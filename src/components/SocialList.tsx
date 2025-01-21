'use client';

import React from 'react';
import config from '../../config.json';

export function SocialList() {
  return (
    <div className="social-list">
      <a
        title="Twitter"
        href={`https://twitter.com/${config.twitter_account}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Twitter
      </a>
      <a
        title="GitHub"
        href={`https://github.com/${config.github_account}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub
      </a>
      <style jsx>{`
        .social-list {
          display: flex;
          gap: 2rem;
          margin-top: 3rem;
        }
        .social-list a {
          color: #666;
          text-decoration: none;
          transition: color 0.3s ease;
        }
        .social-list a:hover {
          color: #15847d;
        }
      `}</style>
    </div>
  );
} 