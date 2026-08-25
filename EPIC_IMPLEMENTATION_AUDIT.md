# Phase 1-5 Epic Implementation Audit

**Audit date:** 2026-08-24  
**Source:** `High-level implementation overview.md`  
**Scope:** Current working tree, including uncommitted changes

## Executive summary

The 20 epics across Phases 1-5 are approximately **71% implemented** under a strict acceptance-criteria reading. Core UI implementation is further along than automated and manual verification.

| Phase | Estimate | Assessment |
|---|---:|---|
| Phase 1 | 66% | Foundations exist, but audits and screen-reader validation are incomplete. |
| Phase 2 | 92% | Navigation architecture is the strongest phase. |
| Phase 3 | 62% | Setup is strong; the live workspace remains substantially incomplete. |
| Phase 4 | 64% | Feedback contract is strong; coaching actions and transparency are partial. |
| Phase 5 | 83% | Landing and visual identity are strong; some system-level polish remains. |

## Epic assessment

Status definitions:

- **Complete:** The implementation clearly meets the epic's acceptance criteria.
- **Mostly:** The primary behavior is implemented, with limited acceptance or verification gaps.
- **Partial:** Material acceptance criteria or end-to-end behavior remain missing.

| Epic | Status | Evidence and gaps |
|---|---|---|
| FND-01 | Mostly | Accessible tokens exist in `src/app/globals.css`. Required light/dark route screenshots do not exist. |
| FND-02 | Mostly | Global focus and 44px primitives exist. Some manual controls, including Retry and Dismiss, remain below preferred target sizes. |
| FND-03 | Mostly | Topic and persona choices use native radios and fieldsets. Keyboard and semantic behavior lacks component and E2E coverage. |
| FND-04 | Partial | Reduced motion and live announcements exist, but there is no recorded NVDA or VoiceOver audit. |
| NAV-01 | Mostly | Bottom navigation, safe-area padding, icons, labels, and active states are implemented. No authenticated 320px E2E test exists. |
| NAV-02 | Complete | Shared model, active states, focus trap and restoration, Escape, and outside-click behavior are implemented in `src/components/layout/app-navigation.tsx`. |
| NAV-03 | Complete | Live routes remove global navigation and expose motion, transcript, audio, and back controls. |
| SET-01 | Mostly | Four steps, versioned session storage, restoration, and clearing are implemented in `src/components/setup/setup-wizard.tsx`. Persistence is not tested end to end. |
| SET-02 | Complete | Search, recommended motions, collapsible filters, custom validation, and empty-result recovery are implemented. |
| SET-03 | Mostly | Human-mode skipping, semantic selection, review, customization, and unmet-requirement messaging exist. Persona rhetorical style could be presented more clearly. |
| LIVE-01 | Partial | `svh` and `dvh` sizing and a labeled composer exist. Safe-area handling, viewport-change preservation, 200% zoom verification, and resilient drafts are missing. |
| LIVE-02 | Partial | The overlay traps and restores focus and supports Escape. It remains one centered resizable dialog rather than a mobile sheet and desktop supporting panel, and it has no rollout flag. |
| LIVE-03 | Partial | Realtime presence, polling fallback, and status announcements exist. Drafts clear before submission succeeds, realtime retry is absent, and duplicate prevention is unverified. |
| COACH-01 | Complete | Versioned schema, legacy adapter, turn-ID and excerpt validation, invalid-evidence removal, prompt parsing, and tests exist in `src/lib/debate/feedback.ts`. |
| COACH-02 | Mostly | Strength, priority, rationale, evidence, rubric, and practice action exist. Rematch is absent and legacy feedback uses the full adapted layout rather than a reduced fallback. |
| COACH-03 | Partial | Motion, difficulty, and goal are prefilled and reviewed before creation. Per-suggestion rationale and usage analytics are missing. |
| TRUST-01 | Partial | Setup and live labels, synthetic-voice naming, score limitations, and controls exist. Transcript and shared-view disclosure is missing, and Report is session-local rather than functional. |
| VIS-01 | Mostly | Two font stacks, 13px minimum utility text, tabular figures, and emoji removal are implemented. The system uses fallback fonts rather than `next/font`, and visual regression coverage is absent. |
| VIS-02 | Complete | Full-bleed stage visual, dominant CTA, secondary pricing, editorial sections, and coaching narrative are implemented in `src/app/page.tsx`. |
| VIS-03 | Mostly | Libraries use rows, unnecessary cards were removed, and shared motion and reduced-motion rules exist. True sheet motion depends on unfinished LIVE-02. |

## Phase findings

### Phase 1: Foundations and accessibility

The token, focus, semantic-selection, target-size, reduced-motion, and status-announcement foundations are present. Native radio inputs and fieldsets provide a solid semantic base for topic and persona selection.

