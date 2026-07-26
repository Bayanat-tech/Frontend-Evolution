import type { ColumnDef } from "@tanstack/react-table";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Edit2,
  FileSignature,
  FileText,
  PackageCheck,
  Plane,
  Plus,
  RefreshCw,
  Save,
  Ship,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import { api } from "../../api/client";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";

type ViewMode = "list" | "editor";
type Notice = { type: "success" | "error"; text: string } | null;

type PackForm = {
  company_code: string;
  prin_code: string;
  job_no: string;
  packlist_no: string;
  seq_number: string;
  transport_mode: string;
  job_type: string;
  job_date: string;
  prin_name: string;
  shipper_name: string;
  shipper_address: string;
  consignee_name: string;
  consignee_address: string;
  notify_name: string;
  notify_address: string;
  marksnos: string;
  prod_description: string;
  cargo_details: string;
  no_of_packings: string;
  quantity: string;
  puom: string;
  volume: string;
  net_wt: string;
  gross_wt: string;
  charge_wt: string;
  container_no: string;
  container_size: string;
  container_type: string;
  vessel_name: string;
  voyage_no: string;
  bl_no: string;
  bl_date: string;
  import_blno: string;
  import_bldate: string;
  hawb: string;
  airline: string;
  flight_info: string;
  issue_place: string;
  issue_date: string;
  shipment_status: string;
  terms_of_delivery: string;
  curr_code: string;
  ex_rate: string;
  rate: string;
  amount: string;
  remarks: string;
  handling_info: string;
  user_id: string;
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

export function FreightPacklistPage({ target }: { target?: FreightWorkspaceTarget }) {
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

  const [view, setView] = useState<ViewMode>("list");
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [pack, setPack] = useState<PackForm>(() => emptyPack(companyCode, userId, mode.code, direction.code));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!notice) return;
    if (notice.type === "success") toast.success(notice.text);
    else toast.error(notice.text);
    setNotice(null);
  }, [notice, toast]);

  const isAir = mode.code === "A";

  const loadRows = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/packlist/list", {
        company_code: companyCode,
        transport_mode: mode.code,
        job_type: direction.code,
        search: query,
      });
      setRows((response.data.data || []).map(normalizeLookupRow));
    } catch (error: any) {
      setRows([]);
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to load pack lists." });
    } finally {
      setLoading(false);
    }
  }, [companyCode, direction.code, mode.code, query]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    setPack(emptyPack(companyCode, userId, mode.code, direction.code));
    setView("list");
  }, [companyCode, direction.code, mode.code, userId]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    { accessorKey: "seq_number", header: "Pack List", size: 140, cell: ({ row }) => <button type="button" className="font-semibold text-primary hover:underline" onClick={() => openPack(row.original)}>{lookupText(row.original, "seq_number") || `${lookupText(row.original, "job_no")}/${lookupText(row.original, "packlist_no")}`}</button> },
    { accessorKey: "job_no", header: "Job No", size: 120 },
    { accessorKey: "job_date", header: "Job Date", size: 110, cell: ({ row }) => formatDate(lookupText(row.original, "job_date")) },
    { accessorKey: "prin_code", header: "Principal", size: 90 },
    { accessorKey: "prin_name", header: "Principal Name", size: 220 },
    { accessorKey: "shipper_name", header: "Shipper", size: 200 },
    { accessorKey: "consignee_name", header: "Consignee", size: 200 },
    { accessorKey: "bl_no", header: isAir ? "AWB" : "BL No", size: 130 },
    { accessorKey: "container_no", header: "Container", size: 130 },
    { accessorKey: "gross_wt", header: "Gross Wt", size: 90 },
    { accessorKey: "quantity", header: "Qty", size: 80 },
    { id: "actions", header: "Actions", size: 90, cell: ({ row }) => <div className="flex gap-1"><Button type="button" size="icon" variant="ghost" title="Edit" onClick={() => openPack(row.original)}><Edit2 size={14} /></Button><Button type="button" size="icon" variant="ghost" title="Delete" onClick={(event) => { event.stopPropagation(); void deletePack(row.original); }}><Trash2 size={14} /></Button></div> },
  ], [isAir]);

  const openAdd = () => {
    setPack(emptyPack(companyCode, userId, mode.code, direction.code));
    setNotice(null);
    setView("editor");
  };

  const openPack = async (row: LookupRow) => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow }>("/api/freight/packlist/get", {
        company_code: companyCode,
        prin_code: lookupText(row, "prin_code"),
        job_no: lookupText(row, "job_no"),
        packlist_no: lookupText(row, "packlist_no"),
      });
      setPack(toPackForm(normalizeLookupRow(response.data.data || row), companyCode, userId, mode.code, direction.code));
      setView("editor");
    } catch (error: any) {
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to open pack list." });
    } finally {
      setLoading(false);
    }
  };

  const deletePack = async (row: LookupRow) => {
    setSaving(true);
    setNotice(null);
    try {
      await api.post("/api/freight/packlist/delete", {
        company_code: companyCode,
        prin_code: lookupText(row, "prin_code"),
        job_no: lookupText(row, "job_no"),
        packlist_no: lookupText(row, "packlist_no"),
      });
      setNotice({ type: "success", text: "Pack list deleted." });
      await loadRows();
    } catch (error: any) {
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to delete pack list." });
    } finally {
      setSaving(false);
    }
  };

  const savePack = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: { packlist_no?: string | number; seq_number?: string }; message?: string }>("/api/freight/packlist/save", { packlist: pack });
      setNotice({ type: "success", text: response.data.message || "Pack list saved." });
      setPack((current) => ({
        ...current,
        packlist_no: String(response.data.data?.packlist_no || current.packlist_no),
        seq_number: response.data.data?.seq_number || current.seq_number,
      }));
      await loadRows();
      setView("list");
    } catch (error: any) {
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to save pack list." });
    } finally {
      setSaving(false);
    }
  };

  if (view === "list") {
    return (
      <section className="grid gap-3">
        <Header title={`${mode.label} ${direction.label} Pack List`} subtitle="Freight packing document listing" icon={Icon}>
          {notice && <NoticeChip notice={notice} />}
          <Button type="button" size="sm" variant="outline" onClick={() => void loadRows()} disabled={loading}><RefreshCw size={14} />Refresh</Button>
          <Button type="button" size="sm" onClick={openAdd}><Plus size={14} />Add Pack List</Button>
        </Header>
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search pack list, job, principal, BL/AWB..."
          title={`${rows.length} Pack Lists`}
          subtitle={`${mode.label} / ${direction.label}`}
          height="calc(100vh - 240px)"
          minWidth={1280}
          density="grid"
          enablePagination
          pageSize={50}
          enableExport
          exportFilename={`freight-${modeKey}-${directionKey}-packlist.csv`}
          onRowClick={openPack}
        />
      </section>
    );
  }

  return (
    <form className="grid gap-2" onSubmit={savePack}>
      <Header title={`${mode.label} ${direction.label} Pack List`} subtitle={pack.seq_number || "New pack list"} icon={Icon}>
        {notice && <NoticeChip notice={notice} />}
        <Button type="button" size="sm" variant="outline" onClick={() => setView("list")}><ArrowLeft size={14} />List</Button>
        <Button type="submit" size="sm" disabled={saving || !pack.job_no}><Save size={14} />Save</Button>
      </Header>

      <div className="grid gap-2 lg:grid-cols-12">
        <Panel className="lg:col-span-12" icon={FileSignature} title="Document Reference" meta={`${pack.seq_number || "Auto"} / ${pack.job_no || "Select job"}`}>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-8">
            <Lookup label="Freight Job" value={pack.job_no} valueField="JOB_NO" displayFields={["JOB_NO", "PRIN_CODE", "PRIN_NAME"]} columns={jobColumns} loadOptions={() => lookupJobs(companyCode, mode.code, direction.code, pack.job_no)} onChange={(value, row) => selectJob(value, row, setPack, companyCode, userId, mode.code, direction.code)} />
            <ReadOnlyField label="Pack No" value={pack.packlist_no || "Auto"} />
            <ReadOnlyField label="Seq No" value={pack.seq_number || "Auto"} />
            <ReadOnlyField label="Principal" value={pack.prin_code || "-"} />
            <ReadOnlyField label="Principal Name" value={pack.prin_name || "-"} />
            <Field label={isAir ? "AWB No" : "BL No"} value={pack.bl_no} onChange={(value) => setPackField(setPack, "bl_no", value)} />
            <Field label={isAir ? "AWB Date" : "BL Date"} type="date" value={pack.bl_date} onChange={(value) => setPackField(setPack, "bl_date", value)} />
            <Field label="Currency" value={pack.curr_code} onChange={(value) => setPackField(setPack, "curr_code", value)} />
          </div>
        </Panel>

        <Panel className="lg:col-span-5" icon={UserRound} title="Parties" meta="Shipper / Consignee / Notify">
          <div className="grid gap-1.5 sm:grid-cols-3">
            <Textarea label="Shipper" value={pack.shipper_name} onChange={(value) => setPackField(setPack, "shipper_name", value)} />
            <Textarea label="Consignee" value={pack.consignee_name} onChange={(value) => setPackField(setPack, "consignee_name", value)} />
            <Textarea label="Notify" value={pack.notify_name} onChange={(value) => setPackField(setPack, "notify_name", value)} />
            <Textarea label="Shipper Address" value={pack.shipper_address} onChange={(value) => setPackField(setPack, "shipper_address", value)} />
            <Textarea label="Consignee Address" value={pack.consignee_address} onChange={(value) => setPackField(setPack, "consignee_address", value)} />
            <Textarea label="Notify Address" value={pack.notify_address} onChange={(value) => setPackField(setPack, "notify_address", value)} />
          </div>
        </Panel>

        <Panel className="lg:col-span-4" icon={PackageCheck} title="Cargo And Measures" meta={`${pack.quantity || "0"} ${pack.puom || ""} / ${pack.gross_wt || "0"} kgs`}>
          <div className="grid gap-1.5 sm:grid-cols-3">
            <Field label="Packages" type="number" value={pack.no_of_packings} onChange={(value) => setPackField(setPack, "no_of_packings", value)} />
            <Field label="Quantity" type="number" value={pack.quantity} onChange={(value) => setPackField(setPack, "quantity", value)} />
            <Field label="UOM" value={pack.puom} onChange={(value) => setPackField(setPack, "puom", value)} />
            <Field label="Volume" type="number" value={pack.volume} onChange={(value) => setPackField(setPack, "volume", value)} />
            <Field label="Net Wt" type="number" value={pack.net_wt} onChange={(value) => setPackField(setPack, "net_wt", value)} />
            <Field label="Gross Wt" type="number" value={pack.gross_wt} onChange={(value) => setPackField(setPack, "gross_wt", value)} />
            <Field label="Charge Wt" type="number" value={pack.charge_wt} onChange={(value) => setPackField(setPack, "charge_wt", value)} />
            <Field label="Rate" type="number" value={pack.rate} onChange={(value) => setPackField(setPack, "rate", value)} />
            <Field label="Amount" type="number" value={pack.amount} onChange={(value) => setPackField(setPack, "amount", value)} />
          </div>
        </Panel>

        <Panel className="lg:col-span-3" icon={mode.icon} title={isAir ? "Air Waybill" : "Container / Carrier"} meta={isAir ? pack.flight_info || "Flight pending" : pack.container_no || "Container pending"}>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {isAir ? (
              <>
                <Field label="HAWB" value={pack.hawb} onChange={(value) => setPackField(setPack, "hawb", value)} />
                <Field label="Airline" value={pack.airline} onChange={(value) => setPackField(setPack, "airline", value)} />
                <Field label="Flight Info" value={pack.flight_info} onChange={(value) => setPackField(setPack, "flight_info", value)} />
                <Field label="Issue Place" value={pack.issue_place} onChange={(value) => setPackField(setPack, "issue_place", value)} />
                <Field label="Issue Date" type="date" value={pack.issue_date} onChange={(value) => setPackField(setPack, "issue_date", value)} />
                <Field label="Status" value={pack.shipment_status} onChange={(value) => setPackField(setPack, "shipment_status", value)} />
              </>
            ) : (
              <>
                <Field label="Vessel / Vehicle" value={pack.vessel_name} onChange={(value) => setPackField(setPack, "vessel_name", value)} />
                <Field label="Voyage / Trip" value={pack.voyage_no} onChange={(value) => setPackField(setPack, "voyage_no", value)} />
                <Field label="Container No" value={pack.container_no} onChange={(value) => setPackField(setPack, "container_no", value)} />
                <Field label="Size" value={pack.container_size} onChange={(value) => setPackField(setPack, "container_size", value)} />
                <Field label="Type" value={pack.container_type} onChange={(value) => setPackField(setPack, "container_type", value)} />
                <Field label="Import BL" value={pack.import_blno} onChange={(value) => setPackField(setPack, "import_blno", value)} />
              </>
            )}
          </div>
        </Panel>

        <Panel className="lg:col-span-6" icon={FileText} title="Description And Marks" meta={pack.prod_description || "Cargo description pending"}>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <Textarea label="Marks & Nos" value={pack.marksnos} onChange={(value) => setPackField(setPack, "marksnos", value)} />
            <Textarea label="Product Description" value={pack.prod_description} onChange={(value) => setPackField(setPack, "prod_description", value)} />
            <Textarea label="Cargo Details" value={pack.cargo_details} onChange={(value) => setPackField(setPack, "cargo_details", value)} />
            <Textarea label="Remarks" value={pack.remarks} onChange={(value) => setPackField(setPack, "remarks", value)} />
          </div>
        </Panel>

        <Panel className="lg:col-span-6" icon={FileSignature} title="Terms And Handling" meta={pack.terms_of_delivery || "Delivery terms pending"}>
          <div className="grid gap-1.5 sm:grid-cols-4">
            <Field label="Terms" value={pack.terms_of_delivery} onChange={(value) => setPackField(setPack, "terms_of_delivery", value)} />
            <Field label="Ex Rate" type="number" value={pack.ex_rate} onChange={(value) => setPackField(setPack, "ex_rate", value)} />
            {!isAir && <Field label="Import BL Date" type="date" value={pack.import_bldate} onChange={(value) => setPackField(setPack, "import_bldate", value)} />}
            <Textarea className="sm:col-span-2" label="Handling Info" value={pack.handling_info} onChange={(value) => setPackField(setPack, "handling_info", value)} />
          </div>
        </Panel>
      </div>
    </form>
  );
}

