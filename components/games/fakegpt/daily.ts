import { dateSeed, utcDate, type DailySet, type DailyRound } from '../../../workers/fakegpt/src/schema';
import { BANK } from './bank';
import { dailyNudges, JOIN_VIBES, LATE_LINES, pickChatter, PRAISE, ROASTS } from './bank/chatter';
import { pickDailyQuestions } from './bank/select';
import { DAILY_ROUND_COUNT } from './bank/types';
import { PERSONA_BANK, fillPersonas } from './lanes';
import { mulberry32, shuffle } from './logic';

export function buildDailySet(date = utcDate()): DailySet {
  const seed = dateSeed(date);
  const random = mulberry32(seed);
  const questions = pickDailyQuestions(BANK, date);
  const personas = fillPersonas(PERSONA_BANK, seed);
  const vibes = shuffle(JOIN_VIBES, random);
  const rounds: DailyRound[] = questions.map((item, index) => {
    const persona = personas[index % personas.length] ?? personas[0];
    const name = persona.name;
    return {
      id: item.id,
      kind: item.kind,
      text: item.text,
      persona: name,
      vibe: vibes[index % vibes.length] ?? persona.vibe,
      category: item.category,
      difficulty: item.difficulty,
      answer: item.answer,
      aliases: [],
      options: shuffle(item.options, mulberry32(seed + index * 17)),
      nudges: dailyNudges(seed + index * 31, name),
      good: pickChatter(PRAISE, seed + index * 41, name),
      bad: pickChatter(index % 5 === 0 ? LATE_LINES : ROASTS, seed + index * 43, name),
    };
  });
  return {
    date,
    source: 'fallback',
    personas,
    rounds: rounds.slice(0, DAILY_ROUND_COUNT),
  };
}
