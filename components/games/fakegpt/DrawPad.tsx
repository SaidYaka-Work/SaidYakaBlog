'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from 'react';

export type DrawSnapshot = {
  strokeCount: number;
  uniqueColors: number;
  coverage: number;
  dataUrl: string;
};

export type DrawPadHandle = {
  snapshot: () => DrawSnapshot;
};

type Point = { x: number; y: number };
type Stroke = { color: string; size: number; points: Point[] };

const COLORS = ['#161412', '#b4532a', '#c9a227', '#2f6f4e', '#2a4d8f', '#6b3fa0', '#fffdf8'];
const SIZES = [
  { id: 's', label: 'Fine', value: 3.5 },
  { id: 'm', label: 'Brush', value: 8 },
  { id: 'l', label: 'Bold', value: 16 },
];

const EMPTY: DrawSnapshot = { strokeCount: 0, uniqueColors: 0, coverage: 0, dataUrl: '' };

function measureCoverage(ctx: CanvasRenderingContext2D, width: number, height: number): number {
  if (width < 2 || height < 2) return 0;
  const data = ctx.getImageData(0, 0, width, height).data;
  let painted = 0;
  const step = 16;
  const samples = Math.floor(data.length / step);
  for (let i = 0; i < data.length; i += step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a > 8 && (r < 248 || g < 246 || b < 236)) painted += 1;
  }
  return samples ? painted / samples : 0;
}

function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (!stroke.points.length) return;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i += 1) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
}

const DrawPad = forwardRef<DrawPadHandle, { disabled?: boolean }>(function DrawPad({ disabled = false }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const liveRef = useRef<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1].value);
  const [canUndo, setCanUndo] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, 0, width, height);
    const scale = width / (canvas.clientWidth || width);
    ctx.save();
    ctx.scale(scale, scale);
    for (const stroke of strokesRef.current) paintStroke(ctx, stroke);
    if (liveRef.current) paintStroke(ctx, liveRef.current);
    ctx.restore();
  }, []);

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    redraw();
  }, [redraw]);

  useEffect(() => {
    fit();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [fit]);

  const pointFrom = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    liveRef.current = { color, size, points: [pointFrom(event)] };
    redraw();
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !liveRef.current) return;
    liveRef.current.points.push(pointFrom(event));
    redraw();
  };

  const endStroke = () => {
    if (!liveRef.current) return;
    if (liveRef.current.points.length > 0) {
      strokesRef.current = [...strokesRef.current, liveRef.current];
      setCanUndo(true);
    }
    liveRef.current = null;
    redraw();
  };

  const snapshot = useCallback((): DrawSnapshot => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || strokesRef.current.length === 0) return EMPTY;
    const colors = new Set(strokesRef.current.map((stroke) => stroke.color));
    return {
      strokeCount: strokesRef.current.length,
      uniqueColors: colors.size,
      coverage: measureCoverage(ctx, canvas.width, canvas.height),
      dataUrl: canvas.toDataURL('image/png'),
    };
  }, []);

  useImperativeHandle(ref, () => ({ snapshot }), [snapshot]);

  return (
    <div className="fgpt-tool">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Colors">
          {COLORS.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`Color ${value}`}
              aria-pressed={color === value}
              disabled={disabled}
              onClick={() => setColor(value)}
              className={`h-7 w-7 rounded-full border ${
                color === value ? 'border-[var(--ink)] ring-2 ring-[var(--accent)]' : 'border-[var(--line)]'
              }`}
              style={{ background: value }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Brush size">
          {SIZES.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => setSize(option.value)}
              className={`pressable rounded-full border px-2.5 py-1 text-[11px] ${
                size === option.value
                  ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]'
                  : 'border-[var(--line)] text-[var(--muted)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            disabled={disabled || !canUndo}
            onClick={() => {
              strokesRef.current = strokesRef.current.slice(0, -1);
              setCanUndo(strokesRef.current.length > 0);
              redraw();
            }}
            className="pressable rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--ink)] disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            disabled={disabled || !canUndo}
            onClick={() => {
              strokesRef.current = [];
              liveRef.current = null;
              setCanUndo(false);
              redraw();
            }}
            className="pressable rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--ink)] disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="fgpt-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
        aria-label="Drawing canvas"
      />
    </div>
  );
});

export default DrawPad;
