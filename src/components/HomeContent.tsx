'use client';

import { SocialList } from './SocialList';
import Link from 'next/link';

export default function HomeContent() {
  return (
    <div className="container">
      <div className="content">
        <h1 className="title">
          Hi, I&apos;m <span className="fancy">Said Yaka</span>
        </h1>
        <p className="subtitle">
          Welcome to my blog
        </p>
        <p className="description">
          Thoughts on technology, development, and everything in between.
        </p>
        <div className="cta-buttons">
          <Link href="/posts" className="btn-primary">
            Read Posts
          </Link>
          <Link href="/tags" className="btn-secondary">
            Browse Topics
          </Link>
        </div>
        <SocialList />
      </div>
      <style jsx>{`
        .container {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1 1 auto;
          padding: 0 1.5rem;
          min-height: 60vh;
        }
        .content {
          max-width: 650px;
          text-align: center;
        }
        .title {
          font-size: 2.75rem;
          margin: 0 0 1rem 0;
          font-weight: 700;
          line-height: 1.2;
          color: #111;
        }
        .fancy {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .subtitle {
          font-size: 1.5rem;
          font-weight: 400;
          color: #444;
          margin: 0 0 1rem 0;
        }
        .description {
          color: #666;
          font-size: 1.125rem;
          line-height: 1.6;
          margin: 0 0 2rem 0;
        }
        .cta-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-bottom: 2rem;
        }
        .btn-primary, .btn-secondary {
          padding: 0.75rem 1.75rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s ease;
          display: inline-block;
        }
        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .btn-secondary {
          background: white;
          color: #667eea;
          border: 2px solid #667eea;
        }
        .btn-secondary:hover {
          background: #667eea;
          color: white;
        }

        @media (min-width: 769px) {
          .title {
            font-size: 3.5rem;
          }
          .subtitle {
            font-size: 1.75rem;
          }
        }

        @media (max-width: 600px) {
          .cta-buttons {
            flex-direction: column;
            align-items: center;
          }
          .btn-primary, .btn-secondary {
            width: 100%;
            max-width: 250px;
          }
        }
      `}</style>
    </div>
  );
} 