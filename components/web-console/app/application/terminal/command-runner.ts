/** Thrown by start() when this console build does not include the program. */
export class CommandRunnerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandRunnerUnavailableError";
  }
}

/**
 * Runs hsctl commands inside the browser tab.
 *
 * The program writes its output as text through the output callback given to
 * start(). Commands run one at a time.
 */
export interface CommandRunner {
  /** Loads the program and resolves with its version. Safe to call again. */
  start(output: (text: string) => void): Promise<{ version: string }>;
  /** Runs one command, without the program name, and resolves with its exit code. */
  run(argv: readonly string[]): Promise<number>;
}
