// Employee Master — list page only
//  • Click the employee code (or the edit icon) to open the tabbed workspace
//  • Add Employee opens the workspace in "new" mode
//  • Import dropdown (Employee / Payunit) opens the common EDI import page
//  • Print icon opens a dialog with the single-employee report

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, Edit2, Plus, Printer, Trash2, Upload, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../../../api/client";
import { executeDynamicDelete } from "../../../api/lookups";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { NewReportDialog } from "../../../components/new_report_format";
import { EdiImportPage } from "../../../components/EdiImportPage";
import { formatDate } from "../../../hooks/apiDate";
import { employeeWorkspacePath } from "./Employee.workspace.shared";
import type { TEmployeeHr } from "../../../pages/hr/Employee Master/employee-hr.types";

import { employeeListKey, useEmployeeList } from "./UseEmployeeList";

/** EDI keys understood by PROC_BUILD_DYNAMIC_EDI_SAVE / the template procedure. */
type ImportKey = "EMPLOYEE" | "EMP_PAY_COMPONENT";

const IMPORT_OPTIONS: { key: ImportKey; label: string }[] = [
  { key: "EMPLOYEE", label: "Employee" },
  { key: "EMP_PAY_COMPONENT", label: "Payunit" },
];

/**
 * System-generated columns per EDI key.
 *
 * Declared at MODULE level on purpose: the reference never changes, so the import page never
 * sees a "new" array and never refetches its columns. Do NOT write `[]` or an array literal
 * inline in JSX.
 *
 *  EMPLOYEE          : blank EMPLOYEE_ID -> INSERT (trigger generates ID + CODE), filled -> UPDATE.
 *  EMP_PAY_COMPONENT : HR_EMP_COMPONENTS has only a BEFORE DELETE trigger, so no column is
 *                      generated on insert -> nothing to list. (The key is the composite
 *                      COMPANY_CODE + EMPLOYEE_ID + PAY_COMP_ID + CURR_CODE.)
 */
const NO_AUTO_GENERATED: string[] = [];
const AUTO_GENERATED_BY_KEY: Record<ImportKey, string[]> = {
  EMPLOYEE: ["EMPLOYEE_ID", "EMPLOYEE_CODE"],
  EMP_PAY_COMPONENT: NO_AUTO_GENERATED,
};

