import { Save, X, ClipboardList, FileText } from "lucide-react";
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
  Object.entries(row).forEach(([k, v]) => {
    out[k.toLowerCase()] = v;
  });
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
    `SELECT PRIN_CODE, PRIN_NAME FROM MS_PRINCIPAL WHERE COMPANY_CODE = '${companyCode.replace(
      /'/g,
      "''"
    )}' ORDER BY PRIN_CODE`
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
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to create adjustment.",
      });
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
        className="grid w-[min(96vw,640px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border bg-card text-card-foreground shadow-2xl freight-dense-form freight-ui-standard"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header — matches freight-transaction-header */}
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 border-b bg-card px-3 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <ClipboardList size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                  New Stock Adjustment
                </h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  Draft
                </span>
              </div>
            </div>
          </div>
          <button
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
            type="button"
            onClick={() => onClose()}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto bg-muted/20 p-3">
          <NoticeToast notice={notice} onClose={() => setNotice(null)} />

          <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
            <div className="freight-panel-title flex items-center gap-2 border-b bg-muted/35 px-2 py-1.5">
              <span className="freight-section-icon">
                <FileText size={12} />
              </span>
              <h3 className="m-0 text-[11px] font-semibold uppercase text-foreground">
                Adjustment Header
              </h3>
            </div>
            <div className="freight-panel-body p-2.5">
              <div className="grid gap-2 sm:grid-cols-2">
                <LookupField
                  label="Adjustment Code *"
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

                <LookupField
                  label="Principal *"
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

                <label className="grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label sm:col-span-2">
                  Remarks *
                  <textarea
                    className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] text-foreground shadow-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter adjustment remarks..."
                  />
                </label>

                <label className="grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label">
                  Adj Date *
                  <Input
                    type="date"
                    className="h-7 text-[11px]"
                    value={adjDate}
                    onChange={(e) => setAdjDate(e.target.value)}
                  />
                </label>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t bg-card px-3 py-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onClose()}>
            <X size={14} /> Cancel
          </Button>
          <Button type="button" size="sm" disabled={!canSubmit} onClick={handleSubmit}>
            <Save size={14} /> {saving ? "Creating..." : "Create Adjustment"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AddStockAdjustmentForm;