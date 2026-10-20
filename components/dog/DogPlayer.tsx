'use client';

import dynamic from 'next/dynamic';

const DogRoom = dynamic(() => import('./DogRoom'), {
  ssr: false,
  loading: () => (
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="h-10 w-48 animate-pulse rounded bg-[var(--line)]" />
      <div className="mt-8 h-[320px] animate-pulse rounded-[1.6rem] border border-[var(--line)] bg-[var(--bg-elevated)]" />
    </section>
  ),
});

export default function DogPlayer() {
  return <DogRoom />;
}
