export type ThemeColors = {
  ink: string;
  muted: string;
  accent: string;
  bg: string;
  elevated: string;
};

export function readThemeColors(): ThemeColors {
  if (typeof document === 'undefined') {
    return {
      ink: '#161412',
      muted: '#6d675e',
      accent: '#b4532a',
      bg: '#f4efe6',
      elevated: '#fffdf8',
    };
  }

  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;

  return {
    ink: read('--ink', '#161412'),
    muted: read('--muted', '#6d675e'),
    accent: read('--accent', '#b4532a'),
    bg: read('--bg', '#f4efe6'),
    elevated: read('--bg-elevated', '#fffdf8'),
  };
}

export function wrapAngle(angle: number) {
  const tau = Math.PI * 2;
  return ((angle % tau) + tau) % tau;
}

export function angleDelta(a: number, b: number) {
  const delta = wrapAngle(a) - wrapAngle(b);
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}
