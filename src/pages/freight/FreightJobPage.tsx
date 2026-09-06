import type { ColumnDef } from "@tanstack/react-table";
import { createContext, FormEvent, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Ban,
  BriefcaseBusiness,
  Check,
  Edit2,
  FileText,
  MapPinned,
  Plane,
  Plus,
  RefreshCw,
  Save,
  Ship,
  Truck,
} from "lucide-react";
import { api } from "../../api/client";
import { freightSelect, freightTaxCategories } from "../../api/freight";
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

type JobForm = {
  company_code: string;
  prin_code: string;
  prin_name: string;
  job_no: string;
  job_date: string;
  job_type: string;
  job_class: string;
  transport_mode: string;
  dept_code: string;
  dept_name: string;
  div_code: string;
  div_name: string;
  job_category: string;
  job_category_name: string;
  member_type: string;
  member_type_name: string;
  sale_type: string;
  tx_cat_code: string;
  tx_cat_name: string;
  quotation_ref: string;
  doc_ref: string;
  doc_ref2: string;
  hawb: string;
  port_code: string;
  destination_port: string;
  place_receipt: string;
  place_delivery: string;
  vessel_name: string;
  feeder_vessel_name: string;
  voyage_no: string;
  carrier: string;
  driver_ref: string;
  driver_remarks: string;
  forwarder_code: string;
  forwarder_name: string;
  eta: string;
  ata: string;
  etd: string;
  schedule_date: string;
  job_start_date: string;
  transit_time: string;
  payment_terms: string;
  payableat: string;
  curr_code: string;
  ex_rate: string;
  frieght_value: string;
  insurance_value: string;
  no_of_original_bl: string;
  cust_code: string;
  broker_code: string;
  prin_ref1: string;
  prin_ref2: string;
  description1: string;
  description2: string;
  salesman_code: string;
  salesman_name: string;
  be_no: string;
  be_date: string;
  be_deposits: string;
  be_dep_amount: string;
  country_origin: string;
  country_destination: string;
  custom_recno: string;
  ref_customs: string;
  ref_customs_date: string;
  ref_jobno: string;
  combined_jobno: string;
  reexport: string;
  job_flag: string;
  confirmed: string;
  confirm_date: string;
  completed: string;
  complete_date: string;
  invoiced: string;
  invoice_date: string;
  packdet: string;
  packdet_date: string;
  remarks: string;
  dec_no: string;
  dec_date: string;
  delivered_on: string;
  picked_date: string;
  clearance_date: string;
  letter_undertaking: string;
  contr_deposit: string;
  contr_deposit_amt: string;
  health_status: string;
  port_code_name: string;
  destination_port_name: string;
  vessel_display_name: string;
  canceled: string;
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

const JobEditContext = createContext(true);

function isTruthyFlag(value: string | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "Y" || normalized === "YES" || normalized === "1" || normalized === "TRUE";
}

function isJobCancelLocked(job: JobForm) {
  return Boolean(
    isTruthyFlag(job.confirmed) ||
    isTruthyFlag(job.invoiced) ||
    isTruthyFlag(job.completed) ||
    job.confirm_date ||
    job.invoice_date ||
    job.complete_date
  );
}

function isJobEditLocked(job: JobForm) {
  return Boolean(
    job.canceled === "Y" ||
    isTruthyFlag(job.invoiced) ||
    isTruthyFlag(job.completed) ||
    job.invoice_date ||
    job.complete_date
  );
}

function getJobCancelLockMessage(job: JobForm) {
  if (isTruthyFlag(job.invoiced) || job.invoice_date) return "Invoiced jobs cannot be cancelled.";
  if (isTruthyFlag(job.completed) || job.complete_date) return "Completed jobs cannot be cancelled.";
  if (isTruthyFlag(job.confirmed) || job.confirm_date) return "Confirmed jobs cannot be cancelled.";
  return "This job cannot be cancelled.";
}

export function FreightJobPage({
  target,
  initialJob,
  startMode = "list",
  onEmbeddedActionsChange,
  onEmbeddedList,
}: {
  target?: FreightWorkspaceTarget;
  initialJob?: LookupRow | null;
  startMode?: ViewMode;
  onEmbeddedActionsChange?: (actions: ReactNode | null) => void;
  onEmbeddedList?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const userId = String(userRecord.user_id || userRecord.USER_ID || userRecord.loginid || userRecord.LOGINID || "");
  const modeKey = (target?.mode || "air") as keyof typeof modeMap;
  const directionKey = (target?.direction || "import") as keyof typeof directionMap;
  const mode = modeMap[modeKey];
  const direction = directionMap[directionKey];
  const Icon = mode.icon;
  const isReexport = direction.code === "IRE";
  const isExportLike = direction.code === "EXP" || isReexport;

  const [view, setView] = useState<ViewMode>(startMode);
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [job, setJob] = useState<JobForm>(() => emptyJob(companyCode, userId, mode.code, direction.code));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [editing, setEditing] = useState(false);
  const embeddedInWorkspace = Boolean(onEmbeddedActionsChange);

  const notify = useCallback((next: Exclude<Notice, null>) => {
    setNotice(next);
    if (next.type === "success") toast.success(next.text);
    else toast.error(next.text);
  }, [toast]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const isCanceled = job.canceled === "Y";
  const isCancelLocked = isJobCancelLocked(job);
  const isEditLocked = isJobEditLocked(job);
  const cancelLockMessage = getJobCancelLockMessage(job);
  const editLockMessage = isCanceled ? "Cancelled job cannot be edited." : "Invoiced or completed job cannot be edited.";
  const embeddedFormId = "freight-job-embedded-form";

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
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to load freight jobs." });
    } finally {
      setLoading(false);
    }
  }, [companyCode, direction.code, mode.code, notify, query]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    setJob(emptyJob(companyCode, userId, mode.code, direction.code));
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
    { accessorKey: "vessel_name", header: mode.code === "R" ? "Transporter" : mode.code === "A" ? "Airline" : "Vessel", size: 150 },
    { accessorKey: "canceled", header: "Status", size: 90, cell: ({ row }) => lookupText(row.original, "canceled") === "Y" ? <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Cancelled</span> : <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Open</span> },
    { id: "actions", header: "Actions", size: 70, cell: ({ row }) => <Button type="button" size="icon" variant="ghost" title="Edit job" onClick={() => openJob(row.original)}><Edit2 size={14} /></Button> },
  ], [mode.code]);

  const openAdd = () => {
    setJob(emptyJob(companyCode, userId, mode.code, direction.code));
    setNotice(null);
    setEditing(true);
    setView("editor");
  };

  const openJob = async (row: LookupRow) => {
    const jobNo = lookupText(row, "job_no");
    const prinCode = lookupText(row, "prin_code");
    if (!jobNo || !prinCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: { header?: LookupRow } }>("/api/freight/job/get", {
        company_code: companyCode,
        prin_code: prinCode,
        job_no: jobNo,
      });
      setJob(toJobForm(normalizeLookupRow(response.data.data?.header || row), companyCode, userId, mode.code, direction.code));
      setEditing(false);
      setView("editor");
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to open freight job." });
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
    setEditing(true);
    setView("editor");
  }, [initialJob, startMode]);

  useEffect(() => {
    if (isEditLocked && editing) setEditing(false);
  }, [editing, isEditLocked]);

  const saveJob = async (event: FormEvent) => {
    event.preventDefault();
    if (isEditLocked) {
      notify({ type: "error", text: editLockMessage });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: { job_no?: string }; message?: string }>("/api/freight/job/save", { job });
      notify({ type: "success", text: response.data.message || "Freight job saved." });
      setJob((current) => ({ ...current, job_no: response.data.data?.job_no || current.job_no }));
      setEditing(false);
      await loadRows();
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to save freight job." });
    } finally {
      setSaving(false);
    }
  };

  const cancelJob = async () => {
    if (!job.job_no) return;
    if (isCancelLocked) {
      notify({ type: "error", text: cancelLockMessage });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await api.post("/api/freight/job/cancel", { company_code: companyCode, prin_code: job.prin_code, job_no: job.job_no, cancelled_by: userId, cancel_remarks: job.remarks });
      notify({ type: "success", text: `Job ${job.job_no} cancelled.` });
      await loadRows();
      setView("list");
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to cancel freight job." });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!embeddedInWorkspace || !onEmbeddedActionsChange || view !== "editor") {
      onEmbeddedActionsChange?.(null);
      return undefined;
    }

    onEmbeddedActionsChange(
      <div className="freight-job-inline-actions freight-job-inline-actions-header freight-job-commandbar">
        {notice && <NoticeChip notice={notice} />}
        <Button type="button" size="sm" variant="outline" onClick={() => (onEmbeddedList ? onEmbeddedList() : setView("list"))}>
          <ArrowLeft size={14} /> List
        </Button>
        {!editing && !isEditLocked && (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Edit2 size={14} /> Edit
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={cancelJob}
          disabled={saving || !job.job_no || isCanceled || isCancelLocked}
          title={isCancelLocked ? cancelLockMessage : "Cancel job"}
        >
          <Ban size={14} /> Cancel
        </Button>
        {editing && (
          <Button type="submit" size="sm" disabled={saving || isEditLocked} form={embeddedFormId}>
            <Save size={14} /> Save
          </Button>
        )}
        <span className={`freight-job-mode-badge ${editing ? "editing" : "viewing"}`}>{editing ? "Edit" : "View"}</span>
      </div>
    );

    return () => onEmbeddedActionsChange(null);
  }, [
    cancelLockMessage,
    embeddedInWorkspace,
    editing,
    isCancelLocked,
    isCanceled,
    isEditLocked,
    job.job_no,
    notice,
    onEmbeddedActionsChange,
    onEmbeddedList,
    saving,
    view,
  ]);

  const copyQuotationToJob = async (quotationNr: string, row: LookupRow | null) => {
    setJob((current) => ({
      ...current,
      quotation_ref: quotationNr,
      prin_code: row ? lookupText(row, "PRIN_CODE") || current.prin_code : current.prin_code,
    }));
    if (!quotationNr) return;

    try {
      const prinCode = row ? lookupText(row, "PRIN_CODE") : job.prin_code;
      const response = await api.post<{ success?: boolean; data?: { header?: LookupRow; details?: LookupRow[] } }>("/api/freight/quotation/get", {
        company_code: companyCode,
        prin_code: prinCode,
        quotation_nr: quotationNr,
      });
      const quotation = normalizeLookupRow(response.data.data?.header || {});
      setJob((current) => toJobFromQuotation(quotation, current, quotationNr));
      notify({ type: "success", text: `Quotation ${quotationNr} copied to job draft.` });
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to copy quotation details." });
    }
  };

  if (view === "list") {
    return (
    <section className="freight-list-screen grid gap-3">
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
    <form id={embeddedInWorkspace ? embeddedFormId : undefined} className="freight-document-form" onSubmit={saveJob}>
      {!embeddedInWorkspace && <Header title={`${mode.label} ${direction.label} Job`} subtitle={job.job_no || "New job"} icon={Icon}>
        {notice && <NoticeChip notice={notice} />}
        <Button type="button" size="sm" variant="outline" onClick={() => setView("list")}><ArrowLeft size={14} />List</Button>
        {!editing && !isEditLocked && <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}><Edit2 size={14} />Edit</Button>}
        <Button type="button" size="sm" variant="outline" onClick={cancelJob} disabled={saving || !job.job_no || isCanceled || isCancelLocked} title={isCancelLocked ? cancelLockMessage : "Cancel job"}><Ban size={14} />Cancel</Button>
        {editing && <Button type="submit" size="sm" disabled={saving || isEditLocked}><Save size={14} />Save</Button>}
      </Header>}
      <div className="freight-job-editor-shell">
        <fieldset disabled={isEditLocked || !editing} className={`freight-ui-standard freight-document-paper freight-shipment-paper ${editing ? "is-editing" : "is-viewing"}`}>
          <JobEditContext.Provider value={editing && !isEditLocked}>
          {/* <div className="freight-shipment-hero">
            <div className="freight-shipment-hero-item">
              <span>Booking Ref / Job No</span>
              <strong>{job.job_no || "New Job"}</strong>
            </div>
            <div className="freight-shipment-hero-item">
              <span>{mode.code === "A" ? "HAWB Number" : "House / BL Number"}</span>
              {editing && !isEditLocked ? (
                <Input className="freight-shipment-hero-input" value={job.hawb} onChange={(event) => setJobField(setJob, "hawb", event.target.value)} />
              ) : (
                <strong>{job.hawb || job.doc_ref || "-"}</strong>
              )}
            </div>
          </div> */}
          <div className="freight-shipment-quickfacts">
            <DisplayField label="Shipment Date" value={toDisplayDate(job.job_date)} />
            <DisplayField label="Shipment Type" value={direction.label} />
            <DisplayField label="Transport Mode" value={`${mode.label} Freight`} />
            <DisplayField label="From Quote" value={job.quotation_ref || "-"} />
            <DisplayField label="Sales Rep" value={job.salesman_code || "-"} />
            <DisplayField label="Principal" value={job.prin_code || "-"} />
          </div>
          <div className="freight-job-section-grid">
          <Panel className="lg:col-span-12" icon={BriefcaseBusiness} title="Job Identity" meta={`${job.job_no || "Auto"} / ${mode.label} / ${direction.label}`}>
            <div className="freight-job-field-grid freight-job-field-grid-8">
              {/* <ReadOnlyField label="Job No" value={job.job_no || "Auto"} /> */}
              <DateField label="Job Date" value={job.job_date} onChange={(value) => setJobField(setJob, "job_date", value)} />
              {/* <Lookup label="Principal" value={job.prin_code} valueField="PRIN_CODE" displayFields={["PRIN_CODE", "PRIN_NAME"]} columns={[{ field: "PRIN_CODE", header: "Code" }, { field: "PRIN_NAME", header: "Principal" }]} loadOptions={(search) => lookup("freight_principal", companyCode, "NULL", "NULL", search)} onChange={(value) => setJobField(setJob, "prin_code", value, )} required /> */}
              <Lookup
                label="Principal"
                value={job.prin_code}
                displayValue={job.prin_name}
                valueField="PRIN_CODE"
                displayFields={["PRIN_CODE", "PRIN_NAME"]}
                columns={[{ field: "PRIN_CODE", header: "Code" }, { field: "PRIN_NAME", header: "Principal" }]}
                loadOptions={(search) => lookup("freight_principal", companyCode, "NULL", "NULL", search)}
                onChange={(value, row) =>
                setJob((current) => ({
                   ...current,
                   prin_code: value,
                   quotation_ref: current.prin_code !== value ? "" : current.quotation_ref,
                   div_code: lookupText(row || undefined, "DIV_CODE") || current.div_code,
                  }))
                }
                required
              />
              <Lookup label="Department" value={job.dept_code} displayValue={job.dept_name} valueField="DEPT_CODE" displayFields={["DEPT_CODE", "DEPT_NAME"]} columns={[{ field: "DEPT_CODE", header: "Code" }, { field: "DEPT_NAME", header: "Department" }, { field: "DIV_CODE", header: "Div" }]} loadOptions={(search) => lookup("freight_department", companyCode, "NULL", "NULL", search)} onChange={(value, row) => setJob((current) => ({ ...current, dept_code: value, div_code: lookupText(row || undefined, "DIV_CODE") || current.div_code }))} required/>
              <Lookup label="Division" value={job.div_code} displayValue={job.div_name} valueField="DIV_CODE" displayFields={["DIV_CODE", "DIV_NAME"]} columns={[{ field: "DIV_CODE", header: "Code" }, { field: "DIV_NAME", header: "Division" }]} loadOptions={(search) => lookup("freight_division", companyCode, "NULL", "NULL", search)} onChange={(value) => setJob((current) => ({ ...current, div_code: value, tx_cat_code: current.div_code === value ? current.tx_cat_code : "", tx_cat_name: current.div_code === value ? current.tx_cat_name : "" }))} required />
              <Lookup label="Job Category" value={job.job_category} displayValue={job.job_category_name} valueField="JOB_CATEGORY" displayFields={["JOB_CATEGORY", "JOB_CATEGORY_NAME"]} columns={[{ field: "JOB_CATEGORY", header: "Code" }, { field: "JOB_CATEGORY_NAME", header: "Category" }]} loadOptions={(search) => lookup("freight_job_category", companyCode, "NULL", "NULL", search)} onChange={(value) => setJobField(setJob, "job_category", value)} required/>
              <Lookup
                  label="Quotation Ref"
                  value={job.quotation_ref}
                  valueField="QUOTATION_NR"
                  displayFields={["QUOTATION_NR", "QUOTATION_DATE"]}
                  columns={[{ field: "QUOTATION_NR", header: "Quotation" }, { field: "PRIN_CODE", header: "Principal" }, { field: "QUOTATION_DATE", header: "Date" }]}
                  loadOptions={(search) =>
                   freightSelect<LookupRow>({
                      parameter: "freight_job_quotation_source",
                        code1: companyCode,
                        code2: mode.code,
                        code3: direction.code,
                        code4: search || "NULL",
                        code5: job.prin_code || "NULL",
                    }).then((rows) => rows.map(normalizeLookupRow))
                  }
                  onChange={(value, row) => void copyQuotationToJob(value, row)}
                  disabled={!job.prin_code}
                  placeholder="Principal is not selected"
                 />
               <Lookup label="Member Type" value={job.member_type} displayValue={job.member_type_name} valueField="MEMBER_TYPE" displayFields={["MEMBER_TYPE", "MEMBER_TYPE_NAME"]} columns={[{ field: "MEMBER_TYPE", header: "Code" }, { field: "MEMBER_TYPE_NAME", header: "Member Type" }]} loadOptions={(search) => lookup("freight_member_type", companyCode, "NULL", "NULL", search)} onChange={(value) => setJobField(setJob, "member_type", value)} />
              <Lookup label="Tax Category" value={job.tx_cat_code} displayValue={job.tx_cat_name} valueField="TX_CAT_CODE" displayFields={["TX_CAT_CODE", "TX_CAT_NAME"]} columns={[{ field: "TX_CAT_CODE", header: "Code" }, { field: "TX_CAT_NAME", header: "Tax Category" }]} loadOptions={(search) => freightTaxCategories<LookupRow>(companyCode, job.div_code, search).then((rows) => rows.map(normalizeLookupRow))} onChange={(value, row) => setJob((current) => ({ ...current, tx_cat_code: value, tx_cat_name: lookupText(row || undefined, "TX_CAT_NAME") }))} disabled={!job.div_code} placeholder={job.div_code ? "Select tax category" : "Select division first"} />
             <SelectField label="Job Indicator" value={job.job_flag} options={[["M", "Master"], ["H", "House"]]} onChange={(value) => setJobField(setJob, "job_flag", value)}  />
            </div>
          </Panel>

          {isReexport && (
            <Panel className="lg:col-span-12 freight-job-reexport-panel" icon={Ship} title="Re-export Linkage" meta={job.ref_jobno || job.combined_jobno || "Import job reference"}>
              <div className="freight-job-field-grid freight-job-field-grid-4">
                <Field label="Import Job No(s)" value={job.ref_jobno} onChange={(value) => setJobField(setJob, "ref_jobno", value)} />
                <SelectField label="Job Indicator" value={job.job_flag} options={[["M", "Master"], ["H", "House"], ["C", "Console"]]} onChange={(value) => setJobField(setJob, "job_flag", value)} />
                <Field label="Parent Job No" value={job.combined_jobno} onChange={(value) => setJobField(setJob, "combined_jobno", value)} />
                <ReadOnlyField label="Re-export" value="Yes" />
              </div>
            </Panel>
          )}

          <Panel className="lg:col-span-4 freight-job-compact-panel" icon={MapPinned} title="Journey" meta={`${job.port_code || "Origin"} -> ${job.destination_port || "Destination"}`}>
            <div className="freight-job-field-grid freight-job-field-grid-4">
              <Lookup label={direction.code === "EXP" ? "Port of Loading" : "Origin Port"} value={job.port_code} displayValue={job.port_code_name} valueField="PORT_CODE" displayFields={["PORT_CODE", "PORT_NAME"]} columns={portColumns} loadOptions={(search) => lookup("freight_port", companyCode, "NULL", "NULL", search)} onChange={(value, row) => setJob((current) => ({ ...current, port_code: value, port_code_name: lookupText(row || undefined, "PORT_NAME") || current.port_code_name }))} required/>
              <Lookup label={direction.code === "EXP" ? "Port of Destination" : "Destination Port"} value={job.destination_port_name} displayValue={job.destination_port_name} valueField="PORT_CODE" displayFields={["PORT_CODE", "PORT_NAME"]} columns={portColumns} loadOptions={(search) => lookup("freight_port", companyCode, "NULL", "NULL", search)} onChange={(value, row) => setJob((current) => ({ ...current, destination_port: value, destination_port_name: lookupText(row || undefined, "PORT_NAME") || current.destination_port_name }))} required/>
              <Field label="Place of Receipt" value={job.place_receipt} onChange={(value) => setJobField(setJob, "place_receipt", value)} />
              <Field label="Place of Delivery" value={job.place_delivery} onChange={(value) => setJobField(setJob, "place_delivery", value)} />
             </div>
          </Panel>

          {mode.code === "R" && (
            <Panel className="lg:col-span-4 freight-job-compact-panel" icon={Truck} title="Truck And Driver Details" meta={job.driver_ref || job.vessel_name || "Road details"}>
              <div className="freight-job-field-grid freight-job-field-grid-2">
                <Field label="Driver Name / Ref" value={job.driver_ref} onChange={(value) => setJobField(setJob, "driver_ref", value)} />
                <Textarea className="sm:col-span-2" label="Driver Remarks / Contact" value={job.driver_remarks} onChange={(value) => setJobField(setJob, "driver_remarks", value)} />
                {/* {isExportLike && (
                 <> */}
                   <Field label="Doc Ref" value={job.doc_ref} onChange={(value) => setJobField(setJob, "doc_ref", value)} />
                   <Field label="House Ref" value={job.hawb} onChange={(value) => setJobField(setJob, "hawb", value)} />
                 {/* </> */}
                
              </div>
            </Panel>
          )}

          <Panel className="lg:col-span-4 freight-job-compact-panel" icon={FileText} title="Bill Of Lading Details" meta={job.doc_ref || job.hawb || "Document refs"}>
            <div className="freight-job-field-grid freight-job-field-grid-2">
              {/* <Field className="sm:col-span-2" label={mode.code === "A" ? "MAWB" : "Master BL No"} value={job.doc_ref} onChange={(value) => setJobField(setJob, "doc_ref", value)} /> */}
              {/* <Field className="sm:col-span-2" label="Doc Ref 2" value={job.doc_ref2} onChange={(value) => setJobField(setJob, "doc_ref2", value)} /> */}
               <ModeCarrierLookup mode={mode.code} companyCode={companyCode} value={job.vessel_name} displayValue={job.vessel_display_name} onChange={(value) => setJobField(setJob, "vessel_name", value)} />
              {mode.code === "S" && <Field label="Feeder Vessel" value={job.feeder_vessel_name} onChange={(value) => setJobField(setJob, "feeder_vessel_name", value)} />}
              <Field label={mode.code === "R" ? "Trip / Route No" : mode.code === "A" ? "Flight No" : "Voyage No"} value={job.voyage_no} onChange={(value) => setJobField(setJob, "voyage_no", value)} />
              {mode.code === "S" && !isExportLike && (
                <SelectField label="Health Status" value={job.health_status} options={[["Y", "Yes"], ["N", "No"]]} onChange={(value) => setJobField(setJob, "health_status", value)} />
              )}
              {mode.code !== "R" && (
                  <div className="freight-job-row-2 sm:col-span-2">
                  <Field label={mode.code === "A" ? "MAWB" : "Master BL No"} value={job.doc_ref} onChange={(value) => setJobField(setJob, "doc_ref", value)} required />
                  <Field label={mode.code === "A" ? "HAWB" : "HBL"} value={job.hawb} onChange={(value) => setJobField(setJob, "hawb", value)} required   />
                  </div>
                )}
              <Textarea className="sm:col-span-2" label="Cargo Description" value={job.description1} onChange={(value) => setJobField(setJob, "description1", value)} />
              <Textarea className="sm:col-span-2" label="Remarks" value={job.remarks} onChange={(value) => setJobField(setJob, "remarks", value)} />
            </div>
          </Panel>

          {/* <Panel className="lg:col-span-4 freight-job-compact-panel" icon={BriefcaseBusiness} title="Events" meta={job.job_start_date || "Job start pending"}>
            <div className="freight-job-field-grid freight-job-field-grid-2">
              <DateField label="Job Start Date" value={job.job_start_date} onChange={(value) => setJobField(setJob, "job_start_date", value)} required />
              {/* <DateField label="Date of Departure" value={job.etd} onChange={(value) => setJobField(setJob, "etd", value)} />
              <DateField label="ETA" value={job.eta} onChange={(value) => setJobField(setJob, "eta", value)} />
              <DateField label="ATA" value={job.ata} onChange={(value) => setJobField(setJob, "ata", value)} />
              <DateField label="Schedule Date" value={job.schedule_date} onChange={(value) => setJobField(setJob, "schedule_date", value)} /> */}
              {/* <DateTimeField label="Date of Departure" value={job.etd} onChange={(value) => setJobField(setJob, "etd", value)} />
              <DateTimeField label="ETA" value={job.eta} onChange={(value) => setJobField(setJob, "eta", value)} />
              <DateTimeField label="ATA" value={job.ata} onChange={(value) => setJobField(setJob, "ata", value)} />
              <DateTimeField label="Schedule Date" value={job.schedule_date} onChange={(value) => setJobField(setJob, "schedule_date", value)} />
              <DateTimeField label="Transit Time" value={job.transit_time} onChange={(value) => setJobField(setJob, "transit_time", value)} />
            </div>
          </Panel> */} 

  <Panel className="lg:col-span-3" icon={BriefcaseBusiness} title="Events" meta={job.job_start_date || "Job start pending"}>
   <div className="freight-job-field-grid freight-job-field-grid-2">
    <DateField label="Job Start Date" value={job.job_start_date} onChange={(value) => setJobField(setJob, "job_start_date", value)} required />
    {isExportLike ? (
      <>
        <DateField label="Date of Delivery" value={job.delivered_on} onChange={(value) => setJobField(setJob, "delivered_on", value)} />
        <DateField label="Date of Pickup" value={job.picked_date} onChange={(value) => setJobField(setJob, "picked_date", value)} />
        <DateField label="Date of Departure" value={job.etd} onChange={(value) => setJobField(setJob, "etd", value)} />
        <DateField label="Schedule Date" value={job.schedule_date} onChange={(value) => setJobField(setJob, "schedule_date", value)} />
        <DateField label="Transit Time" value={job.transit_time} onChange={(value) => setJobField(setJob, "transit_time", value)} />
      </>
    ) : (
      <>
        <DateField label="ETD" value={job.etd} onChange={(value) => setJobField(setJob, "etd", value)} />
        <DateField label="Exp. Date of Arrival" value={job.eta} onChange={(value) => setJobField(setJob, "eta", value)} />
        <DateField label="Act. Date of Arrival" value={job.ata} onChange={(value) => setJobField(setJob, "ata", value)} />
        <DateField label="Clearance Date" value={job.clearance_date} onChange={(value) => setJobField(setJob, "clearance_date", value)} />
        <DateField label="Transit Time" value={job.transit_time} onChange={(value) => setJobField(setJob, "transit_time", value)} />
        {mode.code === "S" && (
          <DateField label="LOU" value={job.letter_undertaking} onChange={(value) => setJobField(setJob, "letter_undertaking", value)} />
        )}
      </>
    )}
  </div>
</Panel>

          <Panel className="lg:col-span-4" icon={BriefcaseBusiness} title="Payment Terms" meta={`${job.payment_terms || "Terms"} / ${job.payableat || "Payable"}`}>
            <div className="freight-job-field-grid freight-job-field-grid-2">
              <Lookup label="INCO Terms" value={job.payment_terms} valueField="PAYMENT_TERMS" displayFields={["PAYMENT_TERMS", "PAYMENT_TERMS_NAME"]} columns={[{ field: "PAYMENT_TERMS", header: "Code" }, { field: "PAYMENT_TERMS_NAME", header: "Terms" }]} loadOptions={(search) => lookup("freight_payment_terms", companyCode, "NULL", "NULL", search)} onChange={(value) => setJobField(setJob, "payment_terms", value)} />
              <Lookup label="Currency" value={job.curr_code} valueField="CURR_CODE" displayFields={["CURR_CODE", "CURR_NAME"]} columns={[{ field: "CURR_CODE", header: "Code" }, { field: "CURR_NAME", header: "Currency" }, { field: "EX_RATE", header: "Rate" }]} loadOptions={(search) => lookup("freight_currency", companyCode, "NULL", "NULL", search)} onChange={(value, row) => setJob((current) => ({ ...current, curr_code: value, ex_rate: lookupText(row || undefined, "EX_RATE") || current.ex_rate }))} required />
              <Field label="Exchange Rate" type="number" value={job.ex_rate} onChange={(value) => setJobField(setJob, "ex_rate", value)} required/>
              <Lookup label="Freight Payable At" value={job.payableat} valueField="PAYABLEAT" displayFields={["PAYABLEAT", "PAYABLEAT_NAME"]} columns={[{ field: "PAYABLEAT", header: "Code" }, { field: "PAYABLEAT_NAME", header: "Payable At" }]} loadOptions={(search) => lookup("freight_payable_at", companyCode, "NULL", "NULL", search)} onChange={(value) => setJobField(setJob, "payableat", value)} />
              {/* <Field label="Freight Value" type="number" value={job.frieght_value} onChange={(value) => setJobField(setJob, "frieght_value", value)} />
              <Field label="Insurance Value" type="number" value={job.insurance_value} onChange={(value) => setJobField(setJob, "insurance_value", value)} /> */}
              <Field label="No of Orig Docs" type="number" value={job.no_of_original_bl} onChange={(value) => setJobField(setJob, "no_of_original_bl", value)} />
              {mode.code === "S" && !isExportLike && (
                <>
                 <SelectField label="Container Deposit" value={job.contr_deposit} options={[["Y", "Yes"], ["N", "No"]]} onChange={(value) => setJobField(setJob, "contr_deposit", value)} />
                 <Field label="Container Deposit Amt" type="number" value={job.contr_deposit_amt} onChange={(value) => setJobField(setJob, "contr_deposit_amt", value)} />
              </>
              )}
            </div>
          </Panel>

          <Panel className="lg:col-span-4" icon={BriefcaseBusiness} title="References" meta={job.forwarder_code || job.salesman_code || "Forwarder / sales"}>
            <div className="freight-job-field-grid freight-job-field-grid-2">
              <Lookup label="Forwarder" value={job.forwarder_code} valueField="FORWARDER_CODE" displayFields={["FORWARDER_CODE", "FORWARDER_NAME"]} columns={[{ field: "FORWARDER_CODE", header: "Code" }, { field: "FORWARDER_NAME", header: "Forwarder" }]} loadOptions={(search) => lookup("freight_forwarder", companyCode, "NULL", "NULL", search)} onChange={(value) => setJobField(setJob, "forwarder_code", value)} />
              <Lookup label="Sales Rep" value={job.salesman_code} valueField="SALESMAN_CODE" displayFields={["SALESMAN_CODE", "SALESMAN_NAME"]} columns={[{ field: "SALESMAN_CODE", header: "Code" }, { field: "SALESMAN_NAME", header: "Salesman" }]} loadOptions={(search) => lookup("freight_salesman", companyCode, "NULL", "NULL", search)} onChange={(value) => setJobField(setJob, "salesman_code", value)} />
              {/* <Field label="Principal Ref 2" value={job.prin_ref2} onChange={(value) => setJobField(setJob, "prin_ref2", value)} /> */}
              {/* <Lookup label="Customer" value={job.cust_code} valueField="CUSTOMER_CODE" displayFields={["CUSTOMER_CODE", "CUSTOMER_NAME"]} columns={[{ field: "CUSTOMER_CODE", header: "Code" }, { field: "CUSTOMER_NAME", header: "Customer" }]} loadOptions={(search) => lookup("freight_customer", companyCode, "NULL", "NULL", search)} onChange={(value) => setJobField(setJob, "cust_code", value)} />
              <Lookup label="Broker" value={job.broker_code} valueField="BROKER_CODE" displayFields={["BROKER_CODE", "BROKER_NAME"]} columns={[{ field: "BROKER_CODE", header: "Code" }, { field: "BROKER_NAME", header: "Broker" }]} loadOptions={(search) => lookup("freight_broker", companyCode, "NULL", "NULL", search)} onChange={(value) => setJobField(setJob, "broker_code", value)} /> */}
            </div>
          </Panel>

          {/* <Panel className="lg:col-span-4" icon={FileText} title="Customs And Operational References" meta={job.be_no || job.custom_recno || "Customs"}>
            <div className="freight-job-field-grid freight-job-field-grid-3">
              <Field label="BE No" value={job.be_no} onChange={(value) => setJobField(setJob, "be_no", value)} />
              <DateField label="BE Date" value={job.be_date} onChange={(value) => setJobField(setJob, "be_date", value)} />
              <Field label="Custom Ref" value={job.custom_recno} onChange={(value) => setJobField(setJob, "custom_recno", value)} />
              <Field label="Customs Job Ref" value={job.ref_customs} onChange={(value) => setJobField(setJob, "ref_customs", value)} />
              <DateField label="Customs Ref Date" value={job.ref_customs_date} onChange={(value) => setJobField(setJob, "ref_customs_date", value)} />
              {/* <Field label="Country Origin" value={job.country_origin} onChange={(value) => setJobField(setJob, "country_origin", value)} />
              <Field label="Country Destination" value={job.country_destination} onChange={(value) => setJobField(setJob, "country_destination", value)} /> */}
              {/* {!isReexport && <Field label="Import Job No(s)" value={job.ref_jobno} onChange={(value) => setJobField(setJob, "ref_jobno", value)} />}
              {!isReexport && <Field label="Parent Job No" value={job.combined_jobno} onChange={(value) => setJobField(setJob, "combined_jobno", value)} />}
            </div>
          </Panel> */} 

          <Panel className="lg:col-span-4" icon={FileText} title="Customs And Operational References" meta={job.be_no || job.custom_recno || "Customs"}>
  <div className="freight-job-field-grid freight-job-field-grid-3">
    {isExportLike ? (
      <>
        <Field label="Customer Dec No" value={job.dec_no} onChange={(value) => setJobField(setJob, "dec_no", value)} />
        <DateField label="Customer Dec Date" value={job.dec_date} onChange={(value) => setJobField(setJob, "dec_date", value)} />
        <Field label="FHCR No" value={job.ref_customs} onChange={(value) => setJobField(setJob, "ref_customs", value)} />
        <DateField label="FHCR Date" value={job.ref_customs_date} onChange={(value) => setJobField(setJob, "ref_customs_date", value)} />
      </>
    ) : (
      <>
        <Field label="BE No" value={job.be_no} onChange={(value) => setJobField(setJob, "be_no", value)} />
        <DateField label="BE Date" value={job.be_date} onChange={(value) => setJobField(setJob, "be_date", value)} />
        <SelectField label="BE Deposits" value={job.be_deposits} options={[["Y", "Yes"], ["N", "No"]]} onChange={(value) => setJobField(setJob, "be_deposits", value)} />
        <Field label="BE Deposit Amt" type="number" value={job.be_dep_amount} onChange={(value) => setJobField(setJob, "be_dep_amount", value)} />
        <Field label="Custom Rec No" value={job.custom_recno} onChange={(value) => setJobField(setJob, "custom_recno", value)} />
        <Field label="FHCR No" value={job.ref_customs} onChange={(value) => setJobField(setJob, "ref_customs", value)} />
        <DateField label="FHCR Date" value={job.ref_customs_date} onChange={(value) => setJobField(setJob, "ref_customs_date", value)} />
      </>
    )}
    {!isReexport && <Field label="Import Job No(s)" value={job.ref_jobno} onChange={(value) => setJobField(setJob, "ref_jobno", value)} />}
    {!isReexport && <Field label="Parent Job No" value={job.combined_jobno} onChange={(value) => setJobField(setJob, "combined_jobno", value)} />}
  </div>
</Panel>

          </div>
          </JobEditContext.Provider>
        </fieldset>
        <JobProgressRail job={job} />
      </div>
    </form>
  );
}

