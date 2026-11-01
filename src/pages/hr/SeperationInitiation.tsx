// src/pages/hr/SeparationInitiationPage.tsx
//
// HR Employee – Separation Initiation (port of the legacy PowerBuilder screen).
// Design / code modelled on HolidayCalendarPage:
//  • Freight-style header with Clear / Save
//  • SectionPanel blocks using the in-house Input / Select / LookupField
//  • toast feedback
//  • ALL data access goes through executeWmsInboundSql (raw SQL), no dedicated endpoint
//
// Flow (same as the PB dropdown script):
//  Company (read-only) → Division → Department → Section → Employee
//  • blank Division / Department / Section behaves like '%' in the lookups
//  • picking a lower level back-fills the parent (Department → Division, Section → Dept + Div)
//  • picking an Employee loads HR_EMP_SEPARATIONS (company + employee id);
//    no row = new record with Request Date / Notice Start defaulted to today
//  • Pay Month / Year are system-derived (see fetchPayMonthYear)
//  • Separation Reason lookup is blocked until an Employee is chosen (uof_chk_criteria)

import { useCallback, useState } from "react";
import { ClipboardList, RotateCcw, Save, UserMinus, Users, X} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LookupField } from "../../components/ui/LookupField";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useToast } from "../../components/ui/AlertToast";
import { executeWmsInboundSql } from "../../api/wms"; // adjust path to wherever this actually lives
import { getLookupValue } from "../../api/lookups";
import { useAuth } from "../../state/AuthContext";
import { useNavigate } from "react-router-dom";
/* ─────────────────────────────────────────────────────────────
   Types / constants
   ───────────────────────────────────────────────────────────── */
type Row = Record<string, unknown>;

type SeparationForm = {
  requestDate: string; // SEPARATION_INITIATION_DATE (yyyy-mm-dd)
  payMonth: string;
  payYear: string;
  separationReason: string; // SEPARATION_REASON (code)
  separationReasonDisplay: string;
  reasonCategory: string;
  inNoticePeriod: "Y" | "N";
  noticePeriod: string; // days
  noticeStart: string;
  noticeEnd: string;
  settlementDate: string; // "Settlement Due Date"
  actSeparationDate: string;
  remarks: string;
  statusFlag: string;
};

// TODO: confirm against prod: SELECT DISTINCT REASON_CATEGORY / STATUS_FLAG FROM HR_EMP_SEPARATIONS
const REASON_CATEGORIES = [
  { code: "RESIGNATION", label: "Resignation" },
  { code: "TERMINATION", label: "Termination" },
  { code: "RETIREMENT", label: "Retirement" },
  { code: "END_OF_CONTRACT", label: "End of Contract" },
  { code: "OTHER", label: "Other" },
];

const STATUS_OPTIONS = [
  { code: "N", label: "New" },
  { code: "A", label: "Approved" },
  { code: "C", label: "Cancelled" },
];

const emptyForm = (): SeparationForm => ({
  requestDate: "",
  payMonth: "",
  payYear: "",
  separationReason: "",
  separationReasonDisplay: "",
  reasonCategory: "",
  inNoticePeriod: "Y",
  noticePeriod: "",
  noticeStart: "",
  noticeEnd: "",
  settlementDate: "",
  actSeparationDate: "",
  remarks: "",
  statusFlag: "N",
});

/* ── small helpers ── */
const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function addDays(ymd: string, days: number) {
  if (!ymd || !Number.isFinite(days)) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return "";
  return toYmd(new Date(y, m - 1, d + days));
}

