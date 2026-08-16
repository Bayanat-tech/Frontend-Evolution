import type { ColumnDef } from "@tanstack/react-table";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Plane, RefreshCw, Search, Ship, Truck, Save, Edit2 } from "lucide-react";
import { api } from "../../api/client";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";
import { Field } from "../vendor/components";

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

type SheetState = {
  header: LookupRow | null;
  packlist: LookupRow | null;
};

export function FreightJobSheetPage({
  target,
  initialJob = null,
  readOnly = false,
  onEmbeddedActionsChange,
  onEmbeddedList,
}: {
  target?: FreightWorkspaceTarget;
  initialJob?: LookupRow | null;
  readOnly?: boolean;
  onEmbeddedActionsChange?: (actions: ReactNode | null) => void;
  onEmbeddedList?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const modeKey = (target?.mode || "air") as keyof typeof modeMap;
  const directionKey = (target?.direction || "import") as keyof typeof directionMap;
  const mode = modeMap[modeKey];
  const direction = directionMap[directionKey];
  const Icon = mode.icon;
  const [selectedJob, setSelectedJob] = useState<LookupRow | null>(initialJob ? normalizeRow(initialJob) : null);
  const [sheet, setSheet] = useState<SheetState>({ header: null, packlist: null });
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [isEditing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LookupRow | null>(null);
  const [saving, setSaving] = useState(false);
  const embeddedInWorkspace = Boolean(onEmbeddedActionsChange);
  const activeJob = sheet.header || selectedJob;

  const loadRows = useCallback(async () => {
    setListLoading(true);
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/job/list", {
        company_code: companyCode,
        transport_mode: mode.code,
        job_type: direction.code,
        search: query,
      });
      setRows((response.data.data || []).map(normalizeRow));
    } catch (error: any) {
      setRows([]);
      toast.error(error?.response?.data?.details || error?.response?.data?.message || "Unable to load jobs for job sheet.");
    } finally {
      setListLoading(false);
    }
  }, [companyCode, direction.code, mode.code, query, toast]);

  const loadSheet = useCallback(async (jobRow: LookupRow) => {
    const jobNo = text(jobRow, "job_no");
    const prinCode = text(jobRow, "prin_code");
    if (!jobNo || !prinCode) return;
    setLoading(true);
    try {
      const response = await api.post<{ success?: boolean; data?: { header?: LookupRow; packlist?: LookupRow } }>("/api/freight/job/get", {
        company_code: companyCode,
        prin_code: prinCode,
        job_no: jobNo,
      });
      setSheet({
        header: normalizeRow(response.data.data?.header || jobRow),
        packlist: response.data.data?.packlist ? normalizeRow(response.data.data.packlist) : null,
      });
    } catch (error: any) {
      setSheet({ header: null, packlist: null });
      toast.error(error?.response?.data?.details || error?.response?.data?.message || "Unable to open job sheet.");
    } finally {
      setLoading(false);
    }
  }, [companyCode, toast]);

  function startEditing() {
    if (readOnly) {
      toast.error("Invoiced or completed job is locked. Job sheet is view only.");
      return;
    }
    setDraft(activeJob ? { ...activeJob } : null);
    setEditing(true);
  }

function cancelEditing() {
  setDraft(null);
  setEditing(false);
}

function updateDraft(key: string, value: string) {
  setDraft((current) => ({ ...(current || {}), [key.toUpperCase()]: value }));
}

