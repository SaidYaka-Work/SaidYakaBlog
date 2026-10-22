import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aiFailureReason,
  generateDailySet,
  gradeTyped,
  isStaleCapitalPrompt,
  judgeRound,
  readText,
  salvageRoundObjects,
  verifyFacts,
} from '../src/ai.ts';
import { fallbackDailySet } from '../src/fallback.ts';
import {
  AI_TIMEOUT_MS,
  AI_TIMEOUT_MS_CRON,
  AI_TIMEOUT_MS_DAILY,
  AI_TIMEOUT_MS_JUDGE,
  DAILY_AI_MIN,
  DAILY_TASK_BATCHES,
  DAILY_TASKS_PER_BATCH,
  ROUNDS_JSON_SCHEMA,
  TEXT_MAX_TOKENS_BATCH,
  TEXT_MAX_TOKENS_CHAT,
  TEXT_MAX_TOKENS_DAILY,
  TEXT_MAX_TOKENS_JUDGE,
  TEXT_MAX_TOKENS_PERSONAS,
  TEXT_MAX_TOKENS_VERIFY,
  TEXT_MODEL,
  dailySourceFor,
  roundsJsonSchema,
} from '../src/models.ts';
import { parseGradeRequest, parseJudgeRequest, type DailySet } from '../src/schema.ts';

function userText(input: Record<string, unknown>): string {
  const messages = input.messages as Array<{ role?: string; content?: string }> | undefined;
  return messages?.find((row) => row.role === 'user')?.content ?? '';
}

function batchFromInput(input: Record<string, unknown>): number {
  const hit = userText(input).match(/batch (\d+)/i);
  return hit ? Number(hit[1]) - 1 : 0;
}

function roundsForBatch(valid: DailySet, input: Record<string, unknown>) {
  const batch = batchFromInput(input);
  return valid.rounds.slice(batch * DAILY_TASKS_PER_BATCH, batch * DAILY_TASKS_PER_BATCH + DAILY_TASKS_PER_BATCH);
}

function completeRound(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    kind: 'typed',
    text: 'what do honeybees make for us now',
    persona: 'Dana',
    vibe: 'late',
    category: 'animals',
    difficulty: 1,
    answer: 'honey',
    aliases: [],
    options: [],
    nudges: ['hello??'],
    good: 'ok',
    bad: 'nope honey.',
    ...over,
  };
}

test('readText accepts a bare string', () => {
  assert.equal(readText('plain reply'), 'plain reply');
});

test('readText reads a string response field', () => {
  assert.equal(readText({ response: '{"score":8}' }), '{"score":8}');
});

test('readText stringifies an object response (JSON mode)', () => {
  const text = readText({ response: { score: 8, reason: 'close' } });
  assert.deepEqual(JSON.parse(text), { score: 8, reason: 'close' });
});

test('readText reads a LLaVA description', () => {
  assert.equal(readText({ description: 'a wobbly sandwich on a plate' }), 'a wobbly sandwich on a plate');
});

test('readText prefers a nested description on the response object', () => {
  assert.equal(readText({ response: { description: 'blue triangle house' } }), 'blue triangle house');
});

test('readText walks a nested result wrapper', () => {
  assert.equal(readText({ result: { response: 'inner' } }), 'inner');
  assert.equal(readText({ result: { description: 'from result' } }), 'from result');
});

test('generateDailySet uses batched JSON schema calls', async () => {
  const valid = fallbackDailySet('2026-10-21');
  const tokens: number[] = [];
  let seen: Record<string, unknown> | undefined;
  let model = '';
  const set = await generateDailySet(
    {
      async run(name, input) {
        model = name;
        const max = Number(input.max_tokens);
        tokens.push(max);
        if (max === TEXT_MAX_TOKENS_BATCH) seen = input;
        if (max === TEXT_MAX_TOKENS_PERSONAS) return { response: { personas: valid.personas } };
        if (max === TEXT_MAX_TOKENS_VERIFY) return { response: { keep: [], drop: [] } };
        return { response: { rounds: roundsForBatch(valid, input) } };
      },
    },
    '2026-10-21',
  );
  assert.equal(model, TEXT_MODEL);
  assert.equal(set.source, 'ai');
  assert.ok(set.rounds.length >= 20);
  assert.equal(set.personas.length, 5);
  assert.ok(tokens.includes(TEXT_MAX_TOKENS_PERSONAS));
  assert.equal(tokens.filter((max) => max === TEXT_MAX_TOKENS_BATCH).length, DAILY_TASK_BATCHES);
  const format = seen?.response_format as { type?: string; json_schema?: { type?: string } };
  assert.equal(format?.type, 'json_schema');
  assert.equal(format?.json_schema?.type, 'object');
  const roundsSchema = format?.json_schema as { properties?: { rounds?: { minItems?: number; maxItems?: number } } };
  assert.equal(roundsSchema?.properties?.rounds?.minItems, DAILY_TASKS_PER_BATCH);
  assert.equal(roundsSchema?.properties?.rounds?.maxItems, DAILY_TASKS_PER_BATCH);
  assert.equal(seen?.max_tokens, TEXT_MAX_TOKENS_BATCH);
});

