import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Ban, CheckCircle2, Eye, PackageCheck, Plus, Printer, RefreshCw, Save, Settings2, Truck, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { executeWmsInboundSql, getWmsInbound, patchWmsInbound, postWmsInbound } from "../../api/wms";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import { titleCase } from "../../utils/menu";

type WmsRow = Record<string, unknown>;

const listingTabs = [
  { label: "In Progress", value: "in_progress" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Canceled", value: "cancel" },
];

const jobClassLabels: Record<string, string> = {
  N: "Normal",
  NP: "Normal HHT/RFID/AR",
  M: "Manual Putaway",
  S: "Sales Return",
  SP: "Sales Return HHT/RFID/AR",
  NI: "Non-Inventory",
  CP: "Co-Packing",
  MR: "Misc Receipts",
  IWT: "Inter Warehouse Transfer",
  CD: "Cross Docking",
};

const detailTabs = [
  { label: "Shipment Details", value: "shipment_details" },
  { label: "Packing Details", value: "packing_details" },
  { label: "Receiving Details", value: "receiving_details" },
  { label: "Quality Clearance", value: "quality_clearance" },
  { label: "Tally Details", value: "tally_details" },
  { label: "Putaway Details", value: "putway_details" },
  { label: "Putaway Manual", value: "putway_manual" },
  { label: "Putaway HHT/RFID/AR", value: "putway_hht" },
  { label: "Job Confirmation", value: "job_confirmation" },
  { label: "Activity Billing", value: "activity_billing" },
];

type JobField = {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
};

const jobFields: JobField[] = [
  { name: "prin_code", label: "Principal Code", required: true },
  { name: "dept_code", label: "Department Code" },
  { name: "div_code", label: "Division Code" },
  { name: "job_class", label: "Job Class", required: true },
  { name: "job_type", label: "Job Type", required: true },
  { name: "country_origin", label: "Country Origin" },
  { name: "country_destination", label: "Country Destination" },
  { name: "port_code", label: "Port Code" },
  { name: "destination_port", label: "Destination Port" },
  { name: "transport_mode", label: "Transport Mode" },
  { name: "schedule_date", label: "Schedule Date", type: "date" },
  { name: "doc_ref", label: "Doc Ref" },
  { name: "prin_ref2", label: "Principal Ref 2" },
  { name: "description1", label: "Description" },
  { name: "remarks", label: "Remarks" },
];

export function WmsInboundPage() {
  const location = useLocation();
  const view = parseInboundView(location.pathname);
  return view.jobNo ? <InboundJobDetail jobNo={view.jobNo} tab={view.tab || "shipment_details"} /> : <InboundJobListing />;
}

function InboundJobListing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<WmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("in_progress");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<WmsRow>(makeEmptyJob(user?.company_code));
  const [saving, setSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<WmsRow | null>(null);
  const [cancelRemarks, setCancelRemarks] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadRows = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const data = await executeWmsInboundSql("SELECT * FROM VW_TI_JOB WHERE JOB_TYPE = 'IMP' ORDER BY JOB_NO DESC");
      setRows(data.map(normalizeRow));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load inbound jobs" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const filteredRows = useMemo(() => rows.filter((row) => filterJobByTab(row, activeTab)), [rows, activeTab]);

  const columns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      {
        accessorKey: "job_no",
        header: "Job No",
        size: 130,
        cell: ({ row }) => (
          <button
            className="font-semibold text-primary hover:underline"
            onClick={() => navigate(`view/${value(row.original, "job_no")}/shipment_details?principal_code=${value(row.original, "prin_code")}`)}
          >
            {value(row.original, "job_no")}
          </button>
        ),
      },
      { accessorKey: "job_class", header: "Job Class", size: 180, cell: ({ row }) => <JobClassPill code={value(row.original, "job_class")} /> },
      { accessorKey: "prin_name", header: "Principal Name", size: 240, cell: ({ row }) => value(row.original, "prin_name") },
      { accessorKey: "job_date", header: "Job Date", size: 120, cell: ({ row }) => formatDate(value(row.original, "job_date")) },
      ...(activeTab === "confirmed"
        ? [{ accessorKey: "confirm_date", header: "Confirm Date", size: 130, cell: ({ row }: { row: { original: WmsRow } }) => formatDate(value(row.original, "confirm_date")) }]
        : []),
      ...(activeTab === "cancel"
        ? [{ accessorKey: "cancel_date", header: "Cancel Date", size: 130, cell: ({ row }: { row: { original: WmsRow } }) => formatDate(value(row.original, "cancel_date")) }]
        : []),
      { accessorKey: "doc_ref", header: "Doc Ref", size: 130, cell: ({ row }) => value(row.original, "doc_ref") },
      { accessorKey: "canceled", header: "Canceled", size: 100, cell: ({ row }) => flagBadge(value(row.original, "canceled")) },
      { accessorKey: "invoiced", header: "Invoiced", size: 100, cell: ({ row }) => flagBadge(value(row.original, "invoiced")) },
      { accessorKey: "invoice_date", header: "Invoice Date", size: 130, cell: ({ row }) => formatDate(value(row.original, "invoice_date")) },
      {
        id: "actions",
        header: "Actions",
        size: 120,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" title="Open job" onClick={() => navigate(`view/${value(row.original, "job_no")}/shipment_details?principal_code=${value(row.original, "prin_code")}`)}>
              <Eye size={14} />
            </Button>
            {activeTab !== "cancel" && (
              <Button size="icon" variant="ghost" title="Cancel job" onClick={() => setCancelTarget(row.original)}>
                <Ban size={14} />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [activeTab, navigate],
  );

  const saveJob = async (event: FormEvent) => {
    event.preventDefault();
    const missing = jobFields.find((field) => field.required && !String(form[field.name] || "").trim());
    if (missing) {
      setNotice({ type: "error", message: `${missing.label} is required` });
      return;
    }
    setSaving(true);
    try {
      await postWmsInbound("inboundjob", {
        ...form,
        company_code: form.company_code || user?.company_code,
        job_type: form.job_type || "IMP",
      });
      setFormOpen(false);
      setNotice({ type: "success", message: "Inbound job saved successfully" });
      await loadRows();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save inbound job" });
    } finally {
      setSaving(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget || !cancelRemarks.trim()) return;
    setSaving(true);
    try {
      await patchWmsInbound("canceljob", {
        job_no: value(cancelTarget, "job_no"),
        prin_code: value(cancelTarget, "prin_code"),
        remarks: cancelRemarks,
      });
      setCancelTarget(null);
      setCancelRemarks("");
      setNotice({ type: "success", message: "Inbound job cancellation submitted" });
      await loadRows();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to cancel inbound job" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">WMS Inbound</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Inbound Job Listing</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Manage import jobs, shipment progress, receiving, putaway, confirmation, and activity billing.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => { setForm(makeEmptyJob(user?.company_code)); setFormOpen(true); }}><Plus size={15} /> Add Job</Button>
        </div>
      </div>

      {notice && <div className={notice.type === "error" ? "alert error" : "alert success"}>{notice.message}</div>}

      <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
        {listingTabs.map((tab) => (
          <Button key={tab.value} size="sm" variant={activeTab === tab.value ? "default" : "outline"} onClick={() => setActiveTab(tab.value)}>
            {tab.label}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length} Jobs`}
        subtitle="Inbound Jobs"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search job, principal, reference..."
        loading={loading}
        height="calc(100vh - 310px)"
        minWidth={1380}
        density="grid"
        enablePagination
        pageSize={50}
        getRowId={(row, index) => String(value(row, "job_no") || index)}
        rowClassName={(row) => (isCanceled(row) ? "bg-red-50/70" : hasDate(value(row, "confirm_date")) ? "bg-emerald-50/70" : "bg-blue-50/50")}
      />

      <Dialog open={formOpen} title="Add Inbound Job" description="Create an import job using the existing WMS backend flow." onClose={() => setFormOpen(false)}>
        <form className="grid gap-4" onSubmit={saveJob}>
          <div className="grid gap-3 md:grid-cols-3">
            {jobFields.map((field) => (
              <label className={field.name === "remarks" || field.name === "description1" ? "field md:col-span-3" : "field"} key={field.name}>
                <span>{field.label}{field.required && <strong className="text-destructive"> *</strong>}</span>
                {field.name === "job_class" ? (
                  <Select value={String(form[field.name] || "")} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}>
                    <option value="">Select Job Class</option>
                    {Object.entries(jobClassLabels).map(([code, label]) => <option value={code} key={code}>{code} - {label}</option>)}
                  </Select>
                ) : (
                  <Input type={field.type || "text"} value={String(form[field.name] || "")} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} />
                )}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}><X size={15} /> Cancel</Button>
            <Button disabled={saving} type="submit"><Save size={15} /> {saving ? "Saving..." : "Save Job"}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(cancelTarget)}
        title={`Cancel Job ${cancelTarget ? value(cancelTarget, "job_no") : ""}`}
        description="Please enter cancellation remarks before submitting."
        compact
        tone="danger"
        onClose={() => setCancelTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Close</Button>
            <Button variant="destructive" disabled={saving || !cancelRemarks.trim()} onClick={confirmCancel}>Confirm Cancel</Button>
          </>
        }
      >
        <label className="field">
          <span>Cancel Remarks</span>
          <Input value={cancelRemarks} onChange={(event) => setCancelRemarks(event.target.value)} placeholder="Enter reason..." />
        </label>
      </Dialog>
    </section>
  );
}

function InboundJobDetail({ jobNo, tab }: { jobNo: string; tab: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<WmsRow | null>(null);
  const [loading, setLoading] = useState(true);

  const loadJob = async () => {
    setLoading(true);
    try {
      const data = await getWmsInbound<WmsRow>(`job/${encodeURIComponent(jobNo)}`);
      setJob(normalizeRow(data || {}));
    } catch {
      const fallback = await executeWmsInboundSql(`SELECT * FROM VW_TI_JOB WHERE JOB_NO = '${sqlEscape(jobNo)}' AND COMPANY_CODE = '${sqlEscape(user?.company_code || "")}'`);
      setJob(normalizeRow(fallback[0] || { job_no: jobNo }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJob();
  }, [jobNo]);

  const availableTabs = getTabsForJob(value(job || {}, "job_class"));
  const activeTab = availableTabs.some((item) => item.value === tab) ? tab : "shipment_details";

  return (
    <section className="grid gap-3">
      <div className="rounded-md border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button size="icon" variant="outline" onClick={() => navigate("../..")} title="Back to jobs"><ArrowLeft size={16} /></Button>
            <div className="min-w-0">
              <p className="eyebrow">Inbound Job</p>
              <h1 className="m-0 truncate text-xl font-semibold">{jobNo}</h1>
            </div>
            {job && <JobClassPill code={value(job, "job_class")} />}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={loadJob}><RefreshCw size={14} /> Refresh</Button>
            <Button size="sm" variant="outline"><Printer size={14} /> Print</Button>
          </div>
        </div>
        <div className="grid gap-2 p-3 md:grid-cols-5">
          <Info label="Principal" value={`${value(job || {}, "prin_code")} ${value(job || {}, "prin_name") ? `- ${value(job || {}, "prin_name")}` : ""}`} />
          <Info label="Job Date" value={formatDate(value(job || {}, "job_date"))} />
          <Info label="Document Ref" value={value(job || {}, "doc_ref")} />
          <Info label="Status" value={isCanceled(job || {}) ? "Canceled" : hasDate(value(job || {}, "confirm_date")) ? "Confirmed" : "In Progress"} />
          <Info label="Company" value={user?.company_code || ""} />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-md border bg-card p-2">
        {availableTabs.map((item) => (
          <Link
            className={item.value === activeTab ? "ui-button ui-button-default ui-button-sm" : "ui-button ui-button-outline ui-button-sm"}
            key={item.value}
            to={`../${item.value}${locationSearchPrincipal(job)}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <InboundOperationalTab job={job} jobNo={jobNo} tab={activeTab} loadingJob={loading} />
    </section>
  );
}

function InboundOperationalTab({ job, jobNo, tab, loadingJob }: { job: WmsRow | null; jobNo: string; tab: string; loadingJob: boolean }) {
  const { user } = useAuth();
  const prinCode = value(job || {}, "prin_code");
  const [rows, setRows] = useState<WmsRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const config = getInboundTabConfig(tab);
  const loadRows = async () => {
    if (!config || loadingJob) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await executeWmsInboundSql(config.sql({ companyCode: user?.company_code || "", jobNo, prinCode }));
      setRows(data.map(normalizeRow));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to load ${config.title}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [tab, jobNo, prinCode, loadingJob]);

  if (!config) return <Card><CardContent className="p-6 text-sm text-muted-foreground">This inbound tab is not configured yet.</CardContent></Card>;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {config.action && <Button size="sm" variant="outline" onClick={config.action.onClick}><config.action.icon size={14} /> {config.action.label}</Button>}
      <Button size="sm" variant="outline" onClick={loadRows}><RefreshCw size={14} /> Refresh</Button>
    </div>
  );

  return (
    <section className="grid gap-3">
      {notice && <div className={notice.type === "error" ? "alert error" : "alert success"}>{notice.message}</div>}
      <DataTable
        columns={makeColumns(config.columns)}
        data={rows}
        title={loading ? "Loading" : `${rows.length} Rows`}
        subtitle={config.title}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
        loading={loading || loadingJob}
        height="calc(100vh - 365px)"
        minWidth={config.minWidth}
        density="grid"
        enablePagination
        pageSize={75}
        toolbar={toolbar}
        getRowId={(row, index) => `${tab}_${value(row, "packdet_no") || value(row, "container_no") || value(row, "key_number") || index}`}
      />
    </section>
  );
}

function makeColumns(columns: { key: string; label: string; size?: number }[]): ColumnDef<WmsRow>[] {
  return columns.map((column) => ({
    accessorKey: column.key,
    header: column.label,
    size: column.size || 140,
    cell: ({ row }) => formatCellValue(row.original, column.key),
  }));
}

function getInboundTabConfig(tab: string) {
  const packSql = ({ companyCode, jobNo, prinCode }: { companyCode: string; jobNo: string; prinCode: string }) =>
    `SELECT * FROM VW_WM_INB_PACKDET_DETS WHERE company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`;
  const configs: Record<string, { title: string; minWidth: number; columns: { key: string; label: string; size?: number }[]; sql: (args: { companyCode: string; jobNo: string; prinCode: string }) => string; action?: { label: string; icon: typeof Plus; onClick: () => void } }> = {
    shipment_details: {
      title: "Shipment Details",
      minWidth: 1060,
      sql: ({ jobNo, prinCode }) => `SELECT * FROM TI_CONTAINER WHERE PRIN_CODE = '${sqlEscape(prinCode)}' AND JOB_NO = '${sqlEscape(jobNo)}'`,
      columns: [
        { key: "container_no", label: "Container No", size: 150 },
        { key: "vehicle_no", label: "Vehicle No", size: 130 },
        { key: "vessel_name", label: "Vessel Name", size: 150 },
        { key: "voyage_no", label: "Voyage No", size: 130 },
        { key: "seal_no", label: "Seal No", size: 130 },
        { key: "po_no", label: "PO No", size: 130 },
        { key: "bl_no", label: "BL No", size: 130 },
      ],
      action: { label: "Add Shipment", icon: Plus, onClick: () => undefined },
    },
    packing_details: {
      title: "Packing Details",
      minWidth: 1280,
      sql: packSql,
      columns: packingColumns(),
      action: { label: "Add Packing", icon: Plus, onClick: () => undefined },
    },
    receiving_details: {
      title: "Receiving Details",
      minWidth: 1320,
      sql: packSql,
      columns: [
        { key: "prod_name", label: "Product", size: 320 },
        { key: "qty_string", label: "Quantity", size: 150 },
        { key: "quantity", label: "Net Quantity", size: 140 },
        { key: "qty_arrived_string", label: "Arrived Qty", size: 150 },
        { key: "qty_netarrived_string", label: "Net Arrived Qty", size: 160 },
        { key: "batch_no", label: "Batch No", size: 120 },
        { key: "lot_no", label: "Lot No", size: 120 },
        { key: "po_no", label: "PO No", size: 120 },
        { key: "doc_ref", label: "Doc Ref", size: 140 },
      ],
      action: { label: "Receive All", icon: PackageCheck, onClick: () => undefined },
    },
    quality_clearance: {
      title: "Quality Clearance",
      minWidth: 1200,
      sql: packSql,
      columns: [
        { key: "prod_name", label: "Product", size: 320 },
        { key: "qty_string", label: "Quantity", size: 140 },
        { key: "clearance", label: "Clearance", size: 120 },
        { key: "batch_no", label: "Batch No", size: 120 },
        { key: "lot_no", label: "Lot No", size: 120 },
        { key: "container_no", label: "Container", size: 140 },
        { key: "po_no", label: "PO No", size: 120 },
        { key: "doc_ref", label: "Doc Ref", size: 140 },
      ],
      action: { label: "Process Clearance", icon: Settings2, onClick: () => undefined },
    },
    tally_details: {
      title: "Tally Details",
      minWidth: 1260,
      sql: ({ companyCode, jobNo, prinCode }) =>
        `SELECT * FROM VW_WM_INB_TT_TALLY_DETS WHERE company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`,
      columns: [
        { key: "prod_name", label: "Product", size: 320 },
        { key: "qty_tally_string", label: "Tally Qty", size: 150 },
        { key: "qty_string", label: "Pack Qty", size: 150 },
        { key: "batch_no", label: "Batch No", size: 120 },
        { key: "lot_no", label: "Lot No", size: 120 },
        { key: "container_no", label: "Container", size: 140 },
        { key: "po_no", label: "PO No", size: 120 },
      ],
      action: { label: "Add Tally", icon: Plus, onClick: () => undefined },
    },
    putway_details: {
      title: "Putaway Details",
      minWidth: 1280,
      sql: ({ companyCode, jobNo, prinCode }) =>
        `SELECT * FROM VW_WM_INB_TT_BATCH_DETS WHERE company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`,
      columns: confirmationColumns(),
      action: { label: "Process Putaway", icon: Truck, onClick: () => undefined },
    },
    putway_manual: {
      title: "Putaway Manual",
      minWidth: 1280,
      sql: ({ companyCode, jobNo, prinCode }) =>
        `SELECT * FROM VW_WM_INB_TT_BATCH_DETS WHERE company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`,
      columns: confirmationColumns(),
      action: { label: "Add Manual Putaway", icon: Plus, onClick: () => undefined },
    },
    putway_hht: {
      title: "Putaway HHT/RFID/AR",
      minWidth: 1280,
      sql: ({ companyCode, jobNo, prinCode }) =>
        `SELECT * FROM VW_WM_INB_TT_BATCH_DETS WHERE company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`,
      columns: confirmationColumns(),
      action: { label: "Process HHT Putaway", icon: Settings2, onClick: () => undefined },
    },
    job_confirmation: {
      title: "Job Confirmation",
      minWidth: 1380,
      sql: ({ companyCode, jobNo, prinCode }) =>
        `SELECT * FROM VW_WM_INB_TT_BATCH_DETS WHERE confirmed = 'N' AND company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`,
      columns: confirmationColumns(),
      action: { label: "Process Confirm Selected", icon: CheckCircle2, onClick: () => undefined },
    },
    activity_billing: {
      title: "Activity Billing",
      minWidth: 1180,
      sql: ({ companyCode, jobNo, prinCode }) =>
        `SELECT * FROM VW_WM_INB_ACTIVITY_BILLING WHERE company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}'`,
      columns: [
        { key: "activity_code", label: "Activity Code", size: 150 },
        { key: "activity_name", label: "Activity Name", size: 260 },
        { key: "charge_code", label: "Charge Code", size: 140 },
        { key: "qty", label: "Qty", size: 100 },
        { key: "rate", label: "Rate", size: 100 },
        { key: "amount", label: "Amount", size: 120 },
      ],
    },
  };
  return configs[tab];
}

function packingColumns() {
  return [
    { key: "prod_name", label: "Product", size: 320 },
    { key: "qty_string", label: "Quantity", size: 140 },
    { key: "quantity", label: "Net Quantity", size: 140 },
    { key: "batch_no", label: "Batch No", size: 120 },
    { key: "lot_no", label: "Lot No", size: 120 },
    { key: "container_no", label: "Container", size: 140 },
    { key: "po_no", label: "PO No", size: 120 },
    { key: "doc_ref", label: "Doc Ref", size: 140 },
  ];
}

function confirmationColumns() {
  return [
    { key: "prod_name", label: "Product", size: 320 },
    { key: "qty_confirm_string", label: "Quantity", size: 150 },
    { key: "receive_qty_string", label: "Arrived Qty", size: 150 },
    { key: "net_receive_string", label: "Net Arrived Qty", size: 160 },
    { key: "batch_no", label: "Batch No", size: 120 },
    { key: "lot_no", label: "Lot No", size: 120 },
    { key: "mfg_date", label: "Mfg Date", size: 120 },
    { key: "exp_date", label: "Exp Date", size: 120 },
    { key: "container_no", label: "Container", size: 140 },
    { key: "po_no", label: "PO No", size: 120 },
    { key: "doc_ref", label: "BL Number", size: 140 },
  ];
}

function getTabsForJob(jobClass: string) {
  if (jobClass === "M") return detailTabs.filter((tab) => ["shipment_details", "putway_manual", "job_confirmation", "activity_billing"].includes(tab.value));
  if (jobClass === "NP") return detailTabs.filter((tab) => ["shipment_details", "packing_details", "quality_clearance", "tally_details", "putway_hht", "job_confirmation", "activity_billing"].includes(tab.value));
  if (jobClass === "N") return detailTabs.filter((tab) => ["shipment_details", "packing_details", "receiving_details", "quality_clearance", "putway_details", "job_confirmation", "activity_billing"].includes(tab.value));
  return detailTabs;
}

function parseInboundView(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const viewIndex = parts.findIndex((part) => part.toLowerCase() === "view");
  return {
    jobNo: viewIndex >= 0 ? parts[viewIndex + 1] : "",
    tab: viewIndex >= 0 ? parts[viewIndex + 2] : "",
  };
}

function filterJobByTab(row: WmsRow, tab: string) {
  const canceled = isCanceled(row);
  const confirmed = hasDate(value(row, "confirm_date"));
  if (tab === "cancel") return canceled || hasDate(value(row, "cancel_date"));
  if (tab === "confirmed") return confirmed && !canceled;
  return !confirmed && !canceled;
}

function makeEmptyJob(companyCode?: string) {
  return {
    company_code: companyCode || "",
    job_type: "IMP",
    job_class: "N",
    transport_mode: "S",
    schedule_date: new Date().toISOString().slice(0, 10),
  };
}

function JobClassPill({ code }: { code: string }) {
  const label = jobClassLabels[code] || code || "N/A";
  return <span className="inline-flex max-w-[170px] items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{label}</span>;
}

function Info({ label, value: infoValue }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <strong className="mt-1 block truncate text-sm">{infoValue || "-"}</strong>
    </div>
  );
}

function flagBadge(flag: string) {
  const yes = flag === "Y" || flag.toLowerCase() === "yes";
  return <span className={yes ? "text-emerald-700" : "text-muted-foreground"}>{yes ? "Yes" : "No"}</span>;
}

function normalizeRow(row: WmsRow) {
  const normalized: WmsRow = { ...row };
  Object.entries(row || {}).forEach(([key, rowValue]) => {
    normalized[key.toLowerCase()] = rowValue;
  });
  return normalized;
}

function value(row: WmsRow, key: string) {
  return String(row[key] ?? row[key.toUpperCase()] ?? "");
}

function formatCellValue(row: WmsRow, key: string) {
  const cell = value(row, key);
  if (key.includes("date")) return formatDate(cell);
  return cell;
}

function formatDate(input: string) {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleDateString("en-GB");
}

function hasDate(input: string) {
  return Boolean(input && input !== "N/A" && input !== "null");
}

function isCanceled(row: WmsRow) {
  return value(row, "canceled") === "Y" || hasDate(value(row, "cancel_date"));
}

function sqlEscape(input: string) {
  return String(input || "").replace(/'/g, "''");
}

function locationSearchPrincipal(job: WmsRow | null) {
  const prin = value(job || {}, "prin_code");
  return prin ? `?principal_code=${encodeURIComponent(prin)}` : "";
}
