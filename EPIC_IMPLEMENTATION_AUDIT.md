# Phase 1–5 Epic Implementation Audit

**Updated:** October 2, 2026

**Source:** [High-level implementation overview](High-level%20implementation%20overview.md)

**Scope:** Source inspection and recorded verification evidence; no new live deployment or accessibility audit was run for this update.

## Summary

The August 24 audit is superseded by this review. Its approximately 71% completion estimate is retired: it had no reproducible weighting, and its narrative contradicted several status rows. Track the acceptance gaps below instead of treating implementation percentages as release readiness.

The original 20 UI epics are substantially implemented in code. Remaining work centers on acceptance verification, a genuinely supporting desktop transcript panel, consistent typography/control sizing, durable feedback reporting, and pilot validation.

**Two different phase systems exist.** This file's Phase 1 means *foundations and accessibility*. The newer [growth implementation plan](docs/GROWTH_IMPLEMENTATION_PLAN.md) calls the learning cycle *Phase 1*. Its drill runtime extends COACH-03 but does not close unrelated UI/accessibility epics.

| Original UI phase | Current assessment |
|---|---|
| 1 — Foundations/accessibility | Tokens, focus primitives, native choices and announcements exist. Contrast evidence, complete target-size coverage and screen-reader validation remain open. |
| 2 — Navigation | Shared routing, mobile navigation and immersive layouts exist. Authenticated 320px and focus behavior need browser verification. |
| 3 — Debate flows | Wizard persistence, draft retention, retry controls and adaptive transcript presentation exist. Desktop composer access and authenticated recovery/human-debate tests remain open. |
| 4 — Coaching/trust | Evidence-aware feedback is implemented and has recorded production evidence. Practice has advanced to a linked drill runtime. Legacy presentation, durable reporting and drill release gates remain open. |
| 5 — Visual identity | Optimized fonts, landing narrative, row layouts and motion presets exist. Small text and visual/contrast baselines need follow-up. |

## Status definitions

- **Implemented:** Code meets the scoped functional contract and relevant verification is recorded. This does not imply every deployment or educational claim is validated.
- **Mostly:** Core behavior exists, with remaining acceptance or verification gaps.
- **Partial:** A material acceptance requirement is missing or the current behavior does not fully satisfy it.

## Epic assessment

