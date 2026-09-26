import { ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

export function ConfirmDialog({
  open,
  title,
  description,
  actionLabel,
  tone,
  children,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  actionLabel: string;
  tone?: "default" | "danger";
  children?: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      compact
      open={open}
      tone={tone}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant={tone === "danger" ? "destructive" : "default"} onClick={onConfirm}>{actionLabel}</Button>
        </>
      }
    >
      {children || <p className="m-0 text-sm text-muted-foreground">Please confirm to continue.</p>}
    </Dialog>
  );
}

