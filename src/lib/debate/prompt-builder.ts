import { Debate, DebateStage, DebateTurn, Persona } from "./types";
import { getStageLabel } from "./state-machine";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
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
): AnthropicMessage[] {
  const messages: AnthropicMessage[] = [];

  for (const turn of turns) {
    const stageLabel = getStageLabel(turn.stage);
    const role = turn.role === "user" ? "user" : "assistant";
    messages.push({
      role,
      content: `[${stageLabel}]\n\n${turn.content}`,
    });
  }

  // Add the current user message if provided
  if (userContent) {
    const stageLabel = getStageLabel(currentStage);
    messages.push({
      role: "user",
      content: `[${stageLabel}]\n\n${userContent}`,
    });
  }

  // Add AI stage instruction as a user message
  const aiInstruction = STAGE_AI_INSTRUCTIONS[currentStage];
  if (aiInstruction && !userContent) {
    // For AI-initiated stages (like cross_exam_ai), we need a user message to prompt the AI
    const stageLabel = getStageLabel(currentStage);
    messages.push({
      role: "user",
      content: `[${stageLabel}]\n\n[Stage instruction: ${aiInstruction}]`,
    });
  }

  // Ensure messages alternate properly - Anthropic requires user first
  if (messages.length > 0 && messages[0].role === "assistant") {
    messages.unshift({
      role: "user",
      content: "[The debate begins. Deliver your opening statement.]",
    });
  }

  // Merge consecutive same-role messages
  const merged: AnthropicMessage[] = [];
  for (const msg of messages) {
    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      merged[merged.length - 1].content += "\n\n" + msg.content;
    } else {
      merged.push({ ...msg });
    }
  }

  return merged;
}

export function buildFeedbackPrompt(turns: DebateTurn[]): string {
  let transcript = "DEBATE TRANSCRIPT:\n\n";
  for (const turn of turns) {
    const speaker = turn.role === "user" ? "USER" : "AI OPPONENT";
    const stageLabel = getStageLabel(turn.stage);
    transcript += `--- ${speaker} (${stageLabel}) ---\n${turn.content}\n\n`;
  }
  return transcript;
}

export const FEEDBACK_SYSTEM_PROMPT = `You are an expert debate coach analyzing a completed debate. You are NO LONGER in persona - speak as a neutral, constructive coach.

Evaluate the USER's performance (not the AI's) across these dimensions on a 1-10 scale:
- argumentStrength: How strong and well-supported were their arguments?
- evidenceUsage: How well did they use evidence, examples, and data?
- rebuttalQuality: How effectively did they counter the opponent's points?
- rhetoricalSkill: How persuasive was their delivery and structure?
- overallScore: Overall debate performance

Also provide:
- summary: A 2-3 sentence overall assessment
- strengths: 2-4 specific things they did well (as an array of strings)
- improvements: 2-4 specific areas for improvement (as an array of strings)

Respond ONLY with valid JSON matching this exact structure:
{
  "overallScore": number,
  "argumentStrength": number,
  "evidenceUsage": number,
  "rebuttalQuality": number,
  "rhetoricalSkill": number,
  "summary": "string",
  "strengths": ["string"],
  "improvements": ["string"]
}`;
