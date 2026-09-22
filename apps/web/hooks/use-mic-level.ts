'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Live microphone input level, from a second audio stream opened alongside
 * speech recognition.
 *
 * This exists because the Web Speech API reports recognised *words* and nothing
 * about the audio behind them. When nothing appears on screen, "the microphone
 * is muted" and "the recogniser cannot make out what you said" look identical —
 * and they need opposite fixes. A real level meter separates them: sound moving
 * with no text means the recogniser is struggling; a flat meter means the audio
 * never arrived.
 *
 * Failing to open the stream is not treated as an error. Recognition owns the
 * microphone that matters, so a browser that refuses a second capture should
 * cost the meter, never the session — `available` goes false and the caller
 * hides the meter.
 */
export function useMicLevel(active: boolean) {
  const [level, setLevel] = useState(0);
  const [available, setAvailable] = useState<boolean | null>(null);
  const levelRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setLevel(0);
      return undefined;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let frame: number | null = null;
    let pump: ReturnType<typeof setInterval> | null = null;

    const startMeter = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const samples = new Uint8Array(analyser.frequencyBinCount);
        setAvailable(true);

        const measure = () => {
          analyser.getByteTimeDomainData(samples);
          let peak = 0;
          for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128));
          // 128 is silence and 255 is clipping; 64 lands normal speech near the
          // top of the bar without a raised voice pinning it there.
          levelRef.current = Math.min(1, peak / 64);
          frame = requestAnimationFrame(measure);
        };
        measure();

        // The analyser is sampled every frame, but React is told 12 times a
        // second. Re-rendering at 60fps to move a bar is waste that shows up as
        // dropped frames on a phone.
        pump = setInterval(() => setLevel(levelRef.current), 80);
      } catch {
        if (!cancelled) setAvailable(false);
      }
    };

    void startMeter();

    return () => {
      cancelled = true;
      if (frame !== null) cancelAnimationFrame(frame);
      if (pump !== null) clearInterval(pump);
      void context?.close().catch(() => {});
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active]);

  return { level, available };
}
