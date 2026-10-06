import { Banknote, Coins, IdCard, Plane, StickyNote } from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";
import { executeDynamicMutation } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Field, SectionPanel } from "../../components/ui/Formblocks";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useLookupOptions } from "../../components/ui/Uselookupoptions";
import { useAuth } from "../../state/AuthContext";
import type { TravelFareRow } from "./TravelFare";

/** Exposed to the parent so the header Save button can trigger save() */
export type TravelFareFormHandle = {
  save: () => Promise<void>;
};

type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<TravelFareRow>;
  onClose: (shouldRefetch?: boolean) => void;
};

type NumKey =
  | "ex_rate"
  | "adult_ticket_fair"
  | "child_ticket_fair"
  | "infant_ticket_fair"
  | "fc_adult_fair"
  | "fc_child_fair"
  | "fc_infant_fair";

type FareFormState = {
  airport_code: string;
  airport_name: string;
  airport_short_name: string;
  destination_country: string;
  curr_code: string;
  fair_class: string;
  remarks: string;
  status: string;
} & Record<NumKey, string>; // numbers are kept as strings so an empty box stays empty

const EMPTY: FareFormState = {
  airport_code: "",
  airport_name: "",
  airport_short_name: "",
  destination_country: "",
  curr_code: "",
  ex_rate: "",
  fair_class: "",
  adult_ticket_fair: "",
  child_ticket_fair: "",
  infant_ticket_fair: "",
  fc_adult_fair: "",
  fc_child_fair: "",
  fc_infant_fair: "",
  remarks: "",
  status: "A",
};

const LOCAL_FARES: ReadonlyArray<readonly [NumKey, string]> = [
  ["adult_ticket_fair", "Adult"],
  ["child_ticket_fair", "Child"],
  ["infant_ticket_fair", "Infant"],
];

const FC_FARES: ReadonlyArray<readonly [NumKey, string]> = [
  ["fc_adult_fair", "Adult"],
  ["fc_child_fair", "Child"],
  ["fc_infant_fair", "Infant"],
];

export const FARE_CLASS_OPTIONS = [
  { value: "E", label: "Economy" },
  { value: "B", label: "Business" },
  { value: "F", label: "First" },
];

/* ── Lookup mappers (module-level → referentially stable) ── */
type CountryOption = { country_code: string; country_name: string };
type CurrencyOption = { curr_code: string; curr_name: string; ex_rate: string };

const mapCountry = (r: Record<string, unknown>): CountryOption => ({
  country_code: String(r.COUNTRY_CODE ?? ""),
  country_name: String(r.COUNTRY_NAME ?? ""),
});
const mapCurrency = (r: Record<string, unknown>): CurrencyOption => ({
  curr_code: String(r.CURR_CODE ?? ""),
  curr_name: String(r.CURR_NAME ?? ""),
  ex_rate: r.EX_RATE == null ? "" : String(r.EX_RATE),
});

const str = (v: unknown) => (v == null ? "" : String(v));
const toNum = (v: string) => (v !== "" ? Number(v) : undefined);

