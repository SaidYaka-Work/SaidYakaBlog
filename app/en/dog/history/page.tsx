import type { Metadata } from 'next';
import DogPlayer from '@/components/dog/DogPlayer';
import { SOCIAL, defaultOgImage, englishUrl } from '@/lib/site';

const title = 'Past dogs';
const description = 'The hall of dogs who lived out in the saidyaka.com city: how far they grew, how long they stayed.';
const url = englishUrl('/dog/history');

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

export default function DogHistoryPage() {
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <p className="sr-only">{description}</p>
      <DogPlayer initialPanel="hall" />
    </>
  );
}
