'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { readThemeColors } from '../theme';
import { useGameChrome } from '../useGameChrome';

const meta = getGameBySlug('fold-herd')!;

const WORLD_W = 800;
const WORLD_H = 500;
const MARGIN = 26;
const SHEEP_R = 12;
const DOG_R = 15;
const PEN_SCORE = 100;
const TIME_SCORE = 4;
const HOLD = 1.5;

type Vec = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };
type Kind = 'hedge' | 'pond';
type Obstacle = Rect & { kind: Kind };
type Gate = 'left' | 'right' | 'top' | 'bottom';
type Pen = Rect & { gate: Gate; opening: number };

type Sheep = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  bob: number;
  penned: boolean;
  stuck: number;
  wander: number;
};

type Dog = { x: number; y: number; vx: number; vy: number; heading: number; gait: number };

type Field = {
  name: string;
  time: number;
  flock: number;
  pen: Pen;
  obstacles: Obstacle[];
};

type Phase = 'play' | 'hold' | 'done';

type Sim = {
  field: number;
  time: number;
  score: number;
  phase: Phase;
  hold: number;
  dog: Dog;
  sheep: Sheep[];
  whistle: number;
  flash: number;
};

type Pointer = { x: number; y: number; id: number } | null;

const FIELDS: Field[] = [
  {
    name: 'Open Fold',
    time: 50,
    flock: 5,
    pen: { x: 628, y: 132, w: 148, h: 236, gate: 'left', opening: 168 },
    obstacles: [],
  },
  {
    name: 'Hedgerow',
    time: 54,
    flock: 6,
    pen: { x: 636, y: 148, w: 140, h: 204, gate: 'left', opening: 118 },
    obstacles: [
      { kind: 'hedge', x: 268, y: 18, w: 30, h: 176 },
      { kind: 'hedge', x: 268, y: 308, w: 30, h: 174 },
      { kind: 'hedge', x: 430, y: 214, w: 118, h: 26 },
    ],
  },
  {
    name: 'The Pond',
    time: 56,
    flock: 6,
    pen: { x: 640, y: 154, w: 136, h: 196, gate: 'left', opening: 110 },
    obstacles: [{ kind: 'pond', x: 292, y: 178, w: 228, h: 146 }],
  },
  {
    name: 'Narrow Gate',
    time: 60,
    flock: 7,
    pen: { x: 648, y: 176, w: 128, h: 152, gate: 'left', opening: 64 },
    obstacles: [
      { kind: 'hedge', x: 214, y: 64, w: 24, h: 148 },
      { kind: 'hedge', x: 214, y: 292, w: 24, h: 148 },
      { kind: 'hedge', x: 468, y: 18, w: 28, h: 186 },
      { kind: 'hedge', x: 468, y: 296, w: 28, h: 186 },
    ],
  },
];

const GRASS = (() => {
  const blades: { x: number; y: number; h: number }[] = [];
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 86; i += 1) {
    blades.push({ x: rand() * WORLD_W, y: rand() * WORLD_H, h: 3 + rand() * 6 });
  }
  return blades;
})();

