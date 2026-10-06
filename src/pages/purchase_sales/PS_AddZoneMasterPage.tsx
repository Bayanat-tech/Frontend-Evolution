import { Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { executeDynamicMutation, getDynamicLookupaccount } from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";

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

  // Slot mapping must match PROC_BUILD_DYNAMIC_INS_UPD_COMMON:
  //   val1s1 = ZONE_CODE, val1s2 = COMPANY_CODE, val1s3 = ZONE_NAME, val1s4 = USER_ID
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

      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Zone</p>
            <h2 className="m-0 text-sm font-semibold">Basic Information</h2>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
          <label className="field min-w-0">
            <span>
              Zone Code <strong className="text-destructive"> *</strong>
            </span>
            <div className="flex min-w-0 items-center gap-1">
              <div className="min-w-0 flex-1">
                <Input
                  disabled={!codeEditable}
                  value={form.zone_code ?? ""}
                  onChange={(e) => {
                    set("zone_code", e.target.value);
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
                  disabled={checking || !form.zone_code?.trim()}
                  onClick={checkDuplicate}
                >
                  <Search size={14} />
                </Button>
              )}
            </div>
            {errors.zone_code && <span className="mt-0.5 text-xs text-destructive">{errors.zone_code}</span>}
            {!errors.zone_code && duplicateWarning && (
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
              Zone Name <strong className="text-destructive"> *</strong>
            </span>
            <Input
              disabled={readonly}
              value={form.zone_name ?? ""}
              onChange={(e) => set("zone_name", e.target.value)}
            />
            {errors.zone_name && <span className="mt-0.5 text-xs text-destructive">{errors.zone_name}</span>}
          </label>
        </CardContent>
      </Card>
    </form>
  );
}