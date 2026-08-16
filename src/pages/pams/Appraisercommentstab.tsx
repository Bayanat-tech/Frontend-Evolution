import { useState, useMemo, useEffect } from "react";
import { useAuth } from "../../state/AuthContext";
import { pamsSelect } from "../../api/pams";

type Row = Record<string, unknown>;

interface WeightageConfig {
  taskPct: number;
  charPct: number;
  isHrDefined: boolean;
}

interface Props {
  docNo: string;
  employeeCode: string;
  isVisible?: boolean;
  taskTotal: number;
  characterTotal: number;
  flowLevel?: number;
  userFlowLevel?: number;
  weightageConfig?: WeightageConfig;
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
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function commentForLevel(row: Row | null, level: number): string {
  if (!row || level < 1 || level > 5) return "";
  return text(row[`APPRAISER_COMMENTS${level}`]);
}

function nameForLevel(row: Row | null, level: number): string {
  if (!row || level < 1 || level > 5) return "";
  return text(row[`APPRAISER_NAME${level}`]);
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
  scoreNote: { fontSize: "10px", color: "#9ca3af", marginTop: "3px" },
  formulaBadge: {
    display: "inline-block" as const, fontSize: "10px", padding: "2px 6px",
    borderRadius: "3px", background: "#e3f2fd", color: "#1565c0",
    border: "1px solid #bbdefb", marginTop: "4px",
  },
  grid: { display: "grid" as const, gridTemplateColumns: "1fr 1fr", border: "1px solid #111" },
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
  prevBlock: {
    padding: "8px", marginBottom: "8px", borderRadius: "6px",
    background: "#f9fafb", border: "1px solid #e5e7eb",
  },
  prevName: { fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" },
  prevComment: {
    fontSize: "13px", color: "#4b5563", whiteSpace: "pre-wrap" as const,
  },
  nameBox: { fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" },
};

const AppraiserCommentsTab: React.FC<Props> = ({
  docNo,
  employeeCode,
  taskTotal,
  characterTotal,
  flowLevel     = 0,
  userFlowLevel = 0,
  weightageConfig,
  onAppraiserCommentChange,
  onAppraiseeCommentChange,
}) => {
  const { user }  = useAuth();
  const loginid   = user?.loginid || user?.username || "";
  const myName    = (user as Row | undefined)?.name as string | undefined;
  const [appraiserComment, setAppraiserComment] = useState("");
  const [appraiseeComment, setAppraiseeComment] = useState("");
  const [existingData,     setExistingData]     = useState<Row | null>(null);
  const [loading,          setLoading]          = useState(false);
  
  const isEmployee          = loginid.trim().toUpperCase() === employeeCode.trim().toUpperCase();
  const isFinal             = flowLevel >= 6;
  const isCurrentActionUser = userFlowLevel === 0 && !isEmployee && !isFinal;
  const appraiserReadOnly   = isEmployee || isFinal || !isCurrentActionUser;
  const appraiseeReadOnly   = !isEmployee || isFinal;
  
  const effectiveLevel = userFlowLevel === 0 ? flowLevel : userFlowLevel;
  const prevLevelNum        = effectiveLevel - 1;
  const prevLevelCommentRaw = effectiveLevel >= 2 ? commentForLevel(existingData, prevLevelNum) : "";
  const prevLevelComment    = prevLevelCommentRaw.trim();
  const showPrevLevel       = prevLevelComment.length > 0;
  const prevLevelName       = showPrevLevel ? nameForLevel(existingData, prevLevelNum) : "";

  // ── FIXED: Current Actor Name Logic ──
  const currentActorName = useMemo(() => {
    if (!existingData) return myName || loginid;
    
    // If document is at Level 0 (employee self-rating draft)
    // Show Level 1 (Supervisor) name - because that's who will act next
    if (flowLevel === 0) {
      const level1Name = text(existingData.APPRAISER_NAME1);
      // Also try to get IMMEDIATE_SUPERVISOR name if available
      const supervisorName = text(existingData.IMMEDIATE_SUPERVISOR_NAME) || text(existingData.NEXT_ACTION_BY_NAME);
      return level1Name || supervisorName || myName || loginid;
    }
    
    // If current user is the actor (userFlowLevel === 0 means "it's my turn")
    if (userFlowLevel === 0) {
      if (isCurrentActionUser) {
        // Current user is the one who should act
        return text(existingData.CURRENT_USER_NAME) || myName || loginid;
      }
      if (isEmployee) {
        // Employee is viewing - show who created it
        return text(existingData.CREATED_BY_NAME) || myName || loginid;
      }
      // For other cases, show the next action person
      return text(existingData.NEXT_ACTION_BY_NAME) || myName || loginid;
    }
    
    // For other levels (1-5), show the name for that specific level
    return nameForLevel(existingData, userFlowLevel);
  }, [existingData, flowLevel, userFlowLevel, isCurrentActionUser, isEmployee, myName, loginid]);

  const employeeName = text(existingData?.EMPLOYEE_NAME);
  
  const { finalRating, taskWeighted, charWeighted } = useMemo(() => {
    const t = Number(taskTotal      || 0);
    const c = Number(characterTotal || 0);

    if (weightageConfig?.isHrDefined) {
      const tw  = (t * weightageConfig.taskPct) / 100;
      const cw  = (c * weightageConfig.charPct) / 100;
      return { finalRating: Math.round(tw + cw), taskWeighted: tw, charWeighted: cw };
    }
    return {
      finalRating:  Math.round((t + c) / 2),
      taskWeighted: t / 2,
      charWeighted: c / 2,
    };
  }, [taskTotal, characterTotal, weightageConfig]);

  // ── Fetch comments ──
  useEffect(() => {
    if (!docNo) return;
    setLoading(true);
    pamsSelect({ parameter: "appraisal_comments", loginid, code1: docNo })
      .then((res) => {
        if (res.length > 0) {
          const row = res[0] as Row;
          setExistingData(row);
          console.log("APPRAISAL DATA =", row);
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

  const formattedCommentsDate         = existingData?.COMMENTS_DATE         ? fmtDateTime(existingData.COMMENTS_DATE)         : "";
  const formattedAppraiseeCommentsDate= existingData?.APPRAISEE_COMMENTS_DATE? fmtDateTime(existingData.APPRAISEE_COMMENTS_DATE): "";

  if (loading) return <div style={S.spinner}>Loading comments...</div>;

  return (
    <div>
      {/* ── Score summary ── */}
      <div style={S.scoreRow}>
        <div style={S.scoreBox("#1976d2")}>
          <div style={S.scoreLabel}>Task Score</div>
          <div style={S.scoreValue("#1976d2")}>{Math.round(taskTotal)}</div>
        </div>
        <div style={S.scoreBox("#9c27b0")}>
          <div style={S.scoreLabel}>Character Score</div>
          <div style={S.scoreValue("#9c27b0")}>{Math.round(characterTotal)}</div>
        </div>
        <div style={S.scoreBox("#2e7d32")}>
          <div style={S.scoreLabel}>Final Rating</div>
          <div style={S.scoreValue("#2e7d32")}>{finalRating}</div>
        </div>
      </div>

      {/* ── Comments grid ── */}
      <div style={S.grid}>
        <div style={{ ...S.header, borderRight: "1px solid #111" }}>Appraiser Comments</div>
        <div style={S.header}>Appraisee Comments</div>

        {/* Appraiser Comments Column */}
        <div style={{ padding: "8px", borderTop: "1px solid #111", borderRight: "1px solid #111" }}>
          {showPrevLevel && (
            <div style={S.prevBlock}>
              <div style={S.prevName}>{prevLevelName || `Level ${prevLevelNum}`}</div>
              <div style={S.prevComment}>{prevLevelComment}</div>
            </div>
          )}

          {/* Show name ALWAYS - both in edit and view only mode */}
          {currentActorName && <div style={S.nameBox}>{currentActorName}</div>}

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
          {formattedCommentsDate && <div style={S.meta}>Last saved: {formattedCommentsDate}</div>}
          {appraiserReadOnly && <div style={S.readOnlyTag}>View only</div>}
        </div>

        {/* Appraisee Comments Column */}
        <div style={{ padding: "8px", borderTop: "1px solid #111" }}>
          {/* Show name ALWAYS - both in edit and view only mode */}
          {employeeName && <div style={S.nameBox}>{employeeName}</div>}

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
          {formattedAppraiseeCommentsDate && <div style={S.meta}>Last saved: {formattedAppraiseeCommentsDate}</div>}
          {appraiseeReadOnly && <div style={S.readOnlyTag}>View only</div>}
        </div>
      </div>
    </div>
  );
};

export default AppraiserCommentsTab;