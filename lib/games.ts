import { englishPath } from '@/lib/site';

export type GameKind = 'react' | 'external';

export type GameTone =
  | 'rush'
  | 'market'
  | 'orbit'
  | 'lantern'
  | 'pulse'
  | 'glyph'
  | 'shade'
  | 'herd'
  | 'unknown'
  | 'gpt'
  | 'magnitude'
  | 'roots'
  | 'chrono'
  | 'plain'
  | 'alibi';

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
  daily?: boolean;
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
    slug: 'fakegpt',
    title: 'FakeGPT',
    tagline: 'You are the chatbot. Answer before the user rage-quits.',
    description:
      'You are the AI, secretly tapping the right answer. Juggle customers on tabs as they join, each with a queue and a patience meter. Every job is multiple choice from a huge on-device bank. No server.',
    howTo:
      'Play the daily shift. Level 1 starts with one or two customers; more join as levels get harder, each on their own tab. Every request is four options. Serve or survive the clock to level up. Arrow keys, [ ], or Ctrl/Alt+1–5 switch tabs. 1–4 tap answers.',
    genre: 'Daily',
    kind: 'react',
    href: englishPath('/fakegpt'),
    tone: 'gpt',
    daily: true,
  },
  {
    slug: 'unknown-number',
    title: 'Unknown Number',
    tagline: 'A mystery figure texts you. Name them before the sixth bubble.',
    description:
      'A daily chat puzzle: an unknown historical figure texts six clues, vague then specific. Guess who is writing before the thread goes quiet.',
    howTo: 'Six incoming texts from a mystery figure, a shrinking globe, and sixteen suspects. Name them before the thread goes quiet. After you finish, a Meet card tells you who they were.',
    genre: 'Daily',
    kind: 'react',
    href: englishPath('/games/unknown-number'),
    tone: 'unknown',
    daily: true,
  },
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
    slug: 'fold-herd',
    title: 'Fold Herd',
    tagline: 'Ease the flock through the gate before the fold closes.',
    description: 'A herding game: steer a sheepdog and fold a wandering flock into the pen, field by field.',
    howTo: 'Steer the dog with WASD, arrows, or a drag. Sheep fold away from you — ease them through the gate before time runs out. Space whistles strays back.',
    genre: 'Herding',
    kind: 'react',
    href: englishPath('/games/fold-herd'),
    tone: 'herd',
  },
  {
    slug: 'magnitude',
    title: 'Magnitude',
    tagline: 'Five Fermi guesses a day. How many orders of magnitude off are you?',
    description:
      'A daily estimation puzzle: five concrete facts, a logarithmic slider, and a score for how many powers of ten you miss by. Each answer comes with a short explanation and a source.',
    howTo:
      'Drag the log slider, type a number, or use the arrow keys. Lock in to see the true value, how many powers of ten you missed, and a short source note. Five questions a day.',
    genre: 'Estimation',
    kind: 'react',
    href: englishPath('/games/magnitude'),
    tone: 'magnitude',
    daily: true,
  },
  {
    slug: 'root-words',
    title: 'Root Words',
    tagline: 'Six literal roots a day. Build the English word they became.',
    description:
      'A daily etymology puzzle: each round shows the literal sense of a word’s roots — “bad + star,” “far + sound” — and a tray of Greek, Latin, and Old English tiles. Assemble the word, then read the real derivation.',
    howTo:
      'Tap root tiles to match the literal sense, or use 1–9 and Enter. Three tries; a hint labels one true root. Six words a day, each with a short etymology note.',
    genre: 'Etymology',
    kind: 'react',
    href: englishPath('/games/root-words'),
    tone: 'roots',
    daily: true,
  },
  {
    slug: 'chronology',
    title: 'Chronology',
    tagline: 'Six events a day. Put history back in order.',
    description:
      'A daily timeline puzzle: six historical events, inventions, or discoveries, and a few tries to drag them into chronological order. Locked cards stay put; a short note teaches the year when you finish.',
    howTo:
      'Drag the cards from oldest to newest, or select one and move it with the arrows. Lock in to freeze cards that sit in the right place. Four tries; the years and a one-sentence note wait at the end.',
    genre: 'History',
    kind: 'react',
    href: englishPath('/games/chronology'),
    tone: 'chrono',
    daily: true,
  },
  {
    slug: 'plaintext',
    title: 'Plaintext',
    tagline: 'A famous quotation, letter by letter. Same cipher for everyone, every day.',
    description:
      'A daily cryptogram: a public-domain quotation encrypted with a simple letter-substitution cipher. Assign plaintext letters, use frequency counts, and decode the line to meet the author.',
    howTo:
      'Tap a cipher letter, then choose its match on the keyboard — or type it. Frequency counts sit under the alphabet. The same letter used twice is flagged. A reveal costs score. Decode the whole line to read who said it, and why it lasted.',
    genre: 'Cryptogram',
    kind: 'react',
    href: englishPath('/games/plaintext'),
    tone: 'plain',
    daily: true,
  },
  {
    slug: 'alibi',
    title: 'Alibi',
    tagline: 'Four suspects, one grid. A daily case with a single solution.',
    description:
      'A daily logic-grid mystery: match each guest to a room and an hour from a handful of written clues. Mark the grid, tick off what you have used, and name who took it.',
    howTo:
      'Tap a cell to cycle empty, ×, and ✓ — a check crosses out the rest of its row and column. Arrows move; X marks a no, C or Space a yes. Tick clues as you use them. Check my grid costs score. When the marks name the only arrangement, the case closes.',
    genre: 'Deduction',
    kind: 'react',
    href: englishPath('/games/alibi'),
    tone: 'alibi',
    daily: true,
  },
];

export function getListedGames(): GameMeta[] {
  return games;
}

export function getPlayableGames(): GameMeta[] {
  return games.filter((game) => game.kind === 'react' && game.href === englishPath(`/games/${game.slug}`));
}

export function getGameBySlug(slug: string): GameMeta | undefined {
  return games.find((game) => game.slug === slug);
}
