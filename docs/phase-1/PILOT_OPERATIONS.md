# Phase 1 pilot operations

Prepared October 3, 2026. This is an execution guide, not a release approval.

## Deployment order

1. Confirm Preview has `SUPABASE_SERVICE_ROLE_KEY` scoped to the staging project.
   Apply migrations 019 (atomic AI turns) and 020 (measurement) to staging.
2. Run `scripts/verify-ai-turn-concurrency.mjs` against the explicit staging ref;
   retain its content-free JSON. It tests eight concurrent requests, lease
   replacement, stale-worker fencing, retry and owner denial using disposable fixtures.
3. Deploy the application change, retaining `LEARNING_ROLLOUT=off` and
   `LEARNING_PAID_ENABLED=false`. Repeat the Preview debate including a controlled
   interrupted stream and explicit retry. Inspect persisted turn counts.
4. Verify all learning writes return 503 while off and an owned existing cycle
   still renders. A request accepted before the flag changes may finish: flags are
   checked at request admission, not by the database completion RPC. Deployments do
   not necessarily terminate old invocations. Watch pending evaluations until their
   90-second leases expire; no automatic retry is allowed after off.
5. Review and approve exact v2 templates before setting the pilot allowlist.
   Existing v1 cycles remain readable and paused; no automatic reinterpretation.

## Controlled pilot scope and approval record

Use deterministic v2 templates, not model-generated exercise variations. Record
reviewer, date and approved versions for all three families in the readiness record.
The app generates coaching, not exercise variations. Calibration and curriculum
approval remain required before learner enrollment.

Generate the proposed 54-slot held-out worksheet in restricted storage:

```sh
node scripts/calibrate-drills.mjs --template /private/tmp/drill-calibration.json
```

Fill each exercise/response with consented or coach-authored held-out examples;
include insufficient-evidence cases within the design. Two distinct coaches rate
blind to AI scores, then adjudicate with disagreement explanations retained outside
Git. Record exact provenance before running:

```sh
node scripts/calibrate-drills.mjs /private/tmp/drill-calibration.json
```

The script reports per-family and subgroup scores and insufficient classification.
Passing the proposed 80% within-one threshold is not coach sign-off.

## Cohort and review

Before enrollment, freeze a restricted JSON manifest with `userIds`, `start`, `end`
and reporting `asOf` (ISO timestamps). Use 20–30 target learners and preserve the
manifest version. The denominator is unique enrolled learners whose first retained
AI debate completion falls in `[start,end)`, with seven complete days of follow-up.
Only a completed cycle linked to that first debate counts in the numerator. Pending
learners and unavailable recommendations are reported separately; unavailable
learners remain in the denominator. Historical event gaps/deletions are limitations.

```sh
node scripts/learning-pilot-report.mjs /private/tmp/cohort.json /private/tmp/pilot-report.json
```

Requires staging URL and service-role key in the shell; never paste keys into reports.
The report includes started-without-completion counts, which are follow-up candidates,
not proven abandonment. No response or transcript text is exported.

Use the staging SQL editor for the durable usefulness review queue:

```sql
select debate_id, rating, created_at, updated_at
from public.coaching_usefulness
where reviewed_at is null
order by (rating = 'reported') desc, updated_at;
```

Authorized reviewers inspect an owned/authorized session only when needed. Record
one disposition (`no_action`, `prompt_review`, `curriculum_review`, or
`technical_followup`) and `reviewed_at`; never paste learner text into the queue.
Changing a rating reopens review. Review reported/not-helpful ratings and incomplete
cycles daily during enrollment, recording counts and decisions without learner text.

## Exhausted evaluation recovery

Migration 021 adds one audited recovery grant per response. It preserves the three
original evaluation rows and saved answer, raises only that response's attempt limit
from three to four, and does not modify `learning_allowances`. Learners and normal
application routes cannot grant recovery.

First identify the response UUID in the staging SQL editor without selecting its
content. Confirm it is failed or invalid, has three attempts, no assessment and no
live lease:

```sql
select id, user_id, session_id, kind, status, attempts, attempt_limit, lease_until
from public.learning_responses
where session_id = '<affected-session-id>';
```

Then use explicit staging credentials from the repository terminal:

```sh
read -r "staging_ref?Staging Supabase project reference: "
export STAGING_SUPABASE_URL="https://${staging_ref}.supabase.co"
read -rs "STAGING_SUPABASE_SERVICE_ROLE_KEY?Staging service-role key (hidden): "
printf '\n'
export STAGING_SUPABASE_SERVICE_ROLE_KEY
node scripts/grant-learning-evaluation-recovery.mjs "$staging_ref" \
  '<response-id>' '<operator-reference>' provider_unavailable
unset STAGING_SUPABASE_SERVICE_ROLE_KEY
```

Allowed reasons are `provider_unavailable`, `provider_timeout`, and
`platform_incident`. A repeated command reports `granted: false`; it cannot create
a fifth attempt. After `granted: true`, the learner refreshes the saved cycle and
selects **Retry saved evaluation**. If the fourth evaluation also fails, the answer
remains readable and requires investigation rather than another reset.

## Release decision and rollback

Operator must name the rollback owner, alert recipient, error/latency/cost limits,
and observation window before enrollment. These are unresolved product decisions,
not defaults inferred by the implementation. Stop enrollment on an ownership leak,
repeat billing consumption, or loss of saved answers; set rollout off and redeploy.
Preserve additive migrations and saved work. Review in-flight outcomes before restart.

After seven days per learner, review the proposed 30% completion signal with its
numerator and denominator, failures, unavailable cases, coach disagreements and
usefulness. Record improve/extend/proceed explicitly. Paid/production rollout and
transferable-learning claims are separate gates.

## Evaluation usage review

Count every attempt, including pending/expired/failed evaluations. Missing usage is
unknown, never zero. This query is an operational summary, not invoice reconciliation:

```sql
select outcome, count(*) attempts,
  count(*) filter (where usage->>'totalTokens' is null) unknown_token_attempts,
  sum((usage->>'totalTokens')::bigint) known_total_tokens,
  percentile_cont(0.95) within group (order by (usage->>'latencyMs')::numeric) p95_latency_ms
from public.learning_evaluations
group by outcome;
```

Filter by the frozen cohort and observation dates for the actual pilot report.
