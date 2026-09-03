#!/usr/bin/env bash
#
# One update-openshell tick, run from INSIDE the long-lived orchestrator sandbox.
#
# Flow:
#   1. bring up gwbridge (loopback TLS -> CONNECT proxy -> gateway, ALPN h2)
#   2. register the gateway at the loopback bridge + service-account login
#   3. create ONE child sandbox from the custom image, attach the single
#      update-openshell provider (fork-scoped GitHub write + Go-proxy + registry
#      egress). Inference is gateway-level (`inference set`), not a per-sandbox
#      provider. run-skill.sh is already baked into the child image at
#      /opt/updater/run-skill.sh (same image, both roles) — no runtime upload.
#   4. exec the baked skill runner in the child, detached, and poll to completion
#   5. delete the child (always, best effort)
#
# gRPC to the gateway only works because the sandbox policy marks the gateway
# endpoint `tls: skip` and this bridge injects the correct upstream SNI + h2
# ALPN. See ../README.md and gwbridge (bridge/main.go).
#
# Secrets are read from the environment (inject via a gateway provider in
# production; --env is a prototype-only fallback). Nothing secret is logged.

set -Eeuo pipefail
umask 077

# OPENSHELL_WORKSPACE is NOT required from the environment: `sandbox create --env`
# refuses OPENSHELL_-prefixed keys, so it cannot be injected that way. Default it
# here instead (override by exporting it before launching the scheduler).
OPENSHELL_WORKSPACE="${OPENSHELL_WORKSPACE:-default}"

required=(
  GW_HOST OIDC_ISSUER OIDC_CLIENT_ID OIDC_AUDIENCE SA_CLIENT_SECRET
  CHILD_IMAGE REPOSITORY CHILD_PROVIDER
)
for v in "${required[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    printf 'Required variable %s is empty.\n' "$v" >&2
    exit 1
  fi
done

# Tunables (safe defaults).
GATEWAY_NAME="${GATEWAY_NAME:-updater}"
BRIDGE_LISTEN="${BRIDGE_LISTEN:-127.0.0.1:18443}"
BRIDGE_PROXY="${BRIDGE_PROXY:-10.200.0.1:3128}"
BRIDGE_BIN="${BRIDGE_BIN:-/usr/local/bin/gwbridge}"
CHILD_NAME="${CHILD_NAME:-uosh-$(date -u +%y%m%d)}"   # sandbox names must be <=19 chars
CHILD_POLICY="${CHILD_POLICY:-/opt/updater/child-policy.yaml}"
# run-skill.sh is baked into the child image at this path (same image, both roles),
# so it is executed in place — no runtime upload (which would land it in a dir).
CHILD_SKILL_SCRIPT="${CHILD_SKILL_SCRIPT:-/opt/updater/run-skill.sh}"
SANDBOX_READY_TIMEOUT_SECONDS="${SANDBOX_READY_TIMEOUT_SECONDS:-180}"
# A real skill run now actually executes `go build/vet/test` + `make check`, which
# can approach an hour, so the wall-clock budget is generous.
SKILL_TIMEOUT_SECONDS="${SKILL_TIMEOUT_SECONDS:-7200}"
SKILL_POLL_SECONDS="${SKILL_POLL_SECONDS:-15}"
# The SA gateway token has a finite TTL (~1h). A tick can outlive it, after which
# the orchestrator can no longer poll or delete the child. Re-login this often to
# keep the token fresh for the whole tick. gwbridge stays up, so re-login is cheap.
SA_RELOGIN_INTERVAL_SECONDS="${SA_RELOGIN_INTERVAL_SECONDS:-1800}"
# Hard wall-clock cap for a SINGLE child-facing openshell call. A busy child can
# STARVE `sandbox exec` so the CLI's own --timeout is not honored and the call
# blocks forever — which would prevent SKILL_TIMEOUT_SECONDS from ever firing.
CHILD_EXEC_TIMEOUT_SECONDS="${CHILD_EXEC_TIMEOUT_SECONDS:-45}"

export OPENSHELL_GATEWAY="$GATEWAY_NAME"
export OPENSHELL_WORKSPACE
export OPENSHELL_NO_BROWSER=1
export OPENSHELL_GATEWAY_INSECURE=true
export RUST_LOG="${RUST_LOG:-warn,openshell_cli::tls=error}"

# Isolated openshell config so concurrent/leftover state can't leak in.
CONFIG_ROOT="${CONFIG_ROOT:-/sandbox/updater-config}"
export HOME="$CONFIG_ROOT/home"
export XDG_CONFIG_HOME="$CONFIG_ROOT/config"
export XDG_STATE_HOME="$CONFIG_ROOT/state"
mkdir -p "$HOME" "$XDG_CONFIG_HOME" "$XDG_STATE_HOME"

BRIDGE_PID=""
CREATE_PID=""
READY_FILE="$CONFIG_ROOT/bridge.ready"
BRIDGE_LOG="$CONFIG_ROOT/bridge.log"
CHILD_READY_MARKER=/tmp/child-ready

