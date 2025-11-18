import { redirect } from 'next/navigation';
import { defaultLocale } from '@/lib/i18n/config';

// Root redirect page - redirects to default locale
export default function RootPage() {
  redirect(`/${defaultLocale}`);
}
