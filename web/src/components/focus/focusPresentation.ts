import type { PomodoroState } from '../../types';

export function formatFocusTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function focusRingProgress(state: Pick<PomodoroState, 'focusMode' | 'duration' | 'timeLeft'>) {
  if (state.focusMode === 'countup') {
    return Math.max(0, Math.min(1, (state.timeLeft % 3600) / 3600));
  }
  if (state.duration <= 0) return 0;
  return Math.max(0, Math.min(1, state.timeLeft / state.duration));
}

export function focusMinutes(seconds: number) {
  return Math.max(0, Math.round(seconds / 60));
}
