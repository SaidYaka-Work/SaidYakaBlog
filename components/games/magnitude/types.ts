export type Category = 'science' | 'geography' | 'history' | 'body' | 'space' | 'everyday';

export type Scale = 'log' | 'year';

export type Grade = 'spot' | 'close' | 'near' | 'order' | 'far' | 'miss';

export type Question = {
  id: string;
  category: Category;
  prompt: string;
  answer: number;
  unit: string;
  scale: Scale;
  min: number;
  max: number;
  explanation: string;
  source: string;
};

export type Result = {
  question: Question;
  guess: number;
  error: number;
  points: number;
  grade: Grade;
};

export type Mode = 'daily' | 'practice';
