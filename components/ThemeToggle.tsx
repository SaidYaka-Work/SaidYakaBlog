'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('theme');
    const preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const next: Theme = stored === 'dark' || stored === 'light' ? stored : preferDark ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
    setReady(true);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem('theme', next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      <span className="sr-only">Toggle color theme</span>
      {ready && theme === 'dark' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 4V2M12 22v-2M4.93 4.93 3.52 3.52M20.48 20.48l-1.41-1.41M4 12H2M22 12h-2M4.93 19.07 3.52 20.48M20.48 3.52l-1.41 1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 14.3A8.5 8.5 0 0 1 9.7 3 7 7 0 1 0 21 14.3Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
