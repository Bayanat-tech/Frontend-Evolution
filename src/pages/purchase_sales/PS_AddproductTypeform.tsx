import { Save, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { executeDynamicMutation, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";

// ─── Old field set — kept exactly as in the old dw_erp_prodtype DataWindow.
// Only two real fields exist on this master: code and name. ────────────────
export type TProductType = {
  prodtype_code?: string;
  prodtype_name?: string;
};

type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<TProductType>;
  onClose: (shouldRefetch?: boolean) => void;
};

const EMPTY: TProductType = {
  prodtype_code: "",
  prodtype_name: "",
};

const MODE_BADGE: Record<FormMode, { label: string; className: string }> = {
  add: { label: "New", className: "bg-emerald-100 text-emerald-700" },
  edit: { label: "Editing", className: "bg-blue-100 text-blue-700" },
  view: { label: "Read Only", className: "bg-slate-100 text-slate-600" },
};

export function AddProductTypeForm({ mode, existingData, onClose }: Props) {
  const { user } = useAuth();
  const readonly = mode === "view";
  const isEdit = mode === "edit";
  // Prod Type Code is the primary key — only editable while adding a new
  // record (mirrors the old DataWindow's isRowNew() gated editability).
  const codeEditable = mode === "add";

  const [form, setForm] = useState<TProductType>({ ...EMPTY });
  const [errors, setErrors] = useState<Partial<Record<keyof TProductType, string>>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  const [checking, setChecking] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState("");

  // ── Load existing record into form ─────────────────────────────────────
  useEffect(() => {
    if ((isEdit || readonly) && existingData) {
      setForm({
        ...EMPTY,
        prodtype_code:
          (existingData as any).PRODTYPE_CODE ?? existingData.prodtype_code ?? "",
        prodtype_name:
          (existingData as any).PRODTYPE_NAME ?? existingData.prodtype_name ?? "",
      });
    }
  }, [isEdit, readonly, existingData]);

  const set = (field: keyof TProductType, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Duplicate check — parameter "PUR_PRODTYPE" filtered by code ─────────
  const checkDuplicate = async () => {
    if (!form.prodtype_code?.trim() || !user?.company_code) return;
    setChecking(true);
    setDuplicateWarning("");
    try {
      const response = await getDynamicLookup({
        parameter: "PURCHASE_SALE_MSE_PRODTYPE",
        loginid: user?.loginid ?? "",
        code1: user?.company_code ?? "",
        code2: form.prodtype_code.trim(),
        code3: "NULL",
        code4: "NULL",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
      const list = Array.isArray(response) ? response : [];
      const exists = list.some(
        (r: any) => String(r.prodtype_code ?? r.PRODTYPE_CODE ?? "") === form.prodtype_code,
      );
      setDuplicateWarning(exists ? "This Prod Type Code already exists." : "Code is available.");
    } catch (error) {
      console.error("Failed to check product type code:", error);
    } finally {
      setChecking(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const next: Partial<Record<keyof TProductType, string>> = {};
    if (!form.prodtype_code?.trim()) next.prodtype_code = "Prod Type Code is required";
    if (!form.prodtype_name?.trim()) next.prodtype_name = "Prod Type Name is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // ── Save — parameter "pur_prodtype_ins_upd". Slot mapping must stay in
  // lockstep with the corresponding WHEN branch in
  // PROC_BUILD_DYNAMIC_INS_UPD_COMMON (val1s1=company_code,
  // val1s2=prodtype_code, val1s3=prodtype_name). ──────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setApiError("");
    try {
      await executeDynamicMutation({
        parameter: "PURCHASE_SALE_MSE_PRODTYPE",
        loginid: user?.loginid ?? "",

        val1s1: user?.company_code ?? "",
        val1s2: form.prodtype_code ?? "",
        val1s3: form.prodtype_name ?? "",
      });
      onClose(true);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to save product type");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-y-3 gap-x-4 overflow-hidden">
      {apiError && <div className="alert error">{apiError}</div>}

      {/* ── Header strip ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2 border-b pb-2">
        <div className="min-w-0">
          <h2 className="m-0 text-base font-semibold">Product Type</h2>
          <p className="m-0 text-sm font-semibold text-primary truncate">
            {form.prodtype_code || "Prod Type Code"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${MODE_BADGE[mode].className}`}
        >
          {MODE_BADGE[mode].label}
        </span>
      </div>

      {/* ── Fields ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 min-w-0 sm:grid-cols-2">
        <label className="field min-w-0" key="prodtype_code">
          <span>
            Prod Type Code <strong className="text-destructive"> *</strong>
          </span>
          <div className="flex items-center gap-1 min-w-0">
            <div className="min-w-0 flex-1">
              <Input
                disabled={!codeEditable}
                value={form.prodtype_code ?? ""}
                onChange={(e) => {
                  set("prodtype_code", e.target.value);
                  setDuplicateWarning("");
                }}
              />
            </div>
            {codeEditable && (
              <Button
                size="icon"
                variant="outline"
                title="Check code availability"
                disabled={checking || !form.prodtype_code?.trim()}
                onClick={checkDuplicate}
              >
                <Search size={14} />
              </Button>
            )}
          </div>
          {errors.prodtype_code && (
            <span className="text-destructive text-xs mt-0.5">{errors.prodtype_code}</span>
          )}
          {!errors.prodtype_code && duplicateWarning && (
            <span
              className={`text-xs mt-0.5 ${
                duplicateWarning.includes("already exists")
                  ? "text-destructive"
                  : "text-emerald-600"
              }`}
            >
              {duplicateWarning}
            </span>
          )}
        </label>

        <label className="field min-w-0" key="prodtype_name">
          <span>
            Prod Type Name <strong className="text-destructive"> *</strong>
          </span>
          <Input
            disabled={readonly}
            value={form.prodtype_name ?? ""}
            onChange={(e) => set("prodtype_name", e.target.value)}
          />
          {errors.prodtype_name && (
            <span className="text-destructive text-xs mt-0.5">{errors.prodtype_name}</span>
          )}
        </label>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button variant="outline" onClick={() => onClose(false)}>
          <X size={15} /> {readonly ? "Close" : "Cancel"}
        </Button>
        {!readonly && (
          <Button disabled={saving} onClick={handleSave}>
            <Save size={15} /> {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>
    </div>
  );
}