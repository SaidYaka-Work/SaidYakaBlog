'use client';

import Link from 'next/link';
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
  onMute,
  onPet,
  onFeed,
  onWalk,
  onHall,
  onCatch,
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
  onMute: () => void;
  onPet: () => void;
  onFeed: () => void;
  onWalk: () => void;
  onHall: () => void;
  onCatch: () => void;
}) {
  return (
    <div className="dog-hud">
      <Link href={englishPath('/')} className="dog-back">
        ← saidyaka.com
      </Link>

      <div className="dog-id">
        <strong>{name}</strong>
        <span>{stageLabel}</span>
      </div>

      <div className="dog-chips">
        <span className="dog-chip" title="Neighbors on the porch">
          👥 {presence}
        </span>
        <button type="button" className="dog-chip" onClick={onHall}>
          Hall
        </button>
        <button type="button" className="dog-chip" onClick={onMute} aria-pressed={muted} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      {!empty && (
        <div className="dog-meters" aria-hidden={false}>
          <Meter icon="♥" label="Happiness" value={happiness} />
          <Meter icon="🦴" label="Fullness" value={fullness} />
          <Meter icon="🐾" label="Energy" value={energy} />
        </div>
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
            <button type="button" className="dog-action" onClick={onFeed} disabled={busy}>
              Feed
            </button>
            <button type="button" className="dog-action" onClick={onWalk} disabled={busy}>
              Walk
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Meter({ icon, label, value }: { icon: string; label: string; value: number }) {
  const width = Math.max(6, Math.min(100, value));
  return (
    <div className="dog-meter" title={label} aria-label={label}>
      <span>{icon}</span>
      <b>
        <i style={{ width: `${width}%` }} />
      </b>
    </div>
  );
}
