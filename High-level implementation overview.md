# **1. High-level implementation overview** 

Plan for five incremental phases over roughly 10–12 weeks for 1–2 developers with occasional design support. Begin with shared tokens and accessibility primitives, then change navigation and the two core product flows, followed by evidence-based coaching, AI transparency, and final visual polish. 

The governing visual thesis is: **a calm digital debate chamber—editorial typography, deep ink surfaces, warm neutral light mode, and one indigo stage-light accent.** New and legacy UI may coexist behind feature flags, but domain logic should remain shared and legacy components should be removed within two stable releases of a successful rollout. 

# **2. Recommendation clustering** 

**Theme Impact Effort Key dependencies** Accessibility and High Medium Token system before contrast/focus rollout semantics Design-system High Medium Must precede broad screen refactors foundations Adaptive navigation High Medium Shared shell and target-size primitives Progressive debate setup High High Semantic choice components and persisted state Live debate workspace High High Adaptive shell, safe viewport, shared realtime logic Feedback and coaching High High New feedback contract and backward compatibility AI transparency and ethics High Medium Disclosure component and content policy Landing and visual Medium Medium Typography, colors, and motion storytelling foundations 

## **Dependency rules** 

- Color, typography, focus, and control-size tokens come first. 

- Semantic choices must exist before rebuilding the setup wizard. 

- Adaptive navigation should ship before the live screen abandons the global header. 

- The live-layout refactor must reuse useDebate ; do not fork realtime or state-machine logic. 

- Evidence-backed feedback requires API/type changes before the new feedback view. 

- Landing-page polish should not block improvements to setup, live debate, or feedback. 

# **3. Phased plan** 

Assumption: two-week sprints. A single developer should add approximately 25–35% to the schedule. 

## **Phase 1: Foundations and accessibility** 

**Timeline:** 1–2 weeks 

### **Goals** 

- Meet an agreed WCAG 2.2 AA baseline on core routes. 

- Establish reusable tokens and accessible primitives. 

- Make AI simulation status unambiguous immediately. 

### **Success criteria** 

- Core text passes 4.5:1 contrast; UI boundaries and focus indicators pass 3:1 where applicable. 

- Every interactive control has a visible keyboard focus state. 

- Compact-screen controls have 44px preferred targets. 

- Topic and persona selection is keyboard and screen-reader operable. 

- Reduced-motion behavior is active. 

- AI personas and generated scoring are visibly labeled. 

### **In scope** 

- [globals.css](C:/Users/Jolma/Documents/Vibe-Code/debate-master/src/app/globals.css) ● Tailwind configuration 

- Button, input, textarea, card/choice, dialog, status, and disclosure primitives 

- Setup selectors, forms, transcript dialog, and status announcements 

### **Out of scope** 

- Navigation architecture 

- Wizard restructuring 

- Live-stage composition 

- Landing-page redesign 

### **Risks and mitigation** 

- **Risk:** Token changes cause broad visual regressions. **Mitigation:** Capture light/dark screenshots of all routes before changing tokens. 

- **Risk:** Semantic refactoring changes click behavior. **Mitigation:** Add component tests for mouse, keyboard, and selected-state behavior. 

- **Risk:** Disclosure copy feels repetitive. 

   - **Mitigation:** Use a compact persistent badge plus fuller contextual explanation. 

## **Phase 2: Adaptive navigation and shell** 

**Timeline:** 1–2 weeks 

### **Goals** 

- Make primary navigation ergonomic on mobile and stable across window sizes. 

- Separate marketing navigation, authenticated product navigation, and immersive debate navigation. 

### **Success criteria** 

- No navigation overflow at 320px width. 

- Compact screens expose three to five primary destinations through a bottom bar. 

- Desktop uses a restrained top bar or rail with an active-location state. 

- Live debate uses a local immersive header. 

- Navigation respects safe-area insets and keyboard focus order. 

### **In scope** 

- Root layout and header 

- New mobile bottom navigation 

- Desktop product navigation 

- Debate-local top bar 

- Profile/overflow sheet 

### **Out of scope** 

