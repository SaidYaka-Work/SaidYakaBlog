import type {
  Direction,
  Grade,
  LessonStep,
  Mesh,
  Mode,
  Motion,
  Peg,
  Piece,
  Placement,
  Point,
  Puzzle,
  Ratio,
  Result,
  Target,
  Teeth,
} from './types';

export const MAX_SCORE = 100;
export const MIN_SOLVED_SCORE = 20;
export const TIME_STEP_SECONDS = 30;
export const TIME_STEP_COST = 2;
export const MOVE_COST = 2;
export const EXTRA_GEAR_COST = 14;
export const LAUNCH_DATE = '2026-10-31';
export const ROTATION_SEED = 0x674541;
export const MODULE = 20;
export const MESH_EPS = 0.08;
export const OMEGA_EPS = 1e-6;

const TEETH_NICE = [8, 12, 16, 24] as const;
const TEETH_ALL = [8, 10, 12, 16, 20, 24] as const;
const ANGLES = [0, 1, 2, 3, 4, 5, 6, 7].map((step) => (step * Math.PI) / 4);

const GRADE_LABEL: Record<Grade, string> = {
  swift: 'Swift',
  steady: 'Steady',
  patient: 'Patient',
};

const dailyCache = new Map<string, Puzzle>();

export function utcDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dateSeed(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return ((year * 10000 + month * 100 + day) ^ ROTATION_SEED) >>> 0;
}

export function mulberry32(seed: number) {
  return () => {
    let next = (seed += 0x6d2b79f5);
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function calendarDayIndex(date: string, launch = LAUNCH_DATE): number {
  const current = Date.parse(`${date}T00:00:00Z`);
  const origin = Date.parse(`${launch}T00:00:00Z`);
  return Math.floor((current - origin) / 86_400_000);
}

export function puzzleNumberForDate(date: string): number {
  return Math.max(1, calendarDayIndex(date) + 1);
}

export function addUtcDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const rest = x % y;
    x = y;
    y = rest;
  }
  return x || 1;
}

export function reduceRatio(num: number, den: number): Ratio {
  const n = Math.abs(Math.round(num));
  const d = Math.abs(Math.round(den)) || 1;
  const g = gcd(n, d);
  return { num: n / g, den: d / g };
}

