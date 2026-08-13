import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../../state/AuthContext";
import { pamsSelect, pamsUpdateRatings } from "../../api/pams";
import TaskDetailsAppraisalTab   from "./Taskdetailsappraisaltab";
import TaskCharacterAppraisalTab from "./Taskcharacterappraisaltab";
import TaskGoalAppraisalTab      from "./Taskgoalappraisaltab";
import TaskSkillAppraisalTab     from "./Taskskillappraisaltab";
import AppraiserCommentsTab      from "./Appraisercommentstab";
import PerformanceReportDesign   from "./Performancereportdesign";
import { NoticeToast } from "../../components/ui/NoticeToast";

// ─── Types ────────────────────────────────────────────────────────────────────
type SelectedTab = "task_details" | "characteristics" | "goals" | "skill" | "comments";
type Row = Record<string, unknown>;

interface WeightageConfig {
  taskPct: number;
  charPct: number;
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

function calcFinalRating(taskTotal: number, charTotal: number, cfg: WeightageConfig): number {
  if (taskTotal === 0 && charTotal === 0) return 0;
  if (cfg.isHrDefined) {
    return Math.round((taskTotal * cfg.taskPct) / 100 + (charTotal * cfg.charPct) / 100);
  }
  return Math.round((taskTotal + charTotal) / 2);
}

function getRatingMeta(rating: number): { label: string; numColor: string; labelColor: string } {
  if (rating === 5) return { label: "Exceptional",        numColor: "#16a34a", labelColor: "#16a34a" };
  if (rating === 4) return { label: "Above Expectation", numColor: "#2563eb", labelColor: "#2563eb" };
  if (rating === 3) return { label: "Meets Expectation", numColor: "#7c3aed", labelColor: "#7c3aed" };
  if (rating === 2) return { label: "Below Expectation", numColor: "#d97706", labelColor: "#d97706" };
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
  ratingChipWrap: { marginLeft: "auto", flexShrink: 0 },
  weightageInfo: {
    fontSize: "0.68rem",
    fontWeight: 600,
    color: "#082A89",
    background: "rgba(8,42,137,0.08)",
    border: "1px solid rgba(8,42,137,0.15)",
    borderRadius: "6px",
    padding: "3px 8px",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
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
  reportModalOverlay: {
    position: "fixed" as const,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    display: "flex" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    zIndex: 10000,
    padding: "20px",
  },
  reportModalContent: {
    backgroundColor: "#fff",
    borderRadius: "8px",
    width: "90%",
    maxWidth: "1200px",
    height: "90%",
    display: "flex" as const,
    flexDirection: "column" as const,
    overflow: "hidden" as const,
  },
  reportModalHeader: {
    display: "flex" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    padding: "15px 20px",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f8fafc",
  },
  reportModalBody: { flex: 1, overflow: "auto" as const, padding: "20px" },
  reportModalFooter: {
    padding: "15px 20px",
    borderTop: "1px solid #e5e7eb",
    display: "flex" as const,
    justifyContent: "flex-end" as const,
    gap: "10px",
  },
  closeModalBtn: {
    background: "none",
    border: "none",
    fontSize: "24px",
    cursor: "pointer" as const,
    color: "#6b7280",
    padding: "0 8px",
    lineHeight: 1,
  },
};

// ─── Final Rating Chip ────────────────────────────────────────────────────────
const RatingChip: React.FC<{ rating: number; weightageConfig: WeightageConfig }> = ({
  rating,
  weightageConfig,
}) => {
  const meta = getRatingMeta(rating);
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
        {rating}
      </span>
      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: meta.labelColor, borderLeft: "1px solid rgba(8,42,137,0.20)", paddingLeft: "8px", letterSpacing: "0.02em" }}>
        {meta.label}
      </span>
      <span style={{ fontSize: "0.62rem", color: "#082A89", opacity: 0.55, borderLeft: "1px solid rgba(8,42,137,0.15)", paddingLeft: "8px" }}>
        {weightageConfig.isHrDefined ? `T${weightageConfig.taskPct}% / C${weightageConfig.charPct}%` : ""}
      </span>
    </div>
  );
};

