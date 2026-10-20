import type { Metadata } from 'next';
import { canonicalUrl } from '@/lib/site';

export function localeRedirectMetadata(to: string): Metadata {
  const href = canonicalUrl(to);
  return {
    title: 'Redirecting to English',
    description: 'This localized page now lives on the English version of saidyaka.com.',
    robots: { index: false, follow: true },
    alternates: {
      canonical: href,
      languages: {
        en: href,
        'x-default': href,
      },
    },
  };
}

export default function LocaleRedirect({ to }: { to: string }) {
  const href = to.endsWith('/') || /\.[a-z0-9]+$/i.test(to) ? to : `${to}/`;

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-6 py-24">
      <meta httpEquiv="refresh" content={`0;url=${href}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.location.replace(${JSON.stringify(href)});`,
        }}
      />
      <p className="text-sm uppercase tracking-[0.18em] text-[var(--faint)]">Moved</p>
      <h1 className="mt-3 font-serif text-4xl text-[var(--ink)]">This page is now in English</h1>
      <p className="mt-4 text-[var(--muted)] leading-relaxed">
        The translated version was removed. Continue to the English page if you are not redirected
        automatically.
      </p>
      <a
        href={href}
        className="mt-8 inline-flex w-fit items-center gap-2 text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--accent)]"
      >
        Continue to {href}
      </a>
    </main>
  );
}
