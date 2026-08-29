import { Debate, DebateConfig, DebateStage, DebateTurn, Persona } from "./types";
import { getStageLabel } from "./state-machine";

export interface GeminiMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

const STAGE_AI_INSTRUCTIONS: Partial<Record<DebateStage, string>> = {
  opening_ai: `Deliver your opening statement for this debate. Structure it with 2-4 clear arguments in 2-4 short paragraphs. Be persuasive and establish your position firmly. Reflect your persona's characteristic style.`,

  rebuttal_ai_1: `Provide your first rebuttal. Tag and address 2-4 specific points from your opponent's arguments. Provide counter-arguments with evidence or concrete examples. You may introduce 1-2 new supporting points.`,

  rebuttal_ai_2: `Provide your second rebuttal. Press harder on the weakest parts of your opponent's position. Introduce your strongest remaining evidence. Address any new arguments they raised.`,

  cross_exam_ai: `You are now in cross-examination mode. Ask your opponent 3-5 pointed, probing questions designed to expose weaknesses or inconsistencies in their position. Frame questions that are hard to answer without conceding something to your side.`,

  cross_exam_ai_response: `Your opponent has answered your cross-examination questions. Briefly comment on their answers in 1-2 paragraphs. Highlight any evasions, contradictions, or concessions.`,

  closing_ai: `Deliver your closing statement. First, briefly and fairly summarize the strongest arguments on both sides. Then advocate powerfully for your position in a concise closing of 1-3 paragraphs. End memorably.`,
};

export function buildSystemPrompt(
  persona: Persona,
  debate: Debate
): string {
  const { config } = debate;
  const aiSide = config.userSide === "pro" ? "Con (Against)" : "Pro (For)";
  const userSide = config.userSide === "pro" ? "Pro (For)" : "Con (Against)";

  return `${persona.systemPrompt}

DEBATE CONTEXT:
- Topic: "${config.topic}"
- Motion: "${config.motion}"
- Your side: ${aiSide}
- Opponent's side: ${userSide}
- Difficulty level: ${config.difficulty}
${config.difficulty === "beginner" ? "- Adjust your language to be more accessible. Use simpler examples and be patient in explaining concepts." : ""}
${config.difficulty === "advanced" ? "- Bring your most sophisticated arguments. Use complex evidence, philosophical frameworks, and detailed analysis." : ""}

Speak in first person as your persona. Use clear formatting with headings and numbered points where appropriate.`;
}

export function buildMessages(
  turns: DebateTurn[],
  currentStage: DebateStage,
  userContent?: string
): GeminiMessage[] {
  const raw: { role: "user" | "model"; text: string }[] = [];

  for (const turn of turns) {
    const stageLabel = getStageLabel(turn.stage);
    const role = turn.role === "user" ? "user" : "model";
    raw.push({
      role,
      text: `[${stageLabel}]\n\n${turn.content}`,
    });
  }

  // Add the current user message if provided
  if (userContent) {
    const stageLabel = getStageLabel(currentStage);
    raw.push({
      role: "user",
      text: `[${stageLabel}]\n\n${userContent}`,
    });
  }

  // Add AI stage instruction as a user message
  const aiInstruction = STAGE_AI_INSTRUCTIONS[currentStage];
  if (aiInstruction && !userContent) {
    // For AI-initiated stages (like cross_exam_ai), we need a user message to prompt the AI
    const stageLabel = getStageLabel(currentStage);
    raw.push({
      role: "user",
      text: `[${stageLabel}]\n\n[Stage instruction: ${aiInstruction}]`,
    });
  }

  // Ensure messages alternate properly - Gemini requires conversation to start with user
  if (raw.length > 0 && raw[0].role === "model") {
    raw.unshift({
      role: "user",
      text: "[The debate begins. Deliver your opening statement.]",
    });
  }

  // Merge consecutive same-role messages
  const merged: GeminiMessage[] = [];
  for (const msg of raw) {
    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      merged[merged.length - 1].parts[0].text += "\n\n" + msg.text;
    } else {
      merged.push({
        role: msg.role,
        parts: [{ text: msg.text }],
      });
    }
  }

  return merged;
}

export function buildFeedbackPrompt(turns: DebateTurn[]): string {
  let transcript = "DEBATE TRANSCRIPT:\n\n";
  for (const turn of turns) {
    const speaker = turn.role === "user" ? "USER" : "AI OPPONENT";
    const stageLabel = getStageLabel(turn.stage);
    transcript += `--- TURN_ID: ${turn.id} | ${speaker} (${stageLabel}) ---\n${turn.content}\n\n`;
  }
  return transcript;
}

/**
 * Transcript for the human-vs-human judge. Speakers are labelled only by SIDE
 * (PRO/CON) — never by name or identity — so the judge rules on the arguments
 * alone and cannot favour a player it "knows".
 */
