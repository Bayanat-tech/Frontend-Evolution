import { Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { executeDynamicMutation, getDynamicLookupaccount } from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";

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

      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Product Category</p>
            <h2 className="m-0 text-sm font-semibold">Basic Information</h2>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
          <label className="field min-w-0">
            <span>
              Prod Category Code <strong className="text-destructive"> *</strong>
            </span>
            <div className="flex min-w-0 items-center gap-1">
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
                  type="button"
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
            {errors.prodcat_code && <span className="mt-0.5 text-xs text-destructive">{errors.prodcat_code}</span>}
            {!errors.prodcat_code && duplicateWarning && (
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
              Prod Category Name <strong className="text-destructive"> *</strong>
            </span>
            <Input
              disabled={readonly}
              value={form.prodcat_name ?? ""}
              onChange={(e) => set("prodcat_name", e.target.value)}
            />
            {errors.prodcat_name && <span className="mt-0.5 text-xs text-destructive">{errors.prodcat_name}</span>}
          </label>
        </CardContent>
      </Card>
    </form>
  );
}