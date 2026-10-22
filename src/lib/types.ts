export interface PersonalityProfile {
  /** A few sentences on who this person is, in third person. */
  summary: string;
  /** How they talk: sentence length, warmth, formality, pacing, dialect. */
  speakingStyle: string;
  /** Phrases, sayings, greetings and words they actually use. */
  signaturePhrases: string[];
  /** What makes them laugh and how they joke. */
  humor: string;
  /** Core values and principles they live by. */
  values: string[];
  /** Beliefs, opinions and stances they expressed (with nuance). */
  opinions: string[];
  /** Important people: who they are and what they mean to them. */
  relationships: string[];
  /** Key life events in rough chronological order. */
  lifeTimeline: string[];
  /** How they approach decisions, risk, conflict and problems. */
  decisionMaking: string;
  /** Recurring advice and lessons they want to pass on. */
  adviceThemes: string[];
  /** Topics they find sensitive or prefer not to dwell on. */
  sensitivities: string[];
}

export const EMPTY_PROFILE: PersonalityProfile = {
  summary: "",
  speakingStyle: "",
  signaturePhrases: [],
  humor: "",
  values: [],
  opinions: [],
  relationships: [],
  lifeTimeline: [],
  decisionMaking: "",
  adviceThemes: [],
  sensitivities: [],
};

export interface Legacy {
  id: string;
  name: string;
  birthYear: number | null;
  intro: string;
  profile: PersonalityProfile;
  voiceId: string | null;
  voiceConsentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewTurn {
  id: string;
  legacyId: string;
  topic: string;
  question: string;
  answer: string | null;
  skipped: boolean;
  distilled: boolean;
  createdAt: string;
}

export interface Memory {
  id: string;
  legacyId: string;
  title: string;
  content: string;
  era: string;
  tags: string[];
  sourceTurnId: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  legacyId: string;
  role: "user" | "assistant";
  speaker: string | null;
  content: string;
  createdAt: string;
}

export interface LegacySummary extends Legacy {
  answeredCount: number;
  memoryCount: number;
  pendingDistillCount: number;
}
