import { defineMessages } from "react-intl";

export const messages = defineMessages({
  productName: {
    id: "home.productName",
    defaultMessage: "HyperShell",
    description: "Product name shown in the masthead next to the logo.",
  },
  skipToContent: {
    id: "home.skipToContent",
    defaultMessage: "Skip to content",
    description: "Skip link that moves keyboard focus to the main content.",
  },
  primaryNavigation: {
    id: "home.primaryNavigation",
    defaultMessage: "Page sections",
    description: "Accessible name of the masthead navigation to page sections.",
  },
  navInstances: {
    id: "home.nav.instances",
    defaultMessage: "Instances",
    description: "Masthead link to the public instances section.",
  },
  navIncidents: {
    id: "home.nav.incidents",
    defaultMessage: "Incidents",
    description: "Masthead link to the incidents section.",
  },
  navNews: {
    id: "home.nav.news",
    defaultMessage: "News",
    description: "Masthead link to the news section.",
  },
  navChangelog: {
    id: "home.nav.changelog",
    defaultMessage: "Changelog",
    description: "Masthead link to the changelog section.",
  },
  navDocs: {
    id: "home.nav.docs",
    defaultMessage: "Docs",
    description: "Masthead link to the external documentation.",
  },
  getHelp: {
    id: "home.getHelp",
    defaultMessage: "Get help",
    description: "Masthead button that jumps to the contact section.",
  },
  heroEyebrow: {
    id: "home.hero.eyebrow",
    defaultMessage: "Gateway fleet management",
    description:
      "Short label above the page title describing the product category.",
  },
  heroTitleLine1: {
    id: "home.hero.titleLine1",
    defaultMessage: "Pick an instance.",
    description: "First line of the page title.",
  },
  heroTitleLine2: {
    id: "home.hero.titleLine2",
    defaultMessage: "Ship your sandboxes.",
    description: "Second line of the page title.",
  },
  heroLead: {
    id: "home.hero.lead",
    defaultMessage:
      "HyperShell runs OpenShell gateways across clusters and clouds for you. Choose where your workload belongs and you are one login away from a running gateway.",
    description: "Introductory paragraph under the page title.",
  },
  chooseInstance: {
    id: "home.hero.chooseInstance",
    defaultMessage: "Choose an instance",
    description: "Primary button that scrolls to the instance list.",
  },
  askInSlack: {
    id: "home.hero.askInSlack",
    defaultMessage: "Ask in #{channel}",
    description:
      "Button that opens the team Slack channel; channel is the channel name without #.",
  },
  liveStatus: {
    id: "home.status.title",
    defaultMessage: "Live status",
    description: "Title of the card that summarizes current service status.",
  },
  updatedAt: {
    id: "home.status.updatedAt",
    defaultMessage: "Updated {time}",
    description:
      "When the status content was last updated; time is a formatted date and time.",
  },
  statusOperational: {
    id: "home.status.operational",
    defaultMessage: "Operational",
    description: "Status label for an instance or service that works normally.",
  },
  statusDegraded: {
    id: "home.status.degraded",
    defaultMessage: "Degraded",
    description:
      "Status label for an instance or service with degraded performance.",
  },
  statusOutage: {
    id: "home.status.outage",
    defaultMessage: "Outage",
    description: "Status label for an instance or service that is down.",
  },
  statusMaintenance: {
    id: "home.status.maintenance",
    defaultMessage: "Maintenance",
    description: "Status label for an instance or service under maintenance.",
  },
  statusUnknown: {
    id: "home.status.unknown",
    defaultMessage: "Unknown",
    description:
      "Status label when the status of an instance or service is not known.",
  },
  openshellVersionShort: {
    id: "home.status.openshellVersion",
    defaultMessage: "OpenShell {version}",
    description:
      "OpenShell version an instance runs; version is a release such as v0.1.2.",
  },
  incidentHistory: {
    id: "home.status.incidentHistory",
    defaultMessage: "Incident history",
    description: "Link to the full incident history page.",
  },
  instancesTitle: {
    id: "home.instances.title",
    defaultMessage: "Public instances",
    description: "Heading of the public instances section.",
  },
  instancesLead: {
    id: "home.instances.lead",
    defaultMessage:
      "Same platform, several homes. Pick the one closest to what your gateway talks to.",
    description: "Sentence under the public instances heading.",
  },
  region: {
    id: "home.instances.region",
    defaultMessage: "Region",
    description: "Label for the cloud region an instance runs in.",
  },
  openshellVersion: {
    id: "home.instances.openshellVersion",
    defaultMessage: "OpenShell version",
    description: "Label for the OpenShell version an instance runs.",
  },
  matchingCli: {
    id: "home.instances.matchingCli",
    defaultMessage: "Install the matching OpenShell CLI",
    description:
      "Label above the copyable CLI install command for an instance.",
  },
  copyCommand: {
    id: "home.instances.copy",
    defaultMessage: "Copy command",
    description: "Tooltip on the button that copies the CLI install command.",
  },
  copied: {
    id: "home.instances.copied",
    defaultMessage: "Copied",
    description: "Tooltip shown after the CLI install command was copied.",
  },
  access: {
    id: "home.instances.access",
    defaultMessage: "Access",
    description:
      "Label for how an instance can be reached, such as the public internet or the Red Hat VPN.",
  },
  accessPublic: {
    id: "home.instances.accessPublic",
    defaultMessage: "Public internet",
    description: "Access value for an instance reachable without a VPN.",
  },
  vpnRequired: {
    id: "home.instances.vpnRequired",
    defaultMessage: "Red Hat VPN",
    description:
      "Access value for instances only reachable over the Red Hat VPN.",
  },
  openConsole: {
    id: "home.instances.openConsole",
    defaultMessage: "Open console",
    description: "Button that opens the web console of an instance.",
  },
  openConsoleFor: {
    id: "home.instances.openConsoleFor",
    defaultMessage: "Open console for {instance}",
    description:
      "Accessible name of the open console button; instance is the instance name.",
  },
  cliMatchNotice: {
    id: "home.instances.cliMatchNotice",
    defaultMessage:
      "Your OpenShell CLI must match the version of the instance you use. Each instance lists its version and the install command that pins it.",
    description:
      "Notice explaining that the CLI version must match the instance version.",
  },
  incidentsTitle: {
    id: "home.incidents.title",
    defaultMessage: "Incidents",
    description: "Heading of the incidents section.",
  },
  noActiveIncidents: {
    id: "home.incidents.none",
    defaultMessage: "No active incidents",
    description: "Shown when no incident is in progress.",
  },
  pastIncidents: {
    id: "home.incidents.past",
    defaultMessage: "Past incidents",
    description:
      "Heading of the list of recently resolved incidents and maintenance.",
  },
  noPastIncidents: {
    id: "home.incidents.nonePast",
    defaultMessage: "No incidents or maintenance recorded recently.",
    description: "Shown when there are no recent resolved incidents.",
  },
  fullIncidentHistory: {
    id: "home.incidents.fullHistory",
    defaultMessage: "Full incident history",
    description: "Link to the full incident history page.",
  },
  phaseInvestigating: {
    id: "home.incidents.phase.investigating",
    defaultMessage: "Investigating",
    description: "Incident phase: the team is looking for the cause.",
  },
  phaseIdentified: {
    id: "home.incidents.phase.identified",
    defaultMessage: "Identified",
    description: "Incident phase: the cause is known and a fix is in progress.",
  },
  phaseMonitoring: {
    id: "home.incidents.phase.monitoring",
    defaultMessage: "Monitoring",
    description: "Incident phase: a fix is in place and being watched.",
  },
  resolvedIncident: {
    id: "home.incidents.resolvedIncident",
    defaultMessage: "Resolved",
    description: "State of an incident that is over.",
  },
  completedMaintenance: {
    id: "home.incidents.completedMaintenance",
    defaultMessage: "Maintenance completed",
    description: "State of a maintenance window that is over.",
  },
  newsTitle: {
    id: "home.news.title",
    defaultMessage: "News & announcements",
    description: "Heading of the news and announcements section.",
  },
  allNews: {
    id: "home.news.all",
    defaultMessage: "All news",
    description: "Link to the full list of news.",
  },
  noNews: {
    id: "home.news.none",
    defaultMessage: "No announcements yet.",
    description: "Shown when there are no announcements.",
  },
  newsActionRequired: {
    id: "home.news.kind.actionRequired",
    defaultMessage: "Action needed",
    description: "Badge on news that asks users to do something.",
  },
  newsNew: {
    id: "home.news.kind.new",
    defaultMessage: "New",
    description: "Badge on news about a new capability.",
  },
  newsPlatform: {
    id: "home.news.kind.platform",
    defaultMessage: "Platform",
    description: "Badge on news about a platform change.",
  },
  changelogTitle: {
    id: "home.changelog.title",
    defaultMessage: "Changelog",
    description: "Heading of the changelog section.",
  },
  fullChangelog: {
    id: "home.changelog.full",
    defaultMessage: "Full changelog",
    description: "Link to the full changelog.",
  },
  changelogDate: {
    id: "home.changelog.date",
    defaultMessage: "Date",
    description: "Changelog table column: date of the change.",
  },
  changelogType: {
    id: "home.changelog.type",
    defaultMessage: "Type",
    description: "Changelog table column: kind of change such as feat or fix.",
  },
  changelogChange: {
    id: "home.changelog.change",
    defaultMessage: "Change",
    description:
      "Changelog table column: summary of the change; also the table name.",
  },
  changelogComponent: {
    id: "home.changelog.component",
    defaultMessage: "Component",
    description: "Changelog table column: component the change touches.",
  },
  changelogPullRequest: {
    id: "home.changelog.pullRequest",
    defaultMessage: "Pull request",
    description: "Changelog table column: link to the pull request.",
  },
  pullRequestLink: {
    id: "home.changelog.pullRequestLink",
    defaultMessage: "#{number}",
    description:
      "Link text for a pull request; number is the pull request number.",
  },
  noChanges: {
    id: "home.changelog.none",
    defaultMessage: "No changes recorded yet.",
    description: "Shown when the changelog is empty.",
  },
  contactTitle: {
    id: "home.contact.title",
    defaultMessage: "Talk to the team in #{channel}",
    description:
      "Heading of the contact section; channel is the Slack channel name without #.",
  },
  contactLead: {
    id: "home.contact.lead",
    defaultMessage:
      "Onboarding, access to an instance, questions or something broken. We answer in the channel.",
    description: "Sentence under the contact heading.",
  },
  openInSlack: {
    id: "home.contact.openInSlack",
    defaultMessage: "Open in Slack",
    description: "Button that opens the team Slack channel.",
  },
  loading: {
    id: "home.loading",
    defaultMessage: "Loading status information",
    description: "Accessible name of the loading spinner.",
  },
  loadFailedTitle: {
    id: "home.error.loadFailed",
    defaultMessage: "Status information could not be loaded",
    description: "Error title when the status content could not be loaded.",
  },
  loadFailedBody: {
    id: "home.error.loadFailedBody",
    defaultMessage:
      "Try again in a minute. If it keeps failing, tell us in #{channel}.",
    description: "Error body; channel is the Slack channel name without #.",
  },
  staleTitle: {
    id: "home.error.stale",
    defaultMessage: "Status may be out of date",
    description: "Warning title when the latest status refresh failed.",
  },
  staleBody: {
    id: "home.error.staleBody",
    defaultMessage:
      "The latest refresh failed. Showing the last information we loaded.",
    description: "Warning body when the latest status refresh failed.",
  },
  retry: {
    id: "home.error.retry",
    defaultMessage: "Try again",
    description: "Action that retries loading the status content.",
  },
  footerOwner: {
    id: "home.footer.owner",
    defaultMessage: "HyperShell · Red Hat",
    description: "Footer text naming the product and its owner.",
  },
  footerSource: {
    id: "home.footer.source",
    defaultMessage: "Source",
    description: "Footer link to the source code repository.",
  },
  activeIncidentTitle: {
    id: "home.incidents.activeTitle",
    defaultMessage: "{phase}: {title}",
    description:
      "Title of an active incident; phase is Investigating, Identified or Monitoring, title is the incident title.",
  },
  activeIncidentStarted: {
    id: "home.incidents.activeStarted",
    defaultMessage: "Started {time}",
    description:
      "When an active incident started; time is a formatted date and time.",
  },
  activeIncidentStartedAffecting: {
    id: "home.incidents.activeStartedAffecting",
    defaultMessage: "Started {time}. Affects {instances}.",
    description:
      "When an active incident started and what it affects; time is a formatted date and time, instances is a comma-separated list of names.",
  },
  pastIncidentMeta: {
    id: "home.incidents.pastMeta",
    defaultMessage: "{state} {time}",
    description:
      "Details under a past incident; state is Resolved or Maintenance completed, time is a formatted date and time.",
  },
  pastIncidentMetaAffecting: {
    id: "home.incidents.pastMetaAffecting",
    defaultMessage: "{state} {time}. Affected {instances}.",
    description:
      "Details under a past incident; state is Resolved or Maintenance completed, time is a formatted date and time, instances is a comma-separated list of names.",
  },
  linkOpensInNewTab: {
    id: "home.linkOpensInNewTab",
    defaultMessage: "{name} (opens in a new tab)",
    description:
      "Accessible name of a link that opens a new browser tab; name is the link purpose.",
  },
});
