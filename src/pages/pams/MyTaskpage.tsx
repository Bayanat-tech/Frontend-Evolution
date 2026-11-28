import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../state/AuthContext";
import { pamsSelect, pamsDelete, pamsSave } from "../../api/pams";
import { CheckCircle, Eye, Edit2, Save, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { NoticeToast } from "../../components/ui/NoticeToast";
import type { ColumnDef } from "@tanstack/react-table";
import type { LookupRow } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { DataTable } from "../../components/ui/DataTablePams";


type Row = Record<string, unknown>;
type EmpType = "ALL" | "MANAGER" | "NON-MANAGER";

interface MyTaskPageProps {
  initialTab?: number;
}

interface FormData {
  APPRAISAL_DOC_NO: string;
  APPRAISAL_DOC_DATE: string;
  EMPLOYEE_CODE: string;
  EMPLOYEE_NAME: string;
  PERIOD_NUMBER: string;
  APPRAISAL_FROM: string;
  APPRAISAL_TO: string;
  COMPANY_CODE: string;
  [key: string]: unknown;
}

interface ActiveWeightage {
  taskPct: number;
  charPct: number;
  isHrDefined: boolean;
}

const TAB_STATUS = ["PENDING", "IN PROGRESS", "REJECTED", "SENTBACK_TAB", "APPROVED"] as const;
const TAB_LABELS = ["Pending", "In Progress", "Rejected", "Sent Back", "Closed"] as const;
const IN_PROGRESS_TAB = 1; // is tab me checkbox selection nahi dikhega
const HR_APPROVERS = ["2021060535", "2010080001", "2018030473"];
const taskPageCache = new Map<string, Row[]>();

function text(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

function fmtDate(val: unknown): string {
  const raw = String(val || "");
  if (!raw || raw === "null" || raw === "undefined") return "NA";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "NA";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatPeriodDisplay(periodNumber: unknown): string {
  const raw = text(periodNumber);
  if (!raw) return "";
  return raw.replace(/-/g, " ");
}

function getStatusMeta(
  lastAction: string,
  flowLevel: number,
  status: string
): { label: string; bg: string; color: string; border: string } {
  const isDraft =
    (flowLevel === 2 || flowLevel === 3) &&
    (status === "DRAFT" || lastAction === "SAVE AS DRAFT" || lastAction === "SAVE_AS_DRAFT");
  const label = isDraft ? "SAVE AS DRAFT" : lastAction;
  const val = (lastAction || "").toUpperCase().trim();

  if (isDraft) return { label, bg: "#fff4e5", color: "#92400e", border: "#fcd38a" };
  if (val === "SUBMITTED") return { label, bg: "#e6f9f0", color: "#0a6640", border: "#79c3a2" };
  if (val === "APPROVED") return { label, bg: "#e8f0fe", color: "#1a4fa0", border: "#b3caf5" };
  if (val === "REJECTED") return { label, bg: "#fdecea", color: "#a01a1a", border: "#f5b3b3" };
  if (val === "SENT BACK") return { label, bg: "#f3e8fe", color: "#6b21a8", border: "#d9b3f5" };
  return { label, bg: "#f4f4f5", color: "#52525b", border: "#d4d4d8" };
}

function normalizeRow(row: Row): Row {
  const normalized: Row = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    normalized[key] = value;
    normalized[key.toUpperCase()] = value;
  });
  return normalized;
}

function computeFinalRating(
  taskScore: number,
  charScore: number,
  weightage: ActiveWeightage | null
): number {
  if (weightage?.isHrDefined) {
    return Math.round((taskScore * weightage.taskPct / 100) + (charScore * weightage.charPct / 100));
  }
  return Math.round((taskScore + charScore) / 2);
}

function isManagerRow(row: Row): boolean {
  return text(row.EMPLOYEE_TYPE).toUpperCase() === "MANAGER";
}

// ── Helpers: search / filter ke liye "jo screen par dikhta hai wahi text" ──
function getAvg(row: Row, weightage: ActiveWeightage | null): number {
  const taskScore = Number(row.TASK_TOTAL ?? row.task_total ?? 0);
  const charScore = Number(row.CHAR_TOTAL ?? row.char_total ?? 0);
  return taskScore > 0 || charScore > 0
    ? computeFinalRating(taskScore, charScore, weightage)
    : Math.round(Number(row.FINAL_RATING || 0));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtRangeDate(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function desgLabel(r: Row): string {
  const c = text(r.DESG_CODE);
  const n = text(r.DESG_NAME);
  return c && n ? `${c} - ${n}` : c || n;
}

function nextActionLabel(r: Row): string {
  const c = text(r.NEXT_ACTION_BY);
  const n = text(r.NEXT_ACTION_BY_NAME);
  return c ? (n ? `${c} - ${n}` : c) : "";
}

function employeeLabel(r: Row): string {
  return `${text(r.EMPLOYEE_CODE)} - ${text(r.EMPLOYEE_NAME)}`;
}

function statusLabelOf(r: Row): string {
  return getStatusMeta(text(r.LAST_ACTION), Number(r.FLOW_LEVEL_RUNNING || 0), text(r.STATUS)).label;
}

// Reason column: Sent Back / Rejected — reason + "by whom" (CODE - NAME)
function reasonInfo(r: Row): { reason: string; by: string; byLabel: string; kind: "SENTBACK" | "REJECTED" | "" } {
  const sbReason = text(r.SENT_BACK_REASON).trim();
  const sbByCode = text(r.SENT_BACK_BY).trim();
  const sbByName = text(r.SENT_BACK_BY_NAME).trim();
  const rjReason = text(r.REJECT_REASON).trim();
  const rjByCode = text(r.REJECT_BY).trim();
  const rjByName = text(r.REJECT_BY_NAME).trim();
  const action = text(r.LAST_ACTION).toUpperCase().replace(/[\s_]/g, "");
  const isRejected = action === "REJECTED";

  const sbBy = sbByCode && sbByName ? `${sbByCode} - ${sbByName}` : sbByCode || sbByName;
  const rjBy = rjByCode && rjByName ? `${rjByCode} - ${rjByName}` : rjByCode || rjByName;

  if (isRejected && rjReason) return { reason: rjReason, by: rjBy, byLabel: "Rejected by", kind: "REJECTED" };
  if (sbReason) return { reason: sbReason, by: sbBy, byLabel: "Sent back by", kind: "SENTBACK" };
  if (rjReason) return { reason: rjReason, by: rjBy, byLabel: "Rejected by", kind: "REJECTED" };
  return { reason: "", by: "", byLabel: "", kind: "" };
}

function rowDiv(r: Row, empDiv: Record<string, string>, divName: Record<string, string>) {
  let code = text(r.DIV_CODE ?? r.DIVISION_CODE).trim();
  let name = text(r.DIV_NAME ?? r.DIVISION_NAME).trim();
  if (!code) code = empDiv[text(r.EMPLOYEE_CODE).trim().toUpperCase()] || "";
  if (code && !name) name = divName[code] || "";
  return { key: code || name, label: code && name ? `${code} - ${name}` : code || name };
}

function rowDept(r: Row) {
  const code = text(r.DEPT_CODE ?? r.DEPARTMENT_CODE).trim();
  const name = text(r.DEPT_NAME ?? r.DEPARTMENT_NAME).trim();
  return { key: code || name, label: code && name ? `${code} - ${name}` : code || name };
}

function buildSearchText(
  r: Row,
  w: ActiveWeightage | null,
  empDiv: Record<string, string>,
  divName: Record<string, string>
): string {
  return [
    text(r.APPRAISAL_DOC_NO),
    fmtDate(r.APPRAISAL_DOC_DATE),
    text(r.PERIOD_NUMBER),
    formatPeriodDisplay(r.PERIOD_NUMBER),
    text(r.EMPLOYEE_CODE),
    text(r.EMPLOYEE_NAME),
    employeeLabel(r),
    desgLabel(r),
    text(r.DEPT_NAME),
    rowDiv(r, empDiv, divName).label,
    rowDept(r).label,
    fmtRangeDate(r.APPRAISAL_FROM),
    fmtRangeDate(r.APPRAISAL_TO),
    String(getAvg(r, w) || ""),
    nextActionLabel(r),
    text(r.SENT_BACK_REASON),
    text(r.SENT_BACK_BY),
    text(r.SENT_BACK_BY_NAME),
    text(r.REJECT_REASON),
    text(r.REJECT_BY),
    text(r.REJECT_BY_NAME),
    statusLabelOf(r),
  ].join(" | ");
}

const MyTaskPage = ({ initialTab = 0 }: MyTaskPageProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";
  const isHRApprover = HR_APPROVERS.includes(loginid);
  const cacheKey = useCallback(
    (tabIdx: number) => `${loginid}-${companyCode}-${TAB_STATUS[tabIdx]}`,
    [loginid, companyCode]
  );
  const [activeTab, setActiveTab] = useState(initialTab);
  const [rows, setRows] = useState<Row[]>(
    () => taskPageCache.get(`${loginid}-${companyCode}-${TAB_STATUS[initialTab]}`) ?? []
  );
  const [loading, setLoading] = useState(
    () => !taskPageCache.has(`${loginid}-${companyCode}-${TAB_STATUS[initialTab]}`)
  );
  const [tabCounts, setTabCounts] = useState<number[]>(() =>
    TAB_STATUS.map((_, i) => taskPageCache.get(`${loginid}-${companyCode}-${TAB_STATUS[i]}`)?.length ?? 0)
  );
  const [notice, setNotice] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [empType, setEmpType] = useState<EmpType>("ALL");
  const [divFilter, setDivFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [activeWeightage, setActiveWeightage] = useState<ActiveWeightage | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentRow, setCurrentRow] = useState<Row | null>(null);
  const [formData, setFormData] = useState<FormData>({
    APPRAISAL_DOC_NO: "", APPRAISAL_DOC_DATE: "",
    EMPLOYEE_CODE: "", EMPLOYEE_NAME: "",
    PERIOD_NUMBER: "", APPRAISAL_FROM: "",
    APPRAISAL_TO: "", COMPANY_CODE: companyCode,
  });
  const [saving, setSaving] = useState(false);
  const [periods, setPeriods] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Row[]>([]);
  const fetchRequestId = useRef(0);
  const prevUserKeyRef = useRef(`${loginid}-${companyCode}`);

  // ── Notify Next Level state (Direct Button) ──
  const [notifying, setNotifying] = useState(false);

  const showSelection = isHRApprover && activeTab !== IN_PROGRESS_TAB;
  const [approving, setApproving] = useState(false);
  const [approveProgress, setApproveProgress] = useState({ done: 0, total: 0 });
  const APPROVE_CHUNK_SIZE = 50;

  const resetFilters = () => {
    setQuery("");
    setEmpType("ALL");
    setDivFilter("ALL");
    setDeptFilter("ALL");
  };

  // Division master + employee->division map (Trn_appraisal rows me DIV_* nahi aata)
  const [divMaster, setDivMaster] = useState<Row[]>([]);
  const [empDivMap, setEmpDivMap] = useState<Record<string, string>>({});

  // employees lookup se code -> name map (fallback ke liye jab SP name na bheje)
  const empNameByCode = useMemo(() => {
    const m: Record<string, string> = {};
    employees.forEach((e) => {
      const code = text(e.EMPLOYEE_CODE).trim().toUpperCase();
      const name = text(e.RPT_NAME || e.EMP_NAME).trim();
      if (code && name) m[code] = name;
    });
    return m;
  }, [employees]);

  const divNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    divMaster.forEach((d) => {
      const c = text(d.DIV_CODE).trim();
      if (c) m[c] = text(d.DIV_NAME).trim();
    });
    return m;
  }, [divMaster]);

  useEffect(() => {
    if (!isHRApprover || !companyCode) return;
    let cancelled = false;
    (async () => {
      try {
        const divs = (await pamsSelect({ parameter: "division", loginid, code1: companyCode })).map(normalizeRow);
        if (cancelled) return;
        setDivMaster(divs);
        const map: Record<string, string> = {};
        await Promise.all(
          divs.map(async (d) => {
            const code = text(d.DIV_CODE).trim();
            if (!code) return;
            try {
              const emps = await pamsSelect({
                parameter: "get_employees_by_division",
                loginid, code1: companyCode, code2: code,
              });
              emps.forEach((e) => {
                const ec = text(normalizeRow(e as Row).EMPLOYEE_CODE).trim().toUpperCase();
                if (ec) map[ec] = code;
              });
            } catch {
              /* ek division fail ho to baaki chalte rahein */
            }
          })
        );
        if (!cancelled) setEmpDivMap(map);
      } catch (error) {
        console.error("Error loading divisions:", error);
      }
    })();
    return () => { cancelled = true; };
  }, [isHRApprover, loginid, companyCode]);

  const typeCounts = useMemo(() => ({
    MANAGER: rows.filter(isManagerRow).length,
    "NON-MANAGER": rows.filter((r) => !isManagerRow(r)).length,
  }), [rows]);

  const divOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => {
      const d = rowDiv(r, empDivMap, divNameMap);
      if (d.key) m.set(d.key, d.label);
    });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, empDivMap, divNameMap]);

  const deptOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => {
      if (divFilter !== "ALL" && rowDiv(r, empDivMap, divNameMap).key !== divFilter) return;
      const d = rowDept(r);
      if (d.key) m.set(d.key, d.label);
    });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, divFilter, empDivMap, divNameMap]);

  const decoratedRows = useMemo(
    () => rows.map((r): Row => ({ ...r, _SEARCH: buildSearchText(r, activeWeightage, empDivMap, divNameMap) })),
    [rows, activeWeightage, empDivMap, divNameMap]
  );

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decoratedRows.filter((r) => {
      if (isHRApprover) {
        if (empType === "MANAGER" && !isManagerRow(r)) return false;
        if (empType === "NON-MANAGER" && isManagerRow(r)) return false;
        if (divFilter !== "ALL" && rowDiv(r, empDivMap, divNameMap).key !== divFilter) return false;
        if (deptFilter !== "ALL" && rowDept(r).key !== deptFilter) return false;
      }
      return !q || text(r._SEARCH).toLowerCase().includes(q);
    });
  }, [decoratedRows, query, isHRApprover, empType, divFilter, deptFilter, empDivMap, divNameMap]);

  // ── Eligible Check: Next Action, Supervisor, Creator, HOD ──
  const isEligibleToNotify = useMemo(() => {
    return visibleRows.some((r) => {
      // Agar document already complete hai, to skip karo
      if (text(r.FINAL_APPROVED).toUpperCase() === "YES") return false;

      const nextAction = text(r.NEXT_ACTION_BY).trim();
      const sup = text(r.IMMEDIATE_SUPERVISOR).trim();
      const creator = text(r.CREATED_BY).trim();
      const hod = text(r.HOD).trim();

      // Agar user inme se kisi ek me bhi hai, toh button dikhao
      return (
        (nextAction && nextAction === loginid) ||
        (sup && sup === loginid) ||
        (creator && creator === loginid) ||
        (hod && hod === loginid)
      );
    });
  }, [visibleRows, loginid]);

  useEffect(() => {
    if (!companyCode) return;
    pamsSelect({ parameter: "appraisal_weightage_list", loginid, code1: companyCode })
      .then((data) => {
        const wRows = data as unknown as Array<Record<string, unknown>>;
        const active = wRows?.find((r) => String(r.IS_ACTIVE) === "Y");
        if (active) {
          const taskPct = Number(active.TASK_PCT || 0);
          const charPct = Number(active.CHARACTER_PCT || 0);
          setActiveWeightage({ taskPct, charPct, isHrDefined: taskPct > 0 && charPct > 0 });
        } else {
          setActiveWeightage({ taskPct: 50, charPct: 50, isHrDefined: false });
        }
      })
      .catch(() => setActiveWeightage({ taskPct: 50, charPct: 50, isHrDefined: false }));
  }, [companyCode, loginid]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [periodsData, employeesData] = await Promise.all([
          pamsSelect({ parameter: "period", loginid, code1: companyCode }),
          pamsSelect({ parameter: "employee_hierarchy", loginid, code1: companyCode }),
        ]);
        setPeriods(periodsData.map(normalizeRow));
        setEmployees(employeesData.map(normalizeRow));
      } catch (error) {
        console.error("Error loading lookups:", error);
      }
    };
    void loadLookups();
  }, [loginid, companyCode]);

  const loadTabCounts = useCallback(async () => {
    if (!loginid || !companyCode) return;
    const results = await Promise.all(
      TAB_STATUS.map(async (status, i) => {
        try {
          const data = await pamsSelect({
            parameter: "Trn_appraisal",
            loginid,
            code1: companyCode,
            code2: "NULL",
            code3: status,
          });
          const normalized = data.map(normalizeRow);
          taskPageCache.set(cacheKey(i), normalized);
          return normalized.length;
        } catch {
          return null;
        }
      })
    );
    setTabCounts((prev) => results.map((c, i) => (c ?? prev[i] ?? 0)));
  }, [loginid, companyCode, cacheKey]);

  useEffect(() => { void loadTabCounts(); }, [loadTabCounts]);

  const fetchData = useCallback(async (tabIndex: number, isBackground = false) => {
    const myRequestId = ++fetchRequestId.current;
    const tabStatus = TAB_STATUS[tabIndex];

    if (!isBackground) setLoading(true);
    setNotice(null);

    try {
      const data = await pamsSelect({
        parameter: "Trn_appraisal",
        loginid,
        code1: companyCode,
        code2: "NULL",
        code3: tabStatus,
      });
      if (myRequestId !== fetchRequestId.current) return;

      const normalizedData = data.map(normalizeRow);
      setRows(normalizedData);
      taskPageCache.set(cacheKey(tabIndex), normalizedData);
      setTabCounts((prev) => {
        const next = [...prev];
        next[tabIndex] = normalizedData.length;
        return next;
      });

      const initSelected: Record<string, boolean> = {};
      normalizedData.forEach((row) => {
        initSelected[text(row.APPRAISAL_DOC_NO)] = false;
      });
      setSelectedRows(initSelected);
    } catch (err: unknown) {
      if (myRequestId !== fetchRequestId.current) return;
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to load data" });
    } finally {
      if (myRequestId === fetchRequestId.current) setLoading(false);
    }
  }, [loginid, companyCode, cacheKey]);

  useEffect(() => {
    const hasCached = taskPageCache.has(cacheKey(activeTab));
    void fetchData(activeTab, hasCached);
  }, [activeTab, fetchData]);

  useEffect(() => {
    const userKey = `${loginid}-${companyCode}`;
    if (prevUserKeyRef.current === userKey) return;
    prevUserKeyRef.current = userKey;
    taskPageCache.clear();
    setRows([]);
    setSelectedRows({});
    setTabCounts(TAB_STATUS.map(() => 0));
    setLoading(true);
    resetFilters();
    void fetchData(activeTab, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginid, companyCode]);

  const handleTabChange = useCallback((index: number) => {
    if (index === activeTab) return;

    const cached = taskPageCache.get(cacheKey(index));
    if (cached) {
      setRows(cached);
      setLoading(false);
      const initSelected: Record<string, boolean> = {};
      cached.forEach((row) => { initSelected[text(row.APPRAISAL_DOC_NO)] = false; });
      setSelectedRows(initSelected);
    } else {
      setRows([]);
      setLoading(true);
    }

    setActiveTab(index);
    setQuery("");
    setEmpType("ALL");
    setDivFilter("ALL");
    setDeptFilter("ALL");
  }, [activeTab, cacheKey]);

  const openAppraisalTabsPage = (row: Row, mode: "view" | "edit" | "open" = "open") => {
    const docNo = text(row.APPRAISAL_DOC_NO);
    const employeeCode = text(row.EMPLOYEE_CODE);
    const employeeName = encodeURIComponent(text(row.EMPLOYEE_NAME));
    const designation = encodeURIComponent(text(row.DESG_NAME));
    const department = encodeURIComponent(text(row.DEPT_NAME));
    const sourceTab = encodeURIComponent(TAB_STATUS[activeTab]);
    navigate(
      `/workspace/pams/appraisal/view/${docNo}?employee_code=${employeeCode}&employee_name=${employeeName}&designation=${designation}&department=${department}&mode=${mode}&source_tab=${sourceTab}`,
      { state: { prefetchedRow: row } }
    );
  };

  function dateToString(value: unknown): string {
    if (!value) return "";
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const buildFormData = (row: Row): FormData => ({
    APPRAISAL_DOC_NO: text(row.APPRAISAL_DOC_NO),
    APPRAISAL_DOC_DATE: dateToString(row.APPRAISAL_DOC_DATE),
    EMPLOYEE_CODE: text(row.EMPLOYEE_CODE),
    EMPLOYEE_NAME: text(row.EMPLOYEE_NAME),
    PERIOD_NUMBER: text(row.PERIOD_NUMBER),
    APPRAISAL_FROM: dateToString(row.APPRAISAL_FROM),
    APPRAISAL_TO: dateToString(row.APPRAISAL_TO),
    COMPANY_CODE: text(row.COMPANY_CODE) || companyCode,
  });

  const openViewDialog = (row: Row) => {
    setCurrentRow(row);
    setFormData(buildFormData(row));
    setViewMode(true); setEditMode(false); setDialogOpen(true);
  };

  const openEditDialog = (row: Row) => {
    setCurrentRow(row);
    setFormData(buildFormData(row));
    setViewMode(false); setEditMode(true); setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false); setViewMode(false); setEditMode(false); setCurrentRow(null);
    setFormData({
      APPRAISAL_DOC_NO: "", APPRAISAL_DOC_DATE: "", EMPLOYEE_CODE: "",
      EMPLOYEE_NAME: "", PERIOD_NUMBER: "", APPRAISAL_FROM: "", APPRAISAL_TO: "",
      COMPANY_CODE: companyCode
    });
  };

  const updateFormField = (key: string, value: unknown) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handlePeriodChange = (periodNumber: string) => {
    const period = periods.find((p) => text(p.PERIOD_NUMBER) === periodNumber);
    updateFormField("PERIOD_NUMBER", periodNumber);
    if (period) {
      updateFormField("APPRAISAL_FROM", dateToString(period.PERIOD_FROM_DATE));
      updateFormField("APPRAISAL_TO", dateToString(period.PERIOD_TO_DATE));
    }
  };

  const handleEmployeeChange = (value: string, selected: LookupRow | null) => {
    updateFormField("EMPLOYEE_CODE", value);
    updateFormField("EMPLOYEE_NAME", selected?.RPT_NAME || selected?.EMP_NAME || "");
  };

  const saveRecord = async () => {
    if (!editMode) return;
    if (!formData.EMPLOYEE_CODE || !formData.PERIOD_NUMBER) {
      setNotice({ type: "error", message: "Employee and period are required" });
      return;
    }
    setSaving(true); setNotice(null);
    try {
      await pamsSave({
        parameter: "Trn_ems_appraisal_hdr", loginid,
        val1s1: formData.COMPANY_CODE, val1s4: formData.EMPLOYEE_CODE,
        val1s5: formData.APPRAISAL_DOC_NO, val1s6: formData.APPRAISAL_DOC_DATE,
        val1s7: formData.APPRAISAL_FROM, val1s8: formData.APPRAISAL_TO,
        val1s9: formData.PERIOD_NUMBER,
        wval1s1: formData.COMPANY_CODE, wval1s5: formData.APPRAISAL_DOC_NO,
      });
      setNotice({ type: "success", message: "Appraisal updated successfully" });
      closeDialog();
      void fetchData(activeTab);
      void loadTabCounts();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Failed to update appraisal" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: Row) => {
    if (!window.confirm("Are you sure you want to delete this appraisal?")) return;
    try {
      await pamsDelete({
        parameter: "delete_appraisal_hdr", loginid,
        code1: text(row.APPRAISAL_DOC_NO), code2: text(row.COMPANY_CODE),
      });
      setNotice({ type: "success", message: "Appraisal deleted successfully" });
      void fetchData(activeTab);
      void loadTabCounts();
    } catch (err: unknown) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to delete" });
    }
  };

  // ── Selection (sirf visible rows par kaam karta hai) ──
  const visibleIds = useMemo(
    () => visibleRows.map((r) => text(r.APPRAISAL_DOC_NO)).filter(Boolean),
    [visibleRows]
  );
  const selectedVisibleIds = useMemo(
    () => visibleIds.filter((id) => selectedRows[id]),
    [visibleIds, selectedRows]
  );

  const toggleSelect = (id: string, checked: boolean) =>
    setSelectedRows((prev) => ({ ...prev, [id]: checked }));

  const toggleSelectAll = (checked: boolean) => {
    setSelectedRows((prev) => {
      const next = { ...prev };
      visibleIds.forEach((id) => { next[id] = checked; });
      return next;
    });
  };

  const handleBulkApprove = async () => {
    if (approving) return;

    const ids = selectedVisibleIds;
    if (!ids.length) {
      setNotice({ type: "warning", message: "Please select at least one appraisal!" });
      return;
    }
    if (!window.confirm(`Are you sure you want to approve ${ids.length} appraisal(s)?`)) return;

    setApproving(true);
    setApproveProgress({ done: 0, total: ids.length });
    setNotice(null);

    const failedIds: string[] = [];
    let approvedCount = 0;

    for (let i = 0; i < ids.length; i += APPROVE_CHUNK_SIZE) {
      const chunk = ids.slice(i, i + APPROVE_CHUNK_SIZE);
      try {
        await pamsSelect({
          parameter: "proc_update_pams_doc_status_bulk", loginid,
          code1: companyCode, code2: chunk.join(","), code3: "A", code4: "",
        });
        approvedCount += chunk.length;
      } catch {
        failedIds.push(...chunk);
      }
      setApproveProgress({ done: Math.min(i + chunk.length, ids.length), total: ids.length });
    }

    if (failedIds.length === 0) {
      toast.success(`${approvedCount} appraisal(s) approved successfully.`);
      setSelectedRows({});
    } else {
      toast.warning(`${approvedCount} approved, ${failedIds.length} failed. Failed records selected rehenge, dobara try karo.`);
      const next: Record<string, boolean> = {};
      failedIds.forEach((id) => { next[id] = true; });
      setSelectedRows(next);
    }

    setApproving(false);
    void fetchData(activeTab);
    void loadTabCounts();
  };

  // ── Notify Next Level (auto-pick period from active rows) ──
  const handleNotifyNextLevel = async () => {
    // Jo pehli eligible row milegi, uska period utha lo
    const eligibleRow = visibleRows.find((r) => {
      if (text(r.FINAL_APPROVED).toUpperCase() === "YES") return false;
      const nextAction = text(r.NEXT_ACTION_BY).trim();
      const sup = text(r.IMMEDIATE_SUPERVISOR).trim();
      const creator = text(r.CREATED_BY).trim();
      const hod = text(r.HOD).trim();
      return (
        (nextAction && nextAction === loginid) ||
        (sup && sup === loginid) ||
        (creator && creator === loginid) ||
        (hod && hod === loginid)
      );
    });

    const periodToNotify = eligibleRow ? text(eligibleRow.PERIOD_NUMBER) : "";

    if (!periodToNotify) {
      toast.warning("No active period found to notify.");
      return;
    }

    setNotifying(true);
    try {
      const res = await pamsSelect({
        parameter: "notify_next_level_hod_bulk",
        loginid,
        code1: companyCode,
        code2: periodToNotify,
      });
      const result = text((res as unknown as Row[])?.[0]?.P_RESULT);

      if (result === "SUCCESS") {
        toast.success(`Period ${periodToNotify} has been sent to the next level.`);
      } else if (result === "NOTHING_TO_NOTIFY") {
        toast.warning("There are no completed appraisals ready to notify at this time.");
      } else {
        toast.error(result || "Something went wrong while notifying the next level.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to notify the next level. Please try again.");
    } finally {
      setNotifying(false);
    }
  };

  // employees lookup se name fallback resolve karne ke liye helper
  const resolveByLabel = (code: string, name: string): string => {
    const c = code.trim();
    const n = name.trim();
    if (c && n) return `${c} - ${n}`;
    if (c && !n) {
      const fromLookup = empNameByCode[c.toUpperCase()];
      return fromLookup ? `${c} - ${fromLookup}` : c;
    }
    return n;
  };

  const columns = useMemo<ColumnDef<Row>[]>(() => {
    const cols: ColumnDef<Row>[] = [];

    // ── 1. Appraisal Doc No ──
    cols.push({
      accessorKey: "APPRAISAL_DOC_NO",
      size: 240,
      minSize: 180,
      header: () => {
        if (!showSelection) return <span>Appraisal Doc No</span>;
        const allChecked = visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length;
        const someChecked = selectedVisibleIds.length > 0 && !allChecked;
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={allChecked}
              ref={(el) => { if (el) el.indeterminate = someChecked; }}
              disabled={visibleIds.length === 0}
              title={`Select all (${visibleIds.length})`}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => toggleSelectAll(e.target.checked)}
              style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#082A89" }}
            />
            <span>Appraisal Doc No</span>
          </span>
        );
      },
      cell: ({ row }) => {
        const id = text(row.original.APPRAISAL_DOC_NO);
        if (!id) return null;
        return (
          <div
            onClick={(e) => {
              if ((e.target as HTMLElement).tagName !== "INPUT")
                openAppraisalTabsPage(row.original, "open");
            }}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {showSelection && (
              <input
                type="checkbox"
                checked={!!selectedRows[id]}
                onChange={(e) => { e.stopPropagation(); toggleSelect(id, e.target.checked); }}
                style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#082A89" }}
              />
            )}
            <span
              style={{
                color: "#082A89", fontWeight: 600, fontSize: "0.82rem",
                cursor: "pointer", display: "inline-block",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              {id}
            </span>
          </div>
        );
      },
    });

    // ── 2. Appraisal Date ──
    cols.push({
      accessorKey: "APPRAISAL_DOC_DATE",
      header: "Appraisal Date",
      size: 140,
      minSize: 120,
      cell: ({ row }) => (
        <span style={{ whiteSpace: "nowrap" }}>{fmtDate(row.original.APPRAISAL_DOC_DATE)}</span>
      ),
    });

    // ── 3. Period No ──
    cols.push({
      id: "PERIOD_NUMBER",
      accessorFn: (r) => formatPeriodDisplay(r.PERIOD_NUMBER),
      header: "Period No",
      size: 150,
      minSize: 110,
      cell: ({ row }) => {
        const periodNumber = text(row.original.PERIOD_NUMBER);
        if (!periodNumber) return <span style={{ color: "#9ca3af" }}>—</span>;
        return (
          <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>
            {formatPeriodDisplay(periodNumber)}
          </span>
        );
      },
    });

    // ── 4. Employee ──
    cols.push({
      id: "EMPLOYEE_CODE",
      accessorFn: (r) => employeeLabel(r),
      header: "Employee",
      size: 340,
      minSize: 220,
      cell: ({ row }) => (
        <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>
          {text(row.original.EMPLOYEE_CODE)} - {text(row.original.EMPLOYEE_NAME)}
        </span>
      ),
    });

    // ── 5. Designation ──
    cols.push({
      id: "DESG_NAME",
      accessorFn: (r) => desgLabel(r),
      header: "Designation",
      size: 260,
      minSize: 180,
      cell: ({ row }) => (
        <span style={{ whiteSpace: "nowrap" }}>{desgLabel(row.original) || "—"}</span>
      ),
    });

    // ── 6. Period Range ──
    cols.push({
      id: "PERIOD_RANGE",
      accessorFn: (r) => `${fmtRangeDate(r.APPRAISAL_FROM)} ${fmtRangeDate(r.APPRAISAL_TO)}`.trim(),
      header: "Period Range",
      size: 260,
      minSize: 200,
      cell: ({ row }) => {
        const from = fmtRangeDate(row.original.APPRAISAL_FROM);
        const to = fmtRangeDate(row.original.APPRAISAL_TO);
        if (!from && !to) return <span style={{ color: "#9ca3af" }}>—</span>;
        return (
          <span style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>
            <span style={{ color: "#0c0e11" }}>{from || "—"}</span>
            <span style={{ color: "#9ca3af", margin: "0 4px" }}>→</span>
            <span style={{ color: "#0a0d11" }}>{to || "—"}</span>
          </span>
        );
      },
    });

    // ── 7. Avg Score ──
    cols.push({
      id: "FINAL_RATING",
      accessorFn: (r) => getAvg(r, activeWeightage) || "",
      header: "Avg Score",
      size: 120,
      minSize: 100,
      cell: ({ row }) => {
        const avg = getAvg(row.original, activeWeightage);
        if (!avg) return <span style={{ color: "#9ca3af" }}>—</span>;
        let bg = "#f3f4f6", color = "#374151", border = "#d1d5db";
        if (avg >= 5) { bg = "#f6fefe"; color = "#35a074"; border = "#6bff15"; }
        else if (avg >= 4) { bg = "#e6f9f0"; color = "#4d4dc1"; border = "#b7ebd4"; }
        else if (avg >= 3) { bg = "#f3e8fe"; color = "#6b21a8"; border = "#d9b3f5"; }
        else if (avg >= 2) { bg = "#fff4e5"; color = "#0e9289"; border = "#fcd38a"; }
        else if (avg >= 1) { bg = "#fdecea"; color = "#d80a0a"; border = "#f5b3b3"; }
        return (
          <span style={{
            display: "inline-block", padding: "2px 12px", borderRadius: "999px",
            fontSize: "0.75rem", fontWeight: 700, background: bg, color, border: `1px solid ${border}`
          }}>
            {avg}
          </span>
        );
      },
    });

    // ── 8. Next Action By ──
    cols.push({
      id: "NEXT_ACTION_BY",
      accessorFn: (r) => nextActionLabel(r),
      header: "Next Action By",
      size: 280,
      minSize: 200,
      cell: ({ row }) => {
        const label = nextActionLabel(row.original);
        if (!label) return <span style={{ color: "#9ca3af" }}>—</span>;
        return <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{label}</span>;
      },
    });

    // ── 9. Reason ──
    cols.push({
      id: "SENT_BACK_REASON",
      accessorFn: (r) => {
        const i = reasonInfo(r);
        return `${i.reason} ${i.by}`.trim();
      },
      header: "Reason",
      size: 380,
      minSize: 350,
      cell: ({ row }) => {
        const info = reasonInfo(row.original);
        if (!info.reason) return <span style={{ color: "#9ca3af" }}>—</span>;
        const byColor = info.kind === "REJECTED" ? "#b91c1c" : "#6b21a8";

        const rawCode = info.kind === "REJECTED"
          ? text(row.original.REJECT_BY)
          : text(row.original.SENT_BACK_BY);
        const rawName = info.kind === "REJECTED"
          ? text(row.original.REJECT_BY_NAME)
          : text(row.original.SENT_BACK_BY_NAME);
        const byDisplay = resolveByLabel(rawCode, rawName) || info.by;

        return (
          <div
            style={{ lineHeight: 1.35 }}
            title={byDisplay ? `${info.reason} (${info.byLabel} ${byDisplay})` : info.reason}
          >
            <div style={{
              fontSize: "0.8rem", fontWeight: 500,
              whiteSpace: "normal", wordBreak: "break-word",
            }}>
              {info.reason}
            </div>
            {byDisplay && (
              <div style={{
                fontSize: "10px", fontWeight: 600, color: byColor, marginTop: "2px",
                whiteSpace: "normal", wordBreak: "break-word",
              }}>
                {info.byLabel}: {byDisplay}
              </div>
            )}
          </div>
        );
      },
    });

    // ── 10. Status ──
    cols.push({
      id: "LAST_ACTION",
      accessorFn: (r) => statusLabelOf(r),
      header: "Status",
      size: 160,
      minSize: 130,
      cell: ({ row }) => {
        const status = getStatusMeta(
          text(row.original.LAST_ACTION),
          Number(row.original.FLOW_LEVEL_RUNNING || 0),
          text(row.original.STATUS)
        );
        return (
          <span style={{
            display: "inline-block", padding: "2px 10px", borderRadius: "999px",
            fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap",
            background: status.bg, color: status.color, border: `1px solid ${status.border}`
          }}>
            {status.label || "—"}
          </span>
        );
      },
    });

    // ── 11. Actions ──
    cols.push({
      id: "actions",
      header: "Actions",
      size: 110,
      minSize: 90,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {activeTab === 0 && (
            <Button size="sm" variant="ghost" title="Edit"
              onClick={(e) => { e.stopPropagation(); openAppraisalTabsPage(row.original, "edit"); }}
              style={{ padding: "4px", height: "28px", width: "28px" }}>
              <Edit2 size={14} />
            </Button>
          )}
          <Button size="sm" variant="ghost" title="View"
            onClick={(e) => { e.stopPropagation(); openAppraisalTabsPage(row.original, "view"); }}
            style={{ padding: "4px", height: "28px", width: "28px" }}>
            <Eye size={14} />
          </Button>
        </div>
      ),
    });

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSelection, selectedRows, visibleIds, selectedVisibleIds, activeWeightage, activeTab, empNameByCode]);

  // HR users ke liye: search box ke right side me 3 dropdown
  const empTypeLookupRows = useMemo(
    () => [
      { CODE: "ALL", LABEL: `All Employees (${rows.length})` },
      { CODE: "NON-MANAGER", LABEL: `Non Manager (${typeCounts["NON-MANAGER"]})` },
      { CODE: "MANAGER", LABEL: `Manager (${typeCounts.MANAGER})` },
    ] as LookupRow[],
    [rows.length, typeCounts]
  );
  const divLookupRows = useMemo(
    () => [
      { CODE: "ALL", LABEL: "All Divisions" },
      ...divOptions.map(([k, label]) => ({ CODE: k, LABEL: label })),
    ] as LookupRow[],
    [divOptions]
  );
  const deptLookupRows = useMemo(
    () => [
      { CODE: "ALL", LABEL: "All Departments" },
      ...deptOptions.map(([k, label]) => ({ CODE: k, LABEL: label })),
    ] as LookupRow[],
    [deptOptions]
  );

  const labelOf = (list: LookupRow[], code: string) =>
    text(list.find((r) => text(r.CODE) === code)?.LABEL);

  const filterToolbar = isHRApprover ? (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <div style={{ width: "190px" }}>
        <LookupField
          compact
          label="Employee Type"
          value={empType}
          displayValue={labelOf(empTypeLookupRows, empType)}
          placeholder="Employee type"
          columns={[{ field: "LABEL", header: "Employee Type" }]}
          valueField="CODE"
          displayFields={["LABEL"]}
          popoverWidth={260}
          loadOptions={async () => empTypeLookupRows}
          onChange={(v) => setEmpType((v || "ALL") as EmpType)}
        />
      </div>

      <div style={{ width: "230px" }}>
        <LookupField
          compact
          label="Division"
          value={divFilter}
          displayValue={labelOf(divLookupRows, divFilter)}
          placeholder="Division"
          columns={[{ field: "LABEL", header: "Division" }]}
          valueField="CODE"
          displayFields={["LABEL"]}
          popoverWidth={340}
          loadOptions={async () => divLookupRows}
          onChange={(v) => { setDivFilter(v || "ALL"); setDeptFilter("ALL"); }}
        />
      </div>

      <div style={{ width: "230px" }}>
        <LookupField
          compact
          label="Department"
          value={deptFilter}
          displayValue={labelOf(deptLookupRows, deptFilter)}
          placeholder="Department"
          columns={[{ field: "LABEL", header: "Department" }]}
          valueField="CODE"
          displayFields={["LABEL"]}
          popoverWidth={340}
          loadOptions={async () => deptLookupRows}
          onChange={(v) => setDeptFilter(v || "ALL")}
        />
      </div>
    </div>
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* ── Navbar right side — Complete Appraisal Button ── */}
      

      {/* Tabs UI */}
      <div
        style={{
          display: "flex", alignItems: "flex-end", gap: "4px",
          padding: "3px 7px 0 8px", overflowX: "auto",
          background: "#f1f5f9",
          border: "1px solid #e2e8f0",
          borderBottom: "1px solid #cbd5e1",
          borderRadius: "10px",
        }}
      >
        {TAB_LABELS.map((label, index) => {
          const active = activeTab === index;
          return (
            <button
              key={TAB_STATUS[index]}
              type="button"
              onClick={() => handleTabChange(index)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "10px 16px", fontSize: "12.5px",
                fontWeight: active ? 700 : 500,
                color: active ? "#082A89" : "#475569",
                background: active ? "#e8f0ff" : "transparent",
                border: "none",
                borderBottom: active ? "2px solid #082A89" : "2px solid transparent",
                borderRadius: "10px 10px 0 0",
                cursor: "pointer", whiteSpace: "nowrap",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#e8eef7"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <span>{label}</span>
              <span
                style={{
                  minWidth: "20px", padding: "1px 7px", borderRadius: "999px",
                  fontSize: "11px", fontWeight: 700, textAlign: "center",
                  background: active ? "#082A89" : "#cbd5e1",
                  color: active ? "#fff" : "#334155",
                }}
              >
                {tabCounts[index] ?? 0}
              </span>
            </button>
          );
        })}
        {isEligibleToNotify && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingBottom: "4px", paddingLeft: "12px" }}>
            <Button
              size="sm"
              onClick={handleNotifyNextLevel}
              disabled={notifying}
              style={{ background: "#082a89", opacity: notifying ? 0.85 : 1, whiteSpace: "nowrap" }}
            >
              <CheckCircle size={14} />
              {notifying ? "Sending..." : "Complete Appraisal"}
            </Button>
          </div>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <DataTable
          columns={columns}
          data={visibleRows}
          title={`${visibleRows.length.toLocaleString()} Records`}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search appraisal..."
          toolbar={filterToolbar}
          enableExport={false}
          loading={loading}
          loaderType="circle"
          height={550}
          minWidth={1800}
          density="compact"
          enablePagination
          pageSize={100}
          enableColumnFilters={true}
          getRowId={(row) => text(row.APPRAISAL_DOC_NO)}
        />
        {approving && (
          <div
            style={{
              position: "absolute", inset: 0, zIndex: 40,
              background: "rgba(255,255,255,0.55)", cursor: "wait",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 18px", background: "#fff", borderRadius: "10px",
              border: "1px solid #b3caf5", boxShadow: "0 4px 16px rgba(8,42,137,0.15)",
              fontSize: "13px", fontWeight: 600, color: "#082A89",
            }}>
              <Loader2 size={18} className="animate-spin" />
              Approving {approveProgress.done}/{approveProgress.total}...
            </div>
          </div>
        )}
      </div>

      {showSelection && selectedVisibleIds.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "5px" }}>
          {approving && (
            <span style={{ fontSize: "12px", color: "#6b7280" }}>
              Please wait, do not close this page...
            </span>
          )}
          <Button
            onClick={handleBulkApprove}
            disabled={approving}
            style={{ background: "#082a89", opacity: approving ? 0.85 : 1, cursor: approving ? "wait" : "pointer" }}
          >
            {approving ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Approving... {approveProgress.done}/{approveProgress.total}
              </>
            ) : (
              <>
                <CheckCircle size={15} /> Approve Selected ({selectedVisibleIds.length})
              </>
            )}
          </Button>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        wide
        title={viewMode ? "View Appraisal" : editMode ? "Edit Appraisal" : "Appraisal Details"}
        description="View or edit appraisal details"
        onClose={closeDialog}
        footer={
          <>
            <Button variant="outline" onClick={closeDialog}>Close</Button>
            {editMode && (
              <Button disabled={saving} onClick={saveRecord}>
                <Save size={15} /> {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </>
        }
      >
        <form className="grid max-w-full gap-4 overflow-hidden">
          <Card className="max-w-full overflow-hidden">
            <CardHeader className="border-b border-border">
              <div>
                <p className="eyebrow">Details</p>
                <h2 className="m-0 text-sm font-semibold">Appraisal Information</h2>
              </div>
            </CardHeader>
            <CardContent className="grid max-w-full grid-cols-1 gap-3 pt-4 lg:grid-cols-2">
              <div className="field">
                <span>Appraisal Doc No</span>
                <Input disabled value={formData.APPRAISAL_DOC_NO || "Auto generated"} onChange={() => { }} />
              </div>
              <div className="field">
                <span>Appraisal Doc Date</span>
                <Input disabled={viewMode} type="date" value={formData.APPRAISAL_DOC_DATE}
                  onChange={(e) => updateFormField("APPRAISAL_DOC_DATE", e.target.value)} />
              </div>
              <div className="min-w-0 lg:col-span-2">
                <div className="field">
                  <span>Employee <strong className="text-destructive">*</strong></span>
                  <LookupField
                    compact
                    disabled={viewMode}
                    label="Employee"
                    value={formData.EMPLOYEE_CODE}
                    displayValue={formData.EMPLOYEE_NAME
                      ? `${formData.EMPLOYEE_CODE} - ${formData.EMPLOYEE_NAME}`
                      : formData.EMPLOYEE_CODE}
                    placeholder="Search employee"
                    columns={[
                      { field: "EMPLOYEE_ID", header: "Employee ID" },
                      { field: "EMPLOYEE_CODE", header: "Employee Code" },
                      { field: "RPT_NAME", header: "Employee Name" },
                      { field: "EMP_NAME", header: "Employee Name" },
                    ]}
                    valueField="EMPLOYEE_CODE"
                    displayFields={["EMPLOYEE_CODE", "RPT_NAME", "EMP_NAME"]}
                    loadOptions={async () => employees as LookupRow[]}
                    onChange={handleEmployeeChange}
                  />
                </div>
              </div>
              <div className="field">
                <span>Period Number <strong className="text-destructive">*</strong></span>
                <select
                  disabled={viewMode}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors disabled:opacity-60"
                  value={formData.PERIOD_NUMBER}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                >
                  <option value="">Select Period</option>
                  {periods.map((period, idx) => (
                    <option key={idx} value={text(period.PERIOD_NUMBER)}>
                      {formatPeriodDisplay(period.PERIOD_NUMBER)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span>Appraisal From</span>
                <Input disabled type="date" value={formData.APPRAISAL_FROM} onChange={() => { }} />
              </div>
              <div className="field">
                <span>Appraisal To</span>
                <Input disabled type="date" value={formData.APPRAISAL_TO} onChange={() => { }} />
              </div>
            </CardContent>
          </Card>
        </form>
      </Dialog>
    </div>
  );
};

export default MyTaskPage;