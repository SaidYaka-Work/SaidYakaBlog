export type Counter = {
  count: number;
  resetAt: number;
};

export function takeWindow(current: Counter | undefined, now: number, limit: number, windowMs: number): { ok: boolean; next: Counter } {
  const fresh = !current || now >= current.resetAt;
  const next: Counter = fresh ? { count: 1, resetAt: now + windowMs } : { count: current.count + 1, resetAt: current.resetAt };
  return { ok: next.count <= limit, next };
}

export function takeBudget(used: number, cost: number, cap: number): { ok: boolean; used: number } {
  const next = used + cost;
  return { ok: next <= cap, used: next };
}

export async function kvGetJson<T>(kv: KVNamespace | undefined, key: string): Promise<T | null> {
  if (!kv) return null;
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvPutJson(kv: KVNamespace | undefined, key: string, value: unknown, expirationTtl: number): Promise<void> {
  if (!kv) return;
  await kv.put(key, JSON.stringify(value), { expirationTtl });
}

export type KVNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};
