'use client';

import { useEffect, useState } from 'react';

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
}

export default function TableOfContents({ content }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    // Extract headings from HTML content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    const headingElements = tempDiv.querySelectorAll('h2, h3, h4');
    const extractedHeadings: Heading[] = [];

    headingElements.forEach((heading, index) => {
      const text = heading.textContent || '';
      const level = parseInt(heading.tagName.substring(1));
      const id = heading.id || `heading-${index}`;

      // Add ID to heading if it doesn't have one
      if (!heading.id) {
        heading.id = id;
      }

      extractedHeadings.push({ id, text, level });
    });

    setHeadings(extractedHeadings);

    // Update the actual DOM with IDs
    const article = document.querySelector('article');
    if (article) {
      const actualHeadings = article.querySelectorAll('h2, h3, h4');
      actualHeadings.forEach((heading, index) => {
        if (!heading.id) {
          heading.id = `heading-${index}`;
        }
      });
    }
  }, [content]);

  useEffect(() => {
    // Track active heading on scroll
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-80px 0px -80% 0px' }
    );

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // Account for any fixed header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <nav className="toc-container">
      <div className="toc-sticky">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
          On This Page
        </h2>
        <ul className="space-y-2 text-sm">
          {headings.map(({ id, text, level }) => (
            <li
              key={id}
              style={{ paddingLeft: `${(level - 2) * 12}px` }}
            >
              <a
                href={`#${id}`}
                onClick={(e) => handleClick(e, id)}
                className={`block py-1 border-l-2 pl-3 transition-colors duration-200 hover:text-blue-600 hover:border-blue-600 ${
                  activeId === id
                    ? 'text-blue-600 border-blue-600 font-medium'
                    : 'text-gray-600 border-gray-200'
                }`}
              >
                {text}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <style jsx>{`
        .toc-container {
          position: relative;
        }
        .toc-sticky {
          position: sticky;
          top: 2rem;
          max-height: calc(100vh - 4rem);
          overflow-y: auto;
          padding-right: 1rem;
        }
        .toc-sticky::-webkit-scrollbar {
          width: 4px;
        }
        .toc-sticky::-webkit-scrollbar-track {
          background: transparent;
        }
        .toc-sticky::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 2px;
        }
        .toc-sticky::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </nav>
  );
}
