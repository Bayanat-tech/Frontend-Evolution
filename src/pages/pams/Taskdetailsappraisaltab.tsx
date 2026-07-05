import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../../state/AuthContext";
import { pamsSelect } from "../../api/pams";

// ─── Types ────────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;

interface Props {
  docNo: string;
  employeeCode: string;
  onRowsChange?: (rows: Row[]) => void;
  onGrandTotalChange?: (total: number) => void;
  isVisible?: boolean;
}

interface RowState {
  RATING: number | "";
  STANDARD_WEIGHTAGE: number | "";
  TOTAL: number;
}

const ALLOWED_RATINGS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function text(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

function num(val: unknown): number {
  const n = Number(val);
  return isFinite(n) ? n : 0;
}

function getClosestAllowedRating(value: number): number {
  let closest = ALLOWED_RATINGS[0];
  let minDiff = Math.abs(value - closest);
  for (const r of ALLOWED_RATINGS) {
    const diff = Math.abs(value - r);
    if (diff < minDiff) { minDiff = diff; closest = r; }
  }
  return closest;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  wrapper: {
    width: "100%", height: "420px", overflowY: "auto" as const,
    border: "1px solid #ddd", fontFamily: "inherit", fontSize: "11px",
  },
  table: { width: "100%", borderCollapse: "collapse" as const, tableLayout: "fixed" as const },
  th: {
    background: "#f8f8f8", borderBottom: "1px solid #ddd", borderRight: "1px solid #eee",
    padding: "8px 10px", textAlign: "left" as const, fontWeight: 600,
    fontSize: "11px", color: "#333", position: "sticky" as const,
    top: 0, zIndex: 1, whiteSpace: "nowrap" as const,
  },
  tdParent: {
    borderBottom: "1px solid #eee", padding: 0,
    verticalAlign: "top" as const, background: "#fff",
  },
  tdChild: {
    borderBottom: "1px solid #f0f0f0", padding: "6px 10px",
    verticalAlign: "middle" as const, background: "#fafafa",
    fontSize: "11px", color: "#666",
  },
  tdPinned: {
    borderTop: "2px solid #ddd", padding: "8px 10px",
    background: "#f8f8f8", fontWeight: 600, fontSize: "11px",
  },
  cellPad: { padding: "8px 10px" },
  toggleBtn: {
    display: "inline-flex" as const, alignItems: "center" as const,
    justifyContent: "center" as const, width: "16px", height: "16px",
    border: "1px solid #bbb", borderRadius: "3px", fontSize: "9px",
    cursor: "pointer", marginRight: "6px", background: "#fff",
    color: "#555", flexShrink: 0, userSelect: "none" as const, lineHeight: 1,
  },
  ratingSelect: {
    width: "70px", border: "1px solid #ccc", borderRadius: "4px",
    padding: "3px 6px", fontSize: "11px", textAlign: "center" as const,
    outline: "none", backgroundColor: "#fff", cursor: "pointer",
  },
  totalGreen: { color: "#2e7d32", fontWeight: 600 },
  emptyMsg: { padding: "40px", textAlign: "center" as const, color: "#9ca3af", fontSize: "13px" },
};

// ─── Component ────────────────────────────────────────────────────────────────
const TaskDetailsAppraisalTab: React.FC<Props> = ({
  docNo, employeeCode, onRowsChange, onGrandTotalChange,
}) => {
  const { user } = useAuth();
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";

  const [rows, setRows] = useState<Row[]>([]);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!docNo) return;
    setLoading(true);
    pamsSelect({
      parameter: "Trn_task", loginid,
      code1: companyCode, code2: docNo, code3: employeeCode,
    })
      .then((data) => {
        const sorted = [...(data as Row[])].sort(
          (a, b) => num(a.KPI_CODE) - num(b.KPI_CODE)
        );
        setRows(sorted);

        const fresh: Record<string, RowState> = {};
        sorted.forEach((row) => {
          const key = text(row.KPI_CODE);
          fresh[key] = {
            RATING: num(row.RATING) !== 0 ? num(row.RATING) : "",
            STANDARD_WEIGHTAGE: num(row.STANDARD_WEIGHTAGE) !== 0 ? num(row.STANDARD_WEIGHTAGE) : "",
            TOTAL: num(row.TOTAL),
          };
        });
        setRowStates(fresh);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [docNo, employeeCode, loginid, companyCode]);

  // ── Notify parent of row changes ───────────────────────────────────────────
  useEffect(() => {
    if (!rows.length || !onRowsChange) return;
    const updated = rows.map((row) => {
      const key = text(row.KPI_CODE);
      const state = rowStates[key];
      const safeW = state?.STANDARD_WEIGHTAGE === "" ? num(row.STANDARD_WEIGHTAGE) : num(state?.STANDARD_WEIGHTAGE);
      const safeR = state?.RATING === "" ? 0 : num(state?.RATING);
      return { ...row, RATING: safeR, STANDARD_WEIGHTAGE: safeW, TOTAL: state?.TOTAL ?? num(row.TOTAL) };
    });
    onRowsChange(updated);
  }, [rowStates, rows, onRowsChange]);

  // ── Grand total ────────────────────────────────────────────────────────────
  const grandTotal = useMemo(() => {
    let t = 0;
    rows.forEach((row) => {
      const key = text(row.KPI_CODE);
      t += rowStates[key]?.TOTAL ?? num(row.TOTAL);
    });
    return Math.round(t);
  }, [rows, rowStates]);

  useEffect(() => {
    if (onGrandTotalChange) onGrandTotalChange(grandTotal);
  }, [grandTotal, onGrandTotalChange]);

  // ── Rating change ──────────────────────────────────────────────────────────
  const handleRatingChange = (row: Row, value: string) => {
    const key = text(row.KPI_CODE);
    if (value === "") {
      setRowStates((prev) => ({ ...prev, [key]: { ...prev[key], RATING: "", TOTAL: 0 } }));
      return;
    }
    let n = Number(value);
    if (isNaN(n)) return;
    n = Math.round(n * 2) / 2;
    if (n < 1) n = 1;
    if (n > 5) n = 5;
    const allowed = getClosestAllowedRating(n);
    setRowStates((prev) => {
      const w = prev[key]?.STANDARD_WEIGHTAGE === "" ? num(row.STANDARD_WEIGHTAGE) : num(prev[key]?.STANDARD_WEIGHTAGE);
      const total = (w * allowed) / 100;
      return { ...prev, [key]: { ...prev[key], RATING: allowed, TOTAL: total } };
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.wrapper}>
      <table style={S.table}>
        <colgroup>
          <col style={{ width: "50px" }} />
          <col />
          <col style={{ width: "150px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "100px" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={S.th}>S.No</th>
            <th style={S.th}>KPI Code - Description</th>
            <th style={{ ...S.th, textAlign: "center" }}>Standard Weightage</th>
            <th style={{ ...S.th, textAlign: "center" }}>Rating ⭐</th>
            <th style={{ ...S.th, textAlign: "center" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} style={S.emptyMsg}>Loading task details...</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={5} style={S.emptyMsg}>No records found</td></tr>
          ) : rows.map((row, idx) => {
            const key = text(row.KPI_CODE);
            const isOpen = !!expanded[key];
            const items = text(row.KPI_ITEM_DESC).split(",").map((s) => s.trim()).filter(Boolean);
            const state = rowStates[key];
            const rating = state?.RATING ?? "";
            const weightage = state?.STANDARD_WEIGHTAGE ?? "";
            const total = state?.TOTAL ?? num(row.TOTAL);

            return (
              <React.Fragment key={`task-${key}`}>
                <tr>
                  <td style={S.tdParent}>
                    <div style={{ ...S.cellPad, color: "#999", textAlign: "center" }}>{idx + 1}</div>
                  </td>
                  <td style={S.tdParent}>
                    <div style={{ ...S.cellPad, display: "flex", alignItems: "flex-start" }}>
                      {items.length > 0 ? (
                        <span style={S.toggleBtn} onClick={() => setExpanded((p) => ({ ...p, [key]: !p[key] }))}>
                          {isOpen ? "▾" : "▸"}
                        </span>
                      ) : (
                        <span style={{ width: "22px", flexShrink: 0 }} />
                      )}
                      <span style={{ fontWeight: 600 }}>
                        {text(row.KPI_CODE)} - {text(row.KPI_DESC)}
                      </span>
                    </div>
                  </td>
                  <td style={S.tdParent}>
                    <div style={{ ...S.cellPad, textAlign: "center", color: "#555", fontWeight: 500 }}>
                      {weightage !== "" ? weightage : "—"}
                    </div>
                  </td>
                  <td style={S.tdParent}>
                    <div style={{ ...S.cellPad, textAlign: "center" }}>
                      <select
                        value={rating}
                        style={S.ratingSelect}
                        onChange={(e) => handleRatingChange(row, e.target.value)}
                      >
                        <option value="">0</option>
                        {ALLOWED_RATINGS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td style={S.tdParent}>
                    <div style={{ ...S.cellPad, textAlign: "center", ...S.totalGreen }}>
                      {total > 0 ? total.toFixed(2) : "—"}
                    </div>
                  </td>
                </tr>

                {isOpen && (
                  <tr key={`child-${key}`}>
                    <td style={{ ...S.tdChild, textAlign: "center" }} />
                    <td style={{ ...S.tdChild, paddingLeft: "38px", whiteSpace: "pre-wrap" }}>
                      ◾ {text(row.KPI_ITEM_DESC)}
                    </td>
                    <td style={S.tdChild} /><td style={S.tdChild} /><td style={S.tdChild} />
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td style={S.tdPinned} />
            <td style={S.tdPinned}>Total</td>
            <td style={S.tdPinned} />
            <td style={S.tdPinned} />
            <td style={{ ...S.tdPinned, textAlign: "center", ...S.totalGreen }}>{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default TaskDetailsAppraisalTab;