export function radius(teeth: number): number {
  return teeth / MODULE;
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function facesOf(teeth: Teeth | readonly number[]): number[] {
  return [...teeth];
}

export function isCompound(piece: Pick<Piece, 'teeth'>): boolean {
  return piece.teeth.length > 1 && piece.teeth[0] !== piece.teeth[1];
}

export function largestTeeth(teeth: Teeth | readonly number[]): number {
  return Math.max(...teeth);
}

export function meshFaces(
  distance: number,
  facesA: readonly number[],
  facesB: readonly number[],
): { teethA: number; teethB: number } | null {
  let best: { teethA: number; teethB: number; err: number } | null = null;
  for (const teethA of facesA) {
    for (const teethB of facesB) {
      const err = Math.abs(distance - (radius(teethA) + radius(teethB)));
      if (err <= MESH_EPS && (!best || err < best.err)) {
        best = { teethA, teethB, err };
      }
    }
  }
  return best ? { teethA: best.teethA, teethB: best.teethB } : null;
}

export function emptyPlacement(): Placement {
  return {};
}

export function pegKey(id: number): string {
  return String(id);
}

export function pieceOnPeg(placement: Placement, pegId: number): string | undefined {
  return placement[pegKey(pegId)];
}

export function outputPeg(puzzle: Puzzle): Peg {
  return puzzle.pegs.find((peg) => peg.role === 'output') ?? puzzle.pegs[puzzle.pegs.length - 1];
}

export function motorPeg(puzzle: Puzzle): Peg {
  return puzzle.pegs.find((peg) => peg.id === puzzle.motor.peg) ?? puzzle.pegs[0];
}

export function pieceById(puzzle: Puzzle, id: string): Piece | undefined {
  return puzzle.pieces.find((piece) => piece.id === id);
}

export function occupantFaces(puzzle: Puzzle, placement: Placement, pegId: number): number[] | null {
  if (pegId === puzzle.motor.peg) return [puzzle.motor.teeth];
  const pieceId = pieceOnPeg(placement, pegId);
  if (!pieceId) return null;
  const piece = pieceById(puzzle, pieceId);
  return piece ? facesOf(piece.teeth) : null;
}

export function usedCount(placement: Placement): number {
  return Object.keys(placement).length;
}

export function solutionPlacement(puzzle: Puzzle): Placement {
  return { ...puzzle.solution };
}

function findMeshes(puzzle: Puzzle, placement: Placement): Mesh[] {
  const occupied: { id: number; faces: number[] }[] = [];
  for (const peg of puzzle.pegs) {
    const faces = occupantFaces(puzzle, placement, peg.id);
    if (faces) occupied.push({ id: peg.id, faces });
  }
  const meshes: Mesh[] = [];
  for (let i = 0; i < occupied.length; i += 1) {
    for (let j = i + 1; j < occupied.length; j += 1) {
      const left = puzzle.pegs.find((peg) => peg.id === occupied[i].id);
      const right = puzzle.pegs.find((peg) => peg.id === occupied[j].id);
      if (!left || !right) continue;
      const hit = meshFaces(dist(left, right), occupied[i].faces, occupied[j].faces);
      if (hit) {
        meshes.push({
          a: occupied[i].id,
          b: occupied[j].id,
          teethA: hit.teethA,
          teethB: hit.teethB,
        });
      }
    }
  }
  return meshes;
}

export function simulate(puzzle: Puzzle, placement: Placement): Motion {
  const meshes = findMeshes(puzzle, placement);
  const omega: Record<number, number> = { [puzzle.motor.peg]: 1 };
  const queue = [puzzle.motor.peg];
  let jammed = false;

  while (queue.length) {
    const current = queue.shift()!;
    const speed = omega[current];
    for (const mesh of meshes) {
      if (mesh.a !== current && mesh.b !== current) continue;
      const other = mesh.a === current ? mesh.b : mesh.a;
      const teethHere = mesh.a === current ? mesh.teethA : mesh.teethB;
      const teethThere = mesh.a === current ? mesh.teethB : mesh.teethA;
      const next = -speed * (teethHere / teethThere);
      if (omega[other] !== undefined) {
        if (Math.abs(omega[other] - next) > OMEGA_EPS) jammed = true;
      } else {
        omega[other] = next;
        queue.push(other);
      }
    }
  }

  return { jammed, omega, meshes };
}

export function targetOmega(target: Target): number {
  const magnitude = target.ratio.num / target.ratio.den;
  return target.direction === 'cw' ? magnitude : -magnitude;
}

export function omegaMatches(omega: number, target: Target): boolean {
  return Math.abs(omega - targetOmega(target)) <= OMEGA_EPS;
}

export function isSolved(puzzle: Puzzle, placement: Placement): boolean {
  const motion = simulate(puzzle, placement);
  if (motion.jammed) return false;
  const output = outputPeg(puzzle);
  const speed = motion.omega[output.id];
  if (speed === undefined) return false;
  return omegaMatches(speed, puzzle.target);
}

export function placePiece(placement: Placement, pegId: number, pieceId: string): Placement {
  const next: Placement = {};
  for (const [key, value] of Object.entries(placement)) {
    if (key === pegKey(pegId) || value === pieceId) continue;
    next[key] = value;
  }
  next[pegKey(pegId)] = pieceId;
  return next;
}

export function removePiece(placement: Placement, pegId: number): Placement {
  const next = { ...placement };
  delete next[pegKey(pegId)];
  return next;
}

export function trayPieces(puzzle: Puzzle, placement: Placement): Piece[] {
  const used = new Set(Object.values(placement));
  return puzzle.pieces.filter((piece) => !used.has(piece.id));
}

export function describeRatio(ratio: Ratio): string {
  if (ratio.num === ratio.den) return 'the same speed';
  if (ratio.den === 1) return `${ratio.num}× faster`;
  if (ratio.num === 1) return `1/${ratio.den} speed`;
  return `${ratio.num}/${ratio.den} speed`;
}

export function describeDirection(direction: Direction): string {
  return direction === 'cw' ? 'clockwise' : 'counter-clockwise';
}

export function describeTarget(target: Target): string {
  return `output must turn at ${describeRatio(target.ratio)}, ${describeDirection(target.direction)}`;
}

export function formatOmega(omega: number): string {
  if (!Number.isFinite(omega)) return '—';
  const sign = omega < 0 ? 'CCW' : 'CW';
  const mag = Math.abs(omega);
  const ratio = reduceRatio(Math.round(mag * 120), 120);
  if (ratio.num === ratio.den) return `1× ${sign}`;
  if (ratio.den === 1) return `${ratio.num}× ${sign}`;
  if (ratio.num === 1) return `1/${ratio.den}× ${sign}`;
  return `${ratio.num}/${ratio.den}× ${sign}`;
}

export function shortTarget(target: Target): string {
  const ratio = describeRatio(target.ratio);
  const dir = target.direction === 'cw' ? 'CW' : 'CCW';
  if (ratio === 'the same speed') return `1× ${dir}`;
  if (ratio.endsWith(' faster')) return `${ratio.replace(' faster', '')} ${dir}`;
  return `${ratio.replace(' speed', '')} ${dir}`;
}

export function directionOf(omega: number): Direction {
  return omega < 0 ? 'ccw' : 'cw';
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function ratioFromOmega(omega: number): Target {
  const mag = Math.abs(omega);
  let best = { num: 1, den: 1, err: Infinity };
  for (let den = 1; den <= 24; den += 1) {
    const num = Math.round(mag * den);
    if (num < 1 || num > 24) continue;
    const err = Math.abs(num / den - mag);
    if (err < best.err - 1e-12 || (Math.abs(err - best.err) < 1e-12 && num + den < best.num + best.den)) {
      best = { num, den, err };
    }
  }
  const ratio = reduceRatio(best.num, best.den);
  return { ratio, direction: directionOf(omega) };
}

function occupiable(puzzle: Puzzle, pegId: number): boolean {
  return pegId !== puzzle.motor.peg;
}

export function nearestPeg(puzzle: Puzzle, fromId: number, dX: number, dY: number): number | null {
  const from = puzzle.pegs.find((peg) => peg.id === fromId);
  if (!from) return null;
  let best: number | null = null;
  let bestDist = Infinity;
  for (const peg of puzzle.pegs) {
    if (peg.id === fromId) continue;
    const dx = peg.x - from.x;
    const dy = peg.y - from.y;
    if (dX !== 0 && Math.sign(dx) !== dX) continue;
    if (dY !== 0 && Math.sign(dy) !== dY) continue;
    const aligned = dX === 0 ? Math.abs(dx) < 0.35 : Math.abs(dy) < 0.35;
    const weight = aligned ? 0 : 0.45;
    const reach = Math.hypot(dx, dy) + weight;
    if (reach < bestDist) {
      best = peg.id;
      bestDist = reach;
    }
  }
  return best;
}

export function boardView(puzzle: Puzzle): { minX: number; minY: number; width: number; height: number } {
  const maxR = Math.max(
    radius(puzzle.motor.teeth),
    ...puzzle.pieces.flatMap((piece) => piece.teeth.map(radius)),
    0.45,
  );
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const peg of puzzle.pegs) {
    minX = Math.min(minX, peg.x - maxR);
    minY = Math.min(minY, peg.y - maxR);
    maxX = Math.max(maxX, peg.x + maxR);
    maxY = Math.max(maxY, peg.y + maxR);
  }
  const pad = 0.38;
  return {
    minX: minX - pad,
    minY: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

function wouldMesh(
  at: Point,
  faces: readonly number[],
  other: Point,
  otherFaces: readonly number[],
): boolean {
  return meshFaces(dist(at, other), faces, otherFaces) !== null;
}

function tooClose(at: Point, other: Point, min = 0.42): boolean {
  return dist(at, other) < min;
}

type TrainNode = {
  peg: Peg;
  piece?: Piece;
  inTeeth: number;
  outTeeth: number;
  omega: number;
};

function officialPath(puzzle: Puzzle): number[] {
  const placement = solutionPlacement(puzzle);
  const motion = simulate(puzzle, placement);
  const output = outputPeg(puzzle).id;
  const adj = new Map<number, number[]>();
  for (const mesh of motion.meshes) {
    if (!adj.has(mesh.a)) adj.set(mesh.a, []);
    if (!adj.has(mesh.b)) adj.set(mesh.b, []);
    adj.get(mesh.a)!.push(mesh.b);
    adj.get(mesh.b)!.push(mesh.a);
  }
  const parent = new Map<number, number | null>([[puzzle.motor.peg, null]]);
  const queue = [puzzle.motor.peg];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of adj.get(current) ?? []) {
      if (parent.has(next)) continue;
      parent.set(next, current);
      queue.push(next);
    }
  }
  if (!parent.has(output)) return [puzzle.motor.peg];
  const path = [output];
  while (path[0] !== puzzle.motor.peg) {
    const prev = parent.get(path[0]);
    if (prev === undefined || prev === null) break;
    path.unshift(prev);
  }
  return path;
}

function meshOnPath(meshes: Mesh[], a: number, b: number): Mesh | undefined {
  return meshes.find(
    (mesh) => (mesh.a === a && mesh.b === b) || (mesh.a === b && mesh.b === a),
  );
}

function teethToward(mesh: Mesh, pegId: number): number {
  return mesh.a === pegId ? mesh.teethA : mesh.teethB;
}

function phraseFlip(from: number, to: number): string {
  const ratio = reduceRatio(from, to);
  if (ratio.num === ratio.den) return 'same speed, opposite way';
  if (ratio.den === 1) return `${ratio.num}× as fast, opposite way`;
  if (ratio.num === 1) return `1/${ratio.den} as fast, opposite way`;
  return `${ratio.num}/${ratio.den} as fast, opposite way`;
}

export function lessonFromPlacement(puzzle: Puzzle, placement: Placement): LessonStep[] {
  const motion = simulate(puzzle, placement);
  if (motion.jammed || motion.omega[outputPeg(puzzle).id] === undefined) {
    return puzzle.lesson;
  }

  const adj = new Map<number, number[]>();
  for (const mesh of motion.meshes) {
    if (!adj.has(mesh.a)) adj.set(mesh.a, []);
    if (!adj.has(mesh.b)) adj.set(mesh.b, []);
    adj.get(mesh.a)!.push(mesh.b);
    adj.get(mesh.b)!.push(mesh.a);
  }
  const parent = new Map<number, number | null>([[puzzle.motor.peg, null]]);
  const queue = [puzzle.motor.peg];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of adj.get(current) ?? []) {
      if (parent.has(next)) continue;
      parent.set(next, current);
      queue.push(next);
    }
  }

  const output = outputPeg(puzzle).id;
  if (!parent.has(output)) return puzzle.lesson;

  const path = [output];
  while (path[0] !== puzzle.motor.peg) {
    const prev = parent.get(path[0]);
    if (prev === undefined || prev === null) break;
    path.unshift(prev);
  }

  const steps: LessonStep[] = [];
  let usedCompound = false;
  for (let i = 0; i < path.length - 1; i += 1) {
    const from = path[i];
    const to = path[i + 1];
    const mesh = meshOnPath(motion.meshes, from, to);
    if (!mesh) continue;
    const drive = teethToward(mesh, from);
    const driven = teethToward(mesh, to);
    const toPieceId = pieceOnPeg(placement, to);
    const toPiece = toPieceId ? pieceById(puzzle, toPieceId) : undefined;
    const axle =
      toPiece && isCompound(toPiece)
        ? ` That ${driven}-tooth wheel shares an axle with a ${
            toPiece.teeth[0] === driven ? toPiece.teeth[1] : toPiece.teeth[0]
          }-tooth mate, so both turn at ${formatOmega(motion.omega[to]).replace(' ', ' — ')}.`
        : '';
    if (toPiece && isCompound(toPiece)) usedCompound = true;
    const title = i === 0 ? 'The motor bites' : i === path.length - 2 ? 'The output turns' : `Mesh ${i + 1}`;
    steps.push({
      title,
      text: `A ${drive}-tooth wheel pushes a ${driven}-tooth gear: ${phraseFlip(drive, driven)}.${axle}`,
    });
  }

  steps.push({
    title: 'The rule',
    text: usedCompound
      ? 'In a simple train the middle gears cancel — only the first and last teeth set the ratio, and every mesh flips direction. A compound pair breaks that cancellation: the axle keeps one speed and offers a new tooth count to the next mesh, so ratios multiply.'
      : 'In a simple train the middle gears cancel. Only the first and last tooth counts set the speed ratio; each mesh still reverses direction, so an even number of meshes keeps the motor’s sense and an odd number flips it.',
  });
  return steps;
}