| Epic | Status | Current evidence and remaining gap |
|---|---|---|
| FND-01 — Tokens/contrast | Mostly | `src/app/globals.css` defines light/dark semantic colors. No complete retained contrast matrix and required light/dark route baselines were found in the reviewed evidence. Token presence is not a contrast pass. |
| FND-02 — Focus/targets | Mostly | Global focus-visible rules and shared button/input primitives exist. The old Complete rating overstated route-wide compliance: manual controls still need computed hit-area and disabled-state checks. |
| FND-03 — Semantic choices | Mostly | Native radio/fieldset selection exists in setup. Authenticated keyboard selection, helper/error associations and screen-reader operation remain to be verified. |
| FND-04 — Motion/announcements | Partial | Reduced-motion CSS and state-level announcements exist. Required NVDA or VoiceOver validation is not documented. |
| NAV-01 — Compact navigation | Mostly | Shared navigation model, bottom navigation and safe-area inset exist. The 320px test exercises the public home page, not authenticated bottom navigation. |
| NAV-02 — Desktop/profile | Mostly | `app-navigation.tsx` implements menu focus management, Escape and restoration. Browser verification of focus order/trapping remains open; the old Complete rating conflated code with verified acceptance. |
| NAV-03 — Immersive shell | Mostly | Debate routes use local controls and omit marketing chrome. Verify authenticated route transitions and keyboard/screen-reader access end to end. |
| SET-01 — Wizard persistence | Mostly | Four-step wizard and versioned session-storage restoration exist. `e2e/setup-wizard.spec.ts` tests unauthenticated redirects; it does not exercise signed-in back/forward/reload restoration. |
| SET-02 — Motion discovery | Mostly | Search, filters, recommendations, custom motion handling and empty states exist. Authenticated discovery-to-creation acceptance remains unverified in the reviewed browser suite. |
| SET-03 — Opponent/review | Mostly | Semantic choices, human-mode skipping, review and optional settings exist. Complete browser verification and clarify rhetorical-style presentation. |
| LIVE-01 — Viewport/composer | Mostly | Dynamic-height layout, labeled input, character status and draft persistence exist. Mobile keyboard/safe-area behavior, resize preservation and 200% zoom still need verification. |
| LIVE-02 — Transcript | Partial | Mobile sheet and desktop side-panel styling now exist behind `ui_live_v2`, with legacy resizable fallback. The desktop presentation still uses a modal overlay, backdrop and body scroll lock; non-covering composer access is not established. Focus/Escape acceptance needs browser tests. |
| LIVE-03 — Realtime/recovery | Mostly | `user-input.tsx` awaits submission before clearing and retains text on rejection. Reconnect/Retry controls and polling fallback exist. A real AI journey is recorded; human invite/join/verdict and reconnect-without-duplicate-turn browser scenarios remain open. Drill retry evidence does not prove debate-turn deduplication. |
| COACH-01 — Feedback contract | Implemented | Versioned feedback, legacy adapter, exact turn/excerpt validation and parser tests exist. Phase 0 production evidence verifies the AI coaching journey and displayed references. Human scoring calibration remains a separate gate. |
| COACH-02 — Coaching view | Mostly | Strength, priority, rationale, evidence, scores, practice and Rematch are implemented. Legacy results use an adapter/badge rather than a clearly reduced layout. Verify first-viewport hierarchy and the original Share/Library/evidence-navigation criteria across viewports. |
| COACH-03 — Targeted practice | Mostly | Existing setup supports suggested motion/difficulty/goal and explanatory copy. New linked drill/revision/reassessment flow is implemented and pushed to staging. Durable learning events exist. October 3 adds unavailable-recommendation storage, usefulness review and a seven-day cohort report (migration 020 verified in staging); application commit `8a41d68` is deployed to Preview `pbqftftkz`. Generic CTA analytics forwarding remains incomplete. New fixed-template drills are a distinct experience from the original editable debate-setup acceptance criteria. |
| TRUST-01 — AI transparency | Mostly | Simulation/affiliation disclosures exist in live, transcript and shared views; scores are labeled estimates. Helpful/Not helpful/Report submit to an API, but that endpoint logs the signal rather than storing an owned review record. Verify persistent visible synthetic-voice disclosure before playback and operational report handling. |
| VIS-01 — Typography/icons | Mostly | `src/app/layout.tsx` uses optimized Inter and Newsreader; tabular scores exist. Meaningful 10–12px utility text remains, including practice labels and composer character status. The original 13px minimum and zero-layout-shift claim are not fully established. |
| VIS-02 — Landing narrative | Mostly | Stage-led hero, primary CTA, secondary pricing and editorial/coaching sections exist. Public browser evidence supports basic structure/overflow; crop contrast and light/dark visual baselines remain open. |
| VIS-03 — Rows/motion | Mostly | Library rows, section-based layouts and sheet/panel/reduced-motion presets exist. Review remaining noninteractive cards and verify transitions do not block input. Desktop transcript behavior still limits full acceptance. |

## Corrections to the prior audit

