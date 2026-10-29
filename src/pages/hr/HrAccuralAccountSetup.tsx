// ════════════════════════════════════════════════════════════════════════
// HrAccuralAccountSetup.tsx — Refactored to Employee-Master style UI
// Header: freight-transaction-header; Panels: SectionPanel + Field
// ════════════════════════════════════════════════════════════════════════
import type { ColumnDef } from "@tanstack/react-table";
import {
  Building2,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import type { LookupRow } from "../../api/lookups";
import { upsertAccrualAcctSetupApi } from "../../api/hr";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Field, SectionPanel } from "../../components/ui/Formblocks";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

// ─── Shared control density (matches employee master / other refactored pages) ──
const CTL = "h-7 text-xs";

// ─── Header filter set — Division / Department / Section, all required,
// mirroring the old dw_hr_accrualacsetup header band. ─────────────────────
type THeaderFilters = {
  div_code: string;
  div_name: string;
  dept_code: string;
  dept_name: string;
  section_code: string;
  section_name: string;
};

const EMPTY_HEADER: THeaderFilters = {
  div_code: "",
  div_name: "",
  dept_code: "",
  dept_name: "",
  section_code: "",
  section_name: "",
};

// ─── Grid row ─────────────────────────────────────────────────────────────
type TAccrualAccountRow = {
  row_id: string;
  company_code: string;
  div_code: string;
  dept_code: string;
  section_code: string;
  pay_comp_id: string;
  pay_desc: string;
  ac_code_db: string;
  ac_code_db_name: string;
  ac_code_cr: string;
  ac_code_cr_name: string;
  sepn_flag: "Y" | "N";
  remarks: string;
  pay_comp_earn_ded?: string;
  is_new?: boolean;
};

const blankRow = (): TAccrualAccountRow => ({
  row_id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  company_code: "",
  div_code: "",
  dept_code: "",
  section_code: "",
  pay_comp_id: "",
  pay_desc: "",
  ac_code_db: "",
  ac_code_db_name: "",
  ac_code_cr: "",
  ac_code_cr_name: "",
  sepn_flag: "N",
  remarks: "",
  is_new: true,
});

// ─── LookupField configs ──────────────────────────────────────────────────
const DIVISION_LOOKUP_PARAMETER = "MST_HR_ACCOUNT_DIVISION";
const DIVISION_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "div_code", header: "Division Code" },
  { field: "div_name", header: "Division Name" },
];

const DEPARTMENT_LOOKUP_PARAMETER = "MST_HR_MS_HR_DEPARTMENT";
const DEPARTMENT_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "dept_code", header: "Department Code" },
  { field: "dept_name", header: "Department Name" },
];

const SECTION_LOOKUP_PARAMETER = "MST_HR_MS_HR_SECTION_DDL";
const SECTION_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "section_code", header: "Section Code" },
  { field: "section_name", header: "Section Name" },
];

const ACCRUAL_TYPE_LOOKUP_PARAMETER = "MST_HR_ACCRUAL_TYPE_DDL";
const ACCRUAL_TYPE_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "accrual_type", header: "Accrual Type" },
  { field: "accrual_desc", header: "Accrual Description" },
];

const ACCOUNT_LOOKUP_PARAMETER = "MST_HR_ACCOUNT_CODE_DDL";
const ACCOUNT_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "ac_code", header: "Account Code" },
  { field: "ac_name", header: "Account Name" },
];

const RETRIEVE_PARAMETER = "MST_HR_ACCRUAL_AC_SETUP_RETRIEVE";
const DELETE_PARAMETER_PREFIX = "MST_HR_ACCRUAL_AC_SETUP_DELETE_";

