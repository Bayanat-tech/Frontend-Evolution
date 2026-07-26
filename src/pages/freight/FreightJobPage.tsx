import type { ColumnDef } from "@tanstack/react-table";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Ban,
  BriefcaseBusiness,
  Edit2,
  FileText,
  MapPinned,
  PackageCheck,
  Plane,
  Plus,
  RefreshCw,
  Save,
  Ship,
  Truck,
  UserRound,
} from "lucide-react";
import { api } from "../../api/client";
import type { LookupRow } from "../../api/lookups";
import { executeWmsInboundSql } from "../../api/wms";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";

type ViewMode = "list" | "editor";
type Notice = { type: "success" | "error"; text: string } | null;

type JobForm = {
  company_code: string;
  prin_code: string;
  job_no: string;
  job_date: string;
  job_type: string;
  transport_mode: string;
  dept_code: string;
  quotation_ref: string;
  doc_ref: string;
  hawb: string;
  port_code: string;
  destination_port: string;
  vessel_name: string;
  voyage_no: string;
  carrier: string;
  forwarder_code: string;
  eta: string;
  etd: string;
  payment_terms: string;
  payableat: string;
  curr_code: string;
  ex_rate: string;
  be_no: string;
  be_date: string;
  country_origin: string;
  country_destination: string;
  custom_recno: string;
  ref_customs: string;
  remarks: string;
  canceled: string;
  user_id: string;
};

type PackForm = {
  shipper_name: string;
  shipper_address: string;
  consignee_name: string;
  consignee_address: string;
  notify_name: string;
  notify_address: string;
  cargo_details: string;
  no_of_packings: string;
  quantity: string;
  puom: string;
  volume: string;
  gross_wt: string;
  charge_wt: string;
  container_no: string;
  container_size: string;
  container_type: string;
  bl_no: string;
};

const modeMap = {
  air: { code: "A", label: "Air", icon: Plane },
  sea: { code: "S", label: "Sea", icon: Ship },
  land: { code: "R", label: "Road", icon: Truck },
};

const directionMap = {
  import: { code: "IMP", label: "Import" },
  export: { code: "EXP", label: "Export" },
  reexport: { code: "IRE", label: "Import for Re-export" },
};

