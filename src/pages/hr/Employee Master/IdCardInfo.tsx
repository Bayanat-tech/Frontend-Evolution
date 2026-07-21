import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup } from "../../../api/lookups";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { TILPHr } from "./employee-hr.types";
import { useToast } from "../../../components/ui/AlertToast";

const toInputDate = (value: Date | null | undefined) => {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};
const fromInputDate = (value: string): Date | null => (value ? new Date(value) : null);

export const IdCardInfo = ({
  handleNext,
  handleBack,
  idCardInfo,
  setIdCardInfo,
}: {
  handleNext: () => void;
  handleBack: () => void;
  idCardInfo: TILPHr;
  setIdCardInfo: (value: TILPHr) => void;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<TILPHr>(idCardInfo);

  useEffect(() => {
    if (idCardInfo && Object.keys(idCardInfo).length) setForm(idCardInfo);
  }, [idCardInfo]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.labourcard_status || !form.labourcard_no || !form.labourcard_valid_from || !form.labourcard_valid_to) {
      toast.warning("Please fill all required fields");
      return;
    }
    setIdCardInfo(form);
    handleNext();
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <h2 className="m-0 text-lg font-semibold text-foreground">Id/Labour Card/PASI No.</h2>

      <div className="grid max-w-2xl gap-3">
        <div className="grid grid-cols-2 gap-4">
          <Field label="ID/Labourcard No." required>
            <Input value={form.labourcard_no} onChange={(e) => setForm((c) => ({ ...c, labourcard_no: e.target.value }))} />
          </Field>

          <Field label="PASI No.">
            <Input value={form.pasi_no} onChange={(e) => setForm((c) => ({ ...c, pasi_no: e.target.value }))} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Valid From" required>
            <Input
              type="date"
              value={toInputDate(form.labourcard_valid_from)}
              onChange={(e) => setForm((c) => ({ ...c, labourcard_valid_from: fromInputDate(e.target.value) as Date }))}
            />
          </Field>

          <Field label="Valid To" required>
            <Input
              type="date"
              min={toInputDate(form.labourcard_valid_from)}
              disabled={!form.labourcard_valid_from}
              value={toInputDate(form.labourcard_valid_to)}
              onChange={(e) => setForm((c) => ({ ...c, labourcard_valid_to: fromInputDate(e.target.value) as Date }))}
            />
          </Field>
        </div>

        <LookupField
          label="Status"
          value={form.labourcard_status ?? ""}
          valueField="value_code"
          displayFields={["value_code", "value_desc"]}
          columns={[
            { field: "value_code", header: "Code" },
            { field: "value_desc", header: "Description" },
          ]}
          loadOptions={async () => {
            const res = await getDynamicLookup({
              parameter: "MS_EMP_HR_LABOUR_CARD_STATUS",
              loginid: user?.loginid ?? "",
              code1: user?.company_code ?? "",
            });
            return Array.isArray(res) ? res : [];
          }}
          onChange={(value) => setForm((c) => ({ ...c, labourcard_status: value }))}
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