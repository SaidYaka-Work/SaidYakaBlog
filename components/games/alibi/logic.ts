import type {
  Assignment,
  Cat,
  CellPos,
  Clue,
  Grade,
  Grid,
  Mark,
  Mode,
  Person,
  Puzzle,
  Ref,
  Result,
  Room,
  SubgridId,
  TimeSlot,
  World,
} from './types';
import { WORLDS } from './worlds';

export const MAX_SCORE = 100;
export const CHECK_COST = 12;
export const MISTAKE_COST = 3;
export const GRACE_SECONDS = 240;
export const TIME_STEP_SECONDS = 30;
export const TIME_STEP_COST = 2;
export const MIN_SOLVED_SCORE = 20;
export const LAUNCH_DATE = '2026-10-26';
export const DAILY_SIZE = 4;
export const PRACTICE_SIZE = 3;

const GRADE_LABEL: Record<Grade, string> = {
  swift: 'Swift',
  steady: 'Steady',
  patient: 'Patient',
  checked: 'Checked',
  guided: 'Guided',
};

const permCache = new Map<number, number[][]>();

export function utcDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dateSeed(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return ((year * 10000 + month * 100 + day) ^ 0xa11b1e) >>> 0;
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

function validateWorlds(worlds: readonly World[]) {
  const ids = new Set<string>();
  for (const world of worlds) {
    if (ids.has(world.id)) throw new Error(`Alibi: duplicate world ${world.id}`);
    ids.add(world.id);
    if (world.people.length < 4 || world.rooms.length < 4 || world.times.length < 4) {
      throw new Error(`Alibi: ${world.id} needs 4 people, rooms, and times`);
    }
    const names = new Set(world.people.map((person) => person.name.toLowerCase()));
    const roles = new Set(world.people.map((person) => person.role.toLowerCase()));
    const rooms = new Set(world.rooms.map((room) => room.name.toLowerCase()));
    if (names.size !== world.people.length) throw new Error(`Alibi: ${world.id} has duplicate names`);
    if (roles.size !== world.people.length) throw new Error(`Alibi: ${world.id} has duplicate roles`);
    if (rooms.size !== world.rooms.length) throw new Error(`Alibi: ${world.id} has duplicate rooms`);
    if (!world.place.trim() || !world.hook.trim() || !world.item.trim() || !world.closing.trim()) {
      throw new Error(`Alibi: ${world.id} is incomplete`);
    }
  }
  if (worlds.length < 8) throw new Error(`Alibi: need at least 8 worlds, got ${worlds.length}`);
}

validateWorlds(WORLDS);

export function permutations(n: number): number[][] {
  const hit = permCache.get(n);
  if (hit) return hit;
  const out: number[][] = [];
  const used = Array.from({ length: n }, () => false);
  const current: number[] = [];
  const walk = () => {
    if (current.length === n) {
      out.push([...current]);
      return;
    }
    for (let i = 0; i < n; i += 1) {
      if (used[i]) continue;
      used[i] = true;
      current.push(i);
      walk();
      current.pop();
      used[i] = false;
    }
  };
  walk();
  permCache.set(n, out);
  return out;
}

export function allAssignments(size: number, categories: 2 | 3): Assignment[] {
  const rooms = permutations(size);
  if (categories === 2) {
    return rooms.map((personRoom) => ({ personRoom, personTime: personRoom.map((_, index) => index) }));
  }
  const times = permutations(size);
  const out: Assignment[] = [];
  for (const personRoom of rooms) {
    for (const personTime of times) {
      out.push({ personRoom, personTime });
    }
  }
  return out;
}

export function randomAssignment(size: number, categories: 2 | 3, random: () => number): Assignment {
  const rooms = permutations(size);
  const personRoom = rooms[Math.floor(random() * rooms.length)];
  if (categories === 2) {
    return { personRoom, personTime: personRoom.map((_, index) => index) };
  }
  const times = permutations(size);
  return { personRoom, personTime: times[Math.floor(random() * times.length)] };
}

export function assignmentsEqual(a: Assignment, b: Assignment): boolean {
  return (
    a.personRoom.length === b.personRoom.length &&
    a.personRoom.every((room, index) => room === b.personRoom[index]) &&
    a.personTime.length === b.personTime.length &&
    a.personTime.every((time, index) => time === b.personTime[index])
  );
}

export function personOf(ref: Ref, assignment: Assignment): number {
  if (ref.cat === 'people') return ref.i;
  if (ref.cat === 'rooms') return assignment.personRoom.indexOf(ref.i);
  return assignment.personTime.indexOf(ref.i);
}

export function timeOf(ref: Ref, assignment: Assignment): number {
  if (ref.cat === 'times') return ref.i;
  return assignment.personTime[personOf(ref, assignment)];
}

export function together(left: Ref, right: Ref, assignment: Assignment): boolean {
  return personOf(left, assignment) === personOf(right, assignment);
}

export function clueHolds(clue: Clue, assignment: Assignment): boolean {
  if (clue.kind === 'pair' && clue.left && clue.right) {
    return together(clue.left, clue.right, assignment);
  }
  if (clue.kind === 'notPair' && clue.left && clue.right) {
    return !together(clue.left, clue.right, assignment);
  }
  if (clue.kind === 'before' && clue.earlier && clue.later) {
    const earlier = timeOf(clue.earlier, assignment);
    const later = timeOf(clue.later, assignment);
    if (clue.immediate) return later === earlier + 1;
    return earlier < later;
  }
  if (clue.kind === 'either' && clue.subject && clue.optionA && clue.optionB) {
    const matchA = together(clue.subject, clue.optionA, assignment);
    const matchB = together(clue.subject, clue.optionB, assignment);
    return matchA !== matchB && (matchA || matchB);
  }
  if (clue.kind === 'between' && clue.mid && clue.endA && clue.endB) {
    const mid = timeOf(clue.mid, assignment);
    const a = timeOf(clue.endA, assignment);
    const b = timeOf(clue.endB, assignment);
    return (a < mid && mid < b) || (b < mid && mid < a);
  }
  if (clue.kind === 'offset' && clue.earlier && clue.later) {
    return timeOf(clue.later, assignment) === timeOf(clue.earlier, assignment) + (clue.hours ?? 2);
  }
  return false;
}

export function solutionsFor(size: number, categories: 2 | 3, clues: readonly Clue[]): Assignment[] {
  return allAssignments(size, categories).filter((assignment) => clues.every((clue) => clueHolds(clue, assignment)));
}

export function solutionCount(size: number, categories: 2 | 3, clues: readonly Clue[], stopAt = 2): number {
  let count = 0;
  for (const assignment of allAssignments(size, categories)) {
    if (!clues.every((clue) => clueHolds(clue, assignment))) continue;
    count += 1;
    if (count >= stopAt) return count;
  }
  return count;
}

function ref(cat: Cat, i: number): Ref {
  return { cat, i };
}

function personName(world: World, index: number, form: 0 | 1): string {
  const person = world.people[index];
  return form === 0 ? person.name : `the ${person.role}`;
}

function roomPhrase(world: World, index: number): string {
  return `the ${world.rooms[index].name}`;
}

function whoeverRoom(world: World, index: number): string {
  return `whoever was in ${roomPhrase(world, index)}`;
}

function timePhrase(world: World, index: number): string {
  return world.times[index].name;
}

function pickForm(random: () => number): 0 | 1 {
  return random() < 0.5 ? 0 : 1;
}

function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function phrase(world: World, item: Ref, random: () => number, asSubject = true): string {
  if (item.cat === 'people') return personName(world, item.i, pickForm(random));
  if (item.cat === 'rooms') return asSubject ? whoeverRoom(world, item.i) : roomPhrase(world, item.i);
  if (asSubject) return `whoever arrived at ${timePhrase(world, item.i)}`;
  return timePhrase(world, item.i);
}

function pairText(world: World, left: Ref, right: Ref, random: () => number): string {
  const people = left.cat === 'people' ? left : right.cat === 'people' ? right : null;
  const rooms = left.cat === 'rooms' ? left : right.cat === 'rooms' ? right : null;
  const times = left.cat === 'times' ? left : right.cat === 'times' ? right : null;
  const form = pickForm(random);

  if (people && rooms) {
    if (random() < 0.45) return `The guest in ${roomPhrase(world, rooms.i)} was ${world.people[people.i].name}.`;
    return `${personName(world, people.i, form)} was in ${roomPhrase(world, rooms.i)}.`;
  }
  if (people && times) {
    return `${personName(world, people.i, form)} arrived at ${timePhrase(world, times.i)}.`;
  }
  if (rooms && times) {
    if (random() < 0.5) return `${roomPhrase(world, rooms.i)} was occupied at ${timePhrase(world, times.i)}.`;
    return `${whoeverRoom(world, rooms.i)} arrived at ${timePhrase(world, times.i)}.`;
  }
  return `${phrase(world, left, random)} was with ${phrase(world, right, random, false)}.`;
}

function notPairText(world: World, left: Ref, right: Ref, random: () => number): string {
  const people = left.cat === 'people' ? left : right.cat === 'people' ? right : null;
  const rooms = left.cat === 'rooms' ? left : right.cat === 'rooms' ? right : null;
  const times = left.cat === 'times' ? left : right.cat === 'times' ? right : null;
  const form = pickForm(random);

  if (people && rooms) {
    if (random() < 0.35) return `${whoeverRoom(world, rooms.i)} was not ${world.people[people.i].name}.`;
    return `${personName(world, people.i, form)} was not in ${roomPhrase(world, rooms.i)}.`;
  }
  if (people && times) {
    return `${personName(world, people.i, form)} did not arrive at ${timePhrase(world, times.i)}.`;
  }
  if (rooms && times) {
    if (random() < 0.5) return `${roomPhrase(world, rooms.i)} was empty at ${timePhrase(world, times.i)}.`;
    return `${whoeverRoom(world, rooms.i)} did not arrive at ${timePhrase(world, times.i)}.`;
  }
  return `${phrase(world, left, random)} was not ${phrase(world, right, random, false)}.`;
}

function makeClue(partial: Omit<Clue, 'id'> & { id?: string }): Clue {
  const id =
    partial.id ??
    [partial.kind, partial.left, partial.right, partial.earlier, partial.later, partial.subject, partial.optionA, partial.optionB, partial.mid, partial.endA, partial.endB, partial.hours, partial.immediate]
      .map((value) => {
        if (!value && value !== 0) return '';
        if (typeof value === 'object' && 'cat' in value) return `${value.cat}${value.i}`;
        return String(value);
      })
      .filter(Boolean)
      .join(':');
  return { ...partial, id };
}

export function generateCandidates(
  world: World,
  assignment: Assignment,
  size: number,
  categories: 2 | 3,
  random: () => number,
): Clue[] {
  const clues: Clue[] = [];
  const seen = new Set<string>();
  const push = (clue: Clue) => {
    const text = sentence(clue.text);
    if (seen.has(clue.id) || seen.has(text) || !text) return;
    if (!clueHolds(clue, assignment)) return;
    seen.add(clue.id);
    seen.add(text);
    clues.push({ ...clue, text });
  };

  const cats: Cat[] = categories === 3 ? ['people', 'rooms', 'times'] : ['people', 'rooms'];
  for (let a = 0; a < cats.length; a += 1) {
    for (let b = a + 1; b < cats.length; b += 1) {
      for (let i = 0; i < size; i += 1) {
        for (let j = 0; j < size; j += 1) {
          const left = ref(cats[a], i);
          const right = ref(cats[b], j);
          if (together(left, right, assignment)) {
            push(makeClue({ kind: 'pair', left, right, text: pairText(world, left, right, random) }));
          } else {
            push(makeClue({ kind: 'notPair', left, right, text: notPairText(world, left, right, random) }));
          }
        }
      }
    }
  }

  for (let p = 0; p < size; p += 1) {
    const trueRoom = assignment.personRoom[p];
    for (let room = 0; room < size; room += 1) {
      if (room === trueRoom) continue;
      const roomOrder = [trueRoom, room].sort((left, right) => left - right);
      push(
        makeClue({
          kind: 'either',
          subject: ref('people', p),
          optionA: ref('rooms', trueRoom),
          optionB: ref('rooms', room),
          text: `${personName(world, p, pickForm(random))} was in either ${roomPhrase(world, roomOrder[0])} or ${roomPhrase(world, roomOrder[1])}.`,
        }),
      );
    }
  }

  if (categories === 2) return clues;

  const subjects: Ref[] = [];
  for (let i = 0; i < size; i += 1) {
    subjects.push(ref('people', i), ref('rooms', i));
  }

  for (let i = 0; i < subjects.length; i += 1) {
    for (let j = 0; j < subjects.length; j += 1) {
      if (i === j) continue;
      const earlier = subjects[i];
      const later = subjects[j];
      if (personOf(earlier, assignment) === personOf(later, assignment)) continue;
      const delta = timeOf(later, assignment) - timeOf(earlier, assignment);
      if (delta <= 0) continue;
      if (delta === 1) {
        const laterPhrase = phrase(world, later, random);
        const earlierPhrase = phrase(world, earlier, random);
        push(
          makeClue({
            kind: 'before',
            earlier,
            later,
            immediate: true,
            text: `${laterPhrase} arrived right after ${earlierPhrase}.`,
          }),
        );
      } else {
        const earlierPhrase = phrase(world, earlier, random);
        const laterPhrase = phrase(world, later, random);
        push(
          makeClue({
            kind: 'before',
            earlier,
            later,
            immediate: false,
            text: `${earlierPhrase} arrived before ${laterPhrase}.`,
          }),
        );
        if (delta === 2) {
          const laterName = phrase(world, later, random);
          const earlierName = phrase(world, earlier, random);
          push(
            makeClue({
              kind: 'offset',
              earlier,
              later,
              hours: 2,
              text: `${laterName} arrived two hours after ${earlierName}.`,
            }),
          );
        }
      }
    }
  }

  for (let p = 0; p < size; p += 1) {
    const trueTime = assignment.personTime[p];
    for (let time = 0; time < size; time += 1) {
      if (time === trueTime) continue;
      const timeOrder = [trueTime, time].sort((left, right) => left - right);
      push(
        makeClue({
          kind: 'either',
          subject: ref('people', p),
          optionA: ref('times', trueTime),
          optionB: ref('times', time),
          text: `${personName(world, p, pickForm(random))} arrived at either ${timePhrase(world, timeOrder[0])} or ${timePhrase(world, timeOrder[1])}.`,
        }),
      );
    }
  }

  for (let mid = 0; mid < size; mid += 1) {
    for (let a = 0; a < size; a += 1) {
      for (let b = a + 1; b < size; b += 1) {
        if (mid === a || mid === b) continue;
        const clue = makeClue({
          kind: 'between',
          mid: ref('people', mid),
          endA: ref('people', a),
          endB: ref('people', b),
          text: `${personName(world, mid, pickForm(random))} arrived between ${personName(world, a, pickForm(random))} and ${personName(world, b, pickForm(random))}.`,
        });
        if (clueHolds(clue, assignment)) push(clue);
        const roomWho = whoeverRoom(world, assignment.personRoom[mid]);
        const roomMid = makeClue({
          kind: 'between',
          mid: ref('rooms', assignment.personRoom[mid]),
          endA: ref('people', a),
          endB: ref('people', b),
          text: `${roomWho} arrived between ${world.people[a].name} and ${world.people[b].name}.`,
        });
        if (clueHolds(roomMid, assignment)) push(roomMid);
      }
    }
  }

  return clues;
}

function clueStrength(clue: Clue): number {
  if (clue.kind === 'pair') return 5;
  if (clue.kind === 'either' || clue.kind === 'offset') return 4;
  if (clue.kind === 'before' && clue.immediate) return 4;
  if (clue.kind === 'between') return 3;
  if (clue.kind === 'before') return 2;
  return 1;
}

function minimizeClues(size: number, categories: 2 | 3, clues: Clue[]): Clue[] {
  const selected = [...clues].sort((a, b) => clueStrength(b) - clueStrength(a));
  let i = 0;
  while (i < selected.length) {
    const trial = selected.filter((_, index) => index !== i);
    if (solutionCount(size, categories, trial) === 1) {
      selected.splice(i, 1);
    } else {
      i += 1;
    }
  }
  return selected;
}

function fallbackClues(world: World, assignment: Assignment, size: number, categories: 2 | 3, random: () => number): Clue[] {
  const clues: Clue[] = [];
  for (let p = 0; p < size - 1; p += 1) {
    const room = assignment.personRoom[p];
    clues.push(
      makeClue({
        kind: 'pair',
        left: ref('people', p),
        right: ref('rooms', room),
        text: sentence(pairText(world, ref('people', p), ref('rooms', room), random)),
      }),
    );
    if (categories === 3) {
      const time = assignment.personTime[p];
      clues.push(
        makeClue({
          kind: 'pair',
          left: ref('people', p),
          right: ref('times', time),
          text: sentence(pairText(world, ref('people', p), ref('times', time), random)),
        }),
      );
    }
  }
  return clues;
}

function sliceWorld(world: World, size: number): World {
  return {
    ...world,
    people: world.people.slice(0, size),
    rooms: world.rooms.slice(0, size),
    times: world.times.slice(0, size),
  };
}

export function buildPuzzle(seed: number, mode: Mode): Puzzle {
  const random = mulberry32(seed);
  const size = mode === 'daily' ? DAILY_SIZE : PRACTICE_SIZE;
  const categories: 2 | 3 = mode === 'daily' ? 3 : 2;
  const world = sliceWorld(WORLDS[Math.floor(random() * WORLDS.length)], size);
  const minClues = mode === 'daily' ? 5 : 3;
  const maxClues = mode === 'daily' ? 11 : 7;

  let backup: Puzzle | undefined;
  for (let attempt = 0; attempt < 72; attempt += 1) {
    const solution = randomAssignment(size, categories, random);
    const candidates = shuffle(generateCandidates(world, solution, size, categories, random), random);
    const selected: Clue[] = [];
    for (const clue of candidates) {
      if (solutionCount(size, categories, selected) === 1) break;
      selected.push(clue);
    }
    if (solutionCount(size, categories, selected) !== 1) continue;
    const minimal = shuffle(minimizeClues(size, categories, selected), random);
    if (minimal.length < minClues || minimal.length > maxClues) continue;
    const found = solutionsFor(size, categories, minimal);
    if (found.length !== 1 || !assignmentsEqual(found[0], solution)) continue;
    const puzzle: Puzzle = {
      mode,
      size,
      categories,
      world,
      solution,
      clues: minimal,
      culprit: Math.floor(random() * size),
      generated: 'search',
    };
    if (mode === 'practice' && minimal.every((clue) => clue.kind === 'notPair')) {
      backup = backup ?? puzzle;
      continue;
    }
    return puzzle;
  }

  if (backup) return backup;

  const solution = randomAssignment(size, categories, random);
  const clues = fallbackClues(world, solution, size, categories, random);
  return {
    mode,
    size,
    categories,
    world,
    solution,
    clues,
    culprit: Math.floor(random() * size),
    generated: 'fallback',
  };
}

export function dailyPuzzle(date = utcDate()): Puzzle {
  return buildPuzzle(dateSeed(date), 'daily');
}

export function practicePuzzle(seed = Math.floor(Math.random() * 1_000_000_000)): Puzzle {
  return buildPuzzle(seed ^ 0x9e3779b9, 'practice');
}

export function emptyMarks(size: number): Mark[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 'empty' as Mark));
}

