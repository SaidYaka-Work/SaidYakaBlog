import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export const metadata = localeRedirectMetadata('/en/fakegpt/');

export default function FakeGptAlias() {
  return <LocaleRedirect to="/en/fakegpt/" />;
}
