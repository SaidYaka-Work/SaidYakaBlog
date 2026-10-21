import { dogWorkerUrl } from '@/lib/dog';

export type ResultKey = '1' | '2' | '3' | '4' | '5' | '6' | 'X';

export type GlobalStats = {
  played: number;
  solved: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5' | '6' | 'X', number>;
};

export const GLOBAL_SENT_KEY = 'unknown-number-global-sent';
const TIMEOUT_MS = 2500;

function dailyUrl(path: string) {
  const base = dogWorkerUrl();
  return base ? `${base}${path}` : '';
}

async function withTimeout<T>(factory: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await factory(controller.signal);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchGlobalStats(day: number): Promise<GlobalStats | null> {
  const url = dailyUrl(`/daily/unknown-number/stats?day=${day}`);
  if (!url) return null;
  return withTimeout(async (signal) => {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    const data = (await response.json()) as GlobalStats;
    if (!data || typeof data.played !== 'number' || typeof data.solved !== 'number' || !data.distribution) {
      return null;
    }
    return data;
  });
}

export async function submitGlobalResult(day: number, result: ResultKey): Promise<void> {
  if (typeof window === 'undefined') return;
  const flag = `${day}`;
  if (window.localStorage.getItem(GLOBAL_SENT_KEY) === flag) return;
  window.localStorage.setItem(GLOBAL_SENT_KEY, flag);
  const url = dailyUrl('/daily/unknown-number/result');
  if (!url) return;
  await withTimeout(async (signal) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, result }),
      signal,
    });
    return response.ok;
  });
}

export function resultKey(status: 'won' | 'lost', guesses: number): ResultKey {
  if (status === 'lost') return 'X';
  return String(Math.min(6, Math.max(1, guesses))) as ResultKey;
}

export function globalSummary(stats: GlobalStats): { percent: number; most: number | null } {
  const percent = stats.played ? Math.round((stats.solved / stats.played) * 100) : 0;
  let most: number | null = null;
  let best = -1;
  for (const key of ['1', '2', '3', '4', '5', '6'] as const) {
    const value = stats.distribution[key] ?? 0;
    if (value > best) {
      best = value;
      most = Number(key);
    }
  }
  return { percent, most: best > 0 ? most : null };
}