function Header({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof Plane; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><Icon size={18} /></span>
        <div>
          <p className="eyebrow mb-0.5">Freight Pack List</p>
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

function NoticeChip({ notice }: { notice: Exclude<Notice, null> }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.text}</span>;
}

function emptyPack(companyCode: string, userId: string, transportMode: string, jobType: string): PackForm {
  return {
    company_code: companyCode,
    prin_code: "",
    job_no: "",
    packlist_no: "",
    seq_number: "",
    transport_mode: transportMode,
    job_type: jobType,
    job_date: "",
    prin_name: "",
    shipper_name: "",
    shipper_address: "",
    consignee_name: "",
    consignee_address: "",
    notify_name: "",
    notify_address: "",
    marksnos: "",
    prod_description: "",
    cargo_details: "",
    no_of_packings: "",
    quantity: "1",
    puom: "",
    volume: "",
    net_wt: "",
    gross_wt: "",
    charge_wt: "",
    container_no: "",
    container_size: "",
    container_type: "STANDARD",
    vessel_name: "",
    voyage_no: "",
    bl_no: "",
    bl_date: "",
    import_blno: "",
    import_bldate: "",
    hawb: "",
    airline: "",
    flight_info: "",
    issue_place: "",
    issue_date: "",
    shipment_status: "READY",
    terms_of_delivery: "",
    curr_code: "OMR",
    ex_rate: "1",
    rate: "",
    amount: "",
    remarks: "",
    handling_info: "",
    user_id: userId,
  };
}

function toPackForm(row: LookupRow, companyCode: string, userId: string, mode: string, jobType: string): PackForm {
  const base = emptyPack(companyCode, userId, mode, jobType);
  return Object.fromEntries(Object.keys(base).map((key) => [key, lookupText(row, key) || (base as any)[key]])) as PackForm;
}

function selectJob(value: string, row: LookupRow | null, setPack: (updater: (current: PackForm) => PackForm) => void, companyCode: string, userId: string, mode: string, jobType: string) {
  if (!row) {
    setPack((current) => ({ ...current, job_no: value }));
    return;
  }
  const next = toPackForm(row, companyCode, userId, mode, jobType);
  setPack((current) => ({
    ...current,
    ...next,
    job_no: value,
    packlist_no: current.packlist_no,
    seq_number: current.seq_number,
    curr_code: lookupText(row, "curr_code") || current.curr_code,
    ex_rate: lookupText(row, "ex_rate") || current.ex_rate,
  }));
}

function setPackField(setPack: (updater: (current: PackForm) => PackForm) => void, field: keyof PackForm, value: string) {
  setPack((current) => ({ ...current, [field]: value }));
}

async function lookupJobs(companyCode: string, mode: string, jobType: string, search: string) {
  const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/packlist/jobs", {
    company_code: companyCode,
    transport_mode: mode,
    job_type: jobType,
    search,
  });
  return (response.data.data || []).map(normalizeLookupRow);
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

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

const jobColumns = [
  { field: "JOB_NO", header: "Job No" },
  { field: "JOB_DATE", header: "Date" },
  { field: "PRIN_CODE", header: "Principal" },
  { field: "PRIN_NAME", header: "Principal Name" },
];
