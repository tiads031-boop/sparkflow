import { useEffect, useRef } from 'react';

interface OverlayEntry {
  id: symbol;
  close: () => void;
  isolateAppMain: boolean;
  restoreFocus: HTMLElement | null;
}

const overlayStack: OverlayEntry[] = [];
let previousBodyOverflow = '';
let previousMainOverflow = '';
let nativeBackRemove: (() => Promise<void>) | null = null;
let nativeBackInstalling = false;

function appMain() {
  return document.querySelector<HTMLElement>('[data-sf-app-main]');
}

function topOverlay() {
  return overlayStack.at(-1);
}

function syncAppIsolation() {
  const main = appMain();
  if (!main) return;
  const isolate = overlayStack.some((entry) => entry.isolateAppMain);
  if (isolate) main.setAttribute('inert', '');
  else main.removeAttribute('inert');
}

function closeTopOverlay() {
  topOverlay()?.close();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !topOverlay()) return;
  event.preventDefault();
  event.stopPropagation();
  closeTopOverlay();
}

function lockAppScroll() {
  if (overlayStack.length !== 1) return;
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const main = appMain();
  if (main) {
    previousMainOverflow = main.style.overflow;
    main.style.overflow = 'hidden';
  }
  window.addEventListener('keydown', onKeyDown);
}

function unlockAppScroll() {
  if (overlayStack.length !== 0) return;
  document.body.style.overflow = previousBodyOverflow;
  const main = appMain();
  if (main) {
    main.style.overflow = previousMainOverflow;
    main.removeAttribute('inert');
  }
  window.removeEventListener('keydown', onKeyDown);
}

async function ensureNativeBackListener() {
  if (nativeBackRemove || nativeBackInstalling || overlayStack.length === 0) return;
  nativeBackInstalling = true;
  try {
    const { App } = await import('@capacitor/app');
    const listener = await App.addListener('backButton', () => closeTopOverlay());
    if (overlayStack.length === 0) {
      await listener.remove();
      return;
    }
    nativeBackRemove = listener.remove;
  } catch {
    // Browser/PWA builds do not need a native back-button listener.
  } finally {
    nativeBackInstalling = false;
  }
}

function maybeRemoveNativeBackListener() {
  if (overlayStack.length !== 0 || !nativeBackRemove) return;
  const remove = nativeBackRemove;
  nativeBackRemove = null;
  void remove();
}

/**
 * Keeps modal behaviour consistent across browser and Capacitor builds.
 *
 * Open overlays join one global stack so Escape / Android Back only closes the
 * top-most dialog. The app's actual scroll container is locked while any
 * overlay is open. Portal-based overlays may additionally isolate the app main
 * tree from keyboard/screen-reader focus via `isolateAppMain`.
 */
export function useModalLifecycle(
  open: boolean,
  onClose: () => void,
  options: { isolateAppMain?: boolean } = {},
) {
  const onCloseRef = useRef(onClose);
  const isolateRef = useRef(Boolean(options.isolateAppMain));
  useEffect(() => {
    onCloseRef.current = onClose;
    isolateRef.current = Boolean(options.isolateAppMain);
  }, [onClose, options.isolateAppMain]);

  useEffect(() => {
    if (!open) return;

    const entry: OverlayEntry = {
      id: Symbol('sparkflow-overlay'),
      close: () => onCloseRef.current(),
      isolateAppMain: isolateRef.current,
      restoreFocus: document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    };

    overlayStack.push(entry);
    lockAppScroll();
    syncAppIsolation();
    void ensureNativeBackListener();

    return () => {
      const index = overlayStack.findIndex((candidate) => candidate.id === entry.id);
      if (index >= 0) overlayStack.splice(index, 1);
      syncAppIsolation();
      unlockAppScroll();
      maybeRemoveNativeBackListener();

      if (entry.restoreFocus?.isConnected) {
        window.setTimeout(() => entry.restoreFocus?.focus({ preventScroll: true }), 0);
      }
    };
  }, [open]);
}