export function emptyGrid(size: number): Grid {
  return {
    personRoom: emptyMarks(size),
    personTime: emptyMarks(size),
    roomTime: emptyMarks(size),
  };
}

export function cloneGrid(grid: Grid): Grid {
  return {
    personRoom: grid.personRoom.map((row) => [...row]),
    personTime: grid.personTime.map((row) => [...row]),
    roomTime: grid.roomTime.map((row) => [...row]),
  };
}

function applyYesPlain(grid: Grid, which: SubgridId, row: number, col: number): boolean {
  const board = grid[which];
  if (!board[row] || board[row][col] === undefined) return false;
  if (board[row][col] === 'yes' && board[row].every((mark, index) => (index === col ? mark === 'yes' : mark === 'no'))) {
    const columnClean = board.every((line, index) => (index === row ? true : line[col] === 'no'));
    if (columnClean) return false;
  }
  for (let c = 0; c < board.length; c += 1) {
    board[row][c] = c === col ? 'yes' : 'no';
  }
  for (let r = 0; r < board.length; r += 1) {
    if (r === row) continue;
    board[r][col] = 'no';
  }
  return true;
}

function propagateImplied(grid: Grid): Grid {
  const next = cloneGrid(grid);
  const n = next.personRoom.length;
  let changed = true;
  let guard = 0;
  while (changed && guard < 24) {
    changed = false;
    guard += 1;
    for (let p = 0; p < n; p += 1) {
      for (let r = 0; r < n; r += 1) {
        for (let t = 0; t < n; t += 1) {
          const pr = next.personRoom[p][r];
          const pt = next.personTime[p][t];
          const rt = next.roomTime[r][t];
          if (pr === 'yes' && pt === 'yes' && rt !== 'yes') {
            changed = applyYesPlain(next, 'roomTime', r, t) || changed;
          }
          if (pr === 'yes' && rt === 'yes' && pt !== 'yes') {
            changed = applyYesPlain(next, 'personTime', p, t) || changed;
          }
          if (pt === 'yes' && rt === 'yes' && pr !== 'yes') {
            changed = applyYesPlain(next, 'personRoom', p, r) || changed;
          }
        }
      }
    }
  }
  return next;
}

