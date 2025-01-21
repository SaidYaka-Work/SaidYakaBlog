import Head from 'next/head';
import config from '../../../config.json';

interface OpenGraphMetaProps {
  title?: string;
  description?: string;
  url: string;
  image?: string;
}

export default function OpenGraphMeta({
  title,
  description,
  url,
  image,
}: OpenGraphMetaProps) {
  return (
    <Head>
      <meta property="og:site_name" content={config.site_title} />
      <meta property="og:title" content={title || config.site_title} />
      <meta property="og:description" content={description || config.site_description} />
      <meta property="og:url" content={`${config.base_url}${url}`} />
      <meta property="og:image" content={image || `${config.base_url}/og-image.png`} />
      <meta property="og:type" content="website" />
    </Head>
  );
} 