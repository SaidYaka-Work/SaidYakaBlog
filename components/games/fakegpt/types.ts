import type { DailyRound, PromptKind } from '../../../workers/fakegpt/src/schema';

export type { PromptKind };
export type Prompt = DailyRound;

export type Thumbs = 'up' | 'down';

export type RoundAttempt = {
  kind: PromptKind;
  submittedInTime: boolean;
  remainingMs: number;
  totalMs: number;
  strokeCount: number;
  uniqueColors: number;
  coverage: number;
  audioMs: number;
  peakLevel: number;
  padHits: number;
  correct?: boolean;
  empty?: boolean;
};

export type ScoreResult = {
  points: number;
  quality: number;
  thumbs: Thumbs;
  stars: number;
  empty: boolean;
  late: boolean;
  reaction: string;
};

export type Artifact = {
  prompt: Prompt;
  customer?: string;
  points: number;
  thumbs: Thumbs;
  reaction: string;
  stars: number;
  empty: boolean;
  late: boolean;
  playerAnswer?: string;
  correctAnswer?: string;
  drawingUrl?: string;
  audioUrl?: string;
  replayHits?: SynthHit[];
  seen?: string;
  heard?: string;
  judged?: boolean;
};

export type SynthHit = {
  padId: string;
  at: number;
  holdMs: number;
};

export type ChatRole = 'user' | 'assistant';

export type ChatMessage =
  | { id: string; role: 'user'; kind: 'text'; text: string; persona?: string }
  | { id: string; role: 'user'; kind: 'nudge'; text: string }
  | { id: string; role: 'user'; kind: 'rating'; thumbs: Thumbs; text: string }
  | { id: string; role: 'user'; kind: 'join'; text: string }
  | { id: string; role: 'assistant'; kind: 'drawing'; src: string }
  | { id: string; role: 'assistant'; kind: 'audio'; src: string; hits?: SynthHit[] }
  | { id: string; role: 'assistant'; kind: 'answer'; text: string }
  | { id: string; role: 'assistant'; kind: 'miss'; text: string };
