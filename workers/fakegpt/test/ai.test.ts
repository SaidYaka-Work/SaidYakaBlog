import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiFailureReason, generateDailySet, gradeTyped, judgeRound, readText, verifyFacts } from '../src/ai.ts';
import { fallbackDailySet } from '../src/fallback.ts';
import {
  AI_TIMEOUT_MS,
  AI_TIMEOUT_MS_CRON,
  AI_TIMEOUT_MS_DAILY,
  AI_TIMEOUT_MS_JUDGE,
  DAILY_TASK_BATCHES,
  TEXT_MAX_TOKENS_BATCH,
  TEXT_MAX_TOKENS_CHAT,
  TEXT_MAX_TOKENS_DAILY,
  TEXT_MAX_TOKENS_JUDGE,
  TEXT_MAX_TOKENS_PERSONAS,
  TEXT_MAX_TOKENS_VERIFY,
  TEXT_MODEL,
} from '../src/models.ts';
import { parseGradeRequest, parseJudgeRequest } from '../src/schema.ts';

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
        return { response: { rounds: valid.rounds.slice(0, 10) } };
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
  assert.equal(seen?.max_tokens, TEXT_MAX_TOKENS_BATCH);
});

test('text token caps and timeouts match the split daily path', () => {
  assert.equal(TEXT_MAX_TOKENS_DAILY, TEXT_MAX_TOKENS_BATCH);
  assert.ok(TEXT_MAX_TOKENS_BATCH <= 900);
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
          return { response: { rounds: valid.rounds.slice(0, 10) } };
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
