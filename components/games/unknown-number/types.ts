export const LICENSES = ['CC0', 'CC BY', 'CC BY-SA', 'Public Domain'] as const;
export type LicenseId = (typeof LICENSES)[number];

export type Portrait = {
  path: string;
  commonsUrl: string;
  author: string;
  license: LicenseId;
};

export type FigureDraft = {
  id: string;
  name: string;
  years: string;
  field: string;
  country: string;
  bio: string;
  story: [string, string, string];
  source: string;
  more?: string;
  aliases: string[];
  clues: [string, string, string, string, string, string];
  voice: string;
  contactEmoji: string;
};

export type Figure = FigureDraft & {
  portrait: Portrait | null;
};

export type GameStatus = 'playing' | 'won' | 'lost';

export type GuessRecord = {
  text: string;
  correct: boolean;
};

export type DayState = {
  date: string;
  puzzleNumber: number;
  figureId: string;
  guesses: GuessRecord[];
  revealed: number;
  status: GameStatus;
  timestamps: string[];
};

export type GameStats = {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  lastPlayed: string | null;
  lastWon: string | null;
  distribution: [number, number, number, number, number, number];
};
