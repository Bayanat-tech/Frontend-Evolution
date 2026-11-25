import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft, Edit2, FileText, Loader2, Plus, Printer, Save, Trash2, Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { NewReportDialog } from "../../components/new_report_format";
import { useAuth } from "../../state/AuthContext";
import { formatDate } from "../../hooks/apiDate";
import AddManReqHrForm, { type ManReqFormHandle } from "./AddManReqHrForm";

export type TManReqHr = {
  company_code: string;
  doc_type: string;
  doc_no: number | null;
  doc_ref_no: string;
  pos_title: string;
  no_of_pos: number | null;
  reports_to: string;
  dept: string;
  req_date: Date | null;
  dept_mgr: string;
  total_exp: number | null;
  rev_exp: number | null;
  qual: string;
  sal_range_frm: number | null;
  sal_range_to: number | null;
  req_skills: string;
  sec_skills: string;
  role_desc: string;
  req_reason: string;
  disqual: string;
  tgt_company: string;
  other_info: string;
  sign_1: string;
  sign_2: string;
  sign_3: string;
  sign_4: string;
  comments: string;
  user_id: string;
  user_dt: Date | null;
  doc_date: Date | null;
};

type Editor = { editMode: boolean; row?: TManReqHr } | null;

const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => (v == null || v === "" ? null : Number(v));
const d = (v: unknown) => (v ? new Date(v as string) : null);


export const mapManReqHr = (raw: Record<string, unknown>): TManReqHr => {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) r[k.toLowerCase()] = v;

  return {
    company_code: s(r.company_code),
    doc_type:     s(r.doc_type),
    doc_no:       n(r.doc_no),
    doc_ref_no:   s(r.doc_ref_no),
    pos_title:    s(r.pos_title),
    no_of_pos:    n(r.no_of_pos),
    reports_to:   s(r.reports_to),
    dept:         s(r.dept),
    req_date:     d(r.req_date),
    dept_mgr:     s(r.dept_mgr),
    total_exp:    n(r.total_exp),
    rev_exp:      n(r.rev_exp),
    qual:         s(r.qual),
    sal_range_frm: n(r.sal_range_frm),
    sal_range_to:  n(r.sal_range_to),
    req_skills:   s(r.req_skills),
    sec_skills:   s(r.sec_skills),
    role_desc:    s(r.role_desc),
    req_reason:   s(r.req_reason),
    disqual:      s(r.disqual),
    tgt_company:  s(r.tgt_company),
    other_info:   s(r.other_info),
    sign_1:       s(r.sign_1),
    sign_2:       s(r.sign_2),
    sign_3:       s(r.sign_3),
    sign_4:       s(r.sign_4),
    comments:     s(r.comments),
    user_id:      s(r.user_id),
    user_dt:      d(r.user_dt),
    doc_date:     d(r.doc_date),
  };
};

