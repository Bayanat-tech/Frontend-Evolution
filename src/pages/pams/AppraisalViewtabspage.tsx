import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../../state/AuthContext";
import { pamsSelect, pamsUpdateRatings } from "../../api/pams";
import TaskDetailsAppraisalTab   from "./Taskdetailsappraisaltab";
import TaskCharacterAppraisalTab from "./Taskcharacterappraisaltab";
import TaskGoalAppraisalTab      from "./Taskgoalappraisaltab";
import TaskSkillAppraisalTab     from "./Taskskillappraisaltab";
import AppraiserCommentsTab      from "./Appraisercommentstab";

// ─── Types ────────────────────────────────────────────────────────────────────
type SelectedTab = "task_details" | "characteristics" | "goals" | "skill" | "comments";
type Row = Record<string, unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function text(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

// Rating → label + professional color set
function getRatingMeta(rating: number): { label: string; numColor: string; labelColor: string } {
  if (rating === 5) return { label: "Exceptional",        numColor: "#16a34a", labelColor: "#16a34a" };
  if (rating === 4) return { label: "Above Expectations", numColor: "#2563eb", labelColor: "#2563eb" };
  if (rating === 3) return { label: "Meets Expectations", numColor: "#7c3aed", labelColor: "#7c3aed" };
  if (rating === 2) return { label: "Below Expectations", numColor: "#d97706", labelColor: "#d97706" };
  if (rating === 1) return { label: "Unsatisfactory",     numColor: "#dc2626", labelColor: "#dc2626" };
  return             { label: "—",                        numColor: "#6b7280", labelColor: "#6b7280" };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  container: {
    width: "100%",
    padding: "12px",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  // ── Header — light blue background (as in current UI) ─────────────────────
  header: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: "10px",
    marginBottom: "10px",
    padding: "8px 14px",
    borderRadius: "10px",
    background: "#E8F0FF",
    border: "1px solid #c7d9ff",
    boxShadow: "0 2px 8px rgba(8,42,137,0.10)",
    minHeight: "52px",
    flexWrap: "wrap" as const,
  },

  // ── Back arrow — dark blue to match header text ────────────────────────────
  backBtn: {
    display: "inline-flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    background: "rgba(8,42,137,0.10)",
    border: "1.5px solid rgba(8,42,137,0.20)",
    cursor: "pointer" as const,
    color: "#082A89",
    fontSize: "16px",
    fontWeight: 700,
    flexShrink: 0,
    transition: "background 0.15s",
  },

  docTitle: {
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "#082A89",
    flexShrink: 0,
    letterSpacing: "0.01em",
  },

  divider: {
    width: "1px",
    height: "28px",
    background: "rgba(8,42,137,0.20)",
    margin: "0 2px",
    flexShrink: 0,
  },

  // ── Avatar — solid dark blue bg, white initial ─────────────────────────────
  avatar: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    background: "#082A89",
    border: "2px solid #082A89",
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    fontSize: "0.78rem",
    fontWeight: 800,
    color: "#fff",
    flexShrink: 0,
  },

  empName: {
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "#082A89",
    whiteSpace: "nowrap" as const,
  },
  empId: {
    fontSize: "0.72rem",
    color: "#475569",
    whiteSpace: "nowrap" as const,
    fontWeight: 500,
  },

  // ── Final Rating chip — solid dark bg, high-contrast text ─────────────────
  ratingChipWrap: {
    marginLeft: "auto",
    flexShrink: 0,
  },

  // Tab bar
  tabBar: {
    background: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
    display: "flex" as const,
    flexWrap: "wrap" as const,
    gap: "2px",
    borderRadius: "8px 8px 0 0",
  },
  tab: (active: boolean): React.CSSProperties => ({
    padding: "10px 20px",
    fontSize: "13px",
    fontWeight: active ? 600 : 500,
    color: active ? "#082A89" : "#6b7280",
    background: active ? "#E8F0FF" : "transparent",
    border: "none",
    borderBottom: active ? "2px solid #082A89" : "2px solid transparent",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    transition: "all 0.15s",
    borderRadius: "4px 4px 0 0",
  }),

  panel: {
    border: "1px solid #e5e7eb",
    borderTop: "none",
    borderRadius: "0 0 10px 10px",
    background: "#fff",
    padding: "14px",
    minHeight: "400px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    marginBottom: "10px",
  },

  btnRow: {
    display: "flex" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    gap: "8px",
    flexWrap: "wrap" as const,
    marginTop: "8px",
  },
  btnGroup: { display: "flex" as const, gap: "8px", flexWrap: "wrap" as const },
  solidBtn: (color = "#E8F0FF"): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 14px",
    background: color,
    color: "#082A89",
    border: "none",
    borderRadius: "5px",
    fontSize: "12.5px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    transition: "opacity 0.15s",
  }),
  outlineBtn: {
    display: "inline-flex" as const,
    alignItems: "center" as const,
    gap: "5px",
    padding: "6px 13px",
    background: "#fff",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "5px",
    fontSize: "12.5px",
    fontWeight: 500,
    cursor: "pointer" as const,
    whiteSpace: "nowrap" as const,
    transition: "background 0.15s",
  },

  overlay: {
    position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.35)",
    display: "flex" as const, alignItems: "center" as const,
    justifyContent: "center" as const, zIndex: 9999,
  },
  modal: {
    background: "#fff", borderRadius: "10px", padding: "20px",
    width: "400px", maxWidth: "95vw",
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    display: "flex" as const, flexDirection: "column" as const, gap: "14px",
  },
  modalTitle: { fontSize: "16px", fontWeight: 700, color: "#111827", marginBottom: "4px" },
  label: {
    fontSize: "12px", color: "#6b7280", fontWeight: 600,
    marginBottom: "4px", display: "block" as const,
  },
  select: {
    width: "100%", padding: "8px 10px", border: "1px solid #d1d5db",
    borderRadius: "6px", fontSize: "13px", background: "#fff", color: "#111827",
  },
  textarea: {
    width: "100%", padding: "8px 10px", border: "1px solid #d1d5db",
    borderRadius: "6px", fontSize: "13px", resize: "vertical" as const,
    minHeight: "80px", fontFamily: "inherit", color: "#111827",
    boxSizing: "border-box" as const,
  },
  modalBtnRow: { display: "flex" as const, justifyContent: "flex-end" as const, gap: "8px" },

  notice: (type: "success" | "error" | "warning"): React.CSSProperties => ({
    padding: "10px 14px", borderRadius: "6px", fontSize: "13px",
    fontWeight: 500, marginBottom: "12px",
    background: type === "success" ? "#e6f9f0" : type === "error" ? "#fdecea" : "#fff4e5",
    color:      type === "success" ? "#0a6640"  : type === "error" ? "#a01a1a" : "#92400e",
    border: `1px solid ${type === "success" ? "#b7ebd4" : type === "error" ? "#f5b3b3" : "#fcd38a"}`,
  }),
};