function hypot(x: number, y: number) {
  return Math.sqrt(x * x + y * y);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function gateCenter(pen: Pen): Vec {
  if (pen.gate === 'left') return { x: pen.x, y: pen.y + pen.h / 2 };
  if (pen.gate === 'right') return { x: pen.x + pen.w, y: pen.y + pen.h / 2 };
  if (pen.gate === 'top') return { x: pen.x + pen.w / 2, y: pen.y };
  return { x: pen.x + pen.w / 2, y: pen.y + pen.h };
}

function penInterior(pen: Pen): Rect {
  return { x: pen.x + 12, y: pen.y + 12, w: pen.w - 24, h: pen.h - 24 };
}

function inside(rect: Rect, x: number, y: number, pad = 0) {
  return x > rect.x + pad && x < rect.x + rect.w - pad && y > rect.y + pad && y < rect.y + rect.h - pad;
}

function fencesFor(pen: Pen): Rect[] {
  const t = 9;
  const mid = pen.gate === 'left' || pen.gate === 'right' ? pen.y + pen.h / 2 : pen.x + pen.w / 2;
  const half = pen.opening / 2;
  const fences: Rect[] = [];

  const split = (along: 'h' | 'v', x: number, y: number, w: number, h: number) => {
    if (along === 'v') {
      fences.push({ x, y, w, h: Math.max(0, mid - half - y) });
      fences.push({ x, y: mid + half, w, h: Math.max(0, y + h - (mid + half)) });
    } else {
      fences.push({ x, y, w: Math.max(0, mid - half - x), h });
      fences.push({ x: mid + half, y, w: Math.max(0, x + w - (mid + half)), h });
    }
  };

  if (pen.gate === 'top') split('h', pen.x, pen.y, pen.w, t);
  else fences.push({ x: pen.x, y: pen.y, w: pen.w, h: t });
  if (pen.gate === 'bottom') split('h', pen.x, pen.y + pen.h - t, pen.w, t);
  else fences.push({ x: pen.x, y: pen.y + pen.h - t, w: pen.w, h: t });
  if (pen.gate === 'left') split('v', pen.x, pen.y, t, pen.h);
  else fences.push({ x: pen.x, y: pen.y, w: t, h: pen.h });
  if (pen.gate === 'right') split('v', pen.x + pen.w - t, pen.y, t, pen.h);
  else fences.push({ x: pen.x + pen.w - t, y: pen.y, w: t, h: pen.h });

  return fences.filter((fence) => fence.w > 2 && fence.h > 2);
}

function gateLine(pen: Pen): Rect {
  const t = 8;
  const mid = pen.gate === 'left' || pen.gate === 'right' ? pen.y + pen.h / 2 : pen.x + pen.w / 2;
  const half = pen.opening / 2;
  if (pen.gate === 'left') return { x: pen.x, y: mid - half, w: t, h: pen.opening };
  if (pen.gate === 'right') return { x: pen.x + pen.w - t, y: mid - half, w: t, h: pen.opening };
  if (pen.gate === 'top') return { x: mid - half, y: pen.y, w: pen.opening, h: t };
  return { x: mid - half, y: pen.y + pen.h - t, w: pen.opening, h: t };
}

function resolveCircleRect(entity: { x: number; y: number; vx: number; vy: number }, radius: number, rect: Rect) {
  const closestX = clamp(entity.x, rect.x, rect.x + rect.w);
  const closestY = clamp(entity.y, rect.y, rect.y + rect.h);
  const dx = entity.x - closestX;
  const dy = entity.y - closestY;
  const dist = hypot(dx, dy);
  if (dist === 0) {
    const left = entity.x - rect.x;
    const right = rect.x + rect.w - entity.x;
    const top = entity.y - rect.y;
    const bottom = rect.y + rect.h - entity.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) entity.x = rect.x - radius;
    else if (min === right) entity.x = rect.x + rect.w + radius;
    else if (min === top) entity.y = rect.y - radius;
    else entity.y = rect.y + rect.h + radius;
    if (min === left || min === right) entity.vx *= -0.25;
    else entity.vy *= -0.25;
    return true;
  }
  if (dist < radius) {
    const push = (radius - dist) / dist;
    entity.x += dx * push;
    entity.y += dy * push;
    const nx = dx / dist;
    const ny = dy / dist;
    const impact = entity.vx * nx + entity.vy * ny;
    if (impact < 0) {
      entity.vx -= nx * impact * 1.35;
      entity.vy -= ny * impact * 1.35;
    }
    return true;
  }
  return false;
}

function avoidRect(x: number, y: number, radius: number, rect: Rect, reach: number): Vec {
  const closestX = clamp(x, rect.x, rect.x + rect.w);
  const closestY = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - closestX;
  const dy = y - closestY;
  const dist = hypot(dx, dy);
  if (dist > reach || dist === 0) return { x: 0, y: 0 };
  const strength = ((reach - dist) / reach) * 240;
  return { x: (dx / dist) * strength, y: (dy / dist) * strength };
}

function solids(field: Field, forDog: boolean): { rect: Rect; kind: Kind | 'fence' }[] {
  const items: { rect: Rect; kind: Kind | 'fence' }[] = fencesFor(field.pen).map((rect) => ({ rect, kind: 'fence' }));
  for (const obstacle of field.obstacles) {
    if (forDog && obstacle.kind === 'pond') continue;
    items.push({ rect: obstacle, kind: obstacle.kind });
  }
  return items;
}

