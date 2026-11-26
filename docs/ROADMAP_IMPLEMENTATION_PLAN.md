# Debate Master roadmap implementation plan

Prepared November 26, 2026. This is the single plan for everything that is still
open. It consolidates and supersedes the open items in:

- [ROADMAP.md](../ROADMAP.md) (May 2026 product roadmap)
- [PENDING_IMPLEMENTATION_AUDIT.md](archive/PENDING_IMPLEMENTATION_AUDIT.md) (September 2 audit)
- [High-level implementation overview.md](../High-level%20implementation%20overview.md) (UI epic specification)
- [EPIC_IMPLEMENTATION_AUDIT.md](../EPIC_IMPLEMENTATION_AUDIT.md) (October 2 audit)
- [GROWTH_IMPLEMENTATION_PLAN.md](GROWTH_IMPLEMENTATION_PLAN.md) (October 2026–September 2027 growth plan)

It also pulls in the open items of [PHASE_1_TODO.md](PHASE_1_TODO.md) and
[GOOGLE_PLAY_PRODUCTION_1_0_8.md](GOOGLE_PLAY_PRODUCTION_1_0_8.md), because they
carry the current status of the growth plan's Phase 1 and the Android release.

Status here comes from those documents, recorded evidence and the `main` branch
as of commit `e5d5480`. Nothing in this document was newly tested. An item marked
open is not necessarily broken; it means no recorded evidence closes it yet.

---

## 1. How to read this plan

The source documents use two conflicting phase systems. This plan renames them:

| Prefix | Meaning | Old name |
|---|---|---|
| **R** | Release and operations work needed now | Scattered across release docs |
| **G0–G5** | Growth phases (learning-cycle product) | "Phase 0–5" in the growth plan and `PHASE_1_TODO.md` |
| **UX** | UI epic acceptance work (FND, NAV, SET, LIVE, COACH, TRUST, VIS) | "Phase 1–5" in the overview and both audits |
| **P** | Product backlog left from the May roadmap | "Phase 3/4" in `ROADMAP.md` |

Effort: **S** < 1 day, **M** 1–3 days, **L** 1 week or more. Owners are roles,
not named commitments: **Eng** engineering, **Op** operator with dashboard access,
**Coach** debate coach or evaluation owner, **PO** product owner.

---

## 2. Corrections to the source documents

These statements in the source files are stale or contradict each other. Treat
the right-hand column as current.

| Source claim | Current position |
|---|---|
| `ROADMAP.md`: stack is Next.js 14.2.21 | `main` runs Next.js 15.5 (async request APIs). Staging was synced to `main` on November 26. |
| `ROADMAP.md`: Claude model bumped to `claude-sonnet-4-6` | No `CLAUDE_MODEL` or Anthropic code remains in `src/`. Debates, coaching and drills use Google Gemini. Remove the claim. |
| `ROADMAP.md`: human-vs-human debates not built | Built in phases A (data model, invites, async turns), B (Supabase Realtime) and D (AI judge, ranked Elo leaderboard). No phase C was merged. Only the opening exchange has staging evidence. |
| `PENDING_IMPLEMENTATION_AUDIT.md`: all 20 epics "100% implemented and verified" | Superseded by the October 2 audit: 1 epic implemented, 17 mostly, 2 partial. Retire the September file. |
| `EPIC_IMPLEMENTATION_AUDIT.md`: usefulness endpoint only logs | Migration 020 added durable usefulness storage and a review queue. The deployed review workflow still has to be exercised (G1-6.3). |
| Growth plan: Phase 1 runs October–November 2026 | Phase 1 is still open at the end of November. All later growth dates move; see section 9. |
| Growth plan: reconcile Stripe and Google Play | Google Play passed a full license-test lifecycle in production (1.0.8). Stripe stays **deferred, not passed** by the September 20 scope decision, although `main` now contains Stripe entitlement reconciliation code. |
| Audit: Sentry and TWA edits are pending | The Sentry test-page fix is merged. The production TWA build is 1.0.8 (code 11). |

---

## 3. Where things stand

**Done and evidenced:** authentication, RLS, rate limiting, input caps, Sentry
wiring, CI, debate history, sharing, custom personas, topic packs, leaderboards,
PWA, Stripe and Google Play code paths, human-vs-human debates, linked learning
cycles with three v2 drill families, atomic AI turns, pilot measurement
(migrations 017–022), and one complete claim-repair learning cycle on staging.