Remaining acceptance gaps:

- Required light and dark screenshots for landing, setup, live, feedback, and library do not exist.
- Several manual text buttons do not consistently use the shared target-size primitives.
- Keyboard selection and form semantics are not covered by component or E2E tests.
- No NVDA or VoiceOver validation is documented.
- The TRUST-00 disclosure quick win is mostly implemented through persona, live, feedback, and synthetic-voice labels.

### Phase 2: Adaptive navigation and shell

Navigation is the most complete phase. Compact, desktop, profile, TWA, and immersive-debate variants share a centralized route model. Active states and profile-menu keyboard behavior are implemented.

Remaining acceptance gaps:

- There is no authenticated 320px browser test for the bottom navigation.
- Focus-trap, restoration, and visual-order behavior are implemented but not exercised through E2E tests.

### Phase 3: Core debate flows

The setup half of Phase 3 is substantially implemented. The wizard has four progressive steps, versioned persistence, motion search, recommended motions, collapsed filters, semantic persona selection, human-mode skipping, review, and optional settings.

The live-workspace half remains materially incomplete:

- The composer is positioned in a dynamic-height flex layout, but system safe-area behavior is not explicit.
- Draft text is cleared immediately after calling submit rather than after successful completion.
- Viewport-height changes and 200% zoom are not tested.
- The transcript remains a centered resizable overlay on all viewports.
- There is no compact bottom sheet or wide supporting panel.
- The legacy overlay is not controlled by a centralized feature flag.
- Realtime loss has polling fallback but no explicit user Retry action.
- Human and AI debate completion paths are not covered by E2E tests.

### Phase 4: Coaching and trustworthy AI

COACH-01 is strongly implemented. Feedback is versioned, old records adapt to the new schema, evidence is restricted to valid turn IDs and stored excerpts, invalid evidence is removed, and normalization has unit coverage.

Remaining acceptance gaps:

- There is no Rematch action in the coaching view.
- Legacy feedback is labeled but not rendered through a clearly reduced fallback.
- Targeted-practice suggestions do not explain each recommended field independently.
- Targeted-practice and feedback-usefulness analytics are absent.
- AI disclosure does not persist into the transcript overlay and shared debate view.
- Helpful, Not helpful, and Report controls update local session state only; they do not submit a durable signal or report.
- Synthetic-voice status is available through control labels and titles, but not always as persistent visible copy before playback.

### Phase 5: Visual identity and purposeful motion

The landing page, editorial structure, debate-stage image, typography hierarchy, brass accent, card reduction, list-row libraries, tabular scores, and CSS motion system are implemented. Reduced-motion rules force immediate visible states and remove spatial transitions.

Remaining acceptance gaps:

- Fonts use stable system stacks rather than a bundled `next/font` implementation.
- Light and dark visual-regression screenshots are absent.
- Image-crop contrast is supported by the overlay and tested indirectly at common viewports, but no visual-regression baseline exists.
- Sheet-specific motion cannot be completed until LIVE-02 provides an actual adaptive sheet and panel.

## Highest-priority remaining work

1. Finish LIVE-01, LIVE-02, and LIVE-03: adaptive transcript, safe-area composer, draft recovery, Retry, and duplicate protection.
2. Complete TRUST-01: persistent disclosures in transcripts and shared views plus a real privacy-safe report workflow.
3. Complete COACH-02 and COACH-03: Rematch, reduced legacy layout, suggestion rationale, and analytics.
4. Add signed-in AI and human completion E2E coverage.
5. Add keyboard selection, focus trapping, wizard persistence, viewport resizing, 200% zoom, accessibility scanning, and visual-regression tests.
6. Perform and document the required NVDA or VoiceOver audit.

## Test-coverage assessment

The current automated suite includes 94 unit tests and 24 Playwright executions across 1440x900, 768x1024, and 360x800 viewports. The browser suite primarily covers public routes, PWA behavior, authentication boundaries, the landing page, persona-form basics, overflow, and reduced motion.

The following required paths remain uncovered:

- Authenticated setup through debate creation
- Wizard back, forward, and reload persistence
- Keyboard selection of topics and personas
- Focus trap and restoration for profile and transcript dialogs
- AI debate completion through feedback
- Human invite, join, realtime turns, and verdict
- Connection loss during drafting and submission
- Legacy and version-two feedback rendering in the browser
- Automated accessibility scanning on core routes
- Light and dark visual-regression screenshots
- 200% browser zoom

## Cross-cutting observations

- No centralized `ui_navigation_v2`, `ui_setup_v2`, `ui_live_v2`, or `ui_feedback_v2` rollout module exists.
- The measurement events listed in the implementation overview are not implemented.
- `ROADMAP.md` contains older status information and should not be treated as the current Phase 1-5 acceptance record.
