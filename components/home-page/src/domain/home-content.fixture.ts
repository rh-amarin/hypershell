/** A valid raw content document for tests. Returns a fresh copy each call. */
export function sampleDocument() {
  return {
    changelog: [
      {
        component: "cli",
        date: "2026-09-28",
        pullRequest: 371,
        summary: "Interactive hsctl terminal UI",
        type: "feat",
        url: "https://github.com/openshift-online/hypershell/pull/371",
      },
      {
        component: "update-openshell",
        date: "2026-09-29",
        pullRequest: 374,
        summary: "Bump OpenShell to v0.1.2",
        type: "feat",
        url: "https://github.com/openshift-online/hypershell/pull/374",
      },
    ],
    contact: {
      slackChannel: "forum-hypershell",
      slackUrl: "https://slack.com/app_redirect?channel=forum-hypershell",
    },
    incidents: [
      {
        id: "old",
        instanceIds: ["ibm-production"],
        kind: "incident",
        phase: "resolved",
        resolvedAt: "2026-09-20T12:00:00Z",
        startedAt: "2026-09-20T10:00:00Z",
        title: "Console sign-in failures",
        update: "Resolved.",
      },
    ],
    instances: [
      {
        consoleUrl: "https://ibm.example.com",
        description: "The default home for gateways.",
        id: "ibm-production",
        name: "Production",
        openshellVersion: "v0.1.2-rhaiv.0",
        provider: "IBM Cloud",
        region: "us-south",
        requiresVpn: false,
        status: "operational",
      },
      {
        consoleUrl: "https://vpn.example.com",
        description: "Reaches GitLab and other Red Hat internal services.",
        id: "vpn-production",
        name: "Production with VPN",
        openshellVersion: "0.1.1",
        provider: "Private network",
        region: "us-east",
        requiresVpn: true,
        status: "operational",
      },
    ],
    links: {
      changelog: "https://github.com/openshift-online/hypershell/commits/main",
      docs: "https://docs.example.com",
      incidentHistory: "https://status.example.com/history",
      news: "https://news.example.com",
      source: "https://github.com/openshift-online/hypershell",
    },
    news: [
      {
        id: "a",
        kind: "platform",
        publishedOn: "2026-09-27",
        summary: "Older platform note.",
        title: "Hub gRPC is TLS-only",
      },
      {
        id: "b",
        kind: "action-required",
        publishedOn: "2026-09-29",
        summary: "Install the matching CLI.",
        title: "OpenShell v0.1.2 is now the default",
        url: "https://news.example.com/openshell-v0-1-2",
      },
    ],
    schemaVersion: 1,
    services: [
      { id: "management-api", name: "Management API", status: "operational" },
    ],
    updatedAt: "2026-09-30T09:00:00Z",
  };
}
