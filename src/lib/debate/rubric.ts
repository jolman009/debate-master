export const RUBRIC_VERSION = "debate-anchors-1";
export const PROMPT_VERSION = "coach-3";

// Coach review is required before claiming calibration. Tags are descriptive,
// not additional headline scores.
export const RUBRIC = {
  argumentStrength: { subskills: ["claim_warrant", "causal_reasoning"], anchors: ["1–3: asserts a claim without a connecting warrant", "4–6: supplies a warrant but leaves assumptions or causal links unexplained", "7–8: connects claims and warrants and addresses key assumptions", "9–10: tests alternatives and explains why the causal case survives them"] },
  evidenceUsage: { subskills: ["evidence_relevance", "source_limits"], anchors: ["1–3: unsupported assertions or irrelevant examples", "4–6: relevant examples with an incomplete connection to the claim", "7–8: explains how evidence supports the claim and acknowledges limits", "9–10: weighs competing evidence and calibrates conclusions to its strength"] },
  rebuttalQuality: { subskills: ["strongest_warrant", "comparative_weighing"], anchors: ["1–3: ignores or misrepresents the opposing case", "4–6: answers a claim but misses its strongest warrant", "7–8: answers the strongest warrant with a supported counterargument", "9–10: directly compares both cases and explains which decisive objection remains"] },
  rhetoricalSkill: { subskills: ["organization", "precision"], anchors: ["1–3: unclear claims and disconnected structure", "4–6: understandable position with repetition or ambiguous transitions", "7–8: clear signposting, precise language and concise explanations", "9–10: coherent prioritization makes complex tradeoffs easy to follow"] },
} as const;
export const RUBRIC_ANCHORS = `Rubric ${RUBRIC_VERSION}: ${JSON.stringify(RUBRIC)}. Use integer scores. Judge text only, never infer accent or vocal delivery. Do not invent factual verification. If evidence is insufficient to score a dimension return null for its score; never substitute a midpoint.`;
