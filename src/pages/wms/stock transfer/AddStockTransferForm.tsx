import { Save, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { createSTN, executeWmsInboundSql } from "../../../api/wms";
import type { LookupRow } from "../../../api/lookups";

interface TransferFormProps {
  open: boolean;
  onClose: (shouldRefetch?: boolean) => void;
}

function normalizeRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...row };
  Object.entries(row).forEach(([k, v]) => { out[k.toLowerCase()] = v; });
  return out;
}

async function loadPrincipalLookup(companyCode: string): Promise<LookupRow[]> {
  const rows = await executeWmsInboundSql(
    `SELECT PRIN_CODE, PRIN_NAME FROM MS_PRINCIPAL WHERE COMPANY_CODE = '${companyCode.replace(/'/g, "''")}' ORDER BY PRIN_CODE`
  );
  return rows.map((r) => normalizeRow(r as Record<string, unknown>) as LookupRow);
}

export function TransferForm({ open, onClose }: TransferFormProps) {
  const { user } = useAuth();
  const [prinCode, setPrinCode] = useState("");
  const [prinName, setPrinName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!prinCode.trim()) {
      setNotice({ type: "error", message: "Principal is required." });
      return;
    }
    if (!description.trim()) {
      setNotice({ type: "error", message: "Remarks / Description is required." });
      return;
    }
    setSaving(true);
    try {
      await createSTN({
        prin_code: prinCode,
        description,
        stn_date: new Date().toISOString().slice(0, 10),
        user_id: user?.loginid || user?.username || "Admin",
        company_code: user?.company_code || "",
      });
      onClose(true);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to create STN." });
    } finally {
      setSaving(false);
    }
  };

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
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Stock Transfer</p>
              <h2 className="m-0 text-lg font-bold text-foreground">Create New STN</h2>
            </div>
          </div>
          <button
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
            onClick={() => onClose()}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto bg-muted/20 p-4">
          <NoticeToast notice={notice} onClose={() => setNotice(null)} />

          <div className="grid gap-3 mt-1">
            <LookupField
              label="Principal"
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
                setPrinName(selectedRow ? String(selectedRow["prin_name"] ?? selectedRow["PRIN_NAME"] ?? "") : "");
              }}
            />

            <label className="field">
              <span>Remarks / Description <strong className="text-destructive">*</strong></span>
              <textarea
                className="ui-textarea min-h-[100px] rounded-md w-full"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter transfer remarks..."
              />
            </label>

            <fieldset className="rounded-md border border-border bg-card p-2.5">
              <legend className="px-2 text-xs font-semibold text-muted-foreground">Auto-filled</legend>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="field">
                  <span>STN Date</span>
                  <Input readOnly className="bg-muted/40" value={new Date().toLocaleDateString("en-GB")} />
                </label>
                {/* <label className="field">
                  <span>Company</span>
                  <Input readOnly className="bg-muted/40" value={user?.company_code || ""} />
                </label> */}
              </div>
            </fieldset>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t bg-card px-5 py-3">
          <Button type="button" variant="outline" onClick={() => onClose()}>
            <X size={15} /> Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || !prinCode.trim() || !description.trim()}
            onClick={handleSubmit}
          >
            <Save size={15} /> {saving ? "Creating..." : "Create STN"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TransferForm;