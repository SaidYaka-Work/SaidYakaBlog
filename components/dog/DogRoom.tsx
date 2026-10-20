'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dogWorkerUrl,
  dogWsUrl,
  generateGenome,
  stageWord,
  type DogSnapshot,
  type Memorial,
} from '@/lib/dog';
import { formatNeed, reactionFromEvent } from './look';
import { englishPath } from '@/lib/site';
import CatchGame from './CatchGame';
import DogPortrait from './DogPortrait';
import DogStudio from './DogStudio';
import FeedGame from './FeedGame';
import NamePicker from './NamePicker';
import WalkGame from './WalkGame';
import './dog.css';

type PlayKind = 'feed' | 'walk' | 'catch' | null;
type Reaction = 'idle' | 'pet' | 'walk' | 'feed' | 'sleep';

const ERRORS: Record<string, string> = {
  cooldown: 'Give him a moment.',
  rate_limited: 'The porch is busy. Try again shortly.',
  asleep: 'He is asleep. Let him dream.',
  too_tired: 'He is too tired for that.',
  too_soon: 'He just did that.',
  gone: 'Nobody is on the rug right now.',
  home: 'A dog is already home.',
  missed: 'The stray slipped past. Try again.',
  invalid: 'Pick a name from the list.',
  busy: 'Too many neighbors on the porch.',
  not_catcher: 'Only the catcher can pick the name.',
  too_late: 'The naming window closed.',
  named: 'This dog already has a name.',
};

