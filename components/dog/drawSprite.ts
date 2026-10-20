import type { DogGenome } from '@/lib/dog';
import { palette } from './look';

export function drawDogSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  genome: DogGenome,
  opts: { hop?: number; phase?: number; scale?: number; facing?: 1 | -1 } = {},
) {
  const colors = palette(genome);
  const hop = opts.hop ?? 0;
  const phase = opts.phase ?? 0;
  const scale = opts.scale ?? 1;
  const facing = opts.facing ?? 1;
  const kick = Math.sin(phase) * 6;
  ctx.save();
  ctx.translate(x, y - hop);
  ctx.scale(facing * scale, scale);
  ctx.fillStyle = 'rgba(22,18,16,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 18, 20, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.ear;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(14, -2);
  ctx.quadraticCurveTo(28, -10 - kick, 26, 6);
  ctx.stroke();
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.ellipse(2, 2, 16, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.belly;
  ctx.beginPath();
  ctx.ellipse(-2, 6, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.ellipse(-8, 12 + kick * 0.2, 4, 7, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6, 12 - kick * 0.2, 4, 7, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.ellipse(-12, -8, 10, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.ear;
  ctx.beginPath();
  ctx.ellipse(-16, -16, 4, 7, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-6, -16, 4, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.nose;
  ctx.beginPath();
  ctx.ellipse(-20, -6, 2.2, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f7ead8';
  ctx.beginPath();
  ctx.arc(-14, -10, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.eye;
  ctx.beginPath();
  ctx.arc(-14, -10, 1.1, 0, Math.PI * 2);
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
  const sky = night ? '#161820' : '#f3e6d4';
  const floor = night ? '#241c18' : '#e4d4c2';
  const rail = night ? '#4a3a2e' : '#8a6a4e';
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = night ? '#1f1a16' : '#d7c4ae';
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
    ctx.fillStyle = night ? '#3d2c22' : '#6d4e36';
    ctx.fillRect(x, height * 0.48, 6, height * 0.22);
  }
}
