import { FileText, Globe2, Banknote, Package, CheckCircle2, XCircle, Pencil, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { LookupField } from "../../../components/ui/LookupField";
import { api } from "../../../api/client";
import { executeWmsInboundSql } from "../../../api/wms";
import { useToast } from "../../../components/ui/AlertToast";
import { loadInboundCountryLookup, loadInboundPortLookup } from "../../../utils/lookupLoaders";
import { type WmsRow, value, normalizeRow, sqlEscape, JobClassPill } from "../../../utils/inboundHelpers";

type Props = {
  job:         WmsRow | null;
  loadingJob:  boolean;
  companyCode: string;
  jobNo:       string;
  onSaved?:    () => void | Promise<void>;
};

type Accent = "blue" | "violet" | "amber" | "emerald";

const accentMap: Record<Accent, { bg: string; text: string; iconBg: string }> = {
  blue:    { bg: "bg-blue-50/60",    text: "text-blue-700",    iconBg: "bg-blue-100 text-blue-700" },
  violet:  { bg: "bg-violet-50/60",  text: "text-violet-700",  iconBg: "bg-violet-100 text-violet-700" },
  amber:   { bg: "bg-amber-50/60",   text: "text-amber-700",   iconBg: "bg-amber-100 text-amber-700" },
  emerald: { bg: "bg-emerald-50/60", text: "text-emerald-700", iconBg: "bg-emerald-100 text-emerald-700" },
};

function SectionHeader({ icon: Icon, label, caption, accent, right }: { icon: any; label: string; caption: string; accent: Accent; right?: React.ReactNode }) {
  const a = accentMap[accent];
  return (
    <div className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${a.bg}`}>
      <div className="flex items-center gap-2">
        <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${a.iconBg}`}>
          <Icon size={14} />
        </div>
        <div>
          <p className={`m-0 text-[9px] font-bold uppercase tracking-widest ${a.text}`}>{label}</p>
          <p className="m-0 text-xs font-semibold text-foreground leading-tight">{caption}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

function Field({ label, val }: { label: string; val: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{val ?? <span className="text-muted-foreground/50">—</span>}</span>
    </div>
  );
}

function EditableField({
  label, isEditing, val, editVal, onChange, multiline,
}: {
  label: string;
  isEditing: boolean;
  val: React.ReactNode;
  editVal: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  if (!isEditing) return <Field label={label} val={val} />;
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{label}</span>
      {multiline ? (
        <textarea
          rows={2}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          value={editVal}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          value={editVal}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function ValuePill({ val, tone = "slate", title }: { val: React.ReactNode; tone?: "slate" | "blue" | "violet" | "amber"; title?: string }) {
  const tones: Record<string, string> = {
    slate:  "bg-slate-100 text-slate-700 border-slate-200",
    blue:   "bg-blue-100 text-blue-700 border-blue-200",
    violet: "bg-violet-100 text-violet-700 border-violet-200",
    amber:  "bg-amber-100 text-amber-800 border-amber-200",
  };
  if (val === null || val === undefined || val === "") {
    return <span className="text-sm text-muted-foreground/50">—</span>;
  }
  return (
    <span
      title={title}
      className={`inline-block max-w-full truncate rounded-md border px-2 py-0.5 text-xs font-semibold align-middle ${tones[tone]}`}
    >
      {val}
    </span>
  );
}

function FlagPill({ label, isYes }: { label: string; isYes: boolean }) {
  return (
    <div>
      <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
          isYes
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-50 text-slate-500"
        }`}
      >
        {isYes ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
        {isYes ? "Yes" : "No"}
      </span>
    </div>
  );
}

// ── shape of the editable form ───────────────────────────────────────────────
type EditableForm = {
  description1:              string;
  country_origin:            string;
  country_origin_name:       string;
  country_destination:       string;
  country_destination_name:  string;
  port_code:                  string;
  port_name:                  string;
  destination_port:          string;
  destination_port_name:    string;
  remarks:                    string;
  grn_remarks:                string;
  curr_code:                  string;
  curr_name:                  string;
  ex_rate:                    string;
  sale_type:                  string;
  tally_type:                  string;
};

const emptyForm: EditableForm = {
  description1: "", country_origin: "", country_origin_name: "",
  country_destination: "", country_destination_name: "",
  port_code: "", port_name: "", destination_port: "", destination_port_name: "",
  remarks: "", grn_remarks: "",
  curr_code: "", curr_name: "", ex_rate: "", sale_type: "", tally_type: "",
};

export function InboundJobDetailsTab({ job, loadingJob, companyCode, jobNo, onSaved }: Props) {
  const { toast } = useToast();

  const prinCode = value(job || {}, "prin_code");
  const deptCode = value(job || {}, "dept_code");
  const divCode  = value(job || {}, "div_code");

  const [prinName, setPrinName] = useState<string>("");
  const [deptName, setDeptName] = useState<string>("");
  const [divName,  setDivName]  = useState<string>("");

  const [isEditing, setIsEditing] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [formData,  setFormData]  = useState<EditableForm>(emptyForm);

  useEffect(() => {
    if (loadingJob || !job || !companyCode) return;

    const fetchNames = async () => {
      try {
        const [prinRows, deptRows, divRows] = await Promise.all([
          prinCode
            ? executeWmsInboundSql(
                `SELECT PRIN_NAME FROM MS_PRINCIPAL
                 WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' AND PRIN_CODE = '${sqlEscape(String(prinCode))}'`
              )
            : Promise.resolve([]),
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

        setPrinName(String(value(normalizeRow(prinRows?.[0] || {}), "prin_name") || ""));
        setDeptName(String(value(normalizeRow(deptRows?.[0] || {}), "dept_name") || ""));
        setDivName(String(value(normalizeRow(divRows?.[0] || {}), "div_name") || ""));
      } catch {
        setPrinName(""); setDeptName(""); setDivName("");
      }
    };

    void fetchNames();
  }, [loadingJob, job, companyCode, prinCode, deptCode, divCode]);

  if (loadingJob || !job) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading job details…</CardContent></Card>
    );
  }

  const isY = (v: unknown) => String(v ?? "").toUpperCase() === "Y";

  const codeWithName = (code: unknown, name: string) => {
    if (!code) return "—";
    return name ? `${code} - ${name}` : String(code);
  };

