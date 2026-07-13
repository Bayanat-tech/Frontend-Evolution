import { useEffect, useState } from "react";
import { TPayrollHr } from "./employee-hr.types";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { LookupField } from "../../../components/ui/LookupField";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookup } from "../../../api/lookups";
import { getWmsMaster } from "../../../api/wms";
import { Input } from "../../../components/ui/Input";


const toInputDate = (value: Date | null | undefined) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const fromInputDate = (value: string): Date | null => (value ? new Date(value) : null);

export const PayrollForm = ({
  handleNext,
  handleBack,
  payRollInfo,
  setPayRollInfo,
}: {
  handleNext: () => void;
  handleBack: () => void;
  payRollInfo: TPayrollHr;
  setPayRollInfo: (value: TPayrollHr) => void;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<TPayrollHr>(payRollInfo);

  useEffect(() => {
    if (payRollInfo && Object.keys(payRollInfo).length) setForm(payRollInfo);
  }, [payRollInfo]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.include_in_payroll) {
      toast.warning("Include In Payment is required");
      return;
    }
    setPayRollInfo(form);
    handleNext();
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <h2 className="m-0 text-lg font-semibold text-foreground">Payroll Information</h2>

      <div className="grid max-w-2xl gap-3">
        <div className="grid grid-cols-2 gap-4">
          <LookupField
            label="Include In Payment"
            value={form.include_in_payroll ?? ""}
            valueField="value_code"
            displayFields={["value_code", "value_desc"]}
            columns={[
              { field: "value_code", header: "Code" },
              { field: "value_desc", header: "Description" },
            ]}
            loadOptions={async () => {
              const res = await getDynamicLookup({
                parameter: "MS_EMP_HR_INCLUDE_PAYROLL",
                loginid: user?.loginid ?? "",
                code1: user?.company_code ?? "",
              });
              return Array.isArray(res) ? res : [];
            }}
            onChange={(value) => setForm((c) => ({ ...c, include_in_payroll: value }))}
          />

          <Field label="Payroll Start Date">
            <Input
              type="date"
              value={toInputDate(form.payroll_start_date)}
              onChange={(e) => setForm((c) => ({ ...c, payroll_start_date: fromInputDate(e.target.value) as Date }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <LookupField
            label="Mode Of Payment"
            value={form.payment_mode ?? ""}
            valueField="value_code"
            displayFields={["value_code", "value_desc"]}
            columns={[
              { field: "value_code", header: "Code" },
              { field: "value_desc", header: "Description" },
            ]}
            loadOptions={async () => {
              const res = await getDynamicLookup({
                parameter: "MS_EMP_HR_PAYMENT_MODE",
                loginid: user?.loginid ?? "",
                code1: user?.company_code ?? "",
              });
              return Array.isArray(res) ? res : [];
            }}
            onChange={(value) => setForm((c) => ({ ...c, payment_mode: value }))}
          />

          <LookupField
            label="Paying Bank"
            value={form.company_bank_code ?? ""}
            valueField="bank_code"
            displayFields={["bank_code", "bank_name"]}
            columns={[
              { field: "bank_code", header: "Code" },
              { field: "bank_name", header: "Bank" },
            ]}
            loadOptions={async () => {
              const res = await getDynamicLookup({
                parameter: "MS_EMP_HR_EMPLOYEE_BANK",
                loginid: user?.loginid ?? "",
                code1: user?.company_code ?? "",
              });
              return Array.isArray(res) ? res : [];
            }}
            onChange={(value) => setForm((c) => ({ ...c, company_bank_code: value }))}
          />
        </div>

        <Field label="Bank Account No.">
          <Input value={form.salary_acct_no} onChange={(e) => setForm((c) => ({ ...c, salary_acct_no: e.target.value }))} />
        </Field>

        <Field label="Bank IBAN No.">
          <Input value={form.emp_iban_no} onChange={(e) => setForm((c) => ({ ...c, emp_iban_no: e.target.value }))} />
        </Field>

        <LookupField
          label="Employee Bank"
          value={form.salary_bank_code ?? ""}
          valueField="bank_code"
          displayFields={["bank_code", "bank_name"]}
          columns={[
            { field: "bank_code", header: "Code" },
            { field: "bank_name", header: "Bank" },
          ]}
          loadOptions={async () => {
            const res = await getDynamicLookup({
              parameter: "MS_EMP_HR_EMPLOYEE_BANK",
              loginid: user?.loginid ?? "",
              code1: user?.company_code ?? "",
            });
            return Array.isArray(res) ? res : [];
          }}
          onChange={(value) => setForm((c) => ({ ...c, salary_bank_code: value }))}
        />

        <Field label="Salary A/C Ref.">
          <Input value="123" disabled />
        </Field>

        <div className="grid grid-cols-[1fr_auto] gap-4">
          <LookupField
            label="Currency"
            value={form.currency_id ?? ""}
            valueField="curr_code"
            displayFields={["curr_code", "curr_name"]}
            columns={[
              { field: "curr_code", header: "Code" },
              { field: "curr_name", header: "Currency" },
            ]}
            loadOptions={async () => {
              const res = await getWmsMaster("currency", { page: 1, limit: 100000 });
              return res?.tableData ?? [];
            }}
            onChange={(value) => setForm((c) => ({ ...c, currency_id: value }))}
          />

          <Field label="Exch. Rate">
            <Input
              type="number"
              min={0}
              className="text-right"
              value={form.exch_rate ?? ""}
              onChange={(e) => {
                if (e.target.value.charAt(0) !== "-") {
                  setForm((c) => ({ ...c, exch_rate: Number(e.target.value) }));
                }
              }}
            />
          </Field>
        </div>
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