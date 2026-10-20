import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export const metadata = localeRedirectMetadata('/en/play/');

export default function RetiredPlay() {
  return <LocaleRedirect to="/en/play/" />;
}
