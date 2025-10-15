import Layout from '@/components/Layout';

export const metadata = {
  title: 'About | Said Yaka',
  description: 'Software engineer at Evertune.ai building AI-driven systems that scale.',
};

export default function AboutPage() {
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
    <Layout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/profile.jpg"
            alt="Said Yaka - AI Engineer"
            className="rounded-full w-48 h-48 object-cover mb-6 shadow-lg"
          />
          <h1 className="text-4xl font-bold">About</h1>
        </div>

        <div className="prose lg:prose-lg">
          <p className="text-xl text-gray-700 mb-6">
            Hi, I&apos;m Said Yaka — a software engineer at <a href="https://evertune.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Evertune.ai</a>, where I design and build AI-driven systems that scale.
          </p>

          <p className="text-gray-700 mb-6">
            I write about AI engineering, retrieval-augmented generation (RAG), evaluation frameworks, and the practical side of getting LLMs production-ready.
          </p>

          <p className="text-gray-700 mb-6">
            Before diving deep into AI infra, I worked across web and data stacks, and I love turning complex ideas into clean, resilient code.
          </p>

          <p className="text-gray-700 mb-8">
            This site is where I share my notes, experiments, and lessons learned from shipping real AI features.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Connect</h2>
          <div className="flex gap-4 mb-8">
            <a
              href="https://github.com/SaidYaka-Work"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium"
            >
              GitHub
            </a>
            <span className="text-gray-400">•</span>
            <a
              href="https://www.linkedin.com/in/saidyaka/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium"
            >
              LinkedIn
            </a>
            <span className="text-gray-400">•</span>
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium"
            >
              Twitter
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
}
