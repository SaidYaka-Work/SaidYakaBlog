import type { Metadata } from 'next';
import DogPlayer from '@/components/dog/DogPlayer';
import { SOCIAL, defaultOgImage, englishUrl } from '@/lib/site';

const title = 'Biscuit, the internet’s dog';
const description =
  'One shared dog for everyone on saidyaka.com. Pet him, feed him, walk him, and keep him from running away.';
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
  return <DogPlayer />;
}
