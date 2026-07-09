import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddHrManpowerForm } from "./AddHrManpower";

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

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<TManpowerTransaction>;
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
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const [rows, setRows] = useState<TManpowerTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<TManpowerTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup(baseParams(loginid, companyCode));
      const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const list: TManpowerTransaction[] = raw.map((r) => ({
        ...(r as TManpowerTransaction),
        doc_no: (r.doc_no ?? r.DOC_NO ?? "") as string | number,
      }));
      setRows(sortByDocNoDesc(list));
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load confirmation review records",
      });
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setNotice(null);
    try {
      await executeDynamicDelete({
        parameter: "HR_TRANSACTION_MEMO_AND_FORMS_MAN_POWER_REQUISITION_DELETE",
        loginid,
        code1: String(deleteTarget.doc_no ?? ""),
        code2: companyCode,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Document ${deleteTarget.doc_no} deleted successfully.` });
      await loadRows();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete record",
      });
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
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              title="Edit"
              onClick={() => setPopup({ open: true, mode: "edit", data: row.original })}
            >
              <Edit2 size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="View"
              onClick={() => setPopup({ open: true, mode: "view", data: row.original })}
            >
              <Eye size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Delete"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Confirmation Review Form</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Manage employee confirmation review and manpower requisition records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={() => setPopup({ open: true, mode: "add", data: {} })}>
            <Plus size={15} /> Add Record
          </Button>
        </div>
      </div>

      {notice && (
        <div className={notice.type === "error" ? "alert error" : "alert success"}>
          {notice.message}
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        title={`${rows.length.toLocaleString()} Records`}
        subtitle="Confirmation Review Form List"
        searchPlaceholder="Search ref no, candidate..."
        loading={loading}
        height={560}
        minWidth={900}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => String(row.doc_no)}
      />

      {popup.open && (
        <Dialog
          open
          title={
            popup.mode === "add"
              ? "Add Confirmation Review Form"
              : popup.mode === "edit"
                ? "Edit Confirmation Review Form"
                : "View Confirmation Review Form"
          }
          wide
          onClose={() => setPopup((p) => ({ ...p, open: false }))}
        >
          <AddHrManpowerForm
            mode={popup.mode}
            existingData={popup.data}
            onClose={(shouldRefetch?: boolean) => {
              setPopup((p) => ({ ...p, open: false }));
              if (shouldRefetch) void loadRows();
            }}
          />
        </Dialog>
      )}

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
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Confirm delete for document <strong>{deleteTarget?.doc_no}</strong>?
        </p>
      </Dialog>
    </section>
  );
}