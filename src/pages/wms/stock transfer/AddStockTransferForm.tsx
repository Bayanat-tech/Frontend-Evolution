import { ArrowLeft, Save, X, PackageCheck, FileText, Ship } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { createSTN, executeWmsInboundSql } from "../../../api/wms";
import type { LookupRow } from "../../../api/lookups";

interface TransferFormProps {
  onClose: (shouldRefetch?: boolean) => void;
}

function normalizeRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...row };
  Object.entries(row).forEach(([k, v]) => { out[k.toLowerCase()] = v; });
  return out;
}

async function loadPrincipalLookup(companyCode: string): Promise<LookupRow[]> {
  const rows = await executeWmsInboundSql(
    `SELECT PRIN_CODE, PRIN_NAME FROM MS_PRINCIPAL WHERE COMPANY_CODE = '${companyCode.replace(/'/g, "''")}' ORDER BY PRIN_CODE`
  );
  return rows.map((r) => normalizeRow(r as Record<string, unknown>) as LookupRow);
}

export function TransferForm({ onClose }: TransferFormProps) {
  const { user } = useAuth();
  const [prinCode, setPrinCode] = useState("");
  const [prinName, setPrinName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prinCode.trim()) {
      setNotice({ type: "error", message: "Principal is required." });
      return;
    }
    if (!description.trim()) {
      setNotice({ type: "error", message: "Remarks / Description is required." });
      return;
    }
    setSaving(true);
    try {
      await createSTN({
        prin_code: prinCode,
        description,
        stn_date: new Date().toISOString().slice(0, 10),
        user_id: user?.loginid || user?.username || "Admin",
        company_code: user?.company_code || "",
      });
      onClose(true);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to create STN." });
      setSaving(false);
    }
  };

  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* Form Header (Exactly matching Inbound Job style) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onClose()}
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary mr-1">
              <PackageCheck size={18} />
            </span>
            <h2 className="text-foreground m-0" style={{ fontSize: "16px", letterSpacing: "-0.01em", fontWeight: 600 }}>
              New Stock Transfer
            </h2>
          </div>
        </div>
        
        {/* Action Buttons (Freight Style) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onClose()}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-all text-xs font-medium shadow-sm cursor-pointer disabled:opacity-50"
          >
            <X size={14} /> Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !prinCode.trim() || !description.trim()}
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save size={14} /> {saving ? "Saving..." : "Save Transfer"}
          </button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* Form Body */}
      <form className="freight-dense-form freight-ui-standard freight-enquiry-editor grid gap-2.5" onSubmit={handleSubmit}>
        
        {/* Section 1: Transfer Information */}
        <SectionPanel icon={Ship} title="Transfer Information" meta="Create new STN">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2">
            
            <div className="lg:col-span-2">
              <LookupField
                label="Principal"
                value={prinCode}
                displayValue={prinCode && prinName ? `${prinCode} - ${prinName}` : prinCode}
                valueField="prin_code"
                displayFields={["prin_code", "prin_name"]}
                columns={[
                  { field: "prin_code", header: "Principal Code" },
                  { field: "prin_name", header: "Principal Name" },
                ]}
                placeholder="Select principal"
                loadOptions={() => loadPrincipalLookup(user?.company_code || "")}
                onChange={(selected, selectedRow) => {
                  setPrinCode(selected);
                  setPrinName(selectedRow ? String(selectedRow["prin_name"] ?? selectedRow["PRIN_NAME"] ?? "") : "");
                }}
                required
              />
            </div>

            <div className="lg:col-span-2">
              <FormInput
                label="STN Date"
                value={new Date().toLocaleDateString("en-GB")}
                onChange={() => {}}
                disabled
              />
            </div>
            
          </div>
        </SectionPanel>

        {/* Section 2: References */}
        <SectionPanel icon={FileText} title="References" meta="Description And Remarks">
          <div className="grid gap-1.5 lg:grid-cols-12">
            <div className="lg:col-span-12">
              <FormTextarea
                label="Remarks / Description"
                value={description}
                onChange={setDescription}
                placeholder="Enter transfer remarks..."
                required
              />
            </div>
          </div>
        </SectionPanel>

      </form>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Shared UI primitives (Copied exactly from InboundJobCreateForm)
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

function FormTextarea({
  label,
  value,
  onChange,
  className = "",
  placeholder,
  disabled,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label ${className}`}>
      {label} {required && <span style={{ color: "#E24B4A" }}>*</span>}
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