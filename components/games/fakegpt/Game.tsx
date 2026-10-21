'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameShell from '../GameShell';
import { useGameChrome } from '../useGameChrome';
import { getGameBySlug } from '@/lib/games';
import DrawPad, { type DrawPadHandle } from './DrawPad';
import SoundPad, { replayHits, type MicMode, type SoundPadHandle } from './SoundPad';
import {
  ROUNDS_PER_RUN,
  STORAGE_KEY,
  formatTimer,
  nextNudge,
  pickPrompts,
  roundSeconds,
  scoreRound,
  totalScore,
} from './logic';
import { PROMPTS } from './prompts';
import type { Artifact, ChatMessage, Prompt, SynthHit } from './types';

const meta = getGameBySlug('fakegpt')!;

type Phase = 'intro' | 'typing' | 'responding' | 'rating' | 'results';

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
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
    return <p className="fgpt-user">{message.text}</p>;
  }
  if (message.role === 'user' && message.kind === 'nudge') {
    return <p className="fgpt-user fgpt-nudge">{message.text}</p>;
  }
  if (message.role === 'user' && message.kind === 'rating') {
    return (
      <p className="fgpt-user">
        <span aria-hidden="true">{message.thumbs === 'up' ? '👍 ' : '👎 '}</span>
        {message.text}
      </p>
    );
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

export default function FakeGptGame() {
  const { muted, best, commitBest, beep, toggleMute } = useGameChrome(STORAGE_KEY);
  const [phase, setPhase] = useState<Phase>('intro');
  const [queue, setQueue] = useState<Prompt[]>([]);
  const [round, setRound] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [remainingMs, setRemainingMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const [micMode, setMicMode] = useState<MicMode>('unknown');
  const [busy, setBusy] = useState(false);
  const drawRef = useRef<DrawPadHandle>(null);
  const soundRef = useRef<SoundPadHandle>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const deadlineRef = useRef(0);
  const nudgesRef = useRef(0);
  const finishingRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const prompt = queue[round];
  const score = useMemo(() => totalScore(artifacts), [artifacts]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  const later = useCallback(
    (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timersRef.current.push(id);
      return id;
    },
    [],
  );

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    logRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, phase]);

  const beginRound = useCallback(
    (nextRound: number, nextQueue: Prompt[]) => {
      const next = nextQueue[nextRound];
      if (!next) {
        setPhase('results');
        return;
      }
      finishingRef.current = false;
      nudgesRef.current = 0;
      setRound(nextRound);
      setPhase('typing');
      later(() => {
        setMessages((current) => [...current, { id: uid('user'), role: 'user', kind: 'text', text: next.text }]);
        const ms = roundSeconds(nextRound) * 1000;
        deadlineRef.current = Date.now() + ms;
        setTotalMs(ms);
        setRemainingMs(ms);
        setPhase('responding');
        beep(520, 0.05);
      }, 720);
    },
    [beep, later],
  );

  const startRun = useCallback(() => {
    clearTimers();
    for (const item of artifacts) {
      if (item.audioUrl) URL.revokeObjectURL(item.audioUrl);
    }
    const nextQueue = pickPrompts(PROMPTS, ROUNDS_PER_RUN);
    setQueue(nextQueue);
    setArtifacts([]);
    setMessages([]);
    setRound(0);
    setBusy(false);
    beginRound(0, nextQueue);
  }, [artifacts, beginRound, clearTimers]);

  const finishRound = useCallback(
    async (submittedInTime: boolean) => {
      if (!prompt || finishingRef.current || phase !== 'responding') return;
      finishingRef.current = true;
      setBusy(true);
      const left = Math.max(0, deadlineRef.current - Date.now());
      const draw = prompt.kind === 'draw' ? drawRef.current?.snapshot() : null;
      const sound =
        prompt.kind === 'sound'
          ? await Promise.race([
              soundRef.current?.finalize() ?? Promise.resolve(null),
              new Promise<null>((resolve) => {
                window.setTimeout(() => resolve(null), 1500);
              }),
            ])
          : null;
      const result = scoreRound({
        kind: prompt.kind,
        submittedInTime,
        remainingMs: submittedInTime ? left : 0,
        totalMs,
        strokeCount: draw?.strokeCount ?? 0,
        uniqueColors: draw?.uniqueColors ?? 0,
        coverage: draw?.coverage ?? 0,
        audioMs: sound?.audioMs ?? 0,
        peakLevel: sound?.peakLevel ?? 0,
        padHits: sound?.padHits ?? 0,
      });
      const artifact: Artifact = {
        prompt,
        points: result.points,
        thumbs: result.thumbs,
        reaction: result.reaction,
        stars: result.stars,
        empty: result.empty,
        late: result.late,
        drawingUrl: draw?.dataUrl || undefined,
        audioUrl: sound?.usedMic && sound.blobUrl ? sound.blobUrl : undefined,
        replayHits: sound?.hits,
      };
      const assistant: ChatMessage = result.empty
        ? { id: uid('miss'), role: 'assistant', kind: 'miss', text: '…' }
        : prompt.kind === 'draw' && artifact.drawingUrl
          ? { id: uid('draw'), role: 'assistant', kind: 'drawing', src: artifact.drawingUrl }
          : {
              id: uid('audio'),
              role: 'assistant',
              kind: 'audio',
              src: artifact.audioUrl ?? '',
              hits: artifact.replayHits,
            };
      setMessages((current) => [...current, assistant]);
      setArtifacts((current) => [...current, artifact]);
      setPhase('rating');
      beep(result.thumbs === 'up' ? 740 : 180, 0.1);
      later(() => {
        setMessages((current) => [
          ...current,
          { id: uid('rate'), role: 'user', kind: 'rating', thumbs: result.thumbs, text: result.reaction },
        ]);
      }, 380);
      later(() => {
        setBusy(false);
        const upcoming = round + 1;
        if (upcoming >= queue.length) {
          commitBest(score + result.points);
          setPhase('results');
          return;
        }
        beginRound(upcoming, queue);
      }, 1700);
    },
    [beginRound, beep, commitBest, later, phase, prompt, queue, round, score, totalMs],
  );

  useEffect(() => {
    if (phase !== 'responding') return;
    const tick = window.setInterval(() => {
      const left = Math.max(0, deadlineRef.current - Date.now());
      setRemainingMs(left);
      const elapsed = totalMs > 0 ? 1 - left / totalMs : 1;
      const nudge = nextNudge(elapsed, nudgesRef.current);
      if (nudge) {
        nudgesRef.current += 1;
        setMessages((current) => [...current, { id: uid('nudge'), role: 'user', kind: 'nudge', text: nudge }]);
        if (!muted) beep(240, 0.04);
      }
      if (left <= 0) {
        window.clearInterval(tick);
        void finishRound(false);
      }
    }, 100);
    return () => window.clearInterval(tick);
  }, [beep, finishRound, muted, phase, totalMs]);

  const status =
    phase === 'intro'
      ? 'Waiting for a weird human'
      : phase === 'results'
        ? 'Run complete'
        : phase === 'typing'
          ? 'Incoming request…'
          : phase === 'rating'
            ? 'They are rating you'
            : prompt
              ? `Round ${round + 1}/${queue.length} · ${prompt.kind === 'draw' ? 'Draw' : 'Sound'}`
              : 'Ready';

  const urgent = phase === 'responding' && remainingMs <= 5000;

  return (
    <GameShell
      title={meta.title}
      howTo={meta.howTo}
      score={score}
      best={best ?? '—'}
      status={status}
      muted={muted}
      onMute={toggleMute}
      onRestart={phase === 'intro' ? undefined : startRun}
      restartLabel={phase === 'results' ? 'Play again' : 'Restart'}
      tight
      hud="line"
    >
      <div className={`fgpt-chat ${phase === 'responding' ? 'is-playing' : ''} ${phase === 'results' ? 'is-results' : ''}`}>
        <header className="fgpt-bar">
          <span className="fgpt-mark" aria-hidden="true">
            f
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--ink)]">FakeGPT</p>
            <p className="truncate text-xs text-[var(--faint)]">
              {phase === 'responding' && prompt ? prompt.text : 'You are the model. Be fast. Be strange.'}
            </p>
          </div>
          {phase === 'responding' ? (
            <p className={`fgpt-timer ${urgent ? 'is-urgent' : ''}`} aria-live="polite">
              {formatTimer(remainingMs)}
            </p>
          ) : null}
        </header>

        {phase === 'results' ? null : (
        <div className="fgpt-log" role="log" aria-live="polite">
          {phase === 'intro' ? (
            <div className="space-y-3 text-sm leading-relaxed text-[var(--muted)]">
              <p className="fgpt-assistant">
                Hello. I am not a model. You are. Weird humans will type requests. You have a short timer to draw
                them or make the noise they asked for.
              </p>
              <p className="fgpt-user">draw me a cat riding a skateboard. or don&apos;t. i will be impatient either way.</p>
            </div>
          ) : null}
          {messages.map((message) => (
            <MessageView key={message.id} message={message} />
          ))}
          {phase === 'typing' ? <TypingDots /> : null}
          <div ref={logRef} />
        </div>
        )}

        {phase === 'intro' ? (
          <div className="fgpt-composer">
            <button
              type="button"
              onClick={startRun}
              className="pressable w-full rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]"
            >
              New chat
            </button>
          </div>
        ) : null}

        {phase === 'responding' && prompt ? (
          <div className="fgpt-composer">
            {prompt.kind === 'draw' ? (
              <DrawPad key={prompt.id} ref={drawRef} disabled={busy} />
            ) : (
              <SoundPad
                key={prompt.id}
                ref={soundRef}
                disabled={busy}
                preferredMode={micMode}
                onMode={setMicMode}
              />
            )}
            <div className="flex justify-end px-3 pb-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void finishRound(true)}
                className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)] disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        ) : null}

        {phase === 'results' ? (
          <div className="fgpt-results">
            <h2 className="font-serif text-2xl tracking-tight text-[var(--ink)]">Your context window</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {score} points this run{best != null ? ` · best ${Math.max(best, score)}` : ''}. The users have logged off.
            </p>
            <ul className="mt-4 grid gap-3">
              {artifacts.map((item) => (
                <li key={item.prompt.id} className="rounded-2xl border border-[var(--line)] p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--faint)]">
                    {item.prompt.kind} · {item.thumbs === 'up' ? 'thumbs up' : 'thumbs down'} · {item.points} pts
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink)]">{item.prompt.text}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.reaction}</p>
                  <div className="mt-3">
                    {item.drawingUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.drawingUrl} alt="" className="fgpt-drawing" />
                    ) : (
                      <AudioBubble src={item.audioUrl} hits={item.replayHits} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={startRun}
              className="pressable mt-4 w-full rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]"
            >
              Play again
            </button>
          </div>
        ) : null}
      </div>
    </GameShell>
  );
}
