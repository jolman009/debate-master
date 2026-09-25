# Phase 1 linked session foundation

Migration `017_linked_learning_sessions.sql` adds learning cycles and linked
sessions without changing existing debates, debate quotas, feedback or events.
Staging application was confirmed by the user on September 24, 2026, following
the earlier staging migrations. The user also confirmed that the complete SQL
verification suite finished successfully without SQL errors; the `expect_error`
output was the expected helper column. Hosted linkage, ownership, client
permission, sequential-retry and deletion-cleanup assertions therefore pass on
user-reported evidence, with fixtures rolled back. Concurrent HTTP retry
verification also passed on staging: the saved report was inspected and retained
as [concurrency evidence](evidence/phase-1-staging-concurrency.json).
Production application is not confirmed.

Each cycle stores its authenticated owner, originating debate, cited turn and
one target competency from the existing rubric. Every session inherits those
fields through `loop_id`. A cycle has one `debate` source session; a `drill`
references that session, and a `reassessment` references the drill. Multiple
attempts are allowed. Drill and reassessment records require an exercise-template
version. These are links only, not drill content or completion records.

Composite foreign keys prevent linking another owner's debate, a turn from a
different debate, or a parent from another cycle. Deleting source material
cascades to its dependent learning records. Existing debates are not backfilled;
human-mode participants do not gain access to the creator's learning cycles.

## Trusted server integration

No public creation endpoint is enabled yet. Authenticated clients may read only
their own cycles and sessions; anonymous access and client writes are denied.
Use the service-role client only after verifying the request's user on the server.
Never take `p_user_id` from a request body.

1. Call `create_learning_cycle` with the verified user ID, source debate ID,
   cited turn ID, target competency and a stable UUID request ID. It requires
   completed, valid AI coaching and atomically creates the cycle and source
   session. Find that session by `loop_id` and `session_type = 'debate'`.
2. Call `create_learning_attempt` with the verified user ID, loop ID, parent
   session ID, `drill` or `reassessment`, exercise-template version and a new
   stable UUID request ID. Reuse this ID for retries of the same operation.
3. Identical requests return the original record. Reusing a request ID with
   different arguments fails. Creation is serialized per owner to prevent
   concurrent retries from creating duplicate records.

Before exposing these functions through a learner-facing API, implement free
introductory-cycle entitlement checks atomically with creation. These functions
do not consume allowances or reconcile payment providers.

## Validation and remaining work

Run `supabase/tests/linked_learning_sessions.sql` against a disposable migrated
database as postgres with stop-on-error enabled. The test rolls back fixtures.
It checks linkage, retry identity, conflicting retries, parent types, ownership,
client permissions and deletion cleanup.

Local verification (September 24, 2026): migration 017 and the SQL assertions
passed in an isolated PGlite PostgreSQL runtime with migrations 001, 002 and 015,
the prerequisite `judge_result` column, and simulated Supabase auth roles.
TypeScript, lint and all 194 existing unit tests passed. This verifies the new
SQL against its prerequisite schema, not the full hosted migration chain or
multi-connection concurrency. The staging SQL suite subsequently passed as
reported above. The separate concurrent HTTP checks also passed, as recorded
below. Entitlement integration is still required before exposing creation APIs.

### Concurrent retry verification on staging

From the repository directory, run the following in zsh. Supply the staging
Supabase project reference and its service-role key at the prompts. The key
input is hidden and is not placed in shell history. Do not paste it into chat.

```sh
read -r "staging_ref?Staging Supabase project reference: "
export STAGING_SUPABASE_URL="https://${staging_ref}.supabase.co"
read -rs "STAGING_SUPABASE_SERVICE_ROLE_KEY?Staging service-role key (hidden): "
printf '\n'
export STAGING_SUPABASE_SERVICE_ROLE_KEY
node scripts/verify-learning-concurrency.mjs "$staging_ref" /tmp/phase-1-concurrency.json
unset STAGING_SUPABASE_SERVICE_ROLE_KEY
```

The verifier does not load `.env.local` and refuses the known production project.
It creates a disposable identity, debate and turn, then runs three rounds of
eight parallel HTTP requests for each cycle, drill and reassessment creation.
Each batch must return the same record ID and persist one record. It also races
two different payloads sharing a fresh request ID: one payload must win, and
the other must fail with `22023`, with exactly one persisted record.

Pass criteria: exit code zero, top-level `passed: true`, and every check and
cleanup item passing in `/tmp/phase-1-concurrency.json`. It removes synthetic
records and the identity even after a test failure; failed cleanup fails the
report and lists fixture IDs for recovery. The report contains no credentials
or learner content. No model inference or payment calls occur.

This is a concurrent HTTP smoke test, not a throughput benchmark or proof of
allowance enforcement. Entitlements are not implemented by these functions.
Hosted verification: September 25, 2026 at 01:33:30 UTC (September 24 in
America/Chicago), targeting `twtsdothnlfvbczzpdaj.supabase.co`. All 36 assertions
and all three cleanup checks passed across three rounds of eight parallel
requests per batch. The top-level result is `passed: true`. Evidence was read
from the generated report and retained in
`docs/evidence/phase-1-staging-concurrency.json`.

Next work packages add coach-authored exercise templates, short drill flow,
attempt content/state, targeted assessment, entitlements and durable learning
events. Phase 0 `lifecycle_events.session_id` continues to reference debates;
its `loop_id` stays untouched because one source debate can have multiple cycles.
Learning-session creation must not be counted as practice completion or WCIL.
