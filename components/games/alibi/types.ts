export type Mode = 'daily' | 'practice';

export type Cat = 'people' | 'rooms' | 'times';

export type Ref = {
  cat: Cat;
  i: number;
};

export type Person = {
  name: string;
  role: string;
};

export type Room = {
  name: string;
  short: string;
};

export type TimeSlot = {
  name: string;
  short: string;
};

export type World = {
  id: string;
  place: string;
  hook: string;
  item: string;
  closing: string;
  people: Person[];
  rooms: Room[];
  times: TimeSlot[];
};

export type Assignment = {
  personRoom: number[];
  personTime: number[];
};

export type ClueKind = 'pair' | 'notPair' | 'before' | 'either' | 'between' | 'offset';

export type Clue = {
  id: string;
  text: string;
  kind: ClueKind;
  left?: Ref;
  right?: Ref;
  earlier?: Ref;
  later?: Ref;
  immediate?: boolean;
  subject?: Ref;
  optionA?: Ref;
  optionB?: Ref;
  mid?: Ref;
  endA?: Ref;
  endB?: Ref;
  hours?: number;
};

export type Puzzle = {
  mode: Mode;
  size: number;
  categories: 2 | 3;
  world: World;
  solution: Assignment;
  clues: Clue[];
  culprit: number;
  generated: 'search' | 'fallback';
};

export type Mark = 'empty' | 'no' | 'yes';

export type SubgridId = 'personRoom' | 'personTime' | 'roomTime';

export type Grid = {
  personRoom: Mark[][];
  personTime: Mark[][];
  roomTime: Mark[][];
};

export type CellPos = {
  grid: SubgridId;
  row: number;
  col: number;
};

export type Grade = 'swift' | 'steady' | 'patient' | 'checked' | 'guided';

export type Result = {
  seconds: number;
  checks: number;
  mistakes: number;
  points: number;
  grade: Grade;
  culprit: Person;
  room: Room;
  time: TimeSlot | null;
  world: World;
  solution: Assignment;
};
