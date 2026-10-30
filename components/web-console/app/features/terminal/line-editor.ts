const escape = "\u001b";

/** What the terminal must do after the editor read some input. */
export type LineEditorEffect =
  | { kind: "write"; text: string }
  | { kind: "submit"; line: string }
  | { kind: "interrupt" }
  | { kind: "clear-screen" };

// Escape sequences the editor understands. Others are ignored.
const sequences: Record<string, string> = {
  [`${escape}[A`]: "up",
  [`${escape}[B`]: "down",
  [`${escape}[C`]: "right",
  [`${escape}[D`]: "left",
  [`${escape}[H`]: "home",
  [`${escape}[F`]: "end",
  [`${escape}OH`]: "home",
  [`${escape}OF`]: "end",
  [`${escape}[1~`]: "home",
  [`${escape}[4~`]: "end",
  [`${escape}[3~`]: "delete",
};

// Reads one escape sequence at the start of text: ESC [ params final, or ESC O final.
function readSequence(text: string): string {
  if (text.length < 2) {
    return text;
  }
  if (text.charAt(1) === "O") {
    return text.slice(0, 3);
  }
  if (text.charAt(1) !== "[") {
    return text.slice(0, 2);
  }
  let end = 2;
  while (end < text.length && /[0-9;]/u.test(text.charAt(end))) {
    end += 1;
  }
  return text.slice(0, end + 1);
}

/**
 * A single-line editor for a terminal without a shell: it echoes typed text,
 * moves the cursor, and keeps a command history. It redraws the whole line
 * after each change, so the prompt must fit on one row.
 */
export class LineEditor {
  private chars: string[] = [];
  private cursor = 0;
  private readonly history: string[] = [];
  private historyIndex = 0;
  private draft: string[] = [];

  constructor(private readonly prompt: string) {}

  /** Text that shows the prompt for a new, empty line. */
  start(): string {
    this.chars = [];
    this.cursor = 0;
    this.historyIndex = this.history.length;
    return this.prompt;
  }

  /** Reads raw terminal input, which may hold several keys or pasted text. */
  read(input: string): LineEditorEffect[] {
    const effects: LineEditorEffect[] = [];
    let changed = false;
    let rest = input;
    while (rest.length > 0) {
      const char = rest.charAt(0);
      if (char === escape) {
        const sequence = readSequence(rest);
        rest = rest.slice(sequence.length);
        changed = this.applyKey(sequences[sequence]) || changed;
        continue;
      }
      // Keep surrogate pairs together so emoji count as one character.
      const codePoint = rest.codePointAt(0) ?? 0;
      const symbol = String.fromCodePoint(codePoint);
      rest = rest.slice(symbol.length);

      if (symbol === "\r" || symbol === "\n") {
        // Treat CR LF from a paste as one Enter.
        if (symbol === "\r" && rest.startsWith("\n")) {
          rest = rest.slice(1);
        }
        if (changed) {
          effects.push({ kind: "write", text: this.render() });
          changed = false;
        }
        effects.push({ kind: "submit", line: this.submit() });
        continue;
      }
      if (symbol === "\u0003") {
        this.chars = [];
        this.cursor = 0;
        changed = false;
        effects.push({ kind: "interrupt" });
        continue;
      }
      if (symbol === "\u000c") {
        effects.push({ kind: "clear-screen" });
        changed = true;
        continue;
      }
      changed = this.applyControl(symbol) || changed;
    }
    if (changed) {
      effects.push({ kind: "write", text: this.render() });
    }
    return effects;
  }

  private applyControl(symbol: string): boolean {
    switch (symbol) {
      case "\u007f":
      case "\b":
        if (this.cursor === 0) {
          return false;
        }
        this.chars.splice(this.cursor - 1, 1);
        this.cursor -= 1;
        return true;
      case "\u0001":
        return this.applyKey("home");
      case "\u0005":
        return this.applyKey("end");
      case "\u0015":
        this.chars.splice(0, this.cursor);
        this.cursor = 0;
        return true;
      case "\t":
        return false;
      default:
        if (symbol < " ") {
          return false;
        }
        this.chars.splice(this.cursor, 0, symbol);
        this.cursor += 1;
        return true;
    }
  }

  private applyKey(key: string | undefined): boolean {
    switch (key) {
      case "left":
        if (this.cursor === 0) {
          return false;
        }
        this.cursor -= 1;
        return true;
      case "right":
        if (this.cursor === this.chars.length) {
          return false;
        }
        this.cursor += 1;
        return true;
      case "home":
        this.cursor = 0;
        return true;
      case "end":
        this.cursor = this.chars.length;
        return true;
      case "delete":
        if (this.cursor === this.chars.length) {
          return false;
        }
        this.chars.splice(this.cursor, 1);
        return true;
      case "up":
        return this.recall(-1);
      case "down":
        return this.recall(1);
      default:
        return false;
    }
  }

  private recall(step: -1 | 1): boolean {
    const next = this.historyIndex + step;
    if (next < 0 || next > this.history.length) {
      return false;
    }
    if (this.historyIndex === this.history.length) {
      this.draft = this.chars;
    }
    this.historyIndex = next;
    this.chars =
      next === this.history.length
        ? this.draft
        : Array.from(this.history[next] ?? "");
    this.cursor = this.chars.length;
    return true;
  }

  private submit(): string {
    const line = this.chars.join("");
    if (line.trim() !== "" && this.history.at(-1) !== line) {
      this.history.push(line);
    }
    this.chars = [];
    this.cursor = 0;
    this.draft = [];
    this.historyIndex = this.history.length;
    return line;
  }

  // Return to column 0, clear the row, draw the line, then step back to the cursor.
  private render(): string {
    const back = this.chars.length - this.cursor;
    return `\r${escape}[2K${this.prompt}${this.chars.join("")}${
      back > 0 ? `${escape}[${String(back)}D` : ""
    }`;
  }
}
