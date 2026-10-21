export type PromptKind = 'draw' | 'sound';

export type Prompt = {
  id: string;
  kind: PromptKind;
  text: string;
};

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
  points: number;
  thumbs: Thumbs;
  reaction: string;
  stars: number;
  empty: boolean;
  late: boolean;
  drawingUrl?: string;
  audioUrl?: string;
  replayHits?: SynthHit[];
};

export type SynthHit = {
  padId: string;
  at: number;
  holdMs: number;
};

export type ChatRole = 'user' | 'assistant';

export type ChatMessage =
  | { id: string; role: 'user'; kind: 'text'; text: string }
  | { id: string; role: 'user'; kind: 'nudge'; text: string }
  | { id: string; role: 'user'; kind: 'rating'; thumbs: Thumbs; text: string }
  | { id: string; role: 'assistant'; kind: 'drawing'; src: string }
  | { id: string; role: 'assistant'; kind: 'audio'; src: string; hits?: SynthHit[] }
  | { id: string; role: 'assistant'; kind: 'miss'; text: string };
