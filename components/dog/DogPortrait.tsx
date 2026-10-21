'use client';

import dynamic from 'next/dynamic';
import type { DogGenome, LifeStage } from '@/lib/dog';
import type { DriveControl } from './DogRig';
import type { PortraitReaction } from './look';
import type { WorldView } from './DogCanvas';
import type { WorldColliders } from './world/useWorldTiles';

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
  drive = null,
  food = false,
  near = false,
  world = null,
  onWorldColliders,
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
  drive?: DriveControl | null;
  food?: boolean;
  near?: boolean;
  world?: WorldView | null;
  onWorldColliders?: (colliders: WorldColliders) => void;
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
      drive={drive}
      food={food}
      near={near}
      world={world}
      onWorldColliders={onWorldColliders}
      onReady={onReady}
    />
  );
}