// ─── Skeleton loader — tabs ke saath instant UI ───────────────────────────────
const HeaderSkeleton: React.FC<{ docNo: string; employeeName: string; employeeCode: string }> = ({
  docNo, employeeName, employeeCode,
}) => (
  <div style={S.header}>
    <div style={{ ...S.backBtn, opacity: 0.4, cursor: "default" }}>←</div>
    <span style={S.docTitle}>Appraisal: {docNo}</span>
    <span style={S.divider} />
    <div style={S.avatar}>
      {(employeeName?.[0] ?? employeeCode?.[0] ?? "?").toUpperCase()}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", minWidth: 0, flex: 1 }}>
      <span style={S.empName}>{employeeName || employeeCode || "—"}</span>
      {employeeCode && <span style={S.empId}>ID: {employeeCode}</span>}
    </div>
    {/* Rating chip placeholder */}
    <div style={{
      marginLeft: "auto", height: "30px", width: "160px",
      borderRadius: "10px", background: "rgba(8,42,137,0.08)",
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────
const AppraisalViewTabsPage: React.FC = () => {
  const navigate       = useNavigate();
  const location       = useLocation();
  const [searchParams] = useSearchParams();

  // ── Prefetched row from MyTaskPage navigate state ──────────────────────────
  const prefetchedRow = (location.state as { prefetchedRow?: Row } | null)?.prefetchedRow;

  const getDocNoFromPath = () => {
    const match = location.pathname.match(/\/(?:appraisal\/)?view\/([^/?]+)/);
    return match ? match[1] : "";
  };

  const docNo        = getDocNoFromPath();
  const employeeCode = searchParams.get("employee_code") ?? "";
  const employeeName = searchParams.get("employee_name") ?? "";
  const { user }    = useAuth();
  const loginid     = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";
  const [selectedTab,    setSelectedTab]    = useState<SelectedTab>("task_details");
  const [flowLevel,      setFlowLevel]      = useState<number>(
    prefetchedRow ? num(prefetchedRow.FLOW_LEVEL_RUNNING) : 0
  );
  const [finalApproved,  setFinalApproved]  = useState<string>(
    prefetchedRow ? (text(prefetchedRow.FINAL_APPROVED) || "NO") : "NO"
  );
  const [taskTotal,      setTaskTotal]      = useState<number>(0);
  const [characterTotal, setCharacterTotal] = useState<number>(0);
  const [sentBackPopup,  setSentBackPopup]  = useState(false);
  const [sentBackLevel,  setSentBackLevel]  = useState("1");
  const [sentBackReason, setSentBackReason] = useState("");
  const [sentBackLevels, setSentBackLevels] = useState<Row[]>([]);
  const [notice,         setNotice]         = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);

  // ── KEY CHANGE: prefetchedRow hai to loading=false se start karo ───────────
  const [loading,        setLoading]        = useState(!prefetchedRow);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);

  const [showReportModal,setShowReportModal]= useState(false);
  const [userFlowLevel,  setUserFlowLevel]  = useState<number>(0);

  const [weightageConfig, setWeightageConfig] = useState<WeightageConfig>({
    taskPct: 50,
    charPct: 50,
    isHrDefined: false,
  });

  // ── Refs ───────────────────────────────────────────────────────────────────
  const taskRowsRef         = useRef<Row[]>([]);
  const charRowsRef         = useRef<Row[]>([]);
  const goalRowsRef         = useRef<Row[]>([]);
  const skillRowsRef        = useRef<Row[]>([]);
  const appraiserCommentRef = useRef<string>("");
  const appraiseeCommentRef = useRef<string>("");
  const reportPrintRef      = useRef<HTMLDivElement>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const isFinalized              = finalApproved === "YES";
  const showSaveSubmitButtons    = !isFinalized && flowLevel >= 0 && flowLevel <= 2;
  const showApproveRejectButtons = !isFinalized && flowLevel >= 3 && flowLevel <= 7;
  const finalRating              = calcFinalRating(taskTotal, characterTotal, weightageConfig);
  const showFinalRating          = taskTotal > 0 && characterTotal > 0;
  const [reportReady, setReportReady] = useState(false);

  // ── Fetch — prefetchedRow hai to background mein, nahi to blocking ─────────
  useEffect(() => {
    if (!docNo || !employeeCode) { setLoading(false); return; }

    const fetchInitialData = async () => {
      if (!prefetchedRow) setLoading(true);
      else setBackgroundRefreshing(true);

      try {
        const [flowRes, levelRes, commentRes, historyRes, weightageRes] = await Promise.all([
          pamsSelect({ parameter: "get_appraisal_flow_level",    loginid, code1: docNo }),
          pamsSelect({ parameter: "sentback_levels",              loginid, code1: docNo }),
          pamsSelect({ parameter: "appraisal_comments",           loginid, code1: docNo }),
          pamsSelect({ parameter: "get_appraisal_flow_with_name", loginid, code1: docNo }),
          pamsSelect({
            parameter: "appraisal_weightage_active",
            loginid,
            code1: companyCode,
            code2: "ALL",
          }),
        ]);

        let currentFlowLevel = 0;
        let nextActionBy     = "";

        if (flowRes.length > 0) {
          currentFlowLevel = num(flowRes[0].FLOW_LEVEL_RUNNING);
          nextActionBy     = text(flowRes[0].NEXT_ACTION_BY).trim().toUpperCase();
          setFlowLevel(currentFlowLevel);
          setFinalApproved(text(flowRes[0].FINAL_APPROVED) || "NO");
        }

        if (weightageRes.length > 0) {
          const wRow = weightageRes[0];
          setWeightageConfig({
            taskPct:     num(wRow.TASK_PCT),
            charPct:     num(wRow.CHARACTER_PCT),
            isHrDefined: true,
          });
        } else {
          setWeightageConfig({ taskPct: 50, charPct: 50, isHrDefined: false });
        }

        const isMyTurn = nextActionBy === loginid.trim().toUpperCase();
        if (isMyTurn) {
          setUserFlowLevel(0);
        } else {
          const histRows = historyRes as Row[];
          const myAction = histRows.find(
            (h) => text(h.ACTION_BY).trim().toUpperCase() === loginid.trim().toUpperCase()
          );
          setUserFlowLevel(myAction ? num(myAction.FLOW_LEVEL) : currentFlowLevel);
        }

        setSentBackLevels(levelRes as Row[]);
        if (levelRes.length > 0)
          setSentBackLevel(text(levelRes[0].FLOW_RUNNING_LEVEL) || "1");

        if (commentRes.length > 0) {
          appraiserCommentRef.current = text(commentRes[0].APPRAISER_COMMENTS);
          appraiseeCommentRef.current = text(commentRes[0].APPRAISEE_COMMENTS);
        }

      } catch {
        // silent
      } finally {
        setLoading(false);
        setBackgroundRefreshing(false);
      }
    };

    void fetchInitialData();
  }, [docNo, employeeCode, loginid, companyCode]); // prefetchedRow intentionally excluded

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
        const allRows = [
          ...taskRowsRef.current,
          ...charRowsRef.current,
          ...goalRowsRef.current,
          ...skillRowsRef.current,
        ];
        if (allRows.length > 0) await pamsUpdateRatings(allRows as Record<string, unknown>[]);
        if (appraiserCommentRef.current.trim())
          await pamsSelect({ parameter: "update_appraiser_comments", loginid, code1: docNo, code2: employeeCode, code3: appraiserCommentRef.current.trim() });
        if (appraiseeCommentRef.current.trim())
          await pamsSelect({ parameter: "update_appraisee_comments", loginid, code1: docNo, code2: employeeCode, code3: appraiseeCommentRef.current.trim() });
      }
      const ratingToSend = (action === "S" || action === "A" || action === "D") ? finalRating : 0;

      await pamsSelect({
        parameter: "update_appraisal_status",
        loginid,
        code1: docNo,
        code2: employeeCode,
        code3: action,
        code4: "",
        number1: ratingToSend,   // <-- yeh naya param add hua
      });
      const msg =
        action === "D" ? "Saved as draft" :
        action === "S" ? "Submitted successfully" :
        action === "A" ? "Approved successfully" :
                         "Rejected successfully";
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
      await pamsSelect({ parameter: "update_appraisal_status", loginid, code1: docNo, code2: employeeCode, code3: "SB", code4: `${sentBackLevel}~${sentBackReason.trim()}` });
      setNotice({ type: "success", message: "Appraisal sent back successfully" });
      setSentBackPopup(false);
      setSentBackReason("");
      setSentBackLevel("1");
      setTimeout(() => navigate(-1), 900);
    } catch (err: unknown) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    }
  };

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrintReport = () => {
    if (!reportReady || !reportPrintRef.current) return; 
    const fileName = `Performance-Report-${docNo}-${new Date().toISOString().slice(0, 10)}`;
    const printStyles = `
      @page { size: A4 portrait; margin: 10mm 8mm; }
      * { box-sizing: border-box; }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        margin: 0; padding: 0;
        font-family: Arial, sans-serif;
        background: #fff;
      }
      thead { display: table-header-group; }
    `;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      `<!DOCTYPE html><html><head><title>${fileName}</title><style>${printStyles}</style></head><body>${reportPrintRef.current.outerHTML}</body></html>`
    );
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  // ── Full-page loading — sirf tab jab prefetchedRow nahi hai ───────────────
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
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {backgroundRefreshing && (
        <div style={{
          position: "fixed", top: "12px", right: "16px", zIndex: 9998,
          background: "#082A89", color: "#fff",
          fontSize: "11px", fontWeight: 600,
          padding: "4px 10px", borderRadius: "20px",
          opacity: 0.85,
        }}>
          Refreshing...
        </div>
      )}
      <div style={S.header}>
        <button
          style={S.backBtn}
          onClick={() => navigate(-1)}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(8,42,137,0.18)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(8,42,137,0.10)"; }}
          title="Go back"
        >
          ←
        </button>

        <span style={S.docTitle}>Appraisal: {docNo}</span>
        <span style={S.divider} />

        <div style={S.avatar}>
          {(employeeName?.[0] ?? employeeCode?.[0] ?? "?").toUpperCase()}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", minWidth: 0, flex: 1 }}>
          <span style={S.empName}>{employeeName || employeeCode || "—"}</span>
          {employeeCode && <span style={S.empId}>ID: {employeeCode}</span>}
        </div>

        {showFinalRating && (
          <div style={S.ratingChipWrap}>
            <RatingChip rating={finalRating} weightageConfig={weightageConfig} />
          </div>
        )}
      </div>

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
            docNo={docNo}
            employeeCode={employeeCode}
            isVisible={selectedTab === "comments"}
            taskTotal={taskTotal}
            characterTotal={characterTotal}
            flowLevel={flowLevel}
            userFlowLevel={userFlowLevel}
            weightageConfig={weightageConfig}
            onAppraiserCommentChange={(val) => { appraiserCommentRef.current = val; }}
            onAppraiseeCommentChange={(val)  => { appraiseeCommentRef.current = val; }}
          />
        </div>
      </div>

      <div style={S.btnRow}>
        <div style={S.btnGroup}>
          {showSaveSubmitButtons && (
            <>
              <button
                style={S.solidBtn()}
                onMouseEnter={e => (e.currentTarget.style.background = "#d0deff")}
                onMouseLeave={e => (e.currentTarget.style.background = "#E8F0FF")}
                onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
                onClick={() => void handleAction("D")}
              >
                💾 Save as Draft
              </button>
              <button
                style={S.solidBtn()}
                onMouseEnter={e => (e.currentTarget.style.background = "#d0deff")}
                onMouseLeave={e => (e.currentTarget.style.background = "#E8F0FF")}
                onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
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
              <button
                style={S.solidBtn("#E8F0FF")}
                onMouseEnter={e => (e.currentTarget.style.background = "#d0deff")}
                onMouseLeave={e => (e.currentTarget.style.background = "#E8F0FF")}
                onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
                onClick={() => void handleAction("A")}
              >✔️ Approve</button>
              <button
                style={S.solidBtn("#E8F0FF")}
                onMouseEnter={e => (e.currentTarget.style.background = "#d0deff")}
                onMouseLeave={e => (e.currentTarget.style.background = "#E8F0FF")}
                onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
                onClick={() => void handleAction("R")}
              >✗ Reject</button>
              <button
                style={S.solidBtn("#E8F0FF")}
                onMouseEnter={e => (e.currentTarget.style.background = "#d0deff")}
                onMouseLeave={e => (e.currentTarget.style.background = "#E8F0FF")}
                onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
                onClick={() => setSentBackPopup(true)}
              >↩ Send Back</button>
            </>
          )}
        </div>
        <div style={S.btnGroup}>
          <button
            style={S.solidBtn("#E8F0FF")}
            onMouseEnter={e => (e.currentTarget.style.background = "#d0deff")}
            onMouseLeave={e => (e.currentTarget.style.background = "#E8F0FF")}
            onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
            onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
            onClick={() => { setReportReady(false); setShowReportModal(true); }}
          >🖨️ Print</button>
          <button
            style={S.solidBtn("#E8F0FF")}
            onMouseEnter={e => (e.currentTarget.style.background = "#d0deff")}
            onMouseLeave={e => (e.currentTarget.style.background = "#E8F0FF")}
            onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
            onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
            onClick={() => navigate(-1)}
          >🚪 Exit</button>
        </div>
      </div>

      {/* ── Sent Back Modal ── */}
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
              <button type="button" style={S.outlineBtn} onClick={() => setSentBackPopup(false)}>Cancel</button>
              <button type="button" style={S.solidBtn()} onClick={() => void handleSentBack()}>Confirm Send Back</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report Modal ── */}
      {showReportModal && (
        <div style={S.reportModalOverlay} onClick={() => setShowReportModal(false)}>
          <div style={S.reportModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={S.reportModalHeader}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#082A89" }}>
                Performance Report — {docNo}
              </h3>
              <button
                style={S.closeModalBtn}
                onClick={() => setShowReportModal(false)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#082A89"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6b7280"; }}
              >
                ×
              </button>
            </div>
            <div style={S.reportModalBody}>
              <PerformanceReportDesign
                required_values={{
                  doc_no:        docNo ?? "",
                  employee_code: employeeCode,
                  company_code:  "BSG",
                }}
                printRef={reportPrintRef}
                onReady={setReportReady}
              />
            </div>
            <div style={S.reportModalFooter}>
              <button style={S.outlineBtn} onClick={() => setShowReportModal(false)}>Close</button>
              <button style={S.solidBtn()} onClick={handlePrintReport}>🖨️ Print Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AppraisalViewTabsPage;