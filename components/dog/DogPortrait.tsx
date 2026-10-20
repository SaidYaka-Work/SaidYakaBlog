'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { generateGenome, type DogGenome, type LifeStage } from '@/lib/dog';
import {
  extrasFromGenome,
  localSky,
  palette,
  shadeHex,
  stageLook,
  buildLook,
  snoutLook,
  wagMs,
  type IdlePose,
  type PortraitReaction,
  type SkyMood,
} from './look';

export type DogMood = {
  happiness?: number;
  hungry?: boolean;
  sad?: boolean;
};

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
}) {
  const genes = genome ?? generateGenome('napping-biscuit');
  const colors = useMemo(() => palette(genes), [genes]);
  const extras = useMemo(() => extrasFromGenome(genes), [genes]);
  const stageScale = stageLook(stage);
  const build = buildLook(genes.build);
  const muzzle = snoutLook(genes.snout);
  const uid = useId().replace(/:/g, '');
  const sceneRef = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [idle, setIdle] = useState<IdlePose>('sit');
  const [sky, setSky] = useState<SkyMood>(() => localSky());
  const wag = wagMs(happiness, asleep, sad);

  useEffect(() => {
    setSky(localSky());
    const id = window.setInterval(() => setSky(localSky()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!interactive || asleep || reaction !== 'idle' || compact) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    let clearPose = 0;
    const tick = window.setInterval(() => {
      const poses: IdlePose[] = ['sit', 'lie', 'stretch', 'scratch', 'yawn', 'look'];
      const next = poses[Math.floor(Math.random() * poses.length)] ?? 'sit';
      setIdle(next);
      window.clearTimeout(clearPose);
      clearPose = window.setTimeout(() => setIdle('sit'), 2400);
    }, 8200 + Math.floor(Math.random() * 4000));
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(clearPose);
    };
  }, [asleep, compact, interactive, reaction]);

  useEffect(() => {
    if (!interactive) return;
    const node = sceneRef.current;
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

  const pose = asleep || reaction === 'sleep' ? 'sleep' : reaction !== 'idle' ? reaction : idle;
  const skyClass = night || sky === 'night' ? 'is-night' : `is-${sky}`;
  const headTurn = asleep ? 0 : look.x * 7 + (pose === 'look' ? 10 : 0);
  const headTilt = asleep ? 4 : look.y * 4 + (pose === 'yawn' ? -6 : 0);
  const pupilX = asleep ? 0 : look.x * 3.2;
  const pupilY = asleep ? 0 : look.y * 2.2;

  return (
    <div
      ref={sceneRef}
      className={`biscuit-scene ${skyClass} is-${stage} is-${genes.build} is-${pose} ${asleep ? 'is-asleep' : ''} ${sad ? 'is-sad' : ''} ${hungry ? 'is-hungry' : ''} ${compact ? 'is-compact' : ''}`}
      style={{ '--wag': `${wag}ms` } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 440 340" className="biscuit-svg">
        <defs>
          <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--porch-sky-top)" />
            <stop offset="100%" stopColor="var(--porch-sky-bot)" />
          </linearGradient>
          <linearGradient id={`${uid}-floor`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--porch-floor-top)" />
            <stop offset="100%" stopColor="var(--porch-floor-bot)" />
          </linearGradient>
          <radialGradient id={`${uid}-body`} cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor={colors.bodyLite} />
            <stop offset="62%" stopColor={colors.body} />
            <stop offset="100%" stopColor={colors.bodyDeep} />
          </radialGradient>
          <radialGradient id={`${uid}-head`} cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor={colors.bodyLite} />
            <stop offset="70%" stopColor={colors.body} />
            <stop offset="100%" stopColor={colors.bodyDeep} />
          </radialGradient>
          <radialGradient id={`${uid}-belly`} cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor={shadeHex(colors.belly, 0.12)} />
            <stop offset="100%" stopColor={colors.belly} />
          </radialGradient>
          <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.1" />
          </filter>
        </defs>

        <rect width="440" height="340" fill={`url(#${uid}-sky)`} />
        <g className="porch-hills">
          <ellipse cx="70" cy="198" rx="110" ry="36" fill="var(--porch-hill)" />
          <ellipse cx="360" cy="202" rx="130" ry="40" fill="var(--porch-hill-deep)" />
        </g>
        <g className="porch-parallax">
          <rect x="0" y="208" width="440" height="132" fill={`url(#${uid}-floor)`} />
          <path d="M0 208h440" stroke="var(--porch-rail)" strokeWidth="3" />
          <rect x="28" y="132" width="10" height="78" rx="3" fill="var(--porch-post)" />
          <rect x="402" y="128" width="10" height="82" rx="3" fill="var(--porch-post)" />
          <path d="M28 150h384" stroke="var(--porch-rail)" strokeWidth="4" strokeLinecap="round" />
          <path d="M38 168h364" stroke="var(--porch-rail)" strokeWidth="2" opacity="0.55" />
          <rect x="48" y="96" width="46" height="54" rx="6" fill="var(--porch-window)" />
          <rect x="54" y="102" width="16" height="20" rx="2" fill="var(--porch-pane)" />
          <rect x="74" y="102" width="14" height="20" rx="2" fill="var(--porch-pane)" />
          <rect x="54" y="126" width="34" height="18" rx="2" fill="var(--porch-pane)" />
        </g>
        <ellipse className="porch-rug" cx="232" cy="292" rx="118" ry="18" fill="var(--porch-rug)" />
        <ellipse cx="232" cy="292" rx="86" ry="10" fill="var(--porch-rug-deep)" opacity="0.45" />
        {(hungry || pose === 'feed') && (
          <g className="porch-bowl">
            <ellipse cx="86" cy="286" rx="22" ry="8" fill={colors.accessory} />
            <path d="M68 280c2 10 32 10 36 0" fill={shadeHex(colors.accessory, -0.15)} />
            <ellipse cx="86" cy="278" rx="14" ry="4" fill={colors.belly} opacity="0.8" />
          </g>
        )}
        <g className="porch-plant">
          <path d="M388 268c8-28 22-28 18-2" fill="none" stroke="var(--porch-leaf)" strokeWidth="3" />
          <ellipse cx="396" cy="248" rx="10" ry="16" fill="var(--porch-leaf)" opacity="0.85" />
          <ellipse cx="408" cy="256" rx="8" ry="12" fill="var(--porch-leaf-deep)" />
        </g>
        <g className="porch-motes">
          <circle className="porch-mote" cx="92" cy="88" r="1.6" />
          <circle className="porch-mote mote-b" cx="300" cy="70" r="1.3" />
          <circle className="porch-mote mote-c" cx="360" cy="120" r="1.1" />
          <circle className="porch-mote mote-d" cx="140" cy="48" r="1.4" />
        </g>

        <g
          className="dog-root"
          style={{
            transform: `translate(${pose === 'lie' || pose === 'sleep' ? 8 : 0}px, ${pose === 'lie' || pose === 'sleep' ? 10 : 0}px) scale(${0.92 * stageScale.body * build.bodyY})`,
            transformOrigin: '232px 292px',
          }}
        >
          <ellipse className="dog-shadow" cx="236" cy="286" rx="78" ry="12" fill="#16120f" />
          <g className="dog-tail" style={{ transformOrigin: '292px 188px' }}>
            <Tail genes={genes} colors={colors} extras={extras} />
          </g>
          <g className="dog-hind">
            <ellipse cx="286" cy="238" rx={24 * build.bodyX} ry={28 * stageScale.leg} fill={`url(#${uid}-body)`} stroke={colors.outline} strokeWidth="1.6" />
            <ellipse cx="292" cy="262" rx="14" ry="9" fill={genes.marking === 'socks' ? colors.belly : colors.bodyDeep} stroke={colors.outline} strokeWidth="1.2" />
          </g>
          <g className="dog-torso" style={{ transformOrigin: '236px 210px' }}>
            <ellipse
              cx="236"
              cy="208"
              rx={72 * build.length}
              ry={46 * build.bodyY}
              fill={`url(#${uid}-body)`}
              stroke={colors.outline}
              strokeWidth="1.8"
            />
            <ellipse cx="214" cy="218" rx="42" ry="28" fill={`url(#${uid}-belly)`} opacity="0.95" />
            {extras.ruff && (
              <path
                d="M176 198c8 16 28 26 48 18 12-4 18-14 16-24"
                fill={colors.bodyLite}
                stroke={colors.outline}
                strokeWidth="1.1"
                opacity="0.9"
              />
            )}
            {extras.fluff > 0.55 && (
              <>
                <ellipse cx="188" cy="196" rx="14" ry="10" fill={colors.bodyLite} opacity="0.7" />
                <ellipse cx="268" cy="190" rx="16" ry="11" fill={colors.bodyDeep} opacity="0.35" />
              </>
            )}
            <Pattern genes={genes} colors={colors} />
          </g>
          <g className="dog-fore">
            <ellipse className="dog-leg-l" cx="188" cy="248" rx="11" ry={22 * stageScale.leg} fill={`url(#${uid}-body)`} stroke={colors.outline} strokeWidth="1.3" />
            <ellipse className="dog-leg-r" cx="222" cy="252" rx="11" ry={20 * stageScale.leg} fill={colors.bodyDeep} stroke={colors.outline} strokeWidth="1.3" />
            <ellipse cx="186" cy="268" rx="13" ry="8" fill={genes.marking === 'socks' ? colors.belly : colors.body} stroke={colors.outline} strokeWidth="1.1" />
            <ellipse cx="222" cy="270" rx="13" ry="8" fill={genes.marking === 'socks' ? colors.belly : colors.bodyDeep} stroke={colors.outline} strokeWidth="1.1" />
          </g>
          {genes.marking === 'bib' && <ellipse cx="196" cy="200" rx="18" ry="16" fill={colors.belly} />}
          <g
            className="dog-head"
            style={{
              transform: `translate(${headTurn * 0.4}px, ${headTilt * 0.2}px) rotate(${headTurn}deg)`,
              transformOrigin: `${168}px ${132}px`,
            }}
          >
            <g className="dog-ears">
              <Ears genes={genes} colors={colors} floppy={genes.earFloppy} droop={stageScale.droop} />
            </g>
            <ellipse
              cx="168"
              cy="132"
              rx={48 * stageScale.head}
              ry={44 * stageScale.head}
              fill={`url(#${uid}-head)`}
              stroke={colors.outline}
              strokeWidth="1.8"
            />
            {genes.pattern === 'mask' && (
              <ellipse cx="160" cy="128" rx={34 * stageScale.head} ry={28 * stageScale.head} fill={colors.ear} opacity="0.55" />
            )}
            {extras.cheekTuft && (
              <>
                <ellipse cx="132" cy="150" rx="12" ry="9" fill={colors.bodyLite} opacity="0.85" />
                <ellipse cx="198" cy="148" rx="11" ry="8" fill={colors.bodyLite} opacity="0.75" />
              </>
            )}
            {genes.marking === 'blaze' && (
              <path d="M168 96c3 16 3 34 0 48" stroke={colors.belly} strokeWidth="7" strokeLinecap="round" fill="none" />
            )}
            <ellipse
              cx={168 - muzzle.length * 0.15}
              cy={148 + muzzle.drop * 0.2}
              rx={muzzle.length}
              ry={18}
              fill={`url(#${uid}-belly)`}
              stroke={colors.outline}
              strokeWidth="1.3"
            />
            {stage === 'senior' && (
              <ellipse cx={168 - muzzle.length * 0.12} cy={150} rx={muzzle.length * 0.78} ry="12" fill={colors.grey} opacity="0.7" />
            )}
            <ellipse cx={142 - muzzle.length * 0.35} cy={154 + muzzle.drop * 0.15} rx="7.5" ry="6" fill={colors.nose} />
            <ellipse cx={140 - muzzle.length * 0.35} cy={152} rx="2.2" ry="1.4" fill="#fff" opacity="0.45" />
            <g className="dog-mouth">
              <path d="M150 160c8 8 18 8 26 1" fill="none" stroke={colors.outline} strokeWidth="1.6" strokeLinecap="round" />
              <path className="dog-tongue" d="M160 164c6 10 16 10 18 0" fill="#d36a6a" />
            </g>
            <Eyes
              colors={colors}
              asleep={asleep || pose === 'sleep'}
              yawn={pose === 'yawn'}
              scale={stageScale.eye}
              pupilX={pupilX}
              pupilY={pupilY}
              brow={genes.marking === 'brow'}
              droop={stageScale.droop}
            />
            <Accessory genes={genes} colors={colors} />
          </g>
        </g>
      </svg>
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

function Pattern({ genes, colors }: { genes: DogGenome; colors: ReturnType<typeof palette> }) {
  if (genes.pattern === 'saddle') {
    return <ellipse cx="258" cy="188" rx="40" ry="24" fill={colors.spot} opacity="0.72" />;
  }
  if (genes.pattern === 'patches') {
    return (
      <>
        <ellipse cx="206" cy="190" rx="18" ry="14" fill={colors.spot} />
        <ellipse cx="268" cy="214" rx="16" ry="12" fill={colors.spot} />
      </>
    );
  }
  if (genes.pattern === 'spots') {
    return (
      <>
        <circle cx="214" cy="200" r="7" fill={colors.spot} />
        <circle cx="252" cy="186" r="5.5" fill={colors.spot} />
        <circle cx="238" cy="226" r="4.5" fill={colors.spot} />
        <circle cx="274" cy="206" r="4" fill={colors.spot} />
      </>
    );
  }
  return null;
}

function Ears({
  genes,
  colors,
  floppy,
  droop,
}: {
  genes: DogGenome;
  colors: ReturnType<typeof palette>;
  floppy: number;
  droop: number;
}) {
  const inner = colors.earDeep;
  if (genes.earShape === 'prick') {
    return (
      <>
        <path className="dog-ear-l" d="M138 104c-8-38 28-44 28-10" fill={colors.ear} stroke={colors.outline} strokeWidth="1.4" />
        <path d="M146 100c0-18 12-20 14-4" fill={inner} opacity="0.55" />
        <path className="dog-ear-r" d="M196 100c10-40 36-22 18 12" fill={colors.ear} stroke={colors.outline} strokeWidth="1.4" />
      </>
    );
  }
  if (genes.earShape === 'rose') {
    return (
      <>
        <path className="dog-ear-l" d="M136 112c-18-12-6-28 12-14" fill={colors.ear} stroke={colors.outline} strokeWidth="1.3" />
        <path className="dog-ear-r" d="M198 108c18-16 28-2 10 12" fill={colors.ear} stroke={colors.outline} strokeWidth="1.3" />
      </>
    );
  }
  if (genes.earShape === 'button') {
    return (
      <>
        <ellipse className="dog-ear-l" cx="138" cy="108" rx="13" ry="11" fill={colors.ear} stroke={colors.outline} strokeWidth="1.3" />
        <ellipse className="dog-ear-r" cx="198" cy="106" rx="13" ry="11" fill={colors.ear} stroke={colors.outline} strokeWidth="1.3" />
      </>
    );
  }
  const drop = 14 + floppy * 18 + droop * 8;
  return (
    <>
      <ellipse className="dog-ear-l" cx="134" cy={112 + drop / 5} rx="13" ry={12 + drop / 3} fill={colors.ear} stroke={colors.outline} strokeWidth="1.3" />
      <ellipse cx="134" cy={116 + drop / 5} rx="7" ry={7 + drop / 5} fill={inner} opacity="0.45" />
      <ellipse className="dog-ear-r" cx="202" cy={110 + drop / 5} rx="13" ry={12 + drop / 3} fill={colors.ear} stroke={colors.outline} strokeWidth="1.3" />
    </>
  );
}

function Tail({ genes, colors, extras }: { genes: DogGenome; colors: ReturnType<typeof palette>; extras: ReturnType<typeof extrasFromGenome> }) {
  if (genes.tail === 'nub') {
    return <ellipse cx="304" cy="196" rx="11" ry="8" fill={colors.ear} stroke={colors.outline} strokeWidth="1.2" />;
  }
  if (genes.tail === 'curl') {
    return <path d="M296 192c28-22 16-40-6-28" fill="none" stroke={colors.ear} strokeWidth="9" strokeLinecap="round" />;
  }
  if (genes.tail === 'plume') {
    return (
      <ellipse
        cx="318"
        cy="176"
        rx={26 + extras.fluff * 6}
        ry={16 + extras.fluff * 4}
        fill={colors.ear}
        stroke={colors.outline}
        strokeWidth="1.3"
      />
    );
  }
  return (
    <path
      d="M294 190c28-6 40 8 36 24"
      fill="none"
      stroke={colors.ear}
      strokeWidth={9 + extras.fluff * 3}
      strokeLinecap="round"
    />
  );
}

function Eyes({
  colors,
  asleep,
  yawn,
  scale,
  pupilX,
  pupilY,
  brow,
  droop,
}: {
  colors: ReturnType<typeof palette>;
  asleep: boolean;
  yawn: boolean;
  scale: number;
  pupilX: number;
  pupilY: number;
  brow: boolean;
  droop: number;
}) {
  const r = 7.2 * scale;
  const left = { x: 154, y: 126 + droop };
  const right = { x: 180, y: 124 + droop };
  if (asleep || yawn) {
    return (
      <>
        <path d={`M${left.x - 8} ${left.y}c6 5 10 5 16 0`} fill="none" stroke={colors.outline} strokeWidth="2" />
        <path d={`M${right.x - 8} ${right.y}c6 5 10 5 16 0`} fill="none" stroke={colors.outline} strokeWidth="2" />
      </>
    );
  }
  return (
    <>
      {brow && (
        <>
          <ellipse cx={left.x} cy={left.y - 10} rx="5" ry="2.2" fill={colors.spot} />
          <ellipse cx={right.x} cy={right.y - 10} rx="5" ry="2.2" fill={colors.spot} />
        </>
      )}
      {[left, right].map((eye) => (
        <g key={eye.x} className="dog-open-eye" style={{ transformOrigin: `${eye.x}px ${eye.y}px` }}>
          <ellipse cx={eye.x} cy={eye.y} rx={r} ry={r * 1.05} fill="#f7ead8" stroke={colors.outline} strokeWidth="1.1" />
          <circle cx={eye.x + pupilX} cy={eye.y + pupilY} r={r * 0.62} fill={colors.eye} />
          <circle cx={eye.x + pupilX} cy={eye.y + pupilY} r={r * 0.28} fill="#16120f" />
          <circle cx={eye.x + pupilX - 1.6} cy={eye.y + pupilY - 1.8} r={r * 0.18} fill="#fff" />
        </g>
      ))}
    </>
  );
}

function Accessory({ genes, colors }: { genes: DogGenome; colors: ReturnType<typeof palette> }) {
  if (genes.accessory === 'bandana') {
    return <path d="M142 168l22 20 28-8-10-16z" fill={colors.accessory} stroke={colors.outline} strokeWidth="1" />;
  }
  if (genes.accessory === 'collar') {
    return (
      <>
        <rect x="142" y="168" width="54" height="8" rx="4" fill={colors.accessory} />
        <circle cx="194" cy="172" r="4.5" fill="#e8c36a" stroke={colors.outline} strokeWidth="0.8" />
      </>
    );
  }
  if (genes.accessory === 'bow') {
    return <path d="M164 96l-14-10 14 4 14-4z" fill={colors.accessory} stroke={colors.outline} strokeWidth="1" />;
  }
  return null;
}