export function buildJudgePrompt(
  turns: DebateTurn[],
  config: DebateConfig
): string {
  let prompt = `MOTION: "${config.motion || config.topic}"\n\n`;
  prompt += "DEBATE TRANSCRIPT:\n\n";
  for (const turn of turns) {
    const speaker = turn.role === "pro" ? "PRO" : "CON";
    const stageLabel = getStageLabel(turn.stage);
    prompt += `--- ${speaker} (${stageLabel}) ---\n${turn.content}\n\n`;
  }
  prompt +=
    "Judge this debate. Score both sides and declare the winner as valid JSON.";
  return prompt;
}

export const JUDGE_SYSTEM_PROMPT = `You are a neutral, impartial debate judge ruling on a completed debate between two human debaters, PRO and CON.

Judge ONLY what is in the transcript. Apply the SAME rubric to both sides with equal rigour. Your personal opinion on the motion is irrelevant — judge who argued better, not who you agree with. Do not favour a side for going first or last.

Score EACH side independently on a 1-10 scale:
- argumentStrength: How strong and well-supported were their arguments?
- evidenceUsage: How well did they use evidence, examples, and data?
- rebuttalQuality: How effectively did they counter the other side's points?
- rhetoricalSkill: How persuasive was their delivery and structure?
- score: Their overall performance

For each side also provide:
- summary: A 2-3 sentence assessment of that side's case
- strengths: 2-4 specific things that side did well (array of strings)
- improvements: 2-4 specific things that side could have done better (array of strings)

Then decide:
- winner: "pro", "con", or "draw" — "draw" ONLY when the sides are genuinely inseparable
- rationale: 2-4 sentences explaining the decision, citing the decisive exchanges

The winner must be consistent with the scores: do not declare a winner whose overall score is lower than the other side's.

Respond ONLY with valid JSON matching this exact structure:
{
  "pro": {
    "score": number,
    "argumentStrength": number,
    "evidenceUsage": number,
    "rebuttalQuality": number,
    "rhetoricalSkill": number,
    "summary": "string",
    "strengths": ["string"],
    "improvements": ["string"]
  },
  "con": {
    "score": number,
    "argumentStrength": number,
    "evidenceUsage": number,
    "rebuttalQuality": number,
    "rhetoricalSkill": number,
    "summary": "string",
    "strengths": ["string"],
    "improvements": ["string"]
  },
  "winner": "pro" | "con" | "draw",
  "rationale": "string"
}`;

export const FEEDBACK_SYSTEM_PROMPT = `You are an expert debate coach analyzing a completed debate. You are NO LONGER in persona - speak as a neutral, constructive coach.

Evaluate the USER's performance (not the AI's) across these dimensions on a 1-10 scale:
- argumentStrength: How strong and well-supported were their arguments?
- evidenceUsage: How well did they use evidence, examples, and data?
- rebuttalQuality: How effectively did they counter the opponent's points?
- rhetoricalSkill: How persuasive was their delivery and structure?
- overallScore: Overall debate performance

Use evidence from the transcript. Evidence references MUST use exact TURN_ID values from the transcript and excerpts MUST be copied exactly from that turn. Prefer USER turns when coaching the user's performance. If no exact excerpt supports a claim, leave that claim's evidence array empty.

Also provide:
- summary: A 2-3 sentence overall assessment
- strongestMoment: one concrete thing the user did best
- priorityImprovement: the one most important thing to improve next
- rubric: a score and rationale for each scoring dimension
- practiceRecommendation: a user-controlled next practice suggestion
- strengths: 2-4 specific things they did well (array of strings)
- improvements: 2-4 specific areas for improvement (array of strings)

Respond ONLY with valid JSON matching this exact structure:
{
  "version": 2,
  "overallScore": number,
  "summary": "string",
  "strongestMoment": {
    "title": "string",
    "detail": "string",
    "evidence": [{ "turnId": "string", "excerpt": "exact transcript excerpt" }]
  },
  "priorityImprovement": {
    "title": "string",
    "detail": "string",
    "evidence": [{ "turnId": "string", "excerpt": "exact transcript excerpt" }]
  },
  "rubric": {
    "argumentStrength": { "score": number, "rationale": "string", "evidence": [{ "turnId": "string", "excerpt": "exact transcript excerpt" }] },
    "evidenceUsage": { "score": number, "rationale": "string", "evidence": [{ "turnId": "string", "excerpt": "exact transcript excerpt" }] },
    "rebuttalQuality": { "score": number, "rationale": "string", "evidence": [{ "turnId": "string", "excerpt": "exact transcript excerpt" }] },
    "rhetoricalSkill": { "score": number, "rationale": "string", "evidence": [{ "turnId": "string", "excerpt": "exact transcript excerpt" }] }
  },
  "practiceRecommendation": {
    "focus": "string",
    "motion": "string",
    "difficulty": "beginner" | "intermediate" | "advanced",
    "rationale": "string"
  },
  "strengths": ["string"],
  "improvements": ["string"]
}`;