- Drafts are **not** cleared immediately on calling submit: `user-input.tsx` awaits the callback and preserves content when it rejects. The end-to-end propagation of each failure mode still needs testing.
- Transcript presentation is **not** limited to the original centered dialog. Adaptive sheet/side-panel styling and a legacy flag exist; the remaining concern is the desktop modal behavior.
- Connection recovery has explicit Retry/reconnect controls in `debate-stage.tsx` and `use-realtime-debate.ts`.
- Rematch, independent suggestion explanations, transcript/shared-view disclosures and Next.js font optimization are present.
- Usefulness controls make a real HTTP request. `src/app/api/feedback/usefulness/route.ts` validates the rating and writes a content-free console log; this is not a database-backed moderation or review workflow.
- `src/lib/flags.ts` declares all four original UI rollout flags. The reviewed component usages consume `ui_live_v2`; declarations alone do not prove navigation/setup/feedback rollback coverage. Separate measurement and learning server flags control their respective APIs.
- Analytics are **not absent**. `src/lib/analytics.ts` exposes event hooks, but no production listener registration was found outside tests. Separately, migrations 015 and 018 persist authoritative debate and learning lifecycle events.

## Learning-cycle extension: current status

| Checkpoint | Status/evidence |
|---|---|
| Migration 017 linked sessions | Applied to staging, user-confirmed. SQL suite user-confirmed passed. [Concurrent retry evidence](docs/evidence/phase-1-staging-concurrency.json) inspected: 36 assertions and three cleanup checks passed. |
| Migration 018 runtime | Applied to staging, user-confirmed. [Runtime concurrency report](docs/evidence/phase-1-staging-drill-runtime.json) inspected: 26 assertions and four cleanup checks passed, including free-slot reservation and duplicate evaluation/commit protection. |
| Hosted runtime SQL suite | Passed in full without SQL errors on staging, user-confirmed October 2, 2026. The blank `expect_error` helper result is expected. Raw SQL output was not independently inspected. |
| Shared drill UI/API | Implemented in `src/lib/learning`, `src/components/learning`, `/api/learning/[...path]` and `/practice/[cycleId]`. Includes saved drafts, targeted coaching, revision, reassessment, ownership, server reservation and events. |
| Three revised templates | Counterargument, warrant and claim repair are v2; prompt is `targeted-coach-2`. Revisions allow concessions, unsupported-inference explanations and evidence-based repair; difficulty guidance and reassessment scenarios are family-specific. |
| Source pairing | Counterargument requires exact excerpts cited in the same rebuttal coaching; it no longer selects an uncited preceding AI turn. This remains coaching-supported pairing, not independently validated semantic relevance. |
| Commit/push | `3f96ca9` introduced the runtime; `6f5d542` revised templates and recorded staging evidence. Both were pushed to `origin/staging`. Vercel Preview deployment of `6f5d542` was user-confirmed October 2, 2026; Latest streaming fix `a75c2f4` was pushed to staging; Vercel Preview `g5gv7pnti` was independently confirmed Ready. A fresh single-browser debate completed without retries, with nine transcript entries and coaching persisting after reload; see `docs/evidence/phase-1-preview-ai-retest.json`. Cross-client idempotency remains unverified. |
| Curriculum/rollout | Revised templates await explicit approval and calibration. Preview variables `LEARNING_ROLLOUT=off` and `LEARNING_PAID_ENABLED=false` were created and staging Preview redeployed, user-confirmed October 2, 2026. Live flag behavior and template approval configuration remain to be verified. No pilot environment change or production rollout is claimed. Saved v1 snapshots remain readable; the prompt-version guard pauses their evaluation rather than silently reinterpreting them. |
| Remaining validation | Real-service authenticated journeys for all families, deployed-model checks, coach ratings, the 20–30 learner pilot, and cohort/reporting work remain open. Stripe reconciliation stays deferred; Google Play reconciliation remains a paid-release dependency. |

See [drill rollout guide](docs/PHASE_1_DRILL_ROLLOUT.md) and [Phase 0 readiness](docs/PHASE_0_READINESS.md). Approval of rubric/feedback contracts does not substitute for coach calibration or demonstrate educational effectiveness.

## Verification record and limits

These are recorded results, not new executions performed for this documentation update:

