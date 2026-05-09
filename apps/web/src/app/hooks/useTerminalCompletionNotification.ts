import { useCallback, useEffect, useRef } from "react";

import {
  type TerminalCompletionSoundId,
  buildTerminalCompletionSoundDataUrl,
} from "../notificationSounds";
import type { TerminalRuntimeStateStore } from "../terminalRuntimeStateStore";

const createCompletionAudio = (soundId: TerminalCompletionSoundId): HTMLAudioElement | null => {
  if (soundId === "silent" || typeof Audio === "undefined") {
    return null;
  }

  if (import.meta.env.MODE === "test" && !("mock" in Audio)) {
    return null;
  }

  const source = buildTerminalCompletionSoundDataUrl(soundId);
  if (!source) {
    return null;
  }

  const audio = new Audio(source);
  audio.preload = "auto";
  return audio;
};

export const useTerminalCompletionNotification = (
  runtimeStateStore: TerminalRuntimeStateStore,
  selectedSound: TerminalCompletionSoundId,
) => {
  const previousTerminalStatesRef = useRef(runtimeStateStore.getSnapshot());
  const audioCacheRef = useRef<Partial<Record<TerminalCompletionSoundId, HTMLAudioElement | null>>>(
    {},
  );

  const playCompletionSound = useCallback((soundId: TerminalCompletionSoundId) => {
    if (soundId === "silent") {
      return;
    }

    if (audioCacheRef.current[soundId] === undefined) {
      audioCacheRef.current[soundId] = createCompletionAudio(soundId);
    }

    const audio = audioCacheRef.current[soundId];
    if (!audio) {
      return;
    }

    audio.currentTime = 0;
    try {
      const playResult = audio.play();
      if (typeof playResult?.catch === "function") {
        void playResult.catch(() => {
          // Browsers can block untrusted audio playback; ignore and keep UI responsive.
        });
      }
    } catch {
      // Some environments throw synchronously for media playback; ignore.
    }
  }, []);

  useEffect(() => {
    previousTerminalStatesRef.current = runtimeStateStore.getSnapshot();

    return runtimeStateStore.subscribe(() => {
      const previousTerminalStates = previousTerminalStatesRef.current;
      const nextTerminalStates = runtimeStateStore.getSnapshot();
      const shouldPlayCompletionSound = Object.entries(nextTerminalStates).some(
        ([terminalId, state]) =>
          previousTerminalStates[terminalId]?.state === "processing" && state.state === "idle",
      );

      previousTerminalStatesRef.current = nextTerminalStates;
      if (!shouldPlayCompletionSound) {
        return;
      }

      playCompletionSound(selectedSound);
    });
  }, [playCompletionSound, runtimeStateStore, selectedSound]);

  const playCompletionSoundPreview = useCallback(
    (soundId?: TerminalCompletionSoundId) => {
      playCompletionSound(soundId ?? selectedSound);
    },
    [playCompletionSound, selectedSound],
  );

  return {
    playCompletionSoundPreview,
  };
};
