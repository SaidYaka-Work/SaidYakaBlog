import config from '@/config.json';

export const SITE_URL = config.base_url.replace(/\/$/, '');
export const SITE_NAME = config.author_name;
export const SITE_TITLE = config.site_title;
export const SITE_DESCRIPTION = config.site_description;
export const AUTHOR_NAME = config.author_name;
export const AUTHOR_DESCRIPTION = config.author_description;

export const SOCIAL = {
  github: `https://github.com/${config.github_account}`,
  githubAlt: 'https://github.com/SaidYaka-Work',
  linkedin: 'https://www.linkedin.com/in/saidyaka/',
  twitter: `https://x.com/${config.social.twitter}`,
  twitterHandle: `@${config.social.twitter}`,
};

export const ENGLISH_PREFIX = '/en';

/** Absolute canonical URL. Trailing slashes match next.config `trailingSlash: true`. */
export function canonicalUrl(path: string): string {
  if (!path || path === '/') {
    return `${SITE_URL}/`;
  }
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  if (/\.[a-z0-9]+$/i.test(withLeading)) {
    return `${SITE_URL}${withLeading}`;
  }
  const withTrailing = withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
  return `${SITE_URL}${withTrailing}`;
}

export function englishUrl(path = '/'): string {
  if (!path || path === '/') {
    return canonicalUrl(`${ENGLISH_PREFIX}/`);
  }
  const stripped = path.replace(/^\/en(?=\/|$)/, '');
  const next = stripped.startsWith('/') ? stripped : `/${stripped}`;
  return canonicalUrl(`${ENGLISH_PREFIX}${next === '/' ? '/' : next}`);
}

export function englishPath(path = '/'): string {
  if (!path || path === '/') return `${ENGLISH_PREFIX}/`;
  const stripped = path.replace(/^\/en(?=\/|$)/, '');
  const next = stripped.startsWith('/') ? stripped : `/${stripped}`;
  const combined = `${ENGLISH_PREFIX}${next === '/' ? '/' : next}`;
  return combined.endsWith('/') ? combined : `${combined}/`;
}

export function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function readingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export const defaultOgImage = '/images/profile.jpg';
