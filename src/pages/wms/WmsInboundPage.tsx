import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft, Ban, CheckCircle2, Eye, PackageCheck, Plus, Printer,
  RefreshCw, Save, Settings2, Truck, X, ChevronDown
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { executeWmsInboundSql, getWmsInbound, patchWmsInbound, postWmsInbound } from "../../api/wms";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import { cn } from "../../lib/utils";
import { LookupField } from "../../components/ui/LookupField";
type WmsRow = Record<string, unknown>;
type DropdownOption = { value: string; label: string };

// ---------------------------------------------------------------------------
// SearchableSelect
// ---------------------------------------------------------------------------
function SearchableSelect({
  value: currentValue, options, placeholder, onChange, onClear, hasValue,
}: {
  value: string; options: DropdownOption[]; placeholder: string;
  onChange: (val: string) => void; onClear: () => void; hasValue: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(
    () => search.trim()
      ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())).slice(0, 50)
      : options.slice(0, 50),
    [options, search],
  );

  const selectedLabel = options.find((o) => o.value === currentValue)?.label || "";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setSearch(""); }}
        className={cn(
          "flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-all duration-200",
          hasValue
            ? "border-primary bg-primary/10 font-medium text-primary ring-1 ring-primary/30"
            : "border-input bg-background text-muted-foreground",
        )}
      >
        <span className="truncate">{hasValue ? selectedLabel : placeholder}</span>
        <ChevronDown size={14} className="ml-2 shrink-0 opacity-50" />
      </button>
      {hasValue && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
          className="absolute right-7 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/30 text-foreground hover:bg-destructive hover:text-white transition-colors"
        >
          <X size={10} />
        </button>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          <div className="p-2 border-b">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No results</li>
            ) : (
              filtered.map((opt) => (
                <li
                  key={opt.value}
                  className={cn(
                    "cursor-pointer px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                    opt.value === currentValue && "bg-primary/10 font-medium text-primary",
                  )}
                  onMouseDown={() => { onChange(opt.value); setOpen(false); setSearch(""); }}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
          {options.length > 50 && (
            <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
              Showing 50 of {options.length} — type to filter
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// useRawSqlDropdown
// ---------------------------------------------------------------------------
function useRawSqlDropdown({ sql, valueKey, labelKeys, enabled = true }: {
  sql: string; valueKey: string; labelKeys: string[]; enabled?: boolean;
}) {
  const [options, setOptions] = useState<DropdownOption[]>([]);

  useEffect(() => {
    if (!enabled || !sql) return;
    api.post("/api/wms/inbound/executeRawSql", { raw_sql: sql })
      .then((response) => {
        const data = Array.isArray(response.data?.data) ? response.data.data
          : Array.isArray(response.data) ? response.data : [];
        setOptions(data.map((row: Record<string, unknown>) => {
          const get = (key: string) =>
            String(row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()] ?? "");
          return { value: get(valueKey), label: labelKeys.map(get).filter(Boolean).join(" - ") };
        }));
      })
      .catch(() => {});
  }, [sql, enabled]);

  return { options };
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------
const listingTabs = [
  { label: "In Progress", value: "in_progress" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Canceled", value: "cancel" },
];

const jobClassLabels: Record<string, string> = {
  N: "Normal", NP: "Normal HHT/RFID/AR", M: "Manual Putaway", S: "Sales Return",
  SP: "Sales Return HHT/RFID/AR", NI: "Non-Inventory", CP: "Co-Packing",
  MR: "Misc Receipts", IWT: "Inter Warehouse Transfer", CD: "Cross Docking",
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
  name: string; label: string; required?: boolean; type?: string;
  dropdown?: "principal" | "division" | "department" | "port" | "country";
};

const jobFields: JobField[] = [
  { name: "prin_code", label: "Principal Code", required: true, dropdown: "principal" },
  { name: "dept_code", label: "Department Code", dropdown: "department" },
  { name: "div_code", label: "Division Code", dropdown: "division" },
  { name: "job_class", label: "Job Class", required: true },
  { name: "job_type", label: "Job Type", required: true },
  { name: "country_origin", label: "Country Origin", dropdown: "country" },
  { name: "country_destination", label: "Country Destination", dropdown: "country" },
  { name: "port_code", label: "Port Code", dropdown: "port" },
  { name: "destination_port", label: "Destination Port", dropdown: "port" },
  { name: "transport_mode", label: "Transport Mode" },
  { name: "schedule_date", label: "Schedule Date", type: "date" },
  { name: "doc_ref", label: "Doc Ref" },
  { name: "prin_ref2", label: "Principal Ref 2" },
  { name: "description1", label: "Description" },
  { name: "remarks", label: "Remarks" },
];

// ---------------------------------------------------------------------------
// Add form field configs per tab

const shipmentFormFields: FormField[] = [
  { name: "container_no", label: "Container No", required: true },
  { name: "vehicle_no", label: "Vehicle No" },
  { name: "vessel_name", label: "Vessel Name" },
  { name: "voyage_no", label: "Voyage No" },
  { name: "seal_no", label: "Seal No" },
  { name: "po_no", label: "PO No" },
  { name: "bl_no", label: "BL No" },
  { name: "arrival_date", label: "Arrival Date", type: "date" },
  { name: "remarks", label: "Remarks" },
];

// Add a new type to FormField
type FormField = {
  name: string; label: string; required?: boolean; type?: string;
  dropdown?: DropdownOption[];
  lookup?: "product" | "container" | "country" | "manufacturer";
  disabled?: boolean;  // ADD this
};

const packingFormFields: FormField[] = [
  { name: "container_no",    label: "Container No",       required: true,  lookup: "container" },
  { name: "prod_code",       label: "Product / SKU",      required: true,  lookup: "product" },
  { name: "qty_puom",        label: "Quantity (Primary)",  required: true,  type: "number" },
  { name: "qty_luom",        label: "Quantity (Lowest)",   required: true,  type: "number" },
  { name: "quantity",        label: "Total Quantity",      type: "number",  disabled: true },  // auto-calculated
  { name: "batch_no",        label: "Batch No" },
  { name: "lot_no",          label: "Lot No" },
  { name: "po_no",           label: "PO No" },
  { name: "bl_no",           label: "BL No" },
  { name: "doc_ref",         label: "Doc Ref" },
  { name: "mfg_date",        label: "Production Date",    type: "date" },
  { name: "exp_date",        label: "Expiry Date",        type: "date" },
  { name: "country_origin",  label: "Country of Origin",  lookup: "country" },
  { name: "manufacturer",    label: "Manufacturer",       lookup: "manufacturer" },
  { name: "shelf_life_date", label: "Shelf Life (Date)",  type: "date" },
  { name: "shelf_life_days", label: "Shelf Life Days",    type: "number" },
];


const receivingFormFields: FormField[] = [
  { name: "prod_code", label: "Product Code", required: true },
  { name: "qty_arrived", label: "Arrived Qty", required: true, type: "number" },
  { name: "uom", label: "UOM" },
  { name: "batch_no", label: "Batch No" },
  { name: "lot_no", label: "Lot No" },
  { name: "po_no", label: "PO No" },
  { name: "doc_ref", label: "Doc Ref" },
];

const qualityFormFields: FormField[] = [
  { name: "prod_code", label: "Product Code", required: true },
  { name: "clearance", label: "Clearance Status", required: true },
  { name: "remarks", label: "Remarks" },
];

const tallyFormFields: FormField[] = [
  { name: "prod_code", label: "Product Code", required: true },
  { name: "qty_tally", label: "Tally Qty", required: true, type: "number" },
  { name: "uom", label: "UOM" },
  { name: "batch_no", label: "Batch No" },
  { name: "lot_no", label: "Lot No" },
  { name: "container_no", label: "Container No" },
  { name: "po_no", label: "PO No" },
];

const putawayFormFields: FormField[] = [
  { name: "prod_code", label: "Product Code", required: true },
  { name: "site_to", label: "Site To", required: true },
  { name: "location_to", label: "Location To", required: true },
  { name: "qty_confirm", label: "Confirm Qty", required: true, type: "number" },
  { name: "batch_no", label: "Batch No" },
  { name: "lot_no", label: "Lot No" },
];

const manualPutawayFormFields: FormField[] = [
  { name: "prod_code", label: "Product Code", required: true },
  { name: "site_from", label: "Site From", required: true },
  { name: "location_from", label: "Location From", required: true },
  { name: "site_to", label: "Site To", required: true },
  { name: "location_to", label: "Location To", required: true },
  { name: "qty", label: "Quantity", required: true, type: "number" },
  { name: "batch_no", label: "Batch No" },
  { name: "lot_no", label: "Lot No" },
];

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------
export function WmsInboundPage() {
  const location = useLocation();
  const view = parseInboundView(location.pathname);
  return view.jobNo ? (
    <InboundJobDetail jobNo={view.jobNo} tab={view.tab || "shipment_details"} />
  ) : (
    <InboundJobListing />
  );
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------
function InboundJobListing() {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const navigate = useNavigate();

  const [rows, setRows] = useState<WmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("in_progress");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<WmsRow>(makeEmptyJob(companyCode));
  const [saving, setSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<WmsRow | null>(null);
  const [cancelRemarks, setCancelRemarks] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const { options: principalOptions } = useRawSqlDropdown({
    sql: `SELECT PRIN_CODE, PRIN_NAME FROM MS_PRINCIPAL WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY PRIN_NAME`,
    valueKey: "PRIN_CODE", labelKeys: ["PRIN_CODE", "PRIN_NAME"], enabled: !!companyCode,
  });
  const { options: divisionOptions } = useRawSqlDropdown({
    sql: `SELECT DIV_CODE, DIV_NAME FROM MS_HR_DIVISION WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY DIV_NAME`,
    valueKey: "DIV_CODE", labelKeys: ["DIV_CODE", "DIV_NAME"], enabled: !!companyCode,
  });
  const { options: deptOptions } = useRawSqlDropdown({
    sql: `SELECT DEPT_CODE, DEPT_NAME FROM MS_DEPARTMENT WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY DEPT_NAME`,
    valueKey: "DEPT_CODE", labelKeys: ["DEPT_CODE", "DEPT_NAME"], enabled: !!companyCode,
  });
  const { options: portOptions } = useRawSqlDropdown({
    sql: `SELECT PORT_CODE, PORT_NAME FROM MS_PORT ORDER BY PORT_NAME`,
    valueKey: "PORT_CODE", labelKeys: ["PORT_CODE", "PORT_NAME"], enabled: true,
  });
  const { options: countryOptions } = useRawSqlDropdown({
    sql: `SELECT COUNTRY_CODE, COUNTRY_NAME FROM MS_COUNTRY ORDER BY COUNTRY_NAME`,
    valueKey: "COUNTRY_CODE", labelKeys: ["COUNTRY_CODE", "COUNTRY_NAME"], enabled: true,
  });

  const dropdownMap: Record<string, DropdownOption[]> = {
    principal: principalOptions, division: divisionOptions,
    department: deptOptions, port: portOptions, country: countryOptions,
  };

  const loadRows = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const data = await executeWmsInboundSql(
        "SELECT * FROM VW_TI_JOB WHERE JOB_TYPE = 'IMP' ORDER BY JOB_NO DESC",
      );
      setRows(data.map(normalizeRow));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load inbound jobs" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRows(); }, []);

  const filteredRows = useMemo(
    () => rows.filter((row) => filterJobByTab(row, activeTab)),
    [rows, activeTab],
  );

  const columns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      {
        accessorKey: "job_no", header: "Job No", size: 130,
        cell: ({ row }) => (
          <button
            className="font-semibold text-primary hover:underline"
            onClick={() => navigate(`view/${value(row.original, "job_no")}/shipment_details?principal_code=${value(row.original, "prin_code")}`)}
          >
            {value(row.original, "job_no")}
          </button>
        ),
      },
      {
        accessorKey: "job_class", header: "Job Class", size: 180,
        cell: ({ row }) => <JobClassPill code={value(row.original, "job_class")} />,
      },
      {
        accessorKey: "prin_name", header: "Principal Name", size: 240,
        cell: ({ row }) => value(row.original, "prin_name"),
      },
      {
        accessorKey: "job_date", header: "Job Date", size: 120,
        cell: ({ row }) => formatDate(value(row.original, "job_date")),
      },
      ...(activeTab === "confirmed" ? [{
        accessorKey: "confirm_date", header: "Confirm Date", size: 130,
        cell: ({ row }: { row: { original: WmsRow } }) => formatDate(value(row.original, "confirm_date")),
      }] : []),
      ...(activeTab === "cancel" ? [{
        accessorKey: "cancel_date", header: "Cancel Date", size: 130,
        cell: ({ row }: { row: { original: WmsRow } }) => formatDate(value(row.original, "cancel_date")),
      }] : []),
      { accessorKey: "doc_ref", header: "Doc Ref", size: 130, cell: ({ row }) => value(row.original, "doc_ref") },
      { accessorKey: "canceled", header: "Canceled", size: 100, cell: ({ row }) => flagBadge(value(row.original, "canceled")) },
      { accessorKey: "invoiced", header: "Invoiced", size: 100, cell: ({ row }) => flagBadge(value(row.original, "invoiced")) },
      {
        accessorKey: "invoice_date", header: "Invoice Date", size: 130,
        cell: ({ row }) => formatDate(value(row.original, "invoice_date")),
      },
      {
        id: "actions", header: "Actions", size: 120, enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" title="Open job"
              onClick={() => navigate(`view/${value(row.original, "job_no")}/shipment_details?principal_code=${value(row.original, "prin_code")}`)}>
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
    if (missing) { setNotice({ type: "error", message: `${missing.label} is required` }); return; }
    setSaving(true);
    try {
      await postWmsInbound("inboundjob", { ...form, company_code: form.company_code || companyCode, job_type: form.job_type || "IMP" });
      setFormOpen(false);
      setNotice({ type: "success", message: "Inbound job saved successfully" });
      await loadRows();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save inbound job" });
    } finally { setSaving(false); }
  };

  const confirmCancel = async () => {
    if (!cancelTarget || !cancelRemarks.trim()) return;
    setSaving(true);
    try {
      await patchWmsInbound("canceljob", {
        job_no: value(cancelTarget, "job_no"), prin_code: value(cancelTarget, "prin_code"), remarks: cancelRemarks,
      });
      setCancelTarget(null); setCancelRemarks("");
      setNotice({ type: "success", message: "Inbound job cancellation submitted" });
      await loadRows();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to cancel inbound job" });
    } finally { setSaving(false); }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">WMS Inbound</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Inbound Job Listing</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Manage import jobs, shipment progress, receiving, putaway, confirmation, and activity billing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => { setForm(makeEmptyJob(companyCode)); setFormOpen(true); }}>
            <Plus size={15} /> Add Job
          </Button>
        </div>
      </div>

      {notice && <div className={notice.type === "error" ? "alert error" : "alert success"}>{notice.message}</div>}

      <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
        {listingTabs.map((tab) => (
          <Button key={tab.value} size="sm" variant={activeTab === tab.value ? "default" : "outline"}
            onClick={() => setActiveTab(tab.value)}>
            {tab.label}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns} data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length} Jobs`}
        subtitle="Inbound Jobs" searchValue={query} onSearchChange={setQuery}
        searchPlaceholder="Search job, principal, reference..."
        loading={loading} height="calc(100vh - 310px)" minWidth={1380} density="grid"
        enablePagination pageSize={50}
        getRowId={(row, index) => String(value(row, "job_no") || index)}
        rowClassName={(row) =>
          isCanceled(row) ? "bg-red-50/70"
            : hasDate(value(row, "confirm_date")) ? "bg-emerald-50/70"
            : "bg-blue-50/50"
        }
      />

      {/* Add Job Dialog */}
      <Dialog wide open={formOpen} title="Add Inbound Job"
        description="Create an import job using the existing WMS backend flow."
        onClose={() => setFormOpen(false)}>
        <form className="grid gap-2" onSubmit={saveJob}>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
            {jobFields.map((field) => {
              const ddOptions = field.dropdown ? dropdownMap[field.dropdown] : null;
              const isFullRow = field.name === "remarks" || field.name === "description1";
              return (
                <label className={isFullRow ? "field col-span-2 md:col-span-3" : "field"} key={field.name}>
                  <span className="text-xs font-medium text-muted-foreground">
                    {field.label}{field.required && <strong className="text-destructive"> *</strong>}
                  </span>
                  {ddOptions ? (
                    field.dropdown === "port" || field.dropdown === "country" ? (
                      <SearchableSelect
                        value={String(form[field.name] || "")} options={ddOptions}
                        placeholder={`— Select ${field.label} —`} hasValue={!!form[field.name]}
                        onChange={(val) => setForm((cur) => ({ ...cur, [field.name]: val }))}
                        onClear={() => setForm((cur) => ({ ...cur, [field.name]: "" }))}
                      />
                    ) : (
                      <div className="relative">
                        <Select value={String(form[field.name] || "")}
                          onChange={(e) => setForm((cur) => ({ ...cur, [field.name]: e.target.value }))}
                          className={cn("pr-8 transition-all duration-200",
                            form[field.name] ? "border-primary bg-primary/10 font-medium text-primary ring-1 ring-primary/30" : "")}>
                          <option value="">— Select {field.label} —</option>
                          {ddOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </Select>
                        {Boolean(form[field.name]) && (
                          <button type="button"
                            className="absolute right-7 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/30 text-foreground hover:bg-destructive hover:text-white transition-colors"
                            onClick={() => setForm((cur) => ({ ...cur, [field.name]: "" }))}>
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    )
                  ) : field.name === "job_class" ? (
                    <div className="relative">
                      <Select value={String(form[field.name] || "")}
                        onChange={(e) => setForm((cur) => ({ ...cur, [field.name]: e.target.value }))}
                        className={cn("pr-8 transition-all duration-200",
                          form[field.name] ? "border-primary bg-primary/10 font-medium text-primary ring-1 ring-primary/30" : "")}>
                        <option value="">— Select Job Class —</option>
                        {Object.entries(jobClassLabels).map(([code, label]) => (
                          <option value={code} key={code}>{code} - {label}</option>
                        ))}
                      </Select>
                      {Boolean(form[field.name]) && (
                        <button type="button"
                          className="absolute right-7 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/30 text-foreground hover:bg-destructive hover:text-white transition-colors"
                          onClick={() => setForm((cur) => ({ ...cur, [field.name]: "" }))}>
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <Input type={field.type || "text"} value={String(form[field.name] || "")}
                      onChange={(e) => setForm((cur) => ({ ...cur, [field.name]: e.target.value }))} />
                  )}
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}><X size={15} /> Cancel</Button>
            <Button disabled={saving} type="submit"><Save size={15} /> {saving ? "Saving..." : "Save Job"}</Button>
          </div>
        </form>
      </Dialog>

      {/* Cancel Job Dialog */}
      <Dialog open={Boolean(cancelTarget)}
        title={`Cancel Job ${cancelTarget ? value(cancelTarget, "job_no") : ""}`}
        description="Please enter cancellation remarks before submitting."
        compact tone="danger" onClose={() => setCancelTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Close</Button>
            <Button variant="destructive" disabled={saving || !cancelRemarks.trim()} onClick={confirmCancel}>
              Confirm Cancel
            </Button>
          </>
        }>
        <label className="field">
          <span>Cancel Remarks</span>
          <Input value={cancelRemarks} onChange={(event) => setCancelRemarks(event.target.value)} placeholder="Enter reason..." />
        </label>
      </Dialog>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Job Detail
// ---------------------------------------------------------------------------
function InboundJobDetail({ jobNo, tab }: { jobNo: string; tab: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<WmsRow | null>(null);
  const [loading, setLoading] = useState(true);
 const location = useLocation();

   const basePath = location.pathname.split("/").slice(0, -1).join("/");

  const loadJob = async () => {
    setLoading(true);
    try {
      const data = await getWmsInbound<WmsRow>(`job/${encodeURIComponent(jobNo)}`);
      setJob(normalizeRow(data || {}));
    } catch {
      try {
        const fallback = await executeWmsInboundSql(
          `SELECT * FROM VW_TI_JOB WHERE JOB_NO = '${sqlEscape(jobNo)}' AND COMPANY_CODE = '${sqlEscape(user?.company_code || "")}'`,
        );
        setJob(normalizeRow(fallback[0] || { job_no: jobNo }));
      } catch {
        setJob(normalizeRow({ job_no: jobNo }));
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadJob(); }, [jobNo]);

  const availableTabs = getTabsForJob(value(job || {}, "job_class"));
  const activeTab = availableTabs.some((item) => item.value === tab) ? tab : "shipment_details";

  const jobStatus = isCanceled(job || {}) ? "Canceled"
    : hasDate(value(job || {}, "confirm_date")) ? "Confirmed" : "In Progress";

  const statusColor = jobStatus === "Canceled" ? "text-red-600 bg-red-50 border-red-200"
    : jobStatus === "Confirmed" ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : "text-blue-600 bg-blue-50 border-blue-200";

  return (
    <section className="grid gap-3">
      {/* Header */}
{/* Header */}
<div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
  <div className="flex min-w-0 items-center gap-3">
    <Button size="icon" variant="outline" onClick={() => navigate("../..")} title="Back to jobs">
      <ArrowLeft size={16} />
    </Button>

    <div className="min-w-0">
      <p className="eyebrow mb-0.5">Inbound Job</p>
      <h1 className="m-0 truncate text-xl font-semibold leading-tight">{jobNo}</h1>
    </div>

    {/* Divider */}
    <div className="hidden h-8 w-px bg-border sm:block" />

    {/* Principal pill */}
    {job && value(job, "prin_code") && (
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Principal</span>
        <span className="rounded-md border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
          {value(job, "prin_code")}
          {value(job, "prin_name") ? ` · ${value(job, "prin_name")}` : ""}
        </span>
      </div>
    )}

    {/* Job Date pill */}
    {job && value(job, "job_date") && (
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Job Date</span>
        <span className="rounded-md border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
          {formatDate(value(job, "job_date"))}
        </span>
      </div>
    )}

    {/* Divider */}
    <div className="hidden h-8 w-px bg-border sm:block" />

    {/* Job Class pill */}
    {job && <JobClassPill code={value(job, "job_class")} />}

    {/* Status pill */}
    <span className={cn(
      "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold",
      statusColor
    )}>
      {jobStatus}
    </span>
  </div>

  <div className="flex flex-wrap gap-2">
    <Button size="sm" variant="outline" onClick={loadJob}><RefreshCw size={14} /> Refresh</Button>
    <Button size="sm" variant="outline"><Printer size={14} /> Print</Button>
  </div>
</div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto rounded-md border bg-card p-2">
        {availableTabs.map((item) => (
          <Link
            className={item.value === activeTab
              ? "ui-button ui-button-default ui-button-sm whitespace-nowrap"
              : "ui-button ui-button-outline ui-button-sm whitespace-nowrap"}
            key={item.value}
         to={`${basePath}/${item.value}${locationSearchPrincipal(job)}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      <InboundOperationalTab job={job} jobNo={jobNo} tab={activeTab} loadingJob={loading} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Operational Tab — with per-tab Add modal
// ---------------------------------------------------------------------------
function InboundOperationalTab({
  job, jobNo, tab, loadingJob,
}: { job: WmsRow | null; jobNo: string; tab: string; loadingJob: boolean; }) {
  const { user } = useAuth();
  const prinCode = value(job || {}, "prin_code");
  const companyCode = user?.company_code || "";
// ADD after existing useState declarations
const [editOpen, setEditOpen] = useState(false);
const [editForm, setEditForm] = useState<WmsRow>({});
const [editSaving, setEditSaving] = useState(false);
  const [rows, setRows] = useState<WmsRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<WmsRow>({});
  const [saving, setSaving] = useState(false);
  // For Quality Clearance process modal
  const [processOpen, setProcessOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<WmsRow[]>([]);
// ADD alongside the existing notice state:
const [modalNotice, setModalNotice] = useState<string | null>(null);
  const config = getInboundTabConfig(tab);

// REPLACE the getLookupProps function signature and product case:

const getLookupProps = (field: FormField, isEditMode = false) => {
  const formData = isEditMode ? editForm : addForm;
  const setFormData = isEditMode ? setEditForm : setAddForm;

  switch (field.lookup) {
    case "product":
      return {
        valueField: "PROD_CODE",
        displayFields: ["PROD_CODE", "PROD_NAME"],
        columns: [
          { field: "PROD_CODE", header: "Product Code" },
          { field: "PROD_NAME", header: "Product Name" },
          { field: "UOM_CODE",  header: "UOM" },
        ],
        loadOptions: async () => {
          if (tab === "packing_details" && !formData.container_no) {
            throw new Error("Please select a Container No. first before selecting a product.");
          }
          const res = await api.post("/api/wms/inbound/executeRawSql", {
            raw_sql: `SELECT *
                      FROM MS_PRODUCT 
                      WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' 
                      ORDER BY PROD_NAME`,
          });
          return Array.isArray(res.data?.data) ? res.data.data
               : Array.isArray(res.data) ? res.data : [];
        },
        onChange: (val: string, row: Record<string, unknown> | null) => {
          const uppp   = Number(row?.["UPPP"]      ?? row?.["uppp"]      ?? 1);
          const uomCount = Number(row?.["UOM_COUNT"] ?? row?.["uom_count"] ?? 1);
          const pUom   = String(row?.["UOM_CODE"]  ?? row?.["uom_code"]  ?? "");
          const lUom   = String(row?.["L_UOM"]     ?? row?.["l_uom"]     ?? "");

          setFormData((cur) => {
            const qtyPuom = Number(cur.qty_puom ?? 0);
            const qtyLuom = uomCount <= 1 ? 0 : Number(cur.qty_luom ?? 0);
            const quantity = uomCount <= 1
              ? qtyPuom + qtyLuom
              : qtyPuom * uppp + qtyLuom;

            return {
              ...cur,
              prod_code: val,
              // prod_code_display: row ? `${row["PROD_CODE"] ?? ""} - ${row["PROD_NAME"] ?? ""}` : "",
              p_uom: pUom,
              l_uom: lUom,
              uppp,
              uom_count: uomCount,
              qty_luom: uomCount <= 1 ? 0 : cur.qty_luom,
              quantity,
            };
          });
        },
      };

case "container": {
const cacheKey = `wms_containers_${jobNo}_v2`;
  return {
    valueField: "CONTAINER_NO",
    displayFields: ["CONTAINER_NO"],
    columns: [
      { field: "CONTAINER_NO", header: "Container No" },
      { field: "VEHICLE_NO",   header: "Vehicle No" },
      { field: "VESSEL_NAME",  header: "Vessel Name" },
      { field: "SEAL_NO",      header: "Seal No" },
      { field: "PO_NO",        header: "PO No" },   // ← ADD to display column too
    ],
    loadOptions: async () => {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) { try { return JSON.parse(cached); } catch { /* fall through */ } }
      const res = await api.post("/api/wms/inbound/executeRawSql", {
        raw_sql: `SELECT CONTAINER_NO, VEHICLE_NO, VESSEL_NAME, SEAL_NO, PO_NO  
                  FROM TI_CONTAINER 
                  WHERE JOB_NO = '${sqlEscape(jobNo)}' 
                    AND PRIN_CODE = '${sqlEscape(prinCode)}' 
                  ORDER BY CONTAINER_NO`,  // ← PO_NO added here
      });
      const data = Array.isArray(res.data?.data) ? res.data.data
                 : Array.isArray(res.data) ? res.data : [];
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
      return data;
    },
    onChange: (val: string, row: Record<string, unknown> | null) =>
      setFormData((cur) => ({
        ...cur,
        container_no: val,
        po_no: String(row?.["PO_NO"] ?? row?.["po_no"] ?? ""),  // ← auto-set po_no
      })),
  };
}

    case "country":
      return {
        valueField: "COUNTRY_CODE",
        displayFields: ["COUNTRY_CODE", "COUNTRY_NAME"],
        columns: [
          { field: "COUNTRY_CODE", header: "Code" },
          { field: "COUNTRY_NAME", header: "Country" },
        ],
        loadOptions: async () => {
          const res = await api.post("/api/wms/inbound/executeRawSql", {
            raw_sql: `SELECT COUNTRY_CODE, COUNTRY_NAME FROM MS_COUNTRY ORDER BY COUNTRY_NAME`,
          });
          return Array.isArray(res.data?.data) ? res.data.data
               : Array.isArray(res.data) ? res.data : [];
        },
        onChange: (val: string, row: Record<string, unknown> | null) =>
          setFormData((cur) => ({
            ...cur,
            country_origin: val,
            country_origin_display: row ? `${row["COUNTRY_CODE"] ?? ""} - ${row["COUNTRY_NAME"] ?? ""}` : "",
          })),
      };

    case "manufacturer":
      return {
        valueField: "MANU_CODE",
        displayFields: ["MANU_CODE", "MANU_NAME"],
        columns: [
          { field: "MANU_CODE", header: "Code" },
          { field: "MANU_NAME", header: "Manufacturer" },
        ],
        loadOptions: async () => {
          const res = await api.post("/api/wms/inbound/executeRawSql", {
            raw_sql: `SELECT MANU_CODE, MANU_NAME FROM MS_MANUFACTURER 
                      WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY MANU_NAME`,
          });
          return Array.isArray(res.data?.data) ? res.data.data
               : Array.isArray(res.data) ? res.data : [];
        },
        onChange: (val: string, row: Record<string, unknown> | null) =>
          setFormData((cur) => ({
            ...cur,
            manufacturer: val,
            manufacturer_display: row ? `${row["MANU_CODE"] ?? ""} - ${row["MANU_NAME"] ?? ""}` : "",
          })),
      };

    default:
      return null;
  }
};
// Add this helper inside InboundOperationalTab, after getLookupProps
const recalcQuantity = (
  formData: WmsRow,
  field: "qty_puom" | "qty_luom",
  rawValue: string,
): Partial<WmsRow> => {
  const val = rawValue.charAt(0) === "-" ? "" : rawValue;
  const uppp     = Number(formData.uppp     ?? 1);
  const uomCount = Number(formData.uom_count ?? 1);
  const qtyPuom  = field === "qty_puom" ? Number(val) : Number(formData.qty_puom ?? 0);
  const qtyLuom  = field === "qty_luom" ? Number(val) : Number(formData.qty_luom ?? 0);
  const quantity  = uomCount <= 1 ? qtyPuom + qtyLuom : qtyPuom * uppp + qtyLuom;
  return { [field]: val, quantity };
};
  const loadRows = useCallback(async () => {
    if (!config || loadingJob || !prinCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await executeWmsInboundSql(
        config.sql({ companyCode, jobNo, prinCode }),
      );
      setRows(data.map(normalizeRow));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to load ${config?.title}` });
    } finally { setLoading(false); }
  }, [tab, jobNo, prinCode, loadingJob, companyCode]);

  useEffect(() => { void loadRows(); }, [loadRows]);

  // Reset form when opening
  const openAddModal = () => {
    setAddForm({ job_no: jobNo, prin_code: prinCode, company_code: companyCode });
    setAddOpen(true);
  };
// Add this helper just above saveAdd:
const stripUiFields = (form: WmsRow): WmsRow => {
  const {
    uom_count,           // UI-only (controls qty_luom disabled state)
    prod_code_display,   // UI-only (display label)
    country_origin_display,
    manufacturer_display,
    ...payload
  } = form;
  return payload;
};
const saveAdd = async (e: FormEvent) => {
  e.preventDefault();
  if (!config?.addEndpoint) return;
  setModalNotice(null);  // ← clear on each attempt

  if (tab === "packing_details") {
    if (!addForm.container_no) {
      setModalNotice("Container No. is required. Please select a container first.");
      return;
    }
    if (!addForm.prod_code) {
      setModalNotice("Product / SKU is required.");
      return;
    }
    if (!addForm.qty_puom || Number(addForm.qty_puom) <= 0) {
      setModalNotice("Quantity (Primary) is required and must be greater than 0.");
      return;
    }
    if (addForm.qty_luom === undefined || addForm.qty_luom === "") {
      setModalNotice("Quantity (Lowest) is required.");
      return;
    }
  } else {
    const fields = config?.addFields || [];
    const missing = fields.find((f) => f.required && !String(addForm[f.name] || "").trim());
    if (missing) {
      setModalNotice(`${missing.label} is required`);
      return;
    }
  }

  setSaving(true);
  try {
    if (config.addEndpoint === "shipment") {
      sessionStorage.removeItem(`wms_containers_${jobNo}_v2`);
    }
    await postWmsInbound(config.addEndpoint, {
  ...stripUiFields(addForm),   // ← was: ...addForm
      job_no: jobNo,
      prin_code: prinCode,
      company_code: companyCode,
    });
    setAddOpen(false);
    setModalNotice(null);
    setNotice({ type: "success", message: `${config.title} added successfully` });
    await loadRows();
  } catch (error) {
    setModalNotice(error instanceof Error ? error.message : `Unable to add ${config?.title}`);
  } finally {
    setSaving(false);
  }
};

const saveEdit = async (e: FormEvent) => {
  e.preventDefault();
  if (tab !== "packing_details") return;
  setModalNotice(null);

  if (!editForm.container_no) { setModalNotice("Container No. is required."); return; }
  if (!editForm.prod_code)    { setModalNotice("Product / SKU is required."); return; }
  if (!editForm.qty_puom || Number(editForm.qty_puom) <= 0) {
    setModalNotice("Quantity (Primary) is required.");
    return;
  }

  setEditSaving(true);
  try {
    await patchWmsInbound("packing_details", {   // ← also fix endpoint here
  ...stripUiFields(editForm),  // ← was: ...editForm
      job_no: jobNo,
      prin_code: prinCode,
      company_code: companyCode,
      packdet_no: String(editForm.packdet_no || ""),
    });
    setEditOpen(false);
    setModalNotice(null);
    setNotice({ type: "success", message: "Packing detail updated successfully" });
    await loadRows();
  } catch (error) {
    setModalNotice(error instanceof Error ? error.message : "Unable to update packing detail");
  } finally {
    setEditSaving(false);
  }
};
  if (!config) return (
    <Card><CardContent className="p-6 text-sm text-muted-foreground">This tab is not configured yet.</CardContent></Card>
  );

  // Action button per tab
  const getActionButton = () => {
    switch (tab) {
      case "quality_clearance":
        return (
          <Button size="sm" variant="outline"
            onClick={() => setProcessOpen(true)}
            disabled={selectedRows.length === 0}>
            <Settings2 size={14} /> Process Clearance
          </Button>
        );
      case "putway_details":
        return (
          <Button size="sm" variant="outline"
            onClick={() => setProcessOpen(true)}
            disabled={selectedRows.length === 0}>
            <Truck size={14} /> Process Putaway
          </Button>
        );
      case "job_confirmation":
        return (
          <Button size="sm" variant="outline"
            onClick={() => setProcessOpen(true)}
            disabled={selectedRows.length === 0}>
            <CheckCircle2 size={14} /> Process Confirm Selected
          </Button>
        );
      case "receiving_details":
        return (
          <Button size="sm" variant="outline" onClick={openAddModal}>
            <PackageCheck size={14} /> Add Receiving
          </Button>
        );
      default:
        if (config.addFields && config.addEndpoint) {
          return (
            <Button size="sm" variant="outline" onClick={openAddModal}>
              <Plus size={14} /> {config.addLabel || `Add ${config.title}`}
            </Button>
          );
        }
        return null;
    }
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {getActionButton()}
      <Button size="sm" variant="outline" onClick={loadRows}><RefreshCw size={14} /> Refresh</Button>
    </div>
  );

const columns = makeColumns(
  config.columns,
  tab === "quality_clearance" || tab === "putway_details" || tab === "job_confirmation",
tab === "packing_details"
  ? (row) => {
      setEditForm({
        ...row,
        // Ensure these are numbers so recalcQuantity works correctly
        uom_count: Number(row.uom_count ?? 1),
        uppp: Number(row.uppp ?? 1),
        qty_puom: Number(row.qty_puom ?? 0),
        qty_luom: Number(row.qty_luom ?? 0),
        quantity: Number(row.quantity ?? 0),
      });
      setEditOpen(true);
    }
  : undefined,
);
  return (
    <section className="grid gap-3">
      {notice && <div className={notice.type === "error" ? "alert error" : "alert success"}>{notice.message}</div>}

      <DataTable
        columns={columns} data={rows}
        title={loading ? "Loading" : `${rows.length} Rows`}
        subtitle={config.title} searchValue={query} onSearchChange={setQuery}
        searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
        loading={loading || loadingJob} height="calc(100vh - 365px)"
        minWidth={config.minWidth} density="grid" enablePagination pageSize={75}
        toolbar={toolbar}
        getRowId={(row, index) =>
          `${tab}_${value(row, "packdet_no") || value(row, "container_no") || value(row, "key_number") || index}`
        }
        onRowSelectionChange={
          (tab === "quality_clearance" || tab === "putway_details" || tab === "job_confirmation")
            ? (sel) => setSelectedRows(sel)
            : undefined
        }
      />

{/* Add Modal */}
<Dialog
  wide
  open={addOpen}
  title={config.addLabel || `Add ${config.title}`}
  description={`Fill in the details to add a new ${config.title.toLowerCase()} record.`}
  onClose={() => setAddOpen(false)}
>
  <form className="grid gap-2" onSubmit={saveAdd}>
        {modalNotice && (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {modalNotice}
      </div>
    )}
    <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
      {(config.addFields ?? []).map((field) => (
        <label
          key={field.name}
          className={
            field.name === "remarks" || field.name === "description1"
              ? "field col-span-2 md:col-span-3"
              : "field"
          }
        >
          <span className="text-xs font-medium text-muted-foreground">
            {field.label}
            {field.required && <strong className="text-destructive"> *</strong>}
          </span>

{field.lookup ? (() => {
  const lp = getLookupProps(field);
  if (!lp) return null;
  return (
    <LookupField
      label={field.label}
      compact
      value={String(addForm[field.name] || "")}
      displayValue={String(addForm[`${field.name}_display`] || "")}
      valueField={lp.valueField}
      displayFields={lp.displayFields}
      columns={lp.columns}
      loadOptions={lp.loadOptions}
      onChange={lp.onChange}
    />
  );
})() : field.dropdown && field.dropdown.length > 0 ? (
  <Select
    value={String(addForm[field.name] || "")}
    onChange={(e) => setAddForm((cur) => ({ ...cur, [field.name]: e.target.value }))}
  >
    <option value="">— Select {field.label} —</option>
    {field.dropdown.map((opt) => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </Select>
// REPLACE the Input render at the bottom of the Add Modal's field map:
) : field.name === "qty_puom" ? (
  <Input
    type="number"
    min="0"
    value={String(addForm.qty_puom ?? "")}
    onChange={(e) =>
      setAddForm((cur) => ({ ...cur, ...recalcQuantity(cur, "qty_puom", e.target.value) }))
    }
  />
) : field.name === "qty_luom" ? (
  <Input
    type="number"
    min="0"
    disabled={Number(addForm.uom_count ?? 1) <= 1}
    value={String(addForm.qty_luom ?? "")}
    onChange={(e) =>
      setAddForm((cur) => ({ ...cur, ...recalcQuantity(cur, "qty_luom", e.target.value) }))
    }
  />
) : field.disabled || field.name === "quantity" ? (
  <Input
    type="number"
    disabled
    value={String(addForm.quantity ?? 0)}
    className="bg-muted text-muted-foreground"
  />
) : (
  <Input
    type={field.type || "text"}
    value={String(addForm[field.name] || "")}
    onChange={(e) => setAddForm((cur) => ({ ...cur, [field.name]: e.target.value }))}
  />
)
}
        </label>
      ))}
    </div>
    <div className="flex justify-end gap-2 pt-1">
      <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
        <X size={15} /> Cancel
      </Button>
      <Button disabled={saving} type="submit">
        <Save size={15} /> {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  </form>
</Dialog>
{/* Edit Packing Modal */}
{tab === "packing_details" && (
  <Dialog
    wide
    open={editOpen}
    title="Edit Packing Details"
    description="Update the packing detail record."
    onClose={() => { setEditOpen(false); setModalNotice(null); }}  // ← clear on close
  >
    <form className="grid gap-2" onSubmit={saveEdit}>
            {modalNotice && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {modalNotice}
        </div>
      )}

      <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
        {(config.addFields ?? []).map((field) => (
          <label
            key={field.name}
            className={
              field.name === "remarks" || field.name === "description1"
                ? "field col-span-2 md:col-span-3"
                : "field"
            }
          >
            <span className="text-xs font-medium text-muted-foreground">
              {field.label}
              {field.required && <strong className="text-destructive"> *</strong>}
            </span>

            {field.lookup ? (() => {
const lp = getLookupProps(field, true);
              if (!lp) return null;
              return (
                <LookupField
                  label={field.label}
                  compact
                  value={String(editForm[field.name] || "")}
                  displayValue={String(editForm[`${field.name}_display`] || "")}
                  valueField={lp.valueField}
                  displayFields={lp.displayFields}
                  columns={lp.columns}
                  loadOptions={lp.loadOptions}
                  onChange={(val, row) => {
                    // Use editForm setter instead of addForm
                    const syntheticEvent = { val, row };
                    if (field.name === "prod_code") {
                      setEditForm((cur) => ({
                        ...cur,
                        prod_code: val,
                        // prod_code_display: row
                        //   ? `${row["PROD_CODE"] ?? ""} - ${row["PROD_NAME"] ?? ""}` : "",
                        uom: row ? String(row["UOM_CODE"] ?? cur.uom ?? "") : String(cur.uom ?? ""),
                      }));
                    } else if (field.name === "container_no") {
                      setEditForm((cur) => ({ ...cur, container_no: val }));
                    } else if (field.name === "country_origin") {
                      setEditForm((cur) => ({
                        ...cur,
                        country_origin: val,
                        country_origin_display: row
                          ? `${row["COUNTRY_CODE"] ?? ""} - ${row["COUNTRY_NAME"] ?? ""}` : "",
                      }));
                    } else if (field.name === "manufacturer") {
                      setEditForm((cur) => ({
                        ...cur,
                        manufacturer: val,
                        manufacturer_display: row
                          ? `${row["MANU_CODE"] ?? ""} - ${row["MANU_NAME"] ?? ""}` : "",
                      }));
                    }
                  }}
                />
              );
            })() : field.dropdown && field.dropdown.length > 0 ? (
              <Select
                value={String(editForm[field.name] || "")}
                onChange={(e) => setEditForm((cur) => ({ ...cur, [field.name]: e.target.value }))}
              >
                <option value="">— Select {field.label} —</option>
                {field.dropdown.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
          ) : field.name === "qty_puom" ? (
  <Input
    type="number"
    min="0"
    value={String(editForm.qty_puom ?? "")}
    onChange={(e) =>
      setEditForm((cur) => ({ ...cur, ...recalcQuantity(cur, "qty_puom", e.target.value) }))
    }
  />
) : field.name === "qty_luom" ? (
  <Input
    type="number"
    min="0"
    disabled={Number(editForm.uom_count ?? 1) <= 1}
    value={String(editForm.qty_luom ?? "")}
    onChange={(e) =>
      setEditForm((cur) => ({ ...cur, ...recalcQuantity(cur, "qty_luom", e.target.value) }))
    }
  />
) : field.disabled || field.name === "quantity" ? (
  <Input
    type="number"
    disabled
    value={String(editForm.quantity ?? 0)}
    className="bg-muted text-muted-foreground"
  />
) : (
  <Input
    type={field.type || "text"}
    value={String(editForm[field.name] || "")}
    onChange={(e) => setEditForm((cur) => ({ ...cur, [field.name]: e.target.value }))}
  />
)

            }
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
          <X size={15} /> Cancel
        </Button>
        <Button disabled={editSaving} type="submit">
          <Save size={15} /> {editSaving ? "Saving..." : "Update"}
        </Button>
      </div>
    </form>
  </Dialog>
)}
      {/* Process Modal (Quality Clearance / Putaway / Confirmation) */}
      <Dialog open={processOpen} compact
        title={
          tab === "quality_clearance" ? "Process Quality Clearance"
          : tab === "putway_details" ? "Process Putaway"
          : "Process Job Confirmation"
        }
        description={`Processing ${selectedRows.length} selected row(s)`}
        onClose={() => setProcessOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setProcessOpen(false)}>Close</Button>
            <Button onClick={async () => {
              setSaving(true);
              try {
                // call the appropriate process API
                const endpoint = tab === "quality_clearance" ? "processquality"
                  : tab === "putway_details" ? "processputaway"
                  : "processjobconfirm";
                await postWmsInbound(endpoint, {
                  job_no: jobNo, prin_code: prinCode, company_code: companyCode,
                  rows: selectedRows.map((r) => value(r, "packdet_no")),
                });
                setProcessOpen(false);
                setSelectedRows([]);
                setNotice({ type: "success", message: "Processed successfully" });
                await loadRows();
              } catch (error) {
                setNotice({ type: "error", message: error instanceof Error ? error.message : "Process failed" });
              } finally { setSaving(false); }
            }} disabled={saving}>
              <CheckCircle2 size={15} /> {saving ? "Processing..." : "Confirm"}
            </Button>
          </>
        }>
        <div className="text-sm text-muted-foreground">
          {selectedRows.length === 0
            ? "No rows selected. Close and select rows from the table."
            : `You are about to process ${selectedRows.length} row(s). This action cannot be undone.`}
        </div>
      </Dialog>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------
function getInboundTabConfig(tab: string) {
  const packSql = ({ companyCode, jobNo, prinCode }: { companyCode: string; jobNo: string; prinCode: string }) =>
    `SELECT * FROM VW_WM_INB_PACKDET_DETS WHERE company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`;

  const configs: Record<string, {
    title: string; minWidth: number; addLabel?: string; addEndpoint?: string;
    addFields?: FormField[];
    columns: { key: string; label: string; size?: number }[];
    sql: (args: { companyCode: string; jobNo: string; prinCode: string }) => string;
  }> = {
    shipment_details: {
      title: "Shipment Details", minWidth: 1060,
      addLabel: "Add Shipment", addEndpoint: "shipment", addFields: shipmentFormFields,
      sql: ({ jobNo, prinCode }) =>
        `SELECT * FROM TI_CONTAINER WHERE PRIN_CODE = '${sqlEscape(prinCode)}' AND JOB_NO = '${sqlEscape(jobNo)}'`,
      columns: [
        { key: "container_no", label: "Container No", size: 150 },
        { key: "vehicle_no", label: "Vehicle No", size: 130 },
        { key: "vessel_name", label: "Vessel Name", size: 150 },
        { key: "voyage_no", label: "Voyage No", size: 130 },
        { key: "seal_no", label: "Seal No", size: 130 },
        { key: "po_no", label: "PO No", size: 130 },
        { key: "bl_no", label: "BL No", size: 130 },
        { key: "arrival_date", label: "Arrival Date", size: 130 },
      ],
    },
    packing_details: {
      title: "Packing Details", minWidth: 1280,
      addLabel: "Add Packing Details", addEndpoint: "packing_details", addFields: packingFormFields,
      sql: packSql, columns: packingColumns(),
    },
    receiving_details: {
      title: "Receiving Details", minWidth: 1320,
      addLabel: "Add Receiving", addEndpoint: "receiving", addFields: receivingFormFields,
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
    },
    quality_clearance: {
      title: "Quality Clearance", minWidth: 1200,
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
    },
    tally_details: {
      title: "Tally Details", minWidth: 1260,
      addLabel: "Add Tally", addEndpoint: "tally", addFields: tallyFormFields,
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
    },
    putway_details: {
      title: "Putaway Details", minWidth: 1280,
      addLabel: "Process Putaway", addEndpoint: "putaway", addFields: putawayFormFields,
      sql: ({ companyCode, jobNo, prinCode }) =>
        `SELECT * FROM VW_WM_INB_TT_BATCH_DETS WHERE company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`,
      columns: confirmationColumns(),
    },
    putway_manual: {
      title: "Putaway Manual", minWidth: 1280,
      addLabel: "Add Manual Putaway", addEndpoint: "manualputaway", addFields: manualPutawayFormFields,
      sql: ({ companyCode, jobNo, prinCode }) =>
        `SELECT * FROM VW_WM_INB_TT_BATCH_DETS WHERE company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`,
      columns: confirmationColumns(),
    },
    putway_hht: {
      title: "Putaway HHT/RFID/AR", minWidth: 1280,
      addLabel: "Process HHT Putaway", addEndpoint: "hhtputaway", addFields: putawayFormFields,
      sql: ({ companyCode, jobNo, prinCode }) =>
        `SELECT * FROM VW_WM_INB_TT_BATCH_DETS WHERE company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`,
      columns: confirmationColumns(),
    },
    job_confirmation: {
      title: "Job Confirmation", minWidth: 1380,
      sql: ({ companyCode, jobNo, prinCode }) =>
        `SELECT * FROM VW_WM_INB_TT_BATCH_DETS WHERE confirmed = 'N' AND company_code = '${sqlEscape(companyCode)}' AND job_no = '${sqlEscape(jobNo)}' AND prin_code = '${sqlEscape(prinCode)}' ORDER BY updated_at`,
      columns: confirmationColumns(),
    },
    activity_billing: {
      title: "Activity Billing", minWidth: 1180,
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
  if (jobClass === "M")
    return detailTabs.filter((tab) =>
      ["shipment_details", "putway_manual", "job_confirmation", "activity_billing"].includes(tab.value));
  if (jobClass === "NP")
    return detailTabs.filter((tab) =>
      ["shipment_details", "packing_details", "quality_clearance", "tally_details", "putway_hht", "job_confirmation", "activity_billing"].includes(tab.value));
  if (jobClass === "N")
    return detailTabs.filter((tab) =>
      ["shipment_details", "packing_details", "receiving_details", "quality_clearance", "putway_details", "job_confirmation", "activity_billing"].includes(tab.value));
  return detailTabs;
}

// ---------------------------------------------------------------------------
// Column factory — optional checkbox column for selectable tabs
// ---------------------------------------------------------------------------
function makeColumns(
  columns: { key: string; label: string; size?: number }[],
  selectable = false,
  onEdit?: (row: WmsRow) => void,  // ADD this parameter
): ColumnDef<WmsRow>[] {
  const cols: ColumnDef<WmsRow>[] = columns.map((col) => ({
    accessorKey: col.key,
    header: col.label,
    size: col.size || 140,
    cell: ({ row }) => formatCellValue(row.original, col.key),
  }));

  // ADD edit actions column when onEdit is provided
  if (onEdit) {
    cols.push({
      id: "actions",
      header: "",
      size: 60,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <button
          className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          onClick={() => onEdit(row.original)}
        >
          Edit
        </button>
      ),
    });
  }

  if (selectable) {
    cols.unshift({
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          className="rounded border-input"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      size: 40,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="rounded border-input"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
    });
  }

  return cols;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseInboundView(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const viewIndex = parts.findIndex((p) => p.toLowerCase() === "view");
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
    company_code: companyCode || "", job_type: "IMP", job_class: "N",
    transport_mode: "S", schedule_date: new Date().toISOString().slice(0, 10),
  };
}

function JobClassPill({ code }: { code: string }) {
  const label = jobClassLabels[code] || code || "N/A";
  return (
    <span className="inline-flex max-w-[170px] items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
      {label}
    </span>
  );
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
  Object.entries(row || {}).forEach(([key, v]) => { normalized[key.toLowerCase()] = v; });
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