function clearOf(field: Field, x: number, y: number, radius: number) {
  if (x < MARGIN + radius || x > WORLD_W - MARGIN - radius || y < MARGIN + radius || y > WORLD_H - MARGIN - radius) {
    return false;
  }
  if (inside(field.pen, x, y, -4)) return false;
  for (const item of solids(field, false)) {
    const closestX = clamp(x, item.rect.x, item.rect.x + item.rect.w);
    const closestY = clamp(y, item.rect.y, item.rect.y + item.rect.h);
    if (hypot(x - closestX, y - closestY) < radius + 10) return false;
  }
  return true;
}

function place(field: Field, origin: Vec, spreadX: number, spreadY: number, radius: number): Vec {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const x = origin.x + (Math.random() - 0.5) * spreadX;
    const y = origin.y + (Math.random() - 0.5) * spreadY;
    if (clearOf(field, x, y, radius)) return { x, y };
  }
  return { x: clamp(origin.x, 80, 360), y: clamp(origin.y, 80, WORLD_H - 80) };
}

function loadField(score: number, index: number): Sim {
  const field = FIELDS[index];
  const origin = { x: 168, y: WORLD_H * 0.5 };
  const sheep: Sheep[] = Array.from({ length: field.flock }, () => {
    const pos = place(field, origin, 150, 170, SHEEP_R);
    return {
      x: pos.x,
      y: pos.y,
      vx: (Math.random() - 0.5) * 18,
      vy: (Math.random() - 0.5) * 18,
      heading: Math.random() * Math.PI * 2,
      bob: Math.random() * Math.PI * 2,
      penned: false,
      stuck: 0,
      wander: Math.random() * Math.PI * 2,
    };
  });
  const dogPos = place(field, { x: origin.x - 86, y: origin.y + 10 }, 40, 50, DOG_R);
  return {
    field: index,
    time: field.time,
    score,
    phase: 'play',
    hold: 0,
    dog: { x: dogPos.x, y: dogPos.y, vx: 0, vy: 0, heading: 0, gait: 0 },
    sheep,
    whistle: 0,
    flash: 0,
  };
}

function freshSim(): Sim {
  return loadField(0, 0);
}

function currentField(sim: Sim) {
  return FIELDS[sim.field];
}

function contain(entity: { x: number; y: number; vx: number; vy: number }, radius: number) {
  if (entity.x < MARGIN + radius) {
    entity.x = MARGIN + radius;
    entity.vx = Math.abs(entity.vx) * 0.4;
  }
  if (entity.x > WORLD_W - MARGIN - radius) {
    entity.x = WORLD_W - MARGIN - radius;
    entity.vx = -Math.abs(entity.vx) * 0.4;
  }
  if (entity.y < MARGIN + radius) {
    entity.y = MARGIN + radius;
    entity.vy = Math.abs(entity.vy) * 0.4;
  }
  if (entity.y > WORLD_H - MARGIN - radius) {
    entity.y = WORLD_H - MARGIN - radius;
    entity.vy = -Math.abs(entity.vy) * 0.4;
  }
}

type Events = {
  penned: (folded: number, flock: number) => void;
  fieldWon: (bonus: number, score: number, name: string) => void;
  timesUp: (folded: number, flock: number) => void;
  nextField: (name: string) => void;
  complete: (score: number) => void;
};

function stepDog(sim: Sim, dt: number, keys: Set<string>, pointer: Pointer) {
  const field = currentField(sim);
  const dog = sim.dog;
  let ax = 0;
  let ay = 0;
  if (keys.has('left')) ax -= 1;
  if (keys.has('right')) ax += 1;
  if (keys.has('up')) ay -= 1;
  if (keys.has('down')) ay += 1;
  const keyed = ax !== 0 || ay !== 0;
  if (keyed) {
    const len = hypot(ax, ay) || 1;
    ax = (ax / len) * 820;
    ay = (ay / len) * 820;
  } else if (pointer) {
    const dx = pointer.x - dog.x;
    const dy = pointer.y - dog.y;
    const dist = hypot(dx, dy);
    if (dist > 10) {
      ax = (dx / dist) * 820;
      ay = (dy / dist) * 820;
    }
  }
  dog.vx += ax * dt;
  dog.vy += ay * dt;
  dog.vx *= 1 - Math.min(0.92, 5.6 * dt);
  dog.vy *= 1 - Math.min(0.92, 5.6 * dt);
  const pond = field.obstacles.find((item) => item.kind === 'pond' && inside(item, dog.x, dog.y, 0));
  const max = pond ? 88 : 192;
  const speed = hypot(dog.vx, dog.vy);
  if (speed > max) {
    dog.vx = (dog.vx / speed) * max;
    dog.vy = (dog.vy / speed) * max;
  }
  dog.x += dog.vx * dt;
  dog.y += dog.vy * dt;
  for (const item of solids(field, true)) resolveCircleRect(dog, DOG_R, item.rect);
  contain(dog, DOG_R);
  if (speed > 12) dog.heading = Math.atan2(dog.vy, dog.vx);
  dog.gait += speed * dt * 0.12;
}

