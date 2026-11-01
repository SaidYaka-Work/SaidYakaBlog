'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { englishUrl } from '@/lib/site';
import { wrapAngle } from '../theme';
import { useGameChrome } from '../useGameChrome';
import type { Mode, Piece, Placement, Puzzle, Result } from './types';
import {
  HOWTO_PUZZLE,
  MAX_SCORE,
  boardView,
  canPlaceOn,
  dailyPuzzle,
  describeTarget,
  emptyPlacement,
  formatOmega,
  formatTime,
  gearLabel,
  gradeLabel,
  isSolved,
  largestTeeth,
  lessonFromPlacement,
  makeResult,
  moveLabel,
  nearestPeg,
  outputPeg,
  pieceById,
  pieceCaption,
  pieceOnPeg,
  placePiece,
  practicePuzzle,
  puzzleNumberForDate,
  radius,
  removePiece,
  shareLines,
  shortTarget,
  simulate,
  solutionPlacement,
  starLabel,
  trayPieces,
  utcDate,
} from './logic';

const meta = getGameBySlug('gearwork')!;

function startPuzzle(mode: Mode, date: string): Puzzle {
  return mode === 'daily' ? dailyPuzzle(date) : practicePuzzle();
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function GearworkGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('gearwork-best');
  const date = utcDate();
  const [mode, setMode] = useState<Mode>('daily');
  const [puzzle, setPuzzle] = useState<Puzzle>(() => dailyPuzzle(date));
  const [placement, setPlacement] = useState<Placement>(emptyPlacement);
  const [history, setHistory] = useState<Placement[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState(-1);
  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [result, setResult] = useState<Result | undefined>();
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [moves, setMoves] = useState(0);
  const [shareNote, setShareNote] = useState('');
  const [hint, setHint] = useState('');
  const [drag, setDrag] = useState<{ pieceId: string; fromPeg: number | null; x: number; y: number } | null>(null);

  const placementRef = useRef(placement);
  const phaseRef = useRef(phase);
  const movesRef = useRef(moves);
  const secondsRef = useRef(seconds);
  const dragRef = useRef(drag);
  const skipClickRef = useRef(false);
  placementRef.current = placement;
  phaseRef.current = phase;
  movesRef.current = moves;
  secondsRef.current = seconds;
  dragRef.current = drag;

  const motion = useMemo(() => simulate(puzzle, placement), [placement, puzzle]);
  const out = outputPeg(puzzle);
  const outputSpeed = motion.omega[out.id];
  const done = phase === 'done';
  const tray = trayPieces(puzzle, placement);

  const load = useCallback(
    (nextMode: Mode, nextPuzzle?: Puzzle) => {
      const loaded = nextPuzzle ?? startPuzzle(nextMode, date);
      setMode(nextMode);
      setPuzzle(loaded);
      setPlacement(emptyPlacement());
      setHistory([]);
      setSelected(null);
      setFocus(outputPeg(loaded).id);
      setPhase('play');
      setResult(undefined);
      setSeconds(0);
      setRunning(false);
      setMoves(0);
      setShareNote('');
      setHint('');
      setDrag(null);
      placementRef.current = emptyPlacement();
      phaseRef.current = 'play';
      movesRef.current = 0;
      secondsRef.current = 0;
      dragRef.current = null;
    },
    [date],
  );

  const restart = useCallback(() => {
    load(mode, mode === 'daily' ? dailyPuzzle(date) : puzzle);
    beep(420, 0.05);
  }, [beep, date, load, mode, puzzle]);

  const finish = useCallback(
    (nextPlacement: Placement, nextSeconds: number, nextMoves: number) => {
      if (!isSolved(puzzle, nextPlacement)) return;
      const scored = makeResult(puzzle, nextSeconds, nextMoves, nextPlacement);
      setResult(scored);
      setPhase('done');
      setRunning(false);
      setSelected(null);
      setHint('');
      setDrag(null);
      commitBest(scored.points);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      beep(880, 0.16);
    },
    [beep, commitBest, puzzle],
  );

  const applyPlacement = useCallback(
    (next: Placement) => {
      if (phaseRef.current !== 'play') return;
      const current = placementRef.current;
      if (JSON.stringify(next) === JSON.stringify(current)) return;
      setHistory((historyNow) => [...historyNow.slice(-79), current]);
      placementRef.current = next;
      setPlacement(next);
      const nextMoves = movesRef.current + 1;
      movesRef.current = nextMoves;
      setMoves(nextMoves);
      setRunning(true);
      setHint('');
      const nextMotion = simulate(puzzle, next);
      if (nextMotion.jammed) {
        setHint('That loop locks. An odd cycle of meshes fights itself.');
        beep(180, 0.07);
      } else {
        beep(540, 0.035);
      }
      if (isSolved(puzzle, next)) finish(next, secondsRef.current, nextMoves);
    },
    [beep, finish, puzzle],
  );

  const dropOnPeg = useCallback(
    (pegId: number, pieceId: string) => {
      if (phaseRef.current !== 'play') return;
      if (!canPlaceOn(puzzle, pegId)) {
        setHint('The motor is already on that peg.');
        beep(200, 0.05);
        return;
      }
      applyPlacement(placePiece(placementRef.current, pegId, pieceId));
      setSelected(null);
    },
    [applyPlacement, beep, puzzle],
  );

  const liftFromPeg = useCallback(
    (pegId: number) => {
      if (phaseRef.current !== 'play') return;
      const pieceId = pieceOnPeg(placementRef.current, pegId);
      if (!pieceId) return;
      applyPlacement(removePiece(placementRef.current, pegId));
      setSelected(pieceId);
      beep(300, 0.03);
    },
    [applyPlacement, beep],
  );

  const undo = useCallback(() => {
    if (phaseRef.current !== 'play') return;
    setHistory((historyNow) => {
      if (historyNow.length === 0) return historyNow;
      const previous = historyNow[historyNow.length - 1];
      placementRef.current = previous;
      setPlacement(previous);
      setHint('');
      setSelected(null);
      beep(300, 0.03);
      return historyNow.slice(0, -1);
    });
  }, [beep]);

  const share = useCallback(async () => {
    if (!result) return;
    const url = englishUrl('/games/gearwork');
    const text = `${shareLines(result, mode, date).join('\n')}\n${url}`;
    try {
      if (typeof navigator.share === 'function' && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
        await navigator.share({ text });
        setShareNote('Shared');
        return;
      }
    } catch {
      // fall through
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareNote('Copied');
    } catch {
      setShareNote('Could not copy');
    }
  }, [date, mode, result]);

  useEffect(() => {
    if (!running || phase !== 'play') return;
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase, running]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if (phase !== 'play') return;

      if (event.code === 'ArrowUp' || event.code === 'ArrowDown' || event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        event.preventDefault();
        const dX = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
        const dY = event.code === 'ArrowDown' ? 1 : event.code === 'ArrowUp' ? -1 : 0;
        const from = focus >= 0 ? focus : outputPeg(puzzle).id;
        const next = nearestPeg(puzzle, from, dX, dY);
        if (next === null) return;
        setFocus(next);
        beep(360, 0.02);
        return;
      }

      if (target?.tagName === 'BUTTON' && (event.code === 'Space' || event.code === 'Enter')) return;

      if (event.code === 'Escape') {
        setSelected(null);
        return;
      }
      if ((event.code === 'KeyZ' && (event.metaKey || event.ctrlKey)) || event.code === 'KeyU') {
        event.preventDefault();
        undo();
        return;
      }
      if (event.code === 'Backspace' || event.code === 'Delete' || event.code === 'KeyX') {
        if (focus >= 0 && pieceOnPeg(placementRef.current, focus)) {
          event.preventDefault();
          liftFromPeg(focus);
        }
        return;
      }
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        if (selected && focus >= 0) {
          dropOnPeg(focus, selected);
        } else if (focus >= 0 && pieceOnPeg(placementRef.current, focus)) {
          liftFromPeg(focus);
        }
        return;
      }
      if (event.key >= '1' && event.key <= '9') {
        const index = Number(event.key) - 1;
        const piece = tray[index];
        if (!piece) return;
        event.preventDefault();
        setSelected(piece.id);
        beep(440, 0.02);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [beep, dropOnPeg, focus, liftFromPeg, phase, puzzle, selected, tray, undo]);

  const pendingDrag = useRef<{ pieceId: string; fromPeg: number | null; x: number; y: number } | null>(null);

  const beginDrag = (pieceId: string, fromPeg: number | null, event: ReactPointerEvent) => {
    if (done) return;
    pendingDrag.current = { pieceId, fromPeg, x: event.clientX, y: event.clientY };
    skipClickRef.current = true;
    setSelected(pieceId);
    beep(440, 0.02);
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const pending = pendingDrag.current;
      if (pending && !dragRef.current) {
        const dx = event.clientX - pending.x;
        const dy = event.clientY - pending.y;
        if (dx * dx + dy * dy > 36) {
          skipClickRef.current = true;
          setDrag({ ...pending, x: event.clientX, y: event.clientY });
        }
        return;
      }
      setDrag((current) => (current ? { ...current, x: event.clientX, y: event.clientY } : current));
    };
    const finish = (event: PointerEvent) => {
      const current = dragRef.current ?? pendingDrag.current;
      pendingDrag.current = null;
      const wasDragging = Boolean(dragRef.current);
      setDrag(null);
      if (!current || phaseRef.current !== 'play') {
        window.setTimeout(() => {
          skipClickRef.current = false;
        }, 0);
        return;
      }
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const pegEl = hit?.closest('[data-peg]') as HTMLElement | null;
      const pegId = pegEl ? Number(pegEl.dataset.peg) : NaN;
      const overTray = Boolean(hit?.closest('[data-tray]'));
      window.setTimeout(() => {
        skipClickRef.current = false;
      }, 0);

      if (!wasDragging) {
        setSelected(current.pieceId);
        return;
      }
      if (Number.isFinite(pegId) && canPlaceOn(puzzle, pegId)) {
        if (current.fromPeg === pegId) {
          setSelected(current.pieceId);
          return;
        }
        dropOnPeg(pegId, current.pieceId);
        return;
      }
      if (overTray && current.fromPeg !== null) {
        liftFromPeg(current.fromPeg);
        return;
      }
      setSelected(current.pieceId);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [dropOnPeg, liftFromPeg, puzzle]);

  const status =
    done && result
      ? `Meshed · ${starLabel(result.stars)} · ${result.points}/${MAX_SCORE}`
      : motion.jammed
        ? `${mode === 'daily' ? 'Daily' : 'Practice'} · jammed · ${formatTime(seconds)}`
        : `${mode === 'daily' ? 'Daily' : 'Practice'} · ${shortTarget(puzzle.target)} · ${formatTime(seconds)} · ${moveLabel(moves)}`;

  return (
    <GameShell
      title={meta.title}
      howTo={meta.howTo}
      score={result?.points ?? 0}
      best={best ?? '—'}
      scoreLabel="Score"
      bestLabel="Best"
      status={status}
      muted={muted}
      onMute={toggleMute}
      onRestart={restart}
      tight
      hud="line"
      extraActions={
        <>
          {mode === 'daily' ? (
            <button
              type="button"
              onClick={() => {
                load('practice');
                beep(480, 0.05);
              }}
              className="pressable rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--ink)]"
            >
              Practice
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  load('daily');
                  beep(480, 0.05);
                }}
                className="pressable rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--ink)]"
              >
                Today’s train
              </button>
              <button
                type="button"
                onClick={() => {
                  load('practice');
                  beep(480, 0.05);
                }}
                className="pressable rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--ink)]"
              >
                New practice
              </button>
            </>
          )}
          {done ? (
            <button
              type="button"
              onClick={() => void share()}
              className="pressable rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs text-[var(--bg)]"
            >
              {shareNote || 'Share'}
            </button>
          ) : null}
        </>
      }
    >
      <div className="overflow-hidden rounded-[1.6rem] border border-[var(--line)] bg-[var(--bg-elevated)]">
        <div className="px-3 py-5 sm:px-7 sm:py-7">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Gear train</p>
            {mode === 'daily' ? (
              <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                Daily #{puzzleNumberForDate(date)}
              </span>
            ) : (
              <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Practice
              </span>
            )}
            <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              {shortTarget(puzzle.target)}
            </span>
          </div>

          {done && result ? (
            <EndBanner result={result} mode={mode} date={date} onShare={() => void share()} shareNote={shareNote} />
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              {describeTarget(puzzle.target).replace(/^./, (ch) => ch.toUpperCase())}. Motor is fixed at 1×
              clockwise.{' '}
              {motion.jammed
                ? 'The train is jammed.'
                : outputSpeed !== undefined
                  ? `Output is ${formatOmega(outputSpeed)}.`
                  : 'Output is idle.'}
            </p>
          )}

          <HowTo />

          <Board
            puzzle={puzzle}
            placement={placement}
            focus={focus}
            selected={selected}
            locked={done}
            jammed={motion.jammed}
            solved={done}
            onFocus={setFocus}
            hidePieceId={drag?.pieceId ?? null}
            onPegTap={(pegId) => {
              if (done || skipClickRef.current) return;
              setFocus(pegId);
              if (selected && canPlaceOn(puzzle, pegId)) {
                dropOnPeg(pegId, selected);
                return;
              }
              if (!selected && pieceOnPeg(placement, pegId)) {
                liftFromPeg(pegId);
              }
            }}
            onPegDragStart={beginDrag}
          />

          <Tray
            pieces={tray}
            selected={selected}
            locked={done}
            hidePieceId={drag?.fromPeg === null ? (drag?.pieceId ?? null) : null}
            onSelect={(pieceId) => {
              if (done || skipClickRef.current) return;
              setSelected((current) => (current === pieceId ? null : pieceId));
              beep(440, 0.02);
            }}
            onDragStart={beginDrag}
          />

          <p className="mt-3 hidden text-[11px] uppercase tracking-[0.14em] text-[var(--faint)] sm:block">
            tap a gear, then a peg · drag to place · 1–9 pick · arrows move · Space places · X lifts · U undo
          </p>
          <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-[var(--faint)] sm:hidden">
            tap a tray gear, then a peg — or drag it on
          </p>

          {hint ? (
            <p className="mt-3 text-sm text-[var(--muted)]" aria-live="polite">
              {hint}
            </p>
          ) : null}

          {!done ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={undo}
                disabled={history.length === 0}
                className="pressable rounded-full border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--ink)] disabled:opacity-40"
              >
                Undo
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {drag ? <DragGhost piece={pieceById(puzzle, drag.pieceId)} x={drag.x} y={drag.y} /> : null}
    </GameShell>
  );
}

