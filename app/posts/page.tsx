import { redirect } from 'next/navigation';
import { defaultLocale } from '@/lib/i18n/config';

// Redirect old posts list URL without locale to English version
export default function OldPostsRedirect() {
  redirect(`/${defaultLocale}/posts`);
}


