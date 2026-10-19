import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, FileText,
  Save, Send, CheckCircle2, XCircle, Undo2, Printer,
} from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { pamsSelect, pamsUpdateRatings } from "../../api/pams";
import TaskDetailsAppraisalTab from "./Taskdetailsappraisaltab";
import TaskCharacterAppraisalTab from "./Taskcharacterappraisaltab";
import TaskGoalAppraisalTab from "./Taskgoalappraisaltab";
import TaskSkillAppraisalTab from "./Taskskillappraisaltab";
import AppraiserCommentsTab from "./Appraisercommentstab";
import PerformanceReportDesign from "./Performancereportdesign";
import { NoticeToast } from "../../components/ui/NoticeToast";

// ─── Types ────────────────────────────────────────────────────────────────────
type SelectedTab = "task_details" | "characteristics" | "goals" | "skill" | "comments";
type Row = Record<string, unknown>;

interface WeightageConfig {
  taskPct: number;
  charPct: number;
  goalPct: number;
  skillPct: number;
  isHrDefined: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function text(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}
function num(val: unknown): number {
  const n = Number(val);
  return isFinite(n) ? n : 0;
}

function calcFinalRating(
  taskTotal: number,
  charTotal: number,
  goalTotal: number,
  skillTotal: number,
  cfg: WeightageConfig
): number {
  const t = Number(taskTotal || 0);
  const c = Number(charTotal || 0);
  const g = Number(goalTotal || 0);
  const s = Number(skillTotal || 0);

  if (t === 0 && c === 0 && g === 0 && s === 0) return 0;

  const taskPct  = Number(cfg?.taskPct)  || 0;
  const charPct  = Number(cfg?.charPct)  || 0;
  const goalPct  = Number(cfg?.goalPct)  || 0;
  const skillPct = Number(cfg?.skillPct) || 0;
  const totalWt  = taskPct + charPct + goalPct + skillPct;

  let raw: number;

  if (totalWt > 0) {
    const weightedSum =
      (t * taskPct) + (c * charPct) + (g * goalPct) + (s * skillPct);
    raw = weightedSum / totalWt;
  } else {
    const active = [t, c, g, s].filter((v) => v > 0);
    if (active.length === 0) return 0;
    raw = active.reduce((a, b) => a + b, 0) / active.length;
  }

  // ✅ Nearest integer: 2.40 → 2, 2.6 → 3
  return Math.round(raw);
}

function getRatingMeta(rating: number): { label: string; numColor: string; labelColor: string } {
  if (rating >= 4.5) return { label: "Exceptional", numColor: "#16a34a", labelColor: "#16a34a" };
  if (rating >= 3.5) return { label: "Above Expectation", numColor: "#2563eb", labelColor: "#2563eb" };
  if (rating >= 2.5) return { label: "Meets Expectation", numColor: "#7c3aed", labelColor: "#7c3aed" };
  if (rating >= 1.5) return { label: "Below Expectation", numColor: "#d97706", labelColor: "#d97706" };
  if (rating >= 1) return { label: "Unsatisfactory", numColor: "#dc2626", labelColor: "#dc2626" };
  return { label: "—", numColor: "#6b7280", labelColor: "#6b7280" };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  container: {
    width: "100%",
    padding: "12px",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  headerBar: {
    position: "relative" as const,
    background: "linear-gradient(180deg, #ffffff 0%, #f4f8ff 100%)",
    borderRadius: "10px",
    border: "1px solid #d8e3ff",
    boxShadow: "0 2px 10px rgba(8,42,137,0.08)",
    marginBottom: "10px",
    overflow: "hidden" as const,
  },
  headerAccent: {
    height: "3px",
    background: "linear-gradient(90deg, #082A89 0%, #2563eb 45%, #38bdf8 100%)",
  },
  headerInner: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: "10px",
    padding: "8px 14px",
    minHeight: "52px",
    flexWrap: "wrap" as const,
  },
  backBtn: {
    display: "inline-flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    width: "30px",
    height: "30px",
    borderRadius: "8px",
    background: "#E8F0FF",
    border: "1px solid #c7d9ff",
    color: "#082A89",
    cursor: "pointer" as const,
    flexShrink: 0,
    transition: "background 0.15s",
  },
  title: {
    display: "inline-flex" as const,
    alignItems: "center" as const,
    gap: "6px",
    fontSize: "0.9rem",
    fontWeight: 700,
    color: "#082A89",
    letterSpacing: "0.01em",
    flexShrink: 0,
  },
  titleIcon: { color: "#2563eb" },
  divider: {
    width: "1px",
    height: "26px",
    background: "rgba(8,42,137,0.25)",
    margin: "0 2px",
    flexShrink: 0,
  },
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
  ratingChipWrap: { marginLeft: "10px", flexShrink: 0 },
  actions: {
    marginLeft: "auto",
    display: "flex" as const,
    alignItems: "center" as const,
    gap: "8px",
    flexWrap: "wrap" as const,
  },
  actionBtn: {
    display: "inline-flex" as const,
    alignItems: "center" as const,
    gap: "6px",
    padding: "7px 14px",
    background: "#082A89",
    color: "#fff",
    border: "none",
    borderRadius: "7px",
    fontSize: "0.78rem",
    fontWeight: 600,
    cursor: "pointer" as const,
    whiteSpace: "nowrap" as const,
    transition: "background 0.18s, transform 0.1s",
  },
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
    transition: "background 0.18s, transform 0.1s",
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
    transition: "background 0.18s, transform 0.1s",
  },
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 9999,
  },
  modal: {
    background: "#fff",
    borderRadius: "10px",
    padding: "20px",
    width: "400px",
    maxWidth: "95vw",
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: "14px",
  },
  modalTitle: { fontSize: "16px", fontWeight: 700, color: "#111827", marginBottom: "4px" },
  label: {
    fontSize: "12px",
    color: "#6b7280",
    fontWeight: 600,
    marginBottom: "4px",
    display: "block" as const,
  },
  select: {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "13px",
    background: "#fff",
    color: "#111827",
  },
  textarea: {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "13px",
    resize: "vertical" as const,
    minHeight: "80px",
    fontFamily: "inherit",
    color: "#111827",
    boxSizing: "border-box" as const,
  },
  modalBtnRow: {
    display: "flex" as const,
    justifyContent: "flex-end" as const,
    gap: "8px",
  },
};