- Page-body redesigns 

- New information architecture beyond existing destinations 

### **Risks and mitigation** 

- **Risk:** Auth and TWA-specific pricing rules regress. 

   - **Mitigation:** Preserve routing policy in a centralized navigation model and test web/TWA variants. 

- **Risk:** Users lose familiar links. **Mitigation:** Keep all existing destinations available through Profile/More. 

- **Risk:** Bottom navigation covers content. 

   - **Mitigation:** Add a shared navigation-inset token and automated compact-screen checks. 

## **Phase 3: Core debate flows** 

**Timeline:** 3–4 weeks 

### **Goals** 

- Reduce setup abandonment with a progressive four-step flow. 

- Make the live debate feel like the product’s central workspace. 

- Stabilize the composer, viewport, transcript, and connection states. 

### **Success criteria** 

- Setup becomes Format → Motion → Opponent → Review. 

- State survives backward navigation and accidental reloads. 

- The live composer remains reachable above the keyboard and safe area. 

- Draft text survives transient connectivity failures. 

- Transcript becomes a bottom sheet on mobile and supporting panel on wide screens. 

- Existing AI and human debate state-machine tests continue to pass. 

### **In scope** 

- /debate/new 

- Setup wizard and selection components 

- /debate/[debateId] 

- Live stage, transcript, stage indicator, composer, and realtime status 

### **Out of scope** 

- Feedback data-contract redesign 

- Landing page 

- Advanced personalized recommendations 

### **Risks and mitigation** 

- **Risk:** Realtime behavior breaks during layout work. **Mitigation:** Keep useDebate and state-machine logic unchanged; refactor presentation around them. 

- **Risk:** Persisted setup state becomes stale. 

   - **Mitigation:** Version storage and clear it after successful debate creation. 

- **Risk:** Two live layouts create duplicated logic. **Mitigation:** Put the feature flag at the presentation boundary and share all data/state hooks. 

## **Phase 4: Coaching and trustworthy AI** 

**Timeline:** 2–3 weeks 

### **Goals** 

- Replace generic score reporting with evidence-backed coaching. 

- Turn feedback into the beginning of the next practice session. 

- Clarify the limitations and provenance of generated output. 

### **Success criteria** 

- Feedback claims can reference specific transcript turns. 

- Users can understand why each rubric score was assigned. 

- “Practice this weakness” creates a relevant new setup. 

- Old feedback records still render. 

- Users can report unhelpful or inaccurate feedback. 

- Public-figure simulations and synthetic voices remain labeled throughout the journey. 

### **In scope** 

- Feedback types, prompt, API parsing, and rendering 

- Practice deep links/prefill 

- Feedback usefulness prompt 

- AI/synthetic-media disclosures 

### **Out of scope** 

- Fully automated curriculum generation 

- Model confidence percentages unless they are validated and meaningful 

- Social sharing redesign 

### **Risks and mitigation** 

- **Risk:** Generated evidence references nonexistent turns. **Mitigation:** Require turn IDs from an allowed list and validate server-side. 

- **Risk:** Larger feedback payload increases latency. **Mitigation:** Limit evidence excerpts and stream a clear generation state. 

- **Risk:** Old JSON feedback no longer matches new types. **Mitigation:** Add a versioned adapter supporting both schemas. 

## **Phase 5: Visual identity and purposeful motion** 

**Timeline:** 2 weeks 

### **Goals** 

- Remove the generic AI/SaaS appearance. 

- Apply the debate-chamber visual thesis consistently. 

- Make motion explain state without creating noise. 

### **Success criteria** 

- Landing page has one dominant debate-stage visual. 

- Feature-card grids are replaced with editorial sections. 

- Internal screens use cards only when the surface is itself interactive. 

- Typography and iconography are consistent. 

- Turn, panel, and feedback transitions remain usable with reduced motion. 

### **In scope** 

- Landing page 

- Typography and icon system 

- Library/persona visual cleanup 

- Motion polish 

### **Out of scope** 

- Decorative 3D scenes 

- Multiple accent palettes 

