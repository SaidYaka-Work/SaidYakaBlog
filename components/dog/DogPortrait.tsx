import type { DogCoat, LifeStage } from '@/lib/dog';

const COATS: Record<DogCoat, { body: string; ear: string; spot: string }> = {
  cream: { body: '#f0d8c8', ear: '#b4532a', spot: '#e8a87c' },
  ink: { body: '#2a2420', ear: '#16120f', spot: '#6d675e' },
  copper: { body: '#c46a3a', ear: '#7a3418', spot: '#e8a87c' },
  smoke: { body: '#8a8378', ear: '#4a453f', spot: '#c4b8a8' },
  tan: { body: '#d4a574', ear: '#8a5a32', spot: '#f0d8c8' },
  chestnut: { body: '#7a4630', ear: '#3d2218', spot: '#c48a64' },
};

export default function DogPortrait({
  coat,
  asleep,
  reaction,
  night,
  stage = 'adult',
}: {
  coat: DogCoat;
  asleep: boolean;
  reaction: 'idle' | 'pet' | 'walk' | 'feed' | 'sleep';
  night: boolean;
  stage?: LifeStage;
}) {
  const palette = COATS[coat];
  return (
    <div
      className={`biscuit-scene is-${stage} ${night ? 'is-night' : ''} is-${reaction} ${asleep ? 'is-asleep' : ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 320 220" className="h-auto w-full">
        <ellipse cx="160" cy="196" rx="78" ry="10" fill="currentColor" opacity="0.08" />
        <g className={`biscuit-body is-${stage}`}>
          <ellipse cx="214" cy="132" rx="18" ry="10" className="biscuit-tail" fill={palette.ear} />
          <ellipse cx="156" cy="136" rx="62" ry="38" fill={palette.body} />
          <ellipse cx="124" cy="108" rx="36" ry="32" fill={palette.body} />
          <path d="M96 86c-8-22 10-30 22-16" fill={palette.ear} />
          <path d="M148 82c8-24 26-18 18 8" fill={palette.ear} />
          <circle cx="112" cy="104" r="3.2" fill={asleep ? palette.body : '#16120f'} />
          <circle cx="134" cy="104" r="3.2" fill={asleep ? palette.body : '#16120f'} />
          {asleep && (
            <>
              <path d="M106 104h12" stroke="#16120f" strokeWidth="2" />
              <path d="M128 104h12" stroke="#16120f" strokeWidth="2" />
            </>
          )}
          <ellipse cx="123" cy="116" rx="5" ry="3.4" fill="#16120f" />
          <path d="M118 122c4 5 10 5 14 0" fill="none" stroke="#16120f" strokeWidth="1.6" />
          <ellipse cx="138" cy="148" rx="8" ry="12" fill={palette.spot} />
          <ellipse cx="174" cy="150" rx="8" ry="12" fill={palette.spot} />
        </g>
      </svg>
      {reaction === 'pet' && <span className="biscuit-hearts">♥ ♥</span>}
      {asleep && <span className="biscuit-zzz">zzz</span>}
    </div>
  );
}
