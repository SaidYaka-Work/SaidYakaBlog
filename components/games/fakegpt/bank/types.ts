export const BANK_KINDS = [
  'translate',
  'trivia',
  'math',
  'unit',
  'weekday',
  'spell',
  'unscramble',
  'order',
  'tone',
  'fill',
] as const;

export type BankKind = (typeof BANK_KINDS)[number];

export type BankQuestion = {
  id: string;
  kind: BankKind;
  category: string;
  difficulty: 1 | 2 | 3;
  text: string;
  options: [string, string, string, string];
  answer: string;
};

export const WINDOW_DAYS = 60;
export const DAILY_BANK_COUNT = 24;
export const DAILY_GEN_COUNT = 16;
export const DAILY_ROUND_COUNT = DAILY_BANK_COUNT + DAILY_GEN_COUNT;
export const EPOCH_DATE = '2026-01-01';
export const OPTIONS_PER_QUESTION = 4;
