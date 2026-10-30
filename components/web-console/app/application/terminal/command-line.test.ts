import { describe, expect, it } from "vitest";

import { parseCommandLine } from "./command-line";

describe("parseCommandLine", () => {
  it.each([
    ["hsctl list gateways", ["hsctl", "list", "gateways"]],
    ["  hsctl   get\tgateway  ", ["hsctl", "get", "gateway"]],
    [
      "hsctl list gateways --search \"name = 'a b'\"",
      ["hsctl", "list", "gateways", "--search", "name = 'a b'"],
    ],
    ["echo 'it''s'", ["echo", "its"]],
    ["echo 'a \\ b'", ["echo", "a \\ b"]],
    ['echo "a \\" b"', ["echo", 'a " b']],
    ['echo "a \\n b"', ["echo", "a \\n b"]],
    ["echo a\\ b", ["echo", "a b"]],
    ["echo ''", ["echo", ""]],
    ["", []],
  ])("splits %j", (line, words) => {
    expect(parseCommandLine(line)).toEqual({ kind: "ok", words });
  });

  it.each(["echo 'open", 'echo "open'])("rejects %j", (line) => {
    expect(parseCommandLine(line)).toEqual({
      kind: "error",
      reason: "unclosed-quote",
    });
  });
});
