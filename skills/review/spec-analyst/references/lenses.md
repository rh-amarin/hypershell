# Spec Analyst Lenses

Heuristics for `/spec-analyst`. Each lens lists signals, how to confirm, and
what is **not** a finding.

Severity guide:

- **Blocker** - two active desired states cannot both be true, or the registry
  cannot be walked; `/reconcile` would guess
- **Critical** - a SHALL is unimplementable, untestable, or clearly unimplemented
  for a release-facing contract
- **Major** - ambiguity, misplacement, or duplication that will produce wrong
  code or split ownership
- **Minor** - hygiene: IDs, keyword mix, missing scenarios, stale Date

---

## language

**Question:** Would two competent implementers build different things?

### Signals

- RFC 2119 mix: `MUST` and `SHALL` in the same corpus without a documented
  mapping. HyperShell authoring uses SHALL/SHOULD/MAY. `MUST` in a spec is a
  finding unless it quotes an external standard.
- Non-normative obligation: `should`, `must`, `will`, `needs to`, `ensures`,
  `responsible for` outside keywords, in a section that reads as a contract
- Vague quantity: `quickly`, `promptly`, `as needed`, `appropriate`,
  `reasonable`, `robust`, `seamless`, `and/or`, `etc.`, `TBD`
- Silent actor: passive “is created” / “is updated” with no component
- Compound SHALL: one requirement heading with independent obligations that
  can pass or fail separately (split candidate)
- Inclusive vs exclusive or: “A or B” without whether both are allowed
- Unbounded retry, wait, or size with no cap
- Pronouns (`it`, `this`, `the resource`) that can bind to more than one noun
  in the preceding sentence

### Confirm

Rewrite the sentence as one observable: actor, action, object, outcome,
failure. If you cannot, it is a language finding.

### Not a finding

- Overview/Purpose that is descriptive, as long as it does not smuggle a
  competing contract
- Quotes from RFC, Kubernetes, OpenAPI, or WCAG that use MUST
- Examples in scenarios that use concrete values

---

## identity

**Question:** Can a requirement be cited stably from code, tests, and Jira?

### Signals

- No ID (`G1`, `WEB-AUTH-01`, `UI-FND-03`, `DM-3a` are existing styles)
- ID collision inside one file or across files
- ID prefix that does not match the spec (`WEB-*` in a platform gateway spec)
- ID in RECONCILE.md that no longer exists in the spec
- RECONCILE IDs that are **positional only** -- never written into the spec at
  all (the `G*/DM*/CP*/R*/SA*/KC*/RBAC*` families are assigned by reconcile, not
  by the spec, so the mapping silently drifts whenever requirements are added,
  removed, or reordered). Report this per-spec as a structural traceability gap,
  not once per requirement -- it is stronger than "an ID went missing"
- Heading rename that would break citations with no alias
- Two headings that are the same requirement under different names

### Confirm

Build the global ID map. Collisions are Major (cross-file) or Critical if
RECONCILE or tests already cite the wrong one.

### Not a finding

- A spec that has never used IDs: report once per file (Minor) plus a
  suggested prefix, not once per heading

---

## registry

**Question:** Is `specs/index.spec.md` a true map of the corpus?

### Signals

- File on disk (at the pinned tree) with no registry row
- Registry row whose path does not exist
- Domain column disagrees with folder (`specs/platform/` vs `security`)
- Depends On names a spec that does not exist or uses a title not a path key
- Cycles in Depends On
- Components column missing a component the requirements actually bind to
- Index “Sub-Specs” prose omits a domain that has files

Current corpus already tends to grow files faster than the index. Unregistered
active specs are Major: `/reconcile` will skip them.

### Confirm

Diff `git ls-tree` paths under `specs/` against the registry table. Extract paths
from the **registry table rows only** -- not from backticked `*.spec.md` tokens
that appear in surrounding prose or `Sub-Specs` narrative, or you will miss real
unregistered files and invent phantom rows. Parse Depends On as graph; report
cycles with the node list.