function stepSheep(sim: Sim, dt: number, events: Events) {
  const field = currentField(sim);
  const gate = gateCenter(field.pen);
  const interior = penInterior(field.pen);
  const walls = solids(field, false);
  const closedGate = gateLine(field.pen);
  const flock = sim.sheep.filter((sheep) => !sheep.penned);
  let cx = 0;
  let cy = 0;
  if (flock.length) {
    for (const sheep of flock) {
      cx += sheep.x;
      cy += sheep.y;
    }
    cx /= flock.length;
    cy /= flock.length;
  }

  for (const sheep of sim.sheep) {
    let ax = 0;
    let ay = 0;
    sheep.wander += (Math.random() - 0.5) * 2.8 * dt;
    ax += Math.cos(sheep.wander) * 18;
    ay += Math.sin(sheep.wander) * 18;

    if (sheep.penned) {
      ax += (interior.x + interior.w / 2 - sheep.x) * 1.6;
      ay += (interior.y + interior.h / 2 - sheep.y) * 1.6;
    } else {
      let sepX = 0;
      let sepY = 0;
      let aliX = 0;
      let aliY = 0;
      let cohX = 0;
      let cohY = 0;
      let near = 0;
      for (const other of sim.sheep) {
        if (other === sheep || other.penned) continue;
        const dx = sheep.x - other.x;
        const dy = sheep.y - other.y;
        const dist = hypot(dx, dy) || 0.001;
        if (dist < 28) {
          sepX += (dx / dist) * (28 - dist);
          sepY += (dy / dist) * (28 - dist);
        }
        if (dist < 88) {
          aliX += other.vx;
          aliY += other.vy;
          cohX += other.x;
          cohY += other.y;
          near += 1;
        }
      }
      ax += sepX * 9.5;
      ay += sepY * 9.5;
      if (near) {
        ax += (aliX / near - sheep.vx) * 1.35;
        ay += (aliY / near - sheep.vy) * 1.35;
        ax += (cohX / near - sheep.x) * 0.55;
        ay += (cohY / near - sheep.y) * 0.55;
      }

      const ddx = sheep.x - sim.dog.x;
      const ddy = sheep.y - sim.dog.y;
      const dogDist = hypot(ddx, ddy) || 0.001;
      if (dogDist < 92) {
        const panic = dogDist < 30;
        const pressure = ((92 - dogDist) / 92) ** 1.15;
        const away = panic ? 560 : 310;
        ax += (ddx / dogDist) * away * pressure;
        ay += (ddy / dogDist) * away * pressure;
        ax += (-ddy / dogDist) * (panic ? 90 : 36) * pressure;
        ay += (ddx / dogDist) * (panic ? 90 : 36) * pressure;
        const behind = ddx * (gate.x - sheep.x) + ddy * (gate.y - sheep.y);
        if (!panic && behind > 0 && dogDist < 80) {
          const toGate = hypot(gate.x - sheep.x, gate.y - sheep.y) || 1;
          ax += ((gate.x - sheep.x) / toGate) * 150 * pressure;
          ay += ((gate.y - sheep.y) / toGate) * 150 * pressure;
        }
      }

      const toOpening = hypot(gate.x - sheep.x, gate.y - sheep.y);
      if (toOpening < 78 && Math.abs(sheep.y - gate.y) < field.pen.opening * 0.62) {
        ax += ((gate.x + 36 - sheep.x) / (toOpening || 1)) * 90;
        ay += ((gate.y - sheep.y) / (toOpening || 1)) * 90;
      }

      if (sim.whistle > 0.05) {
        const stray = hypot(sheep.x - cx, sheep.y - cy);
        if (flock.length && stray > 120) {
          ax += (cx - sheep.x) * 1.8;
          ay += (cy - sheep.y) * 1.8;
        }
        if (dogDist < 140) {
          ax += (ddx / dogDist) * 120;
          ay += (ddy / dogDist) * 120;
        }
      }

      for (const item of walls) {
        const force = avoidRect(sheep.x, sheep.y, SHEEP_R, item.rect, item.kind === 'pond' ? 46 : 34);
        ax += force.x;
        ay += force.y;
      }
    }

    sheep.vx += ax * dt;
    sheep.vy += ay * dt;
    sheep.vx *= 1 - Math.min(0.9, 3.4 * dt);
    sheep.vy *= 1 - Math.min(0.9, 3.4 * dt);
    const max = sheep.penned ? 42 : hypot(sheep.x - sim.dog.x, sheep.y - sim.dog.y) < 34 ? 132 : 94;
    const speed = hypot(sheep.vx, sheep.vy);
    if (speed > max) {
      sheep.vx = (sheep.vx / speed) * max;
      sheep.vy = (sheep.vy / speed) * max;
    }
    sheep.x += sheep.vx * dt;
    sheep.y += sheep.vy * dt;

    let hit = false;
    for (const item of walls) {
      if (resolveCircleRect(sheep, SHEEP_R, item.rect)) hit = true;
    }
    if (sheep.penned && resolveCircleRect(sheep, SHEEP_R, closedGate)) hit = true;
    contain(sheep, SHEEP_R);

    if (speed < 10 && hit) sheep.stuck += dt;
    else sheep.stuck = 0;
    if (sheep.stuck > 1.05) {
      const homeX = sheep.penned ? interior.x + interior.w / 2 : cx || WORLD_W * 0.35;
      const homeY = sheep.penned ? interior.y + interior.h / 2 : cy || WORLD_H * 0.5;
      sheep.vx += (homeX - sheep.x) * 0.55 + (Math.random() - 0.5) * 70;
      sheep.vy += (homeY - sheep.y) * 0.55 + (Math.random() - 0.5) * 70;
      sheep.stuck = 0;
    }

    if (speed > 8) sheep.heading = Math.atan2(sheep.vy, sheep.vx);
    sheep.bob += dt * (6 + speed * 0.08);

    if (!sheep.penned && inside(interior, sheep.x, sheep.y, 0)) {
      sheep.penned = true;
      sheep.vx *= 0.35;
      sheep.vy *= 0.35;
      sim.score += PEN_SCORE;
      sim.flash = 0.22;
      events.penned(sim.sheep.filter((item) => item.penned).length, field.flock);
    }
  }
}

