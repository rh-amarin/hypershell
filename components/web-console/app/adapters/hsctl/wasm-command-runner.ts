import {
  CommandRunnerUnavailableError,
  type CommandRunner,
} from "../../application/terminal/command-runner";

// The global function the Go program calls once it is ready. It must match
// readyCallback in components/cli/cmd/hsctl/main_js.go.
const readyCallback = "hypershellHsctlReady";

interface HsctlApi {
  run(argv: string[]): Promise<number>;
  version: string;
}

// The parts of the Go runtime loader (wasm_exec.js) this adapter uses.
interface GoRuntime {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

interface GoFileSystem {
  writeSync(fd: number, buffer: Uint8Array): number;
}

interface GoGlobals {
  Go?: new () => GoRuntime;
  fs?: GoFileSystem;
  [readyCallback]?: (api: HsctlApi) => void;
}

export interface WasmCommandRunnerOptions {
  /**
   * URLs of the program and of Go's loader script. Their names carry a hash
   * of their content, so a cached copy is never stale. Undefined when this
   * console build does not include them.
   */
  wasmUrl: string | undefined;
  loaderUrl: string | undefined;
  document?: Document;
  fetch?: typeof fetch;
}

function loadScript(doc: Document, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      reject(
        new CommandRunnerUnavailableError(`Can't load the Go runtime ${src}`),
      );
    };
    doc.head.appendChild(script);
  });
}

async function instantiate(
  fetchImpl: typeof fetch,
  url: string,
  imports: WebAssembly.Imports,
): Promise<WebAssembly.Instance> {
  const response = await fetchImpl(url, { credentials: "same-origin" });
  if (!response.ok) {
    throw new CommandRunnerUnavailableError(
      `Can't download ${url}: HTTP ${String(response.status)}`,
    );
  }
  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  return instance;
}

/**
 * Runs the WebAssembly build of hsctl in this tab.
 *
 * Go's loader sends the program's stdout and stderr to a small file-system
 * object, globalThis.fs. The adapter wraps its writeSync to pass that text to
 * the terminal instead of the browser console.
 */
export function createWasmCommandRunner(
  options: WasmCommandRunnerOptions,
): CommandRunner {
  const globals = globalThis as unknown as GoGlobals;
  let output: (text: string) => void = () => undefined;
  let started: Promise<HsctlApi> | undefined;
  let stopped = false;
  let captured = false;

  const captureOutput = (fs: GoFileSystem) => {
    const original = fs.writeSync.bind(fs);
    const decoders = new Map([
      [1, new TextDecoder()],
      [2, new TextDecoder()],
    ]);
    fs.writeSync = (fd, buffer) => {
      const decoder = decoders.get(fd);
      if (!decoder) {
        return original(fd, buffer);
      }
      output(decoder.decode(buffer, { stream: true }));
      return buffer.length;
    };
  };

  const load = async (): Promise<HsctlApi> => {
    const doc = options.document ?? document;
    const fetchImpl = options.fetch ?? fetch;
    const { loaderUrl, wasmUrl } = options;
    if (loaderUrl === undefined || wasmUrl === undefined) {
      throw new CommandRunnerUnavailableError(
        "This console build does not include hsctl",
      );
    }

    if (!globals.Go) {
      await loadScript(doc, loaderUrl);
    }
    const Go = globals.Go;
    if (!Go || !globals.fs) {
      throw new CommandRunnerUnavailableError(
        "The Go runtime loader did not start",
      );
    }
    if (!captured) {
      captureOutput(globals.fs);
      captured = true;
    }

    const go = new Go();
    const instance = await instantiate(fetchImpl, wasmUrl, go.importObject);
    const ready = new Promise<HsctlApi>((resolve) => {
      globals[readyCallback] = resolve;
    });
    const exited = go.run(instance).then(() => {
      stopped = true;
      throw new Error("hsctl stopped before it was ready");
    });
    try {
      return await Promise.race([ready, exited]);
    } finally {
      globals[readyCallback] = undefined;
    }
  };

  return {
    async start(listener) {
      output = listener;
      started ??= load().catch((error: unknown) => {
        started = undefined;
        throw error;
      });
      const api = await started;
      return { version: api.version };
    },
    async run(argv) {
      if (!started || stopped) {
        throw new Error("hsctl is not running");
      }
      const api = await started;
      return api.run([...argv]);
    },
  };
}
