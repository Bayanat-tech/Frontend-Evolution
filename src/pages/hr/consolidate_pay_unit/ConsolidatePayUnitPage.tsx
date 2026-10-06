import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Banknote, Edit2, Eye, IdCard, Loader2, Plus, RefreshCw, Save, Trash2, X,
} from "lucide-react";

import { LookupField } from "../../../components/ui/LookupField";
import { DataTable } from "../../../components/ui/DataTable";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import { Field, SectionPanel } from "../../../components/ui/Formblocks";
import { useToast } from "../../../components/ui/AlertToast";
import {
  getDynamicLookup, executeDynamicMutation, executeDynamicDelete, type LookupRow,
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

type FormMode = "add" | "edit" | "view";

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

const fmtAmount = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

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
  const [query, setQuery] = useState("");

  const [payUnitStatusOptions, setPayUnitStatusOptions] = useState<CodeOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<CodeOption[]>([]);

  // inline form (shown above the table)
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("add");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  // delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmpCompRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const readonly = formMode === "view";
  const editing = formMode === "edit";

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
    async (q?: string) => {
      const data = await getDynamicLookup({
        parameter: "MST_HR_CONSOLIDATE_PAY_UNIT",
        code1: companyCode,
      });
      const list = (data || []).map((row) => normalizePayUnitRow(row as Record<string, unknown>));
      if (!q?.trim()) return list as unknown as LookupRow[];
      const term = q.trim().toLowerCase();
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
    async (q?: string) => {
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
      if (!q?.trim()) return list;
      const term = q.trim().toLowerCase();
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

  // ── Inline form open / close ─────────────────────────────────────────────

  const openAdd = () => {
    if (!payCompId) {
      toast.warning("Please select a Pay Unit first");
      return;
    }
    setFormMode("add");
    setErrors({});
    setForm(
      emptyForm({
        payUnitStatus: payUnitStatusOptions[0]?.VALUE_CODE ?? "",
        status: statusOptions[0]?.VALUE_CODE ?? "",
      }),
    );
    setFormOpen(true);
  };

  const openRow = (mode: "edit" | "view", row: EmpCompRow) => {
    setFormMode(mode);
    setErrors({});
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
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setFormMode("add");
    setErrors({});
    setForm(emptyForm());
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const validate = (): string | null => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.employeeId.trim()) next.employeeId = "Employee is required";
    if (form.amount === "" || Number.isNaN(Number(form.amount))) next.amount = "Amount is required";
    if (!form.payUnitStatus.trim()) next.payUnitStatus = "Pay Unit Status is required";
    if (!form.status.trim()) next.status = "Status is required";
    setErrors(next);
    return Object.values(next)[0] ?? null;
  };

  const handleSave = async () => {
    if (!companyCode) {
      toast.warning("Company code not found. Please login again.");
      return;
    }
    if (!loginid) {
      toast.warning("Login id not found. Please login again.");
      return;
    }
    if (!payCompId) {
      toast.warning("Pay Unit is required");
      return;
    }
    const error = validate();
    if (error) {
      toast.warning(error);
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
        val1s5: form.remarks.trim(),
        val1s6: form.status.trim(), // STATUS_FLAG (VALUE_CODE from GROUP 6)
        val1s7: form.payUnitStatus.trim(), // COMP_STATUS (VALUE_CODE from GROUP 36)
        // APPROVED_ON as YYYY-MM-DD string — avoids ORA-01861 with DATE bind/NLS
        val1s9: form.approvedOn,
        val1n1: Number(form.amount),
      });
      toast.success(editing ? "Record updated successfully" : "Record saved successfully");
      setFormOpen(false);
      setForm(emptyForm());
      await loadMainPage(payCompId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save record");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────

  const requestDelete = (row: EmpCompRow) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  };

  const deleteLabel = deleteTarget
    ? deleteTarget.EMPLOYEE_CODE || deleteTarget.RPT_NAME || deleteTarget.EMPLOYEE_ID
    : "";

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await executeDynamicDelete({
        parameter: "MST_HR_CONSOLIDATE_EMP_COMP_DELETE",
        loginid,
        code1: companyCode,
        code2: String(deleteTarget.EMPLOYEE_ID),
        code3: String(deleteTarget.PAY_COMP_ID || payCompId),
      });
      toast.success("Record deleted successfully");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await loadMainPage(payCompId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete record");
    } finally {
      setDeleting(false);
    }
  };

  // ── Columns ──────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<EmpCompRow, unknown>[]>(
    () => [
      {
        id: "employee",
        header: "Employee",
        size: 280,
        enableSorting: false,
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
        enableSorting: false,
        cell: ({ getValue }) => {
          const v = getValue();
          if (v == null || v === "") return "";
          return fmtAmount(Number(v));
        },
      },
      {
        accessorKey: "COMP_STATUS",
        header: "Pay Unit Status",
        size: 130,
        enableSorting: false,
        cell: ({ getValue }) => codeLabel(payUnitStatusOptions, String(getValue() ?? "")),
      },
      {
        accessorKey: "APPROVED_ON",
        header: "Approved On",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => formatDateDisplay(getValue()),
      },
      {
        accessorKey: "STATUS_FLAG",
        header: "Status",
        size: 90,
        enableSorting: false,
        cell: ({ getValue }) => codeLabel(statusOptions, String(getValue() ?? "")),
      },
      {
        accessorKey: "REMARKS",
        header: "Remarks",
        size: 160,
        enableSorting: false,
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
              onClick={() => openRow("edit", row.original)}
              title="Edit"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openRow("view", row.original)}
              title="View"
            >
              <Eye size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => requestDelete(row.original)}
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payCompId, companyCode, payUnitStatusOptions, statusOptions],
  );

  const formTitle =
    formMode === "add" ? "New Pay Unit Entry" : editing ? "Edit Pay Unit Entry" : "View Pay Unit Entry";
  const formBadge = formMode === "add" ? "Draft" : editing ? "Editing" : "View only";

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Freight-style transaction header */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Banknote size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                HR Payroll - Consolidate Pay Unit
              </h1>
              <span className="text-xs text-muted-foreground">
                {rows.length.toLocaleString()} Row{rows.length === 1 ? "" : "s"}
              </span>
              {formOpen && (
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {formBadge}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadMainPage(payCompId)}
            disabled={!payCompId || loading || saving}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={openAdd} disabled={!payCompId || saving}>
            <Plus size={14} /> Add
          </Button>
          {formOpen && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={closeForm} disabled={saving}>
                <X size={14} /> Close
              </Button>
              {!readonly && (
                <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
                  {saving ? "Saving" : "Save"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Pay Unit selection */}
      <SectionPanel title="Pay Unit Selection" icon={Banknote}>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Pay Unit" required className="md:col-span-2">
            <LookupField
              compact
              label="Pay Unit"
              value={payCompId}
              displayValue={payCompLabel}
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
                // key changed → drop any half-filled form
                setFormOpen(false);
                setForm(emptyForm());
                void loadMainPage(value);
              }}
              placeholder="Pay unit code or name"
            />
          </Field>
        </div>
      </SectionPanel>

      {/* Add / Edit / View form — above the table */}
      {formOpen && (
        <SectionPanel title={formTitle} icon={IdCard}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Employee" required error={errors.employeeId} className="md:col-span-2">
              <LookupField
                compact
                label="Employee"
                disabled={readonly}
                value={form.employeeId}
                displayValue={
                  form.employeeId
                    ? `${form.employeeCode || form.employeeId}${form.employeeName ? `  ${form.employeeName}` : ""}`
                    : ""
                }
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
                placeholder="Employee code or name"
              />
            </Field>

            <Field label="Amount" required error={errors.amount}>
              <Input
                type="number"
                step="0.001"
                disabled={readonly}
                value={form.amount}
                onChange={(e) => setField("amount", e.target.value)}
              />
            </Field>

            <Field label="Pay Unit Status" required error={errors.payUnitStatus}>
              <Select
                disabled={readonly}
                value={form.payUnitStatus}
                onChange={(e) => setField("payUnitStatus", e.target.value)}
              >
                <option value="">-- Select --</option>
                {payUnitStatusOptions.map((opt) => (
                  <option key={opt.VALUE_CODE} value={opt.VALUE_CODE}>
                    {opt.VALUE_DESC}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Approved On">
              <Input
                type="date"
                disabled={readonly}
                value={form.approvedOn}
                onChange={(e) => setField("approvedOn", e.target.value)}
              />
            </Field>

            <Field label="Status" required error={errors.status}>
              <Select
                disabled={readonly}
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
              >
                <option value="">-- Select --</option>
                {statusOptions.map((opt) => (
                  <option key={opt.VALUE_CODE} value={opt.VALUE_CODE}>
                    {opt.VALUE_DESC}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Remarks" className="md:col-span-2">
              <Input
                disabled={readonly}
                value={form.remarks}
                onChange={(e) => setField("remarks", e.target.value)}
              />
            </Field>
          </div>
        </SectionPanel>
      )}

      {/* Pay unit grid */}
      <DataTable
        columns={columns}
        data={rows}
        title={loading ? "Loading" : `${rows.length.toLocaleString()} Employees`}
        subtitle="Employee Pay Unit Amounts"
        searchValue={query}
        onSearchChange={(value) => setQuery(value)}
        searchPlaceholder="Search employee..."
        loading={loading}
        emptyText={payCompId ? "No records found. Click Add to create one." : "Select Pay Unit to begin."}
        height={420}
        minWidth={1000}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => `${row.EMPLOYEE_ID}-${row.PAY_COMP_ID}`}
        enableExport
        exportFilename={`hr-pay-units-${payCompId || "all"}.csv`}
      />

      {/* Total */}
      {payCompId && rows.length > 0 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="font-semibold text-slate-700">Total:</span>
          <span className="min-w-[100px] rounded border border-border bg-card px-3 py-1 text-right font-semibold tabular-nums">
            {fmtAmount(totalAmount)}
          </span>
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog
        open={deleteOpen}
        title="Delete Pay Unit Record"
        description={deleteTarget ? `Delete pay unit for employee ${deleteLabel}?` : undefined}
        compact
        tone="danger"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          This action cannot be undone. Are you sure you want to delete the record for{" "}
          <strong>{deleteLabel}</strong>?
        </p>
      </Dialog>
    </section>
  );
}