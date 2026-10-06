import type { ColumnDef } from "@tanstack/react-table";
import {
  ClipboardCheck, Edit2, Eye, Loader2, Plus, RefreshCw, Save, Trash2, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import {
  AddHrManpowerForm,
  type FormMode,
  type ManpowerFormHandle,
} from "./AddHrManpower";

export type TManpowerTransaction = {
  company_code?: string;
  doc_type?: string;
  doc_no?: string | number;
  doc_ref_no?: string;
  cand_no?: string;
  cand_name?: string;
  desig?: string;
  grade?: string;
  division?: string;
  reviewer?: string;
  doj?: string;
  conf_due_dt?: string;
  kr_1?: string;
  kr_2?: string;
  kr_3?: string;
  kr_4?: string;
  kr_5?: string;
  assesmnt_area1?: string;
  assesmnt_area2?: string;
  assesmnt_area3?: string;
  assesmnt_area4?: string;
  assesmnt_area5?: string;
  rating_1?: string;
  rating_2?: string;
  rating_3?: string;
  rating_4?: string;
  rating_5?: string;
  comment1?: string;
  comment2?: string;
  comment3?: string;
  comment4?: string;
  comment5?: string;
  confirmed?: string;
  extended?: string;
  extended_till?: string;
  sign_1?: string;
  date_1?: string;
  sign_2?: string;
  date_2?: string;
  sign_3?: string;
  date_3?: string;
  user_id?: string;
  user_dt?: string;
  doc_date?: string;
  [key: string]: unknown;
};

const baseParams = (loginid: string, companyCode: string) => ({
  parameter: "HR_TRANSACTIONS_MEMO_AND_FORMS_HR_CONF_REVW_FORM_LIST",
  loginid,
  code1: companyCode,
  code2: "",
  code3: "",
  code4: "",
  number1: 0,
  number2: 0,
  number3: 0,
  number4: 0,
  date1: null,
  date2: null,
  date3: null,
  date4: null,
});

const sortByDocNoDesc = (rows: TManpowerTransaction[]): TManpowerTransaction[] =>
  [...rows].sort((a, b) => Number(b.doc_no ?? 0) - Number(a.doc_no ?? 0));

export function HrManpowerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const [rows, setRows] = useState<TManpowerTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  // inline form (replaces the grid while open)
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("add");
  const [activeRow, setActiveRow] = useState<TManpowerTransaction | null>(null);
  const [formKey, setFormKey] = useState(0); // remount form when switching rows
  const [saving, setSaving] = useState(false);

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<TManpowerTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ref to the form so the header Save button can trigger it
  const formRef = useRef<ManpowerFormHandle>(null);

  const readonly = formMode === "view";
  const editing = formMode === "edit";

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    try {
      const data = await getDynamicLookup(baseParams(loginid, companyCode));
      const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const list: TManpowerTransaction[] = raw.map((r) => ({
        ...(r as TManpowerTransaction),
        doc_no: (r.doc_no ?? r.DOC_NO ?? "") as string | number,
      }));
      setRows(sortByDocNoDesc(list));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load confirmation review records",
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginid, companyCode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  /* ── Inline form open / close ── */
  const openForm = (mode: FormMode, row: TManpowerTransaction | null = null) => {
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

  /* ── Header Save button handler ── */
  const handleHeaderSave = async () => {
    setSaving(true);
    try {
      await formRef.current?.save();
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await executeDynamicDelete({
        parameter: "HR_TRANSACTION_MEMO_AND_FORMS_MAN_POWER_REQUISITION_DELETE",
        loginid,
        code1: String(deleteTarget.doc_no ?? ""),
        code2: companyCode,
      });
      toast.success(`Document ${deleteTarget.doc_no} deleted successfully`);
      setDeleteTarget(null);
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete record");
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<TManpowerTransaction>[]>(
    () => [
      { accessorKey: "doc_ref_no", header: "Ref No", size: 130 },
      { accessorKey: "cand_no", header: "Candidate No", size: 130 },
      { accessorKey: "cand_name", header: "Candidate Name", size: 220 },
      { accessorKey: "desig", header: "Designation", size: 160 },
      { accessorKey: "grade", header: "Grade", size: 110 },
      {
        id: "actions",
        header: "Actions",
        size: 110,
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
            <ClipboardCheck size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                HR Transactions - Confirmation Review Form
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
                      Doc No: {String(activeRow.doc_no)}
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
                <Button type="button" size="sm" onClick={() => void handleHeaderSave()} disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
                  {saving ? "Saving" : editing ? "Update" : "Save"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add / Edit / View form — replaces the grid while open */}
      {formOpen ? (
        <AddHrManpowerForm
          key={formKey}
          ref={formRef}
          mode={formMode}
          existingData={activeRow}
          onClose={handleFormClosed}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          title={loading ? "Loading" : `${rows.length.toLocaleString()} Records`}
          subtitle="Confirmation Review Form List"
          searchPlaceholder="Search ref no, candidate..."
          loading={loading}
          emptyText="No confirmation review records found. Click Add to create one."
          height={560}
          minWidth={900}
          density="grid"
          enablePagination
          pageSize={100}
          getRowId={(row) => String(row.doc_no)}
        />
      )}

      {/* Delete confirmation */}
      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete Confirmation Review Form"
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
          Confirm delete for document <strong>{String(deleteTarget?.doc_no ?? "")}</strong>?
        </p>
      </Dialog>
    </section>
  );
}