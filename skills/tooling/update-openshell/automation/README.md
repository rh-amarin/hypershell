# update-openshell — daily automation (orchestrator + children, in-sandbox)

A prototype that runs the `skills/tooling/update-openshell/` skill (from
`openshift-online/hypershell`) **once per day**, entirely inside OpenShell
sandboxes — **no Kubernetes CronJob**.

This is the same idea as the `amber-review` app in the `hypershell-gitops` repo
(`clusters/hysh-ibm-01/apps/amber-review/`) but with the schedule and the
orchestration moved *inside* a sandbox: a small
long-lived **orchestrator** sandbox holds the daily timer and, on each tick,
spawns an ephemeral **child** sandbox that actually runs the skill and opens a PR.

> Status: **prototype**. Not wired into GitOps yet. Validated end-to-end against
> gateway `ibm-angel2`.

## Architecture at a glance

Two sandboxes, one gateway, one custom image. The **orchestrator** holds the
daily timer and drives the gateway over gRPC to spawn an ephemeral **child** that
runs the skill and opens a pull request. Everything runs *inside* sandboxes —
there is no Kubernetes CronJob and no long-lived VM.

```
   ADMIN (one-time): SA workspace member · set inference · create provider
                                   │
                                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  OpenShell GATEWAY                                            │
   │  OIDC login · gRPC control plane · inference · egress proxy   │
   └──────────────────────────────────────────────────────────────┘
       ▲  gRPC: create/delete                 ▲  skill egress + inference
       │  (gwbridge + tls:skip)               │  (one provider gates it)
       │                                       │
   ┌───┴───────────────────┐  create   ┌──────┴────────────────────────┐
   │ ORCHESTRATOR sandbox  │ ────────► │ CHILD sandbox (ephemeral)      │
   │  scheduler.sh (daily) │           │  run-skill.sh:                 │
   │   → run-tick.sh       │           │   claude runs the SKILL        │
   │   → gwbridge          │           │   → go build/test → open PR    │
   └───────────────────────┘           └──────┬─────────────────────────┘
                                               ▼
                              PR within fork  rh-amarin/hypershell
                              (branch → main; upstream untouched)
```

The gnarly bit is the left edge: an orchestrator *inside* a sandbox reaching the
gateway's gRPC control plane through the L7 egress proxy. See **Why this was hard**
below, and [`openshell/SETUP.md`](openshell/SETUP.md) for the one-time provisioning.

## Why this was hard (and how it works)

An orchestrator running *inside* a sandbox has to call the OpenShell gateway over
gRPC (HTTP/2) to create/delete child sandboxes. Sandbox egress forces all TCP
through an L7 MITM proxy that pins ALPN to `http/1.1`, which breaks gRPC. Two
pieces unblock it:

