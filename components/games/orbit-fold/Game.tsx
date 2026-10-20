'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { angleDelta, readThemeColors } from '../theme';
import { useGameChrome } from '../useGameChrome';

const meta = getGameBySlug('orbit-fold')!;
const RINGS = [62, 96, 132];
const OMEGA = [1.62, -1.08, 0.78];
const FOLD_TIME = 0.22;

type Spark = { id: number; ring: number; angle: number; life: number };
type Rock = { id: number; ring: number; angle: number };

type Sim = {
  ring: number;
  angle: number;
  sparks: Spark[];
  rocks: Rock[];
  score: number;
  alive: boolean;
  elapsed: number;
  sparkIn: number;
  rockIn: number;
  fold: number;
  nextId: number;
};

function freshSim(): Sim {
  return {
    ring: 1,
    angle: 0,
    sparks: [
      { id: 1, ring: 0, angle: 1.2, life: 6 },
      { id: 2, ring: 2, angle: 3.4, life: 6 },
      { id: 3, ring: 1, angle: 4.8, life: 6 },
    ],
    rocks: [{ id: 4, ring: 2, angle: 5.6 }],
    score: 0,
    alive: true,
    elapsed: 0,
    sparkIn: 1.1,
    rockIn: 2.2,
    fold: 0,
    nextId: 5,
  };
}

export default function OrbitFoldGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('orbit-fold-best');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim>(freshSim());
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState('Hop rings. Grab sparks. Fold through rocks.');

  const finish = useCallback(
    (finalScore: number) => {
      commitBest(finalScore);
      setScore(finalScore);
      setStatus(finalScore ? `Folded out with ${finalScore}.` : 'Caught a rock. Try another hop.');
    },
    [commitBest],
  );

  const hop = useCallback(
    (dir: 1 | -1) => {
      const state = sim.current;
      if (!state.alive) return;
      state.ring = (state.ring + dir + RINGS.length) % RINGS.length;
      state.fold = FOLD_TIME;
      beep(520 + state.ring * 80, 0.05);
    },
    [beep],
  );

  const restart = useCallback(() => {
    sim.current = freshSim();
    setScore(0);
    setStatus('Hop rings. Grab sparks. Fold through rocks.');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let last = performance.now();
    let running = true;

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const state = sim.current;
      const size = canvas.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.floor(size * dpr) || canvas.height !== Math.floor(size * dpr)) {
        canvas.width = Math.floor(size * dpr);
        canvas.height = Math.floor(size * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (state.alive) {
        state.elapsed += dt;
        state.fold = Math.max(0, state.fold - dt);
        state.angle += OMEGA[state.ring] * dt;
        state.sparks.forEach((spark) => {
          spark.angle += OMEGA[spark.ring] * dt;
          spark.life -= dt;
        });
        state.rocks.forEach((rock) => {
          rock.angle += OMEGA[rock.ring] * dt;
        });
        state.sparks = state.sparks.filter((spark) => spark.life > 0);

        state.sparkIn -= dt;
        state.rockIn -= dt;
        if (state.sparkIn <= 0 && state.sparks.length < 5) {
          state.sparks.push({
            id: state.nextId++,
            ring: Math.floor(Math.random() * 3),
            angle: Math.random() * Math.PI * 2,
            life: 6.5,
          });
          state.sparkIn = Math.max(0.7, 1.5 - state.elapsed * 0.02);
        }
        if (state.rockIn <= 0 && state.rocks.length < 5) {
          state.rocks.push({
            id: state.nextId++,
            ring: Math.floor(Math.random() * 3),
            angle: state.angle + Math.PI * (0.4 + Math.random() * 1.2),
          });
          state.rockIn = Math.max(0.85, 2.1 - state.elapsed * 0.04);
        }

        for (const spark of [...state.sparks]) {
          if (spark.ring !== state.ring) continue;
          if (Math.abs(angleDelta(spark.angle, state.angle)) * RINGS[state.ring] < 16) {
            state.sparks = state.sparks.filter((item) => item.id !== spark.id);
            state.score += 10;
            setScore(state.score);
            beep(740, 0.06);
          }
        }

        if (state.fold <= 0) {
          for (const rock of state.rocks) {
            if (rock.ring !== state.ring) continue;
            if (Math.abs(angleDelta(rock.angle, state.angle)) * RINGS[state.ring] < 18) {
              state.alive = false;
              beep(140, 0.2);
              finish(state.score);
              break;
            }
          }
        }
      }

      draw(ctx, size, state);
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
    };
  }, [beep, finish]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'ArrowUp') {
        event.preventDefault();
        hop(1);
      } else if (event.code === 'ArrowDown') {
        event.preventDefault();
        hop(-1);
      } else if (event.code === 'KeyR') {
        restart();
      }
    };
    window.addEventListener('keydown', onKey, { passive: false });
    return () => window.removeEventListener('keydown', onKey);
  }, [hop, restart]);

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
        className="mx-auto block aspect-square w-full max-w-[440px] touch-none select-none"
        onPointerDown={() => hop(1)}
        role="img"
        aria-label="Orbit Fold arena"
      />
    </GameShell>
  );
}

function draw(ctx: CanvasRenderingContext2D, size: number, state: Sim) {
  const theme = readThemeColors();
  const cx = size / 2;
  const cy = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = theme.ink === '#f3eee6' ? '#0c0b0a' : '#16120f';
  ctx.fillRect(0, 0, size, size);

  RINGS.forEach((radius, index) => {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = index === state.ring ? theme.accent : 'rgba(232,168,124,0.28)';
    ctx.lineWidth = index === state.ring ? 2.4 : 1.2;
    ctx.stroke();
  });

  for (const spark of state.sparks) {
    const [x, y] = polar(cx, cy, RINGS[spark.ring], spark.angle);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#f0d8c8';
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  for (const rock of state.rocks) {
    const [x, y] = polar(cx, cy, RINGS[rock.ring], rock.angle);
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#6d675e';
    ctx.fill();
    ctx.strokeStyle = '#3d3832';
    ctx.stroke();
  }

  const [px, py] = polar(cx, cy, RINGS[state.ring], state.angle);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(state.angle + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(7, 8);
  ctx.lineTo(-7, 8);
  ctx.closePath();
  ctx.fillStyle = state.fold > 0 ? '#fffdf8' : theme.accent;
  ctx.globalAlpha = state.fold > 0 ? 0.55 : 1;
  ctx.fill();
  ctx.restore();

  if (!state.alive) {
    ctx.fillStyle = 'rgba(12,11,10,0.45)';
    ctx.fillRect(0, 0, size, size);
  }
}

function polar(cx: number, cy: number, radius: number, angle: number): [number, number] {
  return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
}
