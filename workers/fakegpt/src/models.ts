/** Cheap Workers AI models used by FakeGPT. See README for pricing citations. */
export const TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
export const VISION_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';
export const WHISPER_MODEL = '@cf/openai/whisper';

/** Split daily gen: personas, then two ~10-task batches. One 1600-token blob timed out at 8s. */
export const TEXT_MAX_TOKENS_PERSONAS = 280;
export const TEXT_MAX_TOKENS_BATCH = 900;
export const TEXT_MAX_TOKENS_DAILY = TEXT_MAX_TOKENS_BATCH;
export const TEXT_MAX_TOKENS_VERIFY = 220;
export const TEXT_MAX_TOKENS_GRADE = 80;
/** Judge JSON is larger than a chat turn (score, seen/heard, reason, 1–3 messages, nudges). */
export const TEXT_MAX_TOKENS_JUDGE = 256;
export const TEXT_MAX_TOKENS_CHAT = 180;
export const VISION_MAX_TOKENS = 64;
export const AI_TIMEOUT_MS = 5500;
/** Background /daily waitUntil per call. Not user-facing once we serve fallback first. */
export const AI_TIMEOUT_MS_DAILY = 14_000;
/** Cron can wait; a live full-set retry needed 9.3s and 8s timed out. */
export const AI_TIMEOUT_MS_CRON = 28_000;
/** Live /judge fell back at 8.6s after vision + 5.5s judge. Typical judge is 3–5.5s. */
export const AI_TIMEOUT_MS_JUDGE = 9000;
export const DAILY_TASK_BATCHES = 2;
export const DAILY_TASKS_PER_BATCH = 10;
export const DAILY_GENERATE_SPEND = 4;

/** Full-day cache for a validated AI set. Fallback is cached only briefly so we retry. */
export const AI_DAILY_CACHE_TTL_SEC = 26 * 60 * 60;
export const FALLBACK_DAILY_CACHE_TTL_SEC = 3 * 60;
export const DAILY_CACHE_KEY_PREFIX = 'daily:v5:';

export function dailyCacheTtlSec(source: 'ai' | 'fallback'): number {
  return source === 'ai' ? AI_DAILY_CACHE_TTL_SEC : FALLBACK_DAILY_CACHE_TTL_SEC;
}

export function dailyCacheKey(date: string): string {
  return `${DAILY_CACHE_KEY_PREFIX}${date}`;
}

const PERSONA_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    vibe: { type: 'string' },
  },
  required: ['id', 'name'],
};

const ROUND_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    kind: {
      type: 'string',
      enum: [
        'mc',
        'typed',
        'translate',
        'math',
        'unit',
        'weekday',
        'spell',
        'unscramble',
        'order',
        'tone',
        'fill',
        'draw',
        'sound',
      ],
    },
    text: { type: 'string' },
    persona: { type: 'string' },
    vibe: { type: 'string' },
    category: { type: 'string' },
    difficulty: { type: 'number' },
    answer: { type: 'string' },
    aliases: { type: 'array', items: { type: 'string' } },
    options: { type: 'array', items: { type: 'string' } },
    nudges: { type: 'array', items: { type: 'string' } },
    good: { type: 'string' },
    bad: { type: 'string' },
  },
  required: ['id', 'kind', 'text', 'persona', 'answer', 'nudges', 'good', 'bad'],
};

export const PERSONAS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    personas: { type: 'array', items: PERSONA_SCHEMA },
  },
  required: ['personas'],
};

export const ROUNDS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    rounds: { type: 'array', items: ROUND_SCHEMA },
  },
  required: ['rounds'],
};

export const DAILY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    personas: { type: 'array', items: PERSONA_SCHEMA },
    rounds: { type: 'array', items: ROUND_SCHEMA },
  },
  required: ['personas', 'rounds'],
};

export const JUDGE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number' },
    seen: { type: 'string' },
    heard: { type: 'string' },
    reason: { type: 'string' },
    messages: { type: 'array', items: { type: 'string' } },
    nudges: { type: 'array', items: { type: 'string' } },
  },
  required: ['score', 'seen', 'heard', 'reason', 'messages', 'nudges'],
};

export const CHAT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    messages: { type: 'array', items: { type: 'string' } },
  },
  required: ['messages'],
};

export const VERIFY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    keep: { type: 'array', items: { type: 'string' } },
    drop: { type: 'array', items: { type: 'string' } },
  },
  required: ['keep', 'drop'],
};

export const GRADE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    correct: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['correct', 'reason'],
};

export const DAILY_ROUNDS = 20;
export const DAILY_ROUNDS_MAX = 32;
export const DAILY_PERSONAS = 5;
export const MAX_BONUS_PER_RUN = 1;
export const IMAGE_MAX_CHARS = 180_000;
export const AUDIO_MAX_CHARS = 420_000;
export const AUDIO_MAX_MS = 8000;
export const PLAYER_TEXT_MAX = 160;

export const GLOBAL_AI_CALLS_PER_DAY = 280;
export const IP_JUDGE_PER_HOUR = 24;
export const IP_GRADE_PER_HOUR = 30;
export const IP_CHAT_PER_HOUR = 40;
export const IP_DAILY_GET_PER_HOUR = 60;
