import { Loader2, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { DataTable } from "../../../components/ui/DataTable";
import { executeHrRawSql } from "../../../api/hr";
import { TLeaveApproval } from "./leave-approval-types";
import LeaveResumptionForm from "./LeaveResumptionForm";

export function LeaveResumptionApprovalPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const loginId = String(user?.loginid1 || user?.LOGINID1 || user?.loginid || user?.LOGINID || "");

  const [rows, setRows] = useState<TLeaveApproval[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Page state: "list" shows the grid, "editor" shows the form as a full page (same as Leave Request)
  const [view, setView] = useState<"list" | "editor">("list");
  const [editData, setEditData] = useState<TLeaveApproval | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const compCode = String(user?.COMPANY_CODE || user?.company_code || "00001");

  const buildSql = (login: string, comp: string) => `
    SELECT *
    FROM VW_LEAVE_REQUEST_FLOW_CLOSE
    WHERE (COMPANY_CODE = '${comp}' OR '${comp}' = '')
    AND (
      (ACTUAL_RESUME_DATE IS NULL
        AND RESUME_DATE_APPROVED IS NULL
        AND FINAL_APPROVED = 'YES'
        AND CREATED_BY = '${login}')
      OR (ACTUAL_RESUME_DATE IS NOT NULL
        AND NVL(RESUME_DATE_APPROVED, 'NO') = 'NO'
        AND FINAL_APPROVED = 'YES' AND NEXT_ACTION_BY = 'APPROVED')
    )
  `;

  const loadRows = async () => {
    if (!loginId) {
      setRows([]);
      return;
    }

    setLoading(true);
    try {
      if (user?.tenantName === "WMSTST") {
        try {
          const response = await executeHrRawSql(buildSql(loginId, compCode));
          setRows((response ?? []) as TLeaveApproval[]);
        } catch (error) {
          console.warn("Unable to load leave resumption approvals with company code filter:", error);
          try {
            const fallbackSql = `
              SELECT *
              FROM VW_LEAVE_REQUEST_FLOW_CLOSE
              WHERE (ACTUAL_RESUME_DATE IS NULL AND RESUME_DATE_APPROVED IS NULL AND FINAL_APPROVED = 'YES' AND CREATED_BY = '${loginId}')
                OR (ACTUAL_RESUME_DATE IS NOT NULL AND NVL(RESUME_DATE_APPROVED, 'NO') = 'NO' AND FINAL_APPROVED = 'YES' AND NEXT_ACTION_BY = 'APPROVED')
            `;
            const fallbackRes = await executeHrRawSql(fallbackSql);
            setRows((fallbackRes ?? []) as TLeaveApproval[]);
          } catch (fallbackError) {
            console.warn("Fallback query also failed:", fallbackError);
          }
        }
      } else {
        // ---- All other tenants: alternate view/query ----
        const sql_string = `
          SELECT *
          FROM VW_HR_LEAVE_REQUEST_FLOW
          WHERE ( ACTUAL_RESUME_DATE IS NULL
          AND NVL(RESUME_DATE_APPROVED,'NO') = 'NO'
            AND FINAL_APPROVED = 'YES'
            AND LAST_ACTION IN ('SAVEASDRAFT','SUBMITTED')
            AND CREATED_BY = '${user?.loginid1}')
        `;
        const response = await executeHrRawSql(sql_string);
        setRows((response ?? []) as TLeaveApproval[]);
      }
    } catch (error) {
      console.warn("Unable to load leave resumption approvals:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [loginId, compCode]);

  const openEdit = async (requestNumber: string) => {
    setView("editor");
    setEditLoading(true);
    setEditData(null);
    try {
      const editsql = (requestNumber: string) => `
      SELECT *
      FROM VW_LEAVE_REQUEST_FLOW_CLOSE
      WHERE company_code = '${user?.COMPANY_CODE}'
      AND request_number = '${requestNumber}'
      ORDER BY request_number ASC
      `;
      const res = await executeHrRawSql(editsql(requestNumber));
      const found = (res ?? []) as TLeaveApproval[];
      // Fall back to the grid row if the lookup view returns nothing (e.g. other tenants).
      setEditData(found[0] ?? rows.find((r) => r.REQUEST_NUMBER === requestNumber) ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load leave request");
      setEditData(rows.find((r) => r.REQUEST_NUMBER === requestNumber) ?? null);
    } finally {
      setEditLoading(false);
    }
  };

  const closeEditor = () => {
    setView("list");
    setEditData(null);
  };

  const columns = useMemo<ColumnDef<TLeaveApproval>[]>(
    () => [
      {
        accessorKey: "REQUEST_NUMBER",
        header: "REQUEST NO",
        size: 130,
        cell: ({ row }) => (
          <button
            className="font-semibold text-[#00378C] hover:underline text-left text-[11.5px] cursor-pointer"
            type="button"
            onClick={() => void openEdit(row.original.REQUEST_NUMBER)}
            title="Open leave resumption"
          >
            {row.original.REQUEST_NUMBER || "-"}
          </button>
        ),
      },
      {
        accessorKey: "REQUEST_DATE",
        header: "DATE",
        size: 100,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">{formatDate(row.original.REQUEST_DATE)}</span>
        ),
      },
      {
        accessorKey: "EMPLOYEE_NAME_DISPLAY",
        header: "EMPLOYEE NAME",
        minSize: 180,
        cell: ({ row }) => (
          <div className="truncate" title={String(row.original.EMPLOYEE_NAME_DISPLAY || "")}>
            <span className="text-[11.5px] text-foreground">{row.original.EMPLOYEE_NAME_DISPLAY || "-"}</span>
          </div>
        ),
      },
      {
        accessorKey: "LEAVE_TYPE_DESC",
        header: "LEAVE TYPE",
        size: 140,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground font-medium">{row.original.LEAVE_TYPE_DESC || "-"}</span>
        ),
      },
      {
        accessorKey: "LEAVE_START_DATE",
        header: "START DATE",
        size: 100,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">{formatDate(row.original.LEAVE_START_DATE)}</span>
        ),
      },
      {
        accessorKey: "LEAVE_END_DATE",
        header: "END DATE",
        size: 100,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">{formatDate(row.original.LEAVE_END_DATE)}</span>
        ),
      },
      {
        accessorKey: "ACTUAL_RESUME_DATE",
        header: "ACTUAL RESUME",
        size: 110,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">{formatDate(row.original.ACTUAL_RESUME_DATE)}</span>
        ),
      },
      {
        accessorKey: "DUTY_RESUME_DATE",
        header: "DUTY RESUME",
        size: 110,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">{formatDate(row.original.DUTY_RESUME_DATE)}</span>
        ),
      },
      {
        accessorKey: "REMARKS",
        header: "REMARKS",
        size: 150,
        cell: ({ row }) => (
          <div className="truncate" title={String(row.original.REMARKS || "")}>
            <span className="text-[11.5px] text-muted-foreground">{row.original.REMARKS || "-"}</span>
          </div>
        ),
      },
      {
        accessorKey: "NEXT_ACTION_BY_NAME",
        header: "NEXT ACTION BY",
        size: 160,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">{row.original.NEXT_ACTION_BY_NAME || "-"}</span>
        ),
      },
      {
        id: "actions",
        header: "ACTIONS",
        size: 80,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              title="Open leave resumption"
              aria-label="Open leave resumption"
              onClick={() => void openEdit(row.original.REQUEST_NUMBER)}
            >
              <Pencil size={13} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows]
  );

  return (
    <section className="leave-resumption-freight-view grid gap-2">
      {view === "editor" ? (
        editLoading ? (
          <div className="flex h-[calc(100dvh-150px)] items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="animate-spin" size={16} />
            Loading leave request...
          </div>
        ) : (
          <LeaveResumptionForm
            data={editData}
            isEditMode
            onClose={closeEditor}
            onSuccess={() => {
              closeEditor();
              void loadRows();
            }}
          />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 py-1">
            <div className="flex items-center gap-2.5">
              <h2
                className="text-foreground m-0"
                style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
              >
                Leave Resumption
              </h2>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={rows}
            searchValue={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search leave resumption approvals..."
            loading={loading}
            emptyText="No leave resumption approvals found"
            density="grid"
            height="calc(100dvh - 180px)"
            minWidth={1200}
            enablePagination
            enableExport
            exportFilename="Leave_Resumption_Approvals.csv"
            pageSize={25}
            getRowId={(row, index) => `${row.REQUEST_NUMBER ?? index}`}
          />
        </>
      )}
    </section>
  );
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-GB");
}

export default LeaveResumptionApprovalPage;