export function FreightJobPage({ target, initialJob, startMode = "list" }: { target?: FreightWorkspaceTarget; initialJob?: LookupRow | null; startMode?: ViewMode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const userId = String(userRecord.user_id || userRecord.USER_ID || userRecord.loginid || userRecord.LOGINID || "");
  const modeKey = target?.mode || "air";
  const directionKey = target?.direction || "import";
  const mode = modeMap[modeKey];
  const direction = directionMap[directionKey];
  const Icon = mode.icon;

  const [view, setView] = useState<ViewMode>(startMode);
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [job, setJob] = useState<JobForm>(() => emptyJob(companyCode, userId, mode.code, direction.code));
  const [pack, setPack] = useState<PackForm>(() => emptyPack());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!notice) return;
    if (notice.type === "success") toast.success(notice.text);
    else toast.error(notice.text);
    setNotice(null);
  }, [notice, toast]);

  const isCanceled = job.canceled === "Y";

  const loadRows = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/job/list", {
        company_code: companyCode,
        transport_mode: mode.code,
        job_type: direction.code,
        search: query,
      });
      setRows((response.data.data || []).map(normalizeLookupRow));
    } catch (error: any) {
      setRows([]);
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to load freight jobs." });
    } finally {
      setLoading(false);
    }
  }, [companyCode, direction.code, mode.code, query]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    setJob(emptyJob(companyCode, userId, mode.code, direction.code));
    setPack(emptyPack());
    setView(startMode);
  }, [companyCode, direction.code, mode.code, startMode, userId]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    { accessorKey: "job_no", header: "Job No", size: 120, cell: ({ row }) => <button type="button" className="font-semibold text-primary hover:underline" onClick={() => openJob(row.original)}>{lookupText(row.original, "job_no")}</button> },
    { accessorKey: "job_date", header: "Date", size: 110, cell: ({ row }) => formatDate(lookupText(row.original, "job_date")) },
    { accessorKey: "prin_code", header: "Principal", size: 100 },
    { accessorKey: "prin_name", header: "Principal Name", size: 230, cell: ({ row }) => lookupText(row.original, "prin_name") },
    { accessorKey: "doc_ref", header: mode.code === "A" ? "MAWB" : "BL / Doc Ref", size: 140 },
    { accessorKey: "hawb", header: mode.code === "A" ? "HAWB" : "House Ref", size: 130 },
    { accessorKey: "port_code", header: "Origin", size: 90 },
    { accessorKey: "destination_port", header: "Destination", size: 120 },
    { accessorKey: "vessel_name", header: mode.code === "R" ? "Vehicle" : mode.code === "A" ? "Airline" : "Vessel", size: 150 },
    { accessorKey: "canceled", header: "Status", size: 90, cell: ({ row }) => lookupText(row.original, "canceled") === "Y" ? <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Cancelled</span> : <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Open</span> },
    { id: "actions", header: "Actions", size: 70, cell: ({ row }) => <Button type="button" size="icon" variant="ghost" title="Edit job" onClick={() => openJob(row.original)}><Edit2 size={14} /></Button> },
  ], [mode.code]);

  const openAdd = () => {
    setJob(emptyJob(companyCode, userId, mode.code, direction.code));
    setPack(emptyPack());
    setNotice(null);
    setView("editor");
  };

  const openJob = async (row: LookupRow) => {
    const jobNo = lookupText(row, "job_no");
    const prinCode = lookupText(row, "prin_code");
    if (!jobNo || !prinCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: { header?: LookupRow; packlist?: LookupRow } }>("/api/freight/job/get", {
        company_code: companyCode,
        prin_code: prinCode,
        job_no: jobNo,
      });
      setJob(toJobForm(normalizeLookupRow(response.data.data?.header || row), companyCode, userId, mode.code, direction.code));
      setPack(toPackForm(normalizeLookupRow(response.data.data?.packlist || {})));
      setView("editor");
    } catch (error: any) {
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to open freight job." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startMode !== "editor") return;
    if (initialJob && lookupText(initialJob, "job_no") && lookupText(initialJob, "prin_code")) {
      void openJob(initialJob);
      return;
    }
    setJob(emptyJob(companyCode, userId, mode.code, direction.code));
    setPack(emptyPack());
    setView("editor");
  }, [initialJob, startMode]);

  const saveJob = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: { job_no?: string }; message?: string }>("/api/freight/job/save", { job, packlist: pack });
      setNotice({ type: "success", text: response.data.message || "Freight job saved." });
      setJob((current) => ({ ...current, job_no: response.data.data?.job_no || current.job_no }));
      await loadRows();
      setView("list");
    } catch (error: any) {
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to save freight job." });
    } finally {
      setSaving(false);
    }
  };

  const cancelJob = async () => {
    if (!job.job_no) return;
    setSaving(true);
    setNotice(null);
    try {
      await api.post("/api/freight/job/cancel", { company_code: companyCode, prin_code: job.prin_code, job_no: job.job_no, cancelled_by: userId, cancel_remarks: job.remarks });
      setNotice({ type: "success", text: `Job ${job.job_no} cancelled.` });
      await loadRows();
      setView("list");
    } catch (error: any) {
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to cancel freight job." });
    } finally {
      setSaving(false);
    }
  };

  if (view === "list") {
    return (
      <section className="grid gap-3">
        <Header title={`${mode.label} ${direction.label} Jobs`} subtitle="Freight operations job listing" icon={Icon}>
          {notice && <NoticeChip notice={notice} />}
          <Button type="button" size="sm" variant="outline" onClick={() => void loadRows()} disabled={loading}><RefreshCw size={14} />Refresh</Button>
          <Button type="button" size="sm" onClick={openAdd}><Plus size={14} />Add Job</Button>
        </Header>
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search job, principal, BL/AWB..."
          title={`${rows.length} Jobs`}
          subtitle={`${mode.label} / ${direction.label}`}
          height="calc(100vh - 240px)"
          minWidth={1280}
          density="grid"
          enablePagination
          pageSize={50}
          enableExport
          exportFilename={`freight-${modeKey}-${directionKey}-jobs.csv`}
          onRowClick={openJob}
        />
      </section>
    );
  }

  return (
    <form className="grid gap-2" onSubmit={saveJob}>
      <Header title={`${mode.label} ${direction.label} Job`} subtitle={job.job_no || "New job"} icon={Icon}>
        {notice && <NoticeChip notice={notice} />}
        <Button type="button" size="sm" variant="outline" onClick={() => setView("list")}><ArrowLeft size={14} />List</Button>
        <Button type="button" size="sm" variant="outline" onClick={cancelJob} disabled={saving || !job.job_no || isCanceled}><Ban size={14} />Cancel</Button>
        <Button type="submit" size="sm" disabled={saving || isCanceled}><Save size={14} />Save</Button>
      </Header>
      <fieldset disabled={isCanceled} className="grid gap-2">
        <div className="grid gap-2 lg:grid-cols-12">
          <Panel className="lg:col-span-12" icon={BriefcaseBusiness} title="Job Identity" meta={`${job.job_no || "Auto"} / ${mode.label} / ${direction.label}`}>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-6">
              <ReadOnlyField label="Job No" value={job.job_no || "Auto"} />
              <Field label="Job Date" type="date" value={job.job_date} onChange={(value) => setJobField(setJob, "job_date", value)} />
              <Lookup label="Principal" value={job.prin_code} valueField="PRIN_CODE" displayFields={["PRIN_CODE", "PRIN_NAME"]} columns={[{ field: "PRIN_CODE", header: "Code" }, { field: "PRIN_NAME", header: "Principal" }]} loadOptions={() => lookup(`SELECT PRIN_CODE, PRIN_NAME FROM MS_PRINCIPAL WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY PRIN_CODE`)} onChange={(value) => setJobField(setJob, "prin_code", value)} />
              <Lookup label="Quotation" value={job.quotation_ref} valueField="QUOTATION_NR" displayFields={["QUOTATION_NR", "QUOTATION_DATE"]} columns={[{ field: "QUOTATION_NR", header: "Quotation" }, { field: "PRIN_CODE", header: "Principal" }, { field: "QUOTATION_DATE", header: "Date" }]} loadOptions={() => lookup(`SELECT QUOTATION_NR, QUOTATION_DATE, PRIN_CODE FROM TF_QUOTATION WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' AND TRANSPORT_MODE='${sqlEscape(mode.code)}' AND JOB_TYPE='${sqlEscape(direction.code === "IRE" ? "IMP" : direction.code)}' AND NVL(INDSTATUS,'N')='A' ORDER BY QUOTATION_DATE DESC`)} onChange={(value, row) => { setJobField(setJob, "quotation_ref", value); if (row) setJobField(setJob, "prin_code", lookupText(row, "PRIN_CODE")); }} />
              <Field label="Department" value={job.dept_code} onChange={(value) => setJobField(setJob, "dept_code", value)} />
              <Field label="Currency" value={job.curr_code} onChange={(value) => setJobField(setJob, "curr_code", value)} />
            </div>
          </Panel>

          <Panel className="lg:col-span-7" icon={MapPinned} title="Route And Carrier" meta={`${job.port_code || "Origin"} -> ${job.destination_port || "Destination"}`}>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              <Lookup label="Origin Port" value={job.port_code} valueField="PORT_CODE" displayFields={["PORT_CODE", "PORT_NAME"]} columns={portColumns} loadOptions={() => lookup(`SELECT PORT_CODE, PORT_NAME, COUNTRY_CODE FROM MS_PORT WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY PORT_CODE`)} onChange={(value) => setJobField(setJob, "port_code", value)} />
              <Lookup label="Destination" value={job.destination_port} valueField="PORT_CODE" displayFields={["PORT_CODE", "PORT_NAME"]} columns={portColumns} loadOptions={() => lookup(`SELECT PORT_CODE, PORT_NAME, COUNTRY_CODE FROM MS_PORT WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY PORT_CODE`)} onChange={(value) => setJobField(setJob, "destination_port", value)} />
              <ModeCarrierLookup mode={mode.code} companyCode={companyCode} value={job.vessel_name} onChange={(value) => setJobField(setJob, "vessel_name", value)} />
              <Field label={mode.code === "R" ? "Trip / Route No" : mode.code === "A" ? "Flight No" : "Voyage No"} value={job.voyage_no} onChange={(value) => setJobField(setJob, "voyage_no", value)} />
              <Field label="ETA" type="date" value={job.eta} onChange={(value) => setJobField(setJob, "eta", value)} />
              <Field label="ETD" type="date" value={job.etd} onChange={(value) => setJobField(setJob, "etd", value)} />
              <Field label={mode.code === "A" ? "MAWB" : "BL / Doc Ref"} value={job.doc_ref} onChange={(value) => setJobField(setJob, "doc_ref", value)} />
              <Field label={mode.code === "A" ? "HAWB" : "House Ref"} value={job.hawb} onChange={(value) => setJobField(setJob, "hawb", value)} />
            </div>
          </Panel>

          <Panel className="lg:col-span-5" icon={PackageCheck} title="Cargo And Pack List" meta={`${pack.quantity || "0"} ${pack.puom || ""} / ${pack.gross_wt || "0"} kgs`}>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <Field label="Pieces" type="number" value={pack.quantity} onChange={(value) => setPackField(setPack, "quantity", value)} />
              <Field label="UOM" value={pack.puom} onChange={(value) => setPackField(setPack, "puom", value)} />
              <Field label="Gross Wt" type="number" value={pack.gross_wt} onChange={(value) => setPackField(setPack, "gross_wt", value)} />
              <Field label="Charge Wt" type="number" value={pack.charge_wt} onChange={(value) => setPackField(setPack, "charge_wt", value)} />
              <Field label="Volume" type="number" value={pack.volume} onChange={(value) => setPackField(setPack, "volume", value)} />
              <Field label="Packs" type="number" value={pack.no_of_packings} onChange={(value) => setPackField(setPack, "no_of_packings", value)} />
              {mode.code !== "A" && <Field label="Container No" value={pack.container_no} onChange={(value) => setPackField(setPack, "container_no", value)} />}
              {mode.code !== "A" && <Field label="Container Type" value={pack.container_type} onChange={(value) => setPackField(setPack, "container_type", value)} />}
            </div>
          </Panel>

          <Panel className="lg:col-span-6" icon={UserRound} title="Parties" meta="Shipper / Consignee / Notify">
            <div className="grid gap-1.5 sm:grid-cols-2">
              <Textarea label="Shipper" value={pack.shipper_name} onChange={(value) => setPackField(setPack, "shipper_name", value)} />
              <Textarea label="Shipper Address" value={pack.shipper_address} onChange={(value) => setPackField(setPack, "shipper_address", value)} />
              <Textarea label="Consignee" value={pack.consignee_name} onChange={(value) => setPackField(setPack, "consignee_name", value)} />
              <Textarea label="Consignee Address" value={pack.consignee_address} onChange={(value) => setPackField(setPack, "consignee_address", value)} />
            </div>
          </Panel>

          <Panel className="lg:col-span-6" icon={FileText} title="Customs And Notes" meta={job.be_no || job.custom_recno || "Operational references"}>
            <div className="grid gap-1.5 sm:grid-cols-3">
              <Field label="BE No" value={job.be_no} onChange={(value) => setJobField(setJob, "be_no", value)} />
              <Field label="BE Date" type="date" value={job.be_date} onChange={(value) => setJobField(setJob, "be_date", value)} />
              <Field label="Custom Ref" value={job.custom_recno} onChange={(value) => setJobField(setJob, "custom_recno", value)} />
              <Textarea label="Cargo Detail" value={pack.cargo_details} onChange={(value) => setPackField(setPack, "cargo_details", value)} className="sm:col-span-2" />
              <Textarea label="Remarks" value={job.remarks} onChange={(value) => setJobField(setJob, "remarks", value)} />
            </div>
          </Panel>
        </div>
      </fieldset>
    </form>
  );
}

