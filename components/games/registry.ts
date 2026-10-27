import type { ComponentType } from 'react';

export type GameLoader = () => Promise<{ default: ComponentType }>;

/** Lazy imports for catalog games that render at `/en/games/<slug>/`. */
export const reactGameLoaders: Record<string, GameLoader> = {
  'unknown-number': () => import('./unknown-number/Game'),
  'orbit-fold': () => import('./orbit-fold/Game'),
  'lantern-circuit': () => import('./lantern-circuit/Game'),
  'pulse-dock': () => import('./pulse-dock/Game'),
  'glyph-thread': () => import('./glyph-thread/Game'),
  'shade-shift': () => import('./shade-shift/Game'),
  'fold-herd': () => import('./fold-herd/Game'),
  magnitude: () => import('./magnitude/Game'),
  'root-words': () => import('./root-words/Game'),
  chronology: () => import('./chronology/Game'),
  plaintext: () => import('./plaintext/Game'),
  alibi: () => import('./alibi/Game'),
  sequence: () => import('./sequence/Game'),
};
