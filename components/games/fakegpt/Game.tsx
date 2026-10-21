'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameShell from '../GameShell';
import { useGameChrome } from '../useGameChrome';
import { getGameBySlug } from '@/lib/games';
import DrawPad, { type DrawPadHandle } from './DrawPad';
import SoundPad, { replayHits, type MicMode, type SoundPadHandle } from './SoundPad';
import { fetchDailySet, readOffline, requestChat, requestJudge, writeOffline } from './api';
import {
  STORAGE_KEY,
  formatTimer,
  nextNudge,
  roundSeconds,
  scoreRound,
  scoreWithJudge,
  totalScore,
} from './logic';
import { capAudio, downscaleImage } from './media';
import type { Artifact, ChatMessage, Prompt, SynthHit } from './types';
import { formatUtcDate, utcDate, type DailySet } from '../../../workers/fakegpt/src/schema';

const meta = getGameBySlug('fakegpt')!;

type Phase = 'intro' | 'typing' | 'responding' | 'rating' | 'talking' | 'results';

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
    return (
      <div className="ml-auto max-w-[86%]">
        {message.persona ? <p className="mb-1 text-right text-[11px] text-[var(--faint)]">{message.persona}</p> : null}
        <p className="fgpt-user">{message.text}</p>
      </div>
    );
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
  const [offline, setOffline] = useState(false);
  const [daily, setDaily] = useState<DailySet | null>(null);
  const [reply, setReply] = useState('');
  const [chatting, setChatting] = useState(false);
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
    setOffline(readOffline());
    void fetchDailySet(readOffline()).then(setDaily);
  }, []);

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
        setMessages((current) => [
          ...current,
          { id: uid('user'), role: 'user', kind: 'text', text: next.text, persona: next.persona },
        ]);
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

  const startRun = useCallback(async () => {
    clearTimers();
    for (const item of artifacts) {
      if (item.audioUrl) URL.revokeObjectURL(item.audioUrl);
    }
    const pack = daily ?? (await fetchDailySet(offline));
    setDaily(pack);
    const nextQueue: Prompt[] = pack.rounds;
    setQueue(nextQueue);
    setArtifacts([]);
    setMessages([]);
    setRound(0);
    setBusy(false);
    setReply('');
    beginRound(0, nextQueue);
  }, [artifacts, beginRound, clearTimers, daily, offline]);

  const advance = useCallback(
    (nextScore: number) => {
      setBusy(false);
      setChatting(false);
      setReply('');
      const upcoming = round + 1;
      if (upcoming >= queue.length) {
        commitBest(nextScore);
        setPhase('results');
        return;
      }
      beginRound(upcoming, queue);
    },
    [beginRound, commitBest, queue, round],
  );

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
      const attempt = {
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
      };
      let result = scoreRound(attempt);
      let seen = '';
      let heard = '';
      let judged = false;
      const empty = result.empty;
      if (!offline && !empty) {
        const image = prompt.kind === 'draw' && draw?.dataUrl ? await downscaleImage(draw.dataUrl) : undefined;
        const audio =
          prompt.kind === 'sound' && sound?.usedMic && sound.blob ? await capAudio(sound.blob) : undefined;
        const judgedRemote = await requestJudge(
          {
            date: daily?.date ?? utcDate(),
            roundId: prompt.id,
            kind: prompt.kind,
            request: prompt.text,
            persona: prompt.persona ?? 'a impatient user',
            submittedInTime,
            remainingMs: attempt.remainingMs,
            totalMs,
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
      if (!judged) {
        result = {
          ...result,
          reaction: empty ? result.reaction : result.thumbs === 'up' ? prompt.good ?? result.reaction : prompt.bad ?? result.reaction,
        };
      }
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
        seen,
        heard,
        judged,
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
        setBusy(false);
        setPhase('talking');
      }, 380);
    },
    [beep, daily?.date, later, offline, phase, prompt, totalMs],
  );

  useEffect(() => {
    if (phase !== 'responding') return;
    const tick = window.setInterval(() => {
      const left = Math.max(0, deadlineRef.current - Date.now());
      setRemainingMs(left);
      const elapsed = totalMs > 0 ? 1 - left / totalMs : 1;
      const nudge = nextNudge(elapsed, nudgesRef.current, prompt?.nudges);
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
  }, [beep, finishRound, muted, phase, prompt?.nudges, totalMs]);

  const sendReply = useCallback(async () => {
    if (!prompt || chatting) return;
    const text = reply.trim();
    if (!text) {
      advance(score);
      return;
    }
    setChatting(true);
    setMessages((current) => [...current, { id: uid('me'), role: 'assistant', kind: 'miss', text }]);
    const chat = await requestChat(
      {
        date: daily?.date ?? utcDate(),
        roundId: prompt.id,
        persona: prompt.persona ?? 'a impatient user',
        request: prompt.text,
        playerText: text,
        history: messages
          .filter((message) => message.kind === 'text' || message.kind === 'rating' || message.kind === 'nudge')
          .map((message) => ({ role: message.role, text: 'text' in message ? message.text : '' })),
      },
      offline,
    );
    if (chat?.messages.length) {
      setMessages((current) => [
        ...current,
        ...chat.messages.map((line) => ({
          id: uid('chat'),
          role: 'user' as const,
          kind: 'text' as const,
          text: line,
          persona: prompt.persona,
        })),
      ]);
    }
    later(() => advance(score), 900);
  }, [advance, chatting, daily?.date, later, messages, offline, prompt, reply, score]);

  const status =
    phase === 'intro'
      ? 'Waiting for a weird human'
      : phase === 'results'
        ? 'Run complete'
        : phase === 'typing'
          ? 'Incoming request…'
          : phase === 'rating' || phase === 'talking'
            ? 'They are talking back'
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
          {offline ? 'Offline' : 'Online judge'}
        </button>
      }
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
              {phase === 'responding' && prompt
                ? prompt.text
                : `Today's requests · ${formatUtcDate(daily?.date ?? utcDate())}${daily?.source === 'ai' ? '' : ' · local set'}`}
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
                Hello. I am not a model. You are. Today&apos;s weird humans share one daily set
                ({formatUtcDate(daily?.date ?? utcDate())}). Draw or make the noise before the timer dies.
              </p>
              <p className="fgpt-user">
                If online judging is on, a downscaled drawing or short clip is sent to a Worker to score this round,
                then discarded. Offline mode keeps everything on this device.
              </p>
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
              onClick={() => void startRun()}
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

        {phase === 'talking' ? (
          <div className="fgpt-composer px-3 py-3">
            <label className="block text-[12px] text-[var(--muted)]" htmlFor="fgpt-reply">
              Optional excuse (one short reply). Skip to keep moving.
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                id="fgpt-reply"
                value={reply}
                maxLength={160}
                onChange={(event) => setReply(event.target.value)}
                placeholder="sorry, the cat ate my stylus"
                className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={chatting}
                onClick={() => void sendReply()}
                className="pressable rounded-full bg-[var(--ink)] px-4 py-2 text-sm text-[var(--bg)] disabled:opacity-50"
              >
                {reply.trim() ? 'Reply' : 'Continue'}
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
                  {item.seen ? <p className="mt-1 text-sm text-[var(--ink)]">I see: {item.seen}</p> : null}
                  {item.heard ? <p className="mt-1 text-sm text-[var(--ink)]">I heard: {item.heard}</p> : null}
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
              onClick={() => void startRun()}
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
