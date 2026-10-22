'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '../GameShell';
import { useGameChrome } from '../useGameChrome';
import { getGameBySlug } from '@/lib/games';
import DrawPad, { type DrawPadHandle } from './DrawPad';
import SoundPad, { replayHits, type MicMode, type SoundPadHandle } from './SoundPad';
import { fetchDailySet, readOffline, requestGrade, requestJudge, writeOffline } from './api';
import { checkJob, isBonusKind, isChoiceKind, jobKindLabel } from './jobs';
import {
  MAX_STRIKES,
  applyStrike,
  buildShareGrid,
  customerPanelId,
  customerTabId,
  customersForLevel,
  firstName,
  isLevelComplete,
  isRunComplete,
  joinNotice,
  levelSurviveMs,
  newlyJoined,
  nextCombo,
  nextTabIndex,
  patienceMs,
  planRun,
  rankFor,
  shareGlyph,
  startCustomerCount,
  tabCycleDelta,
  tabShortcutIndex,
  tabTone,
  tickRequest,
  type PlannedCustomer,
} from './lanes';
import { STORAGE_KEY, formatTimer, nextNudge, scoreJob, scoreRound, scoreWithJudge } from './logic';
import { capAudio, downscaleImage } from './media';
import type { Artifact, ChatMessage, Prompt, SynthHit } from './types';
import { dateSeed, formatUtcDate, utcDate, type DailySet } from '../../../workers/fakegpt/src/schema';

const meta = getGameBySlug('fakegpt')!;

type Phase = 'intro' | 'playing' | 'levelup' | 'results';