// ─── Final Rating Chip ────────────────────────────────────────────────────────
const RatingChip: React.FC<{ rating: number }> = ({ rating }) => {
  const meta = getRatingMeta(rating);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        background: "rgba(8,42,137,0.12)",
        border: "1px solid rgba(8,42,137,0.20)",
        padding: "4px 12px",
        borderRadius: "10px",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#082A89", opacity: 0.75, letterSpacing: "0.04em" }}>
        Final Rating:
      </span>
      <span
        style={{
          fontSize: "1.05rem",
          fontWeight: 800,
          color: meta.numColor,
          lineHeight: 1,
          minWidth: "14px",
          textAlign: "center",
        }}
      >
        {rating}
      </span>
      <span
        style={{
          fontSize: "0.72rem",
          fontWeight: 700,
          color: meta.labelColor,
          borderLeft: "1px solid rgba(8,42,137,0.20)",
          paddingLeft: "8px",
          letterSpacing: "0.02em",
        }}
      >
        {meta.label}
      </span>
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
const AppraisalViewTabsPage: React.FC = () => {
  const navigate       = useNavigate();
  const location       = useLocation();
  const [searchParams] = useSearchParams();

  const getDocNoFromPath = () => {
    const match = location.pathname.match(/\/(?:appraisal\/)?view\/([^/?]+)/);
    return match ? match[1] : "";
  };

  const docNo        = getDocNoFromPath();
  const employeeCode = searchParams.get("employee_code") ?? "";
  const employeeName = searchParams.get("employee_name") ?? "";
  const mode         = searchParams.get("mode") ?? "view";

  const { user }    = useAuth();
  const loginid     = user?.loginid || user?.username || "";

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedTab,    setSelectedTab]    = useState<SelectedTab>("task_details");
  const [flowLevel,      setFlowLevel]      = useState<number>(0);
  const [finalApproved,  setFinalApproved]  = useState<string>("NO");
  const [taskTotal,      setTaskTotal]      = useState<number>(0);
  const [characterTotal, setCharacterTotal] = useState<number>(0);
  const [sentBackPopup,  setSentBackPopup]  = useState(false);
  const [sentBackLevel,  setSentBackLevel]  = useState("1");
  const [sentBackReason, setSentBackReason] = useState("");
  const [sentBackLevels, setSentBackLevels] = useState<Row[]>([]);
  const [notice,         setNotice]         = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [loading,        setLoading]        = useState(true);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const taskRowsRef         = useRef<Row[]>([]);
  const charRowsRef         = useRef<Row[]>([]);
  const goalRowsRef         = useRef<Row[]>([]);
  const skillRowsRef        = useRef<Row[]>([]);
  const appraiserCommentRef = useRef<string>("");
  const appraiseeCommentRef = useRef<string>("");

  // ── Derived ────────────────────────────────────────────────────────────────
  const isFinalized              = finalApproved === "YES";
  const readOnly                 = isFinalized;                                    // ← mode check hatao
  const showSaveSubmitButtons    = !isFinalized && flowLevel >= 1 && flowLevel <= 2;
  const showApproveRejectButtons = !isFinalized && flowLevel >= 3 && flowLevel <= 7;
  const finalRating              = Math.round((taskTotal + characterTotal) / 2);
  const showFinalRating          = taskTotal > 0 && characterTotal > 0;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!docNo || !employeeCode) { setLoading(false); return; }
    const fetchInitialData = async () => {
      try {
        const [flowRes, levelRes, commentRes] = await Promise.all([
          pamsSelect({ parameter: "get_appraisal_flow_level", loginid, code1: docNo }),
          pamsSelect({ parameter: "sentback_levels",          loginid, code1: docNo }),
          pamsSelect({ parameter: "appraisal_comments",       loginid, code1: docNo }),
        ]);
        if (flowRes.length > 0) {
          setFlowLevel(Number(flowRes[0].FLOW_LEVEL_RUNNING ?? 0));
          setFinalApproved(text(flowRes[0].FINAL_APPROVED) || "NO");
        }
        setSentBackLevels(levelRes as Row[]);
        if (levelRes.length > 0) setSentBackLevel(text(levelRes[0].FLOW_RUNNING_LEVEL) || "1");
        if (commentRes.length > 0) {
          appraiserCommentRef.current = text(commentRes[0].APPRAISER_COMMENTS);
          appraiseeCommentRef.current = text(commentRes[0].APPRAISEE_COMMENTS);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    void fetchInitialData();
  }, [docNo, employeeCode, loginid]);

  // ── Save ratings ───────────────────────────────────────────────────────────
  const saveRatings = async () => {
    const allRows = [...taskRowsRef.current, ...charRowsRef.current, ...goalRowsRef.current, ...skillRowsRef.current];
    if (!allRows.length) return;
    setNotice(null);
    try {
      await pamsUpdateRatings(allRows as Record<string, unknown>[]);
      setNotice({ type: "success", message: "Ratings saved successfully" });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save ratings" });
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateBeforeSubmit = (): string[] => {
    const missing: string[] = [];
    const emptyTask  = taskRowsRef.current.filter((r) => !r.RATING || Number(r.RATING) === 0);
    if (emptyTask.length)  missing.push(`Task Details — Rating missing for ${emptyTask.length} KPI(s)`);
    const emptyChar  = charRowsRef.current.filter((r) => !r.RATING || Number(r.RATING) === 0);
    if (emptyChar.length)  missing.push(`Characteristics — Rating missing for ${emptyChar.length} KPI(s)`);
    const emptyGoal  = goalRowsRef.current.filter((r) => !r.RATING || Number(r.RATING) === 0);
    if (emptyGoal.length)  missing.push(`Goals — Rating missing for ${emptyGoal.length} KPI(s)`);
    const emptySkill = skillRowsRef.current.filter((r) => !r.RATING || Number(r.RATING) === 0);
    if (emptySkill.length) missing.push(`Skill — Rating missing for ${emptySkill.length} KPI(s)`);
    const isEmployee = loginid.trim() === employeeCode.trim();
    if (!isEmployee && !appraiserCommentRef.current.trim()) missing.push("Comments — Appraiser comment is empty");
    if (isEmployee  && !appraiseeCommentRef.current.trim()) missing.push("Comments — Appraisee comment is empty");
    return missing;
  };

  // ── Action ─────────────────────────────────────────────────────────────────
  const handleAction = async (action: "D" | "S" | "A" | "R") => {
    setNotice(null);
    try {
      if (action === "D" || action === "S" || action === "A") {
        const allRows = [...taskRowsRef.current, ...charRowsRef.current, ...goalRowsRef.current, ...skillRowsRef.current];
        if (allRows.length > 0) await pamsUpdateRatings(allRows as Record<string, unknown>[]);
        if (appraiserCommentRef.current.trim())
          await pamsSelect({ parameter: "update_appraiser_comments", loginid, code1: docNo, code2: employeeCode, code3: appraiserCommentRef.current.trim() });
        if (appraiseeCommentRef.current.trim())
          await pamsSelect({ parameter: "update_appraisee_comments", loginid, code1: docNo, code2: employeeCode, code3: appraiseeCommentRef.current.trim() });
      }
      await pamsSelect({ parameter: "update_appraisal_status", loginid, code1: docNo, code2: employeeCode, code3: action, code4: "" });
      const msg = action === "D" ? "Saved as draft" : action === "S" ? "Submitted successfully" : action === "A" ? "Approved successfully" : "Rejected successfully";
      setNotice({ type: "success", message: msg });
      setTimeout(() => navigate(-1), 900);
    } catch (err: unknown) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    }
  };

  // ── Sent Back ──────────────────────────────────────────────────────────────
  const handleSentBack = async () => {
    if (!sentBackReason.trim()) {
      setNotice({ type: "warning", message: "Please enter a reason for sending back!" });
      return;
    }
    try {
      await pamsSelect({ parameter: "update_appraisal_status", loginid, code1: docNo, code2: employeeCode, code3: "SB", code4: sentBackLevel });
      setNotice({ type: "success", message: "Appraisal sent back successfully" });
      setSentBackPopup(false);
      setSentBackReason("");
      setSentBackLevel("1");
      setTimeout(() => navigate(-1), 900);
    } catch (err: unknown) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    }
  };

  if (loading) {
    return (
      <div style={S.container}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px", color: "#6b7280" }}>
          Loading appraisal...
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.container}>

      {/* Notice */}
      {notice && <div style={S.notice(notice.type)}>{notice.message}</div>}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={S.header}>

        {/* Back button */}
        <button
          style={S.backBtn}
          onClick={() => navigate(-1)}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(8,42,137,0.18)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(8,42,137,0.10)"; }}
          title="Go back"
        >
          ←
        </button>

        {/* Doc title */}
        <span style={S.docTitle}>Appraisal: {docNo}</span>
        <span style={S.divider} />

        {/* Avatar */}
        <div style={S.avatar}>
          {(employeeName?.[0] ?? employeeCode?.[0] ?? "?").toUpperCase()}
        </div>

        {/* Employee info */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", minWidth: 0, flex: 1 }}>
          <span style={S.empName}>{employeeName || employeeCode || "—"}</span>
          {employeeCode && (
            <span style={S.empId}>ID: {employeeCode}</span>
          )}
        </div>

        {/* Final Rating chip — solid dark background, always visible */}
        {showFinalRating && (
          <div style={S.ratingChipWrap}>
            <RatingChip rating={finalRating} />
          </div>
        )}
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div style={S.tabBar}>
        {(
          [
            { value: "task_details",    label: "Task Details" },
            { value: "characteristics", label: "Characteristics" },
            { value: "goals",           label: "Goals" },
            { value: "skill",           label: "Skill" },
            { value: "comments",        label: "Appraiser Comments" },
          ] as { value: SelectedTab; label: string }[]
        ).map(({ value, label }) => (
          <button key={value} style={S.tab(selectedTab === value)} onClick={() => setSelectedTab(value)}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div style={S.panel}>
        <div style={{ display: selectedTab === "task_details"    ? "block" : "none" }}>
          <TaskDetailsAppraisalTab
            docNo={docNo} employeeCode={employeeCode}
            isVisible={selectedTab === "task_details"}
            onRowsChange={(rows) => { taskRowsRef.current = rows; }}
            onGrandTotalChange={(total) => setTaskTotal(total)}
          />
        </div>
        <div style={{ display: selectedTab === "characteristics" ? "block" : "none" }}>
          <TaskCharacterAppraisalTab
            docNo={docNo} employeeCode={employeeCode}
            isVisible={selectedTab === "characteristics"}
            onRowsChange={(rows) => { charRowsRef.current = rows; }}
            onGrandTotalChange={(total) => setCharacterTotal(total)}
          />
        </div>
        <div style={{ display: selectedTab === "goals"           ? "block" : "none" }}>
          <TaskGoalAppraisalTab
            docNo={docNo} employeeCode={employeeCode}
            isVisible={selectedTab === "goals"}
            onRowsChange={(rows) => { goalRowsRef.current = rows; }}
          />
        </div>
        <div style={{ display: selectedTab === "skill"           ? "block" : "none" }}>
          <TaskSkillAppraisalTab
            docNo={docNo} employeeCode={employeeCode}
            isVisible={selectedTab === "skill"}
            onRowsChange={(rows) => { skillRowsRef.current = rows; }}
          />
        </div>
        <div style={{ display: selectedTab === "comments"        ? "block" : "none" }}>
          <AppraiserCommentsTab
            docNo={docNo} employeeCode={employeeCode}
            isVisible={selectedTab === "comments"}
            taskTotal={taskTotal}
            characterTotal={characterTotal}
            flowLevel={flowLevel}
            onAppraiserCommentChange={(val) => { appraiserCommentRef.current = val; }}
            onAppraiseeCommentChange={(val)  => { appraiseeCommentRef.current = val; }}
          />
        </div>
      </div>

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      <div style={S.btnRow}>
        <div style={S.btnGroup}>
          {showSaveSubmitButtons && (
            <>
              <button style={S.solidBtn()} onClick={() => void handleAction("D")}>
                💾 Save as Draft
              </button>
              <button
                style={S.solidBtn()}
                onClick={() => {
                  const missing = validateBeforeSubmit();
                  if (missing.length > 0) {
                    setNotice({ type: "warning", message: `Please fill before submitting: ${missing.join(" | ")}` });
                    return;
                  }
                  void handleAction("S");
                }}
              >
                ➤ Submit
              </button>
            </>
          )}
          {showApproveRejectButtons && (
            <>
              <button style={S.solidBtn("#E8F0FF")} onClick={() => void handleAction("A")}>✔️ Approve</button>
              <button style={S.solidBtn("#E8F0FF")} onClick={() => void handleAction("R")}>✗ Reject</button>
              <button style={S.solidBtn("#E8F0FF")} onClick={() => setSentBackPopup(true)}>↩ Send Back</button>
            </>
          )}
        </div>

        <div style={S.btnGroup}>
          <button style={S.outlineBtn} onClick={() => window.print()}>🖨️ Print</button>
          <button style={S.outlineBtn} disabled>📎 Attach</button>
          <button style={S.outlineBtn} onClick={() => navigate(-1)}>🚪 Exit</button>
        </div>
      </div>

      {/* ── Sent Back Modal ───────────────────────────────────────────────── */}
      {sentBackPopup && (
        <div style={S.overlay} onClick={() => setSentBackPopup(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalTitle}>Send Back Appraisal</div>

            <div>
              <label style={S.label}>Send Back To Level</label>
              <select style={S.select} value={sentBackLevel} onChange={(e) => setSentBackLevel(e.target.value)}>
                {sentBackLevels.length === 0 ? (
                  <option value="1">Level 1</option>
                ) : (
                  sentBackLevels.map((level, i) => (
                    <option key={i} value={text(level.FLOW_RUNNING_LEVEL) || String(i + 1)}>
                      {text(level.LEVEL_NAME) || `Level ${text(level.FLOW_RUNNING_LEVEL) || i + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label style={S.label}>Reason</label>
              <textarea
                style={S.textarea}
                value={sentBackReason}
                onChange={(e) => setSentBackReason(e.target.value)}
                placeholder="Enter reason for sending back..."
              />
            </div>

            <div style={S.modalBtnRow}>
              <button style={S.outlineBtn} onClick={() => setSentBackPopup(false)}>Cancel</button>
              <button style={S.solidBtn()} onClick={() => void handleSentBack()}>Confirm Send Back</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppraisalViewTabsPage;
