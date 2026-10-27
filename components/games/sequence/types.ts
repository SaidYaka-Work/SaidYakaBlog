export type Category =
  | 'recursive'
  | 'figurate'
  | 'power'
  | 'combinatorial'
  | 'prime'
  | 'sieve'
  | 'digital'
  | 'special';

export type SequenceSpec = {
  id: string;
  name: string;
  category: Category;
  shownCount: number;
  generate: (count: number) => number[];
  expected: readonly number[];
  rule: string;
  blurb: string;
  source: string;
  categoryHint: string;
  giveaway: string;
  openingHint?: string;
};

export type Puzzle = {
  id: string;
  name: string;
  category: Category;
  shown: number[];
  answer: number;
  continuation: number[];
  rule: string;
  blurb: string;
  source: string;
  hints: string[];
};

export type Grade = 'first' | 'second' | 'third' | 'fourth' | 'fifth' | 'miss';

export type Tone = 'hit' | 'close' | 'miss';

export type Attempt = {
  guess: number;
  tone: Tone;
};

export type Result = {
  puzzle: Puzzle;
  attempts: Attempt[];
  solved: boolean;
  tries: number;
  points: number;
  grade: Grade;
};

export type Mode = 'daily' | 'practice';
