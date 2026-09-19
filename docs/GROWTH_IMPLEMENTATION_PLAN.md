# Debate Master phased growth implementation plan

Prepared September 19, 2026. Planning window: October 2026–September 2027.

## Product outcome

Make Debate Master the place where learners discover a weakness in their argument, practice correcting it, and see whether the correction transfers to a new challenge. The differentiating experience is:

**Debate → transcript-linked coaching → one weakness → short drill → reassessment → persistent skill profile.**

Start with students and competitive debaters, expand through coaches and classrooms, then test professional preparation. The durable advantage is a useful history of competencies, recurring weaknesses, and effective exercises, supported by credible measurement.

This plan translates the supplied *Debate Master: User Value, Product Strategy, and Growth Roadmap* into delivery work. Recommendations in that document are source material, not authorization to execute them. This deliverable changes documentation only. Its competitor descriptions are taken from the supplied analysis, not independently verified current market claims; pricing and educational-outcome claims should be validated before external use.

## Planning assumptions

- Target capacity: two full-time engineers, a half-time product designer/product lead, and a part-time debate coach/evaluation specialist. Institutional work additionally needs security/privacy expertise and pilot support. These are proposed roles, not known staffing commitments.
- Dates are planning estimates, conditional on phase gates. Reserve approximately 20% of engineering capacity for reliability, evaluation, and pilot feedback. With one engineer, preserve the sequence and re-estimate dates rather than compress quality work.
- Keep the existing Next.js, TypeScript, Supabase, Gemini, billing, and speech foundations. Introduce specialized infrastructure only when ingestion, audio processing, or evaluation jobs need it.
- Production configuration, deployed migrations, real usage, costs, and test health were not verified for this planning exercise. Code presence does not establish production readiness.

## Starting point: extend what exists

| Capability | Evidence in the current repository | Implementation implication |
|---|---|---|
| Structured debates, opponent personas, streaming | Debate state machine, prompt builder, turn service, setup and stage components | Retain as the practice engine; add explicit session types and learning objectives. |
| Four-dimension coaching and transcript references | `src/lib/debate/feedback.ts`, `types.ts`, and feedback API | Version the scoring contract and add calibration; do not rebuild the feedback system. Exact transcript-excerpt validation already exists. |
| Targeted practice recommendation | `src/components/debate/feedback-panel.tsx` links to `/debate/new` with motion, difficulty, and goal | Currently starts a preconfigured debate through setup. Build an actual short drill with persisted origin, target competency, completion, and reassessment. |
| Progress overview | `src/components/debate/progress-summary.tsx` | Existing averages, best score, and first-to-latest delta are a starting point, not a comparable longitudinal skill model. |
| Analytics helpers | `src/lib/analytics.ts` | In-process listeners and development logging exist; no production forwarding registration was found in the reviewed source. Add durable event collection. Existing payloads include motion/focus text: replace these with IDs before forwarding to analytics. |
| Sharing, human debates, custom personas, topics, billing | API routes and migrations through `014_user_feedback.sql` | Reuse these foundations. Existing roadmap checkboxes are stale in places; use source inspection and deployment checks when estimating. |
| Coaching feedback and reporting | Feedback usefulness API and UI | Feed disagreement reports into human review and scoring-quality evaluation. |

## Phase sequence

| Phase | Timing | User-visible result | Differentiating value |
|---|---|---|---|
| 0. Measurement foundation | October, weeks 1–2 | Trustworthy coaching and a measurable funnel | Makes later improvement claims interpretable. |
| 1. Complete the learning cycle | October–November, weeks 3–8 | Finish a debate, fix one weakness in 3–5 minutes, retest it | Converts feedback into deliberate practice within the same visit. |
| 2. Demonstrate progress | December, weeks 9–13 | Skill history, personal practice pathway, unseen-topic checks | Establishes persistent, evidence-backed personalization. |
| 3. Coach and classroom pilot | January–March 2027 | Assign practice, see who needs help, assign remediation | Scales debate-specific coaching across a group. |
| 4. Deepen argument analysis | April–June 2027 | Inspect argument structure, test sources, improve delivery | Connects structural reasoning, evidence, and speaking to the same learning cycle. |
| 5. Scale validated demand | July–September 2027 | Institutional controls and a focused professional pilot | Supports adoption without splitting the core learning engine. |

