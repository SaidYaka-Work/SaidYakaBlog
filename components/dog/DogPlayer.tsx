'use client';

import dynamic from 'next/dynamic';
import './dog.css';

const DogRoom = dynamic(() => import('./DogRoom'), {
  ssr: false,
  loading: () => (
    <div className="dog-game">
      <div className="biscuit-poster dog-start-poster" />
      <div className="dog-start">
        <p className="dog-start-kicker">Washington Square Park</p>
        <p className="dog-start-title">Biscuit</p>
        <div className="dog-start-bar" aria-hidden="true">
          <i style={{ width: '18%' }} />
        </div>
        <p className="dog-start-kicker">Loading…</p>
      </div>
    </div>
  ),
});

export default function DogPlayer({ initialPanel }: { initialPanel?: 'hall' | null }) {
  return <DogRoom initialPanel={initialPanel ?? null} />;
}
