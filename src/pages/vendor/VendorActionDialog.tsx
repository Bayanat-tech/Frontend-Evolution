import { FormEvent, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { executeVendorSql, updateVendorLpoStatus, type VendorRow } from "../../api/vendor";
import { useAuth } from "../../state/AuthContext";

export function VendorActionDialog({
  docNo,
  action,
  flowLevel,
  onClose,
  onDone,
}: {
  docNo: string;
  action: "APPROVED" | "SENTBACK" | "REJECTED";
  flowLevel?: string | number;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [remarks, setRemarks] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [levels, setLevels] = useState<VendorRow[]>([]);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const isReject = action === "REJECTED";
  const isSendBack = action === "SENTBACK";

  useEffect(() => {
    if (!isSendBack) {
      setSelectedLevel("");
      setLevels([]);
      return;
    }

    const approver = user?.loginid1 || user?.loginid || user?.username || "";
    if (!approver) return;

    const sql = `
      SELECT *
      FROM VW_VENDOR_SENTBACK v
      WHERE v.FLOW_LEVEL < (
        CASE
          WHEN '${escapeSql(approver)}' IN (SELECT EMP_ID_LEVEL1 FROM MS_VENDOR_APPROVER) THEN 1
          WHEN '${escapeSql(approver)}' IN (SELECT EMP_ID_LEVEL2 FROM MS_VENDOR_APPROVER) THEN 2
          WHEN '${escapeSql(approver)}' IN (SELECT EMP_ID_LEVEL3 FROM MS_VENDOR_APPROVER) THEN 3
          ELSE 0
        END
      )
    `;

    setLoadingLevels(true);
    void executeVendorSql(sql)
      .then((rows) => {
        setLevels(rows);
        const firstLevel = rows.length ? getVendorField(rows[0], "FLOW_LEVEL") : undefined;
        setSelectedLevel(toSelectValue(firstLevel ?? flowLevel));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load send-back levels"))
      .finally(() => setLoadingLevels(false));
  }, [flowLevel, isSendBack, user?.loginid, user?.loginid1, user?.username]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (isSendBack && !selectedLevel) {
      setError("Send back level is required.");
      return;
    }

    if ((isSendBack || isReject) && !remarks.trim()) {
      setError("Remarks are required.");
      return;
    }

    try {
      setSaving(true);
      const actor = user?.username || user?.loginid || "";
      const remarksWithUser = remarks.trim()
        ? `${remarks.trim()} - ${actor}`.trim()
        : `${label} - ${actor}`.trim();
      await updateVendorLpoStatus({
        doc_no: docNo,
        company_code: user?.company_code || "",
        flow_level: isReject ? 0 : selectedLevel || toSelectValue(flowLevel) || 0,
        remarks: remarksWithUser,
        action,
      });
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update status");
    } finally {
      setSaving(false);
    }
  };

  const label = action === "APPROVED" ? "Approve" : action === "SENTBACK" ? "Send Back" : "Reject";

  return (
    <Dialog
      open
      compact
      contentClassName="vendor-action-dialog"
      tone={action === "REJECTED" ? "danger" : "default"}
      title={`${label} Vendor Request`}
      description={`Document ${docNo}`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" variant={action === "REJECTED" ? "destructive" : "default"} onClick={(event) => void submit(event as unknown as FormEvent)} disabled={saving || loadingLevels}>{label}</Button>
        </>
      }
    >
      <form className="grid gap-3" onSubmit={submit}>
        {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
        {isSendBack && (
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-muted-foreground">Level</span>
            <Select value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)} disabled={loadingLevels || saving}>
              <option value="">{loadingLevels ? "Loading levels..." : "Select level"}</option>
              {levels.map((level, index) => {
                const value = toSelectValue(getVendorField(level, "FLOW_LEVEL"));
                const label = String(getVendorField(level, "EMPLOYEE_INFO") ?? value);
                return (
                  <option key={`${value}-${index}`} value={value}>
                    {label}
                  </option>
                );
              })}
            </Select>
          </label>
        )}
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-muted-foreground">Remarks</span>
          <Input value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder={`${label} remarks`} />
        </label>
      </form>
    </Dialog>
  );
}

function escapeSql(value: string) {
  return String(value || "").replace(/'/g, "''");
}

function getVendorField(row: VendorRow, field: string) {
  const exact = row[field];
  if (exact !== undefined && exact !== null) return exact;
  const lowerField = field.toLowerCase();
  const key = Object.keys(row).find((candidate) => candidate.toLowerCase() === lowerField);
  return key ? row[key] : undefined;
}

function toSelectValue(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}