**The critical path** is closing growth Phase 1 (G1). Every later growth phase
depends on it. In parallel, one release action (R1) and the UX acceptance debt
(UX) can proceed without blocking G1.

---

## 4. Track R — Release and operations (now)

| ID | Item | Source | Owner | Effort | Exit |
|---|---|---|---|---|---|
| R1 | Promote Android 1.0.8 (code 11) to the Production track in Play Console and choose rollout scope | Play 1.0.8 doc | Op | S | Release live; codes 9 and 10 stay superseded |
| R2 | Confirm which migrations (017–022) are applied to **production** Supabase, and record it | G0 work package 6; `PHASE_1_TODO.md` | Op + Eng | S | Written production migration inventory |
| R3 | Verify Sentry stored events, deployed error capture and a named alert recipient for staging and production | Phase 0 readiness; `PHASE_1_TODO.md` §3 | Op | S | Test event visible; alert reaches a person |
| R4 | Remove the temporary Stripe `product.created` event selection from the staging webhook destination | Phase 0 readiness | Op | S | Removal confirmed |
| R5 | Clean up retained synthetic smoke-test debates and fixtures; keep content-free reports | `PHASE_1_TODO.md` §1, §3 | Eng | S | Fixtures gone; reports retained |
| R6 | Keep `staging` in sync with `main` after every production merge; feature work lands on staging first | Branch sync, Nov 26 | Eng | S (ongoing) | `git rev-list main...staging` shows staging never behind |
| R7 | Archive superseded documents (see section 10) and point `ROADMAP.md` here | This plan | Eng | S | One live roadmap |


### Track R status log

- **R1 closed (Nov 26, 2026):** 1.0.8 (code 11) has been live on the Production track since October 14, 2026.
- **R2 closed (Nov 26, 2026):** production Supabase had only migration 022 applied; 017–021 were missing, while the production deploy of `e5d5480` (Nov 26, 10:52 UTC) already called `claim_ai_debate_turn` from 019. The operator applied 017, 018, 019, 020 and 021 in order through the SQL Editor at about 11:25 UTC. A presence check of one unique table or function per migration now returns true for 017–022. The Supabase Migrations page stays empty because migrations are applied through the SQL Editor, not the CLI. Lesson: apply a migration to production **before** merging code that needs it to `main`.
- **R3 mostly closed (Nov 26, 2026):** a production `SentryExampleAPIError` was captured and the Sentry alert email reached the operator. Browser-side capture (`SentryExampleFrontendError`) and the staging check are not yet confirmed.
- **R6 checked (Nov 26, 2026):** `main` and `staging` both at `e5d5480`.

---

## 5. Track G1 — Close growth Phase 1 (critical path)

Goal: a free learner completes debate → coaching → drill → reassessment, and the
pilot shows whether learners finish the cycle. Item numbers follow the sections
of `PHASE_1_TODO.md`.

### G1-1. Staging baseline (Eng/Op)

| ID | Item | Effort |
|---|---|---|
| G1-1.1 | Diagnose interrupted provider streams from logs; verify recovery with an explicit retry in staging. Keep earlier duplicate-entry evidence. | M |
| G1-1.2 | Verify authenticated learning writes are rejected when rollout is `off`, while owned saved cycles stay readable. The availability GET alone is not enough. | S |

### G1-2. Curriculum (Coach/PO)

| ID | Item | Effort |
|---|---|---|
| G1-2.1 | Check that approved transcript examples meet routing prerequisites: counterargument needs co-cited learner and opponent excerpts; warrants need distinct claim and evidence excerpts. Test the unavailable case without inventing links. | S |

### G1-3. Real-service journeys in staging (Eng/Coach)

