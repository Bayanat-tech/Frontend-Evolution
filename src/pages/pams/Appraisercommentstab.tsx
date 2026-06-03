import { useState, useMemo, useEffect } from "react";
import { useAuth } from "../../state/AuthContext";
import { pamsSelect } from "../../api/pams";

type Row = Record<string, unknown>;

interface Props {
  docNo: string;
  employeeCode: string;
  isVisible?: boolean;
  taskTotal: number;
  characterTotal: number;
  flowLevel?: number;      // Current FLOW_LEVEL_RUNNING from DB
  userFlowLevel?: number;  // 0 = meri baari hai (editable), >0 = already submitted (readonly)
  onAppraiserCommentChange?: (val: string) => void;
  onAppraiseeCommentChange?: (val: string) => void;
}

function text(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

function fmtDateTime(val: unknown): string {
  if (!val) return "";
  const d = new Date(String(val));
  if (isNaN(d.getTime())) return "";
  const dd  = String(d.getDate()).padStart(2, "0");
  const mm  = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh  = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

const S = {
  scoreRow: { display: "flex" as const, gap: "12px", marginBottom: "16px" },
  scoreBox: (accent: string): React.CSSProperties => ({
    flex: 1, padding: "12px", borderRadius: "8px", textAlign: "center",
    border: `1px solid ${accent}40`, background: `${accent}10`,
  }),
  scoreLabel: { fontSize: "11px", color: "#6b7280", marginBottom: "4px" },
  scoreValue: (color: string): React.CSSProperties => ({
    fontSize: "1.4rem", fontWeight: 800, color,
  }),
  grid: {
    display: "grid" as const, gridTemplateColumns: "1fr 1fr",
    border: "1px solid #111",
  },
  header: {
    padding: "8px 12px", textAlign: "center" as const,
    fontWeight: 700, fontSize: "13px", borderBottom: "1px solid #111",
  },
  textarea: (readOnly: boolean): React.CSSProperties => ({
    width: "100%", minHeight: "160px", padding: "8px",
    border: "none", outline: "none", resize: "vertical" as const,
    fontSize: "13px", fontFamily: "inherit",
    background: readOnly ? "#f5f5f5" : "#fff",
    color: "#111827", boxSizing: "border-box" as const,
  }),
  meta: { fontSize: "11px", color: "#6b7280", marginTop: "4px" },
  readOnlyTag: { fontSize: "11px", color: "#ef4444", marginTop: "4px" },
  spinner: { padding: "40px", textAlign: "center" as const, color: "#9ca3af", fontSize: "13px" },
};

const AppraiserCommentsTab: React.FC<Props> = ({
  docNo,
  employeeCode,
  taskTotal,
  characterTotal,
  flowLevel    = 0,
  userFlowLevel = 0,
  onAppraiserCommentChange,
  onAppraiseeCommentChange,
}) => {
  const { user } = useAuth();
  const loginid  = user?.loginid || user?.username || "";

  const [appraiserComment, setAppraiserComment] = useState("");
  const [appraiseeComment, setAppraiseeComment] = useState("");
  const [existingData,     setExistingData]     = useState<Row | null>(null);
  const [loading,          setLoading]          = useState(false);

  // ── Access Control ──────────────────────────────────────────────────────────
  // isEmployee        → logged in user appraisee hai
  // isFinal           → flowLevel >= 6 = final approved, sab read-only
  // isCurrentActionUser → userFlowLevel === 0 means NEXT_ACTION_BY = loginid
  //                       yaani iska turn hai comment daalne ka
  const isEmployee          = loginid.trim().toUpperCase() === employeeCode.trim().toUpperCase();
  const isFinal             = flowLevel >= 6;
  const isCurrentActionUser = userFlowLevel === 0 && !isEmployee && !isFinal;
   const appraiserReadOnly   = isEmployee || isFinal || !isCurrentActionUser;
  const appraiseeReadOnly = !isEmployee || isFinal;

  const finalRating = useMemo(
    () => Math.round((Number(taskTotal || 0) + Number(characterTotal || 0)) / 2),
    [taskTotal, characterTotal]
  );

  // ── Fetch comments ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!docNo) return;
    setLoading(true);
    pamsSelect({ parameter: "appraisal_comments", loginid, code1: docNo })
      .then((res) => {
        if (res.length > 0) {
          const row = res[0] as Row;
          setExistingData(row);

          // ── Appraiser comment field selection ─────────────────────────
          // userFlowLevel = 0  → PENDING  → APPRAISER_COMMENTS  (editable)
          // userFlowLevel = 1  → L1 done  → APPRAISER_COMMENTS1 (view only)
          // userFlowLevel = 2  → L2 done  → APPRAISER_COMMENTS2 (view only)
          // ... same pattern aage bhi
          // DB Trigger: submit pe APPRAISER_COMMENTS → APPRAISER_COMMENTS{N}
          //             mein move hota hai, APPRAISER_COMMENTS NULL ho jaata hai
          // ─────────────────────────────────────────────────────────────
          let ac = "";
          if      (userFlowLevel === 0) ac = text(row.APPRAISER_COMMENTS);
          else if (userFlowLevel === 1) ac = text(row.APPRAISER_COMMENTS1);
          else if (userFlowLevel === 2) ac = text(row.APPRAISER_COMMENTS2);
          else if (userFlowLevel === 3) ac = text(row.APPRAISER_COMMENTS3);
          else if (userFlowLevel === 4) ac = text(row.APPRAISER_COMMENTS4);
          else if (userFlowLevel === 5) ac = text(row.APPRAISER_COMMENTS5);
          else                          ac = text(row.APPRAISER_COMMENTS);

          const apc = text(row.APPRAISEE_COMMENTS);
          setAppraiserComment(ac);
          setAppraiseeComment(apc);
          onAppraiserCommentChange?.(ac);
          onAppraiseeCommentChange?.(apc);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [docNo, loginid, flowLevel, userFlowLevel]);

  const formattedCommentsDate = existingData?.COMMENTS_DATE
    ? fmtDateTime(existingData.COMMENTS_DATE) : "";
  const formattedAppraiseeCommentsDate = existingData?.APPRAISEE_COMMENTS_DATE
    ? fmtDateTime(existingData.APPRAISEE_COMMENTS_DATE) : "";

  if (loading) return <div style={S.spinner}>Loading comments...</div>;

  return (
    <div>
      {/* Score summary */}
      <div style={S.scoreRow}>
        <div style={S.scoreBox("#1976d2")}>
          <div style={S.scoreLabel}>Task Score</div>
          <div style={S.scoreValue("#1976d2")}>{Math.round(taskTotal)}</div>
        </div>
        <div style={S.scoreBox("#9c27b0")}>
          <div style={S.scoreLabel}>Character Score</div>
          <div style={S.scoreValue("#9c27b0")}>{characterTotal}</div>
        </div>
        <div style={S.scoreBox("#2e7d32")}>
          <div style={S.scoreLabel}>Final Rating</div>
          <div style={S.scoreValue("#2e7d32")}>{finalRating}</div>
        </div>
      </div>

      {/* Comments grid */}
      <div style={S.grid}>
        <div style={{ ...S.header, borderRight: "1px solid #111" }}>Appraiser Comments</div>
        <div style={S.header}>Appraisee Comments</div>

        {/* Appraiser field */}
        <div style={{ padding: "8px", borderTop: "1px solid #111", borderRight: "1px solid #111" }}>
          <textarea
            style={S.textarea(appraiserReadOnly)}
            value={appraiserComment}
            readOnly={appraiserReadOnly}
            placeholder={appraiserReadOnly ? "" : "Enter appraiser comments..."}
            onChange={(e) => {
              if (appraiserReadOnly) return;
              setAppraiserComment(e.target.value);
              onAppraiserCommentChange?.(e.target.value);
            }}
          />
          {formattedCommentsDate && (
            <div style={S.meta}>Last saved: {formattedCommentsDate}</div>
          )}
          {appraiserReadOnly && <div style={S.readOnlyTag}>View only</div>}
        </div>

        {/* Appraisee field */}
        <div style={{ padding: "8px", borderTop: "1px solid #111" }}>
          <textarea
            style={S.textarea(appraiseeReadOnly)}
            value={appraiseeComment}
            readOnly={appraiseeReadOnly}
            placeholder={appraiseeReadOnly ? "" : "Enter appraisee comments..."}
            onChange={(e) => {
              if (appraiseeReadOnly) return;
              setAppraiseeComment(e.target.value);
              onAppraiseeCommentChange?.(e.target.value);
            }}
          />
          {formattedAppraiseeCommentsDate && (
            <div style={S.meta}>Last saved: {formattedAppraiseeCommentsDate}</div>
          )}
          {appraiseeReadOnly && <div style={S.readOnlyTag}>View only</div>}
        </div>
      </div>
    </div>
  );
};

export default AppraiserCommentsTab;