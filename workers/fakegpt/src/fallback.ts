import { PROMPTS } from '../../../components/games/fakegpt/prompts';
import { mulberry32, pickPrompts } from '../../../components/games/fakegpt/logic';
import { DAILY_ROUNDS } from './models';
import { dateSeed, type DailyRound, type DailySet } from './schema';

const PERSONAS = [
  'Kira the intern',
  'Uncle Modem',
  'a sentient stapler',
  'the microwave',
  'Roomba 4',
  'a tired sysadmin',
  'Fax from 1997',
  'the last cookie',
];

const NUDGE_A = ['hello??', 'any day now', 'did you crash?'];
const NUDGE_B = ['are you still generating?', 'my context window is bored', 'hello from the void'];
const GOOD = [
  'ok wait. this slaps. screenshotting the void.',
  'unexpectedly moving. gold star, plastic trophy.',
  'the board of imaginary users voted yes.',
];
const BAD = [
  'i requested wonder and received a shrug.',
  'this is the loading state of art.',
  'my houseplant looked away.',
];

export function fallbackDailySet(date: string): DailySet {
  const random = mulberry32(dateSeed(date));
  const picked = pickPrompts(PROMPTS, DAILY_ROUNDS, random);
  const rounds: DailyRound[] = picked.map((prompt, index) => ({
    id: `${date}-${prompt.id}`,
    kind: prompt.kind,
    text: prompt.text,
    persona: PERSONAS[Math.floor(random() * PERSONAS.length)] ?? PERSONAS[0],
    nudges: index % 2 === 0 ? NUDGE_A : NUDGE_B,
    good: GOOD[index % GOOD.length],
    bad: BAD[index % BAD.length],
  }));
  return { date, source: 'fallback', rounds };
}
