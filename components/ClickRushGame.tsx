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
      if (!Number.isNaN(parsed)) setBestScore(parsed);
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
    <section className="mx-auto max-w-5xl px-0 py-8 sm:py-12">
      <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--bg-elevated)] p-5 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Mini game</p>
            <h1 className="mt-2 font-serif text-4xl tracking-tight sm:text-5xl">Click Rush</h1>
            <p className="mt-3 max-w-md text-[var(--muted)]">
              A tiny reflex game for people who click first and think after.
            </p>
          </div>
          <button
            type="button"
            onClick={startGame}
            className="rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]"
          >
            {isPlaying ? 'Restart' : 'Start game'}
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Time', `${timeLeft}s`],
            ['Score', String(score)],
            ['Best', String(bestScore)],
            ['Style', accuracy],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <span className="block text-xs uppercase tracking-[0.12em] text-[var(--faint)]">
                {label}
              </span>
              <strong className="mt-1 block text-xl font-normal text-[var(--ink)]">{value}</strong>
            </div>
          ))}
        </div>

        <div
          className="relative min-h-[360px] overflow-hidden rounded-[1.6rem] bg-[#111010] sm:min-h-[460px]"
          aria-label="Click Rush game arena"
        >
          <button
            type="button"
            aria-label="Glowing orb"
            onClick={hitOrb}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-0 ${
              isPlaying ? 'cursor-pointer' : 'pointer-events-none opacity-30'
            }`}
            style={{
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              width: `${orb.size}px`,
              height: `${orb.size}px`,
              background:
                'radial-gradient(circle at 30% 30%, #fde68a 0%, #fb7185 34%, #d946ef 68%, #7c3aed 100%)',
              boxShadow: '0 0 28px rgba(244, 114, 182, 0.65)',
            }}
          />
          {!isPlaying && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 px-4 text-center text-white">
              <p className="text-xl font-medium">{message}</p>
              <span className="text-sm text-white/70">20 seconds. One orb. Mild glory.</span>
            </div>
          )}
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">{message}</p>
      </div>
    </section>
  );
}
