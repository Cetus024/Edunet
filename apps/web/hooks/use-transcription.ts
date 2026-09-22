'use client';

import { useBrowserLiveTranscription } from '@/hooks/use-browser-live-transcription';
import { useLiveTranscription as useHuaweiLiveTranscription } from '@/hooks/use-live-transcription';

export type TranscriptionProvider = 'browser' | 'huawei';

function getTranscriptionProvider(): TranscriptionProvider {
  return process.env.NEXT_PUBLIC_TRANSCRIPTION_PROVIDER?.trim().toLowerCase() === 'huawei'
    ? 'huawei'
    : 'browser';
}

export function useTranscription() {
  const browserTranscription = useBrowserLiveTranscription();
  const huaweiTranscription = useHuaweiLiveTranscription();
  const provider = getTranscriptionProvider();

  return {
    ...(provider === 'huawei' ? huaweiTranscription : browserTranscription),
    provider,
  };
}

