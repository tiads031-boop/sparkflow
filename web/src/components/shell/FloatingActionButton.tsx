import { Plus } from 'lucide-react';
import { useRef } from 'react';

const LONG_PRESS_MS = 520;

export default function FloatingActionButton({
  onPress,
  onLongPress,
}: {
  onPress: () => void;
  onLongPress: () => void;
}) {
  const timerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const startPress = () => {
    longPressedRef.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      onLongPress();
      navigator.vibrate?.(35);
    }, LONG_PRESS_MS);
  };

  const finishPress = () => {
    clearTimer();
    if (!longPressedRef.current) onPress();
  };

  return (
    <button
      type="button"
      aria-label="快速新建；长按语音 AI 规划"
      title="短按快速新建，长按语音 AI 规划"
      onPointerDown={startPress}
      onPointerUp={finishPress}
      onPointerCancel={clearTimer}
      onClick={(event) => {
        if (event.detail === 0) onPress();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') clearTimer();
      }}
      onContextMenu={(event) => event.preventDefault()}
      className="fixed z-[45] grid h-14 w-14 touch-none select-none place-items-center rounded-full bg-[var(--sf-text-primary)] text-[var(--sf-surface)] shadow-[0_10px_30px_rgba(0,0,0,0.24)] transition-transform active:scale-95"
      style={{
        right: 'max(20px, calc((100vw - 32rem) / 2 + 20px))',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
      }}
    >
      <Plus size={25} strokeWidth={2.6} />
    </button>
  );
}
