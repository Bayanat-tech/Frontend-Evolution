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
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export function Dialog({ open, title, description, tone = "default", compact, wide, children, footer, onClose }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-5 backdrop-blur-[1px]" onMouseDown={onClose}>
      <div
        className={cn(
          "grid max-h-[88vh] w-[min(96vw,560px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-card text-card-foreground shadow-2xl",
          compact && "w-[min(94vw,460px)]",
          wide && "w-[min(96vw,1040px)]",
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={cn("flex items-start justify-between gap-4 border-b bg-secondary/70 p-4", tone === "danger" && "[&_h2]:text-destructive")}>
          <div>
            <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          <Button aria-label="Close" type="button" variant="ghost" size="icon" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto overflow-x-hidden p-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t bg-secondary/40 p-4">{footer}</div>}
      </div>
    </div>
  );
}
