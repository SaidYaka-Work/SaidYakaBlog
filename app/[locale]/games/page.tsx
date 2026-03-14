import Link from 'next/link';
import { Locale } from '@/lib/i18n/config';
import { getTranslation } from '@/lib/i18n/translations';

export default function Games({ params }: { params: { locale: Locale } }) {
  const t = (key: any) => getTranslation(params.locale, key);
  const games = [
    { slug: 'night-market', title: 'Night Market Scramble' },
  ];
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">{t('nav.games')}</h1>
      <ul className="space-y-3">
        {games.map(g => (
          <li key={g.slug}>
            <a href={`/games/${g.slug}/index.html`} className="text-primary-600 underline">{g.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
