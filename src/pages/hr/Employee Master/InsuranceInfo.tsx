import { FormEvent, useEffect, useState } from "react";
import { TIsuranceHr } from "./employee-hr.types";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

const toInputDate = (value: Date | null | undefined) => {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};
const fromInputDate = (value: string): Date | null => (value ? new Date(value) : null);

export const InsuranceInfo = ({
  handleNext,
  handleBack,
  insuranceInfo,
  setInsuranceInfo,
}: {
  handleNext: () => void;
  handleBack: () => void;
  insuranceInfo: TIsuranceHr;
  setInsuranceInfo: (value: TIsuranceHr) => void;
}) => {
  const [form, setForm] = useState<TIsuranceHr>(insuranceInfo);

  useEffect(() => {
    if (insuranceInfo && Object.keys(insuranceInfo).length) setForm(insuranceInfo);
  }, [insuranceInfo]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setInsuranceInfo(form);
    handleNext();
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <h2 className="m-0 text-lg font-semibold text-foreground">Insurance Information</h2>

      <div className="grid max-w-2xl gap-3">
        <div className="grid grid-cols-[2fr_1fr] gap-4">
          <Field label="Card No.">
            <Input
              value={form.ins_card_no}
              onChange={(e) => {
                if (e.target.value.charAt(0) !== "-") {
                  setForm((c) => ({ ...c, ins_card_no: e.target.value }));
                }
              }}
            />
          </Field>

          <Field label="Type">
            <Input value={form.ins_card_type} onChange={(e) => setForm((c) => ({ ...c, ins_card_type: e.target.value }))} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Valid From">
            <Input
              type="date"
              value={toInputDate(form.ins_card_issue_dt)}
              onChange={(e) => setForm((c) => ({ ...c, ins_card_issue_dt: fromInputDate(e.target.value) as Date }))}
            />
          </Field>

          <Field label="Valid To">
            <Input
              type="date"
              min={toInputDate(form.ins_card_issue_dt)}
              disabled={!form.ins_card_issue_dt}
              value={toInputDate(form.ins_card_exp_dt)}
              onChange={(e) => setForm((c) => ({ ...c, ins_card_exp_dt: fromInputDate(e.target.value) as Date }))}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}