export function setMark(grid: Grid, pos: CellPos, mark: Mark, categories: 2 | 3): Grid {
  if (categories === 2 && pos.grid !== 'personRoom') return grid;
  const next = cloneGrid(grid);
  if (mark === 'yes') {
    applyYesPlain(next, pos.grid, pos.row, pos.col);
    return categories === 3 ? propagateImplied(next) : next;
  }
  next[pos.grid][pos.row][pos.col] = mark;
  return next;
}

export function cycleMark(grid: Grid, pos: CellPos, categories: 2 | 3): Grid {
  const current = grid[pos.grid][pos.row][pos.col];
  const nextMark: Mark = current === 'empty' ? 'no' : current === 'no' ? 'yes' : 'empty';
  return setMark(grid, pos, nextMark, categories);
}

function rowChoice(row: Mark[]): number | null {
  const yesAt = row.findIndex((mark) => mark === 'yes');
  if (yesAt >= 0) {
    if (row.some((mark, index) => index !== yesAt && mark === 'yes')) return null;
    return yesAt;
  }
  const open: number[] = [];
  row.forEach((mark, index) => {
    if (mark !== 'no') open.push(index);
  });
  return open.length === 1 ? open[0] : null;
}

export function inferredAssignment(grid: Grid, categories: 2 | 3): Assignment | null {
  const personRoom = grid.personRoom.map(rowChoice);
  if (personRoom.some((value) => value === null)) return null;
  const rooms = personRoom as number[];
  if (new Set(rooms).size !== rooms.length) return null;
  if (categories === 2) {
    return { personRoom: rooms, personTime: rooms.map((_, index) => index) };
  }
  const personTime = grid.personTime.map(rowChoice);
  if (personTime.some((value) => value === null)) return null;
  const times = personTime as number[];
  if (new Set(times).size !== times.length) return null;
  return { personRoom: rooms, personTime: times };
}

