'use client';

import { useEffect, useRef, useState } from 'react';
import { generateGenome } from '@/lib/dog';
import { drawDogSprite, paintPorchCanvas } from './drawSprite';

const STRAY = generateGenome('stray-porch');

const DURATION = 14_000;

export default function CatchGame({ onDone }: { onDone: (score: number, durationMs: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const started = useRef(performance.now());
  const [hits, setHits] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = {
      x: 40,
      dir: 1,
      hits: 0,
      flash: 0,
      done: false,
    };

    let frame = 0;
    let last = performance.now();
    let running = true;

    const toss = () => {
      if (state.done) return;
      const w = canvas.clientWidth;
      const zone = Math.abs(state.x - w / 2) < 34;
      if (zone) {
        state.hits += 1;
        state.flash = 0.25;
        setHits(state.hits);
      }
    };

    const finish = () => {
      if (state.done) return;
      state.done = true;
      onDone(Math.min(100, state.hits * 34), performance.now() - started.current);
    };

    const loop = (now: number) => {
      if (!running) return;
      if (now - started.current >= DURATION) finish();
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
      state.x += state.dir * (150 + state.hits * 18) * dt;
      if (state.x < 24 || state.x > w - 24) state.dir *= -1;
      state.flash = Math.max(0, state.flash - dt);

      paintPorchCanvas(ctx, w, h, true, now / 40);
      ctx.fillStyle = state.flash > 0 ? 'rgba(232,168,124,0.4)' : 'rgba(232,168,124,0.16)';
      ctx.fillRect(w / 2 - 36, 40, 72, 160);
      drawDogSprite(ctx, state.x, 150, STRAY, {
        phase: now / 80,
        scale: 1.2,
        facing: state.dir >= 0 ? 1 : -1,
      });
      ctx.fillStyle = '#a8a198';
      ctx.font = '12px ui-sans-serif, system-ui';
      ctx.fillText('Tap when the stray is in the porch light.', 12, 20);

      frame = requestAnimationFrame(loop);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        toss();
      }
    };
    canvas.addEventListener('pointerdown', toss);
    window.addEventListener('keydown', onKey, { passive: false });
    frame = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', toss);
      window.removeEventListener('keydown', onKey);
    };
  }, [onDone]);

  return (
    <div>
      <p className="mb-2 text-sm text-[var(--muted)]">{hits} clean catches</p>
      <canvas ref={canvasRef} className="biscuit-game h-[240px] w-full rounded-2xl" />
    </div>
  );
}
