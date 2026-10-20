import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export const metadata = localeRedirectMetadata('/en/about/');

export default function AboutAlias() {
  return <LocaleRedirect to="/en/about/" />;
}