export function isSolved(puzzle: Puzzle, grid: Grid): boolean {
  const inferred = inferredAssignment(grid, puzzle.categories);
  return inferred !== null && assignmentsEqual(inferred, puzzle.solution);
}

export function truthMark(puzzle: Puzzle, pos: CellPos): Mark {
  if (pos.grid === 'personRoom') return puzzle.solution.personRoom[pos.row] === pos.col ? 'yes' : 'no';
  if (pos.grid === 'personTime') return puzzle.solution.personTime[pos.row] === pos.col ? 'yes' : 'no';
  const roomTime = puzzle.solution.personRoom.map((room, person) => [room, puzzle.solution.personTime[person]] as const);
  const match = roomTime.some(([room, time]) => room === pos.row && time === pos.col);
  return match ? 'yes' : 'no';
}

export function wrongCells(puzzle: Puzzle, grid: Grid): CellPos[] {
  const grids: SubgridId[] = puzzle.categories === 3 ? ['personRoom', 'personTime', 'roomTime'] : ['personRoom'];
  const wrong: CellPos[] = [];
  for (const which of grids) {
    grid[which].forEach((row, r) => {
      row.forEach((mark, c) => {
        if (mark === 'empty') return;
        const pos = { grid: which, row: r, col: c };
        if (mark !== truthMark(puzzle, pos)) wrong.push(pos);
      });
    });
  }
  return wrong;
}

