import { generateGenome, lookFromGenome, type DogGenome, type LifeStage } from '@/lib/dog';

export default function DogPortrait({
  genome,
  asleep,
  reaction,
  night,
  stage = 'adult',
}: {
  genome?: DogGenome | null;
  asleep: boolean;
  reaction: 'idle' | 'pet' | 'walk' | 'feed' | 'sleep';
  night: boolean;
  stage?: LifeStage;
}) {
  const look = lookFromGenome(genome ?? generateGenome('napping-biscuit'), stage);
  const genes = genome ?? generateGenome('napping-biscuit');
  const eye = asleep ? genes.body : genes.eye;
  return (
    <div
      className={`biscuit-scene is-${stage} is-${genes.build} ${night ? 'is-night' : ''} is-${reaction} ${asleep ? 'is-asleep' : ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 320 220" className="h-auto w-full">
        <ellipse cx="160" cy="196" rx="78" ry="10" fill="currentColor" opacity="0.08" />
        <g className={`biscuit-body is-${stage}`} style={{ transform: `scale(${look.scale})`, transformOrigin: '160px 160px' }}>
          <Tail genome={genes} />
          <ellipse cx="158" cy="138" rx={look.bodyRx} ry={look.bodyRy} fill={genes.body} />
          {genes.pattern === 'saddle' && (
            <ellipse cx="172" cy="132" rx="34" ry="22" fill={genes.spot} opacity="0.7" />
          )}
          {genes.pattern === 'patches' && (
            <>
              <ellipse cx="138" cy="128" rx="16" ry="12" fill={genes.spot} />
              <ellipse cx="188" cy="146" rx="14" ry="10" fill={genes.spot} />
            </>
          )}
          <ellipse cx="156" cy="154" rx="28" ry="14" fill={genes.belly} opacity="0.85" />
          <ellipse cx="122" cy="108" rx={look.headRx} ry={look.headRy} fill={genes.body} />
          {genes.pattern === 'mask' && (
            <ellipse cx="122" cy="104" rx={look.headRx - 6} ry={look.headRy - 8} fill={genes.ear} opacity="0.55" />
          )}
          <Ears genome={genes} />
          <circle cx="110" cy="102" r="3.2" fill={eye} />
          <circle cx="132" cy="102" r="3.2" fill={eye} />
          {asleep && (
            <>
              <path d="M104 102h12" stroke="#16120f" strokeWidth="2" />
              <path d="M126 102h12" stroke="#16120f" strokeWidth="2" />
            </>
          )}
          {genes.marking === 'brow' && (
            <>
              <ellipse cx="110" cy="94" rx="4" ry="2" fill={genes.spot} />
              <ellipse cx="132" cy="94" rx="4" ry="2" fill={genes.spot} />
            </>
          )}
          {genes.marking === 'blaze' && <path d="M122 88c2 10 2 22 0 30" stroke={genes.belly} strokeWidth="5" fill="none" />}
          <ellipse cx="122" cy={116} rx={look.muzzle} ry="3.4" fill={genes.nose} />
          <path d="M116 122c6 6 12 6 16 0" fill="none" stroke="#16120f" strokeWidth="1.6" />
          {genes.pattern === 'spots' && (
            <>
              <circle cx="148" cy="146" r="5" fill={genes.spot} />
              <circle cx="176" cy="138" r="4" fill={genes.spot} />
              <circle cx="164" cy="158" r="3.5" fill={genes.spot} />
            </>
          )}
          {genes.marking === 'socks' && (
            <>
              <ellipse cx="138" cy="168" rx="8" ry="7" fill={genes.belly} />
              <ellipse cx="174" cy="170" rx="8" ry="7" fill={genes.belly} />
            </>
          )}
          {genes.marking === 'bib' && <ellipse cx="128" cy="128" rx="12" ry="10" fill={genes.belly} />}
          <Accessory genome={genes} />
        </g>
      </svg>
      {reaction === 'pet' && <span className="biscuit-hearts">♥ ♥</span>}
      {asleep && <span className="biscuit-zzz">zzz</span>}
    </div>
  );
}

function Ears({ genome }: { genome: DogGenome }) {
  if (genome.earShape === 'prick') {
    return (
      <>
        <path d="M96 86c-4-24 14-30 22-10" fill={genome.ear} />
        <path d="M148 82c8-26 24-16 16 10" fill={genome.ear} />
      </>
    );
  }
  if (genome.earShape === 'rose') {
    return (
      <>
        <path d="M96 92c-10-8 2-18 12-8" fill={genome.ear} />
        <path d="M146 88c10-10 18-2 8 10" fill={genome.ear} />
      </>
    );
  }
  if (genome.earShape === 'button') {
    return (
      <>
        <ellipse cx="100" cy="92" rx="8" ry="7" fill={genome.ear} />
        <ellipse cx="146" cy="90" rx="8" ry="7" fill={genome.ear} />
      </>
    );
  }
  const drop = 10 + genome.earFloppy * 16;
  return (
    <>
      <ellipse cx="98" cy={92 + drop / 4} rx="9" ry={10 + drop / 3} fill={genome.ear} />
      <ellipse cx="148" cy={90 + drop / 4} rx="9" ry={10 + drop / 3} fill={genome.ear} />
    </>
  );
}

function Tail({ genome }: { genome: DogGenome }) {
  if (genome.tail === 'nub') return <ellipse cx="210" cy="136" rx="8" ry="6" fill={genome.ear} />;
  if (genome.tail === 'curl') {
    return <path d="M208 136c18-16 8-28-4-18" fill="none" stroke={genome.ear} strokeWidth="7" strokeLinecap="round" />;
  }
  if (genome.tail === 'plume') {
    return <ellipse cx="220" cy="128" rx="22" ry="14" className="biscuit-tail" fill={genome.ear} />;
  }
  return <ellipse cx="214" cy="132" rx="18" ry="10" className="biscuit-tail" fill={genome.ear} />;
}

function Accessory({ genome }: { genome: DogGenome }) {
  if (genome.accessory === 'bandana') {
    return <path d="M104 124l18 18 18-10-8-14z" fill={genome.accessoryColor} />;
  }
  if (genome.accessory === 'collar') {
    return <rect x="104" y="126" width="36" height="6" rx="3" fill={genome.accessoryColor} />;
  }
  if (genome.accessory === 'bow') {
    return <path d="M118 86l-10-8 10 3 10-3z" fill={genome.accessoryColor} />;
  }
  return null;
}
