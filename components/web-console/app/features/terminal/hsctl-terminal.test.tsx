import { act, render, screen, waitFor } from "@testing-library/react";
import { forwardRef, useEffect, useImperativeHandle } from "react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";

import {
  CommandRunnerUnavailableError,
  type CommandRunner,
} from "../../application/terminal/command-runner";
import { englishMessages } from "../../i18n/catalog";
import { HsctlTerminal } from "./hsctl-terminal";

// The real emulator needs layout and WebAssembly. This stand-in records what
// the page writes, lets the test type into it, and exposes the emulator
// instance the page drives: its element, auto-resize flag, fit and focus.
interface FakeInstance {
  autoResize: boolean;
  element: HTMLElement;
  fit: () => void;
  focus: () => void;
}

const fakeTerminal = vi.hoisted(() => {
  const state: {
    screen: string;
    type: (data: string) => void;
    instance: FakeInstance | undefined;
    // Whether the emulator stylesheet has applied, and whether the element
    // is in the page, when the emulator reports ready.
    styled: boolean;
    connected: boolean;
  } = {
    screen: "",
    type: () => undefined,
    instance: undefined,
    styled: true,
    connected: true,
  };
  return state;
});

vi.mock("@wterm/react", () => ({
  Terminal: forwardRef<
    unknown,
    { onData?: (data: string) => void; onReady?: (instance: unknown) => void }
  >(function FakeTerminal({ onData, onReady }, ref) {
    useImperativeHandle(ref, () => ({
      focus: () => undefined,
      get instance() {
        return fakeTerminal.instance;
      },
      write: (data: string) => {
        fakeTerminal.screen += data;
      },
    }));
    useEffect(() => {
      fakeTerminal.type = (data) => onData?.(data);
    }, [onData]);
    useEffect(() => {
      const element = document.createElement("div");
      if (fakeTerminal.styled) {
        element.style.setProperty("--term-bg", "#000");
      }
      if (fakeTerminal.connected) {
        document.body.appendChild(element);
      }
      fakeTerminal.instance = {
        autoResize: true,
        element,
        fit: vi.fn(),
        focus: vi.fn(),
      };
      onReady?.(fakeTerminal.instance);
      return () => {
        element.remove();
      };
    }, [onReady]);
    return <div data-testid="terminal" />;
  }),
}));

function terminalTree(runner: CommandRunner, isVisible = true) {
  return (
    <IntlProvider locale="en" messages={englishMessages}>
      <HsctlTerminal isVisible={isVisible} runner={runner} />
    </IntlProvider>
  );
}

function renderTerminal(runner: CommandRunner, isVisible = true) {
  fakeTerminal.screen = "";
  fakeTerminal.styled = true;
  fakeTerminal.connected = true;
  return render(terminalTree(runner, isVisible));
}

function fakeRunner(
  run: (argv: readonly string[], output: (text: string) => void) => number,
): CommandRunner {
  let output: (text: string) => void = () => undefined;
  return {
    start: (listener) => {
      output = listener;
      return Promise.resolve({ version: "1.2.3" });
    },
    run: (argv) => Promise.resolve(run(argv, output)),
  };
}

async function typeLine(line: string) {
  await act(async () => {
    fakeTerminal.type(`${line}\r`);
    await Promise.resolve();
  });
}

