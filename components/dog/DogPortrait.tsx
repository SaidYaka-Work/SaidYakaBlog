'use client';

import dynamic from 'next/dynamic';
import type { DogGenome, LifeStage } from '@/lib/dog';
import type { PortraitReaction } from './look';

const Poster = () => <div className="biscuit-poster" />;

const DogCanvas = dynamic(() => import('./DogCanvas'), { ssr: false, loading: Poster });
const DogStill = dynamic(() => import('./dogStill'), { ssr: false, loading: Poster });

export default function DogPortrait({
  genome,
  asleep,
  reaction,
  night,
  stage = 'adult',
  happiness = 70,
  hungry = false,
  sad = false,
  compact = false,
  interactive = false,
  fill = false,
  empty = false,
  onReady,
}: {
  genome?: DogGenome | null;
  asleep: boolean;
  reaction: PortraitReaction;
  night: boolean;
  stage?: LifeStage;
  happiness?: number;
  hungry?: boolean;
  sad?: boolean;
  compact?: boolean;
  interactive?: boolean;
  fill?: boolean;
  empty?: boolean;
  onReady?: () => void;
}) {
  if (compact) {
    return <DogStill genome={genome} stage={stage} reaction={reaction} asleep={asleep} night={night} sad={sad} />;
  }
  return (
    <DogCanvas
      genome={genome}
      stage={stage}
      reaction={reaction}
      asleep={asleep}
      night={night}
      happiness={happiness}
      hungry={hungry}
      sad={sad}
      interactive={interactive}
      fill={fill}
      empty={empty}
      onReady={onReady}
    />
  );
}
