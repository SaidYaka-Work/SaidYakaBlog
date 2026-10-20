'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  dogWorkerUrl,
  dogWsUrl,
  generateGenome,
  type DogSnapshot,
} from '@/lib/dog';
import { reactionFromEvent } from './look';
import CatchGame from './CatchGame';
import DogHud, { type Toast } from './DogHud';
import DogPortrait from './DogPortrait';
import DogStudio from './DogStudio';
import FeedGame from './FeedGame';
import NamePicker from './NamePicker';
import WalkGame from './WalkGame';
import { playDogSfx } from './dogSound';
import useDogDrive from './useDogDrive';
import './dog.css';

const HistoryBoard = dynamic(() => import('./HistoryBoard'), { ssr: false });

type PlayKind = 'feed' | 'walk' | 'catch' | null;
type Reaction = 'idle' | 'pet' | 'walk' | 'feed' | 'sleep';
type Panel = 'hall' | 'feed' | 'walk' | 'catch' | 'name' | null;
type Preview = 'start' | 'hungry' | 'feed' | 'walk' | 'hall' | 'sleep' | 'eat' | 'sad' | 'pose-walk' | 'room' | 'leash' | null;

const ERRORS: Record<string, string> = {
  cooldown: 'Give him a moment.',
  rate_limited: 'The porch is busy. Try again shortly.',
  asleep: 'He is asleep. Let him dream.',
  too_tired: 'He is too tired for that.',
  too_soon: 'He just did that.',
  gone: 'Nobody is on the rug right now.',
  too_far: 'Walk him to the feeder.',
  busy: 'A visitor already has the leash.',
  home: 'A dog is already home.',
  missed: 'The stray slipped past. Try again.',
  invalid: 'Pick a name from the list.',
  porch_busy: 'Too many neighbors on the porch.',
  not_catcher: 'Only the catcher can pick the name.',
  too_late: 'The naming window closed.',
  named: 'This dog already has a name.',
};

function toastFromText(text: string): Omit<Toast, 'id'> {
  const line = text.toLowerCase();
  if (line.includes('petted') || line.includes('scratched')) return { emote: '👋', text };
  if (line.includes('fed') || line.includes('dinner')) return { emote: '🍖', text };
  if (line.includes('walk') || line.includes('sniff')) return { emote: '🐾', text };
  return { emote: '✨', text };
}

