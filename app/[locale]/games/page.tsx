import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export const metadata = localeRedirectMetadata('/en/games/');

export default function RetiredGames() {
  return <LocaleRedirect to="/en/games/" />;
}