export function EmployeeMasterPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { rows, isLoading, error, refetch, companyCode, loginid } = useEmployeeList();
  const queryKey = useMemo(() => employeeListKey(companyCode), [companyCode]);

  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TEmployeeHr | null>(null);

  /* ── Print dialog state ── */
  const [printTarget, setPrintTarget] = useState<TEmployeeHr | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printHtml, setPrintHtml] = useState<string | null>(null);
  const [printExporting, setPrintExporting] = useState(false);

  /* ── Import (EDI) state ── */
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importKey, setImportKey] = useState<ImportKey | null>(null);
  const importMenuRef = useRef<HTMLDivElement | null>(null); // wrapper around the button
  const importPanelRef = useRef<HTMLDivElement | null>(null); // the portal panel
  const [importMenuPos, setImportMenuPos] = useState({ top: 0, right: 0 });

  const toggleImportMenu = () => {
    const rect = importMenuRef.current?.getBoundingClientRect();
    if (rect) setImportMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setImportMenuOpen((o) => !o);
  };

  useEffect(() => {
    if (error) toast.error(error instanceof Error ? error.message : "Unable to load employees");
  }, [error, toast]);

  // close the import dropdown on outside click, scroll or resize
  useEffect(() => {
    if (!importMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (importMenuRef.current?.contains(t) || importPanelRef.current?.contains(t)) return;
      setImportMenuOpen(false);
    };
    const close = () => setImportMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [importMenuOpen]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(term)));
  }, [query, rows]);

  /* ── Navigation ── */
  const openEmployee = useCallback(
    (row: TEmployeeHr) => navigate(employeeWorkspacePath(row.employee_code, "master")),
    [navigate],
  );
  const openAdd = () => navigate(employeeWorkspacePath("new", "details"));


  /* ── Delete ── */
  const deleteMutation = useMutation({
    mutationFn: (row: TEmployeeHr) =>
      executeDynamicDelete({
        parameter: "MSEHR_TRANSACTIONS_MS_HR_EMPLOYEE_DELETE",
        loginid,
        code1: row.employee_code,
        code2: companyCode,
      }),
    onSuccess: () => {
      toast.success("Employee deleted successfully");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to delete employee"),
  });

  /* ── Print ── */
  const openPrint = useCallback(
    async (row: TEmployeeHr) => {
      setPrintTarget(row);
      setPrintHtml(null);
      setPrintError(null);
      setPrintOpen(true);
      setPrintLoading(true);
      try {
        const res = await api.post(
          "/api/hr/hr-reports/employee-master/print/html",
          { company_code: companyCode, employee_id: String(row.employee_id), loginid },
          {
            responseType: "text",
            headers: { Accept: "text/html" },
            transformResponse: [(d) => d],
          },
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
        if (typeof d === "string") {
          try {
            msg = JSON.parse(d)?.message || d;
          } catch {
            msg = d;
          }
        } else if (d?.message) {
          msg = d.message;
        }
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
        "/api/hr/hr-reports/employee-master/print/excel",
        { company_code: companyCode, employee_id: String(printTarget.employee_id), loginid },
        { responseType: "blob" },
      );
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Employee_Report_${printTarget.employee_code}.xlsx`;
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
    if (w) {
      w.document.write(printHtml);
      w.document.close();
    }
  }, [printHtml]);

  /* ── Columns ── */
  const columns = useMemo<ColumnDef<TEmployeeHr>[]>(
    () => [
      {
        accessorKey: "employee_code",
        header: "Employee code",
        size: 60,
        cell: ({ row }) => (
          <button
            type="button"
            className="cursor-pointer font-semibold text-[#00378C] hover:underline"
            onClick={() => openEmployee(row.original)}
            title="Open employee"
          >
            {row.original.employee_code}
          </button>
        ),
      },
      { accessorKey: "rpt_name", header: "Employee Name", size: 270 },
      { accessorKey: "desg_code", header: "Designation", size: 80 },
      {
        accessorKey: "join_date",
        header: "Join Date",
        size: 100,
        cell: ({ getValue }) => formatDate(getValue()),
      },
      { accessorKey: "dept_code", header: "Department", size: 80 },
      {
        id: "actions",
        header: "Actions",
        size: 120,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openPrint(row.original)}
              title="Print employee report"
            >
              <Printer size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEmployee(row.original)}
              title="Open employee"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => setDeleteTarget(row.original)}
              title="Delete employee"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    [openEmployee, openPrint],
  );

  /* ── Import page replaces the list while open ── */
  if (importKey) {
    const importLabel = IMPORT_OPTIONS.find((o) => o.key === importKey)?.label ?? importKey;
    return (
      <EdiImportPage
        key={importKey}
        tableKey={importKey}
        title={`Import ${importLabel}`}
        autoGeneratedColumns={AUTO_GENERATED_BY_KEY[importKey]}
        onClose={() => {
          setImportKey(null);
          void refetch();
        }}
      />
    );
  }

  return (
    <section className="freight-workspace-ui freight-ui-standard grid gap-2">
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Users size={15} />
          </div>
          <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">Employee Master</h1>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {/* Import dropdown */}
          <div className="relative" ref={importMenuRef}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={toggleImportMenu}
              aria-haspopup="menu"
              aria-expanded={importMenuOpen}
            >
              <Upload size={14} /> Import <ChevronDown size={12} />
            </Button>
          </div>

          {importMenuOpen &&
            createPortal(
              <div
                ref={importPanelRef}
                role="menu"
                style={{
                  position: "fixed",
                  top: importMenuPos.top,
                  right: importMenuPos.right,
                  zIndex: 9999,
                }}
                className="min-w-[140px] overflow-hidden rounded-md border bg-white py-1 shadow-lg"
              >
                {IMPORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    role="menuitem"
                    className="block w-full cursor-pointer px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-blue-50 hover:text-[#00378C]"
                    onClick={() => {
                      setImportMenuOpen(false);
                      setImportKey(opt.key);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>,
              document.body,
            )}

          <Button type="button" size="sm" onClick={openAdd}>
            <Plus size={14} /> Add Employee
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        title={isLoading ? "Loading" : `${filteredRows.length.toLocaleString()} Employees`}
        subtitle="Employee Master List"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search employee, designation..."
        loading={isLoading}
        emptyText="No Employee found"
        height={620}
        minWidth={900}
        density="grid"
        getRowId={(row) => `${row.employee_code}-${row.employee_id}`}
      />

      <NewReportDialog
        open={printOpen}
        onClose={closePrint}
        title={printTarget ? `Employee Report - ${printTarget.employee_code}` : "Employee Report"}
        htmlContent={printHtml}
        loading={printLoading}
        error={printError}
        onExportExcel={exportPrintExcel}
        exportingExcel={printExporting}
        onOpenInNewWindow={openPrintInNewWindow}
      />

      <Dialog
        open={!!deleteTarget}
        title="Delete Employee"
        description={deleteTarget ? `Delete ${deleteTarget.rpt_name}?` : undefined}
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
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
          This action cannot be undone. Are you sure you want to delete this employee?
        </p>
      </Dialog>
    </section>
  );
}

export default EmployeeMasterPage;