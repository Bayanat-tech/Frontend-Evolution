
import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "../../state/AuthContext";
import { pamsSelect } from "../../api/pams";

type Row = Record<string, unknown>;

interface WeightageConfig {
  taskPct: number;
  charPct: number;
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
  flowLevel?: number;
  userFlowLevel?: number;
  weightageConfig?: WeightageConfig;
  showAllComments?: boolean;

  onAppraiserCommentChange?: (val: string, level: number) => void;
  onAppraiseeCommentChange?: (val: string, level: number) => void;
}

function text(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

function calcFinalRatingDisplay(
  taskTotal: number,
  characterTotal: number,
  weightageConfig?: WeightageConfig
): number {
  const t = Number(taskTotal || 0);
  const c = Number(characterTotal || 0);

  if (weightageConfig?.isHrDefined) {
    const tw = (t * weightageConfig.taskPct) / 100;
    const cw = (c * weightageConfig.charPct) / 100;

    return Math.round(tw + cw);
  }

  return Math.round((t + c) / 2);
}

const S = {
  scoreRow: {
    display: "flex" as const,
    gap: "12px",
    marginBottom: "16px",
  },

  scoreBox: (accent: string): React.CSSProperties => ({
    flex: 1,
    padding: "12px",
    borderRadius: "8px",
    textAlign: "center",
    border: `1px solid ${accent}40`,
    background: `${accent}10`,
  }),

  scoreLabel: {
    fontSize: "11px",
    color: "#6b7280",
    marginBottom: "4px",
  },

  scoreValue: (color: string): React.CSSProperties => ({
    fontSize: "1.4rem",
    fontWeight: 800,
    color,
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

  meta: {
    fontSize: "11px",
    color: "#6b7280",
    marginTop: "4px",
  },

  readOnlyTag: {
    fontSize: "11px",
    color: "#ef4444",
    marginTop: "4px",
  },

  spinner: {
    padding: "40px",
    textAlign: "center" as const,
    color: "#9ca3af",
    fontSize: "13px",
  },

  prevBlock: {
    padding: "8px",
    marginBottom: "8px",
    borderRadius: "6px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
  },

  prevName: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#374151",
    marginBottom: "4px",
  },

  prevComment: {
    fontSize: "13px",
    color: "#4b5563",
    whiteSpace: "pre-wrap" as const,
  },

  nameBox: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#374151",
    marginBottom: "4px",
  },

  allCommentsContainer: {
    maxHeight: "400px",
    overflowY: "auto" as const,
  },
};

const AppraiserCommentsTab: React.FC<Props> = ({
  docNo,
  employeeCode,
  taskTotal,
  characterTotal,
  flowLevel = 0,
  userFlowLevel = 0,
  weightageConfig,
  showAllComments = false,
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

  const isEmployee =
    loginid.trim().toUpperCase() === employeeCode.trim().toUpperCase();

  const isFinal = flowLevel >= 6;

  const isCurrentActionUser =
    userFlowLevel === 0 && !isEmployee && !isFinal;

  const appraiserReadOnly =
    isEmployee || isFinal || !isCurrentActionUser;

  const appraiseeReadOnly =
    !isEmployee || isFinal;

  const actingLevelRef = useRef<number | null>(null);

  if (
    actingLevelRef.current === null &&
    flowLevel !== undefined
  ) {
    actingLevelRef.current =
      userFlowLevel === 0 ? flowLevel : userFlowLevel;
  }

  const myLevel =
    actingLevelRef.current ??
    (userFlowLevel === 0 ? flowLevel : userFlowLevel);

  const effectiveLevel = showAllComments ? 0 : myLevel;

  useEffect(() => {
    actingLevelRef.current = null;
  }, [docNo, employeeCode]);

  useEffect(() => {
    if (!docNo) return;

    let cancelled = false;

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

        /*
         * IMPORTANT FIX
         *
         * Appraisee comment always belongs to FLOW_LEVEL 0.
         * Get latest saved comment from DB.
         */
        const appraiseeRows = safeRows
          .filter(
            (r) =>
              String(r.COMMENT_TYPE).toUpperCase() === "APPRAISEE" &&
              String(r.FLOW_LEVEL) === "0"
          )
          .sort((a, b) => {
            const da = new Date(a.COMMENT_DATE || 0).getTime();
            const db = new Date(b.COMMENT_DATE || 0).getTime();

            return db - da;
          });

        const latestAppraisee =
          appraiseeRows.length > 0
            ? text(appraiseeRows[0].COMMENT_TEXT)
            : "";

        /*
         * Latest appraiser comment for current level.
         */
        const currentLevel = String(myLevel);

        const appraiserRows = safeRows
          .filter(
            (r) =>
              String(r.COMMENT_TYPE).toUpperCase() === "APPRAISER" &&
              String(r.FLOW_LEVEL) === currentLevel
          )
          .sort((a, b) => {
            const da = new Date(a.COMMENT_DATE || 0).getTime();
            const db = new Date(b.COMMENT_DATE || 0).getTime();

            return db - da;
          });

        const latestAppraiser =
          appraiserRows.length > 0
            ? text(appraiserRows[0].COMMENT_TEXT)
            : "";

        /*
         * Don't overwrite user's current typed value.
         * But if state is empty, load DB value.
         */
        setAppraiseeComment((prev) => {
          if (prev.trim()) return prev;
          return latestAppraisee;
        });

        setAppraiserComment((prev) => {
          if (prev.trim()) return prev;
          return latestAppraiser;
        });

        /*
         * IMPORTANT:
         * Parent refs MUST also receive DB-loaded comments.
         *
         * This is the main fix for:
         * Save Draft -> reopen -> Submit
         */
        onAppraiseeCommentChange?.(
          latestAppraisee,
          0
        );

        onAppraiserCommentChange?.(
          latestAppraiser,
          myLevel
        );

        /*
         * Employee / actor names
         */
        try {
          const res = await pamsSelect({
            parameter: "appraisal_comments",
            loginid,
            code1: docNo,
          });

          if (cancelled) return;

          if (res.length > 0) {
            const row = res[0] as Row;

            setEmployeeName(
              text(row.EMPLOYEE_NAME)
            );

            if (flowLevel === 0) {
              setCurrentActorName(
                text(row.APPRAISER_NAME1) ||
                text(row.IMMEDIATE_SUPERVISOR_NAME) ||
                text(row.NEXT_ACTION_BY_NAME) ||
                myName ||
                loginid
              );
            } else if (userFlowLevel === 0) {
              if (isCurrentActionUser) {
                setCurrentActorName(
                  text(row.CURRENT_USER_NAME) ||
                  myName ||
                  loginid
                );
              } else if (isEmployee) {
                setCurrentActorName(
                  text(row.CREATED_BY_NAME) ||
                  myName ||
                  loginid
                );
              } else {
                setCurrentActorName(
                  text(row.NEXT_ACTION_BY_NAME) ||
                  myName ||
                  loginid
                );
              }
            } else {
              setCurrentActorName(
                text(row[`APPRAISER_NAME${userFlowLevel}`])
              );
            }
          }
        } catch {
          // Name lookup failure should not block comments.
        }
      } catch {
        // Comment lookup failure should not crash page.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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
    isCurrentActionUser,
    myName,
    onAppraiserCommentChange,
    onAppraiseeCommentChange,
  ]);

  const prevLevelNum = effectiveLevel - 1;

  const prevLevelRow = commentLog.find(
    (r) =>
      String(r.FLOW_LEVEL) === String(prevLevelNum) &&
      String(r.COMMENT_TYPE).toUpperCase() === "APPRAISER"
  );

  const prevLevelComment =
    text(prevLevelRow?.COMMENT_TEXT).trim();

  const showPrevLevel =
    !showAllComments &&
    effectiveLevel >= 2 &&
    prevLevelComment.length > 0;

  const prevLevelName =
    text(prevLevelRow?.COMMENT_BY_NAME) ||
    `Level ${prevLevelNum}`;

  const myAppraiserRow = commentLog.find(
    (r) =>
      String(r.FLOW_LEVEL) === String(myLevel) &&
      String(r.COMMENT_TYPE).toUpperCase() === "APPRAISER"
  );

  const appraiseeRow = commentLog.find(
    (r) =>
      String(r.FLOW_LEVEL) === "0" &&
      String(r.COMMENT_TYPE).toUpperCase() === "APPRAISEE"
  );

  const allAppraiserComments = useMemo(() => {
    const map = new Map<string, CommentLogRow>();

    commentLog
      .filter(
        (r) =>
          String(r.COMMENT_TYPE).toUpperCase() ===
          "APPRAISER"
      )
      .forEach((r) => {
        const key = String(r.FLOW_LEVEL);

        const existing = map.get(key);

        if (
          !existing ||
          (r.COMMENT_DATE &&
            r.COMMENT_DATE > existing.COMMENT_DATE)
        ) {
          map.set(key, r);
        }
      });

    return Array.from(map.values())
      .filter(
        (r) =>
          String(r.FLOW_LEVEL) !==
          String(myLevel)
      )
      .sort(
        (a, b) =>
          Number(a.FLOW_LEVEL) -
          Number(b.FLOW_LEVEL)
      );
  }, [commentLog, myLevel]);

  const showNextReviewerPreview =
    flowLevel === 0 &&
    !myAppraiserRow &&
    allAppraiserComments.length === 0 &&
    !!currentActorName;

  if (loading) {
    return (
      <div style={S.spinner}>
        Loading comments...
      </div>
    );
  }

  return (
    <div>
      <div style={S.scoreRow}>
        <div style={S.scoreBox("#1976d2")}>
          <div style={S.scoreLabel}>
            Task Score
          </div>

          <div style={S.scoreValue("#1976d2")}>
            {Math.round(taskTotal)}
          </div>
        </div>

        <div style={S.scoreBox("#9c27b0")}>
          <div style={S.scoreLabel}>
            Character Score
          </div>

          <div style={S.scoreValue("#9c27b0")}>
            {Math.round(characterTotal)}
          </div>
        </div>

        <div style={S.scoreBox("#2e7d32")}>
          <div style={S.scoreLabel}>
            Final Rating
          </div>

          <div style={S.scoreValue("#2e7d32")}>
            {calcFinalRatingDisplay(
              taskTotal,
              characterTotal,
              weightageConfig
            )}
          </div>
        </div>
      </div>

      <div style={S.grid}>
        <div
          style={{
            ...S.header,
            borderRight: "1px solid #111",
          }}
        >
          Appraiser Comments
        </div>

        <div style={S.header}>
          Appraisee Comments
        </div>

        <div
          style={{
            padding: "8px",
            borderTop: "1px solid #111",
            borderRight: "1px solid #111",
          }}
        >
          {showPrevLevel && (
            <div style={S.prevBlock}>
              <div style={S.prevName}>
                {prevLevelName}
              </div>

              <div style={S.prevComment}>
                {prevLevelComment}
              </div>
            </div>
          )}

          {showAllComments ? (
            <div style={S.allCommentsContainer}>
              {allAppraiserComments.map(
                (row, idx) => (
                  <div
                    key={idx}
                    style={S.prevBlock}
                  >
                    <div style={S.prevName}>
                      {row.COMMENT_BY_NAME ||
                        `Level ${row.FLOW_LEVEL}`}
                    </div>

                    <div style={S.prevComment}>
                      {row.COMMENT_TEXT ||
                        "No comment"}
                    </div>

                    {row.COMMENT_DATE && (
                      <div style={S.meta}>
                        Saved:{" "}
                        {row.COMMENT_DATE}
                      </div>
                    )}
                  </div>
                )
              )}

              {showNextReviewerPreview && (
                <>
                  <div
                    style={{
                      ...S.nameBox,
                      marginTop:
                        allAppraiserComments.length >
                          0
                          ? "12px"
                          : 0,
                    }}
                  >
                    {currentActorName}
                  </div>

                  <textarea
                    style={S.textarea(true)}
                    value=""
                    readOnly
                    placeholder="next reviewer will comment here"
                  />

                  <div style={S.readOnlyTag}>
                    View only
                  </div>
                </>
              )}

              {!appraiserReadOnly && (
                <>
                  <div
                    style={{
                      ...S.nameBox,
                      marginTop: "12px",
                    }}
                  >
                    {currentActorName || "You"}
                  </div>

                  <textarea
                    style={S.textarea(
                      appraiserReadOnly
                    )}
                    value={appraiserComment}
                    readOnly={appraiserReadOnly}
                    placeholder="Enter appraiser comments..."
                    onChange={(e) => {
                      if (appraiserReadOnly) return;

                      const value =
                        e.target.value;

                      setAppraiserComment(value);

                      onAppraiserCommentChange?.(
                        value,
                        myLevel
                      );
                    }}
                  />

                  {myAppraiserRow?.COMMENT_DATE && (
                    <div style={S.meta}>
                      Last saved:{" "}
                      {myAppraiserRow.COMMENT_DATE}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              {currentActorName && (
                <div style={S.nameBox}>
                  {currentActorName}
                </div>
              )}

              <textarea
                style={S.textarea(
                  appraiserReadOnly
                )}
                value={appraiserComment}
                readOnly={appraiserReadOnly}
                placeholder={
                  appraiserReadOnly
                    ? ""
                    : "Enter appraiser comments..."
                }
                onChange={(e) => {
                  if (appraiserReadOnly) return;

                  const value =
                    e.target.value;

                  setAppraiserComment(value);

                  onAppraiserCommentChange?.(
                    value,
                    myLevel
                  );
                }}
              />

              {myAppraiserRow?.COMMENT_DATE && (
                <div style={S.meta}>
                  Last saved:{" "}
                  {myAppraiserRow.COMMENT_DATE}
                </div>
              )}

              {appraiserReadOnly && (
                <div style={S.readOnlyTag}>
                  View only
                </div>
              )}
            </>
          )}
        </div>

        <div
          style={{
            padding: "8px",
            borderTop: "1px solid #111",
          }}
        >
          {employeeName && (
            <div style={S.nameBox}>
              {employeeName}
            </div>
          )}

          <textarea
            style={S.textarea(
              appraiseeReadOnly
            )}
            value={appraiseeComment}
            readOnly={appraiseeReadOnly}
            placeholder={
              appraiseeReadOnly
                ? ""
                : "Enter appraisee comments..."
            }
            onChange={(e) => {
              if (appraiseeReadOnly) return;

              const value =
                e.target.value;

              setAppraiseeComment(value);

              /*
               * IMPORTANT:
               * Parent ref gets updated immediately.
               */
              onAppraiseeCommentChange?.(
                value,
                0
              );
            }}
          />

          {appraiseeRow?.COMMENT_DATE && (
            <div style={S.meta}>
              Last saved:{" "}
              {appraiseeRow.COMMENT_DATE}
            </div>
          )}

          {appraiseeReadOnly && (
            <div style={S.readOnlyTag}>
              View only
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppraiserCommentsTab;

