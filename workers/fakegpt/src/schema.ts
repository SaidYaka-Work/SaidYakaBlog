import { MAX_CUSTOMERS, fillPersonas, type DailyPersona } from '../../../components/games/fakegpt/lanes';
import { levenshtein, matchChoice, normalizeAnswer } from '../../../components/games/fakegpt/match';

export type { DailyPersona };
import { DAILY_PERSONAS, DAILY_ROUNDS, DAILY_ROUNDS_MAX, MAX_BONUS_PER_RUN, PLAYER_TEXT_MAX } from './models';
import { clipText, isUnsafeText, looksLikeInjection, sanitizeLine } from './safety';

export type PromptKind =
  | 'mc'
  | 'typed'
  | 'translate'
  | 'math'
  | 'unit'
  | 'weekday'
  | 'spell'
  | 'unscramble'
  | 'order'
  | 'tone'
  | 'fill'
  | 'draw'
  | 'sound';
export type BonusKind = 'draw' | 'sound';

export type DailyRound = {
  id: string;
  kind: PromptKind;
  text: string;
  persona: string;
  vibe: string;
  category: string;
  difficulty: 1 | 2 | 3;
  answer: string;
  aliases: string[];
  options: string[];
  nudges: string[];
  good: string;
  bad: string;
};

export type DailySet = {
  date: string;
  source: 'ai' | 'fallback';
  personas: DailyPersona[];
  rounds: DailyRound[];
  /** How many rounds came from the model before bank fill. */
  aiCount?: number;
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
  kind: BonusKind;
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

export type GradeRequest = {
  date: string;
  roundId: string;
  persona: string;
  question: string;
  answer: string;
  aliases: string[];
  playerText: string;
};

export type GradeResult = {
  correct: boolean;
  reason: string;
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

const KINDS: readonly PromptKind[] = [
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
];

function asKind(value: unknown): PromptKind | null {
  return typeof value === 'string' && KINDS.includes(value as PromptKind) ? (value as PromptKind) : null;
}

export function parseDailyPersona(raw: unknown): DailyPersona | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const name = sanitizeLine(row.name ?? row.persona, 40);
  if (!name) return null;
  const id = sanitizeLine(row.id, 24).replace(/[^a-z0-9-]/gi, '') || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24);
  return {
    id: id || 'user',
    name,
    vibe: sanitizeLine(row.vibe, 80) || 'impatient, funny, slightly unhinged',
  };
}

function asBonusKind(value: unknown): BonusKind | null {
  return value === 'draw' || value === 'sound' ? value : null;
}

function needsChoices(kind: PromptKind, options: readonly string[]): boolean {
  return kind === 'mc' || kind === 'tone' || kind === 'order' || (kind === 'fill' && options.length === 4);
}

function asDifficulty(value: unknown): 1 | 2 | 3 {
  const n = Math.round(Number(value));
  if (n <= 1) return 1;
  if (n >= 3) return 3;
  return 2;
}

const SOURCE_CLUSTERS: readonly (readonly string[])[] = [
  ['hello', 'hi', 'hey', 'howdy', 'yo', 'hiya'],
  ['goodbye', 'bye', 'good bye', 'farewell', 'cya', 'see you'],
  ['thank you', 'thanks', 'thx', 'thank'],
  ['yes', 'yeah', 'yep', 'yup'],
  ['no', 'nope', 'nah'],
  ['please', 'pls'],
];

const FORMAT_STOP = new Set(['a', 'an', 'the', 'of', 'and', 'de', 'la', 'el']);

/** Quoted phrases plus "translate X to …" / "what does X mean" source terms. */
export function translateSourceTerms(text: string): string[] {
  const terms = new Set<string>();
  const add = (raw: string) => {
    const normalized = normalizeAnswer(raw);
    if (!normalized) return;
    terms.add(normalized);
    for (const word of normalized.split(' ')) {
      if (word.length >= 2) terms.add(word);
    }
  };
  const src = String(text || '');
  for (const match of src.matchAll(/["“”']([^"'“”]{1,40})["“”']/g)) add(match[1]);
  const translateTo = src.match(/translate\s+(.+?)\s+to\s+[a-z]+/i);
  if (translateTo) add(translateTo[1]);
  const whatDoes = src.match(/what does\s+["']?([^"'?]+?)["']?\s+mean/i);
  if (whatDoes) add(whatDoes[1]);
  return [...terms];
}

function sourceLanguageCluster(terms: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const cluster of SOURCE_CLUSTERS) {
    if (cluster.some((word) => terms.includes(word))) {
      for (const word of cluster) out.add(word);
    }
  }
  return out;
}

/** Case, spacing, and punctuation only — not a reshuffled order. */
export function isSpacingAlias(alias: string, answer: string): boolean {
  const got = normalizeAnswer(alias);
  const want = normalizeAnswer(answer);
  if (!got || !want) return false;
  return got === want || got.replace(/ /g, '') === want.replace(/ /g, '');
}