### Phase 0 — Establish the measurement foundation

**Work packages**

1. Define observable anchors for the existing four dimensions: argument construction, evidence/reasoning, rebuttal/responsiveness, and clarity/persuasion. Tag subskills such as causal reasoning and answering the strongest warrant without immediately adding more headline scores.
2. Store rubric version, evaluator model/prompt version, session format, difficulty, and assessment status with each evaluation. Mark old results as legacy; do not infer precision or comparability they never had.
3. Distinguish valid scores from missing, invalid, or fallback evaluations. The current normalizer can substitute a score of 5; such defaults must not enter learning trends as measured performance.
4. Persist lifecycle events with authenticated ownership, event IDs, timestamps, and session/loop IDs. Deduplicate retries. Keep transcript and user-authored motion text out of analytics events.
5. Create a coach-scored evaluation set spanning difficulty, topic, stance, and response quality. Start with approximately 60–100 samples, two independent raters, and adjudication; expand before broad quality claims.
6. Check production migration state, rate limiting, monitoring, billing enforcement, feedback failures, latency, and inference cost. Establish feature rollout and rollback controls on the server for new APIs and entitlements.

**Ownership:** engineering lead for schema/telemetry; coach for rubric anchors and human scoring; product lead for funnel definitions.

**Release gate:** scripted end-to-end sessions produce exactly one completion event per action; invalid feedback is excluded from progress; every displayed transcript reference resolves. Proposed calibration threshold: at least 80% of AI dimension scores within one point of adjudicated human scores on the 10-point scale, with disagreement examined by subgroup. This is a starting quality threshold, not scientific proof of validity.

### Phase 1 — Turn recommendations into completed improvement cycles

**Experience:** coaching highlights one transcript moment and offers “Practice this weakness.” The learner completes a short exercise, receives focused feedback, and retries the original skill through a linked reassessment.

**Work packages**

1. Add `debate`, `drill`, and `reassessment` session types. Persist the originating debate, cited turn, target competency, exercise template version, and parent learning-cycle ID.
2. Ship three coach-authored drill families first: answer the strongest counterargument, explain the claim-to-evidence warrant, and repair an unsupported claim. Use generated variations inside these controlled structures.
3. Implement a short flow: challenge → learner response → focused coaching → retry. Avoid the full debate setup and full round sequence for a micro-drill.
4. Score only the targeted competency where evidence is sufficient. Show before/after excerpts and clearly distinguish practice completion from demonstrated improvement.
5. Give free users one complete introductory cycle, including drill and reassessment, without an intervening upgrade block. Apply entitlements atomically on the server and reconcile Stripe/Google Play behavior.
6. Preserve progress across refreshes, retries, and device changes; instrument actual starts and completions rather than treating CTA clicks as completed activity.

**Dependencies:** versioned rubric, durable events, and session ownership from Phase 0.

**Acceptance:** a new free user can complete the entire cycle; each attempt is correctly linked; repeated requests cannot duplicate an attempt or consume allowance twice; premium and existing debate flows still work.

**Validation gate:** test with 20–30 target learners. Proposed signal: at least 30% of first-debate completers finish a drill and linked reassessment within seven days. Review abandonment and coaching usefulness before adding more drill types; report the cohort count alongside the percentage.

### Phase 2 — Build the longitudinal skill profile and transfer checks

**Work packages**

1. Replace the main progress emphasis with competency trends, recurring weaknesses, completed correction cycles, and a recommended next activity. Keep wins and leaderboards secondary.
2. Compare like-for-like evaluations by rubric version, format, and difficulty. Show sample counts, time windows, and insufficient-data states. Use point changes on the rubric scale rather than dramatic percentage gains from tiny baselines.
3. Ship three short practice pathways: rebuttal foundations, evidence and warrants, and cross-examination. Each has an explicit objective, baseline, drill sequence, and reassessment.
4. Add goal-based onboarding and a “choose my opponent” option. Initially use transparent rules matching a weakness to a persona's attack style; train no custom recommendation model yet.
5. Introduce an unseen-topic assessment after a defined practice interval, such as five completed cycles. Use reserved parallel topic sets, fixed difficulty, independent evaluation, and no coaching hints during the assessment.
6. Expose an exportable progress report with score provenance, evidence excerpts, and a clear separation of practice improvement from transfer results.

