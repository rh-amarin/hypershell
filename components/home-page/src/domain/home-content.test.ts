import { describe, expect, it } from "vitest";

import { sampleDocument } from "./home-content.fixture";
import {
  activeIncidents,
  latestChanges,
  latestNews,
  pastIncidents,
  validateHomeContent,
  type HomeContent,
} from "./home-content";

function validContent(
  mutate?: (doc: ReturnType<typeof sampleDocument>) => void,
) {
  const doc = sampleDocument();
  mutate?.(doc);
  const result = validateHomeContent(doc);
  if (!result.ok) {
    throw new Error("fixture is invalid");
  }
  return result.content;
}

describe("validateHomeContent", () => {
  it("accepts a valid document", () => {
    expect(validateHomeContent(sampleDocument()).ok).toBe(true);
  });

  it("rejects an unsupported schema version", () => {
    const doc = { ...sampleDocument(), schemaVersion: 2 };
    expect(validateHomeContent(doc)).toMatchObject({ ok: false });
  });

  it("rejects non-https links and a document without instances", () => {
    const insecure = sampleDocument();
    insecure.contact.slackUrl = "http://slack.example.com";
    expect(validateHomeContent(insecure).ok).toBe(false);

    const empty = { ...sampleDocument(), instances: [] };
    expect(validateHomeContent(empty).ok).toBe(false);
  });

  it("maps missing and unrecognized statuses to unknown", () => {
    const content = validContent((doc) => {
      (doc.instances[0] as { status?: string }).status = "sparkling";
      delete (doc.services[0] as { status?: string }).status;
    });
    expect(content.instances[0]?.status).toBe("unknown");
    expect(content.services[0]?.status).toBe("unknown");
  });
});

describe("content ordering", () => {
  const content: HomeContent = validContent((doc) => {
    doc.incidents.push({
      id: "live",
      instanceIds: [],
      kind: "incident",
      phase: "investigating",
      resolvedAt: undefined as unknown as string,
      startedAt: "2026-09-30T08:00:00Z",
      title: "Slow provisioning",
      update: "Looking into it.",
    });
    doc.incidents.push({
      id: "maintenance",
      instanceIds: [],
      kind: "maintenance",
      phase: "resolved",
      resolvedAt: undefined as unknown as string,
      startedAt: "2026-09-25T08:00:00Z",
      title: "Database upgrade",
      update: "Done.",
    });
  });

  it("separates active incidents from resolved ones", () => {
    expect(activeIncidents(content).map((i) => i.id)).toEqual(["live"]);
    expect(pastIncidents(content, 5).map((i) => i.id)).toEqual([
      "maintenance",
      "old",
    ]);
    expect(pastIncidents(content, 1)).toHaveLength(1);
  });

  it("orders news and changes newest first", () => {
    expect(latestNews(content, 5).map((n) => n.id)).toEqual(["b", "a"]);
    expect(latestChanges(content, 5).map((c) => c.pullRequest)).toEqual([
      374, 371,
    ]);
    expect(latestChanges(content, 1)).toHaveLength(1);
  });
});
