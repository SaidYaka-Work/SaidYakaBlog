/**
 * Durable Object write budget for the shared dog.
 *
 * Hot yard/pose/leash/ai/presence/location/feeder stay in memory.
 * SQLite rows are written only on meaningful care/life/travel/park events, or at most
 * once every PERSIST_MIN_MS while dirty. Pose ticks never write by themselves.
 */

import { applyDecay, applyVisitorMove, createRoom, migrateRoom, snapshot, tickSharedYard, type RoomState } from './logic';
import { YARD_TICK_MS } from './room';

export const PERSIST_MIN_MS = 60_000;
export const IDLE_ALARM_MS = 6 * 60_000;
export const FAST_ALARM_MS = YARD_TICK_MS;
export const WRITE_BUDGET_MAX_ROWS = 20_000;
export const READ_RETRY_MIN_MS = 250;
export const READ_RETRY_MAX_MS = 8_000;

export function logDogError(tag: string, error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`[dog] ${tag}`, err, err.stack ?? '');
}

export type PersistReason =
  | 'create'
  | 'feed'
  | 'pet'
  | 'walk'
  | 'stage'
  | 'runaway'
  | 'catch'
  | 'name'
  | 'travel'
  | 'park';

export type PersistKind = 'read' | 'connect' | 'tick' | 'action';

export const MEANINGFUL_REASONS = new Set<PersistReason>([
  'create',
  'feed',
  'pet',
  'walk',
  'stage',
  'runaway',
  'catch',
  'name',
  'travel',
  'park',
]);

export function persistReason(prev: RoomState, next: RoomState): PersistReason | null {
  if (!prev.dog && next.dog) return 'catch';
  if (prev.dog && !next.dog) return 'runaway';
  if (prev.pendingName?.token !== next.pendingName?.token) {
    return next.pendingName ? 'catch' : 'name';
  }
  if (prev.dog && next.dog) {
    if (prev.dog.profile.name !== next.dog.profile.name) return 'name';
    if (prev.dog.furthestStage !== next.dog.furthestStage) return 'stage';
    if (prev.dog.lastFedAt !== next.dog.lastFedAt || prev.dog.totals.feeds !== next.dog.totals.feeds) {
      return 'feed';
    }
    if (prev.dog.lastPettedAt !== next.dog.lastPettedAt || prev.dog.totals.pets !== next.dog.totals.pets) {
      return 'pet';
    }
    if (prev.dog.lastWalkedAt !== next.dog.lastWalkedAt || prev.dog.totals.walks !== next.dog.totals.walks) {
      return 'walk';
    }
  }
  if (prev.yard?.leash.holderId && !next.yard?.leash.holderId) return 'park';
  const prevLoc = prev.yard?.location;
  const nextLoc = next.yard?.location;
  if (prevLoc && nextLoc && prevLoc.placeId !== nextLoc.placeId) return 'travel';
  return null;
}

export function shouldWrite(opts: {
  reason: PersistReason | null;
  dirty: boolean;
  lastPersistAt: number;
  now: number;
  kind: PersistKind;
}): boolean {
  if (opts.reason && MEANINGFUL_REASONS.has(opts.reason)) return true;
  if (opts.kind === 'read' || opts.kind === 'connect') return false;
  return opts.dirty && opts.now - opts.lastPersistAt >= PERSIST_MIN_MS;
}

export function nextAlarmDelay(socketCount: number): number {
  return socketCount > 0 ? FAST_ALARM_MS : IDLE_ALARM_MS;
}

export function shouldReplaceAlarm(existing: number | null | undefined, now: number, delay: number): boolean {
  const want = now + delay;
  if (!existing || existing <= now) return true;
  return existing > want + 50;
}

export type PersistStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put(entries: Record<string, unknown>): Promise<void>;
  getAlarm(): Promise<number | null | undefined>;
  setAlarm(at: number): Promise<void>;
};

export type PersistDecision = {
  wrote: boolean;
  reason: PersistReason | 'dirty' | null;
};

/** In-memory room + write-budget policy used by DogRoom and the 24h write test. */
export class RoomSession {
  room: RoomState | null;
  loadedFromStorage: boolean;
  lastTickAt: number;
  lastPersistAt: number;
  lastReadAttemptAt: number;
  readBackoffMs = READ_RETRY_MIN_MS;
  lastFullSnapAt = 0;
  dirty = false;

  constructor(room: RoomState | null, now: number, lastPersistAt = now, loadedFromStorage = Boolean(room)) {
    this.room = room;
    this.loadedFromStorage = loadedFromStorage;
    this.lastTickAt = now;
    this.lastPersistAt = lastPersistAt;
    this.lastReadAttemptAt = now;
  }

  static degraded(now: number) {
    return new RoomSession(null, now, now, false);
  }

  get mayPersist() {
    return this.loadedFromStorage && Boolean(this.room);
  }