function Header({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof Plane; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><Icon size={18} /></span>
        <div>
          <p className="eyebrow mb-0.5">Freight Job</p>
          <h1 className="m-0 text-lg font-semibold text-foreground">{title}</h1>
          <p className="m-0 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Panel({ title, meta, icon: Icon, children, className = "" }: { title: string; meta: string; icon: typeof Plane; children: React.ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-md border bg-card shadow-sm ${className}`}>
      <div className="flex items-center gap-1.5 border-b bg-muted/35 px-2 py-1">
        <span className="grid h-5 w-5 place-items-center rounded-md bg-primary/10 text-primary"><Icon size={12} /></span>
        <div className="min-w-0"><h2 className="m-0 text-[11px] font-semibold uppercase text-foreground">{title}</h2><p className="m-0 truncate text-[10px] text-muted-foreground">{meta}</p></div>
      </div>
      <div className="p-1.5">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="grid gap-0.5 text-[10px] font-semibold uppercase text-muted-foreground">{label}<Input className="h-7 text-xs font-semibold" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Textarea({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return <label className={`grid gap-0.5 text-[10px] font-semibold uppercase text-muted-foreground ${className}`}>{label}<textarea className="min-h-8 rounded-md border border-input bg-background px-2 py-1 text-xs font-semibold text-foreground shadow-sm" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-0.5 text-[10px] font-semibold uppercase text-muted-foreground">{label}<div className="flex h-7 items-center rounded-md border bg-muted/40 px-2 text-xs font-semibold normal-case text-foreground">{value}</div></div>;
}

function Lookup({ label, value, valueField, displayFields, columns, loadOptions, onChange }: { label: string; value: string; valueField: string; displayFields: string[]; columns: { field: string; header: string }[]; loadOptions: () => Promise<LookupRow[]>; onChange: (value: string, row: LookupRow | null) => void }) {
  return <label className="grid gap-0.5 text-[10px] font-semibold uppercase text-muted-foreground">{label}<LookupField value={value} compact valueField={valueField} displayFields={displayFields} columns={columns} loadOptions={loadOptions} onChange={onChange} /></label>;
}

function ModeCarrierLookup({ mode, companyCode, value, onChange }: { mode: string; companyCode: string; value: string; onChange: (value: string) => void }) {
  if (mode === "S") return <Lookup label="Vessel" value={value} valueField="VESSEL_CODE" displayFields={["VESSEL_CODE", "VESSEL_NAME"]} columns={[{ field: "VESSEL_CODE", header: "Code" }, { field: "VESSEL_NAME", header: "Vessel" }]} loadOptions={() => lookup(`SELECT VESSEL_CODE, VESSEL_NAME FROM MS_VESSEL WHERE COMPANY_CODE='${sqlEscape(companyCode)}' ORDER BY VESSEL_CODE`)} onChange={(next) => onChange(next)} />;
  if (mode === "R") return <Lookup label="Vehicle" value={value} valueField="VEHICLE_NO" displayFields={["VEHICLE_NO", "VEHICLE_DESC"]} columns={[{ field: "VEHICLE_NO", header: "Vehicle" }, { field: "VEHICLE_DESC", header: "Description" }]} loadOptions={() => lookup(`SELECT VEHICLE_NO, VEHICLE_DESC FROM MS_VEHICLE WHERE COMPANY_CODE='${sqlEscape(companyCode)}' ORDER BY VEHICLE_NO`)} onChange={(next) => onChange(next)} />;
  return <Lookup label="Airline" value={value} valueField="AIRLINE_CODE" displayFields={["AIRLINE_CODE", "AIRLINE_NAME"]} columns={[{ field: "AIRLINE_CODE", header: "Code" }, { field: "AIRLINE_NAME", header: "Airline" }]} loadOptions={() => lookup(`SELECT AIRLINE_CODE, AIRLINE_NAME FROM MS_AIRLINE WHERE COMPANY_CODE='${sqlEscape(companyCode)}' ORDER BY AIRLINE_CODE`)} onChange={(next) => onChange(next)} />;
}

function NoticeChip({ notice }: { notice: Exclude<Notice, null> }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.text}</span>;
}

function emptyJob(companyCode: string, userId: string, transportMode: string, jobType: string): JobForm {
  return { company_code: companyCode, prin_code: "", job_no: "", job_date: today(), job_type: jobType, transport_mode: transportMode, dept_code: "22", quotation_ref: "", doc_ref: "", hawb: "", port_code: "", destination_port: "", vessel_name: "", voyage_no: "", carrier: "", forwarder_code: "", eta: "", etd: "", payment_terms: "CIF", payableat: "ORIGIN", curr_code: "OMR", ex_rate: "1", be_no: "", be_date: "", country_origin: "", country_destination: "", custom_recno: "", ref_customs: "", remarks: "", canceled: "N", user_id: userId };
}

function emptyPack(): PackForm {
  return { shipper_name: "", shipper_address: "", consignee_name: "", consignee_address: "", notify_name: "", notify_address: "", cargo_details: "", no_of_packings: "", quantity: "1", puom: "", volume: "", gross_wt: "", charge_wt: "", container_no: "", container_size: "", container_type: "STANDARD", bl_no: "" };
}

function toJobForm(row: LookupRow, companyCode: string, userId: string, mode: string, jobType: string): JobForm {
  const base = emptyJob(companyCode, userId, mode, jobType);
  return Object.fromEntries(Object.keys(base).map((key) => [key, lookupText(row, key) || (base as any)[key]])) as JobForm;
}

function toPackForm(row: LookupRow): PackForm {
  const base = emptyPack();
  return Object.fromEntries(Object.keys(base).map((key) => [key, lookupText(row, key) || (base as any)[key]])) as PackForm;
}

function setJobField(setJob: (updater: (current: JobForm) => JobForm) => void, field: keyof JobForm, value: string) {
  setJob((current) => ({ ...current, [field]: value }));
}

function setPackField(setPack: (updater: (current: PackForm) => PackForm) => void, field: keyof PackForm, value: string) {
  setPack((current) => ({ ...current, [field]: value }));
}

async function lookup(sql: string) {
  return (await executeWmsInboundSql(sql)).map(normalizeLookupRow);
}

function normalizeLookupRow(row: LookupRow) {
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key.toUpperCase(), value])) as LookupRow;
}

function lookupText(row: LookupRow | undefined, key: string) {
  if (!row) return "";
  const value = row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

function sqlEscape(value: string) {
  return value.replace(/'/g, "''");
}

const portColumns = [{ field: "PORT_CODE", header: "Code" }, { field: "PORT_NAME", header: "Port" }, { field: "COUNTRY_CODE", header: "Country" }];
