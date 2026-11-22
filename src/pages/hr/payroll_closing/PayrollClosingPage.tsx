import { AlertTriangle, CalendarCheck, FileText, Lock } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { getDynamicLookup, type LookupRow } from "../../../api/lookups";
import { almsCommonProcedure } from "../../../api/alms"; // adjust path if needed
import { executeWmsInboundSql } from "../../../api/wms"; // adjust path if needed
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { Field, SectionPanel } from "../../../components/ui/Formblocks";
import { LookupField } from "../../../components/ui/LookupField";
import { useAuth } from "../../../state/AuthContext";

/* ================= CONSTANTS ================= */

const P_DIVISION = "HR_DROPDOWN_MS_DIVISION";
const PROC_PROCESS_PAYROLL_JV = "PROC_PROCESS_PAYROLL_JV";
const PROC_PROCESS_PAYROLL_MONTHEND = "PROC_PROCESS_PAYROLL_MONTHEND";

const DIVISION_COLUMNS = [
  { field: "div_code", header: "Division Code" },
  { field: "div_name", header: "Division Name" },
];

const NULLS = {
  code3: "NULL", code4: "NULL", code5: "NULL", code6: "NULL", code7: "NULL",
  code8: "NULL", code9: "NULL", code10: "NULL",
  number1: 0, number2: 0, number3: 0, number4: 0,
  date1: null, date2: null, date3: null, date4: null,
};

const CHECKLIST: string[] = [
  "Account JV Process has to run - JV Report",
  "All Divisions Payroll has to Close and Finalize Company",
  "Database Backups to be taken- History Reports",
  "Reports to be Verified and Printed - Payroll Statements",
  "Save Salary Register And Accrual Reports -PaySlip and Accrual Reports",
  "EMail Departments - Employees PaySlip",
];

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/* ================= HELPERS ================= */

function sqlEscape(value: string) {
  return value.replace(/'/g, "''");
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "OCT 2026" -> "31/10/2026" (last day of the payroll month). Falls back to today. */
function periodToDocDate(period: string): string {
  const [mon, yr] = period.trim().toUpperCase().split(/\s+/);
  const monthIdx = MONTHS.indexOf(mon);
  const year = Number(yr);
  if (monthIdx >= 0 && Number.isFinite(year)) {
    const lastDay = new Date(year, monthIdx + 1, 0).getDate();
    return `${pad2(lastDay)}/${pad2(monthIdx + 1)}/${year}`;
  }
  const now = new Date();
  return `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`;
}

/** Case-insensitive column read (Oracle usually returns UPPERCASE keys). */
function pick(row: Record<string, unknown> | undefined, key: string): unknown {
  if (!row) return undefined;
  const found = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
  return found ? row[found] : undefined;
}

/** Reads the latest result for this user from TR_PROCESS_ERROR. No trailing semicolon - runner rejects it. */
async function readProcessResult(loginid: string): Promise<{ status: number; message: string } | null> {
  const result = (await executeWmsInboundSql(
    `SELECT P_MESSAGE, P_STATUS FROM TR_PROCESS_ERROR WHERE USER_ID = '${sqlEscape(loginid)}'`,
  )) as Record<string, unknown>[];

  const first = Array.isArray(result) ? result[0] : undefined;
  if (!first) return null;

  return {
    status: Number(pick(first, "P_STATUS")),
    message: String(pick(first, "P_MESSAGE") ?? ""),
  };
}

/* ================= CONFIRM MODAL ================= */

type ConfirmOptions = {
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmState = ConfirmOptions & { resolve: (result: boolean) => void };

function ConfirmDialog({
  title,
  message,
  confirmText = "Yes",
  cancelText = "No",
  onResult,
}: ConfirmOptions & { onResult: (result: boolean) => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Default focus on Cancel (same as legacy MessageBox default = No), Esc cancels
  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onResult(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onResult]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onResult(false);
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="freight-ui-standard w-full max-w-md overflow-hidden rounded-md border bg-background shadow-xl"
      >
        <div className="flex items-center gap-2 border-b bg-muted/35 px-3 py-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-amber-50 text-amber-600">
            <AlertTriangle size={15} />
          </span>
          <h3 className="m-0 text-sm font-semibold text-foreground">{title}</h3>
        </div>

        <div className="px-4 py-4 text-sm leading-relaxed text-foreground">{message}</div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-3 py-2">
          <Button type="button" size="sm" variant="outline" data-autofocus onClick={() => onResult(false)}>
            {cancelText}
          </Button>
          <Button type="button" size="sm" onClick={() => onResult(true)}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Promise-based confirm: `if (!(await confirm({...}))) return;` — render `dialog` once in the page. */
function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...options, resolve });
      }),
    [],
  );

  const handleResult = useCallback(
    (result: boolean) => {
      state?.resolve(result);
      setState(null);
    },
    [state],
  );

  const dialog = state ? (
    <ConfirmDialog
      title={state.title}
      message={state.message}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      onResult={handleResult}
    />
  ) : null;

  return { confirm, dialog };
}

