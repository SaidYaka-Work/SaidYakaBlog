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
          <rect x="0" y="198" width="440" height="142" fill={`url(#${uid}-floor)`} />
          <path d="M18 220h404M18 242h404M18 264h404M18 286h404" stroke="var(--porch-rail)" strokeWidth="1" opacity="0.18" />
          <path d="M0 198h440" stroke="var(--porch-rail)" strokeWidth="3" />
          <rect x="24" y="118" width="12" height="82" rx="3" fill="var(--porch-post)" />
          <rect x="404" y="114" width="12" height="86" rx="3" fill="var(--porch-post)" />
          <path d="M24 138h392" stroke="var(--porch-rail)" strokeWidth="5" strokeLinecap="round" />
          <path d="M36 158h368" stroke="var(--porch-rail)" strokeWidth="2" opacity="0.5" />
          <rect x="44" y="78" width="58" height="64" rx="8" fill="var(--porch-window)" />
          <rect x="50" y="84" width="20" height="24" rx="3" fill="var(--porch-pane)" />
          <rect x="76" y="84" width="20" height="24" rx="3" fill="var(--porch-pane)" />
          <rect x="50" y="112" width="46" height="22" rx="3" fill="var(--porch-pane)" />
        </g>
        <ellipse className="porch-rug" cx="220" cy="304" rx="132" ry="20" fill="var(--porch-rug)" />
        <ellipse cx="220" cy="304" rx="92" ry="10" fill="var(--porch-rug-deep)" opacity="0.4" />
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
            transform: `translate(${pose === 'lie' || pose === 'sleep' ? 6 : 0}px, ${pose === 'lie' || pose === 'sleep' ? 12 : 0}px) scale(${1.08 * stageScale.body * build.bodyY})`,
            transformOrigin: '220px 304px',
          }}
        >
          <ellipse className="dog-shadow" cx="220" cy="298" rx="88" ry="14" fill="#16120f" />
          <g className="dog-tail" style={{ transformOrigin: '300px 210px' }}>
            <Tail genes={genes} colors={colors} extras={extras} />
          </g>
          <g className="dog-hind">
            <ellipse cx="152" cy="236" rx={28 * build.bodyX} ry={32 * stageScale.leg} fill={colors.bodyDeep} stroke={colors.outline} strokeWidth="1.7" />
            <ellipse cx="288" cy="236" rx={28 * build.bodyX} ry={32 * stageScale.leg} fill={colors.bodyDeep} stroke={colors.outline} strokeWidth="1.7" />
          </g>
          <g className="dog-torso" style={{ transformOrigin: '220px 220px' }}>
            <ellipse
              cx="220"
              cy="222"
              rx={82 * build.length}
              ry={56 * build.bodyY}
              fill={`url(#${uid}-body)`}
              stroke={colors.outline}
              strokeWidth="2"
            />
            <ellipse cx="220" cy="236" rx="48" ry="30" fill={`url(#${uid}-belly)`} />
            {extras.ruff && <ellipse cx="220" cy="196" rx="40" ry="16" fill={colors.bodyLite} opacity="0.8" />}
            {extras.fluff > 0.5 && (
              <>
                <ellipse cx="168" cy="210" rx="16" ry="12" fill={colors.bodyLite} opacity="0.7" />
                <ellipse cx="272" cy="210" rx="16" ry="12" fill={colors.bodyLite} opacity="0.7" />
              </>
            )}
            <Pattern genes={genes} colors={colors} />
            {genes.marking === 'bib' && <ellipse cx="220" cy="214" rx="22" ry="18" fill={colors.belly} />}
          </g>
          <g className="dog-fore">
            <ellipse className="dog-leg-l" cx="176" cy="256" rx="17" ry={18 * stageScale.leg} fill={`url(#${uid}-body)`} stroke={colors.outline} strokeWidth="1.5" />
            <ellipse className="dog-leg-r" cx="264" cy="256" rx="17" ry={18 * stageScale.leg} fill={`url(#${uid}-body)`} stroke={colors.outline} strokeWidth="1.5" />
            <ellipse cx="174" cy="274" rx="20" ry="11" fill={genes.marking === 'socks' ? colors.belly : colors.body} stroke={colors.outline} strokeWidth="1.3" />
            <ellipse cx="266" cy="274" rx="20" ry="11" fill={genes.marking === 'socks' ? colors.belly : colors.body} stroke={colors.outline} strokeWidth="1.3" />
          </g>
          <g
            className="dog-head"
            style={{
              transform: `translate(${headTurn * 0.35}px, ${headTilt * 0.15}px) rotate(${headTurn}deg)`,
              transformOrigin: '220px 138px',
            }}
          >
            <g className="dog-ears dog-ears-back">
              <Ears genes={genes} colors={colors} floppy={genes.earFloppy} droop={stageScale.droop} layer="back" />
            </g>
            <ellipse
              cx="220"
              cy="138"
              rx={62 * stageScale.head}
              ry={56 * stageScale.head}
              fill={`url(#${uid}-head)`}
              stroke={colors.outline}
              strokeWidth="2"
            />
            {genes.pattern === 'mask' && (
              <ellipse cx="220" cy="136" rx={42 * stageScale.head} ry={34 * stageScale.head} fill={colors.ear} opacity="0.5" />
            )}
            {extras.cheekTuft && (
              <>
                <ellipse cx="168" cy="158" rx="14" ry="11" fill={colors.bodyLite} />
                <ellipse cx="272" cy="158" rx="14" ry="11" fill={colors.bodyLite} />
              </>
            )}
            {genes.marking === 'blaze' && (
              <path d="M220 96c4 18 4 40 0 56" stroke={colors.belly} strokeWidth="8" strokeLinecap="round" fill="none" />
            )}
            <ellipse
              cx="220"
              cy={158 + muzzle.drop * 0.15}
              rx={muzzle.length + 8}
              ry="20"
              fill={`url(#${uid}-belly)`}
              stroke={colors.outline}
              strokeWidth="1.4"
            />
            {stage === 'senior' && (
              <ellipse cx="220" cy="160" rx={muzzle.length} ry="14" fill={colors.grey} opacity="0.75" />
            )}
            <ellipse cx="220" cy="154" rx="8" ry="6.5" fill={colors.nose} />
            <ellipse cx="217" cy="152" rx="2.4" ry="1.5" fill="#fff" opacity="0.5" />
            <g className="dog-mouth">
              <path d="M204 166c10 10 22 10 32 0" fill="none" stroke={colors.outline} strokeWidth="1.8" strokeLinecap="round" />
              <path className="dog-tongue" d="M214 168c8 12 20 12 22 0" fill="#d36a6a" />
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
            <g className="dog-ears">
              <Ears genes={genes} colors={colors} floppy={genes.earFloppy} droop={stageScale.droop} layer="front" />
            </g>
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
    return <ellipse cx="220" cy="200" rx="48" ry="26" fill={colors.spot} opacity="0.72" />;
  }
  if (genes.pattern === 'patches') {
    return (
      <>
        <ellipse cx="176" cy="210" rx="20" ry="16" fill={colors.spot} />
        <ellipse cx="268" cy="228" rx="18" ry="14" fill={colors.spot} />
      </>
    );
  }
  if (genes.pattern === 'spots') {
    return (
      <>
        <circle cx="186" cy="214" r="8" fill={colors.spot} />
        <circle cx="248" cy="200" r="6" fill={colors.spot} />
        <circle cx="226" cy="238" r="5" fill={colors.spot} />
        <circle cx="270" cy="220" r="4.5" fill={colors.spot} />
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
  layer,
}: {
  genes: DogGenome;
  colors: ReturnType<typeof palette>;
  floppy: number;
  droop: number;
  layer: 'back' | 'front';
}) {
  const inner = colors.earDeep;
  if (layer === 'back' && genes.earShape !== 'prick') return null;
  if (layer === 'front' && genes.earShape === 'prick') return null;
  if (genes.earShape === 'prick') {
    return (
      <>
        <path className="dog-ear-l" d="M178 112c-8-52 40-56 34-6" fill={colors.ear} stroke={colors.outline} strokeWidth="1.7" />
        <path d="M190 104c2-24 16-26 15 0" fill={inner} opacity="0.5" />
        <path className="dog-ear-r" d="M262 112c8-52-40-56-34-6" fill={colors.ear} stroke={colors.outline} strokeWidth="1.7" />
        <path d="M250 104c-2-24-16-26-15 0" fill={inner} opacity="0.5" />
      </>
    );
  }
  if (genes.earShape === 'rose') {
    return (
      <>
        <path className="dog-ear-l" d="M160 120c-24-8-14-34 14-20" fill={colors.ear} stroke={colors.outline} strokeWidth="1.6" />
        <path className="dog-ear-r" d="M280 120c24-8 14-34-14-20" fill={colors.ear} stroke={colors.outline} strokeWidth="1.6" />
      </>
    );
  }
  if (genes.earShape === 'button') {
    return (
      <>
        <ellipse className="dog-ear-l" cx="162" cy="118" rx="18" ry="15" fill={colors.ear} stroke={colors.outline} strokeWidth="1.6" />
        <ellipse className="dog-ear-r" cx="278" cy="118" rx="18" ry="15" fill={colors.ear} stroke={colors.outline} strokeWidth="1.6" />
      </>
    );
  }
  const drop = 24 + floppy * 18 + droop * 10;
  return (
    <>
      <ellipse className="dog-ear-l" cx="150" cy={128 + drop / 8} rx="20" ry={18 + drop / 3} fill={colors.ear} stroke={colors.outline} strokeWidth="1.7" />
      <ellipse cx="154" cy={134 + drop / 8} rx="8" ry={9 + drop / 6} fill={inner} opacity="0.45" />
      <ellipse className="dog-ear-r" cx="290" cy={128 + drop / 8} rx="20" ry={18 + drop / 3} fill={colors.ear} stroke={colors.outline} strokeWidth="1.7" />
      <ellipse cx="286" cy={134 + drop / 8} rx="8" ry={9 + drop / 6} fill={inner} opacity="0.45" />
    </>
  );
}

