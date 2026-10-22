import type { Metadata } from 'next';
import DogPlayer from '@/components/dog/DogPlayer';
import { SOCIAL, defaultOgImage, englishUrl } from '@/lib/site';

const title = 'Biscuit, the internet’s dog';
const description =
  'One shared dog for everyone on saidyaka.com. He lives in a real city. Walk him, feed him, then travel the world together.';
const url = englishUrl('/dog');

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

export default function DogPage() {
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <p className="sr-only">{description}</p>
      <DogPlayer />
    </>
  );
}
