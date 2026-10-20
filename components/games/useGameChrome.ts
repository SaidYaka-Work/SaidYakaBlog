'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createGameAudio } from './audio';

export function useGameChrome(storageKey: string) {
  const [muted, setMuted] = useState(true);
  const [best, setBest] = useState<number | null>(null);
  const audio = useMemo(() => createGameAudio(), []);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    const parsed = Number(saved);
    if (!Number.isNaN(parsed)) setBest(parsed);
  }, [storageKey]);

  const commitBest = useCallback(
    (score: number) => {
      setBest((current) => {
        if (current !== null && score <= current) return current;
        window.localStorage.setItem(storageKey, String(score));
        return score;
      });
    },
    [storageKey],
  );

  const beep = useCallback(
    (frequency?: number, duration?: number) => {
      if (muted) return;
      audio.beep(frequency, duration);
    },
    [audio, muted],
  );

  const toggleMute = useCallback(() => {
    setMuted((value) => !value);
  }, []);

  return { muted, best, commitBest, beep, toggleMute };
}