function advance(sim: Sim, dt: number, events: Events) {
  if (sim.phase === 'done') return;
  sim.whistle = Math.max(0, sim.whistle - dt);
  sim.flash = Math.max(0, sim.flash - dt);
  if (sim.phase === 'hold') {
    sim.hold -= dt;
    if (sim.hold > 0) return;
    if (sim.field + 1 >= FIELDS.length) {
      sim.phase = 'done';
      events.complete(sim.score);
      return;
    }
    const next = loadField(sim.score, sim.field + 1);
    Object.assign(sim, next);
    events.nextField(FIELDS[next.field].name);
    return;
  }

  sim.time = Math.max(0, sim.time - dt);
  const field = currentField(sim);
  const folded = sim.sheep.filter((sheep) => sheep.penned).length;
  if (folded >= field.flock) {
    const bonus = Math.round(sim.time) * TIME_SCORE;
    sim.score += bonus;
    sim.phase = 'hold';
    sim.hold = HOLD;
    sim.flash = 0.4;
    events.fieldWon(bonus, sim.score, field.name);
    return;
  }
  if (sim.time <= 0) {
    sim.phase = 'hold';
    sim.hold = HOLD;
    events.timesUp(folded, field.flock);
  }
}

function toWorld(event: { clientX: number; clientY: number }, canvas: HTMLCanvasElement): Vec {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WORLD_W,
    y: ((event.clientY - rect.top) / rect.height) * WORLD_H,
  };
}

function keyDir(code: string): 'left' | 'right' | 'up' | 'down' | null {
  if (code === 'ArrowLeft' || code === 'KeyA') return 'left';
  if (code === 'ArrowRight' || code === 'KeyD') return 'right';
  if (code === 'ArrowUp' || code === 'KeyW') return 'up';
  if (code === 'ArrowDown' || code === 'KeyS') return 'down';
  return null;
}

