/**
 * Live Cloudflare Worker origin for FakeGPT daily sets and judging.
 *
 * After `npx wrangler deploy` from `workers/fakegpt`, paste the printed
 * `https://saidyaka-fakegpt.<subdomain>.workers.dev` URL here (no trailing slash).
 * `NEXT_PUBLIC_FAKEGPT_WORKER_URL` overrides this at build time if set.
 */
export const PRODUCTION_FAKEGPT_WORKER_URL = 'https://saidyaka-fakegpt.saidyaka.workers.dev';

export function fakegptWorkerUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_FAKEGPT_WORKER_URL?.trim();
  return (fromEnv || PRODUCTION_FAKEGPT_WORKER_URL).replace(/\/$/, '');
}