function lessonFromTrain(nodes: TrainNode[]): LessonStep[] {
  const steps: LessonStep[] = [];
  let usedCompound = false;
  for (let i = 1; i < nodes.length; i += 1) {
    const prev = nodes[i - 1];
    const node = nodes[i];
    const axle =
      node.piece && isCompound(node.piece)
        ? ` That ${node.inTeeth}-tooth wheel shares an axle with a ${node.outTeeth}-tooth mate, so both keep ${formatOmega(node.omega)}.`
        : '';
    if (node.piece && isCompound(node.piece)) usedCompound = true;
    steps.push({
      title: i === 1 ? 'The motor bites' : i === nodes.length - 1 ? 'The output turns' : `Mesh ${i}`,
      text: `A ${prev.outTeeth}-tooth wheel pushes a ${node.inTeeth}-tooth gear: ${phraseFlip(prev.outTeeth, node.inTeeth)}.${axle}`,
    });
  }
  steps.push({
    title: 'The rule',
    text: usedCompound
      ? 'In a simple train the middle gears cancel — only the first and last teeth set the ratio, and every mesh flips direction. A compound pair breaks that cancellation: the axle keeps one speed and offers a new tooth count to the next mesh, so ratios multiply.'
      : 'In a simple train the middle gears cancel. Only the first and last tooth counts set the speed ratio; each mesh still reverses direction, so an even number of meshes keeps the motor’s sense and an odd number flips it.',
  });
  return steps;
}

