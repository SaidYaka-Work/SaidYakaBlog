import { fakegptWorkerUrl } from '@/lib/fakegpt';
import { fallbackDailySet } from '../../../workers/fakegpt/src/fallback';
import {
  type ChatResult,
  type DailySet,
  type JudgeRequest,
  type JudgeResult,
  utcDate,
  validateChatResult,
  validateDailySet,
  validateJudgeResult,
} from '../../../workers/fakegpt/src/schema';

const TIMEOUT_MS = 5000;
export const OFFLINE_KEY = 'fakegpt-offline';

function withTimeout<T>(factory: (signal: AbortSignal) => Promise<T>, ms = TIMEOUT_MS): Promise<T | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  return factory(controller.signal)
    .catch(() => null)
    .finally(() => window.clearTimeout(timer));
}

export function readOffline(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(OFFLINE_KEY) === '1';
}

export function writeOffline(value: boolean) {
  window.localStorage.setItem(OFFLINE_KEY, value ? '1' : '0');
}

export async function fetchDailySet(offline: boolean): Promise<DailySet> {
  const date = utcDate();
  if (offline) return fallbackDailySet(date);
  const base = fakegptWorkerUrl();
  if (!base) return fallbackDailySet(date);
  const remote = await withTimeout(async (signal) => {
    const response = await fetch(`${base}/daily?date=${date}`, { signal });
    if (!response.ok) return null;
    return validateDailySet(await response.json(), date);
  }, 4000);
  return remote ?? fallbackDailySet(date);
}

export async function requestJudge(body: JudgeRequest, offline: boolean): Promise<JudgeResult | null> {
  if (offline) return null;
  const base = fakegptWorkerUrl();
  if (!base) return null;
  return withTimeout(async (signal) => {
    const response = await fetch(`${base}/judge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (response.status === 429) return { fallback: true, score: 0, seen: '', heard: '', reason: '', messages: [], nudges: [] };
    if (!response.ok) return null;
    const parsed = validateJudgeResult(await response.json());
    if (!parsed || parsed.fallback) return parsed?.fallback ? { ...parsed, fallback: true } : null;
    return parsed;
  });
}

export async function requestChat(
  body: { date: string; roundId: string; persona: string; request: string; playerText: string; history: Array<{ role: 'user' | 'assistant'; text: string }> },
  offline: boolean,
): Promise<ChatResult | null> {
  if (offline) return null;
  const base = fakegptWorkerUrl();
  if (!base) return null;
  return withTimeout(async (signal) => {
    const response = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) return null;
    return validateChatResult(await response.json());
  }, 4000);
}
