import LocaleRedirect, { localeRedirectMetadata } from '@/components/LocaleRedirect';

export const metadata = localeRedirectMetadata('/en/posts/');

export default function RetiredPosts() {
  return <LocaleRedirect to="/en/posts/" />;
}
