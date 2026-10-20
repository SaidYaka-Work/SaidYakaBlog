'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type DriveInput = { ax: number; az: number; run: boolean };

const DEAD = 0.12;

function focusedOverlay(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return true;
  if (target.closest('.dog-overlay, .dog-modal, .dog-start')) return true;
  return false;
}

export default function useDogDrive({
  enabled,
  blocked,
  onFirstUse,
}: {
  enabled: boolean;
  blocked: boolean;
  onFirstUse?: () => void;
}) {
  const keys = useRef(new Set<string>());
  const stick = useRef({ ax: 0, az: 0 });
  const moveStarted = useRef(0);
  const [input, setInput] = useState<DriveInput>({ ax: 0, az: 0, run: false });
  const [touch, setTouch] = useState(false);
  const used = useRef(false);

  const sync = useCallback((shift = false) => {
    let ax = stick.current.ax;
    let az = stick.current.az;
    if (keys.current.has('KeyA') || keys.current.has('ArrowLeft')) ax -= 1;
    if (keys.current.has('KeyD') || keys.current.has('ArrowRight')) ax += 1;
    if (keys.current.has('KeyW') || keys.current.has('ArrowUp')) az -= 1;
    if (keys.current.has('KeyS') || keys.current.has('ArrowDown')) az += 1;
    const mag = Math.hypot(ax, az);
    if (mag > 1) {
      ax /= mag;
      az /= mag;
    }
    if (mag < DEAD) {
      ax = 0;
      az = 0;
      moveStarted.current = 0;
    } else if (!moveStarted.current) {
      moveStarted.current = performance.now();
    }
    const held = moveStarted.current ? performance.now() - moveStarted.current : 0;
    const run = shift || keys.current.has('ShiftLeft') || keys.current.has('ShiftRight') || held > 1400;
    setInput({ ax, az, run });
    if (mag >= DEAD && !used.current) {
      used.current = true;
      onFirstUse?.();
    }
  }, [onFirstUse]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const coarse = window.matchMedia('(pointer: coarse)');
    const update = () => setTouch(coarse.matches || 'ontouchstart' in window);
    update();
    coarse.addEventListener('change', update);
    return () => coarse.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const down = (event: KeyboardEvent) => {
      if (blocked || focusedOverlay(event.target)) return;
      keys.current.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      sync(event.shiftKey);
    };
    const up = (event: KeyboardEvent) => {
      keys.current.delete(event.code);
      sync(event.shiftKey);
    };
    const blur = () => {
      keys.current.clear();
      sync();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [blocked, enabled, sync]);

  const setStick = useCallback((ax: number, az: number) => {
    stick.current = { ax, az };
    sync();
  }, [sync]);

  return { input, touch, setStick };
}
