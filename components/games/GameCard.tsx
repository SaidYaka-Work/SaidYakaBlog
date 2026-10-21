import type { CSSProperties } from 'react';
import Link from 'next/link';
import type { GameMeta } from '@/lib/games';

export default function GameCard({
  game,
  index,
  featured = false,
}: {
  game: GameMeta;
  index: number;
  featured?: boolean;
}) {
  const isInternal = game.href.startsWith('/en/');
  const className =
    'lift-card group block overflow-hidden rounded-[1.6rem] border border-[var(--line)] bg-[var(--bg-elevated)]';
  const body = (
    <>
      <GamePreview tone={game.tone} featured={featured} />
      <div className={featured ? 'p-6 sm:p-8' : 'p-6'}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{game.genre}</p>
          {game.daily ? (
            <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
              Daily
            </span>
          ) : null}
        </div>
        <h2 className={`mt-3 font-serif tracking-tight ${featured ? 'text-4xl sm:text-5xl' : 'text-3xl'}`}>
          {game.title}
        </h2>
        <p className="mt-3 leading-relaxed text-[var(--muted)]">{game.tagline}</p>
        <p className="mt-4 text-sm text-[var(--ink)]">Play →</p>
      </div>
    </>
  );

  return (
    <li data-reveal style={{ '--reveal-delay': index } as CSSProperties}>
      {isInternal ? (
        <Link href={game.href} className={className}>
          {body}
        </Link>
      ) : (
        <a href={game.href} className={className}>
          {body}
        </a>
      )}
    </li>
  );
}

function GamePreview({ tone, featured = false }: { tone: GameMeta['tone']; featured?: boolean }) {
  return (
    <div className={`relative overflow-hidden ${featured ? 'h-44 sm:h-52' : 'h-36'}`} aria-hidden="true">
      <div className="absolute inset-0 bg-[#16120f]" />
      {tone === 'orbit' && (
        <>
          <span className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e8a87c]/25" />
          <span className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e8a87c]/40" />
          <span className="absolute left-[62%] top-[28%] h-3 w-3 rounded-full bg-[#f0d8c8] shadow-[0_0_12px_#e8a87c]" />
        </>
      )}
      {tone === 'lantern' && (
        <div className="absolute inset-0 grid grid-cols-4 gap-2 p-6 opacity-80">
          {Array.from({ length: 8 }).map((_, index) => (
            <span key={index} className="rounded-md border border-[#e8a87c]/35 bg-[#2a1f18]" />
          ))}
        </div>
      )}
      {tone === 'pulse' && (
        <>
          <span className="absolute left-1/2 top-8 h-4 w-4 -translate-x-1/2 rotate-45 bg-[#e8a87c]" />
          <span className="absolute bottom-8 left-[28%] h-3 w-24 rounded-full bg-[#f0d8c8]/80" />
        </>
      )}
      {tone === 'glyph' && (
        <div className="absolute inset-0 grid grid-cols-4 gap-2 p-6 font-serif text-[#f3eee6]/80">
          {['G', 'L', 'Y', 'P', 'H', '·', 'W', 'D'].map((letter, index) => (
            <span key={index} className="grid place-items-center rounded-md bg-white/5">
              {letter}
            </span>
          ))}
        </div>
      )}
      {tone === 'shade' && (
        <div className="absolute inset-0 grid grid-cols-5 gap-1.5 p-6">
          {Array.from({ length: 10 }).map((_, index) => (
            <span
              key={index}
              className={`rounded-sm ${index % 3 === 0 ? 'bg-[#e8a87c]/70' : 'bg-white/10'}`}
            />
          ))}
        </div>
      )}
      {tone === 'rush' && (
        <span className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_30%_30%,#fde68a,#fb7185_40%,#7c3aed)] shadow-[0_0_28px_rgba(244,114,182,0.55)]" />
      )}
      {tone === 'market' && (
        <>
          <span className="absolute bottom-6 left-8 h-16 w-20 rounded-t-lg bg-[#e8a87c]/40" />
          <span className="absolute bottom-6 right-10 h-12 w-16 rounded-t-lg bg-[#f0d8c8]/30" />
        </>
      )}
      {tone === 'herd' && (
        <>
          <span className="absolute right-8 top-7 h-[4.6rem] w-14 rounded-sm border border-[#e8a87c]/40" />
          <span className="absolute left-[20%] top-[44%] h-3 w-4 rounded-full bg-[#f0d8c8]/85" />
          <span className="absolute left-[30%] top-[54%] h-3 w-4 rounded-full bg-[#f0d8c8]/75" />
          <span className="absolute left-[24%] top-[62%] h-3 w-4 rounded-full bg-[#f0d8c8]/65" />
          <span className="absolute left-[46%] bottom-9 h-3.5 w-5 rounded-full bg-[#e8a87c]" />
        </>
      )}
      {tone === 'unknown' && (
        <>
          <span className="absolute left-8 top-8 max-w-[58%] rounded-2xl rounded-bl-md bg-[#f0d8c8]/25 px-3 py-2 text-[10px] leading-relaxed text-[#f3eee6]/80">
            I left a country that no longer wanted people like me…
          </span>
          <span className="absolute bottom-7 right-8 h-8 w-24 rounded-2xl rounded-br-md bg-[#e8a87c]/70" />
          <span className="absolute bottom-10 left-10 flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f0d8c8]/80" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#f0d8c8]/55" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#f0d8c8]/35" />
          </span>
        </>
      )}
    </div>
  );
}