export default function DogRoom({ initialPanel = null }: { initialPanel?: Panel }) {
  const worker = dogWorkerUrl();
  const [snapshot, setSnapshot] = useState<DogSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [play, setPlay] = useState<PlayKind>(null);
  const [playId, setPlayId] = useState<string | null>(null);
  const [reaction, setReaction] = useState<Reaction>('idle');
  const [canName, setCanName] = useState(false);
  const [nameStatus, setNameStatus] = useState('');
  const [studio, setStudio] = useState(false);
  const [preview, setPreview] = useState<Preview>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(12);
  const [muted, setMuted] = useState(true);
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [hint, setHint] = useState(true);
  const feedRef = useRef<() => void>(() => undefined);
  const socket = useRef<WebSocket | null>(null);
  const toastId = useRef(1);
  const lastMove = useRef(0);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const previewRef = useRef<Preview>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setStudio(params.has('studio'));
    const next = params.get('preview');
    if (
      next === 'start' ||
      next === 'hungry' ||
      next === 'feed' ||
      next === 'walk' ||
      next === 'hall' ||
      next === 'sleep' ||
      next === 'eat' ||
      next === 'sad' ||
      next === 'pose-walk' ||
      next === 'room' ||
      next === 'leash'
    ) {
      setPreview(next);
      previewRef.current = next;
      if (next !== 'start') setPlaying(true);
      if (next === 'hall') setPanel('hall');
      if (next === 'feed') setPlay('feed');
      if (next === 'walk') setPlay('walk');
      if (next === 'sleep') setReaction('sleep');
      if (next === 'eat') setReaction('feed');
      if (next === 'pose-walk') setReaction('walk');
    } else if (initialPanel === 'hall') {
      setPlaying(true);
      setPanel('hall');
    }
    try {
      const stored = localStorage.getItem('biscuit-muted');
      setMuted(stored !== '0');
      setHint(localStorage.getItem('biscuit-hint') !== '1');
    } catch {
      setMuted(true);
    }
  }, [initialPanel]);

  useEffect(() => {
    let live = true;
    const urls = ['/dog/ShibaInu.glb', '/dog/Husky.glb'];
    let loaded = 0;
    urls.forEach((url) => {
      fetch(url)
        .then((response) => response.arrayBuffer())
        .catch(() => undefined)
        .finally(() => {
          if (!live) return;
          loaded += 1;
          setProgress(20 + Math.round((loaded / urls.length) * 55));
        });
    });
    return () => {
      live = false;
    };
  }, []);

  const pushToast = useCallback((text: string) => {
    const id = toastId.current++;
    setToasts((current) => [...current.slice(-2), { id, ...toastFromText(text) }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 2800);
  }, []);

  const apply = useCallback((data: DogSnapshot) => {
    setSnapshot(data);
    setConnected(true);
    setProgress((value) => Math.max(value, 78));
  }, []);

  useEffect(() => {
    if (!worker) {
      setProgress((value) => Math.max(value, 70));
      return;
    }
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
          | { type: 'name-please'; until: number }
          | { type: 'welcome'; clientId: string }
          | { type: 'pose'; pose?: DogSnapshot['pose']; leash?: DogSnapshot['leash']; feeder?: DogSnapshot['feeder'] };
        if (message.type === 'welcome') {
          setClientId(message.clientId);
        }
        if (message.type === 'pose') {
          setSnapshot((current) =>
            current
              ? {
                  ...current,
                  pose: message.pose ?? current.pose,
                  leash: message.leash ?? current.leash,
                  feeder: message.feeder ?? current.feeder,
                }
              : current,
          );
        }
        if (message.type === 'state') {
          apply(message);
          if (!message.awaitingName) {
            setCanName(false);
            setNameStatus('');
            if (panelRef.current === 'name') setPanel(null);
          }
        }
        if (message.type === 'play') {
          setPlayId(message.playId);
          setPlay(message.game);
          setPanel(null);
        }
        if (message.type === 'name-please') {
          setCanName(true);
          setNameStatus('');
          setPanel('name');
        }
        if (message.type === 'error') {
          const text = message.text || ERRORS[message.code] || 'Not just now.';
          pushToast(text);
          if (message.code === 'invalid' || message.code === 'not_catcher') setNameStatus(text);
        }
        if (message.type === 'event') {
          pushToast(message.text);
          const next = reactionFromEvent(message.text);
          if (next && !previewRef.current) {
            setReaction(next);
            if (next === 'pet') playDogSfx('bark', mutedRef.current);
            if (next === 'feed') playDogSfx('munch', mutedRef.current);
            if (next === 'walk') playDogSfx('step', mutedRef.current);
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
  }, [apply, pushToast, worker]);

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
    if (play === 'walk') {
      setReaction('walk');
      playDogSfx('step', muted);
    }
    if (play === 'feed') {
      setReaction('feed');
      playDogSfx('munch', muted);
    }
    setPlay(null);
    setPlayId(null);
    window.setTimeout(() => setReaction('idle'), 1200);
  }

  function pickName(nameId: string) {
    send({ type: 'name', nameId });
  }

  function toggleMute() {
    setMuted((value) => {
      const next = !value;
      try {
        localStorage.setItem('biscuit-muted', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  const napping = !worker || !connected;
  const dog = snapshot?.dog ?? null;
  const previewing = Boolean(preview) && preview !== 'start' && preview !== 'hall';
  const awaitingName = Boolean(snapshot?.awaitingName);
  const shownName = dog?.profile.name || (awaitingName ? 'A new dog' : snapshot?.memorial?.profile.name || 'Biscuit');
  const hungry = preview === 'hungry' || preview === 'eat' || Boolean(dog?.care.feedOverdue) || (dog?.care.hunger ?? 0) > 70;
  const wantsWalk = preview === 'hungry' || Boolean(dog?.care.walkOverdue) || (dog?.care.walkNeed ?? 0) > 70;
  const poseAsleep = preview === 'sleep' || (!previewing && Boolean(dog?.asleep));
  const poseReaction =
    preview === 'sleep'
      ? 'sleep'
      : preview === 'eat'
        ? 'feed'
        : preview === 'pose-walk'
          ? 'walk'
          : dog?.asleep
            ? 'sleep'
            : reaction;
  const poseSad = preview === 'sad' || (!previewing && (dog?.happiness ?? 100) < 40);
  const fallbackAsleep = preview === 'sleep' || preview === 'start' || !preview;
  const fallbackReaction: Reaction =
    preview === 'eat' ? 'feed' : preview === 'pose-walk' ? 'walk' : preview === 'sleep' ? 'sleep' : preview === 'sad' || preview === 'hungry' ? 'idle' : 'sleep';
  const overlay = play || (awaitingName && canName) || panel;
  const canTap = ready || progress >= 88 || napping;
  const shared = Boolean(snapshot?.pose);
  const youHold = Boolean(snapshot?.leash?.held && snapshot.leash.holderId && snapshot.leash.holderId === clientId);
  const visitorWalking = preview === 'leash' || Boolean(snapshot?.leash?.held && snapshot.leash.holderId && snapshot.leash.holderId !== clientId);
  const hideDrive = preview === 'eat' || preview === 'sleep' || preview === 'pose-walk';

  const hideHint = useCallback(() => {
    setHint(false);
    try {
      localStorage.setItem('biscuit-hint', '1');
    } catch {
      // ignore
    }
  }, []);

  const { input, touch, setStick } = useDogDrive({
    enabled: playing && !studio,
    blocked: Boolean(overlay),
    onFirstUse: hideHint,
  });

  function feedHim() {
    hideHint();
    if (shared) {
      send({ type: 'bowl' });
      return;
    }
    start('feed');
  }
  feedRef.current = feedHim;

  useEffect(() => {
    if (!playing || overlay || !shared) return;
    const moving = Math.hypot(input.ax, input.az) > 0.12;
    if (!moving) return;
    const now = performance.now();
    if (now - lastMove.current < 80) return;
    lastMove.current = now;
    send({ type: 'move', ax: input.ax, az: input.az, run: input.run });
  }, [input, overlay, playing, shared]);

  useEffect(() => {
    if (!playing || overlay) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code !== 'KeyE' && event.code !== 'Space') return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, .dog-overlay, .dog-modal, .dog-start')) {
        return;
      }
      event.preventDefault();
      feedRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, playing]);

  useEffect(() => {
    if (canName) setPlaying(true);
  }, [canName]);

  useEffect(() => {
    if (ready) setProgress(100);
  }, [ready]);

  if (studio) return <DogStudio />;

  return (
    <div className="dog-game">
      {dog ? (
        <DogPortrait
          genome={dog.genome}
          asleep={poseAsleep}
          reaction={poseReaction}
          night={dog.night}
          stage={dog.stage}
          happiness={dog.happiness}
          hungry={hungry}
          sad={poseSad}
          interactive
          fill
          food={Boolean(snapshot?.feeder?.hasFood || snapshot?.feeder?.eating)}
          drive={
            hideDrive
              ? null
              : {
                  input,
                  server: snapshot?.pose ?? null,
                  youHold,
                  localOnly: !shared,
                  onPose: undefined,
                }
          }
          onReady={() => setReady(true)}
        />
      ) : (
        <DogPortrait
          genome={generateGenome(previewing ? 'biscuit-porch-1' : 'napping-biscuit')}
          asleep={fallbackAsleep}
          reaction={fallbackReaction}
          night={false}
          stage="puppy"
          happiness={72}
          hungry={hungry}
          sad={preview === 'sad'}
          interactive={previewing}
          fill
          empty={!napping && !previewing}
          food={preview === 'eat'}
          drive={
            previewing && !hideDrive
              ? {
                  input,
                  server: null,
                  youHold: true,
                  localOnly: true,
                  onPose: undefined,
                }
              : null
          }
          onReady={() => setReady(true)}
        />
      )}

      {playing && (
        <DogHud
          name={shownName}
          stageLabel={dog?.stageLabel || (awaitingName ? 'new' : napping ? 'napping' : 'away')}
          presence={snapshot?.presence ?? 0}
          happiness={dog?.happiness ?? (previewing ? 72 : 0)}
          energy={dog?.energy ?? (previewing ? 64 : 0)}
          fullness={dog?.fullness ?? (previewing ? 38 : 0)}
          hungry={hungry && Boolean(dog || previewing)}
          wantsWalk={wantsWalk && Boolean(dog || previewing)}
          muted={muted}
          empty={!dog && !previewing}
          busy={Boolean(overlay)}
          toasts={toasts}
          visitorWalking={visitorWalking}
          hint={hint}
          touch={touch}
          onMute={toggleMute}
          onPet={() => {
            send({ type: 'action', action: 'pet' });
            setReaction('pet');
            playDogSfx('bark', muted);
            window.setTimeout(() => setReaction('idle'), 900);
          }}
          onFeed={feedHim}
          onHall={() => setPanel('hall')}
          onCatch={() => start('catch')}
          onStick={setStick}
        />
      )}

      {!playing && (
        <div className="dog-start">
          <p className="dog-start-kicker">the porch</p>
          <p className="dog-start-title">{shownName}</p>
          <div className="dog-start-bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
          <button type="button" className="dog-start-play" disabled={!canTap && preview !== 'start'} onClick={() => setPlaying(true)}>
            {canTap ? 'Tap to play' : 'Loading…'}
          </button>
        </div>
      )}

      {play === 'feed' && (
        <Overlay title="Dinner" onClose={() => finish(0)}>
          <FeedGame onDone={(score) => finish(score)} drops={dog?.care.feedDrops} genome={dog?.genome} />
        </Overlay>
      )}
      {play === 'walk' && (
        <Overlay title="Around the block" onClose={() => finish(0)}>
          <WalkGame
            onDone={(score) => finish(score)}
            durationMs={dog?.care.walkGameMs}
            speed={dog?.care.walkSpeed}
            spawnMs={dog?.care.walkSpawnMs}
            rockChance={dog?.care.walkRockChance}
            caption={dog?.care.walkCaption}
            genome={dog?.genome}
          />
        </Overlay>
      )}
      {play === 'catch' && (
        <Overlay title="Catch a dog" onClose={() => finish(0)}>
          <CatchGame onDone={(score) => finish(score)} />
        </Overlay>
      )}
      {awaitingName && canName && (
        <Overlay title="Name him" onClose={() => setPanel(null)}>
          <NamePicker
            until={snapshot?.nameUntil ?? null}
            onPick={pickName}
            status={nameStatus}
            avoidIds={snapshot?.usedNameIds ?? []}
          />
        </Overlay>
      )}
      {panel === 'hall' && (
        <Overlay title="Hall of Dogs" wide onClose={() => setPanel(null)}>
          <HistoryBoard embedded />
        </Overlay>
      )}

      <p className="dog-credit">
        3D Shiba Inu and Husky by{' '}
        <a className="link-underline" href="https://quaternius.com/packs/ultimateanimatedanimals.html">
          Quaternius
        </a>
        , CC0.
      </p>
    </div>
  );
}

function Overlay({
  title,
  wide,
  onClose,
  children,
}: {
  title: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="dog-overlay">
      <div className={`dog-modal ${wide ? 'dog-modal-wide' : ''}`}>
        <div className="dog-modal-head">
          <h2>{title}</h2>
          <button type="button" className="dog-chip" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="dog-modal-body">{children}</div>
      </div>
    </div>
  );
}