export function ManReqMasterPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";
  const queryKey = useMemo(() => ["man-req-hr", companyCode], [companyCode]);

  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TManReqHr | null>(null);

  /* ── Print dialog state ── */
  const [printTarget, setPrintTarget] = useState<TManReqHr | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printHtml, setPrintHtml] = useState<string | null>(null);
  const [printExporting, setPrintExporting] = useState(false);

  const formRef = useRef<ManReqFormHandle>(null);

  /* ── Requisitions ── */
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<TManReqHr[]> => {
      const response = await getDynamicLookup({
        parameter: "MSEHR_TRANSACTIONS_HR_MAN_REQ",
        loginid,
        code1: companyCode,
      });
      return ((Array.isArray(response) ? response : []) as Record<string, unknown>[]).map(mapManReqHr);
    },
    enabled: !!companyCode,
  });

  useEffect(() => {
    if (error) toast.error(error instanceof Error ? error.message : "Unable to load requisitions");
  }, [error, toast]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(term)),
    );
  }, [query, rows]);

  /* ── Delete ── */
  const deleteMutation = useMutation({
    mutationFn: (row: TManReqHr) =>
      executeDynamicDelete({
        parameter: "MSEHR_TRANSACTIONS_HR_MAN_REQ_DELETE",
        loginid,
        code1: String(row.doc_no ?? ""),
        code2: companyCode,
      }),
    onSuccess: () => {
      toast.success("Requisition deleted");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to delete requisition"),
  });

  /* ── Print ── */
  const openPrint = useCallback(
    async (row: TManReqHr) => {
      setPrintTarget(row);
      setPrintHtml(null);
      setPrintError(null);
      setPrintOpen(true);
      setPrintLoading(true);
      try {
        const res = await api.post(
          "/api/hr/hr-reports/manpower-requisition/print/html",
          { company_code: companyCode, doc_no: String(row.doc_no ?? ""), loginid },
          { responseType: "text", headers: { Accept: "text/html" }, transformResponse: [(d) => d] },
        );
        const data = res.data;
        if (typeof data === "string" && data.trim().startsWith("{")) {
          const json = JSON.parse(data);
          if (json?.success === false) throw new Error(json.message || "No data found");
        }
        setPrintHtml(typeof data === "string" ? data : String(data));
      } catch (e: any) {
        let msg = e?.message || "Unable to generate report";
        const d = e?.response?.data;
        if (typeof d === "string") { try { msg = JSON.parse(d)?.message || d; } catch { msg = d; } }
        else if (d?.message) msg = d.message;
        setPrintError(msg);
      } finally {
        setPrintLoading(false);
      }
    },
    [companyCode, loginid],
  );

  const exportPrintExcel = useCallback(async () => {
    if (!printTarget) return;
    setPrintExporting(true);
    try {
      const res = await api.post(
        "/api/hr/hr-reports/manpower-requisition/print/excel",
        { company_code: companyCode, doc_no: String(printTarget.doc_no ?? ""), loginid },
        { responseType: "blob" },
      );
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Requisition_${printTarget.doc_no ?? "doc"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setPrintError(e?.response?.data?.message || e?.message || "Excel export failed");
    } finally {
      setPrintExporting(false);
    }
  }, [printTarget, companyCode, loginid]);

  const closePrint = () => {
    setPrintOpen(false);
    setPrintTarget(null);
    setPrintHtml(null);
    setPrintError(null);
  };

  const openPrintInNewWindow = useCallback(() => {
    if (!printHtml) return;
    const w = window.open("", "_blank");
    if (w) { w.document.write(printHtml); w.document.close(); }
  }, [printHtml]);

  /* ── Editor ── */
  const openAdd = () => setEditor({ editMode: false });
  const openEdit = useCallback((row: TManReqHr) => setEditor({ editMode: true, row }), []);
  const backToList = () => setEditor(null);
  const handleSaved = () => {
    setEditor(null);
    queryClient.invalidateQueries({ queryKey });
  };

  const handleHeaderSave = async () => {
    setSaving(true);
    try { await formRef.current?.save(); }
    finally { setSaving(false); }
  };

  /* ── Columns ── */
  const columns = useMemo<ColumnDef<TManReqHr>[]>(
    () => [
      { accessorKey: "doc_no",     header: "Doc No",        size: 80 },
      { accessorKey: "doc_type",   header: "Type",          size: 60 },
      { accessorKey: "doc_ref_no", header: "Ref No",        size: 100 },
      { accessorKey: "pos_title",  header: "Position Title", size: 220 },
      { accessorKey: "dept",       header: "Department",    size: 140 },
      { accessorKey: "no_of_pos",  header: "Positions",     size: 80 },
      {
        accessorKey: "req_date", header: "Request Date", size: 110,
        cell: ({ getValue }) => formatDate(getValue()),
      },
      { accessorKey: "dept_mgr",   header: "Dept Manager",  size: 140 },
      {
        id: "actions", header: "Actions", size: 120, enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openPrint(row.original)}
              title="Print requisition"
            >
              <Printer size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEdit(row.original)}
              title="Edit requisition"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => setDeleteTarget(row.original)}
              title="Delete requisition"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    [openEdit, openPrint],
  );

  /* ── Editor view ── */
  if (editor) {
    const { editMode, row } = editor;
    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                  HR Manpower Requisition
                </h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {editMode ? "Editing" : "New"}
                </span>
                {editMode && row && (
                  <span className="text-xs text-muted-foreground">
                    {row.doc_no ?? ""}
                    {row.pos_title ? ` - ${row.pos_title}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={backToList} disabled={saving}>
              <ArrowLeft size={14} /> Back to List
            </Button>
            <Button type="button" size="sm" onClick={handleHeaderSave} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
              {saving ? "Saving" : "Save"}
            </Button>
          </div>
        </div>

        <AddManReqHrForm
          key={row?.doc_no ?? "new"}
          ref={formRef}
          isEditMode={editMode}
          existingData={editMode ? row : undefined}
          onSaved={handleSaved}
        />
      </section>
    );
  }

  /* ── List view ── */
  return (
    <section className="freight-workspace-ui freight-ui-standard grid gap-2">
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Users size={15} />
          </div>
          <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
            HR Manpower Requisition
          </h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" onClick={openAdd}>
            <Plus size={14} /> New Requisition
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        title={isLoading ? "Loading" : `${filteredRows.length.toLocaleString()} Requisitions`}
        subtitle="Manpower Requisition List"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search position, department, doc no..."
        loading={isLoading}
        emptyText="No requisition found"
        height={620}
        minWidth={1000}
        density="grid"
        getRowId={(row) => String(row.doc_no ?? `${row.doc_ref_no}-${row.pos_title}`)}
      />

      <NewReportDialog
        open={printOpen}
        onClose={closePrint}
        title={printTarget ? `Requisition - ${printTarget.doc_no ?? ""}` : "Requisition"}
        htmlContent={printHtml}
        loading={printLoading}
        error={printError}
        onExportExcel={exportPrintExcel}
        exportingExcel={printExporting}
        onOpenInNewWindow={openPrintInNewWindow}
      />

      <Dialog
        open={!!deleteTarget}
        title="Delete Requisition"
        description={deleteTarget ? `Delete requisition ${deleteTarget.doc_no ?? ""}?` : undefined}
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          This action cannot be undone. Are you sure you want to delete this requisition?
        </p>
      </Dialog>
    </section>
  );
}

export default ManReqMasterPage;