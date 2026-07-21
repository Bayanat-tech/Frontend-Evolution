import { useState, useMemo, useEffect } from "react";
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
}

const ALLOWED_RATINGS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

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
  td: {
    borderBottom: "1px solid #eee", padding: "8px 10px",
    verticalAlign: "middle" as const, background: "#fff",
  },
  tdPinned: {
    borderTop: "2px solid #ddd", padding: "8px 10px",
    background: "#f8f8f8", fontWeight: 600, fontSize: "11px",
  },
  ratingSelect: {
    width: "70px", border: "1px solid #ccc", borderRadius: "4px",
    padding: "3px 6px", fontSize: "11px", textAlign: "center" as const,
    outline: "none", backgroundColor: "#fff", cursor: "pointer",
  },
  totalGreen: { color: "#2e7d32", fontWeight: 600 },
  emptyMsg: { padding: "40px", textAlign: "center" as const, color: "#9ca3af", fontSize: "13px" },
};

const TaskCharacterAppraisalTab: React.FC<Props> = ({
  docNo, employeeCode, onRowsChange, onGrandTotalChange,
}) => {
  const { user }    = useAuth();
  const loginid     = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";

  const [rows,      setRows]      = useState<Row[]>([]);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!docNo) return;
    setLoading(true);
    pamsSelect({
      parameter: "Trn_character", loginid,
      code1: companyCode, code2: docNo, code3: employeeCode,
    })
      .then((data) => {
        const sorted = [...(data as Row[])].sort((a, b) => num(a.KPI_CODE) - num(b.KPI_CODE));
        setRows(sorted);
        const fresh: Record<string, RowState> = {};
        sorted.forEach((row) => {
          const key = text(row.KPI_CODE);
          fresh[key] = { RATING: num(row.RATING) !== 0 ? num(row.RATING) : "" };
        });
        setRowStates(fresh);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [docNo, employeeCode, loginid, companyCode]);

  useEffect(() => {
    if (!rows.length || !onRowsChange) return;
    const updated = rows.map((row) => {
      const key   = text(row.KPI_CODE);
      const state = rowStates[key];
      return { ...row, RATING: state?.RATING === "" ? 0 : num(state?.RATING) };
    });
    onRowsChange(updated);
  }, [rowStates, rows, onRowsChange]);

  const grandTotal = useMemo(() => {
    let sum = 0, count = 0;
    rows.forEach((row) => {
      const rating = rowStates[text(row.KPI_CODE)]?.RATING;
      if (rating !== "" && rating != null && !isNaN(Number(rating))) {
        sum += Number(rating); count++;
      }
    });
    return count > 0 ? Math.round(sum / count) : 0
  }, [rows, rowStates]);

  useEffect(() => {
    if (onGrandTotalChange) onGrandTotalChange(grandTotal);
  }, [grandTotal, onGrandTotalChange]);

  const handleRatingChange = (row: Row, value: string) => {
    const key = text(row.KPI_CODE);
    if (value === "") {
      setRowStates((prev) => ({ ...prev, [key]: { RATING: "" } }));
      return;
    }
    const rating = Number(value);
    if (isNaN(rating)) return;
    setRowStates((prev) => ({ ...prev, [key]: { RATING: rating } }));
  };

  return (
    <div style={S.wrapper}>
      <table style={S.table}>
        <colgroup>
          <col style={{ width: "60px" }} />
          <col />
          <col style={{ width: "120px" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={S.th}>S.No</th>
            <th style={S.th}>KPI Code - Description</th>
            <th style={{ ...S.th, textAlign: "center" }}>Rating ⭐</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={3} style={S.emptyMsg}>Loading characteristics...</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={3} style={S.emptyMsg}>No records found</td></tr>
          ) : rows.map((row, idx) => {
            const key    = text(row.KPI_CODE);
            const rating = rowStates[key]?.RATING ?? "";
            return (
              <tr key={`char-${key}`}>
                <td style={S.td}>
                  <div style={{ color: "#999", textAlign: "center" }}>{idx + 1}</div>
                </td>
                <td style={S.td}>
                  <div style={{ fontWeight: 600 }}>
                    {text(row.KPI_CODE)} - {text(row.KPI_DESC)}
                  </div>
                </td>
                <td style={S.td}>
                  <div style={{ textAlign: "center" }}>
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
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td style={S.tdPinned} />
            <td style={S.tdPinned}>Total</td>
            <td style={{ ...S.tdPinned, textAlign: "center", ...S.totalGreen }}>{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default TaskCharacterAppraisalTab;