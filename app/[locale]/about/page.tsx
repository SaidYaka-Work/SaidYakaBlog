import { type Locale } from '@/lib/i18n/config';
import { getTranslation } from '@/lib/i18n/translations';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(locale, key);

  return {
    title: t('about.metaTitle'),
    description: t('about.metaDescription'),
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(locale, key);

  // JSON-LD Schema for Person
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Said Yaka',
    jobTitle: 'AI Engineer',
    worksFor: {
      '@type': 'Organization',
      name: 'Evertune.ai',
      url: 'https://evertune.ai',
    },
    url: 'https://saidyaka.com',
    sameAs: [
      'https://github.com/SaidYaka-Work',
      'https://www.linkedin.com/in/saidyaka/',
      'https://x.com',
    ],
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
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center mb-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-primary rounded-full blur-2xl opacity-30 animate-pulse"></div>
            <img
              src="/images/profile.jpg"
              alt="Said Yaka - AI Engineer"
              className="relative rounded-full w-56 h-56 object-cover shadow-2xl ring-4 ring-white"
            />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-3">{t('about.title')}</h1>
          <p className="text-gray-600 text-lg">{t('about.subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-10 border-2 border-primary-100 mb-8">
          <p 
            className="text-2xl text-gray-800 mb-8 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: t('about.intro') }}
          />

          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            {t('about.paragraph1')}
          </p>

          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            {t('about.paragraph2')}
          </p>

          <p className="text-lg text-gray-700 mb-8 leading-relaxed">
            {t('about.paragraph3')}
          </p>

          <div className="border-t-2 border-primary-100 pt-8">
            <h2 className="text-3xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">{t('about.connectTitle')}</h2>
            <div className="flex flex-wrap gap-4">
              <a
                href="https://github.com/SaidYaka-Work"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-50 to-accent-50 text-primary-700 rounded-full hover:from-primary-500 hover:to-accent-500 hover:text-white transition-all duration-300 font-semibold border-2 border-primary-200 hover:border-transparent shadow-md hover:shadow-xl hover:scale-105"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" clipRule="evenodd" />
                </svg>
                {t('about.github')}
              </a>
              <a
                href="https://www.linkedin.com/in/saidyaka/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-50 to-accent-50 text-primary-700 rounded-full hover:from-primary-500 hover:to-accent-500 hover:text-white transition-all duration-300 font-semibold border-2 border-primary-200 hover:border-transparent shadow-md hover:shadow-xl hover:scale-105"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                {t('about.linkedin')}
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-50 to-accent-50 text-primary-700 rounded-full hover:from-primary-500 hover:to-accent-500 hover:text-white transition-all duration-300 font-semibold border-2 border-primary-200 hover:border-transparent shadow-md hover:shadow-xl hover:scale-105"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                {t('about.twitter')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
