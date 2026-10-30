#!/usr/bin/env bash
# Builds the browser (WebAssembly) version of hsctl for the console terminal
# page, and copies the Go runtime loader next to it.
#
# Output goes to app/adapters/hsctl/generated/. Vite publishes the files with
# content-hashed names, so browsers never reuse a stale copy. The files are
# generated, so git ignores them. Without them, the terminal panel reports
# that the terminal is not available in this build.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
console_dir="$(dirname "${script_dir}")"
cli_dir="$(cd "${console_dir}/../cli" && pwd)"
out_dir="${console_dir}/app/adapters/hsctl/generated"

mkdir -p "${out_dir}"

goroot="$(go env GOROOT)"
loader="${goroot}/lib/wasm/wasm_exec.js"
if [ ! -f "${loader}" ]; then
  echo "error: Go runtime loader not found at ${loader}" >&2
  exit 1
fi

(
  cd "${cli_dir}"
  # Red Hat Go builds FIPS binaries by default, and a FIPS binary exits in a
  # browser because it can't read /proc. The browser does the TLS anyway.
  GOFIPS140=off GOOS=js GOARCH=wasm go build -trimpath -ldflags='-s -w' \
    -o "${out_dir}/hsctl.wasm" ./cmd/hsctl
)
cp "${loader}" "${out_dir}/wasm_exec.js"

echo "built ${out_dir}/hsctl.wasm ($(wc -c <"${out_dir}/hsctl.wasm" | tr -d ' ') bytes)"
