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
- SQLite migration `v1`

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

- Every dog starts as a puppy and grows through young → adult → senior. Good care speeds growth; neglect stunts it. Tune ages and care in `src/stages.ts`.
- Care cadence follows the stage: puppies eat and walk often (short walks); young/adult dogs need the most exercise; seniors want fewer, gentler walks. Over-walking a senior can cost energy and happiness.
- Feed and walk are mini-games. The Worker issues a `playId` on start and only accepts a finish after a plausible duration. Walk length and pace come from the stage config.
- Pet is a simple cooldown action.
- Happiness below 25 for ~3 continuous days → the dog runs away. The porch keeps a memorial and a paginated history (`GET /history`).
- While gone, visitors play a catch mini-game. A good enough score brings a new randomized dog.

## Abuse

No free-text input. Per-connection gaps, per-IP windows, action cooldowns, connection cap (80), CORS limited to saidyaka.com + localhost.
