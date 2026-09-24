'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type LiveTranscriptionStatus = 'idle' | 'connecting' | 'recording' | 'stopping' | 'error';

interface GatewaySession {
  token: string;
  websocketUrl: string;
  expiresAt: string;
}

interface GatewayMessage {
  type: 'ready' | 'partial' | 'final' | 'ended' | 'error';
  text?: string;
  code?: string;
  message?: string;
}

interface Deferred<T> {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
}

const WORKLET_PATH = '/audio/pcm16-worklet.js';
const STOP_TIMEOUT_MS = 8000;

function getGatewayUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_HUAWEI_SIS_GATEWAY_URL?.trim();
  if (!configuredUrl) {
    throw new Error('Huawei SIS gateway URL is not configured.');
  }
  return configuredUrl.replace(/\/$/, '');
}

function getGatewayError(status: number, payload: unknown): string {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object' && 'message' in detail) {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
  }
  return `Huawei SIS gateway returned HTTP ${status}.`;
}

function getMicrophoneError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Microphone permission was denied.';
    if (error.name === 'NotFoundError') return 'No microphone was found.';
    if (error.name === 'NotReadableError') return 'The microphone is already in use by another application.';
  }
  return error instanceof Error ? error.message : 'Unable to start live transcription.';
}

export function useLiveTranscription() {
  const [status, setStatus] = useState<LiveTranscriptionStatus>('idle');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const statusRef = useRef<LiveTranscriptionStatus>('idle');
  const finalTranscriptRef = useRef('');
  const websocketRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const muteNodeRef = useRef<GainNode | null>(null);
  const canSendAudioRef = useRef(false);
  const mountedRef = useRef(true);
  const startDeferredRef = useRef<Deferred<void> | null>(null);
  const stopDeferredRef = useRef<Deferred<string> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateStatus = useCallback((nextStatus: LiveTranscriptionStatus) => {
    statusRef.current = nextStatus;
    if (mountedRef.current) setStatus(nextStatus);
  }, []);

  const releaseAudio = useCallback(() => {
    canSendAudioRef.current = false;

    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    muteNodeRef.current?.disconnect();
    muteNodeRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close();
    }
  }, []);

  const closeSocket = useCallback(() => {
    const websocket = websocketRef.current;
    websocketRef.current = null;
    if (!websocket) return;

    websocket.onopen = null;
    websocket.onmessage = null;
    websocket.onerror = null;
    websocket.onclose = null;
    if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
      websocket.close();
    }
  }, []);

  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  const fail = useCallback((message: string) => {
    const failure = new Error(message);
    releaseAudio();
    closeSocket();
    clearStopTimer();
    startDeferredRef.current?.reject(failure);
    startDeferredRef.current = null;
    stopDeferredRef.current?.reject(failure);
    stopDeferredRef.current = null;
    if (mountedRef.current) setError(message);
    updateStatus('error');
  }, [clearStopTimer, closeSocket, releaseAudio, updateStatus]);

  const finishSession = useCallback(() => {
    releaseAudio();
    closeSocket();
    clearStopTimer();
    if (mountedRef.current) setInterimTranscript('');
    updateStatus('idle');
    stopDeferredRef.current?.resolve(finalTranscriptRef.current);
    stopDeferredRef.current = null;
  }, [clearStopTimer, closeSocket, releaseAudio, updateStatus]);

  const handleGatewayMessage = useCallback((message: GatewayMessage) => {
    if (message.type === 'ready') {
      canSendAudioRef.current = true;
      updateStatus('recording');
      startDeferredRef.current?.resolve();
      startDeferredRef.current = null;
      return;
    }

    if (message.type === 'partial') {
      if (mountedRef.current) setInterimTranscript(message.text?.trim() ?? '');
      return;
    }

    if (message.type === 'final') {
      const text = message.text?.trim();
      if (!text) return;
      const previous = finalTranscriptRef.current;
      const nextTranscript = previous ? `${previous} ${text}` : text;
      finalTranscriptRef.current = nextTranscript;
      if (mountedRef.current) {
        setFinalTranscript(nextTranscript);
        setInterimTranscript('');
      }
      return;
    }

    if (message.type === 'ended') {
      finishSession();
      return;
    }

    fail(message.message ?? message.code ?? 'Huawei SIS transcription failed.');
  }, [fail, finishSession, updateStatus]);

  const start = useCallback(async (): Promise<void> => {
    if (!['idle', 'error'].includes(statusRef.current)) {
      throw new Error('A transcription session is already active.');
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') {
      throw new Error('This browser does not support live microphone transcription.');
    }

    releaseAudio();
    closeSocket();
    clearStopTimer();
    setError(null);
    setFinalTranscript('');
    setInterimTranscript('');
    setElapsedSeconds(0);
    finalTranscriptRef.current = '';
    updateStatus('connecting');

    try {
      const gatewayUrl = getGatewayUrl();
      const response = await fetch(`${gatewayUrl}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'en' }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getGatewayError(response.status, payload));
      const session = payload as GatewaySession;
      if (!session.websocketUrl || !session.token) {
        throw new Error('Huawei SIS gateway returned an invalid session.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = mediaStream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      await audioContext.audioWorklet.addModule(WORKLET_PATH);
      await audioContext.resume();

      const sourceNode = audioContext.createMediaStreamSource(mediaStream);
      const workletNode = new AudioWorkletNode(audioContext, 'pcm16-chunker');
      const muteNode = audioContext.createGain();
      muteNode.gain.value = 0;
      sourceNode.connect(workletNode);
      workletNode.connect(muteNode);
      muteNode.connect(audioContext.destination);
      sourceNodeRef.current = sourceNode;
      workletNodeRef.current = workletNode;
      muteNodeRef.current = muteNode;

      const websocketUrl = new URL(session.websocketUrl);
      websocketUrl.searchParams.set('token', session.token);
      const websocket = new WebSocket(websocketUrl);
      websocket.binaryType = 'arraybuffer';
      websocketRef.current = websocket;

      workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (canSendAudioRef.current && websocket.readyState === WebSocket.OPEN) {
          websocket.send(event.data);
        }
      };

      const readyPromise = new Promise<void>((resolve, reject) => {
        startDeferredRef.current = { resolve, reject };
      });

      websocket.onopen = () => {
        websocket.send(JSON.stringify({ type: 'start', language: 'en' }));
      };
      websocket.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        try {
          handleGatewayMessage(JSON.parse(event.data) as GatewayMessage);
        } catch {
          fail('Huawei SIS gateway returned an invalid message.');
        }
      };
      websocket.onerror = () => fail('Unable to connect to the Huawei SIS gateway.');
      websocket.onclose = () => {
        if (statusRef.current === 'stopping') {
          finishSession();
        } else if (statusRef.current !== 'idle' && statusRef.current !== 'error') {
          fail('The Huawei SIS gateway connection closed unexpectedly.');
        }
      };

      await readyPromise;
    } catch (startError) {
      const message = getMicrophoneError(startError);
      if (statusRef.current !== 'error') fail(message);
      throw new Error(message);
    }
  }, [clearStopTimer, closeSocket, fail, finishSession, handleGatewayMessage, releaseAudio, updateStatus]);

  const stop = useCallback(async (): Promise<string> => {
    if (statusRef.current !== 'recording') {
      throw new Error('No transcription session is currently recording.');
    }

    updateStatus('stopping');
    releaseAudio();
    const websocket = websocketRef.current;
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      fail('The Huawei SIS gateway is no longer connected.');
      throw new Error('The Huawei SIS gateway is no longer connected.');
    }

    const stopped = new Promise<string>((resolve, reject) => {
      stopDeferredRef.current = { resolve, reject };
    });
    websocket.send(JSON.stringify({ type: 'stop' }));
    stopTimerRef.current = setTimeout(() => {
      finishSession();
    }, STOP_TIMEOUT_MS);
    return stopped;
  }, [fail, finishSession, releaseAudio, updateStatus]);

  useEffect(() => {
    if (status !== 'recording') return;
    const timer = setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    const endActiveSession = () => {
      const websocket = websocketRef.current;
      if (statusRef.current === 'recording' && websocket?.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: 'stop' }));
      }
      releaseAudio();
      closeSocket();
      clearStopTimer();
    };

    window.addEventListener('beforeunload', endActiveSession);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('beforeunload', endActiveSession);
      endActiveSession();
    };
  }, [clearStopTimer, closeSocket, releaseAudio]);

  const reset = useCallback(() => {
    if (!['idle', 'error'].includes(statusRef.current)) return;
    finalTranscriptRef.current = '';
    setFinalTranscript('');
    setInterimTranscript('');
    setElapsedSeconds(0);
    setError(null);
    updateStatus('idle');
  }, [updateStatus]);

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
