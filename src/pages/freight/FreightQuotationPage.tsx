import type { ColumnDef } from "@tanstack/react-table";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Copy,
  CreditCard,
  Eye,
  FileText,
  MapPinned,
  PackageCheck,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  ShipWheel,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api } from "../../api/client";
import { executeWmsInboundSql } from "../../api/wms";
import type { LookupRow } from "../../api/lookups";
import { AttachmentDialog } from "../../components/ui/AttachmentDialog";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";

type QuotationHeader = {
  company_code: string;
  prin_code: string;
  quotation_nr: string;
  quotation_date: string;
  dept_code: string;
  job_type: string;
  transport_mode: string;
  indstatus: string;
  enquiry_no: string;
  enquiry_type: string;
  offer_validity: string;
  origin_port: string;
  destination_port: string;
  country_origin: string;
  country_destination: string;
  via: string;
  carrier: string;
  forwarder_code: string;
  salesman_code: string;
  transit_time: string;
  frequency: string;
  commodity: string;
  cargo_detail: string;
  remarks: string;
  l: string;
  b: string;
  h: string;
  volume: string;
  weight: string;
  gross_wt: string;
  container_type: string;
  no_of_contaners: string;
  vehicle_type: string;
  t_f: string;
  shipment_status: string;
  payment_terms: string;
  tos: string;
  curr_code: string;
  ex_rate: string;
  member_type: string;
  sale_type: string;
  job_category: string;
  spl_instructions: string;
  walkin_prin_code: string;
  contact_person: string;
  subject: string;
  quotation_type: string;
};

type QuotationDetail = {
  srno: number;
  act_code: string;
  activity: string;
  activity_remarks: string;
  uoc: string;
  moc1: string;
  transport_mode: string;
  origin_port: string;
  destination_port: string;
  quantity: string;
  uom: string;
  rate_remarks: string;
  cost_curr_code: string;
  cost_ex_rate: string;
  fc_costrate: string;
  fc_cost: string;
  cost: string;
  curr_code: string;
  ex_rate: string;
  fc_billrate: string;
  fc_bill: string;
  bill: string;
  partners_curr_code: string;
  partners_ex_rate: string;
  fc_partners: string;
  partners_price: string;
};

type QuotationTerm = {
  serial_no: number;
  sr_no: string;
  type_ind: string;
  description: string;
  font_type: string;
  font_size: string;
};

type Notice = { type: "success" | "error"; text: string } | null;
type ViewMode = "list" | "editor";
export type FreightQuotationInitialTab = "summary" | "cargo" | "charges" | "terms";
type SmartCheck = { tone: "ok" | "warn" | "danger"; title: string; detail: string };

const jobTypes = [
  { value: "IMP", label: "Import" },
  { value: "EXP", label: "Export" },
];
const transportModes = [
  { value: "A", label: "Air" },
  { value: "S", label: "Sea" },
  { value: "R", label: "Road" },
];
const paymentTerms = ["CIF", "CFR", "FOB", "EXW", "FCA", "FAS", "CPT", "CIP", "DAF", "DES", "DEQ", "DDU", "DDP"];
const tosOptions = ["ORIGIN", "DESTINATION"];
const memberTypes = ["", "IFLN", "AFFAL", "None"];
const saleTypes = ["Normal", "FreeIn"];
const jobCategories = ["International", "Combined services", "Clearance", "Others"];
const tabs: { key: FreightQuotationInitialTab; label: string; icon: typeof PackageCheck }[] = [
  { key: "summary", label: "Overview", icon: PackageCheck },
  { key: "cargo", label: "Cargo", icon: MapPinned },
  { key: "charges", label: "Rates", icon: Activity },
  { key: "terms", label: "Terms", icon: FileText },
];

