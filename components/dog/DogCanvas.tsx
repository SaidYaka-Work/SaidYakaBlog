'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import type { DogGenome, LifeStage } from '@/lib/dog';
import type { PortraitReaction } from './look';
import DogRig from './DogRig';
import PorchWorld from './PorchWorld';

export default function DogCanvas({
  genome,
  stage = 'adult',
  reaction,
  asleep,
  night,
  happiness = 70,
  hungry = false,
  sad = false,
  compact = false,
  interactive = false,
}: {
  genome?: DogGenome | null;
  stage?: LifeStage;
  reaction: PortraitReaction;
  asleep: boolean;
  night: boolean;
  happiness?: number;
  hungry?: boolean;
  sad?: boolean;
  compact?: boolean;
  interactive?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [frameloop, setFrameloop] = useState<'always' | 'never'>('always');
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const update = () => {
      const visible = !document.hidden && node.getBoundingClientRect().height > 0;
      const onscreen = node.getBoundingClientRect().bottom > 0 && node.getBoundingClientRect().top < window.innerHeight;
      setFrameloop(visible && onscreen ? 'always' : 'never');
    };
    update();
    const io = new IntersectionObserver(update, { threshold: 0.05 });
    io.observe(node);
    document.addEventListener('visibilitychange', update);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  useEffect(() => {
    if (!interactive) return;
    const node = host.current;
    if (!node) return;
    const onMove = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      const x = ((event.clientX - box.left) / box.width) * 2 - 1;
      const y = ((event.clientY - box.top) / box.height) * 2 - 1;
      setLook({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
    };
    const onLeave = () => setLook({ x: 0, y: 0 });
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerleave', onLeave);
    return () => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerleave', onLeave);
    };
  }, [interactive]);

  return (
    <div ref={host} className={`biscuit-scene ${night ? 'is-night' : ''} ${compact ? 'is-compact' : ''} is-${reaction}`}>
      <Canvas
        dpr={[1, 1.6]}
        camera={{ position: [3.35, 2.05, 4.15], fov: compact ? 38 : 34, near: 0.1, far: 40 }}
        shadows
        frameloop={frameloop}
        gl={{ antialias: true, alpha: false, powerPreference: 'default' }}
      >
        <Suspense fallback={null}>
          <PorchWorld night={night} showBowl={hungry || reaction === 'feed'} compact={compact} />
          <DogRig
            genome={genome}
            stage={stage}
            reaction={reaction}
            asleep={asleep}
            sad={sad}
            happiness={happiness}
            look={look}
            reduced={reduced}
          />
        </Suspense>
      </Canvas>
      {reaction === 'pet' && (
        <span className="biscuit-hearts">
          <i />
          <i />
          <i />
        </span>
      )}
      {(asleep || reaction === 'sleep') && <span className="biscuit-zzz">Zzz</span>}
    </div>
  );
}
