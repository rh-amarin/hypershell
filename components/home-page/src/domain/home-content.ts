import { z } from "zod";

const isoDateTime = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();
const httpsUrl = z.url({ protocol: /^https$/u });

// Unrecognized status values are kept as "unknown" rather than rejected, so a
// newer content file never renders as healthy on an older site.
export const serviceStatuses = [
  "operational",
  "degraded",
  "outage",
  "maintenance",
  "unknown",
] as const;
export type ServiceStatus = (typeof serviceStatuses)[number];

const serviceStatus = z
  .string()
  .optional()
  .transform((value): ServiceStatus =>
    serviceStatuses.includes(value as ServiceStatus)
      ? (value as ServiceStatus)
      : "unknown",
  );

const instanceSchema = z.object({
  consoleUrl: httpsUrl,
  description: z.string().min(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/u),
  name: z.string().min(1),
  openshellVersion: z
    .string()
    .regex(/^v?[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.]+)?$/u),
  provider: z.string().min(1),
  region: z.string().min(1),
  requiresVpn: z.boolean(),
  status: serviceStatus,
});

const sharedServiceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: serviceStatus,
});

const incidentSchema = z.object({
  id: z.string().min(1),
  instanceIds: z.array(z.string()),
  kind: z.enum(["incident", "maintenance"]),
  phase: z.enum(["investigating", "identified", "monitoring", "resolved"]),
  resolvedAt: isoDateTime.optional(),
  startedAt: isoDateTime,
  title: z.string().min(1),
  update: z.string().min(1),
});

const newsSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["action-required", "new", "platform"]),
  publishedOn: isoDate,
  summary: z.string().min(1),
  title: z.string().min(1),
  url: httpsUrl.optional(),
});

const changeSchema = z.object({
  component: z.string().min(1),
  date: isoDate,
  pullRequest: z.number().int().positive(),
  summary: z.string().min(1),
  type: z.enum(["feat", "fix", "chore", "docs", "refactor", "perf"]),
  url: httpsUrl,
});

export const homeContentSchema = z.object({
  changelog: z.array(changeSchema),
  contact: z.object({
    slackChannel: z.string().regex(/^[a-z0-9-]+$/u),
    slackUrl: httpsUrl,
  }),
  incidents: z.array(incidentSchema),
  instances: z.array(instanceSchema).min(1),
  links: z.object({
    changelog: httpsUrl.optional(),
    docs: httpsUrl.optional(),
    incidentHistory: httpsUrl.optional(),
    news: httpsUrl.optional(),
    source: httpsUrl.optional(),
  }),
  news: z.array(newsSchema),
  schemaVersion: z.literal(1),
  services: z.array(sharedServiceSchema),
  updatedAt: isoDateTime,
});

export type HomeContent = z.infer<typeof homeContentSchema>;
export type Instance = HomeContent["instances"][number];
export type SharedService = HomeContent["services"][number];
export type Incident = HomeContent["incidents"][number];
export type NewsItem = HomeContent["news"][number];
export type ChangelogEntry = HomeContent["changelog"][number];

export type ContentValidationResult =
  | { readonly ok: true; readonly content: HomeContent }
  | { readonly ok: false; readonly issueCount: number };

export function validateHomeContent(input: unknown): ContentValidationResult {
  const parsed = homeContentSchema.safeParse(input);
  return parsed.success
    ? { content: parsed.data, ok: true }
    : { issueCount: parsed.error.issues.length, ok: false };
}

export function activeIncidents(content: HomeContent): Incident[] {
  return content.incidents
    .filter((incident) => incident.phase !== "resolved")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function pastIncidents(content: HomeContent, limit: number): Incident[] {
  return content.incidents
    .filter((incident) => incident.phase === "resolved")
    .sort((a, b) =>
      (b.resolvedAt ?? b.startedAt).localeCompare(a.resolvedAt ?? a.startedAt),
    )
    .slice(0, limit);
}

export function latestNews(content: HomeContent, limit: number): NewsItem[] {
  return [...content.news]
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn))
    .slice(0, limit);
}

export function latestChanges(
  content: HomeContent,
  limit: number,
): ChangelogEntry[] {
  return [...content.changelog]
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.pullRequest - a.pullRequest,
    )
    .slice(0, limit);
}
