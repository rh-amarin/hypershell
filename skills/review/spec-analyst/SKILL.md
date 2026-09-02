---
name: spec-analyst
description: >
  Audit the HyperShell spec corpus (specs/**/*.spec.md) for its own quality --
  ambiguous language, contradictions, misplaced or duplicated requirements,
  incompleteness, untestable clauses, structural and metadata drift, broken
  cross-references, and stale references to removed domain concepts. Runs a set
  of lenses and produces a findings report pinned to the analyzed commit; can
  optionally apply safe mechanical fixes. Use when you want to review the specs
  themselves -- not code coverage, which is /reconcile. Triggers on: "analyze the
  specs", "audit the specs", "spec quality", "review the specs", "check the specs
  for contradictions", "are the specs consistent", "spec health", "spec-analyst".
---

# Spec Analyst

Audit the spec corpus as the artifact under test. The specs are HyperShell's
desired-state contract; this skill treats them the way a linter treats source and
a copy editor treats a manuscript -- checking the specs against *each other* and
against the project's own authoring conventions, then emitting a report bound to
the exact commit it analyzed. Its verdict gates whether the corpus is safe to
hand to `/reconcile` as desired state.

## Usage

```text
/spec-analyst                     # Full corpus audit
/spec-analyst platform            # Limit to specs/platform/
/spec-analyst standards/ui        # Limit to a subtree
/spec-analyst openshell-gateway   # Single spec (matches by filename stem)
/spec-analyst --since main        # Only specs changed vs a git ref (diff mode)
/spec-analyst --lens contradiction,links,registry   # Run named lenses only
/spec-analyst --apply             # Report, then apply safe mechanical fixes
/spec-analyst platform --apply    # Scope + apply combined
```

## User Input

```text
$ARGUMENTS
```

Parse `$ARGUMENTS` before proceeding:

- A leading path/stem sets the **scope** (default: whole corpus).
- `--since <ref>` selects **diff mode** (only specs changed vs `<ref>`).
- `--lens a,b,c` restricts to named lenses (default: all).
- `--apply` enables **apply mode** (see below).

## What This Analyzes (and What It Does Not)

This skill owns **spec-vs-spec quality**. It deliberately does not re-do work
other skills own:

| Concern | Owner | This skill's role |
|---------|-------|-------------------|
| spec → code coverage, gap tables, coverage % | `/reconcile` (`skills/RECONCILE.md`) | Read and **summarize** its record; never scan code or recompute |
| code → spec orphans (unspecified endpoints/RPCs/CLI/routes) | `/reconcile` | Out of scope; recommend a `/reconcile` run |
| code adherence to conventions | `/align` | None |
| PR / code review | `/review-guidance`, `/amber-review`, `/ui-standards` | None |
| **quality of the specs as a corpus** | **this skill** | **Full** |

Never open component source to confirm coverage here. If a request is really about
whether code implements a spec, redirect to `/reconcile`.

## Mandatory Context Files

Before analyzing, load:

1. `CLAUDE.md` -- domain model and critical conventions
2. `skills/plan/spec/SKILL.md` -- the authoritative spec **format and principles**
   (the rubric for structural, language, and testability lenses)
3. `specs/index.spec.md` -- the Spec Registry (dependency edges, component tags)
4. `skills/review/spec-analyst/references/lenses.md` -- the **lens catalog**: the
   signals, confirmation steps, and "not a finding" boundaries for every check
5. `skills/review/spec-analyst/references/report-template.md` -- the report shape
6. `skills/RECONCILE.md` -- existing spec→code coverage record (read-only, for the
   `trace` lens summary only)

## Phases

### Phase 1 -- Pin the corpus

Record what the analysis is based on, so the report is reproducible:

- `git rev-parse HEAD` / `--short HEAD` -- the analyzed commit; branch and subject.
- `git status --porcelain specs/` -- if `specs/` is dirty, default to analyzing
  the **committed** tree and list ignored uncommitted paths under "Not in basis";
  note `basis: working-tree` only if the user asked to include the dirty state.
