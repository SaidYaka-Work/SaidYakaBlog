export type GameAudio = {
  beep: (frequency?: number, duration?: number) => void;
};

export function createGameAudio(): GameAudio {
  let context: AudioContext | null = null;

  return {
    beep(frequency = 440, duration = 0.07) {
      try {
        const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        context = context ?? new AudioCtx();
        if (context.state === 'suspended') void context.resume();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.value = 0.045;
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
        oscillator.stop(context.currentTime + duration);
      } catch {
        // audio is optional
      }
    },
  };
}
