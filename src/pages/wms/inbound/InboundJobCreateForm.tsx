import { FileText, MapPin, Ship, PackageCheck } from "lucide-react";
import { type FormEvent } from "react";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { type LookupRow } from "../../../api/lookups";
import { jobClassLabels } from "../../../config/staticData";
import {
  loadInboundPrincipalLookup,
  loadInboundDepartmentLookup,
  loadInboundDivisionLookup,
  loadInboundCountryLookup,
  loadInboundPortLookup,
} from "../../../utils/lookupLoaders";
import { type WmsRow } from "../../../utils/inboundHelpers";

type Props = {
  form:        any;
  setForm:     (updater: (cur: WmsRow) => WmsRow) => void;
  companyCode: string;
  onSubmit:    (e: FormEvent) => void;
};

const fieldClassName =
  "flex h-7 w-full rounded-md border border-input bg-background px-2 py-0.5 text-[11px] text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

export function InboundJobCreateForm({ form, setForm, companyCode, onSubmit }: Props) {
  const set = (name: string, val: unknown) =>
    setForm((cur) => ({ ...cur, [name]: val }));

  const applyPrincipal = (value: string, row: LookupRow | null) =>
    setForm((cur) => ({
      ...cur,
      prin_code: value,
      prin_name: row ? String(row["prin_name"] ?? row["PRIN_NAME"] ?? cur.prin_name ?? "") : cur.prin_name,
      dept_code: row ? String(row["prin_dept_code"] ?? row["PRIN_DEPT_CODE"] ?? cur.dept_code ?? "") : cur.dept_code,
      dept_name: row ? String(row["dept_name"] ?? row["DEPT_NAME"] ?? cur.dept_name ?? "") : cur.dept_name,
      div_code:  row ? String(row["div_code"] ?? row["DIV_CODE"] ?? cur.div_code ?? "") : cur.div_code,
      div_name:  row ? String(row["div_name"] ?? row["DIV_NAME"] ?? cur.div_name ?? "") : cur.div_name,
    }));

  const applyDepartment = (value: string, row: LookupRow | null) =>
    setForm((cur) => ({
      ...cur,
      dept_code: value,
      dept_name: row ? String(row["dept_name"] ?? row["DEPT_NAME"] ?? "") : cur.dept_name,
      div_code:  row ? String(row["div_code"]  ?? row["DIV_CODE"]  ?? cur.div_code ?? "") : cur.div_code,
      div_name:  row ? String(row["div_name"]  ?? row["DIV_NAME"]  ?? cur.div_name ?? "") : cur.div_name,
    }));

  const applyDivision = (value: string, row: LookupRow | null) =>
    setForm((cur) => ({
      ...cur,
      div_code: value,
      div_name: row ? String(row["div_name"] ?? row["DIV_NAME"] ?? "") : cur.div_name,
    }));

  const applyOriginCountry = (value: string, row: LookupRow | null) =>
    setForm((cur) => ({
      ...cur,
      country_origin: value,
      country_origin_name: row ? String(row["country_name"] ?? row["COUNTRY_NAME"] ?? "") : "",
      port_code: "",
      port_name: "",
    }));

  const applyDestinationCountry = (value: string, row: LookupRow | null) =>
    setForm((cur) => ({
      ...cur,
      country_destination: value,
      country_destination_name: row ? String(row["country_name"] ?? row["COUNTRY_NAME"] ?? "") : "",
      destination_port: "",
      destination_port_name: "",
    }));

  const applyPortOfLoading = (value: string, row: LookupRow | null) =>
    setForm((cur) => ({
      ...cur,
      port_code: value,
      port_name: row ? String(row["port_name"] ?? row["PORT_NAME"] ?? "") : "",
    }));

  const applyPortOfDestination = (value: string, row: LookupRow | null) =>
    setForm((cur) => ({
      ...cur,
      destination_port: value,
      destination_port_name: row ? String(row["port_name"] ?? row["PORT_NAME"] ?? "") : "",
    }));

  return (
    <form
      id="inbound-job-form"
      className="freight-dense-form freight-ui-standard freight-enquiry-editor grid gap-2.5"
      onSubmit={onSubmit}
    >
      {/* ── Section 1: Job Information ── */}
      <SectionPanel icon={Ship} title="Job Information" meta="Inbound Job Creation">
        {/* Replaced 'enquiry-header-fields' with a structured grid to match Freight UI */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2">
          
          <div className="grid gap-0.5 text-[11.5px] font-semibold text-slate-700 freight-field-label">
            <span>Principal <span style={{ color: "#E24B4A" }}>*</span></span>
            <LookupField
              compact
              label="Principal"
              value={String(form.prin_code || "")}
              displayValue={[form.prin_code, form.prin_name].filter(Boolean).join(" - ")}
              valueField="prin_code"
              displayFields={["prin_code", "prin_name"]}
              columns={[
                { field: "prin_code",      header: "Code" },
                { field: "prin_name",      header: "Principal Name" },
                { field: "prin_dept_code", header: "Department" },
                { field: "div_code",       header: "Division" },
              ]}
              placeholder="Select principal"
              loadOptions={() => loadInboundPrincipalLookup(companyCode)}
              onChange={applyPrincipal}
              required
              enforceRequired
            />
          </div>

          <FormLookup
            label="Department"
            value={String(form.dept_code || "")}
            displayValue={[form.dept_code, form.dept_name].filter(Boolean).join(" - ")}
            valueField="dept_code"
            displayFields={["dept_code", "dept_name"]}
            columns={[
              { field: "dept_code", header: "Code" },
              { field: "dept_name", header: "Department Name" },
              { field: "div_code",  header: "Division" },
            ]}
            loadOptions={() => loadInboundDepartmentLookup(companyCode, String(form.div_code || ""))}
            onChange={applyDepartment}
          />

          <FormLookup
            label="Division"
            value={String(form.div_code || "")}
            displayValue={[form.div_code, form.div_name].filter(Boolean).join(" - ")}
            valueField="div_code"
            displayFields={["div_code", "div_name"]}
            columns={[
              { field: "div_code",  header: "Code" },
              { field: "div_name",  header: "Division Name" },
            ]}
            loadOptions={() => loadInboundDivisionLookup(companyCode)}
            onChange={applyDivision}
          />

          <FormSelect
            label="Job Classification"
            value={String(form.job_class || "")}
            onChange={(v) => set("job_class", v)}
            options={[
              { value: "", label: "Select Job Classification" },
              ...Object.entries(jobClassLabels).map(([code, label]) => ({
                value: code,
                label: `${code} - ${String(label)}`,
              })),
            ]}
            required
          />

          <FormSelect
            label="Job Type"
            value={String(form.job_type || "IMP")}
            onChange={(v) => set("job_type", v)}
            options={[{ value: "IMP", label: "IMP - Inbound" }]}
            required
          />

          <FormSelect
            label="Transport Mode"
            value={String(form.transport_mode || "S")}
            onChange={(v) => set("transport_mode", v)}
            options={[
              { value: "S", label: "S - Sea" },
              { value: "A", label: "A - Air" },
              { value: "R", label: "R - Road\\Land" },
              { value: "C", label: "C - Courier" },
            ]}
          />

          <FormInput
            label="Schedule Date"
            type="date"
            value={String(form.schedule_date || "")}
            onChange={(v) => set("schedule_date", v)}
          />
        </div>
      </SectionPanel>

      {/* ── Section 2: Routing ── */}
      <SectionPanel
        icon={MapPin}
        title="Routing"
        meta={`${form.country_origin || "Origin"} -> ${form.country_destination || "Destination"}`}
      >
        {/* Standardized grid for routing fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2 items-end">
          <FormLookup
            label="Origin Country"
            value={String(form.country_origin || "")}
            displayValue={[form.country_origin, form.country_origin_name].filter(Boolean).join(" - ")}
            valueField="country_code"
            displayFields={["country_code", "country_name"]}
            columns={[
              { field: "country_code", header: "Code" },
              { field: "country_name", header: "Country" },
            ]}
            loadOptions={() => loadInboundCountryLookup()}
            onChange={applyOriginCountry}
          />

          <FormLookup
            label="Destination Country"
            value={String(form.country_destination || "")}
            displayValue={[form.country_destination, form.country_destination_name].filter(Boolean).join(" - ")}
            valueField="country_code"
            displayFields={["country_code", "country_name"]}
            columns={[
              { field: "country_code", header: "Code" },
              { field: "country_name", header: "Country" },
            ]}
            loadOptions={() => loadInboundCountryLookup()}
            onChange={applyDestinationCountry}
          />

          <FormLookup
            label="Port Of Loading"
            value={String(form.port_code || "")}
            displayValue={[form.port_code, form.port_name].filter(Boolean).join(" - ")}
            valueField="port_code"
            displayFields={["port_code", "port_name"]}
            columns={[
              { field: "port_code",    header: "Port Code" },
              { field: "port_name",    header: "Port Name" },
              { field: "country_code", header: "Country" },
            ]}
            loadOptions={() => loadInboundPortLookup(String(form.country_origin || ""))}
            onChange={applyPortOfLoading}
          />

          <FormLookup
            label="Port Of Destination"
            value={String(form.destination_port || "")}
            displayValue={[form.destination_port, form.destination_port_name].filter(Boolean).join(" - ")}
            valueField="port_code"
            displayFields={["port_code", "port_name"]}
            columns={[
              { field: "port_code",    header: "Port Code" },
              { field: "port_name",    header: "Port Name" },
              { field: "country_code", header: "Country" },
            ]}
            loadOptions={() => loadInboundPortLookup(String(form.country_destination || ""))}
            onChange={applyPortOfDestination}
          />
        </div>
      </SectionPanel>

      {/* ── Section 3: References ── */}
      <SectionPanel icon={FileText} title="References" meta="Description And Remarks">
        <div className="grid gap-1.5 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <FormTextarea
              label="Job Description"
              value={String(form.description1 || "")}
              onChange={(v) => set("description1", v)}
              placeholder="Job description"
            />
          </div>
          <div className="lg:col-span-4">
            <FormTextarea
              label="Job Remarks"
              value={String(form.remarks || "")}
              onChange={(v) => set("remarks", v)}
              placeholder="Job remarks"
            />
          </div>
          <div className="lg:col-span-4">
            <FormTextarea
              label="GRN Remarks"
              value={String(form.grn_remarks || "")}
              onChange={(v) => set("grn_remarks", v)}
              placeholder="GRN remarks"
            />
          </div>
        </div>
      </SectionPanel>
    </form>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Shared UI primitives (mirrors FreightEnquiryMainPage)
 * ───────────────────────────────────────────────────────────── */

function SectionPanel({
  title,
  meta,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  meta?: string;
  icon: typeof PackageCheck;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`freight-panel overflow-hidden rounded-md border bg-background shadow-sm ${className}`}>
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Icon size={15} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-sm font-semibold text-foreground">{title}</h3>
          </div>
        </div>
        {meta && ( 
          <span className="truncate text-[10.5px] font-medium text-muted-foreground">{meta}</span>
        )}
      </div>
      <div className="freight-panel-body p-3">{children}</div>
    </section>
  );
}

function FormInput({
  label,
  value,
  onChange,
  type = "text",
  step,
  required,
  placeholder,
  className = "",
  disabled,
  inputClassName = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  inputClassName?: string;
}) {
  return (
    <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label ${className}`}>
      {label}
      <Input
        className={`h-7 text-[11px] ${type === "number" ? "text-right tabular-nums" : ""} ${inputClassName}`}
        value={value}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onInvalid={(event) => (event.target as HTMLInputElement).setCustomValidity(`${label} is required`)}
        onInput={(event) => (event.target as HTMLInputElement).setCustomValidity("")}
      />
    </label>
  );
}

function FormLookup({
  label,
  value,
  displayValue,
  valueField,
  displayFields,
  columns,
  loadOptions,
  onChange,
  required,
  disabled,
  className = "",
}: {
  label: string;
  value: string;
  displayValue?: string;
  valueField: string;
  displayFields: string[];
  columns: Array<{ field: string; header: string }>;
  loadOptions: () => Promise<LookupRow[]>;
  onChange: (value: string, row: LookupRow | null) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`grid gap-0.5 text-[11.5px] font-semibold text-slate-700 freight-field-label ${className}`}>
      <span>
        {label} {required && <span style={{ color: "#E24B4A" }}>*</span>}
      </span>
      <LookupField
        compact
        label={label}
        value={value}
        displayValue={displayValue}
        columns={columns}
        valueField={valueField}
        displayFields={displayFields}
        loadOptions={loadOptions}
        onChange={onChange}
        required={required}
        disabled={disabled}
        enforceRequired={required}
        placeholder={`Select ${label}`}
      />
    </div>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <label className="grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label">
      <span>
        {label} {required && <span style={{ color: "#E24B4A" }}>*</span>}
      </span>
      <select
        className={fieldClassName}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        onInvalid={(event) => (event.target as HTMLSelectElement).setCustomValidity(`${label} is required`)}
        onInput={(event) => (event.target as HTMLSelectElement).setCustomValidity("")}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormTextarea({
  label,
  value,
  onChange,
  className = "",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label ${className}`}>
      {label}
      <textarea
        rows={5}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-[11px] text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 resize-y min-h-[120px]"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}