export function FreightQuotationPage({ target, initialTab = "summary" }: { target?: FreightWorkspaceTarget; initialTab?: FreightQuotationInitialTab }) {
  const { user } = useAuth();
  const userInfo = user as Record<string, unknown> | null;
  const initialHeader = useMemo(() => buildInitialHeader(userInfo, target), [target, userInfo]);
  const [header, setHeader] = useState<QuotationHeader>(initialHeader);
  const [details, setDetails] = useState<QuotationDetail[]>([buildInitialDetail(initialHeader, 1)]);
  const [terms, setTerms] = useState<QuotationTerm[]>([]);
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [activeTab, setActiveTab] = useState<FreightQuotationInitialTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [assistOpen, setAssistOpen] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);

  const loginId = String(userInfo?.loginid || userInfo?.USERID || userInfo?.user_id || userInfo?.username || "");
  const attachmentRequestNumber = header.quotation_nr ? `${header.company_code}-QTN-${header.quotation_nr}` : "";
  const smartChecks = useMemo(() => buildSmartChecks(header, details, terms), [details, header, terms]);
  const checkCount = smartChecks.filter((item) => item.tone !== "ok").length;
  const totals = useMemo(() => buildTotals(details), [details]);
  const isApproved = header.indstatus === "A";
  const isLocked = isApproved;
  const canApprove = Boolean(header.quotation_nr) && !isApproved;

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    {
      accessorKey: "quotation_nr",
      header: "Quotation No",
      size: 160,
      cell: ({ row }) => (
        <button className="font-semibold text-primary hover:underline" type="button" onClick={() => openQuotation(row.original)}>
          {lookupText(row.original, "quotation_nr")}
        </button>
      ),
    },
    { accessorKey: "quotation_date", header: "Date", size: 120, cell: ({ row }) => formatDisplayDate(lookupText(row.original, "quotation_date")) },
    { accessorKey: "prin_code", header: "Principal", size: 120, cell: ({ row }) => lookupText(row.original, "prin_code") },
    { accessorKey: "prin_name", header: "Principal Name", size: 260, cell: ({ row }) => lookupText(row.original, "prin_name") },
    { accessorKey: "job_type", header: "Job Type", size: 110, cell: ({ row }) => jobTypeLabel(lookupText(row.original, "job_type")) },
    { accessorKey: "transport_mode", header: "Mode", size: 100, cell: ({ row }) => modeLabel(lookupText(row.original, "transport_mode")) },
    { accessorKey: "origin_port", header: "Origin", size: 110, cell: ({ row }) => lookupText(row.original, "origin_port") },
    { accessorKey: "destination_port", header: "Destination", size: 130, cell: ({ row }) => lookupText(row.original, "destination_port") },
    { accessorKey: "curr_code", header: "Currency", size: 100, cell: ({ row }) => lookupText(row.original, "curr_code") },
    {
      accessorKey: "indstatus",
      header: "Status",
      size: 130,
      cell: ({ row }) => <span className={statusBadgeClass(lookupText(row.original, "indstatus"))}>{lookupText(row.original, "indstatus") === "A" ? "Approved" : "Not Approved"}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      size: 80,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <Button type="button" size="icon" variant="ghost" title="Open quotation" onClick={() => openQuotation(row.original)}>
          <Eye size={14} />
        </Button>
      ),
    },
  ], []);

  useEffect(() => {
    void loadRows();
  }, [userInfo?.company_code, userInfo?.COMPANY_CODE]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const setHeaderField = (field: keyof QuotationHeader, value: string) => {
    setHeader((current) => {
      const next = { ...current, [field]: value };
      if (field === "l" || field === "b" || field === "h") {
        const volume = (Number(field === "l" ? value : next.l) || 0) * (Number(field === "b" ? value : next.b) || 0) * (Number(field === "h" ? value : next.h) || 0) / 1000000;
        next.volume = volume ? volume.toFixed(3) : "0";
        next.weight = volume ? ((volume * 1000000) / 6000).toFixed(3) : "0";
      }
      return next;
    });
  };

  const applyHeaderLookup = (field: keyof QuotationHeader, value: string, row: LookupRow | null) => {
    setHeader((current) => {
      const next = { ...current, [field]: value };
      if (field === "prin_code" && row) {
        next.dept_code = lookupText(row, "prin_dept_code") || next.dept_code;
        next.curr_code = lookupText(row, "curr_code") || next.curr_code;
        next.ex_rate = lookupText(row, "ex_rate") || next.ex_rate;
      }
      if (field === "curr_code" && row) next.ex_rate = lookupText(row, "ex_rate") || next.ex_rate;
      if (field === "origin_port" && row) next.country_origin = lookupText(row, "country_name") || lookupText(row, "country_code") || next.country_origin;
      if (field === "destination_port" && row) next.country_destination = lookupText(row, "country_name") || lookupText(row, "country_code") || next.country_destination;
      if (field === "enquiry_no" && row) {
        next.enquiry_type = lookupText(row, "enquiry_type") || next.enquiry_type;
        void copyFromEnquiry(lookupText(row, "company_code") || current.company_code, lookupText(row, "prin_code"), value, next.enquiry_type);
      }
      return next;
    });
  };

  const setDetailField = (index: number, field: keyof QuotationDetail, value: string) => {
    setDetails((current) => current.map((row, rowIndex) => (rowIndex === index ? recalcDetail({ ...row, [field]: value }, field) : row)));
  };

  const setTermField = (index: number, field: keyof QuotationTerm, value: string) => {
    setTerms((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  };

  const loadRows = async () => {
    const companyCode = String(userInfo?.company_code || userInfo?.COMPANY_CODE || header.company_code || "");
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow[]; message?: string }>("/api/freight/quotation/list", { company_code: companyCode, search: query });
      if (response.data?.success === false) throw new Error(response.data.message || "Unable to load quotations");
      setRows((response.data?.data || []).map(normalizeLookupRow));
    } catch {
      const data = await executeWmsInboundSql(`
        SELECT q.QUOTATION_NR, q.QUOTATION_DATE, q.COMPANY_CODE, q.PRIN_CODE, p.PRIN_NAME, q.JOB_TYPE,
               q.TRANSPORT_MODE, q.DEPT_CODE, q.ORIGIN_PORT, q.DESTINATION_PORT, q.CURR_CODE,
               q.EX_RATE, q.INDSTATUS, q.ENQUIRY_NO, q.ENQUIRY_TYPE
        FROM TF_QUOTATION q
        LEFT JOIN MS_PRINCIPAL p ON p.COMPANY_CODE = q.COMPANY_CODE AND p.PRIN_CODE = q.PRIN_CODE
        WHERE q.COMPANY_CODE = '${sqlEscape(companyCode)}'
          AND NVL(q.QUOTATION_TYPE, 'QTN') = 'QTN'
        ORDER BY q.QUOTATION_DATE DESC, q.QUOTATION_NR DESC
      `);
      setRows(data.map(normalizeLookupRow));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    const fresh = buildInitialHeader(userInfo, target);
    setHeader(fresh);
    setDetails([buildInitialDetail(fresh, 1)]);
    setTerms([]);
    setNotice(null);
  };

  const startNew = () => {
    resetForm();
    setActiveTab(initialTab);
    setView("editor");
  };

  const copyAsNew = () => {
    setHeader((current) => ({ ...current, quotation_nr: "", quotation_date: toInputDate(new Date()), indstatus: "N" }));
    setNotice({ type: "success", text: "Quotation copied as a new draft" });
  };

  const openQuotation = async (row: LookupRow) => {
    const companyCode = lookupText(row, "company_code") || header.company_code;
    const prinCode = lookupText(row, "prin_code");
    const quotationNr = lookupText(row, "quotation_nr");
    if (!companyCode || !prinCode || !quotationNr) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: { header?: LookupRow; details?: LookupRow[]; terms?: LookupRow[] }; message?: string }>("/api/freight/quotation/get", {
        company_code: companyCode,
        prin_code: prinCode,
        quotation_nr: quotationNr,
      });
      if (response.data?.success === false) throw new Error(response.data.message || "Unable to open quotation");
      const data = response.data?.data;
      const loadedHeader = toHeaderFromRow(normalizeLookupRow(data?.header || row), userInfo, target);
      setHeader(loadedHeader);
      setDetails(data?.details?.length ? data.details.map((item, index) => toDetailFromRow(normalizeLookupRow(item), loadedHeader, index + 1)) : [buildInitialDetail(loadedHeader, 1)]);
      setTerms(data?.terms?.length ? data.terms.map((item, index) => toTermFromRow(normalizeLookupRow(item), index + 1)) : []);
      setActiveTab(initialTab);
      setView("editor");
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to open quotation" });
    } finally {
      setLoading(false);
    }
  };

  const copyFromEnquiry = async (companyCode: string, prinCode: string, enquiryNo: string, enquiryType: string) => {
    if (!companyCode || !prinCode || !enquiryNo) return;
    try {
      const data = await executeWmsInboundSql(`
        SELECT * FROM TF_ENQUIRY
        WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
          AND PRIN_CODE = '${sqlEscape(prinCode)}'
          AND ENQUIRY_NR = '${sqlEscape(enquiryNo)}'
          AND ENQUIRY_TYPE = '${sqlEscape(enquiryType || "EQI")}'
      `);
      if (!data.length) return;
      const copied = toHeaderFromEnquiry(normalizeLookupRow(data[0]), header);
      setHeader((current) => ({ ...current, ...copied, enquiry_no: enquiryNo, enquiry_type: enquiryType || copied.enquiry_type || "" }));
      setDetails([buildInitialDetail({ ...header, ...copied }, 1)]);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to copy enquiry data" });
    }
  };

  const approveQuotation = async () => {
    if (!header.quotation_nr) {
      setNotice({ type: "error", text: "Save quotation before approval" });
      return;
    }
    setApproving(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; message?: string }>("/api/freight/quotation/approve", {
        company_code: header.company_code,
        prin_code: header.prin_code,
        quotation_nr: header.quotation_nr,
        approved_by: loginId,
        approval_remarks: "",
      });
      if (response.data?.success === false) throw new Error(response.data.message || "Unable to approve quotation");
      setHeaderField("indstatus", "A");
      setNotice({ type: "success", text: response.data?.message || "Quotation approved" });
      await loadRows();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to approve quotation" });
    } finally {
      setApproving(false);
    }
  };

  const addDetail = () => setDetails((current) => [...current, buildInitialDetail(header, current.length + 1)]);
  const removeDetail = (index: number) => setDetails((current) => current.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, srno: rowIndex + 1 })));
  const addTerm = () => setTerms((current) => [...current, { serial_no: current.length + 1, sr_no: String(current.length + 1), type_ind: "T", description: "", font_type: "Normal", font_size: "Normal" }]);
  const removeTerm = (index: number) => setTerms((current) => current.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, serial_no: rowIndex + 1, sr_no: String(rowIndex + 1) })));

  const saveQuotation = async (event: FormEvent) => {
    event.preventDefault();
    if (isLocked) {
      setNotice({ type: "error", text: "Approved quotation is read-only" });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const payload = {
        header: { ...header, userid: loginId, user_date: new Date().toISOString(), quotation_type: "QTN" },
        details: details.filter((row) => row.act_code.trim()).map((row, index) => ({
          ...row,
          srno: index + 1,
          company_code: header.company_code,
          prin_code: header.prin_code,
          quotation_nr: header.quotation_nr || "0",
          curr_code: row.curr_code || header.curr_code,
          ex_rate: row.ex_rate || header.ex_rate,
          transport_mode: row.transport_mode || header.transport_mode,
          origin_port: row.origin_port || header.origin_port,
          destination_port: row.destination_port || header.destination_port,
          userid: loginId,
          user_dt: new Date().toISOString(),
        })),
        terms,
      };
      const response = await api.post<{ success?: boolean; message?: string; data?: { quotation_nr?: string } }>("/api/freight/quotation/save", payload);
      if (response.data?.success === false) throw new Error(response.data.message || "Unable to save quotation");
      if (response.data?.data?.quotation_nr) setHeaderField("quotation_nr", response.data.data.quotation_nr);
      setNotice({ type: "success", text: response.data?.message || "Quotation saved" });
      await loadRows();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to save quotation. Confirm Oracle quotation SP/types are created." });
    } finally {
      setSaving(false);
    }
  };

  if (view === "list") {
    return (
      <section className="grid gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><FileText size={17} /></div>
            <div>
              <p className="eyebrow mb-0.5">Freight Quotation</p>
              <h1 className="m-0 text-xl font-semibold leading-tight text-foreground">Quotation Listing</h1>
              <p className="m-0 mt-1 text-xs text-muted-foreground">Build quotations from enquiry/RFQ data and maintain charge lines.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {notice && <NoticeChip notice={notice} />}
            <HeaderChip label="Records" value={String(rows.length)} />
            <Button type="button" size="sm" variant="outline" onClick={loadRows} disabled={loading}><RefreshCw size={14} />{loading ? "Loading" : "Refresh"}</Button>
            <Button type="button" size="sm" onClick={startNew}><Plus size={14} />Add Quotation</Button>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={rows}
          title={loading ? "Loading" : `${rows.length} Quotation Records`}
          subtitle="Freight Quotation"
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search quotation, principal, port..."
          loading={loading}
          height="calc(100vh - 240px)"
          minWidth={1380}
          density="grid"
          enablePagination
          pageSize={50}
          enableExport
          exportFilename="freight-quotation-list.csv"
          getRowId={(row, index) => `${lookupText(row, "company_code")}-${lookupText(row, "quotation_nr") || index}`}
          rowClassName={(row) => lookupText(row, "indstatus") === "A" ? "bg-emerald-50/60" : "bg-amber-50/50"}
          onRowClick={openQuotation}
        />
      </section>
    );
  }

  return (
    <>
      <form className="grid gap-1.5" onSubmit={saveQuotation}>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><FileText size={17} /></div>
            <div className="min-w-0">
              <p className="eyebrow mb-0.5">Freight Quotation</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">Quotation</h1>
                <span className="rounded-md border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">{header.quotation_nr || "New quotation"}</span>
                <span className={statusBadgeClass(header.indstatus)}>{header.indstatus === "A" ? "Approved" : "Not Approved"}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>{modeLabel(header.transport_mode)}</span><span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                <span>{jobTypeLabel(header.job_type)}</span><span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                <span>{header.prin_code || "Principal pending"}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={() => setView("list")}><ArrowLeft size={14} />List</Button>
            <HeaderChip label="Route" value={`${header.origin_port || "-"} -> ${header.destination_port || "-"}`} />
            <HeaderChip label="Profit" value={formatAmount(totals.profit)} />
            {notice && <NoticeChip notice={notice} />}
            <Button type="button" size="sm" variant="outline" onClick={() => setAssistOpen((open) => !open)}><Sparkles size={14} />Check{checkCount > 0 && <span className="rounded bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">{checkCount}</span>}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAttachmentOpen(true)}><Paperclip size={14} />Files</Button>
            <Button type="button" size="sm" variant="outline" onClick={copyAsNew} disabled={isLocked || (!header.prin_code && !header.quotation_nr)}><Copy size={14} />Copy</Button>
            <Button type="button" size="sm" variant="outline" onClick={resetForm} disabled={isLocked}><RotateCcw size={14} />Reset</Button>
            {canApprove && (
              <Button type="button" size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={approveQuotation} disabled={approving || saving}>
                <ShieldCheck size={14} />{approving ? "Approving" : "Approve"}
              </Button>
            )}
            <Button type="submit" size="sm" disabled={saving || isLocked}><Save size={14} />{saving ? "Saving" : "Save"}</Button>
          </div>
        </div>

        {assistOpen && <FreightAssistPanel checks={smartChecks} />}

        <fieldset disabled={isLocked} className="contents">
        <section className="rounded-md border bg-card p-1.5 shadow-sm">
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-11">
            <FormInput label="Quotation No" value={header.quotation_nr} onChange={(value) => setHeaderField("quotation_nr", value)} placeholder="Auto" />
            <FormInput label="Date" type="date" value={header.quotation_date} onChange={(value) => setHeaderField("quotation_date", value)} required />
            <FormLookup label="Principal" value={header.prin_code} valueField="prin_code" displayFields={["prin_code", "prin_name"]} columns={[{ field: "prin_code", header: "Code" }, { field: "prin_name", header: "Principal" }, { field: "curr_code", header: "Currency" }]} loadOptions={() => loadPrincipalLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("prin_code", value, row)} required />
            <FormInput label="Department" value={header.dept_code} onChange={(value) => setHeaderField("dept_code", value)} required />
            {!header.quotation_nr ? (
              <FormLookup label="Source Enquiry/RFQ" value={header.enquiry_no} valueField="enquiry_nr" displayFields={["enquiry_nr", "enquiry_date"]} columns={[{ field: "enquiry_nr", header: "Enquiry" }, { field: "enquiry_type", header: "Type" }, { field: "prin_code", header: "Principal" }]} loadOptions={() => loadEnquiryLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("enquiry_no", value, row)} />
            ) : (
              <ReadOnlyField label="Source Enquiry/RFQ" value={header.enquiry_no || "-"} />
            )}
            <FormSelect label="Job Type" value={header.job_type} onChange={(value) => setHeaderField("job_type", value)} options={jobTypes} />
            <FormSelect label="Mode" value={header.transport_mode} onChange={(value) => setHeaderField("transport_mode", value)} options={transportModes} />
            <StatusField status={header.indstatus} />
            <FormInput label="Offer Validity" type="date" value={header.offer_validity} onChange={(value) => setHeaderField("offer_validity", value)} />
            <FormInput label="Contact Person" value={header.contact_person} onChange={(value) => setHeaderField("contact_person", value)} />
            <FormInput label="Subject" value={header.subject} onChange={(value) => setHeaderField("subject", value)} />
          </div>
        </section>

        <div className="grid min-h-0 gap-0 rounded-md border bg-card shadow-sm">
          <div className="flex gap-1 overflow-x-auto p-1">
            {tabs.map((tab) => <TabButton key={tab.key} tab={tab} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} />)}
          </div>
          <div className="min-h-0 border-t p-1.5">
            {activeTab === "summary" && (
              <section className="grid gap-1.5 xl:grid-cols-12">
                <SectionPanel className="xl:col-span-4" icon={FileText} title="Source" meta={header.enquiry_no ? `${header.enquiry_type || "EQI"} / ${header.enquiry_no}` : "Manual quotation"}>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <ReadOnlyField label="Quotation Type" value={header.quotation_type || "QTN"} />
                    <ReadOnlyField label="Status" value={header.indstatus === "A" ? "Approved" : "Not Approved"} />
                    <FormInput label="Contact Person" value={header.contact_person} onChange={(value) => setHeaderField("contact_person", value)} />
                    <FormInput label="Subject" value={header.subject} onChange={(value) => setHeaderField("subject", value)} />
                  </div>
                </SectionPanel>
                <SectionPanel className="xl:col-span-4" icon={CreditCard} title="Commercial" meta={`${header.payment_terms || "Terms"} / ${header.curr_code || "Currency"}`}>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <FormSelect label="INCO" value={header.payment_terms} onChange={(value) => setHeaderField("payment_terms", value)} options={paymentTerms.map((value) => ({ value, label: value }))} />
                    <FormSelect label="Payable At" value={header.tos} onChange={(value) => setHeaderField("tos", value)} options={tosOptions.map((value) => ({ value, label: value }))} />
                    <FormLookup label="Currency" value={header.curr_code} valueField="curr_code" displayFields={["curr_code", "curr_name"]} columns={[{ field: "curr_code", header: "Code" }, { field: "curr_name", header: "Currency" }, { field: "ex_rate", header: "Rate" }]} loadOptions={() => loadCurrencyLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("curr_code", value, row)} />
                    <FormInput label="Exchange Rate" type="number" value={header.ex_rate} onChange={(value) => setHeaderField("ex_rate", value)} />
                  </div>
                </SectionPanel>
                <SectionPanel className="xl:col-span-4" icon={Activity} title="Totals" meta={`Profit ${formatAmount(totals.profit)}`}>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <ReadOnlyField label="Cost" value={formatAmount(totals.cost)} />
                    <ReadOnlyField label="Sell" value={formatAmount(totals.bill)} />
                    <ReadOnlyField label="Agent" value={formatAmount(totals.partners)} />
                    <ReadOnlyField label="Profit" value={formatAmount(totals.profit)} />
                  </div>
                </SectionPanel>
              </section>
            )}

            {activeTab === "cargo" && (
              <section className="grid gap-1.5 xl:grid-cols-12">
                <SectionPanel className="xl:col-span-12 border-primary/15 bg-primary/[0.015]" icon={Activity} title="Commercial Profile" meta={`${header.member_type || "No member"} / ${header.sale_type || "Sale type"} / ${header.job_category || "Category"}`}>
                  <div className="grid gap-1.5 md:grid-cols-[1fr_1fr_1fr_1.2fr]">
                    <FormSelect label="Member Type" value={header.member_type} onChange={(value) => setHeaderField("member_type", value)} options={memberTypes.map((value) => ({ value, label: value || "Blank" }))} />
                    <FormSelect label="Sale Type" value={header.sale_type} onChange={(value) => setHeaderField("sale_type", value)} options={saleTypes.map((value) => ({ value, label: value }))} />
                    <FormSelect label="Job Category" value={header.job_category} onChange={(value) => setHeaderField("job_category", value)} options={jobCategories.map((value) => ({ value, label: value }))} />
                    <div className="grid gap-0.5 rounded-md border bg-muted/25 px-2 py-1">
                      <div className="text-[11px] font-semibold uppercase text-muted-foreground">Quotation Profile</div>
                      <div className="flex flex-wrap gap-1.5">
                        <HeaderChip label="Mode" value={modeLabel(header.transport_mode)} />
                        <HeaderChip label="Type" value={jobTypeLabel(header.job_type)} />
                        <HeaderChip label="Currency" value={`${header.curr_code || "-"} / ${header.ex_rate || "1"}`} />
                      </div>
                    </div>
                  </div>
                </SectionPanel>
                <SectionPanel className="xl:col-span-6" icon={PackageCheck} title="Cargo" meta={`${header.commodity || "Commodity pending"} / ${header.gross_wt || header.weight || "0"} kgs`}>
                  <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
                    <FormLookup label="Commodity" value={header.commodity} valueField="prodtype_desc" displayFields={["prodtype_desc", "prodtype_code"]} columns={[{ field: "prodtype_desc", header: "Commodity" }, { field: "prodtype_code", header: "Code" }]} loadOptions={() => loadCommodityLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("commodity", value, row)} className="xl:col-span-2" />
                    <FormInput label="L" type="number" value={header.l} onChange={(value) => setHeaderField("l", value)} />
                    <FormInput label="B" type="number" value={header.b} onChange={(value) => setHeaderField("b", value)} />
                    <FormInput label="H" type="number" value={header.h} onChange={(value) => setHeaderField("h", value)} />
                    <FormInput label="Volume" type="number" value={header.volume} onChange={(value) => setHeaderField("volume", value)} />
                    <FormInput label="Vol Weight" type="number" value={header.weight} onChange={(value) => setHeaderField("weight", value)} />
                    <FormInput label="Gross Wt" type="number" value={header.gross_wt} onChange={(value) => setHeaderField("gross_wt", value)} />
                  </div>
                </SectionPanel>
                <SectionPanel className="xl:col-span-6" icon={MapPinned} title="Journey" meta={`${header.origin_port || "Origin"} -> ${header.destination_port || "Destination"}`}>
                  <div className="grid gap-1 sm:grid-cols-2">
                    <FormLookup label="Origin Port" value={header.origin_port} valueField="port_code" displayFields={["port_code", "port_name"]} columns={portColumns} loadOptions={() => loadPortLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("origin_port", value, row)} />
                    <FormLookup label="Destination Port" value={header.destination_port} valueField="port_code" displayFields={["port_code", "port_name"]} columns={portColumns} loadOptions={() => loadPortLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("destination_port", value, row)} />
                    <FormInput label="Country Origin" value={header.country_origin} onChange={(value) => setHeaderField("country_origin", value)} />
                    <FormInput label="Country Destn" value={header.country_destination} onChange={(value) => setHeaderField("country_destination", value)} />
                    <FormInput label="Via" value={header.via} onChange={(value) => setHeaderField("via", value)} className="sm:col-span-2" />
                  </div>
                </SectionPanel>
                <SectionPanel className="xl:col-span-7" icon={ShipWheel} title="Carrier And Equipment" meta={`${modeLabel(header.transport_mode)} / ${header.carrier || "Carrier pending"}`}>
                  <div className="grid gap-1 sm:grid-cols-3">
                    <FormLookup key={`carrier-${header.transport_mode}`} label="Carrier" value={header.carrier} {...carrierLookupProps(header.transport_mode, header.company_code)} onChange={(value, row) => applyHeaderLookup("carrier", value, row)} />
                    <FormLookup label="Forwarder" value={header.forwarder_code} valueField="forwarder_code" displayFields={["forwarder_code", "forwarder_name"]} columns={[{ field: "forwarder_code", header: "Code" }, { field: "forwarder_name", header: "Forwarder" }]} loadOptions={() => loadForwarderLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("forwarder_code", value, row)} />
                    <FormInput label="Transit" value={header.transit_time} onChange={(value) => setHeaderField("transit_time", value)} />
                    <FormInput label="Frequency" value={header.frequency} onChange={(value) => setHeaderField("frequency", value)} />
                    <FormInput label="Container Type" value={header.container_type} onChange={(value) => setHeaderField("container_type", value)} />
                    <FormInput label="Containers" type="number" value={header.no_of_contaners} onChange={(value) => setHeaderField("no_of_contaners", value)} />
                    <FormLookup label="Vehicle Type" value={header.vehicle_type} valueField="vtype_code" displayFields={["vtype_code", "vtype_name"]} columns={[{ field: "vtype_code", header: "Code" }, { field: "vtype_name", header: "Vehicle Type" }]} loadOptions={() => loadVehicleTypeLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("vehicle_type", value, row)} />
                    <FormInput label="T/F" value={header.t_f} onChange={(value) => setHeaderField("t_f", value)} />
                  </div>
                </SectionPanel>
                <SectionPanel className="xl:col-span-5" icon={PackageCheck} title="Notes" meta={header.remarks ? "Remarks added" : "No remarks"}>
                  <div className="grid gap-1 sm:grid-cols-2">
                    <FormTextarea label="Cargo Detail" value={header.cargo_detail} onChange={(value) => setHeaderField("cargo_detail", value)} compact />
                    <FormTextarea label="Remarks" value={header.remarks} onChange={(value) => setHeaderField("remarks", value)} compact />
                    <FormTextarea label="Special Instructions" value={header.spl_instructions} onChange={(value) => setHeaderField("spl_instructions", value)} compact className="sm:col-span-2" />
                  </div>
                </SectionPanel>
              </section>
            )}

            {activeTab === "charges" && (
              <section>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="grid gap-1">
                    <h2 className="m-0 text-sm font-semibold uppercase text-muted-foreground">Quotation Rates</h2>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <HeaderChip label="Cost" value={formatAmount(totals.cost)} />
                      <HeaderChip label="Bill" value={formatAmount(totals.bill)} />
                      <HeaderChip label="Agent" value={formatAmount(totals.partners)} />
                      <HeaderChip label="Profit" value={formatAmount(totals.profit)} />
                    </div>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={addDetail}><Plus size={14} />Add Line</Button>
                </div>
                <div className="max-h-[calc(100vh-330px)] overflow-auto rounded-md border">
                  <table className="min-w-[1500px] w-full border-collapse text-xs">
                    <thead>
                      <tr className="sticky top-0 z-10 border-b bg-muted text-left text-[11px] uppercase text-muted-foreground">
                        {["Act", "Activity", "Remarks", "Mode", "Origin", "Dest", "Qty", "UOM", "Cost Cur", "Cost Ex", "Cost Rate", "Cost", "Sell Cur", "Sell Ex", "Sell Rate", "Sell", "Agent FC", "Agent", ""].map((label) => <th key={label} className="px-1.5 py-1.5 font-semibold">{label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {details.map((row, index) => (
                        <tr key={row.srno} className="border-b transition hover:bg-primary/5 last:border-0">
                          <CellInput value={row.act_code} onChange={(value) => setDetailField(index, "act_code", value)} />
                          <CellInput value={row.activity} onChange={(value) => setDetailField(index, "activity", value)} className="min-w-44" />
                          <CellInput value={row.activity_remarks || row.rate_remarks} onChange={(value) => { setDetailField(index, "activity_remarks", value); setDetailField(index, "rate_remarks", value); }} className="min-w-44" />
                          <td className="px-2 py-2"><select className={fieldClassName} value={row.transport_mode} onChange={(event) => setDetailField(index, "transport_mode", event.target.value)}>{transportModes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td>
                          <CellInput value={row.origin_port} onChange={(value) => setDetailField(index, "origin_port", value)} className="w-24" />
                          <CellInput value={row.destination_port} onChange={(value) => setDetailField(index, "destination_port", value)} className="w-24" />
                          <CellInput type="number" value={row.quantity} onChange={(value) => setDetailField(index, "quantity", value)} className="w-24 text-right" />
                          <CellInput value={row.uom} onChange={(value) => setDetailField(index, "uom", value)} className="w-20" />
                          <CellInput value={row.cost_curr_code} onChange={(value) => setDetailField(index, "cost_curr_code", value)} className="w-20" />
                          <CellInput type="number" value={row.cost_ex_rate} onChange={(value) => setDetailField(index, "cost_ex_rate", value)} className="w-24 text-right" />
                          <CellInput type="number" value={row.fc_costrate} onChange={(value) => setDetailField(index, "fc_costrate", value)} className="w-24 text-right" />
                          <CellInput type="number" value={row.cost} onChange={(value) => setDetailField(index, "cost", value)} className="w-24 text-right" />
                          <CellInput value={row.curr_code} onChange={(value) => setDetailField(index, "curr_code", value)} className="w-20" />
                          <CellInput type="number" value={row.ex_rate} onChange={(value) => setDetailField(index, "ex_rate", value)} className="w-24 text-right" />
                          <CellInput type="number" value={row.fc_billrate} onChange={(value) => setDetailField(index, "fc_billrate", value)} className="w-24 text-right" />
                          <CellInput type="number" value={row.bill} onChange={(value) => setDetailField(index, "bill", value)} className="w-24 text-right" />
                          <CellInput type="number" value={row.fc_partners} onChange={(value) => setDetailField(index, "fc_partners", value)} className="w-24 text-right" />
                          <CellInput type="number" value={row.partners_price} onChange={(value) => setDetailField(index, "partners_price", value)} className="w-24 text-right" />
                          <td className="px-2 py-2 text-right"><Button type="button" size="icon" variant="ghost" title="Remove line" disabled={details.length === 1} onClick={() => removeDetail(index)}><Trash2 size={14} /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === "terms" && (
              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="m-0 text-sm font-semibold uppercase text-muted-foreground">Terms And Conditions</h2>
                  <Button type="button" size="sm" variant="outline" onClick={addTerm}><Plus size={14} />Add Term</Button>
                </div>
                <div className="grid gap-2">
                  {terms.length === 0 && <div className="rounded-md border border-dashed bg-muted/25 p-6 text-center text-sm text-muted-foreground">No terms added. Oracle save procedure can also copy defaults from `MS_QUOTE_TERMS`.</div>}
                  {terms.map((term, index) => (
                    <div key={term.serial_no} className="grid gap-2 rounded-md border bg-background p-2 sm:grid-cols-[90px_120px_1fr_40px]">
                      <FormInput label="Sr No" value={term.sr_no} onChange={(value) => setTermField(index, "sr_no", value)} />
                      <FormInput label="Type" value={term.type_ind} onChange={(value) => setTermField(index, "type_ind", value)} />
                      <FormTextarea label="Description" value={term.description} onChange={(value) => setTermField(index, "description", value)} compact />
                      <div className="grid place-items-end"><Button type="button" size="icon" variant="ghost" title="Remove term" onClick={() => removeTerm(index)}><Trash2 size={14} /></Button></div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
        </fieldset>
      </form>
      <AttachmentDialog open={attachmentOpen} onClose={() => setAttachmentOpen(false)} requestNumber={attachmentRequestNumber} title="Quotation Attachments" module="FREIGHT" type="FRT_QUOTATION" companyCode={header.company_code} loginId={loginId} readOnly={!header.quotation_nr} />
    </>
  );
}

function TabButton({ tab, active, onClick }: { tab: { key: FreightQuotationInitialTab; label: string; icon: typeof PackageCheck }; active: boolean; onClick: () => void }) {
  const Icon = tab.icon;
  return <button type="button" onClick={onClick} className={`ui-button ui-button-sm whitespace-nowrap ${active ? "ui-button-default" : "ui-button-outline"}`}><Icon size={14} />{tab.label}</button>;
}

function FreightAssistPanel({ checks }: { checks: SmartCheck[] }) {
  const ready = checks.every((item) => item.tone === "ok");
  return (
    <section className="grid gap-2 rounded-md border bg-card p-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`grid h-8 w-8 place-items-center rounded-md ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{ready ? <ShieldCheck size={16} /> : <Sparkles size={16} />}</span>
          <div><h2 className="m-0 text-sm font-semibold text-foreground">Quotation Assist</h2><p className="m-0 text-xs text-muted-foreground">Checks pricing, route, party, validity and terms before save.</p></div>
        </div>
        <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{ready ? "Ready" : `${checks.filter((item) => item.tone !== "ok").length} to review`}</span>
      </div>
      <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-4">
        {checks.map((check) => <div key={check.title} className={`rounded-md border px-2.5 py-2 ${check.tone === "danger" ? "border-red-200 bg-red-50 text-red-800" : check.tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><div className="flex items-center gap-1.5 text-xs font-semibold">{check.tone === "ok" ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}{check.title}</div><p className="m-0 mt-1 text-[11px] leading-snug opacity-85">{check.detail}</p></div>)}
      </div>
    </section>
  );
}

function SectionPanel({ title, meta, icon: Icon, children, className = "" }: { title: string; meta?: string; icon: typeof PackageCheck; children: React.ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-md border bg-background shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b bg-muted/35 px-2 py-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon size={12} /></span>
          <div className="min-w-0"><h3 className="m-0 truncate text-[11px] font-semibold uppercase text-foreground">{title}</h3>{meta && <p className="m-0 truncate text-[10px] text-muted-foreground">{meta}</p>}</div>
        </div>
      </div>
      <div className="p-1">{children}</div>
    </section>
  );
}

function NoticeChip({ notice }: { notice: Exclude<Notice, null> }) {
  return <span className={`rounded-md border px-2.5 py-1 text-xs font-medium ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.text}</span>;
}

function HeaderChip({ label, value }: { label: string; value: string }) {
  return <span className="inline-flex max-w-52 items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px]"><span className="font-semibold uppercase text-muted-foreground">{label}</span><span className="truncate font-semibold text-foreground">{value}</span></span>;
}

function statusBadgeClass(status: string) {
  return status === "A" ? "inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700" : "inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700";
}

function StatusField({ status }: { status: string }) {
  return (
    <div className="grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
      Status
      <div className="flex h-6 items-center rounded-md border border-input bg-muted/40 px-2">
        <span className={statusBadgeClass(status)}>{status === "A" ? "Approved" : "Not Approved"}</span>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
      {label}
      <div className="flex h-6 items-center rounded-md border border-input bg-muted/40 px-2 text-[11px] font-semibold normal-case text-foreground">
        <span className="truncate">{value || "-"}</span>
      </div>
    </div>
  );
}

function buildInitialHeader(user: Record<string, unknown> | null, target?: FreightWorkspaceTarget): QuotationHeader {
  const company = String(user?.company_code || user?.COMPANY_CODE || "");
  const mode = target?.mode === "sea" ? "S" : target?.mode === "land" ? "R" : "A";
  const jobType = target?.direction === "import" ? "IMP" : "EXP";
  return {
    company_code: company, prin_code: "", quotation_nr: "", quotation_date: toInputDate(new Date()), dept_code: "22",
    job_type: jobType, transport_mode: mode, indstatus: "N", enquiry_no: "", enquiry_type: "", offer_validity: "",
    origin_port: "", destination_port: "", country_origin: "", country_destination: "", via: "", carrier: "", forwarder_code: "",
    salesman_code: "", transit_time: "", frequency: "", commodity: "", cargo_detail: "", remarks: "", l: "", b: "", h: "",
    volume: "0", weight: "0", gross_wt: "", container_type: "STANDARD", no_of_contaners: "", vehicle_type: "", t_f: "T",
    shipment_status: "", payment_terms: "CIF", tos: "ORIGIN", curr_code: "OMR", ex_rate: "1", member_type: "",
    sale_type: "Normal", job_category: "International", spl_instructions: "", walkin_prin_code: "", contact_person: "",
    subject: "", quotation_type: "QTN",
  };
}

function buildInitialDetail(header: QuotationHeader, srno: number): QuotationDetail {
  return {
    srno, act_code: "", activity: "", activity_remarks: "", uoc: "", moc1: "", transport_mode: header.transport_mode,
    origin_port: header.origin_port, destination_port: header.destination_port, quantity: "1", uom: "", rate_remarks: "",
    cost_curr_code: header.curr_code, cost_ex_rate: header.ex_rate, fc_costrate: "0", fc_cost: "0", cost: "0",
    curr_code: header.curr_code, ex_rate: header.ex_rate, fc_billrate: "0", fc_bill: "0", bill: "0",
    partners_curr_code: header.curr_code, partners_ex_rate: header.ex_rate, fc_partners: "0", partners_price: "0",
  };
}

function toHeaderFromRow(row: LookupRow, user: Record<string, unknown> | null, target?: FreightWorkspaceTarget): QuotationHeader {
  const fallback = buildInitialHeader(user, target);
  return {
    ...fallback,
    company_code: lookupText(row, "company_code") || fallback.company_code,
    prin_code: lookupText(row, "prin_code"),
    quotation_nr: lookupText(row, "quotation_nr"),
    quotation_date: toDateInputValue(lookupText(row, "quotation_date")) || fallback.quotation_date,
    dept_code: lookupText(row, "dept_code") || fallback.dept_code,
    job_type: lookupText(row, "job_type") || fallback.job_type,
    transport_mode: lookupText(row, "transport_mode") || fallback.transport_mode,
    indstatus: lookupText(row, "indstatus") || fallback.indstatus,
    enquiry_no: lookupText(row, "enquiry_no"),
    enquiry_type: lookupText(row, "enquiry_type"),
    offer_validity: toDateInputValue(lookupText(row, "offer_validity")),
    origin_port: lookupText(row, "origin_port"),
    destination_port: lookupText(row, "destination_port"),
    country_origin: lookupText(row, "country_origin"),
    country_destination: lookupText(row, "country_destination"),
    via: lookupText(row, "via"),
    carrier: lookupText(row, "carrier"),
    forwarder_code: lookupText(row, "forwarder_code"),
    salesman_code: lookupText(row, "salesman_code"),
    transit_time: lookupText(row, "transit_time"),
    frequency: lookupText(row, "frequency"),
    commodity: lookupText(row, "commodity"),
    cargo_detail: lookupText(row, "cargo_detail"),
    remarks: lookupText(row, "remarks"),
    l: lookupText(row, "l"),
    b: lookupText(row, "b"),
    h: lookupText(row, "h"),
    volume: lookupText(row, "volume") || fallback.volume,
    weight: lookupText(row, "weight") || fallback.weight,
    gross_wt: lookupText(row, "gross_wt"),
    container_type: lookupText(row, "container_type") || fallback.container_type,
    no_of_contaners: lookupText(row, "no_of_contaners"),
    vehicle_type: lookupText(row, "vehicle_type"),
    t_f: lookupText(row, "t_f") || fallback.t_f,
    shipment_status: lookupText(row, "shipment_status"),
    payment_terms: lookupText(row, "payment_terms") || fallback.payment_terms,
    tos: lookupText(row, "tos") || fallback.tos,
    curr_code: lookupText(row, "curr_code") || fallback.curr_code,
    ex_rate: lookupText(row, "ex_rate") || fallback.ex_rate,
    member_type: lookupText(row, "member_type"),
    sale_type: lookupText(row, "sale_type") || fallback.sale_type,
    job_category: lookupText(row, "job_category") || fallback.job_category,
    spl_instructions: lookupText(row, "spl_instructions"),
    walkin_prin_code: lookupText(row, "walkin_prin_code"),
    contact_person: lookupText(row, "contact_person"),
    subject: lookupText(row, "subject"),
    quotation_type: lookupText(row, "quotation_type") || fallback.quotation_type,
  };
}

function toHeaderFromEnquiry(row: LookupRow, fallback: QuotationHeader): Partial<QuotationHeader> {
  return {
    prin_code: lookupText(row, "prin_code") || fallback.prin_code,
    dept_code: lookupText(row, "dept_code") || fallback.dept_code,
    job_type: lookupText(row, "job_type") || fallback.job_type,
    transport_mode: lookupText(row, "transport_mode") || fallback.transport_mode,
    member_type: lookupText(row, "member_type") || fallback.member_type,
    sale_type: lookupText(row, "sale_type") || fallback.sale_type,
    job_category: lookupText(row, "job_category") || fallback.job_category,
    commodity: lookupText(row, "commodity"),
    cargo_detail: lookupText(row, "cargo_detail"),
    remarks: lookupText(row, "remarks"),
    l: lookupText(row, "l"), b: lookupText(row, "b"), h: lookupText(row, "h"), weight: lookupText(row, "weight"), volume: lookupText(row, "volume"),
    origin_port: lookupText(row, "origin_port"), destination_port: lookupText(row, "destination_port"),
    country_origin: lookupText(row, "country_origin"), country_destination: lookupText(row, "country_destination"),
    via: lookupText(row, "via"), carrier: lookupText(row, "carrier"), transit_time: lookupText(row, "transit_time"),
    frequency: lookupText(row, "frequency"), tos: lookupText(row, "tos"), payment_terms: lookupText(row, "payment_terms"),
    curr_code: lookupText(row, "curr_code") || fallback.curr_code, ex_rate: lookupText(row, "ex_rate") || fallback.ex_rate,
    salesman_code: lookupText(row, "salesman_code"), spl_instructions: lookupText(row, "spl_instructions"), forwarder_code: lookupText(row, "forwarder_code"),
    gross_wt: lookupText(row, "gross_wt"), shipment_status: lookupText(row, "shipment_status"), container_type: lookupText(row, "container_type"),
    no_of_contaners: lookupText(row, "no_of_contaners"), vehicle_type: lookupText(row, "vehicle_type"), t_f: lookupText(row, "t_f") || fallback.t_f,
  };
}

function toDetailFromRow(row: LookupRow, header: QuotationHeader, srno: number): QuotationDetail {
  return {
    ...buildInitialDetail(header, srno),
    srno: Number(lookupText(row, "srno")) || srno,
    act_code: lookupText(row, "act_code"),
    activity: lookupText(row, "ms_activity_activity") || lookupText(row, "activity"),
    activity_remarks: lookupText(row, "activity_remarks"),
    uoc: lookupText(row, "uoc"),
    moc1: lookupText(row, "moc1"),
    transport_mode: lookupText(row, "transport_mode") || header.transport_mode,
    origin_port: lookupText(row, "origin_port") || header.origin_port,
    destination_port: lookupText(row, "destination_port") || header.destination_port,
    quantity: lookupText(row, "quantity") || "1",
    uom: lookupText(row, "uom"),
    rate_remarks: lookupText(row, "rate_remarks"),
    cost_curr_code: lookupText(row, "cost_curr_code") || header.curr_code,
    cost_ex_rate: lookupText(row, "cost_ex_rate") || header.ex_rate,
    fc_costrate: lookupText(row, "fc_costrate") || "0",
    fc_cost: lookupText(row, "fc_cost") || "0",
    cost: lookupText(row, "cost") || "0",
    curr_code: lookupText(row, "curr_code") || header.curr_code,
    ex_rate: lookupText(row, "ex_rate") || header.ex_rate,
    fc_billrate: lookupText(row, "fc_billrate") || "0",
    fc_bill: lookupText(row, "fc_bill") || "0",
    bill: lookupText(row, "bill") || "0",
    partners_curr_code: lookupText(row, "partners_curr_code") || header.curr_code,
    partners_ex_rate: lookupText(row, "partners_ex_rate") || header.ex_rate,
    fc_partners: lookupText(row, "fc_partners") || "0",
    partners_price: lookupText(row, "partners_price") || "0",
  };
}

function toTermFromRow(row: LookupRow, index: number): QuotationTerm {
  return {
    serial_no: Number(lookupText(row, "serial_no")) || index,
    sr_no: lookupText(row, "sr_no") || String(index),
    type_ind: lookupText(row, "type_ind"),
    description: lookupText(row, "description"),
    font_type: lookupText(row, "font_type") || "Normal",
    font_size: lookupText(row, "font_size") || "Normal",
  };
}

function recalcDetail(row: QuotationDetail, field: keyof QuotationDetail): QuotationDetail {
  const qty = Number(row.quantity || 0);
  const costEx = Number(row.cost_ex_rate || 0);
  const billEx = Number(row.ex_rate || 0);
  const partnerEx = Number(row.partners_ex_rate || 0);
  const fcCostRate = Number(row.fc_costrate || 0);
  const fcBillRate = Number(row.fc_billrate || 0);
  const fcPartners = Number(row.fc_partners || 0);
  const shouldCost = ["quantity", "fc_costrate", "cost_ex_rate"].includes(field);
  const shouldBill = ["quantity", "fc_billrate", "ex_rate"].includes(field);
  const shouldPartner = ["fc_partners", "partners_ex_rate"].includes(field);
  return {
    ...row,
    ...(shouldCost ? { fc_cost: round3(fcCostRate * qty), cost: round3(fcCostRate * costEx * qty) } : {}),
    ...(shouldBill ? { fc_bill: round3(fcBillRate * qty), bill: round3(fcBillRate * billEx * qty) } : {}),
    ...(shouldPartner ? { partners_price: round3(fcPartners * partnerEx) } : {}),
  };
}

function buildTotals(details: QuotationDetail[]) {
  const sum = (field: keyof QuotationDetail) => details.reduce((total, row) => total + (Number(row[field]) || 0), 0);
  const cost = sum("cost");
  const bill = sum("bill");
  const partners = sum("partners_price");
  return { cost, bill, partners, profit: bill - cost - partners };
}

function buildSmartChecks(header: QuotationHeader, details: QuotationDetail[], terms: QuotationTerm[]): SmartCheck[] {
  const activeDetails = details.filter((row) => row.act_code.trim() || row.activity.trim());
  const missingRates = activeDetails.filter((row) => Number(row.fc_billrate || 0) <= 0).length;
  return [
    header.prin_code ? { tone: "ok", title: "Principal", detail: "Principal is selected." } : { tone: "danger", title: "Principal", detail: "Select principal before saving quotation." },
    header.origin_port && header.destination_port ? { tone: "ok", title: "Route", detail: `${header.origin_port} to ${header.destination_port} is ready.` } : { tone: "danger", title: "Route", detail: "Origin and destination ports are required." },
    header.curr_code && Number(header.ex_rate || 0) > 0 ? { tone: "ok", title: "Currency", detail: `${header.curr_code} rate ${header.ex_rate}.` } : { tone: "danger", title: "Currency", detail: "Currency and exchange rate are required." },
    activeDetails.length ? missingRates ? { tone: "warn", title: "Rates", detail: `${missingRates} line${missingRates === 1 ? "" : "s"} missing selling rate.` } : { tone: "ok", title: "Rates", detail: `${activeDetails.length} charge line${activeDetails.length === 1 ? "" : "s"} ready.` } : { tone: "danger", title: "Rates", detail: "Add at least one quotation charge line." },
    header.enquiry_no ? { tone: "ok", title: "Source", detail: `Copied from ${header.enquiry_type || "enquiry"} ${header.enquiry_no}.` } : { tone: "warn", title: "Source", detail: "Reference enquiry/RFQ is optional, but recommended." },
    terms.length ? { tone: "ok", title: "Terms", detail: `${terms.length} term${terms.length === 1 ? "" : "s"} added.` } : { tone: "warn", title: "Terms", detail: "No terms added. Save SP may copy standard terms from MS_QUOTE_TERMS." },
  ];
}

function FormInput({ label, value, onChange, type = "text", required, placeholder, className = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string; className?: string }) {
  return <label className={`grid gap-0.5 text-[10px] font-semibold uppercase text-muted-foreground ${className}`}>{label}{required && <span className="sr-only">required</span>}<Input className={fieldClassName} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function FormLookup({ label, value, valueField, displayFields, columns, loadOptions, onChange, required, className = "" }: { label: string; value: string; valueField: string; displayFields: string[]; columns: { field: string; header: string }[]; loadOptions: () => Promise<LookupRow[]>; onChange: (value: string, row: LookupRow | null) => void; required?: boolean; className?: string }) {
  return <label className={`grid gap-0.5 text-[10px] font-semibold uppercase text-muted-foreground ${className}`}>{label}{required && <span className="sr-only">required</span>}<LookupField value={value} valueField={valueField} displayFields={displayFields} columns={columns} loadOptions={loadOptions} onChange={onChange} compact /></label>;
}

function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <label className="grid gap-0.5 text-[10px] font-semibold uppercase text-muted-foreground">{label}<select className={fieldClassName} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function FormTextarea({ label, value, onChange, compact, className = "" }: { label: string; value: string; onChange: (value: string) => void; compact?: boolean; className?: string }) {
  return <label className={`grid gap-0.5 text-[10px] font-semibold uppercase text-muted-foreground ${className}`}>{label}<textarea className={`${fieldClassName} ${compact ? "min-h-7" : "min-h-10"} py-0.5`} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function CellInput({ value, onChange, type = "text", className = "" }: { value: string; onChange: (value: string) => void; type?: string; className?: string }) {
  return <td className="px-1 py-0.5"><Input className={`h-6 text-[11px] ${className}`} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></td>;
}

const fieldClassName = "h-6 w-full rounded-md border border-input bg-background px-2 text-[11px] font-semibold text-foreground shadow-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-muted disabled:text-muted-foreground";
const portColumns = [{ field: "port_code", header: "Code" }, { field: "port_name", header: "Port" }, { field: "country_name", header: "Country" }];

async function loadPrincipalLookup(companyCode: string) { return loadFreightLookup(`SELECT p.PRIN_CODE, p.PRIN_NAME, p.PRIN_DEPT_CODE, p.CURR_CODE, c.EX_RATE FROM MS_PRINCIPAL p LEFT JOIN MS_CURRENCY c ON c.COMPANY_CODE = p.COMPANY_CODE AND c.CURR_CODE = p.CURR_CODE WHERE p.COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY p.PRIN_CODE`); }
async function loadEnquiryLookup(companyCode: string) {
  return loadFreightLookup(`
    SELECT ENQUIRY_NR, ENQUIRY_DATE, ENQUIRY_TYPE, PRIN_CODE, JOB_TYPE, TRANSPORT_MODE, DEPT_CODE, CURR_CODE, COMPANY_CODE
    FROM TF_ENQUIRY
    WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
      AND ENQUIRY_TYPE IN ('EQI', 'RFQ')
      AND NVL(INDSTATUS, 'N') = 'A'
    ORDER BY ENQUIRY_DATE DESC, ENQUIRY_NR DESC
  `);
}
async function loadCommodityLookup(companyCode: string) { return loadFreightLookup(`SELECT PRODTYPE_DESC, PRODTYPE_CODE FROM MS_PRODTYPE WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY PRODTYPE_DESC`); }
async function loadPortLookup(companyCode: string) { return loadFreightLookup(`SELECT p.PORT_CODE, p.PORT_NAME, c.COUNTRY_NAME, p.COUNTRY_CODE FROM MS_PORT p LEFT JOIN MS_COUNTRY c ON c.COUNTRY_CODE = p.COUNTRY_CODE WHERE p.COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY p.PORT_CODE`); }
async function loadCurrencyLookup(companyCode: string) { return loadFreightLookup(`SELECT CURR_CODE, CURR_NAME, EX_RATE FROM MS_CURRENCY WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY CURR_CODE`); }
async function loadForwarderLookup(companyCode: string) { return loadFreightLookup(`SELECT FORWARDER_CODE, FORWARDER_NAME FROM MS_FORWARDER WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY FORWARDER_NAME`); }
async function loadVehicleTypeLookup(companyCode: string) { return loadFreightLookup(`SELECT VTYPE_CODE, VTYPE_NAME FROM MS_VEHICLE_TYPE WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY VTYPE_CODE`); }
function carrierLookupProps(mode: string, companyCode: string) { if (mode === "S") return { valueField: "vessel_code", displayFields: ["vessel_code", "vessel_name"], columns: [{ field: "vessel_code", header: "Code" }, { field: "vessel_name", header: "Vessel" }], loadOptions: () => loadFreightLookup(`SELECT VESSEL_CODE, VESSEL_NAME FROM MS_VESSEL WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY VESSEL_CODE`) }; if (mode === "R") return { valueField: "vehicle_no", displayFields: ["vehicle_no", "vehicle_desc"], columns: [{ field: "vehicle_no", header: "Vehicle" }, { field: "vehicle_desc", header: "Description" }], loadOptions: () => loadFreightLookup(`SELECT VEHICLE_NO, VEHICLE_DESC FROM MS_VEHICLE WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY VEHICLE_NO`) }; return { valueField: "airline_code", displayFields: ["airline_code", "airline_name"], columns: [{ field: "airline_code", header: "Code" }, { field: "airline_name", header: "Airline" }], loadOptions: () => loadFreightLookup(`SELECT AIRLINE_CODE, AIRLINE_NAME FROM MS_AIRLINE WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY AIRLINE_CODE`) }; }
async function loadFreightLookup(sql: string) { return (await executeWmsInboundSql(sql)).map(normalizeLookupRow); }

function normalizeLookupRow(row: LookupRow): LookupRow {
  return Object.entries(row || {}).reduce<LookupRow>((acc, [key, value]) => {
    acc[key.toLowerCase()] = value;
    return acc;
  }, {});
}
function lookupText(row: LookupRow | undefined, field: string) { const value = row?.[field] ?? row?.[field.toUpperCase()] ?? row?.[field.toLowerCase()]; return value === null || value === undefined ? "" : String(value); }
function sqlEscape(input: string) { return String(input || "").replace(/'/g, "''"); }
function toInputDate(value: Date) { return value.toISOString().slice(0, 10); }
function toDateInputValue(input: string) { if (!input) return ""; const parsed = new Date(input); if (Number.isNaN(parsed.getTime())) return ""; return parsed.toISOString().slice(0, 10); }
function formatDisplayDate(input: string) { const value = toDateInputValue(input); if (!value) return input || "-"; const [year, month, day] = value.split("-"); return `${day}/${month}/${year}`; }
function modeLabel(mode: string) { return mode === "S" ? "Sea" : mode === "R" ? "Road" : "Air"; }
function jobTypeLabel(jobType: string) { return jobType === "IMP" ? "Import" : "Export"; }
function round3(value: number) { return Number.isFinite(value) ? value.toFixed(3) : "0.000"; }
function formatAmount(value: number) { return value.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }
