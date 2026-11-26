# Phase 1: three targeted drill families

Status: implementation plan. The first shared runtime and three draft templates
are implemented locally; see [implementation, checks and staging rollout](PHASE_1_DRILL_ROLLOUT.md).
Hosted rollout and curriculum validation remain pending.

Build a shared 3–5 minute learning flow: **source transcript moment → challenge
→ response → focused coaching → revised response → linked reassessment**.
Deliver counterargument response first, then claim-to-evidence warrants, then
unsupported-claim repair. Each family uses a controlled, coach-approved template
and the existing rubric. Generated variations may adapt the exercise context,
but cannot redefine scoring criteria or invent supporting sources.

## Existing foundation and scope

- Migration 017 provides owned learning cycles and immutable `debate`, `drill`
  and `reassessment` session links. Staging SQL checks and concurrent HTTP retry
  verification passed; see [foundation evidence](PHASE_1_LINKED_SESSIONS.md).
- `rubric.ts` and `feedback.ts` are accepted. Preserve their full-debate contract.
  Drill assessment needs its own narrow schema; do not fabricate five scores to
  make a single-skill exercise fit full-debate feedback.
- `feedback-panel.tsx` currently sends practice clicks to full debate setup.
  Replace this entry point only for eligible drills behind a new server flag.
- Exercise content, responses, attempt state, assessments, learning events and
  introductory-cycle entitlement enforcement remain to be implemented.
- This milestone covers AI-coached personal practice. Human-versus-human judge
  results and Phase 2 skill profiles/unseen-topic transfer checks remain separate.

## 1. Define and review the three exercise templates

Create `src/lib/learning/drill-templates.ts`, with immutable IDs and versions,
target competency, descriptive subskills, required context, learner instructions,
response fields, difficulty constraints, coaching rules and reassessment rules.
Use typed family IDs instead of routing from free-text recommendation strings.

| Family / proposed version | Primary scored competency | Challenge and learner task | Observable success |
|---|---|---|---|
| `counterargument-response-v1` | `rebuttalQuality` | Show the learner's claim and an exact opposing argument from the debate. Ask the learner to restate its strongest warrant, answer it, and explain which case is stronger. | Represents the objection accurately; answers its reasoning; supports the response; compares the competing cases. |
| `claim-evidence-warrant-v1` | `argumentStrength` | Show a claim and a relevant evidence excerpt. Ask why the evidence supports the claim, what assumption connects them, and where the inference might fail. | Makes the inference explicit; identifies an assumption; addresses a plausible alternative or limit. |
| `unsupported-claim-repair-v1` | `evidenceUsage` | Show an overbroad or unsupported claim and a bounded evidence card. Ask the learner to narrow or qualify the claim and explain what the evidence supports and leaves unresolved. | Matches claim strength to available support; uses relevant evidence; acknowledges limits without fabricating support. |

All use the existing 1–10 dimension anchors. Subskill checks explain the score;
they are not additional headline scores. Rhetorical skill is not independently
scored in this initial set.

Examples of task shape, not approved curriculum:

- Counterargument: respond to the objection that a school-phone restriction
  prevents students from contacting caregivers; address the objection's actual
  reasoning before weighing the tradeoff.
- Warrant: explain how a supplied observation about fewer classroom interruptions
  could support a learning-related claim, and why it does not prove causation.
- Repair: revise “phone restrictions improve every student's grades” to match
  the limited observation without inventing an outcome measurement.

The coach supplies or approves examples across beginner, intermediate and
advanced difficulty, plus response anchors, common mistakes and parallel
reassessment variants. Keep test examples distinct from prompt-development
examples. Synthetic evidence cards must be clearly labeled hypothetical; real
cards retain their source/provenance. No open-web research is required at runtime.

**Done when:** all three template specifications and difficulty variants have
coach signoff; source availability and insufficient-evidence rules are explicit.

## 2. Select an eligible source moment and family

Add `src/lib/learning/recommendation.ts` and a server-side context loader.

1. Authenticate the learner and load the owned, completed AI debate and valid
   coaching. Do not accept a client-supplied owner, competency or transcript as
   authoritative.
2. Validate an exact learner excerpt and turn ID supporting the target weakness.
   Store that learner turn as the cycle's `cited_turn_id`; store additional
   opposing/evidence references separately with the exercise.
3. Rank supported target dimensions by score, using a documented stable tie-break.
   Map `rebuttalQuality` to counterargument response, `argumentStrength` to warrants,
   and `evidenceUsage` to claim repair. Explain the selected focus to the learner.
4. Check family prerequisites: counterargument needs an opposing argument;
   warrants need a claim/evidence pair; repair needs a claim plus bounded support.
   Coach-authored supplemental cards are allowed but must be labeled as exercise
   material, never presented as original transcript text.