export const AddTravelFareForm = forwardRef<TravelFareFormHandle, Props>(
  function AddTravelFareForm({ mode, existingData, onClose }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();
    const readonly = mode === "view";
    const isEdit = mode === "edit";

    // Both dropdowns were always called with code1 (company) only → code2 = ""
    const countryOptions = useLookupOptions("HR_TRAVEL_FARE_DROP_DOWN_COUNTRY", mapCountry, "countries", "");
    const currencyOptions = useLookupOptions("HR_TRAVEL_FARE_DROP_DOWN_CURRENCY", mapCurrency, "currencies", "");

    // The list row already carries every field, so populate straight from it.
    const [form, setForm] = useState<FareFormState>(() =>
      existingData
        ? {
            airport_code: str(existingData.airport_code),
            airport_name: str(existingData.airport_name),
            airport_short_name: str(existingData.airport_short_name),
            destination_country: str(existingData.destination_country),
            curr_code: str(existingData.curr_code),
            ex_rate: str(existingData.ex_rate),
            fair_class: str(existingData.fair_class),
            adult_ticket_fair: str(existingData.adult_ticket_fair),
            child_ticket_fair: str(existingData.child_ticket_fair),
            infant_ticket_fair: str(existingData.infant_ticket_fair),
            fc_adult_fair: str(existingData.fc_adult_fair),
            fc_child_fair: str(existingData.fc_child_fair),
            fc_infant_fair: str(existingData.fc_infant_fair),
            remarks: str(existingData.remarks),
            status: str(existingData.status) || "A",
          }
        : { ...EMPTY },
    );
    const [errors, setErrors] = useState<Partial<Record<keyof FareFormState, string>>>({});

    const set = (field: keyof FareFormState, value: string) =>
      setForm((prev) => ({ ...prev, [field]: value }));

    // Picking a currency also fills the exchange rate from the same lookup row
    const handleCurrencyChange = (code: string) => {
      const picked = currencyOptions.find((c) => c.curr_code === code);
      setForm((prev) => ({
        ...prev,
        curr_code: code,
        ex_rate: picked && picked.ex_rate !== "" ? picked.ex_rate : prev.ex_rate,
      }));
    };

    // ── Validation ──
    const validate = (): string | null => {
      const next: Partial<Record<keyof FareFormState, string>> = {};
      if (!form.airport_code.trim()) next.airport_code = "Fare Code is required";
      if (!form.airport_name.trim()) next.airport_name = "Fare Code Name is required";
      if (!form.status) next.status = "Status is required";
      setErrors(next);
      return Object.values(next)[0] ?? null;
    };

    // ── Submit (called by the page header Save button) ──
    const handleSubmit = async () => {
      const error = validate();
      if (error) {
        toast.warning(error);
        return;
      }
      try {
        await executeDynamicMutation({
          parameter: "HR_TRAVEL_FARE_INS_UPD",
          loginid: user?.loginid ?? "",

          val1s1: user?.company_code ?? "", // COMPANY_CODE
          val1s2: form.airport_code.trim(), // AIRPORT_CODE (key; locked in edit mode)
          val1s3: form.airport_name || undefined,
          val1s4: form.airport_short_name || undefined,
          val1s5: form.destination_country || undefined,
          val1s6: form.curr_code || undefined,
          val1s7: form.fair_class || undefined,
          val1s8: form.remarks || undefined,
          val1s9: form.status || "A",

          val1n1: toNum(form.ex_rate),
          val1n2: toNum(form.adult_ticket_fair),
          val1n3: toNum(form.child_ticket_fair),
          val1n4: toNum(form.infant_ticket_fair),
          val1n5: toNum(form.fc_adult_fair),

          // Carried over unchanged from the old page. The signature only has N1–N5, and
          // "wval1n1/2" looks like a typo — see the note in the hand-off: these two may not be saved.
          wval1n1: toNum(form.fc_child_fair),
          wval1n2: toNum(form.fc_infant_fair),
        });
        toast.success(isEdit ? "Travel fare updated successfully" : "Travel fare saved successfully");
        onClose(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save travel fare");
      }
    };

    useImperativeHandle(ref, () => ({ save: handleSubmit }));

    const amountField = ([key, label]: readonly [NumKey, string]) => (
      <Field key={key} label={label}>
        <Input
          type="number"
          step="0.001"
          min={0}
          className="text-right"
          disabled={readonly}
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
        />
      </Field>
    );

    // ── UI ──
    return (
      <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
        <SectionPanel title="Identification" icon={IdCard}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Fare Code" required error={errors.airport_code}>
              <Input
                disabled={readonly || isEdit}
                value={form.airport_code}
                onChange={(e) => set("airport_code", e.target.value)}
              />
            </Field>

            <Field label="Fare Code Name" required error={errors.airport_name}>
              <Input
                disabled={readonly}
                value={form.airport_name}
                onChange={(e) => set("airport_name", e.target.value)}
              />
            </Field>

            <Field label="Short Name">
              <Input
                disabled={readonly}
                value={form.airport_short_name}
                onChange={(e) => set("airport_short_name", e.target.value)}
              />
            </Field>

            <Field label="Country">
              <Select
                disabled={readonly}
                value={form.destination_country}
                onChange={(e) => set("destination_country", e.target.value)}
              >
                <option value="">-- Select --</option>
                {countryOptions.map((c) => (
                  <option key={c.country_code} value={c.country_code}>
                    {c.country_code} - {c.country_name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Status" required error={errors.status}>
              <Select disabled={readonly} value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="A">Active</option>
                <option value="I">Inactive</option>
              </Select>
            </Field>
          </div>
        </SectionPanel>

        <SectionPanel title="Fare Setup" icon={Plane}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Currency">
              <Select
                disabled={readonly}
                value={form.curr_code}
                onChange={(e) => handleCurrencyChange(e.target.value)}
              >
                <option value="">-- Select --</option>
                {currencyOptions.map((c) => (
                  <option key={c.curr_code} value={c.curr_code}>
                    {c.curr_code} - {c.curr_name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Exchange Rate">
              <Input
                type="number"
                step="0.001"
                min={0}
                className="text-right"
                disabled={readonly}
                value={form.ex_rate}
                onChange={(e) => set("ex_rate", e.target.value)}
              />
            </Field>

            <Field label="Class">
              <Select disabled={readonly} value={form.fair_class} onChange={(e) => set("fair_class", e.target.value)}>
                <option value="">-- Select --</option>
                {FARE_CLASS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </SectionPanel>

        <div className="grid gap-2 md:grid-cols-2">
          <SectionPanel title="Ticket Fare" icon={Banknote}>
            <div className="grid gap-3 md:grid-cols-3">{LOCAL_FARES.map(amountField)}</div>
          </SectionPanel>

          <SectionPanel title="Ticket Fare (Foreign Currency)" icon={Coins}>
            <div className="grid gap-3 md:grid-cols-3">{FC_FARES.map(amountField)}</div>
          </SectionPanel>
        </div>

        <SectionPanel title="Notes" icon={StickyNote}>
          <Field label="Remarks">
            <textarea
              className="input"
              rows={3}
              disabled={readonly}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
          </Field>
        </SectionPanel>
      </div>
    );
  },
);

export default AddTravelFareForm;