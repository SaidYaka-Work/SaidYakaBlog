'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import MotionRoot from './MotionRoot';

const nav = [
  { href: '/en/posts/', label: 'Writing' },
  { href: '/en/tags/', label: 'Topics' },
  { href: '/en/games/', label: 'Play' },
  { href: '/en/dog/', label: 'Dog' },
  { href: '/en/about/', label: 'About' },
];

function isActive(pathname: string, href: string) {
  if (href === '/en/') return pathname === '/en' || pathname === '/en/';
  return pathname === href || pathname.startsWith(href);
}

function isDogPath(pathname: string) {
  return pathname === '/en/dog' || pathname === '/en/dog/' || pathname.startsWith('/en/dog/history');
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const [open, setOpen] = useState(false);
  const dogGame = isDogPath(pathname);
  const [navShown, setNavShown] = useState(true);

  useEffect(() => {
    if (!dogGame) {
      setNavShown(true);
      return;
    }
    setNavShown(true);
    const hide = window.setTimeout(() => setNavShown(false), 1800);
    const onMove = (event: PointerEvent) => {
      const hit = event.target;
      const overHud =
        hit instanceof Element &&
        hit.closest('.dog-chip, .dog-travel, .dog-back, .dog-action, .dog-stick, button, a');
      setNavShown((event.clientY < 8 && !overHud) || open);
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.clearTimeout(hide);
      window.removeEventListener('pointermove', onMove);
    };
  }, [dogGame, open, pathname]);

  return (
    <div className={dogGame ? 'dog-game-shell' : 'relative flex min-h-screen flex-col'}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-[var(--ink)] focus:px-4 focus:py-2 focus:text-[var(--bg)]"
      >
        Skip to content
      </a>

      <MotionRoot />
      <header
        className={`${
          dogGame ? `dog-nav ${navShown || open ? 'is-shown' : ''}` : 'sticky top-0'
        } z-50 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-xl transition-colors duration-500`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:h-[4.25rem] sm:px-8">
          <Link
            href="/en/"
            className="font-serif text-xl tracking-tight text-[var(--ink)] transition-colors duration-300 hover:text-[var(--accent)] sm:text-2xl"
          >
            Said Yaka
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-active={isActive(pathname, item.href)}
                className={`nav-link text-sm tracking-wide ${
                  isActive(pathname, item.href)
                    ? 'text-[var(--ink)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <ThemeToggle />
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)]"
              aria-expanded={open}
              aria-label="Open menu"
              onClick={() => setOpen((value) => !value)}
            >
              <span className="sr-only">Menu</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                {open ? (
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" />
                ) : (
                  <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <nav
            className="border-t border-[var(--line)] px-5 py-4 md:hidden"
            aria-label="Mobile"
          >
            <div className="flex flex-col gap-3">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`py-1 text-base ${
                    isActive(pathname, item.href) ? 'text-[var(--ink)]' : 'text-[var(--muted)]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="mt-auto border-t border-[var(--line)] transition-colors duration-500">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div>
            <p className="font-serif text-xl text-[var(--ink)]">Said Yaka</p>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
              AI engineering notes from shipping retrieval, evals, and production LLM systems.
            </p>
          </div>
          <p className="text-sm text-[var(--faint)]">
            © {new Date().getFullYear()} Said Yaka
          </p>
        </div>
      </footer>
    </div>
  );
}
