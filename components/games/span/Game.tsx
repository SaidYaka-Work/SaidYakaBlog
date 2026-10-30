'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { englishUrl } from '@/lib/site';
import { useGameChrome } from '../useGameChrome';
import type { Bridges, Mode, Puzzle, Result } from './types';
import {
  HOWTO_PUZZLE,
  MAX_SCORE,
  bridgeCount,
  canConnect,
  dailyPuzzle,
  degreeOf,
  emptyBridges,
  formatTime,
  gradeLabel,
  islandState,
  isSolved,
  makeResult,
  moveLabel,
  nearestIsland,
  neighborsOf,
  nextLegalCount,
  practicePuzzle,
  puzzleNumberForDate,
  setBridge,
  shareLines,
  solutionBridges,
  utcDate,
  wouldCross,
} from './logic';

const meta = getGameBySlug('span')!;

function startPuzzle(mode: Mode, date: string): Puzzle {
  return mode === 'daily' ? dailyPuzzle(date) : practicePuzzle();
}

export default function SpanGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('span-best');
  const date = utcDate();
  const [mode, setMode] = useState<Mode>('daily');
  const [puzzle, setPuzzle] = useState<Puzzle>(() => dailyPuzzle(date));
  const [bridges, setBridges] = useState<Bridges>(emptyBridges);
  const [history, setHistory] = useState<Bridges[]>([]);
  const [focus, setFocus] = useState(-1);
  const [partner, setPartner] = useState<number | null>(null);
  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [result, setResult] = useState<Result | undefined>();
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [moves, setMoves] = useState(0);
  const [shareNote, setShareNote] = useState('');
  const [hint, setHint] = useState('');
  const dragRef = useRef<number | null>(null);
  const skipClickRef = useRef(false);
  const bridgesRef = useRef(bridges);
  const phaseRef = useRef(phase);
  const movesRef = useRef(moves);
  const secondsRef = useRef(seconds);
  bridgesRef.current = bridges;
  phaseRef.current = phase;
  movesRef.current = moves;
  secondsRef.current = seconds;

  const done = phase === 'done';
  const metCount = puzzle.islands.filter((island) => islandState(island, bridges, puzzle.pairs) === 'met').length;

  const load = useCallback(
    (nextMode: Mode, nextPuzzle?: Puzzle) => {
      const loaded = nextPuzzle ?? startPuzzle(nextMode, date);
      setMode(nextMode);
      setPuzzle(loaded);
      setBridges(emptyBridges());
      setHistory([]);
      setFocus(-1);
      setPartner(null);
      setPhase('play');
      setResult(undefined);
      setSeconds(0);
      setRunning(false);
      setMoves(0);
      setShareNote('');
      setHint('');
      dragRef.current = null;
      bridgesRef.current = emptyBridges();
      phaseRef.current = 'play';
      movesRef.current = 0;
      secondsRef.current = 0;
    },
    [date],
  );

  const restart = useCallback(() => {
    load(mode, mode === 'daily' ? dailyPuzzle(date) : puzzle);
    beep(420, 0.05);
  }, [beep, date, load, mode, puzzle]);

  const finish = useCallback(
    (nextBridges: Bridges, nextSeconds: number, nextMoves: number) => {
      if (!isSolved(puzzle, nextBridges)) return;
      const scored = makeResult(puzzle, nextSeconds, nextMoves);
      setResult(scored);
      setPhase('done');
      setRunning(false);
      setFocus(-1);
      setPartner(null);
      setHint('');
      commitBest(scored.points);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      beep(880, 0.16);
    },
    [beep, commitBest, puzzle],
  );

  const applyBridges = useCallback(
    (next: Bridges) => {
      if (phaseRef.current !== 'play') return;
      const current = bridgesRef.current;
      if (JSON.stringify(next) === JSON.stringify(current)) return;
      setHistory((historyNow) => [...historyNow.slice(-79), current]);
      bridgesRef.current = next;
      setBridges(next);
      const nextMoves = movesRef.current + 1;
      movesRef.current = nextMoves;
      setMoves(nextMoves);
      setRunning(true);
      setHint('');
      if (isSolved(puzzle, next)) finish(next, secondsRef.current, nextMoves);
    },
    [finish, puzzle],
  );

  const tryCycle = useCallback(
    (a: number, b: number) => {
      if (phaseRef.current !== 'play') return false;
      const current = bridgesRef.current;
      const nextCount = nextLegalCount(puzzle, current, a, b);
      if (nextCount === null) {
        if (canConnect(puzzle.islands, a, b) && wouldCross(puzzle.islands, puzzle.pairs, current, a, b)) {
          setHint('That span crosses another. Clear the crossing first.');
        }
        beep(200, 0.05);
        return false;
      }
      const next = setBridge(current, a, b, nextCount);
      beep(nextCount === 0 ? 300 : nextCount === 1 ? 500 : 620, 0.035);
      applyBridges(next);
      return true;
    },
    [applyBridges, beep, puzzle],
  );

  const undo = useCallback(() => {
    if (phaseRef.current !== 'play') return;
    setHistory((historyNow) => {
      if (historyNow.length === 0) return historyNow;
      const previous = historyNow[historyNow.length - 1];
      bridgesRef.current = previous;
      setBridges(previous);
      setHint('');
      beep(300, 0.03);
      return historyNow.slice(0, -1);
    });
  }, [beep]);

  const share = useCallback(async () => {
    if (!result) return;
    const url = englishUrl('/games/span');
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
        if (focus < 0) {
          setFocus(0);
          beep(360, 0.02);
          return;
        }
        const dRow = event.code === 'ArrowDown' ? 1 : event.code === 'ArrowUp' ? -1 : 0;
        const dCol = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
        const next = nearestIsland(puzzle, focus, dRow, dCol);
        if (next === null) return;
        setPartner(canConnect(puzzle.islands, focus, next) ? focus : null);
        setFocus(next);
        beep(360, 0.02);
        return;
      }

      if (target?.tagName === 'BUTTON' && (event.code === 'Space' || event.code === 'Enter')) return;

      if (event.code === 'Escape') {
        setPartner(null);
        return;
      }
      if ((event.code === 'KeyZ' && (event.metaKey || event.ctrlKey)) || event.code === 'KeyU') {
        event.preventDefault();
        undo();
        return;
      }
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        if (partner !== null && canConnect(puzzle.islands, focus, partner)) {
          tryCycle(focus, partner);
        }
        return;
      }
      if (event.key === '0' || event.key === '1' || event.key === '2') {
        if (partner === null || !canConnect(puzzle.islands, focus, partner)) return;
        event.preventDefault();
        const want = Number(event.key) as 0 | 1 | 2;
        if (want > 0 && wouldCross(puzzle.islands, puzzle.pairs, bridgesRef.current, focus, partner)) {
          setHint('That span crosses another. Clear the crossing first.');
          beep(200, 0.05);
          return;
        }
        beep(want === 0 ? 300 : want === 1 ? 500 : 620, 0.035);
        applyBridges(setBridge(bridgesRef.current, focus, partner, want));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyBridges, beep, focus, partner, phase, puzzle, tryCycle, undo]);

  const status =
    done && result
      ? `Spanned · ${formatTime(result.seconds)} · ${result.points}/${MAX_SCORE}`
      : `${mode === 'daily' ? 'Daily' : 'Practice'} · ${puzzle.size}×${puzzle.size} · ${formatTime(seconds)} · ${moveLabel(moves)}`;

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
                Today’s span
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
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Bridges</p>
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
              {puzzle.size}×{puzzle.size} · {puzzle.islands.length} islands
            </span>
          </div>

          {done && result ? (
            <EndBanner result={result} mode={mode} date={date} onShare={() => void share()} shareNote={shareNote} />
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              Draw one or two bridges so every island’s number is exact and the map is one network.{' '}
              {metCount}/{puzzle.islands.length} satisfied.
            </p>
          )}

          <HowTo />

          <Board
            puzzle={puzzle}
            bridges={bridges}
            focus={focus}
            partner={partner}
            locked={done}
            onFocus={(id) => {
              if (done) return;
              setFocus(id);
            }}
            onPartner={setPartner}
            onCycle={tryCycle}
            dragRef={dragRef}
            skipClickRef={skipClickRef}
          />

          <p className="mt-3 hidden text-[11px] uppercase tracking-[0.14em] text-[var(--faint)] sm:block">
            tap two islands or a span · drag to connect · arrows move · Space cycles · 0–2 sets · U undo
          </p>
          <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-[var(--faint)] sm:hidden">
            tap two islands to cycle none, one, then two · drag also works
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
  return (
    <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
        {mode === 'daily' ? `Daily #${puzzleNumberForDate(date)}` : 'Practice span'}
      </p>
      <h2 className="mt-2 font-serif text-3xl tracking-tight">
        {result.points}
        <span className="text-xl text-[var(--muted)]"> / {MAX_SCORE}</span>
      </h2>
      <p className="mt-2 text-sm text-[var(--ink)]">
        <strong className="font-medium">{gradeLabel(result.grade)}</strong>
        <span className="text-[var(--muted)]">
          {' '}
          · {formatTime(result.seconds)} · {moveLabel(result.moves)}
        </span>
      </p>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        One network, every number exact. Same islands for everyone today
        {mode === 'practice' ? ' — this practice map is just for you' : ''}.
      </p>
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
        Bridges run only horizontally or vertically. They never cross and never pass through an island. A
        number is the exact count of bridges that touch that island — a double counts as two. When every
        island is satisfied and the whole map is linked, the span is complete.
      </p>
      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--faint)]">Solved example</p>
      <div className="mx-auto mt-2 w-[11rem]">
        <Board puzzle={HOWTO_PUZZLE} bridges={solutionBridges(HOWTO_PUZZLE)} focus={-1} partner={null} locked compact />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
        The two ones must each take their only free neighbor. That forces the double across the top.
      </p>
    </details>
  );
}

