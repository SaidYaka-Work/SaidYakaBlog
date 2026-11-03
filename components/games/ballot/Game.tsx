'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameShell from '../GameShell';
import { getGameBySlug } from '@/lib/games';
import { englishUrl } from '@/lib/site';
import { useGameChrome } from '../useGameChrome';
import type { Attempt, Mode, Puzzle, Result, Round } from './types';
import {
  HOWTO_PUZZLE,
  MAX_HINTS,
  MAX_SCORE,
  MAX_TRIES,
  ballotWord,
  candidateName,
  dailyPuzzle,
  formatRanking,
  gradeEmoji,
  gradeLabel,
  makeResult,
  orderedRemaining,
  parseGuess,
  practicePuzzle,
  puzzleNumberForDate,
  shareLines,
  tryWord,
  unlockedHintCount,
  utcDate,
  voteWord,
} from './logic';

const meta = getGameBySlug('ballot')!;

function startPuzzle(mode: Mode, date: string): Puzzle {
  return mode === 'daily' ? dailyPuzzle(date) : practicePuzzle();
}

export default function BallotGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome('ballot-best');
  const date = utcDate();
  const [mode, setMode] = useState<Mode>('daily');
  const [puzzle, setPuzzle] = useState<Puzzle>(() => dailyPuzzle(date));
  const [draft, setDraft] = useState('');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [phase, setPhase] = useState<'play' | 'done'>('play');
  const [result, setResult] = useState<Result | undefined>();
  const [shake, setShake] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [note, setNote] = useState('Name who instant runoff elects.');
  const inputRef = useRef<HTMLInputElement>(null);

  const remaining = MAX_TRIES - attempts.length;
  const misses = attempts.filter((attempt) => !attempt.hit).length;
  const hintCount = unlockedHintCount(misses);
  const done = phase === 'done';
  const parsed = parseGuess(draft, puzzle.candidates);
  const guessed = useMemo(() => new Set(attempts.map((attempt) => attempt.guess)), [attempts]);

  const load = useCallback(
    (nextMode: Mode, nextPuzzle?: Puzzle) => {
      const loaded = nextPuzzle ?? startPuzzle(nextMode, date);
      setMode(nextMode);
      setPuzzle(loaded);
      setDraft('');
      setAttempts([]);
      setPhase('play');
      setResult(undefined);
      setShake(false);
      setShareNote('');
      setNote('Name who instant runoff elects.');
    },
    [date],
  );

  const restart = useCallback(() => {
    load(mode, mode === 'daily' ? dailyPuzzle(date) : puzzle);
    beep(420, 0.05);
  }, [beep, date, load, mode, puzzle]);

  const finish = useCallback(
    (nextAttempts: Attempt[], solved: boolean) => {
      const scored = makeResult(puzzle, nextAttempts, solved);
      setResult(scored);
      setPhase('done');
      setDraft('');
      commitBest(scored.points);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      beep(solved ? 880 : 180, solved ? 0.16 : 0.14);
    },
    [beep, commitBest, puzzle],
  );

  const guess = useCallback(
    (id: string) => {
      if (phase !== 'play') return;
      if (!puzzle.candidates.some((candidate) => candidate.id === id)) return;
      if (guessed.has(id)) {
        setShake(true);
        window.setTimeout(() => setShake(false), 380);
        setNote(`Already counted ${candidateName(puzzle.candidates, id)}.`);
        beep(200, 0.06);
        return;
      }

      const hit = id === puzzle.irvWinner;
      const nextAttempts = [...attempts, { guess: id, hit }];
      setAttempts(nextAttempts);
      setDraft('');

      if (hit) {
        setNote(`${candidateName(puzzle.candidates, id)} wins the runoff.`);
        finish(nextAttempts, true);
        return;
      }
      if (nextAttempts.length >= MAX_TRIES) {
        setNote(`${candidateName(puzzle.candidates, id)} is not the runoff winner.`);
        finish(nextAttempts, false);
        return;
      }

      setShake(true);
      window.setTimeout(() => setShake(false), 380);
      setNote(`${candidateName(puzzle.candidates, id)} is not the runoff winner.`);
      beep(200, 0.08);
    },
    [attempts, beep, finish, guessed, phase, puzzle.candidates, puzzle.irvWinner],
  );

  const submitDraft = useCallback(() => {
    if (!parsed) {
      setShake(true);
      window.setTimeout(() => setShake(false), 380);
      beep(180, 0.06);
      return;
    }
    guess(parsed.id);
  }, [beep, guess, parsed]);

  const share = useCallback(async () => {
    if (!result) return;
    const url = englishUrl('/games/ballot');
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
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      if (event.code === 'Enter') {
        if (target?.tagName === 'BUTTON') return;
        event.preventDefault();
        if (phase === 'play') submitDraft();
        return;
      }
      if (phase !== 'play') return;
      if (inField) return;
      if (event.key >= '1' && event.key <= '9') {
        const index = Number(event.key) - 1;
        const candidate = puzzle.candidates[index];
        if (!candidate) return;
        event.preventDefault();
        guess(candidate.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guess, phase, puzzle.candidates, submitDraft]);

  const status =
    done && result
      ? `${result.solved ? 'Elected' : 'The runoff held'} · ${result.points}/${MAX_SCORE}`
      : `${mode === 'daily' ? 'Daily' : 'Practice'} · ${remaining} ${tryWord(remaining)}`;

  return (
    <GameShell
      title={meta.title}
      howTo={meta.howTo}
      score={result?.points ?? 0}
      best={best ?? '—'}
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
                Today’s race
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
        {done && result ? (
          <EndScreen result={result} mode={mode} date={date} onShare={() => void share()} shareNote={shareNote} />
        ) : (
          <div className="px-4 py-5 sm:px-7 sm:py-7">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Instant runoff</p>
              {mode === 'daily' ? (
                <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                  Daily #{puzzleNumberForDate(date)}
                </span>
              ) : (
                <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Practice
                </span>
              )}
            </div>

            <ol className="mt-4 flex gap-1.5" aria-label={`Attempt ${attempts.length + 1} of ${MAX_TRIES}`}>
              {Array.from({ length: MAX_TRIES }, (_, index) => {
                const row = attempts[index];
                const current = index === attempts.length;
                return (
                  <li
                    key={index}
                    className={`h-1.5 flex-1 rounded-full ${
                      row ? (row.hit ? 'bg-[var(--accent)]' : 'bg-[var(--ink)]') : current ? 'bg-[var(--ink)]' : 'bg-[var(--line)]'
                    }`}
                  />
                );
              })}
            </ol>

            <h2 className="mt-4 font-serif text-2xl leading-snug tracking-tight text-[var(--ink)] sm:text-3xl">
              {puzzle.title}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{puzzle.setting}</p>
            <p className="mt-2 text-sm text-[var(--ink)]">
              {puzzle.voters} ranked {ballotWord(puzzle.voters)}. Name who wins after last place is dropped and those
              ballots transfer.
            </p>

            <div className={`mt-5 ${shake ? 'seq-shake' : ''}`}>
              <BallotBoard puzzle={puzzle} />
            </div>

            {attempts.length ? (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Guesses">
                {attempts.map((attempt) => (
                  <li
                    key={attempt.guess}
                    className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-sm text-[var(--ink)]"
                  >
                    <span aria-hidden="true">{attempt.hit ? '🟩 ' : '⬛ '}</span>
                    {candidateName(puzzle.candidates, attempt.guess)}
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="mt-4 min-h-6 text-sm leading-relaxed text-[var(--ink)]" aria-live="polite">
              {note}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {puzzle.candidates.map((candidate, index) => {
                const used = guessed.has(candidate.id);
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    disabled={used || phase !== 'play'}
                    onClick={() => guess(candidate.id)}
                    className="pressable flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-left text-[var(--ink)] disabled:opacity-40"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--line)] text-xs tabular-nums text-[var(--muted)]">
                      {index + 1}
                    </span>
                    <span className="font-serif text-xl tracking-tight">{candidate.name}</span>
                  </button>
                );
              })}
            </div>

            <label className="mt-5 block">
              <span className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">Or type a name</span>
              <input
                ref={inputRef}
                type="text"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="done"
                value={draft}
                placeholder="who wins the runoff"
                onChange={(event) => setDraft(event.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 font-serif text-2xl tracking-tight text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
              <span className="mt-1.5 block text-xs text-[var(--faint)]">
                {parsed ? `Submit ${parsed.name}` : `${remaining} ${tryWord(remaining)} left · 1–${puzzle.candidates.length} or type`}
              </span>
            </label>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={submitDraft}
                disabled={!parsed}
                className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)] disabled:opacity-40"
              >
                Lock in
              </button>
              <p className="hidden self-center text-xs text-[var(--faint)] sm:block">
                1–{puzzle.candidates.length} guess · type a name · Enter
              </p>
            </div>

            {hintCount > 0 ? (
              <ol className="mt-5 space-y-2" aria-label="Unlocked hints">
                {puzzle.hints.slice(0, hintCount).map((hint, index) => (
                  <li key={hint} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                      Hint {index + 1} of {MAX_HINTS}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">{hint}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-5 text-sm text-[var(--muted)]">
                Four tries. A miss names first-round last place, then who is out next, then the final two.
              </p>
            )}

            <HowTo />
          </div>
        )}
      </div>
    </GameShell>
  );
}

function BallotBoard({ puzzle }: { puzzle: Puzzle }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Ranked ballots">
      {puzzle.ballots.map((group) => (
        <li
          key={`${group.count}:${group.ranking.join('>')}`}
          className="min-w-[8.5rem] flex-1 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3 sm:min-w-[9.5rem]"
        >
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
            {group.count} {ballotWord(group.count)}
          </p>
          <ol className="mt-2 space-y-1">
            {group.ranking.map((id, index) => (
              <li key={id} className="flex items-baseline gap-2 text-sm text-[var(--ink)]">
                <span className="w-3 text-[10px] tabular-nums text-[var(--faint)]">{index + 1}</span>
                <span className={index === 0 ? 'font-medium' : ''}>{candidateName(puzzle.candidates, id)}</span>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ul>
  );
}

function HowTo() {
  return (
    <details className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
      <summary className="cursor-pointer text-sm text-[var(--ink)]">How instant runoff works</summary>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        Count first choices. If nobody has a majority, eliminate last place and move those ballots to their next
        remaining pick. Repeat. Plurality stops after the first count — the two rules can disagree.
      </p>
      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--faint)]">
        Solved example · {HOWTO_PUZZLE.voters} ballots
      </p>
      <div className="mt-2">
        <BallotBoard puzzle={HOWTO_PUZZLE} />
      </div>
      <div className="mt-3">
        <RunoffRounds puzzle={HOWTO_PUZZLE} compact />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{HOWTO_PUZZLE.blurb}</p>
    </details>
  );
}

function RunoffRounds({ puzzle, compact = false }: { puzzle: Puzzle; compact?: boolean }) {
  return (
    <ol className={compact ? 'space-y-2' : 'space-y-3'} aria-label="Runoff rounds">
      {puzzle.rounds.map((round, index) => (
        <li key={`round-${index}`} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
            Round {index + 1}
            <span className="text-[var(--faint)]">
              {' '}
              · {round.total} continuing · majority {round.majority}
            </span>
          </p>
          <ul className="mt-2 space-y-2">
            {orderedRemaining(round).map((id) => (
              <RoundRow key={id} puzzle={puzzle} round={round} id={id} />
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function RoundRow({ puzzle, round, id }: { puzzle: Puzzle; round: Round; id: string }) {
  const votes = round.counts[id] ?? 0;
  const width = round.total === 0 ? 0 : (votes / round.total) * 100;
  const out = round.eliminated === id;
  const win = round.winner === id;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className={win ? 'font-medium text-[var(--ink)]' : 'text-[var(--ink)]'}>
          {candidateName(puzzle.candidates, id)}
          {out ? <span className="text-[var(--muted)]"> · out</span> : null}
          {win ? <span className="text-[var(--accent)]"> · elected</span> : null}
        </span>
        <span className="tabular-nums text-[var(--muted)]">
          {votes} {voteWord(votes)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
        <div
          className={`h-full rounded-full ${win ? 'bg-[var(--accent)]' : out ? 'bg-[var(--ink)]/30' : 'bg-[var(--ink)]/55'}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </li>
  );
}

function EndScreen({
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
  const { puzzle } = result;
  const winner = candidateName(puzzle.candidates, puzzle.irvWinner);
  const plurality = candidateName(puzzle.candidates, puzzle.pluralityWinner);

  return (
    <div className="px-4 py-5 sm:px-7 sm:py-7">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
        {mode === 'daily' ? `Daily #${puzzleNumberForDate(date)}` : 'Practice round'}
      </p>
      <h2 className="mt-2 font-serif text-3xl tracking-tight">
        {result.points}
        <span className="text-xl text-[var(--muted)]"> / {MAX_SCORE}</span>
      </h2>
      <p className="mt-2 text-sm text-[var(--ink)]">
        <span className="mr-1.5 text-lg" aria-hidden="true">
          {gradeEmoji(result.grade)}
        </span>
        <strong className="font-medium">{gradeLabel(result.grade)}</strong>
        <span className="text-[var(--muted)]">
          {' '}
          · {result.solved ? `in ${result.tries} ${tryWord(result.tries)}` : 'the runoff held'}
        </span>
      </p>
      <p className="mt-3 font-mono text-sm tracking-[0.18em]" aria-label="Result grid">
        {result.attempts.map((attempt) => (attempt.hit ? '🟩' : '⬛')).join('')}
      </p>

      <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--accent)]">{puzzle.office}</p>
        <p className="mt-2 font-serif text-2xl leading-snug tracking-tight text-[var(--ink)]">{winner} wins</p>
        <p className="mt-2 text-sm text-[var(--ink)]">
          Instant runoff elects <span className="font-medium">{winner}</span>
          <span className="text-[var(--muted)]">
            {puzzle.irvWinner === puzzle.pluralityWinner
              ? `. Plurality would have agreed — ${plurality} also led on first choices.`
              : `. Plurality would have elected ${plurality}, who led on first choices.`}
          </span>
        </p>
        {result.attempts.length ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            You guessed {result.attempts.map((attempt) => candidateName(puzzle.candidates, attempt.guess)).join(', ')}.
          </p>
        ) : null}
        <p className="mt-3 leading-relaxed text-[var(--muted)]">{puzzle.blurb}</p>
      </section>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">The count</p>
        <div className="mt-2">
          <RunoffRounds puzzle={puzzle} />
        </div>
      </div>

      <details className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
        <summary className="cursor-pointer text-sm text-[var(--ink)]">Ballots again</summary>
        <div className="mt-3">
          <BallotBoard puzzle={puzzle} />
        </div>
        <ul className="mt-3 space-y-1 text-xs text-[var(--muted)]">
          {puzzle.ballots.map((group) => (
            <li key={`line-${group.count}:${group.ranking.join('>')}`}>
              {group.count} × {formatRanking(puzzle.candidates, group.ranking)}
            </li>
          ))}
        </ul>
      </details>

      <div className="mt-5 space-y-2">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--faint)]">What you learned</p>
        <ol className="space-y-2">
          {puzzle.lesson.map((step, index) => (
            <li key={`${step.title}-${index}`} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
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
        className="pressable mt-5 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]"
      >
        {shareNote || 'Copy summary'}
      </button>
    </div>
  );
}