export function cellKey(pos: CellPos): string {
  return `${pos.grid}:${pos.row}:${pos.col}`;
}

export function visibleGrids(puzzle: Puzzle): { id: SubgridId; rows: string[]; cols: string[]; rowTitle: string; colTitle: string }[] {
  const people = puzzle.world.people.map((person) => person.name);
  const rooms = puzzle.world.rooms.map((room) => room.short);
  const times = puzzle.world.times.map((time) => time.short);
  const grids: { id: SubgridId; rows: string[]; cols: string[]; rowTitle: string; colTitle: string }[] = [
    { id: 'personRoom', rows: people, cols: rooms, rowTitle: 'Guest', colTitle: 'Room' },
  ];
  if (puzzle.categories === 3) {
    grids.push({ id: 'personTime', rows: people, cols: times, rowTitle: 'Guest', colTitle: 'Hour' });
    grids.push({
      id: 'roomTime',
      rows: puzzle.world.rooms.map((room) => room.short),
      cols: times,
      rowTitle: 'Room',
      colTitle: 'Hour',
    });
  }
  return grids;
}

export function moveCell(current: CellPos, dr: number, dc: number, puzzle: Puzzle): CellPos {
  const grids = visibleGrids(puzzle);
  const index = grids.findIndex((grid) => grid.id === current.grid);
  if (index < 0) return current;
  let gridIndex = index;
  let row = current.row + dr;
  let col = Math.max(0, Math.min(grids[index].cols.length - 1, current.col + dc));

  if (row < 0) {
    if (gridIndex > 0) {
      gridIndex -= 1;
      row = grids[gridIndex].rows.length - 1;
      col = Math.min(col, grids[gridIndex].cols.length - 1);
    } else {
      row = 0;
    }
  } else if (row >= grids[index].rows.length) {
    if (gridIndex < grids.length - 1) {
      gridIndex += 1;
      row = 0;
      col = Math.min(col, grids[gridIndex].cols.length - 1);
    } else {
      row = grids[index].rows.length - 1;
    }
  }

  return { grid: grids[gridIndex].id, row, col };
}

