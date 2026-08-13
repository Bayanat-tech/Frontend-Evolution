import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import type { LookupRow } from "../../api/lookups";
import { upsertAccrualAcctSetupApi } from "../../api/hr";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";

// ─── Header filter set — Company / Division / Department / Section, all
// required, mirroring the old dw_hr_accrualacsetup header band. These four
// scope every row in MS_HR_SEC_PAYCOMP_AC (see SELECT in email ss:
// COMPANY_CODE / DIV_CODE / DEPT_CODE / SECTION_CODE WHERE clause). ───────
type THeaderFilters = {
  company_code: string;
  company_name: string;
  div_code: string;
  div_name: string;
  dept_code: string;
  dept_name: string;
  section_code: string;
  section_name: string;
};

const EMPTY_HEADER: THeaderFilters = {
  company_code: "",
  company_name: "",
  div_code: "",
  div_name: "",
  dept_code: "",
  dept_name: "",
  section_code: "",
  section_name: "",
};

// ─── Grid row — one per Accrual Type, field names mirror the SELECT list
// from MS_HR_SEC_PAYCOMP_AC (PAY_COMP_TYPE = 'A' branch) plus the joined
// pay_desc subquery (ms_hr_accruals.accrual_desc). ─────────────────────────
type TAccrualAccountRow = {
  row_id: string;
  company_code: string;
  div_code: string;
  dept_code: string;
  section_code: string;
  pay_comp_id: string; // Accrual Type code, e.g. "11", "AL", "GR"
  pay_desc: string; // Accrual Type description
  ac_code_db: string;
  ac_code_db_name: string;
  ac_code_cr: string;
  ac_code_cr_name: string;
  sepn_flag: "Y" | "N"; // End of Service
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

// ─── LookupField configs — parameter strings match the exact WHEN literals
// in PROC_BUILD_DYNAMIC_SQL_MST_HR. ────────────────────────────────────

// Company — no filter, matches "SELECT COMPANY_CODE, COMP_NAME, COMP_SHORT_NAME
// FROM MS_HR_COMPANY ORDER BY COMPANY_CODE" from the old gf_search block.
const COMPANY_LOOKUP_PARAMETER = "MST_HR_MS_HR_COMPANY_DDL";
const COMPANY_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "company_code", header: "Company Code" },
  { field: "comp_name", header: "Company Name" },
];

// Division — existing proc branch, P_CODE1 = company.
const DIVISION_LOOKUP_PARAMETER = "MST_HR_ACCOUNT_DIVISION";
const DIVISION_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "div_code", header: "Division Code" },
  { field: "div_name", header: "Division Name" },
];

// Department — existing proc branch, P_CODE1 = company, P_CODE2 = division.
const DEPARTMENT_LOOKUP_PARAMETER = "MST_HR_MS_HR_DEPARTMENT";
const DEPARTMENT_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "dept_code", header: "Department Code" },
  { field: "dept_name", header: "Department Name" },
];

// Section — existing filtered proc branch, P_CODE1 = company, P_CODE2 =
// division, P_CODE3 = department.
const SECTION_LOOKUP_PARAMETER = "MST_HR_MS_HR_SECTION_DDL";
const SECTION_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "section_code", header: "Section Code" },
  { field: "section_name", header: "Section Name" },
];

// Accrual Type (pay_comp_id) — P_CODE1 = company. Mirrors PB 'pay_comp_id'
// CASE: SELECT accrual_type, accrual_desc FROM MS_HR_ACCRUALS WHERE
// COMPANY_CODE = :co AND ACCR_STATUS = 'A'.
const ACCRUAL_TYPE_LOOKUP_PARAMETER = "MST_HR_ACCRUAL_TYPE_DDL";
const ACCRUAL_TYPE_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "accrual_type", header: "Accrual Type" },
  { field: "accrual_desc", header: "Accrual Description" },
];

// Account Code (ac_code_db / ac_code_cr share the same query) — P_CODE1 =
// company. Mirrors PB 'ac_code_db' / 'ac_code_cr' CASE blocks.
const ACCOUNT_LOOKUP_PARAMETER = "MST_HR_ACCOUNT_CODE_DDL";
const ACCOUNT_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "ac_code", header: "Account Code" },
  { field: "ac_name", header: "Account Name" },
];

