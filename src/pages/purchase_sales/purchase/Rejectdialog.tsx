import { Loader2, X, XCircle } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";

export function RejectDialog({
  open,
  isSaving,
  reason,
  error,
  onReasonChange,
  onClearError,
  onClose,
  onConfirm,
}: {
  open: boolean;
  isSaving: boolean;
  reason: string;
  error: string;
  onReasonChange: (value: string) => void;
  onClearError: () => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="m-0 text-sm font-semibold">Reject Purchase Order</h3>
          <Button aria-label="Close" type="button" variant="ghost" size="icon" onClick={onClose} disabled={isSaving}>
            <X size={16} />
          </Button>
        </div>

        <div className="grid gap-3 px-4 py-4">
          <AutoDismissAlert notice={error ? { type: "error", message: error } : null} onClose={onClearError} />

          <label className="field">
            <span className="text-xs font-medium">Reason *</span>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              rows={4}
              placeholder="Enter reason for rejection..."
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="button" onClick={onConfirm} disabled={isSaving} className="bg-red-600 hover:bg-red-700">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
            {isSaving ? "Rejecting..." : "Reject"}
          </Button>
        </div>
      </div>
    </div>
  );
}