export type DebateStage =
  | "setup"
  | "opening_user"
  | "opening_ai"
  | "rebuttal_user_1"
  | "rebuttal_ai_1"
  | "rebuttal_user_2"
  | "rebuttal_ai_2"
  | "cross_exam_ai"
  | "cross_exam_user"
  | "cross_exam_ai_response"
  | "closing_user"
  | "closing_ai"
  | "feedback"
  | "complete";

export type PersonaId =
  | "destiny"
  | "andrew-wilson"
  | "candace"
  | "ben-shapiro"
  | "michael-knowles"
  | "dave-smith";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface VoiceConfig {
  pitch: number;
  rate: number;
  voicePrefs: string[];
}

export interface Persona {
  id: PersonaId;
  displayName: string;
  tagline: string;
  avatarUrl: string;
  systemPrompt: string;
  ideology: string;
  voiceConfig: VoiceConfig;
}

export interface DebateConfig {
  topic: string;
  motion: string;
  userSide: "pro" | "con";
  personaId: PersonaId;
  difficulty: Difficulty;
  rebuttalCycles: 1 | 2;
  crossExamEnabled: boolean;
}

export interface DebateTurn {
  id: string;
  debate_id: string;
  stage: DebateStage;
  role: "user" | "ai";
  content: string;
  created_at: string;
}

export interface Debate {
  id: string;
  config: DebateConfig;
  current_stage: DebateStage;
  turns: DebateTurn[];
  feedback: DebateFeedback | null;
  created_at: string;
  updated_at: string;
}

export interface DebateFeedback {
  overallScore: number;
  argumentStrength: number;
  evidenceUsage: number;
  rebuttalQuality: number;
  rhetoricalSkill: number;
  summary: string;
  strengths: string[];
  improvements: string[];
}

export interface Topic {
  id: string;
  title: string;
  motion: string;
  category: string;
  difficulty: Difficulty;
}
