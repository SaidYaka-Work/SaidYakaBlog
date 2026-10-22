import { fallbackDailySet } from '../src/fallback.ts';
import { TEXT_MAX_TOKENS_PERSONAS, TEXT_MAX_TOKENS_VERIFY } from '../src/models.ts';
import { buildDayPuzzles } from '../src/puzzles.ts';
import { filterAiRounds } from '../src/validators.ts';
import type { DailySet } from '../src/schema.ts';

export function userText(input: Record<string, unknown>): string {
  const messages = input.messages as Array<{ role?: string; content?: string }> | undefined;
  return messages?.find((row) => row.role === 'user')?.content ?? '';
}

export function harvestTrivia(valid: DailySet, count = 10): DailySet['rounds'] {
  const passing = filterAiRounds(valid.rounds).filter((round) => round.kind === 'typed' || round.kind === 'mc');
  const extra = Array.from({ length: count }, (_, index) => ({
    ...valid.rounds[index % valid.rounds.length],
    id: `ok${index + 1}`,
    kind: 'typed' as const,
    text: `what do honeybees make for us number ${index + 1} now`,
    answer: `honey${index + 1}`,
    aliases: [],
    options: [],
    category: 'animals',
    good: 'ok the model remembered a fact. rare.',
    bad: `that's a hallucination, buddy. it's honey${index + 1}.`,
  }));
  return filterAiRounds([...passing, ...extra]).slice(0, count);
}

export function flavorRoundsFor(date: string) {
  return buildDayPuzzles(date).map((puzzle) => ({
    id: puzzle.id,
    text: `${puzzle.prompt} please go`,
    persona: 'Dana',
    vibe: 'late but funny',
    good: 'ok the model remembered a fact. rare.',
    bad: `that's a hallucination, buddy. it's ${puzzle.answer}.`,
    nudges: ['hello??'],
  }));
}

export function isFlavorInput(input: Record<string, unknown>): boolean {
  return /flavor batch|Rewrite exactly|id=pz-/i.test(userText(input));
}

export function isTriviaInput(input: Record<string, unknown>): boolean {
  return /trivia batch/i.test(userText(input));
}

export function aiThatReturns(valid: ReturnType<typeof fallbackDailySet>, date = valid.date) {
  const flavors = flavorRoundsFor(date);
  const trivia = harvestTrivia(valid);
  return {
    async run(_name: string, input: Record<string, unknown>) {
      const max = Number(input.max_tokens);
      if (max === TEXT_MAX_TOKENS_PERSONAS) return { response: { personas: valid.personas } };
      if (max === TEXT_MAX_TOKENS_VERIFY) {
        const keep = trivia.map((row) => row.id);
        return { response: { keep, drop: [] } };
      }
      if (isFlavorInput(input)) return { response: { rounds: flavors } };
      const hit = userText(input).match(/trivia batch (\d+)/i);
      const batch = hit ? Number(hit[1]) - 1 : 0;
      return { response: { rounds: trivia.slice(batch * 5, batch * 5 + 5) } };
    },
  };
}
