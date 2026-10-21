/** Cheap Workers AI models used by FakeGPT. See README for pricing citations. */
export const TEXT_MODEL = '@cf/meta/llama-3.2-1b-instruct';
export const VISION_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';
export const WHISPER_MODEL = '@cf/openai/whisper';

export const TEXT_MAX_TOKENS_DAILY = 420;
export const TEXT_MAX_TOKENS_CHAT = 120;
export const VISION_MAX_TOKENS = 64;
export const AI_TIMEOUT_MS = 5500;

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
