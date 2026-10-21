# Biscuit — the internet's dog

One shared Tamagotchi-style dog for saidyaka.com. State lives in a single Cloudflare Durable Object and is broadcast to every visitor over WebSockets.

## Deploy (one command)

From this folder, on a machine logged into Said's Cloudflare account:

```bash
npx wrangler deploy
```

That is the only deploy step. `wrangler.toml` already has:

- `name = "saidyaka-dog"`
- `account_id = "06bf4532eebfba00e18e7c9bf7ba85c2"`
- Durable Object binding `DOG` → `DogRoom`
- Durable Object binding `DAILY` → `DailyStats` (anonymous Unknown Number totals)
- SQLite migrations `v1` (DogRoom) and `v2-daily-stats` (DailyStats)

Wrangler will print the live URL, which looks like:

```
https://saidyaka-dog.<your-workers-subdomain>.workers.dev
```

Paste that origin into `lib/dog.ts` (`PRODUCTION_DOG_WORKER_URL`) and rebuild the site.

## Local

```bash
npm install
npm test
npx wrangler dev
```

`wrangler dev` serves `http://127.0.0.1:8787`. Point the frontend at it with `NEXT_PUBLIC_DOG_WORKER_URL=http://127.0.0.1:8787`.

## Rules (all server-side)

- Every dog starts as a puppy and grows through young → adult → senior. Good care speeds growth; neglect stunts it. Tune ages and care in `src/stages.ts` only.
- Care cadence and intensity follow the stage: puppies eat and walk often (short, easy loops and small meals); young/adult dogs need the most total exercise (longer, faster walks, energy that drains faster); seniors want fewer, gentler, shorter walks and tire quickly. A vigorous senior walk can cost energy and happiness.
- Every dog gets a generated genome (coat, pattern, ears, tail, snout, build, eyes, markings, accessory) from a stored seed. The same genome renders at every life stage. History keeps the genome so past-dog cards look like him.
- The catcher names a new dog by picking from the curated list in `src/names.ts` (~1000 wholesome names). No free-text path. One name per catch, catcher token only, 60s window, then a random list name. The last 24 porch names are skipped when possible. Rejected picks can retry inside the window.
- Feed and walk are mini-games. The Worker issues a `playId` on start and only accepts a finish after a plausible duration. Walk length, pace, spawn density, and meal size come from the stage config.
- Pet is a simple cooldown action.
- Shared position lives on the Durable Object (`yard` in room state). Clients send `{ type: "move", ax, az, run }` at ~12 Hz. The first visitor to move takes a leash (5s idle / 90s max, then a per-IP cooldown). Others receive `{ type: "pose" }` broadcasts. `{ type: "bowl" }` fills the feeder; eating only counts when he is inside the feeder radius and stage feed rules allow it. Leashed distance credits a walk (8 m) under the same stage walk rules, capped at 40 m/session and 80 m/hour.
- Older frontends ignore the extra snapshot fields. Newer frontends only send `move` / `bowl` after they see `pose` on a snapshot, so an undeployed Worker stays safe.
- Happiness below 25 for ~3 continuous days → the dog runs away. The porch keeps a memorial and a paginated history (`GET /history`).
- While gone, visitors play a catch mini-game. A good enough score brings a new randomized dog.

## Abuse

No free-text input. Per-connection gaps, per-IP windows, action cooldowns, connection cap (80), CORS limited to saidyaka.com + localhost.