function Tail({ genes, colors, extras }: { genes: DogGenome; colors: ReturnType<typeof palette>; extras: ReturnType<typeof extrasFromGenome> }) {
  if (genes.tail === 'nub') {
    return <ellipse cx="304" cy="214" rx="12" ry="9" fill={colors.ear} stroke={colors.outline} strokeWidth="1.3" />;
  }
  if (genes.tail === 'curl') {
    return <path d="M298 214c30-24 18-42-6-30" fill="none" stroke={colors.ear} strokeWidth="10" strokeLinecap="round" />;
  }
  if (genes.tail === 'plume') {
    return (
      <ellipse
        cx="324"
        cy="196"
        rx={28 + extras.fluff * 6}
        ry={18 + extras.fluff * 4}
        fill={colors.ear}
        stroke={colors.outline}
        strokeWidth="1.4"
      />
    );
  }
  return (
    <path
      d="M300 214c32-8 44 10 38 26"
      fill="none"
      stroke={colors.ear}
      strokeWidth={10 + extras.fluff * 3}
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
  const r = 8.6 * scale;
  const left = { x: 198, y: 130 + droop * 2 };
  const right = { x: 242, y: 130 + droop * 2 };
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
    return <path d="M186 176l18 22 32-8-12-18z" fill={colors.accessory} stroke={colors.outline} strokeWidth="1.1" />;
  }
  if (genes.accessory === 'collar') {
    return (
      <>
        <rect x="184" y="176" width="72" height="10" rx="5" fill={colors.accessory} />
        <circle cx="250" cy="181" r="5" fill="#e8c36a" stroke={colors.outline} strokeWidth="0.8" />
      </>
    );
  }
  if (genes.accessory === 'bow') {
    return (
      <g>
        <ellipse cx="208" cy="88" rx="12" ry="8" fill={colors.accessory} stroke={colors.outline} strokeWidth="1" />
        <ellipse cx="232" cy="88" rx="12" ry="8" fill={colors.accessory} stroke={colors.outline} strokeWidth="1" />
        <circle cx="220" cy="88" r="4" fill={colors.accessory} stroke={colors.outline} strokeWidth="1" />
      </g>
    );
  }
  return null;
}
