import assert from 'node:assert/strict';
import { test } from 'node:test';
import { judgeRound } from '../src/ai.ts';
import { originAllowed } from '../src/index.ts';
import { parseJudgeRequest } from '../src/schema.ts';

test('judgeRound falls back when AI is missing', async () => {
  const parsed = parseJudgeRequest({
    date: '2026-10-21',
    kind: 'sound',
    request: 'make the sound of a sad robot',
    persona: 'Uncle Modem',
    submittedInTime: true,
    remainingMs: 4000,
    totalMs: 20000,
    pads: [{ padId: 'sad', holdMs: 400 }],
    features: { durationMs: 400, rms: 0.2, peakLevel: 0.3, pitchLo: 110, pitchHi: 200, silenceRatio: 0.1, padHits: 1 },
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const result = await judgeRound(undefined, parsed.value);
  assert.equal(result.fallback, true);
  assert.ok(result.heard.includes('sad'));
});

test('origin allowlist matches the dog worker defaults plus 8788', () => {
  assert.equal(originAllowed('https://saidyaka.com'), true);
  assert.equal(originAllowed('http://127.0.0.1:8788'), true);
  assert.equal(originAllowed('https://evil.example'), false);
  assert.equal(originAllowed(null), false);
});
