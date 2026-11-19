import React, { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "../../state/AuthContext";
import { pamsSelect } from "../../api/pams";

type Row = Record<string, unknown>;

interface WeightageConfig {
  taskPct: number;
  charPct: number;
  goalPct: number;
  skillPct: number;
  isHrDefined: boolean;
}

interface CommentLogRow {
  FLOW_LEVEL: number | string;
  COMMENT_TYPE: string;
  COMMENT_TEXT: string;
  COMMENT_BY: string;
  COMMENT_BY_NAME: string;
  COMMENT_DATE: string;
}

interface Props {
  docNo: string;
  employeeCode: string;
  isVisible?: boolean;
  taskTotal: number;
  characterTotal: number;
  goalTotal?: number;
  skillTotal?: number;
  flowLevel?: number;
  userFlowLevel?: number;
  weightageConfig?: WeightageConfig;
  showAllComments?: boolean;
  createdBy?: string;
  nextActionBy?: string;
  isSelfRating?: string;
  finalApproved?: string;
  hasActedBefore?: boolean;
  onAppraiserCommentChange?: (val: string, level: number) => void;
  onAppraiseeCommentChange?: (val: string, level: number) => void;
}

function text(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

const norm = (v: unknown) => text(v).trim().toUpperCase();

function calcFinalRating(
  taskTotal: number,
  charTotal: number,
  goalTotal: number,
  skillTotal: number,
  cfg?: WeightageConfig
): number | null {
  const parts = [
    { score: Number(taskTotal || 0), pct: Number(cfg?.taskPct) || 0 },
    { score: Number(charTotal || 0), pct: Number(cfg?.charPct) || 0 },
    { score: Number(goalTotal || 0), pct: Number(cfg?.goalPct) || 0 },
    { score: Number(skillTotal || 0), pct: Number(cfg?.skillPct) || 0 },
  ].filter((p) => p.score > 0);

  if (parts.length === 0) return null;

  const totalWt = parts.reduce((a, p) => a + p.pct, 0);
  const raw =
    totalWt > 0
      ? parts.reduce((a, p) => a + p.score * p.pct, 0) / totalWt
      : parts.reduce((a, p) => a + p.score, 0) / parts.length;

  return Math.round(raw); 
}

const fmtScore = (v: unknown) => (Number(v || 0) > 0 ? Number(v).toFixed(2) : "N/A");

const S = {
  scoreRow: {
    display: "flex" as const,
    gap: "12px",
    marginBottom: "16px",
    flexWrap: "wrap" as const,
  },

  scoreBox: (accent: string): React.CSSProperties => ({
    flex: "1 1 0",
    minWidth: "140px",
    padding: "14px 12px",
    borderRadius: "8px",
    textAlign: "center",
    border: `1px solid ${accent}40`,
    background: `${accent}10`,
  }),

  scoreLabel: {
    fontSize: "12px",
    color: "#6b7280",
    marginBottom: "6px",
    fontWeight: 500,
  },

  scoreValue: (color: string): React.CSSProperties => ({
    fontSize: "1.6rem",
    fontWeight: 800,
    color,
    lineHeight: 1.1,
  }),

  grid: {
    display: "grid" as const,
    gridTemplateColumns: "1fr 1fr",
    border: "1px solid #111",
  },

  header: {
    padding: "8px 12px",
    textAlign: "center" as const,
    fontWeight: 700,
    fontSize: "13px",
    borderBottom: "1px solid #111",
  },

  textarea: (readOnly: boolean): React.CSSProperties => ({
    width: "100%",
    minHeight: "160px",
    padding: "8px",
    border: "none",
    outline: "none",
    resize: "vertical" as const,
    fontSize: "13px",
    fontFamily: "inherit",
    background: readOnly ? "#f5f5f5" : "#fff",
    color: "#111827",
    boxSizing: "border-box" as const,
  }),

  meta: { fontSize: "11px", color: "#6b7280", marginTop: "4px" },
  readOnlyTag: { fontSize: "11px", color: "#ef4444", marginTop: "4px" },
  spinner: { padding: "40px", textAlign: "center" as const, color: "#9ca3af", fontSize: "13px" },
  prevBlock: {
    padding: "8px",
    marginBottom: "8px",
    borderRadius: "6px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
  },
  prevName: { fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" },
  prevComment: { fontSize: "13px", color: "#4b5563", whiteSpace: "pre-wrap" as const },
  nameBox: { fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" },
  blocksContainer: { maxHeight: "400px", overflowY: "auto" as const },
};

const AppraiserCommentsTab: React.FC<Props> = ({
  docNo,
  employeeCode,
  taskTotal,
  characterTotal,
  goalTotal = 0,
  skillTotal = 0,
  flowLevel = 0,
  userFlowLevel = 0,
  weightageConfig,
  createdBy = "",
  nextActionBy = "",
  isSelfRating = "",
  finalApproved = "",
  hasActedBefore = false,
  onAppraiserCommentChange,
  onAppraiseeCommentChange,
}) => {
  const { user } = useAuth();
  const loginid = user?.loginid || user?.username || "";
  const myName = (user as Row | undefined)?.name as string | undefined;

  const [appraiserComment, setAppraiserComment] = useState("");
  const [appraiseeComment, setAppraiseeComment] = useState("");
  const [commentLog, setCommentLog] = useState<CommentLogRow[]>([]);
  const [employeeName, setEmployeeName] = useState("");
  const [currentActorName, setCurrentActorName] = useState("");
  const [loading, setLoading] = useState(false);

  const isEmployee = norm(loginid) === norm(employeeCode);
  const hasNextActionProp = !!norm(nextActionBy);
  const isFinal = norm(finalApproved) === "YES" || (!hasNextActionProp && flowLevel >= 6);

  
  const isNextActor = hasNextActionProp
    ? norm(loginid) === norm(nextActionBy)
    : userFlowLevel === 0 && !isEmployee;

  
  const selfRatingNo = !!norm(isSelfRating) && norm(isSelfRating) !== "YES";


  const myAppraiserComments = commentLog.filter(
    (r) =>
      norm(r.COMMENT_TYPE) === "APPRAISER" &&
      norm(r.COMMENT_BY) === norm(loginid) &&
      text(r.COMMENT_TEXT).trim() !== ""
  );
  const alreadyCommented =
    myAppraiserComments.length > 0 &&
    (hasActedBefore || myAppraiserComments.some((r) => Number(r.FLOW_LEVEL) < flowLevel));

  const appraiserReadOnly = isFinal || !isNextActor || isEmployee || alreadyCommented;

  const appraiseeReadOnly = !isEmployee || isFinal || selfRatingNo || flowLevel !== 0;

  const actingLevelRef = useRef<number | null>(null);
  if (actingLevelRef.current === null && flowLevel !== undefined) {
    actingLevelRef.current = userFlowLevel === 0 ? flowLevel : userFlowLevel;
  }
  const myLevel = actingLevelRef.current ?? (userFlowLevel === 0 ? flowLevel : userFlowLevel);

  const loadedKeyRef = useRef<string>("");

  useEffect(() => {
    actingLevelRef.current = null;
  }, [docNo, employeeCode]);

  useEffect(() => {
    if (!docNo) return;
    let cancelled = false;

    const docKey = `${docNo}|${employeeCode}`;
    const sameDoc = loadedKeyRef.current === docKey;

    if (!sameDoc) {
      setAppraiserComment("");
      setAppraiseeComment("");
      setCommentLog([]);
      setEmployeeName("");
      setCurrentActorName("");
    }

    const loadComments = async () => {
      setLoading(true);
      try {
        const rows = await pamsSelect<CommentLogRow>({
          parameter: "get_appraisal_comments_log",
          loginid,
          code1: docNo,
        });
        if (cancelled) return;
        const safeRows = rows || [];
        setCommentLog(safeRows);

        const byDateDesc = (a: CommentLogRow, b: CommentLogRow) =>
          new Date(b.COMMENT_DATE || 0).getTime() - new Date(a.COMMENT_DATE || 0).getTime();

        // my own appraisee comment (employee, level 0)
        const appraiseeRows = safeRows
          .filter(
            (r) => norm(r.COMMENT_TYPE) === "APPRAISEE" && String(r.FLOW_LEVEL) === "0"
          )
          .sort(byDateDesc);
        const latestAppraisee = appraiseeRows.length > 0 ? text(appraiseeRows[0].COMMENT_TEXT) : "";

        // my own appraiser comment (current level)
        const currentLevel = String(myLevel);
        const appraiserRows = safeRows
          .filter(
            (r) =>
              norm(r.COMMENT_TYPE) === "APPRAISER" &&
              String(r.FLOW_LEVEL) === currentLevel &&
              (!norm(r.COMMENT_BY) || norm(r.COMMENT_BY) === norm(loginid))
          )
          .sort(byDateDesc);
        const latestAppraiser = appraiserRows.length > 0 ? text(appraiserRows[0].COMMENT_TEXT) : "";

        setAppraiseeComment((prev) => (sameDoc && prev.trim() ? prev : latestAppraisee));
        setAppraiserComment((prev) => (sameDoc && prev.trim() ? prev : latestAppraiser));

        if (!sameDoc) {
          onAppraiseeCommentChange?.(latestAppraisee, 0);
          onAppraiserCommentChange?.(latestAppraiser, myLevel);
        }
        loadedKeyRef.current = docKey;

        try {
          const res = await pamsSelect({ parameter: "appraisal_comments", loginid, code1: docNo });
          if (cancelled) return;
          if (res.length > 0) {
            const row = res[0] as Row;
            setEmployeeName(text(row.EMPLOYEE_NAME));
            if (flowLevel === 0) {
              setCurrentActorName(text(row.NEXT_REVIEWER_NAME));
            } else if (hasNextActionProp) {
              // Box owner = the real NEXT_ACTION_BY of the document
              if (isNextActor) setCurrentActorName(text(row.CURRENT_USER_NAME) || myName || loginid);
              else setCurrentActorName(text(row.NEXT_ACTION_BY_NAME) || text(row.CREATED_BY_NAME));
            } else if (userFlowLevel === 0) {
              if (isNextActor) setCurrentActorName(text(row.CURRENT_USER_NAME) || myName || loginid);
              else if (isEmployee) setCurrentActorName(text(row.CREATED_BY_NAME) || myName || loginid);
              else setCurrentActorName(text(row.NEXT_ACTION_BY_NAME) || myName || loginid);
            } else {
              setCurrentActorName(text(row[`APPRAISER_NAME${userFlowLevel}`]));
            }
          }
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadComments();
    return () => {
      cancelled = true;
    };
  }, [
    docNo,
    loginid,
    employeeCode,
    flowLevel,
    userFlowLevel,
    myLevel,
    isEmployee,
    isNextActor,
    hasNextActionProp,
    myName,
    onAppraiserCommentChange,
    onAppraiseeCommentChange,
  ]);

  const latestPerPerson = useMemo(() => {
    const sorted = [...commentLog].sort(
      (a, b) =>
        new Date(b.COMMENT_DATE || 0).getTime() - new Date(a.COMMENT_DATE || 0).getTime()
    );
    const seenLevel = new Set<string>();
    const seenText = new Set<string>();
    const out: CommentLogRow[] = [];

    sorted.forEach((r) => {
      const body = text(r.COMMENT_TEXT).trim().replace(/\s+/g, " ").toLowerCase();
      if (!body) return;

      const levelKey = `${norm(r.COMMENT_BY)}|${norm(r.COMMENT_TYPE)}`;
      const textKey = `${norm(r.COMMENT_BY)}|${norm(r.COMMENT_TYPE)}|${body}`;
      if (seenLevel.has(levelKey) || seenText.has(textKey)) return;

      seenLevel.add(levelKey);
      seenText.add(textKey);
      out.push(r);
    });

    return out.sort((a, b) => Number(a.FLOW_LEVEL) - Number(b.FLOW_LEVEL));
  }, [commentLog]);


  const creatorBlocks = useMemo(
    () =>
      latestPerPerson.filter(
        (r) =>
          norm(r.COMMENT_TYPE) === "APPRAISER" &&
          (appraiserReadOnly || norm(r.COMMENT_BY) !== norm(nextActionBy))
      ),
    [latestPerPerson, nextActionBy, appraiserReadOnly]
  );


  const appraiseeBlocks = useMemo(
    () =>
      isEmployee
        ? []
        : latestPerPerson.filter(
            (r) =>
              (norm(r.COMMENT_BY) !== norm(createdBy) || norm(createdBy) === norm(employeeCode)) &&
              (norm(r.COMMENT_BY) === norm(employeeCode) ||
                (norm(r.COMMENT_TYPE) === "APPRAISEE" && String(r.FLOW_LEVEL) === "0"))
          ),
    [latestPerPerson, employeeCode, createdBy, isEmployee]
  );

  const myAppraiserRow = commentLog.find(
    (r) =>
      String(r.FLOW_LEVEL) === String(myLevel) &&
      norm(r.COMMENT_TYPE) === "APPRAISER" &&
      norm(r.COMMENT_BY) === norm(loginid)
  );
  const appraiseeRow = commentLog.find(
    (r) => String(r.FLOW_LEVEL) === "0" && norm(r.COMMENT_TYPE) === "APPRAISEE"
  );

  const finalRating = calcFinalRating(
    taskTotal,
    characterTotal,
    goalTotal,
    skillTotal,
    weightageConfig
  );

  if (loading) return <div style={S.spinner}>Loading comments...</div>;

  return (
    <div>
      <div style={S.scoreRow}>
        <div style={S.scoreBox("#1976d2")}>
          <div style={S.scoreLabel}>Task Score ({weightageConfig?.taskPct ?? 0}%)</div>
          <div style={S.scoreValue("#1976d2")}>{fmtScore(taskTotal)}</div>
        </div>

        <div style={S.scoreBox("#9c27b0")}>
          <div style={S.scoreLabel}>Character Score ({weightageConfig?.charPct ?? 0}%)</div>
          <div style={S.scoreValue("#9c27b0")}>{fmtScore(characterTotal)}</div>
        </div>

        <div style={S.scoreBox("#ef6c00")}>
          <div style={S.scoreLabel}>Goal Score ({weightageConfig?.goalPct ?? 0}%)</div>
          <div style={S.scoreValue("#ef6c00")}>{fmtScore(goalTotal)}</div>
        </div>

        <div style={S.scoreBox("#00897b")}>
          <div style={S.scoreLabel}>Skill Score ({weightageConfig?.skillPct ?? 0}%)</div>
          <div style={S.scoreValue("#00897b")}>{fmtScore(skillTotal)}</div>
        </div>

        <div style={S.scoreBox("#2e7d32")}>
          <div style={S.scoreLabel}>Final Rating</div>
          <div style={S.scoreValue("#2e7d32")}>
            {finalRating === null ? "N/A" : finalRating.toFixed(2)}
          </div>
        </div>
      </div>

      <div style={S.grid}>
        <div style={{ ...S.header, borderRight: "1px solid #111" }}>Appraiser Comments</div>
        <div style={S.header}>Appraisee Comments</div>

        {/* LEFT: NEXT_ACTION_BY user writes here */}
        <div style={{ padding: "8px", borderTop: "1px solid #111", borderRight: "1px solid #111" }}>
          {creatorBlocks.length > 0 && (
            <div style={S.blocksContainer}>
              {creatorBlocks.map((row, idx) => (
                <div key={`c-${idx}`} style={S.prevBlock}>
                  <div style={S.prevName}>{row.COMMENT_BY_NAME || row.COMMENT_BY}</div>
                  <div style={S.prevComment}>{row.COMMENT_TEXT || "No comment"}</div>
                  {row.COMMENT_DATE && <div style={S.meta}>Saved: {row.COMMENT_DATE}</div>}
                </div>
              ))}
            </div>
          )}

          {!isEmployee && !alreadyCommented && (
            <>
          {currentActorName && <div style={S.nameBox}>{currentActorName}</div>}
          <textarea
            style={S.textarea(appraiserReadOnly)}
            value={appraiserComment}
            readOnly={appraiserReadOnly}
            placeholder={appraiserReadOnly ? "" : "Enter appraiser comments..."}
            onChange={(e) => {
              if (appraiserReadOnly) return;
              const value = e.target.value;
              setAppraiserComment(value);
              onAppraiserCommentChange?.(value, myLevel);
            }}
          />
          {myAppraiserRow?.COMMENT_DATE && (
            <div style={S.meta}>Last saved: {myAppraiserRow.COMMENT_DATE}</div>
          )}
          {appraiserReadOnly && <div style={S.readOnlyTag}>View only</div>}
            </>
          )}
        </div>
        <div style={{ padding: "8px", borderTop: "1px solid #111" }}>
          {appraiseeBlocks.length > 0 && (
            <div style={S.blocksContainer}>
              {appraiseeBlocks.map((row, idx) => (
                <div key={`a-${idx}`} style={S.prevBlock}>
                  <div style={S.prevName}>{row.COMMENT_BY_NAME || row.COMMENT_BY}</div>
                  <div style={S.prevComment}>{row.COMMENT_TEXT || "No comment"}</div>
                  {row.COMMENT_DATE && <div style={S.meta}>Saved: {row.COMMENT_DATE}</div>}
                </div>
              ))}
            </div>
          )}

     
          {selfRatingNo && (
            <>
              {employeeName && <div style={S.nameBox}>{employeeName}</div>}
              <textarea
                style={S.textarea(true)}
                value={appraiseeComment}
                readOnly
                placeholder=""
              />
              <div style={S.readOnlyTag}>View only</div>
            </>
          )}

          {!selfRatingNo && !isEmployee && appraiseeBlocks.length === 0 && employeeName && (
            <div style={S.nameBox}>{employeeName}</div>
          )}

          {!selfRatingNo && isEmployee && (
            <>
              {employeeName && <div style={S.nameBox}>{employeeName}</div>}
              <textarea
                style={S.textarea(appraiseeReadOnly)}
                value={appraiseeComment}
                readOnly={appraiseeReadOnly}
                placeholder={appraiseeReadOnly ? "" : "Enter appraisee comments..."}
                onChange={(e) => {
                  if (appraiseeReadOnly) return;
                  const value = e.target.value;
                  setAppraiseeComment(value);
                  onAppraiseeCommentChange?.(value, 0);
                }}
              />
              {appraiseeRow?.COMMENT_DATE && (
                <div style={S.meta}>Last saved: {appraiseeRow.COMMENT_DATE}</div>
              )}
              {appraiseeReadOnly && <div style={S.readOnlyTag}>View only</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppraiserCommentsTab;