import { FormEvent, useEffect, useState } from "react";
import { TAirfareHr } from "./employee-hr.types";
import { useAuth } from "../../../state/AuthContext";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup } from "../../../api/lookups";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";


export const AirfareInfo = ({
  handleNext,
  handleBack,
  airfareInfo,
  setAirfareInfo,
  submitting,
}: {
  submitting: boolean;
  handleNext: () => void;
  handleBack: () => void;
  airfareInfo: TAirfareHr;
  setAirfareInfo: React.Dispatch<React.SetStateAction<TAirfareHr>>;
}) => {
  const { user } = useAuth();
  const [form, setForm] = useState<TAirfareHr>(airfareInfo);

  useEffect(() => {
    if (airfareInfo && Object.keys(airfareInfo).length) setForm(airfareInfo);
  }, [airfareInfo]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setAirfareInfo((prev) => ({ ...prev, ...form }));
    handleNext();
  };

  const handleNumberChange = (field: keyof TAirfareHr) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value.charAt(0) !== "-") {
      setForm((c) => ({ ...c, [field]: Number(e.target.value) }));
    }
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <h2 className="m-0 text-lg font-semibold text-foreground">Airfare Information</h2>

      <div className="grid max-w-2xl gap-3">
        <LookupField
          label="Fare Code"
          value={form.airport_code ?? ""}
          valueField="airport_code"
          displayFields={["airport_code", "airport_name"]}
          columns={[
            { field: "airport_code", header: "Code" },
            { field: "airport_name", header: "Airport" },
          ]}
          loadOptions={async () => {
            const res = await getDynamicLookup({
              parameter: "MS_EMP_HR_AIRPORT",
              loginid: user?.loginid ?? "",
              code1: user?.company_code ?? "",
            });
            return Array.isArray(res) ? res : [];
          }}
          onChange={(value) => setForm((c) => ({ ...c, airport_code: value }))}
        />

        <div className="grid grid-cols-2 gap-4">
          <LookupField
            label="Eligibility"
            value={form.ticket_eligibility ?? ""}
            valueField="value_code"
            displayFields={["value_code", "value_desc"]}
            columns={[
              { field: "value_code", header: "Code" },
              { field: "value_desc", header: "Description" },
            ]}
            loadOptions={async () => {
              const res = await getDynamicLookup({
                parameter: "MS_EMP_HR_TICKET_ELIGIBILITY",
                loginid: user?.loginid ?? "",
                code1: user?.company_code ?? "",
              });
              return Array.isArray(res) ? res : [];
            }}
            onChange={(value) => setForm((c) => ({ ...c, ticket_eligibility: value }))}
          />

          <Field label="No. of Adult Depended">
            <Input type="number" min={0} value={form.ticket_dpend_adult ?? ""} onChange={handleNumberChange("ticket_dpend_adult")} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Total No. of Adults">
            <Input type="number" min={0} value={form.ta_no ?? ""} onChange={handleNumberChange("ta_no")} />
          </Field>

          <Field label="No. of Childrens">
            <Input type="number" min={0} value={form.tc_no ?? ""} onChange={handleNumberChange("tc_no")} />
          </Field>

          <Field label="No. of Infants">
            <Input type="number" min={0} value={form.ti_no ?? ""} onChange={handleNumberChange("ti_no")} />
          </Field>
        </div>

        <Field label="Ticket Once in Months">
          <Input type="number" min={0} value={form.ticket_eligible_period ?? ""} onChange={handleNumberChange("ticket_eligible_period")} />
        </Field>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={handleBack}>
          Back
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit"}
        </Button>
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