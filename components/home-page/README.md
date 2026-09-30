# HyperShell public home page

The public, unauthenticated entry point for HyperShell users: public instances
with their OpenShell versions and matching CLI install commands, live status,
incidents, news, changelog, and the `#forum-hypershell` contact. It is a static
React + PatternFly 6 site that looks like the web console.

Spec: [`specs/platform/public-home-page.spec.md`](../../specs/platform/public-home-page.spec.md)

## Develop

```shell
pnpm install
pnpm --filter @openshift-online/hypershell-domain-probes build
pnpm run dev:home            # http://127.0.0.1:5174
pnpm --filter @openshift-online/hypershell-home-page check
```

## Content

Everything on the page comes from `content/home.json`, served next to
`index.html` and validated at runtime (`src/domain/home-content.ts`,
`schemaVersion: 1`). The copy in `public/content/home.json` is sample content
for local development. In a deployment, mount the real document at
`content/home.json` (for example from a ConfigMap) so publishing news, an
incident, or a new OpenShell version needs no rebuild.

| Field         | What it drives                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `instances[]` | Instance cards and status rows. `openshellVersion` pins the CLI install command. `requiresVpn` adds the VPN badge. |
| `services[]`  | Extra status rows, such as the management API and web console.                                                     |
| `incidents[]` | Active incidents (`phase` other than `resolved`) and recent history.                                               |
| `news[]`      | News and announcements, newest first.                                                                              |
| `changelog[]` | Changelog table, newest first.                                                                                     |
| `contact`     | Slack channel name and link.                                                                                       |
| `links`       | Optional docs, source, news, changelog, and incident history links.                                                |

A status that is missing or not one of `operational`, `degraded`, `outage`, or
`maintenance` shows as Unknown, and the overall status never reads as healthy
while any row is unknown.

## Layout

- `src/domain` - content schema and status rules (no framework imports)
- `src/application` - the `loadHomeContent` use case and its ports
- `src/adapters` - HTTP content source and domain-probe fan-out
- `src/composition` - browser composition root
- `src/ui` - PatternFly presentation