5. If no supported source moment fits a family, return an unavailable state and
   retain the existing debate-practice option. Do not force a mapping from a
   rhetorical weakness or invent a missing transcript reference.

**Done when:** every recommended drill traces to an owned learner turn and all
displayed transcript quotations resolve exactly; unavailable cases are handled.

## 3. Persist exercises, responses and state

Use additive migrations after 017; assign migration numbers at implementation
time. Its session-link trigger rejects updates, so keep mutable runtime state in
new tables rather than adding state updates to `learning_sessions`.

Proposed tables:

- `learning_exercises`: one immutable snapshot per drill/reassessment session;
  family/template version, challenge, exact references, supplied evidence,
  difficulty, rubric and generation provenance. Retain the delivered challenge
  so refreshes never regenerate a different task.
- `learning_attempt_state`: one row per session; current state, revision counter,
  generation/evaluation lease, expiry and timestamps. Suggested states:
  `preparing`, `ready`, `evaluating`, `coached`, `completed`, `failed`.
- `learning_responses`: immutable submissions with initial/revision role,
  response content, server timestamps and request ID. Store a separate owned
  draft for resuming across devices, with optimistic revision checks.
- `learning_assessments`: response ID, target competency, nullable score, status,
  rationale, validated response excerpts, subskill observations and evaluator
  provenance. Missing/invalid evidence never receives a default score.

Use composite foreign keys to carry session ownership through every table,
owner-read RLS and server-controlled mutations. Enforce one accepted assessment
per submitted response and cascade deletion from source/cycle/session. Keep
learner text in protected content tables, outside event payloads.

The initial response and coached revision belong to the same drill session.
The separate reassessment session remains a child of that drill, matching 017.

**Done when:** reload and a second authenticated device recover the same exercise
and latest saved draft; stale writes, cross-user access and orphan records fail.

## 4. Build idempotent server orchestration and allowance enforcement

Create `src/lib/learning/service.ts`, generation/evaluation modules and APIs:

| Proposed endpoint | Responsibility |
|---|---|
| `POST /api/learning/cycles` | Validate source, select eligible template, atomically reserve allowance and create cycle/root/drill; return an existing result for retries. |
| `GET /api/learning/cycles/[cycleId]` | Return the owned cycle, attempts, saved content and resumable state. |
| `PUT /api/learning/sessions/[sessionId]/draft` | Save the learner's draft with an expected revision. |
| `POST /api/learning/sessions/[sessionId]/responses` | Persist an immutable response, claim evaluation and return its assessment/status. |
| `POST /api/learning/cycles/[cycleId]/reassessment` | Require a completed drill and create/resume its linked reassessment. |

Require stable request IDs for mutations. Identical retries return the original
result; conflicting payloads return 409. Validate input sizes, family/template
IDs, legal state transitions and ownership on the server. Use rate limiting.

Keep model calls outside database transactions. Atomically claim work with an
expiring lease and fencing token; only the current lease holder may commit the
result. A second submit polls/returns the in-progress job instead of starting
another evaluation. Retry transient provider failures within a bounded policy.
Record all attempts and avoid duplicate persisted results; provider timeouts can
still cause repeated inference, which must be visible in cost telemetry.

Reserve one free introductory cycle atomically under the existing per-owner
learning lock, in the same transaction as session creation. That reservation
covers the drill, revision and linked reassessment, including recovery from
technical failure. Reuse the reservation on resume. Proposed initial product
rule: one introductory cycle per account, not one per family. Check the stored
reservation before gating any continuation; never insert an upgrade block
halfway through the reserved cycle. Define premium access using verified
server-side entitlements. Do not rely on client-supplied limits or the billing-off
premium default when testing free-tier behavior.

Stripe reconciliation remains deferred under the existing decision. A limited
pilot may exercise the free cycle without checkout; it must not claim payment
provider parity. Keep unresolved Google Play entitlement verification separate
and gated before paid rollout.

**Done when:** simultaneous first-cycle requests cannot reserve two free cycles;
identical submissions cannot duplicate a response/assessment; technical retries
and reassessment remain available under the original reservation.

## 5. Implement targeted coaching and reassessment

Add a drill-specific assessment parser and prompts under `src/lib/learning/`.
Freeze prompt/rubric/difficulty versions across a cycle. Save the actual model,
template, prompt, rubric, task format, input/output usage and latency per attempt.
Treat learner text as data and validate all quoted response spans server-side.

1. Assess the first drill response against the target competency only.
2. Return one grounded strength, one actionable correction and a retry instruction.
   Avoid presenting a finished model answer before the revision.
3. Assess the revision under the same contract. Show exact before/after excerpts,
   the targeted scores when comparable, and the observed change.
4. Offer a linked, coach-approved parallel reassessment targeting the same skill
   and difficulty, with new wording/context and no answer hints before submission.
