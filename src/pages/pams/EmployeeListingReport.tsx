// EmployeeListingReport.tsx  (frontend)
// Same flow as PrRegisterPage: filters -> backend returns report HTML (header + logo from
// reportHeader / MS_COMPANY) -> shown in PurchaseReportPreview.
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { PurchaseReportPreview } from "../purchase_sales/Reports/Purchasereportpreview";
import { openPurchaseReport } from "../purchase_sales/Reports/PurchaseReportPreviewState";
import { ReportFilterHeader } from "../../components/reports/ReportFilterHeader";
import { Button } from "../../components/ui/Button";
import { LookupField } from "../../components/ui/LookupField";
import type { LookupRow } from "../../api/lookups";
import { pamsSelect, getEmployeeListingReportHtml } from "../../api/pams";
import { useAuth } from "../../state/AuthContext";

interface EmployeeListingParams {
  loginid: string;
  company_code: string;
  period: string;
  division: string;
  department: string;
  designation: string;
  employee: string;
  period_label: string;
  division_label: string;
  department_label: string;
  designation_label: string;
  employee_label: string;
  [key: string]: any;
}

type Opt = { code: string; name: string };
type Sel = { code: string; label: string };
const ALL: Sel = { code: "ALL", label: "" };

const lookupColumns = [
  { field: "CODE", header: "Code" },
  { field: "NAME", header: "Name" },
];
const toRows = (items: Opt[]) =>
  items.map((i) => ({ CODE: i.code, NAME: i.name } as unknown as LookupRow));
const s = (v: unknown) => String(v ?? "");