# Persistent tick history, served over HTTP by status-server.py. Lives on the
# read-write /sandbox mount so it survives across ticks (and orchestrator
# restarts). One JSON object per tick is appended on exit (see record_tick).
STATE_DIR="${STATE_DIR:-/sandbox/updater-state}"
HISTORY_FILE="$STATE_DIR/ticks.jsonl"
mkdir -p "$STATE_DIR"

# Per-tick timing/outcome, filled in as the tick runs and recorded on exit.
TICK_START_TS=$(date +%s)
TICK_START_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ANALYSIS_SECONDS=-1     # skill (claude) wall-clock; -1 until the skill launches
PR_URL=""               # best-effort, extracted from the child skill log

log() { printf '%s run-tick: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# Every child-facing openshell call goes through this hard wall-clock cap
# (SIGTERM after N seconds, SIGKILL 10s later). Guarantees the caller regains
# control even when `sandbox exec` is starved by a busy child. Exit 124 = timed
# out; callers treat that like any other transient poll failure.
os_child() { timeout -k 10 "$CHILD_EXEC_TIMEOUT_SECONDS" openshell "$@"; }

# Service-account (client-credentials) login. Called once at startup and again
# periodically during the poll loop + before the cleanup delete, so an expired
# token can never leave the orchestrator unable to manage/delete its child.
sa_login() {
  OPENSHELL_OIDC_CLIENT_SECRET="$SA_CLIENT_SECRET" \
    timeout 60 openshell gateway login "$GATEWAY_NAME" >/dev/null 2>&1
}

# Append one JSON line describing this tick to the history file that the status
# server serves. Called from cleanup with the final exit status: 0=success,
# 124=timeout (skill did not finish in budget), anything else=failed.
record_tick() {
  local exit_code="$1" outcome tick_end_ts tick_end_iso duration
  case "$exit_code" in
    0)   outcome=success ;;
    124) outcome=timeout ;;
    *)   outcome=failed ;;
  esac
  tick_end_ts=$(date +%s)
  tick_end_iso=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  duration=$(( tick_end_ts - TICK_START_TS ))
  # Controlled fields only (ISO timestamps, integers, our own names) — no need to
  # JSON-escape. PR_URL matches a strict github URL regex; REPOSITORY is validated.
  printf '{"tick_start":"%s","tick_end":"%s","duration_seconds":%d,"analysis_seconds":%d,"status":"%s","exit_code":%d,"child":"%s","repository":"%s","pr_url":"%s"}\n' \
    "$TICK_START_ISO" "$tick_end_iso" "$duration" "$ANALYSIS_SECONDS" \
    "$outcome" "$exit_code" "$CHILD_NAME" "$REPOSITORY" "$PR_URL" \
    >>"$HISTORY_FILE" 2>/dev/null || true
  log "tick recorded: status=$outcome duration=${duration}s analysis=${ANALYSIS_SECONDS}s pr=${PR_URL:-none}"
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  # Record the tick outcome/timing first, so it is captured even if the delete
  # below is slow or fails. PR_URL/ANALYSIS_SECONDS were set by run_skill.
  record_tick "$status"
  # Refresh the SA token first: a long tick can outlive it, and an expired token
  # makes `sandbox delete` fail auth (leaving the child to linger). Best-effort —
  # if it fails, the delete below still tries and the WARNING is the backstop.
  sa_login || true
  # Delete the child sandbox best-effort so nothing lingers between days. Capped
  # so a starved delete can't wedge the trap (retry once after a short pause).
  if os_child sandbox delete "$CHILD_NAME" >/dev/null 2>&1 \
     || { sleep 5; os_child sandbox delete "$CHILD_NAME" >/dev/null 2>&1; }; then
    log "deleted child sandbox $CHILD_NAME"
  else
    log "WARNING: could not delete child sandbox $CHILD_NAME (delete it manually)" >&2
  fi
  if [[ -n "$BRIDGE_PID" ]]; then
    kill "$BRIDGE_PID" 2>/dev/null || true
    wait "$BRIDGE_PID" 2>/dev/null || true
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

start_bridge() {
  rm -f "$READY_FILE"
  BRIDGE_LISTEN="$BRIDGE_LISTEN" \
  BRIDGE_TARGET="$GW_HOST:443" \
  BRIDGE_PROXY="$BRIDGE_PROXY" \
  BRIDGE_READY="$READY_FILE" \
    "$BRIDGE_BIN" >"$BRIDGE_LOG" 2>&1 &
  BRIDGE_PID=$!
  local deadline=$((SECONDS + 15))
  until [[ -f "$READY_FILE" ]]; do
    if ! kill -0 "$BRIDGE_PID" 2>/dev/null; then
      log "gwbridge exited early:" >&2; cat "$BRIDGE_LOG" >&2; return 1
    fi
    (( SECONDS >= deadline )) && { log "gwbridge not ready in time" >&2; return 1; }
    sleep 0.25
  done
  log "gwbridge up (pid $BRIDGE_PID)"
}

