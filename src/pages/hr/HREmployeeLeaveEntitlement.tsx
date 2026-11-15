import { ColumnDef } from "@tanstack/react-table";
import { Plus, Save } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DynamicQueryParams, getDynamicLookup, LookupRow } from "../../api/lookups";
import { useAuth } from "../../state/AuthContext";
import { LookupField } from "../../components/ui/LookupField";
import { DataTable } from "../../components/ui/DataTable";
import { api } from "../../api/client";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */
export type SaveLeaveEntitlementRow = {
  company_code: string;
  employee_id: string;
  leave_type: string;
  leave_slab_id: number | null;
  leave_days: number | null;
  service_days: number | null;
  status_flag: string;
  remarks: string;
  user_id: string;
};

type LeaveEntitlementRow = {
  rowId: string;
  COMPANY_CODE: string;
  EMPLOYEE_ID: string;
  LEAVE_TYPE: string;
  LEAVE_TYPE_DESC: string;
  LEAVE_SLAB_ID: string;
  LEAVE_DAYS: string;
  SERVICE_DAYS: string;
  STATUS_FLAG: string;
  REMARKS: string;
  isNew?: boolean;
};

/* -------------------------------------------------------------------------- */
/*                              Helpers                                       */
/* -------------------------------------------------------------------------- */

// DB stores a single char. Adjust here if your data uses Y/N instead.
const STATUS_TO_DB: Record<string, string> = { Active: "A", Inactive: "I" };

const buildPayload = (
  parameter: string,
  loginid: string,
  extra: Partial<Omit<DynamicQueryParams, "parameter" | "loginid">> = {},
): DynamicQueryParams => ({ parameter, loginid, ...extra });

const upperKeys = (row: LookupRow): Record<string, any> =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toUpperCase(), v]));

const matches = (rows: LookupRow[], q?: string) => {
  const term = (q || "").trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(term)));
};

