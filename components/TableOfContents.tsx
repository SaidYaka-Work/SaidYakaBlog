'use client';

import { useEffect, useState } from 'react';

interface Heading {
  id: string;
  text: string;
  level: number;
}

export default function TableOfContents({ content }: { content: string }) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const headingElements = tempDiv.querySelectorAll('h2, h3, h4');
    const extracted: Heading[] = Array.from(headingElements).map((heading, index) => ({
      id: heading.id || `heading-${index}`,
      text: heading.textContent || '',
      level: parseInt(heading.tagName.substring(1), 10),
    }));
    setHeadings(extracted);

    const article = document.querySelector('article');
    if (article) {
      article.querySelectorAll('h2, h3, h4').forEach((heading, index) => {
        if (!heading.id) heading.id = extracted[index]?.id || `heading-${index}`;
      });
    }
  }, [content]);

  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: '-90px 0px -70% 0px' }
    );

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="On this page" className="sticky top-28">
      <p className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--faint)]">On this page</p>
      <ul className="space-y-2 border-l border-[var(--line)]">
        {headings.map(({ id, text, level }) => (
          <li key={id} style={{ paddingLeft: `${(level - 2) * 12 + 12}px` }}>
            <a
              href={`#${id}`}
              className={`block py-0.5 text-sm leading-snug transition ${
                activeId === id
                  ? 'text-[var(--ink)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
