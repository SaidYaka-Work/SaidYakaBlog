import fs from 'fs';
import path from 'path';
import { Locale } from '@/lib/i18n/config';
import { getTranslation } from '@/lib/i18n/translations';

export default function Games({ params }: { params: { locale: Locale } }) {
  const t = (key: any) => getTranslation(params.locale, key);
  const gamesDir = path.join(process.cwd(), 'public', 'games');
  let games = [] as {slug:string,title:string}[];
  try {
    const items = fs.readdirSync(gamesDir, { withFileTypes: true });
    games = items.filter(i=>i.isDirectory()).map(d=>({slug:d.name,title:d.name.replace(/-/g,' ').replace(/\w/g,c=>c.toUpperCase())}));
  } catch(e) {
    games = [];
  }
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">{t('nav.games')}</h1>
      {games.length === 0 ? (
        <p>No games found.</p>
      ) : (
        <ul className="space-y-3">
          {games.map(g => (
            <li key={g.slug}>
              <a href={`/games/${g.slug}/index.html`} className="text-primary-600 underline">{g.title}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
