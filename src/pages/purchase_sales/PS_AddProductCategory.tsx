import { IdCard } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { executeDynamicMutation } from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
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

  const [form, setForm] = useState<TProductCategory>({ ...EMPTY });
  const [errors, setErrors] = useState<Partial<Record<keyof TProductCategory, string>>>({});
  const [apiError, setApiError] = useState("");

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

  const validate = (): boolean => {
    const next: Partial<Record<keyof TProductCategory, string>> = {};
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
        // empty on add → backend auto-generates; on edit the existing code is sent
        val1s1: form.prodcat_code ? String(form.prodcat_code) : undefined,
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
          <Field label="Prod Category Name" required>
            <Input
              disabled={readonly}
              value={form.prodcat_name ?? ""}
              onChange={(e) => set("prodcat_name", e.target.value)}
              className={errors.prodcat_name ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.prodcat_name && (
              <span className="mt-0.5 text-[10px] font-medium text-destructive">{errors.prodcat_name}</span>
            )}
          </Field>
        </div>
      </SectionPanel>
    </form>
  );
}