/* ================= PAGE ================= */

export function PayrollClosing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? ""; // company is hidden, taken from session

  const [divCode, setDivCode] = useState("");
  const [divName, setDivName] = useState("");
  const [finalize, setFinalize] = useState(false);
  const [processingJv, setProcessingJv] = useState(false);
  const [closing, setClosing] = useState(false);

  // TODO: replace with the real payroll period from the backend
  const [payrollPeriod] = useState("OCT 2026");

  const divisionReady = !!companyCode && !!divCode;
  const busy = processingJv || closing;

  const loadDivisions = useCallback(async (): Promise<LookupRow[]> => {
    const response = await getDynamicLookup({
      parameter: P_DIVISION, loginid, code1: companyCode, code2: "", ...NULLS,
    });
    return Array.isArray(response) ? (response as LookupRow[]) : [];
  }, [loginid, companyCode]);

  const handleProcessJv = async () => {
    if (!divisionReady) return;
    setProcessingJv(true);
    try {
      await almsCommonProcedure({
        parameter: PROC_PROCESS_PAYROLL_JV,
        val1s1: companyCode,                       // P_COMPANY_CODE
        val1s2: divCode,                           // P_DIV_CODE (backend does NVL(..., 'All'))
        val1s3: periodToDocDate(payrollPeriod),    // P_DOC_DATE (DD/MM/YYYY)
        loginid,                                   // P_USER_ID
      });

      const res = await readProcessResult(loginid);
      if (!res) {
        toast.error("JV process finished but no status was returned");
        return;
      }

      // 1 = success, anything else (-1) = fail
      if (res.status === 1) {
        toast.success(res.message || "JV processed successfully");
      } else {
        toast.error(res.message || "JV process failed");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to process JV");
    } finally {
      setProcessingJv(false);
    }
  };

  const handleClosePeriod = async () => {
    if (!divisionReady || !finalize) return;

    try {
      // Step 1: pending final settlements check
      const pending = (await executeWmsInboundSql(
        `SELECT COUNT(*) AS CNT
           FROM VW_HR_EMP_MASTER
          WHERE EMP_STATUS <> 'S'
            AND EMPLOYEE_ID IN (
                  SELECT EMPLOYEE_ID
                    FROM HR_EMP_SEPARATIONS
                   WHERE NVL(FINAL_SETTLEMENT_DONE, 'N') = 'N'
            )`,
      )) as Record<string, unknown>[];

      const pendingCount = Number(pick(Array.isArray(pending) ? pending[0] : undefined, "CNT") ?? 0);
      if (pendingCount > 0) {
        const goOn = await confirm({
          title: "Pending Final Settlements",
          message: "There are Pending Final Settlements for confirmation. Do you wish to continue?",
          confirmText: "Continue",
          cancelText: "Cancel",
        });
        if (!goOn) return;
      }

      // Step 2: close confirmation
      const ok = await confirm({
        title: "Close Payroll Period",
        message: (
          <div className="grid gap-2">
            <p className="m-0">Do you want to Close Payroll Period for all Divisions?</p>
            <p className="m-0 text-xs text-muted-foreground">
              Closing {payrollPeriod} means re-processing will not be possible for this month.
            </p>
          </div>
        ),
        confirmText: "Yes, Close Period",
        cancelText: "No",
      });
      if (!ok) return;

      setClosing(true);

      // Step 3: month-end procedure via common API
      await almsCommonProcedure({
        parameter: PROC_PROCESS_PAYROLL_MONTHEND,
        val1s1: companyCode,                       // P_COMPANY_CODE
        val1s2: divCode,                           // P_DIV_CODE
        val1s3: periodToDocDate(payrollPeriod),    // P_CLOSING_BASE  <-- confirm the expected value
        val1s4: finalize ? "Y" : "N",              // P_IS_FINALIZED
        loginid,                                   // P_USER_ID
      });

      // Step 4: read result
      const res = await readProcessResult(loginid);
      if (!res) {
        toast.error("Close process finished but no status was returned");
        return;
      }

      if (res.status === 1) {
        toast.success(res.message || `Payroll period ${payrollPeriod} closed.`);
        setFinalize(false);
      } else {
        toast.error(res.message || "Unable to close payroll period");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to close payroll period");
    } finally {
      setClosing(false);
    }
  };

  return (
    <section className="freight-workspace-ui freight-dense-form freight-ui-standard grid gap-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <CalendarCheck size={15} />
          </div>
          <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
            Payroll Closing
            <span className="ml-2 text-red-600">- {payrollPeriod}</span>
          </h1>
        </div>
      </div>

      {/* Division selection */}
      <SectionPanel title="Division" icon={FileText}>
        <div className="grid gap-3 md:grid-cols-[200px_1fr]">
          <Field label="Division" required>
            <LookupField
              compact
              disabled={!companyCode}
              value={divCode}
              columns={DIVISION_COLUMNS}
              valueField="div_code"
              displayFields={["div_code", "div_name"]}
              loadOptions={loadDivisions}
              onChange={(value, row) => {
                setDivCode(value);
                setDivName(String((row as Record<string, unknown> | undefined)?.div_name ?? ""));
                setFinalize(false);
              }}
              placeholder="Division code"
            />
          </Field>
        </div>
      </SectionPanel>

      {/* Finalize + checklist + message */}
      <div className="grid gap-4 rounded-md border bg-card px-4 py-3 shadow-sm">
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={finalize}
            disabled={!divisionReady || busy}
            onChange={(e) => setFinalize(e.target.checked)}
          />
          Finalize Payroll
        </label>

        <div>
          <h2 className="m-0 mb-2 text-sm font-semibold text-red-600">Check List</h2>
          <ol className="m-0 grid list-decimal gap-1.5 pl-10 text-sm text-red-900">
            {CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>

        <div className="mx-auto max-w-2xl text-center text-sm font-bold leading-relaxed text-blue-900">
          <p className="m-0">Please Finalize Payroll Process to Close Current Month Payroll.</p>
          <p className="m-0">
            Payroll Closing of {payrollPeriod} will change the Payroll Period to Next Month. Once the
            Salary Calculation, Finalise and Close the Period, Re-Processing is not possible for that
            Month.
          </p>
        </div>

        <div className="text-center">
          <button
            type="button"
            className="cursor-pointer text-sm text-blue-600 hover:underline"
            onClick={() => {
              /* TODO: payslips email */
            }}
          >
            Payslips EMail
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleProcessJv}
            disabled={!divisionReady || busy}
          >
            {processingJv ? "Processing..." : "Process JV"}
          </Button>
          <Button
            type="button"
            onClick={handleClosePeriod}
            disabled={!divisionReady || !finalize || busy}
          >
            <Lock size={14} /> {closing ? "Closing..." : "Close Payroll Period"}
          </Button>
        </div>
      </div>

      {dialog}
    </section>
  );
}

export default PayrollClosing;