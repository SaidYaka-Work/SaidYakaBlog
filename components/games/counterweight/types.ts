export type ShapeId = 'circle' | 'triangle' | 'square' | 'diamond' | 'hexagon';

export type Token =
  | { kind: 'shape'; shape: ShapeId }
  | { kind: 'mass'; value: number };

export type Side = Token[];

export type Scale = {
  left: Side;
  right: Side;
};

export type ShapeInfo = {
  id: ShapeId;
  name: string;
  plural: string;
  weight: number;
};

export type Step = {
  title: string;
  text: string;
};

export type Puzzle = {
  id: string;
  shapes: ShapeInfo[];
  scales: Scale[];
  question: Side;
  answer: number;
  steps: Step[];
  hints: string[];
  blurb: string;
};

export type Grade = 'first' | 'second' | 'third' | 'fourth' | 'miss';

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

export type GenerateOptions = {
  shapeCount?: number;
  template?: 'pair' | 'isolate';
};
