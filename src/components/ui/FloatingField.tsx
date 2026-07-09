import { ReactNode } from 'react';

type Props = {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function FloatingField({ label, required, children, className }: Props) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <span className="absolute -top-2 left-3 z-10 bg-background px-1 text-[11px] text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </div>
  );
}

export const floatingInputClass =
  'h-11 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50';

export const floatingTextareaClass =
  'min-h-[90px] w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none';