### Not a finding

- `index.spec.md` itself
- Standards files listed with Components `ALL` or `-`

---

## links

**Question:** Do spec-to-spec references resolve?

### Signals

- Broken relative links
- Link to a filename that moved
- “see X spec” in prose with no link and an ambiguous X
- Link into a heading anchor that does not exist

### Confirm

Resolve relative to the spec file directory against the pinned tree.

### Not a finding

- External URLs (optional HEAD check only if cheap; do not fail the report
  on network)

---

## contradiction

**Question:** Can both statements be desired state at once?

### Signals

- Two SHALLs that negate each other (same object, opposite outcome)
- Field both `readOnly` and operator-writable
- Default values that disagree (hostnames, labels, timeouts, image env vars)
- Fail-closed vs fail-open on the same missing dependency (cert-manager,
  Gateway API, OIDC)
- One-time secret vs “reconcile must fetch/inspect the secret”
- Soft-delete vs hard-delete vs 409 protection on the same resource
- Immutability vs “user may update”
- Overview/ERD still showing an entity the Requirements removed (or the reverse)
- Parent spec summarizing a child incorrectly
- Spec vs OpenAPI/proto on enum membership, requiredness, or readOnly
  (this is also `trace`; file under contradiction when both are normative)

### Confirm

State A, state B, why they cannot both hold, and which document should win
(usually the more specific child spec, unless the child is stale).

**Severity tie-breaker.** A clearly identifiable winner does *not* downgrade the
finding. If one side is stale but is still an `Active` spec with an unqualified
SHALL, it is Blocker: reconciling *that* spec produces wrong code, regardless of
which side a human would pick. Downgrade to Critical only when the losing side is
already explicitly marked (past-tense "was removed", `Draft`, or a documented
deprecation) so no reader would treat it as current desired state.

Mark `known` if `skills/RECONCILE.md` already records the clash; still emit
the finding so the commit-pinned report stands alone. Use `partially recorded`
when RECONCILE captures one side but misses the residual conflict.

### Not a finding

- SHOULD vs SHALL where SHOULD is a weaker default
- Historical Overview that clearly past-tenses a removed model
- Spec describing current gaps as missing desired state (that is `trace`)

---

## placement

**Question:** Is this requirement in the spec a later reader would open?

### Signals

- Feature behavior living under `specs/standards/`
- Cross-cutting constraint duplicated into a feature spec instead of cited
- Gateway child spec hosting API data-model field definitions that belong in
  `data-model.spec.md` (or the reverse: data-model hosting reconciler steps)
- UI interaction requirements in a platform provisioning spec
- Security SHALL (authn/authz/secret handling) only in a feature spec and
  absent from `security/` when it is a platform-wide rule
- File in `specs/platform/` whose primary entity is web-console-only
- Parent restating child SHALL clauses in full rather than linking
- Requirement that needs a different Depends On parent than its file
- **Decision-record / rationale content parked in a spec** (ADR genre). A
  `## Design Decisions`, `## Rationale`, `## Background`, `## Trade-offs`, or
  `## Context` table or prose that records *why a choice was made*, *what was
  considered and rejected*, or *what a prior version did* - e.g.
  `data-model.spec.md` §Design Decisions, `rbac-enforcement.spec.md` decisions
  table, `local-development.spec.md` ("Team agreed to drop mTLS"),
  `e2e-testing.spec.md` §Design Decisions. Also historical/changelog callouts
  asserting a transition ("X has been removed", "Removed:", "an earlier model
  included…", `openshell-gateway.spec.md:865`,
  `openshell-gateway-database.spec.md` §Removed). This content has a
  **decision-log lifecycle** (append-only, dated, immutable) - not the
  **living-spec lifecycle** (always current desired state) that plan/spec
  mandates. It drifts silently because nothing reconciles it.

