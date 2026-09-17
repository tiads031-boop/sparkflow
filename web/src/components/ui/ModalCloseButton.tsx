import { X } from 'lucide-react';

export default function ModalCloseButton({ onClick, label = '关闭' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--sf-bg)] text-[var(--sf-text-primary)] shadow-sm btn-press focus-ring"
    >
      <X size={20} />
    </button>
  );
}