// ─── Retrieve parameter — matches the proc WHEN block added for
// MS_HR_SEC_PAYCOMP_AC. Save now goes through upsertAccrualAcctSetupApi
// (POST /api/finance/insUpdAccrualAcctSetup), one row per call, since
// PROC_INS_UPD_MS_HR_SEC_PAYCOMP_AC only accepts a single-row table type. ──
const RETRIEVE_PARAMETER = "MST_HR_ACCRUAL_AC_SETUP_RETRIEVE";

// ─── Delete parameter — routes through PROC_BUILD_DYNAMIC_DEL_COMMON
// ('MST_HR_' prefix) → PROC_BUILD_DYNAMIC_DEL_MST_HR. P_CODE1..P_CODE4 =
// Company/Div/Dept/Section, as usual. NOTE: the backend route
// (proc_build_dynamic_del_common) never forwards P_CODE5 — it's hardcoded
// to null there and that route can't be changed — so pay_comp_id (accrual
// type) instead gets appended directly onto the parameter string itself:
// 'MST_HR_ACCRUAL_AC_SETUP_DELETE_' + pay_comp_id (e.g. "...DELETE_AL").
// The DB proc detects this prefix with SUBSTR before its CASE statement
// and pulls pay_comp_id back out of the parameter suffix. ────────────────
const DELETE_PARAMETER_PREFIX = "MST_HR_ACCRUAL_AC_SETUP_DELETE_";

