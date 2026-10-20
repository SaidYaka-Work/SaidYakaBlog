'use client';

import dynamic from 'next/dynamic';

const HistoryBoard = dynamic(() => import('./HistoryBoard'), {
  ssr: false,
  loading: () => <p className="mt-10 text-[var(--muted)]">Opening the kennel book…</p>,
});

export default function HistoryPlayer() {
  return <HistoryBoard />;
}
