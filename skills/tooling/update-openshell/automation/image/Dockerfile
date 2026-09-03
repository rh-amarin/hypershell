# Custom sandbox image for the update-openshell daily automation.
#
# One image serves both roles:
#   * orchestrator sandbox — runs the in-sandbox scheduler + gwbridge + openshell
#     CLI to spawn/delete child sandboxes over gRPC (via the bridge);
#   * child sandbox — runs the update-openshell skill, which needs a full Go
#     toolchain + make + python to do real `go build/vet/test` and `make check`.
#
# Build + push (single-arch amd64, which is what the IBM ROKS nodes run):
#   podman build --platform linux/amd64 \
#     -t quay.io/amarin/openshell-updater:<tag> -f image/Dockerfile .
#   podman push quay.io/amarin/openshell-updater:<tag>
# Then reference by DIGEST in the sandbox `--from` (pin, never :latest).

# ---- stage 1: build the Go TLS bridge as a static binary ----
FROM docker.io/library/golang:1.26-bookworm AS bridge-build
WORKDIR /src
COPY bridge/go.mod ./
COPY bridge/main.go ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" -o /out/gwbridge .

# ---- stage 2: final sandbox image ----
# Pin the base by digest: `:latest` drifts, and a newer bundled `claude` CLI
# changed request shape (started sending output_config.effort, which the Vertex
# inference backend rejects). Pinning keeps the toolchain reproducible.
# (tag at pin time: :latest -> claude 2.1.156)
FROM ghcr.io/nvidia/openshell-community/sandboxes/base@sha256:c2a43bb0d765774e2790b3babfb20997bb2eac7b4bf4c6d7d8661e99817bf904

# Pin every downloaded artifact by version + sha256 (verified at build time).
ARG OPENSHELL_VERSION=0.0.109
ARG OPENSHELL_SHA256_X86_64=4e2db09d50e764cf92437a523f2074c884c743598b543a1194a49b35f5f73ed5
# Match the repo's go.mod (`go 1.26.4` / `toolchain go1.26.7`). If the local Go
# is older, `go` auto-downloads the golang.org/toolchain module, which is ALWAYS
# checksum-DB verified — that forces GOSUMDB=on, and under the sandbox's MITM
# egress the resulting request burst makes proxy.golang.org 403 ~150 modules.
# Shipping a Go that already satisfies go.mod (with GOTOOLCHAIN=local below) means
# no toolchain fetch, so GOSUMDB can stay off and modules download cleanly.
# Bump this in lockstep when the repo raises its required Go (a loud build error).
ARG GO_VERSION=1.26.7
ARG GO_SHA256_AMD64=ffb5f8de10c62550dfddab66b36b57030721e0a44a3218e9e1181d7b59f121ca

USER root

# skopeo resolves container image digests (`skopeo inspect docker://...`), which
# the update-openshell skill needs to pin the Red Hat downstream images by
# sha256. Not present in the base image.
# NB: do not execute skopeo here — building amd64 under qemu emulation crashes
# the (Go) binary; it runs fine natively on the amd64 ROKS nodes. Just verify the
# file is present and executable.
RUN set -eux; \
    export DEBIAN_FRONTEND=noninteractive; \
    apt-get update; \
    apt-get install -y --no-install-recommends skopeo; \
    rm -rf /var/lib/apt/lists/*; \
    test -x /usr/bin/skopeo

# Go toolchain for `go build/vet/test` + `make check` in the skill.
RUN set -eux; \
    curl -fsSL -o /tmp/go.tgz \
      "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz"; \
    echo "${GO_SHA256_AMD64}  /tmp/go.tgz" | sha256sum -c -; \
    tar -C /usr/local -xzf /tmp/go.tgz; \
    rm -f /tmp/go.tgz; \
    /usr/local/go/bin/go version
ENV PATH=/usr/local/go/bin:/usr/local/bin:$PATH \
    GOTOOLCHAIN=local

# openshell CLI (orchestrator uses it to manage child sandboxes).
RUN set -eux; \
    curl -fsSL -o /tmp/os.tgz \
      "https://github.com/NVIDIA/OpenShell/releases/download/v${OPENSHELL_VERSION}/openshell-x86_64-unknown-linux-musl.tar.gz"; \
    echo "${OPENSHELL_SHA256_X86_64}  /tmp/os.tgz" | sha256sum -c -; \
    tar -C /usr/local/bin -xzf /tmp/os.tgz openshell; \
    chmod 0555 /usr/local/bin/openshell; \
    rm -f /tmp/os.tgz; \
    openshell --version

# The gwbridge binary at a fixed path the orchestrator policy allowlists.
COPY --from=bridge-build /out/gwbridge /usr/local/bin/gwbridge
RUN chmod 0555 /usr/local/bin/gwbridge

# Runner scripts (baked in; not uploaded at runtime for the orchestrator).
COPY scripts/scheduler.sh     /opt/updater/scheduler.sh
COPY scripts/run-tick.sh      /opt/updater/run-tick.sh
COPY scripts/run-skill.sh     /opt/updater/run-skill.sh
# Dependency-free (python3 stdlib) status endpoint the scheduler starts to serve
# the tick history over a loopback port (published via `openshell service expose`).
COPY scripts/status-server.py /opt/updater/status-server.py
RUN chmod 0555 /opt/updater/*.sh /opt/updater/status-server.py

# Child sandbox policy, baked at the path run-tick.sh passes to `sandbox create`.
# One image serves both roles, so the orchestrator carries the child's policy too.
COPY policies/child-policy.yaml /opt/updater/child-policy.yaml
RUN chmod 0444 /opt/updater/child-policy.yaml

USER 1000730000
