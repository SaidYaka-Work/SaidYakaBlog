export type Era = 'ancient' | 'classical' | 'medieval' | 'early-modern' | 'modern' | 'contemporary';

export type Region = 'africa' | 'americas' | 'asia' | 'europe' | 'oceania' | 'near-east' | 'global';

export type HistoricalEvent = {
  id: string;
  title: string;
  year: number;
  era: Era;
  region: Region;
  note: string;
  source: string;
};

export type Grade = 'first' | 'second' | 'third' | 'fourth' | 'miss';

export type Attempt = {
  placed: boolean[];
};

export type Result = {
  events: HistoricalEvent[];
  attempts: Attempt[];
  solved: boolean;
  tries: number;
  points: number;
  grade: Grade;
};

export type Mode = 'daily' | 'practice';
