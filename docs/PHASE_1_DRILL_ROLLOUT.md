# Phase 1 drill runtime: implementation and staging rollout

The implementation adds three draft exercise templates and one shared flow:
counterargument response (`rebuttalQuality`), claim-to-evidence warrant
(`argumentStrength`), and unsupported-claim repair (`evidenceUsage`).
Curriculum approval and human calibration are not claimed by code completion.

Staging update: the user confirmed migration 018 was applied successfully.
Hosted runtime SQL, concurrency and real-service journey results remain pending.

## Implemented behavior

- Eligible, owned AI coaching can open a practice cycle from the feedback panel.
  An existing cycle for the same source resumes instead of consuming a new slot.
  Unsupported transcript contexts retain the prior debate-practice option.
- Deterministic, versioned challenges use exact transcript references; short
  parallel reassessments use clearly labeled hypothetical scenarios. This first
  release does not ask a model to generate fresh exercise material.
- Responses receive single-competency coaching, a revision opportunity, and a
  linked reassessment. No overall score is fabricated and full-debate progress
  remains separate. Insufficient evidence has a null score; malformed/provider
  failures do not complete the attempt.
- Server-saved drafts use optimistic revisions. Submitted responses are retained
  across reloads. Expiring evaluation leases and fencing tokens prevent concurrent
  retries from committing multiple assessments. At most three provider attempts
  per response are permitted; exhausted attempts retain work for support review.
- One lifetime introductory cycle per account is reserved atomically, including
  its revision and reassessment. Technical recovery does not charge another slot.
  Deleting a cycle does not restore this allowance; deleting the account does.
- Paid creation is off by default. If separately enabled, only owned, verified,
  unexpired billing ledger records in the configured provider environment qualify.
  Billing-disabled premium defaults and caller-supplied tiers are not used.
- Learning events have IDs and enums only. Inference attempt records include
  reported input/output/thinking/total tokens, latency and outcome. Unknown usage
  remains null, not zero. Provider invoices are not reconciled by this feature.

Relevant code: `src/lib/learning/`, `src/components/learning/`,
`src/app/api/learning/[...path]/route.ts`, and `src/app/practice/[cycleId]/page.tsx`.
The existing accepted rubric and full-debate feedback normalizer are unchanged.

## Staging sequence

1. Migration 017 is already user-confirmed on staging. Apply
   [migration 018](../supabase/migrations/018_drill_runtime.sql) next. It adds
   runtime, response, allowance, evaluation and event tables and server-only RPCs.
   It does not backfill historical debates or grant new authenticated write access.
2. Run [the runtime SQL suite](../supabase/tests/drill_runtime.sql) in staging's
   SQL editor as postgres, with the complete script selected. It rolls back its
   fixtures. `expect_error` helper outputs are expected; any SQL error fails the
   suite. It checks lifecycle transitions, stale drafts, duplicate claims, expired
   leases, score rejection, insufficient-evidence completion, RLS and deletion.
3. Run the concurrency verifier in the repository terminal using staging values:

   ```sh
   read -r "staging_ref?Staging Supabase project reference: "
   export STAGING_SUPABASE_URL="https://${staging_ref}.supabase.co"
   read -rs "STAGING_SUPABASE_SERVICE_ROLE_KEY?Staging service-role key (hidden): "
   printf '\n'
   export STAGING_SUPABASE_SERVICE_ROLE_KEY
   node scripts/verify-drill-runtime.mjs "$staging_ref" /tmp/phase-1-drill-runtime.json
   unset STAGING_SUPABASE_SERVICE_ROLE_KEY
   ```

   Expect top-level `passed: true` and every check/cleanup passing. The script
   races two source debates for one free slot and eight submissions per response;
   exactly one evaluation claim and completion commit may succeed. It deletes its
   synthetic identity and all fixture data. It performs no inference or payments.
4. Deploy the code to staging with `LEARNING_ROLLOUT=off`. Verify existing debate
   and paid flows remain unchanged. The new routes must reject unauthenticated
   requests, and saved-cycle reads must remain available when rollout is off.
