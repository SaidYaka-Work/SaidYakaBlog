'use client';

import { geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo';
import { useEffect, useRef } from 'react';
import { feature } from 'topojson-client';
import {
  cityPoint,
  destinationPoint,
  formatKm,
  greatCirclePath,
  headingArcKm,
  headingPath,
} from './logic';
import type { Attempt, City } from './types';

type Topology = {
  type: 'Topology';
  objects: { land: unknown; countries: unknown };
};

type Theme = {
  ocean: string;
  land: string;
  landStroke: string;
  grid: string;
  ink: string;
  muted: string;
  accent: string;
  elevated: string;
  chord: string;
};

const WORLD_URL = '/games/unknown-number/world-110m.json';

function readTheme(node: HTMLElement): Theme {
  const styles = getComputedStyle(node);
  const dark = document.documentElement.classList.contains('dark');
  const ink = styles.getPropertyValue('--ink').trim() || (dark ? '#f3eee6' : '#161412');
  const accent = styles.getPropertyValue('--accent').trim() || (dark ? '#e8a87c' : '#b4532a');
  const elevated = styles.getPropertyValue('--bg-elevated').trim() || (dark ? '#151311' : '#fffdf8');
  return {
    ocean: dark ? '#152026' : '#c9dce6',
    land: dark ? '#4a3d30' : '#e2cba8',
    landStroke: dark ? 'rgba(232, 168, 124, 0.38)' : 'rgba(90, 64, 40, 0.38)',
    grid: dark ? 'rgba(243, 238, 230, 0.1)' : 'rgba(22, 20, 18, 0.1)',
    ink,
    muted: styles.getPropertyValue('--muted').trim() || (dark ? '#a8a198' : '#6d675e'),
    accent,
    elevated,
    chord: dark ? 'rgba(243, 238, 230, 0.28)' : 'rgba(22, 20, 18, 0.22)',
  };
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

function project(projection: ReturnType<typeof geoEquirectangular>, point: { lat: number; lng: number }) {
  return projection([point.lng, point.lat]);
}

function strokePath(
  ctx: CanvasRenderingContext2D,
  projection: ReturnType<typeof geoEquirectangular>,
  points: { lat: number; lng: number }[],
  style: { color: string; width: number; dash?: number[] },
) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(style.dash ?? []);

  let started = false;
  ctx.beginPath();
  for (let i = 0; i < points.length; i += 1) {
    const xy = project(projection, points[i]);
    if (!xy) {
      started = false;
      continue;
    }
    if (i > 0) {
      const prev = points[i - 1];
      if (Math.abs(points[i].lng - prev.lng) > 180) {
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(xy[0], xy[1]);
        started = true;
        continue;
      }
    }
    if (!started) {
      ctx.moveTo(xy[0], xy[1]);
      started = true;
    } else {
      ctx.lineTo(xy[0], xy[1]);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fill: string,
  radius: number,
  stroke?: string,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.restore();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  theme: Theme,
  width: number,
) {
  ctx.save();
  ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
  const padX = 7;
  const w = Math.min(width - 12, ctx.measureText(text).width + padX * 2);
  const h = 18;
  const left = Math.max(6, Math.min(width - w - 6, x - w / 2));
  const top = Math.max(6, y - h - 8);
  ctx.fillStyle = theme.elevated;
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = theme.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + w / 2, top + h / 2 + 0.4);
  ctx.restore();
}

function paint(
  canvas: HTMLCanvasElement | null,
  attempts: readonly Attempt[],
  target: City | null,
  world: GeoJSON.FeatureCollection | null,
) {
  if (!canvas) return;
  const width = canvas.clientWidth || 640;
  const height = canvas.clientHeight || 320;
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
  ctx.fillStyle = theme.ocean;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 18);
  ctx.fill();

  const pad = 8;
  const projection = geoEquirectangular().fitExtent(
    [
      [pad, pad + 4],
      [width - pad, height - pad],
    ],
    { type: 'Sphere' },
  );
  const path = geoPath(projection, ctx);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 18);
  ctx.clip();

  ctx.beginPath();
  path(geoGraticule10());
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 0.7;
  ctx.stroke();

  if (world) {
    fillCollection(ctx, path, world, theme.land, theme.landStroke, 0.55);
  }

  const latest = attempts[attempts.length - 1];
  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    const from = cityPoint(attempt.city);
    const isLatest = index === attempts.length - 1;
    if (target) {
      const to = cityPoint(target);
      strokePath(ctx, projection, [from, to], {
        color: theme.chord,
        width: isLatest ? 1.3 : 0.8,
        dash: [5, 5],
      });
      strokePath(ctx, projection, greatCirclePath(from, to, 72), {
        color: theme.accent,
        width: isLatest ? 2.6 : 1.4,
      });
    } else if (attempt.tone !== 'hit') {
      const arcKm = headingArcKm(attempt.km);
      strokePath(ctx, projection, headingPath(from, attempt.bearing, arcKm), {
        color: isLatest ? theme.accent : `${theme.accent}99`,
        width: isLatest ? 2.6 : 1.5,
      });
      const tip = destinationPoint(from, attempt.bearing, arcKm);
      const tipXY = project(projection, tip);
      if (tipXY && isLatest) {
        drawDot(ctx, tipXY[0], tipXY[1], theme.accent, 2.4);
      }
    }

    const xy = project(projection, from);
    if (xy) {
      drawDot(ctx, xy[0], xy[1], isLatest ? theme.accent : theme.ink, isLatest ? 4.2 : 3, theme.elevated);
    }
  }

  if (target) {
    const xy = project(projection, cityPoint(target));
    if (xy) {
      drawDot(ctx, xy[0], xy[1], theme.accent, 5.2, theme.elevated);
      drawLabel(ctx, xy[0], xy[1], target.name, theme, width);
    }
  } else if (latest) {
    const xy = project(projection, cityPoint(latest.city));
    if (xy) {
      drawLabel(
        ctx,
        xy[0],
        xy[1],
        latest.tone === 'hit' ? latest.city.name : `${latest.city.name} · ${formatKm(latest.km)}`,
        theme,
        width,
      );
    }
  }

  ctx.restore();
}

