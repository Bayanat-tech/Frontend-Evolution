import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";

import { LookupField } from "../../../components/ui/LookupField";
import { DataTable } from "../../../components/ui/DataTable";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../components/ui/AlertToast";
import { getDynamicLookup, executeDynamicMutation, executeDynamicDelete, LookupRow
 } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";

// ─── Types ───────────────────────────────────────────────────────────────────

type CodeOption = {
  VALUE_CODE: string;
  VALUE_DESC: string;
};

type PayUnitRow = {
  PAY_COMP_ID: string;
  PAY_COMP_DESC?: string;
  PAY_COMP_SHORT_DESC?: string;
  PAY_COMP_EARN_DED?: string;
};

type EmpCompRow = {
  EMPLOYEE_ID: string;
  EMPLOYEE_CODE?: string;
  RPT_NAME?: string;
  PAY_COMP_ID: string;
  PAY_COMP_AMT?: number | null;
  COMP_STATUS?: string;
  APPROVED_ON?: string;
  STATUS_FLAG?: string;
  REMARKS?: string;
  [key: string]: unknown;
};

type FormState = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  amount: string;
  /** COMP_STATUS code from HR_CODE_VALUES GROUP 36 */
  payUnitStatus: string;
  approvedOn: string;
  /** STATUS_FLAG code from HR_CODE_VALUES GROUP 6 */
  status: string;
  remarks: string;
};

