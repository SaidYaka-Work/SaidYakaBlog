import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export const metadata = localeRedirectMetadata('/en/tags/');

export default function TagsAlias() {
  return <LocaleRedirect to="/en/tags/" />;
}
