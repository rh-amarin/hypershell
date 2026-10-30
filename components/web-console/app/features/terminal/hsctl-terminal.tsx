import "@wterm/dom/src/terminal.css";

import { Alert, Spinner } from "@patternfly/react-core";
import { Terminal, type TerminalHandle, type WTerm } from "@wterm/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { defineMessages, useIntl } from "react-intl";

import { parseCommandLine } from "../../application/terminal/command-line";
import {
  CommandRunnerUnavailableError,
  type CommandRunner,
} from "../../application/terminal/command-runner";
import { LineEditor, type LineEditorEffect } from "./line-editor";
import styles from "./hsctl-terminal.module.css";

const prompt = "$ ";
const clearScreen = "\u001b[2J\u001b[3J\u001b[H";

export const terminalMessages = defineMessages({
  terminalLabel: {
    id: "app.terminal.ariaLabel",
    defaultMessage: "hsctl terminal",
    description: "Accessible label for the terminal input area.",
  },
  loading: {
    id: "app.terminal.loading",
    defaultMessage: "Loading hsctl",
    description: "Status shown while the hsctl program downloads and starts.",
  },
  unavailableTitle: {
    id: "app.terminal.unavailable.title",
    defaultMessage: "The terminal is not available in this console build",
    description:
      "Alert title shown when the console was built without the hsctl program.",
  },
  failedTitle: {
    id: "app.terminal.failed.title",
    defaultMessage: "hsctl could not start",
    description: "Alert title shown when the hsctl program fails to start.",
  },
  banner: {
    id: "app.terminal.banner",
    defaultMessage:
      "hsctl {version} is running in your browser. Type 'help' for the commands.",
    description:
      "First line printed in the terminal. Keep 'help' untranslated; it is a command name.",
  },
  helpTitle: {
    id: "app.terminal.help.title",
    defaultMessage: "Commands:",
    description: "Heading of the help printed by the terminal 'help' command.",
  },
  helpRun: {
    id: "app.terminal.help.run",
    defaultMessage: "Run hsctl, for example: hsctl list gateways",
    description:
      "Help line for 'hsctl ...'. Keep the example command untranslated.",
  },
  helpHsctl: {
    id: "app.terminal.help.hsctl",
    defaultMessage: "Show hsctl help",
    description: "Help line for 'hsctl help'.",
  },
  helpClear: {
    id: "app.terminal.help.clear",
    defaultMessage: "Clear the screen",
    description: "Help line for the 'clear' command.",
  },
  helpSession: {
    id: "app.terminal.help.session",
    defaultMessage:
      "Your console session signs every request. login, logout, config and whoami are not available here.",
    description:
      "Help note on authentication. Keep the command names untranslated.",
  },
  notFound: {
    id: "app.terminal.notFound",
    defaultMessage:
      "{command}: command not found. Only hsctl commands run here. Type 'help'.",
    description: "Printed when the user types a command other than hsctl.",
  },
  unclosedQuote: {
    id: "app.terminal.unclosedQuote",
    defaultMessage: "The command has a quote that is not closed.",
    description: "Printed when a command line has an unmatched quote.",
  },
});

type Status = "loading" | "ready" | "unavailable" | "failed";

// The emulator's resize observer reads this flag on every size change.
function followContainer(instance: WTerm, follow: boolean) {
  instance.autoResize = follow;
}

export interface HsctlTerminalProps {
  runner: CommandRunner;
  /** False while the surrounding panel is closed: painting pauses. */
  isVisible?: boolean;
}

/**
 * An hsctl terminal that fills its container. The host decides where it
 * lives; it keeps its session for as long as it stays mounted.
 */