function buildJobProgress(job: JobForm) {
  const packDone = job.packdet === "Y" || Boolean(job.packdet_date);
  const confirmDone = job.confirmed === "Y" || Boolean(job.confirm_date);
  const invoiceDone = job.invoiced === "Y" || Boolean(job.invoice_date);
  const completeDone = job.completed === "Y" || Boolean(job.complete_date);
  const steps = [
    { label: "Job", done: true, detail: toDisplayDate(job.job_date) },
    { label: "Pack List", done: packDone, detail: toDisplayDate(job.packdet_date) },
    { label: "Confirmed", done: confirmDone, detail: toDisplayDate(job.confirm_date) },
    { label: "Invoiced", done: invoiceDone, detail: toDisplayDate(job.invoice_date) },
    { label: "Completed", done: completeDone, detail: toDisplayDate(job.complete_date) },
  ];
  const currentIndex = steps.findIndex((step) => !step.done);
  return steps.map((step, index) => ({
    ...step,
    className: step.done ? "done" : index === currentIndex ? "current" : "",
  }));
}

function JobProgressRail({ job }: { job: JobForm }) {
  const steps = buildJobProgress(job);
  const activeStep = steps.find((step) => step.className === "current") || steps[steps.length - 1];

  return (
    <aside className="freight-job-progress-rail" aria-label="Job status">
      <div className="freight-job-progress-rail-title">
        <span>Workflow Progress</span>
        <strong>Current Status: {activeStep?.label || "Completed"}</strong>
      </div>
      <div className="freight-job-progress-rail-list">
        {steps.map((step, idx) => (
          <div key={step.label} className={`freight-job-progress-rail-step ${step.className || "pending"}`}>
            <span className="freight-job-progress-rail-marker">
              {step.done ? <Check size={14} /> : idx + 1}
            </span>
            <span className="freight-job-progress-rail-copy">
              <strong>{step.label}</strong>
              <small>{step.detail || (step.done ? "Done" : "Pending")}</small>
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function Header({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof Plane; children: React.ReactNode }) {
  return (
    <div className="freight-form-header flex items-center justify-between mb-2 p-2 rounded-xl border border-border bg-card shadow-sm">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={18} /></span>
        <div>
          <p className="eyebrow mb-0 text-[10px] font-bold uppercase tracking-wider text-primary">Freight Job</p>
          <h1 className="m-0 text-base font-bold text-foreground">{title}</h1>
          <p className="m-0 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Panel({ title, meta, icon: Icon, children, className = "" }: { title: string; meta: string; icon: typeof Plane; children: React.ReactNode; className?: string }) {
  return (
    <section className={`freight-info-section ${className}`}>
      <div className="freight-info-title">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size={15} className="text-primary" />
          <h2>{title}</h2>
        </div>
        <span className="text-[11px] text-muted-foreground font-medium">{meta}</span>
      </div>
      <div className="freight-info-body">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", className = "", required }: { label: string; value: string; onChange: (value: string) => void; type?: string; className?: string; required?: boolean }) {
  const editable = useContext(JobEditContext);
  if (!editable) return <DisplayField className={className} label={label} value={type === "date" ? toDisplayDate(value) : value} />;
  const safeValue = type === "date" ? dateInputValue(value) : value;
  return (
    <label className={`freight-compact-label ${className}`}>
      <span>{label} {required && <span className="text-destructive font-bold">*</span>}</span>
      <Input
        // className="h-8 text-xs font-normal"
        className={`h-8 text-xs font-normal ${type === "number" ? "text-right tabular-nums" : ""}`}
        type={type}
        value={safeValue}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        onInvalid={(event) => (event.target as HTMLInputElement).setCustomValidity(`${label} is required`)}
        onInput={(event) => (event.target as HTMLInputElement).setCustomValidity("")}
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange, required }: { label: string; value: string; options: Array<string | [string, string]>; onChange: (value: string) => void; required?: boolean }) {
  const editable = useContext(JobEditContext);
  if (!editable) {
    const matched = options.find((option) => (Array.isArray(option) ? option[0] : option) === value);
    const display = matched ? (Array.isArray(matched) ? matched[1] : matched) : value;
    return <DisplayField label={label} value={display} />;
  }
  return (
    <label className="freight-compact-label">
      <span>{label} {required && <span className="text-destructive font-bold">*</span>}</span>
      <select className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value=""> </option>
        {options.map((option) => {
          const [code, labelText] = Array.isArray(option) ? option : [option, option];
          return <option key={code} value={code}>{labelText}</option>;
        })}
      </select>
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const editable = useContext(JobEditContext);

  if (!editable) {
    return <DisplayField label={label} value={toDisplayDate(value)} />;
  }

  const inputValue = dateInputValue(value);

  return (
    <label className="freight-compact-label">
      <span>
        {label}
        {required && <span className="text-destructive font-bold"> *</span>}
      </span>

      <Input
        className="h-8 text-xs font-normal"
        type="date"
        value={inputValue}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        onInvalid={(event) =>
          (event.target as HTMLInputElement).setCustomValidity(
            `${label} is required`
          )
        }
        onInput={(event) =>
          (event.target as HTMLInputElement).setCustomValidity("")
        }
      />
    </label>
  );
}

function DateTimeField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const editable = useContext(JobEditContext);

  if (!editable) {
    return <DisplayField label={label} value={toDisplayDateTime(value)} />;
  }

  return (
    <label className="freight-compact-label">
      <span>
        {label}
        {required && <span className="text-destructive font-bold"> *</span>}
      </span>
      <Input
        className="h-8 text-xs font-normal"
        type="datetime-local"
        value={dateTimeInputValue(value)}
        required={required}
        onChange={(event) => onChange(localInputToUtcIso(event.target.value))}
        onInvalid={(event) =>
          (event.target as HTMLInputElement).setCustomValidity(`${label} is required`)
        }
        onInput={(event) => (event.target as HTMLInputElement).setCustomValidity("")}
      />
    </label>
  );
}

function Textarea({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  const editable = useContext(JobEditContext);
  if (!editable) return <DisplayField className={className} label={label} value={value} multiline />;
  return (
    <label className={`freight-compact-label ${className}`}>
      <span>{label}</span>
      <textarea className="min-h-[52px] rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground shadow-none" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const editable = useContext(JobEditContext);
  if (!editable) return <DisplayField label={label} value={value} strong />;
  return (
    <div className="freight-compact-label">
      <span>{label}</span>
      <div className="flex h-8 items-center rounded-lg border border-border bg-muted/40 px-2.5 text-xs font-medium normal-case text-foreground">{value}</div>
    </div>
  );
}

function Lookup({ label, value, displayValue, valueField, displayFields, columns, loadOptions, onChange, required, disabled, placeholder }: { label: string; value: string; displayValue?: string; valueField: string; displayFields: string[]; columns: { field: string; header: string }[]; loadOptions: (query?: string) => Promise<LookupRow[]>; onChange: (value: string, row: LookupRow | null) => void; required?: boolean; disabled?: boolean; placeholder?: string }) {
  const editable = useContext(JobEditContext);
  if (!editable) return <DisplayField label={label} value={displayValue || value} />;
  return (
    <label className="freight-compact-label">
      <span>{label} {required && <span className="text-destructive font-bold">*</span>}</span>
      <LookupField value={value} displayValue={displayValue} compact valueField={valueField} displayFields={displayFields} columns={columns} loadOptions={loadOptions} onChange={onChange} required={required} enforceRequired={required} disabled={disabled} placeholder={placeholder} />
    </label>
  );
}

function DisplayField({ label, value, strong, multiline, className = "" }: { label: string; value: string; strong?: boolean; multiline?: boolean; className?: string }) {
  return (
    <div className={`freight-read-field ${multiline ? "multiline" : ""} ${className}`}>
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      <strong className={`text-xs ${strong ? "font-bold text-primary" : "font-medium text-foreground"}`}>{value || "-"}</strong>
    </div>
  );
}

function ModeCarrierLookup({ mode, companyCode, value, displayValue, onChange }: { mode: string; companyCode: string; value: string; displayValue: string; onChange: (value: string) => void }) {
  if (mode === "S") return <Lookup label="Vessel" value={value} displayValue={displayValue} valueField="VESSEL_CODE" displayFields={["VESSEL_CODE", "VESSEL_NAME"]} columns={[{ field: "VESSEL_CODE", header: "Code" }, { field: "VESSEL_NAME", header: "Vessel" }]} loadOptions={(search) => lookup("freight_vessel", companyCode, "NULL", "NULL", search)} onChange={(next) => onChange(next)} />;
  if (mode === "R") return <Lookup label="Transporter" value={value} displayValue={displayValue} valueField="TRANSPORTER_CODE" displayFields={["TRANSPORTER_CODE", "TRANSPORTER_NAME"]} columns={[{ field: "TRANSPORTER_CODE", header: "Code" }, { field: "TRANSPORTER_NAME", header: "Transporter" }]} loadOptions={(search) => lookup("freight_transporter", companyCode, "NULL", "NULL", search)} onChange={(next) => onChange(next)} />;
  return <Lookup label="Airline" value={value} displayValue={displayValue} valueField="AIRLINE_CODE" displayFields={["AIRLINE_CODE", "AIRLINE_NAME"]} columns={[{ field: "AIRLINE_CODE", header: "Code" }, { field: "AIRLINE_NAME", header: "Airline" }]} loadOptions={(search) => lookup("freight_airline", companyCode, "NULL", "NULL", search)} onChange={(next) => onChange(next)} />;
}

function NoticeChip({ notice }: { notice: Exclude<Notice, null> }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.text}</span>;
}

function emptyJob(companyCode: string, userId: string, transportMode: string, jobType: string): JobForm {
  return {
    company_code: companyCode,
    prin_code: "",
    prin_name: "",
    job_no: "",
    job_date: today(),
    job_type: jobType,
    job_class: "",
    transport_mode: transportMode,
    dept_code: "",
    dept_name: "",
    div_code: "",
    div_name: "",
    job_category: "N/A",
    job_category_name: "",
    member_type: "",
    member_type_name: "",
    sale_type: "Normal",
    tx_cat_code: "",
    tx_cat_name: "",
    quotation_ref: "",
    doc_ref: "",
    doc_ref2: "",
    hawb: "",
    port_code: "",
    destination_port: "",
    place_receipt: "",
    place_delivery: "",
    vessel_name: "",
    feeder_vessel_name: "",
    voyage_no: "",
    carrier: "",
    driver_ref: "",
    driver_remarks: "",
    forwarder_code: "",
    forwarder_name: "",
    eta: "",
    ata: "",
    etd: "",
    schedule_date: "",
    job_start_date: today(),
    transit_time: "",
    payment_terms: "CIF",
    payableat: "ORIGIN",
    curr_code: "OMR",
    ex_rate: "1",
    frieght_value: "",
    insurance_value: "",
    no_of_original_bl: "",
    cust_code: "",
    broker_code: "",
    prin_ref1: "",
    prin_ref2: "",
    description1: "",
    description2: "",
    salesman_code: "",
    salesman_name: "",
    be_no: "",
    be_date: "",
    be_deposits: "",
    be_dep_amount: "",
    country_origin: "",
    country_destination: "",
    custom_recno: "",
    ref_customs: "",
    ref_customs_date: "",
    ref_jobno: "",
    combined_jobno: "",
    reexport: jobType === "IRE" ? "Y" : "N",
    job_flag: "M",
    confirmed: "N",
    confirm_date: "",
    completed: "N",
    complete_date: "",
    invoiced: "",
    invoice_date: "",
    packdet: "N",
    packdet_date: "",
    remarks: "",
    dec_no: "",
    dec_date: "",
    delivered_on: "",
    picked_date: "",
    clearance_date: "",
    letter_undertaking: "",
    contr_deposit: "",
    contr_deposit_amt: "",
    health_status: "",
    port_code_name: "",
    destination_port_name: "",
    vessel_display_name: "",
    canceled: "N",
    user_id: userId,
  };
}

function toJobForm(row: LookupRow, companyCode: string, userId: string, mode: string, jobType: string): JobForm {
  const base = emptyJob(companyCode, userId, mode, jobType);
  return Object.fromEntries(Object.keys(base).map((key) => {
    const value = lookupText(row, key) || (base as any)[key];
    return [key, isJobDateField(key) ? dateInputValue(value) : value];
  })) as JobForm;
}

function toJobFromQuotation(row: LookupRow, current: JobForm, quotationNr: string): JobForm {
  return {
    ...current,
    company_code: lookupText(row, "COMPANY_CODE") || current.company_code,
    prin_code: lookupText(row, "PRIN_CODE") || current.prin_code,
    quotation_ref: quotationNr,
    dept_code: lookupText(row, "DEPT_CODE") || current.dept_code,
    job_type: current.job_type === "IRE" ? "IRE" : lookupText(row, "JOB_TYPE") || current.job_type,
    transport_mode: lookupText(row, "TRANSPORT_MODE") || current.transport_mode,
    port_code: lookupText(row, "ORIGIN_PORT") || current.port_code,
    destination_port: lookupText(row, "DESTINATION_PORT") || current.destination_port,
    place_receipt: lookupText(row, "PLACE_RECEIPT") || lookupText(row, "ORIGIN_PORT") || current.place_receipt,
    place_delivery: lookupText(row, "PLACE_DELIVERY") || lookupText(row, "DESTINATION_PORT") || current.place_delivery,
    vessel_name: lookupText(row, "CARRIER") || current.vessel_name,
    carrier: lookupText(row, "CARRIER") || current.carrier,
    forwarder_code: lookupText(row, "FORWARDER_CODE") || current.forwarder_code,
    payment_terms: lookupText(row, "PAYMENT_TERMS") || current.payment_terms,
    payableat: lookupText(row, "TOS") || current.payableat,
    curr_code: lookupText(row, "CURR_CODE") || current.curr_code,
    ex_rate: lookupText(row, "EX_RATE") || current.ex_rate,
    country_origin: lookupText(row, "COUNTRY_ORIGIN") || current.country_origin,
    country_destination: lookupText(row, "COUNTRY_DESTINATION") || current.country_destination,
    transit_time: lookupText(row, "TRANSIT_TIME") || current.transit_time,
    member_type: lookupText(row, "MEMBER_TYPE") || current.member_type,
    sale_type: lookupText(row, "SALE_TYPE") || current.sale_type,
    job_category: lookupText(row, "JOB_CATEGORY") || current.job_category,
    description1: lookupText(row, "CARGO_DETAIL") || lookupText(row, "CARGO_DETAILS") || current.description1,
    remarks: lookupText(row, "REMARKS") || current.remarks,
    reexport: current.job_type === "IRE" ? "Y" : current.reexport,
  };
}

function setJobField(setJob: (updater: (current: JobForm) => JobForm) => void, field: keyof JobForm, value: string) {
  setJob((current) => ({ ...current, [field]: value }));
}

async function lookup(parameter: string, companyCode: string, code2 = "NULL", code3 = "NULL", query = "") {
  return (await freightSelect<LookupRow>({ parameter, code1: companyCode, code2, code3, code4: query || "NULL", number1: 50 })).map(normalizeLookupRow);
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

function isJobDateField(key: string) {
  return ["job_date", , "job_start_date", "be_date", "ref_customs_date", "confirm_date", "complete_date", "invoice_date", "packdet_date"].includes(key.toLowerCase());
}

function dateInputValue(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toDisplayDate(value: string) {
  const normalized = dateInputValue(value);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
}

function dateTimeInputValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  // yields YYYY-MM-DDTHH:mm for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDisplayDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToUtcIso(value: string) {
  if (!value) return "";
  // value is "YYYY-MM-DDTHH:mm" with no timezone -> browser Date() treats it as LOCAL
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString(); // converts local -> proper UTC ISO string with Z
}

function parseDisplayDate(value: string) {
  const text = value.trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (!match) return "";
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3];
  const candidate = `${year}-${month}-${day}`;
  const date = new Date(`${candidate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  if (date.getFullYear() !== Number(year) || date.getMonth() + 1 !== Number(month) || date.getDate() !== Number(day)) return "";
  return candidate;
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

const portColumns = [{ field: "PORT_CODE", header: "Code" }, { field: "PORT_NAME", header: "Port" }, { field: "COUNTRY_CODE", header: "Country" }];
