import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getPlanningVoiceStatus,
  transcribePlanningAudio,
} from '../api/planning';

export type PlanningVoiceState = 'idle' | 'recording' | 'transcribing';

const MAX_RECORDING_MS = 120_000;

function preferredMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const type of [
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/webm',
  ]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function usePlanningVoiceInput(onTranscript: (text: string) => void) {
  const [state, setState] = useState<PlanningVoiceState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const cancelledRef = useRef(false);
  const startedAtRef = useRef(0);
  const stopTimerRef = useRef<number | null>(null);

  const browserSupported = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof MediaRecorder !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia),
    [],
  );

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!browserSupported) {
      setConfigured(false);
      return;
    }
    let active = true;
    getPlanningVoiceStatus()
      .then((result) => {
        if (active) setConfigured(result.configured);
      })
      .catch(() => {
        if (active) setConfigured(false);
      });
    return () => {
      active = false;
    };
  }, [browserSupported]);

  useEffect(() => {
    if (state !== 'recording') return;
    const timer = window.setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      try {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      } catch {
        // no-op during unmount
      }
      cleanupStream();
    },
    [cleanupStream],
  );

  const finishRecording = useCallback(async (blob: Blob) => {
    cleanupStream();
    setSeconds(0);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setState('idle');
      return;
    }

    setState('transcribing');
    try {
      const result = await transcribePlanningAudio(blob);
      onTranscript(result.text);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '语音转写失败，请重试');
    } finally {
      setState('idle');
    }
  }, [cleanupStream, onTranscript]);

  const start = useCallback(async () => {
    if (!browserSupported || configured === false || state !== 'idle') return;
    setError(null);
    cancelledRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const mimeType = preferredMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64_000 })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        });
        chunksRef.current = [];
        void finishRecording(blob);
      }, { once: true });

      recorder.start(500);
      startedAtRef.current = Date.now();
      setSeconds(0);
      setState('recording');
      stopTimerRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, MAX_RECORDING_MS);
    } catch (err) {
      cleanupStream();
      const denied = err instanceof DOMException && (
        err.name === 'NotAllowedError' ||
        err.name === 'SecurityError'
      );
      setError(denied ? '没有麦克风权限，你仍可以继续用文字输入。' : '无法开始录音，请检查麦克风。');
      setState('idle');
    }
  }, [browserSupported, configured, state, finishRecording, cleanupStream]);

  const stop = useCallback(() => {
    if (state !== 'recording') return;
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
  }, [state]);

  const cancel = useCallback(() => {
    if (state !== 'recording') return;
    cancelledRef.current = true;
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
    else cleanupStream();
  }, [state, cleanupStream]);

  return {
    state,
    seconds,
    error,
    configured,
    supported: browserSupported && configured !== false,
    start,
    stop,
    cancel,
    clearError: () => setError(null),
  };
}
