import { Pencil, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
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

  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRequestNumber, setSelectedRequestNumber] = useState<string | null>(null);
  const [editData, setEditData] = useState<TLeaveApproval | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const buildSql = (login: string) => `
    SELECT *
    FROM VW_LEAVE_REQUEST_FLOW_CLOSE
    WHERE COMPANY_CODE = '${user?.company_code}'
    AND ( ACTUAL_RESUME_DATE IS NULL
      AND RESUME_DATE_APPROVED IS NULL
      AND FINAL_APPROVED = 'YES'
      AND CREATED_BY = '${login}')
    OR (ACTUAL_RESUME_DATE IS NOT NULL
      AND NVL(RESUME_DATE_APPROVED, 'NO') = 'NO'
      AND FINAL_APPROVED = 'YES' AND NEXT_ACTION_BY = 'APPROVED')
  `;

    const loadRows = async () => {
        if (!loginId) {
        setRows([]);
        toast.error("Login id is missing for leave resumption lookup");
        return;
        }
        setLoading(true);
        try {
        const response = await executeHrRawSql(buildSql(loginId));
        setRows((response ?? []) as TLeaveApproval[]);
        } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load leave resumption approvals");
        } finally {
        setLoading(false);
        }
    };

  useEffect(() => {
    void loadRows();
  }, [loginId]);

  const openEdit = async (requestNumber: string) => {
    setSelectedRequestNumber(requestNumber);
    setOpenDialog(true);
    setEditLoading(true);
    try {
      const editsql = (requestNumber:string) =>`
      SELECT *
      FROM VW_LEAVE_REQUEST_FLOW_CLOSE
      WHERE company_code = '${user?.COMPANY_CODE}'
      AND request_number = '${requestNumber}'
      ORDER BY request_number ASC
      `
      const res = await executeHrRawSql(editsql(requestNumber));
      const rows = (res ?? []) as TLeaveApproval[];
      setEditData(rows[0] ?? null);
      } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load leave request");
    } finally {
      setEditLoading(false);
    }
  };

  const closeDialog = () => {
    setOpenDialog(false);
    setSelectedRequestNumber(null);
    setEditData(null);
  };

  const columns = useMemo<ColumnDef<TLeaveApproval>[]>(
    () => [
      {
        id: "actions",
        header: "Actions",
        size: 84,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Edit leave request"
            aria-label="Edit leave request"
            onClick={() => void openEdit(row.original.REQUEST_NUMBER)}
          >
            <Pencil size={14} />
          </Button>
        ),
      },
      { accessorKey: "REQUEST_NUMBER", header: "No.", size: 250 },
      {
        accessorKey: "REQUEST_DATE",
        header: "Request Date",
        size: 130,
        // cell: ({ row }) => formatDate(row.original.REQUEST_DATE),
      },
      { accessorKey: "EMPLOYEE_NAME_DISPLAY", header: "Employee Name", size: 220 },
      { accessorKey: "LEAVE_TYPE_DESC", header: "Leave Type", size: 150 },
      {
        accessorKey: "LEAVE_START_DATE",
        header: "Leave Start Date",
        size: 140,
        // cell: ({ row }) => formatDate(row.original.LEAVE_START_DATE),
      },
      {
        accessorKey: "LEAVE_END_DATE",
        header: "Leave End Date",
        size: 140,
        // cell: ({ row }) => formatDate(row.original.LEAVE_END_DATE),
      },
      {
        accessorKey: "ACTUAL_RESUME_DATE",
        header: "Actual Resume Date",
        size: 160,
        // cell: ({ row }) => formatDate(row.original.ACTUAL_RESUME_DATE),
      },
      {
        accessorKey: "DUTY_RESUME_DATE",
        header: "Duty Resume Date",
        size: 160,
        // cell: ({ row }) => formatDate(row.original.DUTY_RESUME_DATE),
      },
      { accessorKey: "REMARKS", header: "Remarks", size: 150 },
      { accessorKey: "NEXT_ACTION_BY_NAME", header: "Next Action By", size: 200 },
    ],
    [],
  );

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">HR</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Leave Resumption Approval</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void loadRows()} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </Button>
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
        height="calc(100vh - 220px)"
        minWidth={1400}
        enablePagination
        enableExport
        exportFilename="Leave_Resumption_Approvals.csv"
        pageSize={10}
        getRowId={(row, index) => `${row.REQUEST_NUMBER ?? index}`}
      />

      <Dialog
        open={openDialog}
        title={selectedRequestNumber ? "Edit Leave Request" : "Leave Request Form"}
        compact
        wide
        onClose={closeDialog}
      >
        {editLoading ? (
          <p className="m-0 text-sm text-muted-foreground">Loading...</p>
        ) : (
          <LeaveResumptionForm
            data={editData}
            onClose={closeDialog}
            onSuccess={() => {
              closeDialog();
              void loadRows();
            }}
          />
        )}
      </Dialog>
    </section>
  );
}

// function formatDate(value: unknown) {
//   if (!value) return "NA";
//   const date = new Date(value as string);
//   return Number.isNaN(date.getTime()) ? "NA" : date.toLocaleDateString("en-GB");
// }

export default LeaveResumptionApprovalPage;