import type { Metadata } from 'next';
import { AUTHOR_NAME, SITE_URL, SOCIAL, englishUrl } from '@/lib/site';
import SocialLinks from '@/components/SocialLinks';

export const metadata: Metadata = {
  title: 'About',
  description: 'Software engineer at Evertune.ai building AI-driven systems that scale.',
  alternates: {
    canonical: englishUrl('/about'),
    languages: {
      en: englishUrl('/about'),
      'x-default': englishUrl('/about'),
    },
  },
  openGraph: {
    title: 'About | Said Yaka',
    description: 'Software engineer at Evertune.ai building AI-driven systems that scale.',
    url: englishUrl('/about'),
    type: 'profile',
    locale: 'en_US',
  },
};

export default function AboutPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: AUTHOR_NAME,
    jobTitle: 'AI Engineer',
    url: SITE_URL,
    image: `${SITE_URL}/images/profile.jpg`,
    worksFor: {
      '@type': 'Organization',
      name: 'Evertune.ai',
      url: 'https://evertune.ai',
    },
    sameAs: [SOCIAL.githubAlt, SOCIAL.linkedin, SOCIAL.twitter],
    knowsAbout: [
      'Artificial Intelligence',
      'Machine Learning',
      'RAG Systems',
      'LLM Engineering',
      'Software Engineering',
    ],
    description: 'Software engineer at Evertune.ai building AI-driven systems that scale.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="mb-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/profile.jpg"
            alt="Portrait of Said Yaka, AI engineer"
            width={160}
            height={160}
            className="hero-kicker h-28 w-28 rounded-full object-cover ring-1 ring-[var(--line)] sm:h-36 sm:w-36"
          />
          <h1 className="hero-title mt-8 font-serif text-5xl tracking-tight sm:text-6xl">About</h1>
          <p className="hero-copy mt-3 text-lg text-[var(--muted)]">AI engineer and software developer</p>
        </div>

        <div className="space-y-6 text-lg leading-relaxed text-[var(--muted)]" data-reveal>
          <p>
            Hi, I&apos;m <span className="text-[var(--ink)]">Said Yaka</span> — a software engineer
            at{' '}
            <a
              href="https://evertune.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline text-[var(--ink)]"
            >
              Evertune.ai
            </a>
            , where I design and build AI-driven systems that scale.
          </p>
          <p>
            I write about AI engineering, retrieval-augmented generation, evaluation frameworks,
            and the practical side of getting LLMs production-ready.
          </p>
          <p>
            Before diving deep into AI infra, I worked across web and data stacks, and I love
            turning complex ideas into clean, resilient code.
          </p>
          <p>
            This site is where I share my notes, experiments, and lessons learned from shipping
            real AI features.
          </p>
        </div>

        <section className="mt-14 border-t border-[var(--line)] pt-8" data-reveal>
          <h2 className="font-serif text-3xl tracking-tight">Let’s connect</h2>
          <SocialLinks className="mt-5 text-base" />
        </section>
      </div>
    </>
  );
}
