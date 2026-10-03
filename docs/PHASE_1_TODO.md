# Phase 1 completion checklist

Updated October 3, 2026. Scope: **Growth Phase 1 — complete the learning cycle**,
not the older UI roadmap's foundations/accessibility phase.

Check items only when the stated result is evidenced. Record the date, version,
target environment and report/link alongside new passes. Source implementation,
staging verification, curriculum approval and learner outcomes are separate.

**Current status:** implementation, staging SQL/concurrency, v2 build and mocked
browser checks passed. Live Preview smoke tests are partially complete; the Gemini
authentication blocker is resolved. A fresh AI debate on deployed `a75c2f4` completed
without retries; nine transcript entries and coaching persisted after reload. Phase 1 remains open.

**Next:** deploy the October 3 engineering changes, run simultaneous staging AI
retries, finish the two-account human exchange and premium UI checks, and verify
hosted learning off-mode writes/saved reads. Curriculum approval, independent coach
ratings and the seven-day learner pilot remain external gates.

### October 3 implementation work

- [x] Apply migration 019 to staging: database lease/fencing and atomic AI-mode
  turn insertion plus stage advancement. Transactional SQL assertions passed;
  simultaneous HTTP verification remains below.
- [x] Apply migration 020 to staging: content-free unavailable recommendations,
  durable usefulness review queue and deduplicated seven-day cohort reporting.
  Synthetic SQL checks passed, including pending follow-up and RLS/privileges.
- [x] Run October 3 verification: 249 unit/API tests across 34 files, production
  build with lint/type checks and 31 static pages; three synthetic calibration
  scorer checks. These are technical checks, not coach calibration.
- [x] Implement complete-provider-response checks and content-free failure context;
  release leases on failed/disconnected requests so explicit retry can resume.
- [x] Add current-stage prompt boundaries, including no premature closing during
  cross-examination. Real-provider adherence must still be checked after deployment.
- [x] Prepare the [pilot operations guide](phase-1/PILOT_OPERATIONS.md), held-out
  calibration worksheet/scorer and simultaneous AI retry verifier. Empty calibration
  data fails the gate; no coach ratings or learner outcomes are fabricated.
- [x] Grant the user-designated Premium test account app-level access in staging.
  No Supabase administrator privileges or verified payment records were created.
- [x] Join the retained human invitation as the designated second participant;
  Preview shows CON waiting for PRO's opening. Turn exchange remains pending.
- [ ] Deploy these application changes to Preview and record the commit and URL.

Evidence: [October 3 engineering verification](evidence/phase-1-engineering-2026-10-03.json).

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
- [x] Confirm current Vercel Preview deployed `a75c2f4` — Ready status and staging
  branch independently inspected October 2, 2026:
  [Preview g5gv7pnti](https://debate-master-g5gv7pnti-joel-guzmans-projects-f8aa100e.vercel.app/).
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
The fresh streaming-fix retest used `g5gv7pnti` (`a75c2f4`):
[AI retest evidence](evidence/phase-1-preview-ai-retest.json).
Results below are scoped to the stated deployments, not production.

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
- [x] Commit/deploy the streaming fix and repeat a fresh Preview debate through
  coaching — October 2, 2026, `a75c2f4` on `g5gv7pnti`. All nine expected transcript
  entries rendered once before and after reload; coaching content and scores
  (overall 5; evidence 4, rebuttal 5, rhetoric 6, argument strength 4) persisted.
  No retries or transition error banners were observed. This is a single-browser
  UI verification, not proof of server idempotency across clients.
  Saved debate: `9fbc877f-33f7-44f5-b998-f5413befb719`.
- [x] Check the saved overall score matches the rounded, equally weighted mean
  in this smoke test: `round((4 + 5 + 6 + 4) / 4) = 5`. This observed result does
  not replace rubric calibration or server-contract tests.
- [x] Implement durable server idempotency for AI turns with migration 019 and
  update the route to use it. Database assertions verify fencing, repeat commits,
  ownership denial and atomic validation failure.
- [ ] Run `scripts/verify-ai-turn-concurrency.mjs` against staging and retain its
  report. Sequential SQL assertions are not simultaneous HTTP concurrency proof.
- [ ] Diagnose interrupted provider streams from logs and verify recovery with
  explicit retry in staging. The fresh run needed no retry, so it does not close
  this check. Preserve earlier duplicate UI entries and errors in the evidence.
- [ ] Verify the new stage-boundary prompt against real AI output. The October 2
  cross-examination response contained premature closing prose within one entry;
  the October 3 correction is implemented but not yet verified on Preview.
- [ ] Verify a second staging test participant can join the human invite and
  exchange turns. Saved test debate: `69ff5e9c-f699-4b91-b887-a08a5d9b2bf8`.
- [x] Verify existing premium entitlement UI on Preview `g5gv7pnti`, October 3:
  the designated test account shows Active Subscription and Pro Analysis with
  exact citations and download controls. The second account showed Free pricing.
  This manual staging fixture does not verify checkout, audio or provider reconciliation.
- [ ] Verify authenticated learning writes are rejected while rollout is off,
  and owned saved cycles remain readable. The availability GET alone is insufficient.
- [ ] Retain verification results and clean up synthetic sessions when follow-up
  checks are complete; all three smoke-test debates are currently retained.

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
- [x] Preserve existing v1 cycles as readable and paused under the version guard,
  as documented in the operations guide. No snapshot rewriting or v2 rescoring.

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

- [x] Implement durable, content-free tracking of unavailable recommendations
  (migration 020 and recommendation service); deployed application behavior pending.
- [x] Provide `learning_pilot_report` and `scripts/learning-pilot-report.mjs`: join
  first-debate completers to linked completed cycles, deduplicate learners and report
  seven-day matured/pending denominators. Staging synthetic SQL checks passed.
- [ ] Define the denominator before enrollment and allow a full seven days of
  follow-up. Report numerator, denominator and unavailable cases, not percentages alone.
- [x] Add authenticated durable usefulness storage, a review queue with dispositions,
  failed-save UI feedback, and incomplete-cycle counts with a daily review workflow
  in the operations guide. Assign an operator and exercise the deployed workflow
  before enrollment; incomplete cycles are not automatically proven abandonment.
- [x] Record the initial scope as deterministic controlled v2 templates in the
  operations guide. Model-generated exercise variations are excluded.

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
