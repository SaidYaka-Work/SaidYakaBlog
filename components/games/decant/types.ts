export type Mode = 'daily' | 'practice';

export type Grade = 'par' | 'close' | 'steady' | 'patient';

export type Move =
  | { kind: 'fill'; jug: number }
  | { kind: 'empty'; jug: number }
  | { kind: 'pour'; from: number; to: number };

export type Goal =
  | { kind: 'any'; amount: number }
  | { kind: 'match'; amounts: readonly (number | null)[] };

export type LessonStep = {
  title: string;
  text: string;
};

export type Puzzle = {
  id: string;
  capacities: readonly number[];
  start: readonly number[];
  goal: Goal;
  optimal: number;
  solution: readonly Move[];
  prompt: string;
  blurb: string;
  lesson: LessonStep[];
};

export type Result = {
  puzzle: Puzzle;
  pours: number;
  extra: number;
  points: number;
  grade: Grade;
  end: readonly number[];
};

export type Held = null | { kind: 'well' } | { kind: 'drain' } | { kind: 'jug'; index: number };
