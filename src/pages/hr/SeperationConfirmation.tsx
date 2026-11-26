// src/pages/hr/SeparationConfirmationPage.tsx
//
// HR Employee – Confirm Separation (port of the legacy PowerBuilder screen).
// Same design flow as SeparationInitiationPage:
//  • Freight-style header with status pill + "CODE - NAME" subtitle, Close / Clear / Save
//  • Compact SectionPanel blocks using the in-house Input / Select / LookupField
//  • toast feedback
//  • Employee lookup comes from the proc API (getDynamicLookup → MSEHR_TRANSACTIONS_MS_HR_EMPLOYEE),
//    the same source the Employee Master list uses
//  • Everything else goes through executeWmsInboundSql (raw SQL)
//
// Flow:
//  Company (read-only) → Division → Department → Section → Employee
//  • blank Division / Department / Section behaves like '%' in the lookups
//  • picking a lower level back-fills the parent
//  • Employee lookup only lists employees whose separation was already initiated
//  • picking an Employee loads HR_EMP_SEPARATIONS (company + employee id) + the final settlement grid
//  • Save updates the confirmation fields on the same HR_EMP_SEPARATIONS row

import { useCallback, useState } from "react";
import { BadgeCheck, ClipboardList, FileText, RotateCcw, Save, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LookupField } from "../../components/ui/LookupField";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/Table";
import { useToast } from "../../components/ui/AlertToast";
import { executeWmsInboundSql } from "../../api/wms"; // adjust path to wherever this actually lives
import { getDynamicLookup, getLookupValue } from "../../api/lookups";
import { useAuth } from "../../state/AuthContext";
import { useNavigate } from "react-router-dom";

/* ─────────────────────────────────────────────────────────────
   Types / constants
   ───────────────────────────────────────────────────────────── */
type Row = Record<string, unknown>;

type ConfirmForm = {
  payMonth: string;
  payYear: string;
  initiationDate: string; // SEPARATION_INITIATION_DATE (read-only here)
  noticeStart: string; // read-only here
  noticeEnd: string; // read-only here
  separationReason: string; // description, read-only here
  separationReasonCode: string; // passed to the draft settlement procedure
  finalSettlementDone: string; // FINAL_SETTLEMENT_DONE, passed to the draft settlement procedure
  lcCancelled: "Y" | "N";
  lcCancelledDate: string;
  visaCancelled: "Y" | "N";
  visaCancelledDate: string;
  statusFlag: string;
  settlementStatus: string;
  actSeparationDate: string;
  settlementDate: string; // "Expected Settlement Date"
  remarks: string;
};

// Column names from HR_SEPERATION_CONFIRMATION_PAGE
const COL_LC_DATE = "LABOUR_CARD_CANCEL_DATE";
const COL_VISA_DATE = "VISA_CANCELLED_DATE";

/** Proc API (dynamic lookup) that returns the employee master list — same one useEmployeeList uses. */
const EMPLOYEE_LOOKUP_PARAMETER = "MSEHR_TRANSACTIONS_MS_HR_EMPLOYEE";

/**
 * The proc returns ALL employees. When true, the Employee lookup is narrowed to employees that
 * already have a HR_EMP_SEPARATIONS row (separation initiated). Set to false to list everyone;
 * picking a non-initiated employee still shows "Separation is not initiated for this employee".
 */
const ONLY_SEPARATION_INITIATED = false;

// TODO: confirm against prod: SELECT DISTINCT STATUS_FLAG / SETTLEMENT_STATUS FROM HR_EMP_SEPARATIONS
const STATUS_OPTIONS = [
  { code: "N", label: "New" },
  { code: "A", label: "Approved" },
  { code: "C", label: "Cancelled" },
];