async function saveHeader() {
  if (!draft) return;
  if (readOnly) {
    toast.error("Invoiced or completed job is locked. Job sheet is view only.");
    return;
  }
  setSaving(true);
  try {
    await api.post("/api/freight/job/save", {
      company_code: companyCode,
      job: draft,
    });
    toast.success("Job sheet saved.");
    setEditing(false);
    setDraft(null);
    await loadSheet(normalizeRow(draft));
  } catch (error: any) {
    toast.error(error?.response?.data?.details || error?.response?.data?.message || "Unable to save job sheet.");
  } finally {
    setSaving(false);
  }
 }

  useEffect(() => {
    if (!embeddedInWorkspace || !onEmbeddedActionsChange || !selectedJob) {
      onEmbeddedActionsChange?.(null);
      return undefined;
    }

    onEmbeddedActionsChange(
      <div className="freight-job-inline-actions freight-job-inline-actions-header freight-job-commandbar">
        <Button type="button" size="sm" variant="outline" onClick={() => (onEmbeddedList ? onEmbeddedList() : setSelectedJob(null))}>
          <ArrowLeft size={14} /> List
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void loadSheet(activeJob || selectedJob)} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </Button>
        {!isEditing && !readOnly && (
          <Button type="button" size="sm" variant="outline" onClick={startEditing}>
            <Edit2 size={14} /> Edit
          </Button>
        )}
        {isEditing && (
          <Button type="button" size="sm" variant="outline" onClick={cancelEditing}>
            Cancel
          </Button>
        )}
        {isEditing && !readOnly && (
          <Button type="button" size="sm" onClick={() => void saveHeader()} disabled={saving || readOnly}>
            <Save size={14} /> Save
          </Button>
        )}
        <span className={`freight-job-mode-badge ${isEditing ? "editing" : "viewing"}`}>{isEditing ? "Edit" : "View"}</span>
      </div>
    );

    return () => onEmbeddedActionsChange(null);
  }, [activeJob, embeddedInWorkspace, isEditing, loading, onEmbeddedActionsChange, onEmbeddedList, readOnly, saving, selectedJob]);

  useEffect(() => {
    const nextJob = initialJob ? normalizeRow(initialJob) : null;
    setSelectedJob(nextJob);
    setSheet({ header: null, packlist: null });
    setEditing(false);
  setDraft(null);
  }, [initialJob, modeKey, directionKey]);

  useEffect(() => {
    if (readOnly && isEditing) {
      setEditing(false);
      setDraft(null);
    }
  }, [isEditing, readOnly]);

  useEffect(() => {
    if (selectedJob) {
      void loadSheet(selectedJob);
    } else {
      void loadRows();
    }
  }, [loadRows, loadSheet, selectedJob]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    {
      accessorKey: "JOB_NO",
      header: "Job No",
      size: 130,
      cell: ({ row }) => (
        <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setSelectedJob(row.original)}>
          {text(row.original, "job_no")}
        </button>
      ),
    },
    { accessorKey: "JOB_DATE", header: "Date", size: 110, cell: ({ row }) => formatDate(text(row.original, "job_date")) },
    { accessorKey: "PRIN_CODE", header: "Principal", size: 100 },
    { accessorKey: "PRIN_NAME", header: "Principal Name", size: 260 },
    { accessorKey: "DOC_REF", header: mode.code === "A" ? "MAWB" : "Master Ref", size: 145 },
    { accessorKey: "HAWB", header: mode.code === "A" ? "HAWB" : "House Ref", size: 130 },
    { accessorKey: "PORT_CODE", header: "Origin", size: 100 },
    { accessorKey: "DESTINATION_PORT", header: "Destination", size: 120 },
    { accessorKey: "CONFIRM_DATE", header: "Confirm", size: 110, cell: ({ row }) => formatDate(text(row.original, "confirm_date")) || "-" },
    { accessorKey: "INVOICE_DATE", header: "Invoice", size: 110, cell: ({ row }) => formatDate(text(row.original, "invoice_date")) || "-" },
  ], [mode.code]);

  if (!selectedJob) {
    return (
      <section className="grid gap-2">
        <div className="freight-form-header">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><FileText size={18} /></span>
            <div>
              <p className="eyebrow mb-0.5">Freight Job Sheet</p>
              <h1 className="m-0 text-lg font-semibold text-foreground">{mode.label} {direction.label} Job Sheet</h1>
              <p className="m-0 text-xs font-semibold text-slate-700">Select a job to view the operational job sheet.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-72 max-w-full">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-muted-foreground" size={15} />
              <Input className="h-8 pl-9 text-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search job..." />
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => void loadRows()} disabled={listLoading}><RefreshCw size={14} /> Refresh</Button>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={rows}
          loading={listLoading}
          title={`${rows.length} Jobs`}
          subtitle={`${mode.label} / ${direction.label}`}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Filter visible jobs..."
          height="calc(100vh - 292px)"
          minWidth={1160}
          density="grid"
          enablePagination
          pageSize={50}
          onRowClick={(row) => setSelectedJob(normalizeRow(row))}
        />
      </section>
    );
  }

  const job = activeJob || selectedJob;
  const pack = sheet.packlist;
  const titleRef = text(job, "job_no") || "Job Sheet";
  const houseRef = text(job, "hawb") || text(pack, "bl_no") || text(job, "doc_ref") || "-";
  const jobDate = formatDate(text(job, "job_date"));

  return (
    <section className="freight-document-form">
      {!embeddedInWorkspace && (
        <div className="freight-job-focus-bar freight-job-focus-compact">
          <div>
            <p className="m-0 text-xs font-semibold text-primary">Freight Job Sheet / {titleRef}</p>
            <h2 className="m-0 text-lg font-semibold text-foreground">{mode.label} {direction.label} Operational Sheet</h2>
            <p className="m-0 text-xs font-semibold text-muted-foreground">{text(job, "prin_name") || text(job, "prin_code") || "Principal pending"} | {houseRef}</p>
          </div>
          <div className="freight-job-inline-actions">
            <Button type="button" size="sm" variant="outline" onClick={() => setSelectedJob(null)}><ArrowLeft size={14} /> Select Job</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void loadSheet(job)} disabled={loading}><RefreshCw size={14} /> Refresh</Button>
            {!isEditing && !readOnly && <Button type="button" size="sm" variant="outline" onClick={startEditing}><Edit2 size={14} /> Edit</Button>}
            {isEditing && <Button type="button" size="sm" variant="outline" onClick={cancelEditing}>Cancel</Button>}
            {isEditing && !readOnly && <Button type="button" size="sm" onClick={() => void saveHeader()} disabled={saving || readOnly}><Save size={14} /> Save</Button>}
          </div>
        </div>
      )}

      <div className={`freight-document-paper freight-shipment-paper ${isEditing && !readOnly ? "is-editing" : "is-viewing"}`}>
        <div className="freight-shipment-hero">
          <div className="freight-shipment-hero-item">
            <span>Booking Ref / Job No</span>
            <strong>{titleRef}</strong>
          </div>
          <div className="freight-shipment-hero-item">
            <span>{mode.code === "A" ? "HAWB Number" : "House / BL Number"}</span>
            <strong>{houseRef}</strong>
          </div>
        </div>

        <div className="freight-shipment-quickfacts">
          <Display label="Shipment Date" value={jobDate} />
          <Display label="Shipment Type" value={jobTypeLabel(text(job, "job_type"), direction.label)} />
          <Display label="Transport Mode" value={`${mode.label} Freight`} />
          <Display label="From Quote" value={text(job, "quotation_ref")} />
          <Display label="Sales Rep" value={text(job, "salesman_code")} />
          <Display label="Principal" value={text(job, "prin_code")} />
        </div>

        <div className="freight-job-section-grid">
          <SheetSection className="lg:col-span-12" title="Job Identity" meta={`${titleRef} / ${mode.label} / ${direction.label}`}>
            <div className="freight-job-field-grid freight-job-field-grid-4">
              <Display label="Job No" value={titleRef} strong />
              <Display label="Job Date" value={jobDate} />
              {isEditing
                 ? <Field label="Principal" value={text(draft, "prin_code")} onChange={(v) => updateDraft("prin_code", v)} />
                 : <Display label="Principal" value={text(job, "prin_code")} />}
              {isEditing
                ? <Field label="Quotation Ref" value={text(draft, "quotation_ref")} onChange={(v) => updateDraft("quotation_ref", v)} />
                : <Display label="Quotation Ref" value={text(job, "quotation_ref")} />}
              <Display label="Department" value={text(job, "dept_code")} />
              <Display label="Division" value={text(job, "div_code")} />
              <Display label="Job Category" value={text(job, "job_category")} />
              <Display label="Member Type" value={text(job, "member_type")} />
              <Display label="Tax Category" value={text(job, "tx_cat_code")} />
              <Display label="Sale Type" value={text(job, "sale_type")} />
              <Display label="Job Class" value={text(job, "job_class")} />
            </div>
          </SheetSection>

          <SheetSection className="lg:col-span-4" title="Journey" meta={`${text(job, "port_code") || "-"} -> ${text(job, "destination_port") || "-"}`}>
            <div className="freight-job-field-grid">
              <Display label="Origin Port" value={text(job, "port_code")} />
              <Display label="Destination Port" value={text(job, "destination_port")} />
              <Display label="Place of Receipt" value={text(job, "place_receipt")} />
              <Display label="Place of Delivery" value={text(job, "place_delivery")} />
              <Display label={mode.code === "R" ? "Vehicle" : mode.code === "A" ? "Airline" : "Vessel"} value={text(job, "vessel_name")} />
              {mode.code === "S" && <Display label="Feeder Vessel" value={text(job, "feeder_vessel_name")} />}
              <Display label={mode.code === "R" ? "Trip / Route No" : mode.code === "A" ? "Flight No" : "Voyage No"} value={text(job, "voyage_no")} />
              <Display label="Carrier" value={text(job, "carrier")} />
            </div>
          </SheetSection>

          <SheetSection className="lg:col-span-4" title="Bill Of Lading Details" meta={text(job, "doc_ref") || text(job, "hawb") || "Document refs"}>
            <div className="freight-job-field-grid">
              <Display label={mode.code === "A" ? "MAWB" : "Master BL No"} value={text(job, "doc_ref")} />
              <Display label={mode.code === "A" ? "HAWB" : "HBL"} value={text(job, "hawb")} />
              <Display label="Doc Ref 2" value={text(job, "doc_ref2")} />
              <Display label="No of Orig Docs" value={text(job, "no_of_original_bl")} />
              <Display label="Cargo Description" value={text(job, "description1") || text(pack, "cargo_details")} multiline />
              <Display label="Remarks" value={text(job, "remarks") || text(pack, "remarks")} multiline />
            </div>
          </SheetSection>

          <SheetSection className="lg:col-span-4" title="Events" meta={formatDate(text(job, "job_start_date")) || "Job start pending"}>
            <div className="freight-job-field-grid">
              <Display label="Job Start Date" value={formatDate(text(job, "job_start_date"))} />
              <Display label="Date of Pickup" value={formatDate(text(job, "pickup_date"))} />
              <Display label="Date of Departure" value={formatDate(text(job, "etd"))} />
              <Display label="Date of Delivery" value={formatDate(text(job, "delivery_date"))} />
              <Display label="ETA" value={formatDate(text(job, "eta"))} />
              <Display label="ATA" value={formatDate(text(job, "ata"))} />
              <Display label="Schedule Date" value={formatDate(text(job, "schedule_date"))} />
              <Display label="Transit Time" value={text(job, "transit_time")} />
            </div>
          </SheetSection>

          <SheetSection className="lg:col-span-4" title="Payment Terms" meta={`${text(job, "payment_terms") || "-"} / ${text(job, "payableat") || "-"}`}>
            <div className="freight-job-field-grid">
              <Display label="INCO Terms" value={text(job, "payment_terms")} />
              <Display label="Currency" value={text(job, "curr_code")} />
              <Display label="Exchange Rate" value={text(job, "ex_rate")} />
              <Display label="Freight Payable At" value={text(job, "payableat")} />
              <Display label="Freight Value" value={text(job, "frieght_value")} />
              <Display label="Insurance Value" value={text(job, "insurance_value")} />
            </div>
          </SheetSection>

          <SheetSection className="lg:col-span-4" title="References" meta="Forwarder / sales">
            <div className="freight-job-field-grid">
              <Display label="Forwarder" value={text(job, "forwarder_code")} />
              <Display label="Sales Rep" value={text(job, "salesman_code")} />
              <Display label="Principal Ref 1" value={text(job, "prin_ref1")} />
              <Display label="Principal Ref 2" value={text(job, "prin_ref2")} />
              <Display label="Customer" value={text(job, "cust_code")} />
              <Display label="Broker" value={text(job, "broker_code")} />
            </div>
          </SheetSection>

          <SheetSection className="lg:col-span-4" title="Pack List Summary" meta={pack ? `Pack ${text(pack, "packlist_no") || "1"}` : "Pending"}>
            <div className="freight-job-field-grid">
              <Display label="Pack List No" value={text(pack, "packlist_no")} />
              <Display label="Shipper" value={text(pack, "shipper_name")} />
              <Display label="Consignee" value={text(pack, "consignee_name")} />
              <Display label="Notify" value={text(pack, "notify_name")} />
              <Display label="Packages" value={joinParts([text(pack, "no_of_packings"), text(pack, "puom")])} />
              <Display label="Gross / Net / Volume" value={joinParts([text(pack, "gross_wt"), text(pack, "net_wt"), text(pack, "volume")], " / ")} />
              <Display label="Container" value={joinParts([text(pack, "container_no"), text(pack, "container_type")])} />
            </div>
          </SheetSection>
        </div>
      </div>
    </section>
  );
}