**Dependencies:** linked attempts and trustworthy evaluation records. Do not mix new assessments with legacy fallback scores.

**Acceptance:** a learner can trace a trend to underlying sessions and transcript evidence; unseen assessments are separated from practice; historical results survive scoring upgrades without silent reinterpretation.

**Validation gate:** obtain at least one complete four-week cohort. Proposed targets: a 10 percentage-point increase in D7 return rate versus the measured baseline and a 20% relative decline in recurrence of the targeted weakness on comparable reassessments. These are hypotheses; small cohorts provide directional evidence only. If gains are absent, improve drills and calibration before broad expansion.

### Phase 3 — Validate coach and classroom demand

**Experience:** a coach assigns a debate, sees completion and common weaknesses, reviews the relevant transcript moments, then assigns follow-up practice.

**Work packages**

1. Recruit 3–5 design-partner coaches. Start with small invited groups; establish appropriate data permissions and learner controls before collecting pilot data.
2. Add organizations, memberships, coach/student roles, cohorts, and invite-based enrollment. Enforce tenant boundaries with RLS and API authorization, including exports and shared links.
3. Add assignments with motion, format, difficulty, due date, rubric version, and completion rules. Pilot the highest-demand tournament format as a configurable preset after coaches validate its stages and timing.
4. Provide a coach dashboard: participation, rubric distribution, common weaknesses, students needing review, and evidence excerpts supporting each recommendation. Permit instructor correction rather than treating AI prioritization as authoritative.
5. Add bounded custom rubrics, classroom curriculum packs, cohort drill assignment, and CSV/report exports. Keep custom-rubric results separate unless a validated mapping supports comparison.
6. Measure instructor review time and learner outcomes. Prepare the source plan's 6–8 week learning study: unseen pre/post tasks, blind human raters, a comparison group where feasible, and an analysis plan addressing dropout and selection bias.

**Ownership:** product lead runs pilots; engineers own tenancy and assignment flow; coach owns curriculum and evaluation; privacy/security specialist reviews pilot readiness.

**Release gate:** cross-tenant authorization tests pass; coach and student can complete an assignment/remediation cycle; retention/deletion controls and authorized access are verified before pilot enrollment.

**Expansion gate:** proposed signals are three coaches using the dashboard weekly for four weeks, at least 60% assignment completion, two partners willing to enter a paid pilot, and a measurable reduction in median review minutes per student. Rework workflow before building institutional integrations if adoption is weak.

### Phase 4 — Add argument maps, grounded evidence, and delivery feedback

Deliver these sequentially so the two-engineer team can finish complete features.

**April: argument structure**

- Extract claim, evidence, warrant, objection, and rebuttal nodes from completed transcripts. Link every node to its exact source turn/span and let learners correct extraction errors.
- Show unresolved objections and missing support; selecting a node opens its transcript evidence and the appropriate drill.
- Use a readable outline as the accessible/mobile fallback. Begin with post-session analysis rather than a distracting live graph.
- Gate: coach review of a representative sample finds at least 90% of displayed nodes correctly grounded in their cited spans; unresolved ambiguities are visible, not silently asserted as facts.

**May: source-grounded evidence mode**

- Start with teacher-curated evidence packs and user-provided documents, not unrestricted web retrieval.
- Ingest sources into private storage; retain document version, page/section, excerpt, and provenance. Link factual claims to passages and distinguish supported, contradicted, and insufficient-evidence states.
- Treat uploaded material as untrusted data, separate from system instructions. Use tenant-scoped retrieval and deletion propagation across files, extracted text, and indexes.
- Score relevance and warrant quality as well as citation presence. A retrieved passage does not prove that a claim is true.
- Gate: citation navigation and access isolation pass; coach review meets a proposed 90% claim-to-passage support threshold on a held-out sample; unsupported AI assertions are tracked and visibly flagged.

**June: voice delivery analytics**

