import { Save, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { executeDynamicMutation, getDynamicLookupaccount } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";

// ─── Old field set — kept exactly as in the old dw_erp_prodcat DataWindow.
// Only two real fields exist on this master: code and name. ────────────────
export type TProductCategory = {
  prodcat_code?: string;
  prodcat_name?: string;
};

type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<TProductCategory>;
  onClose: (shouldRefetch?: boolean) => void;
};

const EMPTY: TProductCategory = {
  prodcat_code: "",
  prodcat_name: "",
};

const MODE_BADGE: Record<FormMode, { label: string; className: string }> = {
  add: { label: "New", className: "bg-emerald-100 text-emerald-700" },
  edit: { label: "Editing", className: "bg-blue-100 text-blue-700" },
  view: { label: "Read Only", className: "bg-slate-100 text-slate-600" },
};

export function AddProductCategoryForm({ mode, existingData, onClose }: Props) {
  const { user } = useAuth();
  const readonly = mode === "view";
  const isEdit = mode === "edit";
  // Prod Category Code is the primary key — only editable while adding a new
  // record (mirrors the old DataWindow's isRowNew() gated editability).
  const codeEditable = mode === "add";

  const [form, setForm] = useState<TProductCategory>({ ...EMPTY });
  const [errors, setErrors] = useState<Partial<Record<keyof TProductCategory, string>>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  const [checking, setChecking] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState("");

  // ── Load existing record into form ─────────────────────────────────────
  // existingData now comes pre-normalized from the parent page's normalizeRow
  // (prodcat_code / prodcat_name), but we keep the extra fallbacks here too
  // in case this form is ever opened from a caller that hasn't normalized
  // (e.g. a future "quick add" entry point) — the API's real field names are
  // category_code / category_name, confirmed via Network tab.
  useEffect(() => {
    if ((isEdit || readonly) && existingData) {
      const raw = existingData as any;
      setForm({
        ...EMPTY,
        prodcat_code:
          raw.prodcat_code ?? raw.PRODCAT_CODE ?? raw.category_code ?? raw.CATEGORY_CODE ?? "",
        prodcat_name:
          raw.prodcat_name ?? raw.PRODCAT_NAME ?? raw.category_name ?? raw.CATEGORY_NAME ?? "",
      });
    }
  }, [isEdit, readonly, existingData]);

  const set = (field: keyof TProductCategory, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

    // ── Duplicate check — parameter "PURCHASE_SALE_MSE_PRODCAT" filtered by code ─
    const checkDuplicate = async () => {
      if (!form.prodcat_code?.trim() || !user?.company_code) return;
      setChecking(true);
      setDuplicateWarning("");
      try {
        const response = await getDynamicLookupaccount({
          parameter: "PURCHASE_SALE_MSE_PRODCAT",
          loginid: user?.loginid ?? "",
          code1: user?.company_code ?? "",
          code2: form.prodcat_code.trim(),
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
        const exists = list.some((r: any) => {
          const code = r.prodcat_code ?? r.PRODCAT_CODE ?? r.category_code ?? r.CATEGORY_CODE ?? "";
          return String(code) === form.prodcat_code;
        });
        setDuplicateWarning(exists ? "This Prod Category Code already exists." : "Code is available.");
      } catch (error) {
        console.error("Failed to check product category code:", error);
      } finally {
        setChecking(false);
      }
    };

  // ── Validation ────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const next: Partial<Record<keyof TProductCategory, string>> = {};
    if (!form.prodcat_code?.trim()) next.prodcat_code = "Prod Category Code is required";
    if (!form.prodcat_name?.trim()) next.prodcat_name = "Prod Category Name is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // ── Save — parameter "PURCHASE_SALE_MSE_PRODCATEGORY". Slot mapping must
  // stay in lockstep with the corresponding WHEN branch in
  // PROC_BUILD_DYNAMIC_INS_UPD_COMMON:
  //   val1s1 = CATEGORY_CODE (empty = auto-generate)
  //   val1s2 = COMPANY_CODE
  //   val1s3 = CATEGORY_NAME
  //   val1s4 = USER_ID
  // ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setApiError("");
    try {
      await executeDynamicMutation({
        parameter: "PURCHASE_SALE_MSE_PRODCATEGORY",
        loginid: user?.loginid ?? "",

        val1s1: form.prodcat_code ?? "",
        val1s2: user?.company_code ?? "",
        val1s3: form.prodcat_name ?? "",
        val1s4: user?.loginid ?? "",
      });
      onClose(true);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to save product category");
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
          <h2 className="m-0 text-base font-semibold">Product Category</h2>
          <p className="m-0 text-sm font-semibold text-primary truncate">
            {form.prodcat_code || "Prod Category Code"}
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
        <label className="field min-w-0" key="prodcat_code">
          <span>
            Prod Category Code <strong className="text-destructive"> *</strong>
          </span>
          <div className="flex items-center gap-1 min-w-0">
            <div className="min-w-0 flex-1">
              <Input
                disabled={!codeEditable}
                value={form.prodcat_code ?? ""}
                onChange={(e) => {
                  set("prodcat_code", e.target.value);
                  setDuplicateWarning("");
                }}
              />
            </div>
            {codeEditable && (
              <Button
                size="icon"
                variant="outline"
                title="Check code availability"
                disabled={checking || !form.prodcat_code?.trim()}
                onClick={checkDuplicate}
              >
                <Search size={14} />
              </Button>
            )}
          </div>
          {errors.prodcat_code && (
            <span className="text-destructive text-xs mt-0.5">{errors.prodcat_code}</span>
          )}
          {!errors.prodcat_code && duplicateWarning && (
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

        <label className="field min-w-0" key="prodcat_name">
          <span>
            Prod Category Name <strong className="text-destructive"> *</strong>
          </span>
          <Input
            disabled={readonly}
            value={form.prodcat_name ?? ""}
            onChange={(e) => set("prodcat_name", e.target.value)}
          />
          {errors.prodcat_name && (
            <span className="text-destructive text-xs mt-0.5">{errors.prodcat_name}</span>
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