- Gamified celebrations 

- Large animation-framework adoption unless CSS proves insufficient 

# **4. Epics list** 

**Epic Phas Priority Description e** FND-01 Token and contrast 1 P1 Separate surface, content, action, and system semantic colors FND-02 Focus and target-size 1 P1 Global focus-visible and mobile standards hit-area rules 

|FND-03 Semantic selections and<br>forms|1|P1|Accessible choices, labels, help, and<br>errors|
|---|---|---|---|
|FND-04 Motion and live-status<br>accessibility|1|P1|Reduced motion and deliberate<br>announcements|
|NAV-01 Compact bottom<br>navigation|2|P1|Thumb-reachable authenticated<br>navigation|
|NAV-02 Desktop navigation and<br>profile menu|2|P2|Active states and uncluttered<br>secondary actions|
|NAV-03 Immersive debate shell|2|P1|Debate-local header without marketing<br>chrome|
|SET-01 Wizard state architecture|3|P1|Four-step flow with persistent state|
|SET-02 Motion discovery|3|P1|Search-led topic selection and custom<br>motion|
|SET-03 Opponent and review<br>steps|3|P1|Semantic persona selection and<br>progressive settings|
|LIVE-01 Safe viewport and sticky<br>composer|3|P1|Keyboard- and inset-safe live layout|
|LIVE-02 Adaptive transcript<br>workspace|3|P1|Sheet on mobile, supporting panel on<br>desktop|
|LIVE-03 Realtime state and draft<br>recovery|3|P1|Reliable, accessible connection and<br>turn behavior|
|COACH-01 Evidence-aware<br>feedback contract|4|P1|Versioned feedback schema with<br>transcript references|
|COACH-02 Coaching-first<br>feedback view|4|P1|Priority insight, evidence, rubric, and<br>next action|
|COACH-03 Targeted practice<br>flow|4|P2|Create a debate from a diagnosed<br>weakness|
|TRUST-01 AI transparency<br>system|4|P1|Persistent simulation, voice, and<br>scoring disclosures|
|VIS-01 Editorial typography and<br>iconography|5|P2|Distinctive but restrained visual identity|



|VIS-02 Landing-page storytelling|5<br>P2|Full-bleed stage-led marketing|
|---|---|---|
|||experience|
|VIS-03 Card reduction and|5<br>P2|Clearer hierarchy across internal|
|motion polish||routes|



# **5. Detailed user stories/tasks** 

Each item is formatted to work as a GitHub, Jira, or Linear issue. 

## **Phase 1** 

### **FND-01 — Implement accessible light/dark design tokens** 

### **Priority:** P1 

**Description:** Replace overloaded stage-accent and insufficient muted colors with separate content, action, border, surface, and semantic tokens. 

**Dependencies:** None. 

### **Acceptance criteria** 

- Normal text combinations used on core routes meet at least 4.5:1 contrast. 

- Focus, control boundaries, and meaningful graphics meet 3:1 where required. 

- Primary button background and text pass in both themes. 

- Warning text no longer uses light-mode yellow-500 . 

- Light and dark screenshots exist for landing, setup, live, feedback, and library. 

### **FND-02 — Add global focus-visible and control-size primitives** 

### **Priority:** P1 

**Description:** Standardize focus, pressed, disabled, loading, and target-size behavior for interactive components. 

**Dependencies:** FND-01. 

### **Acceptance criteria** 

- Buttons, links, inputs, tabs, chips, dialog controls, and icon actions show a 2px focus ring with offset. 

- Focus is never communicated by color alone. 

- Compact-screen primary controls have at least a 44×44px hit area. 

- No applicable control falls below 24×24px. 

- Disabled states remain legible and expose disabled or aria-disabled . 

### **FND-03 — Build semantic choice and field-group components** 

### **Priority:** P1 

**Description:** Replace clickable topic/persona <div> elements and unassociated setting labels. **Dependencies:** FND-01, FND-02. 

### **Acceptance criteria** 

- Topic and persona choices use native radio inputs or an accessible radio-group implementation. 