const SETTLEMENT_STATUS_OPTIONS = [
  { code: "N", label: "N - Pending" },
  { code: "Y", label: "Y - Settled" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
].map((label, i) => ({ code: String(i + 1).padStart(2, "0"), label }));

const emptyForm = (): ConfirmForm => ({
  payMonth: "",
  payYear: "",
  initiationDate: "",
  noticeStart: "",
  noticeEnd: "",
  separationReason: "",
  separationReasonCode: "",
  finalSettlementDone: "N",
  lcCancelled: "N",
  lcCancelledDate: "",
  visaCancelled: "N",
  visaCancelledDate: "",
  statusFlag: "N",
  settlementStatus: "N",
  actSeparationDate: "",
  settlementDate: "",
  remarks: "",
});

/* ── small helpers ── */
const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function sqlEscape(value: string) {
  return value.replace(/'/g, "''");
}
const sqlStr = (v: string) => (v ? `'${sqlEscape(v)}'` : "NULL");
const sqlDate = (v: string) => (v ? `TO_DATE('${sqlEscape(v)}','YYYY-MM-DD')` : "NULL");

/** yyyy-mm-dd → dd-mm-yyyy (what the draft procedure's TO_DATE expects) */
const toDmy = (ymd: string) => {
  const [y, m, d] = ymd.split("-");
  return y && m && d ? `${d}-${m}-${y}` : "";
};

/**
 * Calls an "API parameter" (e.g. PROC_SEPARATION_DRAFT_SETTLEMENT) and returns its P_SQL_OUT string.
 * TODO: wire this ONE function to whatever client you already use for API-parameter calls
 * (vals map to P_VAL1S1..P_VAL1S8, login id goes as P_LOGINID).
 */
async function callApiParameter(apiName: string, vals: Record<string, string>): Promise<string> {
  void vals;
  throw new Error(`callApiParameter is not wired yet (${apiName})`);
}

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

/** Upper-cases every key so the proc's row (employee_code, rpt_name, …) matches the lookup columns. */
const upperKeys = (row: Row): Row => {
  const out: Row = {};
  Object.keys(row).forEach((k) => {
    out[k.toUpperCase()] = row[k];
  });
  return out;
};

/** "00763" and "763" are the same employee id (leading zeros differ between tables). */
const normId = (v: string) => v.trim().replace(/^0+(?=\d)/, "");

const str = (row: Row, key: string) => (row[key] == null ? "" : String(row[key]).trim());

/** Cascade filter. If the proc does not return that column at all, the filter is skipped. */
const matchesLevel = (row: Row, key: string, selected: string) =>
  !selected || !(key in row) || str(row, key) === selected.trim();

/* ── queries ── */
function buildSeparationQuery(companyCode: string, employeeId: string) {
  return `
    SELECT
      s."PAY_MONTH", s."PAY_YEAR",
      TO_CHAR(s."SEPARATION_INITIATION_DATE",'YYYY-MM-DD') AS "SEPARATION_INITIATION_DATE",
      TO_CHAR(s."NOTICE_PERIOD_START_DATE",'YYYY-MM-DD') AS "NOTICE_PERIOD_START_DATE",
      TO_CHAR(s."NOTICE_PERIOD_END_DATE",'YYYY-MM-DD') AS "NOTICE_PERIOD_END_DATE",
      TO_CHAR(s."ACT_SEPARATION_DATE",'YYYY-MM-DD') AS "ACT_SEPARATION_DATE",
      TO_CHAR(s."SETTLEMENT_DATE",'YYYY-MM-DD') AS "SETTLEMENT_DATE",
      TO_CHAR(s."${COL_LC_DATE}",'YYYY-MM-DD') AS "LC_CANCELLED_DATE",
      TO_CHAR(s."${COL_VISA_DATE}",'YYYY-MM-DD') AS "VISA_CANCELLED_DATE",
      s."LABOUR_CARD_CANCELLED", s."VISA_CANCELLED",
      s."SETTLEMENT_STATUS", s."STATUS_FLAG", s."REMARKS", s."SEPARATION_REASON", s."FINAL_SETTLEMENT_DONE",
      (SELECT r."SEP_REASON_DESC" FROM "MS_HR_SEPARATION_REASONS" r
        WHERE r."COMPANY_CODE" = s."COMPANY_CODE"
          AND r."SEP_REASON_CODE" = s."SEPARATION_REASON"
          AND ROWNUM = 1) AS "SEP_REASON_DESC"
    FROM "HR_EMP_SEPARATIONS" s
    WHERE s."COMPANY_CODE" = '${sqlEscape(companyCode)}'
      AND s."EMPLOYEE_ID" = '${sqlEscape(employeeId)}'
  `;
}

/** Employee Final Settlement grid (HR_EMP_FINAL_SETTLEMENT by company + employee). */
function buildFinalSettlementQuery(companyCode: string, employeeId: string) {
  return `
    SELECT
      f."DOC_NO",
      TO_CHAR(f."DOC_DATE",'DD/MM/YYYY') AS "DOC_DATE",
      TO_CHAR(f."JOIN_DATE",'DD/MM/YYYY') AS "JOIN_DATE",
      TO_CHAR(f."SEPARATION_DATE",'DD/MM/YYYY') AS "SEPARATION_DATE",
      f."ACCRUAL_TYPE", f."SETTLEMENT_UNITS", f."SETTLEMENT_AMOUNT", f."SETTLED_STATUS"
    FROM "HR_EMP_FINAL_SETTLEMENT" f
    WHERE f."COMPANY_CODE" = '${sqlEscape(companyCode)}'
      AND f."EMPLOYEE_ID" = '${sqlEscape(employeeId)}'
    ORDER BY f."DOC_DATE", f."DOC_NO"
  `;
}

function buildUpdateQuery(companyCode: string, employeeId: string, loginId: string, f: ConfirmForm) {
  return `
    UPDATE "HR_EMP_SEPARATIONS"
    SET "PAY_MONTH" = ${sqlStr(f.payMonth)},
        "PAY_YEAR" = ${sqlStr(f.payYear)},
        "STATUS_FLAG" = ${sqlStr(f.statusFlag)},
        "SETTLEMENT_STATUS" = ${sqlStr(f.settlementStatus)},
        "ACT_SEPARATION_DATE" = ${sqlDate(f.actSeparationDate)},
        "SETTLEMENT_DATE" = ${sqlDate(f.settlementDate)},
        "LABOUR_CARD_CANCELLED" = ${sqlStr(f.lcCancelled)},
        "${COL_LC_DATE}" = ${sqlDate(f.lcCancelledDate)},
        "VISA_CANCELLED" = ${sqlStr(f.visaCancelled)},
        "${COL_VISA_DATE}" = ${sqlDate(f.visaCancelledDate)},
        "REMARKS" = ${sqlStr(f.remarks)},
        "USER_ID" = ${sqlStr(loginId)},
        "USER_DT" = SYSDATE
    WHERE "COMPANY_CODE" = '${sqlEscape(companyCode)}'
      AND "EMPLOYEE_ID" = '${sqlEscape(employeeId)}'
  `;
}

function mapRowToForm(row: Row): ConfirmForm {
  return {
    payMonth: pick(row, "PAY_MONTH").padStart(2, "0"),
    payYear: pick(row, "PAY_YEAR"),
    initiationDate: pick(row, "SEPARATION_INITIATION_DATE"),
    noticeStart: pick(row, "NOTICE_PERIOD_START_DATE"),
    noticeEnd: pick(row, "NOTICE_PERIOD_END_DATE"),
    separationReason: pick(row, "SEP_REASON_DESC") || pick(row, "SEPARATION_REASON"),
    separationReasonCode: pick(row, "SEPARATION_REASON"),
    finalSettlementDone: pick(row, "FINAL_SETTLEMENT_DONE") || "N",
    lcCancelled: pick(row, "LABOUR_CARD_CANCELLED") === "Y" ? "Y" : "N",
    lcCancelledDate: pick(row, "LC_CANCELLED_DATE"),
    visaCancelled: pick(row, "VISA_CANCELLED") === "Y" ? "Y" : "N",
    visaCancelledDate: pick(row, "VISA_CANCELLED_DATE"),
    statusFlag: pick(row, "STATUS_FLAG") || "N",
    settlementStatus: pick(row, "SETTLEMENT_STATUS") || "N",
    actSeparationDate: pick(row, "ACT_SEPARATION_DATE"),
    settlementDate: pick(row, "SETTLEMENT_DATE"),
    remarks: pick(row, "REMARKS"),
  };
}

/* ─────────────────────────────────────────────────────────────
   Compact building blocks (same as Separation Initiation)
   ───────────────────────────────────────────────────────────── */
function SectionPanel({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`freight-panel overflow-hidden rounded-md border bg-background shadow-sm ${className ?? ""}`}
    >
      <div className="freight-panel-title flex items-center gap-2 border-b bg-muted/35 px-2.5 py-1.5">
        <span className="freight-section-icon">
          <Icon size={14} />
        </span>
        <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
      </div>
      <div className="freight-panel-body px-2.5 py-2">{children}</div>
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
    <label className={`freight-field-label group flex min-w-0 flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-[11px] font-medium text-muted-foreground transition-colors group-focus-within:text-primary">
        {label}
        {required && <strong className="ml-0.5 font-bold text-destructive"> *</strong>}
      </span>
      {children}
    </label>
  );
}

/** Dense grid used by every panel: 1 → 2 → 5 columns, tight gaps. */
const GRID = "grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-5";

const YES_NO = [
  { code: "Y", label: "Yes" },
  { code: "N", label: "No" },
];

/* ─────────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────────── */
export default function SeparationConfirmationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";
  const companyName = (user as { company_name?: string } | null)?.company_name || companyCode;

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

  // separation record + settlement grid
  const [form, setForm] = useState<ConfirmForm>(emptyForm());
  const [settlementRows, setSettlementRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const navigate = useNavigate();
  const busy = loadingRecord || saving || drafting;
  const hasEmployee = Boolean(empId);

  const setField = <K extends keyof ConfirmForm>(key: K, value: ConfirmForm[K]) => {
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
    setSettlementRows([]);
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

  /* ── lookups ── */
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

  /** Employee ids that already have a separation row (null = could not load → don't narrow the list). */
  const loadInitiatedIds = useCallback(async (): Promise<Set<string> | null> => {
    try {
      const rows = await runSql(`
        SELECT DISTINCT s.EMPLOYEE_ID
        FROM HR_EMP_SEPARATIONS s
        WHERE s.COMPANY_CODE = '${sqlEscape(companyCode)}'
      `);
      return new Set(rows.map((r) => normId(pick(r, "EMPLOYEE_ID"))));
    } catch {
      return null;
    }
  }, [companyCode]);

  // Employee lookup → proc API (same source as the Employee Master list), narrowed client-side
  const loadEmployees = useCallback(
    async (query?: string) => {
      const [response, initiated] = await Promise.all([
        getDynamicLookup({
          parameter: EMPLOYEE_LOOKUP_PARAMETER,
          loginid,
          code1: companyCode,
        }),
        ONLY_SEPARATION_INITIATED ? loadInitiatedIds() : Promise.resolve(null),
      ]);

      const term = (query ?? "").trim().toLowerCase();

      return ((Array.isArray(response) ? response : []) as Row[])
        .map(upperKeys)
        .filter((r) => {
          if (!matchesLevel(r, "DIV_CODE", divCode)) return false;
          if (!matchesLevel(r, "DEPT_CODE", deptCode)) return false;
          if (!matchesLevel(r, "SECTION_CODE", sectCode)) return false;
          if (initiated && !initiated.has(normId(str(r, "EMPLOYEE_ID")))) return false;
          if (term) {
            const hay = `${str(r, "EMPLOYEE_CODE")} ${str(r, "RPT_NAME")} ${str(r, "ALTERNATE_ID")}`.toLowerCase();
            if (!hay.includes(term)) return false;
          }
          return true;
        })
        .sort((a, b) => str(a, "EMPLOYEE_CODE").localeCompare(str(b, "EMPLOYEE_CODE"), undefined, { numeric: true }));
    },
    [companyCode, loginid, divCode, deptCode, sectCode, loadInitiatedIds],
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

  const loadSettlement = useCallback(
    async (employeeId: string) => {
      try {
        setSettlementRows(await runSql(buildFinalSettlementQuery(companyCode, employeeId)));
      } catch {
        setSettlementRows([]);
        toast.warning("Unable to load final settlement details");
      }
    },
    [companyCode, toast],
  );

  /* ── employee pick → back-fill Division/Dept/Section, load separation record + final settlement ── */
  const handleEmployeeChange = async (value: string, row?: Parameters<typeof getLookupValue>[0] | null) => {
    if (!row) {
      resetEmployee();
      return;
    }

    const pickedEmpId = lv(row, "EMPLOYEE_ID");

    setEmpCode(value);
    setEmpId(pickedEmpId);
    setEmpDisplay(lv(row, "RPT_NAME"));

    setLoadingRecord(true);
    try {
      // The proc row may not carry the org hierarchy → fetch it from the employee view when missing
      // (Draft Figure needs the Division code).
      let div = { code: lv(row, "DIV_CODE"), name: lv(row, "DIV_NAME") };
      let dept = { code: lv(row, "DEPT_CODE"), name: lv(row, "DEPT_NAME") };
      let sect = { code: lv(row, "SECTION_CODE"), name: lv(row, "SECTION_NAME") };

      if (!div.code || !dept.code || !sect.code) {
        try {
          const extra = (
            await runSql(`
              SELECT DIV_CODE, DIV_NAME, DEPT_CODE, DEPT_NAME, SECTION_CODE, SECTION_NAME
              FROM VW_HR_EMP_MASTER
              WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
                AND EMPLOYEE_ID = '${sqlEscape(pickedEmpId)}'
                AND ROWNUM = 1
            `)
          )[0];
          if (extra) {
            div = { code: div.code || pick(extra, "DIV_CODE"), name: div.name || pick(extra, "DIV_NAME") };
            dept = { code: dept.code || pick(extra, "DEPT_CODE"), name: dept.name || pick(extra, "DEPT_NAME") };
            sect = {
              code: sect.code || pick(extra, "SECTION_CODE"),
              name: sect.name || pick(extra, "SECTION_NAME"),
            };
          }
        } catch {
          /* hierarchy is a convenience; the separation load below still decides success */
        }
      }

      setDivCode(div.code);
      setDivDisplay(div.name);
      setDeptCode(dept.code);
      setDeptDisplay(dept.name);
      setSectCode(sect.code);
      setSectDisplay(sect.name);

      const rows = await runSql(buildSeparationQuery(companyCode, pickedEmpId));
      if (rows.length === 0) {
        toast.warning("Separation is not initiated for this employee");
        resetEmployee();
        return;
      }
      setForm(mapRowToForm(rows[0]));
      setDirty(false);

      await loadSettlement(pickedEmpId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load separation details");
      resetEmployee();
    } finally {
      setLoadingRecord(false);
    }
  };

  /* ── cancelled flags: toggling to Yes defaults the date to today, No clears it ── */
  const handleLcChange = (value: "Y" | "N") => {
    setForm((prev) => ({
      ...prev,
      lcCancelled: value,
      lcCancelledDate: value === "Y" ? prev.lcCancelledDate || toYmd(new Date()) : "",
    }));
    setDirty(true);
  };

  const handleVisaChange = (value: "Y" | "N") => {
    setForm((prev) => ({
      ...prev,
      visaCancelled: value,
      visaCancelledDate: value === "Y" ? prev.visaCancelledDate || toYmd(new Date()) : "",
    }));
    setDirty(true);
  };

  /* ── save ── */
  const handleSave = useCallback(async () => {
    if (!empId) {
      toast.warning("Select an Employee");
      return;
    }
    if (!form.payMonth) {
      toast.warning("Pay Month is required");
      return;
    }
    if (!form.payYear) {
      toast.warning("Pay Year is required");
      return;
    }
    if (!form.statusFlag) {
      toast.warning("Status is required");
      return;
    }
    if (!form.settlementStatus) {
      toast.warning("Settlement Status is required");
      return;
    }
    if (!form.actSeparationDate) {
      toast.warning("Actual Separation Date is required");
      return;
    }
    if (!form.settlementDate) {
      toast.warning("Expected Settlement Date is required");
      return;
    }

    setSaving(true);
    try {
      await executeWmsInboundSql(buildUpdateQuery(companyCode, empId, loginid, form));
      toast.success("Separation confirmed successfully");
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save separation");
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empId, form, companyCode, loginid]);

  /* ── PB action buttons ── */
  // Draft Figure → PROC_SEPARATION_DRAFT_SETTLEMENT (P_VAL1S1..S8), then refresh the settlement grid
  const handleDraftFigure = async () => {
    if (!empId) return;
    if (!form.actSeparationDate) {
      toast.warning("Actual Separation Date is required");
      return;
    }
    setDrafting(true);
    try {
      const out = await callApiParameter("PROC_SEPARATION_DRAFT_SETTLEMENT", {
        val1s1: companyCode,
        val1s2: divCode,
        val1s3: empId,
        val1s4: form.finalSettlementDone || "N",
        val1s5: toDmy(form.actSeparationDate),
        val1s6: toDmy(form.noticeStart),
        val1s7: toDmy(form.noticeEnd),
        val1s8: form.separationReasonCode,
      });
      // P_SQL_OUT = "STATUS = <n>\nMESSAGE = <text>"
      const message = /MESSAGE\s*=\s*([\s\S]*)$/.exec(out)?.[1]?.trim() || out;
      toast.info(message || "Draft settlement completed");
      await loadSettlement(empId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to draft settlement");
    } finally {
      setDrafting(false);
    }
  };

  // TODO: wire to the procedure the PB "Process Separation" button calls.

  const handleProcessSeparation = () => {
    toast.info("Process Separation is not wired yet");
  };

  /* ─────────────────────────────────────────────────────────── */
  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Header (title + status pill + CODE - NAME) */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <BadgeCheck size={15} />
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">Separation Confirmation</h1>
            {hasEmployee && (
              <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] font-medium leading-tight text-amber-700">
                Confirming
              </span>
            )}
            {hasEmployee && (
              <span className="truncate text-sm text-muted-foreground">
                {empCode} - {empDisplay}
              </span>
            )}
            {dirty && (
              <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-2 py-0 text-[10.5px] font-medium leading-tight text-blue-700">
                Unsaved changes
              </span>
            )}
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

      {/* Employee criteria — one row of 5 */}
      <SectionPanel title="Employee" icon={Users}>
        <div className={GRID}>
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

          <Field label="Employee" required>
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
        <div className={GRID}>
          <Field label="Pay Month" required>
            <Select
              value={form.payMonth}
              disabled={!hasEmployee}
              onChange={(e) => setField("payMonth", e.target.value)}
            >
              <option value="">Select month</option>
              {MONTHS.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Pay Year" required>
            <Input
              type="number"
              min={2000}
              value={form.payYear}
              disabled={!hasEmployee}
              onChange={(e) => setField("payYear", e.target.value)}
            />
          </Field>

          <Field label="Separation Initiation Date">
            <Input type="date" value={form.initiationDate} readOnly />
          </Field>

          <Field label="Notice Start">
            <Input type="date" value={form.noticeStart} readOnly />
          </Field>

          <Field label="Notice End">
            <Input type="date" value={form.noticeEnd} readOnly />
          </Field>

          <Field label="Separation Reason">
            <Input type="text" value={form.separationReason} readOnly />
          </Field>

          <Field label="Labour Card Cancelled">
            <Select
              value={form.lcCancelled}
              disabled={!hasEmployee}
              onChange={(e) => handleLcChange(e.target.value === "Y" ? "Y" : "N")}
            >
              {YES_NO.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Labour Card Cancelled Date">
            <Input
              type="date"
              value={form.lcCancelledDate}
              disabled={!hasEmployee || form.lcCancelled !== "Y"}
              onChange={(e) => setField("lcCancelledDate", e.target.value)}
            />
          </Field>

          <Field label="Visa Cancelled">
            <Select
              value={form.visaCancelled}
              disabled={!hasEmployee}
              onChange={(e) => handleVisaChange(e.target.value === "Y" ? "Y" : "N")}
            >
              {YES_NO.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Visa Cancelled Date">
            <Input
              type="date"
              value={form.visaCancelledDate}
              disabled={!hasEmployee || form.visaCancelled !== "Y"}
              onChange={(e) => setField("visaCancelledDate", e.target.value)}
            />
          </Field>
        </div>
      </SectionPanel>

      {/* Confirmation: status, settlement, remarks, actions */}
      <SectionPanel title="Confirmation & Remarks" icon={FileText}>
        <div className={GRID}>
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

          <Field label="Settlement Status" required>
            <Select
              value={form.settlementStatus}
              disabled={!hasEmployee}
              onChange={(e) => setField("settlementStatus", e.target.value)}
            >
              {SETTLEMENT_STATUS_OPTIONS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Actual Separation Date" required>
            <Input
              type="date"
              value={form.actSeparationDate}
              disabled={!hasEmployee}
              onChange={(e) => setField("actSeparationDate", e.target.value)}
            />
          </Field>

          <Field label="Expected Settlement Date" required>
            <Input
              type="date"
              value={form.settlementDate}
              disabled={!hasEmployee}
              onChange={(e) => setField("settlementDate", e.target.value)}
            />
          </Field>

          <div className="flex items-end justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleDraftFigure()}
              disabled={busy || !hasEmployee || dirty}
            >
              {drafting ? "Drafting" : "Draft Figure"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleProcessSeparation}
              disabled={busy || !hasEmployee || dirty}
            >
              Process Separation
            </Button>
          </div>

          <Field label="Remarks" className="sm:col-span-2 lg:col-span-5">
            <textarea
              rows={2}
              value={form.remarks}
              disabled={!hasEmployee}
              onChange={(e) => setField("remarks", e.target.value)}
              className="w-full resize-none rounded-md border bg-background px-2 py-1.5 text-[12px] text-foreground outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
            />
          </Field>
        </div>
      </SectionPanel>

      {/* Employee Final Settlement grid */}
      <SectionPanel title="Employee Final Settlement" icon={FileText}>
        <div className="max-h-[320px] min-h-[140px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-secondary/70">
              <TableRow>
                <TableHead className="text-[10.5px] uppercase">Doc No</TableHead>
                <TableHead className="text-[10.5px] uppercase">Doc Date</TableHead>
                <TableHead className="text-[10.5px] uppercase">Join Date</TableHead>
                <TableHead className="text-[10.5px] uppercase">Separation Date</TableHead>
                <TableHead className="text-[10.5px] uppercase">Accrual Type</TableHead>
                <TableHead className="text-right text-[10.5px] uppercase">Settlement Units</TableHead>
                <TableHead className="text-right text-[10.5px] uppercase">Settlement Amount</TableHead>
                <TableHead className="text-[10.5px] uppercase">Settled Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingRecord ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-[120px] text-center align-middle text-[12px] text-muted-foreground">
                    Loading settlement…
                  </TableCell>
                </TableRow>
              ) : !hasEmployee ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-[120px] text-center align-middle text-[12px] text-muted-foreground">
                    Select an employee to view final settlement.
                  </TableCell>
                </TableRow>
              ) : settlementRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-[120px] text-center align-middle text-[12px] text-muted-foreground">
                    No final settlement records found.
                  </TableCell>
                </TableRow>
              ) : (
                settlementRows.map((r, i) => (
                  <TableRow key={`${pick(r, "DOC_NO")}-${i}`}>
                    <TableCell className="text-[11.5px] text-foreground">{pick(r, "DOC_NO")}</TableCell>
                    <TableCell className="text-[11.5px] text-foreground">{pick(r, "DOC_DATE")}</TableCell>
                    <TableCell className="text-[11.5px] text-foreground">{pick(r, "JOIN_DATE")}</TableCell>
                    <TableCell className="text-[11.5px] text-foreground">{pick(r, "SEPARATION_DATE")}</TableCell>
                    <TableCell className="text-[11.5px] text-foreground">{pick(r, "ACCRUAL_TYPE")}</TableCell>
                    <TableCell className="text-right text-[11.5px] text-foreground">{pick(r, "SETTLEMENT_UNITS")}</TableCell>
                    <TableCell className="text-right text-[11.5px] font-semibold text-foreground">
                      {Number(pick(r, "SETTLEMENT_AMOUNT") || 0).toFixed(3)}
                    </TableCell>
                    <TableCell className="text-[11.5px] text-foreground">{pick(r, "SETTLED_STATUS")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SectionPanel>
    </section>
  );
}