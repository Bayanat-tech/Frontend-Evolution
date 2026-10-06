import type { ColumnDef } from "@tanstack/react-table";
import {
  Edit2, Eye, Loader2, Plus, RefreshCw, Save, Send, Trash2, UserPlus, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import {
  AddApplicantForm,
  type ApplicantFormHandle,
  type FormMode,
} from "./Addapplicantform";

type ApplicantInfoRow = {
  doc_no: string;
  doc_date: string;
  doc_type: string;
  doc_ref_no: string;
  cand_no: string;
  cand_name: string;
  pos_appl_for: string;
  dept: string;
  intvr_name: string;
  intrvw_date: string;
  hire_flag: string;
  created_at: string;
  [key: string]: unknown;
};

const baseParams = (loginid: string, companyCode: string) => ({
  parameter: "MST_HR_APPLICANT_INFO",
  loginid,
  code1: companyCode,
  code2: "NULL",
  code3: "NULL",
  code4: "NULL",
  number1: 0,
  number2: 0,
  number3: 0,
  number4: 0,
  date1: null,
  date2: null,
  date3: null,
  date4: null,
});

const parseCreatedAt = (input: unknown): number => {
  if (input === null || input === undefined || input === "") return -Infinity;

  // Some APIs wrap date values as { value: "..." } or { date: "..." }
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const inner = obj.value ?? obj.date ?? obj.iso ?? null;
    if (inner) return parseCreatedAt(inner);
    return -Infinity;
  }

  const raw = String(input).trim();
  if (!raw) return -Infinity;

  // Try as-is first (handles proper ISO strings)
  let t = Date.parse(raw);
  if (!Number.isNaN(t)) return t;

  // "YYYY-MM-DD HH24:MI:SS" -> "YYYY-MM-DDTHH24:MI:SS"
  t = Date.parse(raw.replace(" ", "T"));
  if (!Number.isNaN(t)) return t;

  // Oracle default NLS format: "DD-MON-YY" / "DD-MON-YYYY" (+ optional time)
  const oracleMatch = raw.match(
    /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (oracleMatch) {
    const [, day, monStr, yearStr, hh = "0", mm = "0", ss = "0"] = oracleMatch;
    const months: Record<string, number> = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
    };
    const month = months[monStr.toUpperCase()];
    let year = Number(yearStr);
    if (yearStr.length === 2) year += year < 70 ? 2000 : 1900;
    if (month !== undefined) {
      const d = new Date(year, month, Number(day), Number(hh), Number(mm), Number(ss));
      if (!Number.isNaN(d.getTime())) return d.getTime();
    }
  }

  return -Infinity;
};

// Newest first, keyed on the (hidden) created_at audit column
const sortByCreatedAtDesc = (rows: ApplicantInfoRow[]): ApplicantInfoRow[] =>
  [...rows].sort((a, b) => parseCreatedAt(b.created_at) - parseCreatedAt(a.created_at));

const formatDate = (val: unknown) => {
  if (!val) return "-";
  const d = new Date(String(val));
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString("en-GB");
};

