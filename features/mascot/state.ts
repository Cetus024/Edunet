'use client';

import { atom, useSetAtom } from 'jotai';
import { useCallback } from 'react';

export type MascotScene =
  | 'welcome'
  | 'growth'
  | 'study'
  | 'question'
  | 'success'
  | 'insight';

export type MascotFeedbackEvent =
  | { type: 'quizFinished'; score: number; total: number }
  | { type: 'rescueCompleted' }
  | { type: 'transcriptReady' }
  | { type: 'transcriptError' };

type MascotFeedback = {
  id: number;
  scene: MascotScene;
  message: string;
  durationMs: number;
};

export const mascotFeedbackAtom = atom<MascotFeedback | null>(null);
export const landingMascotSceneAtom = atom<MascotScene | null>(null);

let feedbackSequence = 0;

function feedbackForEvent(event: MascotFeedbackEvent): Omit<MascotFeedback, 'id'> {
  switch (event.type) {
    case 'quizFinished': {
      const perfect = event.total > 0 && event.score === event.total;
      return {
        scene: 'success',
        message: perfect
          ? `Perfect score — ${event.score} out of ${event.total}!`
          : `Quiz complete — ${event.score} out of ${event.total}. Keep weaving those connections!`,
        durationMs: 6000,
      };
    }
    case 'rescueCompleted':
      return {
        scene: 'success',
        message: 'Great save! Your squad streak is safe.',
        durationMs: 6000,
      };
    case 'transcriptReady':
      return {
        scene: 'success',
        message: 'Your transcript is ready to turn into stronger notes.',
        durationMs: 6000,
      };
    case 'transcriptError':
      return {
        scene: 'question',
        message: 'I could not finish that transcript. Check the microphone and try again.',
        durationMs: 7000,
      };
  }
}

export function useMascotFeedback() {
  const setFeedback = useSetAtom(mascotFeedbackAtom);
  const notify = useCallback(
    (event: MascotFeedbackEvent) => {
      feedbackSequence += 1;
      setFeedback({ id: feedbackSequence, ...feedbackForEvent(event) });
    },
    [setFeedback],
  );

  return { notify };
}

export function useLandingMascotScene() {
  const setLandingScene = useSetAtom(landingMascotSceneAtom);

  return useCallback(
    (scene: MascotScene | null) => {
      setLandingScene(scene);
    },
    [setLandingScene],
  );
}
