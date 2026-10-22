import { asTriviaItems, localJobPool } from '../../../components/games/fakegpt/jobs';
import { fillPersonas, type DailyPersona } from '../../../components/games/fakegpt/lanes';
import { mulberry32, pickJobs } from '../../../components/games/fakegpt/logic';
import { DAILY_ROUNDS } from './models';
import { dateSeed, parseDailyPersona, parseDailyRound, validateDailySet, type DailyRound, type DailySet } from './schema';
import { sanitizeReplies } from './validators';

export const DAY_PERSONA_FALLBACK: DailyPersona[] = [
  { id: 'dana', name: 'Dana', vibe: 'calm until the spinner spins' },
  { id: 'lily', name: 'Lily', vibe: 'already late' },
  { id: 'jamie', name: 'Jamie', vibe: 'three tabs of panic' },
  { id: 'ethan', name: 'Ethan', vibe: 'mute button philosopher' },
  { id: 'ava', name: 'Ava', vibe: 'inbox on fire' },
  { id: 'noah', name: 'Noah', vibe: 'caps lock of feelings' },
  { id: 'mia', name: 'Mia', vibe: 'one more meeting' },
  { id: 'owen', name: 'Owen', vibe: 'coffee then consequences' },
];

const COSTUME_PERSONA =
  /uncle modem|last cookie|sentient stapler|\bthe microwave\b|roomba|fax from 1997|kira the intern|tired sysadmin/i;

export function isCostumePersonaName(name: string): boolean {
  return COSTUME_PERSONA.test(name);
}

export function dayPersonas(date: string, incoming: DailyPersona[] = []): DailyPersona[] {
  const humans = incoming.filter((row) => row.name && !isCostumePersonaName(row.name));
  return fillPersonas([...humans, ...DAY_PERSONA_FALLBACK], dateSeed(date));
}

export function fallbackDailySet(date: string): DailySet {
  return fillDailySet(date, [], 'fallback');
}

/** Every round, including bank fills, belongs to one of today's personas. */
export function assignDayPersonas(rounds: DailyRound[], personas: DailyPersona[]): DailyRound[] {
  if (!personas.length) return rounds;
  return rounds.map((round, index) => {
    const persona = personas[index % personas.length];
    return sanitizeReplies(
      { ...round, persona: persona.name, vibe: persona.vibe || round.vibe },
      personas,
    );
  });
}

/** Keep valid AI rounds and personas, cap bonus at one, fill remaining slots from the local bank. */
export function fillDailySet(
  date: string,
  incoming: DailyRound[],
  source: DailySet['source'] = 'ai',
  incomingPersonas: DailyPersona[] = [],
  aiCountOverride?: number,
): DailySet {
  const random = mulberry32(dateSeed(date));
  const kept: DailyRound[] = [];
  const usedAnswers = new Set<string>();
  const usedIds = new Set<string>();
  let bonus = 0;

  for (const row of incoming) {
    const parsed = parseDailyRound(row);
    if (!parsed) continue;
    if (usedIds.has(parsed.id)) continue;
    const isBonus = parsed.kind === 'draw' || parsed.kind === 'sound';
    if (isBonus) {
      if (bonus >= 1) continue;
      bonus += 1;
    } else if (usedAnswers.has(parsed.answer.toLowerCase())) {
      continue;
    }
    usedIds.add(parsed.id);
    if (!isBonus) usedAnswers.add(parsed.answer.toLowerCase());
    kept.push(parsed);
  }

  const incomingKept = kept.length;

  if (kept.length < DAILY_ROUNDS) {
    const local = pickJobs(asTriviaItems(localJobPool()), DAILY_ROUNDS, random, dateSeed(date));
    for (const row of local) {
      if (kept.length >= DAILY_ROUNDS) break;
      if (usedIds.has(row.id)) continue;
      const isBonus = row.kind === 'draw' || row.kind === 'sound';
      if (isBonus && bonus >= 1) continue;
      if (!isBonus && usedAnswers.has(row.answer.toLowerCase())) continue;
      usedIds.add(row.id);
      if (isBonus) bonus += 1;
      else usedAnswers.add(row.answer.toLowerCase());
      kept.push({ ...row, id: row.id });
    }
  }

  const personas = dayPersonas(date, [
    ...incomingPersonas.map(parseDailyPersona).filter((row): row is DailyPersona => Boolean(row)),
    ...kept.map((row) => ({ id: '', name: row.persona, vibe: row.vibe })),
  ]);
  const assigned = assignDayPersonas(kept, personas);
  const counted = typeof aiCountOverride === 'number' ? aiCountOverride : incomingKept;
  const aiCount = Math.max(0, Math.min(assigned.length, Math.round(counted)));

  const assembled = validateDailySet({ rounds: assigned, personas, source, aiCount }, date);
  if (assembled) return assembled;
  const pureLocal = pickJobs(
    asTriviaItems(localJobPool()),
    DAILY_ROUNDS,
    mulberry32(dateSeed(`${date}-local`)),
    dateSeed(date),
  );
  const localPersonas = dayPersonas(`${date}-local`);
  const fallback = validateDailySet(
    { rounds: assignDayPersonas(pureLocal, localPersonas), personas: localPersonas, source: 'fallback', aiCount: 0 },
    date,
  );
  if (!fallback) throw new Error('local job bank failed validation');
  return fallback;
}
