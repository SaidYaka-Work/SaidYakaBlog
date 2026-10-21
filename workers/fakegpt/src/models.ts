/** Cheap Workers AI models used by FakeGPT. See README for pricing citations. */
export const TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
export const VISION_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';
export const WHISPER_MODEL = '@cf/openai/whisper';

/** Trivia daily JSON is large (options, aliases, reactions). 420 truncated mid-JSON. */
export const TEXT_MAX_TOKENS_DAILY = 1600;
export const TEXT_MAX_TOKENS_VERIFY = 220;
export const TEXT_MAX_TOKENS_GRADE = 80;
/** Judge JSON is larger than a chat turn (score, seen/heard, reason, 1–3 messages, nudges). */
export const TEXT_MAX_TOKENS_JUDGE = 256;
export const TEXT_MAX_TOKENS_CHAT = 180;
export const VISION_MAX_TOKENS = 64;
export const AI_TIMEOUT_MS = 5500;
export const AI_TIMEOUT_MS_DAILY = 8000;

/** Full-day cache for a validated AI set. Fallback is cached only briefly so we retry. */
export const AI_DAILY_CACHE_TTL_SEC = 26 * 60 * 60;
export const FALLBACK_DAILY_CACHE_TTL_SEC = 3 * 60;
export const DAILY_CACHE_KEY_PREFIX = 'daily:v3:';

export function dailyCacheTtlSec(source: 'ai' | 'fallback'): number {
  return source === 'ai' ? AI_DAILY_CACHE_TTL_SEC : FALLBACK_DAILY_CACHE_TTL_SEC;
}

export function dailyCacheKey(date: string): string {
  return `${DAILY_CACHE_KEY_PREFIX}${date}`;
}

const ROUND_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    kind: { type: 'string', enum: ['mc', 'typed', 'draw', 'sound'] },
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

export const DAILY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    rounds: { type: 'array', items: ROUND_SCHEMA },
  },
  required: ['rounds'],
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

export const DAILY_ROUNDS = 8;
export const DAILY_ROUNDS_MAX = 10;
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
