import { asTriviaItems, localJobPool } from '../../../components/games/fakegpt/jobs';
import { PERSONA_BANK, fillPersonas } from '../../../components/games/fakegpt/lanes';
import { mulberry32, pickJobs } from '../../../components/games/fakegpt/logic';
import { DAILY_ROUNDS } from './models';
import { dateSeed, parseDailyPersona, parseDailyRound, validateDailySet, type DailyPersona, type DailyRound, type DailySet } from './schema';

export function fallbackDailySet(date: string): DailySet {
  return fillDailySet(date, [], 'fallback');
}

/** Every round, including bank fills, belongs to one of today's personas. */
export function assignDayPersonas(rounds: DailyRound[], personas: DailyPersona[]): DailyRound[] {
  if (!personas.length) return rounds;
  return rounds.map((round, index) => {
    const persona = personas[index % personas.length];
    return { ...round, persona: persona.name, vibe: persona.vibe || round.vibe };
  });
}

/** Keep valid AI rounds and personas, cap bonus at one, fill remaining slots from the local bank. */
export function fillDailySet(
  date: string,
  incoming: DailyRound[],
  source: DailySet['source'] = 'ai',
  incomingPersonas: DailyPersona[] = [],
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

  const personas = fillPersonas(
    [
      ...incomingPersonas.map(parseDailyPersona).filter((row): row is DailyPersona => Boolean(row)),
      ...kept.map((row) => ({ id: '', name: row.persona, vibe: row.vibe })),
      ...PERSONA_BANK,
    ],
    dateSeed(date),
  );
  const assigned = assignDayPersonas(kept, personas);

  const assembled = validateDailySet({ rounds: assigned, personas, source }, date);
  if (assembled) return assembled;
  const pureLocal = pickJobs(
    asTriviaItems(localJobPool()),
    DAILY_ROUNDS,
    mulberry32(dateSeed(`${date}-local`)),
    dateSeed(date),
  );
  const localPersonas = fillPersonas(PERSONA_BANK, dateSeed(`${date}-local`));
  const fallback = validateDailySet(
    { rounds: assignDayPersonas(pureLocal, localPersonas), personas: localPersonas, source: 'fallback' },
    date,
  );
  if (!fallback) throw new Error('local job bank failed validation');
  return fallback;
}
