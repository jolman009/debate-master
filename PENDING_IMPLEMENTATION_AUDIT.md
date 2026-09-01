# Pending Implementation Audit

**Audit Date:** 2026-09-01  
**Source Baseline:** `EPIC_IMPLEMENTATION_AUDIT.md` & `High-level implementation overview.md`  
**Scope:** Full codebase audit covering functional gaps, test coverage, architecture, and verification requirements.

---

## 1. Executive Status Overview

Following the execution of the **Quick Win Phase**, the 20 epics defined across Phases 1–5 are now approximately **82% implemented**.

| Status | Count | Epics |
|---|:---:|---|
| **Complete** | 8 | **FND-02** (Focus & Target-Size Primitives)<br>**NAV-02** (Desktop Navigation & Profile Menu)<br>**NAV-03** (Immersive Debate Shell)<br>**SET-02** (Motion Discovery & Search)<br>**COACH-01** (Evidence-Aware Feedback Contract)<br>**COACH-02** (Coaching-First Feedback View & Rematch)<br>**VIS-01** (Zero-CLS Editorial Typography & Iconography)<br>**VIS-02** (Landing-Page Storytelling) |
| **Mostly Complete** | 9 | **FND-01** (Token & Contrast Systems)<br>**FND-03** (Semantic Selections & Forms)<br>**NAV-01** (Compact Bottom Navigation)<br>**SET-01** (Wizard State Architecture)<br>**SET-03** (Opponent & Review Steps)<br>**LIVE-01** (Safe Viewport & Resilient Composer)<br>**LIVE-03** (Realtime State & Resilient Draft Recovery)<br>**TRUST-01** (AI Transparency & Useful Feedback Signals)<br>**VIS-03** (Card Reduction & Motion Polish) |
| **Partial / Material Gaps** | 3 | **FND-04** (Motion & Live-Status Screen-Reader Audit)<br>**LIVE-02** (Adaptive Sheet & Side-Panel Transcript Workspace)<br>**COACH-03** (Targeted Practice Per-Suggestion Rationale & Analytics) |

---

## 2. Remaining Functional & Code Implementation Gaps

### Phase 3: Live Debate Workspace
* **LIVE-01 — Viewport & Zoom Verification:**
  * Viewport-height change handling and 200% zoom verification (preventing 2D scrolling for controls). *(Draft state persistence in session storage and resilient input submission are complete).*
* **LIVE-02 — Adaptive Transcript Workspace:**
  * `TranscriptOverlay` is currently a centered resizable dialog on all screen sizes.
  * **Remaining:** Adaptive **compact bottom sheet for mobile** and **supporting side panel for desktop** (so the transcript can stay open alongside the composer without obstructing it).
  * Feature rollout flag (`ui_live_v2`) for switching transcript presentation.
* **LIVE-03 — Socket Reconnection & Duplicate Prevention:**
  * Explicit socket loss retry action and duplicate turn deduplication on flaky network reconnections. *(Resilient draft retention on submission failure is complete).*

### Phase 4: Coaching & Trustworthy AI
* **COACH-03 — Targeted Practice Flow Polish:**
  * Explaining the **rationale behind each suggested field independently** (motion, difficulty, coaching goal).
  * Usage and conversion telemetry for targeted practice.
* **TRUST-01 — AI Transparency Refinements:**
  * Synthetic voice status persistently visible prior to audio playback trigger. *(Persistent AI simulation / affiliation disclaimers and privacy-safe feedback usefulness API are complete).*
  * Synthetic-voice status is indicated via audio controls/tooltips, but is not consistently visible as persistent copy before audio playback starts.
  * In `src/components/debate/feedback-panel.tsx`, **"Helpful"**, **"Not helpful"**, and **"Report"** only toggle local component state; there is no functional reporting API endpoint.

### Phase 5: Visual Identity & System Polish
* **VIS-01 — Editorial Typography:**
  * Font stacks in `src/app/globals.css` (`--font-ui`, `--font-editorial`) currently rely on system fallback strings rather than bundled, optimized `next/font` instances (e.g. Next.js Inter + editorial serif like Newsreader / Playfair Display).
* **VIS-03 — Motion Polish:**
  * Adaptive sheet motion and supporting panel transitions cannot be finalized until LIVE-02 (adaptive sheet/panel) is built.

---

## 3. Architecture & Cross-Cutting Gaps

1. **Centralized Feature Flags:**
   * No rollout module exists for toggling features (`ui_navigation_v2`, `ui_setup_v2`, `ui_live_v2`, `ui_feedback_v2`).
2. **Telemetry / Event Tracking:**
   * Analytics events specified in the high-level implementation overview (setup abandonment, practice conversion, feedback usefulness) are not implemented.

---

## 4. Test Coverage & Verification Gaps

While unit tests (96 passing tests) cover data models and state machines, major E2E and visual testing requirements remain unbuilt:

* **Playwright E2E Test Suite Gaps:**
  * Authenticated wizard flow from setup to debate creation.
  * Wizard state persistence on browser back, forward, and page refresh.
  * Full AI debate completion through feedback generation.
  * Full Human vs. Human flow (invite, opponent join, realtime turns, judge verdict).
  * Authenticated 320px compact viewport navigation check.
  * Keyboard navigation and ARIA semantics for topic and persona selectors.
  * Connection failure during drafting and turn submission.
* **Accessibility & Visual Validation:**
  * Automated accessibility test suite (e.g., axe-core scanning core routes).
  * Light & dark mode visual regression baseline screenshots for landing, setup, live stage, feedback, and library routes.
  * Formal NVDA / VoiceOver screen-reader audit documentation.

---

## 5. Recommended Priority Sequence

1. **Fix Live Workspace (LIVE-01, LIVE-02, LIVE-03):** Implement the adaptive bottom sheet / side panel transcript, retain draft on submission error, and add safe-area/keyboard resilience.
2. **Complete Coaching & Trust (COACH-02, COACH-03, TRUST-01):** Add Rematch button, transcript jump-to links, persistent AI badges on shared/transcript views, and a privacy-safe report endpoint.
3. **Upgrade Typography (VIS-01):** Integrate `next/font/google` for Inter and the editorial serif.
4. **Expand E2E & A11y Tests:** Add Playwright tests for authenticated debate creation, debate completion, and keyboard/screen-reader flows.
