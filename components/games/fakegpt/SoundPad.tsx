'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { SynthHit } from './types';

export type SoundSnapshot = {
  audioMs: number;
  peakLevel: number;
  padHits: number;
  blobUrl: string | null;
  usedMic: boolean;
  usedSynth: boolean;
  hits: SynthHit[];
};

export type SoundPadHandle = {
  finalize: () => Promise<SoundSnapshot>;
};

export type MicMode = 'unknown' | 'mic' | 'synth';

type SoundPadProps = {
  disabled?: boolean;
  preferredMode?: MicMode;
  onMode?: (mode: Exclude<MicMode, 'unknown'>) => void;
};

type Pad = {
  id: string;
  label: string;
  freq: number;
  type: OscillatorType;
};

const PADS: Pad[] = [
  { id: 'sad', label: 'Sad beep', freq: 196, type: 'sine' },
  { id: 'robot', label: 'Robot', freq: 110, type: 'square' },
  { id: 'buzz', label: 'Buzz', freq: 70, type: 'sawtooth' },
  { id: 'whoosh', label: 'Whoosh', freq: 420, type: 'triangle' },
  { id: 'honk', label: 'Honk', freq: 260, type: 'square' },
  { id: 'purr', label: 'Purr', freq: 55, type: 'sine' },
  { id: 'clank', label: 'Clank', freq: 880, type: 'triangle' },
  { id: 'squeak', label: 'Squeak', freq: 1400, type: 'sine' },
];

