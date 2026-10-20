'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { readThemeColors } from '../theme';
import { useGameChrome } from '../useGameChrome';

const meta = getGameBySlug('pulse-dock')!;
const ROUNDS = 8;

type Sim = {
  padX: number;
  padW: number;
  dir: number;
  speed: number;
  craftY: number;
  dropping: boolean;
  dropV: number;
  round: number;
  score: number;
  done: boolean;
  flash: number;
};

function freshSim(width: number): Sim {
  return {
    padX: width * 0.2,
    padW: Math.max(88, width * 0.28),
    dir: 1,
    speed: 140,
    craftY: 28,
    dropping: false,
    dropV: 0,
    round: 1,
    score: 0,
    done: false,
    flash: 0,
  };
}

export default function PulseDockGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('pulse-dock-best');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim | null>(null);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState('Drop when the pad slides under the craft.');

  const restart = useCallback(() => {
    const canvas = canvasRef.current;
    sim.current = freshSim(canvas?.clientWidth || 420);
    setScore(0);
    setStatus('Drop when the pad slides under the craft.');
  }, []);

  const drop = useCallback(() => {
    const state = sim.current;
    if (!state || state.done || state.dropping) return;
    state.dropping = true;
    state.dropV = 0;
    beep(500, 0.04);
  }, [beep]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    sim.current = freshSim(canvas.clientWidth);

    let frame = 0;
    let last = performance.now();
    let running = true;

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const width = canvas.clientWidth;
      const height = 320;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const state = sim.current;
      if (state) {
        state.flash = Math.max(0, state.flash - dt);
        if (!state.done) {
          state.padX += state.dir * state.speed * dt;
          if (state.padX <= 12) {
            state.padX = 12;
            state.dir = 1;
          }
          if (state.padX + state.padW >= width - 12) {
            state.padX = width - 12 - state.padW;
            state.dir = -1;
          }
        }
        if (state.dropping) {
          state.dropV += 980 * dt;
          state.craftY += state.dropV * dt;
          if (state.craftY >= height - 46) {
            const craftX = width / 2;
            const center = state.padX + state.padW / 2;
            const dist = Math.abs(craftX - center);
            const half = state.padW / 2;
            let gained = 0;
            if (dist < half - 4) {
              const perfect = dist < 10;
              gained = perfect ? 120 : Math.round(100 * (1 - dist / half));
              beep(perfect ? 880 : 640, 0.07);
              setStatus(perfect ? `Perfect dock · round ${state.round}/${ROUNDS}` : `Docked · +${gained}`);
            } else {
              beep(180, 0.1);
              setStatus(`Missed the pad · round ${state.round}/${ROUNDS}`);
            }
            state.score += gained;
            setScore(state.score);
            state.flash = 0.25;
            state.dropping = false;
            state.craftY = 28;
            state.dropV = 0;
            if (state.round >= ROUNDS) {
              state.done = true;
              commitBest(state.score);
              setStatus(`Round complete. ${state.score} from eight drops.`);
              beep(760, 0.16);
            } else {
              state.round += 1;
              state.speed += 22;
              state.padW = Math.max(54, state.padW - 8);
            }
          }
        }
        draw(ctx, width, height, state);
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
    };
  }, [beep, commitBest]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'ArrowDown') {
        event.preventDefault();
        drop();
      }
    };
    window.addEventListener('keydown', onKey, { passive: false });
    return () => window.removeEventListener('keydown', onKey);
  }, [drop]);

  return (
    <GameShell
      title={meta.title}
      howTo={meta.howTo}
      score={score}
      best={best ?? '—'}
      status={status}
      muted={muted}
      onMute={toggleMute}
      onRestart={restart}
    >
      <canvas
        ref={canvasRef}
        className="block h-[320px] w-full touch-none select-none"
        onPointerDown={drop}
        role="img"
        aria-label="Pulse Dock arena"
      />
    </GameShell>
  );
}

function draw(ctx: CanvasRenderingContext2D, width: number, height: number, state: Sim) {
  const theme = readThemeColors();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = theme.ink === '#f3eee6' ? '#0c0b0a' : '#16120f';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(232,168,124,0.08)';
  ctx.fillRect(width / 2 - 1, 20, 2, height - 70);

  const craftX = width / 2;
  ctx.save();
  ctx.translate(craftX, state.craftY);
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(9, 12);
  ctx.lineTo(-9, 12);
  ctx.closePath();
  ctx.fillStyle = theme.accent;
  ctx.fill();
  ctx.restore();

  const padY = height - 36;
  ctx.fillStyle = state.flash > 0 ? '#f0d8c8' : theme.accent;
  ctx.beginPath();
  ctx.roundRect(state.padX, padY, state.padW, 14, 8);
  ctx.fill();
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(state.padX + state.padW / 2 - 5, padY + 3, 10, 8);

  ctx.fillStyle = theme.muted;
  ctx.font = '12px ui-sans-serif, system-ui';
  ctx.fillText(`${state.round}/${ROUNDS}`, 16, 22);
}
