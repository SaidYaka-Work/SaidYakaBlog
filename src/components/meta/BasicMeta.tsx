import Head from 'next/head';
import config from '../../../config.json';

interface BasicMetaProps {
  title?: string;
  description?: string;
  keywords?: string[];
  author?: string;
  url: string;
}

export default function BasicMeta({
  title,
  description,
  keywords,
  author,
  url,
}: BasicMetaProps) {
  return (
    <Head>
      <title>{title ? `${title} | ${config.site_title}` : config.site_title}</title>
      <meta name="description" content={description || config.site_description} />
      <meta name="keywords" content={keywords?.join(', ') || config.keywords?.join(', ')} />
      <meta name="author" content={author || config.author_name} />
      <link rel="canonical" href={`${config.base_url}${url}`} />
    </Head>
  );
} 