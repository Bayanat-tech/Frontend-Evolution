import type { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, Building2, Download, Edit2, Eye, FileText, List, MapPinned, Plus, Save, Trash2, X } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { BiscDatePicker } from "../../components/ui/BiscDatePicker";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { DivisionPickerDialog } from "../../components/ui/DivisionPickerDialog";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";
import { formatDate } from "../../utils/date";
import { createPortal } from "react-dom";

// ===================== TYPES =====================
export type TAssetTransferHeader = {
  doc_no: string;
  company_code: string;
  doc_type: string;
  doc_date: string;
  site_from: string;
  site_from_name: string;
  site_to: string;
  site_to_name: string;
  remarks: string;
  confirmed: string;
  div_code: string;
  div_name: string;
};

export type TAssetTransferDetail = {
  id: string;
  serial_no: number;
  asset_id: string;
  asset_name: string; // shown as "Description" (read-only, from asset master)
  site_from: string;
  site_to: string;
  emp_id_from: string;
  emp_name_from: string;
  emp_id_to: string;
  emp_name_to: string;
  remarks: string;
};

export type TAssetTransferFormValues = TAssetTransferHeader & { detail: TAssetTransferDetail[] };

type TDivisionOption = { div_code: string; div_name: string };

type PopupState =
  | { open: false }
  | { open: true; mode: "create"; div_code: string; div_name: string; doc_no?: undefined }
  | { open: true; mode: "edit" | "view"; div_code: string; div_name: string; doc_no: string };

// ===================== LIMITS =====================
const HDR_REMARKS_MAX = 250;
const DET_REMARKS_MAX = 250;
const DOC_TYPE = "ATR";

// ===================== HELPERS =====================
const pad = (n: number) => String(n).padStart(2, "0");
const localYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => localYmd(new Date());

function dateInput(value: unknown): string {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s.slice(0, 10) : localYmd(d);
}

function display(code: string, name: string) {
  return code ? (name ? `${code} - ${name}` : code) : "";
}

const siteColumns = [{ field: "site_code", header: "Location" }, { field: "site_name", header: "Name" }];
const assetColumns = [{ field: "asset_id", header: "Asset ID" }, { field: "asset_name", header: "Asset Name" }];
const employeeColumns = [{ field: "employee_code", header: "Employee" }, { field: "rpt_name", header: "Name" }];
const ERR_CLS = "!border-rose-500 !ring-rose-400";

function mapHeader(row: LookupRow): TAssetTransferHeader {
  const g = (k: string) => String(getLookupValue(row, k) || "");
  return {
    doc_no: g("doc_no"), company_code: g("company_code"), doc_type: g("doc_type") || DOC_TYPE,
    doc_date: g("doc_date"),
    site_from: g("site_from"), site_from_name: g("site_from_name"),
    site_to: g("site_to"), site_to_name: g("site_to_name"),
    remarks: g("remarks"), confirmed: g("confirmed") || "N",
    div_code: g("div_code"), div_name: g("div_name"),
  };
}

function newRow(serial_no: number): TAssetTransferDetail {
  return {
    id: crypto.randomUUID(), serial_no,
    asset_id: "", asset_name: "", site_from: "", site_to: "",
    emp_id_from: "", emp_name_from: "", emp_id_to: "", emp_name_to: "", remarks: "",
  };
}

function validateTransfer(v: TAssetTransferFormValues) {
  const h: Record<string, string> = {};
  const l: Record<string, Record<string, string>> = {};

  if (!v.doc_date) h.doc_date = "Doc Date is required";
  if (!v.site_from) h.site_from = "Location From is required";
  if (!v.site_to) h.site_to = "Location To is required";
  if (v.site_from && v.site_to && v.site_from === v.site_to) h.site_to = "Location To must differ from Location From";
  if (v.remarks.length > HDR_REMARKS_MAX) h.remarks = `Max ${HDR_REMARKS_MAX} (${v.remarks.length})`;
  if (v.detail.length === 0) h._lines = "Add at least one detail line";

  const seen = new Set<string>();
  v.detail.forEach((r) => {
    const e: Record<string, string> = {};
    if (!r.asset_id) e.asset_id = "Asset is required";
    else if (seen.has(r.asset_id)) e.asset_id = "Duplicate asset";
    else seen.add(r.asset_id);
    if (r.remarks.length > DET_REMARKS_MAX) e.remarks = `Max ${DET_REMARKS_MAX} (${r.remarks.length})`;
    if (Object.keys(e).length) l[r.id] = e;
  });
  return { h, l };
}

