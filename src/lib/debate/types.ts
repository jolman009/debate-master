export type DebateStage =
  // AI mode (unchanged — persisted values must never be renamed).
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
  // Human-vs-human mode (side-named; pro always opens). Added additively so
  // existing AI debates keep their stage strings with zero migration.
  | "opening_pro"
  | "opening_con"
  | "rebuttal_pro_1"
  | "rebuttal_con_1"
  | "rebuttal_pro_2"
  | "rebuttal_con_2"
  | "cross_exam_pro"
  | "cross_exam_con"
  | "closing_pro"
  | "closing_con"
  | "judge"
  | "complete";

export type Side = "pro" | "con";

/** How the opponent is played. Absent ⇒ "ai" so every existing row is AI. */
export type DebateMode = "ai" | "human";

// A persona's stable identifier. Built-in personas use fixed slugs (e.g.
// "destiny"); user-created custom personas use generated slugs, so this is a
// plain string rather than a fixed union.
export type PersonaId = string;

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface VoiceConfig {
  pitch: number;
  rate: number;
  voicePrefs: string[];
  elevenLabsVoiceId?: string;
}

export interface ThemeColor {
  from: string;
  to: string;
  glow: string;
}

export interface Persona {
  id: PersonaId;
  displayName: string;
  tagline: string;
  avatarUrl: string;
  avatarUrlSpeaking?: string;
  avatarUrlThinking?: string;
  systemPrompt: string;
  ideology: string;
  voiceConfig: VoiceConfig;
  theme: ThemeColor;
}

export interface DebateConfig {
  topic: string;
  motion: string;
  // In human mode this is the CREATOR's side; the invitee takes the other.
  userSide: Side;
  // Optional in human mode (no AI opponent to embody).
  personaId: PersonaId;
  difficulty: Difficulty;
  rebuttalCycles: 1 | 2;
  crossExamEnabled: boolean;
  // Absent ⇒ "ai". Only "human" enables the two-player path.
  mode?: DebateMode;
}

export interface DebateTurn {
  id: string;
  debate_id: string;
  stage: DebateStage;
  // AI mode writes "user"/"ai"; human mode writes the debater's side.
  role: "user" | "ai" | "pro" | "con";
  content: string;
  created_at: string;
  // Set only for human turns — the user who authored the turn.
  author_id?: string | null;
}

export interface DebateParticipant {
  user_id: string;
  side: Side;
  role: string;
  joined_at?: string;
}

export interface Debate {
  id: string;
  config: DebateConfig;
  current_stage: DebateStage;
  turns: DebateTurn[];
  feedback: DebateFeedback | null;
  share_token?: string | null;
  // Present for human debates; only the owner sees it in API responses.
  invite_token?: string | null;
  // Human-mode extras, populated by GET /api/debate/[id]. Absent for AI mode.
  participants?: DebateParticipant[];
  // The requesting user's side, if they are a participant. null otherwise.
  viewerSide?: Side | null;
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
  packId?: string;
}

export interface TopicPack {
  id: string;
  name: string;
  description: string;
}