| ID | Item | Effort |
|---|---|---|
| G1-3.1 | Complete a real **counterargument** cycle. Resume debate `f5e9ec83-…` by normal retry once Gemini recovers; do not duplicate or rewrite the source. | M |
| G1-3.2 | Complete a real **warrant** cycle. Cycle `3af71d41-…` is capped after its audited recovery; start a fresh cycle with a separate eligible account rather than resetting attempts. | M |
| G1-3.3 | Use separate eligible free accounts so each family runs without bypassing the one-introductory-cycle rule. | S |
| G1-3.4 | Verify exact quotations, targeted-only scores, version/model provenance, null insufficient-evidence scores and no fabricated overall score. | S |
| G1-3.5 | Test refresh, navigation away, second-device resume and stale-draft conflicts. | M |
| G1-3.6 | Test failed/invalid evaluations, lease expiry, duplicate clicks and bounded retries; failures must not count as completion. | M |
| G1-3.7 | Verify owner isolation and deletion cleanup across runtime, content and events. | M |
| G1-3.8 | Inspect events: one completion per action, practice clicks never counted as completions, no transcript or response text in analytics. | S |
| G1-3.9 | Record every evaluation attempt with token usage (known and unknown), latency and failures. A successful-call subtotal is not a reconciled bill. | S |
| G1-3.10 | **Provider resilience** (new, from repeated Gemini 502/503 failures): decide whether a second provider or a longer backoff is needed before enrolling learners. | M |

### G1-4. Calibration (two coaches)

| ID | Item | Effort |
|---|---|---|
| G1-4.1 | Prepare 54 held-out responses: 3 families × 3 difficulties × 3 quality bands × 2, including insufficient-evidence cases. Keep them out of prompt tuning. | M |
| G1-4.2 | Collect two independent ratings blind to AI output; adjudicate and keep originals in restricted storage. | L (calendar) |
| G1-4.3 | Score with recorded template, rubric, prompt and model versions. Proposed gate: at least 80% of valid target scores within one point of adjudicated ratings **for each family**. | M |
| G1-4.4 | Review disagreement by difficulty, quality, source relevance and reassessment comparability; record a coach decision and the limits of a small set. | S |

### G1-5. Pilot measurement (Eng/PO)

| ID | Item | Effort |
|---|---|---|
| G1-5.1 | Fix the denominator before enrollment and allow a full seven days of follow-up. Report numerator, denominator and unavailable cases, not percentages alone. | S |

### G1-6. Release controls and learner pilot (Op/PO)

| ID | Item | Effort |
|---|---|---|
| G1-6.1 | Verify an **excluded** user cannot start practice (the included-user half passed October 5). | S |
| G1-6.2 | Exercise `pilot → off`: new activity blocked, saved work readable, in-flight evaluation behavior understood. | S |
| G1-6.3 | Assign an operator and run the deployed usefulness/incomplete-cycle review workflow once. | S |
| G1-6.4 | Agree pilot error, latency and cost thresholds, the observation window and the rollback trigger. | S |
| G1-6.5 | Enroll 20–30 target learners after G1-3 and G1-4 pass. | M |
| G1-6.6 | Observe seven days per learner. Proposed signal: at least 30% of first-debate completers finish a drill and linked reassessment. | L (calendar) |
| G1-6.7 | Review abandonment, usefulness, failures and score disagreements; update the readiness record with results and limits. | S |

### G1-7. Paid and production rollout of learning (conditional)

| ID | Item | Effort |
|---|---|---|
| G1-7.1 | Google Play: confirm migration 022 and `GOOGLE_PLAY_ENVIRONMENT` in staging and production, then run duplicate-delivery and cross-account denial checks. The production lifecycle (purchase, renewal, restore, expiry) already passed. | S |
| G1-7.2 | Stripe: stays **deferred, not passed**. Reopen only when banking details are ready; then run sandbox purchase, renewal, cancellation, replay and reconciliation against the new entitlement code. | M (when reopened) |
| G1-7.3 | Before enabling learning in production: verify production migration state (R2), reviewed app version, environment settings, monitoring (R3) and rollback readiness. Keep `LEARNING_PAID_ENABLED=false` until G1-7.1 passes. | S |

**G1 exit:** record a free-pilot validation decision once G1-1 to G1-6 have
evidence, then either start G2 or document what must change first.

---

## 6. Track UX — UI epic acceptance (parallel to G1)

The 20 UI epics are built; what remains is acceptance evidence and a few real
gaps. Ordered by the October 2 audit's priorities.

### UX-A. Desktop transcript and live workspace

| ID | Item | Epics | Effort |
|---|---|---|---|
| UX-A1 | Replace the desktop modal transcript (backdrop, scroll lock) with a true side panel that leaves the composer usable | LIVE-02, VIS-03 | M |
| UX-A2 | Browser-test mobile sheet and desktop panel focus, Escape and focus restoration | LIVE-02 | S |
| UX-A3 | Verify mobile keyboard and safe-area behavior, resize draft preservation and 200% zoom | LIVE-01 | M |

