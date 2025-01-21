import Head from 'next/head';
import config from '../../../config.json';

interface TwitterCardMetaProps {
  title?: string;
  description?: string;
  url: string;
  image?: string;
}

export default function TwitterCardMeta({
  title,
  description,
  url,
  image,
}: TwitterCardMetaProps) {
  return (
    <Head>
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={config.twitter_account} />
      <meta name="twitter:title" content={title || config.site_title} />
      <meta name="twitter:description" content={description || config.site_description} />
      <meta name="twitter:image" content={image || `${config.base_url}/og-image.png`} />
      <meta name="twitter:url" content={`${config.base_url}${url}`} />
    </Head>
  );
} 