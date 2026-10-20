import { englishPath } from '@/lib/site';

export type GameKind = 'react' | 'external';

export type GameTone = 'rush' | 'market' | 'orbit' | 'lantern' | 'pulse' | 'glyph' | 'shade' | 'dog';

export type GameMeta = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  howTo: string;
  genre: string;
  kind: GameKind;
  href: string;
  tone: GameTone;
};

/**
 * Catalog for the games shelf.
 *
 * To add a daily game:
 * 1. Append a `react` entry here (slug, copy, href via englishPath(`/games/<slug>`)).
 * 2. Add `components/games/<slug>/Game.tsx` that renders inside GameShell.
 * 3. Register the lazy import in `components/games/registry.ts`.
 *
 * Gallery, `/en/games/<slug>/` pages, sitemap, and locale aliases all read this list.
 */

export const games: GameMeta[] = [
  {
    slug: 'click-rush',
    title: 'Click Rush',
    tagline: 'Chase the orb before the clock runs out.',
    description: 'A 20-second reflex game: tap the glowing orb as many times as you can.',
    howTo: 'Press start, then tap or click the orb. It jumps after every hit.',
    genre: 'Reflex',
    kind: 'react',
    href: englishPath('/play'),
    tone: 'rush',
  },
  {
    slug: 'night-market',
    title: 'Night Market',
    tagline: 'A standalone stall-scramble from the games shelf.',
    description: 'A standalone mini-game from the games collection.',
    howTo: 'Open the standalone page and follow the on-screen instructions.',
    genre: 'Arcade',
    kind: 'external',
    href: '/games/night-market/index.html',
    tone: 'market',
  },
  {
    slug: 'orbit-fold',
    title: 'Orbit Fold',
    tagline: 'Hop rings, gather sparks, skip the rocks.',
    description: 'An orbital skill game: change altitude to collect sparks and dodge debris.',
    howTo: 'Tap or press Space to hop outward; Arrow Down hops inward. Collect sparks. Rocks end the run. A hop folds you through debris for a blink.',
    genre: 'Skill',
    kind: 'react',
    href: englishPath('/games/orbit-fold'),
    tone: 'orbit',
  },
  {
    slug: 'lantern-circuit',
    title: 'Lantern Circuit',
    tagline: 'Rotate the pipes until the lantern finds the gate.',
    description: 'A pipe-rotation puzzle: connect the lantern to the gate in as few turns as you can.',
    howTo: 'Tap a tile to rotate it, or move with arrows and press Space. Make one continuous copper path from the lantern to the gate.',
    genre: 'Puzzle',
    kind: 'react',
    href: englishPath('/games/lantern-circuit'),
    tone: 'lantern',
  },
  {
    slug: 'pulse-dock',
    title: 'Pulse Dock',
    tagline: 'Drop the craft when the pad slides underneath.',
    description: 'A timing landing game: eight drops, scored by how centered you hit the moving pad.',
    howTo: 'Tap or press Space to drop. Wait until the pad is under the craft. Eight landings per round.',
    genre: 'Timing',
    kind: 'react',
    href: englishPath('/games/pulse-dock'),
    tone: 'pulse',
  },
  {
    slug: 'glyph-thread',
    title: 'Glyph Thread',
    tagline: 'Draw a path through letters and keep the words coming.',
    description: 'A word-path game: trace adjacent letters to form words before time runs out.',
    howTo: 'Drag across neighboring tiles, or tap them in order and release. Type letters to extend a path; Enter submits. Three letters minimum.',
    genre: 'Words',
    kind: 'react',
    href: englishPath('/games/glyph-thread'),
    tone: 'glyph',
  },
  {
    slug: 'shade-shift',
    title: 'Shade Shift',
    tagline: 'Flip a cell and its neighbors until the grid goes dark.',
    description: 'A lights-out inversion puzzle: every tap flips a tile and its four neighbors.',
    howTo: 'Tap a square to invert it and the tiles above, below, left, and right. Arrows move a cursor; Space flips. Darken the whole board.',
    genre: 'Logic',
    kind: 'react',
    href: englishPath('/games/shade-shift'),
    tone: 'shade',
  },
  {
    slug: 'biscuit',
    title: 'Biscuit',
    tagline: 'The internet’s only dog. Pet, feed, walk, grow.',
    description: 'A shared Tamagotchi-style dog that everyone on the site looks after together.',
    howTo: 'Visit the porch. Pet him, feed him, or take him for a walk.',
    genre: 'Companion',
    kind: 'react',
    href: englishPath('/dog'),
    tone: 'dog',
  },
];

export function getListedGames(): GameMeta[] {
  return games;
}

export function getPlayableGames(): GameMeta[] {
  return games.filter((game) => game.kind === 'react' && game.slug !== 'click-rush' && game.slug !== 'biscuit');
}

export function getGameBySlug(slug: string): GameMeta | undefined {
  return games.find((game) => game.slug === slug);
}
