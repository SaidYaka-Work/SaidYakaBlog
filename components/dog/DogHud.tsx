'use client';

import Link from 'next/link';
import { useRef, type CSSProperties, type PointerEvent } from 'react';
import { englishPath } from '@/lib/site';
import type { DogEmote } from '@/lib/dog';
import { EMOTE_SET } from './emotes';
import { formatPlaceLine } from '../../workers/dog/src/world';

export type Toast = { id: number; emote: string; text: string };

export default function DogHud({
  name,
  stageLabel,
  presence,
  happiness,
  energy,
  fullness,
  hungry,
  wantsWalk,
  muted,
  empty,
  busy,
  toasts,
  visitorWalking,
  hint,
  touch,
  near,
  placeName,
  streetName,
  worldReady,
  travelOpen,
  places,
  attribution,
  onMute,
  onPet,
  onFeed,
  onHall,
  onCatch,
  onStick,
  onTravel,
  onToggleTravel,
  thoughtAnchor = null,
  onEmote,
  youNext = false,
  queueAhead = 0,
  neighborCount = 0,
  youHold = false,
  wantLeash = false,
  flying = false,
  leashWaitMs = 0,
  leashTaking = false,
  onTakeLeash,
  compact = false,
}: {
  name: string;
  stageLabel: string;
  presence: number;
  happiness: number;
  energy: number;
  fullness: number;
  hungry: boolean;
  wantsWalk: boolean;
  muted: boolean;
  empty: boolean;
  busy: boolean;
  toasts: Toast[];
  visitorWalking?: boolean;
  hint?: boolean;
  touch?: boolean;
  near?: boolean;
  placeName?: string;
  streetName?: string;
  worldReady?: boolean;
  travelOpen?: boolean;
  places?: { id: string; name: string; city: string }[];
  attribution?: string;
  onMute: () => void;
  onPet: () => void;
  onFeed: () => void;
  onHall: () => void;
  onCatch: () => void;
  onStick?: (ax: number, az: number) => void;
  onTravel?: (placeId: string) => void;
  onToggleTravel?: () => void;
  thoughtAnchor?: { x: number; y: number } | null;
  onEmote?: (kind: DogEmote) => void;
  youNext?: boolean;
  queueAhead?: number;
  neighborCount?: number;
  youHold?: boolean;
  wantLeash?: boolean;
  flying?: boolean;
  leashWaitMs?: number;
  leashTaking?: boolean;
  onTakeLeash?: () => void;
  compact?: boolean;
}) {
  const leashPill =
    !empty && !flying ? (
      <p className={`dog-leash${youHold || youNext || wantLeash ? ' is-next' : ''}`} role="status">
        {youHold
          ? 'You have the leash'
          : wantLeash
            ? 'Waiting for the leash'
            : leashTaking
            ? 'Taking the leash…'
            : leashWaitMs > 0
              ? `Give him a moment · ${Math.max(1, Math.ceil(leashWaitMs / 1000))}s`
              : youNext
                ? "You're next · ~20s"
                : queueAhead > 0
                  ? `You're ${ordinal(queueAhead + 1)} · ~${(queueAhead + 1) * 20}s`
                  : visitorWalking
                    ? `A visitor is walking ${name}`
                    : `${name} is waiting`}
        {!youHold && onTakeLeash && (
          <button type="button" className="dog-leash-take" onClick={onTakeLeash} disabled={leashWaitMs > 0 || leashTaking}>
            {leashTaking
              ? 'Taking…'
              : leashWaitMs > 0
                ? `Wait ${Math.max(1, Math.ceil(leashWaitMs / 1000))}s`
                : youNext || queueAhead > 0 || visitorWalking
                  ? 'Join queue'
                  : 'Take the leash'}
          </button>
        )}
      </p>
    ) : flying ? (
      <p className="dog-leash" role="status">
        Landing…
      </p>
    ) : null;

  return (
    <div className={`dog-hud ${touch ? 'is-touch' : ''}`}>
      <Link href={englishPath('/')} className="dog-back">
        ← saidyaka.com
      </Link>

      <div className="dog-left">
        <div className="dog-id">
          <strong>{name}</strong>
          <span>{stageLabel}</span>
        </div>
        {!empty && (
          <div className="dog-meters">
            <Meter icon="♥" label="Happiness" value={happiness} />
            <Meter icon="🦴" label="Fullness" value={fullness} />
            <Meter icon="🐾" label="Energy" value={energy} />
          </div>
        )}
        {compact ? leashPill : null}
      </div>

      <div className="dog-chips">
        <span className="dog-chip" title="Neighbors nearby">
          👥 {Math.max(presence, neighborCount)}
        </span>
        {!empty && onTakeLeash && (
          <button
            type="button"
            className={`dog-chip${youHold || youNext || wantLeash ? ' is-leash' : ''}`}
            onClick={onTakeLeash}
            aria-pressed={youHold}
          >
            {youHold
              ? 'Leash yours'
              : wantLeash
                ? 'Waiting for leash'
                : leashTaking
                ? 'Taking the leash…'
                : leashWaitMs > 0
                  ? `Wait ${Math.max(1, Math.ceil(leashWaitMs / 1000))}s`
                  : youNext
                    ? "You're next"
                    : queueAhead > 0
                      ? `You're ${ordinal(queueAhead + 1)}`
                      : visitorWalking
                        ? 'Join queue'
                        : 'Take the leash'}
          </button>
        )}
        {worldReady && (
          <button type="button" className="dog-chip" onClick={onToggleTravel} aria-expanded={travelOpen}>
            Travel
          </button>
        )}
        <button type="button" className="dog-chip" onClick={onHall}>
          Hall
        </button>
        <button type="button" className="dog-chip" onClick={onMute} aria-pressed={muted} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      {compact ? null : leashPill}
      {onEmote && !empty && (
        <div className="dog-emotes" role="group" aria-label="Emotes">
          {EMOTE_SET.map((item) => (
            <button key={item.kind} type="button" onClick={() => onEmote(item.kind)} aria-label={item.kind}>
              {item.label}
            </button>
          ))}
        </div>
      )}

      {(hungry || wantsWalk) && !empty && (
        <div
          className={`dog-thought${thoughtAnchor ? ' is-anchored' : ''}`}
          role="status"
          style={
            thoughtAnchor
              ? ({
                  '--thought-x': `${thoughtAnchor.x * 100}%`,
                  '--thought-y': `${thoughtAnchor.y * 100}%`,
                } as CSSProperties)
              : undefined
          }
        >
          {hungry && <span>hungry</span>}
          {wantsWalk && <span>wants a walk</span>}
        </div>
      )}

      <div className="dog-toasts" aria-live="polite">
        {toasts.map((toast) => (
          <p key={toast.id} className="dog-toast">
            <span>{toast.emote}</span>
            {toast.text}
          </p>
        ))}
      </div>

      {(placeName || streetName) && (
        <p className="dog-place" role="status">
          <span aria-hidden="true">N</span>
          {formatPlaceLine(streetName, placeName)}
        </p>
      )}

      {travelOpen && places && (
        <div className="dog-travel" role="listbox" aria-label="Travel">
          {places.map((place) => (
            <button key={place.id} type="button" onClick={() => onTravel?.(place.id)}>
              <strong>{place.name}</strong>
              <em>{place.city}</em>
            </button>
          ))}
        </div>
      )}

      {hint && !empty && !near && (
        <p className="dog-hint">{touch ? 'Drag to walk · Feed at the bowl' : 'WASD to walk · Travel to a park'}</p>
      )}

      {attribution && <p className="dog-attrib">{attribution}</p>}

      {near && !empty && (
        <p className="dog-prompt" role="status">
          {touch ? 'Feed' : 'E · Feed'}
        </p>
      )}

      {!empty && onStick && <Joystick onStick={onStick} />}

      <div className="dog-actions">
        {empty ? (
          <button type="button" className="dog-action is-primary" onClick={onCatch} disabled={busy}>
            Catch
          </button>
        ) : (
          <>
            <button type="button" className="dog-action is-primary" onClick={onPet} disabled={busy}>
              Pet
            </button>
            <button type="button" className={`dog-action${near ? ' is-ready' : ''}`} onClick={onFeed} disabled={busy}>
              Feed
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ordinal(n: number) {
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function Meter({ icon, label, value }: { icon: string; label: string; value: number }) {
  const width = Math.max(6, Math.min(100, value));
  return (
    <div className="dog-meter" title={label} aria-label={`${label} ${Math.round(value)}`}>
      <span aria-hidden="true">{icon}</span>
      <div>
        <em>{label}</em>
        <b>
          <i style={{ width: `${width}%` }} />
        </b>
      </div>
    </div>
  );
}

function Joystick({ onStick }: { onStick: (ax: number, az: number) => void }) {
  const pad = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const pointer = useRef<number | null>(null);

  function point(event: PointerEvent<HTMLDivElement>) {
    const node = pad.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const max = box.width * 0.36;
    const mag = Math.hypot(dx, dy);
    const scale = mag > max ? max / mag : 1;
    const nx = (dx * scale) / max;
    const ny = (dy * scale) / max;
    const raw = Math.hypot(nx, ny);
    const dead = 0.08;
    let ax = 0;
    let az = 0;
    if (raw > dead) {
      const t = (raw - dead) / (1 - dead);
      const eased = t * t * (3 - 2 * t);
      ax = (nx / raw) * eased;
      az = (ny / raw) * eased;
    }
    if (knob.current) {
      knob.current.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    }
    onStick(ax, az);
  }

  return (
    <div
      ref={pad}
      className="dog-stick"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        point(event);
      }}
      onPointerMove={(event) => {
        if (pointer.current !== event.pointerId) return;
        event.preventDefault();
        point(event);
      }}
      onPointerUp={(event) => {
        pointer.current = null;
        if (knob.current) knob.current.style.transform = 'translate(0, 0)';
        onStick(0, 0);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        pointer.current = null;
        if (knob.current) knob.current.style.transform = 'translate(0, 0)';
        onStick(0, 0);
      }}
    >
      <span ref={knob} className="dog-stick-knob" />
    </div>
  );
}
