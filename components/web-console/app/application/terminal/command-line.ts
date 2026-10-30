export type ParsedCommandLine =
  { kind: "ok"; words: string[] } | { kind: "error"; reason: "unclosed-quote" };

/**
 * Splits a command line into words the way a POSIX shell does for plain
 * words: spaces separate words, single quotes keep text literally, double
 * quotes keep spaces, and a backslash escapes the next character. Variables,
 * globs, pipes and redirection are not supported.
 */
export function parseCommandLine(line: string): ParsedCommandLine {
  const words: string[] = [];
  let word = "";
  let inWord = false;
  let quote: "'" | '"' | undefined;

  for (let index = 0; index < line.length; index += 1) {
    const char = line.charAt(index);
    if (quote === "'") {
      if (char === "'") {
        quote = undefined;
      } else {
        word += char;
      }
      continue;
    }
    if (char === "\\" && index + 1 < line.length) {
      const next = line.charAt(index + 1);
      // Inside double quotes a backslash only escapes " and \.
      if (quote === '"' && next !== '"' && next !== "\\") {
        word += char;
      } else {
        word += next;
        index += 1;
      }
      inWord = true;
      continue;
    }
    if (quote === '"') {
      if (char === '"') {
        quote = undefined;
      } else {
        word += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      inWord = true;
      continue;
    }
    if (char === " " || char === "\t") {
      if (inWord) {
        words.push(word);
        word = "";
        inWord = false;
      }
      continue;
    }
    word += char;
    inWord = true;
  }

  if (quote !== undefined) {
    return { kind: "error", reason: "unclosed-quote" };
  }
  if (inWord) {
    words.push(word);
  }
  return { kind: "ok", words };
}