/** Spelling/format variants of the same answer, not nicknames like "City of Love". */
export function isFormatAlias(alias: string, answer: string): boolean {
  const got = normalizeAnswer(alias);
  const want = normalizeAnswer(answer);
  if (!got || !want) return false;
  if (isSpacingAlias(alias, answer)) return true;
  const gotWords = got.split(' ').filter(Boolean);
  const wantWords = want.split(' ').filter(Boolean);
  if (gotWords.every((word) => wantWords.includes(word)) || wantWords.every((word) => gotWords.includes(word))) {
    return true;
  }
  const initials = (words: string[]) => words.filter((word) => !FORMAT_STOP.has(word)).map((word) => word[0]).join('');
  if (got.replace(/ /g, '') === initials(wantWords) || want.replace(/ /g, '') === initials(gotWords)) return true;
  const dist = levenshtein(got, want);
  const budget = want.length <= 3 ? 0 : want.length <= 7 ? 1 : 2;
  return budget > 0 && dist <= budget;
}

export function filterAliases(kind: PromptKind, text: string, answer: string, aliases: readonly string[]): string[] {
  const source = kind === 'translate' ? translateSourceTerms(text) : [];
  const cluster = kind === 'translate' ? sourceLanguageCluster(source) : new Set<string>();
  return aliases.filter((alias) => {
    const normalized = normalizeAnswer(alias);
    if (!normalized) return false;
    if (normalized === normalizeAnswer(answer)) return false;
    if (source.includes(normalized) || cluster.has(normalized)) return false;
    if (kind === 'order' || kind === 'math' || kind === 'unit') return isSpacingAlias(alias, answer);
    if (kind === 'translate') return true;
    return isFormatAlias(alias, answer);
  });
}

const PLACEHOLDER_REPLY =
  /^(praise|good|bad|mood|canonical|format variant|how the user asks|one of the day names|x)$/i;

export function isPlaceholderReply(value: string): boolean {
  return PLACEHOLDER_REPLY.test(value.trim());
}

export function cleanReply(value: unknown, fallback: string): string {
  const text = sanitizeLine(value, 160);
  if (!text || isPlaceholderReply(text)) return fallback;
  return text;
}

export function parseFailReason(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return 'parse-shape';
  const row = raw as Record<string, unknown>;
  if (!asKind(row.kind)) return 'parse-kind';
  const text = sanitizeLine(row.text, 160);
  if (text.length < 8) return 'parse-text';
  if (!sanitizeLine(row.answer, 80)) return 'parse-answer';
  if (!sanitizeLine(row.id, 32).replace(/[^a-z0-9-]/gi, '')) return 'parse-id';
  const kind = asKind(row.kind);
  const options = (Array.isArray(row.options) ? row.options : [])
    .map((option) => sanitizeLine(option, 80))
    .filter(Boolean)
    .slice(0, 4);
  if (kind && (kind === 'mc' || kind === 'tone' || kind === 'order' || (kind === 'fill' && options.length === 4))) {
    if (options.length !== 4) return 'parse-options';
    const answer = sanitizeLine(row.answer, 80);
    const hits = options.filter((option) => matchChoice(option, answer)).length;
    if (hits !== 1) return 'parse-mc-key';
  }
  return 'parse';
}

export function stripCrossOptionAliases(round: DailyRound): DailyRound {
  if (!round.options.length) return round;
  const answer = normalizeAnswer(round.answer);
  const aliases = round.aliases.filter((alias) => {
    const normalized = normalizeAnswer(alias);
    return !round.options.some((option) => {
      const opt = normalizeAnswer(option);
      return Boolean(opt && opt !== answer && (opt === normalized || matchChoice(option, alias)));
    });
  });
  return { ...round, aliases };
}

export function parseDailyRound(raw: unknown): DailyRound | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const kind = asKind(row.kind);
  const text = sanitizeLine(row.text, 160);
  const answer = sanitizeLine(row.answer, 80);
  const persona = sanitizeLine(row.persona, 40) || 'Dana';
  if (!kind || text.length < 8 || answer.length < 1) return null;
  const id = sanitizeLine(row.id, 32).replace(/[^a-z0-9-]/gi, '');
  if (!id) return null;
  const aliases = filterAliases(
    kind,
    text,
    answer,
    (Array.isArray(row.aliases) ? row.aliases : []).map((alias) => sanitizeLine(alias, 80)).filter(Boolean),
  ).slice(0, 6);
  const options = (Array.isArray(row.options) ? row.options : [])
    .map((option) => sanitizeLine(option, 80))
    .filter(Boolean)
    .slice(0, 4);
  if (kind === 'mc' || kind === 'tone' || kind === 'order' || (kind === 'fill' && options.length === 4)) {
    if (options.length !== 4) return null;
    const hits = options.filter((option) => matchChoice(option, answer)).length;
    if (hits !== 1) return null;
  }
  const nudges = (Array.isArray(row.nudges) ? row.nudges : [])
    .map((nudge) => sanitizeLine(nudge, 80))
    .filter(Boolean)
    .slice(0, 3);
  return stripCrossOptionAliases({
    id,
    kind,
    text,
    persona,
    vibe: sanitizeLine(row.vibe, 80) || 'impatient, funny, slightly unhinged',
    category: sanitizeLine(row.category, 24) || 'general',
    difficulty: asDifficulty(row.difficulty),
    answer,
    aliases,
    options: needsChoices(kind, options) ? options : [],
    nudges: nudges.length ? nudges : ['hello??', 'are you still generating?'],
    good: cleanReply(row.good, 'ok the model remembered a fact. rare.'),
    bad: cleanReply(row.bad, `that's a hallucination, buddy. it's ${answer}.`),
  });
}

