export type Mode = 'daily' | 'practice';

export type Category = 'artifact' | 'invention' | 'landmark' | 'animal' | 'symbol' | 'nature';

export type PictureSpec = {
  id: string;
  name: string;
  category: Category;
  size: 10 | 12 | 15;
  /** `#` filled, `.` empty. Each string is one row; length equals `size`. */
  rows: readonly string[];
  blurb: string;
  source: string;
};

export type Cell = 'empty' | 'fill' | 'mark';

export type Grid = Cell[][];

export type CellPos = {
  row: number;
  col: number;
};

export type Grade = 'swift' | 'steady' | 'patient' | 'checked' | 'guided';

export type Puzzle = {
  id: string;
  name: string;
  category: Category;
  size: number;
  picture: boolean[][];
  rowClues: number[][];
  colClues: number[][];
  blurb: string;
  source: string;
};

export type Result = {
  puzzle: Puzzle;
  seconds: number;
  checks: number;
  mistakes: number;
  points: number;
  grade: Grade;
};
