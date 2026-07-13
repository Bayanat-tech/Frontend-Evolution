import { FormEvent, useEffect, useState } from "react";
import { TSponsorHr } from "./employee-hr.types";
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

export const SponsorInfo = ({
  handleNext,
  handleBack,
  sponsorInfo,
  setSponsorInfo,
}: {
  handleNext: () => void;
  handleBack: () => void;
  sponsorInfo: TSponsorHr;
  setSponsorInfo: (value: TSponsorHr) => void;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<TSponsorHr>(sponsorInfo);

  useEffect(() => {
    if (sponsorInfo && Object.keys(sponsorInfo).length) setForm(sponsorInfo);
  }, [sponsorInfo]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.sponsor_id || !form.visa_type || !form.visa_valid_from || !form.visa_valid_to) {
      toast.warning("Please fill all required fields");
      return;
    }
    setSponsorInfo(form);
    handleNext();
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <h2 className="m-0 text-lg font-semibold text-foreground">Sponsor Information</h2>

      <div className="grid max-w-2xl gap-3">
        <LookupField
          label="Sponsor Name"
          value={String(form.sponsor_id ?? "")}
          valueField="sponsor_code"
          displayFields={["sponsor_code", "sponsor_name"]}
          columns={[
            { field: "sponsor_code", header: "Code" },
            { field: "sponsor_name", header: "Sponsor" },
          ]}
          loadOptions={async () => {
            const res = await getDynamicLookup({
              parameter: "MS_EMP_HR_EMPLOYEE_SPONSOR",
              loginid: user?.loginid ?? "",
              code1: user?.company_code ?? "",
            });
            return Array.isArray(res) ? res : [];
          }}
          onChange={(value) => setForm((c) => ({ ...c, sponsor_id: value }))}
        />

        <LookupField
          label="Visa Type"
          value={form.visa_type ?? ""}
          valueField="value_code"
          displayFields={["value_code", "value_desc"]}
          columns={[
            { field: "value_code", header: "Code" },
            { field: "value_desc", header: "Description" },
          ]}
          loadOptions={async () => {
            const res = await getDynamicLookup({
              parameter: "MS_EMP_HR_VISA_TYPE",
              loginid: user?.loginid ?? "",
              code1: user?.company_code ?? "",
            });
            return Array.isArray(res) ? res : [];
          }}
          onChange={(value) => setForm((c) => ({ ...c, visa_type: value }))}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Valid From" required>
            <Input
              type="date"
              value={toInputDate(form.visa_valid_from)}
              onChange={(e) => setForm((c) => ({ ...c, visa_valid_from: fromInputDate(e.target.value) as Date }))}
            />
          </Field>

          <Field label="Valid To" required>
            <Input
              type="date"
              min={toInputDate(form.visa_valid_from)}
              disabled={!form.visa_valid_from}
              value={toInputDate(form.visa_valid_to)}
              onChange={(e) => setForm((c) => ({ ...c, visa_valid_to: fromInputDate(e.target.value) }))}
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