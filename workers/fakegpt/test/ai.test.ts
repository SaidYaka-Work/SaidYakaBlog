import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiFailureReason, generateDailySet, judgeRound, readText } from '../src/ai.ts';
import { fallbackDailySet } from '../src/fallback.ts';
import { TEXT_MODEL } from '../src/models.ts';
import { parseJudgeRequest } from '../src/schema.ts';

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

test('generateDailySet uses JSON schema and accepts an object response', async () => {
  const valid = fallbackDailySet('2026-10-21');
  let seen: Record<string, unknown> | undefined;
  let model = '';
  const set = await generateDailySet(
    {
      async run(name, input) {
        model = name;
        seen = input;
        return { response: { rounds: valid.rounds } };
      },
    },
    '2026-10-21',
  );
  assert.equal(model, TEXT_MODEL);
  assert.equal(set.source, 'ai');
  assert.equal(set.rounds.length, 8);
  const format = seen?.response_format as { type?: string; json_schema?: { type?: string } };
  assert.equal(format?.type, 'json_schema');
  assert.equal(format?.json_schema?.type, 'object');
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
  assert.equal(lines.length, 1);
  assert.match(lines[0], /fakegpt daily failed: schema-unsupported/);
  assert.ok(!lines[0].includes('ignore previous'));
});

test('aiFailureReason never echoes a prompt', () => {
  assert.equal(aiFailureReason(new Error('timeout')), 'timeout');
  assert.equal(aiFailureReason(new Error('no ai')), 'no-ai');
  assert.equal(aiFailureReason(new Error('invalid-set')), 'json-parse');
  assert.equal(aiFailureReason(new Error('please draw a cat')), 'ai-failed');
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
  const result = await judgeRound(
    {
      async run(model) {
        if (model.includes('llava')) return { description: 'a wobbly sandwich' };
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