const makeRowId = () => `row_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const normalizeStatus = (flag: string): string => {
  const u = (flag || "").trim().toUpperCase();
  if (u === "Y" || u === "A" || u === "ACTIVE") return "Active";
  if (u === "N" || u === "I" || u === "INACTIVE") return "Inactive";
  return flag || "Active";
};

const emptyRow = (companyCode: string, employeeId: string): LeaveEntitlementRow => ({
  rowId: makeRowId(),
  COMPANY_CODE: companyCode,
  EMPLOYEE_ID: employeeId,
  LEAVE_TYPE: "",
  LEAVE_TYPE_DESC: "",
  LEAVE_SLAB_ID: "",
  LEAVE_DAYS: "",
  SERVICE_DAYS: "",
  STATUS_FLAG: "Active",
  REMARKS: "",
  isNew: true,
});

/** Case-insensitive field getter from a LOV row. */
const val = (row: LookupRow | null | undefined, ...keys: string[]): string => {
  if (!row) return "";
  for (const k of keys) {
    const v = row[k] ?? row[k.toUpperCase()] ?? row[k.toLowerCase()];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
};

const errMessage = (err: any, fallback: string): string =>
  err?.response?.data?.details ||
  err?.response?.data?.message ||
  (err instanceof Error ? err.message : fallback);

/* -------------------------------------------------------------------------- */
/*                              Save                                          */
/* -------------------------------------------------------------------------- */
async function saveLeaveEntitlement(
  rows: SaveLeaveEntitlementRow[]
): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post("/api/hr/leave-entitlement/save", rows);
  return data;
}

/* -------------------------------------------------------------------------- */
/*                              Component                                     */
/* -------------------------------------------------------------------------- */

export default function HREmployeeLeaveEntitlement() {
  const { user } = useAuth() as any;
  const companyCode: string = user?.companyCode ?? user?.company_code ?? "";
  const loginId: string = user?.loginId ?? user?.userId ?? user?.username ?? "";

  // header filters
  const [divCode, setDivCode] = useState("");
  const [divDisplay, setDivDisplay] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptDisplay, setDeptDisplay] = useState("");
  const [sectionCode, setSectionCode] = useState("");
  const [sectionDisplay, setSectionDisplay] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeDisplay, setEmployeeDisplay] = useState("");

  // grid
  const [rows, setRows] = useState<LeaveEntitlementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ---------------------------- LOV loaders ----------------------------- */

  const loadDivisions = useCallback(
    async (q?: string) => {
      if (!companyCode) return [];
      const data = await getDynamicLookup(
        buildPayload("MS_EMP_HR_LEAVE_ENTITLEMENT_DIVISION", loginId, { code1: companyCode }),
      );
      return matches(data, q);
    },
    [companyCode, loginId],
  );

  const loadDepartments = useCallback(
    async (q?: string) => {
      if (!companyCode) return [];
      const data = await getDynamicLookup(
        buildPayload("MS_EMP_HR_LEAVE_ENTITLEMENT_DEPARTMENT", loginId, {
          code1: companyCode,
          code2: divCode || undefined,
        }),
      );
      return matches(data, q);
    },
    [companyCode, loginId, divCode],
  );

  const loadSections = useCallback(
    async (q?: string) => {
      if (!companyCode) return [];
      const data = await getDynamicLookup(
        buildPayload("MS_EMP_HR_LEAVE_ENTITLEMENT_SECTION", loginId, {
          code1: companyCode,
          code2: divCode || undefined,
          code3: deptCode || undefined,
        }),
      );
      return matches(data, q);
    },
    [companyCode, loginId, divCode, deptCode],
  );

  const loadEmployees = useCallback(
    async (q?: string) => {
      if (!companyCode) return [];
      const data = await getDynamicLookup(
        buildPayload("MS_EMP_HR_LEAVE_ENTITLEMENT_EMPLOYEE_LIST", loginId, {
          code1: companyCode,
          code2: divCode || undefined,
          code3: deptCode || undefined,
          code4: sectionCode || undefined,
        }),
      );
      return matches(data, q);
    },
    [companyCode, loginId, divCode, deptCode, sectionCode],
  );

  const loadLeaveTypes = useCallback(
    async (q?: string) => {
      if (!companyCode) return [];
      const data = await getDynamicLookup(
        buildPayload("MS_EMP_HR_LEAVE_ENTITLEMENT_LEAVE_TYPE", loginId, {
          code1: companyCode,
        }),
      );
      return matches(data, q);
    },
    [companyCode, loginId],
  );

  /* --------------------- Load leave entitlement ------------------------- */

  const loadLeaveEntitlement = useCallback(
    async (empId: string) => {
      if (!companyCode || !empId) {
        setRows([]);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const data = await getDynamicLookup(
          buildPayload("MS_EMP_HR_LEAVE_ENTITLEMENT_LEAVE_ENTITLEMENT", loginId, {
            code1: companyCode,
            code2: empId,
          }),
        );
        const mapped: LeaveEntitlementRow[] = data.map((raw) => {
          const r = upperKeys(raw);
          return {
            rowId: makeRowId(),
            COMPANY_CODE: String(r.COMPANY_CODE ?? companyCode),
            EMPLOYEE_ID: String(r.EMPLOYEE_ID ?? empId),
            LEAVE_TYPE: String(r.LEAVE_TYPE ?? ""),
            LEAVE_TYPE_DESC: String(r.LEAVE_TYPE_DESC ?? ""),
            LEAVE_SLAB_ID: String(r.LEAVE_SLAB_ID ?? ""),
            LEAVE_DAYS: r.LEAVE_DAYS != null ? String(r.LEAVE_DAYS) : "",
            SERVICE_DAYS: r.SERVICE_DAYS != null ? String(r.SERVICE_DAYS) : "",
            STATUS_FLAG: normalizeStatus(String(r.STATUS_FLAG ?? "Active")),
            REMARKS: String(r.REMARKS ?? ""),
            isNew: false,
          };
        });
        setRows(mapped);
      } catch (err) {
        setRows([]);
        setError(err instanceof Error ? err.message : "Unable to load leave entitlement");
      } finally {
        setLoading(false);
      }
    },
    [companyCode, loginId],
  );

  /* ----------------------- Selection handlers --------------------------- */

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleDivisionChange = (value: string, row: LookupRow | null) => {
    resetMessages();
    setDivCode(value);
    setDivDisplay(row ? `${val(row, "DIV_CODE")} ${val(row, "DIV_NAME")}`.trim() : "");
    setDeptCode("");
    setDeptDisplay("");
    setSectionCode("");
    setSectionDisplay("");
    setEmployeeId("");
    setEmployeeDisplay("");
    setRows([]);
  };

  const handleDepartmentChange = (value: string, row: LookupRow | null) => {
    resetMessages();
    setDeptCode(value);
    setDeptDisplay(row ? `${val(row, "DEPT_CODE")} ${val(row, "DEPT_NAME")}`.trim() : "");

    const parentDiv = val(row, "DIV_CODE");
    if (parentDiv) {
      setDivCode(parentDiv);
      setDivDisplay(`${parentDiv} ${val(row, "DIV_NAME")}`.trim() || parentDiv);
    }

    setSectionCode("");
    setSectionDisplay("");
    setEmployeeId("");
    setEmployeeDisplay("");
    setRows([]);
  };

  const handleSectionChange = (value: string, row: LookupRow | null) => {
    resetMessages();
    setSectionCode(value);
    setSectionDisplay(row ? `${val(row, "SECTION_CODE")} ${val(row, "SECTION_NAME")}`.trim() : "");

    const parentDiv = val(row, "DIV_CODE");
    if (parentDiv) {
      setDivCode(parentDiv);
      setDivDisplay(`${parentDiv} ${val(row, "DIV_NAME")}`.trim() || parentDiv);
    }
    const parentDept = val(row, "DEPT_CODE");
    if (parentDept) {
      setDeptCode(parentDept);
      setDeptDisplay(`${parentDept} ${val(row, "DEPT_NAME")}`.trim() || parentDept);
    }

    setEmployeeId("");
    setEmployeeDisplay("");
    setRows([]);
  };

  const handleEmployeeChange = (value: string, row: LookupRow | null) => {
    resetMessages();
    setEmployeeId(value);
    const code = val(row, "EMPLOYEE_CODE", "EMPLOYEE_ID");
    const name = val(row, "RPT_NAME");
    setEmployeeDisplay(row ? `${code} ${name}`.trim() : "");

    if (row) {
      const empDiv = val(row, "DIV_CODE");
      if (empDiv) {
        setDivCode(empDiv);
        setDivDisplay(`${empDiv} ${val(row, "DIV_NAME")}`.trim() || empDiv);
      }
      const empDept = val(row, "DEPT_CODE");
      if (empDept) {
        setDeptCode(empDept);
        setDeptDisplay(`${empDept} ${val(row, "DEPT_NAME")}`.trim() || empDept);
      }
      const empSec = val(row, "SECTION_CODE");
      if (empSec) {
        setSectionCode(empSec);
        setSectionDisplay(`${empSec} ${val(row, "SECTION_NAME")}`.trim() || empSec);
      }
    }

    if (value) {
      loadLeaveEntitlement(value);
    } else {
      setRows([]);
    }
  };

  /* ----------------------------- Row actions ---------------------------- */

  const updateCell = useCallback((rowId: string, field: keyof LeaveEntitlementRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, [field]: value } : r)));
  }, []);

  const handleAdd = () => {
    if (!employeeId) {
      setError("Please select an Employee before adding a row.");
      return;
    }
    resetMessages();
    setRows((prev) => [emptyRow(companyCode, employeeId), ...prev]);
  };

  const handleSave = async () => {
    resetMessages();

    if (!employeeId) {
      setError("Please select an Employee before saving.");
      return;
    }
    if (!rows.length) {
      setError("Nothing to save.");
      return;
    }

    // validation
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].LEAVE_TYPE) {
        setError(`Row ${i + 1}: Leave Type is required.`);
        return;
      }
      if (!rows[i].STATUS_FLAG) {
        setError(`Row ${i + 1}: Status is required.`);
        return;
      }
    }

    // duplicate check on (leave type + slab) for rows that already have a slab id
    const seen = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].LEAVE_SLAB_ID) continue;
      const key = `${rows[i].LEAVE_TYPE}|${rows[i].LEAVE_SLAB_ID}`;
      if (seen.has(key)) {
        setError(`Row ${i + 1}: duplicate Leave Type / Slab combination.`);
        return;
      }
      seen.add(key);
    }

    // Send oldest-first so new slab ids are assigned in the order the user sees them
    const payload = [...rows].reverse().map((r) => ({
      company_code: r.COMPANY_CODE || companyCode,
      employee_id: r.EMPLOYEE_ID || employeeId,
      leave_type: r.LEAVE_TYPE,
      leave_slab_id: r.LEAVE_SLAB_ID === "" ? null : Number(r.LEAVE_SLAB_ID),
      leave_days: r.LEAVE_DAYS === "" ? null : Number(r.LEAVE_DAYS),
      service_days: r.SERVICE_DAYS === "" ? null : Number(r.SERVICE_DAYS),
      status_flag: STATUS_TO_DB[r.STATUS_FLAG] ?? r.STATUS_FLAG,
      remarks: r.REMARKS,
      user_id: loginId,
    }));

    setSaving(true);
    try {
      const res = await saveLeaveEntitlement(payload);
      setSuccess(res?.message || "Leave entitlement saved successfully");
      await loadLeaveEntitlement(employeeId); // refresh to pick up generated slab ids
    } catch (err) {
      setError(errMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------ Columns ------------------------------- */

  const columns = useMemo<ColumnDef<LeaveEntitlementRow, any>[]>(
    () => [
      {
        id: "si_no",
        header: "SINo.",
        size: 60,
        cell: ({ row }) => (
          <span className="text-[11.5px] font-medium text-slate-600">{row.index + 1}</span>
        ),
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        accessorKey: "LEAVE_TYPE",
        header: "Leave Type *",
        size: 240,
        cell: ({ row }) => {
          const display =
            row.original.LEAVE_TYPE && row.original.LEAVE_TYPE_DESC
              ? `${row.original.LEAVE_TYPE} ${row.original.LEAVE_TYPE_DESC}`
              : row.original.LEAVE_TYPE || undefined;

          // Leave type is part of the primary key, so it is locked on saved rows.
          if (!row.original.isNew) {
            return <span className="text-[11.5px]">{display}</span>;
          }

          return (
            <div onClick={(e) => e.stopPropagation()} className="min-w-0">
              <LookupField
                value={row.original.LEAVE_TYPE}
                displayValue={display}
                columns={[
                  { field: "LEAVE_TYPE", header: "Code" },
                  { field: "LEAVE_TYPE_DESC", header: "Name" },
                ]}
                valueField="LEAVE_TYPE"
                displayFields={["LEAVE_TYPE", "LEAVE_TYPE_DESC"]}
                loadOptions={loadLeaveTypes}
                onChange={(value, lovRow) => {
                  const desc = val(lovRow, "LEAVE_TYPE_DESC");
                  setRows((prev) =>
                    prev.map((r) =>
                      r.rowId === row.original.rowId
                        ? { ...r, LEAVE_TYPE: value, LEAVE_TYPE_DESC: desc }
                        : r,
                    ),
                  );
                }}
                dense
                compact
                placeholder="Select leave type"
              />
            </div>
          );
        },
      },
      {
        accessorKey: "LEAVE_SLAB_ID",
        header: "Slab ID",
        size: 80,
        cell: ({ row }) => (
          <span className="block text-right text-[11.5px] text-slate-600">
            {row.original.LEAVE_SLAB_ID || (row.original.isNew ? "Auto" : "")}
          </span>
        ),
      },
      {
        accessorKey: "LEAVE_DAYS",
        header: "Leave Days",
        size: 110,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="number"
              min={0}
              className="h-6 w-full rounded border border-transparent bg-transparent px-1.5 text-right text-[11.5px] outline-none focus:border-[#00378C] focus:bg-white"
              value={row.original.LEAVE_DAYS}
              onChange={(e) => updateCell(row.original.rowId, "LEAVE_DAYS", e.target.value)}
            />
          </div>
        ),
      },
      {
        accessorKey: "SERVICE_DAYS",
        header: "Service Days",
        size: 110,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="number"
              min={0}
              className="h-6 w-full rounded border border-transparent bg-transparent px-1.5 text-right text-[11.5px] outline-none focus:border-[#00378C] focus:bg-white"
              value={row.original.SERVICE_DAYS}
              onChange={(e) => updateCell(row.original.rowId, "SERVICE_DAYS", e.target.value)}
            />
          </div>
        ),
      },
      {
        accessorKey: "STATUS_FLAG",
        header: "Status *",
        size: 120,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <select
              className="h-6 w-full rounded border border-transparent bg-transparent px-1 text-[11.5px] outline-none focus:border-[#00378C] focus:bg-white"
              value={row.original.STATUS_FLAG}
              onChange={(e) => updateCell(row.original.rowId, "STATUS_FLAG", e.target.value)}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        ),
      },
      {
        accessorKey: "REMARKS",
        header: "Remarks",
        size: 200,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              maxLength={100}
              className="h-6 w-full rounded border border-transparent bg-transparent px-1.5 text-[11.5px] outline-none focus:border-[#00378C] focus:bg-white"
              value={row.original.REMARKS}
              onChange={(e) => updateCell(row.original.rowId, "REMARKS", e.target.value)}
            />
          </div>
        ),
      },
    ],
    [updateCell, loadLeaveTypes],
  );

  /* -------------------------------- Render -------------------------------- */

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      {/* Page heading + action buttons */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-2.5 shadow-sm">
        <h1 className="text-[15px] font-bold text-[#00378C]">HR Employee - Leave Entitlement</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAdd}
            disabled={!employeeId || saving}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[#00378C] bg-white px-3.5 text-xs font-semibold text-[#00378C] shadow-sm transition-opacity hover:bg-[#00378C]/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={14} />
            Add
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!employeeId || !rows.length || saving}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-[#00378C] px-3.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Top: filters */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LookupField
            label="Division"
            value={divCode}
            displayValue={divDisplay || undefined}
            columns={[
              { field: "DIV_CODE", header: "Code" },
              { field: "DIV_NAME", header: "Name" },
            ]}
            valueField="DIV_CODE"
            displayFields={["DIV_CODE", "DIV_NAME"]}
            loadOptions={loadDivisions}
            onChange={handleDivisionChange}
            placeholder="Select division"
          />

          <LookupField
            label="Department"
            value={deptCode}
            displayValue={deptDisplay || undefined}
            columns={[
              { field: "DEPT_CODE", header: "Code" },
              { field: "DEPT_NAME", header: "Name" },
            ]}
            valueField="DEPT_CODE"
            displayFields={["DEPT_CODE", "DEPT_NAME"]}
            loadOptions={loadDepartments}
            onChange={handleDepartmentChange}
            placeholder="Select department"
          />

          <LookupField
            label="Section"
            value={sectionCode}
            displayValue={sectionDisplay || undefined}
            columns={[
              { field: "SECTION_CODE", header: "Code" },
              { field: "SECTION_NAME", header: "Name" },
            ]}
            valueField="SECTION_CODE"
            displayFields={["SECTION_CODE", "SECTION_NAME"]}
            loadOptions={loadSections}
            onChange={handleSectionChange}
            placeholder="Select section"
          />

          <LookupField
            label="Employee *"
            value={employeeId}
            displayValue={employeeDisplay || undefined}
            columns={[
              { field: "EMPLOYEE_CODE", header: "Code" },
              { field: "RPT_NAME", header: "Name" },
            ]}
            valueField="EMPLOYEE_ID"
            displayFields={["EMPLOYEE_CODE", "RPT_NAME"]}
            loadOptions={loadEmployees}
            onChange={handleEmployeeChange}
            placeholder="Select employee"
            required
            enforceRequired
          />
        </div>
      </div>

      {/* Bottom: grid */}
      <div className="min-h-0 flex-1">
        {error && (
          <div className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>
        )}
        {success && (
          <div className="mb-2 rounded border border-green-200 bg-green-50 p-2 text-xs text-green-700">
            {success}
          </div>
        )}
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          density="grid"
          height="calc(100vh - 340px)"
          enablePagination
          pageSize={25}
          exportFilename="leave-entitlement.csv"
          getRowId={(row) => row.rowId}
          emptyText={
            employeeId
              ? "No leave entitlement records. Click Add to create one."
              : "Select an Employee to load leave entitlement."
          }
          stickyFirstColumn={false}
          stickyLastColumn={false}
        />
      </div>
    </div>
  );
}