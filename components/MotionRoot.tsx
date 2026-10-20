'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function MotionRoot() {
  const pathname = usePathname();

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) return;

    document.documentElement.dataset.motion = 'on';

    const items = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const inFirstView = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );

    items.forEach((el) => {
      if (inFirstView(el)) {
        el.classList.add('is-in');
        return;
      }
      el.classList.add('will-reveal');
      observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
