'use client';

import { SocialList } from './SocialList';

export default function HomeContent() {
  return (
    <div className="container">
      <div>
        <h1>
          Hi, I&apos;m Gum<span className="fancy">.</span>
        </h1>
        <h2>Welcome to my minimalist blog starter</h2>
        <p className="description">
          A clean and simple blog template with Next.js, SEO optimization, and tag system.
        </p>
        <SocialList />
      </div>
      <style jsx>{`
        .container {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1 1 auto;
          padding: 0 1.5rem;
        }
        h1 {
          font-size: 2.5rem;
          margin: 0;
          font-weight: 500;
        }
        h2 {
          font-size: 1.75rem;
          font-weight: 400;
          line-height: 1.25;
          margin-top: 1rem;
        }
        .description {
          color: #666;
          font-size: 1.1rem;
          margin-top: 1rem;
        }
        .fancy {
          color: #15847d;
        }

        @media (min-width: 769px) {
          h1 {
            font-size: 3rem;
          }
          h2 {
            font-size: 2.25rem;
          }
        }
      `}</style>
    </div>
  );
} 