export default function FoldHerdGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('fold-herd-best');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim>(freshSim());
  const keys = useRef(new Set<string>());
  const pointer = useRef<Pointer>(null);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState('Open Fold · ease them through the gate.');

  const restart = useCallback(() => {
    sim.current = freshSim();
    pointer.current = null;
    setScore(0);
    setStatus('Open Fold · ease them through the gate.');
  }, []);

  const whistle = useCallback(() => {
    const state = sim.current;
    if (state.phase !== 'play') return;
    state.whistle = 0.55;
    beep(620, 0.08);
  }, [beep]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const events: Events = {
      penned(folded, flock) {
        setScore(sim.current.score);
        setStatus(`${folded} / ${flock} folded`);
        beep(520 + folded * 50, 0.06);
      },
      fieldWon(bonus, nextScore, name) {
        setScore(nextScore);
        setStatus(`${name} folded. +${bonus} time.`);
        beep(840, 0.14);
      },
      timesUp(folded, flock) {
        setStatus(`Time's up. ${folded} / ${flock} made the pen.`);
        beep(160, 0.16);
      },
      nextField(name) {
        setStatus(`${name} · ease them through the gate.`);
        beep(400, 0.05);
      },
      complete(finalScore) {
        setScore(finalScore);
        commitBest(finalScore);
        setStatus(finalScore ? `All four folds. Final ${finalScore}.` : 'The flock scattered. Try another fold.');
        beep(760, 0.18);
      },
    };

    let frame = 0;
    let last = performance.now();
    let running = true;

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      const nextW = Math.floor(width * dpr);
      const nextH = Math.floor(height * dpr);
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
      ctx.setTransform((dpr * width) / WORLD_W, 0, 0, (dpr * height) / WORLD_H, 0, 0);

      const state = sim.current;
      if (state.phase === 'play') {
        if (keys.current.size) pointer.current = null;
        stepDog(state, dt, keys.current, pointer.current);
        stepSheep(state, dt, events);
      } else if (state.phase !== 'done') {
        for (const sheep of state.sheep) sheep.bob += dt * 5;
        state.dog.gait += dt * 2;
      }
      advance(state, dt, events);
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
    };
  }, [beep, commitBest]);

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      const dir = keyDir(event.code);
      if (dir) {
        event.preventDefault();
        keys.current.add(dir);
      } else if (event.code === 'Space') {
        event.preventDefault();
        whistle();
      } else if (event.code === 'KeyR') {
        restart();
      }
    };
    const onUp = (event: KeyboardEvent) => {
      const dir = keyDir(event.code);
      if (dir) keys.current.delete(dir);
    };
    window.addEventListener('keydown', onDown, { passive: false });
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [restart, whistle]);

  const aim = (event: PointerEvent<HTMLCanvasElement>) => {
    pointer.current = { ...toWorld(event, event.currentTarget), id: event.pointerId };
  };

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
        className="mx-auto block aspect-[8/5] w-full touch-none select-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          aim(event);
        }}
        onPointerMove={(event) => {
          if (pointer.current?.id === event.pointerId) aim(event);
        }}
        onPointerUp={(event) => {
          if (pointer.current?.id === event.pointerId) pointer.current = { ...toWorld(event, event.currentTarget), id: event.pointerId };
        }}
        onPointerCancel={() => {
          pointer.current = null;
        }}
        role="img"
        aria-label="Fold Herd pasture"
      />
    </GameShell>
  );
}

