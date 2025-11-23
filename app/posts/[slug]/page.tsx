import { redirect } from 'next/navigation';
import { defaultLocale } from '@/lib/i18n/config';

// Redirect old post URLs without locale to English version
export default async function OldPostRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/${defaultLocale}/posts/${slug}`);
}