export function validateDailySet(raw: unknown, date: string): DailySet | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const roundsIn = Array.isArray(input.rounds) ? input.rounds : [];
  const rounds: DailyRound[] = [];
  const ids = new Set<string>();
  const answers = new Set<string>();

  for (let i = 0; i < roundsIn.length && rounds.length < DAILY_ROUNDS_MAX; i += 1) {
    const parsed = parseDailyRound(roundsIn[i]);
    if (!parsed) continue;
    if (ids.has(parsed.id)) continue;
    const answerKey = normalizeAnswer(parsed.answer);
    if (parsed.kind !== 'draw' && parsed.kind !== 'sound' && answers.has(answerKey)) continue;
    ids.add(parsed.id);
    if (answerKey) answers.add(answerKey);
    rounds.push(parsed);
  }

  const picked = rounds.slice(0, Math.max(DAILY_ROUNDS, rounds.length));
  if (picked.length < DAILY_ROUNDS) return null;
  const bonus = picked.filter((round) => round.kind === 'draw' || round.kind === 'sound').length;
  const choice = picked.filter((round) => needsChoices(round.kind, round.options)).length;
  const typedLike = picked.filter((round) => !needsChoices(round.kind, round.options) && round.kind !== 'draw' && round.kind !== 'sound').length;
  if (bonus > MAX_BONUS_PER_RUN) return null;
  if (choice < 2 || typedLike < 2) return null;
  const categories = new Set(picked.map((round) => round.category));
  const kinds = new Set(picked.map((round) => round.kind));
  if (categories.size < 3 && kinds.size < 4) return null;

  const personasIn = Array.isArray(input.personas) ? input.personas : [];
  const fromRounds = picked.map((round) => ({ id: '', name: round.persona, vibe: round.vibe }));
  const personas = fillPersonas(
    [...personasIn.map(parseDailyPersona).filter((row): row is DailyPersona => Boolean(row)), ...fromRounds],
    dateSeed(date),
  );
  if (personas.length < Math.min(DAILY_PERSONAS, MAX_CUSTOMERS)) return null;

  const aiCount =
    typeof input.aiCount === 'number' && Number.isFinite(input.aiCount)
      ? Math.max(0, Math.min(picked.length, Math.round(input.aiCount)))
      : undefined;

  return {
    date,
    source: input.source === 'fallback' ? 'fallback' : 'ai',
    personas,
    rounds: picked,
    aiCount,
  };
}

export function parseJudgeRequest(raw: unknown): { ok: true; value: JudgeRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid' };
  const input = raw as Record<string, unknown>;
  if (!isUtcDate(input.date)) return { ok: false, error: 'date' };
  const kind = asBonusKind(input.kind);
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

export function parseGradeRequest(raw: unknown): { ok: true; value: GradeRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid' };
  const input = raw as Record<string, unknown>;
  if (!isUtcDate(input.date)) return { ok: false, error: 'date' };
  const playerText = clipText(input.playerText, 80);
  if (playerText.length < 1) return { ok: false, error: 'text' };
  if (isUnsafeText(playerText) || looksLikeInjection(playerText)) return { ok: false, error: 'unsafe' };
  const question = sanitizeLine(input.question, 160);
  const answer = sanitizeLine(input.answer, 80);
  if (question.length < 8 || !answer) return { ok: false, error: 'question' };
  const aliases = (Array.isArray(input.aliases) ? input.aliases : [])
    .map((alias) => sanitizeLine(alias, 80))
    .filter(Boolean)
    .slice(0, 6);
  return {
    ok: true,
    value: {
      date: input.date,
      roundId: sanitizeLine(input.roundId, 32) || 'round',
      persona: sanitizeLine(input.persona, 40) || 'a impatient user',
      question,
      answer,
      aliases,
      playerText,
    },
  };
}

export function validateGradeResult(raw: unknown): GradeResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  if (typeof input.correct !== 'boolean' && input.correct !== 'true' && input.correct !== 'false') return null;
  return {
    correct: input.correct === true || input.correct === 'true',
    reason: sanitizeLine(input.reason, 120),
    fallback: Boolean(input.fallback),
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
