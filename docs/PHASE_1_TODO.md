# Phase 1 completion checklist

Updated October 2, 2026. Scope: **Growth Phase 1 — complete the learning cycle**,
not the older UI roadmap's foundations/accessibility phase.

Check items only when the stated result is evidenced. Record the date, version,
target environment and report/link alongside new passes. Source implementation,
staging verification, curriculum approval and learner outcomes are separate.

**Current status:** implementation, staging SQL/concurrency, v2 build and mocked
browser checks passed. Live Preview smoke tests are partially complete; the Gemini
authentication blocker is resolved. Phase 1 remains open.

**Next:** investigate AI streaming/transition findings, finish human join/turns,
premium entitlement checks, and learning off-mode write rejection/saved reads; then complete curriculum
approval before enabling the pilot.

## Completed foundation

- [x] Implement owned `debate`, `drill` and `reassessment` session links, source
  debate/turn, target competency and template provenance.
- [x] Apply migrations 017 and 018 to staging — user-confirmed.
- [x] Verify migration 017 ownership/linkage SQL — user-confirmed complete pass.
- [x] Verify linked-session concurrency — [36 assertions and three cleanup checks](evidence/phase-1-staging-concurrency.json) passed.
- [x] Implement the shared draft → response → coaching → revision → reassessment
  runtime, targeted scores, free-cycle reservation and durable learning events.
- [x] Verify runtime concurrency — [26 assertions and four cleanup checks](evidence/phase-1-staging-drill-runtime.json) passed, including duplicate claims and allowance protection.
- [x] Revise all three draft templates to v2 with family-specific difficulty
  guidance and distinct reassessment scenarios; update prompt to `targeted-coach-2`.
- [x] Run v2 targeted tests — 34 learning/API tests, typecheck and lint passed.
- [x] Commit and push implementation and v2 revisions to staging — `3f96ca9`
  and `6f5d542`. Preview deployment confirmation is recorded below.

## 1. Confirm the staging baseline — engineering/operator

- [x] Verify the **entire** [migration 018 SQL suite](../supabase/tests/drill_runtime.sql)
  finished without SQL errors on staging — user-confirmed October 2, 2026.
  The blank `expect_error` helper result is expected. The suite rolls back its
  fixtures; no further rerun is needed without a relevant change. Raw SQL output
  was not independently inspected.