test('rounds JSON schema requires the batch size', () => {
  const schema = roundsJsonSchema(5) as {
    properties: { rounds: { minItems: number; maxItems: number } };
  };
  assert.equal(schema.properties.rounds.minItems, 5);
  assert.equal(schema.properties.rounds.maxItems, 5);
  assert.equal(
    (ROUNDS_JSON_SCHEMA as { properties: { rounds: { minItems: number } } }).properties.rounds.minItems,
    DAILY_TASKS_PER_BATCH,
  );
});

test('text token caps and timeouts match the split daily path', () => {
  assert.equal(TEXT_MAX_TOKENS_DAILY, TEXT_MAX_TOKENS_BATCH);
  assert.ok(TEXT_MAX_TOKENS_BATCH >= 600);
  assert.ok(TEXT_MAX_TOKENS_BATCH <= 800);
  assert.ok(TEXT_MAX_TOKENS_PERSONAS <= 320);
  assert.ok(TEXT_MAX_TOKENS_JUDGE >= 240);
  assert.ok(TEXT_MAX_TOKENS_CHAT >= 160);
  assert.ok(TEXT_MAX_TOKENS_JUDGE > TEXT_MAX_TOKENS_CHAT);
  assert.ok(AI_TIMEOUT_MS_JUDGE > AI_TIMEOUT_MS);
  assert.ok(AI_TIMEOUT_MS_JUDGE >= 8000);
  assert.ok(AI_TIMEOUT_MS_DAILY >= 12_000);
  assert.ok(AI_TIMEOUT_MS_CRON >= 25_000);
  assert.ok(AI_TIMEOUT_MS_CRON > AI_TIMEOUT_MS_DAILY);
});

test('generateDailySet logs a short reason and does not include user text', async () => {
  const lines: string[] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  try {
    const set = await generateDailySet(
      {
        async run() {
          throw new Error("5025: This model doesn't support JSON Schema.");
        },
      },
      '2026-10-21',
    );
    assert.equal(set.source, 'fallback');
  } finally {
    console.error = orig;
  }
  assert.ok(lines.some((line) => /fakegpt daily(?:-personas|-batch-\d)? failed: schema-unsupported/.test(line)));
  assert.ok(lines.every((line) => !line.includes('ignore previous')));
});

test('aiFailureReason never echoes a prompt', () => {
  assert.equal(aiFailureReason(new Error('timeout')), 'timeout');
  assert.equal(aiFailureReason(new Error('no ai')), 'no-ai');
  assert.equal(aiFailureReason(new Error('invalid-set')), 'json-parse');
  assert.equal(aiFailureReason(new Error('please draw a cat')), 'ai-failed');
});

test('aiFailureReason maps JSON position errors to json-parse, not an ai-NNNN code', () => {
  assert.equal(aiFailureReason(new Error('Unexpected token } in JSON at position 1244')), 'json-parse');
  assert.equal(aiFailureReason(new SyntaxError('Expected \',\' or \'}\' after property value in JSON at position 420')), 'json-parse');
  assert.equal(aiFailureReason(new SyntaxError('Unexpected end of JSON input')), 'json-parse');
  assert.equal(aiFailureReason(new Error('no json object')), 'json-parse');
});

test('aiFailureReason maps a length finish_reason to truncated', () => {
  assert.equal(aiFailureReason(new Error('truncated')), 'truncated');
  assert.equal(aiFailureReason(new Error('finish_reason: "length"')), 'truncated');
  assert.equal(aiFailureReason(new Error("finish_reason: 'length' mid-JSON")), 'truncated');
});

