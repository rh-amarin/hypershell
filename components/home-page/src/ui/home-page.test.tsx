import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";

import type { HomeApplicationRuntime } from "../application/load-home-content";
import { sampleDocument } from "../domain/home-content.fixture";
import { englishMessages } from "../i18n/catalog";
import { HomePage } from "./home-page";
import { HomeRuntimeProvider } from "./home-runtime";

type Doc = ReturnType<typeof sampleDocument>;

function renderHome(fetchDocument: () => Promise<unknown>) {
  const runtime: HomeApplicationRuntime = {
    clock: { nowIso: () => "2026-09-30T09:00:00.000Z" },
    ids: { nextCorrelationId: () => "c" },
    probes: { publish: () => undefined },
    source: { fetchDocument },
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  render(
    <IntlProvider locale="en" messages={englishMessages}>
      <QueryClientProvider client={client}>
        <HomeRuntimeProvider runtime={runtime}>
          <HomePage fallbackSlackChannel="forum-hypershell" />
        </HomeRuntimeProvider>
      </QueryClientProvider>
    </IntlProvider>,
  );
  return client;
}

async function liveStatusLabels() {
  const heading = await screen.findByRole("heading", { name: "Live status" });
  const card = heading.closest(".pf-v6-c-card");
  if (!(card instanceof HTMLElement)) {
    throw new Error("live status card missing");
  }
  return within(card)
    .getAllByRole("listitem")
    .map((row) => row.querySelector("[data-status]")?.textContent);
}

function withDoc(mutate?: (doc: Doc) => void) {
  const doc = sampleDocument();
  mutate?.(doc);
  return () => Promise.resolve(doc);
}

describe("HomePage", () => {
  it("shows every section from the content document", async () => {
    renderHome(withDoc());

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /Pick an instance/,
      }),
    ).toBeTruthy();
    for (const name of [
      "Live status",
      "Public instances",
      "Incidents",
      "News & announcements",
      "Changelog",
      "Talk to the team in #forum-hypershell",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
    expect(await liveStatusLabels()).toEqual([
      "Operational",
      "Operational",
      "Operational",
    ]);
    expect(screen.queryByText("All systems operational")).toBeNull();
    expect(screen.getByText("No active incidents")).toBeTruthy();

    // PatternFly NavItem only renders its own anchor for string children.
    const nav = screen.getByRole("navigation", { name: "Page sections" });
    expect(
      within(nav).getByRole("link", { name: "Incidents" }).getAttribute("href"),
    ).toBe("#incidents");
    expect(screen.getByText("Console sign-in failures")).toBeTruthy();
  });

  it("shows each instance's OpenShell version and a CLI command pinned to it", async () => {
    renderHome(withDoc());

    const vpnCard = await screen.findByRole("article", {
      name: "Production with VPN",
    });
    expect(within(vpnCard).getByText("Red Hat VPN")).toBeTruthy();
    expect(within(vpnCard).getByText("0.1.1")).toBeTruthy();
    const command = within(vpnCard).getByRole("textbox");
    expect((command as HTMLTextAreaElement).value).toContain(
      "OPENSHELL_VERSION=v0.1.1 sh",
    );

    const ibmCard = screen.getByRole("article", { name: "Production" });
    expect(within(ibmCard).queryByText("Red Hat VPN")).toBeNull();
    expect(
      within(ibmCard).getByRole("link", {
        name: "Open console for Production (opens in a new tab)",
      }),
    ).toHaveProperty("href", "https://ibm.example.com/");
  });

  it("never reports an unknown status as healthy", async () => {
    renderHome(
      withDoc((doc) => {
        (doc.services[0] as { status?: string }).status = "retired";
      }),
    );

    expect(await liveStatusLabels()).toEqual([
      "Operational",
      "Operational",
      "Unknown",
    ]);
  });

  it("puts active incidents first with their phase and affected instance", async () => {
    renderHome(
      withDoc((doc) => {
        const [first] = doc.instances;
        if (first) {
          first.status = "degraded";
        }
        doc.incidents.push({
          id: "live",
          instanceIds: ["ibm-production"],
          kind: "incident",
          phase: "investigating",
          resolvedAt: "2026-09-30T10:00:00Z",
          startedAt: "2026-09-30T08:00:00Z",
          title: "Slow provisioning",
          update: "We are looking into slow gateway provisioning.",
        });
      }),
    );

    expect((await liveStatusLabels())[0]).toBe("Degraded");
    expect(screen.getByText("Investigating: Slow provisioning")).toBeTruthy();
    expect(screen.getByText(/Affects Production/)).toBeTruthy();
    expect(screen.queryByText("No active incidents")).toBeNull();
  });

  it("orders news newest first and marks action-required items", async () => {
    renderHome(withDoc());

    const news = await screen.findByRole("heading", {
      name: "News & announcements",
    });
    const panel = news.closest("section");
    if (!panel) {
      throw new Error("news section missing");
    }
    const titles = within(panel)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(titles[0]).toContain("OpenShell v0.1.2 is now the default");
    expect(within(panel).getByText("Action needed")).toBeTruthy();
  });

  it("shows an error and still offers contact when content cannot load", async () => {
    renderHome(() => Promise.reject(new Error("HTTP 500")));

    expect(
      await screen.findByText(
        "Status information could not be loaded",
        {},
        {
          timeout: 5000,
        },
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: "Talk to the team in #forum-hypershell",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Live status" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  });

  it("keeps the last good content and flags it when a refresh fails", async () => {
    let calls = 0;
    const client = renderHome(() => {
      calls += 1;
      return calls === 1
        ? Promise.resolve(sampleDocument())
        : Promise.reject(new Error("HTTP 503"));
    });
    expect(await liveStatusLabels()).toHaveLength(3);

    await client
      .refetchQueries({ queryKey: ["home-content"] })
      .catch(() => undefined);

    expect(
      await screen.findByText(
        "Status may be out of date",
        {},
        { timeout: 5000 },
      ),
    ).toBeTruthy();
    expect(await liveStatusLabels()).toHaveLength(3);
  });
});
