# FakeGPT Worker

Daily challenge prompts, drawing/sound judging, and short in-character chat for `/en/fakegpt/`.

Nothing the player makes is stored. Images and audio are scored in memory and discarded.

## Models

| Job | Model | Why |
| --- | --- | --- |
| Daily set + persona chat | `@cf/meta/llama-3.2-1b-instruct` | Cheapest Llama instruct on Workers AI |
| Drawing judge | `@cf/llava-hf/llava-1.5-7b-hf` | Smallest dedicated image-to-text model currently listed |
| Sound transcript | `@cf/openai/whisper` | Cheaper than `whisper-large-v3-turbo` |

Pricing: [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) (10,000 neurons/day free; $0.011 / 1,000 neurons after).

## Deploy

From this folder, on a machine logged into Said's Cloudflare account:

```bash
npx wrangler kv namespace create FAKEGPT
npx wrangler kv namespace create FAKEGPT --preview
```

Paste the two ids into `wrangler.toml` (`id` and `preview_id`).

```bash
npx wrangler deploy
```

`wrangler.toml` already has:

- `name = "saidyaka-fakegpt"`
- `account_id = "06bf4532eebfba00e18e7c9bf7ba85c2"` (same account as the dog Worker)
- `[ai] binding = "AI"`
- KV binding `FAKEGPT`
- Cron `5 0 * * *` (pre-generate the UTC daily set)

Wrangler prints a URL like:

```
https://saidyaka-fakegpt.<your-workers-subdomain>.workers.dev
```

Paste that origin into `lib/fakegpt.ts` (`PRODUCTION_FAKEGPT_WORKER_URL`) and/or the GitHub Actions variable `NEXT_PUBLIC_FAKEGPT_WORKER_URL`, then rebuild the site.

## Local

```bash
npm install
npm test
npx wrangler dev --port 8788
```

Point the site at it with `NEXT_PUBLIC_FAKEGPT_WORKER_URL=http://127.0.0.1:8788`.

If Workers AI is unavailable locally, `/daily`, `/judge`, and `/chat` still return a validated fallback so the game never blocks.

## Endpoints

- `GET /health`
- `GET /daily?date=YYYY-MM-DD` (defaults to today UTC)
- `POST /judge` drawing/audio/soundboard scoring
- `POST /chat` one short persona reply

Rate limits (KV): 24 judge / 40 chat / 60 daily reads per IP per hour. Global cap: 280 AI calls/UTC day, then fallback.
