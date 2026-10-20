import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export const metadata = localeRedirectMetadata('/en/');

export default function RetiredHome() {
  return <LocaleRedirect to="/en/" />;
}
