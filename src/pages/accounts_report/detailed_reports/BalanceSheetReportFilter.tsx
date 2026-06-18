import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RefreshCw, X } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { useAuth } from "../../../state/AuthContext";
import { getBalanceSheetReportHtml, getBalanceSheetReportExcelDownload } from "../../../api/transactions";
import { getDynamicLookup } from "../../../api/lookups";
import ReportDialogPage from "../../../components/ReportDialogPage";

// ─── Types ────────────────────────────────────────────────────────────────────

type Division = { div_code: string; div_name: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getToday = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

// ─── Iframe renderer ──────────────────────────────────────────────────────────
// Consistent with TrialBalancePage — scripts in report HTML only run inside a
// real iframe. Balance Sheet has no drill-down, but we keep the same renderer
// so print() and layout behave identically to TB.

function IframeReportRenderer({
  required_values,
}: {
  required_values: { html: string };
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const win = iframe.contentWindow as any;

    let originalPrint: (() => void) | undefined;
    if (win) {
      originalPrint = win.print;
      win.print = () => {};
    }

    doc.open();
    doc.write(required_values.html);
    doc.close();

    const restorePrint = () => {
      if (win && originalPrint) win.print = originalPrint;
    };
    if (doc.readyState === "complete") {
      restorePrint();
    } else {
      iframe.addEventListener("load", restorePrint, { once: true });
    }
  }, [required_values.html]);

  return (
    <iframe
      ref={iframeRef}
      style={{ width: "100%", minHeight: "70vh", border: "none" }}
      title="balance-sheet-report"
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BalanceSheetPage() {
  const { user } = useAuth();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [asOnDate,      setAsOnDate]      = useState<string>(getToday());
  const [divisionCode,  setDivisionCode]  = useState<string>("");

  // ── Division lookup ────────────────────────────────────────────────────────
  const [divisions,        setDivisions]        = useState<Division[]>([]);
  const [divisionsLoading, setDivisionsLoading] = useState(false);

  // ── Report state ───────────────────────────────────────────────────────────
  const [reportHtml,    setReportHtml]    = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError,   setReportError]   = useState<string | null>(null);
  const [excelLoading,  setExcelLoading]  = useState(false);

  // ── Fetch divisions ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      setDivisionsLoading(true);
      try {
        const res = await getDynamicLookup({
          parameter: "Account_division",
          loginid:   user?.loginid      ?? "",
          code1:     user?.company_code ?? "",
        });
        setDivisions(res as Division[]);
      } catch {
        setDivisions([]);
      } finally {
        setDivisionsLoading(false);
      }
    };
    fetch();
  }, [user]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleReset = () => {
    setAsOnDate(getToday());
    setDivisionCode("");
    setReportHtml(null);
    setReportError(null);
  };

  const buildPayload = useCallback(() => ({
    parameter:    "Account_Report_BalanceSheet",
    company_code: user?.company_code ?? "",
    division_code: divisionCode || "All",
    as_on_date:   asOnDate,
    loginid:      user?.loginid ?? "ADMIN",
  }), [user, divisionCode, asOnDate]);

  const handleGenerate = async () => {
    if (!asOnDate) {
      setReportError("Please select an As On Date before generating.");
      return;
    }

    setReportLoading(true);
    setReportError(null);
    setReportHtml(null);

    try {
      const data = await getBalanceSheetReportHtml(buildPayload());
      setReportHtml(data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to generate report";
      setReportError(String(msg));
    } finally {
      setReportLoading(false);
    }
  };

  const handleExcel = async () => {
    setExcelLoading(true);
    try {
      await getBalanceSheetReportExcelDownload(buildPayload());
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to download Excel";
      setReportError(String(msg));
    } finally {
      setExcelLoading(false);
    }
  };

  const canGenerate = Boolean(asOnDate);
  const pageTitle   = "Balance Sheet";

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <section className="grid gap-4">

        {/* Page Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">
              {pageTitle}
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Financial Reports</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" title="Reset" onClick={handleReset}>
              <RefreshCw size={15} />
            </Button>

            <Button disabled={!canGenerate || reportLoading} onClick={handleGenerate}>
              {reportLoading ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <Play size={15} /> Generate Report
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error Banner */}
        {reportError && (
          <div className="flex items-center gap-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
            <span className="font-semibold">Error:</span> {reportError}
            <button
              onClick={() => setReportError(null)}
              className="ml-auto text-destructive/60 hover:text-destructive"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Filters */}
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-1 rounded-full bg-primary" />
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Parameters
                </p>
                <h2 className="text-[11px] font-semibold text-foreground leading-tight">
                  Balance Sheet Filters
                </h2>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-4 py-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">

              {/* Division */}
              <label className="flex flex-col gap-1.5 sm:col-span-2 md:col-span-2">
                <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">
                  Division
                </span>
                <select
                  value={divisionCode}
                  onChange={(e) => setDivisionCode(e.target.value)}
                  disabled={divisionsLoading}
                  className="h-8 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50"
                >
                  <option value="">— All Divisions —</option>
                  {divisions.map((d) => (
                    <option key={d.div_code} value={d.div_code}>
                      {d.div_code} – {d.div_name}
                    </option>
                  ))}
                </select>
              </label>

              {/* As On Date */}
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  As On Date <strong className="text-destructive">*</strong>
                </span>
                <input
                  type="date"
                  value={asOnDate}
                  onChange={(e) => setAsOnDate(e.target.value)}
                  className="h-8 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </label>

            </div>
          </CardContent>
        </Card>

        {/* Empty state placeholder while no report is generated */}
        {reportHtml === null && !reportLoading && (
          <Card className="border-border shadow-sm overflow-hidden min-h-[220px]">
            <div className="flex min-h-[220px] items-center justify-center p-10 text-[13px] text-muted-foreground select-none">
              Set the parameters above and click&nbsp;
              <strong className="font-semibold text-foreground ml-1">Generate Report</strong>
            </div>
          </Card>
        )}

        {/* Loading placeholder */}
        {reportLoading && (
          <Card className="border-border shadow-sm overflow-hidden min-h-[220px]">
            <div className="flex min-h-[220px] items-center justify-center gap-2 p-10 text-[13px] text-muted-foreground">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Generating report…
            </div>
          </Card>
        )}

      </section>

      {/* ── Report Dialog ── */}
      {reportHtml !== null && (
        <ReportDialogPage
          title={pageTitle}
          Report={IframeReportRenderer}
          required_values={{ html: reportHtml }}
          excel={handleExcel}
          onClose={() => setReportHtml(null)}
        />
      )}
    </>
  );
}