### UX-B. Authenticated flow verification

Requires a signed-in Playwright fixture first (UX-B0), which unblocks most rows.

| ID | Item | Epics | Effort |
|---|---|---|---|
| UX-B0 | Add an authenticated Playwright fixture against a seeded test account | All | M |
| UX-B1 | Wizard back/forward/reload restoration and keyboard choice selection with error associations | SET-01, SET-03, FND-03 | M |
| UX-B2 | Motion discovery through to debate creation | SET-02 | S |
| UX-B3 | Authenticated bottom navigation at 320px; desktop menu focus order and trapping | NAV-01, NAV-02 | S |
| UX-B4 | Immersive debate route transitions with keyboard and screen reader | NAV-03 | S |
| UX-B5 | Transient submit failure keeps the draft | LIVE-03 | S |
| UX-B6 | Human debate invite → join → full exchange → verdict, and reconnect without duplicate turns | LIVE-03, P-H2H | M |
| UX-B7 | Rename tests whose names overstate their assertions (focus test, leaderboard test, setup-prefill test) or strengthen them | Test hygiene | S |

### UX-C. Coaching and trust

| ID | Item | Epics | Effort |
|---|---|---|---|
| UX-C1 | Give legacy feedback results a clearly reduced layout, not only an adapter badge | COACH-02 | S |
| UX-C2 | Verify first-viewport hierarchy and Share/Library/evidence navigation across viewports | COACH-02 | S |
| UX-C3 | Register a production analytics listener and forward generic CTA events, using IDs instead of motion or focus text | COACH-03, G0 | M |
| UX-C4 | Verify the synthetic-voice disclosure is visible before playback | TRUST-01 | S |

### UX-D. Visual and accessibility acceptance

| ID | Item | Epics | Effort |
|---|---|---|---|
| UX-D1 | Enforce a 13px minimum for meaningful text (practice labels, composer character status) | VIS-01 | S |
| UX-D2 | Produce a light/dark contrast matrix for semantic tokens | FND-01 | S |
| UX-D3 | Measure computed hit areas and disabled states across manual controls | FND-02 | M |
| UX-D4 | Capture light/dark baselines for key routes, including landing crop contrast | FND-01, VIS-02 | M |
| UX-D5 | Record one real VoiceOver or NVDA session covering setup, live debate and feedback | FND-04, FND-03 | M |
| UX-D6 | Confirm motion transitions never block input | VIS-03 | S |

### UX-E. Flag and legacy cleanup

| ID | Item | Effort |
|---|---|---|
| UX-E1 | `ui_navigation_v2`, `ui_setup_v2` and `ui_feedback_v2` are declared but no component reads them. Wire them up or delete them. | S |
| UX-E2 | Once `ui_live_v2` has been at 100% for two stable releases or 14 days with healthy guardrails, remove the legacy resizable transcript (overview deprecation rule). | S |

---

## 7. Track P — Product backlog from the May roadmap

| ID | Item | Effort | Note |
|---|---|---|---|
| P1 | Listen to each persona's `elevenLabsVoiceId` and adjust | S | Human-judgement task |
| P2 | Human-vs-human: finish verification (UX-B6), then decide whether a phase C is needed | M | Phases A, B, D merged |
| P3 | Persona-specific and weekly leaderboards | M | Low priority under the growth plan |
| P4 | Community sharing of custom personas | L | Deferred: growth plan defers persona marketplaces |
| P5 | Viseme lip-sync with rigged avatar assets | L | Deferred: growth plan defers more avatar work |
| P6 | Remove `ROADMAP.md` setup instructions that are now in the README, or link to them | S | Doc hygiene |

---

## 8. Growth phases G2–G5 (gated)

Scope is unchanged from the growth plan; only dates move. Each phase starts only
when the previous gate passes.

### G0 leftovers to finish alongside G1

- Calibrate the four headline debate dimensions on a 60–100 sample coach-scored
  set with two raters (separate from the 54-item drill set in G1-4).
- Make sure fallback or invalid scores (the old default of 5) are excluded from
  every trend.
- Forward analytics with IDs only (UX-C3).

### G2 — Demonstrate progress (about 5 weeks)

