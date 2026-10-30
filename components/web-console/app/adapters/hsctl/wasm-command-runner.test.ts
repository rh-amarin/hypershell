import { afterEach, describe, expect, it, vi } from "vitest";

import { CommandRunnerUnavailableError } from "../../application/terminal/command-runner";
import { createWasmCommandRunner } from "./wasm-command-runner";

// The smallest valid WebAssembly module.
const emptyModule = Uint8Array.from([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
]);

interface FakeGlobals {
  Go?: unknown;
  fs?: { writeSync(fd: number, buffer: Uint8Array): number };
  hypershellHsctlReady?: (api: unknown) => void;
}

const globals = globalThis as unknown as FakeGlobals;
const encoder = new TextEncoder();

// Stands in for wasm_exec.js and the Go program: on run() it calls the ready
// callback, and run(argv) writes to stdout through the file-system shim.
function installFakeGo(run: (argv: string[]) => number) {
  const consoleWrites: number[] = [];
  globals.fs = {
    writeSync(fd: number, buffer: Uint8Array) {
      consoleWrites.push(fd);
      return buffer.length;
    },
  };
  globals.Go = class {
    importObject = {};
    run(): Promise<void> {
      globals.hypershellHsctlReady?.({
        run: (argv: string[]) => Promise.resolve(run(argv)),
        version: "1.2.3",
      });
      return new Promise(() => undefined);
    }
  };
  return { consoleWrites };
}

function wasmFetch(status = 200) {
  return vi
    .fn<typeof fetch>()
    .mockImplementation(() =>
      Promise.resolve(
        new Response(status === 200 ? emptyModule : "", { status }),
      ),
    );
}

afterEach(() => {
  delete globals.Go;
  delete globals.fs;
});

describe("wasm command runner", () => {
  it("starts the program and sends stdout and stderr to the listener", async () => {
    const { consoleWrites } = installFakeGo((argv) => {
      globals.fs?.writeSync(1, encoder.encode(`ran ${argv.join(" ")}\n`));
      globals.fs?.writeSync(2, encoder.encode("warn\n"));
      globals.fs?.writeSync(3, encoder.encode("other\n"));
      return 0;
    });
    const fetchImpl = wasmFetch();
    const runner = createWasmCommandRunner({
      loaderUrl: "/assets/wasm_exec-abc.js",
      wasmUrl: "/assets/hsctl-abc.wasm",
      fetch: fetchImpl,
    });
    const output: string[] = [];

    await expect(runner.start((text) => output.push(text))).resolves.toEqual({
      version: "1.2.3",
    });
    await expect(runner.run(["list", "gateways"])).resolves.toBe(0);

    expect(fetchImpl).toHaveBeenCalledWith("/assets/hsctl-abc.wasm", {
      credentials: "same-origin",
    });
    expect(output.join("")).toBe("ran list gateways\nwarn\n");
    // Other descriptors still reach Go's own handler.
    expect(consoleWrites).toEqual([3]);
    expect(globals.hypershellHsctlReady).toBeUndefined();
  });

  it("loads the program once", async () => {
    installFakeGo(() => 0);
    const fetchImpl = wasmFetch();
    const runner = createWasmCommandRunner({
      loaderUrl: "/assets/wasm_exec-abc.js",
      wasmUrl: "/assets/hsctl-abc.wasm",
      fetch: fetchImpl,
    });
    await runner.start(() => undefined);
    await runner.start(() => undefined);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports a build without the program as unavailable, and can retry", async () => {
    installFakeGo(() => 0);
    const fetchImpl = wasmFetch(404);
    const runner = createWasmCommandRunner({
      loaderUrl: "/assets/wasm_exec-abc.js",
      wasmUrl: "/assets/hsctl-abc.wasm",
      fetch: fetchImpl,
    });

    await expect(runner.start(() => undefined)).rejects.toBeInstanceOf(
      CommandRunnerUnavailableError,
    );
    await expect(runner.run(["version"])).rejects.toThrow("not running");
    await expect(runner.start(() => undefined)).rejects.toThrow("HTTP 404");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("loads the Go runtime script when it is missing", async () => {
    const appended: HTMLScriptElement[] = [];
    const doc = {
      createElement: () => document.createElement("script"),
      head: {
        appendChild: (script: HTMLScriptElement) => {
          appended.push(script);
          queueMicrotask(() => {
            if (typeof script.onerror === "function") {
              script.onerror(new Event("error"));
            }
          });
          return script;
        },
      },
    } as unknown as Document;
    const runner = createWasmCommandRunner({
      loaderUrl: "/assets/wasm_exec-abc.js",
      wasmUrl: "/assets/hsctl-abc.wasm",
      document: doc,
      fetch: wasmFetch(),
    });

    await expect(runner.start(() => undefined)).rejects.toBeInstanceOf(
      CommandRunnerUnavailableError,
    );
    expect(appended[0]?.src).toContain("/assets/wasm_exec-abc.js");
  });

  it("reports a build without the program files as unavailable", async () => {
    const fetchImpl = wasmFetch();
    const runner = createWasmCommandRunner({
      fetch: fetchImpl,
      loaderUrl: undefined,
      wasmUrl: undefined,
    });

    await expect(runner.start(() => undefined)).rejects.toBeInstanceOf(
      CommandRunnerUnavailableError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
