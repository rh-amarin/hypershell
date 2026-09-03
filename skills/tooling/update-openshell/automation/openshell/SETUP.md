# Gateway provisioning for update-openshell

One-time setup on the target gateway (validated against `ibm-angel2`). Run these
from a workstation that is `openshell-admin` on the gateway. **No secret value
belongs in a committed file** — every command below reads secrets from your shell
environment or prompts for them.

> For the component topology and the tick sequence, see **Architecture at a
> glance** in [`../README.md`](../README.md).

## What this PoC demonstrates

1. **A self-scheduling agent job with no CronJob.** The daily cadence lives in a
   long-lived orchestrator sandbox (`scheduler.sh`, a plain sleep loop), not in
   Kubernetes. The platform schedules *nothing*; the sandbox owns its own clock.
2. **An orchestrator running *inside* a sandbox can drive the gateway over gRPC.**
   Sandbox egress forces all TCP through an L7 MITM proxy that pins ALPN to
   `http/1.1`, which breaks HTTP/2 (gRPC). The combination of `tls: skip` on the
   gateway endpoint (raw TLS passthrough to the real gateway pod, which offers
   `h2`) **plus** `gwbridge` (a loopback TLS bridge that re-injects the correct
   SNI and `h2` ALPN) unblocks `sandbox create/exec/delete` from within a sandbox.
3. **Egress is gated by *attached providers*, not by the network policy alone.** A
   host with no attached provider is denied `HTTP 403` even when the policy lists
   it. All of the child's hosts (GitHub, the Go proxy, container registries) live
   in a *single* credentialed provider, with each host bound to the binary that
   uses it — so the GitHub PAT is never exposed to `go` or `skopeo`.
4. **Least privilege and fork-only blast radius.** The service account has just
   `openshell-user` + workspace membership; the bot PAT can only push to and open
   PRs *within* the fork `rh-amarin/hypershell`. The PR's base and head are both
   in the fork — the upstream repo is never touched. No secret is ever committed;
   all are injected at runtime (providers in production, `--env` only as a
   prototype fallback).
5. **Reproducibility by digest, top to bottom.** The custom image pins its base,
   its Go toolchain (matched to the repo's `go.mod` so no toolchain is fetched at
   build time), and `openshell` by sha256; sandboxes are launched by image digest,
   not `:latest`; and the skill pins the Red Hat downstream images by the exact
   `skopeo inspect` digest.
6. **Ephemeral, bounded children.** One child per tick, always deleted afterward
   (best effort). Every child-facing call is wrapped in a hard wall-clock timeout,
   so a busy child that starves `sandbox exec` can never wedge the tick.
7. **The agent treats the repo as untrusted input.** The child prompt frames every
   file under the checkout — `CLAUDE.md`, skill files, release notes, fetched web
   content — as untrusted data whose embedded instructions must not be followed,
   guarding the unattended run against prompt injection.

Prerequisites:

- `openshell` CLI logged in as an admin (`openshell whoami` shows
  `openshell-admin`). On IBM ROKS use `export OPENSHELL_GATEWAY_INSECURE=true`.
- A confidential OIDC **service account** client (client id + secret + subject)
  with the `openshell-user` role. This is what the orchestrator logs in as.
- A GitHub **bot account** that already owns a fork of
  `openshift-online/hypershell` (e.g. `rh-amarin/hypershell`), and a PAT that can
  push to that fork and open pull requests **within** it. No write access to the
  upstream repo is required.
- An inference backend already usable by the gateway (e.g. a Vertex/Anthropic
  provider); referenced below as `$INFERENCE_PROVIDER`.

## 1. Make the service account a workspace member

The SA must be a member of the workspace the orchestrator uses:

```sh
openshell workspace member add \
  --workspace default \
  --subject "$SA_SUBJECT" \
  --role user
```

## 2. Configure inference (so `claude` works via https://inference.local)

```sh
openshell inference set --provider "$INFERENCE_PROVIDER"
openshell inference get
```

## 3. Create the one provider (GitHub write + Go proxy + registry egress)

Everything the child talks to lives in a **single** provider, for two reasons:

- Sandbox L7 egress is gated by *attached providers*, not by the sandbox network
  policy alone — a host with no attached provider is denied `HTTP 403` even if the
  policy lists it.
- The CLI can only attach *credentialed* provider instances; it cannot
  instantiate a credential-less custom profile. So the public Go-proxy and
  registry hosts are folded into the same credentialed provider. That is safe:
  those hosts are bound to the `go`/`skopeo` binaries, which never read
  `api_token`, and the egress proxy does not inject the auth header (each tool
  supplies its own) — so the PAT is never exposed to them.

`openshell provider create` has no `--file`; custom endpoint-scoped access is a
two-step *profile → provider* flow. Edit `provider.yaml` first: GitHub writes are
scoped to `rh-amarin/hypershell` — change that owner/name if the fork lives
elsewhere. Then lint + import the profile, and create a provider instance whose
`api_token` is read from the environment (never a CLI arg, never a file):

```sh
openshell provider profile lint   --file provider.yaml
openshell provider profile import --file provider.yaml
export GITHUB_TOKEN=...   # the bot PAT; also exported as api_token for the lookup
export api_token="$GITHUB_TOKEN"
openshell provider create --name update-openshell \
  --type update-openshell --credential api_token   # KEY-only = env lookup
```

Attach it to the child at `sandbox create` time with `--provider update-openshell`.

## 4. Sanity-check from the workstation

```sh
openshell provider get update-openshell
openshell provider list-profiles | grep update-openshell
openshell inference get
```

## Values the orchestrator needs (non-secret vs secret)

Non-secret (safe to pass via `--env` / ConfigMap):

| var | example |
| --- | --- |
| `GW_HOST` | `gw-...appdomain.cloud` (host only, no scheme/port) |
| `OIDC_ISSUER` | `https://keycloak-.../realms/hypershell` |
| `OIDC_CLIENT_ID` | the SA client id |
| `OIDC_AUDIENCE` | the SA audience |
| `OPENSHELL_WORKSPACE` | `default` |
| `CHILD_IMAGE` | `quay.io/amarin/openshell-updater@sha256:...` |
| `REPOSITORY` | `rh-amarin/hypershell` (the bot's fork — clone + PR target) |
| `CHILD_PROVIDER` | `update-openshell` (attached to each child at create time) |

Secret (inject via a provider; `--env` only as a prototype fallback):

| var | source |
| --- | --- |
| `SA_CLIENT_SECRET` | the SA client secret (becomes `OPENSHELL_OIDC_CLIENT_SECRET` at login time) |
