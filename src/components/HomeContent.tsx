'use client';

import { SocialList } from './SocialList';
import Link from 'next/link';
import { type Locale } from '@/lib/i18n/config';
import { getTranslation } from '@/lib/i18n/translations';

export default function HomeContent({ locale }: { locale: Locale }) {
  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(locale, key);

  return (
    <div className="container">
      <div className="content">
        <h1 className="title">
          {t('home.greeting')} <span className="fancy">Said Yaka</span>
        </h1>
        <p className="subtitle">
          {t('home.subtitle')}
        </p>
        <p className="description">
          {t('site.description')}
        </p>
        <div className="cta-buttons">
          <Link href={`/${locale}/posts`} className="btn-primary">
            {t('nav.posts')}
          </Link>
          <Link href={`/${locale}/tags`} className="btn-secondary">
            {t('nav.tags')}
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
          max-width: 700px;
          text-align: center;
        }
        .title {
          font-size: 3rem;
          margin: 0 0 1.25rem 0;
          font-weight: 800;
          line-height: 1.1;
          color: #1e293b;
          letter-spacing: -0.02em;
        }
        .fancy {
          background: linear-gradient(135deg, #d946ef 0%, #f97316 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          position: relative;
          display: inline-block;
        }
        .subtitle {
          font-size: 1.75rem;
          font-weight: 500;
          background: linear-gradient(135deg, #334155 0%, #64748b 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0 0 1.5rem 0;
        }
        .description {
          color: #475569;
          font-size: 1.25rem;
          line-height: 1.7;
          margin: 0 0 2.5rem 0;
        }
        .cta-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-bottom: 2.5rem;
        }
        .btn-primary, .btn-secondary {
          padding: 1rem 2.25rem;
          border-radius: 12px;
          font-size: 1.05rem;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.3s ease;
          display: inline-block;
          position: relative;
          overflow: hidden;
        }
        .btn-primary {
          background: linear-gradient(135deg, #d946ef 0%, #f97316 100%);
          color: white;
          box-shadow: 0 4px 14px 0 rgba(217, 70, 239, 0.3);
        }
        .btn-primary:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px 0 rgba(217, 70, 239, 0.4);
        }
        .btn-primary:active {
          transform: translateY(-1px);
        }
        .btn-secondary {
          background: white;
          color: #d946ef;
          border: 2px solid #d946ef;
          box-shadow: 0 2px 8px 0 rgba(217, 70, 239, 0.15);
        }
        .btn-secondary:hover {
          background: linear-gradient(135deg, #e879f9 0%, #fb923c 100%);
          color: white;
          border-color: transparent;
          transform: translateY(-3px);
          box-shadow: 0 8px 24px 0 rgba(217, 70, 239, 0.3);
        }
        .btn-secondary:active {
          transform: translateY(-1px);
        }

        @media (min-width: 769px) {
          .title {
            font-size: 4rem;
          }
          .subtitle {
            font-size: 2rem;
          }
        }

        @media (max-width: 600px) {
          .title {
            font-size: 2.25rem;
          }
          .subtitle {
            font-size: 1.35rem;
          }
          .description {
            font-size: 1.1rem;
          }
          .cta-buttons {
            flex-direction: column;
            align-items: center;
          }
          .btn-primary, .btn-secondary {
            width: 100%;
            max-width: 280px;
          }
        }
      `}</style>
    </div>
  );
} 