type PamsArgs = Parameters<typeof pamsSelect>[0];
const call = async (args: PamsArgs) => {
  try {
    const res = await pamsSelect(args);
    return Array.isArray(res) ? (res as unknown as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 text-xs font-semibold text-slate-600">
      {label}
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full flex items-center gap-3 pt-1">
      <span className="text-xs font-semibold text-slate-500">{children}</span>
      <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
    </div>
  );
}

export default function EmployeeListingReport() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? user?.username ?? "ADMIN";

  const [period, setPeriod] = useState<Sel>(ALL);
  const [div, setDiv] = useState<Sel>(ALL);
  const [dept, setDept] = useState<Sel>(ALL);
  const [desg, setDesg] = useState<Sel>(ALL);
  const [emp, setEmp] = useState<Sel>(ALL);

  const [periodOpts, setPeriodOpts] = useState<Opt[]>([]);
  const [divOpts, setDivOpts] = useState<Opt[]>([]);
  const [deptOpts, setDeptOpts] = useState<Opt[]>([]);
  const [desgOpts, setDesgOpts] = useState<Opt[]>([]);
  const [empOpts, setEmpOpts] = useState<Opt[]>([]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Select filters and run the report.");

  const lastRequestRef = useRef<EmployeeListingParams | null>(null);

  // Same idea as PrRegisterPage.buildRequestParams
  const buildRequestParams = (): EmployeeListingParams => ({
    loginid: loginId,
    company_code: companyCode,
    period: period.code || "ALL",
    division: div.code || "ALL",
    department: dept.code || "ALL",
    designation: desg.code || "ALL",
    employee: emp.code || "ALL",
    // labels only for the report sub-heading
    period_label: period.label,
    division_label: div.label,
    department_label: dept.label,
    designation_label: desg.label,
    employee_label: emp.label,
  });

  const withAll = (label: string, list: Opt[]): Opt[] => [{ code: "ALL", name: label }, ...list];

  // Period + Division (once)
  useEffect(() => {
    if (!loginId) return;
    void (async () => {
      const p = await call({ parameter: "period", loginid: loginId, code1: companyCode });
      setPeriodOpts(p.map((r) => ({
        code: s(r.PERIOD_NUMBER),
        name: s(r.PERIOD_NUMBER) + (r.PERIOD_FROM_DATE ? ` (${s(r.PERIOD_FROM_DATE)} to ${s(r.PERIOD_TO_DATE)})` : ""),
      })));
      const d = await call({ parameter: "report_divisions", loginid: loginId, code1: companyCode });
      setDivOpts(d.filter((r) => s(r.DIV_CODE) !== "ALL").map((r) => ({ code: s(r.DIV_CODE), name: s(r.DIV_NAME) })));
    })();
  }, [loginId, companyCode]);

  // Department <- Division
  useEffect(() => {
    void call({ parameter: "report_departments", loginid: loginId, code1: companyCode, code2: div.code }).then((d) =>
      setDeptOpts(d.filter((r) => s(r.DEPT_CODE) !== "ALL").map((r) => ({ code: s(r.DEPT_CODE), name: s(r.DEPT_NAME) })))
    );
  }, [loginId, companyCode, div.code]);

  // Designation <- Division + Department (code4 = section -> ALL)
  useEffect(() => {
    void call({ parameter: "report_designations", loginid: loginId, code1: companyCode, code2: div.code, code3: dept.code, code4: "ALL" }).then((d) =>
      setDesgOpts(d.filter((r) => s(r.DESG_CODE) !== "ALL").map((r) => ({ code: s(r.DESG_CODE), name: s(r.DESG_NAME) })))
    );
  }, [loginId, companyCode, div.code, dept.code]);

  // Employee <- Division + Department + Designation
  useEffect(() => {
    void call({
      parameter: "emp_listing_employees", loginid: loginId, code1: companyCode,
      code2: div.code, code3: dept.code, code4: desg.code,
    }).then((d) => setEmpOpts(d.map((r) => ({ code: s(r.EMPLOYEE_CODE), name: s(r.EMPLOYEE_NAME) }))));
  }, [loginId, companyCode, div.code, dept.code, desg.code]);

  function resetFilters() {
    setPeriod(ALL); setDiv(ALL); setDept(ALL); setDesg(ALL); setEmp(ALL);
    setMessage("Select filters and run the report.");
  }

  const handleGenerateReport = useCallback(async () => {
    const params = buildRequestParams();
    lastRequestRef.current = params;

    setLoading(true);
    setMessage("");

    const preview = openPurchaseReport("Employee Appraisal Listing Report");

    try {
      const html = await getEmployeeListingReportHtml(params);
      preview.ready({
        html,
        filename: `employee_listing_${new Date().toISOString().slice(0, 10)}`,
        orientation: "portrait",
      });
      setMessage("Report generated.");
    } catch (err: any) {
      const errorMessage = err?.message ?? "Failed to load report. Please try again.";
      preview.fail(new Error(errorMessage));
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, div, dept, desg, emp, companyCode, loginId]);

  const lookup = (
    sel: Sel, setSel: (v: Sel) => void, opts: Opt[], allLabel: string, onAfter?: () => void
  ) => (
    <LookupField
      label=""
      value={sel.code === "ALL" ? "" : sel.code}
      displayValue={sel.code === "ALL" ? "" : sel.label}
      columns={lookupColumns}
      valueField="CODE"
      displayFields={["CODE", "NAME"]}
      loadOptions={() => Promise.resolve(toRows(withAll(allLabel, opts)))}
      onChange={(val, row) => {
        if (!val || val === "ALL") setSel({ code: "ALL", label: "" });
        else setSel({ code: val, label: row ? s((row as Record<string, unknown>).NAME) || val : val });
        onAfter?.();
      }}
      placeholder={allLabel}
    />
  );

  return (
    <section className="freight-ui-standard freight-report-screen">
      <div className="freight-report-card">
        <div className="freight-report-titlebar">
          <h1>Employee Appraisal Listing Report</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
        </div>

        <ReportFilterHeader onClear={resetFilters} />

        <div className="freight-report-fields grid gap-x-4 gap-y-4 p-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SectionTitle>Filters</SectionTitle>

          <Field label="Period">{lookup(period, setPeriod, periodOpts, "All Periods")}</Field>
          <Field label="Division">
            {lookup(div, setDiv, divOpts, "All Divisions", () => { setDept(ALL); setDesg(ALL); setEmp(ALL); })}
          </Field>
          <Field label="Department">
            {lookup(dept, setDept, deptOpts, "All Departments", () => { setDesg(ALL); setEmp(ALL); })}
          </Field>
          <Field label="Designation">
            {lookup(desg, setDesg, desgOpts, "All Designations", () => setEmp(ALL))}
          </Field>
          <Field label="Employee">{lookup(emp, setEmp, empOpts, "All Employees")}</Field>
        </div>

        <div className="freight-report-actions flex items-center gap-2">
          <Button type="button" size="sm" onClick={handleGenerateReport} disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Generate Report
          </Button>
        </div>
        {message ? <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p> : null}
      </div>

      <PurchaseReportPreview />
    </section>
  );
}