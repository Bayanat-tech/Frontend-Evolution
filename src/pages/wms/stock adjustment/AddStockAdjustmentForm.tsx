import { Save, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { createAdjHeader, executeWmsInboundSql } from "../../../api/wms";
import type { LookupRow } from "../../../api/lookups";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AddStockAdjustmentFormProps {
  open: boolean;
  onClose: (shouldRefetch?: boolean) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...row };
  Object.entries(row).forEach(([k, v]) => { out[k.toLowerCase()] = v; });
  return out;
}

async function loadAdjReasonLookup(): Promise<LookupRow[]> {
  const rows = await executeWmsInboundSql(
    `SELECT ADJREASON_CODE, ADJREASON FROM MS_ADJREASON ORDER BY ADJREASON_CODE`
  );
  return rows.map((r) => normalizeRow(r as Record<string, unknown>) as LookupRow);
}

async function loadPrincipalLookup(companyCode: string): Promise<LookupRow[]> {
  const rows = await executeWmsInboundSql(
    `SELECT PRIN_CODE, PRIN_NAME FROM MS_PRINCIPAL WHERE COMPANY_CODE = '${companyCode.replace(/'/g, "''")}' ORDER BY PRIN_CODE`
  );
  return rows.map((r) => normalizeRow(r as Record<string, unknown>) as LookupRow);
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AddStockAdjustmentForm({ open, onClose }: AddStockAdjustmentFormProps) {
  const { user } = useAuth();

  const [adjCode, setAdjCode] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [prinCode, setPrinCode] = useState("");
  const [prinName, setPrinName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [adjDate, setAdjDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const canSubmit = adjCode.trim() && prinCode.trim() && remarks.trim() && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await createAdjHeader({
        ADJ_CODE: adjCode,
        PRIN_CODE: prinCode,
        REMARKS: remarks,
        ADJ_DATE: adjDate,
        CONFIRMED: "N",
        USER_ID: user?.username || "Admin",
        COMPANY_CODE: user?.company_code || "",
      });
      onClose(true);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to create adjustment." });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
      onMouseDown={() => onClose()}
    >
      <div
        className="grid w-[min(96vw,560px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border bg-card text-card-foreground shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-card px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="h-7 w-1 rounded-full bg-primary" />
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                Stock Adjustment
              </p>
              <h2 className="m-0 text-lg font-bold text-foreground">Add Stock Adjustment</h2>
            </div>
          </div>
          <button
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
            type="button"
            onClick={() => onClose()}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto bg-muted/20 p-4">
          <NoticeToast notice={notice} onClose={() => setNotice(null)} />

          <div className="mt-1 grid gap-3 md:grid-cols-2">
            {/* Adj Code lookup */}
            <LookupField
              label="Adjustment Code"
              required
              value={adjCode}
              displayValue={adjCode && adjReason ? `${adjCode} - ${adjReason}` : adjCode}
              valueField="adjreason_code"
              displayFields={["adjreason_code", "adjreason"]}
              columns={[
                { field: "adjreason_code", header: "Adj Code" },
                { field: "adjreason", header: "Reason" },
              ]}
              placeholder="Select adjustment code"
              loadOptions={loadAdjReasonLookup}
              onChange={(selected, selectedRow) => {
                setAdjCode(selected);
                setAdjReason(
                  selectedRow
                    ? String(selectedRow["adjreason"] ?? selectedRow["ADJREASON"] ?? "")
                    : ""
                );
              }}
            />

            {/* Principal lookup */}
            <LookupField
              label="Principal"
              required
              value={prinCode}
              displayValue={prinCode && prinName ? `${prinCode} - ${prinName}` : prinCode}
              valueField="prin_code"
              displayFields={["prin_code", "prin_name"]}
              columns={[
                { field: "prin_code", header: "Principal Code" },
                { field: "prin_name", header: "Principal Name" },
              ]}
              placeholder="Select principal"
              loadOptions={() => loadPrincipalLookup(user?.company_code || "")}
              onChange={(selected, selectedRow) => {
                setPrinCode(selected);
                setPrinName(
                  selectedRow
                    ? String(selectedRow["prin_name"] ?? selectedRow["PRIN_NAME"] ?? "")
                    : ""
                );
              }}
            />

            {/* Remarks */}
            <label className="field md:col-span-2">
              <span>
                Remarks <strong className="text-destructive">*</strong>
              </span>
              <textarea
                className="ui-textarea min-h-[90px] w-full rounded-md"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter adjustment remarks..."
              />
            </label>

            {/* Adj Date */}
            <label className="field">
              <span>
                Adj Date <strong className="text-destructive">*</strong>
              </span>
              <Input type="date" value={adjDate} onChange={(e) => setAdjDate(e.target.value)} />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t bg-card px-5 py-3">
          <Button type="button" variant="outline" onClick={() => onClose()}>
            <X size={15} /> Cancel
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
            <Save size={15} /> {saving ? "Creating..." : "Create Adjustment"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AddStockAdjustmentForm;