- Extend speech input with consented recording and word timestamps; measure pace, fillers, pauses, and response latency. Do not infer these from text alone.
- Keep delivery scores separate from argument quality. Offer transcript corrections and text-only participation; avoid penalizing accent or accessibility needs.
- Connect delivery feedback to a short repeat exercise using the same argument.
- Gate: timing/filler measurements match annotated samples within agreed tolerances; storage/deletion and text fallback work; per-session processing costs fit the budget.

Run the learning-outcomes study alongside these releases using a frozen evaluation protocol. Publish results with sample size, attrition, and limitations; AI score changes alone do not establish transferable learning.

### Phase 5 — Scale the market that demonstrates demand

**Institutional track, highest priority if coach pilots convert**

- Add administrator controls, audit history, usage reporting, configurable retention, and export/deletion operations.
- Implement one pilot-requested LMS integration and one SSO integration first; add rostering and further connectors when contracted demand justifies them.
- Prepare procurement documentation, data-flow inventory, vendor review, incident procedures, and a qualified review of applicable student-data obligations. Do not claim compliance or certification from a feature checklist.
- Launch Education commercially after tenant isolation, recovery, administrative controls, onboarding/support, and paid pilot value are verified.

**Professional discovery track, bounded experiment**

- Package the same engine as “prepare for a difficult meeting”: paste proposal → choose skeptical stakeholder → adversarial Q&A → top objections → drill → preparation brief.
- Pilot one use case with approximately five design partners. Avoid launching sales, interviews, negotiation, and writing as separate products simultaneously.
- For writers/researchers, reuse argument maps and source mode for thesis → objections → revision → retest. Add comparison across three intellectual opponents only after a single-opponent pilot shows value and costs are acceptable.
- Gate: repeat use, explicit willingness to pay, and verified cost per completed preparation cycle. Defer this track if institutional work exceeds capacity.

## Technical integration and delivery order

Proposed entities, subject to schema design:

| Foundation | Records and relationships | Consumers |
|---|---|---|
| Learning cycle | `learning_loops`, `practice_attempts`; owner, origin debate/turn, competency, type, status, parent attempt | Drill runner, reassessment, funnel |
| Evaluation history | `rubric_versions`, `skill_observations`; attempt, score, evaluator version, validity, transcript references | Skill profile, calibration, exports |
| Curriculum | `pathways`, `pathway_steps`, `enrollments`; objective, exercise versions, progression | Personal practice and assignments |
| Education | `organizations`, `memberships`, `cohorts`, `assignments`, `submissions` | Coach dashboard and institutional access |
| Evidence | `sources`, `source_passages`, `argument_nodes`, `argument_edges`, `claim_citations` | Maps, evidence mode, red-teaming |
| Audio | `recordings`, `delivery_observations`; consent, retention, timestamps, attempt | Voice practice and reports |

Use additive migrations and preserve existing feedback JSON. Backfill only facts supported by old records; label unknown provenance. Recompute derived skill summaries from valid observations, not edited aggregate numbers. Make completion and evaluation writes idempotent. Use background jobs with retries for expensive source/audio analysis, keeping the live debate path responsive.

Primary integration points: `src/lib/debate/types.ts`, `feedback.ts`, `prompt-builder.ts`, and `state-machine.ts`; the feedback and debate APIs; `feedback-panel.tsx`, `progress-summary.tsx`, `setup-wizard.tsx`; `src/lib/analytics.ts`; billing tier services; and new Supabase migrations.

For each release: run the repository's lint, typecheck, unit, and relevant Playwright checks; add meaningful coverage for attempt transitions, evaluation validity, quota accounting, ownership/tenant boundaries, and the complete learner journey. Roll out to internal users, then a pilot cohort, then wider availability. Retain a server-side rollback switch for new generation modes.

## Measurement and prioritization

**North star: Weekly Completed Improvement Loops (WCIL).** Count distinct learners whose linked debate → viewed coaching → completed targeted drill → completed reassessment occurs within seven days of the originating debate. Attribute the user to the reassessment-completion week and count them once per week. Track total completed cycles separately. A completed cycle does not automatically mean the user improved.

Supporting measures:

- Activation: first-debate completion and median time to first coaching.
- Cycle conversion: coaching viewed → drill started → drill completed → reassessment completed, using stable linked IDs.
- Retention: D7/D30 return and four-consecutive-week participation, segmented by goal and cohort.
- Learning: comparable competency changes, weakness recurrence, blind transfer performance, and AI/human scoring agreement.
- Business: free-to-paid conversion, churn, inference/audio cost per completed cycle, and paid pilot conversion.
- Coach value: assignment completion, weekly coach use, and median review minutes per student.
- Guardrails: invalid feedback, unsupported citations, reported disagreement, error rate, latency, deletion failures, and per-user generation cost.

All numeric gates in this plan are proposed decision thresholds, not measured baselines, forecasts, or industry benchmarks. Establish denominators and minimum observation windows before each experiment. If the sample is too small, extend observation and use interviews rather than declaring a statistical winner.

Run experiments in order: weakness-focused CTA versus generic rematch; evidence-first coaching versus score-first coaching; skill trends versus wins; then mastery-focused premium messaging. Randomize by learner when traffic supports it, set the primary metric in advance, and watch retention, quality, and costs alongside conversion.

## Packaging and growth

- **Free:** prove one complete improvement cycle and show a basic skill snapshot.
- **Pro:** sell continuing practice, full skill history, personalized pathways, advanced evidence/voice tools, and useful exports. Evaluate sustainable usage limits against actual cost rather than promising unlimited expensive processing prematurely.
- **Education:** sell assignments, cohort insight, curriculum, instructor control, and measured coaching efficiency. Test annual paid pilots before school-wide contracts.
- **Professional:** test separate value-based packaging only after repeated use of a focused scenario workflow.

Recruit student/debate-club testers in Phases 1–2, coach design partners in Phase 3, and expand through demonstrated outcomes and opt-in sharing. Preserve privacy in public reports and examples. The source's price ranges are hypotheses; this plan does not change prices or assume their validation.

Defer additional avatar work, expanded neural voices, elaborate gamification, persona marketplaces, broad LMS coverage, and simultaneous professional vertical launches. Maintain existing experiences, but allocate new investment to measurable learning first.

## First six two-week sprints

| Sprint | Deliverable | Accountable roles | Reviewable exit |
|---|---|---|---|
| 1 | Rubric anchors, event contract, production readiness review, evaluation sample | Engineer 1 + coach; Engineer 2 + product | Validity rules agreed; baseline events traceable; deployment gaps documented |
| 2 | Persisted learning-cycle/attempt schema and first drill template | Engineer 1 backend; Engineer 2 UI; coach content | Debate feedback launches an owned, linked drill |
| 3 | Three drill families, focused scoring, retry and reassessment | Both engineers + coach | Complete learner journey works with transcript-grounded feedback |
| 4 | Free-cycle allowance, persistence/recovery, pilot instrumentation | Both engineers + product | Pilot users complete the cycle; quota and retry checks pass |
| 5 | Skill history, comparable cohorts, baseline pathway | Engineer 1 data; Engineer 2 profile; coach curriculum | Users can trace each trend to valid evidence |
| 6 | Unseen assessment, export, first cohort readout | Both engineers + coach/product | Transfer separated from practice; Phase 3 go/adjust decision documented |

Use the remaining December buffer for pilot fixes and evaluation. If gates fail, spend the next sprint correcting the learning cycle before advancing the calendar.

## Source traceability

Primary source: `/Users/joelguzman/Downloads/Debate Master_ User Value, Product Strategy, and Growth Roadmap.pdf`.

- Pages 4–7: learning cycle, feature priorities, evidence and outcome framework → Phases 0–2 and measurement.
- Pages 8–11: learner, coach, professional, and creator journeys → Phases 1, 3, and 5.
- Pages 12–15: supplied competitive framing and packaging proposals → differentiation and packaging.
- Pages 16–17: MVP and October 2026–September 2027 sequencing → phased schedule. This implementation plan splits the first quarter into explicit dependencies and sequences later work to match assumed capacity.
- Pages 18–21: KPIs, experiments, and independent evaluation → gates, guardrails, and outcomes study.
- Page 22: persistent understanding of learner weaknesses as the durable asset → skill model priority.

Repository inspection supports the starting-point table. It was a planning review, not a full implementation audit or production certification.