export function scoreRun(seconds: number, checks: number, mistakes: number): number {
  let points = MAX_SCORE - checks * CHECK_COST - mistakes * MISTAKE_COST;
  if (seconds > GRACE_SECONDS) {
    const extra = Math.floor((seconds - GRACE_SECONDS) / TIME_STEP_SECONDS);
    points -= extra * TIME_STEP_COST;
  }
  return Math.max(MIN_SOLVED_SCORE, points);
}

export function gradeFor(seconds: number, checks: number): Grade {
  if (checks >= 3) return 'guided';
  if (checks > 0) return 'checked';
  if (seconds <= GRACE_SECONDS) return 'swift';
  if (seconds <= GRACE_SECONDS * 2) return 'steady';
  return 'patient';
}

export function makeResult(puzzle: Puzzle, seconds: number, checks: number, mistakes: number): Result {
  const culprit = puzzle.world.people[puzzle.culprit];
  const room = puzzle.world.rooms[puzzle.solution.personRoom[puzzle.culprit]];
  const time = puzzle.categories === 3 ? puzzle.world.times[puzzle.solution.personTime[puzzle.culprit]] : null;
  return {
    seconds,
    checks,
    mistakes,
    points: scoreRun(seconds, checks, mistakes),
    grade: gradeFor(seconds, checks),
    culprit,
    room,
    time,
    world: puzzle.world,
    solution: puzzle.solution,
  };
}