function EndBanner({
  result,
  mode,
  date,
  onShare,
  shareNote,
}: {
  result: Result;
  mode: Mode;
  date: string;
  onShare: () => void;
  shareNote: string;
}) {
  const lesson = result.lesson.length ? result.lesson : lessonFromPlacement(result.puzzle, solutionPlacement(result.puzzle));
  return (
    <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
        {mode === 'daily' ? `Daily #${puzzleNumberForDate(date)}` : 'Practice train'}
      </p>
      <h2 className="mt-2 font-serif text-3xl tracking-tight">
        {result.points}
        <span className="text-xl text-[var(--muted)]"> / {MAX_SCORE}</span>
      </h2>
      <p className="mt-2 text-sm text-[var(--ink)]">
        <strong className="font-medium">{gradeLabel(result.grade)}</strong>
        <span className="text-[var(--muted)]">
          {' '}
          · {starLabel(result.stars)} · {formatTime(result.seconds)} · {gearLabel(result.used)} · {moveLabel(result.moves)}
        </span>
      </p>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{result.puzzle.blurb}</p>
      <div className="mt-4 space-y-2">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">What you learned</p>
        <ol className="space-y-2">
          {lesson.map((step, index) => (
            <li key={`${step.title}-${index}`} className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                {index + 1}. {step.title}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
      <button
        type="button"
        onClick={onShare}
        className="pressable mt-4 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]"
      >
        {shareNote || 'Copy summary'}
      </button>
    </div>
  );
}

function HowTo() {
  return (
    <details className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
      <summary className="cursor-pointer text-sm text-[var(--ink)]">How to play</summary>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        The motor is already spinning. Seat gears on the pegs so they mesh and drive the marked output at the
        target speed and direction. Meshing flips direction; speed follows tooth counts. Two gears on one axle
        are a compound — they share speed, then offer a new tooth count to the next mesh. A closed loop that
        disagrees will jam.
      </p>
      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--faint)]">Solved example</p>
      <div className="mx-auto mt-2 w-[13rem]">
        <Board
          puzzle={HOWTO_PUZZLE}
          placement={solutionPlacement(HOWTO_PUZZLE)}
          focus={-1}
          selected={null}
          locked
          compact
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
        Eight teeth push sixteen: half as fast, the other way. That is the whole rule on a two-gear train.
      </p>
    </details>
  );
}

function Tray({
  pieces,
  selected,
  locked,
  hidePieceId,
  onSelect,
  onDragStart,
}: {
  pieces: Piece[];
  selected: string | null;
  locked: boolean;
  hidePieceId?: string | null;
  onSelect: (pieceId: string) => void;
  onDragStart: (pieceId: string, fromPeg: number | null, event: ReactPointerEvent) => void;
}) {
  return (
    <div data-tray="" className="mt-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--faint)]">Tray</p>
      {pieces.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {pieces.map((piece, index) => {
            const active = piece.id === selected;
            if (piece.id === hidePieceId) return null;
            return (
              <li key={piece.id}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onSelect(piece.id)}
                  onPointerDown={(event) => {
                    if (locked || event.button === 2) return;
                    onDragStart(piece.id, null, event);
                  }}
                  className={`pressable flex min-h-12 min-w-[4.6rem] items-center gap-2 rounded-2xl border px-2.5 py-1.5 text-left ${
                    active
                      ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]'
                      : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]'
                  }`}
                  aria-pressed={active}
                  aria-label={`${pieceCaption(piece)}${index < 9 ? `, shortcut ${index + 1}` : ''}`}
                >
                  <MiniGear piece={piece} inverted={active} />
                  <span className="text-sm tabular-nums">
                    {pieceCaption(piece)}
                    <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] opacity-60">
                      {index < 9 ? index + 1 : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-[var(--muted)]">Every gear is on the board.</p>
      )}
    </div>
  );
}

function Board({
  puzzle,
  placement,
  focus,
  selected,
  locked = false,
  jammed = false,
  solved = false,
  compact = false,
  hidePieceId = null,
  onFocus,
  onPegTap,
  onPegDragStart,
}: {
  puzzle: Puzzle;
  placement: Placement;
  focus: number;
  selected: string | null;
  locked?: boolean;
  jammed?: boolean;
  solved?: boolean;
  compact?: boolean;
  hidePieceId?: string | null;
  onFocus?: (id: number) => void;
  onPegTap?: (id: number) => void;
  onPegDragStart?: (pieceId: string, fromPeg: number | null, event: ReactPointerEvent) => void;
}) {
  const motion = useMemo(() => simulate(puzzle, placement), [placement, puzzle]);
  const view = boardView(puzzle);
  const spinRefs = useRef<Map<number, SVGGElement>>(new Map());
  const angleRef = useRef<Record<number, number>>({});

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const current = motion;
      const speeds = Object.values(current.omega).map((value) => Math.abs(value));
      const maxAbs = Math.max(1, ...speeds);
      const scale = Math.min(1, 2.3 / maxAbs);
      for (const [id, el] of Array.from(spinRefs.current.entries())) {
        const omega = current.jammed ? 0 : current.omega[id];
        if (omega) {
          angleRef.current[id] = wrapAngle((angleRef.current[id] ?? 0) + omega * scale * dt * 2.05);
        }
        const angle = ((angleRef.current[id] ?? 0) * 180) / Math.PI;
        const shake = current.jammed ? Math.sin(now / 32 + id) * 2.4 : 0;
        el.setAttribute('transform', `rotate(${angle + shake})`);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [motion]);

  return (
    <svg
      className={`mx-auto block w-full touch-none select-none ${compact ? 'mt-1' : 'mt-5 max-w-[30rem]'} ${jammed ? 'seq-shake' : ''}`}
      viewBox={`${view.minX} ${view.minY} ${view.width} ${view.height}`}
      role="img"
      aria-label={`Workshop with ${puzzle.pegs.length} pegs. ${describeTarget(puzzle.target)}`}
    >
      {motion.meshes.map((mesh) => {
        const a = puzzle.pegs.find((peg) => peg.id === mesh.a);
        const b = puzzle.pegs.find((peg) => peg.id === mesh.b);
        if (!a || !b) return null;
        return (
          <line
            key={`${mesh.a}-${mesh.b}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={jammed ? 'var(--accent)' : solved ? 'var(--accent)' : 'var(--line)'}
            strokeWidth={0.045}
            strokeLinecap="round"
            opacity={0.85}
          />
        );
      })}

      {puzzle.pegs.map((peg) => {
        const pieceId = pieceOnPeg(placement, peg.id);
        const piece = pieceId && pieceId !== hidePieceId ? pieceById(puzzle, pieceId) : undefined;
        const isMotor = peg.role === 'motor';
        const faces = isMotor ? [puzzle.motor.teeth] : piece ? piece.teeth : null;
        const selectedPeg = peg.id === focus;
        const rPeg = 0.11;
        const hitR = Math.min(0.42, (faces ? radius(largestTeeth(faces)) : 0.28) + 0.06);
        const focusR = (faces ? radius(largestTeeth(faces)) : 0.22) + 0.1;
        return (
          <g
            key={peg.id}
            data-peg={peg.id}
            data-role={peg.role}
            transform={`translate(${peg.x} ${peg.y})`}
            onClick={() => {
              if (locked) return;
              onFocus?.(peg.id);
              onPegTap?.(peg.id);
            }}
            onPointerDown={(event) => {
              if (locked || !piece || !onPegDragStart) return;
              event.preventDefault();
              onFocus?.(peg.id);
              onPegDragStart(piece.id, peg.id, event);
            }}
            className={locked ? '' : 'cursor-pointer'}
            aria-label={
              isMotor
                ? `Motor peg, ${puzzle.motor.teeth} teeth, 1× clockwise`
                : peg.role === 'output'
                  ? `Output peg${piece ? `, ${pieceCaption(piece)}` : ', empty'}`
                  : `Peg${piece ? `, ${pieceCaption(piece)}` : ', empty'}`
            }
          >
            <circle r={hitR} fill="none" pointerEvents="all" />
            <circle
              r={rPeg}
              fill={peg.role === 'output' ? 'var(--accent)' : 'var(--ink)'}
              fillOpacity={0.35}
              pointerEvents="none"
            />
            {selectedPeg ? (
              <circle r={focusR} fill="none" stroke="var(--ink)" strokeWidth={0.035} pointerEvents="none" />
            ) : null}
            {!faces && selected ? (
              <circle r={0.24} fill="none" stroke="var(--accent)" strokeWidth={0.028} strokeOpacity={0.7} pointerEvents="none" />
            ) : null}
            {peg.role === 'output' && !faces ? (
              <circle r={0.22} fill="none" stroke="var(--accent)" strokeWidth={0.03} strokeDasharray="0.06 0.05" pointerEvents="none" />
            ) : null}

            {faces ? (
              <g
                ref={(node) => {
                  if (node) spinRefs.current.set(peg.id, node);
                  else spinRefs.current.delete(peg.id);
                }}
              >
                <GearDisk teeth={faces[0]} kind={isMotor ? 'motor' : peg.role === 'output' ? 'output' : 'idle'} jammed={jammed} />
                {faces[1] ? <GearDisk teeth={faces[1]} kind="compound" jammed={jammed} /> : null}
                {isMotor ? <MotorMark /> : null}
              </g>
            ) : null}

            {faces ? (
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={0.16}
                fill="var(--ink)"
                className="pointer-events-none select-none"
                style={{ fontFamily: 'ui-serif, Georgia, serif' }}
              >
                {faces.length > 1 ? `${faces[0]}/${faces[1]}` : faces[0]}
              </text>
            ) : null}

            {peg.role === 'output' ? (
              <text
                y={-(faces ? radius(largestTeeth(faces)) : 0.22) - 0.18}
                textAnchor="middle"
                fontSize={0.13}
                fill="var(--accent)"
                className="pointer-events-none select-none"
                style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
              >
                OUT
              </text>
            ) : null}
            {isMotor ? (
              <text
                y={-radius(puzzle.motor.teeth) - 0.18}
                textAnchor="middle"
                fontSize={0.13}
                fill="var(--accent)"
                className="pointer-events-none select-none"
                style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
              >
                MOTOR
              </text>
            ) : null}
          </g>
        );
      })}
      {selected && !compact ? (
        <title>Selected gear ready to seat</title>
      ) : null}
    </svg>
  );
}

function gearPath(teeth: number): string {
  const count = Math.max(6, Math.min(32, Math.round(teeth)));
  const outer = Math.min(1.35, radius(count));
  const inner = outer * 0.74;
  const step = (Math.PI * 2) / count;
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const a = i * step;
    const points = [
      [a - step * 0.34, inner],
      [a - step * 0.16, outer],
      [a + step * 0.16, outer],
      [a + step * 0.34, inner],
    ] as const;
    for (const [angle, r] of points) {
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      parts.push(`${parts.length === 0 ? 'M' : 'L'} ${x.toFixed(4)} ${y.toFixed(4)}`);
    }
  }
  return `${parts.join(' ')} Z`;
}

function GearDisk({
  teeth,
  kind,
  jammed = false,
}: {
  teeth: number;
  kind: 'motor' | 'output' | 'idle' | 'compound';
  jammed?: boolean;
}) {
  const fill =
    kind === 'motor' ? '#e8c4a8' : kind === 'output' ? '#f6e7d4' : kind === 'compound' ? '#f0e2d0' : '#ead8c2';
  const stroke = jammed ? '#b4532a' : kind === 'motor' || kind === 'output' ? '#b4532a' : '#3a342c';
  const hub = Math.min(0.12, radius(teeth) * 0.28);
  return (
    <g pointerEvents="none">
      <path d={gearPath(teeth)} fill={fill} stroke={stroke} strokeWidth={0.038} strokeLinejoin="round" />
      <circle r={hub} fill="#fffdf8" stroke={stroke} strokeWidth={0.022} />
    </g>
  );
}

function MotorMark() {
  return (
    <path
      d="M 0.02 -0.02 L 0.16 0 L 0.02 0.02 Z"
      fill="var(--accent)"
      transform="translate(0.08 0)"
    />
  );
}

function MiniGear({ piece, inverted }: { piece: Piece; inverted: boolean }) {
  const big = largestTeeth(piece.teeth);
  const box = radius(big) * 2.3;
  return (
    <svg viewBox={`${-box / 2} ${-box / 2} ${box} ${box}`} className="h-8 w-8 shrink-0" aria-hidden="true">
      <path
        d={gearPath(piece.teeth[0])}
        fill={inverted ? '#fffdf8' : '#f0d8c8'}
        stroke={inverted ? '#fffdf8' : '#b4532a'}
        strokeWidth={0.045}
      />
      {piece.teeth[1] ? (
        <path
          d={gearPath(piece.teeth[1])}
          fill={inverted ? 'none' : '#fffdf8'}
          stroke={inverted ? '#fffdf8' : '#161412'}
          strokeWidth={0.04}
        />
      ) : null}
    </svg>
  );
}

function DragGhost({ piece, x, y }: { piece?: Piece; x: number; y: number }) {
  if (!piece) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 opacity-90"
      style={{ left: x, top: y }}
    >
      <div className="rounded-2xl border border-[var(--ink)] bg-[var(--bg-elevated)] px-2 py-1 shadow-lg">
        <MiniGear piece={piece} inverted={false} />
      </div>
    </div>
  );
}