- [x] Confirm Vercel Preview deployed `6f5d542` — Ready status and staging branch
  independently inspected October 2, 2026. Current retest deployment:
  [Preview 8bvsqrt9v](https://debate-master-8bvsqrt9v-joel-guzmans-projects-f8aa100e.vercel.app/).
- [x] Set Preview variables `LEARNING_ROLLOUT=off` and
  `LEARNING_PAID_ENABLED=false` and redeploy staging Preview — user-confirmed
  October 2, 2026. Live behavior checks remain below.
- [x] Verify no unapproved template versions are enabled — user confirmed
  `LEARNING_APPROVED_TEMPLATES` is absent in Preview; missing defaults to an empty list.
- [x] Run a fresh v2 production build — `npm run build` passed October 2, 2026,
  including lint, type checking and generation of all 31 static pages. This local
  working-tree build includes pending Sentry changes; it is not a deployment.
- [x] Run fresh v2 desktop/mobile drill browser checks — October 2, 2026:
  all six tests passed (three families × desktop/compact mobile). Production
  build with mocked learning APIs; hosted authentication and real AI remain separate.
### Live Preview smoke tests

Evidence: [Preview smoke-test record](evidence/phase-1-preview-smoke.json).
Initial checks used Preview `9tvzvzy5o`; post-credential-fix checks used `8bvsqrt9v`.
Results below are scoped to those deployments, not production.

- [x] Verify public homepage and pricing render, annual billing toggle works, and
  debate/upgrade entry points redirect signed-out users to login.
- [x] Verify anonymous learning GET denies access with “Sign in to practice.”
  Browser HTTP status was not captured; this does not verify every write endpoint.
- [x] Verify signed-in Free pricing state and upgrade entry point render.
  Paid entitlement behavior and checkout were not exercised.
- [x] Verify AI setup creates a debate and saves the learner's opening.
- [x] Resolve the Preview Gemini authentication blocker — user added
  `GEMINI_API_KEY` and redeployed; a fresh AI rebuttal succeeded on `8bvsqrt9v`.
  Learner and AI rebuttals persisted after reload. Preserve the initial failure
  and resolution in the evidence record.
- [x] Verify human setup creates an invite and shows the waiting-for-opponent screen.
  Invite was not sent; the test debate remains available for follow-up.
- [x] Verify signed-in learning availability returns `available: false`, including
  on `8bvsqrt9v` after redeployment.
- [x] Complete the AI debate through closing and verify coaching/feedback persists
  — October 2, 2026 on `8bvsqrt9v`. Learner/opponent closings, coaching summary,
  strongest moment, priority improvement and all five scores survived reload;
  no regeneration was required. Saved debate: `9b009696-f1fb-4a10-ba13-b461b10e5ce9`.
- [x] Reproduce and fix the local client stream/refresh race. The turn stays locked
  through refresh, transient text clears before stage changes, streamed text uses
  its captured AI stage label, and missing SSE completion requires explicit retry.
  Two regression tests fail on the prior implementation and pass with the fix.
  Full unit/API suite passed (230 tests); production build passed.
- [ ] Commit/deploy the streaming fix and repeat a fresh Preview debate through
  coaching. Current Preview `8bvsqrt9v` does not contain the local fix.
- [ ] Investigate remaining server/provider reliability: the AI route inserts a
  response before its stage-advance guard, so concurrent requests from multiple
  clients can still insert duplicate turns. Client locking does not provide
  durable server idempotency. Confirm the causes of interrupted provider streams
  from logs and verify retry recovery and persisted turn counts in staging.
  Earlier duplicate UI entries and error banners remain recorded in the evidence.
- [ ] Verify a second staging test participant can join the human invite and
  exchange turns. Saved test debate: `69ff5e9c-f699-4b91-b887-a08a5d9b2bf8`.
- [ ] Verify existing premium entitlement behavior with an appropriate staging
  test account, within the billing scope below; do not treat Free pricing as proof.
- [ ] Verify authenticated learning writes are rejected while rollout is off,
  and owned saved cycles remain readable. The availability GET alone is insufficient.
- [ ] Retain verification results and clean up synthetic sessions when follow-up
  checks are complete; both smoke-test debates are currently retained.

**Exit:** version and environment are known, baseline checks pass, and the feature
remains disabled until the next gates are ready. Do not repeat already-passed
concurrency tests without a relevant schema/runtime change.

## 2. Approve the revised curriculum — coach/product

- [ ] Review `counterargument-response-v2`: accurate opposing/source pairing,
  strongest-reason response, supported comparison and justified concessions.
- [ ] Review `claim-evidence-warrant-v2`: explicit assumptions, alternative
  explanations, and valid recognition that evidence may not support a claim.
- [ ] Review `unsupported-claim-repair-v2`: bounded fictional evidence, clear
  separation from the original debate, and justified narrowing/qualification/
  withdrawal rather than merely inserting “might.”
- [ ] Approve beginner/intermediate/advanced guidance and parallel reassessments
  for each family; record reviewer, date, exact versions and any required edits.
- [ ] Check approved transcript examples actually meet routing prerequisites.
  Counterargument requires co-cited learner/opposing excerpts; warrants require
  distinct claim/evidence excerpts. Test unavailable cases without inventing links.
- [ ] Decide how any existing v1 cycles will be handled: keep readable and paused,
  or implement explicit version-compatible continuation. Never rewrite snapshots
  or silently score them with the v2 prompt.

**Exit:** explicit curriculum approval is recorded. The previous rubric approval
and permission to revise code do not establish approval of the revised exercises.

## 3. Validate real coaching in staging — engineering/coach

- [ ] After approval, configure only approved v2 template IDs and explicit staging
  test-user IDs; set `LEARNING_ROLLOUT=pilot`. Keep paid learning disabled.
- [ ] Verify staging Gemini/service credentials, rate limits, deployed error capture
  and an alert recipient. Keep keys and learner text out of reports.
- [ ] Complete a real authenticated **counterargument** cycle: source → first
  response → coaching → revision → linked reassessment → summary.
- [ ] Complete the same real-service journey for **warrants**.
- [ ] Complete the same real-service journey for **claim repair**.
- [ ] Use separate eligible free test accounts where necessary to exercise all
  families without bypassing the one-introductory-cycle rule.
- [ ] Verify one new free learner finishes a whole cycle with no intervening
  upgrade block and no repeated allowance consumption.
- [ ] Verify exact source/response quotations, targeted-only scores, version/model
  provenance, null insufficient-evidence scores and no fabricated overall score.
- [ ] Test refresh, navigation away, second-device resume and stale draft conflicts.
- [ ] Test failed/invalid evaluations, lease expiry, duplicate clicks and bounded
  retries; preserve answers and ensure failures do not count as completion.
- [ ] Verify owner isolation and deletion cleanup across runtime/content/events.
- [ ] Inspect events: one completion per action, practice clicks never treated as
  completions, and no transcript/response text in analytics.
- [ ] Record all evaluation attempts, known token usage, unknown usage, latency
  and failures. Do not equate a successful-call subtotal with a reconciled bill.
- [ ] Remove synthetic fixtures and retain content-free verification reports.

**Exit:** three real-service journeys and recovery/ownership checks pass. Mocked
browser tests and database-only concurrency checks cannot substitute for these.

## 4. Calibrate the targeted assessments — two coaches/evaluation owner

- [ ] Prepare the proposed 54 held-out response examples across three families,
  three difficulties and three quality bands, with two examples per combination.
  Include insufficient-evidence cases; keep evaluation material out of tuning.
- [ ] Obtain two independent ratings blind to AI output; retain original ratings,
  adjudicated results and disagreement explanations in restricted storage.
- [ ] Evaluate with recorded template/rubric/prompt/model versions. Review the
  proposed threshold of at least 80% of valid target scores within one point of
  adjudicated ratings **for each family**, plus insufficient-evidence classification.
- [ ] Review disagreement by difficulty and response quality, source relevance,
  feedback usefulness and reassessment comparability. Record limitations and a
  coach decision; do not describe the small set as proof of educational effectiveness.

## 5. Finish pilot measurement — engineering/product

- [ ] Implement durable, content-free tracking of unavailable recommendations.
- [ ] Provide a cohort report joining first-debate completion to linked drill and
  reassessment completion. Deduplicate learners and identify the observation window.
- [ ] Define the denominator before enrollment and allow a full seven days of
  follow-up. Report numerator, denominator and unavailable cases, not percentages alone.
- [ ] Add a usable coaching-usefulness/abandonment review process. The current
  general usefulness endpoint logs signals; do not assume a durable review queue.
- [ ] Confirm scope for the initial pilot: deterministic controlled templates are
  implemented; model-generated exercise variations are not. Record that scope or
  separately validate variations before adding them.

## 6. Exercise release controls and run the learner pilot — operator/product

- [ ] Verify an included pilot user can practice and an excluded user cannot start.
- [ ] Exercise `pilot → off`: new activity is blocked, saved work remains readable,
  and in-flight evaluation behavior is understood. Keep additive migrations.
- [ ] Agree on pilot error/latency/cost thresholds, observation window, rollback
  owner and conditions for stopping enrollment.
- [ ] Enroll 20–30 target learners after technical and curriculum/quality gates pass.
- [ ] Observe seven days per learner and report the proposed signal: at least 30%
  of first-debate completers finish a drill plus linked reassessment.
- [ ] Review abandonment, usefulness, failures and score disagreements. Record
  whether to improve the drills, extend the pilot or proceed toward Phase 2.
- [ ] Update the readiness record with results and explicit remaining limitations.

## Paid and production rollout — separate conditional gates

- [ ] Preserve Stripe reconciliation as **deferred, not passed**; no new Stripe
  testing is scheduled without revisiting the existing scope decision.
- [ ] Verify Google Play ownership/reconciliation and provider-specific entitlement
  behavior before enabling paid learning. The free pilot does not prove paid parity.
- [ ] Before any production rollout, verify production migration state, reviewed
  application version, environment settings, monitoring and rollback readiness.
  Staging migration passes are not production deployment evidence.

## Phase 1 exit decision

- [ ] Record a **free-pilot validation** decision after sections 1–6 have evidence.
  Do not mark the entire paid/production scope complete while those gates are deferred.
- [ ] Confirm readiness to start Phase 2 skill profiles/transfer checks, or document
  the specific Phase 1 remediation needed first. Keep practice completion distinct
  from demonstrated improvement and transferable learning.

References: [implementation plan](PHASE_1_DRILL_IMPLEMENTATION_PLAN.md),
[rollout guide](PHASE_1_DRILL_ROLLOUT.md),
[epic audit](../EPIC_IMPLEMENTATION_AUDIT.md).
