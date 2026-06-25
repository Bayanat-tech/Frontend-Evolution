import { FormEvent, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { updateVendorLpoStatus } from "../../api/vendor";

export function VendorActionDialog({
  docNo,
  action,
  onClose,
  onDone,
}: {
  docNo: string;
  action: "APPROVED" | "SENT_BACK" | "REJECTED";
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      setSaving(true);
      await updateVendorLpoStatus({ doc_no: docNo, action, remarks });
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update status");
    } finally {
      setSaving(false);
    }
  };

  const label = action === "APPROVED" ? "Approve" : action === "SENT_BACK" ? "Send Back" : "Reject";

  return (
    <Dialog
      open
      compact
      tone={action === "REJECTED" ? "danger" : "default"}
      title={`${label} Vendor Request`}
      description={`Document ${docNo}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant={action === "REJECTED" ? "destructive" : "default"} onClick={(event) => void submit(event as unknown as FormEvent)} disabled={saving}>{label}</Button>
        </>
      }
    >
      <form className="grid gap-3" onSubmit={submit}>
        {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-muted-foreground">Remarks</span>
          <Input value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Approval remarks" />
        </label>
      </form>
    </Dialog>
  );
}
