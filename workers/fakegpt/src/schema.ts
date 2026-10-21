import { DAILY_ROUNDS, DAILY_ROUNDS_MAX, PLAYER_TEXT_MAX } from './models';
import { clipText, isUnsafeText, looksLikeInjection, sanitizeLine } from './safety';

export type PromptKind = 'draw' | 'sound';

export type DailyRound = {
  id: string;
  kind: PromptKind;
  text: string;
  persona: string;
  nudges: string[];
  good: string;
  bad: string;
};

export type DailySet = {
  date: string;
  source: 'ai' | 'fallback';
  rounds: DailyRound[];
};

export type AudioFeatures = {
  durationMs: number;
  rms: number;
  peakLevel: number;
  pitchLo: number;
  pitchHi: number;
  silenceRatio: number;
  padHits: number;
};

export type PadHit = {
  padId: string;
  holdMs: number;
};

export type JudgeRequest = {
  date: string;
  roundId: string;
  kind: PromptKind;
  request: string;
  persona: string;
  submittedInTime: boolean;
  remainingMs: number;
  totalMs: number;
  image?: string;
  audio?: string;
  pads?: PadHit[];
  features?: AudioFeatures;
};

export type JudgeResult = {
  score: number;
  seen: string;
  heard: string;
  reason: string;
  messages: string[];
  nudges: string[];
  fallback: boolean;
};

export type ChatRequest = {
  date: string;
  roundId: string;
  persona: string;
  request: string;
  playerText: string;
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
};

export type ChatResult = {
  messages: string[];
  fallback: boolean;
};