function pickMime(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  if (typeof MediaRecorder === 'undefined') return '';
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function audioContextCtor() {
  return window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

const SoundPad = forwardRef<SoundPadHandle, SoundPadProps>(function SoundPad(
  { disabled = false, preferredMode = 'unknown', onMode },
  ref,
) {
  const [mode, setMode] = useState<Exclude<MicMode, 'unknown'> | 'pending'>(
    preferredMode === 'unknown' ? 'pending' : preferredMode,
  );
  const [recording, setRecording] = useState(false);
  const [activePad, setActivePad] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const peakRef = useRef(0);
  const activeMsRef = useRef(0);
  const lastPeakTickRef = useRef(0);
  const startedAtRef = useRef(0);
  const hitsRef = useRef<SynthHit[]>([]);
  const voicesRef = useRef<Map<string, { osc: OscillatorNode; gain: GainNode; at: number }>>(new Map());
  const rafRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);
  const modeRef = useRef(mode);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const stopVoices = useCallback(() => {
    const ctx = contextRef.current;
    voicesRef.current.forEach((voice, id) => {
      try {
        voice.gain.gain.exponentialRampToValueAtTime(0.001, (ctx?.currentTime ?? 0) + 0.04);
        voice.osc.stop((ctx?.currentTime ?? 0) + 0.05);
      } catch {
        // already stopped
      }
      hitsRef.current.push({ padId: id, at: voice.at, holdMs: Math.max(40, Date.now() - voice.at) });
    });
    voicesRef.current.clear();
    setActivePad(null);
  }, []);

  const teardown = useCallback(() => {
    window.cancelAnimationFrame(rafRef.current);
    stopVoices();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (contextRef.current) {
      void contextRef.current.close().catch(() => undefined);
      contextRef.current = null;
    }
    destRef.current = null;
    analyserRef.current = null;
  }, [stopVoices]);

  useEffect(() => () => teardown(), [teardown]);

  const watchPeak = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i += 1) {
        peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
      }
      const now = Date.now();
      const dt = lastPeakTickRef.current ? now - lastPeakTickRef.current : 0;
      lastPeakTickRef.current = now;
      if (peak > 0.04) activeMsRef.current += dt;
      peakRef.current = Math.max(peakRef.current, peak);
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
  }, []);

  const startRecorder = useCallback((stream: MediaStream) => {
    const mime = pickMime();
    if (!mime || typeof MediaRecorder === 'undefined') return false;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.start();
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    activeMsRef.current = 0;
    lastPeakTickRef.current = 0;
    peakRef.current = 0;
    setRecording(true);
    return true;
  }, []);

  const bootSynth = useCallback(() => {
    const Ctor = audioContextCtor();
    if (!Ctor) {
      setMode('synth');
      onMode?.('synth');
      return;
    }
    const ctx = new Ctor();
    const dest = ctx.createMediaStreamDestination();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.connect(ctx.destination);
    contextRef.current = ctx;
    destRef.current = dest;
    analyserRef.current = analyser;
    startRecorder(dest.stream);
    watchPeak();
    setMode('synth');
    onMode?.('synth');
  }, [onMode, startRecorder, watchPeak]);

  const bootMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const Ctor = audioContextCtor();
      if (Ctor) {
        const ctx = new Ctor();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        contextRef.current = ctx;
        analyserRef.current = analyser;
        watchPeak();
      }
      startRecorder(stream);
      setMode('mic');
      onMode?.('mic');
    } catch {
      bootSynth();
    }
  }, [bootSynth, onMode, startRecorder, watchPeak]);

  useEffect(() => {
    if (preferredMode === 'synth') bootSynth();
    else void bootMic();
    // Remounted per round via key. Do not reboot when the parent learns the mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playPad = (pad: Pad) => {
    if (disabled || mode === 'pending') return;
    const Ctor = audioContextCtor();
    if (!Ctor) return;
    const ctx = contextRef.current ?? new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    contextRef.current = ctx;
    if (!destRef.current) {
      destRef.current = ctx.createMediaStreamDestination();
    }
    if (!analyserRef.current) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      watchPeak();
    }
    if (voicesRef.current.has(pad.id)) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = pad.type;
    osc.frequency.value = pad.freq;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.connect(destRef.current);
    gain.connect(analyserRef.current);
    osc.start();
    voicesRef.current.set(pad.id, { osc, gain, at: Date.now() });
    setActivePad(pad.id);
    if (!recording && !recorderRef.current) {
      startRecorder(destRef.current.stream);
    }
  };

  const releasePad = (padId: string) => {
    const voice = voicesRef.current.get(padId);
    if (!voice) return;
    const ctx = contextRef.current;
    try {
      voice.gain.gain.exponentialRampToValueAtTime(0.001, (ctx?.currentTime ?? 0) + 0.05);
      voice.osc.stop((ctx?.currentTime ?? 0) + 0.06);
    } catch {
      // already stopped
    }
    hitsRef.current.push({ padId, at: voice.at, holdMs: Math.max(40, Date.now() - voice.at) });
    voicesRef.current.delete(padId);
    setActivePad((current) => (current === padId ? null : current));
  };

  const snapshotNow = useCallback(
    (blobUrl: string | null): SoundSnapshot => ({
      audioMs: Math.max(activeMsRef.current, hitsRef.current.reduce((sum, hit) => sum + hit.holdMs, 0)),
      peakLevel: peakRef.current,
      padHits: hitsRef.current.length + voicesRef.current.size,
      blobUrl,
      usedMic: modeRef.current === 'mic',
      usedSynth: modeRef.current === 'synth' || hitsRef.current.length > 0,
      hits: hitsRef.current.slice(),
    }),
    [],
  );

  const finalize = useCallback(() => {
    stopVoices();
    return new Promise<SoundSnapshot>((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(snapshotNow(blobUrlRef.current));
        setRecording(false);
        return;
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = blob.size > 0 ? URL.createObjectURL(blob) : null;
        blobUrlRef.current = url;
        setRecording(false);
        resolve(snapshotNow(url));
      };
      try {
        recorder.stop();
      } catch {
        resolve(snapshotNow(blobUrlRef.current));
      }
    });
  }, [snapshotNow, stopVoices]);

  useImperativeHandle(ref, () => ({ finalize }), [finalize]);

  return (
    <div className="fgpt-tool px-3 py-3">
      <p className="text-[12px] leading-relaxed text-[var(--muted)]">
        {mode === 'pending'
          ? 'Asking the microphone… if it says no, the soundboard still works.'
          : mode === 'mic'
            ? recording
              ? 'Listening. Make the noise. Or tap a pad to layer a little extra chaos.'
              : 'Microphone ready. Make the noise.'
            : 'Microphone declined or missing. Use the soundboard — hold a pad, release to stop.'}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PADS.map((pad) => (
          <button
            key={pad.id}
            type="button"
            disabled={disabled || mode === 'pending'}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              playPad(pad);
            }}
            onPointerUp={() => releasePad(pad.id)}
            onPointerCancel={() => releasePad(pad.id)}
            className={`pressable rounded-2xl border px-3 py-3 text-left text-sm ${
              activePad === pad.id
                ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]'
                : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]'
            }`}
          >
            {pad.label}
          </button>
        ))}
      </div>
    </div>
  );
});

export default SoundPad;

export function replayHits(hits: SynthHit[]) {
  const Ctor = audioContextCtor();
  if (!Ctor || !hits.length) return;
  const ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  const start = ctx.currentTime + 0.02;
  const origin = Math.min(...hits.map((hit) => hit.at));
  for (const hit of hits) {
    const pad = PADS.find((item) => item.id === hit.padId);
    if (!pad) continue;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = pad.type;
    osc.frequency.value = pad.freq;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const when = start + Math.max(0, hit.at - origin) / 1000;
    const hold = Math.max(0.05, hit.holdMs / 1000);
    osc.start(when);
    gain.gain.setValueAtTime(0.08, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + hold);
    osc.stop(when + hold + 0.02);
  }
  window.setTimeout(() => void ctx.close().catch(() => undefined), 4000);
}

export { PADS };
