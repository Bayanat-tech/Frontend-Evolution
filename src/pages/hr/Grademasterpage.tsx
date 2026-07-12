// src/pages/hr/GradeMasterPage.tsx
//
// Grade Master list page. Structured identically to InterviewEvalPage.tsx:
// DataTable + Dialog-hosted add/edit/view form, getDynamicLookup for list,
// executeDynamicDelete for delete. Save (add/edit) goes through the
// dedicated insUpdHrGrade backend via AddGradeMasterForm, not the dynamic
// proc dispatcher.

import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeCommonProcedure, executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddGradeMasterForm } from "./Addgrademasterform";



export type GradeRow = {
  company_code: string;
  grade_code: string;
  grade_name: string;
  grade_short_name: string;
  ot_eligibility: string;
  grade_status: string;
  status: string;
  airfare_entitlement?: string;
  spouse_af_entitlement?: string;
  dep_af_entitlement?: string;
  medical_entitlement?: string;
  spouse_med_entitlement?: string;
  dep_med_entitlement?: string;
  remarks?: string;
  [key: string]: unknown;
};

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<GradeRow>;
};

// NOTE: reuses the same list proc your old GradeComponentsPage.tsx used
// (MST_HR_MS_HR_Grade_Page). Swap the parameter name if yours differs —
// insUpdHrGrade only covers save, not list/delete.
const baseParams = (loginid: string, companyCode: string) => ({
  parameter: "MST_HR_MS_HR_Grade_Page",
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

export function GradeMasterPage() {
  const { user } = useAuth();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<GradeRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup(baseParams(loginid, companyCode));
      const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      // Keep every field the backend returns (not just a narrow subset) so
      // the edit form can populate directly from the row, same as
      // InterviewEvalPage does for its rows.
      const list: GradeRow[] = raw.map((r) => ({
        ...(r as GradeRow),
        company_code: String(r.company_code ?? r.COMPANY_CODE ?? companyCode),
        grade_code: String(r.grade_code ?? r.GRADE_CODE ?? ""),
        grade_name: String(r.grade_name ?? r.GRADE_NAME ?? ""),
        grade_short_name: String(r.grade_short_name ?? r.GRADE_SHORT_NAME ?? ""),
        ot_eligibility: String(r.ot_eligibility ?? r.OT_ELIGIBILITY ?? "N"),
        grade_status: String(r.grade_status ?? r.GRADE_STATUS ?? ""),
        status: String(r.status ?? r.STATUS ?? "A"),
      }));
      setRows(list);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load grades",
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
        parameter: "MST_HR_GRADE_DELETE",
        loginid,
        code1: deleteTarget.grade_code,
        code2: companyCode,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Grade ${deleteTarget.grade_code} deleted successfully.` });
      await loadRows();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete grade",
      });
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<GradeRow>[]>(
    () => [
      { accessorKey: "grade_code", header: "Grade Code", size: 110, enableSorting: false },
      { accessorKey: "grade_name", header: "Name", size: 220, enableSorting: false },
      { accessorKey: "grade_short_name", header: "Short Name", size: 140, enableSorting: false },
      {
        accessorKey: "ot_eligibility",
        header: "OT Eligible",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => (String(getValue() || "N") === "Y" ? "Yes" : "No"),
      },
      {
        accessorKey: "grade_status",
        header: "Grade Status",
        size: 130,
        enableSorting: false,
        cell: ({ getValue }) => {
          const val = String(getValue() || "");
          if (val === "A") return "Approved";
          if (val === "P") return "Pending";
          return val || "-";
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => {
          const val = String(getValue() || "A");
          return val === "A" ? (
            <span style={{ color: "#16a34a", fontWeight: 600, fontSize: "0.8125rem" }}>Active</span>
          ) : (
            <span style={{ color: "#dc2626", fontWeight: 600, fontSize: "0.8125rem" }}>Inactive</span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 100,
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
          <h1 className="m-0 text-2xl font-semibold text-foreground">HR General Masters - Grades</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Maintain employee grades, entitlements, and pay component bands.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={() => setPopup({ open: true, mode: "add", data: {} })}>
            <Plus size={15} /> Add Grade
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
        title={`${rows.length.toLocaleString()} Grades`}
        subtitle="Grade Master List"
        searchPlaceholder="Search grade code, name..."
        loading={loading}
        height={560}
        minWidth={1000}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => `${row.company_code}-${row.grade_code}`}
      />

      {popup.open && (
        <Dialog
          open
          title={
            popup.mode === "add"
              ? "Add Grade"
              : popup.mode === "edit"
                ? "Edit Grade"
                : "View Grade"
          }
          wide
          onClose={() => setPopup((p) => ({ ...p, open: false }))}
        >
          <AddGradeMasterForm
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
        title="Delete Grade"
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
          Confirm delete for grade <strong>{deleteTarget?.grade_code}</strong>?
        </p>
      </Dialog>
    </section>
  );
}