- Arrow keys move through radio options; Space selects. 

- Selected state is available visually and programmatically. 

- Side, difficulty, rounds, and cross-examination use fieldset / legend or equivalent semantics. 

- Voice preview remains a separate interactive target. 

- All form labels use id / htmlFor ; help and errors use aria-describedby . 

- Submission errors use an appropriate live region. 

### **FND-04 — Add reduced-motion and status-announcement standards** 

### **Priority:** P1 

**Description:** Make pulsing, bouncing, avatar movement, streamed states, and feedback transitions motion-safe. 

**Dependencies:** FND-01. 

### **Acceptance criteria** 

- prefers-reduced-motion: reduce removes repeating and large spatial motion. 

- “Your turn,” “AI thinking,” “response complete,” and connection errors are announced. 

- Streamed tokens are not announced individually. 

- No state is communicated only through animation. 

- Screen-reader output is tested with at least NVDA or VoiceOver. 

### **TRUST-00 — Add immediate AI disclosure copy** 

**Priority:** P1 quick win 

**Description:** Add compact disclosure before the full transparency system is built. **Dependencies:** None. 

### **Acceptance criteria** 

- Persona picker identifies opponents as AI simulations. 

- Live AI debates show a persistent “AI simulation” label. 

- Feedback is labeled “AI-generated coaching.” 

- Voice marketing uses “synthetic voice,” not language implying authenticity. 

- Public-figure persona screens state that the simulation is not affiliated with the represented person. 

## **Phase 2** 

### **NAV-01 — Build compact bottom navigation** 

### **Priority:** P1 

**Description:** Replace the overflowing authenticated mobile header with Practice, New Debate, Library, and Profile destinations. 

**Dependencies:** FND-01, FND-02. 

### **Acceptance criteria** 

- Navigation works at 320px without overflow. 

- Every destination has icon, visible label, and active state. 

- New Debate is visually primary without obscuring another destination. 

- Content receives bottom padding including env(safe-area-inset-bottom) . 

- Pricing remains omitted in the Android TWA. 

- Keyboard focus follows visual order. 

### **NAV-02 — Simplify desktop product navigation** 

### **Priority:** P2 

**Description:** Separate authenticated product navigation from marketing navigation. **Dependencies:** Shared route model from NAV-01. 

### **Acceptance criteria** 

- Active route is visually and programmatically indicated. 

- Theme, pricing, email, and sign-out move into a Profile/More menu where appropriate. 

- All existing destinations remain reachable. 

- Menu supports Escape, focus trapping, focus restoration, and outside-click dismissal. 

- Navigation model is shared between compact and desktop presentations. 

### **NAV-03 — Create the immersive debate header** 

### **Priority:** P1 

**Description:** Remove the global marketing header from live debate routes and expose local controls. 

**Dependencies:** NAV-01, NAV-02. 

### **Acceptance criteria** 

- Header includes back navigation, abbreviated motion, transcript, and audio controls. 

- Topic truncation exposes the full value accessibly. 

- Debate page no longer relies on a hard-coded global-header height. 

- Human and AI modes expose the same shell structure. 

- Existing transcript and audio actions remain functional. 

## **Phase 3: Setup** 

### **SET-01 — Introduce versioned wizard state** 

### **Priority:** P1 

**Description:** Refactor setup into Format, Motion, Opponent, and Review steps. **Dependencies:** FND-03. 

### **Acceptance criteria** 

- Current step and total steps are visible and announced. 

- Back and Continue preserve selections. 

- Reload restores an incomplete setup from versioned session storage. 

- Successful creation clears stored setup state. 

- Invalid or obsolete stored state fails safely to defaults. 

- Each step has one dominant decision and one primary action. 

### **SET-02 — Redesign motion discovery** 

### **Priority:** P1 

**Description:** Replace simultaneous pack/category chip stacks with search, recommended motions, and one filter sheet. 

**Dependencies:** SET-01, FND-03. 

### **Acceptance criteria** 

- Users can search by title and motion. 

- Recent or recommended motions appear before the full catalogue. 

- Filters are available without permanently occupying vertical space. 

