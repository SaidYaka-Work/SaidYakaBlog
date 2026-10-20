'use client';

import { generateGenome, type LifeStage } from '@/lib/dog';
import DogPortrait from './DogPortrait';
import './dog.css';

const SEEDS = [
  'biscuit-porch-1',
  'porch-seed-1',
  'porch-seed-2',
  'maple-lane',
  'rain-rug',
  'cream-gate',
  'brindle-stoop',
  'merle-yard',
];
const STAGES: LifeStage[] = ['puppy', 'young', 'adult', 'senior'];

export default function DogStudio() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-10">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Studio</p>
      <h1 className="mt-2 font-serif text-4xl">Lookbook</h1>
      <p className="mt-3 max-w-xl text-sm text-[var(--muted)]">
        Local preview of genomes and life stages on the Quaternius CC0 Shiba/Husky rig. Not linked from the porch.
      </p>
      {SEEDS.map((seed) => (
        <div key={seed} className="mt-10">
          <h2 className="font-serif text-2xl">{seed}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map((stage) => (
              <figure key={stage} className="overflow-hidden rounded-[1.4rem] border border-[var(--line)]">
                <DogPortrait genome={generateGenome(seed)} asleep={false} reaction="idle" night={false} stage={stage} compact />
                <figcaption className="px-3 py-2 text-xs uppercase tracking-[0.14em] text-[var(--faint)]">{stage}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ))}
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        <figure className="overflow-hidden rounded-[1.4rem] border border-[var(--line)]">
          <DogPortrait genome={generateGenome('biscuit-porch-1')} asleep reaction="sleep" night={false} stage="adult" />
          <figcaption className="px-3 py-2 text-sm">Sleeping</figcaption>
        </figure>
        <figure className="overflow-hidden rounded-[1.4rem] border border-[var(--line)]">
          <DogPortrait genome={generateGenome('biscuit-porch-1')} asleep={false} reaction="pet" night={false} stage="adult" happiness={92} />
          <figcaption className="px-3 py-2 text-sm">Petting</figcaption>
        </figure>
        <figure className="overflow-hidden rounded-[1.4rem] border border-[var(--line)]">
          <DogPortrait genome={generateGenome('biscuit-porch-1')} asleep={false} reaction="idle" night={false} stage="adult" sad happiness={18} />
          <figcaption className="px-3 py-2 text-sm">Sad</figcaption>
        </figure>
        <figure className="overflow-hidden rounded-[1.4rem] border border-[var(--line)]">
          <DogPortrait genome={generateGenome('biscuit-porch-1')} asleep={false} reaction="walk" night={false} stage="adult" happiness={80} />
          <figcaption className="px-3 py-2 text-sm">Walking</figcaption>
        </figure>
        <figure className="overflow-hidden rounded-[1.4rem] border border-[var(--line)]">
          <DogPortrait genome={generateGenome('biscuit-porch-1')} asleep={false} reaction="feed" night={false} stage="adult" hungry />
          <figcaption className="px-3 py-2 text-sm">Eating</figcaption>
        </figure>
      </div>
    </section>
  );
}