describe("HsctlTerminal", () => {
  it("runs hsctl commands and shows their output", async () => {
    const run = vi.fn(
      (argv: readonly string[], output: (t: string) => void) => {
        output(`ran ${argv.join(" ")}`);
        return 0;
      },
    );
    renderTerminal(fakeRunner(run));
    await waitFor(() => {
      expect(fakeTerminal.screen).toContain("hsctl 1.2.3 is running");
    });

    await typeLine("hsctl list gateways --search \"name = 'a'\"");
    await waitFor(() => {
      expect(run).toHaveBeenCalledWith(
        ["list", "gateways", "--search", "name = 'a'"],
        expect.any(Function),
      );
    });
    // Output without a final newline still ends before the next prompt.
    await waitFor(() => {
      expect(fakeTerminal.screen).toContain(
        "ran list gateways --search name = 'a'\r\n$ ",
      );
    });
  });

  it("handles built-in commands and rejects other programs", async () => {
    const run = vi.fn(() => 0);
    renderTerminal(fakeRunner(run));
    await waitFor(() => {
      expect(fakeTerminal.screen).toContain("$ ");
    });

    await typeLine("help");
    await waitFor(() => {
      expect(fakeTerminal.screen).toContain("hsctl list gateways");
    });
    await typeLine("ls -l");
    await waitFor(() => {
      expect(fakeTerminal.screen).toContain("ls: command not found");
    });
    await typeLine("hsctl 'open");
    await waitFor(() => {
      expect(fakeTerminal.screen).toContain("quote that is not closed");
    });
    await typeLine("clear");
    await waitFor(() => {
      expect(fakeTerminal.screen).toContain("\u001b[2J");
    });
    await act(async () => {
      fakeTerminal.type("abc\u0003");
      await Promise.resolve();
    });
    expect(fakeTerminal.screen).toContain("^C");
    expect(run).not.toHaveBeenCalled();
  });

  it("prints a runner failure as an error line", async () => {
    const runner: CommandRunner = {
      start: () => Promise.resolve({ version: "1.2.3" }),
      run: () => Promise.reject(new Error("hsctl is not running")),
    };
    renderTerminal(runner);
    await waitFor(() => {
      expect(fakeTerminal.screen).toContain("$ ");
    });
    await typeLine("hsctl version");
    await waitFor(() => {
      expect(fakeTerminal.screen).toContain("Error: hsctl is not running");
    });
  });

  it("explains when this build has no terminal", async () => {
    renderTerminal({
      start: () =>
        Promise.reject(new CommandRunnerUnavailableError("HTTP 404")),
      run: () => Promise.resolve(0),
    });
    expect(
      await screen.findByText(
        "The terminal is not available in this console build",
      ),
    ).toBeTruthy();
    expect(screen.getByText("HTTP 404")).toBeTruthy();
  });

  it("shows what hsctl printed before it stopped", async () => {
    renderTerminal({
      start: (output) => {
        output("error reading /proc/sys/crypto/fips_enabled\n");
        return Promise.reject(new Error("hsctl stopped before it was ready"));
      },
      run: () => Promise.resolve(0),
    });
    expect(await screen.findByText("hsctl could not start")).toBeTruthy();
    expect(
      screen.getByText(/hsctl stopped before it was ready\s+error reading/u),
    ).toBeTruthy();
  });

  it("explains when hsctl fails to start", async () => {
    renderTerminal({
      start: () => Promise.reject(new Error("boom")),
      run: () => Promise.resolve(0),
    });
    expect(await screen.findByText("hsctl could not start")).toBeTruthy();
  });

  it("stops following the panel size while hidden and refits on open", async () => {
    const runner = fakeRunner(() => 0);
    const view = renderTerminal(runner);
    await waitFor(() => {
      expect(fakeTerminal.screen).toContain("$ ");
    });
    const instance = fakeTerminal.instance;
    await waitFor(() => {
      expect(instance?.focus).toHaveBeenCalled();
    });

    view.rerender(terminalTree(runner, false));
    expect(instance?.autoResize).toBe(false);

    vi.mocked(instance?.fit ?? vi.fn()).mockClear();
    view.rerender(terminalTree(runner, true));
    expect(instance?.autoResize).toBe(true);
    await waitFor(() => {
      expect(instance?.fit).toHaveBeenCalled();
    });
  });

  it("waits for the panel to attach the terminal before focusing it", async () => {
    const runner = fakeRunner(() => 0);
    fakeTerminal.screen = "";
    fakeTerminal.styled = true;
    fakeTerminal.connected = false;
    render(terminalTree(runner));
    await waitFor(() => {
      expect(fakeTerminal.screen).toContain("$ ");
    });
    const instance = fakeTerminal.instance;
    expect(instance?.focus).not.toHaveBeenCalled();

    if (instance) {
      document.body.appendChild(instance.element);
    }
    await waitFor(() => {
      expect(instance?.focus).toHaveBeenCalled();
    });
  });

  it("holds output until the emulator stylesheet applies", async () => {
    const runner = fakeRunner(() => 0);
    fakeTerminal.screen = "";
    fakeTerminal.styled = false;
    fakeTerminal.connected = true;
    render(terminalTree(runner));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(fakeTerminal.screen).toBe("");

    fakeTerminal.instance?.element.style.setProperty("--term-bg", "#000");
    await waitFor(() => {
      expect(fakeTerminal.screen).toContain("hsctl 1.2.3 is running");
    });
  });

  it("ignores typing while a command runs and clears on Ctrl+L", async () => {
    let finish: (code: number) => void = () => undefined;
    const runner: CommandRunner = {
      start: () => Promise.resolve({ version: "1.2.3" }),
      run: () =>
        new Promise<number>((resolve) => {
          finish = resolve;
        }),
    };
    renderTerminal(runner);
    await waitFor(() => {
      expect(fakeTerminal.screen).toContain("$ ");
    });

    await typeLine("hsctl list gateways");
    const before = fakeTerminal.screen;
    await act(async () => {
      fakeTerminal.type("ignored");
      await Promise.resolve();
    });
    expect(fakeTerminal.screen).toBe(before);

    await act(async () => {
      finish(0);
      await Promise.resolve();
    });
    await act(async () => {
      fakeTerminal.type("\u000c");
      await Promise.resolve();
    });
    expect(
      fakeTerminal.screen.endsWith("\u001b[2J\u001b[3J\u001b[H\r\u001b[2K$ "),
    ).toBe(true);
  });
});