export function HrAccuralAccountSetup() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";

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
    !!header.company_code && !!header.div_code && !!header.dept_code && !!header.section_code;

  // ── Generic dropdown loader — P_CODE1..P_CODE4 only, since
  // PROC_BUILD_DYNAMIC_SQL_MST_HR doesn't read code5-10. Those are still
  // sent (as "NULL"/0/null) because getDynamicLookup's signature requires
  // them; the proc simply ignores them. ──────────────────────────────────
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

  // ── Retrieve — pulls existing MS_HR_SEC_PAYCOMP_AC rows for the header
  // scope (COMPANY_CODE / DIV_CODE / DEPT_CODE / SECTION_CODE, PAY_COMP_TYPE
  // = 'A'), per the SELECT in the email ss. ──────────────────────────────
  const handleRetrieve = useCallback(async () => {
    if (!header.company_code || !header.div_code || !header.dept_code || !header.section_code) {
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const response = await getDynamicLookup({
        parameter: RETRIEVE_PARAMETER,
        loginid,
        code1: header.company_code,
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
        company_code: r.company_code ?? header.company_code,
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
  }, [loginid, header.company_code, header.div_code, header.dept_code, header.section_code]);

  // ── Auto-retrieve — as soon as all four header fields (Company, Division,
  // Department, Section) are selected, fire the same Retrieve call the
  // button triggers, so the grid populates without an extra click. Any
  // change that clears one of the four (e.g. re-picking Company) simply
  // won't satisfy the condition below, so this won't fire again until the
  // full scope is complete again. ────────────────────────────────────────
  useEffect(() => {
    if (headerReady) {
      handleRetrieve();
    } else {
      // Header scope is incomplete again — clear any previously retrieved
      // rows so the grid doesn't show data for a stale/mismatched scope.
      setRows([]);
      setDeletedRowIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header.company_code, header.div_code, header.dept_code, header.section_code]);

  // ── Row editing helpers ────────────────────────────────────────────
  const updateRow = (row_id: string, patch: Partial<TAccrualAccountRow>) =>
    setRows((prev) => prev.map((r) => (r.row_id === row_id ? { ...r, ...patch } : r)));

  const addRow = () => setRows((prev) => [...prev, blankRow()]);

  // ── Delete row — new/unsaved rows (row_id starts with "new-") only ever
  // existed in local state, so they're just dropped. Existing rows are
  // deleted immediately against MS_HR_SEC_PAYCOMP_AC via executeDynamicDelete
  // (routes through PROC_BUILD_DYNAMIC_DEL_COMMON → PROC_BUILD_DYNAMIC_DEL_MST_HR),
  // scoped by Company/Div/Dept/Section (P_CODE1-4) + pay_comp_id, which is
  // appended onto the parameter string itself (see DELETE_PARAMETER_PREFIX)
  // since the backend route never forwards P_CODE5. Only removed from the
  // grid on success so a failed delete doesn't silently desync the UI from
  // the database. ───────────────────────────────────────────────────────
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
        code1: header.company_code,
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

  // ── Save — pushes each row back to MS_HR_SEC_PAYCOMP_AC via
  // upsertAccrualAcctSetupApi (POST /api/finance/insUpdAccrualAcctSetup).
  // The proc only accepts one row per call (WMSTST.MS_HR_SEC_PAYCOMP_AC_TAB
  // is built from a single-element array server-side), so rows are saved
  // sequentially. Row deletes are handled separately by removeRow, which
  // deletes immediately rather than batching with Save. ──────────────────
  const handleSave = useCallback(async () => {
    if (!headerReady) return;
    setSaving(true);
    setNotice(null);
    try {
      const today = new Date().toISOString();

      for (const row of rows) {
        await upsertAccrualAcctSetupApi({
          company_code: header.company_code,
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
  }, [loginid, header, headerReady, rows]);

  const columns: ColumnDef<TAccrualAccountRow>[] = [
    { accessorKey: "pay_comp_id", header: "Accrual Type", size: 130 },
    { accessorKey: "ac_code_db", header: "DB Account Code", size: 260 },
    { accessorKey: "ac_code_cr", header: "CR Account Code", size: 260 },
    { accessorKey: "sepn_flag", header: "End of Service", size: 130 },
    { accessorKey: "remarks", header: "Remarks", size: 200 },
  ];
  void columns; // kept for parity with Stock Inquiry's ColumnDef usage; grid below is hand-rolled for inline editing

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Accrual Account Setup</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Map accrual types to debit / credit accounts by company, division, department and
            section.
          </p>
        </div>
      </div>

      {notice && (
        <div className={notice.type === "error" ? "alert error" : "alert success"}>
          {notice.message}
        </div>
      )}

      {/* ── Header band — Company / Division / Department / Section ───── */}
      <div className="rounded-md border bg-card p-3">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div className="flex items-center gap-1.5 min-w-0" key="company">
            <span className="w-24 shrink-0 text-sm text-primary font-medium">Company: *</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                value={header.company_code}
                columns={COMPANY_LOOKUP_COLUMNS}
                valueField="company_code"
                displayFields={["company_code", "comp_name"]}
                loadOptions={() => loadLookupRows(COMPANY_LOOKUP_PARAMETER, "NULL")}
                onChange={(value, row) => {
                  setHeaderField("company_code", value);
                  setHeaderField("company_name", (row?.comp_name as string) ?? "");
                  // Company changed — downstream Division/Dept/Section picks
                  // are no longer valid; clear them so the header doesn't
                  // silently keep a stale scope.
                  setHeaderField("div_code", "");
                  setHeaderField("div_name", "");
                  setHeaderField("dept_code", "");
                  setHeaderField("dept_name", "");
                  setHeaderField("section_code", "");
                  setHeaderField("section_name", "");
                }}
                placeholder="Company code or name"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0" key="division">
            <span className="w-24 shrink-0 text-sm text-primary font-medium">Division: *</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                disabled={!header.company_code}
                value={header.div_code}
                columns={DIVISION_LOOKUP_COLUMNS}
                valueField="div_code"
                displayFields={["div_code", "div_name"]}
                loadOptions={() =>
                  loadLookupRows(DIVISION_LOOKUP_PARAMETER, header.company_code)
                }
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
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0" key="department">
            <span className="w-24 shrink-0 text-sm text-primary font-medium">Department: *</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                disabled={!header.div_code}
                value={header.dept_code}
                columns={DEPARTMENT_LOOKUP_COLUMNS}
                valueField="dept_code"
                displayFields={["dept_code", "dept_name"]}
                loadOptions={() =>
                  loadLookupRows(
                    DEPARTMENT_LOOKUP_PARAMETER,
                    header.company_code,
                    header.div_code,
                  )
                }
                onChange={(value, row) => {
                  setHeaderField("dept_code", value);
                  setHeaderField("dept_name", (row?.dept_name as string) ?? "");
                  setHeaderField("section_code", "");
                  setHeaderField("section_name", "");
                }}
                placeholder="Department code or name"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0" key="section">
            <span className="w-24 shrink-0 text-sm text-primary font-medium">Section: *</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                disabled={!header.dept_code}
                value={header.section_code}
                columns={SECTION_LOOKUP_COLUMNS}
                valueField="section_code"
                displayFields={["section_code", "section_name"]}
                loadOptions={() =>
                  loadLookupRows(
                    SECTION_LOOKUP_PARAMETER,
                    header.company_code,
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
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-end border-t pt-2">
          <Button size="sm" disabled={!headerReady || loading} onClick={handleRetrieve}>
            {loading ? "Retrieving..." : "Retrieve"}
          </Button>
        </div>
      </div>

      {/* ── Editable grid — Accrual Type / DB / CR / End of Service / Remarks ── */}
      <div className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b p-2">
          <span className="text-sm font-medium text-foreground">
            {rows.length.toLocaleString()} Row{rows.length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={!headerReady} onClick={addRow}>
              <Plus size={13} /> Add Row
            </Button>
            <Button size="sm" disabled={!headerReady || saving} onClick={handleSave}>
              <Save size={13} /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="w-10 px-2 py-1.5 font-medium">#</th>
                <th className="min-w-[180px] px-2 py-1.5 font-medium">Accrual Type</th>
                <th className="min-w-[260px] px-2 py-1.5 font-medium">DB Account Code</th>
                <th className="min-w-[260px] px-2 py-1.5 font-medium">CR Account Code</th>
                <th className="min-w-[120px] px-2 py-1.5 font-medium">End of Service</th>
                <th className="min-w-[180px] px-2 py-1.5 font-medium">Remarks</th>
                <th className="w-10 px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.row_id} className="border-b last:border-b-0">
                  <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>

                  <td className="px-2 py-1">
                    <LookupField
                      compact
                      value={row.pay_comp_id}
                      columns={ACCRUAL_TYPE_LOOKUP_COLUMNS}
                      valueField="accrual_type"
                      displayFields={["accrual_type", "accrual_desc"]}
                      loadOptions={() =>
                        loadLookupRows(ACCRUAL_TYPE_LOOKUP_PARAMETER, header.company_code)
                      }
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
                      columns={ACCOUNT_LOOKUP_COLUMNS}
                      valueField="ac_code"
                      displayFields={["ac_code", "ac_name"]}
                      loadOptions={() =>
                        loadLookupRows(ACCOUNT_LOOKUP_PARAMETER, header.company_code)
                      }
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
                      columns={ACCOUNT_LOOKUP_COLUMNS}
                      valueField="ac_code"
                      displayFields={["ac_code", "ac_name"]}
                      loadOptions={() =>
                        loadLookupRows(ACCOUNT_LOOKUP_PARAMETER, header.company_code)
                      }
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
                    <select
                      className="h-7 w-full rounded border bg-background px-2 text-sm"
                      value={row.sepn_flag}
                      onChange={(e) =>
                        updateRow(row.row_id, {
                          sepn_flag: e.target.value === "Y" ? "Y" : "N",
                        })
                      }
                    >
                      <option value="N">No</option>
                      <option value="Y">Yes</option>
                    </select>
                  </td>

                  <td className="px-2 py-1">
                    <Input
                      className="h-7 text-sm px-2"
                      value={row.remarks}
                      onChange={(e) => updateRow(row.row_id, { remarks: e.target.value })}
                      placeholder="Remarks"
                    />
                  </td>

                  <td className="px-2 py-1 text-center">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                      onClick={() => removeRow(row)}
                      disabled={deletingRowId === row.row_id}
                      aria-label="Remove row"
                    >
                      <Trash2 size={14} />
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
                      : "Select Company, Division, Department and Section to begin."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}