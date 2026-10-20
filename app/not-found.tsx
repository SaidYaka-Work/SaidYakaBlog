import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-xl flex-col justify-center px-6">
      <p className="text-sm uppercase tracking-[0.18em] text-[var(--faint)]">404</p>
      <h1 className="mt-3 font-serif text-5xl tracking-tight">Page not found</h1>
      <p className="mt-4 text-[var(--muted)]">
        That URL doesn&apos;t exist. The writing is still here, just one click over.
      </p>
      <div className="mt-8 flex gap-5 text-sm">
        <Link href="/en/" className="text-[var(--ink)] underline underline-offset-4">
          Home
        </Link>
        <Link href="/en/posts/" className="text-[var(--muted)] hover:text-[var(--ink)]">
          All posts
        </Link>
      </div>
    </main>
  );
}
