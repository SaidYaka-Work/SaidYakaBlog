export type Mode = 'daily' | 'practice';

export type Grade = 'swift' | 'steady' | 'patient';

export type Island = {
  id: number;
  row: number;
  col: number;
  need: number;
};

/** Canonical `"min-max"` island-id pair. */
export type EdgeKey = string;

export type BridgeCount = 0 | 1 | 2;

export type Bridges = Record<EdgeKey, BridgeCount>;

export type Pair = readonly [number, number];

export type Puzzle = {
  id: string;
  size: number;
  islands: Island[];
  pairs: Pair[];
  solution: Record<EdgeKey, 1 | 2>;
};

export type Result = {
  puzzle: Puzzle;
  seconds: number;
  moves: number;
  points: number;
  grade: Grade;
};
