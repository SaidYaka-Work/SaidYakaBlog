import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export const metadata = localeRedirectMetadata('/en/fakegpt/');

export default function RetiredFakeGpt() {
  return <LocaleRedirect to="/en/fakegpt/" />;
}
