export type Mode = 'daily' | 'practice';

export type Grade = 'first' | 'second' | 'third' | 'fourth' | 'miss';

export type Pattern = 'spoiler' | 'center-squeeze' | 'agree';

export type Candidate = {
  id: string;
  name: string;
};

export type BallotGroup = {
  ranking: readonly string[];
  count: number;
};

export type Round = {
  remaining: readonly string[];
  counts: Readonly<Record<string, number>>;
  total: number;
  majority: number;
  leader: string | null;
  eliminated: string | null;
  winner: string | null;
};

export type LessonStep = {
  title: string;
  text: string;
};

export type Race = {
  id: string;
  title: string;
  setting: string;
  office: string;
  candidates: readonly Candidate[];
};

export type Puzzle = {
  id: string;
  raceId: string;
  title: string;
  setting: string;
  office: string;
  candidates: readonly Candidate[];
  ballots: readonly BallotGroup[];
  voters: number;
  rounds: readonly Round[];
  irvWinner: string;
  pluralityWinner: string;
  condorcetWinner: string | null;
  pattern: Pattern;
  hints: readonly string[];
  blurb: string;
  lesson: readonly LessonStep[];
};

export type Attempt = {
  guess: string;
  hit: boolean;
};

export type Result = {
  puzzle: Puzzle;
  attempts: readonly Attempt[];
  solved: boolean;
  tries: number;
  points: number;
  grade: Grade;
};