  static async boot(storage: Pick<PersistStorage, 'get' | 'put'>, now: number): Promise<RoomSession> {
    try {
      const existing = await storage.get<RoomState>('room');
      if (existing === undefined) {
        const room = migrateRoom(createRoom(now), now);
        const session = new RoomSession(room, now, now, true);
        try {
          await storage.put({ room });
        } catch (error) {
          logDogError('boot persist failed', error);
        }
        return session;
      }
      return new RoomSession(migrateRoom(existing, now), now, now, true);
    } catch (error) {
      logDogError('boot failed', error);
      return RoomSession.degraded(now);
    }
  }

  async retryLoad(storage: Pick<PersistStorage, 'get' | 'put'>, now: number): Promise<boolean> {
    if (this.loadedFromStorage && this.room) return true;
    if (now - this.lastReadAttemptAt < this.readBackoffMs) return false;
    this.lastReadAttemptAt = now;
    try {
      const existing = await storage.get<RoomState>('room');
      if (existing === undefined) {
        this.room = migrateRoom(createRoom(now), now);
        this.loadedFromStorage = true;
        this.readBackoffMs = READ_RETRY_MIN_MS;
        this.dirty = false;
        try {
          await storage.put({ room: this.room });
        } catch (error) {
          logDogError('boot persist failed', error);
        }
        return true;
      }
      this.room = migrateRoom(existing, now);
      this.loadedFromStorage = true;
      this.readBackoffMs = READ_RETRY_MIN_MS;
      this.dirty = false;
      return true;
    } catch (error) {
      logDogError('boot failed', error);
      this.readBackoffMs = Math.min(READ_RETRY_MAX_MS, this.readBackoffMs * 2);
      return false;
    }
  }

  adopt(next: RoomState, now: number, kind: PersistKind): PersistDecision {
    if (!this.mayPersist) return { wrote: false, reason: null };
    const reason = persistReason(this.room!, next);
    if (next !== this.room) this.dirty = true;
    this.room = next;
    if (shouldWrite({ reason, dirty: this.dirty, lastPersistAt: this.lastPersistAt, now, kind })) {
      this.lastPersistAt = now;
      this.dirty = false;
      return { wrote: true, reason: reason ?? 'dirty' };
    }
    return { wrote: false, reason };
  }

  decay(now: number, kind: PersistKind = 'read'): PersistDecision {
    if (!this.mayPersist) return { wrote: false, reason: null };
    return this.adopt(applyDecay(this.room!, now), now, kind);
  }

  tick(now: number, socketCount: number): PersistDecision & { fed?: ReturnType<typeof tickSharedYard>['fed'] } {
    if (!this.mayPersist) return { wrote: false, reason: null };
    if (socketCount <= 0) {
      return this.decay(now, 'tick');
    }
    const dt = Math.min(0.25, Math.max(0.05, (now - this.lastTickAt) / 1000));
    this.lastTickAt = now;
    const ticked = tickSharedYard(this.room!, now, dt);
    return { ...this.adopt(ticked.room, now, 'tick'), fed: ticked.fed };
  }

  move(
    clientId: string,
    ip: string,
    ax: number,
    az: number,
    run: boolean,
    dt: number,
    now: number,
    proposed?: { x: number; z: number } | null,
  ) {
    if (!this.mayPersist) {
      return { room: this.room, acquired: false, code: 'asleep' as const, wrote: false, reason: null };
    }
    const moved = applyVisitorMove(this.room!, clientId, ip, ax, az, run, dt, now, proposed);
    return { ...moved, ...this.adopt(moved.room, now, 'action') };
  }
}

export async function flushIfNeeded(
  storage: Pick<PersistStorage, 'put'>,
  session: RoomSession,
  decision: PersistDecision,
): Promise<void> {
  if (!decision.wrote || !session.mayPersist || !session.room) return;
  await storage.put({ room: session.room });
}

export async function runOrNap<T>(
  run: () => Promise<T>,
): Promise<{ status: 200; body: T } | { status: 503; body: 'napping' }> {
  try {
    return { status: 200, body: await run() };
  } catch (error) {
    logDogError('boot failed', error);
    return { status: 503, body: 'napping' };
  }
}

/** First GET /state on an empty DO: boot + snapshot, or 503 napping — never throw. */
export async function firstState(
  storage: Pick<PersistStorage, 'get' | 'put'>,
  now: number,
  presence = 0,
): Promise<{ status: 200; body: ReturnType<typeof snapshot> } | { status: 503; body: 'napping' }> {
  try {
    const session = await RoomSession.boot(storage, now);
    if (!session.mayPersist || !session.room) {
      return { status: 503, body: 'napping' };
    }
    const decision = session.decay(now, 'read');
    await flushIfNeeded(storage, session, decision);
    return { status: 200, body: snapshot(session.room, now, presence) };
  } catch (error) {
    logDogError('boot failed', error);
    return { status: 503, body: 'napping' };
  }
}

export async function scheduleAlarm(
  storage: Pick<PersistStorage, 'getAlarm' | 'setAlarm'>,
  now: number,
  socketCount: number,
): Promise<boolean> {
  const delay = nextAlarmDelay(socketCount);
  const existing = await storage.getAlarm();
  if (!shouldReplaceAlarm(existing, now, delay)) return false;
  await storage.setAlarm(now + delay);
  return true;
}