// ─── Final Rating Chip ────────────────────────────────────────────────────────
const RatingChip: React.FC<{ rating: number; weightageConfig: WeightageConfig }> = ({
  rating,
  weightageConfig,
}) => {
  const safeRating = Math.round(Number(rating || 0));
  const meta = getRatingMeta(safeRating);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "6px",
      background: "rgba(8,42,137,0.12)", border: "1px solid rgba(8,42,137,0.20)",
      padding: "4px 12px", borderRadius: "10px", flexShrink: 0,
    }}>
      <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#082A89", opacity: 0.75, letterSpacing: "0.04em" }}>
        Final Rating:
      </span>
      <span style={{ fontSize: "1.05rem", fontWeight: 800, color: meta.numColor, lineHeight: 1, minWidth: "14px", textAlign: "center" }}>
        {safeRating}
      </span>
      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: meta.labelColor, borderLeft: "1px solid rgba(8,42,137,0.20)", paddingLeft: "8px", letterSpacing: "0.02em" }}>
        {meta.label}
      </span>
      <span style={{ fontSize: "0.62rem", color: "#082A89", opacity: 0.55, borderLeft: "1px solid rgba(8,42,137,0.15)", paddingLeft: "8px" }}>
        {weightageConfig.isHrDefined
          ? `T${weightageConfig.taskPct}% / C${weightageConfig.charPct}% / G${weightageConfig.goalPct}% / S${weightageConfig.skillPct}%`
          : ""}
      </span>
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
const AppraisalViewTabsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const prefetchedRow = (location.state as { prefetchedRow?: Row } | null)?.prefetchedRow;

  const getDocNoFromPath = () => {
    const match = location.pathname.match(/\/(?:appraisal\/)?view\/([^/?]+)/);
    return match ? match[1] : "";
  };

  const docNo = getDocNoFromPath();
  const employeeCode = searchParams.get("employee_code") ?? "";
  const employeeName = searchParams.get("employee_name") ?? "";
  const sourceTab = (searchParams.get("source_tab") ?? "").toUpperCase();
  const { user } = useAuth();
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";

  const [selectedTab, setSelectedTab] = useState<SelectedTab>("task_details");
  const [flowLevel, setFlowLevel] = useState<number>(
    prefetchedRow ? num(prefetchedRow.FLOW_LEVEL_RUNNING) : 0
  );
  const [finalApproved, setFinalApproved] = useState<string>(
    prefetchedRow ? (text(prefetchedRow.FINAL_APPROVED) || "NO") : "NO"
  );
  const [createdBy, setCreatedBy] = useState<string>(
    prefetchedRow ? text(prefetchedRow.CREATED_BY) : ""
  );

  // ─── Totals (all four categories) ───
  const [taskTotal, setTaskTotal] = useState<number>(0);
  const [characterTotal, setCharacterTotal] = useState<number>(0);
  const [goalTotal, setGoalTotal] = useState<number>(0);
  const [skillTotal, setSkillTotal] = useState<number>(0);

  const [sentBackPopup, setSentBackPopup] = useState(false);
  const [sentBackLevel, setSentBackLevel] = useState("1");
  const [sentBackReason, setSentBackReason] = useState("");
  const [sentBackLevels, setSentBackLevels] = useState<Row[]>([]);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);

  const [loading, setLoading] = useState(!prefetchedRow);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);

  const [showReportModal, setShowReportModal] = useState(false);
  const [userFlowLevel, setUserFlowLevel] = useState<number>(0);

  // ─── Default weightage (70/10/10/10) ───
  const [weightageConfig, setWeightageConfig] = useState<WeightageConfig>({
    taskPct: 70,
    charPct: 10,
    goalPct: 10,
    skillPct: 10,
    isHrDefined: false,
  });

  const taskRowsRef = useRef<Row[]>([]);
  const charRowsRef = useRef<Row[]>([]);
  const goalRowsRef = useRef<Row[]>([]);
  const skillRowsRef = useRef<Row[]>([]);
  const appraiserCommentRef = useRef<{ text: string; level: number }>({ text: "", level: 0 });
  const appraiseeCommentRef = useRef<{ text: string; level: number }>({ text: "", level: 0 });

  const isFinalized = finalApproved === "YES";
  const employeeIsHOD =
    !!createdBy && createdBy.trim().toUpperCase() === employeeCode.trim().toUpperCase();

  const showActionButtons = sourceTab === "" || sourceTab === "PENDING";
  const showSaveSubmitButtons =
    showActionButtons && !isFinalized &&
    (employeeIsHOD ? flowLevel === 0 : flowLevel <= 2);
  const showApproveRejectButtons =
    showActionButtons && !isFinalized &&
    (employeeIsHOD ? flowLevel >= 1 : flowLevel >= 3) && flowLevel <= 7;

  const finalRating = calcFinalRating(taskTotal, characterTotal, goalTotal, skillTotal, weightageConfig);
  const showFinalRating =
    taskTotal > 0 || characterTotal > 0 || goalTotal > 0 || skillTotal > 0;

  // ── Fetch ──
  useEffect(() => {
    if (!docNo || !employeeCode) { setLoading(false); return; }
    const fetchInitialData = async () => {
      if (!prefetchedRow) setLoading(true); else setBackgroundRefreshing(true);
      try {
        const periodNumber = prefetchedRow ? text(prefetchedRow.PERIOD_NUMBER) : "";

        const [flowRes, levelRes, commentRes, historyRes, weightageRes] = await Promise.all([
          pamsSelect({ parameter: "get_appraisal_flow_level", loginid, code1: docNo }),
          pamsSelect({ parameter: "sentback_levels", loginid, code1: docNo }),
          pamsSelect({ parameter: "appraisal_comments", loginid, code1: docNo }),
          pamsSelect({ parameter: "get_appraisal_flow_with_name", loginid, code1: docNo }),

          pamsSelect({
            parameter: "Trn_weightage",
            loginid,
            code1: companyCode,
            code2: periodNumber,
          }),
        ]);

        let currentFlowLevel = 0, nextActionBy = "";
        if (flowRes.length > 0) {
          currentFlowLevel = num(flowRes[0].FLOW_LEVEL_RUNNING);
          nextActionBy = text(flowRes[0].NEXT_ACTION_BY).trim().toUpperCase();
          setFlowLevel(currentFlowLevel);
          setFinalApproved(text(flowRes[0].FINAL_APPROVED) || "NO");
          setCreatedBy(text(flowRes[0].CREATED_BY));
        }


        if (weightageRes.length > 0) {
          const w = weightageRes[0] as Row;
          const taskPct = num(w.TASK_WEIGHTAGE);
          const charPct = num(w.CHARACTER_WEIGHTAGE);
          const goalPct = num(w.GOAL_WEIGHTAGE);
          const skillPct = num(w.SKILL_WEIGHTAGE);
          const sum = taskPct + charPct + goalPct + skillPct;

          if (sum > 0) {
            setWeightageConfig({
              taskPct,
              charPct,
              goalPct,
              skillPct,
              isHrDefined: true,
            });
          }
        }

        const isMyTurn = nextActionBy === loginid.trim().toUpperCase();
        if (isMyTurn) setUserFlowLevel(0);
        else {
          const histRows = historyRes as Row[];
          const myAction = histRows.find(
            (h) => text(h.ACTION_BY).trim().toUpperCase() === loginid.trim().toUpperCase()
          );
          setUserFlowLevel(myAction ? num(myAction.FLOW_LEVEL) : currentFlowLevel);
        }

        setSentBackLevels(levelRes as Row[]);
        if (levelRes.length > 0) setSentBackLevel(text(levelRes[0].FLOW_RUNNING_LEVEL) || "1");

        if (commentRes.length > 0) {
          appraiserCommentRef.current = {
            text: text(commentRes[0].APPRAISER_COMMENTS),
            level: num(commentRes[0].APPRAISER_COMMENT_LEVEL),
          };
          appraiseeCommentRef.current = {
            text: text(commentRes[0].APPRAISEE_COMMENTS),
            level: num(commentRes[0].APPRAISEE_COMMENT_LEVEL),
          };
        }
      } catch { /* silent */ }
      finally { setLoading(false); setBackgroundRefreshing(false); }
    };
    void fetchInitialData();
  }, [docNo, employeeCode, loginid, companyCode]);

  // ── Validation ──
  const validateBeforeSubmit = async (): Promise<string[]> => {
    const missing: string[] = [];
    const emptyTask = taskRowsRef.current.filter(r => !r.RATING || Number(r.RATING) === 0);
    if (emptyTask.length) missing.push(`Task Details — Rating missing for ${emptyTask.length} KPI(s)`);
    const emptyChar = charRowsRef.current.filter(r => !r.RATING || Number(r.RATING) === 0);
    if (emptyChar.length) missing.push(`Characteristics — Rating missing for ${emptyChar.length} KPI(s)`);
    const emptyGoal = goalRowsRef.current.filter(r => !r.RATING || Number(r.RATING) === 0);
    if (emptyGoal.length) missing.push(`Goals — Rating missing for ${emptyGoal.length} KPI(s)`);
    const emptySkill = skillRowsRef.current.filter(r => !r.RATING || Number(r.RATING) === 0);
    if (emptySkill.length) missing.push(`Skill — Rating missing for ${emptySkill.length} KPI(s)`);

    const isEmployee = loginid.trim().toUpperCase() === employeeCode.trim().toUpperCase();
    let appraiseeComment = appraiseeCommentRef.current.text?.trim() || "";
    let appraiserComment = appraiserCommentRef.current.text?.trim() || "";
    try {
      const commentLog = await pamsSelect<{ FLOW_LEVEL: number | string; COMMENT_TYPE: string; COMMENT_TEXT: string; COMMENT_DATE?: string; }>({
        parameter: "get_appraisal_comments_log", loginid, code1: docNo,
      });
      const rows = commentLog || [];
      const appraiseeRows = rows
        .filter(r => String(r.COMMENT_TYPE).toUpperCase() === "APPRAISEE" && String(r.FLOW_LEVEL) === "0")
        .sort((a, b) => new Date(b.COMMENT_DATE || 0).getTime() - new Date(a.COMMENT_DATE || 0).getTime());
      const currentAppraiserLevel = appraiserCommentRef.current.level || flowLevel;
      const appraiserRows = rows
        .filter(r => String(r.COMMENT_TYPE).toUpperCase() === "APPRAISER" && String(r.FLOW_LEVEL) === String(currentAppraiserLevel))
        .sort((a, b) => new Date(b.COMMENT_DATE || 0).getTime() - new Date(a.COMMENT_DATE || 0).getTime());
      if (!appraiseeComment && appraiseeRows.length > 0) {
        appraiseeComment = String(appraiseeRows[0].COMMENT_TEXT || "").trim();
        appraiseeCommentRef.current = { text: appraiseeComment, level: 0 };
      }
      if (!appraiserComment && appraiserRows.length > 0) {
        appraiserComment = String(appraiserRows[0].COMMENT_TEXT || "").trim();
        appraiserCommentRef.current = { text: appraiserComment, level: currentAppraiserLevel };
      }
    } catch (error) { console.error("Failed to load comments for validation:", error); }

    if (isEmployee) { if (!appraiseeComment) missing.push("Comments — Appraisee comment is required"); }
    else { if (!appraiserComment) missing.push("Comments — Appraiser comment is required"); }
    return missing;
  };

  // ── Action ──
  const handleAction = async (action: "D" | "S" | "A" | "R") => {
    setNotice(null);
    try {
      if (action === "D" || action === "S" || action === "A") {
        const allRows = [...taskRowsRef.current, ...charRowsRef.current, ...goalRowsRef.current, ...skillRowsRef.current];
        if (allRows.length > 0) await pamsUpdateRatings(allRows as Record<string, unknown>[]);

        const appraiserText = appraiserCommentRef.current.text?.trim() || "";
        const appraiserLevel = Number(appraiserCommentRef.current.level || flowLevel || 0);
        if (appraiserText) {
          await pamsSelect({ parameter: "save_appraisal_comment", loginid, code1: docNo, code2: employeeCode, code3: String(appraiserLevel), code4: "APPRAISER", code5: appraiserText });
        }
        const appraiseeText = appraiseeCommentRef.current.text?.trim() || "";
        if (appraiseeText) {
          await pamsSelect({ parameter: "save_appraisal_comment", loginid, code1: docNo, code2: employeeCode, code3: "0", code4: "APPRAISEE", code5: appraiseeText });
        }
      }
      const ratingToSend = (action === "S" || action === "A" || action === "D") ? finalRating : 0;
      await pamsSelect({ parameter: "update_appraisal_status", loginid, code1: docNo, code2: employeeCode, code3: action, code4: "", number1: ratingToSend });
      const msg = action === "D" ? "Saved as draft" : action === "S" ? "Submitted successfully" : action === "A" ? "Approved successfully" : "Rejected successfully";
      setNotice({ type: "success", message: msg });
      setTimeout(() => navigate(-1), 900);
    } catch (err: unknown) {
      console.error("handleAction error:", err);
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    }
  };

  const handleSentBack = async () => {
    if (!sentBackReason.trim()) {
      setNotice({ type: "warning", message: "Please enter a reason for sending back!" });
      return;
    }
    try {
      await pamsSelect({ parameter: "update_appraisal_status", loginid, code1: docNo, code2: employeeCode, code3: "SB", code4: `${sentBackLevel}~${sentBackReason.trim()}` });
      setNotice({ type: "success", message: "Appraisal sent back successfully" });
      setSentBackPopup(false); setSentBackReason(""); setSentBackLevel("1");
      setTimeout(() => navigate(-1), 900);
    } catch (err: unknown) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    }
  };

  const handleAppraiserCommentChange = useCallback((val: string, level: number) => {
    appraiserCommentRef.current = { text: val, level };
  }, []);
  const handleAppraiseeCommentChange = useCallback((val: string, level: number) => {
    appraiseeCommentRef.current = { text: val, level };
  }, []);
  const handleReportClose = useCallback(() => setShowReportModal(false), []);

  if (loading) {
    return (
      <div style={S.container}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px", color: "#6b7280" }}>
          Loading appraisal...
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {backgroundRefreshing && (
        <div style={{ position: "fixed", top: "12px", right: "16px", zIndex: 9998, background: "#082A89", color: "#fff", fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "20px", opacity: 0.85 }}>
          Refreshing...
        </div>
      )}

      {/* ═══════ HEADER ═══════ */}
      <div style={S.headerBar}>
        <div style={S.headerAccent} />
        <div style={S.headerInner}>
          <button
            style={S.backBtn}
            onClick={() => navigate(-1)}
            onMouseEnter={e => (e.currentTarget.style.background = "#d0deff")}
            onMouseLeave={e => (e.currentTarget.style.background = "#E8F0FF")}
            title="Go back"
          >
            <ArrowLeft size={16} />
          </button>

          <div style={S.title}>
            <FileText size={16} style={S.titleIcon} />
            <span>Appraisal: {docNo}</span>
          </div>

          <span style={S.divider} />

          <div style={S.avatar}>
            {(employeeName?.[0] ?? employeeCode?.[0] ?? "?").toUpperCase()}
          </div>

          <span style={S.empName}>{employeeName || employeeCode || "—"}</span>
          {employeeCode && <span style={S.empId}>ID: {employeeCode}</span>}

          {showFinalRating && (
            <div style={S.ratingChipWrap}>
              <RatingChip rating={finalRating} weightageConfig={weightageConfig} />
            </div>
          )}

          <div style={S.actions}>
            {showSaveSubmitButtons && (
              <>
                <button
                  style={S.actionBtn}
                  onMouseEnter={e => (e.currentTarget.style.background = "#0b38a8")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#082A89")}
                  onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                  onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
                  onClick={() => void handleAction("D")}
                >
                  <Save size={13} /> Save Draft
                </button>
                <button
                  style={S.actionBtn}
                  onMouseEnter={e => (e.currentTarget.style.background = "#0b38a8")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#082A89")}
                  onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                  onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
                  onClick={async () => {
                    try {
                      setNotice(null);
                      const missing = await validateBeforeSubmit();
                      if (missing.length > 0) {
                        setNotice({ type: "warning", message: `Please fill before submitting: ` + missing.join(" | ") });
                        return;
                      }
                      await handleAction("S");
                    } catch (error) {
                      console.error("Submit validation error:", error);
                      setNotice({ type: "error", message: "Unable to validate appraisal comments. Please try again." });
                    }
                  }}
                >
                  <Send size={13} /> Submit
                </button>
              </>
            )}

            {showApproveRejectButtons && (
              <>
                <button
                  style={S.actionBtn}
                  onMouseEnter={e => (e.currentTarget.style.background = "#0b38a8")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#082A89")}
                  onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                  onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
                  onClick={() => void handleAction("A")}
                >
                  <CheckCircle2 size={13} /> Approve
                </button>
                <button
                  style={S.actionBtn}
                  onMouseEnter={e => (e.currentTarget.style.background = "#0b38a8")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#082A89")}
                  onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                  onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
                  onClick={() => void handleAction("R")}
                >
                  <XCircle size={13} /> Reject
                </button>
                <button
                  style={S.actionBtn}
                  onMouseEnter={e => (e.currentTarget.style.background = "#0b38a8")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#082A89")}
                  onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                  onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
                  onClick={() => setSentBackPopup(true)}
                >
                  <Undo2 size={13} /> Send Back
                </button>
              </>
            )}

            <button
              style={S.actionBtn}
              onMouseEnter={e => (e.currentTarget.style.background = "#0b38a8")}
              onMouseLeave={e => (e.currentTarget.style.background = "#082A89")}
              onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
              onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
              onClick={() => setShowReportModal(true)}
            >
              <Printer size={13} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* ═══════ TABS + PANEL ═══════ */}
      <div style={S.tabBar}>
        {(
          [
            { value: "task_details", label: "Task Details" },
            { value: "characteristics", label: "Characteristics" },
            { value: "goals", label: "Goals" },
            { value: "skill", label: "Skill" },
            { value: "comments", label: "Appraiser Comments" },
          ] as { value: SelectedTab; label: string }[]
        ).map(({ value, label }) => (
          <button key={value} style={S.tab(selectedTab === value)} onClick={() => setSelectedTab(value)}>
            {label}
          </button>
        ))}
      </div>

      <div style={S.panel}>
        <div style={{ display: selectedTab === "task_details" ? "block" : "none" }}>
          <TaskDetailsAppraisalTab
            docNo={docNo} employeeCode={employeeCode}
            isVisible={selectedTab === "task_details"}
            onRowsChange={rows => { taskRowsRef.current = rows; }}
            onGrandTotalChange={total => setTaskTotal(total)}
          />
        </div>
        <div style={{ display: selectedTab === "characteristics" ? "block" : "none" }}>
          <TaskCharacterAppraisalTab
            docNo={docNo} employeeCode={employeeCode}
            isVisible={selectedTab === "characteristics"}
            onRowsChange={rows => { charRowsRef.current = rows; }}
            onGrandTotalChange={total => setCharacterTotal(total)}
          />
        </div>
        <div style={{ display: selectedTab === "goals" ? "block" : "none" }}>
          <TaskGoalAppraisalTab
            docNo={docNo} employeeCode={employeeCode}
            isVisible={selectedTab === "goals"}
            onRowsChange={rows => { goalRowsRef.current = rows; }}
            onGrandTotalChange={total => setGoalTotal(total)}
          />
        </div>
        <div style={{ display: selectedTab === "skill" ? "block" : "none" }}>
          <TaskSkillAppraisalTab
            docNo={docNo} employeeCode={employeeCode}
            isVisible={selectedTab === "skill"}
            onRowsChange={rows => { skillRowsRef.current = rows; }}
            onGrandTotalChange={total => setSkillTotal(total)}
          />
        </div>
        <div style={{ display: selectedTab === "comments" ? "block" : "none" }}>
          <AppraiserCommentsTab
            docNo={docNo} employeeCode={employeeCode}
            isVisible={selectedTab === "comments"}
            taskTotal={taskTotal}
            characterTotal={characterTotal}
            goalTotal={goalTotal}
            skillTotal={skillTotal}
            flowLevel={flowLevel} userFlowLevel={userFlowLevel}
            weightageConfig={weightageConfig}
            showAllComments={true}
            onAppraiserCommentChange={handleAppraiserCommentChange}
            onAppraiseeCommentChange={handleAppraiseeCommentChange}
          />
        </div>
      </div>

      {/* ── Sent Back Modal ── */}
      {sentBackPopup && (
        <div style={S.overlay} onClick={() => setSentBackPopup(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Send Back Appraisal</div>
            <div>
              <label style={S.label}>Send Back To Level</label>
              <select style={S.select} value={sentBackLevel} onChange={e => setSentBackLevel(e.target.value)}>
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
                onChange={e => setSentBackReason(e.target.value)}
                placeholder="Enter reason for sending back..."
              />
            </div>
            <div style={S.modalBtnRow}>
              <button type="button" style={S.outlineBtn} onClick={() => setSentBackPopup(false)}>Cancel</button>
              <button type="button" style={S.solidBtn()} onClick={() => void handleSentBack()}>Confirm Send Back</button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <PerformanceReportDesign
          required_values={{ doc_no: docNo ?? "", employee_code: employeeCode, company_code: "BSG" }}
          onClose={handleReportClose}
        />
      )}
    </div>
  );
};

export default AppraisalViewTabsPage;