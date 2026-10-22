import type { Metadata } from 'next';
import FakeGptGame from '@/components/games/fakegpt/Game';
import { SOCIAL, defaultOgImage, englishUrl } from '@/lib/site';

const title = 'FakeGPT';
const description =
  'You are the chatbot, secretly doing every job by hand. Customers join as levels get harder — each with a queue and a patience meter.';
const url = englishUrl('/fakegpt');

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    locale: 'en_US',
    url,
    images: [{ url: defaultOgImage, alt: title }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    creator: SOCIAL.twitterHandle,
  },
  alternates: {
    canonical: url,
    languages: { en: url, 'x-default': url },
  },
};

export default function FakeGptPage() {
  return <FakeGptGame />;
}
