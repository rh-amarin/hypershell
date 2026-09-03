#!/usr/bin/env bash
#
# In-sandbox daily scheduler for the update-openshell automation.
#
# The base sandbox image has no crond/supercronic, and a k8s CronJob is
# explicitly NOT wanted here — the whole point of this design is that the
# schedule lives inside a long-lived orchestrator sandbox. So this is a plain
# sleep-until-next-run loop: it wakes once per RUN_INTERVAL_SECONDS (default 24h),
# invokes run-tick.sh, and keeps going regardless of a tick's outcome.
#
# PID 1 of the orchestrator sandbox. Runs run-tick.sh, which brings up the
# gwbridge, logs the service account into the gateway, and drives one child
# sandbox through the update-openshell skill.

set -Eeuo pipefail
umask 077

readonly RUN_INTERVAL_SECONDS="${RUN_INTERVAL_SECONDS:-86400}"
readonly RUN_ON_START="${RUN_ON_START:-true}"
readonly TICK_SCRIPT="${TICK_SCRIPT:-/opt/updater/run-tick.sh}"

# Persistent state shared with the status server (survives across ticks on the
# read-write /sandbox mount). run-tick.sh appends one JSON line per tick to
# $STATE_DIR/ticks.jsonl; the scheduler tees its own + the tick's output to
# $STATE_DIR/scheduler.log. status-server.py serves both over a loopback port
# that an operator publishes with `openshell service expose <orch> $STATUS_PORT`.
export STATE_DIR="${STATE_DIR:-/sandbox/updater-state}"
export STATUS_PORT="${STATUS_PORT:-8080}"
readonly STATUS_SERVER="${STATUS_SERVER:-/opt/updater/status-server.py}"
readonly LOG_FILE="$STATE_DIR/scheduler.log"
mkdir -p "$STATE_DIR"

# Log to stdout (sandbox console) AND append to the served log file.
log() {
  printf '%s scheduler: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" \
    | tee -a "$LOG_FILE"
}

if [[ ! "$RUN_INTERVAL_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  log "RUN_INTERVAL_SECONDS is not valid: $RUN_INTERVAL_SECONDS" >&2
  exit 1
fi

# Small, dependency-free status endpoint (python3 stdlib). Kept alive for the
# whole life of the orchestrator; if it ever dies it is not fatal to ticks.
start_status_server() {
  if [[ ! -r "$STATUS_SERVER" ]]; then
    log "status server not found at $STATUS_SERVER (skipping)" >&2
    return 0
  fi
  python3 "$STATUS_SERVER" >>"$LOG_FILE" 2>&1 &
  log "status server started (loopback :$STATUS_PORT; expose with 'openshell service expose')"
}

run_tick() {
  log "starting update-openshell tick"
  # Tee the tick's own output into the served log too; keep the tick's real exit
  # status (not tee's) via PIPESTATUS. run-tick.sh records the per-tick JSON line
  # (with the analysis duration) into $STATE_DIR/ticks.jsonl itself.
  /usr/bin/bash "$TICK_SCRIPT" 2>&1 | tee -a "$LOG_FILE"
  local status=${PIPESTATUS[0]}
  if (( status == 0 )); then
    log "tick completed successfully"
  else
    log "tick failed with status $status (continuing; will retry next interval)" >&2
  fi
}

log "daily scheduler up; interval=${RUN_INTERVAL_SECONDS}s run_on_start=${RUN_ON_START}"
start_status_server

if [[ "$RUN_ON_START" == true ]]; then
  run_tick
fi

while true; do
  log "sleeping ${RUN_INTERVAL_SECONDS}s until next tick"
  sleep "$RUN_INTERVAL_SECONDS"
  run_tick
done