- Custom motion has a persistent label, guidance, character status, and inline validation. 

- Selecting a motion enables Continue and announces the selection. 

- Empty search results offer a custom-motion action. 

### **SET-03 — Build opponent and review steps** 

### **Priority:** P1 

**Description:** Present persona style clearly and move secondary debate settings into a review step. 

**Dependencies:** SET-01, FND-03. 

### **Acceptance criteria** 

- Persona selection is semantic and keyboard-operable. 

- Each persona exposes name, style, AI label, and separate voice preview. 

- Human mode skips the persona step without losing other state. 

- Review summarizes format, motion, side, opponent, and estimated structure. 

- Optional settings live under a clear “Customize format” disclosure. 

- Final CTA explains unmet requirements rather than silently remaining disabled. 

## **Phase 3: Live debate** 

### **LIVE-01 — Implement a safe viewport and sticky composer** 

### **Priority:** P1 

**Description:** Replace 100vh - 73px with a dynamic, safe-area-aware debate workspace. **Dependencies:** NAV-03. 

### **Acceptance criteria** 

- Layout uses svh / dvh with an appropriate fallback. 

- Composer stays above mobile keyboards and system navigation. 

- Transcript scroll position and draft are not lost when viewport height changes. 

- Composer has a persistent label, character status, shortcut help, and clear Submit action. 

- At 200% zoom, users can reach every control without two-dimensional scrolling. 

### **LIVE-02 — Build adaptive transcript presentation** 

### **Priority:** P1 

**Description:** Use a bottom sheet on compact screens and a supporting panel on wide screens. **Dependencies:** NAV-03, LIVE-01. 

### **Acceptance criteria** 

- Compact transcript sheet has drag-independent open/close controls. 

- Desktop panel can open without covering the composer. 

- Dialog/sheet focus remains trapped and returns to the trigger on close. 

- Escape closes the transient presentation. 

- Transcript entries preserve speaker, stage, and sequence semantics. 

- The existing resizable overlay remains behind a flag until the replacement is stable. 

### **LIVE-03 — Improve connection, turn, and draft recovery** 

### **Priority:** P1 

**Description:** Make realtime state actionable without increasing visual noise. **Dependencies:** LIVE-01. 

### **Acceptance criteria** 

- Draft is retained during failed submission or temporary disconnection. 

- Connection loss offers Retry and preserves text. 

- Turn ownership is represented by text plus visual state. 

- Reconnection does not duplicate a submitted turn. 

- Human and AI debate happy paths are covered by end-to-end tests. 

- Status announcements follow FND-04 and avoid repeated chatter. 

## **Phase 4** 

### **COACH-01 — Add a versioned evidence-aware feedback contract** 

### **Priority:** P1 

**Description:** Extend feedback with rubric rationale, transcript references, and recommended practice focus. 

**Dependencies:** Stable debate-turn identifiers. 

### **Acceptance criteria** 

- New feedback includes version , rubric rationale, evidence references, and practice recommendation. 

- Evidence references only valid turn IDs. 

- Generated excerpts are validated against stored turn content. 

- Invalid evidence is removed rather than rendered as authoritative. 

- Version-one feedback continues to render through an adapter. 

- Parsing and prompt behavior have unit tests. 

### **COACH-02 — Build the coaching-first feedback view** 

### **Priority:** P1 

**Description:** Reorder feedback around one strength, one priority improvement, supporting evidence, and a next action. 

**Dependencies:** COACH-01, FND-01. 

### **Acceptance criteria** 

- The first viewport communicates result, strongest moment, and next improvement. 

- Every detailed coaching claim can open its supporting transcript excerpt. 

- Rubric scores contain text values and rationale; color is supplementary. 

- “Practice this weakness” is the primary post-feedback action. 

- Rematch, Share, and Library are available as secondary actions. 

- Legacy feedback receives a clear, reduced fallback layout. 

### **COACH-03 — Create targeted-practice setup** 

### **Priority:** P2 

**Description:** Generate a new setup from the chosen improvement without acting autonomously. **Dependencies:** COACH-01, SET-01. 

