import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../lib/utils";

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  tone?: "default" | "danger";
  compact?: boolean;
  wide?: boolean;
  contentClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export function Dialog({
  open,
  title,
  description,
  tone = "default",
  compact,
  wide,
  contentClassName,
  children,
  footer,
  onClose,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex='0']") || []);
    (focusable()[0] || dialogRef.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== dialogRef.current) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key === "Tab") {
        const items = focusable(), first = items[0], last = items[items.length - 1];
        if (!first) { event.preventDefault(); dialogRef.current?.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [open]);
  if (!open) return null;
  const editorDialog = wide || /^(add|edit|new|view)\b/i.test(title);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] grid place-items-center p-5 backdrop-blur-[1px]",
        editorDialog ? "bg-background/95" : "bg-slate-950/50",
      )}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          // ← restored: rounded, border, bg, shadow, max-h, overflow-hidden
          "grid max-h-[94vh] w-[min(96vw,560px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-card text-card-foreground shadow-2xl",
          compact && "w-[min(94vw,460px)]",
          wide && "h-[min(96vh,920px)] w-[min(98vw,1440px)]",
          editorDialog && !compact && !wide && "w-[min(96vw,920px)]",
          contentClassName,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-start justify-between gap-4 border-b bg-secondary/70 p-4",
            tone === "danger" && "[&_h2]:text-destructive",
          )}
        >
          <div>
            <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <Button aria-label="Close" type="button" variant="ghost" size="icon" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

{/* Body — scrollable so content never bleeds outside the modal */}
<div className="min-h-0 overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
  {children}
</div>
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t bg-secondary/40 p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