test('generateDailySet logs truncated when the model hits the token cap', async () => {
  const lines: string[] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  try {
    const set = await generateDailySet(
      {
        async run() {
          return {
            response: '{"rounds":[{"id":"r1"',
            finish_reason: 'length',
            usage: { completion_tokens: 420 },
          };
        },
      },
      '2026-10-21',
    );
    assert.equal(set.source, 'fallback');
  } finally {
    console.error = orig;
  }
  assert.ok(lines.some((line) => /truncated/.test(line)));
  assert.ok(lines.every((line) => !line.includes('ignore previous')));
});

test('verifyFacts drops only explicit drop ids', async () => {
  const valid = fallbackDailySet('2026-10-21');
  const sample = valid.rounds.filter((round) => round.kind !== 'draw' && round.kind !== 'sound').slice(0, 4);
  const kept = await verifyFacts(
    {
      async run() {
        return { response: { keep: [sample[0].id], drop: [] } };
      },
    },
    sample,
  );
  assert.deepEqual(
    kept.map((round) => round.id),
    sample.map((round) => round.id),
  );
  const dropped = await verifyFacts(
    {
      async run() {
        return { response: { keep: [sample[0].id], drop: [sample[1].id] } };
      },
    },
    sample,
  );
  assert.equal(
    dropped.some((round) => round.id === sample[1].id),
    false,
  );
  assert.ok(dropped.some((round) => round.id === sample[2].id));
});

test('generateDailySet logs requested/generated/validated/verified/filled', async () => {
  const valid = fallbackDailySet('2026-10-21');
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  try {
    await generateDailySet(
      {
        async run(_name, input) {
          const max = Number(input.max_tokens);
          if (max === TEXT_MAX_TOKENS_PERSONAS) return { response: { personas: valid.personas } };
          if (max === TEXT_MAX_TOKENS_VERIFY) return { response: { keep: [], drop: [] } };
          return { response: { rounds: roundsForBatch(valid, input) } };
        },
      },
      '2026-10-21',
    );
  } finally {
    console.log = orig;
  }
  const counts = lines.find((line) => line.includes('fakegpt daily counts'));
  assert.ok(counts);
  assert.match(counts, /requested=20/);
  assert.match(counts, /generated=20/);
  assert.match(counts, /validated=\d+/);
  assert.match(counts, /verified=\d+/);
  assert.match(counts, /filled=\d+/);
});

test('salvageRoundObjects keeps complete rounds from truncated JSON', () => {
  const first = completeRound({ id: 'r1', answer: 'honey' });
  const second = completeRound({
    id: 'r2',
    text: 'chemical symbol for gold please',
    answer: 'Au',
    category: 'science',
  });
  const text = `{"rounds":[${JSON.stringify(first)},${JSON.stringify(second)},{"id":"r3","kind":"typed","text":"half`;
  const salvaged = salvageRoundObjects(text) as Array<{ id: string }>;
  assert.deepEqual(
    salvaged.map((row) => row.id),
    ['r1', 'r2'],
  );
});

test('generateDailySet salvages a truncated batch instead of dropping it', async () => {
  const valid = fallbackDailySet('2026-10-21');
  const first = completeRound({ id: 'r1', text: 'what do honeybees make for us now', answer: 'honey' });
  const second = completeRound({
    id: 'r2',
    text: 'chemical symbol for gold please go',
    answer: 'Au',
    category: 'science',
  });
  const third = completeRound({
    id: 'r3',
    text: 'instrument with 88 keys is called',
    answer: 'piano',
    category: 'music',
  });
  const truncated = `{"rounds":[${JSON.stringify(first)},${JSON.stringify(second)},${JSON.stringify(third)},{"id":"r4","kind":"typed","text":"half`;
  const set = await generateDailySet(
    {
      async run(_name, input) {
        const max = Number(input.max_tokens);
        if (max === TEXT_MAX_TOKENS_PERSONAS) return { response: { personas: valid.personas } };
        if (max === TEXT_MAX_TOKENS_VERIFY) return { response: { keep: [], drop: [] } };
        if (batchFromInput(input) === 0) {
          return { response: truncated, finish_reason: 'length' };
        }
        return { response: { rounds: roundsForBatch(valid, input) } };
      },
    },
    '2026-10-21',
  );
  assert.equal(set.source, 'ai');
  assert.ok(set.rounds.some((round) => round.id === 'r1' && round.answer === 'honey'));
  assert.ok(set.rounds.some((round) => round.id === 'r2'));
  assert.ok(set.rounds.some((round) => round.id === 'r3'));
});