const emptyForm = (defaults?: { payUnitStatus?: string; status?: string }): FormState => ({
  employeeId: "",
  employeeCode: "",
  employeeName: "",
  amount: "",
  payUnitStatus: defaults?.payUnitStatus ?? "",
  approvedOn: "",
  status: defaults?.status ?? "",
  remarks: "",
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateDisplay(value: unknown): string {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function toInputDate(value: unknown): string {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** API may return snake_case lowercase keys — normalize to UPPER keys used in UI */
function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null && row[key] !== "") return row[key];
    const lower = key.toLowerCase();
    if (row[lower] != null && row[lower] !== "") return row[lower];
    const upper = key.toUpperCase();
    if (row[upper] != null && row[upper] !== "") return row[upper];
  }
  return undefined;
}

function normalizeEmpCompRow(raw: Record<string, unknown>): EmpCompRow {
  return {
    EMPLOYEE_ID: String(pick(raw, "EMPLOYEE_ID", "employee_id") ?? ""),
    EMPLOYEE_CODE: String(pick(raw, "EMPLOYEE_CODE", "employee_code") ?? ""),
    RPT_NAME: String(pick(raw, "RPT_NAME", "rpt_name") ?? ""),
    PAY_COMP_ID: String(pick(raw, "PAY_COMP_ID", "pay_comp_id") ?? ""),
    PAY_COMP_AMT: (() => {
      const v = pick(raw, "PAY_COMP_AMT", "pay_comp_amt");
      return v == null || v === "" ? null : Number(v);
    })(),
    COMP_STATUS: String(pick(raw, "COMP_STATUS", "comp_status") ?? ""),
    APPROVED_ON: pick(raw, "APPROVED_ON", "approved_on") as string | undefined,
    STATUS_FLAG: String(pick(raw, "STATUS_FLAG", "status_flag") ?? ""),
    REMARKS: (pick(raw, "REMARKS", "remarks") as string) ?? "",
    ...raw,
  };
}

function normalizePayUnitRow(raw: Record<string, unknown>): PayUnitRow {
  return {
    PAY_COMP_ID: String(pick(raw, "PAY_COMP_ID", "pay_comp_id") ?? ""),
    PAY_COMP_DESC: String(pick(raw, "PAY_COMP_DESC", "pay_comp_desc") ?? ""),
    PAY_COMP_SHORT_DESC: String(pick(raw, "PAY_COMP_SHORT_DESC", "pay_comp_short_desc") ?? ""),
    PAY_COMP_EARN_DED: String(pick(raw, "PAY_COMP_EARN_DED", "pay_comp_earn_ded") ?? ""),
  };
}

function normalizeCodeOption(raw: Record<string, unknown>): CodeOption {
  return {
    VALUE_CODE: String(pick(raw, "VALUE_CODE", "value_code") ?? ""),
    VALUE_DESC: String(pick(raw, "VALUE_DESC", "value_desc") ?? ""),
  };
}

function codeLabel(options: CodeOption[], code?: string): string {
  if (!code) return "";
  const found = options.find(
    (o) => o.VALUE_CODE === code || o.VALUE_CODE.toUpperCase() === code.toUpperCase(),
  );
  return found?.VALUE_DESC || code;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ConsolidatePayUnitPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const companyCode = String(user?.company_code);
  const loginid = String(user?.loginid);

  const [payCompId, setPayCompId] = useState("");
  const [payCompLabel, setPayCompLabel] = useState("");
  const [rows, setRows] = useState<EmpCompRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [payUnitStatusOptions, setPayUnitStatusOptions] = useState<CodeOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<CodeOption[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  // Load status dropdowns from HR_CODE_VALUES
  useEffect(() => {
    const loadCodeOptions = async () => {
      try {
        const [payUnitStatusData, statusData] = await Promise.all([
          getDynamicLookup({ parameter: "MST_HR_CODE_PAY_UNIT_STATUS" }),
          getDynamicLookup({ parameter: "MST_HR_CODE_STATUS" }),
        ]);
        setPayUnitStatusOptions(
          (payUnitStatusData || []).map((r) => normalizeCodeOption(r as Record<string, unknown>)),
        );
        setStatusOptions(
          (statusData || []).map((r) => normalizeCodeOption(r as Record<string, unknown>)),
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to load status options");
      }
    };
    void loadCodeOptions();
  }, [toast]);

  // ── Load grid when pay unit selected ─────────────────────────────────────

  const loadMainPage = useCallback(
    async (selectedPayCompId: string) => {
      if (!companyCode || !selectedPayCompId) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const data = await getDynamicLookup({
          parameter: "MST_HR_CONSOLIDATE_MAIN_PAGE",
          code1: companyCode,
          code2: selectedPayCompId,
        });
        setRows((data || []).map((row) => normalizeEmpCompRow(row as Record<string, unknown>)));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to load data");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [companyCode, toast],
  );

  // ── Lookups ──────────────────────────────────────────────────────────────

  const loadPayUnits = useCallback(
    async (query?: string) => {
      const data = await getDynamicLookup({
        parameter: "MST_HR_CONSOLIDATE_PAY_UNIT",
        code1: companyCode,
      });
      const list = (data || []).map((row) =>
        normalizePayUnitRow(row as Record<string, unknown>),
      );
      if (!query?.trim()) return list as unknown as LookupRow[];
      const term = query.trim().toLowerCase();
      return list.filter(
        (r) =>
          String(r.PAY_COMP_ID ?? "").toLowerCase().includes(term) ||
          String(r.PAY_COMP_DESC ?? "").toLowerCase().includes(term) ||
          String(r.PAY_COMP_SHORT_DESC ?? "").toLowerCase().includes(term),
      ) as unknown as LookupRow[];
    },
    [companyCode],
  );

  const loadEmployees = useCallback(
    async (query?: string) => {
      const data = await getDynamicLookup({
        parameter: "MST_HR_EMPLOYEE_LOOKUP",
        code1: companyCode,
      });
      // Normalize to uppercase keys so LookupField valueField works
      const list = (data || []).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          EMPLOYEE_ID: String(pick(r, "EMPLOYEE_ID", "employee_id") ?? ""),
          EMPLOYEE_CODE: String(pick(r, "EMPLOYEE_CODE", "employee_code") ?? ""),
          RPT_NAME: String(pick(r, "RPT_NAME", "rpt_name") ?? ""),
          ...r,
        } as LookupRow;
      });
      if (!query?.trim()) return list;
      const term = query.trim().toLowerCase();
      return list.filter((r) =>
        Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(term)),
      );
    },
    [companyCode],
  );

  const totalAmount = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.PAY_COMP_AMT) || 0), 0),
    [rows],
  );

  // ── Dialog ───────────────────────────────────────────────────────────────

  const openAdd = () => {
    if (!payCompId) {
      toast.warning("Please select a Pay Unit first");
      return;
    }
    setEditing(false);
    setForm(
      emptyForm({
        payUnitStatus: payUnitStatusOptions[0]?.VALUE_CODE ?? "",
        status: statusOptions[0]?.VALUE_CODE ?? "",
      }),
    );
    setDialogOpen(true);
  };

  const openEdit = (row: EmpCompRow) => {
    setEditing(true);
    setForm({
      employeeId: String(row.EMPLOYEE_ID ?? ""),
      employeeCode: String(row.EMPLOYEE_CODE ?? ""),
      employeeName: String(row.RPT_NAME ?? ""),
      amount: row.PAY_COMP_AMT != null ? String(row.PAY_COMP_AMT) : "",
      payUnitStatus: String(row.COMP_STATUS ?? payUnitStatusOptions[0]?.VALUE_CODE ?? ""),
      approvedOn: toInputDate(row.APPROVED_ON),
      status: String(row.STATUS_FLAG ?? statusOptions[0]?.VALUE_CODE ?? ""),
      remarks: String(row.REMARKS ?? ""),
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setForm(emptyForm());
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!companyCode) {
      toast.warning("Company code not found. Please login again.");
      return;
    }
    if (!loginid) {
      toast.warning("Login id not found. Please login again.");
      return;
    }
    if (!form.employeeId.trim()) {
      toast.warning("Employee is required");
      return;
    }
    if (form.amount === "" || Number.isNaN(Number(form.amount))) {
      toast.warning("Amount is required");
      return;
    }
    if (!payCompId) {
      toast.warning("Pay Unit is required");
      return;
    }
    if (!form.payUnitStatus.trim()) {
      toast.warning("Pay Unit Status is required");
      return;
    }
    if (!form.status.trim()) {
      toast.warning("Status is required");
      return;
    }

    setSaving(true);
    try {
      await executeDynamicMutation({
        parameter: "MST_HR_CONSOLIDATE_EMP_COMP",
        loginid,
        // keys: COMPANY_CODE, EMPLOYEE_ID, PAY_COMP_ID
        val1s1: companyCode,
        val1s2: form.employeeId.trim(),
        val1s3: payCompId,
        // optional strings → null so SQL stores NULL not ''
        val1s5: form.remarks.trim(),
        val1s6: form.status.trim(), // STATUS_FLAG (VALUE_CODE from GROUP 6)
        val1s7: form.payUnitStatus.trim(), // COMP_STATUS (VALUE_CODE from GROUP 36)
        // APPROVED_ON as YYYY-MM-DD string — avoids ORA-01861 with DATE bind/NLS
        val1s9: form.approvedOn ,
        val1n1: Number(form.amount),
      });
      toast.success(editing ? "Record updated successfully" : "Record saved successfully");
      setDialogOpen(false);
      setForm(emptyForm());
      await loadMainPage(payCompId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save record");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async (row: EmpCompRow) => {
    const label = row.EMPLOYEE_CODE || row.RPT_NAME || row.EMPLOYEE_ID;
    if (!window.confirm(`Delete pay unit for employee ${label}?`)) return;

    try {
      await executeDynamicDelete({
        parameter: "MST_HR_CONSOLIDATE_EMP_COMP_DELETE",
        loginid,
        code1: companyCode,
        code2: String(row.EMPLOYEE_ID),
        code3: String(row.PAY_COMP_ID || payCompId),
      });
      toast.success("Record deleted successfully");
      await loadMainPage(payCompId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete record");
    }
  };

  // ── Columns ──────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<EmpCompRow, unknown>[]>(
    () => [
      {
        id: "actions",
        header: "Actions",
        size: 80,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded text-slate-600 hover:bg-slate-100 hover:text-primary"
              title="Edit"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row.original);
              }}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded text-slate-600 hover:bg-rose-50 hover:text-rose-600"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete(row.original);
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
      {
        id: "employee",
        header: "Employee",
        size: 280,
        accessorFn: (row) =>
          `${row.EMPLOYEE_CODE ?? row.EMPLOYEE_ID ?? ""} ${row.RPT_NAME ?? ""}`.trim(),
        cell: ({ row }) => {
          const code = row.original.EMPLOYEE_CODE || row.original.EMPLOYEE_ID || "";
          const name = row.original.RPT_NAME || "";
          return (
            <span className="font-medium text-slate-800">
              {code}
              {name ? `  ${name}` : ""}
            </span>
          );
        },
      },
      {
        accessorKey: "PAY_COMP_AMT",
        header: "Amount",
        size: 110,
        cell: ({ getValue }) => {
          const v = getValue();
          if (v == null || v === "") return "";
          return Number(v).toLocaleString(undefined, {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
          });
        },
      },
      {
        accessorKey: "COMP_STATUS",
        header: "Pay Unit Status",
        size: 130,
        cell: ({ getValue }) => codeLabel(payUnitStatusOptions, String(getValue() ?? "")),
      },
      {
        accessorKey: "APPROVED_ON",
        header: "Approved On",
        size: 110,
        cell: ({ getValue }) => formatDateDisplay(getValue()),
      },
      {
        accessorKey: "STATUS_FLAG",
        header: "Status",
        size: 90,
        cell: ({ getValue }) => codeLabel(statusOptions, String(getValue() ?? "")),
      },
      {
        accessorKey: "REMARKS",
        header: "Remarks",
        size: 160,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payCompId, companyCode, payUnitStatusOptions, statusOptions],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="grid w-full min-w-0 gap-3 p-3">
      {/* Heading + Pay Unit lookup + Add */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-[#aebbd0] bg-white px-3 py-3 shadow-sm">
        <div className="grid gap-2">
          <div className="grid min-w-[280px] max-w-[420px] gap-1">
            <span className="text-xs font-medium text-slate-600">
              Pay Unit <span className="text-rose-600">*</span>
            </span>
            <LookupField
              label="Pay Unit"
              value={payCompId}
              displayValue={payCompLabel}
              compact
              columns={[
                { field: "PAY_COMP_ID", header: "Code" },
                { field: "PAY_COMP_DESC", header: "Description" },
                { field: "PAY_COMP_SHORT_DESC", header: "Short" },
              ]}
              valueField="PAY_COMP_ID"
              displayFields={["PAY_COMP_ID", "PAY_COMP_DESC"]}
              loadOptions={loadPayUnits}
              onChange={(value, row) => {
                setPayCompId(value);
                const label = row
                  ? `${row.PAY_COMP_ID ?? value} — ${row.PAY_COMP_DESC ?? ""}`
                  : value;
                setPayCompLabel(label);
                void loadMainPage(value);
              }}
              placeholder="Select pay unit..."
            />
          </div>
        </div>

        <Button type="button" size="sm" onClick={openAdd} disabled={!payCompId}>
          <Plus size={14} />
          Add
        </Button>
      </div>

      {/* Grid */}
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        loaderType="circle"
        density="compact"
        height={520}
        enablePagination
        pageSize={100}
        searchPlaceholder="Search employee..."
        onSearchChange={() => {}}
        emptyText={
          payCompId
            ? "No records found. Click Add to create one."
            : "Select a Pay Unit to load data"
        }
        enableExport
        exportFilename={`hr-pay-units-${payCompId || "all"}`}
      />

      {/* Total */}
      {payCompId && rows.length > 0 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="font-semibold text-slate-700">Total:</span>
          <span className="min-w-[100px] rounded border border-[#aebbd0] bg-white px-3 py-1 text-right font-semibold tabular-nums">
            {totalAmount.toLocaleString(undefined, {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}
          </span>
        </div>
      )}

      {/* Add / Edit dialog */}
      {dialogOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-900/45 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeDialog();
            }}
          >
            <div
              className="w-full max-w-lg overflow-hidden rounded-lg border border-[#aebbd0] bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between border-b border-[#c7d2e3] bg-[#f8fafc] px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-800">
                  {editing ? "Edit Pay Unit" : "Add Pay Unit"}
                </h2>
                <button
                  type="button"
                  className="text-slate-500 hover:text-slate-800"
                  onClick={closeDialog}
                  disabled={saving}
                >
                  ✕
                </button>
              </div>

              <div className="grid gap-3 px-4 py-4">
                <div className="grid gap-1">
                  <span className="text-xs font-medium text-slate-600">Pay Unit</span>
                  <Input value={payCompLabel || payCompId} disabled className="h-8 text-xs" />
                </div>

                <div className="grid gap-1">
                  <span className="text-xs font-medium text-slate-600">
                    Employee <span className="text-rose-600">*</span>
                  </span>
                  <LookupField
                    label="Employee"
                    value={form.employeeId}
                    displayValue={
                      form.employeeId
                        ? `${form.employeeCode || form.employeeId}${form.employeeName ? `  ${form.employeeName}` : ""}`
                        : ""
                    }
                    compact
                    columns={[
                      { field: "EMPLOYEE_CODE", header: "Code" },
                      { field: "RPT_NAME", header: "Name" },
                      { field: "EMPLOYEE_ID", header: "ID" },
                    ]}
                    valueField="EMPLOYEE_ID"
                    displayFields={["EMPLOYEE_CODE", "RPT_NAME"]}
                    loadOptions={loadEmployees}
                    onChange={(value, row) => {
                      setForm((prev) => ({
                        ...prev,
                        employeeId: value,
                        employeeCode: String(row?.EMPLOYEE_CODE ?? ""),
                        employeeName: String(row?.RPT_NAME ?? ""),
                      }));
                    }}
                    placeholder="Select employee..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-xs font-medium text-slate-600">
                    Amount <span className="text-rose-600">*</span>
                    <Input
                      type="number"
                      step="0.001"
                      value={form.amount}
                      onChange={(e) => setField("amount", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-slate-600">
                    Pay Unit Status <span className="text-rose-600">*</span>
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      value={form.payUnitStatus}
                      onChange={(e) => setField("payUnitStatus", e.target.value)}
                    >
                      <option value="">Select...</option>
                      {payUnitStatusOptions.map((opt) => (
                        <option key={opt.VALUE_CODE} value={opt.VALUE_CODE}>
                          {opt.VALUE_DESC}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-xs font-medium text-slate-600">
                    Approved On
                    <Input
                      type="date"
                      value={form.approvedOn}
                      onChange={(e) => setField("approvedOn", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-slate-600">
                    Status <span className="text-rose-600">*</span>
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      value={form.status}
                      onChange={(e) => setField("status", e.target.value)}
                    >
                      <option value="">Select...</option>
                      {statusOptions.map((opt) => (
                        <option key={opt.VALUE_CODE} value={opt.VALUE_CODE}>
                          {opt.VALUE_DESC}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-1 text-xs font-medium text-slate-600">
                  Remarks
                  <Input
                    value={form.remarks}
                    onChange={(e) => setField("remarks", e.target.value)}
                    className="h-8 text-xs"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#c7d2e3] bg-[#f8fafc] px-4 py-3">
                <Button type="button" variant="outline" size="sm" onClick={closeDialog} disabled={saving}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? "Saving..." : editing ? "Update" : "Save"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}