### **Acceptance criteria** 

- Practice action pre-fills a recommended motion, difficulty, and coaching goal. 

- Users review and override every suggested field before creation. 

- The UI explains why each suggestion was made. 

- No debate is created without explicit confirmation. 

- Usage is recorded without storing raw debate text in analytics. 

### **TRUST-01 — Complete AI transparency and feedback controls** 

### **Priority:** P1 

**Description:** Standardize disclosure, limitations, reporting, and feedback usefulness controls. **Dependencies:** TRUST-00, COACH-02. 

### **Acceptance criteria** 

- AI simulation disclosure persists in setup, live debate, transcript, and shared views. 

- Synthetic voice status is visible before playback. 

- Generated scores explain that they are coaching estimates, not objective judgments. 

- Users can mark feedback Helpful, Not helpful, or Report. 

- Report flow does not expose private debate content without explicit consent. 

## **Phase 5** 

### **VIS-01 — Apply editorial typography and unified iconography** 

### **Priority:** P2 

**Description:** Introduce one UI sans and one restrained editorial serif for debate motions/headlines. 

**Dependencies:** FND-01. 

### **Acceptance criteria** 

- Meaningful text is at least 13px; body copy defaults to 16/24. 

- Scores and counters use tabular figures. 

- Emoji feature icons are replaced with a consistent icon family or removed. 

- Font loading avoids layout shift and respects Next.js font optimization. 

- No route uses more than two font families. 

### **VIS-02 — Rebuild landing-page storytelling** 

### **Priority:** P2 

**Description:** Replace the centered SaaS hero and feature-card grid with a full-bleed stage-led narrative. 

**Dependencies:** VIS-01. 

### **Acceptance criteria** 

- First viewport clearly identifies Debate Master and contains one dominant CTA. 

- One strong stage visual performs narrative work. 

- Pricing is secondary to starting a debate. 

- Support sections demonstrate the live experience and evidence-based coaching. 

- Hero and persistent header fit common mobile and desktop initial viewports. 

- All image crops maintain text contrast at supported widths. 

### **VIS-03 — Reduce cards and add purposeful motion** 

### **Priority:** P2 

**Description:** Convert unnecessary bordered containers into sections, rows, dividers, and supporting panes. 

**Dependencies:** FND-04, stable core layouts. 

### **Acceptance criteria** 

- Cards remain only where the whole surface is interactive or comparative. 

- Library debates render as clean list rows. 

- Turn changes, sheet transitions, and feedback evidence use consistent motion presets. 

- Reduced-motion users receive equivalent non-spatial feedback. 

- Motion does not delay input or block navigation. 

# **6. Prioritization and sequencing** 

## **Required sequence** 

FND-01 Tokens 

- ↓ 

FND-02 Focus/targets ──┬── FND-03 Semantic choices └── FND-04 Motion/status 

- ↓ 

NAV-01/NAV-02 

- ↓ 

NAV-03 Immersive shell 

- ↓ 

SET-01 → SET-02/SET-03 

↓ 

LIVE-01 → LIVE-02/LIVE-03 

↓ 

COACH-01 → COACH-02 → COACH-03 

↓ 

VIS-01 → VIS-02/VIS-03 

## **Safe parallel work** 

- TRUST-00 disclosure copy can ship during token work. 

- COACH-01 schema and prompt design can begin while navigation is being built. 

- Landing-page art direction can begin after tokens are approved, but implementation should wait until core-flow work stabilizes. 

- Library list cleanup can run beside feedback work if it does not touch navigation components. 

## **Quick wins** 

Ship within the first week: 

- Correct dark muted, primary-button, and warning contrast. 

- Add global focus-visible styling. 

- Increase icon-control hit areas. 

- Add aria-pressed or radio semantics to current selectors. 

- Add AI simulation and AI-generated scoring disclosures. 

- Add persona deletion confirmation. 

- Add reduced-motion overrides. 

- Add role="alert" / role="status" to errors and meaningful state changes. 

## **Explicitly defer** 

