import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export const metadata = localeRedirectMetadata('/en/dog/');

export default function DogAlias() {
  return <LocaleRedirect to="/en/dog/" />;
}