function draw(ctx: CanvasRenderingContext2D, state: Sim) {
  const theme = readThemeColors();
  const field = currentField(state);
  const night = theme.ink === '#f3eee6';
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = night ? '#10140f' : '#16120f';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.fillStyle = night ? 'rgba(232,168,124,0.05)' : 'rgba(232,168,124,0.06)';
  for (const blade of GRASS) {
    ctx.fillRect(blade.x, blade.y, 1.2, blade.h);
  }

  const pen = field.pen;
  ctx.fillStyle = state.flash > 0 ? 'rgba(232,168,124,0.16)' : 'rgba(232,168,124,0.08)';
  ctx.beginPath();
  ctx.roundRect(pen.x + 6, pen.y + 6, pen.w - 12, pen.h - 12, 10);
  ctx.fill();

  const opening = gateLine(pen);
  ctx.fillStyle = 'rgba(240,216,200,0.16)';
  ctx.fillRect(opening.x - 6, opening.y, opening.w + 12, opening.h);

  for (const obstacle of field.obstacles) {
    if (obstacle.kind === 'pond') {
      ctx.beginPath();
      ctx.roundRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h, 48);
      ctx.fillStyle = night ? '#1a3a42' : '#1c3338';
      ctx.fill();
      ctx.strokeStyle = 'rgba(160, 210, 214, 0.28)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(obstacle.x + obstacle.w * 0.38, obstacle.y + obstacle.h * 0.38, 28, 10, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(240,216,200,0.12)';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.roundRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h, 8);
      ctx.fillStyle = night ? '#24301f' : '#2a2618';
      ctx.fill();
      ctx.strokeStyle = 'rgba(232,168,124,0.18)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(232,168,124,0.12)';
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.arc(obstacle.x + 7 + ((i * 37) % (obstacle.w - 10)), obstacle.y + 8 + ((i * 19) % (obstacle.h - 10)), 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  for (const fence of fencesFor(pen)) {
    ctx.beginPath();
    ctx.roundRect(fence.x, fence.y, fence.w, fence.h, 3);
    ctx.fillStyle = '#8a5a38';
    ctx.fill();
  }

  for (const sheep of state.sheep) {
    drawSheep(ctx, sheep, theme.accent);
  }
  drawDog(ctx, state.dog, theme.accent);

  if (state.whistle > 0) {
    ctx.beginPath();
    ctx.arc(state.dog.x, state.dog.y, 28 + (0.55 - state.whistle) * 90, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(232,168,124,${state.whistle})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const folded = state.sheep.filter((sheep) => sheep.penned).length;
  ctx.fillStyle = theme.muted;
  ctx.font = '13px ui-sans-serif, system-ui';
  ctx.fillText(`${field.name} · ${folded}/${field.flock}`, 16, 24);
  ctx.fillStyle = state.time < 10 && state.phase === 'play' ? theme.accent : theme.muted;
  ctx.fillText(`${Math.ceil(state.time)}s`, WORLD_W - 52, 24);

  if (state.phase === 'done') {
    ctx.fillStyle = 'rgba(12,11,10,0.48)';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.fillStyle = '#f3eee6';
    ctx.font = '28px ui-serif, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Herd complete', WORLD_W / 2, WORLD_H / 2 - 8);
    ctx.font = '16px ui-sans-serif, system-ui';
    ctx.fillStyle = theme.accent;
    ctx.fillText(`${state.score}`, WORLD_W / 2, WORLD_H / 2 + 22);
    ctx.textAlign = 'left';
  }
}

function drawSheep(ctx: CanvasRenderingContext2D, sheep: Sheep, accent: string) {
  const bob = Math.sin(sheep.bob) * (sheep.penned ? 0.6 : 1.5);
  ctx.save();
  ctx.translate(sheep.x, sheep.y + bob);
  ctx.rotate(sheep.heading);
  ctx.beginPath();
  ctx.ellipse(1, 4, 8, 3.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 7.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = sheep.penned ? '#f4e0c8' : '#f0d8c8';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(9.5, -1, 4.2, 3.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#3d3832';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(8.4, -4.2, 1.6, 2.2, -0.4, 0, Math.PI * 2);
  ctx.fill();
  if (sheep.penned) {
    ctx.beginPath();
    ctx.arc(-2, -1, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
  }
  ctx.restore();
}

function drawDog(ctx: CanvasRenderingContext2D, dog: Dog, accent: string) {
  const stretch = 1 + Math.min(0.12, hypot(dog.vx, dog.vy) / 1400);
  const bob = Math.sin(dog.gait * 10) * Math.min(1.8, hypot(dog.vx, dog.vy) * 0.02);
  ctx.save();
  ctx.translate(dog.x, dog.y + bob);
  ctx.rotate(dog.heading);
  ctx.scale(stretch, 1);
  ctx.beginPath();
  ctx.ellipse(1, 6, 9, 3.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 7.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(11, -1.2, 5, 3.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#c46a3a';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, -4);
  ctx.lineTo(6, -10);
  ctx.lineTo(12, -3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.quadraticCurveTo(-18, -4 + Math.sin(dog.gait * 12) * 3, -16, 3);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.restore();
}
