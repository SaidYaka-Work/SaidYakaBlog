export type Mode = 'daily' | 'practice';

export type Grade = 'swift' | 'steady' | 'patient';

export type Direction = 'cw' | 'ccw';

export type Point = {
  x: number;
  y: number;
};

export type PegRole = 'motor' | 'idle' | 'output';

export type Peg = {
  id: number;
  x: number;
  y: number;
  role: PegRole;
};

/** One tooth count for a simple gear; two for a compound pair on one axle. */
export type Teeth = readonly [number] | readonly [number, number];

export type Piece = {
  id: string;
  teeth: Teeth;
};

/** peg id string → tray piece id */
export type Placement = Record<string, string>;

export type Ratio = {
  num: number;
  den: number;
};

export type Target = {
  ratio: Ratio;
  direction: Direction;
};

export type LessonStep = {
  title: string;
  text: string;
};

export type Mesh = {
  a: number;
  b: number;
  teethA: number;
  teethB: number;
};

export type Motion = {
  jammed: boolean;
  omega: Record<number, number>;
  meshes: Mesh[];
};

export type Puzzle = {
  id: string;
  pegs: Peg[];
  motor: { peg: number; teeth: number };
  pieces: Piece[];
  target: Target;
  solution: Placement;
  lesson: LessonStep[];
  blurb: string;
};

export type Result = {
  puzzle: Puzzle;
  seconds: number;
  moves: number;
  used: number;
  points: number;
  grade: Grade;
  stars: 1 | 2 | 3;
  lesson: LessonStep[];
};