function Board({
  puzzle,
  bridges,
  focus,
  partner,
  locked = false,
  onFocus,
  onPartner,
  onCycle,
  dragRef,
  skipClickRef,
  compact = false,
}: {
  puzzle: Puzzle;
  bridges: Bridges;
  focus: number;
  partner: number | null;
  locked?: boolean;
  onFocus?: (id: number) => void;
  onPartner?: (id: number | null) => void;
  onCycle?: (a: number, b: number) => void;
  dragRef?: MutableRefObject<number | null>;
  skipClickRef?: MutableRefObject<boolean>;
  compact?: boolean;
}) {
  const possible = useMemo(() => (focus >= 0 ? new Set(neighborsOf(puzzle, focus)) : new Set<number>()), [focus, puzzle]);
  const pad = 0.42;
  const view = `${-pad} ${-pad} ${puzzle.size + pad * 2} ${puzzle.size + pad * 2}`;

  const islandFromPoint = (event: PointerEvent<SVGSVGElement>): number | null => {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const hit = el?.closest('[data-island]') as SVGElement | null;
    if (!hit) return null;
    return Number(hit.dataset.island);
  };

  return (
    <svg
      className={`mx-auto block w-full touch-none select-none ${compact ? 'mt-1' : 'mt-5 max-w-[28rem]'}`}
      viewBox={view}
      role="img"
      aria-label={`${puzzle.size} by ${puzzle.size} span of ${puzzle.islands.length} islands`}
      onPointerDown={(event) => {
        if (locked) return;
        const id = islandFromPoint(event);
        if (id === null) return;
        event.preventDefault();
        (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
        if (dragRef) dragRef.current = id;
      }}
      onPointerUp={(event) => {
        if (locked) return;
        const from = dragRef?.current ?? null;
        const to = islandFromPoint(event);
        if (dragRef) dragRef.current = null;
        if (from === null) return;
        if (to !== null && to !== from && canConnect(puzzle.islands, from, to)) {
          if (skipClickRef) skipClickRef.current = true;
          onPartner?.(from);
          onFocus?.(to);
          onCycle?.(from, to);
          return;
        }
        const tapped = to ?? from;
        if (focus >= 0 && focus !== tapped && canConnect(puzzle.islands, focus, tapped)) {
          if (skipClickRef) skipClickRef.current = true;
          onPartner?.(focus);
          onFocus?.(tapped);
          onCycle?.(focus, tapped);
          return;
        }
        onFocus?.(tapped);
      }}
      onPointerCancel={() => {
        if (dragRef) dragRef.current = null;
      }}
    >
      {focus >= 0 && puzzle.islands[focus] ? (
        <>
          <rect
            x={-pad}
            y={puzzle.islands[focus].row}
            width={puzzle.size + pad * 2}
            height={1}
            fill="var(--accent)"
            opacity={0.06}
          />
          <rect
            x={puzzle.islands[focus].col}
            y={-pad}
            width={1}
            height={puzzle.size + pad * 2}
            fill="var(--accent)"
            opacity={0.06}
          />
        </>
      ) : null}

      {puzzle.pairs.map(([a, b]) => {
        const count = bridgeCount(bridges, a, b);
        return (
          <BridgeMark
            key={`${a}-${b}`}
            puzzle={puzzle}
            a={a}
            b={b}
            count={count}
            locked={locked}
            onCycle={() => {
              onPartner?.(a);
              onFocus?.(b);
              onCycle?.(a, b);
            }}
          />
        );
      })}

      {puzzle.islands.map((island) => {
        const have = degreeOf(island.id, bridges, puzzle.pairs);
        const state = islandState(island, bridges, puzzle.pairs);
        const selected = island.id === focus;
        const linked = island.id === partner;
        const neighbor = possible.has(island.id);
        const fill =
          state === 'met' ? 'var(--accent-soft)' : state === 'over' ? 'var(--accent-soft)' : 'var(--bg)';
        const stroke = selected
          ? 'var(--ink)'
          : state === 'met'
            ? 'var(--accent)'
            : linked || neighbor
              ? 'var(--accent)'
              : 'var(--ink)';
        const text = state === 'met' ? 'var(--accent)' : state === 'over' ? 'var(--accent)' : 'var(--ink)';
        return (
          <g
            key={island.id}
            data-island={island.id}
            data-row={island.row}
            data-col={island.col}
            transform={`translate(${island.col + 0.5} ${island.row + 0.5})`}
            role="button"
            tabIndex={-1}
            aria-label={`Island at row ${island.row + 1}, column ${island.col + 1}, needs ${island.need}, has ${have}${state === 'met' ? ', satisfied' : ''}`}
            onClick={() => {
              if (locked) return;
              if (skipClickRef?.current) {
                skipClickRef.current = false;
                onFocus?.(island.id);
                return;
              }
              if (focus >= 0 && focus !== island.id && canConnect(puzzle.islands, focus, island.id)) {
                onPartner?.(focus);
                onCycle?.(focus, island.id);
              }
              onFocus?.(island.id);
            }}
          >
            <circle r={0.4} fill="transparent" className="cursor-pointer" />
            <circle
              r={0.3}
              fill={fill}
              stroke={stroke}
              strokeWidth={selected ? 0.055 : 0.04}
              className="cursor-pointer"
            />
            {linked ? <circle r={0.36} fill="none" stroke="var(--accent)" strokeWidth={0.02} opacity={0.7} /> : null}
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="0.28"
              fill={text}
              className="pointer-events-none select-none"
              style={{ fontFamily: 'ui-serif, Georgia, serif' }}
            >
              {island.need}
            </text>
            <title>{`Island needing ${island.need}, now ${have}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

function BridgeMark({
  puzzle,
  a,
  b,
  count,
  locked,
  onCycle,
}: {
  puzzle: Puzzle;
  a: number;
  b: number;
  count: number;
  locked: boolean;
  onCycle: () => void;
}) {
  const left = puzzle.islands[a];
  const right = puzzle.islands[b];
  const x1 = left.col + 0.5;
  const y1 = left.row + 0.5;
  const x2 = right.col + 0.5;
  const y2 = right.row + 0.5;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * 0.055;
  const oy = (dx / len) * 0.055;
  const inset = 0.32;
  const ax = x1 + (dx / len) * inset;
  const ay = y1 + (dy / len) * inset;
  const bx = x2 - (dx / len) * inset;
  const by = y2 - (dy / len) * inset;
  const color = count === 0 ? 'transparent' : 'var(--ink)';

  return (
    <g
      data-pair={`${a}-${b}`}
      onClick={(event) => {
        event.stopPropagation();
        if (!locked) onCycle();
      }}
      className={locked ? '' : 'cursor-pointer'}
    >
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke="transparent" strokeWidth={0.22} />
      {count === 1 ? <line x1={ax} y1={ay} x2={bx} y2={by} stroke={color} strokeWidth={0.045} strokeLinecap="round" /> : null}
      {count === 2 ? (
        <>
          <line
            x1={ax + ox}
            y1={ay + oy}
            x2={bx + ox}
            y2={by + oy}
            stroke={color}
            strokeWidth={0.04}
            strokeLinecap="round"
          />
          <line
            x1={ax - ox}
            y1={ay - oy}
            x2={bx - ox}
            y2={by - oy}
            stroke={color}
            strokeWidth={0.04}
            strokeLinecap="round"
          />
        </>
      ) : null}
    </g>
  );
}