- Personalized AI curriculum generation. 

- Model confidence percentages. 

- Multi-accent or persona-specific application themes. 

- Gamified streaks, confetti, and achievements. 

- Cross-device wizard draft synchronization. 

- Major social/sharing redesign. 

- A new animation dependency unless CSS transitions prove insufficient. 

These add complexity without first solving setup friction, live usability, or coaching value. 

## **Deprecation rules** 

- Legacy and new UI may coexist only behind a centralized feature flag. 

- Domain hooks, API clients, and state-machine code must not be duplicated. 

- Mark legacy components with an owner and removal issue when the replacement flag is introduced. 

- Remove legacy UI after two stable releases or 14 days at 100% rollout, provided guardrail metrics remain healthy. 

- Do not begin a third implementation of a screen while both legacy and flagged versions exist. 

# **7. First four sprints** 

## **Sprint 1 — Accessible and clearly AI-generated** 

**Goal:** Debate Master gains a reliable accessibility and trust baseline. 

### **Work** 

- FND-01 token and contrast system 

- FND-02 focus and targets 

- FND-03 semantic topic/persona selections 

- FND-04 reduced motion and live status 

- TRUST-00 disclosure quick win 

### **User-visible outcome** 

- Clearer light and dark themes 

- Better keyboard navigation 

- Larger mobile controls 

- Visible focus states 

- Explicit AI simulation and scoring labels 

## **Sprint 2 — Navigation works naturally on every screen** 

**Goal:** Compact navigation is thumb-reachable and the debate route becomes immersive. 

### **Work** 

- NAV-01 bottom navigation 

- NAV-02 shared navigation model and profile menu 

- NAV-03 local debate header 

- Initial safe-area utilities 

- TWA and auth-state regression coverage 

### **User-visible outcome** 

- No crowded mobile header 

- New Debate is always reachable 

- Clear active destination 

- Cleaner live debate chrome 

## **Sprint 3 — Setup becomes a guided decision flow** 

**Goal:** Users can start a debate with fewer simultaneous choices. 

### **Work** 

- SET-01 wizard architecture and persistence 

- SET-02 motion search/filter 

- SET-03 opponent and review steps 

- Setup analytics events 

- Legacy/new setup feature flag 

### **User-visible outcome** 

- Four focused setup steps 

- Sticky Continue/Start action 

- Search-first topic discovery 

- Clearer opponent and format review 

## **Sprint 4 — Live debate becomes a stable workspace** 

**Goal:** The stage, transcript, and composer work reliably across compact and wide screens. 

### **Work** 

- LIVE-01 dynamic viewport and sticky composer 

- LIVE-02 transcript sheet/panel 

- LIVE-03 draft and connection recovery 

- AI/human end-to-end tests 

- New live-layout rollout flag 

### **User-visible outcome** 

- Composer remains reachable above the keyboard 

- Transcript behaves appropriately by screen size 

- Drafts survive connection problems 

- Turn and connection states are clearer 

**Following milestone:** Sprint 5 should deliver COACH-01/02 and TRUST-01; Sprint 6 can complete targeted practice and visual storytelling. 

# **8. QA, accessibility, and release strategy** 

## **Required test matrix** 

Test these paths at 360×800, 768×1024, and 1440×900: 

- Guest landing → setup → sign-in boundary 

- Signed-in AI debate from setup through feedback 

- Human invite creation, join, realtime turns, verdict 

- Resume an in-progress debate 

- Connection loss during drafting and submission 

- Library, deletion, leaderboard opt-in, persona creation 

- Light, dark, and system appearance 

- Keyboard-only operation 

- 200% browser zoom 

- Reduced-motion preference 

## **Automated coverage** 

Extend the existing Playwright suite with: 

- No horizontal overflow at 320px. 

- Keyboard selection of topics and personas. 

- Focus trap and restoration for sheets/dialogs. 

- Wizard back/forward persistence. 

- Composer visibility after mobile viewport resizing. 

- AI and human debate completion paths. 

- Legacy and version-two feedback rendering. 

- Basic automated accessibility scanning on core routes. 