5. Mark activity completion independently of score improvement. A learner may
   complete a cycle with unchanged/lower scores or insufficient scoring evidence.
   Provider/parser failures remain technical failures and must not count as
   successfully evaluated completions.

Do not compare a full-debate dimension score numerically with a short drill
score. Initial-versus-revised drill responses support a within-task comparison;
parallel reassessments need coach review for comparability and should be labeled
separately. Neither is evidence of broad learning transfer. Do not calculate an
overall score or put these records into the existing full-debate progress chart.

**Done when:** score validation, insufficient-evidence handling, grounded coaching
and provenance checks pass; no invalid/default scores enter comparisons.

## 6. Deliver the learner flow

Add a dedicated `/practice/[cycleId]` route and shared practice components.
Update the eligible feedback CTA to “Practice this weakness”; retain the source
excerpt and a brief explanation of the skill being practiced.

Screens: challenge and response → evaluating → focused coaching and revision
→ before/after comparison → linked reassessment → cycle summary. Each screen
shows the single target skill and the next action. Offer resume for existing
cycles, a clear saved-draft indicator, retry for technical failures and readable
completed results. Avoid full debate setup, opponent selection and round stages.
Support mobile, keyboard navigation and screen-reader status announcements.

**Done when:** a new free learner completes the full flow without a payment block;
refresh, navigation away, duplicate clicks and device changes preserve progress.

## 7. Add durable measurement and rollout controls

Create a separate `learning_events` table referencing learning sessions and cycles.
Do not repurpose Phase 0's debate-only `lifecycle_events.session_id`. Derive events
from committed server transitions and deduplicate by session/action as appropriate:
`drill_started`, `response_submitted`, `coaching_viewed`, `drill_completed`,
`reassessment_started`, `reassessment_completed`, `cycle_completed`.
Define `drill_started` as the first rendered challenge acknowledged by its owner,
not the creation of an empty record or the original practice CTA click.
Multiple response events use response IDs; once-per-session/cycle events use
unique keys. Payloads contain IDs/enums only, never response or transcript text.

Add `LEARNING_ROLLOUT=off|pilot|on` and a pilot-user allowlist. Check the flag in
every new mutation/generation route. Off preserves reads of saved work and
blocks new activity; account deletion remains available. Record failed/invalid
evaluation counts, all attempted inference usage, latency and responsible alerts.

Measure the Phase 1 validation signal using a fixed cohort of first-debate
completers and a full seven-day observation window: unique learners who finish
both a drill and its linked reassessment / unique first-debate completers.
Count a learner once; report numerator, denominator and unavailable-drill cases.
Track coaching usefulness and abandonment at each step separately from scores.

**Done when:** retries cannot inflate completions, content stays out of analytics,
and pilot/off behavior is verified in the deployed environment.

## 8. Validate and release in increments

1. **Foundation:** review templates; migrate runtime/content tables; verify RLS,
   parent linkage, deletion, state transitions and concurrent allowance reservation.
2. **Counterargument vertical slice:** ship one full cycle behind the pilot flag,
   including real generation, revision, reassessment and recovery. Validate the
   shared engine before adding the remaining families.
3. **Warrant family:** add reviewed templates and held-out assessment examples;
   reuse the same state, entitlement and UI paths.
4. **Claim-repair family:** verify supplied-evidence boundaries and rejection of
   invented source claims, then enable the third template.
5. **Staging release gate:** exercise all three families with owned free accounts;
   test denied cross-user access, concurrent submissions, lease expiry, invalid
   model output, reload/resume, event deduplication and full deletion. Run relevant
   unit/API tests, SQL suites, authenticated browser tests, lint and typecheck.
6. **Human quality gate:** two coaches independently review held-out responses
   across families, difficulty and response quality, then adjudicate. Proposed
   starting set: 54 response examples (3 families × 3 difficulties × 3 quality
   bands × 2 examples). Review scoring disagreement and instructional usefulness
   per family. Target at least 80% of valid AI target scores within one point of
   adjudicated ratings for each family; separately review insufficient-evidence
   classification. This small set is an initial gate, not proof of effectiveness.
7. **Learner pilot:** invite 20–30 target learners. Evaluate the proposed 30%
   seven-day drill-plus-reassessment completion signal with actual cohort counts.
   Review failures and abandonment before broadening access or adding families.

Engineering owns schema, services, UI and verification; the coach owns curriculum
and human evaluation; product owns the free-cycle policy and pilot review. These
are role assignments for planning, not confirmed staffing. The rubric approval
already received does not substitute for review of these new exercise templates.

## Completion criteria

All three families run through the same resumable engine, preserve source and
attempt links, offer grounded single-skill coaching and a linked reassessment,
and permit one complete free introductory cycle. Staging technical gates and
coach review pass; pilot evidence is recorded before broad rollout. No completed
practice or transferable-improvement claim is inferred from a CTA click or an
unvalidated score increase.