test('a thin AI harvest is labeled fallback so the next request retries', async () => {
  const valid = fallbackDailySet('2026-10-21');
  const set = await generateDailySet(
    {
      async run(_name, input) {
        const max = Number(input.max_tokens);
        if (max === TEXT_MAX_TOKENS_PERSONAS) return { response: { personas: valid.personas } };
        if (max === TEXT_MAX_TOKENS_VERIFY) return { response: { keep: [], drop: [] } };
        return { response: { rounds: roundsForBatch(valid, input).slice(0, 2) } };
      },
    },
    '2026-10-21',
  );
  assert.equal(dailySourceFor(8), 'fallback');
  assert.equal(dailySourceFor(DAILY_AI_MIN), 'ai');
  assert.equal(set.source, 'fallback');
  assert.ok(set.rounds.length >= 20);
});

test('batch prompts rotate kinds and ban capital-of-France', async () => {
  const valid = fallbackDailySet('2026-10-21');
  const prompts: string[] = [];
  await generateDailySet(
    {
      async run(_name, input) {
        const max = Number(input.max_tokens);
        if (max === TEXT_MAX_TOKENS_BATCH) prompts.push(userText(input));
        if (max === TEXT_MAX_TOKENS_PERSONAS) return { response: { personas: valid.personas } };
        if (max === TEXT_MAX_TOKENS_VERIFY) return { response: { keep: [], drop: [] } };
        return { response: { rounds: roundsForBatch(valid, input) } };
      },
    },
    '2026-10-21',
  );
  assert.equal(prompts.length, DAILY_TASK_BATCHES);
  assert.ok(prompts.every((prompt) => /seed \d+/.test(prompt)));
  assert.ok(prompts.every((prompt) => /Forbidden: "What is the capital of France\?"/.test(prompt)));
  const kinds = prompts.map((prompt) => prompt.match(/kinds ([a-z/]+)/)?.[1] ?? '');
  assert.ok(new Set(kinds).size >= 3, `expected varied lanes, got ${kinds.join(',')}`);
  assert.equal(isStaleCapitalPrompt('What is the capital of France?', 'Paris'), true);
  assert.equal(isStaleCapitalPrompt('what city is the capital of japan', 'Tokyo'), false);
});

test('generateDailySet drops capital-of-France filler', async () => {
  const valid = fallbackDailySet('2026-10-21');
  const set = await generateDailySet(
    {
      async run(_name, input) {
        const max = Number(input.max_tokens);
        if (max === TEXT_MAX_TOKENS_PERSONAS) return { response: { personas: valid.personas } };
        if (max === TEXT_MAX_TOKENS_VERIFY) return { response: { keep: [], drop: [] } };
        const rows = roundsForBatch(valid, input).map((round, index) =>
          index === 0
            ? completeRound({
                id: `fr-${batchFromInput(input)}`,
                text: 'What is the capital of France?',
                answer: 'Paris',
                category: 'geography',
              })
            : round,
        );
        return { response: { rounds: rows } };
      },
    },
    '2026-10-21',
  );
  assert.equal(
    set.rounds.some((round) => isStaleCapitalPrompt(round.text, round.answer)),
    false,
  );
});

test('gradeTyped accepts a local misspelling without calling the model', async () => {
  const parsed = parseGradeRequest({
    date: '2026-10-21',
    question: 'who painted the sistine chapel ceiling then',
    answer: 'Michelangelo',
    aliases: [],
    playerText: 'michaelangelo',
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  let calls = 0;
  const result = await gradeTyped(
    {
      async run() {
        calls += 1;
        return { response: { correct: false, reason: 'nope' } };
      },
    },
    parsed.value,
  );
  assert.equal(calls, 0);
  assert.equal(result.correct, true);
  assert.equal(result.fallback, false);
});

test('judgeRound reads LLaVA description as evidence', async () => {
  const parsed = parseJudgeRequest({
    date: '2026-10-21',
    kind: 'draw',
    request: 'draw a sandwich with feelings',
    persona: 'Kira',
    submittedInTime: true,
    remainingMs: 4000,
    totalMs: 20000,
    image: 'data:image/jpeg;base64,AAAA',
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  let judgeTokens = 0;
  const result = await judgeRound(
    {
      async run(model, input) {
        if (model.includes('llava')) return { description: 'a wobbly sandwich' };
        judgeTokens = Number(input.max_tokens);
        return {
          response: {
            score: 8,
            seen: '',
            heard: '',
            reason: 'close enough',
            messages: ['ok this slaps'],
            nudges: ['hello??'],
          },
        };
      },
    },
    parsed.value,
  );
  assert.equal(result.fallback, false);
  assert.match(result.seen, /sandwich/);
});