export function utcDate(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function formatUtcDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function isUtcDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function dateSeed(date: string): number {
  let hash = 2166136261;
  for (let i = 0; i < date.length; i += 1) {
    hash ^= date.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function asKind(value: unknown): PromptKind | null {
  return value === 'draw' || value === 'sound' ? value : null;
}

export function validateDailySet(raw: unknown, date: string): DailySet | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const roundsIn = Array.isArray(input.rounds) ? input.rounds : [];
  const rounds: DailyRound[] = [];
  const ids = new Set<string>();

  for (let i = 0; i < roundsIn.length && rounds.length < DAILY_ROUNDS_MAX; i += 1) {
    const item = roundsIn[i];
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const kind = asKind(row.kind);
    const text = sanitizeLine(row.text, 160);
    const persona = sanitizeLine(row.persona, 40) || 'a impatient user';
    if (!kind || text.length < 8) continue;
    const id = sanitizeLine(row.id, 32).replace(/[^a-z0-9-]/gi, '') || `r${rounds.length + 1}`;
    if (ids.has(id)) continue;
    ids.add(id);
    const nudges = (Array.isArray(row.nudges) ? row.nudges : [])
      .map((nudge) => sanitizeLine(nudge, 80))
      .filter(Boolean)
      .slice(0, 3);
    rounds.push({
      id,
      kind,
      text,
      persona,
      nudges: nudges.length ? nudges : ['hello??', 'are you still generating?'],
      good: sanitizeLine(row.good, 160) || 'ok wait. this slaps.',
      bad: sanitizeLine(row.bad, 160) || 'i asked for wonder and received a shrug.',
    });
  }

  if (rounds.length < DAILY_ROUNDS) return null;
  const draws = rounds.filter((round) => round.kind === 'draw').length;
  const sounds = rounds.filter((round) => round.kind === 'sound').length;
  if (draws < 2 || sounds < 2) return null;

  return {
    date,
    source: input.source === 'fallback' ? 'fallback' : 'ai',
    rounds: rounds.slice(0, DAILY_ROUNDS),
  };
}

export function parseJudgeRequest(raw: unknown): { ok: true; value: JudgeRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid' };
  const input = raw as Record<string, unknown>;
  if (!isUtcDate(input.date)) return { ok: false, error: 'date' };
  const kind = asKind(input.kind);
  if (!kind) return { ok: false, error: 'kind' };
  const request = sanitizeLine(input.request, 160);
  if (request.length < 8) return { ok: false, error: 'request' };
  if (typeof input.image === 'string' && input.image.length > 180_000) return { ok: false, error: 'image' };
  if (typeof input.audio === 'string' && input.audio.length > 420_000) return { ok: false, error: 'audio' };
  if (typeof input.image === 'string' && !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(input.image)) {
    return { ok: false, error: 'image' };
  }
  if (typeof input.audio === 'string' && !/^data:audio\/[a-z0-9.+-]+;base64,/i.test(input.audio)) {
    return { ok: false, error: 'audio' };
  }

  const pads = Array.isArray(input.pads)
    ? input.pads
        .map((hit) => {
          if (!hit || typeof hit !== 'object') return null;
          const row = hit as Record<string, unknown>;
          const padId = sanitizeLine(row.padId, 24);
          const holdMs = Number(row.holdMs);
          if (!padId || !Number.isFinite(holdMs)) return null;
          return { padId, holdMs: Math.max(0, Math.min(4000, holdMs)) };
        })
        .filter((hit): hit is PadHit => Boolean(hit))
        .slice(0, 16)
    : [];

  const features = parseFeatures(input.features);

  return {
    ok: true,
    value: {
      date: input.date,
      roundId: sanitizeLine(input.roundId, 32) || 'round',
      kind,
      request,
      persona: sanitizeLine(input.persona, 40) || 'a impatient user',
      submittedInTime: Boolean(input.submittedInTime),
      remainingMs: clampNumber(input.remainingMs, 0, 60_000),
      totalMs: clampNumber(input.totalMs, 1, 60_000),
      image: typeof input.image === 'string' ? input.image : undefined,
      audio: typeof input.audio === 'string' ? input.audio : undefined,
      pads,
      features,
    },
  };
}

function parseFeatures(raw: unknown): AudioFeatures | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const input = raw as Record<string, unknown>;
  return {
    durationMs: clampNumber(input.durationMs, 0, 12_000),
    rms: clampNumber(input.rms, 0, 1),
    peakLevel: clampNumber(input.peakLevel, 0, 1),
    pitchLo: clampNumber(input.pitchLo, 0, 4000),
    pitchHi: clampNumber(input.pitchHi, 0, 4000),
    silenceRatio: clampNumber(input.silenceRatio, 0, 1),
    padHits: clampNumber(input.padHits, 0, 32),
  };
}

export function parseChatRequest(raw: unknown): { ok: true; value: ChatRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid' };
  const input = raw as Record<string, unknown>;
  if (!isUtcDate(input.date)) return { ok: false, error: 'date' };
  const playerText = clipText(input.playerText, PLAYER_TEXT_MAX);
  if (playerText.length < 1) return { ok: false, error: 'text' };
  if (isUnsafeText(playerText) || looksLikeInjection(playerText)) return { ok: false, error: 'unsafe' };
  const history = Array.isArray(input.history)
    ? input.history
        .map((row) => {
          if (!row || typeof row !== 'object') return null;
          const item = row as Record<string, unknown>;
          const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null;
          const text = sanitizeLine(item.text, 160);
          if (!role || !text) return null;
          return { role, text };
        })
        .filter((row): row is { role: 'user' | 'assistant'; text: string } => Boolean(row))
        .slice(-6)
    : [];

  return {
    ok: true,
    value: {
      date: input.date,
      roundId: sanitizeLine(input.roundId, 32) || 'round',
      persona: sanitizeLine(input.persona, 40) || 'a impatient user',
      request: sanitizeLine(input.request, 160),
      playerText,
      history,
    },
  };
}

export function validateJudgeResult(raw: unknown): JudgeResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const score = Math.round(clampNumber(input.score, 0, 10));
  const messages = (Array.isArray(input.messages) ? input.messages : [input.reason, input.good, input.bad])
    .map((line) => sanitizeLine(line, 160))
    .filter(Boolean)
    .slice(0, 3);
  const nudges = (Array.isArray(input.nudges) ? input.nudges : [])
    .map((line) => sanitizeLine(line, 80))
    .filter(Boolean)
    .slice(0, 3);
  const seen = sanitizeLine(input.seen ?? input.description, 160);
  const heard = sanitizeLine(input.heard ?? input.transcript, 160);
  const reason = sanitizeLine(input.reason, 160);
  if (!messages.length && !reason && !seen && !heard) return null;
  return {
    score,
    seen,
    heard,
    reason: reason || messages[0] || '',
    messages: messages.length ? messages : [reason || 'noted.'],
    nudges: nudges.length ? nudges : ['hello??'],
    fallback: Boolean(input.fallback),
  };
}

export function validateChatResult(raw: unknown): ChatResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const messages = (Array.isArray(input.messages) ? input.messages : [input.text, input.response])
    .map((line) => sanitizeLine(line, 160))
    .filter(Boolean)
    .slice(0, 2);
  if (!messages.length) return null;
  return { messages, fallback: Boolean(input.fallback) };
}

function clampNumber(value: unknown, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0].trim() || 'local';
}