export function HsctlTerminal({
  runner,
  isVisible = true,
}: HsctlTerminalProps) {
  const intl = useIntl();
  const terminal = useRef<TerminalHandle>(null);
  const editor = useRef<LineEditor | null>(null);
  const pending = useRef<string[]>([]);
  const terminalReady = useRef(false);
  const busy = useRef(true);
  const lastChar = useRef("\n");
  const [status, setStatus] = useState<Status>("loading");
  const [failure, setFailure] = useState<string>();
  // Output printed before hsctl is ready. If startup fails, it explains why.
  const startupOutput = useRef<string | undefined>("");

  // Program output uses bare newlines. Without a terminal driver to turn them
  // into CR LF, each line would start where the last one ended.
  const write = useCallback((text: string) => {
    if (text === "") {
      return;
    }
    if (startupOutput.current !== undefined) {
      startupOutput.current += text;
    }
    lastChar.current = text.charAt(text.length - 1);
    const data = text.replace(/\r?\n/gu, "\r\n");
    if (terminalReady.current && terminal.current) {
      terminal.current.write(data);
    } else {
      pending.current.push(data);
    }
  }, []);

  const lineEditor = useCallback(() => {
    editor.current ??= new LineEditor(prompt);
    return editor.current;
  }, []);

  const showPrompt = useCallback(() => {
    if (lastChar.current !== "\n") {
      write("\n");
    }
    write(lineEditor().start());
    busy.current = false;
  }, [lineEditor, write]);

  useEffect(() => {
    let active = true;
    runner.start(write).then(
      ({ version }) => {
        if (!active) {
          return;
        }
        startupOutput.current = undefined;
        write(`${intl.formatMessage(terminalMessages.banner, { version })}\n`);
        showPrompt();
        setStatus("ready");
      },
      (error: unknown) => {
        if (!active) {
          return;
        }
        // Anything the program printed before it stopped is the real reason;
        // the terminal stays hidden on failure, so show it in the alert.
        const printed = (startupOutput.current ?? "").trim();
        startupOutput.current = undefined;
        const reason = error instanceof Error ? error.message : String(error);
        setFailure(printed === "" ? reason : `${reason}\n${printed}`);
        setStatus(
          error instanceof CommandRunnerUnavailableError
            ? "unavailable"
            : "failed",
        );
      },
    );
    return () => {
      active = false;
    };
  }, [intl, runner, showPrompt, write]);

  const execute = useCallback(
    async (line: string) => {
      busy.current = true;
      try {
        const parsed = parseCommandLine(line);
        if (parsed.kind === "error") {
          write(`${intl.formatMessage(terminalMessages.unclosedQuote)}\n`);
          return;
        }
        const [command, ...argv] = parsed.words;
        if (command === undefined) {
          return;
        }
        if (command === "clear") {
          write(clearScreen);
          lastChar.current = "\n";
        } else if (command === "help") {
          const rows: [string, string][] = [
            ["hsctl ...", intl.formatMessage(terminalMessages.helpRun)],
            ["hsctl help", intl.formatMessage(terminalMessages.helpHsctl)],
            ["clear", intl.formatMessage(terminalMessages.helpClear)],
          ];
          write(
            [
              intl.formatMessage(terminalMessages.helpTitle),
              ...rows.map(([name, text]) => `  ${name.padEnd(12)}${text}`),
              "",
              intl.formatMessage(terminalMessages.helpSession),
              "",
            ].join("\n"),
          );
        } else if (command === "hsctl") {
          await runner.run(argv);
        } else {
          write(
            `${intl.formatMessage(terminalMessages.notFound, { command })}\n`,
          );
        }
      } catch (error: unknown) {
        write(
          `Error: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      } finally {
        showPrompt();
      }
    },
    [intl, runner, showPrompt, write],
  );

  const handleData = useCallback(
    (data: string) => {
      // Commands can't be cancelled yet, so input waits for the prompt.
      if (busy.current) {
        return;
      }
      const effects: LineEditorEffect[] = lineEditor().read(data);
      for (const effect of effects) {
        switch (effect.kind) {
          case "write":
            write(effect.text);
            break;
          case "clear-screen":
            write(clearScreen);
            break;
          case "interrupt":
            write("^C\n");
            showPrompt();
            break;
          case "submit":
            write("\n");
            void execute(effect.line);
            // Lines pasted after the first one are dropped while it runs.
            return;
        }
      }
    },
    [execute, lineEditor, showPrompt, write],
  );

  const handleReady = useCallback((instance: WTerm) => {
    // The emulator sizes its grid from the element's font and padding, and a
    // later shrink cuts off text already written. On a full page load the
    // route stylesheet can arrive after this callback, so wait until the
    // emulator's own CSS applies (it defines --term-bg), at most ~2 seconds.
    // It polls with a timer, not animation frames, which a hidden tab pauses.
    let attempts = 100;
    const flushWhenStyled = () => {
      const styled =
        getComputedStyle(instance.element)
          .getPropertyValue("--term-bg")
          .trim() !== "";
      attempts -= 1;
      if (!styled && attempts > 0) {
        setTimeout(flushWhenStyled, 20);
        return;
      }
      instance.fit();
      terminalReady.current = true;
      const queued = pending.current.join("");
      pending.current = [];
      if (queued !== "") {
        terminal.current?.write(queued);
      }
      terminal.current?.focus();
    };
    flushWhenStyled();
  }, []);

  // A closed panel collapses to almost no height. Fitting the grid to that
  // would drop the history, so stop following the box while hidden, then fit
  // again and take the keyboard when the panel opens.
  useEffect(() => {
    const instance = terminal.current?.instance;
    if (!instance) {
      return;
    }
    followContainer(instance, isVisible);
    if (!isVisible || status !== "ready") {
      return;
    }
    // The panel may attach the terminal only after its opening animation,
    // so wait (at most ~1 second) until it is in the page.
    let attempts = 50;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fitAndFocus = () => {
      attempts -= 1;
      if (!instance.element.isConnected && attempts > 0) {
        timer = setTimeout(fitAndFocus, 20);
        return;
      }
      instance.fit();
      instance.focus();
    };
    fitAndFocus();
    return () => {
      clearTimeout(timer);
    };
  }, [isVisible, status]);

  return (
    <div className={styles.body}>
      {status === "loading" ? (
        <Spinner
          aria-label={intl.formatMessage(terminalMessages.loading)}
          size="lg"
        />
      ) : null}
      {status === "unavailable" || status === "failed" ? (
        <Alert
          isInline
          title={intl.formatMessage(
            status === "unavailable"
              ? terminalMessages.unavailableTitle
              : terminalMessages.failedTitle,
          )}
          variant="danger"
        >
          <span className={styles.failure}>{failure}</span>
        </Alert>
      ) : null}
      {/* Stay visible while loading: the emulator sizes its grid when it
          mounts, and a later shrink drops text that was already written. */}
      <div
        className={styles.frame}
        hidden={status === "unavailable" || status === "failed"}
      >
        <Terminal
          aria-label={intl.formatMessage(terminalMessages.terminalLabel)}
          autoResize
          className={styles.terminal}
          onData={handleData}
          onReady={handleReady}
          ref={terminal}
          renderingPaused={!isVisible}
        />
      </div>
    </div>
  );
}
