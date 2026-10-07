import { 
  FileText, MapPin, Ship, PackageCheck, Pencil, Save, X 
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { type LookupRow } from "../../../api/lookups";
import { api } from "../../../api/client";
import { executeWmsInboundSql } from "../../../api/wms";
import { useToast } from "../../../components/ui/AlertToast";
import { 
  loadInboundCountryLookup, 
  loadInboundPortLookup 
} from "../../../utils/lookupLoaders";
import { 
  type WmsRow, 
  value, 
  normalizeRow, 
  sqlEscape 
} from "../../../utils/inboundHelpers";

type Props = {
  job:         WmsRow | null;
  loadingJob:  boolean;
  companyCode: string;
  jobNo:       string;
  onSaved?:    () => void | Promise<void>;
};

/* ─────────────────────────── building blocks (Exact copy from InboundJobCreateForm) ─────────────────────────── */

const fieldClassName =
  "flex h-7 w-full rounded-md border border-input bg-background px-2 py-0.5 text-[11px] text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-100";

function SectionPanel({
  title,
  meta,
  icon: Icon,
  right,
  children,
  className = "",
}: {
  title: string;
  meta?: string;
  icon: typeof PackageCheck;
  right?: React.ReactNode;
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
        <div className="flex items-center gap-2">
          {meta && (
            <span className="truncate text-[10.5px] font-medium text-muted-foreground mr-2">{meta}</span>
          )}
          {right}
        </div>
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  disabled?: boolean;
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
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label ${className}`}>
      {label}
      <textarea
        rows={5}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-[11px] text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed resize-y min-h-[120px]"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

/* ─────────────────────────── form shape ─────────────────────────── */

type EditableForm = {
  description1:             string;
  country_origin:           string;
  country_origin_name:      string;
  country_destination:      string;
  country_destination_name: string;
  port_code:                string;
  port_name:                string;
  destination_port:         string;
  destination_port_name:    string;
  remarks:                  string;
  grn_remarks:              string;
};

const emptyForm: EditableForm = {
  description1: "", country_origin: "", country_origin_name: "",
  country_destination: "", country_destination_name: "",
  port_code: "", port_name: "", destination_port: "", destination_port_name: "",
  remarks: "", grn_remarks: "",
};

const str = (v: unknown) => String(v ?? "");

/* ─────────────────────────── component ─────────────────────────── */

export function InboundJobDetailsTab({ job, loadingJob, companyCode, jobNo, onSaved }: Props) {
  const { toast } = useToast();

  const deptCode = value(job || {}, "dept_code");
  const divCode  = value(job || {}, "div_code");

  const [deptName, setDeptName] = useState<string>("");
  const [divName,  setDivName]  = useState<string>("");

  const [isEditing, setIsEditing] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [formData,  setFormData]  = useState<EditableForm>(emptyForm);

  // Guards against double-clicks firing two PUTs
  const savingRef = useRef(false);

  useEffect(() => {
    if (loadingJob || !job || !companyCode) return;
    let cancelled = false;

    const fetchNames = async () => {
      try {
        const [deptRows, divRows] = await Promise.all([
          deptCode
            ? executeWmsInboundSql(
                `SELECT DEPT_NAME FROM MS_DEPARTMENT
                 WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' AND DEPT_CODE = '${sqlEscape(String(deptCode))}'`
              )
            : Promise.resolve([]),
          divCode
            ? executeWmsInboundSql(
                `SELECT DIV_NAME FROM MS_HR_DIVISION
                 WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' AND DIV_CODE = '${sqlEscape(String(divCode))}'`
              )
            : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setDeptName(String(value(normalizeRow(deptRows?.[0] || {}), "dept_name") || ""));
        setDivName(String(value(normalizeRow(divRows?.[0] || {}), "div_name") || ""));
      } catch {
        if (cancelled) return;
        setDeptName("");
        setDivName("");
      }
    };

    void fetchNames();
    return () => { cancelled = true; };
  }, [loadingJob, job, companyCode, deptCode, divCode]);

  if (loadingJob || !job) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground flex items-center justify-center h-40">
          Loading job details…
        </CardContent>
      </Card>
    );
  }

  const startEdit = () => {
    setFormData({
      description1:             str(value(job, "description1")),
      country_origin:           str(value(job, "country_origin")),
      country_origin_name:      "",
      country_destination:      str(value(job, "country_destination")),
      country_destination_name: "",
      port_code:                str(value(job, "port_code")),
      port_name:                "",
      destination_port:         str(value(job, "destination_port")),
      destination_port_name:    "",
      remarks:                  str(value(job, "remarks")),
      grn_remarks:              str(value(job, "grn_remarks")),
    });
    setIsEditing(true);
  };

  const cancelEdit = () => setIsEditing(false);

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const blankToNull = (v: string) => (v.trim() === "" ? null : v);

      await api.put(`/api/wms/inbound/editInboundJob/${encodeURIComponent(jobNo)}`, {
        country_origin:      blankToNull(formData.country_origin),
        country_destination: blankToNull(formData.country_destination),
        description1:        blankToNull(formData.description1),
        remarks:             blankToNull(formData.remarks),
        grn_remarks:         blankToNull(formData.grn_remarks),
        port_code:           blankToNull(formData.port_code),
        destination_port:    blankToNull(formData.destination_port),
        prin_ref2:           value(job, "prin_ref2") ?? null,
        transport_mode:      value(job, "transport_mode") ?? null,
        schedule_date:       value(job, "schedule_date") ?? null,
        job_class:           value(job, "job_class") ?? null,
        company_code:        value(job, "company_code") ?? companyCode,
      });
      toast.success("Job details updated successfully");
      setIsEditing(false);
      if (onSaved) await onSaved();
    } catch (error) {
      console.error("[InboundJobDetailsTab] save failed", error);
      toast.error(error instanceof Error ? error.message : "Unable to update job details");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const setField = (key: keyof EditableForm) => (v: string) =>
    setFormData((cur) => ({ ...cur, [key]: v }));

  // NOTE: every button inside the <form> MUST be type="button".
  // Otherwise the browser treats it as a submit button and does a native
  // form submit (full page reload), which cancels the in-flight API call.
  const editControls = isEditing ? (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={cancelEdit}
        disabled={saving}
        className="h-6 text-[10px] px-2 bg-white border-gray-300"
      >
        <X size={12} className="mr-1" /> Cancel
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={() => void handleSave()}
        disabled={saving}
        className="h-6 text-[10px] px-2 bg-blue-600 hover:bg-blue-700 text-white"
      >
        <Save size={12} className="mr-1" /> {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  ) : (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={startEdit}
      className="h-6 text-[10px] px-2 border-blue-200 text-blue-700 hover:bg-blue-50 bg-white"
    >
      <Pencil size={12} className="mr-1" /> Edit Details
    </Button>
  );

  return (
    <form
      className="freight-dense-form freight-ui-standard freight-enquiry-editor grid gap-2.5"
      noValidate
      onSubmit={(event) => {
        // Never allow a native submit/reload; Enter key inside an input also lands here.
        event.preventDefault();
        if (isEditing) void handleSave();
      }}
    >
      
      {/* ── 1. Job Information ── */}
      <SectionPanel 
        icon={Ship} 
        title="Job Information" 
        meta="Inbound Job Creation"
        right={editControls}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2">
          
          <FormSelect
            label="Job Type"
            value={str(value(job, "job_type"))}
            onChange={() => {}}
            options={[{ value: str(value(job, "job_type")), label: str(value(job, "job_type")) || "—" }]}
            disabled={!isEditing}
          />

          <FormInput
            label="Department"
            value={deptName ? `${deptCode} - ${deptName}` : str(deptCode)}
            onChange={() => {}}
            disabled={!isEditing}
          />

          <FormInput
            label="Division"
            value={divName ? `${divCode} - ${divName}` : str(divCode)}
            onChange={() => {}}
            disabled={!isEditing}
          />

          <FormSelect
            label="Job Classification"
            value={str(value(job, "job_class"))}
            onChange={() => {}}
            options={[{ value: str(value(job, "job_class")), label: str(value(job, "job_class")) || "—" }]}
            disabled={!isEditing}
          />

          <FormInput
            label="Job Flag"
            value={str(value(job, "job_flag"))}
            onChange={() => {}}
            disabled={!isEditing}
          />

          <FormSelect
            label="Transport Mode"
            value={str(value(job, "transport_mode"))}
            onChange={() => {}}
            options={[{ value: str(value(job, "transport_mode")), label: str(value(job, "transport_mode")) || "—" }]}
            disabled={!isEditing}
          />

          <FormInput
            label="Schedule Date"
            type="date"
            value={str(value(job, "schedule_date"))}
            onChange={() => {}}
            disabled={!isEditing}
          />
        </div>
      </SectionPanel>

      {/* ── 2. Routing ── */}
      <SectionPanel
        icon={MapPin}
        title="Routing"
        meta={`${value(job, "country_origin") || "Origin"} -> ${value(job, "country_destination") || "Destination"}`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2 items-end">
          {isEditing ? (
            <>
              <FormLookup
                label="Origin Country"
                value={formData.country_origin}
                displayValue={[formData.country_origin, formData.country_origin_name].filter(Boolean).join(" - ")}
                valueField="country_code"
                displayFields={["country_code", "country_name"]}
                columns={[
                  { field: "country_code", header: "Code" },
                  { field: "country_name", header: "Country" },
                ]}
                loadOptions={() => loadInboundCountryLookup()}
                onChange={(val, row) =>
                  setFormData((cur) => ({
                    ...cur,
                    country_origin: val,
                    country_origin_name: row ? String(row["country_name"] ?? row["COUNTRY_NAME"] ?? "") : "",
                    port_code: "", port_name: "",
                  }))
                }
              />
              <FormLookup
                label="Destination Country"
                value={formData.country_destination}
                displayValue={[formData.country_destination, formData.country_destination_name].filter(Boolean).join(" - ")}
                valueField="country_code"
                displayFields={["country_code", "country_name"]}
                columns={[
                  { field: "country_code", header: "Code" },
                  { field: "country_name", header: "Country" },
                ]}
                loadOptions={() => loadInboundCountryLookup()}
                onChange={(val, row) =>
                  setFormData((cur) => ({
                    ...cur,
                    country_destination: val,
                    country_destination_name: row ? String(row["country_name"] ?? row["COUNTRY_NAME"] ?? "") : "",
                    destination_port: "", destination_port_name: "",
                  }))
                }
              />
              <FormLookup
                label="Port Of Loading"
                value={formData.port_code}
                displayValue={[formData.port_code, formData.port_name].filter(Boolean).join(" - ")}
                valueField="port_code"
                displayFields={["port_code", "port_name"]}
                columns={[
                  { field: "port_code",    header: "Port Code" },
                  { field: "port_name",    header: "Port Name" },
                  { field: "country_code", header: "Country" },
                ]}
                loadOptions={() => loadInboundPortLookup(formData.country_origin)}
                onChange={(val, row) =>
                  setFormData((cur) => ({
                    ...cur,
                    port_code: val,
                    port_name: row ? String(row["port_name"] ?? row["PORT_NAME"] ?? "") : "",
                  }))
                }
              />
              <FormLookup
                label="Port Of Destination"
                value={formData.destination_port}
                displayValue={[formData.destination_port, formData.destination_port_name].filter(Boolean).join(" - ")}
                valueField="port_code"
                displayFields={["port_code", "port_name"]}
                columns={[
                  { field: "port_code",    header: "Port Code" },
                  { field: "port_name",    header: "Port Name" },
                  { field: "country_code", header: "Country" },
                ]}
                loadOptions={() => loadInboundPortLookup(formData.country_destination)}
                onChange={(val, row) =>
                  setFormData((cur) => ({
                    ...cur,
                    destination_port: val,
                    destination_port_name: row ? String(row["port_name"] ?? row["PORT_NAME"] ?? "") : "",
                  }))
                }
              />
            </>
          ) : (
            <>
              <FormInput label="Origin Country" value={str(value(job, "country_origin"))} onChange={() => {}} disabled />
              <FormInput label="Destination Country" value={str(value(job, "country_destination"))} onChange={() => {}} disabled />
              <FormInput label="Port Of Loading" value={str(value(job, "port_code"))} onChange={() => {}} disabled />
              <FormInput label="Port Of Destination" value={str(value(job, "destination_port"))} onChange={() => {}} disabled />
            </>
          )}
        </div>
      </SectionPanel>

      {/* ── 3. References ── */}
      <SectionPanel icon={FileText} title="References" meta="Description And Remarks">
        <div className="grid gap-1.5 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <FormTextarea
              label="Job Description"
              value={isEditing ? formData.description1 : str(value(job, "description1"))}
              onChange={setField("description1")}
              placeholder="Job description"
              disabled={!isEditing}
            />
          </div>
          <div className="lg:col-span-4">
            <FormTextarea
              label="Job Remarks"
              value={isEditing ? formData.remarks : str(value(job, "remarks"))}
              onChange={setField("remarks")}
              placeholder="Job remarks"
              disabled={!isEditing}
            />
          </div>
          <div className="lg:col-span-4">
            <FormTextarea
              label="GRN Remarks"
              value={isEditing ? formData.grn_remarks : str(value(job, "grn_remarks"))}
              onChange={setField("grn_remarks")}
              placeholder="GRN remarks"
              disabled={!isEditing}
            />
          </div>
        </div>
      </SectionPanel>

    </form>
  );
}