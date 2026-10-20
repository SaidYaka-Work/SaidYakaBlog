'use client';

import { useEffect, useRef, useState } from 'react';
import type { DogGenome } from '@/lib/dog';
import { generateGenome } from '@/lib/dog';
import { drawDogSprite, paintPorchCanvas } from './drawSprite';

const DROPS = 8;
const FALLBACK_GENOME = generateGenome('feed-sprite');

export default function FeedGame({
  onDone,
  drops = DROPS,
  genome,
}: {
  onDone: (score: number, durationMs: number) => void;
  drops?: number;
  genome?: DogGenome;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const started = useRef(performance.now());
  const [caught, setCaught] = useState(0);
  const [left, setLeft] = useState(drops);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = {
      bowlX: 80,
      dir: 1,
      kibbleX: 160,
      kibbleY: -20,
      falling: false,
      caught: 0,
      remaining: drops,
      done: false,
    };

    let frame = 0;
    let last = performance.now();
    let running = true;

    const finish = () => {
      if (state.done) return;
      state.done = true;
      onDone(Math.round((state.caught / drops) * 100), performance.now() - started.current);
    };

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const w = canvas.clientWidth;
      const h = 240;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.floor(w * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      paintPorchCanvas(ctx, w, h, false, 0);
      drawDogSprite(ctx, 58, h - 58, genome ?? FALLBACK_GENOME, { scale: 1.2, phase: now / 400 });

      state.bowlX += state.dir * 120 * dt;
      if (state.bowlX < 20 || state.bowlX > w - 70) state.dir *= -1;

      if (state.falling) {
        state.kibbleY += 220 * dt;
        if (state.kibbleY > h - 38) {
          const hit = state.kibbleX > state.bowlX && state.kibbleX < state.bowlX + 56;
          if (hit) state.caught += 1;
          state.falling = false;
          state.remaining -= 1;
          setCaught(state.caught);
          setLeft(state.remaining);
          if (state.remaining <= 0) finish();
        }
      }

      ctx.fillStyle = '#c46a3a';
      ctx.beginPath();
      ctx.ellipse(state.bowlX + 28, h - 28, 28, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a3418';
      ctx.beginPath();
      ctx.ellipse(state.bowlX + 28, h - 30, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (state.falling) {
        ctx.fillStyle = '#e8c4a0';
        ctx.beginPath();
        ctx.ellipse(state.kibbleX, state.kibbleY, 5, 3.5, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#a8a198';
      ctx.font = '12px ui-sans-serif, system-ui';
      ctx.fillText('Tap to drop kibble into the bowl', 12, 20);

      frame = requestAnimationFrame(loop);
    };

    const drop = () => {
      if (state.done || state.falling || state.remaining <= 0) return;
      state.kibbleX = canvas.clientWidth / 2;
      state.kibbleY = 28;
      state.falling = true;
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        drop();
      }
    };

    canvas.addEventListener('pointerdown', drop);
    window.addEventListener('keydown', onKey, { passive: false });
    frame = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', drop);
      window.removeEventListener('keydown', onKey);
    };
  }, [onDone, drops, genome]);

  return (
    <div>
      <p className="mb-2 text-sm text-[var(--muted)]">
        {left} drops left · {caught} in the bowl
      </p>
      <canvas ref={canvasRef} className="biscuit-game h-[240px] w-full rounded-2xl" />
    </div>
  );
}