- `git ls-files specs/ | wc -l` -- corpus file count.
- Corpus fingerprint: capture each in-scope spec's blob SHA (`git ls-tree`), and a
  single roll-up hash. Two runs with the same hashes analyzed identical content.

### Phase 2 -- Build the corpus model

Read the in-scope specs once and build the shared model the lenses reuse:

- **File index** -- path, domain (top-level dir), header fields (`Date`,
  `Status`, `Applies to`, `Parent`, `Related`, `Jira`), body style (Scenario /
  Verification / topic-prose).
- **Requirement index** -- every `### Requirement...` heading, its ID if any
  (`UI-*`/`WEB-*`/`G*`/`DM-*`), its normative keywords, and whether it has a
  `#### Scenario:` or `**Verification:**` block.
- **Reference graph** -- relative `[..](*.spec.md)` links, `§`/heading anchors,
  `Parent:`/`Related:` edges, and `index.spec.md` `Depends On` edges.
- **Glossary** -- domain terms and their spelling/casing across files.
- **Keyword budget** -- SHALL/MUST/SHOULD/MAY counts per spec.

### Phase 3 -- Run the lenses

Run each lens defined in `references/lenses.md` (skip any excluded by `--lens`).
The lens file is authoritative for signals, confirmation, and non-findings; do not
duplicate it here. Lenses:

`language` · `identity` · `registry` · `links` · `contradiction` · `placement` ·
`duplication` · `completeness` · `testability` · `freshness` · `trace`

For each finding capture: lens, `file:line` or `file § Requirement` (with blob
SHA), evidence excerpt, why, one primary fix, severity, confidence, and whether it
is `new`, `partially recorded`, or `recorded in RECONCILE.md`. Prefer grep/glob for mechanical
lenses (`links`, `registry`, `identity`, keyword budget); reserve reading +
judgment for `language`, `contradiction`, `placement`, `completeness`.

### Phase 4 -- Rank, verdict, and write the report

- Deduplicate and rank by severity then confidence.
- Set the **verdict** (see below).
- Write the report to `reports/spec-analysis/<YYYY-MM-DD>-<shortsha>.md` following
  `references/report-template.md` (create the directory if needed). Do **not**
  create a git commit -- the user commits both the report and any fixes.
- Print the summary tables and verdict to the conversation.

### Phase 5 -- Apply mode (only if `--apply`)

See **Apply Mode** below. After applying, re-run the affected mechanical lenses to
confirm, and record the applied count in the report's Pin/history.

## Severity and Verdict

Severity follows `references/lenses.md` (aligned with
`skills/review/review-guidance/SKILL.md`): **Blocker > Critical > Major > Minor**.

**Verdict** (report header `Overall:`):

- `UNSAFE_TO_RECONCILE` -- any Blocker: two active desired states conflict, the
  registry cannot be walked, or a release-facing SHALL is unimplementable. Handing
  this corpus to `/reconcile` would make it guess.
- `ISSUES` -- no Blocker, but Critical/Major findings exist. Safe to reconcile with
  care; fix before relying on the affected specs.
- `HEALTHY` -- only Minor findings or none.

## Apply Mode

With `--apply`, after writing the report, apply only **safe, mechanical,
review-verifiable** fixes -- never semantic rewrites:

- `links` -- broken relative links where the intended target is unambiguous
  (single rename match).
- `registry` -- add missing rows, remove dead ones, correct paths/edges in
  `index.spec.md`.
- `freshness` -- metadata: fill/normalize `Status`/`Date` where the correct value
  is unambiguous from git history or RECONCILE; delete stale removed-entity
  references only when the fix is a pure deletion or a documented rename with no
  behavioral meaning.
- `identity` -- add a documented ID prefix suggestion as a comment; do **not**
  auto-renumber existing IDs (breaks citations).

Do **not** auto-apply `language`, `contradiction`, `placement`, `duplication`,
`completeness`, or `testability` findings -- these need human judgment; leave them
as report findings. Show a diff summary, re-run the affected mechanical lenses, and
record the applied count. Never create a commit.
