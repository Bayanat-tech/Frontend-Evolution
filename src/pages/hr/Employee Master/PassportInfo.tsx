import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup } from "../../../api/lookups";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { TPassportHr } from "./employee-hr.types";
import { getWmsMaster } from "../../../api/wms";

const toInputDate = (value: Date | null | undefined) => {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};
const fromInputDate = (value: string): Date | null => (value ? new Date(value) : null);

export const PassportInfo = ({
  handleNext,
  handleBack,
  passportInfo,
  setPassportInfo,
}: {
  handleNext: () => void;
  handleBack: () => void;
  passportInfo: TPassportHr;
  setPassportInfo: (value: TPassportHr) => void;
}) => {
  const { user } = useAuth();
  const [form, setForm] = useState<TPassportHr>(passportInfo);

  useEffect(() => {
    if (passportInfo && Object.keys(passportInfo).length) setForm(passportInfo);
  }, [passportInfo]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setPassportInfo(form);
    handleNext();
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <h2 className="m-0 text-lg font-semibold text-foreground">Passport Information</h2>

      <div className="grid max-w-2xl gap-3">
        <Field label="Passport No.">
          <Input value={form.ppt_no} onChange={(e) => setForm((c) => ({ ...c, ppt_no: e.target.value }))} />
        </Field>

        <Field label="Passport Name">
          <Input value={form.ppt_name} onChange={(e) => setForm((c) => ({ ...c, ppt_name: e.target.value }))} />
        </Field>

        <LookupField
          label="Issued Country"
          value={form.ppt_country ?? ""}
          valueField="country_code"
          displayFields={["country_code", "country_name"]}
          columns={[
            { field: "country_code", header: "Code" },
            { field: "country_name", header: "Country" },
          ]}
          loadOptions={async () => {
            const res = await getWmsMaster("country", { page: 1, limit: 100000 });
            return res?.tableData ?? [];
          }}
          onChange={(value) => setForm((c) => ({ ...c, ppt_country: value }))}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Valid From">
            <Input
              type="date"
              value={toInputDate(form.ppt_valid_from)}
              onChange={(e) => setForm((c) => ({ ...c, ppt_valid_from: fromInputDate(e.target.value) as Date }))}
            />
          </Field>

          <Field label="Valid To">
            <Input
              type="date"
              min={toInputDate(form.ppt_valid_from)}
              disabled={!form.ppt_valid_from}
              value={toInputDate(form.ppt_valid_to)}
              onChange={(e) => setForm((c) => ({ ...c, ppt_valid_to: fromInputDate(e.target.value) as Date }))}
            />
          </Field>
        </div>

        <LookupField
          label="Passport In Hand"
          value={form.passport_with ?? ""}
          valueField="value_code"
          displayFields={["value_code", "value_desc"]}
          columns={[
            { field: "value_code", header: "Code" },
            { field: "value_desc", header: "Description" },
          ]}
          loadOptions={async () => {
            const res = await getDynamicLookup({
              parameter: "MS_EMP_HR_PASSPORT_WITH",
              loginid: user?.loginid ?? "",
              code1: user?.company_code ?? "",
            });
            return Array.isArray(res) ? res : [];
          }}
          onChange={(value) => setForm((c) => ({ ...c, passport_with: value }))}
        />

        <LookupField
          label="Status"
          value={form.ppt_status ?? ""}
          valueField="value_code"
          displayFields={["value_code", "value_desc"]}
          columns={[
            { field: "value_code", header: "Code" },
            { field: "value_desc", header: "Description" },
          ]}
          loadOptions={async () => {
            const res = await getDynamicLookup({
              parameter: "MS_EMP_HR_PASSPORT_STATUS",
              loginid: user?.loginid ?? "",
              code1: user?.company_code ?? "",
            });
            return Array.isArray(res) ? res : [];
          }}
          onChange={(value) => setForm((c) => ({ ...c, ppt_status: value }))}
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