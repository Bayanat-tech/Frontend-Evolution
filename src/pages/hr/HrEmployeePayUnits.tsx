import type { ColumnDef } from "@tanstack/react-table";
import { Download, Loader2, Plus, RefreshCw, Save, Trash2, UserCog, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDynamicLookup, type LookupRow } from "../../api/lookups";
import { upsertHrEmpComponentsApi, type THrEmpComponentPayload } from "../../api/wms";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Field, SectionPanel } from "../../components/ui/Formblocks";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import { toInputDate } from "../../hooks/apiDate";

/* ================= TYPES ================= */

type THeaderFilters = {
  div_code: string;
  dept_code: string;
  section_code: string;
  employee_id: string;
};

type TPayUnitRow = {
  row_id: string;
  pay_unit_code: string;
  pay_unit_name: string;
  amount: string;
  pay_unit_status: string; // code: A | R | P
  approved_on: string; // YYYY-MM-DD
  status: string; // code: A | I
  remarks: string;
  dirty: boolean;
  is_new: boolean;
};

type Opt = { code: string; label: string };

/* ================= CONSTANTS ================= */

const EMPTY_HEADER: THeaderFilters = { div_code: "", dept_code: "", section_code: "", employee_id: "" };

const PAY_UNIT_STATUS_OPTIONS: Opt[] = [
  { code: "A", label: "Approved" },
  { code: "R", label: "Rejected" },
  { code: "P", label: "Pending" },
];
const STATUS_OPTIONS: Opt[] = [
  { code: "A", label: "Active" },
  { code: "I", label: "Inactive" },
];

const DIVISION_COLUMNS = [
  { field: "div_code", header: "Division Code" },
  { field: "div_name", header: "Division Name" },
];
const DEPARTMENT_COLUMNS = [
  { field: "dept_code", header: "Department Code" },
  { field: "dept_name", header: "Department Name" },
];
const SECTION_COLUMNS = [
  { field: "section_code", header: "Section Code" },
  { field: "section_name", header: "Section Name" },
];
const EMPLOYEE_COLUMNS = [
  { field: "employee_code", header: "Employee Code" },
  { field: "rpt_name", header: "Employee Name" },
  { field: "div_name", header: "Division" },
  { field: "dept_name", header: "Department" },
  { field: "section_name", header: "Section" },
];

const P_DIVISION = "MST_HR_ACCOUNT_DIVISION";
const P_DEPARTMENT = "MST_HR_MS_HR_DEPARTMENT";
const P_SECTION = "MST_HR_MS_HR_SECTION_DDL";
const P_EMPLOYEE = "MST_HR_VW_HR_EMP_MASTER_DDL";
const P_RETRIEVE = "MST_HR_EMPLOYEE_PAY_UNITS_SELECT";

/* ================= HELPERS ================= */

/** Accepts either a code ("P") or a label ("Pending") from the backend and returns the code. */
const toCode = (value: unknown, options: Opt[], fallback: string) => {
  const v = String(value ?? "").trim();
  return options.find((o) => o.code === v || o.label === v)?.code ?? fallback;
};

const today = () => new Date().toISOString().slice(0, 10);

const makeNewRow = (): TPayUnitRow => ({
  row_id: `new-${crypto.randomUUID()}`,
  pay_unit_code: "",
  pay_unit_name: "",
  amount: "0",
  pay_unit_status: "P",
  approved_on: today(),
  status: "A",
  remarks: "",
  dirty: true,
  is_new: true,
});

const NULLS = {
  code3: "NULL", code4: "NULL", code5: "NULL", code6: "NULL", code7: "NULL",
  code8: "NULL", code9: "NULL", code10: "NULL",
  number1: 0, number2: 0, number3: 0, number4: 0,
  date1: null, date2: null, date3: null, date4: null,
};

/* ================= PAGE ================= */

