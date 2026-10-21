import { localTriviaPool, mulberry32, pickPrompts } from '../../../components/games/fakegpt/logic';
import { DAILY_ROUNDS } from './models';
import { dateSeed, parseDailyRound, validateDailySet, type DailyRound, type DailySet } from './schema';

export function fallbackDailySet(date: string): DailySet {
  return fillDailySet(date, [], 'fallback');
}

/** Keep valid AI rounds, cap bonus at one, fill remaining slots from the local bank. */
export function fillDailySet(date: string, incoming: DailyRound[], source: DailySet['source'] = 'ai'): DailySet {
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
    const local = pickPrompts(localTriviaPool(), DAILY_ROUNDS, random, dateSeed(date));
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

  const assembled = validateDailySet({ rounds: kept, source }, date);
  if (assembled) return assembled;
  const pureLocal = pickPrompts(localTriviaPool(), DAILY_ROUNDS, mulberry32(dateSeed(`${date}-local`)), dateSeed(date));
  const fallback = validateDailySet({ rounds: pureLocal, source: 'fallback' }, date);
  if (!fallback) throw new Error('local trivia bank failed validation');
  return fallback;
}
