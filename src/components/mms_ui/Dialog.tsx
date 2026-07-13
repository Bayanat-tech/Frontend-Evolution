import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

type DialogMaxWidth = 'xs' | 'sm' | 'md' | 'lg';

const maxWidthClasses: Record<DialogMaxWidth, string> = {
  xs: 'max-w-[444px]',
  sm: 'max-w-[600px]',
  md: 'max-w-[900px]',
  lg: 'max-w-[1200px]'
};

type DialogProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  fullWidth?: boolean;
  fullScreen?: boolean;
  maxWidth?: DialogMaxWidth;
  /** Extra classes applied to the dialog panel — use to replicate MUI PaperProps.sx sizing */
  paperClassName?: string;
};

/**
 * Modal dialog shell — replaces MUI <Dialog />.
 * Renders a centered panel over a dim backdrop; closes on backdrop click.
 */
const Dialog = ({ open, onClose, children, fullWidth, fullScreen, maxWidth = 'sm', paperClassName }: DialogProps) => {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4" role="presentation">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative bg-white shadow-2xl flex flex-col',
          fullScreen ? 'w-full h-full rounded-none' : cn('w-full rounded-lg max-h-[90vh]', maxWidthClasses[maxWidth]),
          fullWidth && !fullScreen && 'w-full',
          paperClassName
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export default Dialog;

export const DialogTitle = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h2 className={cn('px-6 pt-5 pb-2 text-lg font-bold text-[#1f2f43]', className)}>{children}</h2>
);

export const DialogContent = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('px-6 flex-1 overflow-y-auto', className)}>{children}</div>
);

export const DialogContentText = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn('text-sm text-[#4b5563]', className)}>{children}</p>
);

export const DialogActions = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('px-4 pb-4 pt-3 flex items-center justify-end gap-2', className)}>{children}</div>
);