function sqlEscape(value: string) {
  return value.replace(/'/g, "''");
}
const sqlStr = (v: string) => (v ? `'${sqlEscape(v)}'` : "NULL");
const sqlDate = (v: string) => (v ? `TO_DATE('${sqlEscape(v)}','YYYY-MM-DD')` : "NULL");
const sqlNum = (v: string) => (v !== "" && Number.isFinite(Number(v)) ? String(Number(v)) : "NULL");

const pick = (row: Row | undefined, key: string) => {
  if (!row) return "";
  const v = row[key] ?? row[key.toLowerCase()];
  return v == null ? "" : String(v);
};

const lv = (row: Parameters<typeof getLookupValue>[0], key: string) =>
  String(getLookupValue(row, key) ?? "");

async function runSql(sql: string): Promise<Row[]> {
  const res = await executeWmsInboundSql(sql);
  return Array.isArray(res) ? (res as Row[]) : [];
}

/** Blank / null criteria behave like '%' in the lookups (same as the PB script). */
const likeValue = (v: string) => (v && v.trim() ? sqlEscape(v.trim()) : "%");

/* ── queries ── */
function buildSeparationQuery(companyCode: string, employeeId: string) {
  return `
    SELECT
      s."COMPANY_CODE", s."EMPLOYEE_ID", s."PAY_MONTH", s."PAY_YEAR",
      TO_CHAR(s."SEPARATION_INITIATION_DATE",'YYYY-MM-DD') AS "SEPARATION_INITIATION_DATE",
      s."IN_NOTICE_PERIOD",
      TO_CHAR(s."NOTICE_PERIOD_START_DATE",'YYYY-MM-DD') AS "NOTICE_PERIOD_START_DATE",
      TO_CHAR(s."NOTICE_PERIOD_END_DATE",'YYYY-MM-DD') AS "NOTICE_PERIOD_END_DATE",
      TO_CHAR(s."ACT_SEPARATION_DATE",'YYYY-MM-DD') AS "ACT_SEPARATION_DATE",
      s."REMARKS", s."SETTLEMENT_STATUS", s."USER_ID", s."USER_DT",
      s."NOTICE_PERIOD", s."STATUS_FLAG", s."VISA_CANCELLED", s."FINAL_SETTLEMENT_DONE",
      TO_CHAR(s."SETTLEMENT_DATE",'YYYY-MM-DD') AS "SETTLEMENT_DATE",
      s."SEPARATION_REASON", s."LABOUR_CARD_CANCELLED", s."REASON_CATEGORY",
      (SELECT r."SEP_REASON_DESC" FROM "MS_HR_SEPARATION_REASONS" r
        WHERE r."COMPANY_CODE" = s."COMPANY_CODE"
          AND r."SEP_REASON_CODE" = s."SEPARATION_REASON"
          AND ROWNUM = 1) AS "SEP_REASON_DESC"
    FROM "HR_EMP_SEPARATIONS" s
    WHERE s."COMPANY_CODE" = '${sqlEscape(companyCode)}'
      AND s."EMPLOYEE_ID" = '${sqlEscape(employeeId)}'
  `;
}

/**
 * Stand-in for PB uof_set_paymonthyear(): takes the division's current payroll date.
 * TODO: swap for the real "separation base setup" query if it lives elsewhere.
 * Returns null when the setup is missing.
 */
async function fetchPayMonthYear(companyCode: string, divCode: string) {
  const rows = await runSql(`
    SELECT TO_CHAR("PAYROLL_DATE",'MM') AS PAY_MONTH, TO_CHAR("PAYROLL_DATE",'YYYY') AS PAY_YEAR
    FROM "MS_HR_DIVISION"
    WHERE "COMPANY_CODE" = '${sqlEscape(companyCode)}'
      AND "DIV_CODE" = '${sqlEscape(divCode)}'
      AND "PAYROLL_DATE" IS NOT NULL
  `);
  if (rows.length === 0) return null;
  return { payMonth: pick(rows[0], "PAY_MONTH"), payYear: pick(rows[0], "PAY_YEAR") };
}

function buildInsertQuery(companyCode: string, employeeId: string, loginId: string, f: SeparationForm) {
  // Visa / labour card / settlement flags default to 'N' on a new initiation.
  return `
    INSERT INTO "HR_EMP_SEPARATIONS" (
      "COMPANY_CODE","EMPLOYEE_ID","PAY_MONTH","PAY_YEAR","SEPARATION_INITIATION_DATE",
      "IN_NOTICE_PERIOD","NOTICE_PERIOD_START_DATE","NOTICE_PERIOD_END_DATE","ACT_SEPARATION_DATE",
      "REMARKS","SETTLEMENT_STATUS","USER_ID","USER_DT","NOTICE_PERIOD","STATUS_FLAG",
      "VISA_CANCELLED","FINAL_SETTLEMENT_DONE","SETTLEMENT_DATE","SEPARATION_REASON",
      "LABOUR_CARD_CANCELLED","REASON_CATEGORY"
    ) VALUES (
      '${sqlEscape(companyCode)}', '${sqlEscape(employeeId)}', ${sqlStr(f.payMonth)}, ${sqlStr(f.payYear)},
      ${sqlDate(f.requestDate)},
      ${sqlStr(f.inNoticePeriod)}, ${sqlDate(f.noticeStart)}, ${sqlDate(f.noticeEnd)}, ${sqlDate(f.actSeparationDate)},
      ${sqlStr(f.remarks)}, 'N', ${sqlStr(loginId)}, SYSDATE, ${sqlNum(f.noticePeriod)}, ${sqlStr(f.statusFlag)},
      'N', 'N', ${sqlDate(f.settlementDate)}, ${sqlStr(f.separationReason)},
      'N', ${sqlStr(f.reasonCategory)}
    )
  `;
}

function buildUpdateQuery(companyCode: string, employeeId: string, loginId: string, f: SeparationForm) {
  return `
    UPDATE "HR_EMP_SEPARATIONS"
    SET "SEPARATION_INITIATION_DATE" = ${sqlDate(f.requestDate)},
        "IN_NOTICE_PERIOD" = ${sqlStr(f.inNoticePeriod)},
        "NOTICE_PERIOD" = ${sqlNum(f.noticePeriod)},
        "NOTICE_PERIOD_START_DATE" = ${sqlDate(f.noticeStart)},
        "NOTICE_PERIOD_END_DATE" = ${sqlDate(f.noticeEnd)},
        "SETTLEMENT_DATE" = ${sqlDate(f.settlementDate)},
        "ACT_SEPARATION_DATE" = ${sqlDate(f.actSeparationDate)},
        "SEPARATION_REASON" = ${sqlStr(f.separationReason)},
        "REASON_CATEGORY" = ${sqlStr(f.reasonCategory)},
        "REMARKS" = ${sqlStr(f.remarks)},
        "STATUS_FLAG" = ${sqlStr(f.statusFlag)},
        "USER_ID" = ${sqlStr(loginId)},
        "USER_DT" = SYSDATE
    WHERE "COMPANY_CODE" = '${sqlEscape(companyCode)}'
      AND "EMPLOYEE_ID" = '${sqlEscape(employeeId)}'
  `;
}

function mapRowToForm(row: Row): SeparationForm {
  return {
    requestDate: pick(row, "SEPARATION_INITIATION_DATE"),
    payMonth: pick(row, "PAY_MONTH"),
    payYear: pick(row, "PAY_YEAR"),
    separationReason: pick(row, "SEPARATION_REASON"),
    separationReasonDisplay: pick(row, "SEP_REASON_DESC"),
    reasonCategory: pick(row, "REASON_CATEGORY"),
    inNoticePeriod: pick(row, "IN_NOTICE_PERIOD") === "N" ? "N" : "Y",
    noticePeriod: pick(row, "NOTICE_PERIOD"),
    noticeStart: pick(row, "NOTICE_PERIOD_START_DATE"),
    noticeEnd: pick(row, "NOTICE_PERIOD_END_DATE"),
    settlementDate: pick(row, "SETTLEMENT_DATE"),
    actSeparationDate: pick(row, "ACT_SEPARATION_DATE"),
    remarks: pick(row, "REMARKS"),
    statusFlag: pick(row, "STATUS_FLAG") || "N",
  };
}

/* ─────────────────────────────────────────────────────────────
   Freight building blocks (same as Holiday Calendar / Grade / Product pages)
   ───────────────────────────────────────────────────────────── */
function SectionPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
          </div>
        </div>
      </div>
      <div className="freight-panel-body p-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`freight-field-label group flex flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
        {label}
        {required && <strong className="text-destructive ml-0.5 font-bold"> *</strong>}
      </span>
      {children}
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────────── */
export default function SeparationInitiationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";
  const companyName =
    (user as { company_name?: string } | null)?.company_name || companyCode;

  // criteria (top block)
  const [divCode, setDivCode] = useState("");
  const [divDisplay, setDivDisplay] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptDisplay, setDeptDisplay] = useState("");
  const [sectCode, setSectCode] = useState("");
  const [sectDisplay, setSectDisplay] = useState("");
  const [empCode, setEmpCode] = useState("");
  const [empId, setEmpId] = useState("");
  const [empDisplay, setEmpDisplay] = useState("");

  // separation record (bottom blocks)
  const [form, setForm] = useState<SeparationForm>(emptyForm());
  const [isNew, setIsNew] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const busy = loadingRecord || saving;
  const hasEmployee = Boolean(empId);

  const setField = <K extends keyof SeparationForm>(key: K, value: SeparationForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  const handleClose = () => {
    if (dirty && !window.confirm("You have unsaved changes. Close anyway?")) return;
    navigate("/workspace/hcm/hcm"); // HR dashboard
  };
  /* ── reset helpers ── */
  const resetRecord = useCallback(() => {
    setForm(emptyForm());
    setIsNew(true);
    setDirty(false);
  }, []);

  const resetEmployee = useCallback(() => {
    setEmpCode("");
    setEmpId("");
    setEmpDisplay("");
    resetRecord();
  }, [resetRecord]);

  const handleClear = () => {
    setDivCode("");
    setDivDisplay("");
    setDeptCode("");
    setDeptDisplay("");
    setSectCode("");
    setSectDisplay("");
    resetEmployee();
  };

  /* ── lookups (all raw SQL) ── */
  const loadDivisions = useCallback(
    async (query?: string) => {
      const term = query
        ? `AND (UPPER(DIV_NAME) LIKE UPPER('%${sqlEscape(query)}%') OR DIV_CODE LIKE '%${sqlEscape(query)}%')`
        : "";
      return runSql(`
        SELECT DIV_CODE, DIV_NAME, DIV_SHORT_NAME
        FROM MS_HR_DIVISION
        WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ${term}
        ORDER BY DIV_CODE
      `);
    },
    [companyCode],
  );

  const loadDepartments = useCallback(
    async (query?: string) => {
      const term = query
        ? `AND (UPPER(x.DEPT_NAME) LIKE UPPER('%${sqlEscape(query)}%') OR x.DEPT_CODE LIKE '%${sqlEscape(query)}%')`
        : "";
      return runSql(`
        SELECT x.DEPT_CODE, x.DEPT_NAME, x.DEPT_SHORT_NAME, x.DIV_CODE,
               (SELECT d.DIV_NAME FROM MS_HR_DIVISION d
                 WHERE d.COMPANY_CODE = x.COMPANY_CODE AND d.DIV_CODE = x.DIV_CODE AND ROWNUM = 1) AS DIV_NAME
        FROM MS_HR_DEPARTMENT x
        WHERE x.COMPANY_CODE = '${sqlEscape(companyCode)}'
          AND x.DIV_CODE LIKE '${likeValue(divCode)}' ${term}
        ORDER BY x.DEPT_CODE
      `);
    },
    [companyCode, divCode],
  );

  const loadSections = useCallback(
    async (query?: string) => {
      const term = query
        ? `AND (UPPER(x.SECTION_NAME) LIKE UPPER('%${sqlEscape(query)}%') OR x.SECTION_CODE LIKE '%${sqlEscape(query)}%')`
        : "";
      return runSql(`
        SELECT x.SECTION_CODE, x.SECTION_NAME, x.SECTION_SHORT_NAME, x.DIV_CODE, x.DEPT_CODE,
               (SELECT d.DIV_NAME FROM MS_HR_DIVISION d
                 WHERE d.COMPANY_CODE = x.COMPANY_CODE AND d.DIV_CODE = x.DIV_CODE AND ROWNUM = 1) AS DIV_NAME,
               (SELECT p.DEPT_NAME FROM MS_HR_DEPARTMENT p
                 WHERE p.COMPANY_CODE = x.COMPANY_CODE AND p.DIV_CODE = x.DIV_CODE
                   AND p.DEPT_CODE = x.DEPT_CODE AND ROWNUM = 1) AS DEPT_NAME
        FROM MS_HR_SECTION x
        WHERE x.COMPANY_CODE = '${sqlEscape(companyCode)}'
          AND x.DIV_CODE LIKE '${likeValue(divCode)}'
          AND x.DEPT_CODE LIKE '${likeValue(deptCode)}' ${term}
        ORDER BY x.SECTION_CODE
      `);
    },
    [companyCode, divCode, deptCode],
  );

  const loadEmployees = useCallback(
    async (query?: string) => {
      const term = query
        ? `AND (EMPLOYEE_CODE LIKE '%${sqlEscape(query)}%' OR UPPER(RPT_NAME) LIKE UPPER('%${sqlEscape(query)}%'))`
        : "";
      return runSql(`
        SELECT * FROM (
          SELECT EMPLOYEE_CODE, ALTERNATE_ID, RPT_NAME, COMP_NAME, DIV_NAME, DEPT_NAME, SECTION_NAME,
                 COMPANY_CODE, DIV_CODE, DEPT_CODE, SECTION_CODE, EMPLOYEE_ID
          FROM VW_HR_EMP_MASTER
          WHERE emp_status <> 'S'
            AND COMPANY_CODE = '${sqlEscape(companyCode)}'
            AND DIV_CODE LIKE '${likeValue(divCode)}'
            AND DEPT_CODE LIKE '${likeValue(deptCode)}'
            AND SECTION_CODE LIKE '${likeValue(sectCode)}' ${term}
          ORDER BY COMPANY_CODE, EMPLOYEE_CODE
        ) WHERE ROWNUM <= 200
      `);
    },
    [companyCode, divCode, deptCode, sectCode],
  );

  const loadReasons = useCallback(
    async (query?: string) => {
      // uof_chk_criteria: employee must be chosen first
      if (!empId) {
        toast.warning("Select an Employee first");
        return [];
      }
      const term = query
        ? `AND (UPPER(SEP_REASON_DESC) LIKE UPPER('%${sqlEscape(query)}%') OR SEP_REASON_CODE LIKE '%${sqlEscape(query)}%')`
        : "";
      return runSql(`
        SELECT SEP_REASON_CODE, SEP_REASON_DESC, SEP_REASON_SHORT_DESC
        FROM MS_HR_SEPARATION_REASONS
        WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ${term}
        ORDER BY SEP_REASON_CODE
      `);
    },
    [companyCode, empId, toast],
  );

  /* ── cascade handlers ── */
  const handleDivisionChange = (value: string, row?: Parameters<typeof getLookupValue>[0] | null) => {
    setDivCode(value);
    setDivDisplay(row ? lv(row, "DIV_NAME") : "");
    setDeptCode("");
    setDeptDisplay("");
    setSectCode("");
    setSectDisplay("");
    resetEmployee();
  };

  const handleDepartmentChange = (value: string, row?: Parameters<typeof getLookupValue>[0] | null) => {
    setDeptCode(value);
    setDeptDisplay(row ? lv(row, "DEPT_NAME") : "");
    setSectCode("");
    setSectDisplay("");
    // blank Division → back-fill from the picked department
    if (row && !divCode) {
      setDivCode(lv(row, "DIV_CODE"));
      setDivDisplay(lv(row, "DIV_NAME"));
    }
    resetEmployee();
  };

  const handleSectionChange = (value: string, row?: Parameters<typeof getLookupValue>[0] | null) => {
    setSectCode(value);
    setSectDisplay(row ? lv(row, "SECTION_NAME") : "");
    if (row && !divCode) {
      setDivCode(lv(row, "DIV_CODE"));
      setDivDisplay(lv(row, "DIV_NAME"));
    }
    if (row && !deptCode) {
      setDeptCode(lv(row, "DEPT_CODE"));
      setDeptDisplay(lv(row, "DEPT_NAME"));
    }
    resetEmployee();
  };

  /* ── employee pick → load separation record ── */
  const handleEmployeeChange = async (value: string, row?: Parameters<typeof getLookupValue>[0] | null) => {
    if (!row) {
      resetEmployee();
      return;
    }

    const pickedEmpId = lv(row, "EMPLOYEE_ID");
    const pickedDiv = lv(row, "DIV_CODE");

    setEmpCode(value);
    setEmpId(pickedEmpId);
    setEmpDisplay(lv(row, "RPT_NAME"));
    setDivCode(pickedDiv);
    setDivDisplay(lv(row, "DIV_NAME"));
    setDeptCode(lv(row, "DEPT_CODE"));
    setDeptDisplay(lv(row, "DEPT_NAME"));
    setSectCode(lv(row, "SECTION_CODE"));
    setSectDisplay(lv(row, "SECTION_NAME"));

    setLoadingRecord(true);
    try {
      const rows = await runSql(buildSeparationQuery(companyCode, pickedEmpId));
      if (rows.length > 0) {
        setForm(mapRowToForm(rows[0]));
        setIsNew(false);
      } else {
        const pay = await fetchPayMonthYear(companyCode, pickedDiv);
        if (!pay) {
          toast.error("Separation base setup missing. Contact Aware Team.");
          resetEmployee();
          return;
        }
        const today = toYmd(new Date());
        setForm({
          ...emptyForm(),
          requestDate: today,
          noticeStart: today,
          payMonth: pay.payMonth,
          payYear: pay.payYear,
        });
        setIsNew(true);
      }
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load separation details");
      resetEmployee();
    } finally {
      setLoadingRecord(false);
    }
  };

  /* ── notice period auto-calc: End = Start + Days ── */
  const handleNoticeDaysChange = (value: string) => {
    const days = Number(value);
    setForm((prev) => ({
      ...prev,
      noticePeriod: value,
      noticeEnd: value !== "" && prev.noticeStart ? addDays(prev.noticeStart, days) : prev.noticeEnd,
    }));
    setDirty(true);
  };

  const handleNoticeStartChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      noticeStart: value,
      noticeEnd: value && prev.noticePeriod !== "" ? addDays(value, Number(prev.noticePeriod)) : prev.noticeEnd,
    }));
    setDirty(true);
  };

  /* ── save ── */
  const handleSave = useCallback(async () => {
    if (!empId) {
      toast.warning("Select an Employee");
      return;
    }
    if (!form.requestDate) {
      toast.warning("Request Date is required");
      return;
    }
    // if (!form.separationReason) {
    //   toast.warning("Separation Reason is required");
    //   return;
    // }
    if (!form.reasonCategory) {
      toast.warning("Reason Category is required");
      return;
    }
    if (form.noticePeriod === "" || Number(form.noticePeriod) < 0) {
      toast.warning("Notice Period (Days) is required");
      return;
    }
    if (!form.statusFlag) {
      toast.warning("Status is required");
      return;
    }

    setSaving(true);
    try {
      const sql = isNew
        ? buildInsertQuery(companyCode, empId, loginid, form)
        : buildUpdateQuery(companyCode, empId, loginid, form);
      await executeWmsInboundSql(sql);
      toast.success(isNew ? "Separation initiated successfully" : "Separation updated successfully");
      setIsNew(false);
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save separation");
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empId, form, isNew, companyCode, loginid]);

  /* ─────────────────────────────────────────────────────────── */
  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Freight-style transaction header */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <UserMinus size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">Separation Initiation</h1>
              {hasEmployee && (
                <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-blue-700">
                  {isNew ? "New record" : "Existing record"}
                </span>
              )}
              {dirty && (
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  Unsaved changes
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
           <Button type="button" size="sm" variant="outline" onClick={handleClose} disabled={saving}>
            <X size={14} /> Close
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleClear} disabled={busy}>
            <RotateCcw size={14} /> Clear
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={busy || !hasEmployee || !dirty}>
            <Save size={14} /> {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      {/* Employee criteria */}
      <SectionPanel title="Employee" icon={Users}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Company" required>
            <Input type="text" value={companyName} readOnly />
          </Field>

          <Field label="Division" required>
            <LookupField
              compact
              label=""
              value={divCode}
              displayValue={divDisplay}
              columns={[
                { field: "DIV_CODE", header: "Code" },
                { field: "DIV_NAME", header: "Name" },
                { field: "DIV_SHORT_NAME", header: "Short Name" },
              ]}
              valueField="DIV_CODE"
              displayFields={["DIV_NAME"]}
              loadOptions={loadDivisions}
              onChange={handleDivisionChange}
            />
          </Field>

          <Field label="Department" required>
            <LookupField
              compact
              label=""
              value={deptCode}
              displayValue={deptDisplay}
              columns={[
                { field: "DEPT_CODE", header: "Code" },
                { field: "DEPT_NAME", header: "Name" },
                { field: "DEPT_SHORT_NAME", header: "Short Name" },
                { field: "DIV_CODE", header: "Div" },
              ]}
              valueField="DEPT_CODE"
              displayFields={["DEPT_NAME"]}
              loadOptions={loadDepartments}
              onChange={handleDepartmentChange}
            />
          </Field>

          <Field label="Section" required>
            <LookupField
              compact
              label=""
              value={sectCode}
              displayValue={sectDisplay}
              columns={[
                { field: "SECTION_CODE", header: "Code" },
                { field: "SECTION_NAME", header: "Name" },
                { field: "SECTION_SHORT_NAME", header: "Short Name" },
                { field: "DIV_CODE", header: "Div" },
                { field: "DEPT_CODE", header: "Dept" },
              ]}
              valueField="SECTION_CODE"
              displayFields={["SECTION_NAME"]}
              loadOptions={loadSections}
              onChange={handleSectionChange}
            />
          </Field>

          <Field label="Employee" required className="lg:col-span-2">
            <LookupField
              compact
              label=""
              value={empCode}
              displayValue={empDisplay}
              columns={[
                { field: "EMPLOYEE_CODE", header: "Code" },
                { field: "ALTERNATE_ID", header: "Alt ID" },
                { field: "RPT_NAME", header: "Name" },
                { field: "DIV_NAME", header: "Division" },
                { field: "DEPT_NAME", header: "Department" },
                { field: "SECTION_NAME", header: "Section" },
              ]}
              valueField="EMPLOYEE_CODE"
              displayFields={["RPT_NAME"]}
              loadOptions={loadEmployees}
              onChange={(value, row) => void handleEmployeeChange(value, row)}
            />
          </Field>
        </div>
      </SectionPanel>

      {/* Separation details */}
      <SectionPanel title="Separation Details" icon={ClipboardList}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Request Date" required>
            <Input
              type="date"
              value={form.requestDate}
              disabled={!hasEmployee}
              onChange={(e) => setField("requestDate", e.target.value)}
            />
          </Field>

          <Field label="Payroll Month">
            <Input type="text" value={form.payMonth} readOnly />
          </Field>

          <Field label="Payroll Year">
            <Input type="text" value={form.payYear} readOnly />
          </Field>

          <Field label="Reason Category" required>
            <Select
              value={form.reasonCategory}
              disabled={!hasEmployee}
              onChange={(e) => setField("reasonCategory", e.target.value)}
            >
              <option value="">Select category</option>
              {REASON_CATEGORIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Separation Reason" required className="sm:col-span-2">
            <LookupField
              compact
              label=""
              value={form.separationReason}
              displayValue={form.separationReasonDisplay}
              columns={[
                { field: "SEP_REASON_CODE", header: "Code" },
                { field: "SEP_REASON_DESC", header: "Description" },
                { field: "SEP_REASON_SHORT_DESC", header: "Short Desc" },
              ]}
              valueField="SEP_REASON_CODE"
              displayFields={["SEP_REASON_DESC"]}
              loadOptions={loadReasons}
              onChange={(value, row) => {
                setForm((prev) => ({
                  ...prev,
                  separationReason: value,
                  separationReasonDisplay: row ? lv(row, "SEP_REASON_DESC") : "",
                }));
                setDirty(true);
              }}
            />
          </Field>
        </div>
      </SectionPanel>

      {/* Notice period & remarks */}
      <SectionPanel title="Notice Period & Remarks" icon={ClipboardList}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="In Notice Period">
            <Select
              value={form.inNoticePeriod}
              disabled={!hasEmployee}
              onChange={(e) => setField("inNoticePeriod", e.target.value === "N" ? "N" : "Y")}
            >
              <option value="Y">Yes</option>
              <option value="N">No</option>
            </Select>
          </Field>

          <Field label="Notice Period (Days)" required>
            <Input
              type="number"
              min={0}
              value={form.noticePeriod}
              disabled={!hasEmployee}
              onChange={(e) => handleNoticeDaysChange(e.target.value)}
            />
          </Field>

          <Field label="Notice Period Start Date">
            <Input
              type="date"
              value={form.noticeStart}
              disabled={!hasEmployee}
              onChange={(e) => handleNoticeStartChange(e.target.value)}
            />
          </Field>

          <Field label="Notice Period End Date">
            <Input
              type="date"
              value={form.noticeEnd}
              disabled={!hasEmployee}
              onChange={(e) => setField("noticeEnd", e.target.value)}
            />
          </Field>

          <Field label="Settlement Due Date">
            <Input
              type="date"
              value={form.settlementDate}
              disabled={!hasEmployee}
              onChange={(e) => setField("settlementDate", e.target.value)}
            />
          </Field>

          <Field label="Actual Separation Date">
            <Input
              type="date"
              value={form.actSeparationDate}
              disabled={!hasEmployee}
              onChange={(e) => setField("actSeparationDate", e.target.value)}
            />
          </Field>

          <Field label="Status" required>
            <Select
              value={form.statusFlag}
              disabled={!hasEmployee}
              onChange={(e) => setField("statusFlag", e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Remarks" className="sm:col-span-2 lg:col-span-4">
            <textarea
              rows={3}
              value={form.remarks}
              disabled={!hasEmployee}
              onChange={(e) => setField("remarks", e.target.value)}
              className="w-full resize-y rounded-md border bg-background px-2 py-1.5 text-[12px] text-foreground outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
            />
          </Field>
        </div>
      </SectionPanel>
    </section>
  );
}