export default function DogRoom() {
  const worker = dogWorkerUrl();
  const [snapshot, setSnapshot] = useState<DogSnapshot | null>(null);
  const [status, setStatus] = useState('Looking for the porch…');
  const [connected, setConnected] = useState(false);
  const [play, setPlay] = useState<PlayKind>(null);
  const [playId, setPlayId] = useState<string | null>(null);
  const [reaction, setReaction] = useState<Reaction>('idle');
  const [canName, setCanName] = useState(false);
  const [nameStatus, setNameStatus] = useState('');
  const [studio, setStudio] = useState(false);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    setStudio(new URLSearchParams(window.location.search).has('studio'));
  }, []);

  const apply = useCallback((data: DogSnapshot) => {
    setSnapshot(data);
    setConnected(true);
    setStatus(
      data.dog
        ? `${data.presence} ${data.presence === 1 ? 'neighbor' : 'neighbors'} on the porch`
        : 'The rug is empty.',
    );
  }, []);

  useEffect(() => {
    if (!worker) return;
    let closed = false;
    let pause = 800;
    const open = () => {
      const ws = new WebSocket(dogWsUrl());
      socket.current = ws;
      ws.onopen = () => {
        pause = 800;
        ws.send(JSON.stringify({ type: 'hello' }));
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data) as
          | DogSnapshot
          | { type: 'play'; playId: string; game: PlayKind }
          | { type: 'error'; code: string; text?: string }
          | { type: 'event'; text: string }
          | { type: 'name-please'; until: number };
        if (message.type === 'state') {
          apply(message);
          if (!message.awaitingName) {
            setCanName(false);
            setNameStatus('');
          }
        }
        if (message.type === 'play') {
          setPlayId(message.playId);
          setPlay(message.game);
        }
        if (message.type === 'name-please') {
          setCanName(true);
          setNameStatus('');
        }
        if (message.type === 'error') {
          const text = message.text || ERRORS[message.code] || 'Not just now.';
          setStatus(text);
          if (message.code === 'invalid' || message.code === 'not_catcher') setNameStatus(text);
        }
        if (message.type === 'event') {
          setStatus(message.text);
          const next = reactionFromEvent(message.text);
          if (next) {
            setReaction(next);
            window.setTimeout(() => setReaction('idle'), next === 'feed' || next === 'walk' ? 1600 : 1200);
          }
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (closed) return;
        window.setTimeout(open, pause);
        pause = Math.min(8_000, pause * 1.6);
      };
    };
    open();
    return () => {
      closed = true;
      socket.current?.close();
    };
  }, [apply, worker]);

  function send(payload: object) {
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(payload));
    }
  }

  function start(game: Exclude<PlayKind, null>) {
    send({ type: 'start', game });
  }

  function finish(score: number) {
    if (playId) send({ type: 'finish', playId, score });
    if (play === 'walk') setReaction('walk');
    if (play === 'feed') setReaction('feed');
    setPlay(null);
    setPlayId(null);
    window.setTimeout(() => setReaction('idle'), 1200);
  }

  function pickName(nameId: string) {
    send({ type: 'name', nameId });
  }

  const napping = !worker || !connected;
  const dog = snapshot?.dog ?? null;
  const memorial = snapshot?.memorial ?? null;
  const awaitingName = Boolean(snapshot?.awaitingName);
  const shownName = dog?.profile.name || (awaitingName ? 'A new dog' : memorial ? `${memorial.profile.name} left` : 'Biscuit');

  if (studio) return <DogStudio />;

  return (
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="hero-kicker text-xs uppercase tracking-[0.18em] text-[var(--accent)]">The porch</p>
      <h1 className="hero-title mt-2 font-serif text-4xl tracking-tight sm:text-5xl">
        {shownName}
      </h1>
      <p className="hero-copy mt-4 max-w-xl text-[var(--muted)] leading-relaxed">
        One dog for the whole internet. Anyone can pet him, feed him, or take him around the block.
        What he needs changes with his age.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
        <span>{status}</span>
        <Link href={englishPath('/dog/history')} className="link-underline text-[var(--ink)]">
          Past dogs
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-[1.6rem] border border-[var(--line)] bg-[var(--bg-elevated)]">
        {napping && !dog ? (
          <div className="px-6 py-16 text-center">
            <DogPortrait genome={generateGenome('napping-biscuit')} asleep reaction="sleep" night={false} stage="puppy" compact />
            <p className="mt-6 font-serif text-2xl">The dog is napping</p>
            <p className="mx-auto mt-3 max-w-md text-[var(--muted)]">
              The shared kennel is not connected yet. The rug stays warm until the Worker wakes up.
            </p>
          </div>
        ) : play === 'feed' ? (
          <div className="p-4">
            <FeedGame onDone={(score) => finish(score)} drops={dog?.care.feedDrops} genome={dog?.genome} />
          </div>
        ) : play === 'walk' ? (
          <div className="p-4">
            <WalkGame
              onDone={(score) => finish(score)}
              durationMs={dog?.care.walkGameMs}
              speed={dog?.care.walkSpeed}
              spawnMs={dog?.care.walkSpawnMs}
              rockChance={dog?.care.walkRockChance}
              caption={dog?.care.walkCaption}
              genome={dog?.genome}
            />
          </div>
        ) : play === 'catch' ? (
          <div className="p-4">
            <CatchGame onDone={(score) => finish(score)} />
          </div>
        ) : awaitingName && canName ? (
          <div>
            {dog && (
              <DogPortrait
                genome={dog.genome}
                asleep={dog.asleep}
                reaction="idle"
                night={dog.night}
                stage={dog.stage}
                happiness={dog.happiness}
                interactive
              />
            )}
            <NamePicker
              until={snapshot?.nameUntil ?? null}
              onPick={pickName}
              status={nameStatus}
              avoidIds={snapshot?.usedNameIds ?? []}
            />
          </div>
        ) : dog ? (
          <DogPortrait
            genome={dog.genome}
            asleep={dog.asleep}
            reaction={dog.asleep ? 'sleep' : reaction}
            night={dog.night}
            stage={dog.stage}
            happiness={dog.happiness}
            hungry={dog.care.feedOverdue || dog.care.hunger > 70}
            sad={dog.happiness < 40}
            interactive
          />
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="font-serif text-3xl">The porch is empty</p>
            {memorial && <MemorialCard record={memorial} />}
          </div>
        )}
      </div>

      {awaitingName && !canName && (
        <p className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3 text-sm">
          A new dog was caught, waiting for a name.
        </p>
      )}

      {dog && !awaitingName && (
        <>
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <Pill>
              {dog.stageLabel} · {dog.ageDays} days old
            </Pill>
            <Pill>{dog.mood}</Pill>
          </div>
          <p className="mt-3 text-sm text-[var(--ink)]">{dog.care.ageNote}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">{dog.profile.personality}</p>
          {dog.care.warning && (
            <p className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3 text-sm">
              {dog.care.warning}
            </p>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Need
              label="Dinner"
              hint={dog.care.mealHint}
              value={formatNeed(dog.care.nextFeedInMs, dog.care.feedOverdue)}
              hot={dog.care.feedOverdue}
            />
            <Need
              label="Walk"
              hint={dog.care.walkHint}
              value={formatNeed(dog.care.nextWalkInMs, dog.care.walkOverdue)}
              hot={dog.care.walkOverdue}
            />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Happiness" value={dog.happiness} />
            <Stat label="Energy" value={dog.energy} />
            <Stat label="Fullness" value={dog.fullness} />
            <Stat label="Affection" value={dog.affection} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="pressable rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]" onClick={() => { send({ type: 'action', action: 'pet' }); setReaction('pet'); window.setTimeout(() => setReaction('idle'), 900); }}>
              Pet
            </button>
            <button type="button" className="pressable rounded-full border border-[var(--line)] px-5 py-2.5 text-sm" onClick={() => start('feed')}>
              Feed
            </button>
            <button type="button" className="pressable rounded-full border border-[var(--line)] px-5 py-2.5 text-sm" onClick={() => start('walk')}>
              Walk
            </button>
          </div>
          <p className="mt-4 text-sm text-[var(--faint)]">
            {dog.totals.pets} pets · {dog.totals.feeds} meals · {dog.totals.walks} walks · {dog.totals.miles} miles
          </p>
          <ul className="mt-6 space-y-2 text-sm text-[var(--muted)]">
            {dog.activity.slice(0, 6).map((item) => (
              <li key={`${item.at}-${item.text}`}>{item.text}</li>
            ))}
          </ul>
        </>
      )}

      {!dog && !napping && (
        <div className="mt-6">
          <p className="text-[var(--muted)]">Catch the next dog before the porch forgets how.</p>
          <button type="button" className="pressable mt-4 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm text-[var(--bg)]" onClick={() => start('catch')}>
            Catch a dog
          </button>
        </div>
      )}
      {!studio && (
        <p className="dog-credit">
          3D Shiba Inu and Husky by <a className="link-underline" href="https://quaternius.com/packs/ultimateanimatedanimals.html">Quaternius</a>, CC0.
        </p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] px-4 py-3">
      <span className="block text-xs uppercase tracking-[0.12em] text-[var(--faint)]">{label}</span>
      <strong className="mt-1 block text-xl font-normal">{value}</strong>
    </div>
  );
}

function Need({ label, hint, value, hot }: { label: string; hint: string; value: string; hot: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${hot ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-[var(--bg-elevated)]'}`}>
      <span className="block text-xs uppercase tracking-[0.12em] text-[var(--faint)]">{label}</span>
      <strong className="mt-1 block font-normal">{value}</strong>
      <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-[var(--line)] px-3 py-1">{children}</span>;
}

export function MemorialCard({ record }: { record: Memorial }) {
  return (
    <div className="mx-auto mt-6 max-w-md text-left">
      <DogPortrait
        genome={record.genome}
        asleep={false}
        reaction="idle"
        night={false}
        stage={record.furthestStage}
        compact
      />
      <p className="mt-4 text-sm text-[var(--muted)]">
        {record.profile.name} made it to {stageWord(record.furthestStage)} · {record.daysSurvived} days · {record.totals.walks} walks · peak happiness {record.peakHappiness}
        {record.namedByCatcher ? ' · named by the catcher' : ''}
      </p>
    </div>
  );
}

