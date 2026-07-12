import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../state/AuthContext";
import { pamsSelect, pamsSave, pamsDelete } from "../../api/pams";
import { DataTable } from "../../components/ui/PamsDataTable";
import { LookupField } from "../../components/ui/LookupField";
import { ColumnDef } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import type { LookupRow } from "../../api/lookups";

// ─── Types ────────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;

interface WeightageRow {
  WEIGHTAGE_CODE: string;
  TASK_PCT: number;
  CHARACTER_PCT: number;
  PERIOD_NUMBER: string;
  DEPT_CODE: string;
  DIV_CODE: string;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_DATE: string;
  MODIFIED_BY: string;
  MODIFIED_DATE: string;
}

function text(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}
function num(val: unknown): number {
  const n = Number(val);
  return isFinite(n) ? n : 0;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page: {
    padding: "16px", fontFamily: "inherit", fontSize: "12px",
    color: "#333", width: "100%", boxSizing: "border-box" as const,
  },
  pageHeader: {
    display: "flex" as const, alignItems: "flex-start" as const,
    justifyContent: "space-between" as const, marginBottom: "14px",
    gap: "12px", flexWrap: "wrap" as const,
  },
  pageTitle: { fontSize: "15px", fontWeight: 600, color: "#222" },
  pageSubtitle: { fontSize: "11px", color: "#888", marginTop: "2px" },
  activeBadge: {
    fontSize: "11px", padding: "4px 12px", borderRadius: "4px",
    background: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9",
    fontWeight: 600, whiteSpace: "nowrap" as const, flexShrink: 0,
  },
  card: {
    background: "#fff", border: "1px solid #e0e0e0", borderRadius: "6px",
    padding: "14px 16px", marginBottom: "12px",
    width: "100%", boxSizing: "border-box" as const,
  },
  cardTitle: {
    fontSize: "10px", fontWeight: 600, color: "#888",
    textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "12px",
  },
  // 3-col equal grid for Additional Settings
  grid3Equal: {
    display: "grid" as const,
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "12px",
  },
  grid2: {
    display: "grid" as const, gridTemplateColumns: "1fr 1fr", gap: "12px",
  },
  field: { display: "flex" as const, flexDirection: "column" as const, gap: "5px" },
  label: { fontSize: "11px", color: "#666", fontWeight: 500 },
  inputWrap: { position: "relative" as const },
  input: {
    width: "100%", height: "34px", border: "1px solid #ccc", borderRadius: "4px",
    padding: "0 28px 0 10px", fontSize: "13px", fontWeight: 500, outline: "none",
    background: "#fff", color: "#333", boxSizing: "border-box" as const,
  },
  inputReadonly: { background: "#f5f5f5", color: "#666" },
  inputSuffix: {
    position: "absolute" as const, right: "8px", top: "50%",
    transform: "translateY(-50%)", fontSize: "12px", color: "#aaa",
  },
  barTrack: {
    height: "8px", background: "#f0f0f0", borderRadius: "99px",
    overflow: "hidden" as const, display: "flex" as const, marginBottom: "6px",
  },
  barTask: { height: "100%", background: "#185FA5", transition: "width 0.3s ease" },
  barChar: { height: "100%", background: "#0F6E56", transition: "width 0.3s ease" },
  legend: { display: "flex" as const, gap: "16px", marginBottom: "8px" },
  legItem: { display: "flex" as const, alignItems: "center" as const, gap: "5px", fontSize: "11px", color: "#666" },
  legDot: { width: "8px", height: "8px", borderRadius: "50%" },
  summaryRow: {
    display: "flex" as const, justifyContent: "space-between" as const,
    alignItems: "center" as const, fontSize: "12px", marginTop: "6px",
  },
  alertOk: {
    padding: "7px 10px", borderRadius: "4px", fontSize: "11px",
    background: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9", marginTop: "8px",
  },
  alertWarn: {
    padding: "7px 10px", borderRadius: "4px", fontSize: "11px",
    background: "#fff3e0", color: "#e65100", border: "1px solid #ffe0b2", marginTop: "8px",
  },
  tableHeader: {
    display: "flex" as const, justifyContent: "space-between" as const,
    alignItems: "center" as const, marginBottom: "8px",
  },
  actions: {
    display: "flex" as const, gap: "8px", justifyContent: "flex-end" as const,
    alignItems: "center" as const, marginTop: "12px",
  },
  btn: {
    height: "32px", padding: "0 14px", borderRadius: "4px", fontSize: "12px",
    cursor: "pointer", border: "1px solid #ccc", background: "#fff", color: "#333",
  },
  btnPrimary: {
    height: "32px", padding: "0 14px", borderRadius: "4px", fontSize: "12px",
    cursor: "pointer", border: "1px solid #185FA5", background: "#185FA5",
    color: "#fff", fontWeight: 600,
  },
  btnDisabled: { opacity: 0.45, cursor: "not-allowed" as const },
  savedMsg: { fontSize: "11px", color: "#2e7d32", fontWeight: 500 },
  errorMsg: { fontSize: "11px", color: "#c62828", marginTop: "6px" },
  badgeActive: {
    fontSize: "10px", padding: "2px 8px", borderRadius: "3px",
    background: "#e8f5e9", color: "#2e7d32", fontWeight: 600,
  },
  badgeInactive: {
    fontSize: "10px", padding: "2px 8px", borderRadius: "3px",
    background: "#f5f5f5", color: "#999",
  },
  deleteBtn: {
    display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const,
    width: "28px", height: "28px", borderRadius: "4px", border: "1px solid #fca5a5",
    background: "#fff5f5", color: "#c62828", cursor: "pointer",
    transition: "all 0.15s ease",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────
const AppraisalWeightageMaster: React.FC = () => {
  const { user } = useAuth();
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";

  // ── Form state ────────────────────────────────────────────────────────────
  const [taskPct, setTaskPct] = useState<number>(70);
  const [periodNumber, setPeriodNumber] = useState<string>("");
  const [periodDisplay, setPeriodDisplay] = useState<string>("");
  const [divCode, setDivCode] = useState<string>("ALL");
  const [divDisplay, setDivDisplay] = useState<string>("All Divisions");
  const [deptCode, setDeptCode] = useState<string>("ALL");
  const [deptDisplay, setDeptDisplay] = useState<string>("All Departments");

  // ── Data state ────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<WeightageRow[]>([]);
  const [periods, setPeriods] = useState<Row[]>([]);
  const [divisions, setDivisions] = useState<Row[]>([]);
  const [departments, setDepartments] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const charPct = 100 - taskPct;
  const isValid = taskPct >= 1 && taskPct <= 99;
  const activeRow = history.find((r) => r.IS_ACTIVE === "Y");

  // ── Fetch base data ───────────────────────────────────────────────────────
  const fetchAll = useCallback(() => {
    setLoading(true);
    setErrorMsg("");

    Promise.all([
      pamsSelect({ parameter: "appraisal_weightage_list", loginid, code1: companyCode })
        .catch(() => []),
      pamsSelect({ parameter: "period", loginid, code1: companyCode })
        .catch(() => []),
      pamsSelect({ parameter: "division", loginid, code1: companyCode })
        .catch(() => []),
    ])
      .then(([hist, per, div]) => {
        const histRows = hist as unknown as WeightageRow[];
        setHistory(histRows || []);
        setPeriods(per as Row[] || []);
        setDivisions(div as Row[] || []);

        // Pre-fill with active record
        const active = histRows?.find((r) => r.IS_ACTIVE === "Y");
        if (active) {
          setTaskPct(num(active.TASK_PCT));
          setPeriodNumber(text(active.PERIOD_NUMBER));
          setPeriodDisplay(text(active.PERIOD_NUMBER));
          setDivCode(text(active.DIV_CODE) || "ALL");
          setDivDisplay(text(active.DIV_CODE) || "All Divisions");
          setDeptCode(text(active.DEPT_CODE) || "ALL");
          setDeptDisplay(text(active.DEPT_CODE) || "All Departments");
        }
      })
      .catch(() => {
        setHistory([]);
        setPeriods([]);
        setDivisions([]);
        setErrorMsg("Failed to load data. Please check console for details.");
      })
      .finally(() => setLoading(false));
  }, [companyCode, loginid]);

  useEffect(() => {
    if (companyCode) fetchAll();
  }, [companyCode, fetchAll]);

  // ── Cascade: fetch departments when division changes ──────────────────────
  useEffect(() => {
    if (!companyCode) return;
    setDeptCode("ALL");
    setDeptDisplay("All Departments");
    if (divCode === "ALL") {
      setDepartments([]);
      return;
    }
    pamsSelect({ parameter: "department", loginid, code1: companyCode, code2: divCode })
      .then((d) => setDepartments(d as Row[] || []))
      .catch(() => setDepartments([]));
  }, [divCode, companyCode, loginid]);

  // ── Lookup data adapters ──────────────────────────────────────────────────
  const periodOptions = useMemo((): LookupRow[] =>
    periods.map((p) => ({
      PERIOD_NUMBER: text(p.PERIOD_NUMBER),
      DISPLAY_NAME: text(p.PERIOD_NUMBER),
    })), [periods]);

  const divisionOptions = useMemo((): LookupRow[] => [
    { DIV_CODE: "ALL", DIV_NAME: "All Divisions" },
    ...divisions.map((d) => ({
      DIV_CODE: text(d.DIV_CODE),
      DIV_NAME: text(d.DIV_NAME),
    })),
  ], [divisions]);

  const deptOptions = useMemo((): LookupRow[] => [
    { dept_code: "ALL", dept_name: "All Departments" },
    ...departments.map((d) => ({
      dept_code: text(d.dept_code),
      dept_name: text(d.dept_name),
    })),
  ], [departments]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isValid) return;
    if (!periodNumber) { setErrorMsg("Please select an effective period"); return; }
    if (!divCode) { setErrorMsg("Please select a division"); return; }

    setSaving(true);
    setErrorMsg("");
    setSavedMsg(false);
    try {
      await pamsSave({
        parameter: "appraisal_weightage_ins_upd",
        loginid,
        val1s1: companyCode,
        val1s2: deptCode,
        val1s3: periodNumber,
        val1s4: divCode,
        val1n1: taskPct,
        val1n2: charPct,
      });
      setTimeout(() => {
        setSavedMsg(true);
        fetchAll();
        setTimeout(() => setSavedMsg(false), 3000);
      }, 500);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setErrorMsg(error.response?.data?.message || error.message || "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete single row ─────────────────────────────────────────────────────
  const handleDeleteRow = async (code: string) => {
    setDeleting(code);
    setErrorMsg("");
    try {
      await pamsDelete({
        parameter: "delete_appraisal_weightage",
        loginid,
        code1: companyCode,
        code2: code,
      });
      fetchAll();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  // ── DataTable columns ─────────────────────────────────────────────────────
  const columns: ColumnDef<WeightageRow>[] = useMemo(() => [
    {
      accessorKey: "PERIOD_NUMBER",
      header: "Period",
      cell: ({ getValue }) => text(getValue()) || "—",
    },
    {
      accessorKey: "DIV_CODE",
      header: "Division",
      cell: ({ getValue }) => text(getValue()) || "ALL",
    },
    {
      accessorKey: "DEPT_CODE",
      header: "Department",
      cell: ({ getValue }) => text(getValue()) || "ALL",
    },
    {
      accessorKey: "TASK_PCT",
      header: "Task %",
      cell: ({ getValue }) => (
        <span style={{ fontWeight: 600, color: "#185FA5" }}>{num(getValue())}%</span>
      ),
    },
    {
      accessorKey: "CHARACTER_PCT",
      header: "Character %",
      cell: ({ getValue }) => (
        <span style={{ fontWeight: 600, color: "#0F6E56" }}>{num(getValue())}%</span>
      ),
    },
    {
      accessorKey: "MODIFIED_BY",
      header: "Modified By",
      cell: ({ row }) => text(row.original.MODIFIED_BY) || text(row.original.CREATED_BY),
    },
    {
      accessorKey: "MODIFIED_DATE",
      header: "Date",
      cell: ({ row }) => {
        const date = text(row.original.MODIFIED_DATE) || text(row.original.CREATED_DATE);
        if (date) {
          try {
            const f = new Date(date).toLocaleDateString("en-IN");
            return f !== "Invalid Date" ? f : date;
          } catch { return date; }
        }
        return "—";
      },
    },
    {
      accessorKey: "IS_ACTIVE",
      header: "Status",
      cell: ({ getValue }) =>
        getValue() === "Y"
          ? <span style={S.badgeActive}>Active</span>
          : <span style={S.badgeInactive}>Expired</span>,
    },
    {
      // ── Actions column with Delete only ──────────────────────────────────
      id: "actions",
      header: "Actions",
      size: 70,
      cell: ({ row }) => {
        const code = text(row.original.WEIGHTAGE_CODE);
        const isDeleting = deleting === code;
        return (
          <button
            style={{
              ...S.deleteBtn,
              opacity: isDeleting ? 0.5 : 1,
              cursor: isDeleting ? "not-allowed" : "pointer",
            }}
            disabled={isDeleting}
            title="Delete configuration"
            onClick={() => void handleDeleteRow(code)}
          >
            <Trash2 size={14} />
          </button>
        );
      },
    },
  ], [deleting]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* ── Page Header ── */}
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Appraisal Weightage Master</div>
          <div style={S.pageSubtitle}>
            Set Task % and Character % proportion for final appraisal score
          </div>
        </div>
        {activeRow && (
          <span style={S.activeBadge}>
            Active: Task {num(activeRow.TASK_PCT)}% / Character {num(activeRow.CHARACTER_PCT)}%
          </span>
        )}
      </div>

      {/* ── Weightage Config Card ── */}
      <div style={S.card}>
        <div style={S.cardTitle}>Weightage Configuration</div>
        <div style={S.grid2}>
          <div style={S.field}>
            <span style={S.label}>Task Weightage</span>
            <div style={S.inputWrap}>
              <input
                type="number" min={1} max={99} step={5} value={taskPct}
                style={S.input}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v)) setTaskPct(Math.min(99, Math.max(1, v)));
                }}
              />
              <span style={S.inputSuffix}>%</span>
            </div>
          </div>
          <div style={S.field}>
            <span style={S.label}>Character Weightage (auto)</span>
            <div style={S.inputWrap}>
              <input type="number" value={charPct} readOnly
                style={{ ...S.input, ...S.inputReadonly }} />
              <span style={S.inputSuffix}>%</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "14px" }}>
          <div style={S.legend}>
            <span style={S.legItem}><span style={{ ...S.legDot, background: "#185FA5" }} />Task ({taskPct}%)</span>
            <span style={S.legItem}><span style={{ ...S.legDot, background: "#0F6E56" }} />Character ({charPct}%)</span>
          </div>
          <div style={S.barTrack}>
            <div style={{ ...S.barTask, width: `${taskPct}%` }} />
            <div style={{ ...S.barChar, width: `${charPct}%` }} />
          </div>
          <div style={S.summaryRow}>
            <span style={{ color: "#888" }}>Total</span>
            <span style={{ fontWeight: 600 }}>100%</span>
          </div>
        </div>
        <div style={isValid ? S.alertOk : S.alertWarn}>
          {isValid
            ? `✓ Valid — Task ${taskPct}% + Character ${charPct}% = 100%`
            : "⚠ Each component must be between 1% and 99%"}
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>Additional Settings</div>
        <div style={S.grid3Equal}>
          <div style={S.field}>
            <span style={S.label}>Sel Period <span style={{ color: "#c62828" }}>*</span></span>
            <LookupField
              compact
              label="Effective Period"
              value={periodNumber}
              displayValue={periodDisplay}
              placeholder="Select Period"
              columns={[
                { field: "PERIOD_NUMBER", header: "Period Number" },
              ]}
              valueField="PERIOD_NUMBER"
              displayFields={["PERIOD_NUMBER"]}
              loadOptions={async () => periodOptions}
              onChange={(val, row) => {
                setPeriodNumber(val);
                setPeriodDisplay(row ? text(row.PERIOD_NUMBER) : val);
              }}
            />
          </div>
          <div style={S.field}>
            <span style={S.label}>Division <span style={{ color: "#c62828" }}>*</span></span>
            <LookupField
              compact
              label="Division"
              value={divCode}
              displayValue={divDisplay}
              placeholder="Select Division"
              columns={[
                { field: "DIV_CODE", header: "Code" },
                { field: "DIV_NAME", header: "Division Name" },
              ]}
              valueField="DIV_CODE"
              displayFields={["DIV_CODE", "DIV_NAME"]}
              loadOptions={async () => divisionOptions}
              onChange={(val, row) => {
                setDivCode(val || "ALL");
                setDivDisplay(row ? text(row.DIV_NAME) : (val || "All Divisions"));
              }}
            />
          </div>
          <div style={S.field}>
            <span style={S.label}>Department</span>
            <LookupField
              compact
              disabled={divCode === "ALL"}
              label="Department"
              value={deptCode}
              displayValue={deptDisplay}
              placeholder="All Departments"
              columns={[
                { field: "dept_code", header: "Code" },
                { field: "dept_name", header: "Department Name" },
              ]}
              valueField="dept_code"
              displayFields={["dept_code", "dept_name"]}
              loadOptions={async () => deptOptions}
              onChange={(val, row) => {
                setDeptCode(val || "ALL");
                setDeptDisplay(row ? text(row.dept_name) : (val || "All Departments"));
              }}
            />
          </div>

        </div>
      </div>

      <div style={S.card}>
        <div style={S.tableHeader}>
          <div style={S.cardTitle} className="mb-0">
            Saved Configurations
            {!activeRow && (
              <span style={{ marginLeft: "8px", fontSize: "10px", color: "#e65100" }}>
                — No active config found
              </span>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={history}
          loading={loading}
          height={260}
          density="compact"
          emptyText="No configurations found"
          enablePagination={false}
        />
      </div>

      {errorMsg && <div style={S.errorMsg}>⚠ {errorMsg}</div>}

      <div style={S.actions}>
        {savedMsg && <span style={S.savedMsg}>✓ Saved successfully</span>}
        <button
          style={{ ...S.btnPrimary, ...(!isValid || saving ? S.btnDisabled : {}) }}
          disabled={!isValid || saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving..." : "Save Weightage"}
        </button>
      </div>

    </div>
  );
};
export default AppraisalWeightageMaster;