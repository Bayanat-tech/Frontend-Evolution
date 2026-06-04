import { X } from "lucide-react";

type Props = {
  open:     boolean;
  title:    string;
  children: React.ReactNode;
  footer:   React.ReactNode;
  onClose:  () => void;
};

export function InboundFormFrame({ open, title, children, footer, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <div
        className="grid max-h-[92vh] w-[min(96vw,1280px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border bg-card text-card-foreground shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-card px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="h-7 w-1 rounded-full bg-primary" />
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                Inbound Job
              </p>
              <h2 className="m-0 text-lg font-bold text-foreground">{title}</h2>
            </div>
          </div>
          <button
            aria-label="Close"
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 overflow-y-auto overflow-x-hidden bg-muted/20 p-3 text-sm">
          {children}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t bg-card px-5 py-3">
          {footer}
        </div>
      </div>
    </div>
  );
}