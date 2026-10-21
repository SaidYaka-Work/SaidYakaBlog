'use client';

import { geoCircle, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { useEffect, useRef } from 'react';
import { feature } from 'topojson-client';
import { easeOutCubic, globeView, lerp, lerpLng, type GlobeView } from './globe';
import type { Birthplace } from './types';

type Topology = {
  type: 'Topology';
  objects: { land: unknown; countries: unknown };
};

type Theme = {
  ocean0: string;
  ocean1: string;
  land: string;
  landStroke: string;
  grid: string;
  rim: string;
  glow: string;
  pin: string;
  label: string;
  labelBg: string;
};

const WORLD_URL = '/games/unknown-number/world-110m.json';

function readTheme(node: HTMLElement): Theme {
  const dark = document.documentElement.classList.contains('dark');
  const styles = getComputedStyle(node);
  return {
    ocean0: dark ? '#2a3a44' : '#b7d3e2',
    ocean1: dark ? '#12181c' : '#6f9db3',
    land: dark ? '#c4a57a' : '#e6d2ae',
    landStroke: dark ? '#8d7352' : '#8b6f45',
    grid: dark ? 'rgba(232, 214, 186, 0.16)' : 'rgba(28, 44, 52, 0.16)',
    rim: dark ? 'rgba(232, 168, 124, 0.7)' : 'rgba(180, 83, 42, 0.45)',
    glow: dark ? 'rgba(232, 168, 124, 0.28)' : 'rgba(180, 83, 42, 0.22)',
    pin: styles.getPropertyValue('--un-out-bg').trim() || (dark ? '#e8a87c' : '#b4532a'),
    label: styles.getPropertyValue('--ink').trim() || (dark ? '#f3eee6' : '#161412'),
    labelBg: styles.getPropertyValue('--bg-elevated').trim() || (dark ? '#1d1916' : '#fffdf8'),
  };
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function GlobeHint({
  birthplace,
  wrongGuesses,
  revealed,
}: {
  birthplace: Birthplace;
  wrongGuesses: number;
  revealed: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<{ land: GeoJSON.FeatureCollection; countries: GeoJSON.FeatureCollection } | null>(null);
  const viewRef = useRef<GlobeView>(globeView(wrongGuesses, birthplace, revealed));
  const fromRef = useRef<GlobeView>(viewRef.current);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(WORLD_URL)
      .then((response) => response.json())
      .then((topology: Topology) => {
        if (cancelled) return;
        worldRef.current = {
          land: feature(topology as never, topology.objects.land as never) as unknown as GeoJSON.FeatureCollection,
          countries: feature(topology as never, topology.objects.countries as never) as unknown as GeoJSON.FeatureCollection,
        };
        paint(canvasRef.current, viewRef.current, birthplace, worldRef.current);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [birthplace]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const target = globeView(wrongGuesses, birthplace, revealed);
    const from = viewRef.current;
    fromRef.current = from;

    if (prefersReducedMotion() || (from.index === target.index && from.showPin === target.showPin)) {
      viewRef.current = target;
      paint(canvas, target, birthplace, worldRef.current);
      return;
    }

    const duration = 820;
    const started = performance.now();
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const tick = (now: number) => {
      const t = easeOutCubic(Math.min(1, (now - started) / duration));
      const current: GlobeView = {
        ...target,
        scale: lerp(from.scale, target.scale, t),
        hintDeg: lerp(from.hintDeg, target.hintDeg, t),
        rotate: [
          lerpLng(from.rotate[0], target.rotate[0], t),
          lerp(from.rotate[1], target.rotate[1], t),
        ],
        showHint: from.showHint || target.showHint,
        showPin: t > 0.72 && target.showPin,
      };
      viewRef.current = current;
      paint(canvas, current, birthplace, worldRef.current);
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        viewRef.current = target;
        paint(canvas, target, birthplace, worldRef.current);
      }
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [birthplace, revealed, wrongGuesses]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const redraw = () => paint(canvas, viewRef.current, birthplace, worldRef.current);
    const observer = new MutationObserver(redraw);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const resize = new ResizeObserver(redraw);
    resize.observe(canvas);
    return () => {
      observer.disconnect();
      resize.disconnect();
    };
  }, [birthplace]);

  const caption = revealed ? `${birthplace.name}, ${birthplace.country}` : globeView(wrongGuesses, birthplace, false).label;

  return (
    <figure className="un-globe">
      <canvas
        ref={canvasRef}
        className="un-globe-canvas"
        role="img"
        aria-label={
          revealed
            ? `Born in ${birthplace.name}, ${birthplace.country}`
            : `Birthplace hint at ${caption.toLowerCase()} scale`
        }
      />
      <figcaption className="un-globe-caption">{revealed ? caption : `Hint · ${caption}`}</figcaption>
    </figure>
  );
}

function paint(
  canvas: HTMLCanvasElement | null,
  view: GlobeView,
  birth: Birthplace,
  world: { land: GeoJSON.FeatureCollection; countries: GeoJSON.FeatureCollection } | null,
) {
  if (!canvas) return;
  const width = canvas.clientWidth || 200;
  const height = canvas.clientHeight || 200;
  const dpr = Math.min(2.25, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const theme = readTheme(canvas);
  const cx = width / 2;
  const cy = height / 2 + 2;
  const radius = Math.min(width, height) * 0.42;

  ctx.save();
  ctx.shadowColor = 'rgba(16, 14, 12, 0.28)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  const ocean = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.4, radius * 0.1, cx, cy, radius);
  ocean.addColorStop(0, theme.ocean0);
  ocean.addColorStop(1, theme.ocean1);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = ocean;
  ctx.fill();
  ctx.restore();

  const projection = geoOrthographic()
    .translate([cx, cy])
    .scale(view.scale * (radius / 148))
    .rotate([...view.rotate, 0])
    .clipAngle(90);
  const path = geoPath(projection, ctx);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  ctx.beginPath();
  path(geoGraticule10());
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 0.6;
  ctx.stroke();

  if (world) {
    fillCollection(ctx, path, world.countries, theme.land, theme.landStroke, view.index >= 3 ? 0.8 : 0.45);
  }

  const shine = ctx.createRadialGradient(cx - radius * 0.38, cy - radius * 0.42, 2, cx, cy, radius);
  shine.addColorStop(0, 'rgba(255,255,255,0.28)');
  shine.addColorStop(0.35, 'rgba(255,255,255,0.05)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  if (view.showHint) {
    const circle = geoCircle().center([birth.lng, birth.lat]).radius(view.hintDeg).precision(2)();
    ctx.beginPath();
    path(circle);
    ctx.fillStyle = theme.glow;
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = theme.rim;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  if (view.showPin) {
    const point = projection([birth.lng, birth.lat]);
    if (point) {
      drawPin(ctx, point[0], point[1], theme);
    }
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = theme.rim;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  if (view.showPin) {
    const point = projection([birth.lng, birth.lat]);
    if (point) {
      drawLabel(ctx, point[0], Math.max(18, point[1] - 22), `${birth.name}`, theme, width);
    }
  }
}

function geometriesOf(geometry: GeoJSON.Geometry): GeoJSON.Geometry[] {
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }));
  }
  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries.flatMap(geometriesOf);
  }
  return [geometry];
}

function fillCollection(
  ctx: CanvasRenderingContext2D,
  path: ReturnType<typeof geoPath>,
  collection: GeoJSON.FeatureCollection,
  fill: string,
  stroke: string,
  lineWidth: number,
) {
  for (const feat of collection.features) {
    if (!feat.geometry) continue;
    for (const geometry of geometriesOf(feat.geometry)) {
      ctx.beginPath();
      path(geometry);
      ctx.fillStyle = fill;
      ctx.fill('evenodd');
      if (lineWidth) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }
  }
}

function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, theme: Theme) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-8, -2, -7, -14, 0, -14);
  ctx.bezierCurveTo(7, -14, 8, -2, 0, 7);
  ctx.fillStyle = theme.pin;
  ctx.shadowColor = 'rgba(16, 14, 12, 0.35)';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -9, 2.4, 0, Math.PI * 2);
  ctx.fillStyle = '#fffdf8';
  ctx.fill();
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, theme: Theme, width: number) {
  ctx.save();
  ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
  const padX = 8;
  const w = Math.min(width - 12, ctx.measureText(text).width + padX * 2);
  const h = 20;
  const left = Math.max(6, Math.min(width - w - 6, x - w / 2));
  const top = Math.max(6, y - h);
  ctx.fillStyle = theme.labelBg;
  ctx.strokeStyle = theme.rim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = theme.label;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + w / 2, top + h / 2 + 0.5);
  ctx.restore();
}
