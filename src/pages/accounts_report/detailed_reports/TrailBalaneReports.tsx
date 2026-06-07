import { useCallback, useEffect, useMemo, useState } from "react";
import { Play, RefreshCw, X } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { DataTable } from "../../../components/ui/DataTable";
import { useAuth } from "../../../state/AuthContext";
import { api } from "../../../api/client";
import { getDynamicLookup } from "../../../api/lookups";
import ReportDialogPage from "../../../components/ReportDialogPage";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnyRow = Record<string, unknown>;

export interface ReportFilterPageProps<T extends AnyRow> {
  title: string;
  selectorParameter: string;
  selectorValueField: keyof T & string;
  selectorColumnDefs: ColumnDef<T>[];
  selectorAvailableLabel?: string;
  selectorSelectedLabel?: string;
  formValueKey: string;
  reportEndpoint: string;
}

type FormState = {
  from_date: string;
  to_date: string;
  division_code: string;
};

type Division = {
  div_code: string;
  div_name: string;
};

// ─── Report wrapper component for ReportDialogPage ───────────────────────────
// ReportDialogPage expects a `Report` component prop that accepts { required_values }.
// We use it to render the raw HTML string returned by the backend.

function HtmlReportRenderer({ required_values }: { required_values: { html: string } }) {
  return (
    <div
      style={{ width: "100%" }}
      dangerouslySetInnerHTML={{ __html: required_values.html }}
    />
  );
}

// ─── Group exports ────────────────────────────────────────────────────────────

export const FirstGroup = () => (
  <TrailBalanceReports<{ l2_code: string; l2_description: string }>
    title="Trial Balance – L2"
    selectorParameter="BOLD_REPORT_TRAIL_STATEMENT_L2_CODE"
    selectorValueField="l2_code"
    selectorColumnDefs={[
      { header: "L2 Code",     accessorKey: "l2_code"        },
      { header: "Description", accessorKey: "l2_description" },
    ]}
    selectorAvailableLabel="Available L2 Codes"
    selectorSelectedLabel="Selected L2 Codes"
    formValueKey="l2_code"
    reportEndpoint="api/finance/transactions/report/trailbalance/l2"
  />
);

export const SecondGroup = () => (
  <TrailBalanceReports<{ l3_code: string; l3_description: string }>
    title="Trial Balance – L3"
    selectorParameter="BOLD_REPORT_TRAIL_STATEMENT_L3_CODE"
    selectorValueField="l3_code"
    selectorColumnDefs={[
      { header: "L3 Code",     accessorKey: "l3_code"        },
      { header: "Description", accessorKey: "l3_description" },
    ]}
    selectorAvailableLabel="Available L3 Codes"
    selectorSelectedLabel="Selected L3 Codes"
    formValueKey="l3_code"
    reportEndpoint="api/finance/transactions/report/trailbalance/l3"
  />
);

export const ThirdGroup = () => (
  <TrailBalanceReports<{ l4_code: string; l4_description: string }>
    title="Trial Balance – L4"
    selectorParameter="BOLD_REPORT_TRAIL_STATEMENT_L4_CODE"
    selectorValueField="l4_code"
    selectorColumnDefs={[
      { header: "L4 Code",     accessorKey: "l4_code"        },
      { header: "Description", accessorKey: "l4_description" },
    ]}
    selectorAvailableLabel="Available L4 Codes"
    selectorSelectedLabel="Selected L4 Codes"
    formValueKey="l4_code"
    reportEndpoint="api/finance/transactions/report/trailbalance/l4"
  />
);

// ─── Main Component ───────────────────────────────────────────────────────────

