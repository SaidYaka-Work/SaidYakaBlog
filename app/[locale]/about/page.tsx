import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export const metadata = localeRedirectMetadata('/en/about/');

export default function RetiredAbout() {
  return <LocaleRedirect to="/en/about/" />;
}