5. Have a debate coach review the draft curriculum in `drill-templates.ts` using
   the checklist below. Only then set `LEARNING_APPROVED_TEMPLATES` to the approved
   version IDs. Setting an environment variable is not itself review evidence.
6. Set `LEARNING_ROLLOUT=pilot` and `LEARNING_PILOT_USERS` to explicit staging
   account IDs. Keep `LEARNING_PAID_ENABLED=false`. Configure Gemini, service-role
   access, rate limiting and monitoring in staging; never reuse production keys.
7. Run a real authenticated journey for each family using eligible test transcripts.
   Verify exact source references, draft resume on another device, initial feedback,
   revision, parallel reassessment, and final events. Include duplicate-click,
   transient failure, insufficient-evidence and invalid-score cases. Confirm the
   observed model token metadata and alert recipient. Delete synthetic fixtures.
8. Exercise pilot exclusion and `off` rollback. Off preserves readable work and
   blocks new writes/generation. Existing in-flight evaluations may still commit;
   it does not cancel a provider request already running. Keep additive migrations.

## Coach review checklist

For each template/version, record reviewer, date, accepted difficulty guidance,
example responses, reassessment suitability and any changes required. Review:

- Counterargument: selected preceding opposing text may contain several claims;
  instructions must help learners identify its strongest actual reason, without
  claiming an automated strongest-argument extraction has been validated.
- Warrant: both excerpts must be genuine learner text. Their relevance can be
  weak; explaining why they fail to connect is a legitimate answer. Transcript
  assertions are not independently verified sources.
- Repair: the original exercise deliberately provides no independent support.
  A conditional claim plus a clear evidence gap can be successful; invented
  supporting data must not be rewarded.
- Beginner/intermediate/advanced instructions: check that they elicit enough
  evidence for the accepted dimension anchors without requiring a full debate.
- Parallel reassessments: the first versions use fixed library scenarios. They
  are practice reassessments, not reserved unseen-topic transfer tests. Repeated
  exposure must not be described as evidence of transfer.

The plan proposes 54 held-out response examples with two independent coaches,
adjudication, and per-family agreement review. No such ratings are populated or
claimed by this implementation. Full-debate calibration does not substitute for
this targeted exercise review.

## Verification scope and remaining release work

[Local verification evidence](evidence/phase-1-drill-local.json): all 222 unit/API
tests passed; the 28 learning tests passed again after the version guards changed.
The production build, including typecheck and lint, passed. Both SQL suites
passed in isolated PostgreSQL. All six desktop/mobile browser tests passed;
the mobile challenge screenshot was visually inspected for layout and clipping.

Local unit/API tests cover routing, parsing, flags, authenticated ownership
binding, provider failures, saved provenance and duplicate inference prevention.
The isolated PostgreSQL runtime uses prerequisite schema and simulated Supabase
roles; it is not a full hosted migration-chain or multi-connection test.
Browser fixtures exercise the actual practice UI with mocked learning APIs and
blocked external browser requests and a mocked same-origin telemetry tunnel.
They do not establish hosted authentication,
real model output quality or provider billing correctness.

Migration 018 application is user-confirmed on staging. Hosted runtime SQL and
concurrency checks, real-service journeys,
curriculum approval, coach calibration, and the 20–30 learner pilot remain release
checkpoints. Stripe reconciliation remains deferred; Google Play reconciliation
must be verified before paid rollout. No production deployment is claimed.

The learning event data supports seven-day cycle-completion cohorts; a product
report and durable logging of unavailable recommendations are follow-up work.
Do not claim the proposed 30% completion signal until a complete observation
window, numerator, denominator and unavailable cases have been reviewed.

## Reproduce local checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
npx playwright test e2e/learning.spec.ts --project=desktop --project=compact
```

The SQL suites can also run against a disposable fully migrated PostgreSQL
database. Do not run a second build while a local production server is serving
the previous `.next` output; stop/restart that server around builds.
