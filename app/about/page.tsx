import { redirect } from 'next/navigation';
import { defaultLocale } from '@/lib/i18n/config';

// Redirect old about URL without locale to English version
export default function OldAboutRedirect() {
  redirect(`/${defaultLocale}/about`);
}


