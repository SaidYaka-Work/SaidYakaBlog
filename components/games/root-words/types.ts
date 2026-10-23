export type Family = 'greek' | 'latin' | 'germanic' | 'mixed';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Root = {
  form: string;
  gloss: string;
};

export type Puzzle = {
  id: string;
  word: string;
  prompt: string;
  roots: Root[];
  decoys: string[];
  note: string;
  source: string;
  family: Family;
  difficulty: Difficulty;
};

export type PlayTile = {
  id: string;
  form: string;
  gloss?: string;
  correct: boolean;
  order?: number;
};

export type Grade = 'first' | 'firstHint' | 'second' | 'third' | 'miss';

export type Result = {
  puzzle: Puzzle;
  tries: number;
  hints: number;
  solved: boolean;
  points: number;
  grade: Grade;
};

export type Mode = 'daily' | 'practice';