1. Competency trends, recurring weaknesses, completed cycles and a next activity replace the main progress emphasis.
2. Compare only like-for-like evaluations; show sample counts and insufficient-data states.
3. Three pathways: rebuttal foundations, evidence and warrants, cross-examination.
4. Goal-based onboarding and rule-based "choose my opponent."
5. Unseen-topic assessment after about five cycles, with no coaching hints.
6. Exportable progress report with score provenance.

**Gate:** one complete four-week cohort; proposed +10 points D7 return and 20%
relative drop in targeted-weakness recurrence (directional only).

### G3 — Coach and classroom pilot (about 12 weeks)

Organizations, roles, cohorts and invites under RLS; assignments; a coach
dashboard with instructor correction; bounded custom rubrics, curriculum packs
and exports; a 6–8 week learning-study protocol. **Gate:** cross-tenant
authorization tests and retention/deletion controls pass before enrollment;
expansion needs three weekly coaches, ≥60% assignment completion and two paid-pilot
partners.

### G4 — Deeper argument analysis (about 12 weeks, sequential)

Argument maps grounded in transcript spans (≥90% grounded), then source-grounded
evidence mode with curated packs and tenant-scoped retrieval (≥90% claim-to-passage
support), then consented voice delivery analytics kept separate from argument
scores.

### G5 — Scale validated demand (about 12 weeks)

Institutional controls, one LMS and one SSO integration, procurement
documentation; a bounded professional "difficult meeting" pilot with about five
partners. Do not claim compliance from a feature checklist.

---

## 9. Sequencing and re-baselined timeline

Dates assume the growth plan's two engineers plus part-time product and coach.
With one engineer, keep the order and stretch the dates.

| Window | Critical path | Parallel work |
|---|---|---|
| Dec 2026, weeks 1–2 | R1–R7; G1-1, G1-2; start G1-3 | UX-B0 fixture; UX-E1 |
| Dec 2026, weeks 3–4 | Finish G1-3 including provider resilience; start G1-4 ratings | UX-A1–A3 |
| Jan 2027 | G1-4 adjudication; G1-5; G1-6.1–6.4; enroll pilot (G1-6.5) | UX-B1–B7; G0 dimension calibration |
| Feb 2027 | Seven-day observation and readout (G1-6.6–6.7); G1 exit decision; G1-7 if paid learning is wanted | UX-C, UX-D; P1 |
| Mar–Apr 2027 | G2 | UX-E2 |
| May–Jul 2027 | G3 | |
| Aug–Oct 2027 | G4 | |
| Nov 2027 onward | G5 | |

If a gate fails, spend the next sprint fixing the learning cycle rather than
moving the calendar forward.

---

## 10. Explicitly deferred

Carried from the overview and growth plan; do not start without a new decision.

- Stripe payment evidence (until banking details are ready)
- Personalized AI curriculum generation; model confidence percentages
- Multi-accent or persona-specific themes; streaks, confetti, achievements
- Cross-device wizard draft synchronization; major social/sharing redesign
- New animation dependencies unless CSS proves insufficient
- More avatar work, more neural voices, persona marketplaces (P4, P5)
- Broad LMS coverage and simultaneous professional verticals

## 11. Document housekeeping (R7)

| File | Action |
|---|---|
| `PENDING_IMPLEMENTATION_AUDIT.md` | Archive; its "100% verified" claim is superseded |
| `ROADMAP.md` | Mark historical; link here for open work |
| `EPIC_IMPLEMENTATION_AUDIT.md` | Keep as the UX evidence record; link here for open work |
| `High-level implementation overview.md` | Keep as the UI specification |
| `docs/GROWTH_IMPLEMENTATION_PLAN.md` | Keep as the growth strategy; dates superseded by section 9 |
| `docs/PHASE_1_TODO.md` | Keep as the G1 evidence log; tick items there as they close |

## 12. Standing rules for every release

- Run lint, typecheck, unit tests and relevant Playwright checks; add coverage for
  attempt transitions, evaluation validity, quota accounting and ownership.
- Use additive migrations and apply them to staging before production.
- Ship new generation modes behind a server-side rollback switch.
- Keep transcripts, learner text, purchase tokens and credentials out of
  analytics, evidence files and reports.
- Do not equate code presence, mocked tests or synthetic sessions with learner
  outcomes or production readiness.
