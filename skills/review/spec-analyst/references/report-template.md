# Spec Analysis Report

## Pin

| Field | Value |
|-------|-------|
| commit | |
| short | |
| branch | |
| authored | |
| subject | |
| basis | `commit` \| `working-tree` |
| dirty | `clean` \| paths |
| skill | spec-analyst |
| lenses | |
| scope | |
| report_path | `reports/spec-analysis/<YYYY-MM-DD>-<short>.md` |

### Corpus blobs

This table (sorted by path) is the source of the roll-up `fingerprint` above --
hash the sorted blob-SHA list to reproduce it. No separate blob dump is needed.

| Path | Blob SHA |
|------|----------|
| | |

### Not in basis

Uncommitted paths that were ignored (default) or included (`working-tree`):

-

## Verdict

Overall: `HEALTHY` | `ISSUES` | `UNSAFE_TO_RECONCILE`

One paragraph: what would go wrong if `/reconcile` or a human treated this
commit’s specs as desired state.

## Counts

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |

| Lens | Findings | Status |
|------|----------|--------|
| language | 0 | Clear \| Issues |
| identity | 0 | |
| registry | 0 | |
| links | 0 | |
| contradiction | 0 | |
| placement | 0 | |
| duplication | 0 | |
| completeness | 0 | |
| testability | 0 | |
| freshness | 0 | |
| trace | 0 | |

## Findings

Ordered by severity. Each finding:

```markdown
### [Severity] LENS-ID - short title

- **Lens:** 
- **Where:** `specs/...` heading / `code path`
- **Evidence:** quote or `file:line` (blob `...`)
- **Why:** 
- **Fix:** one primary action (edit spec / move / split / delete / change code)
- **Confidence:** High | Medium | Low
- **Known:** new | partially recorded | recorded in RECONCILE.md
```

## Corpus views

### Normative graph

Cycles, orphans, overloaded hubs.

### Keyword budget

| Spec | SHALL | MUST | SHOULD | MAY | Requirements | Scenarios |
|------|-------|------|--------|-----|--------------|-----------|
| | | | | | | |

### Actor map

Requirements with missing or conflicting actors.

### Secret and fail-mode

### Removed-entity scan

### Scenario coverage

| Spec | Requirements without scenarios | Notes |
|------|--------------------------------|-------|

## Coverage summary (from RECONCILE, not recomputed)

Read-only digest of `skills/RECONCILE.md`. This skill does not scan code or
recompute coverage - see `/reconcile` for authoritative gap detail.

| Metric | Value |
|--------|-------|
| Coverage headline (total reqs, %) | |
| Active specs at ~0% coverage | |
| Draft specs cited as authoritative | |
| Stale RECONCILE Code Location paths (missing at pinned tree) | |

## Top actions

1.
2.
3.
4.
5.

## Not evaluated

-

## Compare (optional)

Delta vs report or commit:

-
