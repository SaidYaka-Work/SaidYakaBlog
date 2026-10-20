import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export const metadata = localeRedirectMetadata('/en/');

export default function RootPage() {
  return <LocaleRedirect to="/en/" />;
}
