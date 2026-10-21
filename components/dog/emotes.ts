import type { DogEmote } from '@/lib/dog';

export const EMOTE_SET: { kind: DogEmote; label: string; color: string }[] = [
  { kind: 'wave', label: '👋', color: '#7eb6ff' },
  { kind: 'heart', label: '❤️', color: '#f07080' },
  { kind: 'treat', label: '🦴', color: '#e8a050' },
  { kind: 'clap', label: '👏', color: '#f4d56a' },
  { kind: 'sit', label: '🐾', color: '#8fd0a0' },
];
