import { ARTS } from './data/arts';
import { BIRTHPLACES } from './data/birthplaces';
import { EXPLORATION } from './data/exploration';
import { PUBLIC_LIFE } from './data/public-life';
import { SCIENCE } from './data/science';
import { SPORT } from './data/sport';
import { TODAY } from './data/today';
import { PORTRAITS } from './portraits';
import type { Figure } from './types';

export const FIGURES: Figure[] = [...SCIENCE, ...ARTS, ...PUBLIC_LIFE, ...SPORT, ...EXPLORATION].map((figure) => {
  const extra = TODAY[figure.id];
  const story = extra
    ? ([figure.story[0], figure.story[1], `${figure.story[2]} ${extra}`] as Figure['story'])
    : figure.story;
  const birthplace = BIRTHPLACES[figure.id];
  if (!birthplace) {
    throw new Error(`Missing birthplace for ${figure.id}`);
  }
  return { ...figure, story, portrait: PORTRAITS[figure.id] ?? null, birthplace };
});
