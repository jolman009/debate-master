# Phase 0 measurement readiness

Implementation date: September 19, 2026. Release remains gated on production verification and independent coach calibration.

## Delivered contract

New AI coaching uses observable anchors and descriptive subskills in `src/lib/debate/rubric.ts`. All five scores must be integers from 1–10. Missing/invalid scores return 502, persist invalid status, and never become fabricated feedback. An unevaluated session has missing status; pre-migration results are legacy. Existing JSON is preserved. Each successful new evaluation stores rubric/prompt/model, actual format/difficulty, timestamp, latency and input/output tokens in its assessment. Model failover records the model that actually returned the result. Progress excludes unprovenanced scores and compares matching model/prompt/rubric/format/difficulty only. A successful retry reuses persisted feedback; concurrent saves use first-write-wins.

Migration 015 captures debate_started at insert, debate_completed at the first transition to feedback/judge/complete, and coaching_generated at the first persisted feedback. Events are transactionally coupled to the state write. Coaching viewed is sent on panel mount to an authenticated RPC with owner and feedback checks. Unique owner/session/event keys deduplicate retries; UUID event IDs and database timestamps are authoritative. No properties field accepts transcript, motion, focus or other user text. Loop ID is null until Phase 1. Existing UI analytics uses topic/session IDs; practice_clicked is a click, not a completed drill. No WCIL claim is possible before Phase 1.

Funnel denominator: distinct owned sessions started after migration; completion numerator: those session IDs with debate_completed. Coaching conversion uses coaching_generated → coaching_viewed. Time-to-coaching uses start to generation timestamps; report cohort dates, counts and median. Legacy sessions are not backfilled into funnel counts. Human debate events currently describe the creator session; do not interpret them as both participants' activation. New human judge verdicts also retain evaluator provenance inside judge_result, with a separate prompt version; historical verdicts have unknown provenance and remain outside AI learning trends.

## Rollout and rollback

Migration 015 is applied (user confirmation and live behavioral verification). Deploy the application code next: the production measurement endpoint currently returns 404. Start with MEASUREMENT_ROLLOUT=pilot and MEASUREMENT_PILOT_USERS containing internal auth IDs. Run `supabase/tests/measurement.sql` in a disposable migrated database, then complete an authenticated browser debate and retry feedback/view requests. Verify exactly one event of each kind and inspect all displayed reference links. Switch to on only after calibration and operational gates pass. off immediately pauses new AI coaching/view requests; existing coaching stays readable and authoritative DB events continue. Keep the additive migration on rollback; do not drop collected data. No new entitlements are introduced in Phase 0; future entitlement APIs must use server flags and atomic enforcement.

## Operational review and unresolved evidence

- Migration 015: applied per user confirmation. Live Supabase checks on September 19 passed all 12 assertions: owned start, no premature view, exactly one of each event despite six concurrent view retries, event metadata/privacy, cross-user isolation, anonymous denial, direct insert/update/delete denial, and cascading deletion. See [database evidence](evidence/phase-0-database.json). This verifies behavior, not the full remote migration ledger; the CLI checkout remains unlinked.
- AI rate limiting: verified against https://debate-master-psi.vercel.app using a disposable authenticated account. Twenty requests for a nonexistent debate returned 404; request 21 returned 429 with Retry-After=22 seconds. No inference was invoked. See [production HTTP evidence](evidence/phase-0-production.json). TTS limits, other instances and absent-credential fail-open behavior remain separate checks.
- Monitoring: local SENTRY_DSN is empty; deployed Sentry configuration is unknown. reportError forwards only with a DSN. Send a controlled failure and verify delivery and alert ownership once monitoring access/configuration is available.
- Billing: debate creation derives the tier server-side and uses atomic quota RPCs. Stripe/Play reconciliation and actual production entitlement behavior still require test accounts and webhook replay. Existing billing unit checks are not production proof.
- Feedback: invalid responses now fail explicitly; storage errors are surfaced. Alert on invalid feedback and feedback API failures. Capture request counts externally to compute failure rate; console errors alone do not establish a denominator.
- Latency/cost: successful evaluations retain latency and token usage; null means unavailable, never zero. Aggregate p50/p95 latency by model; multiply token counts by the deployment's verified provider prices. Failed attempts, retries and debate-turn costs require provider billing reconciliation; no dollar-cost baseline has been fabricated.
- Calibration: `docs/calibration/sample-manifest.json` contains 72 balanced collection slots. Two independent coach raters, actual transcripts and adjudication are outstanding. The executable gate deliberately fails the empty manifest. No human labels or passing quality claim are supplied.

These external evidence gaps prevent declaring the Phase 0 release gate passed.

## Local validation

Lint and TypeScript checks passed. All 156 unit tests passed, including missing/invalid score exclusion, exact transcript-reference filtering, authenticated view collection and rollback behavior. The calibration script reports zero ready samples and gate=false, as intended. The SQL fixture has not run, but the live API verifier now covers the applied database behavior with real owner/other-user/anonymous credentials. All disposable fixtures were successfully cleaned up. Browser validation results are recorded below after the final run.

Final browser run: production build succeeded and all nine desktop smoke/setup checks passed. The smoke test's Leaderboard assertion was scoped to navigation because the footer also contains that link. These public/unauthenticated checks do not substitute for the pending authenticated database lifecycle test.


## Evidence follow-up — September 19, 2026

Quick wins closed: live lifecycle deduplication/ownership and deployed AI rate-limit enforcement. The JSON reports retain timestamps, scope and individual results; they contain no credentials or learner content. Reproduce with:

```sh
node scripts/verify-measurement.mjs /tmp/measurement-evidence.json
node scripts/verify-production-measurement.mjs https://debate-master-psi.vercel.app /tmp/production-measurement-evidence.json
```

Both scripts load local environment configuration. They create disposable confirmed test identities without sending emails and delete their fixtures afterward. The first script uses admin credentials only for setup, cleanup and a deletion assertion; event ownership assertions use actual user JWTs. The second sends at most 21 feedback requests to a random nonexistent debate, avoiding inference charges. Run against the intended project only; each report identifies its target. A failed cleanup makes the run fail and prints the affected fixture identity ID.

**Next blocking deployment check:** POST /api/measurement currently returns 404, where the new route should return 401 for an anonymous caller. The combined HTTP report therefore correctly remains failed even though its rate-limit check passed. Deploy the prepared Phase 0 application changes, enable the internal pilot and rerun this verifier. Then complete an authenticated browser debate, verify persisted evaluator provenance and every displayed transcript link, and check view collection through the deployed UI. Database-only synthetic writes do not establish that end-to-end gate.

Still open: deployed monitoring delivery/alert ownership, Stripe/Play production reconciliation, feedback failure-rate denominator, measured inference cost/latency baseline, independent coach scores/adjudication. Neither the live DB check nor the limiter test establishes coaching quality or a passing overall Phase 0 release gate.
