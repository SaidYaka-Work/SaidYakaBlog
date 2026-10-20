export const retiredLocales = ['de', 'fr', 'ja', 'tr'] as const;
export type RetiredLocale = (typeof retiredLocales)[number];

/** Slug that existed only as a translation (no English MDX). */
export const translationOnlySlugs = ['perplexity-comet-browser'] as const;

export const retiredStaticPaths = [
  '',
  'posts',
  'tags',
  'about',
  'games',
  'play',
] as const;