1. **`tls: skip`** on the gateway endpoint in the orchestrator policy — disables
   the proxy's TLS interception for that host, giving raw TLS passthrough to the
   real gateway pod (which *does* offer h2). (See NVIDIA/OpenShell#2426.)
2. **`gwbridge`** ([`bridge/main.go`](bridge/main.go)) — a tiny loopback
   TLS-terminating bridge. openshell connects to it on `127.0.0.1:18443`; it
   tunnels out through the CONNECT proxy and opens a fresh upstream TLS session
   with the **correct SNI** (the ALB routes by SNI) and **ALPN `h2`**, then
   splices. gRPC rides through opaquely.

With both in place, `whoami`, `sandbox list`, and — critically — `sandbox
create`/`delete` of child sandboxes all work from inside the orchestrator.

## Layout

This automation lives alongside the skill it runs, under
`skills/tooling/update-openshell/automation/`:

```
automation/
├── bridge/main.go              # gwbridge: loopback TLS -> CONNECT -> gw (h2)
├── image/Dockerfile            # custom image: base + go + openshell + gwbridge + scripts
├── scripts/
│   ├── scheduler.sh            # daily sleep-loop (PID 1 of the orchestrator)
│   ├── run-tick.sh             # one tick: bridge up, SA login, spawn child, run skill, delete
│   └── run-skill.sh            # child: clone fork + `claude -p` the skill -> PR within the fork
├── policies/
│   ├── orchestrator-policy.yaml# gwbridge->gw (tls:skip); openshell->issuer
│   └── child-policy.yaml       # claude->inference; gh/git->github; go->module proxy
├── openshell/
│   ├── provider.yaml           # ONE provider: fork-scoped GitHub write + Go-proxy + registry egress
│   └── SETUP.md                # one-time gateway provisioning (SA, inference, provider)
└── README.md
```

## Data flow

```
[orchestrator sandbox] scheduler.sh (daily)
        └─ run-tick.sh
             ├─ gwbridge  ──TLS/h2──▶ CONNECT proxy ──▶ gateway (tls:skip)
             ├─ openshell gateway login   (service account, client-credentials)
             ├─ openshell sandbox create  ──▶ [child sandbox]
             │                                   └─ run-skill.sh
             │                                        ├─ git clone the bot's fork (rh-amarin/hypershell)
             │                                        ├─ claude -p  (executes update-openshell SKILL.md)
             │                                        │     └─ go build/vet/test + make check
             │                                        └─ push branch + open PR WITHIN the fork
             └─ openshell sandbox delete  (child, always)
```

## Build & push the image

The `go` and `openshell` download checksums are already pinned in
[`image/Dockerfile`](image/Dockerfile) (verified against go.dev and the
NVIDIA/OpenShell release checksums file).

```sh
cd skills/tooling/update-openshell/automation
podman build --platform linux/amd64 \
  -t quay.io/amarin/openshell-updater:$(date +%Y%m%d) \
  -f image/Dockerfile .
podman push quay.io/amarin/openshell-updater:$(date +%Y%m%d)
# capture the pushed digest and use quay.io/amarin/openshell-updater@sha256:... as CHILD_IMAGE / --from
```

**Current build (2026-09-03):**
`quay.io/amarin/openshell-updater@sha256:8721bf598712b3779545b0f8b3b9f8494c61a6eff49163960d1fe821198631c1`
(go1.23.4 + openshell 0.0.109 + skopeo, gwbridge + child-policy.yaml baked in;
base pinned by digest; pull-verified by digest). This is the image that opened a
real fork-only PR through the **full orchestrator path** (see below). The base is
now pinned because `:latest` drifted a newer `claude` CLI that broke inference.

## Provision the gateway

See [`openshell/SETUP.md`](openshell/SETUP.md): make the service account a
workspace member, configure inference, and create the GitHub bot provider. All
secrets are injected at runtime — nothing secret is committed.

## Launch the orchestrator

Create the long-lived orchestrator sandbox from the custom image, with the
orchestrator policy (fill in the two host placeholders), running the scheduler:

```sh
# host = gateway host only (no scheme/port); issuer host for the login lane
openshell --gateway ibm-angel2 --workspace default sandbox create \
  --name update-openshell-orchestrator \
  --from quay.io/amarin/openshell-updater@sha256:... \
  --keep --no-tty \
  --policy policies/orchestrator-policy.yaml \
  --env GW_HOST=... --env OIDC_ISSUER=... --env OIDC_CLIENT_ID=... \
  --env OIDC_AUDIENCE=... --env OPENSHELL_WORKSPACE=default \
  --env CHILD_IMAGE=quay.io/amarin/openshell-updater@sha256:... \
  --env REPOSITORY=rh-amarin/hypershell \
  --env CHILD_PROVIDER=update-openshell \
  -- /usr/bin/bash /opt/updater/scheduler.sh
```

`SA_CLIENT_SECRET` should be injected by a provider in production; `--env` is a
prototype-only fallback (`--env` refuses `OPENSHELL_`-prefixed keys, so the
script maps `SA_CLIENT_SECRET` → `OPENSHELL_OIDC_CLIENT_SECRET` at login time).

## Validated run (full orchestrator path)

Proven end-to-end on `ibm-angel2`. The orchestrator sandbox ran the scheduler,
which on `RUN_ON_START` drove one tick: `gwbridge` up → service-account login to
the gateway *through the bridge* → child sandbox created over gRPC → the child
cloned the fork, ran the skill, and opened a **fork-only** PR:
`rh-amarin/hypershell#2` — "chore(deps): bump OpenShell to v0.0.113-rhaiv.1"
(base and head both `rh-amarin/hypershell`; upstream untouched). The two pinned
image digests match `skopeo inspect` exactly (no hallucination). An earlier
child-only run opened `#1` the same way.

Two caveats, both known and non-blocking for an image-pin bump:

- `go build/vet/test` (and npm) did not run inside the child — the skill reports
  the Go proxy / npm registry as blocked. `make check`'s policy checks passed and
  the change is pure string/digest substitution, so the skill opened the PR. Root
  cause of the go-build-specific egress gap is still undiagnosed (the Go proxy
  *does* answer `go list`, so it is narrower than "no goproxy access").
- The tick's completion poll (`run-tick.sh` execs the child to read a status file)
  can wedge under exec starvation while the child is busy: the PR gets opened but
  the orchestrator may not observe completion to auto-delete the child. Manual
  `sandbox delete` cleans it up. A more robust completion channel is a TODO.

## Notes / limitations

- The orchestrator holds the daily timer in a bash `sleep` loop (the base image
  has no crond). `RUN_INTERVAL_SECONDS` (default 86400) and `RUN_ON_START` tune it.
- One child per tick; the child is always deleted afterward (best effort).
- `gwbridge` is a static, dependency-free Go binary — it replaced an earlier
  Python prototype that was flaky under repeated gRPC channels.
- Egress from a sandbox is gated by *attached providers*, not the network policy
  file alone — every host the child talks to lives in the one `update-openshell`
  provider (see [`openshell/SETUP.md`](openshell/SETUP.md)).