function blurbFor(target: Target, usedCompound: boolean): string {
  const ratio = describeRatio(target.ratio);
  const dir = describeDirection(target.direction);
  if (usedCompound) {
    return `A compound axle is a hidden multiplier. The motor still turns at 1× clockwise; after the stacked pair the output runs at ${ratio}, ${dir}. Change either face of the compound and the product moves with it.`;
  }
  return `Meshing reverses direction; tooth counts set the speed. Intermediates in a simple train cancel, so the output’s ${ratio}, ${dir}, is really just first teeth over last teeth and a count of flips.`;
}

type GrowSpec = {
  gears: number;
  compounds: number;
  decoys: number;
  decoyPegs: number;
  rich: boolean;
};

function tryGrow(random: () => number, spec: GrowSpec, id: string): Puzzle | null {
  const bank = spec.rich ? TEETH_ALL : TEETH_NICE;
  const motorTeeth = pick(spec.rich ? [8, 10, 12, 16] : [8, 12, 16], random);
  const pegs: Peg[] = [{ id: 0, x: 0, y: 0, role: 'motor' }];
  const nodes: TrainNode[] = [
    { peg: pegs[0], inTeeth: motorTeeth, outTeeth: motorTeeth, omega: 1 },
  ];
  const pieces: Piece[] = [];
  const solution: Placement = {};
  let compoundsLeft = Math.min(spec.compounds, Math.max(0, spec.gears - 1));

  for (let i = 1; i <= spec.gears; i += 1) {
    const isLast = i === spec.gears;
    const wantCompound = !isLast && compoundsLeft > 0 && (compoundsLeft >= spec.gears - i + 1 || random() < 0.62);
    const prev = nodes[nodes.length - 1];
    const inTeeth = pick(bank, random);
    let outTeeth = inTeeth;
    if (wantCompound) {
      const options = bank.filter((teeth) => teeth !== inTeeth);
      if (!options.length) return null;
      outTeeth = pick(options, random);
    }
    const gap = radius(prev.outTeeth) + radius(inTeeth);
    const angles = shuffle(ANGLES, random);
    let placed: Point | null = null;
    const newFaces = wantCompound ? [inTeeth, outTeeth] : [inTeeth];

    for (const angle of angles) {
      const at = {
        x: prev.peg.x + Math.cos(angle) * gap,
        y: prev.peg.y + Math.sin(angle) * gap,
      };
      let ok = true;
      for (const node of nodes) {
        if (node.peg.id === prev.peg.id) continue;
        if (tooClose(at, node.peg, 0.55)) {
          ok = false;
          break;
        }
        const otherFaces = node.peg.role === 'motor' ? [motorTeeth] : facesOf(node.piece!.teeth);
        if (wouldMesh(at, newFaces, node.peg, otherFaces)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      if (!wouldMesh(at, newFaces, prev.peg, [prev.outTeeth]) && !wouldMesh(at, newFaces, prev.peg, facesOf(prev.piece ? prev.piece.teeth : [motorTeeth]))) {
        continue;
      }
      placed = at;
      break;
    }
    if (!placed) return null;

    const peg: Peg = { id: i, x: placed.x, y: placed.y, role: isLast ? 'output' : 'idle' };
    pegs.push(peg);
    const piece: Piece | undefined = {
      id: `g${i}`,
      teeth: wantCompound ? [inTeeth, outTeeth] : [inTeeth],
    };
    pieces.push(piece);
    solution[pegKey(i)] = piece.id;
    const omega = -prev.omega * (prev.outTeeth / inTeeth);
    nodes.push({ peg, piece, inTeeth, outTeeth, omega });
    if (wantCompound) compoundsLeft -= 1;
  }

  const usedCompounds = nodes.some((node) => node.piece && isCompound(node.piece));
  const target = ratioFromOmega(nodes[nodes.length - 1].omega);
  if (target.ratio.num > 18 || target.ratio.den > 18) return null;
  if (Math.abs(nodes[nodes.length - 1].omega) < 0.12 || Math.abs(nodes[nodes.length - 1].omega) > 8) {
    return null;
  }

  const minX = Math.min(...pegs.map((peg) => peg.x));
  const maxX = Math.max(...pegs.map((peg) => peg.x));
  const minY = Math.min(...pegs.map((peg) => peg.y));
  const maxY = Math.max(...pegs.map((peg) => peg.y));
  if (maxX - minX > 7.5 || maxY - minY > 7.5) return null;

  const occupantAt = (pegId: number): number[] => {
    if (pegId === 0) return [motorTeeth];
    const pieceId = solution[pegKey(pegId)];
    const piece = pieces.find((item) => item.id === pieceId);
    return piece ? facesOf(piece.teeth) : [];
  };

  for (let extra = 0; extra < spec.decoyPegs; extra += 1) {
    let dropped = false;
    const radii = [0.9, 1.2, 1.4, 1.6, 1.8];
    const origin = pick(pegs, random);
    for (const reach of shuffle(radii, random)) {
      for (const angle of shuffle(ANGLES, random)) {
        const at = {
          x: origin.x + Math.cos(angle) * reach,
          y: origin.y + Math.sin(angle) * reach,
        };
        if (pegs.some((peg) => tooClose(at, peg, 0.62))) continue;
        const id = pegs.length;
        const trial: Peg = { id, x: at.x, y: at.y, role: 'idle' };
        let steals = false;
        for (const peg of pegs) {
          if (wouldMesh(trial, [12], peg, occupantAt(peg.id))) {
            steals = true;
            break;
          }
        }
        if (steals) continue;
        pegs.push(trial);
        dropped = true;
        break;
      }
      if (dropped) break;
    }
  }

  const decoyBank = spec.rich ? TEETH_ALL : TEETH_NICE;
  for (let extra = 0; extra < spec.decoys; extra += 1) {
    const teeth = pick(decoyBank, random);
    const twin = random() < 0.28 && spec.rich ? pick(decoyBank.filter((item) => item !== teeth), random) : null;
    pieces.push({
      id: `d${extra + 1}`,
      teeth: twin ? [teeth, twin] : [teeth],
    });
  }

  const shuffled = shuffle(pieces, random);
  const puzzle: Puzzle = {
    id,
    pegs,
    motor: { peg: 0, teeth: motorTeeth },
    pieces: shuffled,
    target,
    solution,
    lesson: lessonFromTrain(nodes),
    blurb: blurbFor(target, usedCompounds),
  };

  if (!isSolved(puzzle, solution)) return null;
  const motion = simulate(puzzle, solution);
  if (motion.jammed) return null;
  if (motion.meshes.length !== spec.gears) return null;
  const path = officialPath(puzzle);
  if (path.length !== spec.gears + 1) return null;
  return puzzle;
}

export type GenerateOptions = GrowSpec & { id: string };

export function generatePuzzle(seed: number, options: GenerateOptions): Puzzle {
  const random = mulberry32(seed);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const grown = tryGrow(random, options, options.id);
    if (grown) return grown;
  }
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const grown = tryGrow(random, { ...options, compounds: 0, decoyPegs: 0, decoys: 1, gears: Math.max(2, options.gears - 1) }, options.id);
    if (grown) return grown;
  }
  return HOWTO_PUZZLE;
}

