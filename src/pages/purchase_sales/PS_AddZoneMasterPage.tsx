import { Search, IdCard } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { executeDynamicMutation, getDynamicLookupaccount } from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";
import type { LucideIcon } from "lucide-react";

export type TZoneMaster = {
  zone_code?: string;
  zone_name?: string;
};

type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<TZoneMaster>;
  onClose: (shouldRefetch?: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
};

const EMPTY: TZoneMaster = {
  zone_code: "",
  zone_name: "",
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

export function AddZoneMasterForm({ mode, existingData, onClose, onSavingChange }: Props) {
  const { user } = useAuth();
  const readonly = mode === "view";
  const isEdit = mode === "edit";
  // Zone Code is the primary key: editable only while adding
  const codeEditable = mode === "add";

  const [form, setForm] = useState<TZoneMaster>({ ...EMPTY });
  const [errors, setErrors] = useState<Partial<Record<keyof TZoneMaster, string>>>({});
  const [apiError, setApiError] = useState("");
  const [checking, setChecking] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState("");

  useEffect(() => {
    if ((isEdit || readonly) && existingData) {
      const raw = existingData as any;
      setForm({
        ...EMPTY,
        zone_code: raw.zone_code ?? raw.ZONE_CODE ?? "",
        zone_name: raw.zone_name ?? raw.ZONE_NAME ?? "",
      });
    }
  }, [isEdit, readonly, existingData]);

  const set = (field: keyof TZoneMaster, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const checkDuplicate = async () => {
    if (!form.zone_code?.trim() || !user?.company_code) return;
    setChecking(true);
    setDuplicateWarning("");
    try {
      const response = await getDynamicLookupaccount({
        parameter: "PURCHASE_SALE_MSE_ZONE",
        loginid: user?.loginid ?? "",
        code1: user?.company_code ?? "",
        code2: form.zone_code.trim(),
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
        const code = r.zone_code ?? r.ZONE_CODE ?? "";
        return String(code) === form.zone_code;
      });
      setDuplicateWarning(exists ? "This Zone Code already exists." : "Code is available.");
    } catch (error) {
      console.error("Failed to check zone code:", error);
    } finally {
      setChecking(false);
    }
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof TZoneMaster, string>> = {};
    if (!form.zone_code?.trim()) next.zone_code = "Zone Code is required";
    if (!form.zone_name?.trim()) next.zone_name = "Zone Name is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (readonly) return;
    if (!validate()) return;

    onSavingChange?.(true);
    setApiError("");
    try {
      await executeDynamicMutation({
        parameter: "PURCHASE_SALE_MSE_ZONE",
        loginid: user?.loginid ?? "",
        val1s1: form.zone_code ?? "",
        val1s2: user?.company_code ?? "",
        val1s3: form.zone_name ?? "",
        val1s4: user?.loginid ?? "",
      });
      onClose(true);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to save zone");
    } finally {
      onSavingChange?.(false);
    }
  };

  return (
    <form className="grid content-start gap-4" id="zone-master-form" onSubmit={handleSubmit}>
      <AutoDismissAlert
        notice={apiError ? { type: "error", message: apiError } : null}
        onClose={() => setApiError("")}
      />

      <SectionPanel title="Basic Information" icon={IdCard}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          
          <Field label="Zone Code" required>
            <div className="flex min-w-0 items-center gap-1">
              <div className="min-w-0 flex-1">
                <Input
                  disabled={!codeEditable}
                  value={form.zone_code ?? ""}
                  onChange={(e) => {
                    set("zone_code", e.target.value);
                    setDuplicateWarning("");
                  }}
                  className={errors.zone_code ? "border-destructive focus-visible:ring-destructive" : ""}
                />
              </div>
              {codeEditable && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  title="Check code availability"
                  disabled={checking || !form.zone_code?.trim()}
                  onClick={checkDuplicate}
                  className="h-9 w-9 shrink-0"
                >
                  <Search size={14} className={checking ? "animate-pulse" : ""} />
                </Button>
              )}
            </div>
            {errors.zone_code && <span className="mt-0.5 text-[10px] font-medium text-destructive">{errors.zone_code}</span>}
            {!errors.zone_code && duplicateWarning && (
              <span
                className={`mt-0.5 text-[10px] font-medium ${
                  duplicateWarning.includes("already exists") ? "text-destructive" : "text-emerald-600"
                }`}
              >
                {duplicateWarning}
              </span>
            )}
          </Field>

          <Field label="Zone Name" required>
            <Input
              disabled={readonly}
              value={form.zone_name ?? ""}
              onChange={(e) => set("zone_name", e.target.value)}
              className={errors.zone_name ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.zone_name && <span className="mt-0.5 text-[10px] font-medium text-destructive">{errors.zone_name}</span>}
          </Field>

        </div>
      </SectionPanel>
    </form>
  );
}