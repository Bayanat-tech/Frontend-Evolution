import { ReactNode } from "react";
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
  if (!open) return null;
  const editorDialog = wide || /^(add|edit|new|view)\b/i.test(title);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 grid place-items-center p-5 backdrop-blur-[1px]",
        editorDialog ? "bg-background/95" : "bg-slate-950/50",
      )}
      onClick={onClose}
    >
      <div
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