const startEdit = () => {
  setFormData({
    description1:              String(value(job, "description1") || ""),
    country_origin:            String(value(job, "country_origin") || ""),
    country_origin_name:      "",
    country_destination:      String(value(job, "country_destination") || ""),
    country_destination_name: "",
    port_code:                  String(value(job, "port_code") || ""),
    port_name:                  "",
    destination_port:          String(value(job, "destination_port") || ""),
    destination_port_name:    "",
    remarks:                    String(value(job, "remarks") || ""),
    grn_remarks:                String(value(job, "grn_remarks") || ""),
    curr_code:                  String(value(job, "curr_code") || ""),
    curr_name:                  "",
    ex_rate:                    String(value(job, "ex_rate") ?? ""),
    sale_type:                  String(value(job, "sale_type") || ""),
    tally_type:                  String(value(job, "tally_type") || ""),
  });
  setIsEditing(true);
};

const loadInboundCurrencyLookup = async () => {
  const rows = await executeWmsInboundSql(`SELECT * FROM MS_CURRENCY ORDER BY CURR_CODE`);
  return rows;
};
  const cancelEdit = () => setIsEditing(false);

const handleSave = async () => {
  setSaving(true);
  try {
    const blankToNull = (v: string) => (v.trim() === "" ? null : v);

    await api.put(`/api/wms/inbound/editInboundJob/${encodeURIComponent(jobNo)}`, {
      country_origin:      blankToNull(formData.country_origin),
      country_destination: blankToNull(formData.country_destination),
      description1:        blankToNull(formData.description1),
      remarks:              blankToNull(formData.remarks),
      grn_remarks:          blankToNull(formData.grn_remarks),
      port_code:            blankToNull(formData.port_code),
      destination_port:    blankToNull(formData.destination_port),
      curr_code:            blankToNull(formData.curr_code),
      ex_rate:              formData.ex_rate.trim() === "" ? null : Number(formData.ex_rate),
      sale_type:            blankToNull(formData.sale_type),
      tally_type:            blankToNull(formData.tally_type),
      prin_ref2:            value(job, "prin_ref2") ?? null,
      transport_mode:      value(job, "transport_mode") ?? null,
      schedule_date:        value(job, "schedule_date") ?? null,
      job_class:            value(job, "job_class") ?? null,
      company_code:        value(job, "company_code") ?? companyCode,
    });
    toast.success("Job details updated successfully");
    setIsEditing(false);
    if (onSaved) await onSaved();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Unable to update job details");
  } finally {
    setSaving(false);
  }
};
  const setField = (key: keyof EditableForm) => (v: string) =>
    setFormData((cur) => ({ ...cur, [key]: v }));

  const editControls = (
    <div className="flex items-center gap-2">
      {isEditing ? (
        <>
          <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
            <X size={13} /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save size={13} /> {saving ? "Saving..." : "Save"}
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={startEdit}>
          <Pencil size={13} /> Edit
        </Button>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-3">

      {/* ── Job Identification (full width) ── */}
      <section className="col-span-2 rounded-md border bg-card shadow-sm overflow-hidden">
        <SectionHeader icon={FileText} label="Job Identification" caption="Core job reference details" accent="blue" right={editControls} />
        <div className="grid grid-cols-4 md:grid-cols-7 gap-3 p-3">
          <Field label="Job No" val={<ValuePill val={value(job, "job_no")} tone="blue" />} />
          <Field label="Job Type" val={<ValuePill val={value(job, "job_type")} tone="slate" />} />
          <Field label="Job Class" val={<JobClassPill code={value(job, "job_class")} />} />
          <Field label="Job Flag" val={<ValuePill val={value(job, "job_flag")} tone="violet" />} />
          <Field
            label="Principal"
            val={<ValuePill val={codeWithName(prinCode, prinName)} title={codeWithName(prinCode, prinName)} tone="blue" />}
          />
          <Field
            label="Department"
            val={<ValuePill val={codeWithName(deptCode, deptName)} title={codeWithName(deptCode, deptName)} tone="violet" />}
          />
          <Field
            label="Division"
            val={<ValuePill val={codeWithName(divCode, divName)} title={codeWithName(divCode, divName)} tone="amber" />}
          />
        </div>

        {/* Job Description */}
        <div className="border-t px-3 py-3">
          <EditableField
            label="Job Description"
            isEditing={isEditing}
            val={value(job, "description1")}
            editVal={formData.description1}
            onChange={setField("description1")}
            multiline
          />
        </div>
      </section>

      {/* ── Origin & Destination ── */}
      <section className="rounded-md border bg-card shadow-sm overflow-hidden">
        <SectionHeader icon={Globe2} label="Origin & Destination" caption="Country, port and place references" accent="violet" />
        <div className="grid grid-cols-2 gap-3 p-3">
          {isEditing ? (
            <>
              <label className="field">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Origin Country</span>
                <LookupField
                  compact
                  value={formData.country_origin}
                  displayValue={[formData.country_origin, formData.country_origin_name].filter(Boolean).join(" - ")}
                  valueField="country_code"
                  displayFields={["country_code", "country_name"]}
                  columns={[
                    { field: "country_code", header: "Code" },
                    { field: "country_name", header: "Country" },
                  ]}
                  placeholder="Select origin country"
                  loadOptions={loadInboundCountryLookup}
                  onChange={(val, row) =>
                    setFormData((cur) => ({
                      ...cur,
                      country_origin: val,
                      country_origin_name: row ? String(row["country_name"] ?? row["COUNTRY_NAME"] ?? "") : "",
                      port_code: "", port_name: "",
                    }))
                  }
                />
              </label>

              <label className="field">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Destination Country</span>
                <LookupField
                  compact
                  value={formData.country_destination}
                  displayValue={[formData.country_destination, formData.country_destination_name].filter(Boolean).join(" - ")}
                  valueField="country_code"
                  displayFields={["country_code", "country_name"]}
                  columns={[
                    { field: "country_code", header: "Code" },
                    { field: "country_name", header: "Country" },
                  ]}
                  placeholder="Select destination country"
                  loadOptions={loadInboundCountryLookup}
                  onChange={(val, row) =>
                    setFormData((cur) => ({
                      ...cur,
                      country_destination: val,
                      country_destination_name: row ? String(row["country_name"] ?? row["COUNTRY_NAME"] ?? "") : "",
                      destination_port: "", destination_port_name: "",
                    }))
                  }
                />
              </label>

              <label className="field">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Port Of Loading</span>
                <LookupField
                  compact
                  value={formData.port_code}
                  displayValue={[formData.port_code, formData.port_name].filter(Boolean).join(" - ")}
                  valueField="port_code"
                  displayFields={["port_code", "port_name"]}
                  columns={[
                    { field: "port_code",    header: "Port Code" },
                    { field: "port_name",    header: "Port Name" },
                    { field: "country_code", header: "Country" },
                  ]}
                  placeholder="Select port of loading"
                  loadOptions={() => loadInboundPortLookup(formData.country_origin)}
                  onChange={(val, row) =>
                    setFormData((cur) => ({
                      ...cur,
                      port_code: val,
                      port_name: row ? String(row["port_name"] ?? row["PORT_NAME"] ?? "") : "",
                    }))
                  }
                />
              </label>

              <label className="field">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Port Of Destination</span>
                <LookupField
                  compact
                  value={formData.destination_port}
                  displayValue={[formData.destination_port, formData.destination_port_name].filter(Boolean).join(" - ")}
                  valueField="port_code"
                  displayFields={["port_code", "port_name"]}
                  columns={[
                    { field: "port_code",    header: "Port Code" },
                    { field: "port_name",    header: "Port Name" },
                    { field: "country_code", header: "Country" },
                  ]}
                  placeholder="Select port of destination"
                  loadOptions={() => loadInboundPortLookup(formData.country_destination)}
                  onChange={(val, row) =>
                    setFormData((cur) => ({
                      ...cur,
                      destination_port: val,
                      destination_port_name: row ? String(row["port_name"] ?? row["PORT_NAME"] ?? "") : "",
                    }))
                  }
                />
              </label>
            </>
          ) : (
            <>
              <Field label="Country Origin" val={value(job, "country_origin")} />
              <Field label="Country Destination" val={value(job, "country_destination")} />
              <Field label="Port Of Loading" val={value(job, "port_code")} />
              <Field label="Port Of Destination" val={value(job, "destination_port")} />
            </>
          )}
          {/* <Field label="Place of Receipt" val={value(job, "place_receipt")} />
          <Field label="Place of Delivery" val={value(job, "place_delivery")} /> */}
        </div>
      </section>

      {/* ── Commercial ── */}
{/* ── Commercial ── */}
<section className="rounded-md border bg-card shadow-sm overflow-hidden">
  <SectionHeader icon={Banknote} label="Commercial" caption="Currency, sale type and tally type" accent="amber" />
  <div className="grid grid-cols-2 gap-3 p-3">
    {isEditing ? (
      <>
        <label className="field">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Currency Code</span>
          <LookupField
            compact
            value={formData.curr_code}
            displayValue={[formData.curr_code, formData.curr_name].filter(Boolean).join(" - ")}
            valueField="curr_code"
            displayFields={["curr_code", "curr_name"]}
            columns={[
              { field: "curr_code", header: "Code" },
              { field: "curr_name", header: "Currency Name" },
            ]}
            placeholder="Select currency"
            loadOptions={loadInboundCurrencyLookup}
            onChange={(val, row) =>
              setFormData((cur) => ({
                ...cur,
                curr_code: val,
                curr_name: row ? String(row["curr_name"] ?? row["CURR_NAME"] ?? "") : "",
              }))
            }
          />
        </label>

        <EditableField
          label="Exchange Rate" isEditing
          val={value(job, "ex_rate")} editVal={formData.ex_rate}
          onChange={setField("ex_rate")}
        />
        <EditableField
          label="Sale Type" isEditing
          val={value(job, "sale_type")} editVal={formData.sale_type}
          onChange={setField("sale_type")}
        />
        <EditableField
          label="Tally Type" isEditing
          val={value(job, "tally_type")} editVal={formData.tally_type}
          onChange={setField("tally_type")}
        />
      </>
    ) : (
      <>
        <Field label="Currency Code" val={<ValuePill val={value(job, "curr_code")} tone="amber" />} />
        <Field label="Exchange Rate" val={value(job, "ex_rate")} />
        <Field label="Sale Type" val={<ValuePill val={value(job, "sale_type")} tone="slate" />} />
        <Field label="Tally Type" val={<ValuePill val={value(job, "tally_type")} tone="slate" />} />
      </>
    )}
  </div>
</section>

      {/* ── Status Flags (full width) ── */}
      <section className="col-span-2 rounded-md border bg-card shadow-sm overflow-hidden">
        <SectionHeader icon={Package} label="Status" caption="Progress flags across the job lifecycle" accent="emerald" />
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3 p-3">
          <FlagPill label="Packing Done" isYes={isY(value(job, "packdet"))} />
          <FlagPill label="Allocated" isYes={isY(value(job, "allocated"))} />
          <FlagPill label="Confirmed" isYes={isY(value(job, "confirmed"))} />
          <FlagPill label="Invoiced" isYes={isY(value(job, "invoiced"))} />
          <FlagPill label="Canceled" isYes={isY(value(job, "canceled"))} />
          <FlagPill label="Ordered" isYes={isY(value(job, "ordered"))} />
          <FlagPill label="Picked" isYes={isY(value(job, "picked"))} />
          <Field label="GRN No" val={value(job, "grn_no")} />
        </div>
      </section>

      {/* ── Remarks (full width) ── */}
      <section className="col-span-2 rounded-md border bg-card shadow-sm overflow-hidden">
        <SectionHeader icon={FileText} label="Remarks" caption="Job and GRN notes" accent="blue" />
        <div className="grid grid-cols-2 gap-3 p-3">
          <EditableField
            label="Job Remarks" isEditing={isEditing}
            val={value(job, "remarks")} editVal={formData.remarks}
            onChange={setField("remarks")}
            multiline
          />
          <EditableField
            label="GRN Remarks" isEditing={isEditing}
            val={value(job, "grn_remarks")} editVal={formData.grn_remarks}
            onChange={setField("grn_remarks")}
            multiline
          />
        </div>
      </section>

    </div>
  );
}