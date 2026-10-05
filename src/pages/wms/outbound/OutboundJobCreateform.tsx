import { FileText, MapPin, Ship, ArrowLeft, Save, X, PackageCheck } from "lucide-react";
import { FormEvent } from "react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { jobClassLabels } from "./Outboundtypes";
import type { WmsRow } from "./Outboundtypes";
import { formatLookupDisplay, lookupText } from "./OutboundHelpers";
import {
  loadOutboundPrincipalLookup,
  loadDepartmentLookup,
  loadWmsMasterLookup,
  loadPortLookup,
} from "./OutboundLookups";

type Props = {
  form:        WmsRow;
  setForm:     (updater: (current: WmsRow) => WmsRow) => void;
  companyCode: string;
  onSubmit:    (event: FormEvent) => void;
  onClose:     () => void;
  saving:      boolean;
  isEditing:   boolean;
};

const fieldClassName =
  "flex h-7 w-full rounded-md border border-input bg-background px-2 py-0.5 text-[11px] text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

export function OutboundJobCreateForm({
  form,
  setForm,
  companyCode,
  onSubmit,
  onClose,
  saving,
  isEditing,
}: Props) {
  const jobClass = String(form.job_class || "N");
  const transportMode = String(form.transport_mode || "S");
  const setValue = (name: string, fieldValue: unknown) =>
    setForm((current) => ({ ...current, [name]: fieldValue }));

  return (
    <section className="grid gap-2.5">
      {/* ── Transaction Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Ship size={14} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="m-0 text-md font-bold leading-tight text-foreground">
                {isEditing ? `Outbound Job ${form.job_no}` : "New Outbound Job"}
              </span>
              <span className={statusBadgeClass(form)}>
                {isEditing ? "Editing" : "Draft"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            <ArrowLeft size={14} />
            List
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            <X size={14} />
            Cancel
          </Button>
          <Button type="submit" form="outbound-job-form" size="sm" disabled={saving}>
            <Save size={14} />
            {saving ? "Saving..." : isEditing ? "Update Job" : "Save Job"}
          </Button>
        </div>
      </div>

      <form
        id="outbound-job-form"
        className="freight-dense-form freight-ui-standard freight-enquiry-editor grid gap-2.5"
        onSubmit={onSubmit}
      >
        {/* ── Section 1: Job Information ── */}
        <SectionPanel icon={Ship} title="Job Information" meta="Outbound Job Creation">
          {/* Changed from 'enquiry-header-fields' to a specific grid layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2">
            
            {/* Row 1: Principal, Department, Division, Job Class */}
            <FormLookup
              label="Principal"
              value={String(form.prin_code || "")}
              displayValue={formatLookupDisplay(form, ["prin_code", "prin_name"])}
              valueField="prin_code"
              displayFields={["prin_code", "prin_name"]}
              columns={[
                { field: "prin_code",      header: "Code" },
                { field: "prin_name",      header: "Principal Name" },
                { field: "prin_dept_code", header: "Department" },
                { field: "div_code",       header: "Division" },
              ]}
              loadOptions={() => loadOutboundPrincipalLookup(companyCode)}
              onChange={(selected, selectedRow) =>
                setForm((current) => ({
                  ...current,
                  prin_code: selected,
                  prin_name: selectedRow ? lookupText(selectedRow, "prin_name") : "",
                  div_code:  selectedRow ? lookupText(selectedRow, "div_code")  || current.div_code  : current.div_code,
                  div_name:  selectedRow ? lookupText(selectedRow, "div_name")  || current.div_name  : current.div_name,
                  dept_code: selectedRow ? lookupText(selectedRow, "prin_dept_code") || current.dept_code : current.dept_code,
                  dept_name: selectedRow ? lookupText(selectedRow, "dept_name") || current.dept_name : current.dept_name,
                  curr_code: selectedRow ? lookupText(selectedRow, "curr_code") || current.curr_code || "OMR" : current.curr_code || "OMR",
                  ex_rate:   current.ex_rate || 1,
                }))
              }
            />

            <FormLookup
              label="Department"
              value={String(form.dept_code || "")}
              displayValue={formatLookupDisplay(form, ["dept_code", "dept_name"])}
              valueField="dept_code"
              displayFields={["dept_code", "dept_name"]}
              columns={[
                { field: "dept_code", header: "Code" },
                { field: "dept_name", header: "Department Name" },
                { field: "div_code",  header: "Division" },
              ]}
              loadOptions={() => loadDepartmentLookup(companyCode, String(form.div_code || ""))}
              onChange={(selected, selectedRow) =>
                setForm((current) => ({
                  ...current,
                  dept_code: selected,
                  dept_name: selectedRow ? lookupText(selectedRow, "dept_name") : "",
                  div_code:  selectedRow ? lookupText(selectedRow, "div_code") || current.div_code : current.div_code,
                  div_name:  selectedRow ? lookupText(selectedRow, "div_name") || current.div_name : current.div_name,
                }))
              }
            />

            <FormLookup
              label="Division"
              value={String(form.div_code || "")}
              displayValue={formatLookupDisplay(form, ["div_code", "div_name"])}
              valueField="div_code"
              displayFields={["div_code", "div_name"]}
              columns={[
                { field: "div_code",     header: "Code" },
                { field: "div_name",     header: "Division Name" },
                { field: "country_code", header: "Country" },
              ]}
              loadOptions={() => loadWmsMasterLookup("division")}
              onChange={(selected, selectedRow) =>
                setForm((current) => ({
                  ...current,
                  div_code: selected,
                  div_name: selectedRow ? lookupText(selectedRow, "div_name") : "",
                }))
              }
            />

            <FormSelect
              label="Job Class"
              value={jobClass}
              onChange={(v) => setValue("job_class", v)}
              options={[
                { value: "", label: "Select Job Class" },
                ...Object.entries(jobClassLabels).map(([code, label]) => ({
                  value: code,
                  label: `${code} - ${String(label)}`,
                })),
              ]}
              required
            />

            {/* Row 2: Job Type, Transport Mode, Schedule Date, Doc Ref */}
            <FormSelect
              label="Job Type"
              value={String(form.job_type || "EXP")}
              onChange={(v) => setValue("job_type", v)}
              options={[{ value: "EXP", label: "EXP - Export" }]}
              required
            />

            <FormSelect
              label="Transport Mode"
              value={transportMode}
              onChange={(v) => setValue("transport_mode", v)}
              options={[
                { value: "S", label: "S - Sea" },
                { value: "A", label: "A - Air" },
                { value: "R", label: "R - Road" },
                { value: "C", label: "C - Courier" },
              ]}
            />

            <FormInput
              label="Schedule Date"
              type="date"
              value={String(form.schedule_date || "")}
              onChange={(v) => setValue("schedule_date", v)}
            />

            <FormInput
              label="Doc Ref"
              value={String(form.doc_ref || "")}
              onChange={(v) => setValue("doc_ref", v)}
            />

            {/* Row 3: Principal Ref 2 */}
            <FormInput
              label="Principal Ref 2"
              value={String(form.prin_ref2 || "")}
              onChange={(v) => setValue("prin_ref2", v)}
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
              label="Country Origin"
              value={String(form.country_origin || "")}
              displayValue={formatLookupDisplay(form, ["country_origin", "country_origin_name"])}
              valueField="country_code"
              displayFields={["country_code", "country_name"]}
              columns={[
                { field: "country_code", header: "Code" },
                { field: "country_name", header: "Country Name" },
              ]}
              loadOptions={() => loadWmsMasterLookup("country")}
              onChange={(selected, selectedRow) =>
                setForm((current) => ({
                  ...current,
                  country_origin: selected,
                  country_origin_name: selectedRow ? lookupText(selectedRow, "country_name") : "",
                }))
              }
            />

            <FormLookup
              label="Country Destination"
              value={String(form.country_destination || "")}
              displayValue={formatLookupDisplay(form, ["country_destination", "country_destination_name"])}
              valueField="country_code"
              displayFields={["country_code", "country_name"]}
              columns={[
                { field: "country_code", header: "Code" },
                { field: "country_name", header: "Country Name" },
              ]}
              loadOptions={() => loadWmsMasterLookup("country")}
              onChange={(selected, selectedRow) =>
                setForm((current) => ({
                  ...current,
                  country_destination: selected,
                  country_destination_name: selectedRow ? lookupText(selectedRow, "country_name") : "",
                }))
              }
            />

            <FormLookup
              label="Port Of Loading"
              value={String(form.port_code || "")}
              displayValue={formatLookupDisplay(form, ["port_code", "port_name"])}
              valueField="port_code"
              displayFields={["port_code", "port_name"]}
              columns={[
                { field: "port_code",    header: "Port Code" },
                { field: "port_name",    header: "Port Name" },
                { field: "country_code", header: "Country" },
              ]}
              loadOptions={loadPortLookup}
              onChange={(selected, selectedRow) =>
                setForm((current) => ({
                  ...current,
                  port_code: selected,
                  port_name: selectedRow ? lookupText(selectedRow, "port_name") : "",
                }))
              }
            />

            <FormLookup
              label="Port Of Destination"
              value={String(form.destination_port || "")}
              displayValue={formatLookupDisplay(form, ["destination_port", "destination_port_name"])}
              valueField="port_code"
              displayFields={["port_code", "port_name"]}
              columns={[
                { field: "port_code",    header: "Port Code" },
                { field: "port_name",    header: "Port Name" },
                { field: "country_code", header: "Country" },
              ]}
              loadOptions={loadPortLookup}
              onChange={(selected, selectedRow) =>
                setForm((current) => ({
                  ...current,
                  destination_port: selected,
                  destination_port_name: selectedRow ? lookupText(selectedRow, "port_name") : "",
                }))
              }
            />
          </div>
        </SectionPanel>

        {/* ── Section 3: References ── */}
        <SectionPanel icon={FileText} title="References" meta="Description And Remarks">
          <div className="grid gap-1.5 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <FormTextarea
                label="Description"
                value={String(form.description1 || "")}
                onChange={(v) => setValue("description1", v)}
                placeholder="Short job description"
              />
            </div>
            <div className="lg:col-span-6">
              <FormTextarea
                label="Remarks"
                value={String(form.remarks || "")}
                onChange={(v) => setValue("remarks", v)}
                placeholder="Operational remarks for this outbound job"
              />
            </div>
          </div>
        </SectionPanel>
      </form>
    </section>
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
          <span className="truncate text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
            {meta}
          </span>
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
}) {
  return (
    <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label ${className}`}>
      {label}
      <Input
        className={`h-7 text-[11px] ${type === "number" ? "text-right tabular-nums" : ""}`}
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
  loadOptions: () => Promise<WmsRow[]>;
  onChange: (value: string, row: WmsRow | null) => void;
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
        loadOptions={loadOptions as any}
        onChange={onChange as any}
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

function statusBadgeClass(form: WmsRow) {
  if (form.canceled === "Y") {
    return "inline-flex items-center rounded border border-red-200 bg-red-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-red-700";
  }
  if (form.invoiced === "Y" || form.confirm_date) {
    return "inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-emerald-700";
  }
  return "inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700";
}