// ===================== UI PIECES =====================
function Req() {
  return <span className="text-destructive font-bold ml-0.5" style={{ color: "#E24B4A" }}>*</span>;
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <span data-error="true" className="text-[10px] text-destructive flex items-center gap-1 mt-0.5">
      <AlertCircle size={10} /> {error}
    </span>
  );
}

function Block({ label, required, error, className, children }: {
  label: string; required?: boolean; error?: string; className?: string; children: ReactNode;
}) {
  return (
    <div className={`freight-master-field ${className || ""}`}>
      <label className="freight-master-label"><span>{label}</span>{required && <Req />}</label>
      {children}
      <FieldError error={error} />
    </div>
  );
}

function FormCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="freight-master-form-card">
      <div className="freight-master-form-header">
        <h3><span className="freight-section-icon">{icon}</span>{title}</h3>
      </div>
      <div className="freight-master-form-body">{children}</div>
    </div>
  );
}

// ===================== LISTING PAGE =====================
export function AssetTransferPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";

  const [rows, setRows] = useState<TAssetTransferHeader[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [divisionOpen, setDivisionOpen] = useState(false);
  const [divisions, setDivisions] = useState<TDivisionOption[]>([]);
  const [loadingDivisions, setLoadingDivisions] = useState(false);

  const [popup, setPopup] = useState<PopupState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<TAssetTransferHeader | null>(null);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "AC_ASSETS_TRANSFER",
        loginid: loginId,
        code1: companyCode, code2: "", code3: "", code4: "",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      });
      setRows(
        data.map(mapHeader).sort((a, b) =>
          b.doc_no.localeCompare(a.doc_no, undefined, { numeric: true, sensitivity: "base" })
        )
      );
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load asset transfers" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRows(); }, []);

  const loadDivisions = async () => {
    setLoadingDivisions(true);
    try {
      const data = await getDynamicLookup({
        parameter: "Account_division",
        loginid: loginId,
        code1: companyCode, code2: "", code3: "", code4: "",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      });
      setDivisions(data.map((row) => ({
        div_code: String(getLookupValue(row, "div_code") || ""),
        div_name: String(getLookupValue(row, "div_name") || ""),
      })));
    } catch {
      // silently fail
    } finally {
      setLoadingDivisions(false);
    }
  };

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(term)));
  }, [query, rows]);

  const openRow = (row: TAssetTransferHeader, mode: "edit" | "view") => {
    setNotice(null);
    setPopup({ open: true, mode, doc_no: row.doc_no, div_code: row.div_code, div_name: row.div_name });
  };

  const columns = useMemo<ColumnDef<TAssetTransferHeader>[]>(() => [
    {
      accessorKey: "doc_no",
      header: () => <div className="font-bold">Document No</div>,
      size: 140,
      cell: ({ row, getValue }) => (
        <button
          type="button"
          onClick={() => openRow(row.original, "edit")}
          className="doc-no-link text-primary font-semibold hover:underline cursor-pointer text-left bg-transparent border-none p-0"
          title={`Open ${String(getValue() || "")}`}
        >
          {String(getValue() || "")}
        </button>
      ),
    },
    {
      accessorKey: "doc_date",
      header: () => <div className="text-center w-full font-bold">Date</div>,
      size: 120,
      cell: ({ getValue }) => <div className="text-center">{formatDate(getValue())}</div>,
    },
    { accessorKey: "site_from", header: "Location From", size: 160 },
    { accessorKey: "site_to", header: "Location To", size: 160 },
    { accessorKey: "div_code", header: "Division", size: 120 },
    { accessorKey: "remarks", header: "Remarks", size: 260 },
    {
      id: "actions",
      header: () => <div className="text-center w-full font-bold">Actions</div>,
      enableSorting: false,
      size: 130,
      minSize: 130,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          <Button size="icon" variant="ghost" title="View" onClick={() => openRow(row.original, "view")}><Eye size={15} /></Button>
          <Button size="icon" variant="ghost" title="Edit" onClick={() => openRow(row.original, "edit")}><Edit2 size={15} /></Button>
          <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleteTarget(row.original)}><Trash2 size={15} /></Button>
        </div>
      ),
    },
  ], []);

  const deleteRow = async () => {
    if (!deleteTarget) return;
    try {
      await executeDynamicDelete({
        parameter: "AC_ASSETS_delete_AC_TRANSFER",
        loginid: loginId,
        code1: companyCode,
        code2: deleteTarget.doc_no,
      });
      const id = deleteTarget.doc_no;
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Asset transfer ${id} deleted successfully` });
      await loadRows(false);
    } catch (error: any) {
      setDeleteTarget(null);
      setNotice({
        type: "error",
        message: error?.response?.data?.message || (error instanceof Error ? error.message : "Unable to delete asset transfer"),
      });
    }
  };

  // ===================== EDITOR VIEW =====================
  if (popup.open) {
    return (
      <AssetTransferEditor
        key={`${popup.mode}_${popup.doc_no || "new"}`}
        mode={popup.mode}
        doc_no={popup.doc_no}
        div_code={popup.div_code}
        div_name={popup.div_name}
        companyCode={companyCode}
        loginId={loginId}
        onClose={() => { setNotice(null); setPopup({ open: false }); }}
        onSaved={async (message) => {
          setPopup({ open: false });
          setNotice({ type: "success", message });
          await loadRows(false);
        }}
      />
    );
  }

  // ===================== LIST VIEW =====================
  return (
    <section className="finance-utility-page finance-list-page grid gap-4">
      <div className="tariff-page-header flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="tariff-page-icon"><Building2 size={20} /></span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">Asset Transfer</h1>
           </div>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <div className="min-h-[650px]">
        <DataTable
          columns={columns}
          data={filteredRows}
          title={loading ? "Loading" : `${filteredRows.length} Records`}
          subtitle="Transfers"
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search transfer..."
          loading={loading}
          emptyText="No asset transfers found"
          height={650}
          minWidth={1120}
          density="grid"
          enableExport={false}
          actionButton={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className="h-8 gap-1.5 px-3.5 rounded-lg bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold cursor-pointer transition-colors"
                title="Create Transfer"
                onClick={() => { setNotice(null); setDivisionOpen(true); void loadDivisions(); }}
              >
                <Plus size={14} strokeWidth={2.5} /> Add
              </Button>
              <FinanceListActionsMenu
                onExport={() => exportToCsv(filteredRows, columns.filter((c) => c.id !== "actions"), "asset-transfer.csv")}
                onRefresh={() => void loadRows(false)}
              />
            </div>
          }
          getRowId={(row, index) => `${row.doc_no || "new"}_${index}`}
        />
      </div>

      <DivisionPickerDialog
        open={divisionOpen}
        divisions={divisions}
        loading={loadingDivisions}
        description="Choose a division to create a new asset transfer."
        onSelect={(div) => {
          setDivisionOpen(false);
          setNotice(null);
          setPopup({ open: true, mode: "create", div_code: div.div_code, div_name: div.div_name });
        }}
        onClose={() => setDivisionOpen(false)}
      />

      {deleteTarget && (
        <Dialog
          open
          compact
          tone="danger"
          title="Delete Transfer"
          description="This action cannot be undone."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void deleteRow()}>Delete</Button>
            </>
          }
        >
          <p className="modal-copy">Delete <strong>{deleteTarget.doc_no}</strong>?</p>
        </Dialog>
      )}
    </section>
  );
}

// ===================== EDITOR (HEADER + DETAIL) =====================
function AssetTransferEditor({
  mode, doc_no, div_code, div_name, companyCode, loginId, onClose, onSaved,
}: {
  mode: "create" | "edit" | "view";
  doc_no?: string;
  div_code: string;
  div_name: string;
  companyCode: string;
  loginId: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const isReadOnly = mode === "view";
  const isEdit = mode === "edit";

  const [loading, setLoading] = useState(Boolean(doc_no));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lineErrors, setLineErrors] = useState<Record<string, Record<string, string>>>({});
  const [remarksFocus, setRemarksFocus] = useState(false);
  const [remarksPos, setRemarksPos] = useState<{ left: number; top: number } | null>(null);

  const [values, setValues] = useState<TAssetTransferFormValues>({
    company_code: companyCode, doc_type: DOC_TYPE, doc_no: "", doc_date: today(),
    site_from: "", site_from_name: "", site_to: "", site_to_name: "",
    remarks: "", confirmed: "N", div_code, div_name, detail: [],
  });

  const loader = (parameter: string) => () =>
    getDynamicLookup({
      parameter, loginid: loginId, code1: companyCode, code2: "", code3: "", code4: "",
      number1: 0, number2: 0, number3: 0, number4: 0,
      date1: null, date2: null, date3: null, date4: null,
    });

  // ----- load existing -----
  useEffect(() => {
    if (!doc_no) return;
    let mounted = true;
    const params = {
      loginid: loginId, code1: companyCode, code2: doc_no, code3: DOC_TYPE, code4: "",
      number1: 0, number2: 0, number3: 0, number4: 0,
      date1: null, date2: null, date3: null, date4: null,
    };
    const load = async () => {
      try {
        const [hdrRows, detRows] = await Promise.all([
          getDynamicLookup({ parameter: "AC_ASSETS_TRANSFER", ...params }),
          getDynamicLookup({ parameter: "AC_ASSETS_TRANSFER_DET", ...params }),
        ]);
        if (!mounted) return;
        const h = hdrRows.find((r) => String(getLookupValue(r, "doc_no") || "") === String(doc_no));
        if (!h) throw new Error(`Transfer ${doc_no} not found`);
        const g = (k: string) => String(getLookupValue(h, k) || "");
        const detail: TAssetTransferDetail[] = detRows.map((row: LookupRow, i: number) => {
          const d = (k: string) => String(getLookupValue(row, k) || "");
          return {
            id: crypto.randomUUID(),
            serial_no: Number(getLookupValue(row, "serial_no") || i + 1),
            asset_id: d("asset_id"), asset_name: d("asset_name"),
            site_from: d("site_from"), site_to: d("site_to"),
            emp_id_from: d("emp_id_from"), emp_name_from: d("emp_name_from"),
            emp_id_to: d("emp_id_to"), emp_name_to: d("emp_name_to"),
            remarks: d("remarks"),
          };
        });
        setValues((prev) => ({
          ...prev,
          company_code: g("company_code") || prev.company_code,
          doc_no: g("doc_no"),
          doc_date: dateInput(g("doc_date")) || prev.doc_date,
          site_from: g("site_from"), site_from_name: g("site_from_name"),
          site_to: g("site_to"), site_to_name: g("site_to_name"),
          remarks: g("remarks"),
          confirmed: g("confirmed") || "N",
          div_code: g("div_code") || div_code, div_name: g("div_name") || div_name,
          detail,
        }));
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Unable to load transfer");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [doc_no]);

  // ----- setters -----
  const setField = (field: keyof TAssetTransferHeader, value: string) => {
    setValues((p) => ({ ...p, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  };

  const addLine = () => {
    if (isReadOnly) return;
    setValues((p) => ({ ...p, detail: [...p.detail, newRow(p.detail.length + 1)] }));
    setFieldErrors((p) => { const n = { ...p }; delete n._lines; return n; });
  };

  const removeLine = (id: string) =>
    setValues((p) => ({
      ...p,
      detail: p.detail.filter((r) => r.id !== id).map((r, i) => ({ ...r, serial_no: i + 1 })),
    }));

  const updateLine = (id: string, patch: Partial<TAssetTransferDetail>) => {
    setValues((p) => ({ ...p, detail: p.detail.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
    setLineErrors((p) => {
      if (!p[id]) return p;
      const row = { ...p[id] };
      Object.keys(patch).forEach((k) => delete row[k]);
      return { ...p, [id]: row };
    });
  };

  const [retrieving, setRetrieving] = useState(false);

const retrieveAssets = async () => {
  if (isReadOnly) return;
  setRetrieving(true);
  setError("");
  try {
    const data = await loader("AC_ASSETS_SearchID")();
    if (!data.length) {
      setError("No assets found to retrieve.");
      return;
    }
    setValues((p) => {
      const existing = new Set(p.detail.map((r) => r.asset_id));
      const fresh = data
        .map((row: LookupRow) => ({
          asset_id: String(getLookupValue(row, "asset_id") || ""),
          asset_name: String(getLookupValue(row, "asset_name") || ""),
        }))
        .filter((a) => a.asset_id && !existing.has(a.asset_id));

      const added = fresh.map((a, i) => ({
        ...newRow(p.detail.length + i + 1),
        asset_id: a.asset_id,
        asset_name: a.asset_name,
      }));
      return { ...p, detail: [...p.detail, ...added] };
    });
    setFieldErrors((p) => { const n = { ...p }; delete n._lines; return n; });
  } catch (e) {
    setError(e instanceof Error ? e.message : "Unable to retrieve assets");
  } finally {
    setRetrieving(false);
  }
};

  // ----- submit -----
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (isEdit && !values.doc_no) { setError("Transfer not loaded. Close and reopen."); return; }

    const { h, l } = validateTransfer(values);
    setFieldErrors(h);
    setLineErrors(l);
    const all = [...Object.values(h), ...Object.values(l).flatMap((r) => Object.values(r))];
    if (all.length) {
      setError(
        all.some((m) => /Max|Duplicate|must differ/.test(m))
          ? "Please correct the highlighted fields."
          : h._lines && Object.keys(h).length === 1 && !Object.keys(l).length
          ? h._lines
          : "Kindly fill in the missing fields."
      );
      setTimeout(() => document.querySelector("[data-error='true']")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      return;
    }

    const resolvedDivCode = values.div_code || div_code || "";
    if (!resolvedDivCode) { setError("Division Code is missing."); return; }

    setSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      const result: any = await postFinance("insUpdTrAcAssetTransferBulk", {
        header: {
          company_code: companyCode,
          doc_type: values.doc_type,
          doc_no: values.doc_no || null,
          doc_date: values.doc_date,
          site_from: values.site_from,
          site_to: values.site_to,
          remarks: values.remarks,
          user_id: loginId,
          user_dt: now,
          last_serial_no: values.detail.length,
          confirmed: values.confirmed,
          div_code: resolvedDivCode,
        },
        details: values.detail.map((row, index) => ({
          company_code: companyCode,
          doc_type: values.doc_type,
          doc_no: values.doc_no || null,
          serial_no: index + 1,
          asset_id: row.asset_id,
          site_from: values.site_from,
          site_to: values.site_to,
          emp_id_from: row.emp_id_from,
          emp_id_to: row.emp_id_to,
          remarks: row.remarks,
          user_id: loginId,
          user_dt: now,
          div_code: resolvedDivCode,
        })),
      });
      // const savedNo = String(result?.doc_no ?? result?.data?.doc_no ?? values.doc_no ?? "").trim();
      
      // console.log("insUpdTrAcAssetTransferBulk result:", result);
      // const savedNo = String(
      //  result?.doc_no ?? result?.data?.doc_no ?? result?.data?.data?.doc_no ?? result?.header?.doc_no ?? result?.data?.header?.doc_no ?? result?.DOC_NO ?? result?.data?.DOC_NO ?? values.doc_no ?? "").trim();
      const savedNo = String(result?.doc_no ?? values.doc_no ?? "").trim();
      await onSaved(`Asset transfer ${isEdit ? "updated" : "created"} successfully${savedNo ? ` — Doc No: ${savedNo}` : ""}`);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.details ||
        (err instanceof Error ? err.message : "Unable to save transfer")
      );
    } finally {
      setSaving(false);
    }
  };

  const title = mode === "create" ? "New Asset Transfer" : mode === "edit" ? "Edit Asset Transfer" : "View Asset Transfer";
  const remarksLeft = HDR_REMARKS_MAX - values.remarks.length;

  return (
    <section
  className="freight-airline-tariff-screen flex flex-col gap-2 freight-ui-standard freight-dense-form h-full min-h-0 p-2"
  style={{ display: "flex", flexDirection: "column", width: "100%", maxWidth: "none", marginLeft: 0 }}
>
    {/* <section className="freight-airline-tariff-screen flex flex-col gap-2 freight-ui-standard freight-dense-form h-full min-h-0 p-2"> */}
      {/* ===== HEADER BAR ===== */}
      {/* <div className="tariff-page-header flex flex-wrap items-center justify-between gap-2 shrink-0"> */}
      <div
         className="tariff-page-header flex flex-wrap items-center justify-between gap-2 shrink-0"
         style={{ height: "auto", minHeight: 56, maxHeight: "none", overflow: "visible" }}
      > 
        <div className="flex min-w-0 items-center gap-3">
          <span className="tariff-page-icon"><MapPinned size={20} /></span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">{title}</h1>
            {/* <p className="m-0 text-xs text-slate-500">
              Doc No: {values.doc_no || "Autogenerated"} | 
              {/* Division: {values.div_code ? `${values.div_code} – ${values.div_name}` : "—"} */}
            {/* </p>  */}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-md border bg-secondary px-3 py-1 text-right">
            <span className="block text-[10px] uppercase leading-tight text-muted-foreground">Lines</span>
            <strong className="text-sm tabular-nums">{values.detail.length}</strong>
          </div>
          {!isReadOnly && (
            <Button
              type="submit" form="asset-transfer-form" disabled={saving || loading}
              className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-4 rounded-lg cursor-pointer transition-colors"
            >
              {saving ? <span className="spinner small" /> : <Save size={14} />}
              {saving ? "Saving..." : isEdit ? "Update" : "Save"}
            </Button>
          )}
          <Button type="button" variant="outline" size="icon" onClick={onClose} disabled={saving}
            aria-label="Close form" title="Close form" className="h-8 w-8 rounded-lg">
            <X size={16} />
          </Button>
        </div>
      </div>

      <AutoDismissAlert notice={error ? { type: "error", message: error } : null} onClose={() => setError("")} />

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {loading ? (
          <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">Loading transfer...</div>
        ) : (
          <form className="flex flex-col gap-2" id="asset-transfer-form" onSubmit={handleSubmit} noValidate>
            {/* ===== TOP ROW: DOCUMENT + LOCATION ===== */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 items-start">
              <FormCard icon={<FileText size={16} />} title="Document Details">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Block label="Doc No">
                    <input className="freight-master-input" value={values.doc_no || "Autogenerated"} disabled readOnly />
                  </Block>
                  <Block label="Doc Date" required error={fieldErrors.doc_date}>
                    <BiscDatePicker compact disabled={isReadOnly} value={values.doc_date}
                      error={Boolean(fieldErrors.doc_date)} onChange={(v) => setField("doc_date", v)} />
                  </Block>
                  {/* <Block label="Doc Type">
                    <input className="freight-master-input" value={values.doc_type} disabled readOnly />
                  </Block> */}
                  {/* <Block label="Division" className="col-span-1 sm:col-span-2">
                    <input className="freight-master-input" value={display(values.div_code, values.div_name)} disabled readOnly />
                  </Block> */}
                  <Block label="Division">
                    <input className="freight-master-input" value={display(values.div_code, values.div_name)} disabled readOnly />
                  </Block>

                  <Block label="Confirm">
                   <label className="flex h-8 cursor-pointer items-center gap-2 text-xs">
                   <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer"
                    checked={values.confirmed === "Y"}
                    disabled={isReadOnly}
                    onChange={(e) => setField("confirmed", e.target.checked ? "Y" : "N")}
                    />
                     {/* Confirmed */}
                    </label>
                 </Block>
                </div>
              </FormCard>

              <FormCard icon={<MapPinned size={16} />} title="Location Details">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Block label="Location From" required error={fieldErrors.site_from}>
                    <LookupField compact value={values.site_from}
                      displayValue={display(values.site_from, values.site_from_name)}
                      columns={siteColumns} valueField="site_code" displayFields={["site_code", "site_name"]}
                      disabled={isReadOnly} loadOptions={loader("AC_ASSETS_SITE")}
                      onChange={(value, row) => {
                        setField("site_from", value);
                        setField("site_from_name", String(getLookupValue(row || {}, "site_name") || ""));
                      }} />
                  </Block>
                  <Block label="Location To" required error={fieldErrors.site_to}>
                    <LookupField compact value={values.site_to}
                      displayValue={display(values.site_to, values.site_to_name)}
                      columns={siteColumns} valueField="site_code" displayFields={["site_code", "site_name"]}
                      disabled={isReadOnly} loadOptions={loader("AC_ASSETS_SITE")}
                      onChange={(value, row) => {
                        setField("site_to", value);
                        setField("site_to_name", String(getLookupValue(row || {}, "site_name") || ""));
                      }} />
                  </Block>

                  <div className="freight-master-field relative col-span-1 sm:col-span-2">
                    <label className="freight-master-label"><span>Remarks</span></label>
                    <textarea
                      className={`freight-master-input min-h-[60px] ${fieldErrors.remarks ? ERR_CLS : ""}`}
                      value={values.remarks} maxLength={HDR_REMARKS_MAX} disabled={isReadOnly}
                      onChange={(e) => setField("remarks", e.target.value)}
                    //   onFocus={() => setRemarksFocus(true)} onBlur={() => setRemarksFocus(false)}
                    // />
                    // {remarksFocus && !isReadOnly && (
                    //   <div className={`absolute left-0 top-full z-20 mt-1 w-fit min-w-[200px] rounded-lg px-3 py-1.5 font-mono text-[11px] text-white shadow-lg ${remarksLeft <= 0 ? "bg-rose-600" : "bg-[#00378C]"}`}>
                    //     {values.remarks.length} / {HDR_REMARKS_MAX} characters ( {remarksLeft} left)
                    //   </div>
                    // )}

                     onFocus={(e) => {
                     const r = e.currentTarget.getBoundingClientRect();
                     const below = r.bottom + 4;
                       setRemarksPos({ left: r.left, top: below + 36 > window.innerHeight ? r.top - 38 : below });
                       setRemarksFocus(true);
                      }}
                       onBlur={() => setRemarksFocus(false)}
                     />
                       {remarksFocus && !isReadOnly && remarksPos && createPortal(
                   <div
                      style={{ position: "fixed", left: remarksPos.left, top: remarksPos.top, zIndex: 9999 }}
                      className={`pointer-events-none w-fit min-w-[200px] rounded-lg px-3 py-1.5 font-mono text-[11px] text-white shadow-lg ${remarksLeft <= 0 ? "bg-rose-600" : "bg-[#00378C]"}`}
                      >
                       {values.remarks.length} / {HDR_REMARKS_MAX} characters ( {remarksLeft} left)
                    </div>,
                       document.body
                     )}
                    <FieldError error={fieldErrors.remarks} />
                  </div>
                </div>
              </FormCard>
            </div>

            {/* ===== LINE ITEMS ===== */}
            <div className="freight-master-form-card">
              <div className="freight-master-form-header flex items-center justify-between">
                <h3>
                  <span className="freight-section-icon"><List size={16} /></span>
                  Transfer Detail Lines
                  {/* <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{values.detail.length}</span> */}
                </h3>
                {!isReadOnly && (
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void retrieveAssets()} disabled={retrieving}>
                    <Download size={14} /> {retrieving ? "Retrieving..." : "Retrieve"}
                  </Button>
                  <Button type="button" size="sm" onClick={addLine} className="commercial-add-line-btn">
                    <Plus size={14} /> Add Line
                  </Button>
                 </div>
                )}
              </div>
              <div className="freight-master-form-body">
                <FieldError error={fieldErrors._lines} />
                <div className="max-h-[50vh] min-h-[200px] overflow-auto rounded-md border">
                  <table className="finance-lines-table w-full min-w-[1100px] text-xs">
                    <thead className="sticky top-0 z-10 bg-[#00378C] text-white">
                      <tr>
                        <th className="w-12 px-2 py-2 text-left">SrNo</th>
                        <th className="w-[260px] px-2 py-2 text-left">Asset ID <Req /></th>
                        <th className="w-[260px] px-2 py-2 text-left">Description</th>
                        <th className="w-[220px] px-2 py-2 text-left">Custodian From</th>
                        <th className="w-[220px] px-2 py-2 text-left">Custodian To</th>
                        <th className="min-w-[200px] px-2 py-2 text-left">Remarks</th>
                        {!isReadOnly && <th className="w-16 px-2 py-2 text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {values.detail.length === 0 ? (
                        <tr>
                          <td colSpan={isReadOnly ? 6 : 7} className="px-3 py-10 text-center text-muted-foreground">
                            No lines yet{!isReadOnly && <> — click <strong>Add Line</strong></>}
                          </td>
                        </tr>
                      ) : values.detail.map((row) => {
                        const re = lineErrors[row.id] || {};
                        return (
                          <tr key={row.id} className="border-t align-top odd:bg-muted/20">
                            <td className="px-2 py-1.5">{row.serial_no}</td>
                            <td className="px-1 py-1">
                              <LookupField compact placeholder="Asset" value={row.asset_id} displayValue={row.asset_id}
                                columns={assetColumns} valueField="asset_id" displayFields={["asset_id", "asset_name"]}
                                disabled={isReadOnly} loadOptions={loader("AC_ASSETS_SearchID")}
                                onChange={(value, r) =>
                                  updateLine(row.id, { asset_id: value, asset_name: String(getLookupValue(r || {}, "asset_name") || "") })
                                } />
                              <FieldError error={re.asset_id} />
                            </td>
                            <td className="px-1 py-1">
                              <input className="freight-master-input" value={row.asset_name} title={row.asset_name} disabled readOnly />
                            </td>
                            <td className="px-1 py-1">
                              <LookupField compact placeholder="Custodian From" value={row.emp_id_from}
                                displayValue={display(row.emp_id_from, row.emp_name_from)}
                                columns={employeeColumns} valueField="employee_code" displayFields={["employee_code", "rpt_name"]}
                                disabled={isReadOnly} loadOptions={loader("AC_ASSETS_SearchEmp")}
                                onChange={(value, r) =>
                                  updateLine(row.id, { emp_id_from: value, emp_name_from: String(getLookupValue(r || {}, "rpt_name") || "") })
                                } />
                            </td>
                            <td className="px-1 py-1">
                              <LookupField compact placeholder="Custodian To" value={row.emp_id_to}
                                displayValue={display(row.emp_id_to, row.emp_name_to)}
                                columns={employeeColumns} valueField="employee_code" displayFields={["employee_code", "rpt_name"]}
                                disabled={isReadOnly} loadOptions={loader("AC_ASSETS_SearchEmp")}
                                onChange={(value, r) =>
                                  updateLine(row.id, { emp_id_to: value, emp_name_to: String(getLookupValue(r || {}, "rpt_name") || "") })
                                } />
                            </td>
                            <td className="px-1 py-1">
                              <input className={`freight-master-input ${re.remarks ? ERR_CLS : ""}`}
                                value={row.remarks} maxLength={DET_REMARKS_MAX} disabled={isReadOnly}
                                onChange={(e) => updateLine(row.id, { remarks: e.target.value })} />
                              <FieldError error={re.remarks} />
                            </td>
                            {!isReadOnly && (
                              <td className="px-1 py-1 text-center">
                                <button type="button" title="Delete row" onClick={() => removeLine(row.id)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 cursor-pointer">
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}