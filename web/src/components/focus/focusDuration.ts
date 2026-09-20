export const MIN_FOCUS_MINUTES = 5;
export const MAX_FOCUS_MINUTES = 180;
export const FOCUS_DRAG_STEP = 5;

export function clampFocusDuration(minutes: number) {
  if (!Number.isFinite(minutes)) return 25;
  return Math.min(MAX_FOCUS_MINUTES, Math.max(MIN_FOCUS_MINUTES, Math.round(minutes)));
}

export function durationFromPointer(
  pointerX: number,
  pointerY: number,
  centerX: number,
  centerY: number,
) {
  const radians = Math.atan2(pointerY - centerY, pointerX - centerX) + Math.PI / 2;
  const normalized = (radians + Math.PI * 2) % (Math.PI * 2);
  const raw = MIN_FOCUS_MINUTES
    + (normalized / (Math.PI * 2)) * (MAX_FOCUS_MINUTES - MIN_FOCUS_MINUTES);
  return clampFocusDuration(Math.round(raw / FOCUS_DRAG_STEP) * FOCUS_DRAG_STEP);
}

export function durationToDegrees(minutes: number) {
  const duration = clampFocusDuration(minutes);
  return ((duration - MIN_FOCUS_MINUTES) / (MAX_FOCUS_MINUTES - MIN_FOCUS_MINUTES)) * 360;
}