function TrailBalanceReports<T extends AnyRow>({
  title,
  selectorParameter,
  selectorValueField,
  selectorColumnDefs,
  selectorAvailableLabel = "Available Items",
  selectorSelectedLabel = "Selected Items",
  formValueKey,
  reportEndpoint,
}: ReportFilterPageProps<T>) {
  const { user } = useAuth();

  // ── Local state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>({
    from_date: "",
    to_date: "",
    division_code: "",
  });

  const [divisions, setDivisions]         = useState<Division[]>([]);
  const [divisionsLoading, setDivisionsLoading] = useState(false);

  const [selectorRows, setSelectorRows]   = useState<T[]>([]);
  const [selectorLoading, setSelectorLoading] = useState(false);

  const [selectedRows, setSelectedRows]   = useState<T[]>([]);

  // reportHtml holds the raw HTML string from the backend
  const [reportHtml, setReportHtml]       = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError]     = useState<string | null>(null);

  // ── Fetch divisions ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchDivisions = async () => {
      setDivisionsLoading(true);
      try {
        const response = await getDynamicLookup({
          parameter: "Account_division",
          loginid: user?.loginid ?? "",
          code1: user?.company_code ?? "",
        });
        setDivisions(response as Division[]);
      } catch {
        setDivisions([]);
      } finally {
        setDivisionsLoading(false);
      }
    };
    fetchDivisions();
  }, [user]);

  // ── Fetch selector rows ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchSelectorRows = async () => {
      setSelectorLoading(true);
      try {
        const response = await getDynamicLookup({
          parameter: selectorParameter,
          loginid: user?.loginid ?? "",
          code1: user?.company_code ?? "",
        });
        setSelectorRows(response as T[]);
      } catch {
        setSelectorRows([]);
      } finally {
        setSelectorLoading(false);
      }
    };
    fetchSelectorRows();
  }, [selectorParameter, user]);

  // ── Column defs ────────────────────────────────────────────────────────────
  const availableColumns = useMemo<ColumnDef<T>[]>(
    () => selectorColumnDefs,
    [selectorColumnDefs],
  );

  const selectedColumns = useMemo<ColumnDef<T>[]>(
    () => [
      ...selectorColumnDefs,
      {
        id: "__remove",
        header: "",
        size: 40,
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRows((prev) =>
                prev.filter(
                  (r) => r[selectorValueField] !== row.original[selectorValueField],
                ),
              );
            }}
            className="grid h-5 w-5 place-items-center rounded text-destructive/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Remove"
          >
            <X size={11} />
          </button>
        ),
      },
    ],
    [selectorColumnDefs, selectorValueField],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAvailableRowClick = useCallback(
    (row: T) => {
      setSelectedRows((prev) => {
        if (prev.some((r) => r[selectorValueField] === row[selectorValueField])) return prev;
        return [...prev, row];
      });
    },
    [selectorValueField],
  );

  const handleReset = () => {
    setForm({ from_date: "", to_date: "", division_code: "" });
    setSelectedRows([]);
    setReportError(null);
    setReportHtml(null);
  };

  const canGenerate = Boolean(form.from_date && form.to_date);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setReportLoading(true);
    setReportError(null);
    setReportHtml(null);
    try {
      const payload = {
        company_code:   user?.company_code ?? "",
        division_code:  form.division_code,
        from_date:      form.from_date,
        to_date:        form.to_date,
        [formValueKey]: selectedRows.map((r) => r[selectorValueField]),
      };
      const { data } = await api.post<string>(reportEndpoint, payload, {
        headers:      { Accept: "text/html" },
        responseType: "text",
      });
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <section className="grid gap-4">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">
              {title}
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
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
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

        {/* ── Error Banner ── */}
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

        {/* ── Filters ── */}
        <Card className="border-border shadow-sm overflow-hidden">
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
          <CardContent className="px-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* From Date */}
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  From Date <strong className="text-destructive">*</strong>
                </span>
                <input
                  type="date"
                  value={form.from_date}
                  onChange={(e) => setForm((p) => ({ ...p, from_date: e.target.value }))}
                  className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </label>

              {/* To Date */}
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  To Date <strong className="text-destructive">*</strong>
                </span>
                <input
                  type="date"
                  value={form.to_date}
                  onChange={(e) => setForm((p) => ({ ...p, to_date: e.target.value }))}
                  className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </label>

              {/* Division */}
              <label className="flex flex-col gap-0.5 sm:col-span-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Division
                </span>
                <select
                  value={form.division_code}
                  onChange={(e) => setForm((p) => ({ ...p, division_code: e.target.value }))}
                  disabled={divisionsLoading}
                  className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50"
                >
                  <option value="">— All Divisions —</option>
                  {divisions.map((d) => (
                    <option key={d.div_code} value={d.div_code}>
                      {d.div_code} – {d.div_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* ── Dual DataTable ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Available */}
          <Card className="overflow-hidden border-border shadow-sm">
            <div className="px-3 py-1.5 bg-muted/40 border-b border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {selectorAvailableLabel}
              </p>
              <p className="text-[10px] text-muted-foreground/60">Click a row to add</p>
            </div>
            <DataTable<T, unknown>
              columns={availableColumns}
              data={selectorRows}
              loading={selectorLoading}
              height={300}
              density="grid"
              emptyText="No items available"
              onRowClick={handleAvailableRowClick}
              rowClassName={(row) =>
                selectedRows.some((r) => r[selectorValueField] === row[selectorValueField])
                  ? "bg-green-50 text-green-800 font-medium"
                  : ""
              }
            />
          </Card>

          {/* Selected */}
          <Card className="overflow-hidden border-border shadow-sm">
            <div className="px-3 py-1.5 bg-muted/40 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {selectorSelectedLabel}
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  {selectedRows.length} item{selectedRows.length !== 1 ? "s" : ""} selected
                </p>
              </div>
              {selectedRows.length > 0 && (
                <button
                  onClick={() => setSelectedRows([])}
                  className="text-[10px] text-destructive/70 hover:text-destructive underline"
                >
                  Clear all
                </button>
              )}
            </div>
            <DataTable<T, unknown>
              columns={selectedColumns}
              data={selectedRows}
              height={300}
              density="grid"
              emptyText="No items selected"
            />
          </Card>
        </div>

      </section>

      {/* ── Report Dialog ── */}
      {reportHtml !== null && (
        <ReportDialogPage
          title={title}
          Report={HtmlReportRenderer}
          required_values={{ html: reportHtml }}
          onClose={() => setReportHtml(null)}
        />
      )}
    </>
  );
}