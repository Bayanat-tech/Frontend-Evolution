import { Search, IdCard } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { executeDynamicMutation, getDynamicLookupaccount } from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";
import type { LucideIcon } from "lucide-react";

export type TProductCategory = {
  prodcat_code?: string;
  prodcat_name?: string;
};

type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<TProductCategory>;
  onClose: (shouldRefetch?: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
};

const EMPTY: TProductCategory = {
  prodcat_code: "",
  prodcat_name: "",
};

/* ─────────────────────────────────────────────────────────────
   SectionPanel — EXACT Freight structure (from WMS)
   ───────────────────────────────────────────────────────────── */
function SectionPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
          </div>
        </div>
      </div>
      <div className="freight-panel-body p-3">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Field — matches WmsMasterForm / Freight label styling
   ───────────────────────────────────────────────────────────── */
function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`freight-field-label group flex flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
        {label}
        {required && <strong className="text-destructive ml-0.5 font-bold"> *</strong>}
      </span>
      {children}
    </label>
  );
}

export function AddProductCategoryForm({ mode, existingData, onClose, onSavingChange }: Props) {
  const { user } = useAuth();
  const readonly = mode === "view";
  const isEdit = mode === "edit";
  // Code is the primary key: editable only while adding
  const codeEditable = mode === "add";

  const [form, setForm] = useState<TProductCategory>({ ...EMPTY });
  const [errors, setErrors] = useState<Partial<Record<keyof TProductCategory, string>>>({});
  const [apiError, setApiError] = useState("");
  const [checking, setChecking] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState("");

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

  const checkDuplicate = async () => {
    if (!form.prodcat_code?.trim() || !user?.company_code) return;
    setChecking(true);
    setDuplicateWarning("");
    try {
      const response = await getDynamicLookupaccount({
        parameter: "PURCHASE_SALE_MSE_PRODCATEGORY",
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

  const validate = (): boolean => {
    const next: Partial<Record<keyof TProductCategory, string>> = {};
    if (!form.prodcat_code?.trim()) next.prodcat_code = "Prod Category Code is required";
    if (!form.prodcat_name?.trim()) next.prodcat_name = "Prod Category Name is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // val1s1 = CATEGORY_CODE, val1s2 = COMPANY_CODE, val1s3 = CATEGORY_NAME, val1s4 = USER_ID
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (readonly) return;
    if (!validate()) return;

    onSavingChange?.(true);
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
      onSavingChange?.(false);
    }
  };

  return (
    <form className="grid content-start gap-4" id="product-category-form" onSubmit={handleSubmit}>
      <AutoDismissAlert
        notice={apiError ? { type: "error", message: apiError } : null}
        onClose={() => setApiError("")}
      />

      <SectionPanel title="Basic Information" icon={IdCard}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          
          <Field label="Prod Category Code" required>
            <div className="flex min-w-0 items-center gap-1">
              <div className="min-w-0 flex-1">
                <Input
                  disabled={!codeEditable}
                  value={form.prodcat_code ?? ""}
                  onChange={(e) => {
                    set("prodcat_code", e.target.value);
                    setDuplicateWarning("");
                  }}
                  className={errors.prodcat_code ? "border-destructive focus-visible:ring-destructive" : ""}
                />
              </div>
              {codeEditable && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  title="Check code availability"
                  disabled={checking || !form.prodcat_code?.trim()}
                  onClick={checkDuplicate}
                  className="h-9 w-9 shrink-0"
                >
                  <Search size={14} className={checking ? "animate-pulse" : ""} />
                </Button>
              )}
            </div>
            {errors.prodcat_code && <span className="mt-0.5 text-[10px] font-medium text-destructive">{errors.prodcat_code}</span>}
            {!errors.prodcat_code && duplicateWarning && (
              <span
                className={`mt-0.5 text-[10px] font-medium ${
                  duplicateWarning.includes("already exists") ? "text-destructive" : "text-emerald-600"
                }`}
              >
                {duplicateWarning}
              </span>
            )}
          </Field>

          <Field label="Prod Category Name" required>
            <Input
              disabled={readonly}
              value={form.prodcat_name ?? ""}
              onChange={(e) => set("prodcat_name", e.target.value)}
              className={errors.prodcat_name ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.prodcat_name && <span className="mt-0.5 text-[10px] font-medium text-destructive">{errors.prodcat_name}</span>}
          </Field>

        </div>
      </SectionPanel>
    </form>
  );
}