- Light/dark visual-regression screenshots. 

## **Manual accessibility checks** 

For each phase: 

- Navigate from browser chrome through the full route using Tab, Shift+Tab, Enter, Space, Escape, and arrow keys. 

- Confirm focus is never hidden behind sticky navigation or the composer. 

- Test screen-reader names, roles, states, and announcement frequency. 

- Verify 4.5:1 text and 3:1 UI/focus contrast. 

- Confirm 44px preferred compact targets. 

- Test text resize and 200% zoom. 

- Verify reduced motion eliminates repeating pulse, bounce, and large translation. 

- Confirm Pro/Con, success/error, and winner states are not color-only. 

## **Feature flags** 

Create one centralized feature module, for example: 

- ui_navigation_v2 

- ui_setup_v2 

- ui_live_v2 

- ui_feedback_v2 

Recommended rollout: 

1. Development and automated tests. 

2. Internal accounts only. 

3. 10% deterministic user-ID bucket. 

4. 50% after 48–72 healthy hours. 

5. 100% after guardrail review. 

6. Remove legacy code after two stable releases. 

Avoid scattering environment-variable checks through individual components. Resolve flags at the route or layout boundary and pass the selected presentation downward. 

## **Regression monitoring** 

Use existing observability/Sentry infrastructure for: 

- Debate creation failures 

- Turn submission failures 

- Realtime disconnect frequency 

- Feedback-generation failures 

- React/render errors by UI version 

- Abnormally long setup or feedback requests 

Add a lightweight feedback prompt after completed debates and after users try the new coaching view. Do not send raw debate text to product analytics. 

Rollback if a new experience causes: 

- More than a 5% relative increase in route errors 

- More than a 10% relative reduction in debate creation or completion 

- Significant increases in abandoned drafts 

- Critical keyboard or screen-reader blockers 

# **9. Measurement and iteration plan** 

## **Core funnel** 

Track: 

- setup_started 

- setup_step_completed 

- setup_abandoned 

- debate_created 

- first_turn_submitted 

- debate_completed 

- feedback_viewed 

- practice_weakness_clicked 

- practice_debate_created 

- feedback_helpfulness_submitted 

Attach only necessary context: 

- UI version 

- Compact/medium/expanded window class 

- AI or human mode 

- Difficulty 

- Setup step 

- Debate stage 

- Error category 

Do not attach raw arguments, transcript excerpts, emails, or custom persona prompts. 

## **Primary metrics** 

### **Metric** 

### **Why it matters** 

Setup-to-debate creation rate Measures whether the wizard reduces friction Median setup duration Detects excessive decision time First-turn submission rate Separates setup success from actual engagement Debate completion rate Main engagement and flow-health measure 

Realtime recovery success Measures human-mode reliability Feedback view rate Shows whether coaching is discoverable “Practice this weakness” click rate Measures coaching actionability Practice debate completion rate Stronger learning signal than a button click Feedback helpfulness Direct measure of perceived coaching quality Mobile/desktop funnel gap Reveals adaptive-layout problems 

## **Review cadence** 

- **After Sprint 1:** focused accessibility review of setup, live debate, and feedback. 

- **After Sprint 3:** five-user task test covering topic selection and debate creation. 

- **After Sprint 4:** compact-screen and realtime usability review. 

- **Two weeks after coaching reaches 100%:** targeted interviews about evidence quality and practice recommendations. 

- **After Phase 5:** repeat the complete GUI/UX audit against the original findings. 

## **Second-wave decisions** 

Use the signals to decide: 

- High setup abandonment at Motion → improve search, recommendations, or custom-motion guidance. 

- High creation but low first-turn rate → clarify stage instructions and composer state. 

- Low completion on mobile → investigate viewport, keyboard, and turn-length friction. 

- High feedback viewing but low practice usage → improve the specificity and placement of the practice CTA. 

- Low feedback helpfulness → prioritize prompt/evidence quality before adding more visual polish. 

- Strong targeted-practice completion → consider a lightweight, user-controlled coaching curriculum in a later wave. 

