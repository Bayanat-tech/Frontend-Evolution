import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

type MenuProps = {
  open: boolean;
  anchorRect: DOMRect | null;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

/**
 * Lightweight positioned dropdown — replaces MUI <Menu anchorEl=.../>.
 * Position it under the element that opened it by passing that element's
 * `getBoundingClientRect()` result as `anchorRect`.
 */
const Menu = ({ open, anchorRect, onClose, children, className }: MenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickAway = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, [open, onClose]);

  if (!open || !anchorRect) return null;

  return createPortal(
    <div
      ref={menuRef}
      className={cn(
        'fixed z-[1400] min-w-[160px] bg-white rounded-md shadow-lg border border-[#e5e7eb] py-1',
        className
      )}
      style={{ top: anchorRect.bottom + 4, left: anchorRect.left }}
    >
      {children}
    </div>,
    document.body
  );
};

export default Menu;

export const MenuItem = ({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn('w-full text-left px-4 py-2 text-sm text-[#243447] hover:bg-[#f4f7fb] transition-colors', className)}
  >
    {children}
  </button>
);