export function difficultyForDate(date: string): GrowSpec {
  const weekend = isWeekend(date);
  const random = mulberry32(dateSeed(date) ^ 0x91);
  if (weekend) {
    return {
      gears: 3 + Math.floor(random() * 3),
      compounds: 1 + (random() < 0.5 ? 1 : 0),
      decoys: 2,
      decoyPegs: 1 + (random() < 0.6 ? 1 : 0),
      rich: true,
    };
  }
  return {
    gears: 2 + Math.floor(random() * 2),
    compounds: random() < 0.58 ? 1 : 0,
    decoys: 1 + (random() < 0.45 ? 1 : 0),
    decoyPegs: 1,
    rich: random() < 0.35,
  };
}

export function dailyPuzzle(date = utcDate()): Puzzle {
  const cached = dailyCache.get(date);
  if (cached) return cached;
  const difficulty = difficultyForDate(date);
  const puzzle = generatePuzzle(dateSeed(date), {
    ...difficulty,
    id: `gearwork-${date}`,
  });
  dailyCache.set(date, puzzle);
  return puzzle;
}

export function practicePuzzle(seed = Math.floor(Math.random() * 1_000_000_000)): Puzzle {
  const random = mulberry32(seed >>> 0);
  const weekend = random() < 0.3;
  return generatePuzzle(seed >>> 0, {
    gears: weekend ? 3 + Math.floor(random() * 3) : 2 + Math.floor(random() * 2),
    compounds: weekend ? 1 + (random() < 0.4 ? 1 : 0) : random() < 0.5 ? 1 : 0,
    decoys: weekend ? 2 : 1,
    decoyPegs: 1,
    rich: weekend || random() < 0.4,
    id: `gearwork-practice-${seed >>> 0}`,
  });
}