configure_gateway() {
  # `gateway add` may block trying to start an interactive login even with
  # OPENSHELL_NO_BROWSER=1; the registration itself still lands. Cap it and move
  # on — the explicit service-account `gateway login` below is what authenticates.
  timeout 20 openshell gateway add "https://$BRIDGE_LISTEN" \
    --name "$GATEWAY_NAME" \
    --oidc-issuer "$OIDC_ISSUER" \
    --oidc-client-id "$OIDC_CLIENT_ID" \
    --oidc-audience "$OIDC_AUDIENCE" >/dev/null 2>&1 || true
  sa_login || { log "service-account login failed" >&2; return 1; }
  log "authenticated service account to gateway"
}

create_child() {
  log "creating child sandbox $CHILD_NAME from $CHILD_IMAGE"
  openshell sandbox create \
    --name "$CHILD_NAME" \
    --from "$CHILD_IMAGE" \
    --keep \
    --provider "$CHILD_PROVIDER" \
    --policy "$CHILD_POLICY" \
    --label managed-by=update-openshell \
    --no-auto-providers \
    --no-tty \
    -- /usr/bin/bash -c \
      'printf ready >"$1"; exec /usr/bin/tail --follow /dev/null' \
      bash "$CHILD_READY_MARKER" >"$CONFIG_ROOT/create.log" 2>&1 &
  CREATE_PID=$!

  local deadline=$((SECONDS + SANDBOX_READY_TIMEOUT_SECONDS))
  until os_child sandbox exec --name "$CHILD_NAME" --timeout 10 --no-tty \
      /usr/bin/bash -c '[[ -r "$1" ]]' bash "$CHILD_READY_MARKER" >/dev/null 2>&1; do
    if ! kill -0 "$CREATE_PID" 2>/dev/null; then
      log "child create exited before ready:" >&2; cat "$CONFIG_ROOT/create.log" >&2; return 1
    fi
    (( SECONDS >= deadline )) && { log "child not ready in time" >&2; return 1; }
    sleep 2
  done
  log "child sandbox ready"
}

run_skill() {
  local log_file=/tmp/skill.log status_file=/tmp/skill.status status_tmp=/tmp/skill.status.tmp
  local detached
  read -r -d '' detached <<'EOF' || true
umask 077
trap '' HUP
exec </dev/null >/dev/null 2>&1
set +e
/usr/bin/bash "$4" >"$1" 2>&1
printf '%s\n' "$?" >"$2"
/usr/bin/mv "$2" "$3"
EOF

  log "launching update-openshell skill in child (detached)"
  os_child sandbox exec --name "$CHILD_NAME" --timeout 30 --no-tty \
    --env "REPOSITORY=$REPOSITORY" \
    --env CI=true --env DISABLE_AUTOUPDATER=1 \
    /usr/bin/setsid --fork /usr/bin/bash -c "$detached" \
    bash "$log_file" "$status_tmp" "$status_file" "$CHILD_SKILL_SCRIPT"

  # Mark the start of the analysis (the skill/claude run) so its wall-clock can be
  # reported separately from the tick's bridge/child-setup overhead.
  local skill_launch=$((SECONDS))
  ANALYSIS_SECONDS=0

  # Poll for completion. Each poll is hard-capped by os_child, so even if the
  # child starves `sandbox exec` the loop still advances and SKILL_TIMEOUT_SECONDS
  # is honored; on timeout we return 124 and the EXIT trap deletes the child.
  local deadline=$((SECONDS + SKILL_TIMEOUT_SECONDS)) remote
  local next_relogin=$((SECONDS + SA_RELOGIN_INTERVAL_SECONDS))
  while (( SECONDS < deadline )); do
    # Keep the SA token fresh so a tick longer than the token TTL can still poll
    # and (later) delete the child.
    if (( SECONDS >= next_relogin )); then
      sa_login || log "periodic SA re-login failed (will retry next interval)" >&2
      next_relogin=$((SECONDS + SA_RELOGIN_INTERVAL_SECONDS))
    fi
    remote=$(os_child sandbox exec --name "$CHILD_NAME" --timeout 30 --no-tty \
      /usr/bin/bash -c 'if [[ -r "$1" ]]; then cat "$1"; else printf running; fi' \
      bash "$status_file" 2>/dev/null || printf 'poll-error')
    if [[ "$remote" =~ ^[0-9]+$ ]]; then
      ANALYSIS_SECONDS=$(( SECONDS - skill_launch ))
      local child_log
      child_log=$(os_child sandbox exec --name "$CHILD_NAME" --timeout 60 --no-tty \
        /usr/bin/cat "$log_file" 2>/dev/null || true)
      printf '%s\n' "$child_log"
      # Best-effort PR URL for the tick history (skill prints it on success).
      PR_URL=$(printf '%s' "$child_log" \
        | grep -oiE 'https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+' \
        | head -1 || true)
      log "skill finished with status $remote (analysis ${ANALYSIS_SECONDS}s)"
      return "$remote"
    fi
    sleep "$SKILL_POLL_SECONDS"
  done
  ANALYSIS_SECONDS=$(( SECONDS - skill_launch ))
  log "skill did not finish within ${SKILL_TIMEOUT_SECONDS}s; aborting (child will be deleted)" >&2
  return 124
}

start_bridge
configure_gateway
openshell whoami >/dev/null
create_child
run_skill
