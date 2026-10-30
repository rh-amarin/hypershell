import { createWasmCommandRunner } from "../adapters/hsctl/wasm-command-runner";

// scripts/build-hsctl-wasm.sh writes these files; git ignores them. Vite
// publishes each under a name that carries a hash of its content. The glob
// finds nothing when they were not built, and the terminal then says so.
const generated = import.meta.glob<string>(
  "../adapters/hsctl/generated/*.{wasm,js}",
  { eager: true, import: "default", query: "?url" },
);

function generatedUrl(name: string): string | undefined {
  return Object.entries(generated).find(([path]) =>
    path.endsWith(`/${name}`),
  )?.[1];
}

/** Host composition root for the in-browser hsctl terminal. */
export const hsctlRunner = createWasmCommandRunner({
  loaderUrl: generatedUrl("wasm_exec.js"),
  wasmUrl: generatedUrl("hsctl.wasm"),
});
