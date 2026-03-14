'use client';

import { useEffect, useMemo, useState } from 'react';

type Orb = {
  x: number;
  y: number;
  size: number;
  id: number;
};

const GAME_DURATION = 20;
const STORAGE_KEY = 'click-rush-best-score';

function randomOrb(id: number): Orb {
  return {
    id,
    x: Math.random() * 72 + 8,
    y: Math.random() * 62 + 12,
    size: Math.floor(Math.random() * 26) + 54,
  };
}

export default function ClickRushGame() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [orb, setOrb] = useState<Orb>(() => randomOrb(Date.now()));
  const [message, setMessage] = useState('Press start and chase the glowing orb.');

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = Number(saved);
      if (!Number.isNaN(parsed)) {
        setBestScore(parsed);
      }
    }
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setIsPlaying(false);
          setMessage('Round over. Nice reflexes.');
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      window.localStorage.setItem(STORAGE_KEY, String(score));
    }
  }, [score, bestScore]);

  const accuracy = useMemo(() => {
    if (!score) return 'warming up';
    if (score >= 30) return 'ridiculous';
    if (score >= 22) return 'sharp';
    if (score >= 15) return 'solid';
    return 'casual';
  }, [score]);

  function startGame() {
    setIsPlaying(true);
    setTimeLeft(GAME_DURATION);
    setScore(0);
    setOrb(randomOrb(Date.now()));
    setMessage('Go go go.');
  }

  function hitOrb() {
    if (!isPlaying) return;

    setScore((current) => current + 1);
    setOrb(randomOrb(Date.now() + Math.random()));
    setMessage('Clean hit. Keep moving.');
  }

  return (
    <section className="game-shell">
      <div className="game-card">
        <div className="header-row">
          <div>
            <p className="eyebrow">Mini game</p>
            <h1>Click Rush</h1>
            <p className="subcopy">A tiny reflex game for people who click first and think after.</p>
          </div>
          <button className="start-button" onClick={startGame}>
            {isPlaying ? 'Restart' : 'Start game'}
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat">
            <span>Time</span>
            <strong>{timeLeft}s</strong>
          </div>
          <div className="stat">
            <span>Score</span>
            <strong>{score}</strong>
          </div>
          <div className="stat">
            <span>Best</span>
            <strong>{bestScore}</strong>
          </div>
          <div className="stat">
            <span>Style</span>
            <strong>{accuracy}</strong>
          </div>
        </div>

        <div className="arena" aria-label="Click Rush game arena">
          <button
            aria-label="Glowing orb"
            className={`orb ${isPlaying ? 'active' : 'idle'}`}
            onClick={hitOrb}
            style={{
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              width: `${orb.size}px`,
              height: `${orb.size}px`,
            }}
          />
          {!isPlaying && (
            <div className="overlay">
              <p>{message}</p>
              <span>20 seconds. One orb. Mild glory.</span>
            </div>
          )}
        </div>

        <p className="footer-note">{message}</p>
      </div>

      <style jsx>{`
        .game-shell {
          max-width: 980px;
          margin: 0 auto;
          padding: 2rem 1rem 5rem;
        }
        .game-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(250,245,255,0.98) 100%);
          border: 1px solid rgba(217, 70, 239, 0.15);
          border-radius: 28px;
          box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
          padding: 2rem;
        }
        .header-row {
          display: flex;
          gap: 1rem;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 0.75rem;
          font-weight: 700;
          color: #d946ef;
          margin: 0 0 0.75rem;
        }
        h1 {
          margin: 0;
          font-size: clamp(2.2rem, 4vw, 3.5rem);
          line-height: 1;
          color: #111827;
        }
        .subcopy {
          margin: 0.85rem 0 0;
          max-width: 34rem;
          color: #4b5563;
          font-size: 1.05rem;
          line-height: 1.65;
        }
        .start-button {
          border: 0;
          border-radius: 999px;
          padding: 0.95rem 1.35rem;
          background: linear-gradient(135deg, #d946ef 0%, #f97316 100%);
          color: white;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 12px 30px rgba(217, 70, 239, 0.28);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .start-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 36px rgba(217, 70, 239, 0.34);
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.85rem;
          margin-bottom: 1.5rem;
        }
        .stat {
          padding: 1rem;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(226, 232, 240, 0.9);
        }
        .stat span {
          display: block;
          font-size: 0.82rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6b7280;
          margin-bottom: 0.35rem;
        }
        .stat strong {
          font-size: 1.5rem;
          color: #111827;
        }
        .arena {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          min-height: 460px;
          background:
            radial-gradient(circle at top, rgba(249, 115, 22, 0.18), transparent 35%),
            radial-gradient(circle at bottom right, rgba(217, 70, 239, 0.24), transparent 30%),
            linear-gradient(135deg, #0f172a 0%, #1e1b4b 48%, #3b0764 100%);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .orb {
          position: absolute;
          transform: translate(-50%, -50%);
          border: none;
          border-radius: 999px;
          background: radial-gradient(circle at 30% 30%, #fde68a 0%, #fb7185 34%, #d946ef 68%, #7c3aed 100%);
          box-shadow:
            0 0 0 8px rgba(255,255,255,0.08),
            0 0 28px rgba(244, 114, 182, 0.65),
            0 0 64px rgba(217, 70, 239, 0.4);
          transition: left 0.14s ease, top 0.14s ease, transform 0.14s ease;
          cursor: pointer;
        }
        .orb.active:hover {
          transform: translate(-50%, -50%) scale(1.08);
        }
        .orb.idle {
          pointer-events: none;
          opacity: 0.35;
        }
        .overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          color: white;
          background: rgba(15, 23, 42, 0.32);
          backdrop-filter: blur(2px);
          text-align: center;
          padding: 1rem;
        }
        .overlay p {
          margin: 0;
          font-size: 1.4rem;
          font-weight: 700;
        }
        .overlay span {
          color: rgba(255,255,255,0.8);
        }
        .footer-note {
          margin: 1rem 0 0;
          color: #6b7280;
        }
        @media (max-width: 768px) {
          .game-card {
            padding: 1.25rem;
          }
          .header-row {
            flex-direction: column;
          }
          .start-button {
            width: 100%;
          }
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .arena {
            min-height: 360px;
          }
        }
      `}</style>
    </section>
  );
}
