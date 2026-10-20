import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-6">
      <p className="text-sm uppercase tracking-[0.18em] text-[var(--faint)]">404</p>
      <h1 className="mt-3 font-serif text-5xl tracking-tight">Page not found</h1>
      <p className="mt-4 text-[var(--muted)]">
        This localized URL is gone. The English site is still here.
      </p>
      <Link href="/en/" className="mt-8 text-[var(--ink)] underline underline-offset-4">
        Go to the English home page
      </Link>
    </main>
  );
}
