# Public Home Page Specification

## Purpose

The public home page is the single entry point for HyperShell users before they
sign in to any instance. It tells users which public HyperShell instances exist,
whether they are healthy, which OpenShell version each one runs, what changed
recently, and how to reach the team. Each web console belongs to one instance
and requires sign-in, so the home page is a separate, unauthenticated static
site (`components/home-page/`) that spans every instance. It uses the same
PatternFly 6 look as the web console so moving from the home page into a
console feels like one product.

The page is operative, not promotional: every section answers a question a user
has before or after opening a console.

## Requirements

### Requirement: Content Is Configuration

The home page SHALL load all instance, status, incident, news, changelog, and
contact content at runtime from a single JSON document served at
`content/home.json` relative to the page. Changing content SHALL NOT require
rebuilding the site. The document SHALL be validated against a versioned schema
(`schemaVersion: 1`) before any of it is rendered.

#### Scenario: Operator Publishes an Announcement

- GIVEN the site is deployed with a mounted `content/home.json`
- WHEN an operator adds a news item to the document and it is re-served
- THEN the next page load shows the new item
- AND no image rebuild or redeploy of the site code is needed

#### Scenario: Invalid Content Is Rejected Whole

- GIVEN `content/home.json` fails schema validation
- WHEN the page loads
- THEN the page shows an error state that says the status information could not be loaded
- AND it shows the contact section so users can still reach the team
- AND it SHALL NOT render a partial or guessed status

### Requirement: Public Instances

The page SHALL list every configured public instance in a card showing its
name, hosting provider, a one-sentence purpose, region, OpenShell version,
current status, and an "Open console" link to that instance's web console.
Each card SHALL show how the instance is reached in an "Access" row: "Public
internet", or "Red Hat VPN" for instances only reachable over the Red Hat VPN,
conveyed with text, not color alone. Instance cards SHALL keep their rows
aligned with each other so users can compare instances side by side.

The initial set of instances is:

| Instance | Provider | Purpose |
|---|---|---|
| Production | IBM Cloud | Default home for general-purpose gateways |
| Production sandboxes | AWS | Workloads that make extensive use of AWS services or data |
| Production with VPN | Private network | Gateways that reach GitLab and other Red Hat internal services |
| Stage | To be decided | The next OpenShell release ahead of production, for testing gateways and agents before an upgrade; not for production workloads |

#### Scenario: VPN Instance Is Labeled

- GIVEN an instance with `requiresVpn: true`
- WHEN the page renders its card
- THEN the card's Access row shows the text "Red Hat VPN"

### Requirement: Matching OpenShell CLI

Each instance card SHALL show the OpenShell version the instance runs and a
copyable CLI install command pinned to exactly that version. The command SHALL
be produced by the same canonical builder the web console's gateway connection
steps use (`buildOpenShellInstallCommand` in
`packages/gateway-management-ui`), so the home page and the console never
disagree on how to install the CLI. The page SHALL state that the CLI version
must match the instance the user connects to.

#### Scenario: Copy the Pinned Install Command

- GIVEN an instance whose `openshellVersion` is `v0.1.2-rhaiv.0`
- WHEN the user copies the install command from that instance's card
- THEN the copied command sets `OPENSHELL_VERSION=v0.1.2-rhaiv.0`

### Requirement: Status Summary

The top of the page SHALL show a live status summary with one row per instance
and per listed shared service (for example the management API and the web
console), each with a status label that pairs text with an icon. The summary
SHALL NOT show a single combined status for the whole platform; each row
reports its own status so one healthy aggregate never hides a problem in one
instance.

Status values SHALL map to the reserved information colors of
`specs/standards/ui/brand-color.spec.md`:

| Status | Label | Color family |
|---|---|---|
| `operational` | Operational | success-green |
| `degraded` | Degraded | orange |
| `outage` | Outage | danger-orange |
| `maintenance` | Maintenance | teal |
| missing or unrecognized | Unknown | gray |

Red Hat red SHALL NOT represent any status.

#### Scenario: Unknown Status Does Not Read as Healthy

- GIVEN every instance is `operational` and one shared service has no status
- WHEN the summary renders
- THEN that service's row reads "Unknown" with the gray treatment
- AND no row or heading claims that all systems are operational

### Requirement: Incidents

The page SHALL show active incidents first, each with its title, affected
instances, current phase (`investigating`, `identified`, `monitoring`), start
time, and latest update. When there is no active incident it SHALL say "No
active incidents". It SHALL list the most recent resolved incidents and
completed maintenance below, and link to the full incident history when the
content provides one.

### Requirement: News and Announcements

The page SHALL show the most recent news items, newest first, each with a date,
a kind label (`action-required`, `new`, `platform`), a title, and a one-line
summary. An `action-required` item SHALL use the yellow warning family, since
it asks users to act to avoid breakage.

### Requirement: Changelog

The page SHALL show the most recent changelog entries in a table with date,
change type, summary, component, and a link to the pull request. Change type
SHALL be conveyed by text; color SHALL NOT carry its meaning.

### Requirement: Contact

The page SHALL show a contact section that links to the `#forum-hypershell`
Slack channel with an "Open in Slack" action, and SHALL remain visible when
content fails to load.

### Requirement: Unified Look with the Web Console

The page SHALL use PatternFly 6 components and tokens and the same masthead
brand treatment as the web console (HyperShell logo and product name). Red Hat
red SHALL appear only through the approved logo. The page SHALL follow the UI
standards in `specs/standards/ui/`, including localized interface strings,
accessible landmarks and headings, and no raw console diagnostics.

### Requirement: Content Freshness

The page SHALL refresh the content document every 60 seconds while it is open
and SHALL show when the status was last updated, using the `updatedAt` value
from the content. A failed refresh SHALL keep showing the last good content and
SHALL indicate that the status may be out of date.

#### Scenario: Refresh Fails After a Good Load

- GIVEN the page has rendered valid content
- WHEN a later refresh fails
- THEN the page keeps the previous content visible
- AND it shows a notice that status may be out of date

### Requirement: Observability

Loading the content document SHALL be an application use case that publishes
one `home.content.load.started` probe and exactly one terminal
`home.content.load.completed` probe with outcome `succeeded`, `failed`, or
`cancelled`, through the shared domain-probe fan-out
(`components/web-console/domain-probes`). Probes SHALL NOT include content
text or URLs.