export function ApplicantInfoPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const [rows, setRows] = useState<ApplicantInfoRow[]>([]);
  const [loading, setLoading] = useState(false);

  // inline form (replaces the grid while open)
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("add");
  const [activeRow, setActiveRow] = useState<ApplicantInfoRow | null>(null);
  const [formKey, setFormKey] = useState(0); // remount form when switching rows
  const [saving, setSaving] = useState(false);

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<ApplicantInfoRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ref to the form so the header buttons can trigger it
  const formRef = useRef<ApplicantFormHandle>(null);

  const readonly = formMode === "view";
  const editing = formMode === "edit";

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    try {
      const data = await getDynamicLookup(baseParams(loginid, companyCode));
      const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const list: ApplicantInfoRow[] = raw.map((r) => ({
        ...(r as ApplicantInfoRow),
        // Accept multiple possible key casings/names for the SYSDATE audit column.
        created_at: String(
          r.created_at ?? r.CREATED_AT ?? r.createdAt ?? r.CREATED_DATE ?? r.created_date ?? "",
        ),
      }));
      setRows(sortByCreatedAtDesc(list));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load applicant records");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginid, companyCode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  /* ── Inline form open / close ── */
  const openForm = (mode: FormMode, row: ApplicantInfoRow | null = null) => {
    setFormMode(mode);
    setActiveRow(row);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setFormMode("add");
    setActiveRow(null);
  };

  const handleFormClosed = (shouldRefetch?: boolean) => {
    setFormOpen(false);
    setFormMode("add");
    setActiveRow(null);
    if (shouldRefetch) void loadRows();
  };

  /* ── Delete ── */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await executeDynamicDelete({
        parameter: "HR_CAM_APPLICANT_INFO_DELETE",
        loginid,
        code1: companyCode,
        code2: deleteTarget.doc_type,
        code3: String(deleteTarget.doc_no),
      });
      toast.success(`Document ${deleteTarget.doc_no} deleted successfully`);
      setDeleteTarget(null);
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete applicant record");
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<ApplicantInfoRow>[]>(
    () => [
      // Sorting is disabled on every column: the newest-first order is
      // enforced by sortByCreatedAtDesc() on load. created_at itself is
      // fetched and used for that sort but intentionally not rendered.
      { accessorKey: "doc_no", header: "Doc No", size: 100, enableSorting: false },
      {
        accessorKey: "doc_date",
        header: "Doc Date",
        size: 120,
        enableSorting: false,
        cell: ({ getValue }) => formatDate(getValue()),
      },
      { accessorKey: "doc_ref_no", header: "Ref No", size: 120, enableSorting: false },
      { accessorKey: "cand_name", header: "Candidate Name", size: 180, enableSorting: false },
      { accessorKey: "pos_appl_for", header: "Position", size: 160, enableSorting: false },
      { accessorKey: "dept", header: "Department", size: 140, enableSorting: false },
      { accessorKey: "intvr_name", header: "Interviewer", size: 150, enableSorting: false },
      {
        accessorKey: "intrvw_date",
        header: "Interview Date",
        size: 130,
        enableSorting: false,
        cell: ({ getValue }) => formatDate(getValue()),
      },
      {
        accessorKey: "hire_flag",
        header: "Hire Status",
        size: 110,
        enableSorting: false,
        cell: ({ row }) => {
          const val = (row.original.hire_flag ?? "").toString().toUpperCase();
          if (val === "Y")
            return <span className="text-[0.8125rem] font-semibold text-green-600">Hired</span>;
          if (val === "N")
            return <span className="text-[0.8125rem] font-semibold text-red-600">Rejected</span>;
          return <span className="text-[0.8125rem] text-muted-foreground">-</span>;
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 110,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openForm("edit", row.original)}
              title="Edit"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openForm("view", row.original)}
              title="View"
            >
              <Eye size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => setDeleteTarget(row.original)}
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const formBadge = formMode === "add" ? "Draft" : editing ? "Editing" : "View only";

  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Freight-style transaction header */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <UserPlus size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                HR Recruitment - Applicant Info
              </h1>
              <span className="text-xs text-muted-foreground">
                {rows.length.toLocaleString()} Row{rows.length === 1 ? "" : "s"}
              </span>
              {formOpen && (
                <>
                  <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                    {formBadge}
                  </span>
                  {activeRow?.doc_no && (
                    <span className="text-xs text-muted-foreground">
                      Doc No: {activeRow.doc_no}
                      {activeRow.cand_name ? ` - ${activeRow.cand_name}` : ""}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadRows()}
            disabled={loading || saving}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => openForm("add")} disabled={saving}>
            <Plus size={14} /> Add
          </Button>
          {formOpen && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={closeForm} disabled={saving}>
                <X size={14} /> Close
              </Button>
              {!readonly && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void formRef.current?.saveDraft()}
                    disabled={saving}
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
                    {saving ? "Saving" : "Save as Draft"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => formRef.current?.submit()}
                    disabled={saving}
                  >
                    <Send size={14} /> Submit
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add / Edit / View form — replaces the grid while open */}
      {formOpen ? (
        <AddApplicantForm
          key={formKey}
          ref={formRef}
          mode={formMode}
          existingData={activeRow}
          onClose={handleFormClosed}
          onSavingChange={setSaving}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          title={loading ? "Loading" : `${rows.length.toLocaleString()} Records`}
          subtitle="Applicant Info List"
          searchPlaceholder="Search doc no, candidate, department..."
          loading={loading}
          emptyText="No applicant records found. Click Add to create one."
          height={560}
          minWidth={1100}
          density="grid"
          enablePagination
          pageSize={100}
          getRowId={(row) => `${row.doc_type}-${row.doc_no}`}
        />
      )}

      {/* Delete confirmation */}
      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete Applicant"
        description="This action cannot be undone."
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          Confirm delete for document <strong>{deleteTarget?.doc_no}</strong>?
        </p>
      </Dialog>
    </section>
  );
}