export function HrAccuralAccountSetup() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [header, setHeader] = useState<THeaderFilters>({ ...EMPTY_HEADER });
  const [rows, setRows] = useState<TAccrualAccountRow[]>([]);
  const [deletedRowIds, setDeletedRowIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const setHeaderField = (field: keyof THeaderFilters, value: unknown) =>
    setHeader((prev) => ({ ...prev, [field]: value }));

  const headerReady =
    !!companyCode && !!header.div_code && !!header.dept_code && !!header.section_code;

  const loadLookupRows = useCallback(
    async (
      parameter: string,
      code1: string,
      code2 = "NULL",
      code3 = "NULL",
      code4 = "NULL",
    ): Promise<LookupRow[]> => {
      const response = await getDynamicLookup({
        parameter,
        loginid,
        code1,
        code2,
        code3,
        code4,
        code5: "NULL",
        code6: "NULL",
        code7: "NULL",
        code8: "NULL",
        code9: "NULL",
        code10: "NULL",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
      return Array.isArray(response) ? (response as LookupRow[]) : [];
    },
    [loginid],
  );

  const handleRetrieve = useCallback(async () => {
    if (!companyCode || !header.div_code || !header.dept_code || !header.section_code) {
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await getDynamicLookup({
        parameter: RETRIEVE_PARAMETER,
        loginid,
        code1: companyCode,
        code2: header.div_code,
        code3: header.dept_code,
        code4: header.section_code,
        code5: "NULL",
        code6: "NULL",
        code7: "NULL",
        code8: "NULL",
        code9: "NULL",
        code10: "NULL",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
      const list = Array.isArray(response) ? response : [];
      const mapped: TAccrualAccountRow[] = list.map((r: any, idx: number) => ({
        row_id: `${r.pay_comp_id ?? "row"}-${idx}`,
        company_code: r.company_code ?? companyCode,
        div_code: r.div_code ?? header.div_code,
        dept_code: r.dept_code ?? header.dept_code,
        section_code: r.section_code ?? header.section_code,
        pay_comp_id: r.pay_comp_id ?? "",
        pay_desc: r.pay_desc ?? "",
        ac_code_db: String(r.ac_code_db ?? "").trim(),
        ac_code_db_name: r.ac_code_db_name ?? "",
        ac_code_cr: r.ac_code_cr ?? "",
        ac_code_cr_name: r.ac_code_cr_name ?? "",
        sepn_flag: r.sepn_flag === "Y" ? "Y" : "N",
        remarks: r.remarks ?? "",
      }));
      setRows(mapped);
      setDeletedRowIds([]);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load accrual account setup",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode, header.div_code, header.dept_code, header.section_code]);

  useEffect(() => {
    if (headerReady) {
      handleRetrieve();
    } else {
      setRows([]);
      setDeletedRowIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyCode, header.div_code, header.dept_code, header.section_code]);

  const handleClearAll = useCallback(() => {
    setHeader({ ...EMPTY_HEADER });
    setRows([]);
    setDeletedRowIds([]);
    setNotice(null);
  }, []);

  const updateRow = (row_id: string, patch: Partial<TAccrualAccountRow>) =>
    setRows((prev) => prev.map((r) => (r.row_id === row_id ? { ...r, ...patch } : r)));

  const addRow = () => setRows((prev) => [...prev, blankRow()]);

  const removeRow = async (row: TAccrualAccountRow) => {
    if (row.row_id.startsWith("new-")) {
      setRows((prev) => prev.filter((r) => r.row_id !== row.row_id));
      return;
    }

    setDeletingRowId(row.row_id);
    setNotice(null);
    try {
      await executeDynamicDelete({
        parameter: `${DELETE_PARAMETER_PREFIX}${row.pay_comp_id}`,
        loginid,
        code1: companyCode,
        code2: header.div_code,
        code3: header.dept_code,
        code4: header.section_code,
      });
      setRows((prev) => prev.filter((r) => r.row_id !== row.row_id));
      setDeletedRowIds((prev) => [...prev, row.row_id]);
      setNotice({ type: "success", message: "Row deleted." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete row",
      });
    } finally {
      setDeletingRowId(null);
    }
  };

  const handleSave = useCallback(async () => {
    if (!headerReady) return;
    setSaving(true);
    setNotice(null);
    try {
      const today = new Date().toISOString();

      for (const row of rows) {
        await upsertAccrualAcctSetupApi({
          company_code: companyCode,
          div_code: header.div_code,
          dept_code: header.dept_code,
          section_code: header.section_code,
          pay_comp_id: row.pay_comp_id,
          ac_code_db: row.ac_code_db || null,
          ac_code_cr: row.ac_code_cr || null,
          pay_comp_type: "A",
          pay_comp_earn_ded: row.pay_comp_earn_ded || null,
          sepn_flag: row.sepn_flag,
          remarks: row.remarks || null,
          user_id: loginid,
          user_dt: today,
        });
      }

      setNotice({ type: "success", message: "Accrual account setup saved." });
      setDeletedRowIds([]);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to save accrual account setup",
      });
    } finally {
      setSaving(false);
    }
  }, [loginid, companyCode, header, headerReady, rows]);

  const columns: ColumnDef<TAccrualAccountRow>[] = [
    { accessorKey: "pay_comp_id", header: "Accrual Type", size: 130 },
    { accessorKey: "ac_code_db", header: "DB Account Code", size: 260 },
    { accessorKey: "ac_code_cr", header: "CR Account Code", size: 260 },
    { accessorKey: "sepn_flag", header: "End of Service", size: 130 },
    { accessorKey: "remarks", header: "Remarks", size: 200 },
  ];
  void columns;

  const thClass =
    "px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600";

  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* ══ Header — freight-transaction-header (Employee Master style) ══ */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Wallet size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                Accrual Account Setup
              </h1>
              <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                {headerReady ? "Scope Ready" : "Select Scope"}
              </span>
              {headerReady && (
                <span className="text-xs text-muted-foreground">
                  {header.div_code} / {header.dept_code} / {header.section_code}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button size="sm" variant="outline" onClick={handleClearAll} disabled={saving}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!headerReady || loading}
            onClick={handleRetrieve}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {loading ? "Retrieving" : "Retrieve"}
          </Button>
          <Button size="sm" disabled={!headerReady || saving} onClick={handleSave}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      {/* ══ Scope — Division / Department / Section ══ */}
      <SectionPanel title="Scope" icon={Building2}>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Division" required>
            <LookupField
              compact
              disabled={!companyCode}
              value={header.div_code}
              displayValue={
                header.div_code && header.div_name
                  ? `${header.div_code} - ${header.div_name}`
                  : header.div_code
              }
              columns={DIVISION_LOOKUP_COLUMNS}
              valueField="div_code"
              displayFields={["div_code", "div_name"]}
              loadOptions={() => loadLookupRows(DIVISION_LOOKUP_PARAMETER, companyCode)}
              onChange={(value, row) => {
                setHeaderField("div_code", value);
                setHeaderField("div_name", (row?.div_name as string) ?? "");
                setHeaderField("dept_code", "");
                setHeaderField("dept_name", "");
                setHeaderField("section_code", "");
                setHeaderField("section_name", "");
              }}
              placeholder="Division code or name"
            />
          </Field>

          <Field label="Department" required>
            <LookupField
              compact
              disabled={!header.div_code}
              value={header.dept_code}
              displayValue={
                header.dept_code && header.dept_name
                  ? `${header.dept_code} - ${header.dept_name}`
                  : header.dept_code
              }
              columns={DEPARTMENT_LOOKUP_COLUMNS}
              valueField="dept_code"
              displayFields={["dept_code", "dept_name"]}
              loadOptions={() =>
                loadLookupRows(DEPARTMENT_LOOKUP_PARAMETER, companyCode, header.div_code)
              }
              onChange={(value, row) => {
                setHeaderField("dept_code", value);
                setHeaderField("dept_name", (row?.dept_name as string) ?? "");
                setHeaderField("section_code", "");
                setHeaderField("section_name", "");
              }}
              placeholder="Department code or name"
            />
          </Field>

          <Field label="Section" required>
            <LookupField
              compact
              disabled={!header.dept_code}
              value={header.section_code}
              displayValue={
                header.section_code && header.section_name
                  ? `${header.section_code} - ${header.section_name}`
                  : header.section_code
              }
              columns={SECTION_LOOKUP_COLUMNS}
              valueField="section_code"
              displayFields={["section_code", "section_name"]}
              loadOptions={() =>
                loadLookupRows(
                  SECTION_LOOKUP_PARAMETER,
                  companyCode,
                  header.div_code,
                  header.dept_code,
                )
              }
              onChange={(value, row) => {
                setHeaderField("section_code", value);
                setHeaderField("section_name", (row?.section_name as string) ?? "");
              }}
              placeholder="Section code or name"
            />
          </Field>
        </div>
      </SectionPanel>

      {/* ══ Editable grid ══ */}
      <SectionPanel title="Accrual Accounts" icon={ListChecks}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {rows.length.toLocaleString()} row{rows.length === 1 ? "" : "s"}
          </span>
          <Button size="sm" variant="secondary" disabled={!headerReady} onClick={addRow}>
            <Plus size={13} /> Add Row
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className={`w-10 ${thClass}`}>#</th>
                <th className={`min-w-[180px] ${thClass}`}>Accrual Type</th>
                <th className={`min-w-[260px] ${thClass}`}>DB Account Code</th>
                <th className={`min-w-[260px] ${thClass}`}>CR Account Code</th>
                <th className={`min-w-[120px] ${thClass}`}>End of Service</th>
                <th className={`min-w-[180px] ${thClass}`}>Remarks</th>
                <th className="w-10 px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.row_id} className="border-b last:border-b-0">
                  <td className="px-2 py-1 text-xs text-muted-foreground">{idx + 1}</td>

                  <td className="px-2 py-1">
                    <LookupField
                      compact
                      value={row.pay_comp_id}
                      displayValue={
                        row.pay_comp_id && row.pay_desc
                          ? `${row.pay_comp_id} - ${row.pay_desc}`
                          : row.pay_comp_id
                      }
                      columns={ACCRUAL_TYPE_LOOKUP_COLUMNS}
                      valueField="accrual_type"
                      displayFields={["accrual_type", "accrual_desc"]}
                      loadOptions={() => loadLookupRows(ACCRUAL_TYPE_LOOKUP_PARAMETER, companyCode)}
                      onChange={(value, opt) =>
                        updateRow(row.row_id, {
                          pay_comp_id: value,
                          pay_desc: (opt?.accrual_desc as string) ?? "",
                        })
                      }
                      placeholder="Accrual type"
                    />
                  </td>

                  <td className="px-2 py-1">
                    <LookupField
                      compact
                      value={row.ac_code_db}
                      displayValue={
                        row.ac_code_db && row.ac_code_db_name
                          ? `${row.ac_code_db} - ${row.ac_code_db_name}`
                          : row.ac_code_db
                      }
                      columns={ACCOUNT_LOOKUP_COLUMNS}
                      valueField="ac_code"
                      displayFields={["ac_code", "ac_name"]}
                      loadOptions={() => loadLookupRows(ACCOUNT_LOOKUP_PARAMETER, companyCode)}
                      onChange={(value, opt) =>
                        updateRow(row.row_id, {
                          ac_code_db: value.trim(),
                          ac_code_db_name: (opt?.ac_name as string) ?? "",
                        })
                      }
                      placeholder="DB account"
                    />
                  </td>

                  <td className="px-2 py-1">
                    <LookupField
                      compact
                      value={row.ac_code_cr}
                      displayValue={
                        row.ac_code_cr && row.ac_code_cr_name
                          ? `${row.ac_code_cr} - ${row.ac_code_cr_name}`
                          : row.ac_code_cr
                      }
                      columns={ACCOUNT_LOOKUP_COLUMNS}
                      valueField="ac_code"
                      displayFields={["ac_code", "ac_name"]}
                      loadOptions={() => loadLookupRows(ACCOUNT_LOOKUP_PARAMETER, companyCode)}
                      onChange={(value, opt) =>
                        updateRow(row.row_id, {
                          ac_code_cr: value,
                          ac_code_cr_name: (opt?.ac_name as string) ?? "",
                        })
                      }
                      placeholder="CR account"
                    />
                  </td>

                  <td className="px-2 py-1">
                    <Select
                      className={`${CTL} w-full`}
                      value={row.sepn_flag}
                      onChange={(e) =>
                        updateRow(row.row_id, {
                          sepn_flag: e.target.value === "Y" ? "Y" : "N",
                        })
                      }
                    >
                      <option value="N">No</option>
                      <option value="Y">Yes</option>
                    </Select>
                  </td>

                  <td className="px-2 py-1">
                    <Input
                      className={`${CTL} w-full`}
                      value={row.remarks}
                      onChange={(e) => updateRow(row.row_id, { remarks: e.target.value })}
                      placeholder="Remarks"
                    />
                  </td>

                  <td className="px-2 py-1 text-center">
                    <button
                      type="button"
                      className="grid h-6 w-6 place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      onClick={() => removeRow(row)}
                      disabled={deletingRowId === row.row_id}
                      aria-label="Remove row"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                    {headerReady
                      ? loading
                        ? "Loading..."
                        : "No records found for this scope — Add Row to start."
                      : "Select Division, Department and Section to begin."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionPanel>
    </section>
  );
}