### Confirm

Name the better path and the ownership rule. Propose move vs cite.

For decision-record / rationale / changelog content, recommend extracting each
decision to a numbered ADR under `docs/adr/` (context · decision · alternatives
· consequences), leaving the spec a compact `Decision → ADR-NNNN` link plus, at
most, one load-bearing rationale line attached to the current requirement. Deep
history lives in git and the ADR log, not in the desired-state contract.
Severity Minor (spec hygiene).

### Not a finding

- A one-line pointer (“full rules in X”)
- Scenario setup that mentions another domain
- A single load-bearing rationale line attached to a *current* requirement
  ("SHALL reject `fleet_id` to prevent reintroduction of the removed grouping")
  - that is desired state carrying its reason, not a decision record. The signal
  is a decisions **table / section**, not one clause with a because-clause.

---

## duplication

**Question:** Is the same contract maintained twice?

### Signals

- Near-identical SHALL in two files
- Label names, hostname formulas, Secret names, env var names restated
- RBAC role names listed in both security and a feature spec, already drifted
- OpenAPI text copied into a spec and drifted

### Confirm

Quote both. If they still match, Minor (delete one, cite). If they drifted,
Major or Blocker depending on whether an implementer could pick the wrong one.

### Not a finding

- Parent summary tables that only name child specs

---

## completeness

**Question:** Would an implementer have to invent load-bearing behavior?

### Signals (when the spec defines a resource or API)

- Create without update, delete, or get
- No unauthorized / not-found / conflict behavior
- No tenant isolation statement
- No failure or timeout
- Status/phase without terminal failure
- Credentials without rotation, revocation, or leak constraints
- Watch/reconcile without delete or reconnect
- UI flow without empty, error, permission, and recovery (cite UI standards
  rather than duplicating them; finding is “not cited / not applied”)

### Confirm

Only flag holes that the spec’s own Purpose claims to cover. Do not demand
that a TLS spec define CLI UX.

### Not a finding

- Standards specs that are constraints, not resource lifecycles
- Explicit `MAY` omissions (“scopes are not configurable in version 1”)

---

## testability

**Question:** Could a test fail if the behavior were wrong?

### Signals

- SHALL names functions, files, or packages rather than observable behavior
  (violates “behavior contracts, not implementation plans”)
- “correctly”, “properly”, “fully” with no oracle
- Requirements with zero scenarios
- Scenarios that copy the SHALL with no Given/When/Then data
- Time/retry without a bound a test can use
- “always” / “never” without an observable channel (log metric, status, API)

### Confirm

Name a test that could exist (e2e, unit, contract). If you cannot, Critical.

### Not a finding

- Architecture overviews
- Verification subsections in UI standards that themselves define the oracle

---

## freshness

**Question:** Is this still desired state for this commit?

### Signals