export function graceSeconds(gearCount: number): number {
  return Math.max(70, gearCount * 22 + 28);
}

export function moveGrace(puzzle: Puzzle): number {
  return usedCount(puzzle.solution) + 3;
}

export function scoreRun(seconds: number, moves: number, used: number, puzzle: Puzzle): number {
  let points = MAX_SCORE;
  const needed = usedCount(puzzle.solution);
  if (used > needed) points -= (used - needed) * EXTRA_GEAR_COST;
  const allowed = moveGrace(puzzle);
  if (moves > allowed) points -= (moves - allowed) * MOVE_COST;
  const grace = graceSeconds(needed);
  if (seconds > grace) {
    points -= Math.floor((seconds - grace) / TIME_STEP_SECONDS) * TIME_STEP_COST;
  }
  return Math.max(MIN_SOLVED_SCORE, points);
}

export function gradeFor(seconds: number, puzzle: Puzzle): Grade {
  const grace = graceSeconds(usedCount(puzzle.solution));
  if (seconds <= grace) return 'swift';
  if (seconds <= grace * 2) return 'steady';
  return 'patient';
}

export function starRating(used: number, moves: number, puzzle: Puzzle): 1 | 2 | 3 {
  const needed = usedCount(puzzle.solution);
  if (used <= needed && moves <= needed + 2) return 3;
  if (used <= needed + 1) return 2;
  return 1;
}