type Lane = {
  id: string;
  name: string;
  vibe: string;
  hue: number;
  patience: number;
  unread: number;
  left: boolean;
  messages: ChatMessage[];
  queue: Prompt[];
  current: Prompt | null;
  startedAt: number;
  totalMs: number;
  joining: boolean;
  flash: 'good' | 'bad' | null;
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function TypingDots() {
  return (
    <div className="fgpt-user flex w-fit items-center gap-1 px-3 py-2.5" aria-label="User is typing">
      <span className="un-dot h-1.5 w-1.5 rounded-full bg-current" />
      <span className="un-dot h-1.5 w-1.5 rounded-full bg-current" />
      <span className="un-dot h-1.5 w-1.5 rounded-full bg-current" />
    </div>
  );
}

function AudioBubble({ src, hits }: { src?: string; hits?: SynthHit[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {src ? <audio className="fgpt-audio" controls src={src} preload="metadata" /> : null}
      {hits?.length ? (
        <button
          type="button"
          onClick={() => replayHits(hits)}
          className="pressable rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs text-[var(--bg)]"
        >
          Play sequence
        </button>
      ) : null}
      {!src && !hits?.length ? <p className="text-sm text-[var(--muted)]">No clip captured.</p> : null}
    </div>
  );
}

function MessageView({ message }: { message: ChatMessage }) {
  if (message.role === 'user' && message.kind === 'text') {
    return (
      <div className="ml-auto max-w-[92%]">
        {message.persona ? <p className="mb-1 text-right text-[11px] text-[var(--faint)]">{message.persona}</p> : null}
        <p className="fgpt-user">{message.text}</p>
      </div>
    );
  }
  if (message.role === 'user' && message.kind === 'nudge') {
    return <p className="fgpt-user fgpt-nudge">{message.text}</p>;
  }
  if (message.role === 'user' && message.kind === 'join') {
    return <p className="fgpt-join">{message.text}</p>;
  }
  if (message.role === 'user' && message.kind === 'rating') {
    return (
      <p className="fgpt-user">
        <span aria-hidden="true">{message.thumbs === 'up' ? '👍 ' : '👎 '}</span>
        {message.text}
      </p>
    );
  }
  if (message.kind === 'answer') {
    return <p className="fgpt-assistant">{message.text}</p>;
  }
  if (message.kind === 'drawing') {
    return (
      <div className="fgpt-assistant">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={message.src} alt="Assistant drawing" className="fgpt-drawing" />
      </div>
    );
  }
  if (message.kind === 'audio') {
    return (
      <div className="fgpt-assistant">
        <AudioBubble src={message.src} hits={message.hits} />
      </div>
    );
  }
  return <p className="fgpt-assistant fgpt-miss">{message.text}</p>;
}

function laneFromPlan(customer: PlannedCustomer<Prompt>, joining: boolean): Lane {
  return {
    id: customer.id,
    name: customer.name,
    vibe: customer.vibe,
    hue: customer.hue,
    patience: 1,
    unread: 0,
    left: false,
    messages: joining ? [{ id: uid('join'), role: 'user', kind: 'join', text: joinNotice(customer.name) }] : [],
    queue: customer.queue.slice(),
    current: null,
    startedAt: 0,
    totalMs: 0,
    joining,
    flash: null,
  };
}

function activateLane(lane: Lane, now: number, level: number, focusedId: string): Lane {
  if (lane.left || lane.current) return lane;
  const next = lane.queue[0];
  if (!next) return lane;
  const total = patienceMs(level, next.difficulty);
  return {
    ...lane,
    current: next,
    queue: lane.queue.slice(1),
    startedAt: now,
    totalMs: total,
    patience: 1,
    unread: lane.id === focusedId ? 0 : lane.unread + 1,
    messages: [
      ...lane.messages,
      { id: uid('user'), role: 'user', kind: 'text', text: next.text, persona: lane.name },
    ],
  };
}

export default function FakeGptGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome(STORAGE_KEY);
  const [phase, setPhase] = useState<Phase>('intro');
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [focusedId, setFocusedId] = useState('');
  const [level, setLevel] = useState(1);
  const [served, setServed] = useState(0);
  const [servedTotal, setServedTotal] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [score, setScore] = useState(0);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [pop, setPop] = useState<string | null>(null);
  const [joinName, setJoinName] = useState<string | null>(null);
  const [levelStartedAt, setLevelStartedAt] = useState(0);
  const [levelLeftMs, setLevelLeftMs] = useState(0);
  const [plan, setPlan] = useState<PlannedCustomer<Prompt>[]>([]);
  const [seed, setSeed] = useState(1);
  const [typed, setTyped] = useState('');
  const typedRef = useRef('');
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [daily, setDaily] = useState<DailySet | null>(null);
  const [micMode, setMicMode] = useState<MicMode>('unknown');
  const [shake, setShake] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [shared, setShared] = useState(false);

  const drawRef = useRef<DrawPadHandle>(null);
  const soundRef = useRef<SoundPadHandle>(null);
  const logRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const finishingIds = useRef(new Set<string>());
  const nudgeShown = useRef<Record<string, number>>({});
  const timersRef = useRef<number[]>([]);
  const phaseRef = useRef(phase);
  const lanesRef = useRef(lanes);
  const levelRef = useRef(level);
  const servedRef = useRef(served);
  const focusedRef = useRef(focusedId);
  const seedRef = useRef(seed);
  const planRef = useRef(plan);
  const strikesRef = useRef(strikes);
  const comboRef = useRef(combo);
  const scoreRef = useRef(score);
  const artifactsRef = useRef(artifacts);
  const levelStartedRef = useRef(levelStartedAt);
  const endingRef = useRef(false);

  phaseRef.current = phase;
  lanesRef.current = lanes;
  levelRef.current = level;
  servedRef.current = served;
  focusedRef.current = focusedId;
  seedRef.current = seed;
  planRef.current = plan;
  strikesRef.current = strikes;
  comboRef.current = combo;
  scoreRef.current = score;
  artifactsRef.current = artifacts;
  levelStartedRef.current = levelStartedAt;

  const focused = lanes.find((lane) => lane.id === focusedId && !lane.left) ?? lanes.find((lane) => !lane.left) ?? lanes[0];
  const prompt = focused?.current ?? null;
  const rank = rankFor(score);
  const liveCustomers = customersForLevel(level, seed);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    setOffline(readOffline());
    void fetchDailySet(readOffline()).then(setDaily);
  }, []);

  useEffect(() => {
    const node = focused ? logRefs.current[focused.id] : null;
    node?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [focused, focused?.messages, phase]);

  const showToast = useCallback(
    (text: string) => {
      setToast(text);
      later(() => setToast(null), 2400);
    },
    [later],
  );

  const endRun = useCallback(
    (finalScore: number) => {
      if (endingRef.current) return;
      endingRef.current = true;
      finishingIds.current.clear();
      commitBest(finalScore);
      setPhase('results');
      setBusy(false);
    },
    [commitBest],
  );

  const openLevel = useCallback(
    (nextLevel: number, nextPlan: PlannedCustomer<Prompt>[], nextSeed: number, joiningIds: string[] = []) => {
      endingRef.current = false;
      finishingIds.current.clear();
      nudgeShown.current = {};
      const now = Date.now();
      const active = nextPlan.slice(0, customersForLevel(nextLevel, nextSeed));
      const nextLanes = active.map((customer) => laneFromPlan(customer, joiningIds.includes(customer.id)));
      setPlan(nextPlan);
      setSeed(nextSeed);
      setLevel(nextLevel);
      setServed(0);
      setLevelStartedAt(now);
      setLevelLeftMs(0);
      setLanes(nextLanes);
      setFocusedId(nextLanes[0]?.id ?? '');
      typedRef.current = '';
      setTyped('');
      setBusy(false);
      setPhase('playing');
      nextLanes.forEach((lane, index) => {
        later(() => {
          setLanes((current) =>
            current.map((row) =>
              row.id === lane.id ? activateLane({ ...row, joining: false }, Date.now(), nextLevel, focusedRef.current) : row,
            ),
          );
          beep(520 + index * 40, 0.05);
        }, 280 + index * 420);
      });
    },
    [beep, later],
  );

  const startRun = useCallback(async () => {
    clearTimers();
    for (const item of artifactsRef.current) {
      if (item.audioUrl) URL.revokeObjectURL(item.audioUrl);
    }
    const pack = daily ?? (await fetchDailySet(offline));
    setDaily(pack);
    const nextSeed = dateSeed(pack.date);
    const nextPlan = planRun(pack.personas, pack.rounds, nextSeed);
    setArtifacts([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setStrikes(0);
    setServedTotal(0);
    setShared(false);
    setJoinName(null);
    setPop(null);
    openLevel(1, nextPlan, nextSeed);
  }, [clearTimers, daily, offline, openLevel]);

  const finishLane = useCallback(
    async (laneId: string, submittedInTime: boolean, choice?: string) => {
      if (phaseRef.current !== 'playing' || finishingIds.current.has(laneId)) return;
      const lane = lanesRef.current.find((row) => row.id === laneId);
      const current = lane?.current;
      if (!lane || !current) return;
      finishingIds.current.add(laneId);
      setBusy(true);
      const clock = tickRequest(lane.startedAt, lane.totalMs, Date.now());
      const playerAnswer =
        (choice ?? (isChoiceKind(current.kind, current.options) || isBonusKind(current.kind) ? '' : typedRef.current)).trim();
      const draw = current.kind === 'draw' ? drawRef.current?.snapshot() : null;
      const sound =
        current.kind === 'sound'
          ? await Promise.race([
              soundRef.current?.finalize() ?? Promise.resolve(null),
              new Promise<null>((resolve) => {
                window.setTimeout(() => resolve(null), 1500);
              }),
            ])
          : null;
      const attempt = {
        kind: current.kind,
        submittedInTime,
        remainingMs: submittedInTime ? clock.remainingMs : 0,
        totalMs: lane.totalMs,
        strokeCount: draw?.strokeCount ?? 0,
        uniqueColors: draw?.uniqueColors ?? 0,
        coverage: draw?.coverage ?? 0,
        audioMs: sound?.audioMs ?? 0,
        peakLevel: sound?.peakLevel ?? 0,
        padHits: sound?.padHits ?? 0,
        correct: false,
        empty: false,
      };
      let result = scoreRound(attempt);
      let seen = '';
      let heard = '';
      let judged = false;
      if (!isBonusKind(current.kind)) {
        const verdict = checkJob(current.kind, playerAnswer, current.answer, current.aliases, current.options);
        let correct = verdict === 'correct';
        if (verdict === 'ambiguous' && !offline && (current.kind === 'typed' || current.kind === 'fill')) {
          const graded = await requestGrade(
            {
              date: daily?.date ?? utcDate(),
              roundId: current.id,
              persona: lane.name,
              question: current.text,
              answer: current.answer,
              aliases: current.aliases,
              playerText: playerAnswer,
            },
            offline,
          );
          correct = Boolean(graded && !graded.fallback && graded.correct);
        }
        const nextComboValue = nextCombo(comboRef.current, correct, submittedInTime && !clock.expired);
        result = scoreJob(
          {
            submittedInTime,
            remainingMs: attempt.remainingMs,
            totalMs: lane.totalMs,
            correct,
            empty: verdict === 'empty' || !submittedInTime && !playerAnswer,
          },
          nextComboValue,
        );
        if (!correct && !result.empty) result = { ...result, reaction: current.bad || result.reaction };
        else if (correct) result = { ...result, reaction: current.good || result.reaction };
        setCombo(nextComboValue);
        setMaxCombo((currentMax) => Math.max(currentMax, nextComboValue));
        if (nextComboValue >= 3) {
          setConfetti(true);
          later(() => setConfetti(false), 900);
          setPop(`x${nextComboValue} combo`);
          later(() => setPop(null), 900);
        }
        if (!correct) {
          const hit = applyStrike(strikesRef.current);
          setStrikes(hit.strikes);
          setShake(true);
          later(() => setShake(false), 420);
          if (hit.over) {
            const artifact: Artifact = {
              prompt: current,
              customer: lane.name,
              points: result.points,
              thumbs: result.thumbs,
              reaction: result.reaction,
              stars: result.stars,
              empty: result.empty,
              late: result.late,
              playerAnswer: playerAnswer || '',
              correctAnswer: current.answer,
            };
            const nextScore = scoreRef.current + result.points;
            setScore(nextScore);
            setArtifacts((currentArtifacts) => [...currentArtifacts, artifact]);
            endRun(nextScore);
            return;
          }
        }
      } else if (!offline && !result.empty) {
        const image = current.kind === 'draw' && draw?.dataUrl ? await downscaleImage(draw.dataUrl) : undefined;
        const audio = current.kind === 'sound' && sound?.usedMic && sound.blob ? await capAudio(sound.blob) : undefined;
        const judgedRemote = await requestJudge(
          {
            date: daily?.date ?? utcDate(),
            roundId: current.id,
            kind: current.kind === 'sound' ? 'sound' : 'draw',
            request: current.text,
            persona: lane.name,
            submittedInTime,
            remainingMs: attempt.remainingMs,
            totalMs: lane.totalMs,
            image,
            audio: audio || undefined,
            pads: sound?.hits.map((hit) => ({ padId: hit.padId, holdMs: hit.holdMs })),
            features: sound
              ? {
                  durationMs: sound.audioMs,
                  rms: sound.rms,
                  peakLevel: sound.peakLevel,
                  pitchLo: sound.pitchLo,
                  pitchHi: sound.pitchHi,
                  silenceRatio: sound.silenceRatio,
                  padHits: sound.padHits,
                }
              : undefined,
          },
          offline,
        );
        if (judgedRemote && !judgedRemote.fallback) {
          result = scoreWithJudge(attempt, judgedRemote.score);
          seen = judgedRemote.seen;
          heard = judgedRemote.heard;
          judged = true;
          if (judgedRemote.messages[0]) result = { ...result, reaction: judgedRemote.messages.join(' ') };
        }
      }

      const artifact: Artifact = {
        prompt: current,
        customer: lane.name,
        points: result.points,
        thumbs: result.thumbs,
        reaction: result.reaction,
        stars: result.stars,
        empty: result.empty,
        late: result.late,
        playerAnswer: playerAnswer || (result.empty ? '' : undefined),
        correctAnswer: current.answer,
        drawingUrl: draw?.dataUrl || undefined,
        audioUrl: sound?.usedMic && sound.blobUrl ? sound.blobUrl : undefined,
        replayHits: sound?.hits,
        seen,
        heard,
        judged,
      };
      const assistant: ChatMessage = result.empty
        ? { id: uid('miss'), role: 'assistant', kind: 'miss', text: '…' }
        : !isBonusKind(current.kind)
          ? { id: uid('ans'), role: 'assistant', kind: 'answer', text: playerAnswer || '…' }
          : current.kind === 'draw' && artifact.drawingUrl
            ? { id: uid('draw'), role: 'assistant', kind: 'drawing', src: artifact.drawingUrl }
            : { id: uid('audio'), role: 'assistant', kind: 'audio', src: artifact.audioUrl ?? '', hits: artifact.replayHits };

      const nextScore = scoreRef.current + result.points;
      setScore(nextScore);
      setArtifacts((currentArtifacts) => [...currentArtifacts, artifact]);
      setServed((value) => value + 1);
      setServedTotal((value) => value + 1);
      typedRef.current = '';
      setTyped('');
      setPop(result.thumbs === 'up' ? `+${result.points}` : result.empty ? 'miss' : 'wrong');
      later(() => setPop(null), 800);
      beep(result.thumbs === 'up' ? 740 : 180, 0.1);

      setLanes((currentLanes) =>
        currentLanes.map((row) =>
          row.id === laneId
            ? {
                ...row,
                current: null,
                patience: 1,
                startedAt: 0,
                totalMs: 0,
                flash: result.thumbs === 'up' ? 'good' : 'bad',
                unread: 0,
                messages: [
                  ...row.messages,
                  assistant,
                  { id: uid('rate'), role: 'user', kind: 'rating', thumbs: result.thumbs, text: result.reaction },
                ],
              }
            : row,
        ),
      );
      finishingIds.current.delete(laneId);
      setBusy(false);
      later(() => {
        setLanes((currentLanes) =>
          currentLanes.map((row) => {
            if (row.id !== laneId) return row;
            const cleared = { ...row, flash: null };
            return activateLane(cleared, Date.now(), levelRef.current, focusedRef.current);
          }),
        );
      }, 520);
    },
    [beep, daily?.date, endRun, later, offline],
  );

  const failExpired = useCallback(
    (laneId: string) => {
      void finishLane(laneId, false);
    },
    [finishLane],
  );

  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - levelStartedRef.current;
      setLevelLeftMs(elapsed);
      setLanes((current) => {
        let changed = false;
        const next = current.map((lane) => {
          if (lane.left || !lane.current || finishingIds.current.has(lane.id) || lane.startedAt <= 0 || lane.totalMs <= 0) return lane;
          const clock = tickRequest(lane.startedAt, lane.totalMs, now);
          const elapsedRatio = lane.totalMs > 0 ? 1 - clock.remainingMs / lane.totalMs : 1;
          const shown = nudgeShown.current[lane.id] ?? 0;
          const nudge = nextNudge(elapsedRatio, shown, lane.current.nudges);
          let messages = lane.messages;
          if (nudge) {
            nudgeShown.current[lane.id] = shown + 1;
            messages = [...messages, { id: uid('nudge'), role: 'user', kind: 'nudge', text: nudge }];
            if (!muted) beep(240, 0.04);
          }
          if (clock.expired) {
            later(() => failExpired(lane.id), 0);
          }
          if (clock.patience !== lane.patience || messages !== lane.messages) {
            changed = true;
            const unread = nudge && lane.id !== focusedRef.current ? lane.unread + 1 : lane.unread;
            return { ...lane, patience: clock.patience, messages, unread };
          }
          return lane;
        });
        return changed ? next : current;
      });
      const active = lanesRef.current;
      const starved = active.length > 0 && active.every((lane) => !lane.current && lane.queue.length === 0);
      if (elapsed < 900) return;
      if (isLevelComplete(servedRef.current, elapsed, levelRef.current) || starved) {
        if (isRunComplete(levelRef.current)) {
          endRun(scoreRef.current);
        } else {
          setPhase('levelup');
        }
      }
    }, 120);
    return () => window.clearInterval(tick);
  }, [beep, endRun, failExpired, later, muted, phase]);

  const continueLevel = useCallback(() => {
    const nextLevel = level + 1;
    const joiners = newlyJoined(plan, nextLevel, seed);
    endingRef.current = false;
    setLevel(nextLevel);
    setServed(0);
    setLevelStartedAt(Date.now());
    setLevelLeftMs(0);
    setPhase('playing');
    setJoinName(joiners[0]?.name ?? null);
    if (joiners[0]) showToast(joinNotice(joiners[0].name));
    beep(880, 0.08);
    setLanes((current) => {
      const existingIds = new Set(current.map((lane) => lane.id));
      const added = joiners.filter((row) => !existingIds.has(row.id)).map((row) => laneFromPlan(row, true));
      return [
        ...current.map((lane) => ({ ...lane, joining: false, flash: null })),
        ...added,
      ];
    });
    later(() => {
      setLanes((current) =>
        current.map((lane) => activateLane({ ...lane, joining: false }, Date.now(), nextLevel, focusedRef.current)),
      );
    }, 360);
  }, [beep, later, level, plan, seed, showToast]);

  const focusLane = useCallback((id: string, moveDomFocus = false) => {
    setFocusedId(id);
    setLanes((current) => current.map((lane) => (lane.id === id ? { ...lane, unread: 0 } : lane)));
    typedRef.current = '';
    setTyped('');
    if (moveDomFocus) {
      requestAnimationFrame(() => tabRefs.current[id]?.focus());
    }
  }, []);

  useEffect(() => {
    if (!lanes.length) return;
    const current = lanes.find((lane) => lane.id === focusedId);
    if (current && !current.left) return;
    const next = lanes.find((lane) => !lane.left);
    if (next) focusLane(next.id);
  }, [focusLane, focusedId, lanes]);

  useEffect(() => {
    if (!lanes.some((lane) => lane.left)) return;
    const id = window.setTimeout(() => {
      setLanes((current) => {
        const remaining = current.filter((lane) => !lane.left);
        return remaining.length === current.length ? current : remaining;
      });
    }, 420);
    return () => window.clearTimeout(id);
  }, [lanes]);

  useEffect(() => {
    tabRefs.current[focusedId]?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [focusedId, lanes.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (phase !== 'playing' || !lanes.length) return;
      const open = lanes.filter((lane) => !lane.left);
      if (!open.length) return;
      const shortcut = tabShortcutIndex(event, open.length);
      if (shortcut != null) {
        event.preventDefault();
        focusLane(open[shortcut].id, true);
        return;
      }
      const typing = isEditableTarget(event.target);
      if ((event.key === 'Home' || event.key === 'End') && !typing) {
        event.preventDefault();
        focusLane((event.key === 'Home' ? open[0] : open[open.length - 1]).id, true);
        return;
      }
      const delta = tabCycleDelta(event);
      if (delta != null) {
        const modifiedTab = event.key === 'Tab' && (event.ctrlKey || event.metaKey);
        if (event.key === 'Tab' && !modifiedTab) return;
        if (typing && !event.altKey && !event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        const index = Math.max(0, open.findIndex((lane) => lane.id === focusedId));
        focusLane(open[nextTabIndex(index, open.length, delta)].id, true);
        return;
      }
      if (!prompt || busy) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isChoiceKind(prompt.kind, prompt.options) && ['1', '2', '3', '4'].includes(event.key)) {
        const option = prompt.options[Number(event.key) - 1];
        if (option) void finishLane(focusedId, true, option);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, finishLane, focusLane, focusedId, lanes, phase, prompt]);

  const copyShare = useCallback(async () => {
    const glyphs = artifacts.map((item) =>
      shareGlyph({
        correct: item.thumbs === 'up',
        empty: item.empty,
        late: item.late,
        bonus: isBonusKind(item.prompt.kind),
      }),
    );
    const text = `FakeGPT ${daily?.date ?? utcDate()}\n${rank.title} · ${score} pts · Lv ${level}\n${buildShareGrid(glyphs)}`;
    try {
      await navigator.clipboard.writeText(text);
      setShared(true);
    } catch {
      setShared(false);
    }
  }, [artifacts, daily?.date, level, rank.title, score]);

  const status =
    phase === 'intro'
      ? 'Waiting for the first customer'
      : phase === 'results'
        ? strikes >= MAX_STRIKES
          ? 'The users rage-quit'
          : 'Shift complete'
        : phase === 'levelup'
          ? `Level ${level} cleared`
          : `Level ${level} · ${served} served · ${liveCustomers} customer${liveCustomers === 1 ? '' : 's'}`;

  const urgent = Boolean(focused && focused.patience > 0 && focused.patience <= 0.28);
  const surviveLeft = Math.max(0, levelSurviveMs(level) - levelLeftMs);

  return (
    <GameShell
      title={meta.title}
      howTo={meta.howTo}
      score={score}
      best={best ?? '—'}
      status={status}
      muted={muted}
      onMute={toggleMute}
      onRestart={phase === 'intro' ? undefined : () => void startRun()}
      restartLabel={phase === 'results' ? 'Play again' : 'Restart'}
      extraActions={
        <button
          type="button"
          onClick={() => {
            const next = !offline;
            setOffline(next);
            writeOffline(next);
            void fetchDailySet(next).then(setDaily);
          }}
          className="pressable rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--ink)]"
        >
          {offline ? 'Offline' : 'Online'}
        </button>
      }
      tight
      wide
      hud="line"
    >
      <div
        className={`fgpt-board ${phase === 'playing' ? 'is-playing' : ''} ${shake ? 'is-shake' : ''} ${phase === 'results' ? 'is-results' : ''}`}
      >
        <header className="fgpt-hud">
          <span className="fgpt-mark" aria-hidden="true">
            f
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--ink)]">FakeGPT</p>
            <p className="truncate text-xs text-[var(--faint)]">
              {phase === 'playing'
                ? `Shift ${formatUtcDate(daily?.date ?? utcDate())}${daily?.source === 'ai' ? '' : ' · local set'}`
                : `Today's customers · ${formatUtcDate(daily?.date ?? utcDate())}${daily?.source === 'ai' ? '' : ' · local set'}`}
            </p>
          </div>
          <div className="fgpt-hud-stats">
            <p className={`fgpt-combo ${combo >= 2 ? 'is-hot' : ''}`} aria-label="Combo">
              {combo >= 2 ? `x${combo}` : 'combo'}
            </p>
            <p className="fgpt-strikes" aria-label={`${strikes} of ${MAX_STRIKES} strikes`}>
              {Array.from({ length: MAX_STRIKES }, (_, index) => (
                <span key={index} className={index < strikes ? 'is-on' : ''}>
                  ●
                </span>
              ))}
            </p>
            {phase === 'playing' ? (
              <p className={`fgpt-timer ${urgent || surviveLeft <= 8000 ? 'is-urgent' : ''}`} aria-live="polite">
                {formatTimer(surviveLeft)}
              </p>
            ) : null}
          </div>
        </header>

        {phase === 'playing' || phase === 'levelup' ? (
          <div className="fgpt-levelbar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (levelLeftMs / levelSurviveMs(level)) * 100)}%` }} />
          </div>
        ) : null}

        {toast ? <p className="fgpt-toast">{toast}</p> : null}
        {pop ? <p className={`fgpt-pop ${pop.startsWith('+') || pop.startsWith('x') ? 'is-good' : 'is-bad'}`}>{pop}</p> : null}
        {confetti ? (
          <div className="fgpt-confetti" aria-hidden="true">
            <span>✦</span>
            <span>✧</span>
            <span>★</span>
          </div>
        ) : null}

        {phase === 'intro' ? (
          <div className="fgpt-intro">
            <p className="fgpt-daily">Daily shift · {formatUtcDate(daily?.date ?? utcDate())}</p>
            <p className="fgpt-assistant">
              You are not a model. You are a person doing every job by hand while the users think you are AI.
              Start with {startCustomerCount(dateSeed(daily?.date ?? utcDate())) === 2 ? 'two customers' : 'one customer'}. More join as levels get harder.
              Each has a queue and a patience meter. Three hallucinations and they walk.
            </p>
            <p className="fgpt-user">
              Translate, trivia, math, spelling, tone — locally checked. Tabs juggle chats. Arrow keys, [ ], or Ctrl/Alt+1–5 switch. 1–4 tap answers.
            </p>
            <button
              type="button"
              onClick={() => void startRun()}
              className="pressable mt-4 w-full rounded-full bg-[var(--ink)] px-5 py-3 text-sm text-[var(--bg)]"
            >
              Play
            </button>
          </div>
        ) : null}

        {phase === 'playing' || phase === 'levelup' ? (
          <>
            <div className="fgpt-switcher" role="tablist" aria-label="Customers">
              {lanes.map((lane) => {
                const selected = lane.id === focusedId;
                const tone = tabTone({ patience: lane.patience, unread: lane.unread, left: lane.left });
                return (
                  <button
                    key={lane.id}
                    id={customerTabId(lane.id)}
                    ref={(node) => {
                      tabRefs.current[lane.id] = node;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={customerPanelId(lane.id)}
                    aria-label={`${lane.name}${lane.unread > 0 ? `, ${lane.unread} new` : ''}${tone === 'urgent' ? ', patience low' : ''}${lane.left ? ', left' : ''}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => focusLane(lane.id)}
                    className={`fgpt-tab is-${tone} ${selected ? 'is-on' : ''} ${lane.joining ? 'is-joining' : ''} ${lane.left ? 'is-leaving' : ''}`}
                  >
                    <span className="fgpt-face" style={{ background: `hsl(${lane.hue} 42% 42%)` }}>
                      {lane.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 truncate">{firstName(lane.name)}</span>
                    <span className="fgpt-tab-patience" style={{ width: `${Math.round(lane.patience * 100)}%` }} />
                    {lane.unread > 0 ? <span className="fgpt-badge">{lane.unread}</span> : null}
                  </button>
                );
              })}
            </div>

            <div className="fgpt-lanes" data-count={lanes.length}>
              {lanes.map((lane) => {
                const active = lane.id === focusedId;
                const kind = lane.current?.kind;
                return (
                  <article
                    key={lane.id}
                    id={customerPanelId(lane.id)}
                    role="tabpanel"
                    aria-labelledby={customerTabId(lane.id)}
                    hidden={!active}
                    inert={!active ? true : undefined}
                    className={`fgpt-lane ${active ? 'is-focus' : ''} ${lane.flash ? `is-${lane.flash}` : ''} ${lane.joining ? 'is-joining' : ''} ${lane.left ? 'is-leaving' : ''}`}
                  >
                    <header className="fgpt-lane-top" onClick={() => focusLane(lane.id)}>
                      <span className="fgpt-face" style={{ background: `hsl(${lane.hue} 42% 42%)` }}>
                        {lane.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--ink)]">{lane.name}</p>
                        <p className="truncate text-[11px] text-[var(--faint)]">
                          {lane.current ? jobKindLabel(lane.current.kind) : lane.vibe}
                        </p>
                      </div>
                      <span className="fgpt-q">{lane.queue.length + (lane.current ? 1 : 0)}</span>
                    </header>
                    <div className={`fgpt-patience ${lane.patience <= 0.28 ? 'is-urgent' : ''}`}>
                      <span style={{ width: `${Math.round(lane.patience * 100)}%` }} />
                    </div>
                    <div className="fgpt-log" role="log" aria-live={active ? 'polite' : 'off'}>
                      {lane.messages.map((message) => (
                        <MessageView key={message.id} message={message} />
                      ))}
                      {!lane.current && !lane.messages.length ? <TypingDots /> : null}
                      <div
                        ref={(node) => {
                          logRefs.current[lane.id] = node;
                        }}
                      />
                    </div>
                    {phase === 'playing' && lane.current ? (
                      <div className="fgpt-composer">
                        {isChoiceKind(lane.current.kind, lane.current.options) ? (
                          <div className="fgpt-choices">
                            {lane.current.options.map((option, index) => (
                              <button
                                key={option}
                                type="button"
                                disabled={busy && active}
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                  focusLane(lane.id);
                                  void finishLane(lane.id, true, option);
                                }}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  focusLane(lane.id);
                                  void finishLane(lane.id, true, option);
                                }}
                                className="fgpt-choice pressable"
                              >
                                <span className="fgpt-key">{index + 1}</span>
                                {option}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {kind && !isChoiceKind(kind, lane.current.options) && !isBonusKind(kind) ? (
                          <form
                            className="fgpt-typed"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void finishLane(lane.id, true);
                            }}
                          >
                            <input
                              value={active ? typed : ''}
                              maxLength={80}
                              onChange={(event) => {
                                typedRef.current = event.target.value;
                                setTyped(event.target.value);
                              }}
                              onFocus={() => focusLane(lane.id)}
                              placeholder="type it, fast"
                              disabled={busy && active}
                              className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm"
                              aria-label="Short answer"
                            />
                            <button
                              type="submit"
                              disabled={busy}
                              className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)] disabled:opacity-50"
                            >
                              Send
                            </button>
                          </form>
                        ) : null}
                        {kind === 'draw' ? <DrawPad key={lane.current.id} ref={drawRef} disabled={busy} /> : null}
                        {kind === 'sound' ? (
                          <SoundPad
                            key={lane.current.id}
                            ref={soundRef}
                            disabled={busy}
                            preferredMode={micMode}
                            onMode={setMicMode}
                          />
                        ) : null}
                        {kind === 'draw' || kind === 'sound' ? (
                          <div className="flex justify-end px-3 pb-3">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void finishLane(lane.id, true)}
                              className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)] disabled:opacity-50"
                            >
                              Send
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </>
        ) : null}

        {phase === 'levelup' ? (
          <div className="fgpt-interstitial">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Level up</p>
            <h2 className="mt-2 font-serif text-3xl tracking-tight">Level {level + 1}</h2>
            {newlyJoined(plan, level + 1, seed)[0] ? (
              <p className="mt-3 text-sm text-[var(--ink)]">{joinNotice(newlyJoined(plan, level + 1, seed)[0].name)}</p>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">Same crew. Faster queues.</p>
            )}
            <p className="mt-1 text-xs text-[var(--faint)]">
              {customersForLevel(level + 1, seed)} customers in the shop.
            </p>
            <button
              type="button"
              onClick={continueLevel}
              className="pressable mt-5 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]"
            >
              Next customer
            </button>
          </div>
        ) : null}

        {phase === 'results' ? (
          <div className="fgpt-results">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{rank.title}</p>
            <h2 className="mt-2 font-serif text-3xl tracking-tight text-[var(--ink)]">
              {strikes >= MAX_STRIKES ? 'Hallucination lockout' : 'Shift closed'}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {score} points · best {best != null ? Math.max(best, score) : score} · {servedTotal} requests · max combo x
              {maxCombo} · {liveCustomers} customers
            </p>
            <p className="mt-3 whitespace-pre-wrap text-lg leading-snug" aria-label="Share grid">
              {buildShareGrid(
                artifacts.map((item) =>
                  shareGlyph({
                    correct: item.thumbs === 'up',
                    empty: item.empty,
                    late: item.late,
                    bonus: isBonusKind(item.prompt.kind),
                  }),
                ),
              ) || '⬛'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyShare()}
                className="pressable rounded-full border border-[var(--line)] px-4 py-2 text-sm"
              >
                {shared ? 'Copied' : 'Share'}
              </button>
              <button
                type="button"
                onClick={() => void startRun()}
                className="pressable rounded-full bg-[var(--ink)] px-5 py-2 text-sm text-[var(--bg)]"
              >
                Play again
              </button>
            </div>
            <ul className="mt-4 grid gap-3">
              {artifacts.map((item, index) => (
                <li key={`${item.prompt.id}-${index}`} className="rounded-2xl border border-[var(--line)] p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--faint)]">
                    {item.customer ?? 'customer'} · {jobKindLabel(item.prompt.kind)} · {item.thumbs === 'up' ? 'ok' : 'miss'} ·{' '}
                    {item.points} pts
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink)]">{item.prompt.text}</p>
                  {item.correctAnswer ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      You: {item.playerAnswer || '…'} · Right: {item.correctAnswer}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.reaction}</p>
                  {item.seen ? <p className="mt-1 text-sm text-[var(--ink)]">I see: {item.seen}</p> : null}
                  {item.heard ? <p className="mt-1 text-sm text-[var(--ink)]">I heard: {item.heard}</p> : null}
                  {item.drawingUrl || item.audioUrl || item.replayHits?.length ? (
                    <div className="mt-3">
                      {item.drawingUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.drawingUrl} alt="" className="fgpt-drawing" />
                      ) : (
                        <AudioBubble src={item.audioUrl} hits={item.replayHits} />
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {joinName && phase === 'playing' ? (
          <p className="sr-only" aria-live="polite">
            {joinNotice(joinName)}
          </p>
        ) : null}
      </div>
    </GameShell>
  );
}