- `TODO`, `FIXME`, `TBD`, `Future`, `not yet`, `coming soon` in a spec
- **Deferred / roadmap block parked in a spec** - a section or callout that
  designs *future* work rather than current desired state: `Deferred`, `Day-2`,
  `reserved`, `follow-up`, `will be … in a follow-up`, `out of scope for v1`,
  `expected to cover HYPERSHELL-NN`, or a whole `## X (Deferred)` block laying
  out a future feature. E.g. `openshell-gateway-secret-rotation.spec.md`
  §KEK Day-2 (Deferred). Future work is issue tracking, not desired state
  (violates plan/spec principle #1)
- Status `Active` but body says the feature was removed
- Date field far older than last commit touching the file (Minor; check
  `git log -1 --format=%cI -- <file>` on the pinned commit). **Batch all Date
  drift into one systemic finding**, not one per file, and ignore drift whose
  only touching commit is a mechanical/bulk sweep (image-ref bump, license
  header, mass rename) rather than a content change -- those do not mean the
  contract is stale
- Archived/historical tone (“we used to”) without replacing the contract
- References to deleted paths (`components/api-server/deploy/`, Fleet CRUD)
- Index Depends On that includes a retired spec
- **Version-relative negation** - a `SHALL NOT`, “no longer”, “must not
  include X”, “X is removed” that only parses for a reader who already knows a
  prior version had X. Tell: it singles out one specific removed artifact (a
  named field, enum value, endpoint, resource) rather than a general class of
  prohibited behavior. This is a change description wearing desired-state
  clothes - issue tracking, not desired state (violates plan/spec principle #1).
  Example: “create and update contracts SHALL NOT include a `fleet_id` field.”

### Confirm

Use git history of the spec file at the pinned commit. Code absence is
`trace`, not freshness, unless the spec claims the code exists.

For a suspected version-relative negation, apply the **deletion test**: (1) would
a reader with zero knowledge of the old system understand *why* this prohibition
exists from the spec alone? (2) if the sentence were deleted, would desired state
become ambiguous? A permanent invariant fails deletion (information lost); a
migration ghost survives it (the positive schema already implies the field's
absence). If it is a ghost, the fix is to phrase it as absolute desired state -
either state the field list positively, or, if a compat window is still open,
specify the *active* behavior with rationale (“to reject the removed Fleet
grouping, create/update SHALL reject requests carrying `fleet_id` with 400”).
Severity Minor: this is hygiene, and such requirements are usually testable and
reconcilable, unlike a `trace` unimplementable.

For a deferred / roadmap block, recommend moving the future work to a ticket and
leaving one explicit deferral line in the spec ("KEK rotation is out of scope
for v1 - tracked in HYPERSHELL-NN"). A bounded `MAY` or "not in this version"
sentence is fine; a full future-design block is not. Severity Minor.
(Decision/rationale/history *tables and sections* - as opposed to future work -
are the `placement` lens's ADR signal; flag them there, not here.)

### Not a finding

- An old `Date` on content that is genuinely historical in tone is not by itself
  a freshness defect - but the content still belongs in an ADR / decision log,
  not in the spec: flag its **location** under `placement`, not its date here
- RECONCILE gap tables (not specs)
- Permanent invariants phrased negatively (no secrets in logs, tenant isolation,
  immutability) - these need no prior-version knowledge and fail the deletion test
- An explicitly-scoped compat window that states it rejects or migrates legacy
  input and why (self-contained rationale) - that is desired state, not a ghost

---

## trace

**Question:** What does the existing spec→code coverage record say about this
corpus - without re-deriving it?

**Scope boundary.** This skill audits specs against specs. It does **not** scan
the codebase, walk components, or recompute coverage - that is `/reconcile`'s
job and it owns the authoritative gap tables in `skills/RECONCILE.md`. This lens
only **reads and summarizes** that existing record so the commit-pinned report is
self-standing. Do not open component source to confirm coverage here.

### Signals (read from `skills/RECONCILE.md`, not from code)

- A spec `Status: Active` that RECONCILE shows at ~0% coverage / all Missing
- A `Draft` spec being cited by another spec as if it were an authoritative
  contract
- RECONCILE gap rows whose `Code Location` points at a path that no longer
  exists at the pinned tree (stale traceability record - a doc defect, still not
  a code scan)
- The current coverage headline (total requirements, coverage %) worth carrying
  into the report summary

### Confirm

Quote the relevant RECONCILE row. State it as a spec-hygiene fact ("Active spec,
0% per RECONCILE") and link to `/reconcile` for the authoritative gap detail.

### Not a finding

- Any requirement's true implementation status - defer entirely to `/reconcile`
- Code→spec orphan inventory (unspecified endpoints/RPCs/CLI/env/routes) -
  out of scope; recommend a `/reconcile` run if the user wants it
- RECONCILE percentages themselves being imperfect

Removed-entity references in specs are handled by the `freshness` lens, not here.