| Evidence | Recorded result | Limit |
|---|---|---|
| [Phase 0 production AI journey](docs/evidence/phase-0-ai-journey-production-current.json) | 16 checks passed, including streamed turns, coaching persistence, transcript references and lifecycle deduplication. | Synthetic authenticated production session; not human-debate E2E, a broad reliability baseline or calibration. |
| [Initial drill local verification](docs/evidence/phase-1-drill-local.json) | 222 unit/API tests; build/typecheck/lint; isolated SQL suites; six desktop/mobile browser checks passed. | Original drill implementation; browser learning APIs were mocked. Isolated SQL used prerequisite schema and simulated Supabase roles. |
| October 2 v2 revision checks | 34 targeted learning/API tests, TypeScript and lint passed. Fresh `npm run build` also passed with lint/type checks and all 31 static pages generated. | Build used the local working tree, including pending Sentry changes; no deployment was performed. Fresh v2 browser checks passed: all six family/desktop/compact tests. Learning APIs were mocked; no real-model result is recorded. |
| Public accessibility/setup test source | Landmark, public 320px overflow, reduced-motion/smoke and login-redirect checks exist. | Names overstate some assertions: the focus test checks only that an active-element tag exists; the leaderboard test checks its heading; the setup-prefill test checks redirect handling, not visible prefilled fields. No full accessibility scan or authenticated wizard persistence proof. |

The old 94-unit/24-browser test totals are obsolete. Avoid adding targeted counts to historical totals or claiming all existing test files were rerun. Sentry hydration changes and TWA manifest edits remain separate pending work; their presence is not evidence that those deployment gates passed.

## Next implementation priorities

1. **Close the drill staging gate:** verify deployed defaults and Preview behavior; review/approve v2 curriculum; verify real AI journeys and server pilot/off behavior. Preserve existing recorded concurrency passes.
2. **Finish desktop transcript acceptance:** provide a truly supporting panel that leaves the composer usable, then test mobile sheet and desktop focus/Escape behavior.
3. **Verify authenticated debate recovery:** setup persistence and keyboard operation, viewport/keyboard/200% zoom, transient submit failure, human invite/join/verdict and reconnect deduplication.
4. **Close coaching/reporting gaps:** reduced legacy presentation, confirmed secondary actions, owned durable usefulness/report handling, analytics forwarding and unavailable-recommendation reporting. Keep private transcript text out of telemetry.
5. **Complete visual/accessibility acceptance:** enforce the 13px meaningful-text minimum, measure target sizes/contrast, capture required light/dark route baselines, and record an actual VoiceOver or NVDA session.
6. **Validate learner outcomes:** finish independent scoring/adjudication and the seven-day learner cohort before making improvement or completion-rate claims.

This audit updates status only. It does not change code, enable flags, apply migrations, deploy, or claim that pending acceptance tests passed.

## October 3 Growth Phase 1 engineering follow-up

Migrations 019 and 020 applied to staging and their rollback SQL suites returned
`passed=true`. Atomic AI turn persistence/leases, complete-stream validation, stage
prompt boundaries, durable recommendation/usefulness tracking and cohort reporting
are deployed to staging Preview `pbqftftkz` as `8a41d68`. The suite passes 249 tests; production build/type/lint
checks pass. See [verification record](docs/evidence/phase-1-engineering-2026-10-03.json)
and [pilot operations](docs/phase-1/PILOT_OPERATIONS.md). October 4 authenticated retest completed: nine transcript entries and unchanged
coaching persisted after reload (overall 6; dimensions 4, 6, 7, 5). Two-client
opening contention was rejected with one saved AI opening; cross-examination
stayed within its stage. A synthetic usefulness save was acknowledged, but row
readback is pending staging dashboard access. Stale-client retry exposed an
outdated-stage issue; a local expected-stage guard passes 12 targeted tests and
typecheck but awaits deployment/retest. Controlled provider interruption/logs,
simultaneous HTTP verifier, hosted learning off-mode checks, real learning journeys,
coach calibration and learner pilot outcomes remain open.
