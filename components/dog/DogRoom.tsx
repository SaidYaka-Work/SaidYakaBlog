'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  dogWorkerUrl,
  dogWsUrl,
  generateGenome,
  type DogCompanion,
  type DogEmote,
  type DogPose,
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
import { playDogSfx, warmDogAudio } from './dogSound';
import useDogDrive from './useDogDrive';
import { nearFeeder } from '../../workers/dog/src/room';
import { parseDebugSpawn, type DebugSpawn } from './debugSpawn';
import { ATTRIBUTION, HOME_PLACE, PLACES, formatPlaceLine, nearestPlace, placeById, sunDirection } from '../../workers/dog/src/world';
import type { WorldView } from './DogCanvas';
import type { WorldColliders } from './world/useWorldTiles';
import { emptyFootprintGrid } from '../../workers/dog/src/world';
import './dog.css';

const HistoryBoard = dynamic(() => import('./HistoryBoard'), { ssr: false });

const CLIENT_ID_RE = /^[a-f0-9-]{36}$/i;

function readStoredClientId() {
  try {
    const existing = sessionStorage.getItem('biscuit-client');
    if (existing && CLIENT_ID_RE.test(existing)) return existing;
    const next = crypto.randomUUID();
    sessionStorage.setItem('biscuit-client', next);
    return next;
  } catch {
    return null;
  }
}

type PlayKind = 'feed' | 'walk' | 'catch' | null;
type Reaction = 'idle' | 'pet' | 'walk' | 'feed' | 'sleep';
type Panel = 'hall' | 'feed' | 'walk' | 'catch' | 'name' | null;
type Preview = 'start' | 'hungry' | 'feed' | 'walk' | 'hall' | 'sleep' | 'eat' | 'sad' | 'pose-walk' | 'room' | 'leash' | 'world' | 'travel' | 'gate' | 'presence' | null;

const PREVIEW_VISITORS: DogCompanion[] = [
  { id: 'visit-a', x: 1.22, z: 0.92, yaw: -0.7, emote: 'wave' },
  { id: 'visit-b', x: -1.22, z: 0.78, yaw: 0.85, emote: null },
  { id: 'visit-c', x: 0.32, z: -1.28, yaw: 2.5, emote: 'heart' },
];

