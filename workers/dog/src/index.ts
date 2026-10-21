import { originAllowed } from './logic';
import { DogRoom, type Env } from './dog';

export { DogRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      const allowed = origin && originAllowed(origin, env.ALLOWED_ORIGINS) ? origin : '';
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          Vary: 'Origin',
        },
      });
    }

    if (url.pathname === '/health') {
      const allowed = origin && originAllowed(origin, env.ALLOWED_ORIGINS) ? origin : '';
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'no-store',
          Vary: 'Origin',
        },
      });
    }

    if (origin && !originAllowed(origin, env.ALLOWED_ORIGINS)) {
      return new Response('origin not allowed', { status: 403 });
    }

    const id = env.DOG.idFromName('biscuit');
    return env.DOG.get(id).fetch(request);
  },
};
