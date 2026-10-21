/** Cheap Workers AI models used by FakeGPT. See README for pricing citations. */
export const TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
export const VISION_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';
export const WHISPER_MODEL = '@cf/openai/whisper';

export const TEXT_MAX_TOKENS_DAILY = 420;
export const TEXT_MAX_TOKENS_CHAT = 120;
export const VISION_MAX_TOKENS = 64;
export const AI_TIMEOUT_MS = 5500;

/** Full-day cache for a validated AI set. Fallback is cached only briefly so we retry. */
export const AI_DAILY_CACHE_TTL_SEC = 26 * 60 * 60;
export const FALLBACK_DAILY_CACHE_TTL_SEC = 3 * 60;
export const DAILY_CACHE_KEY_PREFIX = 'daily:v2:';

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
    kind: { type: 'string', enum: ['draw', 'sound'] },
    text: { type: 'string' },
    persona: { type: 'string' },
    nudges: { type: 'array', items: { type: 'string' } },
    good: { type: 'string' },
    bad: { type: 'string' },
  },
  required: ['id', 'kind', 'text', 'persona', 'nudges', 'good', 'bad'],
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

export const DAILY_ROUNDS = 8;
export const DAILY_ROUNDS_MAX = 12;
export const IMAGE_MAX_CHARS = 180_000;
export const AUDIO_MAX_CHARS = 420_000;
export const AUDIO_MAX_MS = 8000;
export const PLAYER_TEXT_MAX = 160;

export const GLOBAL_AI_CALLS_PER_DAY = 280;
export const IP_JUDGE_PER_HOUR = 24;
export const IP_CHAT_PER_HOUR = 40;
export const IP_DAILY_GET_PER_HOUR = 60;
