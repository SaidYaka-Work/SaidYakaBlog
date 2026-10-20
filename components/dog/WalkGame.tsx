'use client';

import { useEffect, useRef, useState } from 'react';

const DURATION = 12_000;

type Thing = { x: number; y: number; kind: 'sniff' | 'rock'; id: number };

export default function WalkGame({
  onDone,
  durationMs = DURATION,
  speed = 180,
}: {
  onDone: (score: number, durationMs: number) => void;
  durationMs?: number;
  speed?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const started = useRef(performance.now());
  const [sniffs, setSniffs] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = {
      y: 140,
      v: 0,
      grounded: true,
      things: [] as Thing[],
      spawn: 0.4,
      nextId: 1,
      sniffs: 0,
      hits: 0,
      done: false,
    };

    let frame = 0;
    let last = performance.now();
    let running = true;

    const hop = () => {
      if (state.grounded) {
        state.v = -420;
        state.grounded = false;
      }
    };

    const finish = () => {
      if (state.done) return;
      state.done = true;
      const score = Math.max(0, Math.min(100, state.sniffs * 14 - state.hits * 10));
      onDone(score, performance.now() - started.current);
    };

    const loop = (now: number) => {
      if (!running) return;
      if (now - started.current >= durationMs) finish();
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

      if (!state.done) {
        state.v += 1400 * dt;
        state.y += state.v * dt;
        if (state.y > 140) {
          state.y = 140;
          state.v = 0;
          state.grounded = true;
        }
        state.spawn -= dt;
        if (state.spawn <= 0) {
          state.things.push({
            id: state.nextId++,
            x: w + 20,
            y: Math.random() > 0.45 ? 148 : 88,
            kind: Math.random() > 0.4 ? 'sniff' : 'rock',
          });
          state.spawn = 0.55 + Math.random() * 0.4;
        }
        state.things.forEach((thing) => {
          thing.x -= speed * dt;
        });
        state.things = state.things.filter((thing) => {
          const near = Math.abs(thing.x - 56) < 18 && Math.abs(thing.y - state.y) < 22;
          if (near && thing.kind === 'sniff') {
            state.sniffs += 1;
            setSniffs(state.sniffs);
            return false;
          }
          if (near && thing.kind === 'rock') {
            state.hits += 1;
            return false;
          }
          return thing.x > -20;
        });
      }

      ctx.fillStyle = '#16120f';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2a211c';
      ctx.fillRect(0, 168, w, 72);
      ctx.fillStyle = '#e8a87c';
      ctx.beginPath();
      ctx.ellipse(56, state.y, 16, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const thing of state.things) {
        ctx.fillStyle = thing.kind === 'sniff' ? '#f0d8c8' : '#6d675e';
        ctx.beginPath();
        ctx.arc(thing.x, thing.y, thing.kind === 'sniff' ? 6 : 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#a8a198';
      ctx.font = '12px ui-sans-serif, system-ui';
      ctx.fillText('Tap or Space to hop. Sniff the sparks, skip the rocks.', 12, 20);

      frame = requestAnimationFrame(loop);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        hop();
      }
    };
    canvas.addEventListener('pointerdown', hop);
    window.addEventListener('keydown', onKey, { passive: false });
    frame = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', hop);
      window.removeEventListener('keydown', onKey);
    };
  }, [onDone, durationMs, speed]);

  return (
    <div>
      <p className="mb-2 text-sm text-[var(--muted)]">{sniffs} sniffs collected</p>
      <canvas ref={canvasRef} className="biscuit-game h-[240px] w-full rounded-2xl" />
    </div>
  );
}