export default function MeridianMap({
  attempts,
  target = null,
  caption,
}: {
  attempts: readonly Attempt[];
  target?: City | null;
  caption: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const attemptsRef = useRef(attempts);
  const targetRef = useRef(target);
  attemptsRef.current = attempts;
  targetRef.current = target;

  useEffect(() => {
    let cancelled = false;
    fetch(WORLD_URL)
      .then((response) => response.json())
      .then((topology: Topology) => {
        if (cancelled) return;
        worldRef.current = feature(topology as never, topology.objects.land as never) as unknown as GeoJSON.FeatureCollection;
        paint(canvasRef.current, attemptsRef.current, targetRef.current, worldRef.current);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    paint(canvasRef.current, attempts, target, worldRef.current);
  }, [attempts, target]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const redraw = () => paint(canvas, attemptsRef.current, targetRef.current, worldRef.current);
    const observer = new MutationObserver(redraw);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const resize = new ResizeObserver(redraw);
    resize.observe(canvas);
    return () => {
      observer.disconnect();
      resize.disconnect();
    };
  }, []);

  return (
    <figure className="overflow-hidden rounded-[1.15rem] border border-[var(--line)] bg-[var(--bg)]">
      <canvas
        ref={canvasRef}
        className="block h-[11.5rem] w-full sm:h-[16.5rem]"
        role="img"
        aria-label={caption}
      />
      <figcaption className="border-t border-[var(--line)] px-3 py-2 text-[11px] leading-relaxed text-[var(--muted)]">
        {caption}
      </figcaption>
    </figure>
  );
}
