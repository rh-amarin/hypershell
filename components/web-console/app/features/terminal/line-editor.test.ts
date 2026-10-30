import { describe, expect, it } from "vitest";

import { LineEditor, type LineEditorEffect } from "./line-editor";

const esc = "\u001b";

function submitted(effects: LineEditorEffect[]): string[] {
  return effects.flatMap((effect) =>
    effect.kind === "submit" ? [effect.line] : [],
  );
}

function lastWrite(effects: LineEditorEffect[]): string | undefined {
  return effects
    .flatMap((effect) => (effect.kind === "write" ? [effect.text] : []))
    .at(-1);
}

describe("LineEditor", () => {
  it("shows the prompt and echoes typed text by redrawing the line", () => {
    const editor = new LineEditor("$ ");
    expect(editor.start()).toBe("$ ");
    expect(lastWrite(editor.read("ab"))).toBe(`\r${esc}[2K$ ab`);
  });

  it("submits the line on Enter, once for CR LF", () => {
    const editor = new LineEditor("$ ");
    editor.start();
    const effects = editor.read("hsctl version\r\n");
    expect(submitted(effects)).toEqual(["hsctl version"]);
  });

  it("edits in the middle of the line", () => {
    const editor = new LineEditor("$ ");
    editor.start();
    editor.read("acd");
    // Left twice, type b, then Delete removes c.
    const effects = editor.read(`${esc}[D${esc}[Db${esc}[3~`);
    expect(lastWrite(effects)).toBe(`\r${esc}[2K$ abd${esc}[1D`);
    expect(submitted(editor.read("\r"))).toEqual(["abd"]);
  });

  it("handles backspace, home, end and kill-line", () => {
    const editor = new LineEditor("$ ");
    editor.start();
    editor.read("abc\u007f");
    editor.read(`\u0001x\u0005y`);
    expect(submitted(editor.read("\r"))).toEqual(["xaby"]);

    editor.read("abc\u0015z");
    expect(submitted(editor.read("\r"))).toEqual(["z"]);
  });

  it("ignores keys that change nothing", () => {
    const editor = new LineEditor("$ ");
    editor.start();
    expect(editor.read(`\u007f${esc}[D${esc}[C${esc}[3~\t${esc}[Z`)).toEqual(
      [],
    );
  });

  it("recalls history with up and down and keeps the draft", () => {
    const editor = new LineEditor("$ ");
    editor.start();
    editor.read("one\r");
    editor.read("two\r");
    editor.read("two\r");
    editor.read("dra");

    expect(lastWrite(editor.read(`${esc}[A`))).toBe(`\r${esc}[2K$ two`);
    expect(lastWrite(editor.read(`${esc}[A`))).toBe(`\r${esc}[2K$ one`);
    expect(editor.read(`${esc}[A`)).toEqual([]);
    editor.read(`${esc}[B${esc}[B`);
    expect(submitted(editor.read("\r"))).toEqual(["dra"]);
  });

  it("reports Ctrl+C and Ctrl+L", () => {
    const editor = new LineEditor("$ ");
    editor.start();
    editor.read("abc");
    expect(editor.read("\u0003")).toEqual([{ kind: "interrupt" }]);
    expect(editor.read("\u000c")[0]).toEqual({ kind: "clear-screen" });
    expect(submitted(editor.read("\r"))).toEqual([""]);
  });

  it("keeps emoji as one character", () => {
    const editor = new LineEditor("$ ");
    editor.start();
    editor.read("a\u{1F600}\u007f");
    expect(submitted(editor.read("\r"))).toEqual(["a"]);
  });
});