export function revealLines(result: Result): string[] {
  const who = `${result.culprit.name}, the ${result.culprit.role}`;
  if (result.time) {
    return [
      `${who} was in the ${result.room.name} at ${result.time.name}.`,
      `That is when the ${result.world.item} left ${result.world.place}. ${result.world.closing}`,
    ];
  }
  return [
    `${who} was in the ${result.room.name}.`,
    `That is when the ${result.world.item} left ${result.world.place}. ${result.world.closing}`,
  ];
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

export function checkLabel(count: number) {
  return count === 1 ? '1 check' : `${count} checks`;
}

export function mistakeLabel(count: number) {
  return count === 1 ? '1 mistake' : `${count} mistakes`;
}

export function shareLines(result: Result, mode: Mode, date: string): string[] {
  const title = mode === 'daily' ? `Alibi #${puzzleNumberForDate(date)}` : 'Alibi · practice';
  return [
    title,
    `${formatTime(result.seconds)} · ${checkLabel(result.checks)} · ${mistakeLabel(result.mistakes)}`,
    `${result.points}/${MAX_SCORE}`,
  ];
}

export function solutionRows(puzzle: Puzzle): { person: Person; room: Room; time: TimeSlot | null }[] {
  return puzzle.world.people.map((person, index) => ({
    person,
    room: puzzle.world.rooms[puzzle.solution.personRoom[index]],
    time: puzzle.categories === 3 ? puzzle.world.times[puzzle.solution.personTime[index]] : null,
  }));
}

export function cluesAreNecessary(size: number, categories: 2 | 3, clues: readonly Clue[]): boolean {
  if (clues.length === 0) return false;
  return clues.every((_, index) => solutionCount(size, categories, clues.filter((__, i) => i !== index)) > 1);
}

export { WORLDS };
