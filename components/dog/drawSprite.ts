import type { DogGenome } from '@/lib/dog';
import { extrasFromGenome, palette } from './look';

export function drawDogSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  genome: DogGenome,
  opts: { hop?: number; phase?: number; scale?: number; facing?: 1 | -1 } = {},
) {
  const colors = palette(genome);
  const extras = extrasFromGenome(genome);
  const hop = opts.hop ?? 0;
  const phase = opts.phase ?? 0;
  const scale = opts.scale ?? 1;
  const facing = opts.facing ?? 1;
  const kick = Math.sin(phase) * 7;
  const backKick = Math.sin(phase + Math.PI) * 7;
  ctx.save();
  ctx.translate(x, y - hop);
  ctx.scale(facing * scale, scale);
  ctx.fillStyle = 'rgba(22,18,16,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 20, 22, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = colors.ear;
  ctx.lineWidth = genome.tail === 'plume' ? 8 : 5 + extras.fluff * 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (genome.tail === 'curl') {
    ctx.moveTo(16, 0);
    ctx.quadraticCurveTo(28, -16 - kick * 0.3, 18, -18);
  } else {
    ctx.moveTo(16, 0);
    ctx.quadraticCurveTo(32, -12 - kick, 30, 8);
  }
  ctx.stroke();

  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.ellipse(2, 2, 18, 11, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.belly;
  ctx.beginPath();
  ctx.ellipse(-1, 6, 10, 6, -0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.bodyDeep;
  ctx.beginPath();
  ctx.ellipse(10, 12 + backKick * 0.25, 3.4, 7, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-8, 13 + kick * 0.25, 3.4, 7, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.ellipse(6, 12 - kick * 0.25, 3.6, 7.2, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-4, 13 - backKick * 0.25, 3.6, 7.2, -0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.ellipse(-14, -8, 11, 9, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.kind === 'blacktan' ? colors.tan : colors.belly;
  ctx.beginPath();
  ctx.ellipse(-24, -4, genome.snout === 'short' ? 6 : genome.snout === 'long' ? 10 : 8, 4.4, 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.ear;
  if (genome.earShape === 'prick') {
    ctx.beginPath();
    ctx.moveTo(-18, -14);
    ctx.lineTo(-22, -28);
    ctx.lineTo(-10, -16);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.lineTo(-6, -26);
    ctx.lineTo(-2, -12);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(-20, -12, 4.2, 8, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-8, -12, 4, 7, 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = colors.nose;
  ctx.beginPath();
  ctx.ellipse(-30, -4, 2.4, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f7ead8';
  ctx.beginPath();
  ctx.arc(-16, -10, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.eye;
  ctx.beginPath();
  ctx.arc(-16, -10, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-16.6, -10.6, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function paintPorchCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  night = true,
  scroll = 0,
) {
  const sky = night ? '#1c1816' : '#f8ead6';
  const floor = night ? '#2a221c' : '#f3e6d4';
  const rail = night ? '#8a4a28' : '#c47848';
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  if (!night) {
    const glow = ctx.createRadialGradient(width * 0.22, height * 0.18, 8, width * 0.22, height * 0.18, width * 0.45);
    glow.addColorStop(0, 'rgba(255, 231, 196, 0.8)');
    glow.addColorStop(1, 'rgba(255, 231, 196, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.fillStyle = night ? '#241c18' : '#e2c8ae';
  ctx.beginPath();
  ctx.ellipse(80 - (scroll % 80), height * 0.62, 90, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = floor;
  ctx.fillRect(0, height * 0.7, width, height * 0.3);
  ctx.strokeStyle = rail;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, height * 0.7);
  ctx.lineTo(width, height * 0.7);
  ctx.stroke();
  for (let i = -1; i < width / 48 + 2; i += 1) {
    const x = i * 48 - (scroll % 48);
    ctx.fillStyle = night ? '#3d2c22' : '#e8d4bc';
    ctx.fillRect(x, height * 0.48, 8, height * 0.22);
  }
}
