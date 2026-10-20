import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export const metadata = localeRedirectMetadata('/en/tags/');

export default function RetiredTags() {
  return <LocaleRedirect to="/en/tags/" />;
}
