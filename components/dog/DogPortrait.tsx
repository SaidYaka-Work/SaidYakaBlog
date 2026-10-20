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
  const muzzle = snoutLook(genes.snout, stageScale.muzzle);
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
      const poses: IdlePose[] = ['sit', 'look', 'yawn', 'stretch', 'scratch'];
      const next = poses[Math.floor(Math.random() * poses.length)] ?? 'sit';
      setIdle(next);
      window.clearTimeout(clearPose);
      clearPose = window.setTimeout(() => setIdle('sit'), 2600);
    }, 7000 + Math.floor(Math.random() * 3500));
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
  const headTurn = asleep ? 6 : look.x * 9 + (pose === 'look' ? 12 : 0) + (sad ? -8 : 0);
  const headTilt = asleep ? 14 : look.y * 5 + stageScale.tilt + (pose === 'yawn' ? -8 : 0);
  const pupilX = asleep ? 0 : look.x * 3.6;
  const pupilY = asleep ? 0 : look.y * 2.4;
  const showBowl = hungry || pose === 'feed';
  const fluffy = extras.fur === 'fluffy';

  return (
    <div
      ref={sceneRef}
      className={`biscuit-scene ${skyClass} is-${stage} is-${genes.build} is-${pose} is-${genes.tail} ${asleep ? 'is-asleep' : ''} ${sad ? 'is-sad' : ''} ${hungry ? 'is-hungry' : ''} ${compact ? 'is-compact' : ''} ${fluffy ? 'is-fluffy' : 'is-smooth'}`}
      style={
        {
          '--wag': `${wag}ms`,
          '--look-x': `${look.x}`,
          '--look-y': `${look.y}`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <svg viewBox="0 0 460 360" className="biscuit-svg">
        <defs>
          <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--porch-sky-top)" />
            <stop offset="58%" stopColor="var(--porch-sky-mid)" />
            <stop offset="100%" stopColor="var(--porch-sky-bot)" />
          </linearGradient>
          <radialGradient id={`${uid}-sun`} cx="22%" cy="18%" r="42%">
            <stop offset="0%" stopColor="var(--porch-sun)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--porch-sun)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-floor`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--porch-floor-top)" />
            <stop offset="100%" stopColor="var(--porch-floor-bot)" />
          </linearGradient>
          <linearGradient id={`${uid}-wall`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--porch-wall)" />
            <stop offset="100%" stopColor="var(--porch-wall-deep)" />
          </linearGradient>
          <radialGradient id={`${uid}-body`} cx="34%" cy="28%" r="72%">
            <stop offset="0%" stopColor={colors.bodyLite} />
            <stop offset="55%" stopColor={colors.body} />
            <stop offset="100%" stopColor={colors.bodyDeep} />
          </radialGradient>
          <radialGradient id={`${uid}-head`} cx="38%" cy="26%" r="70%">
            <stop offset="0%" stopColor={colors.bodyLite} />
            <stop offset="62%" stopColor={colors.body} />
            <stop offset="100%" stopColor={colors.bodyDeep} />
          </radialGradient>
          <radialGradient id={`${uid}-muzzle`} cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor={shadeHex(colors.belly, 0.08)} />
            <stop offset="100%" stopColor={colors.kind === 'blacktan' ? colors.tan : colors.belly} />
          </radialGradient>
          <radialGradient id={`${uid}-rug`} cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="var(--porch-rug-lite)" />
            <stop offset="70%" stopColor="var(--porch-rug)" />
            <stop offset="100%" stopColor="var(--porch-rug-deep)" />
          </radialGradient>
          <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>

        <rect width="460" height="360" fill={`url(#${uid}-sky)`} />
        <rect width="460" height="360" fill={`url(#${uid}-sun)`} />

        <g
          className="porch-far"
          style={{ transform: `translate(${look.x * -10}px, ${look.y * -3}px)` }}
        >
          <ellipse cx="86" cy="214" rx="130" ry="34" fill="var(--porch-hill)" />
          <ellipse cx="340" cy="218" rx="150" ry="38" fill="var(--porch-hill-deep)" />
          <path d="M48 206c8-28 22-40 22-40s10 16 14 40" fill="var(--porch-tree)" />
          <path d="M400 210c10-36 28-50 28-50s12 20 16 50" fill="var(--porch-tree-deep)" />
        </g>

        <g
          className="porch-mid"
          style={{ transform: `translate(${look.x * -5}px, ${look.y * -1.5}px)` }}
        >
          <rect x="0" y="168" width="118" height="86" fill={`url(#${uid}-wall)`} />
          <rect x="18" y="86" width="78" height="86" rx="6" fill="var(--porch-window)" />
          <rect x="26" y="94" width="28" height="32" rx="3" fill="var(--porch-pane)" />
          <rect x="60" y="94" width="28" height="32" rx="3" fill="var(--porch-pane)" />
          <rect x="26" y="132" width="28" height="30" rx="3" fill="var(--porch-pane)" />
          <rect x="60" y="132" width="28" height="30" rx="3" fill="var(--porch-pane)" />
          <rect x="52" y="94" width="4" height="68" fill="var(--porch-window)" />
          <rect x="26" y="124" width="62" height="4" fill="var(--porch-window)" />
        </g>

        <g className="porch-floor">
          <rect x="0" y="248" width="460" height="112" fill={`url(#${uid}-floor)`} />
          <path d="M0 248h460" stroke="var(--porch-rail)" strokeWidth="3" />
          <path
            d="M20 268h420M40 288h380M70 308h320M110 328h240"
            stroke="var(--porch-plank)"
            strokeWidth="1.2"
            opacity="0.45"
          />
          <rect x="14" y="168" width="14" height="82" rx="3" fill="var(--porch-post)" />
          <rect x="432" y="164" width="14" height="86" rx="3" fill="var(--porch-post)" />
          <rect x="12" y="162" width="18" height="8" rx="2" fill="var(--porch-rail)" />
          <rect x="430" y="158" width="18" height="8" rx="2" fill="var(--porch-rail)" />
          <path d="M20 186h412" stroke="var(--porch-rail)" strokeWidth="6" strokeLinecap="round" />
          <path d="M28 208h396" stroke="var(--porch-rail)" strokeWidth="2.5" opacity="0.45" />
        </g>

        <g className="porch-rug">
          <ellipse cx="238" cy="318" rx="128" ry="22" fill={`url(#${uid}-rug)`} />
          <ellipse cx="238" cy="316" rx="102" ry="14" fill="none" stroke="var(--porch-rug-lite)" strokeWidth="3" opacity="0.55" />
          <ellipse cx="238" cy="316" rx="70" ry="8" fill="var(--porch-rug-deep)" opacity="0.22" />
          {Array.from({ length: 14 }, (_, i) => {
            const t = (i / 13) * Math.PI;
            const x = 238 + Math.cos(Math.PI + t) * 128;
            const y = 318 + Math.sin(Math.PI + t) * 22;
            return <line key={i} x1={x} y1={y} x2={x} y2={y + 6} stroke="var(--porch-rug-deep)" strokeWidth="2" strokeLinecap="round" />;
          })}
        </g>

        {showBowl && (
          <g className="porch-bowl">
            <ellipse cx="348" cy="306" rx="26" ry="8" fill="#8a4a28" />
            <path d="M326 300c3 12 40 12 44 0v-6c-4 8-40 8-44 0z" fill="#c46a3a" />
            <ellipse cx="348" cy="294" rx="18" ry="5" fill="#e8c4a0" />
            <ellipse cx="348" cy="293" rx="10" ry="2.4" fill="#f7ead8" />
          </g>
        )}

        <g className="porch-plant">
          <rect x="400" y="286" width="28" height="22" rx="3" fill="var(--porch-pot)" />
          <path d="M400 288h28l-3-10h-22z" fill="var(--porch-pot-rim)" />
          <path d="M414 278c6-32 22-34 18-4" fill="none" stroke="var(--porch-leaf)" strokeWidth="3" />
          <ellipse cx="422" cy="252" rx="11" ry="18" fill="var(--porch-leaf)" />
          <ellipse cx="436" cy="262" rx="9" ry="14" fill="var(--porch-leaf-deep)" />
        </g>

        <g className="porch-motes">
          <circle className="porch-mote" cx="120" cy="72" r="1.7" />
          <circle className="porch-mote mote-b" cx="300" cy="58" r="1.3" />
          <circle className="porch-mote mote-c" cx="380" cy="110" r="1.1" />
          <circle className="porch-mote mote-d" cx="168" cy="40" r="1.4" />
        </g>

        <g
          className="dog-place"
          style={{
            transform: `scale(${1.02 * stageScale.body})`,
            transformOrigin: '230px 318px',
          }}
        >
          <g className="dog-root">
            <ellipse className="dog-shadow" cx="228" cy="316" rx={86 * build.length} ry="14" fill="#16120f" filter={`url(#${uid}-soft)`} />

            <g className="dog-tail" style={{ transformOrigin: '132px 228px' }}>
              <Tail genes={genes} colors={colors} extras={extras} />
            </g>

            <g
              className="dog-body-scale"
              style={{
                transform: `scale(${build.length}, ${build.chest})`,
                transformOrigin: '214px 250px',
              }}
            >
              <g className="dog-body">
              <ellipse className="dog-leg-fh" cx="156" cy="278" rx={16 * build.haunch} ry={22 * stageScale.leg} fill={colors.bodyDeep} stroke={colors.outline} strokeWidth="1.6" />
              <path
                className="dog-haunch"
                d="M124 268c-12-52 24-96 78-84 28 8 40 40 28 78-10 34-58 48-84 28-14-10-20-16-22-22z"
                fill={`url(#${uid}-body)`}
                stroke={colors.outline}
                strokeWidth="2.1"
              />
              <path
                className="dog-torso"
                d="M176 206c28-40 96-48 128-14 26 28 20 72-10 94-28 22-78 18-104-10-18-20-24-42-14-70z"
                fill={`url(#${uid}-body)`}
                stroke={colors.outline}
                strokeWidth="2.1"
              />
              <path
                className="dog-chest"
                d="M248 196c28-18 58-8 68 18 10 26-2 54-28 64-24 10-50 2-62-18-12-20-6-50 22-64z"
                fill={`url(#${uid}-body)`}
                stroke={colors.outline}
                strokeWidth="1.8"
              />
              <ellipse cx="232" cy="252" rx="46" ry="24" fill={colors.belly} opacity="0.92" />
              {extras.ruff && <ellipse cx="256" cy="198" rx="28" ry="14" fill={colors.bodyLite} opacity="0.8" />}
              {fluffy && (
                <>
                  <ellipse cx="168" cy="214" rx="16" ry="12" fill={colors.bodyLite} opacity="0.72" />
                  <ellipse cx="206" cy="188" rx="18" ry="10" fill={colors.bodyLite} opacity="0.65" />
                  <ellipse cx="150" cy="246" rx="12" ry="10" fill={colors.bodyLite} opacity="0.6" />
                </>
              )}
              <CoatArt genes={genes} colors={colors} />
              <path
                d="M168 196c30-18 86-20 126 6"
                fill="none"
                stroke={colors.rim}
                strokeWidth="3.2"
                strokeLinecap="round"
                opacity="0.55"
              />
              </g>
            </g>

            <g className="dog-legs">
              <g className="dog-leg-ff" style={{ transformOrigin: '236px 236px' }}>
                <path d="M230 236c-2 28-4 48-6 58" fill="none" stroke={colors.bodyDeep} strokeWidth="13" strokeLinecap="round" />
                <ellipse className="dog-paw" cx="222" cy={304} rx={15 * stageScale.paw} ry={8 * stageScale.paw} fill={pawFill(genes, colors)} stroke={colors.outline} strokeWidth="1.3" />
              </g>
              <g className="dog-leg-nh" style={{ transformOrigin: '158px 250px' }}>
                <ellipse cx="150" cy="302" rx={17 * stageScale.paw} ry={8 * stageScale.paw} fill={pawFill(genes, colors)} stroke={colors.outline} strokeWidth="1.3" />
              </g>
              <g className="dog-leg-nf" style={{ transformOrigin: '274px 228px' }}>
                <path d="M272 228c2 30 4 52 6 64" fill="none" stroke={colors.body} strokeWidth="14" strokeLinecap="round" />
                <ellipse className="dog-paw" cx="280" cy={304} rx={17 * stageScale.paw} ry={8.5 * stageScale.paw} fill={pawFill(genes, colors)} stroke={colors.outline} strokeWidth="1.4" />
              </g>
            </g>

            <g
              className="dog-head-anchor"
              style={{
                transform: `translate(${headTurn * 0.45}px, ${6 * stageScale.droop + headTilt * 0.2}px) rotate(${headTurn * 0.35}deg)`,
                transformOrigin: '252px 176px',
              }}
            >
              <g
                className="dog-head-scale"
                style={{
                  transform: `scale(${stageScale.head}) rotate(${headTilt}deg)`,
                  transformOrigin: '252px 176px',
                }}
              >
              <g className="dog-head">
                <g className="dog-ears dog-ears-back">
                  <Ears genes={genes} colors={colors} floppy={genes.earFloppy} droop={stageScale.droop} layer="back" />
                </g>
                <path
                  d="M228 168c-8-42 32-68 70-52 26 12 34 40 20 62-12 20-48 30-70 16-14-8-18-16-20-26z"
                  fill={`url(#${uid}-head)`}
                  stroke={colors.outline}
                  strokeWidth="2.1"
                />
                {genes.pattern === 'mask' || colors.kind === 'blacktan' ? (
                  <path
                    d="M246 136c8-18 40-20 54 2 8 14 4 28-10 34-18 8-40 4-48-10-6-10-4-18 4-26z"
                    fill={colors.kind === 'blacktan' ? colors.body : colors.ear}
                    opacity="0.72"
                  />
                ) : null}
                <g
                  className="dog-muzzle"
                  style={{
                    transform: `scaleX(${Math.max(0.55, muzzle / 48)})`,
                    transformOrigin: '300px 168px',
                  }}
                >
                  <path
                    d="M292 150c28-10 70 0 82 20 6 12-4 24-28 28-26 4-48-8-54-24-4-10-4-18 0-24z"
                    fill={`url(#${uid}-muzzle)`}
                    stroke={colors.outline}
                    strokeWidth="1.8"
                  />
                  <path d="M318 186c14 10 32 10 44-2" fill="none" stroke={colors.outline} strokeWidth="1.7" strokeLinecap="round" />
                  <circle cx="328" cy="176" r="1.3" fill={colors.outline} opacity="0.45" />
                  <circle cx="338" cy="180" r="1.1" fill={colors.outline} opacity="0.4" />
                  <circle cx="348" cy="176" r="1.1" fill={colors.outline} opacity="0.35" />
                  {stage === 'senior' && (
                    <path
                      d="M300 156c22-6 54 2 64 18-8 10-28 14-50 8-12-4-18-14-14-26z"
                      fill={colors.grey}
                      opacity="0.8"
                    />
                  )}
                  <g className="dog-mouth">
                    <path className="dog-tongue" d="M328 188c10 14 26 14 30 0" fill="#d36a6a" />
                  </g>
                  <ellipse cx="368" cy="168" rx="10" ry="7.5" fill={colors.nose} />
                  <ellipse cx="364" cy="165" rx="3.2" ry="1.8" fill="#fff" opacity="0.45" />
                </g>
                {genes.marking === 'blaze' && (
                  <path d="M286 118c6 22 8 40 2 62" stroke={colors.belly} strokeWidth="9" strokeLinecap="round" fill="none" />
                )}
                <Eyes
                  colors={colors}
                  asleep={asleep || pose === 'sleep'}
                  yawn={pose === 'yawn'}
                  scale={stageScale.eye}
                  pupilX={pupilX}
                  pupilY={pupilY}
                  brow={genes.marking === 'brow' || colors.kind === 'blacktan'}
                  droop={stageScale.droop}
                  senior={stage === 'senior'}
                />
                <path
                  d="M250 122c22-10 48-8 66 8"
                  fill="none"
                  stroke={colors.rim}
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  opacity="0.5"
                />
                <g className="dog-ears">
                  <Ears genes={genes} colors={colors} floppy={genes.earFloppy} droop={stageScale.droop} layer="front" />
                </g>
                <Accessory genes={genes} colors={colors} />
              </g>
              </g>
            </g>
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

function pawFill(genes: DogGenome, colors: ReturnType<typeof palette>) {
  if (genes.marking === 'socks' || colors.kind === 'blacktan') return colors.kind === 'blacktan' ? colors.tan : colors.belly;
  return colors.body;
}

function CoatArt({ genes, colors }: { genes: DogGenome; colors: ReturnType<typeof palette> }) {
  const marks = [];
  if (colors.kind === 'blacktan') {
    marks.push(<ellipse key="tan-chest" cx="262" cy="236" rx="28" ry="22" fill={colors.tan} />);
    marks.push(<ellipse key="tan-brow-l" cx="250" cy="206" rx="8" ry="4" fill={colors.tan} />);
  }
  if (colors.kind === 'brindle') {
    marks.push(
      <g key="brindle" opacity="0.38">
        <path d="M176 214c24 8 40 6 54-8" fill="none" stroke={colors.spot} strokeWidth="7" strokeLinecap="round" />
        <path d="M184 236c28 6 46 4 60-10" fill="none" stroke={colors.spot} strokeWidth="6" strokeLinecap="round" />
        <path d="M196 256c22 6 38 4 50-8" fill="none" stroke={colors.spot} strokeWidth="5" strokeLinecap="round" />
        <path d="M210 198c18 4 30 2 40-8" fill="none" stroke={colors.spot} strokeWidth="5" strokeLinecap="round" />
      </g>,
    );
  }
  if (colors.kind === 'merle' || genes.pattern === 'patches') {
    marks.push(<ellipse key="p1" cx="176" cy="230" rx="22" ry="16" fill={colors.spot} opacity="0.8" />);
    marks.push(<ellipse key="p2" cx="250" cy="214" rx="18" ry="14" fill={colors.spot} opacity="0.7" />);
    marks.push(<ellipse key="p3" cx="218" cy="258" rx="12" ry="9" fill={colors.spot} opacity="0.55" />);
  }
  if (genes.pattern === 'saddle' && colors.kind !== 'merle') {
    marks.push(<ellipse key="saddle" cx="214" cy="210" rx="48" ry="22" fill={colors.spot} opacity="0.72" />);
  }
  if (genes.pattern === 'spots' && colors.kind !== 'merle') {
    marks.push(<circle key="s1" cx="188" cy="226" r="8" fill={colors.spot} />);
    marks.push(<circle key="s2" cx="236" cy="208" r="6" fill={colors.spot} />);
    marks.push(<circle key="s3" cx="222" cy="250" r="5" fill={colors.spot} />);
    marks.push(<circle key="s4" cx="268" cy="228" r="4.5" fill={colors.spot} />);
  }
  if (colors.kind === 'whitepatch') {
    marks.push(<ellipse key="wp1" cx="190" cy="220" rx="24" ry="18" fill={colors.spot} />);
    marks.push(<ellipse key="wp2" cx="258" cy="206" rx="16" ry="13" fill={colors.spot} />);
  }
  if (genes.marking === 'bib') {
    marks.push(<ellipse key="bib" cx="266" cy="228" rx="20" ry="16" fill={colors.belly} />);
  }
  return <>{marks}</>;
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
  if (layer === 'back' && genes.earShape === 'flop') return null;
  if (layer === 'front' && genes.earShape === 'prick') {
    return (
      <>
        <path className="dog-ear-l" d="M236 128c-10-58 42-64 36-8" fill={colors.ear} stroke={colors.outline} strokeWidth="1.8" />
        <path d="M250 120c2-28 16-30 14 2" fill={colors.earIn} opacity="0.55" />
        <path className="dog-ear-r" d="M312 122c14-56-40-62-32-6" fill={colors.ear} stroke={colors.outline} strokeWidth="1.8" />
        <path d="M300 116c-2-26-16-28-14 2" fill={colors.earIn} opacity="0.5" />
      </>
    );
  }
  if (layer === 'back') {
    if (genes.earShape === 'prick') {
      return <path className="dog-ear-l" d="M232 130c-16-54 36-60 32-6" fill={colors.earDeep} stroke={colors.outline} strokeWidth="1.6" />;
    }
    return <path className="dog-ear-l" d="M226 136c-36-8-28-40 8-28" fill={colors.earDeep} stroke={colors.outline} strokeWidth="1.5" />;
  }
  if (genes.earShape === 'rose') {
    return (
      <>
        <path className="dog-ear-l" d="M224 138c-28-6-18-32 12-20" fill={colors.ear} stroke={colors.outline} strokeWidth="1.6" />
        <path className="dog-ear-r" d="M318 128c26-18 8-36-16-18" fill={colors.ear} stroke={colors.outline} strokeWidth="1.6" />
      </>
    );
  }
  if (genes.earShape === 'button') {
    return (
      <>
        <path className="dog-ear-l" d="M230 128c-22-18-8-36 14-18 8 8 6 22-2 28-8 4-12 0-12-10z" fill={colors.ear} stroke={colors.outline} strokeWidth="1.6" />
        <path className="dog-ear-r" d="M314 122c20-20 6-36-16-16-8 8-6 22 2 26 8 4 12-2 14-10z" fill={colors.ear} stroke={colors.outline} strokeWidth="1.6" />
      </>
    );
  }
  const drop = 20 + floppy * 22 + droop * 10;
  return (
    <>
      <path
        className="dog-ear-l"
        d={`M228 132c-40 ${6 + drop / 8} -28 ${34 + drop} 8 ${28 + drop / 2} 16-4 22-${18 + drop / 3} 14-${34 + drop / 4}z`}
        fill={colors.ear}
        stroke={colors.outline}
        strokeWidth="1.8"
      />
      <path
        className="dog-ear-r"
        d={`M314 124c28 ${4 + drop / 10} 22 ${36 + drop} -10 ${26 + drop / 2} -14-6 -16-${20 + drop / 3} -8-${32 + drop / 4}z`}
        fill={colors.ear}
        stroke={colors.outline}
        strokeWidth="1.8"
      />
    </>
  );
}

function Tail({ genes, colors, extras }: { genes: DogGenome; colors: ReturnType<typeof palette>; extras: ReturnType<typeof extrasFromGenome> }) {
  const thick = 11 + extras.fluff * 5;
  if (genes.tail === 'nub') {
    return <path d="M132 228c-18-6-22 8-12 16" fill="none" stroke={colors.ear} strokeWidth={thick} strokeLinecap="round" />;
  }
  if (genes.tail === 'curl') {
    return (
      <path
        d="M132 228c-38-18-36-56 4-52 24 2 22 28-4 28"
        fill="none"
        stroke={colors.ear}
        strokeWidth={thick}
        strokeLinecap="round"
      />
    );
  }
  if (genes.tail === 'plume') {
    return (
      <path
        d="M132 228c-46-8-70-40-58-72 8 18 28 28 22 8 18 22 48 36 36 64"
        fill={colors.ear}
        stroke={colors.outline}
        strokeWidth="1.4"
      />
    );
  }
  return (
    <path
      d="M132 228c-48-6-72-40-62-78"
      fill="none"
      stroke={colors.ear}
      strokeWidth={thick}
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
  senior,
}: {
  colors: ReturnType<typeof palette>;
  asleep: boolean;
  yawn: boolean;
  scale: number;
  pupilX: number;
  pupilY: number;
  brow: boolean;
  droop: number;
  senior: boolean;
}) {
  const far = { x: 262, y: 138 + droop * 2, r: 7.2 * scale };
  const near = { x: 298, y: 134 + droop * 2, r: 9.1 * scale };
  if (asleep || yawn) {
    return (
      <>
        <path d={`M${far.x - 8} ${far.y}c5 5 10 5 16 0`} fill="none" stroke={colors.outline} strokeWidth="2.1" />
        <path d={`M${near.x - 9} ${near.y}c6 6 12 6 18 0`} fill="none" stroke={colors.outline} strokeWidth="2.2" />
      </>
    );
  }
  return (
    <>
      {brow && (
        <>
          <ellipse cx={far.x} cy={far.y - 11} rx="6" ry="2.4" fill={colors.tan} />
          <ellipse cx={near.x} cy={near.y - 12} rx="7" ry="2.6" fill={colors.tan} />
        </>
      )}
      {senior && (
        <>
          <path d={`M${far.x - 8} ${far.y - 10}c6-3 12-3 16 2`} fill="none" stroke={colors.grey} strokeWidth="2.2" />
          <path d={`M${near.x - 9} ${near.y - 11}c7-3 14-3 18 2`} fill="none" stroke={colors.grey} strokeWidth="2.3" />
        </>
      )}
      {[far, near].map((eye) => (
        <g key={eye.x} className="dog-open-eye" style={{ transformOrigin: `${eye.x}px ${eye.y}px` }}>
          <ellipse cx={eye.x} cy={eye.y} rx={eye.r} ry={eye.r * 1.08} fill="#f7ead8" stroke={colors.outline} strokeWidth="1.15" />
          <circle cx={eye.x + pupilX} cy={eye.y + pupilY} r={eye.r * 0.62} fill={colors.eye} />
          <circle cx={eye.x + pupilX} cy={eye.y + pupilY} r={eye.r * 0.28} fill="#16120f" />
          <circle cx={eye.x + pupilX - 1.7} cy={eye.y + pupilY - 1.9} r={eye.r * (senior ? 0.28 : 0.18)} fill="#fff" opacity={senior ? 0.55 : 0.95} />
          {senior && <circle cx={eye.x + pupilX + 1.2} cy={eye.y + pupilY + 0.8} r={eye.r * 0.16} fill="#fff" opacity="0.35" />}
        </g>
      ))}
    </>
  );
}

function Accessory({ genes, colors }: { genes: DogGenome; colors: ReturnType<typeof palette> }) {
  if (genes.accessory === 'bandana') {
    return <path d="M236 184l16 20 34-10-10-16z" fill={colors.accessory} stroke={colors.outline} strokeWidth="1.1" />;
  }
  if (genes.accessory === 'collar') {
    return (
      <>
        <path d="M238 180c18 10 42 10 58-2" fill="none" stroke={colors.accessory} strokeWidth="8" strokeLinecap="round" />
        <circle cx="300" cy="182" r="5" fill="#e8c36a" stroke={colors.outline} strokeWidth="0.8" />
      </>
    );
  }
  if (genes.accessory === 'bow') {
    return (
      <g>
        <ellipse cx="276" cy="108" rx="12" ry="8" fill={colors.accessory} stroke={colors.outline} strokeWidth="1" />
        <ellipse cx="298" cy="108" rx="12" ry="8" fill={colors.accessory} stroke={colors.outline} strokeWidth="1" />
        <circle cx="287" cy="108" r="4" fill={colors.accessory} stroke={colors.outline} strokeWidth="1" />
      </g>
    );
  }
  return null;
}
