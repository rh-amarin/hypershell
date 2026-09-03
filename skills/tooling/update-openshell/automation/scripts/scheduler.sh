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

log() { printf '%s scheduler: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

if [[ ! "$RUN_INTERVAL_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  log "RUN_INTERVAL_SECONDS is not valid: $RUN_INTERVAL_SECONDS" >&2
  exit 1
fi

run_tick() {
  log "starting update-openshell tick"
  if /usr/bin/bash "$TICK_SCRIPT"; then
    log "tick completed successfully"
  else
    log "tick failed with status $? (continuing; will retry next interval)" >&2
  fi
}

log "daily scheduler up; interval=${RUN_INTERVAL_SECONDS}s run_on_start=${RUN_ON_START}"

if [[ "$RUN_ON_START" == true ]]; then
  run_tick
fi

while true; do
  log "sleeping ${RUN_INTERVAL_SECONDS}s until next tick"
  sleep "$RUN_INTERVAL_SECONDS"
  run_tick
done