export function makeResult(
  puzzle: Puzzle,
  seconds: number,
  moves: number,
  placement: Placement,
): Result {
  const used = usedCount(placement);
  return {
    puzzle,
    seconds,
    moves,
    used,
    points: scoreRun(seconds, moves, used, puzzle),
    grade: gradeFor(seconds, puzzle),
    stars: starRating(used, moves, puzzle),
    lesson: lessonFromPlacement(puzzle, placement),
  };
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function gradeLabel(grade: Grade) {
  return GRADE_LABEL[grade];
}

export function starLabel(stars: 1 | 2 | 3) {
  return '★'.repeat(stars) + '☆'.repeat(3 - stars);
}

export function gearLabel(count: number) {
  return count === 1 ? '1 gear' : `${count} gears`;
}

export function moveLabel(count: number) {
  return count === 1 ? '1 move' : `${count} moves`;
}

export function shareLines(result: Result, mode: Mode, date: string): string[] {
  const title = mode === 'daily' ? `Gearwork #${puzzleNumberForDate(date)}` : 'Gearwork · practice';
  return [
    title,
    shortTarget(result.puzzle.target),
    `${starLabel(result.stars)} · ${formatTime(result.seconds)} · ${gearLabel(result.used)}`,
    `${result.points}/${MAX_SCORE}`,
  ];
}

export function pieceCaption(piece: Piece): string {
  if (isCompound(piece)) return `${piece.teeth[0]}T / ${piece.teeth[1]}T`;
  return `${piece.teeth[0]}T`;
}

export function canPlaceOn(puzzle: Puzzle, pegId: number): boolean {
  return occupiable(puzzle, pegId);
}

/** Tiny two-peg how-to: motor 8T drives a 16T output at half speed, reversed. */
export const HOWTO_PUZZLE: Puzzle = {
  id: 'gearwork-how-to',
  pegs: [
    { id: 0, x: 0, y: 0, role: 'motor' },
    { id: 1, x: 1.2, y: 0, role: 'output' },
  ],
  motor: { peg: 0, teeth: 8 },
  pieces: [{ id: 'h1', teeth: [16] }],
  target: { ratio: { num: 1, den: 2 }, direction: 'ccw' },
  solution: { '1': 'h1' },
  lesson: [
    {
      title: 'The motor bites',
      text: 'An 8-tooth motor pushes a 16-tooth gear: 1/2 as fast, opposite way.',
    },
    {
      title: 'The rule',
      text: 'In a simple train the middle gears cancel. Only the first and last tooth counts set the speed ratio; each mesh still reverses direction, so an even number of meshes keeps the motor’s sense and an odd number flips it.',
    },
  ],
  blurb:
    'Meshing reverses direction; tooth counts set the speed. The 8-tooth motor against a 16-tooth output is a clean 1/2, counter-clockwise.',
};

/** Three 12-tooth gears in a triangle — an odd loop that locks. */
export const JAM_PUZZLE: Puzzle = {
  id: 'gearwork-jam',
  pegs: [
    { id: 0, x: 0, y: 0, role: 'motor' },
    { id: 1, x: 1.2, y: 0, role: 'idle' },
    { id: 2, x: 0.6, y: 1.039230484541326, role: 'output' },
  ],
  motor: { peg: 0, teeth: 12 },
  pieces: [
    { id: 'j1', teeth: [12] },
    { id: 'j2', teeth: [12] },
  ],
  target: { ratio: { num: 1, den: 1 }, direction: 'cw' },
  solution: { '1': 'j1' },
  lesson: [],
  blurb: '',
};

export const JAM_PLACEMENT: Placement = { '1': 'j1', '2': 'j2' };
