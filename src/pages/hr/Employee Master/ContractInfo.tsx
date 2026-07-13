import { FormEvent, useEffect, useState } from "react";
import { TContractHr } from "./employee-hr.types";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup } from "../../../api/lookups";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";


const toInputDate = (value: Date | null | undefined) => {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};
const fromInputDate = (value: string): Date | null => (value ? new Date(value) : null);

export const ContractInfo = ({
  handleNext,
  handleBack,
  contractInfo,
  setContractInfo,
}: {
  handleNext: () => void;
  handleBack: () => void;
  contractInfo: TContractHr;
  setContractInfo: (value: TContractHr) => void;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<TContractHr>(contractInfo);

  useEffect(() => {
    if (contractInfo && Object.keys(contractInfo).length) setForm(contractInfo);
  }, [contractInfo]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.contract_type || !form.contract_renewable || !form.contract_start_date || !form.contract_end_date) {
      toast.warning("Please fill all required fields");
      return;
    }
    setContractInfo(form);
    handleNext();
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <h2 className="m-0 text-lg font-semibold text-foreground">Contract Information</h2>

      <div className="grid max-w-2xl gap-3">
        <LookupField
          label="Contract Type"
          value={form.contract_type ?? ""}
          valueField="contract_type"
          displayFields={["contract_type", "contract_type_desc"]}
          columns={[
            { field: "contract_type", header: "Code" },
            { field: "contract_type_desc", header: "Description" },
          ]}
          loadOptions={async () => {
            const res = await getDynamicLookup({
              parameter: "MS_EMP_HR_EMPLOYEE_CONTRACT",
              loginid: user?.loginid ?? "",
              code1: user?.company_code ?? "",
            });
            return Array.isArray(res) ? res : [];
          }}
          onChange={(value) => setForm((c) => ({ ...c, contract_type: value }))}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Date" required>
            <Input
              type="date"
              value={toInputDate(form.contract_start_date)}
              onChange={(e) => setForm((c) => ({ ...c, contract_start_date: fromInputDate(e.target.value) as Date }))}
            />
          </Field>

          <Field label="End Date" required>
            <Input
              type="date"
              min={toInputDate(form.contract_start_date)}
              disabled={!form.contract_start_date}
              value={toInputDate(form.contract_end_date)}
              onChange={(e) => setForm((c) => ({ ...c, contract_end_date: fromInputDate(e.target.value) }))}
            />
          </Field>
        </div>

        <LookupField
          label="Renewable"
          value={form.contract_renewable ?? ""}
          valueField="value_code"
          displayFields={["value_code", "value_desc"]}
          columns={[
            { field: "value_code", header: "Code" },
            { field: "value_desc", header: "Description" },
          ]}
          loadOptions={async () => {
            const res = await getDynamicLookup({
              parameter: "MS_EMP_HR_CONTRACT_RENEWABLE",
              loginid: user?.loginid ?? "",
              code1: user?.company_code ?? "",
            });
            return Array.isArray(res) ? res : [];
          }}
          onChange={(value) => setForm((c) => ({ ...c, contract_renewable: value }))}
        />
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={handleBack}>
          Back
        </Button>
        <Button type="submit">Next</Button>
      </div>
    </form>
  );
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      {children}
    </label>
  );
}