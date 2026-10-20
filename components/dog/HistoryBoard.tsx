'use client';

import { useEffect, useState } from 'react';
import { dogWorkerUrl, stageWord, type HistoryPage, type Memorial } from '@/lib/dog';
import DogPortrait from './DogPortrait';
import './dog.css';

export default function HistoryBoard({ embedded = false }: { embedded?: boolean }) {
  const [page, setPage] = useState<HistoryPage | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const origin = dogWorkerUrl();
    if (!origin) {
      setError(true);
      return;
    }
    fetch(`${origin}/history?limit=24`, { headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error('bad');
        return response.json();
      })
      .then(setPage)
      .catch(() => setError(true));
  }, []);

  if (error || !dogWorkerUrl()) {
    return (
      <p className={embedded ? 'text-[var(--muted)]' : 'mt-10 text-[var(--muted)]'}>
        The kennel log is napping with the dog. History will show up once the Worker is connected.
      </p>
    );
  }

  if (!page) {
    return <p className={embedded ? 'text-[var(--muted)]' : 'mt-10 text-[var(--muted)]'}>Opening the kennel book…</p>;
  }

  return (
    <div className={embedded ? '' : 'mt-10'}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Leader label="Longest lived" record={page.leaders.longestLived} detail={(dog) => `${dog.daysSurvived} days`} />
        <Leader label="Most walked" record={page.leaders.mostWalked} detail={(dog) => `${dog.totals.miles} miles`} />
        <Leader label="Most petted" record={page.leaders.mostPets} detail={(dog) => `${dog.totals.pets} pets`} />
      </div>
      {page.dogs.length === 0 ? (
        <p className="mt-10 text-[var(--muted)]">No one has left the porch yet. The first dog is still home.</p>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {page.dogs.map((dog) => (
            <li key={dog.id} className="overflow-hidden rounded-[1.4rem] border border-[var(--line)] bg-[var(--bg-elevated)]">
              <DogPortrait
                genome={dog.genome}
                asleep={false}
                reaction="idle"
                night={false}
                stage={dog.furthestStage}
                compact
              />
              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{dog.furthestStage}</p>
                <h2 className="mt-2 font-serif text-3xl">{dog.profile.name}</h2>
                {dog.namedByCatcher && <p className="mt-1 text-xs text-[var(--faint)]">Named by the catcher</p>}
                <p className="mt-2 text-sm text-[var(--muted)]">{dog.profile.personality}</p>
                <p className="mt-3 text-sm">
                  Reached {stageWord(dog.furthestStage)} · {dog.daysSurvived} days · {dog.departed === 'ran_away' ? 'ran away' : 'still remembered'}
                </p>
                <p className="mt-1 text-sm text-[var(--faint)]">
                  {dog.totals.feeds} meals · {dog.totals.walks} walks · {dog.totals.miles} miles · peak {dog.peakHappiness}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Leader({
  label,
  record,
  detail,
}: {
  label: string;
  record: Memorial | null;
  detail: (dog: Memorial) => string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] px-4 py-3">
      <span className="block text-xs uppercase tracking-[0.12em] text-[var(--faint)]">{label}</span>
      <strong className="mt-1 block font-normal">{record ? `${record.profile.name} · ${detail(record)}` : '—'}</strong>
    </div>
  );
}
