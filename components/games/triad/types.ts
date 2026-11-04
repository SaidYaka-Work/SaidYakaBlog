export type Mode = 'daily' | 'practice';

export type Grade = 'clean' | 'sharp' | 'steady' | 'guided' | 'messy';

export type Shape = 0 | 1 | 2;
export type Color = 0 | 1 | 2;
export type Count = 0 | 1 | 2;
export type Fill = 0 | 1 | 2;

export type Card = {
  id: number;
  shape: Shape;
  color: Color;
  count: Count;
  fill: Fill;
};

/** Three card ids, sorted ascending. */
export type Triad = readonly [number, number, number];

export type Puzzle = {
  id: string;
  cards: readonly Card[];
  triads: readonly Triad[];
};

export type Result = {
  puzzle: Puzzle;
  found: readonly Triad[];
  mistakes: number;
  hints: number;
  solved: boolean;
  points: number;
  grade: Grade;
};
