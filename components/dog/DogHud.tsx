'use client';

import Link from 'next/link';
import { useRef, type PointerEvent } from 'react';
import { englishPath } from '@/lib/site';

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
  inWorld,
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
  onHome,
  onTravel,
  onToggleTravel,
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
  inWorld?: boolean;
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
  onHome?: () => void;
  onTravel?: (placeId: string) => void;
  onToggleTravel?: () => void;
}) {
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
      </div>

      <div className="dog-chips">
        <span className="dog-chip" title="Neighbors on the porch">
          👥 {presence}
        </span>
        {worldReady && inWorld && (
          <button type="button" className="dog-chip" onClick={onHome}>
            Home
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

      {visitorWalking && (
        <p className="dog-leash" role="status">
          🐾 a visitor is walking {name}
        </p>
      )}

      {(hungry || wantsWalk) && !empty && (
        <div className="dog-thought" role="status">
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

      {inWorld && (placeName || streetName) && (
        <p className="dog-place" role="status">
          <span aria-hidden="true">N</span>
          {streetCaption(streetName, placeName)}
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

      {hint && !empty && !near && !inWorld && (
        <p className="dog-hint">{touch ? 'Joystick to walk · Feed at the bowl' : 'WASD to walk · through the gate for the world'}</p>
      )}
      {hint && !empty && inWorld && (
        <p className="dog-hint">{touch ? 'Joystick to walk · Home to return' : 'WASD to walk · Home or Travel'}</p>
      )}

      {attribution && inWorld && <p className="dog-attrib">{attribution}</p>}

      {near && !empty && (
        <p className="dog-prompt" role="status">
          {touch ? 'Feed' : 'E · Feed'}
        </p>
      )}

      {touch && !empty && onStick && <Joystick onStick={onStick} />}

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

function streetCaption(streetName?: string, placeName?: string) {
  if (!streetName) return placeName;
  if (streetName.length > 32 || /subway|interchange|transfer|entrance|underground/i.test(streetName)) {
    return placeName || streetName;
  }
  return streetName;
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
    const x = (dx * scale) / max;
    const y = (dy * scale) / max;
    if (knob.current) {
      knob.current.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    }
    onStick(x, y);
  }

  return (
    <div
      ref={pad}
      className="dog-stick"
      onPointerDown={(event) => {
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        point(event);
      }}
      onPointerMove={(event) => {
        if (pointer.current !== event.pointerId) return;
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
