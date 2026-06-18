"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RefreshCw, X, Search } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { useAuth } from "../../state/AuthContext";
import { getDynamicLookup } from "../../api/lookups";
import ReportDialogPage from "../../components/ReportDialogPage";
import {
  getProfitLossReportHtml,
  getProfitLossReportExcelDownload,
} from "../../api/transactions";

// ─── Types ────────────────────────────────────────────────────────────────────

type Division = { div_code: string; div_name: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStartOfYear = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-01-01`;
};

const getToday = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(
    n.getDate()
  ).padStart(2, "0")}`;
};

// ─── Iframe renderer ──────────────────────────────────────────────────────────

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
      title="report"
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfitLossPage() {
  const { user } = useAuth();

  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? user?.username ?? "ADMIN";

  // ── Division lookup ────────────────────────────────────────────────────────
  const [divisionList, setDivisionList] = useState<Division[]>([]);
  const [divisionLoading, setDivisionLoading] = useState(false);
  const [divisionSearch, setDivisionSearch] = useState("");
  const [showDivisionDropdown, setShowDivisionDropdown] = useState(false);
  const [division, setDivision] = useState("");
  const [divisionDisplay, setDivisionDisplay] = useState("");

  // ── Form state ─────────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState(getStartOfYear());
  const [dateTo, setDateTo] = useState(getToday());

  // ── Report state ───────────────────────────────────────────────────────────
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const filteredDivisions = divisionList.filter((d) =>
    `${d.div_code} ${d.div_name}`
      .toLowerCase()
      .includes(divisionSearch.toLowerCase())
  );

  const canGenerate = Boolean(division && dateFrom && dateTo);

  // ── Fetch divisions ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchDivisions = async () => {
      setDivisionLoading(true);
      try {
        const res = await getDynamicLookup({
          parameter: "Account_division",
          loginid: loginId,
          code1: companyCode,
        });
        setDivisionList((res as Division[]) ?? []);
      } catch {
        setDivisionList([]);
      } finally {
        setDivisionLoading(false);
      }
    };
    fetchDivisions();
  }, [companyCode, loginId]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleReset = () => {
    setDivision("");
    setDivisionDisplay("");
    setDivisionSearch("");
    setDateFrom(getStartOfYear());
    setDateTo(getToday());
    setReportHtml(null);
    setReportError(null);
  };

  const buildPayload = useCallback(
    () => ({
      parameter: "Account_Report_PROFIT_AND_LOSS_VW_PROFIT_AND_LOSS",
      loginid: loginId,
      company_code: companyCode,
      division_code: division,
      from_date: dateFrom,
      to_date: dateTo,
    }),
    [companyCode, loginId, division, dateFrom, dateTo]
  );

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setReportLoading(true);
    setReportError(null);
    setReportHtml(null);
    try {
      const html = await getProfitLossReportHtml(buildPayload());
      setReportHtml(html);
    } catch (err: any) {
      setReportError(err?.message ?? "Failed to generate report");
    } finally {
      setReportLoading(false);
    }
  };

  const handleExcel = async () => {
    try {
      await getProfitLossReportExcelDownload(buildPayload());
    } catch (err: any) {
      setReportError(err?.message ?? "Failed to download Excel");
    }
  };

  const handleCloseReport = () => setReportHtml(null);

  const pageTitle = "Profit & Loss";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <section className="grid gap-4">

        {/* Page Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">
              {pageTitle}
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Financial Reports
            </p>
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
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
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

        {/* Filters Card */}
        <Card className="border-border shadow-sm overflow-visible">
          <CardHeader className="bg-muted/30 border-b border-border px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-1 rounded-full bg-primary" />
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Parameters
                </p>
                <h2 className="text-[11px] font-semibold text-foreground leading-tight">
                  Report Filters
                </h2>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-3 overflow-visible">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 overflow-visible">

              {/* Division searchable select */}
              <label className="flex flex-col gap-1.5 sm:col-span-2 overflow-visible">
                <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">
                  Division <strong className="text-destructive">*</strong>
                </span>
                <div className="relative z-50 overflow-visible">
                  <div className="flex items-center gap-2 rounded border border-input bg-background px-2">
                    <Search size={13} className="text-muted-foreground flex-shrink-0" />
                    <input
                      type="text"
                      placeholder={divisionLoading ? "Loading…" : "Search division…"}
                      value={showDivisionDropdown ? divisionSearch : divisionDisplay}
                      onChange={(e) => {
                        setDivisionSearch(e.target.value);
                        setShowDivisionDropdown(true);
                      }}
                      onFocus={() => setShowDivisionDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowDivisionDropdown(false), 200)
                      }
                      disabled={divisionLoading}
                      className="h-8 w-full bg-transparent text-[11px] text-foreground outline-none disabled:opacity-50"
                    />
                  </div>
                  {showDivisionDropdown && filteredDivisions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-[9999] mt-1 max-h-52 overflow-y-auto rounded border border-border bg-background shadow-lg">
                      {filteredDivisions.map((d) => (
                        <button
                          key={d.div_code}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] hover:bg-muted/40"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setDivision(d.div_code);
                            setDivisionDisplay(`${d.div_code} – ${d.div_name}`);
                            setDivisionSearch("");
                            setShowDivisionDropdown(false);
                            setReportError(null);
                          }}
                        >
                          <span className="w-20 flex-shrink-0 font-medium">
                            {d.div_code}
                          </span>
                          <span className="truncate text-muted-foreground">
                            {d.div_name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>

              {/* From Date */}
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  From Date <strong className="text-destructive">*</strong>
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </label>

              {/* To Date */}
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  To Date <strong className="text-destructive">*</strong>
                </span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </label>

            </div>
          </CardContent>
        </Card>

      </section>

      {/* Report Dialog */}
      {reportHtml !== null && (
        <ReportDialogPage
          title={pageTitle}
          Report={IframeReportRenderer}
          required_values={{ html: reportHtml }}
          excel={handleExcel}
          onClose={handleCloseReport}
        />
      )}
    </>
  );
}