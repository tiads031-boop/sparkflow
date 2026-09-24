import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalLifecycle } from '../../ui/useModalLifecycle';

export default function SceneDialog({ title, onClose, busy = false, children, footer }: {
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
  footer: ReactNode;
}) {
  const requestClose = () => { if (!busy) onClose(); };
  useModalLifecycle(true, requestClose, { isolateAppMain: true });

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/45 sm:items-center sm:p-5"
      role="presentation" onPointerDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}>
      <section role="dialog" aria-modal="true" aria-label={title}
        className="flex max-h-[min(92dvh,820px)] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-[var(--sf-surface)] text-[var(--sf-text-primary)] shadow-2xl sm:rounded-[28px]">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--sf-border)] sm:hidden" aria-hidden="true" />
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--sf-divider)] px-5 py-4">
          <h2 className="min-w-0 text-lg font-black">{title}</h2>
          <button type="button" onClick={requestClose} disabled={busy} aria-label="关闭"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--sf-bg)] disabled:opacity-40">
            <X size={17} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
        <footer className="shrink-0 border-t border-[var(--sf-divider)] bg-[var(--sf-surface)] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3">
          {footer}
        </footer>
      </section>
    </div>,
    document.body,
  );
}
