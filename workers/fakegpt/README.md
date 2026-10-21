# FakeGPT Worker

Daily trivia set, rare draw/sound bonus judging, typed-answer grading, and short in-character chat for `/en/fakegpt/`.

Nothing the player makes is stored. Images and audio are scored in memory and discarded.

## Models

| Job | Model | Why |
| --- | --- | --- |
| Daily set + persona chat | `@cf/meta/llama-3.1-8b-instruct-fast` | Supports JSON Schema `response_format`; 1B instruct cannot emit valid JSON |
| Drawing judge | `@cf/llava-hf/llava-1.5-7b-hf` | Smallest dedicated image-to-text model currently listed (`description` field) |
| Sound transcript | `@cf/openai/whisper` | Cheaper than `whisper-large-v3-turbo` |

Pricing: [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) (10,000 neurons/day free; $0.011 / 1,000 neurons after).

## Deploy

From this folder, on a machine logged into Said's Cloudflare account:

KV namespace ids are already in `wrangler.toml`. After a deploy, delete any leftover `daily:YYYY-MM-DD` keys (pre-v2 cache) if today's set is still a fallback.

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

If Workers AI is unavailable locally, `/daily`, `/judge`, `/grade`, and `/chat` still return a validated fallback so the game never blocks.

## Endpoints

- `GET /health`
- `GET /daily?date=YYYY-MM-DD` (defaults to today UTC)
- `POST /grade` yes/no grade for an ambiguous typed answer
- `POST /judge` drawing/audio/soundboard scoring (bonus rounds)
- `POST /chat` one short persona reply

Rate limits (KV): 24 judge / 30 grade / 40 chat / 60 daily reads per IP per hour. Global cap: 280 AI calls/UTC day, then fallback.
