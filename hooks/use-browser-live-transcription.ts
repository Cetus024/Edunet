'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveTranscriptionStatus } from '@/hooks/use-live-transcription';

interface BrowserSpeechAlternative {
  transcript: string;
}

interface BrowserSpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: BrowserSpeechAlternative;
}

interface BrowserSpeechResultList {
  readonly length: number;
  readonly [index: number]: BrowserSpeechResult;
}

interface BrowserSpeechResultEvent extends Event {
  readonly resultIndex: number;
  readonly results: BrowserSpeechResultList;
}

interface BrowserSpeechErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechResultEvent) => void) | null;
  onerror: ((event: BrowserSpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

interface Deferred<T> {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
}

const STOP_TIMEOUT_MS = 5000;
const RESTART_DELAY_MS = 150;

function getRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function getRecognitionError(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone or browser speech recognition permission was denied.';
    case 'audio-capture':
      return 'No working microphone was found.';
    case 'network':
      return 'The browser speech recognition service is unavailable. Check your connection.';
    case 'language-not-supported':
      return 'That language is not supported by this browser\'s speech recognition.';
    default:
      return 'Browser speech recognition stopped unexpectedly.';
  }
}

export function useBrowserLiveTranscription() {
  const [status, setStatus] = useState<LiveTranscriptionStatus>('idle');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const statusRef = useRef<LiveTranscriptionStatus>('idle');
  const finalTranscriptRef = useRef('');
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);
  const mountedRef = useRef(true);
  const startDeferredRef = useRef<Deferred<void> | null>(null);
  const stopDeferredRef = useRef<Deferred<string> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateStatus = useCallback((nextStatus: LiveTranscriptionStatus) => {
    statusRef.current = nextStatus;
    if (mountedRef.current) setStatus(nextStatus);
  }, []);

  const clearTimers = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    stopTimerRef.current = null;
    restartTimerRef.current = null;
  }, []);

  const disposeRecognition = useCallback((abort = false) => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    if (abort) {
      try {
        recognition.abort();
      } catch {
        // The browser may already have ended the recognition session.
      }
    }
  }, []);

  const finish = useCallback(() => {
    shouldRestartRef.current = false;
    clearTimers();
    disposeRecognition();
    if (mountedRef.current) setInterimTranscript('');
    updateStatus('idle');
    stopDeferredRef.current?.resolve(finalTranscriptRef.current);
    stopDeferredRef.current = null;
  }, [clearTimers, disposeRecognition, updateStatus]);

  const fail = useCallback((message: string) => {
    const failure = new Error(message);
    shouldRestartRef.current = false;
    clearTimers();
    disposeRecognition(true);
    startDeferredRef.current?.reject(failure);
    startDeferredRef.current = null;
    stopDeferredRef.current?.reject(failure);
    stopDeferredRef.current = null;
    if (mountedRef.current) {
      setError(message);
      setInterimTranscript('');
    }
    updateStatus('error');
  }, [clearTimers, disposeRecognition, updateStatus]);

  const appendFinal = useCallback((text: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    const previous = finalTranscriptRef.current;
    const nextTranscript = previous ? `${previous} ${cleanText}` : cleanText;
    finalTranscriptRef.current = nextTranscript;
    if (mountedRef.current) setFinalTranscript(nextTranscript);
  }, []);

  const configureRecognition = useCallback((recognition: BrowserSpeechRecognition, lang: string) => {
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      updateStatus('recording');
      startDeferredRef.current?.resolve();
      startDeferredRef.current = null;
    };

    recognition.onresult = (event) => {
      let currentInterim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript?.trim() ?? '';
        if (!text) continue;
        if (result.isFinal) appendFinal(text);
        else currentInterim = currentInterim ? `${currentInterim} ${text}` : text;
      }
      if (mountedRef.current) setInterimTranscript(currentInterim);
    };

    recognition.onerror = (recognitionError) => {
      if (recognitionError.error === 'no-speech') {
        if (mountedRef.current) setInterimTranscript('');
        return;
      }
      if (recognitionError.error === 'aborted' && !shouldRestartRef.current) return;
      fail(getRecognitionError(recognitionError.error));
    };

    recognition.onend = () => {
      if (statusRef.current === 'stopping') {
        finish();
        return;
      }
      if (!shouldRestartRef.current || statusRef.current !== 'recording') return;
      restartTimerRef.current = setTimeout(() => {
        try {
          recognition.start();
        } catch {
          fail('The browser could not resume speech recognition.');
        }
      }, RESTART_DELAY_MS);
    };
  }, [appendFinal, fail, finish, updateStatus]);

  const start = useCallback(async (lang: string = 'en-SG'): Promise<void> => {
    if (!['idle', 'error'].includes(statusRef.current)) {
      throw new Error('A transcription session is already active.');
    }
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      const message = 'Live transcription requires a supported Chrome or Edge browser.';
      fail(message);
      throw new Error(message);
    }

    clearTimers();
    disposeRecognition(true);
    setError(null);
    setFinalTranscript('');
    setInterimTranscript('');
    setElapsedSeconds(0);
    finalTranscriptRef.current = '';
    shouldRestartRef.current = true;
    updateStatus('connecting');

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    configureRecognition(recognition, lang);
    const started = new Promise<void>((resolve, reject) => {
      startDeferredRef.current = { resolve, reject };
    });

    try {
      recognition.start();
      await started;
    } catch (startError) {
      const message = startError instanceof Error
        ? startError.message
        : 'Unable to start browser speech recognition.';
      if (statusRef.current !== 'error') fail(message);
      throw new Error(message);
    }
  }, [clearTimers, configureRecognition, disposeRecognition, fail, updateStatus]);

  const stop = useCallback(async (): Promise<string> => {
    if (statusRef.current !== 'recording' || !recognitionRef.current) {
      throw new Error('No transcription session is currently recording.');
    }
    shouldRestartRef.current = false;
    updateStatus('stopping');
    if (mountedRef.current) setInterimTranscript('');

    const stopped = new Promise<string>((resolve, reject) => {
      stopDeferredRef.current = { resolve, reject };
    });
    try {
      recognitionRef.current.stop();
    } catch {
      finish();
    }
    stopTimerRef.current = setTimeout(finish, STOP_TIMEOUT_MS);
    return stopped;
  }, [finish, updateStatus]);

  const reset = useCallback(() => {
    if (!['idle', 'error'].includes(statusRef.current)) return;
    finalTranscriptRef.current = '';
    setFinalTranscript('');
    setInterimTranscript('');
    setElapsedSeconds(0);
    setError(null);
    updateStatus('idle');
  }, [updateStatus]);

  useEffect(() => {
    if (status !== 'recording') return;
    const timer = setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    const abortActiveSession = () => {
      shouldRestartRef.current = false;
      clearTimers();
      disposeRecognition(true);
    };
    window.addEventListener('beforeunload', abortActiveSession);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('beforeunload', abortActiveSession);
      abortActiveSession();
    };
  }, [clearTimers, disposeRecognition]);

  return {
    status,
    finalTranscript,
    interimTranscript,
    elapsedSeconds,
    error,
    start,
    stop,
    reset,
  };
}

