import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../../application/terminal/command-runner";
import { englishMessages } from "../../i18n/catalog";
import { TerminalDrawer } from "./terminal-drawer";

const mounts = vi.hoisted(() => ({ count: 0 }));

// The terminal itself has its own tests; record mounts and visibility here.
vi.mock("./hsctl-terminal", async () => {
  const { useEffect } = await import("react");
  return {
    HsctlTerminal: ({ isVisible }: { isVisible: boolean }) => {
      useEffect(() => {
        mounts.count += 1;
      }, []);
      return <div data-testid="terminal" data-visible={String(isVisible)} />;
    },
  };
});

const pageContent = "Page content";

const runner: CommandRunner = {
  start: () => Promise.resolve({ version: "1.2.3" }),
  run: () => Promise.resolve(0),
};

function renderDrawer(isExpanded: boolean, onClose = vi.fn()) {
  return render(
    <IntlProvider locale="en" messages={englishMessages}>
      <TerminalDrawer isExpanded={isExpanded} onClose={onClose} runner={runner}>
        <p>{pageContent}</p>
      </TerminalDrawer>
    </IntlProvider>,
  );
}

describe("TerminalDrawer", () => {
  it("does not load the terminal until the panel first opens", () => {
    mounts.count = 0;
    renderDrawer(false);
    expect(screen.getByText("Page content")).toBeTruthy();
    expect(screen.queryByTestId("terminal")).toBeNull();
    expect(mounts.count).toBe(0);
  });

  it("keeps the terminal mounted after the panel closes", () => {
    mounts.count = 0;
    const view = renderDrawer(true);
    expect(screen.getByTestId("terminal").dataset.visible).toBe("true");

    view.rerender(
      <IntlProvider locale="en" messages={englishMessages}>
        <TerminalDrawer isExpanded={false} onClose={vi.fn()} runner={runner}>
          <p>{pageContent}</p>
        </TerminalDrawer>
      </IntlProvider>,
    );
    expect(screen.getByTestId("terminal").dataset.visible).toBe("false");
    expect(mounts.count).toBe(1);
  });

  it("offers a resize handle and a close button", async () => {
    const onClose = vi.fn();
    renderDrawer(true, onClose);

    expect(
      screen.getByRole("heading", { level: 2, name: "Terminal" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("separator", { name: "Resize the terminal panel" }),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Close the terminal panel" }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