const ERRORS: Record<string, string> = {
  cooldown: 'Give him a moment.',
  rate_limited: 'The city is busy. Try again shortly.',
  asleep: 'He is asleep. Let him dream.',
  too_tired: 'He is too tired for that.',
  too_soon: 'Give him a moment.',
  gone: 'Nobody is on the rug right now.',
  too_far: 'Walk him to the bowl.',
  busy: 'A visitor already has the leash. You are in line.',
  home: 'A dog is already out in the city.',
  missed: 'The stray slipped past. Try again.',
  invalid: 'Pick a name from the list.',
  porch_busy: 'Too many neighbors nearby.',
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
  const [reach, setReach] = useState<'unknown' | 'up' | 'down'>(worker ? 'unknown' : 'down');
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
  const clientIdRef = useRef<string | null>(null);
  const [compactHud, setCompactHud] = useState(false);
  const gameRef = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState(true);
  const [nearBowl, setNearBowl] = useState(false);
  const [localPlaceId, setLocalPlaceId] = useState(HOME_PLACE.id);
  const [travelOpen, setTravelOpen] = useState(false);
  const [flight, setFlight] = useState(0);
  const [streetName, setStreetName] = useState('');
  const [lightOverride, setLightOverride] = useState<'day' | 'night' | null>(null);
  const [thoughtAnchor, setThoughtAnchor] = useState<{ x: number; y: number } | null>(null);
  const [localEmote, setLocalEmote] = useState<DogEmote | null>(null);
  const [selfHere, setSelfHere] = useState({ x: 0.95, z: -0.55 });
  const [debugSpawn, setDebugSpawn] = useState<DebugSpawn | null>(null);
  const [leashWaitMs, setLeashWaitMs] = useState(0);
  const [leashTaking, setLeashTaking] = useState(false);
  const colliders = useRef<WorldColliders>({
    buildings: [],
    roads: [],
    parks: [],
    buildingGrid: emptyFootprintGrid(),
    roadGrid: emptyFootprintGrid(),
    label: '',
  });
  const localPose = useRef<{ x: number; z: number } | null>(null);
  const poseRef = useRef<DogPose | null>(null);
  const lastHudAt = useRef(0);
  const lastSelfHud = useRef(0);
  const lastToast = useRef({ text: '', at: 0 });
  const lastIntent = useRef<'feed' | 'pet' | 'move' | 'other'>('other');
  const feedRef = useRef<() => void>(() => undefined);
  const socket = useRef<WebSocket | null>(null);
  const toastId = useRef(1);
  const lastMove = useRef(0);
  const lastHere = useRef(0);
  const inputRef = useRef({ ax: 0, az: 0, run: false });
  const youHoldRef = useRef(false);
  const spawnRef = useRef<DebugSpawn | null>(null);
  const mine = useRef({ x: 1.15, z: 0.85 });
  const wasNext = useRef(false);
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
      next === 'leash' ||
      next === 'world' ||
      next === 'travel' ||
      next === 'gate' ||
      next === 'presence'
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
      if (next === 'world' || next === 'travel' || next === 'leash') setReaction(next === 'leash' ? 'idle' : 'walk');
      if (next === 'room' || next === 'gate' || next === 'presence') setReaction('idle');
      if (next === 'travel') {
        setLocalPlaceId('shibuya');
        setFlight(1);
      }
      const place = params.get('place');
      if (place && placeById(place)) setLocalPlaceId(place);
    } else if (initialPanel === 'hall') {
      setPlaying(true);
      setPanel('hall');
    }
    const light = params.get('light');
    if (light === 'day' || light === 'night') setLightOverride(light);
    const place = params.get('place');
    if (place && placeById(place)) {
      setLocalPlaceId(place);
    }
    const spawn = parseDebugSpawn(window.location.search);
    if (spawn) {
      setDebugSpawn(spawn);
      setPlaying(true);
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
    const now = Date.now();
    if (text === lastToast.current.text && now - lastToast.current.at < 2200) return;
    lastToast.current = { text, at: now };
    const id = toastId.current++;
    setToasts((current) => [...current.slice(-2), { id, ...toastFromText(text) }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 2800);
  }, []);

  const apply = useCallback((data: DogSnapshot) => {
    if (data.pose) poseRef.current = data.pose;
    lastHudAt.current = Date.now();
    setSnapshot(data);
    setReach('up');
    setProgress((value) => Math.max(value, 78));
  }, []);

  useEffect(() => {
    if (!worker) {
      setReach('down');
      setProgress((value) => Math.max(value, 70));
      return;
    }
    let closed = false;
    let wsPause = 800;
    let statePause = 800;
    let stateTimer = 0;

    const pullState = async () => {
      try {
        const response = await fetch(`${worker}/state`);
        if (!response.ok) throw new Error('state');
        const data = (await response.json()) as DogSnapshot;
        if (closed) return;
        if (data?.type === 'state') apply(data);
        else throw new Error('state');
        statePause = 800;
      } catch {
        if (closed) return;
        setReach('down');
        stateTimer = window.setTimeout(pullState, statePause);
        statePause = Math.min(15_000, Math.round(statePause * 1.6));
      }
    };

    const open = () => {
      if (closed) return;
      void pullState();
      const storedId = clientIdRef.current || readStoredClientId();
      if (storedId) {
        clientIdRef.current = storedId;
        setClientId(storedId);
      }
      const ws = new WebSocket(dogWsUrl(storedId));
      socket.current = ws;
      ws.onopen = () => {
        if (closed || socket.current !== ws) {
          try {
            ws.close();
          } catch {
            // ignore
          }
          return;
        }
        wsPause = 800;
        setReach('up');
        const storedId = clientIdRef.current || readStoredClientId();
        if (storedId) {
          clientIdRef.current = storedId;
          setClientId(storedId);
        }
        ws.send(JSON.stringify(storedId ? { type: 'hello', clientId: storedId } : { type: 'hello' }));
      };
      ws.onmessage = (event) => {
        let message:
          | DogSnapshot
          | { type: 'play'; playId: string; game: PlayKind }
          | { type: 'error'; code: string; text?: string }
          | { type: 'event'; text: string }
          | { type: 'name-please'; until: number }
          | { type: 'welcome'; clientId: string }
          | { type: 'pose'; pose?: DogSnapshot['pose']; leash?: DogSnapshot['leash']; feeder?: DogSnapshot['feeder']; location?: DogSnapshot['location']; companions?: DogSnapshot['companions'] };
        try {
          message = JSON.parse(event.data) as typeof message;
        } catch {
          setReach('down');
          return;
        }
        if (message.type === 'welcome') {
          const kept = clientIdRef.current || readStoredClientId() || message.clientId;
          clientIdRef.current = kept;
          setClientId(kept);
          try {
            if (!sessionStorage.getItem('biscuit-client')) sessionStorage.setItem('biscuit-client', kept);
          } catch {
            // ignore
          }
        }
        if (message.type === 'pose') {
          const pose = message;
          setReach('up');
          setSnapshot((current) => {
            if (!current) return current;
            const next = {
              ...current,
              pose: pose.pose ?? current.pose,
              leash: pose.leash ?? current.leash,
              feeder: pose.feeder ?? current.feeder,
              location: pose.location ?? current.location,
              companions: pose.companions ?? current.companions,
            };
            if (next.pose) poseRef.current = next.pose;
            const leashChanged =
              next.leash?.holderId !== current.leash?.holderId ||
              next.leash?.nextId !== current.leash?.nextId ||
              (next.companions?.length ?? 0) !== (current.companions?.length ?? 0);
            const now = Date.now();
            if (!leashChanged && now - lastHudAt.current < 200) return current;
            lastHudAt.current = now;
            return next;
          });
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
          const wait = Number((message as { retryAfterMs?: number }).retryAfterMs) || 0;
          if ((message.code === 'cooldown' || message.code === 'busy') && wait > 0) {
            setLeashWaitMs(wait);
          }
          const text =
            message.code === 'too_soon' && lastIntent.current === 'feed'
              ? 'Biscuit is full.'
              : message.code === 'too_soon' && lastIntent.current === 'pet'
                ? 'Biscuit has had enough pets for now.'
                : message.code === 'cooldown'
                  ? `Give him a moment · ${Math.max(1, Math.ceil(wait / 1000))}s`
                  : message.text || ERRORS[message.code] || 'Not just now.';
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
      ws.onerror = () => {
        setReach('down');
      };
      ws.onclose = () => {
        if (socket.current !== ws) return;
        setReach('down');
        if (closed) return;
        window.setTimeout(open, wsPause);
        wsPause = Math.min(8_000, Math.round(wsPause * 1.6));
      };
    };
    const dropHold = () => {
      const live = socket.current;
      if (live?.readyState !== WebSocket.OPEN) return;
      try {
        live.send(JSON.stringify({ type: 'leave' }));
      } catch {
        // ignore
      }
      try {
        live.close();
      } catch {
        // ignore
      }
    };
    window.addEventListener('pagehide', dropHold);
    window.addEventListener('beforeunload', dropHold);
    open();
    return () => {
      window.removeEventListener('pagehide', dropHold);
      window.removeEventListener('beforeunload', dropHold);
      closed = true;
      window.clearTimeout(stateTimer);
      const ws = socket.current;
      socket.current = null;
      if (!ws) return;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'leave' }));
        } catch {
          // ignore
        }
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => {
          try {
            ws.onerror = null;
            ws.close();
          } catch {
            // ignore
          }
        };
      }
    };
  }, [apply, pushToast, worker]);

  function send(payload: object) {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify(payload));
    return true;
  }

  function start(game: Exclude<PlayKind, null>) {
    if (reach === 'down' || !worker) return;
    if (game === 'catch' && !snapshot?.awaitingCatch) return;
    if (game === 'catch' && reach !== 'up') return;
    send({ type: 'start', game });
  }

  function finish(score: number) {
    if (play === 'catch' && (reach !== 'up' || !snapshot?.awaitingCatch)) {
      setPlay(null);
      setPlayId(null);
      return;
    }
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
    if (reach !== 'up' || !snapshot?.awaitingName) return;
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

  const previewing = Boolean(preview) && preview !== 'start' && preview !== 'hall';
  const napping = !previewing && (!worker || reach === 'down');
  const serverUp = reach === 'up';
  const dog = snapshot?.dog ?? null;
  const awaitingName = Boolean(snapshot?.awaitingName);
  const awaitingCatch = Boolean(serverUp && snapshot?.awaitingCatch && !dog);
  const shownName = dog?.profile.name || (awaitingName ? 'A new dog' : snapshot?.memorial?.profile.name || 'Biscuit');
  const hungry = preview === 'hungry' || preview === 'eat' || Boolean(dog?.care.feedOverdue) || (dog?.care.hunger ?? 0) > 70;
  const wantsWalk = preview === 'hungry' || Boolean(dog?.care.walkOverdue) || (dog?.care.walkNeed ?? 0) > 70;
  const liveSleep = !previewing && Boolean(dog?.asleep);
  const poseAsleep = preview === 'sleep' || liveSleep;
  const poseReaction =
    preview === 'sleep'
      ? 'sleep'
      : preview === 'eat'
        ? 'feed'
        : preview === 'pose-walk'
          ? 'walk'
          : liveSleep
            ? 'sleep'
            : reaction;
  const poseSad = preview === 'sad' || (!previewing && (dog?.happiness ?? 100) < 40);
  const fallbackAsleep = preview === 'sleep' || preview === 'start' || !preview;
  const fallbackReaction: Reaction =
    preview === 'eat'
      ? 'feed'
      : preview === 'pose-walk' || preview === 'world' || preview === 'travel'
        ? 'walk'
        : preview === 'sleep'
          ? 'sleep'
          : 'idle';
  const worldNightHint =
    lightOverride === 'night' ? true : lightOverride === 'day' ? false : undefined;
  const overlay = play || (awaitingName && canName) || panel;
  const canTap = ready || progress >= 88 || napping;
  const shared = Boolean(snapshot?.pose);
  const youHold = Boolean(
    snapshot?.leash?.held &&
      snapshot.leash.holderId &&
      (snapshot.leash.holderId === clientId || snapshot.leash.holderId === clientIdRef.current),
  );
  youHoldRef.current = youHold;
  const leashQueue = snapshot?.leash?.queue ?? [];
  const nextId = snapshot?.leash?.nextId ?? leashQueue[0] ?? null;
  const youNext = preview === 'presence' || Boolean(nextId && clientId && nextId === clientId && !youHold);
  const queueAhead = youNext || !clientId ? 0 : Math.max(0, leashQueue.indexOf(clientId));
  const youId = preview === 'presence' ? 'you' : clientId;
  const selfGuest: DogCompanion = {
    id: youId || 'you',
    x: selfHere.x,
    z: selfHere.z,
    yaw: 0,
    emote: localEmote,
  };
  const guests =
    preview === 'presence'
      ? [...PREVIEW_VISITORS, selfGuest]
      : [...(snapshot?.companions ?? []).filter((guest) => guest.id !== clientId), ...(youId ? [selfGuest] : [])];
  const lookAt = snapshot?.pose ?? { x: 0, z: 0 };
  const visitorWalking = preview === 'leash' || Boolean(snapshot?.leash?.held && snapshot.leash.holderId && snapshot.leash.holderId !== clientId);
  const hideDrive = preview === 'eat' || preview === 'sleep' || preview === 'pose-walk';
  const inRange = preview === 'eat' || Boolean(snapshot?.feeder?.near) || nearBowl;
  const worldReady = Boolean(snapshot?.location) || previewing || !worker;
  const activePlace = placeById((previewing && localPlaceId) || snapshot?.location?.placeId || localPlaceId) ?? HOME_PLACE;
  const pillPlace = debugSpawn ? nearestPlace(debugSpawn.lat, debugSpawn.lng) : activePlace;
  const worldView: WorldView = {
    originLat: debugSpawn?.lat ?? (previewing ? activePlace.lat : snapshot?.location?.originLat ?? activePlace.lat),
    originLng: debugSpawn?.lng ?? (previewing ? activePlace.lng : snapshot?.location?.originLng ?? activePlace.lng),
    lat: debugSpawn?.lat ?? (previewing ? activePlace.lat : snapshot?.location?.lat ?? activePlace.lat),
    lng: debugSpawn?.lng ?? (previewing ? activePlace.lng : snapshot?.location?.lng ?? activePlace.lng),
    flight,
    nightHint: worldNightHint,
  };

  const goTravel = useCallback(
    (placeId: string) => {
      const place = placeById(placeId);
      if (snapshot?.location && !debugSpawn) send({ type: 'travel', placeId });
      else {
        setLocalPlaceId(placeId);
      }
      setTravelOpen(false);
      setFlight(1);
      if (place) pushToast(`Off to ${place.name}.`);
    },
    [debugSpawn, pushToast, snapshot?.location],
  );

  const onWorldColliders = useCallback((next: WorldColliders) => {
    colliders.current = next;
    setStreetName(next.label);
  }, []);

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
    lastIntent.current = 'feed';
    if (shared && (snapshot?.dog?.fullness ?? 0) >= 86) {
      pushToast('Biscuit is full.');
      return;
    }
    if (shared) {
      send({ type: 'bowl' });
      if ((snapshot?.dog?.fullness ?? 0) < 86) pushToast('Biscuit is eating.');
      return;
    }
    start('feed');
  }
  feedRef.current = feedHim;

  function takeLeash() {
    hideHint();
    lastIntent.current = 'move';
    if (leashWaitMs > 0) {
      pushToast(`Give him a moment · ${Math.max(1, Math.ceil(leashWaitMs / 1000))}s`);
      return;
    }
    if (youHoldRef.current) return;
    setLeashTaking(true);
    pushToast('Taking the leash…');
    window.setTimeout(() => setLeashTaking(false), 4000);
    if (!send({ type: 'move', ax: 0, az: 0.18, run: false })) {
      pushToast('Give him a moment · reconnecting');
    }
  }

  inputRef.current = input;
  spawnRef.current = debugSpawn;

  useEffect(() => {
    if (!playing || overlay || !shared) return;
    const tick = () => {
      const current = inputRef.current;
      const moving = Math.hypot(current.ax, current.az) > 0.12;
      const now = performance.now();
      if (moving) {
        if (now - lastMove.current < 80) return;
        lastIntent.current = 'move';
        const sent = send({
          type: 'move',
          ax: current.ax,
          az: current.az,
          run: current.run,
          ...(localPose.current && !spawnRef.current
            ? { wx: localPose.current.x, wz: localPose.current.z }
            : {}),
        });
        if (sent) lastMove.current = now;
      }
    };
    tick();
    const id = window.setInterval(tick, 80);
    return () => window.clearInterval(id);
  }, [overlay, playing, shared]);

  useEffect(() => {
    if (!playing || overlay || !shared || previewing || youHold) return;
    const moving = Math.hypot(input.ax, input.az) > 0.12;
    if (!moving) return;
    const now = performance.now();
    if (now - lastHere.current < 150) return;
    lastHere.current = now;
    mine.current = {
      x: mine.current.x + input.ax * 0.18,
      z: mine.current.z + input.az * 0.18,
    };
    if (now - lastSelfHud.current >= 200) {
      lastSelfHud.current = now;
      setSelfHere({ ...mine.current });
    }
    send({ type: 'here', x: mine.current.x, z: mine.current.z });
  }, [input, overlay, playing, previewing, shared, youHold]);

  useEffect(() => {
    if (youHold) setLeashTaking(false);
    if (wasNext.current && youHold) pushToast('The leash is yours.');
    wasNext.current = youNext;
  }, [pushToast, youHold, youNext]);

  useEffect(() => {
    if (previewRef.current) return;
    if (!snapshot?.location) return;
    setLocalPlaceId(snapshot.location.placeId);
  }, [snapshot?.location]);

  const flying = flight > 0;
  useEffect(() => {
    if (!flying) return;
    const hold = preview === 'travel' ? 1400 : 0;
    let tick: number | undefined;
    const start = window.setTimeout(() => {
      tick = window.setInterval(() => {
        setFlight((value) => (value < 0.04 ? 0 : value * 0.93));
      }, 50);
    }, hold);
    return () => {
      window.clearTimeout(start);
      if (tick) window.clearInterval(tick);
    };
  }, [flying, preview]);

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

  useEffect(() => {
    if (leashWaitMs <= 0) return;
    const id = window.setTimeout(() => setLeashWaitMs((ms) => Math.max(0, ms - 1000)), 1000);
    return () => window.clearTimeout(id);
  }, [leashWaitMs]);

  useEffect(() => {
    const id = readStoredClientId();
    if (!id) return;
    clientIdRef.current = id;
    setClientId(id);
  }, []);

  useEffect(() => {
    const node = gameRef.current;
    if (!node) return;
    const sync = () => {
      const visual = window.visualViewport?.width ?? Number.POSITIVE_INFINITY;
      setCompactHud(node.clientWidth <= 400 || window.innerWidth <= 400 || visual <= 400);
    };
    sync();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    ro?.observe(node);
    window.addEventListener('resize', sync);
    window.visualViewport?.addEventListener('resize', sync);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('resize', sync);
    };
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [playing]);

  const handlePose = useCallback(
    (pose: { x: number; z: number }) => {
      localPose.current = pose;
      const bowl = nearFeeder(pose.x, pose.z, snapshot?.feeder);
      setNearBowl((current) => (current === bowl ? current : bowl));
    },
    [snapshot?.feeder],
  );

  const drive = hideDrive
    ? null
    : {
        input,
        server: previewing || debugSpawn ? null : snapshot?.pose ?? null,
        serverRef: previewing || debugSpawn ? undefined : poseRef,
        youHold: previewing || youHold || Boolean(debugSpawn),
        localOnly: previewing || !shared || Boolean(debugSpawn),
        realm: 'world' as const,
        originKey: `${activePlace.id}:${worldView.originLat},${worldView.originLng}`,
        buildings: colliders.current.buildingGrid,
        roads: colliders.current.roadGrid,
        parks: colliders.current.parks,
        onPose: handlePose,
      };

  if (studio) return <DogStudio />;

  return (
    <div ref={gameRef} className={`dog-game${compactHud ? ' is-compact' : ''}`}>
      {dog ? (
        <DogPortrait
          genome={dog.genome}
          asleep={poseAsleep}
          reaction={poseReaction}
          night={worldNightHint ?? sunDirection(worldView.lat, worldView.lng, Date.now()).night}
          stage={dog.stage}
          happiness={dog.happiness}
          hungry={hungry}
          sad={poseSad}
          interactive
          fill
          food={Boolean(snapshot?.feeder?.hasFood || snapshot?.feeder?.eating)}
          near={inRange}
          bowl={snapshot?.feeder && Number.isFinite(snapshot.feeder.x) ? { x: snapshot.feeder.x!, z: snapshot.feeder.z! } : { x: 1.15, z: 0.55 }}
          world={worldView}
          drive={drive}
          onWorldColliders={onWorldColliders}
          onReady={() => setReady(true)}
          onAnchor={setThoughtAnchor}
          companions={guests}
          youId={youId}
          lookAt={lookAt}
        />
      ) : (
        <DogPortrait
          genome={generateGenome(previewing ? 'biscuit-porch-1' : 'napping-biscuit')}
          asleep={fallbackAsleep}
          reaction={fallbackReaction}
          night={worldNightHint ?? sunDirection(worldView.lat, worldView.lng, Date.now()).night}
          stage="puppy"
          happiness={72}
          hungry={hungry}
          sad={preview === 'sad'}
          interactive={previewing}
          fill
          empty={!napping && !previewing && awaitingCatch}
          food={preview === 'eat'}
          near={inRange}
          bowl={{ x: 1.15, z: 0.55 }}
          world={worldView}
          drive={previewing ? drive : null}
          onWorldColliders={onWorldColliders}
          onReady={() => setReady(true)}
          onAnchor={setThoughtAnchor}
          companions={guests}
          youId={youId}
          lookAt={lookAt}
        />
      )}

      {playing && (
        <DogHud
          compact={compactHud}
          name={shownName}
          stageLabel={dog?.stageLabel || (awaitingName ? 'new' : napping ? 'napping' : 'away')}
          presence={preview === 'presence' ? 4 : snapshot?.presence ?? 0}
          happiness={dog?.happiness ?? (previewing ? 72 : 0)}
          energy={dog?.energy ?? (previewing ? 64 : 0)}
          fullness={dog?.fullness ?? (previewing ? 38 : 0)}
          hungry={hungry && Boolean(dog || previewing)}
          wantsWalk={wantsWalk && Boolean(dog || previewing)}
          muted={muted}
          empty={awaitingCatch && !previewing}
          busy={Boolean(overlay) || napping}
          toasts={toasts}
          visitorWalking={visitorWalking}
          hint={hint}
          touch={touch}
          near={inRange}
          placeName={`${pillPlace.name}, ${pillPlace.city}`}
          streetName={streetName}
          worldReady={worldReady}
          travelOpen={travelOpen}
          places={PLACES.map((place) => ({ id: place.id, name: place.name, city: place.city }))}
          attribution={ATTRIBUTION}
          onMute={toggleMute}
          onPet={() => {
            lastIntent.current = 'pet';
            send({ type: 'action', action: 'pet' });
            setReaction('pet');
            playDogSfx('bark', muted);
            pushToast('Biscuit leans into the scratch.');
            window.setTimeout(() => setReaction('idle'), 900);
          }}
          leashWaitMs={leashWaitMs}
          leashTaking={leashTaking}
          onFeed={feedHim}
          onHall={() => setPanel('hall')}
          onCatch={() => {
            if (napping || !awaitingCatch) return;
            start('catch');
          }}
          onStick={setStick}
          onTravel={goTravel}
          onToggleTravel={() => setTravelOpen((open) => !open)}
          thoughtAnchor={thoughtAnchor}
          onEmote={(kind: DogEmote) => {
            setLocalEmote(kind);
            window.setTimeout(() => setLocalEmote((current) => (current === kind ? null : current)), 2800);
            if (preview === 'presence') {
              pushToast({ wave: '👋 waved', heart: '❤️ heart', sit: '🐾 sat nearby', treat: '🦴 treat', clap: '👏 clap' }[kind]);
              return;
            }
            send({ type: 'emote', kind });
          }}
          youNext={youNext}
          queueAhead={queueAhead}
          neighborCount={guests.length + (clientId ? 1 : 0)}
          youHold={youHold}
          flying={flying}
          onTakeLeash={takeLeash}
        />
      )}

      {!playing && (
        <div className="dog-start">
          <p className="dog-start-kicker">
            {formatPlaceLine(
              streetName,
              snapshot?.location
                ? nearestPlace(snapshot.location.lat, snapshot.location.lng).name
                : activePlace.name,
            )}
          </p>
          <p className="dog-start-title">{shownName}</p>
          <div className="dog-start-bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
          <button type="button" className="dog-start-play" disabled={!canTap && preview !== 'start'} onClick={() => {
            warmDogAudio();
            setPlaying(true);
          }}>
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
      {play === 'catch' && !napping && awaitingCatch && (
        <Overlay title="Catch a dog" onClose={() => finish(0)}>
          <CatchGame onDone={(score) => finish(score)} />
        </Overlay>
      )}
      {napping && playing && (
        <div className="dog-overlay dog-nap" role="status">
          <div className="dog-modal">
            <div className="dog-modal-head">
              <h2>Biscuit is napping</h2>
            </div>
            <div className="dog-modal-body">
              <p>out in the city · back soon</p>
            </div>
          </div>
        </div>
      )}
      {awaitingName && canName && !napping && (
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
