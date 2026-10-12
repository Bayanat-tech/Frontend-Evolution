import { Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { executeDynamicMutation, getDynamicLookup } from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";

export type TProductType = {
  prodtype_code?: string;
  prodtype_name?: string;
};

type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<TProductType>;
  onClose: (shouldRefetch?: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
};

const EMPTY: TProductType = {
  prodtype_code: "",
  prodtype_name: "",
};

export function AddProductTypeForm({ mode, existingData, onClose, onSavingChange }: Props) {
  const { user } = useAuth();
  const readonly = mode === "view";
  const isEdit = mode === "edit";
  // Code is the primary key: editable only while adding
  const codeEditable = mode === "add";

  const [form, setForm] = useState<TProductType>({ ...EMPTY });
  const [errors, setErrors] = useState<Partial<Record<keyof TProductType, string>>>({});
  const [apiError, setApiError] = useState("");
  const [checking, setChecking] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState("");

  useEffect(() => {
    if ((isEdit || readonly) && existingData) {
      setForm({
        ...EMPTY,
        prodtype_code: (existingData as any).PRODTYPE_CODE ?? existingData.prodtype_code ?? "",
        prodtype_name: (existingData as any).PRODTYPE_NAME ?? existingData.prodtype_name ?? "",
      });
    }
  }, [isEdit, readonly, existingData]);

  const set = (field: keyof TProductType, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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

  const validate = (): boolean => {
    const next: Partial<Record<keyof TProductType, string>> = {};
    if (!form.prodtype_code?.trim()) next.prodtype_code = "Prod Type Code is required";
    if (!form.prodtype_name?.trim()) next.prodtype_name = "Prod Type Name is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // val1s1 = company_code, val1s2 = prodtype_code, val1s3 = prodtype_name
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (readonly) return;
    if (!validate()) return;

    onSavingChange?.(true);
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
      onSavingChange?.(false);
    }
  };

  return (
    <form className="grid content-start gap-4" id="product-type-form" onSubmit={handleSubmit}>
      <AutoDismissAlert
        notice={apiError ? { type: "error", message: apiError } : null}
        onClose={() => setApiError("")}
      />

      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Product Type</p>
            <h2 className="m-0 text-sm font-semibold">Basic Information</h2>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
          <label className="field min-w-0">
            <span>
              Prod Type Code <strong className="text-destructive"> *</strong>
            </span>
            <div className="flex min-w-0 items-center gap-1">
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
                  type="button"
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
            {errors.prodtype_code && <span className="mt-0.5 text-xs text-destructive">{errors.prodtype_code}</span>}
            {!errors.prodtype_code && duplicateWarning && (
              <span
                className={`mt-0.5 text-xs ${
                  duplicateWarning.includes("already exists") ? "text-destructive" : "text-emerald-600"
                }`}
              >
                {duplicateWarning}
              </span>
            )}
          </label>

          <label className="field min-w-0">
            <span>
              Prod Type Name <strong className="text-destructive"> *</strong>
            </span>
            <Input
              disabled={readonly}
              value={form.prodtype_name ?? ""}
              onChange={(e) => set("prodtype_name", e.target.value)}
            />
            {errors.prodtype_name && <span className="mt-0.5 text-xs text-destructive">{errors.prodtype_name}</span>}
          </label>
        </CardContent>
      </Card>
    </form>
  );
}