function SheetSection({ title, meta, children, className = "" }: { title: string; meta?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`freight-info-section ${className}`}>
      <div className="freight-info-title">
        <h2>{title}</h2>
        {meta && <span>{meta}</span>}
      </div>
      <div className="freight-info-body">{children}</div>
    </section>
  );
}

function Display({ label, value, strong = false, multiline = false }: { label: string; value: string; strong?: boolean; multiline?: boolean }) {
  return (
    <div className={`freight-read-field ${multiline ? "multiline" : ""}`}>
      <span>{label}</span>
      <strong className={strong ? "is-strong" : ""}>{value || "-"}</strong>
    </div>
  );
}

function normalizeRow(row: LookupRow) {
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key.toUpperCase(), value])) as LookupRow;
}

function text(row: LookupRow | null | undefined, key: string) {
  if (!row) return "";
  const value = row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function formatDate(value: string) {
  if (!value) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB");
}

function yesNo(value: string) {
  return ["Y", "YES", "TRUE", "1"].includes(value.toUpperCase()) ? "Yes" : "No";
}

function jobTypeLabel(value: string, fallback: string) {
  if (value === "IMP") return "Import";
  if (value === "EXP") return "Export";
  if (value === "IRE") return "Import for Re-export";
  return fallback;
}

function jobFlagLabel(value: string) {
  if (value === "M") return "Master";
  if (value === "H") return "House";
  return value || "-";
}

function progressMeta(job: LookupRow) {
  return [
    yesNo(text(job, "packdet")),
    yesNo(text(job, "confirmed")),
    yesNo(text(job, "invoiced") || (text(job, "invoice_date") ? "Y" : "")),
  ].join(" / ");
}

function joinParts(parts: string[], separator = " ") {
  return parts.filter(Boolean).join(separator);
}
