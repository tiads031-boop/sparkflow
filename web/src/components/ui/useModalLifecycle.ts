import { useEffect, useRef } from 'react';

let bodyLockCount = 0;
let previousBodyOverflow = '';

function lockBodyScroll() {
  if (bodyLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyLockCount += 1;
}

function unlockBodyScroll() {
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  if (bodyLockCount === 0) document.body.style.overflow = previousBodyOverflow;
}

/**
 * Keeps modal behaviour consistent across browser and Capacitor builds.
 * In addition to Escape, Android's hardware back button closes the top-level
 * dialog instead of leaving an invisible backdrop over the app.
 */
export function useModalLifecycle(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    let disposed = false;
    let removeNativeBackListener: (() => Promise<void>) | undefined;
    const close = () => onCloseRef.current();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };

    lockBodyScroll();
    window.addEventListener('keydown', onKeyDown);

    void import('@capacitor/app')
      .then(async ({ App }) => {
        const listener = await App.addListener('backButton', close);
        if (disposed) {
          await listener.remove();
          return;
        }
        removeNativeBackListener = listener.remove;
      })
      .catch(() => {
        // Browser/PWA builds do not need a native back-button listener.
      });

    return () => {
      disposed = true;
      window.removeEventListener('keydown', onKeyDown);
      unlockBodyScroll();
      void removeNativeBackListener?.();
    };
  }, [open]);
}
