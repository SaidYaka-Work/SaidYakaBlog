export type Field = 'literature' | 'philosophy' | 'politics' | 'science' | 'poetry' | 'faith';

export type Quote = {
  id: string;
  text: string;
  author: string;
  years: string;
  work: string;
  field: Field;
  bio: string;
  why: string;
  source: string;
};

export type Puzzle = {
  quote: Quote;
  encodeMap: Record<string, string>;
  decodeMap: Record<string, string>;
  encoded: string;
};

export type Grade = 'swift' | 'steady' | 'patient' | 'hinted' | 'guided';

export type Result = {
  quote: Quote;
  seconds: number;
  hints: number;
  points: number;
  grade: Grade;
};

export type Mode = 'daily' | 'practice';

export type Cell =
  | { kind: 'letter'; cipher: string }
  | { kind: 'mark'; value: string };

export type Word = {
  cells: Cell[];
};