export function HrEmployeePayUnits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [header, setHeader] = useState<THeaderFilters>(EMPTY_HEADER);
  const [rows, setRows] = useState<TPayUnitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const patchHeader = (p: Partial<THeaderFilters>) => setHeader((prev) => ({ ...prev, ...p }));
  const employeeReady = !!companyCode && !!header.employee_id;

  /* ── Lookups ── */
  const loadLookupRows = useCallback(
    async (parameter: string, code1: string, code2 = "NULL", code3 = "NULL"): Promise<LookupRow[]> => {
      const response = await getDynamicLookup({
        parameter, loginid, code1, code2, ...NULLS, code3,
      });
      return Array.isArray(response) ? (response as LookupRow[]) : [];
    },
    [loginid],
  );

  const loadEmployeeOptions = useCallback(async () => {
    const all = await loadLookupRows(P_EMPLOYEE, companyCode);
    return all.filter((row) => {
      const r = row as Record<string, unknown>;
      if (header.div_code && r.div_code !== header.div_code) return false;
      if (header.dept_code && r.dept_code !== header.dept_code) return false;
      if (header.section_code && r.section_code !== header.section_code) return false;
      return true;
    });
  }, [loadLookupRows, companyCode, header.div_code, header.dept_code, header.section_code]);

  /* ── Retrieve ── */
  const handleRetrieve = useCallback(async () => {
    if (!companyCode || !header.employee_id) return;
    setLoading(true);
    try {
      const response = await getDynamicLookup({
        parameter: P_RETRIEVE, loginid, code1: companyCode, code2: header.employee_id, ...NULLS,
      });
      const list = (Array.isArray(response) ? response : []) as Record<string, any>[];
      setRows(
        list.map((r, idx) => ({
          row_id: `${r.pay_unit_code ?? "row"}-${idx}`,
          pay_unit_code: r.pay_unit_code ?? "",
          pay_unit_name: r.pay_unit_name ?? "",
          amount: r.amount != null ? String(r.amount) : "0",
          pay_unit_status: toCode(r.pay_unit_status, PAY_UNIT_STATUS_OPTIONS, "P"),
          approved_on: toInputDate(r.approved_on),
          status: toCode(r.status, STATUS_OPTIONS, "A"),
          remarks: r.remarks ?? "",
          dirty: false,
          is_new: false,
        })),
      );
    } catch (error) {
      setRows([]);
      toast.error(error instanceof Error ? error.message : "Unable to load pay units");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginid, companyCode, header.employee_id]);

  useEffect(() => {
    if (employeeReady) void handleRetrieve();
    else setRows([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyCode, header.employee_id]);

  /* ── Refresh: clear filters + grid (Retrieve re-fetches the current selection) ── */
  const handleClearAll = () => {
    setHeader(EMPTY_HEADER);
    setRows([]);
  };

  /* ── Row handlers (functional updates keep these stable for the columns memo) ── */
  const updateRow = useCallback(
    (row_id: string, patch: Partial<TPayUnitRow>) =>
      setRows((prev) => prev.map((r) => (r.row_id === row_id ? { ...r, ...patch, dirty: true } : r))),
    [],
  );
  const removeNewRow = useCallback(
    (row_id: string) => setRows((prev) => prev.filter((r) => r.row_id !== row_id)),
    [],
  );
  const addRow = () => {
    if (employeeReady) setRows((prev) => [makeNewRow(), ...prev]);
  };

  /* ── Save ── */
  const handleSave = async () => {
    if (!employeeReady) return;

    const dirtyRows = rows.filter((r) => r.dirty);
    if (dirtyRows.length === 0) {
      toast.warning("No changes to save.");
      return;
    }
    if (dirtyRows.some((r) => !r.pay_unit_code.trim())) {
      toast.warning("Pay Unit is required on every row.");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payloads: THrEmpComponentPayload[] = dirtyRows.map((row) => ({
        employee_id: header.employee_id,
        pay_comp_id: row.pay_unit_code,
        pay_comp_amt: Number(row.amount) || 0,
        pay_roll_status: row.pay_unit_status,
        status_flag: row.status,
        remarks: row.remarks,
        company_code: companyCode,
        user_id: loginid,
        user_dt: now,
        entered_on: now,
        entered_by: loginid,
        approved_on: row.approved_on ? new Date(`${row.approved_on}T00:00:00`).toISOString() : now,
      }));

      const results = await upsertHrEmpComponentsApi(payloads);
      const failed = results
        .map((result, i) => ({ result, row: dirtyRows[i] }))
        .filter(({ result }) => !result.success);

      if (failed.length === 0) {
        setRows((prev) => prev.map((r) => (r.dirty ? { ...r, dirty: false, is_new: false } : r)));
        toast.success("Pay units saved.");
      } else {
        console.error("Pay unit save failures:", failed);
        const first = failed[0].result as any;
        const reason = "error" in first ? first.error : first.details || first.message;
        toast.error(
          failed.length === 1
            ? `Failed to save "${failed[0].row.pay_unit_code}": ${reason}`
            : `${failed.length} of ${dirtyRows.length} pay unit(s) failed to save. First error: ${reason}`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save pay units");
    } finally {
      setSaving(false);
    }
  };

  /* ── Columns ── */
  const columns = useMemo<ColumnDef<TPayUnitRow>[]>(
    () => [
      {
        id: "pay_unit",
        header: "Pay Unit",
        size: 240,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center gap-1">
              {r.is_new ? (
                <Input
                  className="h-7 px-2 text-sm"
                  value={r.pay_unit_code}
                  placeholder="Pay unit code"
                  onChange={(e) => updateRow(r.row_id, { pay_unit_code: e.target.value })}
                />
              ) : (
                <span>
                  <span className="font-medium">{r.pay_unit_code}</span>
                  {r.pay_unit_name && r.pay_unit_name !== r.pay_unit_code && (
                    <span className="ml-1 text-muted-foreground">{r.pay_unit_name}</span>
                  )}
                </span>
              )}
              {r.dirty && <span className="text-amber-500" title="Unsaved change">●</span>}
            </div>
          );
        },
      },
      {
        id: "amount",
        header: "Amount",
        size: 130,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            type="number"
            min={0}
            className="h-7 px-2 text-right font-mono text-sm"
            value={row.original.amount}
            onChange={(e) => updateRow(row.original.row_id, { amount: e.target.value })}
          />
        ),
      },
      {
        id: "pay_unit_status",
        header: "Pay Unit Status",
        size: 150,
        enableSorting: false,
        cell: ({ row }) => (
          <Select
            value={row.original.pay_unit_status}
            onChange={(e) => updateRow(row.original.row_id, { pay_unit_status: e.target.value })}
          >
            {PAY_UNIT_STATUS_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>{o.label}</option>
            ))}
          </Select>
        ),
      },
      {
        id: "approved_on",
        header: "Approved On",
        size: 150,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            type="date"
            className="h-7 px-2 text-sm"
            value={row.original.approved_on}
            onChange={(e) => updateRow(row.original.row_id, { approved_on: e.target.value })}
          />
        ),
      },
      {
        id: "status",
        header: "Status",
        size: 120,
        enableSorting: false,
        cell: ({ row }) => (
          <Select
            value={row.original.status}
            onChange={(e) => updateRow(row.original.row_id, { status: e.target.value })}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>{o.label}</option>
            ))}
          </Select>
        ),
      },
      {
        id: "remarks",
        header: "Remarks",
        size: 220,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            className="h-7 px-2 text-sm"
            placeholder="Remarks"
            value={row.original.remarks}
            onChange={(e) => updateRow(row.original.row_id, { remarks: e.target.value })}
          />
        ),
      },
      {
        id: "actions",
        header: "",
        size: 50,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) =>
          row.original.is_new ? (
            <div className="flex justify-center">
              <button
                type="button"
                className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                onClick={() => removeNewRow(row.original.row_id)}
                title="Remove unsaved row"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ) : null,
      },
    ],
    [updateRow, removeNewRow],
  );

  /* ── UI ── */
  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Freight-style transaction header */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <UserCog size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">HR Employee - Pay Units</h1>
              <span className="text-xs text-muted-foreground">
                {rows.length.toLocaleString()} Row{rows.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={handleClearAll} disabled={saving}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={!employeeReady || saving}>
            <Plus size={14} /> Add
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleRetrieve} disabled={!employeeReady || loading || saving}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}{" "}
            {loading ? "Retrieving" : "Retrieve"}
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={!employeeReady || saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      {/* Employee selection */}
      <SectionPanel title="Employee Selection" icon={Users}>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Division" required>
            <LookupField
              compact
              disabled={!companyCode}
              value={header.div_code}
              columns={DIVISION_COLUMNS}
              valueField="div_code"
              displayFields={["div_code", "div_name"]}
              loadOptions={() => loadLookupRows(P_DIVISION, companyCode)}
              onChange={(value) =>
                patchHeader({ div_code: value, dept_code: "", section_code: "", employee_id: "" })
              }
              placeholder="Division code or name"
            />
          </Field>

          <Field label="Department" required>
            <LookupField
              compact
              disabled={!header.div_code}
              value={header.dept_code}
              columns={DEPARTMENT_COLUMNS}
              valueField="dept_code"
              displayFields={["dept_code", "dept_name"]}
              loadOptions={() => loadLookupRows(P_DEPARTMENT, companyCode, header.div_code)}
              onChange={(value) => patchHeader({ dept_code: value, section_code: "", employee_id: "" })}
              placeholder="Department code or name"
            />
          </Field>

          <Field label="Section" required>
            <LookupField
              compact
              disabled={!header.dept_code}
              value={header.section_code}
              columns={SECTION_COLUMNS}
              valueField="section_code"
              displayFields={["section_code", "section_name"]}
              loadOptions={() => loadLookupRows(P_SECTION, companyCode, header.div_code, header.dept_code)}
              onChange={(value) => patchHeader({ section_code: value, employee_id: "" })}
              placeholder="Section code or name"
            />
          </Field>

          <Field label="Employee" required className="md:col-span-3">
            <LookupField
              compact
              disabled={!companyCode}
              value={header.employee_id}
              columns={EMPLOYEE_COLUMNS}
              valueField="employee_id"
              displayFields={["employee_code", "rpt_name"]}
              loadOptions={loadEmployeeOptions}
              onChange={(value) => patchHeader({ employee_id: value })}
              placeholder="Employee code or name"
            />
          </Field>
        </div>
      </SectionPanel>

      {/* Pay units grid */}
      <DataTable
        columns={columns}
        data={rows}
        title={loading ? "Loading" : `${rows.length.toLocaleString()} Pay Units`}
        subtitle="Employee Pay Unit Amounts"
        loading={loading}
        emptyText={employeeReady ? "No pay units found for this employee." : "Select Employee to begin."}
        height={420}
        minWidth={1000}
        density="grid"
        getRowId={(row) => row.row_id}
      />
    </section>
  );
}

export default HrEmployeePayUnits;