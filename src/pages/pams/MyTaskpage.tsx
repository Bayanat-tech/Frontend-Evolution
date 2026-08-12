import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../state/AuthContext";
import { pamsSelect, pamsDelete, pamsSave } from "../../api/pams";
import { CheckCircle, Eye, Edit2, X, Save } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { NoticeToast } from "../../components/ui/NoticeToast";
import type { ColumnDef } from "@tanstack/react-table";
import type { LookupRow } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { DataTable } from "../../components/ui/PamsDataTable";

// ─── Types ────────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;

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

interface HodBatch {
  PERIOD_NUMBER: string;
  READY_COUNT: number | string;
  PENDING_COUNT: number | string;
}

const TAB_STATUS = ["PENDING", "IN PROGRESS", "REJECTED", "SENT BACK", "APPROVED"] as const;
const TAB_LABELS = ["Pending", "In Progress", "Rejected", "Sent Back", "Closed"] as const;
const HR_APPROVERS = ["2021060535", "2010080001", "2018030473"];
// FLOW_LEVEL jispe HOD ke docs pahunchte hain jab HOD apna review complete kar leta hai (2 -> 3)
const HOD_READY_FLOW_LEVEL = 3;
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

function formatPeriodQuarter(row: Row): string {
  const dateValue = row.PERIOD_FROM_DATE;
  if (!dateValue) return text(row.PERIOD_NUMBER);
  const parsed = new Date(String(dateValue));
  if (isNaN(parsed.getTime())) return text(row.PERIOD_NUMBER);
  const quarter = Math.floor(parsed.getMonth() / 3) + 1;
  return `Q${quarter} ${parsed.getFullYear()}`;
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
  const [notice, setNotice] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
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
  const statusFilter = TAB_STATUS[activeTab];

  const [hodBatches, setHodBatches] = useState<HodBatch[]>([]);
  const [notifying, setNotifying] = useState<string | null>(null);

  const loadHodBatches = useCallback(async () => {
    try {
      const data = await pamsSelect({
        parameter: "hod_ready_batches",
        loginid, code1: companyCode,
      });
      setHodBatches((data as unknown as HodBatch[]) ?? []);
    } catch (error) {
      console.error("Error loading HOD batches:", error);
    }
  }, [loginid, companyCode]);

  useEffect(() => { void loadHodBatches(); }, [loadHodBatches]);

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

      const initSelected: Record<string, boolean> = {};
      normalizedData.forEach((row) => {
        initSelected[text(row.APPRAISAL_DOC_NO)] = false;
      });
      setSelectedRows(initSelected);
    } catch (err: unknown) {
      if (myRequestId !== fetchRequestId.current) return; // stale error, ignore
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to load data" });
    } finally {
      // Only clear loading spinner if we're still the latest request
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
    setLoading(true);
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
  }, [activeTab, cacheKey]);

  const openAppraisalTabsPage = (row: Row, mode: "view" | "edit" = "view") => {
    const docNo = text(row.APPRAISAL_DOC_NO);
    const employeeCode = text(row.EMPLOYEE_CODE);
    const employeeName = encodeURIComponent(text(row.EMPLOYEE_NAME));
    const designation = encodeURIComponent(text(row.DESG_NAME));
    const department = encodeURIComponent(text(row.DEPT_NAME));
    navigate(
      `/workspace/pams/appraisal/view/${docNo}?employee_code=${employeeCode}&employee_name=${employeeName}&designation=${designation}&department=${department}&mode=${mode}`,
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
    } catch (err: unknown) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to delete" });
    }
  };

  const handleBulkApprove = async () => {
    const ids = Object.entries(selectedRows).filter(([, v]) => v).map(([id]) => id);
    if (!ids.length) {
      setNotice({ type: "warning", message: "Please select at least one appraisal!" });
      return;
    }
    try {
      await pamsSelect({
        parameter: "proc_update_pams_doc_status_bulk", loginid,
        code1: companyCode, code2: ids.join(","), code3: "A", code4: "",
      });
      setNotice({ type: "success", message: "Appraisals approved successfully!" });
      setSelectedRows({});
      void fetchData(activeTab);
    } catch (err: unknown) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    }
  };

  const toggleSelect = (id: string, checked: boolean) =>
    setSelectedRows((prev) => ({ ...prev, [id]: checked }));

  const toggleSelectAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    rows.forEach((row) => { next[text(row.APPRAISAL_DOC_NO)] = checked; });
    setSelectedRows(next);
  };

  // flowLevel = jis level pe docs abhi khade hain (HOD ke liye ye hamesha 3 hai)
  const handleNotifyNextLevel = async (flowLevel: number, periodNumber: string) => {
    const key = `${flowLevel}-${periodNumber}`;
    setNotifying(key);
    try {
      const res = await pamsSelect({
        parameter: "notify_next_level_hod_bulk",
        loginid, code1: companyCode,
        code2: String(flowLevel - 1),   // p_flow_level jispe wo baitha tha (2 for HOD)
        code3: periodNumber,
      });
      const result = text((res as unknown as Row[])?.[0]?.P_RESULT);

      if (result === "SUCCESS") {
        toast.success(`Period ${periodNumber} has been sent to the next level for review.`);
      } else if (result?.startsWith("PENDING")) {
        const pendingCount = result.split(":")[1];
        toast.warning(`${pendingCount} employee appraisal(s) are still pending your review. Please complete all reviews before notifying the next level.`);
      } else if (result === "NOTHING_TO_NOTIFY") {
        toast.warning("There are no completed appraisals ready to notify at this time.");
      } else {
        toast.error(result || "Something went wrong while notifying the next level.");
      }

      void loadHodBatches();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to notify the next level. Please try again.");
    } finally {
      setNotifying(null);
    }
  };

  const columns = useMemo<ColumnDef<Row>[]>(() => {
    const cols: ColumnDef<Row>[] = [];

    cols.push({
      accessorKey: "APPRAISAL_DOC_NO",
      header: "Appraisal Doc No",
      size: 200,
      cell: ({ row }) => {
        const id = text(row.original.APPRAISAL_DOC_NO);
        if (!id) return null;
        return (
          <div
            onClick={(e) => {
              if ((e.target as HTMLElement).tagName !== "INPUT")
                openAppraisalTabsPage(row.original, "view");
            }}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              cursor: "pointer", whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis"
            }}
          >
            {isHRApprover && (
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
                cursor: "pointer", display: "inline-block", minWidth: 80
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

    cols.push({
      accessorKey: "APPRAISAL_DOC_DATE",
      header: "Appraisal Date",
      size: 110,
      cell: ({ row }) => fmtDate(row.original.APPRAISAL_DOC_DATE),
    });

    cols.push({
  accessorKey: "PERIOD_NUMBER",
  header: "Period No",
  size: 100,
  cell: ({ row }) =>
    formatPeriodQuarter({
      PERIOD_FROM_DATE: row.original.APPRAISAL_FROM,
      PERIOD_NUMBER: row.original.PERIOD_NUMBER,
    }) || "—",
});

    cols.push({
      accessorKey: "EMPLOYEE_CODE",
      header: "Employee",
      size: 280,
      cell: ({ row }) => (
        <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>
          {text(row.original.EMPLOYEE_CODE)} - {text(row.original.EMPLOYEE_NAME)}
        </span>
      ),
    });

    cols.push({
      accessorKey: "DESG_NAME",
      header: "Designation",
      size: 200,
      cell: ({ row }) => {
        const desgCode = text(row.original.DESG_CODE);
        const desgName = text(row.original.DESG_NAME);
        const desgLabel = desgCode && desgName ? `${desgCode} - ${desgName}` : desgCode || desgName || "—";
        return <span style={{ whiteSpace: "nowrap" }}>{desgLabel}</span>;
      },
    });

    cols.push({
      accessorKey: "PERIOD_RANGE",
      header: "Period Range",
      size: 210,
      cell: ({ row }) => {
        const fromDate = row.original.APPRAISAL_FROM;
        const toDate = row.original.APPRAISAL_TO;


        const formatDateRange = (dateVal: unknown) => {
          if (!dateVal) return null;


          let dateStr = String(dateVal);

          if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            return dateStr;
          }

          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return null;

          const day = String(d.getDate()).padStart(2, "0");
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const year = d.getFullYear();
          return `${day} ${getMonthAbbreviation(d.getMonth())} ${year}`;
        };

        const getMonthAbbreviation = (monthIndex: number) => {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return months[monthIndex];
        };

        const from = formatDateRange(fromDate);
        const to = formatDateRange(toDate);

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

    cols.push({
      accessorKey: "FINAL_RATING",
      header: "Avg Score",
      size: 110,
      cell: ({ row }) => {
        const taskScore = Number(row.original.TASK_TOTAL ?? row.original.task_total ?? 0);
        const charScore = Number(row.original.CHAR_TOTAL ?? row.original.char_total ?? 0);
        const avg = (taskScore > 0 || charScore > 0)
          ? computeFinalRating(taskScore, charScore, activeWeightage)
          : Math.round(Number(row.original.FINAL_RATING || 0));

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

    cols.push({
      accessorKey: "NEXT_ACTION_BY",
      header: "Next Action By",
      size: 190,
      cell: ({ row }) => {
        const code = text(row.original.NEXT_ACTION_BY);
        const name = text(row.original.NEXT_ACTION_BY_NAME);
        if (!code) return <span style={{ color: "#9ca3af" }}>—</span>;
        return <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{code}{name ? ` - ${name}` : ""}</span>;
      },
    });

    cols.push({
      accessorKey: "SENT_BACK_REASON",
      header: "Sent Back Remarks",
      size: 230,
      cell: ({ row }) => {
        const reason = text(row.original.SENT_BACK_REASON);
        const by = text(row.original.SENT_BACK_BY);
        if (!reason) return <span style={{ color: "#9ca3af" }}>—</span>;
        return (
          <div style={{ lineHeight: 1.4 }}>
            <div title={reason} style={{
              maxWidth: "210px", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.8rem", fontWeight: 500
            }}>
              {reason}
            </div>
            {by && <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: "2px" }}>by {by}</div>}
          </div>
        );
      },
    });

    cols.push({
      accessorKey: "LAST_ACTION",
      header: "Status",
      size: 140,
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

    cols.push({
      id: "actions",
      header: "Actions",
      size: 100,
      cell: ({ row }) => (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Button size="sm" variant="ghost" title="Edit"
            onClick={() => openEditDialog(row.original)}
            style={{ padding: "4px", height: "28px", width: "28px" }}>
            <Edit2 size={14} />
          </Button>
          <Button size="sm" variant="ghost" title="View"
            onClick={() => openViewDialog(row.original)}
            style={{ padding: "4px", height: "28px", width: "28px" }}>
            <Eye size={14} />
          </Button>
        </div>
      ),
    });

    return cols;
  }, [isHRApprover, selectedRows, activeWeightage]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#6b7280" }}>
        <a href="/dashboard" style={{ color: "#6b7280", textDecoration: "none" }}>Home</a>
        <span style={{ color: "#d1d5db" }}>/</span>
        <a href="/pams/masters" style={{ color: "#6b7280", textDecoration: "none" }}>Master</a>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ color: "#111827", fontWeight: 500 }}>Appraisal</span>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: "2px", borderBottom: "2px solid #e5e7eb" }}>
        {TAB_LABELS.map((label, index) => (
          <button
            key={index}
            onClick={() => handleTabChange(index)}
            style={{
              padding: "8px 20px", fontSize: "14px",
              fontWeight: activeTab === index ? 700 : 500,
              color: activeTab === index ? "#082A89" : "#6b7280",
              background: activeTab === index ? "#f0f4ff" : "transparent",
              border: "none",
              borderBottom: activeTab === index ? "2px solid #082A89" : "2px solid transparent",
              borderRadius: "8px 8px 0 0", cursor: "pointer",
              marginBottom: "-2px", whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Select All */}
      {isHRApprover && rows.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 4px" }}>
          <input
            type="checkbox"
            checked={rows.length > 0 && rows.every((row) => selectedRows[text(row.APPRAISAL_DOC_NO)])}
            onChange={(e) => toggleSelectAll(e.target.checked)}
            style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#082A89" }}
          />
          <span style={{ fontSize: "12px", color: "#6b7280" }}>
            Select All ({rows.length} records)
          </span>
        </div>
      )}

      {/* HOD — Notify Next Level batches */}
      {hodBatches
        .filter((b) => Number(b.PENDING_COUNT) === 0 && Number(b.READY_COUNT) > 0)
        .map((batch) => {
          const key = `${HOD_READY_FLOW_LEVEL}-${batch.PERIOD_NUMBER}`;
          return (
            <div key={batch.PERIOD_NUMBER} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", background: "#f0f4ff", border: "1px solid #b3caf5",
              borderRadius: "8px", marginBottom: "8px",
            }}>
              <span style={{ fontSize: "13px", color: "#082A89", fontWeight: 500 }}>
                Period {batch.PERIOD_NUMBER} — {Number(batch.READY_COUNT)} employees reviewed, ready for next level
              </span>
              <Button
                size="sm"
                disabled={notifying === key}
                onClick={() => handleNotifyNextLevel(HOD_READY_FLOW_LEVEL, batch.PERIOD_NUMBER)}
                style={{ background: "#082a89" }}
              >
                <CheckCircle size={14} /> {notifying === key ? "Sending..." : "Notify Next Reviewer"}
              </Button>
            </div>
          );
        })}

      <DataTable
        columns={columns}
        data={rows}
        title={`${rows.length.toLocaleString()} Records`}
        subtitle={`${statusFilter} Appraisals`}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search appraisal..."
        loading={loading}
        loaderType="circle" 
        height={550}
        minWidth={1300}
        density="compact"
        enablePagination
        pageSize={100}
        enableColumnFilters={true}
        getRowId={(row) => text(row.APPRAISAL_DOC_NO)}
      />

      {/* Bulk Approve */}
      {isHRApprover && Object.values(selectedRows).some(Boolean) && (
        <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={handleBulkApprove} style={{ background: "#082a89" }}>
            <CheckCircle size={15} /> Approve Selected ({Object.values(selectedRows).filter(Boolean).length})
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
            <Button variant="outline" onClick={closeDialog}><X size={15} /> Close</Button>
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
                      {text(period.PERIOD_NUMBER)}
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