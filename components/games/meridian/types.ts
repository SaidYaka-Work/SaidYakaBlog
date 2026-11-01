export type Mode = 'daily' | 'practice';

export type Region =
  | 'n-america'
  | 's-america'
  | 'europe'
  | 'africa'
  | 'w-asia'
  | 's-asia'
  | 'se-asia'
  | 'e-asia'
  | 'oceania';

export type LonLat = {
  lat: number;
  lng: number;
};

export type City = {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  region: Region;
  aliases?: readonly string[];
  fact: string;
};

export type CompassPoint =
  | 'N'
  | 'NNE'
  | 'NE'
  | 'ENE'
  | 'E'
  | 'ESE'
  | 'SE'
  | 'SSE'
  | 'S'
  | 'SSW'
  | 'SW'
  | 'WSW'
  | 'W'
  | 'WNW'
  | 'NW'
  | 'NNW';

export type Tone = 'hit' | 'close' | 'near' | 'far';

export type Grade = 'first' | 'second' | 'third' | 'fourth' | 'fifth' | 'sixth' | 'miss';

export type Puzzle = {
  id: string;
  city: City;
};

export type Attempt = {
  city: City;
  km: number;
  bearing: number;
  point: CompassPoint;
  tone: Tone;
};

export type Result = {
  puzzle: Puzzle;
  attempts: Attempt[];
  solved: boolean;
  tries: number;
  points: number;
  stars: number;
  grade: Grade;
};
