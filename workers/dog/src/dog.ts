import {
  DECAY_ALARM_MS,
  HISTORY_PAGE,
  MAX_CONNECTIONS,
  applyCare,
  applyCatch,
  applyDecay,
  applyName,
  applyPet,
  canStartCare,
  canStartCatch,
  createRoom,
  fanout,
  listHistory,
  migrateRoom,
  originAllowed,
  parseClientMessage,
  pruneBuckets,
  snapshot,
  takeConnectionGap,
  takeRate,
  validateFinish,
  type CareGame,
  type RateBucket,
  type RoomState,
} from './logic';

export interface Env {
  DOG: DurableObjectNamespace;
  ALLOWED_ORIGINS?: string;
}

type PlaySession = {
  playId: string;
  game: CareGame;
  startedAt: number;
};

type SocketMeta = {
  ip: string;
  lastAt: number;
  play: PlaySession | null;
  nameToken: string | null;
};

function corsHeaders(origin: string | null, env: Env): HeadersInit {
  const allowed = origin && originAllowed(origin, env.ALLOWED_ORIGINS) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

export class DogRoom {
  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env,
  ) {
    this.ctx.blockConcurrencyWhile(async () => {
      const existing = await this.ctx.storage.get<RoomState>('room');
      if (!existing) {
        await this.ctx.storage.put('room', createRoom(Date.now()));
      } else {
        await this.ctx.storage.put('room', migrateRoom(existing));
      }
      const alarm = await this.ctx.storage.getAlarm();
      if (!alarm) {
        await this.ctx.storage.setAlarm(Date.now() + DECAY_ALARM_MS);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, this.env) });
    }

    if (url.pathname === '/health') {
      return new Response('ok', { headers: corsHeaders(origin, this.env) });
    }

    if (url.pathname === '/state' && request.method === 'GET') {
      if (origin && !originAllowed(origin, this.env.ALLOWED_ORIGINS)) {
        return new Response('origin not allowed', { status: 403 });
      }
      const now = Date.now();
      const room = await this.load(now);
      return Response.json(snapshot(room, now, this.ctx.getWebSockets().length), {
        headers: corsHeaders(origin, this.env),
      });
    }

    if (url.pathname === '/history' && request.method === 'GET') {
      if (origin && !originAllowed(origin, this.env.ALLOWED_ORIGINS)) {
        return new Response('origin not allowed', { status: 403 });
      }
      const now = Date.now();
      const room = await this.load(now);
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = Number(url.searchParams.get('limit') || HISTORY_PAGE);
      return Response.json(listHistory(room, offset, limit), {
        headers: corsHeaders(origin, this.env),
      });
    }

    if (url.pathname === '/ws') {
      if (!originAllowed(origin, this.env.ALLOWED_ORIGINS)) {
        return new Response('origin not allowed', { status: 403 });
      }
      if (this.ctx.getWebSockets().length >= MAX_CONNECTIONS) {
        return new Response('busy', { status: 503, headers: corsHeaders(origin, this.env) });
      }
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected websocket', { status: 426 });
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      const ip =
        request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
        '0.0.0.0';

      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ ip, lastAt: 0, play: null, nameToken: null } satisfies SocketMeta);

      const now = Date.now();
      const room = await this.load(now);
      server.send(JSON.stringify(snapshot(room, now, this.ctx.getWebSockets().length)));
      this.broadcastSnapshot();

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('not found', { status: 404, headers: corsHeaders(origin, this.env) });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') {
      ws.send(JSON.stringify({ type: 'error', code: 'invalid' }));
      return;
    }

    const parsed = parseClientMessage(message);
    const now = Date.now();

    if (!parsed.ok) {
      ws.send(JSON.stringify({ type: 'error', code: parsed.code }));
      return;
    }

    if (parsed.kind === 'hello') {
      ws.send(JSON.stringify(snapshot(await this.load(now), now, this.ctx.getWebSockets().length)));
      return;
    }

    const meta = (ws.deserializeAttachment() as SocketMeta | null) ?? {
      ip: '0.0.0.0',
      lastAt: 0,
      play: null,
      nameToken: null,
    };

    if (parsed.kind === 'name') {
      const result = applyName(await this.load(now), parsed.nameId, meta.nameToken, now);
      await this.commit(result.room);
      if (!result.ok) {
        ws.send(
          JSON.stringify({
            type: 'error',
            code: result.code,
            text:
              result.code === 'invalid'
                ? 'Pick a name from the list.'
                : result.code === 'not_catcher'
                  ? 'Only the catcher can pick the name.'
                  : result.code === 'too_late'
                    ? 'The naming window closed.'
                    : 'That dog already has a name.',
          }),
        );
        this.sendSnapshot(ws, result.room, now);
        return;
      }
      ws.serializeAttachment({ ...meta, nameToken: null } satisfies SocketMeta);
      this.broadcast(snapshot(result.room, now, this.ctx.getWebSockets().length));
      this.broadcast({ type: 'event', text: result.event.text, at: result.event.at });
      return;
    }

    if (parsed.kind === 'start') {
      const room = await this.load(now);
      const allowed =
        parsed.game === 'catch' ? canStartCatch(room, now) : canStartCare(room, parsed.game, now);
      if (!allowed.ok) {
        ws.send(
          JSON.stringify({
            type: 'error',
            code: allowed.code,
            retryAfterMs: allowed.retryAfterMs,
          }),
        );
        return;
      }
      const play: PlaySession = {
        playId: crypto.randomUUID(),
        game: parsed.game,
        startedAt: now,
      };
      ws.serializeAttachment({ ...meta, play } satisfies SocketMeta);
      ws.send(JSON.stringify({ type: 'play', playId: play.playId, game: play.game, startedAt: now }));
      return;
    }

    const gated = await this.gate(ws, meta, now);
    if (!gated) return;

    if (parsed.kind === 'pet') {
      const result = applyPet(await this.load(now), now);
      await this.commit(result.room);
      if (!result.ok) {
        ws.send(JSON.stringify({ type: 'error', code: result.code, retryAfterMs: result.retryAfterMs }));
        this.sendSnapshot(ws, result.room, now);
        return;
      }
      this.broadcast(snapshot(result.room, now, this.ctx.getWebSockets().length));
      this.broadcast({ type: 'event', text: result.event.text, at: result.event.at });
      return;
    }

    if (parsed.kind !== 'finish') return;
    if (!meta.play || meta.play.playId !== parsed.playId) {
      ws.send(JSON.stringify({ type: 'error', code: 'invalid' }));
      return;
    }

    const invalid = validateFinish(meta.play.game, meta.play.startedAt, parsed.score, now);
    if (invalid) {
      ws.serializeAttachment({ ...meta, play: null } satisfies SocketMeta);
      ws.send(JSON.stringify({ type: 'error', code: invalid }));
      return;
    }

    const room = await this.load(now);
    const result =
      meta.play.game === 'catch'
        ? applyCatch(room, parsed.score, now)
        : applyCare(room, meta.play.game, parsed.score, now);

    const nameToken = result.ok && result.kind === 'catch' ? result.nameToken : null;
    ws.serializeAttachment({ ...gated, play: null, nameToken: nameToken ?? meta.nameToken } satisfies SocketMeta);
    await this.commit(result.room);

    if (!result.ok) {
      ws.send(JSON.stringify({ type: 'error', code: result.code, retryAfterMs: result.retryAfterMs }));
      this.sendSnapshot(ws, result.room, now);
      return;
    }

    this.broadcast(snapshot(result.room, now, this.ctx.getWebSockets().length));
    this.broadcast({ type: 'event', text: result.event.text, at: result.event.at });
    if (result.kind === 'catch' && result.room.pendingName) {
      ws.send(
        JSON.stringify({
          type: 'name-please',
          until: result.room.pendingName.until,
        }),
      );
    }
  }

  async webSocketClose() {
    this.broadcastSnapshot();
  }

  async webSocketError() {
    this.broadcastSnapshot();
  }

  async alarm() {
    const now = Date.now();
    const room = await this.load(now);
    await this.commit(room);
    this.broadcast(snapshot(room, now, this.ctx.getWebSockets().length));
    await this.ctx.storage.setAlarm(now + DECAY_ALARM_MS);
  }

  private async gate(ws: WebSocket, meta: SocketMeta, now: number): Promise<SocketMeta | null> {
    const gap = takeConnectionGap(meta.lastAt, now);
    if (!gap.ok) {
      ws.send(JSON.stringify({ type: 'error', code: 'rate_limited', retryAfterMs: gap.retryAfterMs }));
      return null;
    }
    const rates = (await this.ctx.storage.get<Record<string, RateBucket>>('rates')) ?? {};
    const taken = takeRate(rates[meta.ip], now);
    if (!taken.ok) {
      ws.send(JSON.stringify({ type: 'error', code: 'rate_limited', retryAfterMs: taken.retryAfterMs }));
      return null;
    }
    rates[meta.ip] = taken.bucket;
    await this.ctx.storage.put('rates', pruneBuckets(rates, now));
    const next = { ...meta, lastAt: now };
    ws.serializeAttachment(next);
    return next;
  }

  private async load(now: number) {
    const stored = migrateRoom((await this.ctx.storage.get<RoomState>('room')) ?? createRoom(now));
    const next = applyDecay(stored, now);
    if (next !== stored) await this.commit(next);
    return next;
  }

  private async commit(room: RoomState) {
    await this.ctx.storage.put('room', room);
  }

  private sendSnapshot(ws: WebSocket, room: RoomState, now: number) {
    ws.send(JSON.stringify(snapshot(room, now, this.ctx.getWebSockets().length)));
  }

  private broadcastSnapshot() {
    const now = Date.now();
    void this.load(now).then((room) => {
      this.broadcast(snapshot(room, now, this.ctx.getWebSockets().length));
    });
  }

  private broadcast(payload: unknown) {
    fanout(
      this.ctx.getWebSockets().map((socket) => ({
        send: (data: string) => {
          try {
            socket.send(data);
          } catch {
            // closing
          }
        },
      })),
      payload,
    );
  }
}
