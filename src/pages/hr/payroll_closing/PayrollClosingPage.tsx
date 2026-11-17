import { CalendarCheck, FileText, Lock } from "lucide-react";
import { useCallback, useState } from "react";
import { getDynamicLookup, type LookupRow } from "../../../api/lookups";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { Field, SectionPanel } from "../../../components/ui/Formblocks";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { useAuth } from "../../../state/AuthContext";

/* ================= CONSTANTS ================= */

const P_DIVISION = "HR_DROPDOWN_MS_DIVISION";

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

/* ================= PAGE ================= */

export function PayrollClosing() {
  const { user } = useAuth();
  const { toast } = useToast();
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
      // TODO: call Process JV API
      toast.success("JV processed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to process JV");
    } finally {
      setProcessingJv(false);
    }
  };

  const handleClosePeriod = async () => {
    if (!divisionReady || !finalize) return;
    const ok = window.confirm(
      `Close payroll period ${payrollPeriod}? Re-processing will not be possible for this month.`,
    );
    if (!ok) return;

    setClosing(true);
    try {
      // TODO: call Close Payroll Period API
      toast.success(`Payroll period ${payrollPeriod} closed.`);
      setFinalize(false);
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
              displayFields={["div_code" , "div_name"]}
              loadOptions={loadDivisions}
              onChange={(value, row) => {
                setDivCode(value);
                setDivName(String((row as Record<string, unknown> | undefined)?.div_name ?? ""));
                setFinalize(false);
              }}
              placeholder="Division code"
            />
          </Field>
          {/* <Field label="Division Name">
            <Input readOnly value={divName} className="h-8 bg-slate-50" />
          </Field> */}
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
    </section>
  );
}

export default PayrollClosing;