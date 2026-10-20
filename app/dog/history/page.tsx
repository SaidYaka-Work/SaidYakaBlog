import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export const metadata = localeRedirectMetadata('/en/dog/history/');

export default function DogHistoryAlias() {
  return <LocaleRedirect to="/en/dog/history/" />;
}
