import { Loader2, Undo2, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";
import { SendBackUserOption } from "./Purchaseordertypes";

export function SendBackDialog({
  open,
  isSaving,
  users,
  usersLoading,
  selectedCode,
  reason,
  error,
  onSelectUser,
  onReasonChange,
  onClearError,
  onClose,
  onConfirm,
}: {
  open: boolean;
  isSaving: boolean;
  users: SendBackUserOption[];
  usersLoading: boolean;
  selectedCode: string;
  reason: string;
  error: string;
  onSelectUser: (option: SendBackUserOption | undefined, code: string) => void;
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
          <h3 className="m-0 text-sm font-semibold">Send Back Purchase Order</h3>
          <Button aria-label="Close" type="button" variant="ghost" size="icon" onClick={onClose} disabled={isSaving}>
            <X size={16} />
          </Button>
        </div>

        <div className="grid gap-3 px-4 py-4">
          <AutoDismissAlert notice={error ? { type: "error", message: error } : null} onClose={onClearError} />

          <label className="field">
            <span className="text-xs font-medium">Send Back To *</span>
            {usersLoading ? (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading users...
              </div>
            ) : (
              <Select
                value={selectedCode}
                onChange={(event) => {
                  const code = event.target.value;
                  const match = users.find((option) => option.code === code);
                  onSelectUser(match, code);
                }}
              >
                <option value="">Select level</option>
                {users.map((option) => (
                  <option key={option.code} value={option.code}>{option.name}</option>
                ))}
              </Select>
            )}
          </label>

          <label className="field">
            <span className="text-xs font-medium">Reason *</span>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              rows={4}
              placeholder="Enter reason for sending back..."
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="button" onClick={onConfirm} disabled={isSaving || usersLoading} className="bg-yellow-500 hover:bg-yellow-600">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
            {isSaving ? "Sending Back..." : "Send Back"}
          </Button>
        </div>
      </div>
    </div>
  );
}