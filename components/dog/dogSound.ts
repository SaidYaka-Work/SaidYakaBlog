type Sfx = 'bark' | 'munch' | 'step';

let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function playDogSfx(kind: Sfx, muted: boolean) {
  if (muted) return;
  try {
    const ac = audio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    if (kind === 'bark') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.stop(now + 0.18);
    } else if (kind === 'munch') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(92, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.stop(now + 0.09);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.stop(now + 0.08);
    }
    osc.start(now);
  } catch {
    // Web Audio can throw if the tab blocked autoplay; mute stays safe.
  }
}
