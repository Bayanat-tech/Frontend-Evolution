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

/**
 * When `mode` is omitted or `"single"`:
 *   - One selector panel (left/right). Matches the original L2/L3/L4 behaviour.
 *
 * When `mode` is `"ac"`:
 *   - Two tabbed selectors: one for ac_code rows, one for l4_code rows.
 *   - Report-format radio group (standard | sub_ledger_1 | sub_ledger_2 | tb_without_year_end_jv).
 *   - "Exclude Zero TXNs" checkbox.
 *   - Both ac_code[] and l4_code[] arrays are sent to the backend.
 *   - `selectorParameter`      → parameter for the ac_code lookup.
 *   - `secondSelectorParameter`→ parameter for the l4_code lookup.
 *   - `formValueKey`           → "ac_code" (key used in the POST body for the primary selector).
 *   - `secondFormValueKey`     → "l4_code" (key used in the POST body for the secondary selector).
 */
export interface ReportFilterPageProps<
  T extends AnyRow = AnyRow,
  S extends AnyRow = AnyRow,
> {
  /** Display title shown in the page header. */
  title: string;

  // ── Primary selector (always present) ──────────────────────────────────────
  /** Dynamic-lookup parameter string for the primary selector list. */
  selectorParameter: string;
  /** Row field that holds the unique value for each primary-selector row. */
  selectorValueField: keyof T & string;
  /** Column definitions for the primary selector DataTable. */
  selectorColumnDefs: ColumnDef<T>[];
  /** Header label for the "available" panel of the primary selector. */
  selectorAvailableLabel?: string;
  /** Header label for the "selected" panel of the primary selector. */
  selectorSelectedLabel?: string;
  /** POST-body key for the primary selector values array. */
  formValueKey: string;

  // ── Secondary selector (ac mode only) ──────────────────────────────────────
  /** `"ac"` enables the dual-tab selector + report-format radio + exclude-zero checkbox. */
  mode?: "single" | "ac";
  /** Dynamic-lookup parameter string for the secondary (l4_code) selector. */
  secondSelectorParameter?: string;
  /** Row field that holds the unique value for each secondary-selector row. */
  secondSelectorValueField?: keyof S & string;
  /** Column definitions for the secondary selector DataTable. */
  secondSelectorColumnDefs?: ColumnDef<S>[];
  /** Header label for the "available" panel of the secondary selector. */
  secondSelectorAvailableLabel?: string;
  /** Header label for the "selected" panel of the secondary selector. */
  secondSelectorSelectedLabel?: string;
  /** POST-body key for the secondary selector values array. */
  secondFormValueKey?: string;
  /** Tab label for the primary selector (ac mode). Defaults to "A/c Code". */
  primaryTabLabel?: string;
  /** Tab label for the secondary selector (ac mode). Defaults to "L4 Code". */
  secondaryTabLabel?: string;

  // ── Endpoints ──────────────────────────────────────────────────────────────
  reportEndpoint: string;
  excelEndpoint?: string;
  excelFileName?: string;
}

type FormState = {
  from_date: string;
  to_date: string;
  division_code: string;
  /** ac mode only */
  report_format: TReportFormat;
  /** ac mode only */
  exclude_zero_txns: boolean;
};

type Division = {
  div_code: string;
  div_name: string;
};

type TReportFormat =
  | "standard"
  | "sub_ledger_1"
  | "sub_ledger_2"
  | "tb_without_year_end_jv";

const REPORT_FORMAT_OPTIONS: { value: TReportFormat; label: string }[] = [
  { value: "standard",              label: "Standard" },
  { value: "sub_ledger_1",          label: "Sub Ledger Format 1" },
  { value: "sub_ledger_2",          label: "Sub Ledger Format 2" },
  { value: "tb_without_year_end_jv",label: "TB Without Year End JV" },
];

// ─── Report HTML renderer (used by ReportDialogPage) ─────────────────────────

function HtmlReportRenderer({ required_values }: { required_values: { html: string } }) {
  return (
    <div
      style={{ width: "100%" }}
      dangerouslySetInnerHTML={{ __html: required_values.html }}
    />
  );
}

// ─── Group exports (L2 / L3 / L4 — unchanged behaviour) ──────────────────────

export const FirstGroup = () => (
  <ReportFilterPage<{ l2_code: string; l2_description: string }>
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
    reportEndpoint="api/finance/transactions/report/trialbalance/html/l2"
    excelEndpoint="api/finance/transactions/report/trialbalance/excel/l2"
    excelFileName="TrailBalance_L2.xlsx"
  />
);

export const SecondGroup = () => (
  <ReportFilterPage<{ l3_code: string; l3_description: string }>
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
    reportEndpoint="api/finance/transactions/report/trialbalance/html/l3"
    excelEndpoint="api/finance/transactions/report/trialbalance/excel/l3"
  />
);

export const ThirdGroup = () => (
  <ReportFilterPage<{ l4_code: string; l4_description: string }>
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
    reportEndpoint="api/finance/transactions/report/trialbalance/html/l4"
    excelEndpoint="api/finance/transactions/report/trialbalance/excel/l4"
  />
);

// ─── AC Trial Balance export ──────────────────────────────────────────────────

export const AcGroup = () => (
  <ReportFilterPage<
    { ac_code: string; ac_name: string },
    { l4_code: string; l4_description: string }
  >
    mode="ac"
    title="Trial Balance – Account"
    selectorParameter="BOLD_REPORT_TRAIL_STATEMENT_AC_CODE"
    selectorValueField="ac_code"
    selectorColumnDefs={[
      { header: "A/c Code", accessorKey: "ac_code" },
      { header: "A/c Name", accessorKey: "ac_name" },
    ]}
    selectorAvailableLabel="Available A/c Codes"
    selectorSelectedLabel="Selected A/c Codes"
    formValueKey="ac_code"
    primaryTabLabel="A/c Code"
    secondSelectorParameter="BOLD_REPORT_TRAIL_STATEMENT_L4_CODE"
    secondSelectorValueField="l4_code"
    secondSelectorColumnDefs={[
      { header: "L4 Code",     accessorKey: "l4_code"        },
      { header: "Description", accessorKey: "l4_description" },
    ]}
    secondSelectorAvailableLabel="Available L4 Codes"
    secondSelectorSelectedLabel="Selected L4 Codes"
    secondFormValueKey="l4_code"
    secondaryTabLabel="L4 Code"
    reportEndpoint="api/finance/transactions/report/trialbalance/html/ac"
    excelEndpoint="api/finance/transactions/report/trialbalance/excel/ac"
    excelFileName="TrailBalance_AC.xlsx"
  />
);

// ─── Main Component ───────────────────────────────────────────────────────────

function ReportFilterPage<T extends AnyRow = AnyRow, S extends AnyRow = AnyRow>({
  title,
  // primary selector
  selectorParameter,
  selectorValueField,
  selectorColumnDefs,
  selectorAvailableLabel = "Available Items",
  selectorSelectedLabel  = "Selected Items",
  formValueKey,
  // secondary selector (ac mode)
  mode = "single",
  secondSelectorParameter,
  secondSelectorValueField,
  secondSelectorColumnDefs,
  secondSelectorAvailableLabel = "Available L4 Codes",
  secondSelectorSelectedLabel  = "Selected L4 Codes",
  secondFormValueKey,
  primaryTabLabel   = "A/c Code",
  secondaryTabLabel = "L4 Code",
  // endpoints
  reportEndpoint,
  excelEndpoint,
  excelFileName,
}: ReportFilterPageProps<T, S>) {
  const { user } = useAuth();
  const isAcMode = mode === "ac";

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>({
    from_date:         "",
    to_date:           "",
    division_code:     "",
    report_format:     "standard",
    exclude_zero_txns: false,
  });

  // ── Division lookup ────────────────────────────────────────────────────────
  const [divisions, setDivisions]             = useState<Division[]>([]);
  const [divisionsLoading, setDivisionsLoading] = useState(false);

  // ── Primary selector state ─────────────────────────────────────────────────
  const [primaryRows, setPrimaryRows]         = useState<T[]>([]);
  const [primaryLoading, setPrimaryLoading]   = useState(false);
  const [selectedPrimary, setSelectedPrimary] = useState<T[]>([]);

  // ── Secondary selector state (ac mode only) ────────────────────────────────
  const [secondaryRows, setSecondaryRows]           = useState<S[]>([]);
  const [secondaryLoading, setSecondaryLoading]     = useState(false);
  const [selectedSecondary, setSelectedSecondary]   = useState<S[]>([]);
  const [activeTab, setActiveTab] = useState<"primary" | "secondary">("primary");

  // ── Report state ───────────────────────────────────────────────────────────
  const [reportHtml, setReportHtml]       = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError]     = useState<string | null>(null);

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

  // ── Fetch primary selector rows ────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      setPrimaryLoading(true);
      try {
        const res = await getDynamicLookup({
          parameter: selectorParameter,
          loginid:   user?.loginid      ?? "",
          code1:     user?.company_code ?? "",
        });
        setPrimaryRows(res as T[]);
      } catch {
        setPrimaryRows([]);
      } finally {
        setPrimaryLoading(false);
      }
    };
    fetch();
  }, [selectorParameter, user]);

  // ── Fetch secondary selector rows (ac mode) ────────────────────────────────
  useEffect(() => {
    if (!isAcMode || !secondSelectorParameter) return;
    const fetch = async () => {
      setSecondaryLoading(true);
      try {
        const res = await getDynamicLookup({
          parameter: secondSelectorParameter,
          loginid:   user?.loginid      ?? "",
          code1:     user?.company_code ?? "",
        });
        setSecondaryRows(res as S[]);
      } catch {
        setSecondaryRows([]);
      } finally {
        setSecondaryLoading(false);
      }
    };
    fetch();
  }, [isAcMode, secondSelectorParameter, user]);

  // ── Column defs ────────────────────────────────────────────────────────────

  const availablePrimaryColumns = useMemo<ColumnDef<T>[]>(
    () => selectorColumnDefs,
    [selectorColumnDefs],
  );

  const selectedPrimaryColumns = useMemo<ColumnDef<T>[]>(
    () => [
      ...selectorColumnDefs,
      {
        id:     "__remove_primary",
        header: "",
        size:   40,
        cell:   ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPrimary((prev) =>
                prev.filter((r) => r[selectorValueField] !== row.original[selectorValueField]),
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

  const availableSecondaryColumns = useMemo<ColumnDef<S>[]>(
    () => secondSelectorColumnDefs ?? [],
    [secondSelectorColumnDefs],
  );

  const selectedSecondaryColumns = useMemo<ColumnDef<S>[]>(
    () => [
      ...(secondSelectorColumnDefs ?? []),
      {
        id:     "__remove_secondary",
        header: "",
        size:   40,
        cell:   ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!secondSelectorValueField) return;
              setSelectedSecondary((prev) =>
                prev.filter(
                  (r) => r[secondSelectorValueField] !== row.original[secondSelectorValueField],
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
    [secondSelectorColumnDefs, secondSelectorValueField],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handlePrimaryRowClick = useCallback(
    (row: T) => {
      setSelectedPrimary((prev) => {
        if (prev.some((r) => r[selectorValueField] === row[selectorValueField])) return prev;
        return [...prev, row];
      });
    },
    [selectorValueField],
  );

  const handleSecondaryRowClick = useCallback(
    (row: S) => {
      if (!secondSelectorValueField) return;
      setSelectedSecondary((prev) => {
        if (prev.some((r) => r[secondSelectorValueField] === row[secondSelectorValueField]))
          return prev;
        return [...prev, row];
      });
    },
    [secondSelectorValueField],
  );

  const handleReset = () => {
    setForm({
      from_date:         "",
      to_date:           "",
      division_code:     "",
      report_format:     "standard",
      exclude_zero_txns: false,
    });
    setSelectedPrimary([]);
    setSelectedSecondary([]);
    setReportError(null);
    setReportHtml(null);
  };

  const canGenerate = Boolean(form.from_date && form.to_date);

  // ── Build POST payload ─────────────────────────────────────────────────────
  const buildPayload = () => {
    const base = {
      company_code:  user?.company_code ?? "",
      division_code: form.division_code,
      from_date:     form.from_date,
      to_date:       form.to_date,
      [formValueKey]: selectedPrimary.map((r) => r[selectorValueField]),
    };

    if (isAcMode) {
      return {
        ...base,
        report_format:     form.report_format,
        exclude_zero_txns: form.exclude_zero_txns,
        // secondary selector values (l4_code array)
        ...(secondFormValueKey && secondSelectorValueField
          ? { [secondFormValueKey]: selectedSecondary.map((r) => r[secondSelectorValueField!]) }
          : {}),
      };
    }

    return base;
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setReportLoading(true);
    setReportError(null);
    setReportHtml(null);
    try {
      const { data } = await api.post<string>(reportEndpoint, buildPayload(), {
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

  const handleExcel = async () => {
    if (!excelEndpoint) return;
    try {
      const response = await api.post(excelEndpoint, buildPayload(), {
        responseType: "arraybuffer",
      });
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url  = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href  = url;
      link.setAttribute("download", excelFileName || "report.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to download Excel";
      setReportError(String(msg));
    }
  };

  // ── Selector panels ────────────────────────────────────────────────────────

  /** Renders a pair of Available / Selected DataTables for one code list. */
  function SelectorPanel<R extends AnyRow>({
    availableRows,
    loading,
    selectedRows,
    availableColumns,
    selectedColumns,
    valueField,
    availableLabel,
    selectedLabel,
    onRowClick,
    onClearAll,
  }: {
    availableRows:    R[];
    loading:          boolean;
    selectedRows:     R[];
    availableColumns: ColumnDef<R>[];
    selectedColumns:  ColumnDef<R>[];
    valueField:       keyof R & string;
    availableLabel:   string;
    selectedLabel:    string;
    onRowClick:       (row: R) => void;
    onClearAll:       () => void;
  }) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Available */}
        <Card className="overflow-hidden border-border shadow-sm">
          <div className="px-3 py-1.5 bg-muted/40 border-b border-border">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {availableLabel}
            </p>
            <p className="text-[10px] text-muted-foreground/60">Click a row to add</p>
          </div>
          <DataTable<R, unknown>
            columns={availableColumns}
            data={availableRows}
            loading={loading}
            height={260}
            density="grid"
            emptyText="No items available"
            onRowClick={onRowClick}
            rowClassName={(row) =>
              selectedRows.some((r) => r[valueField] === row[valueField])
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
                {selectedLabel}
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                {selectedRows.length} item{selectedRows.length !== 1 ? "s" : ""} selected
              </p>
            </div>
            {selectedRows.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-[10px] text-destructive/70 hover:text-destructive underline"
              >
                Clear all
              </button>
            )}
          </div>
          <DataTable<R, unknown>
            columns={selectedColumns}
            data={selectedRows}
            height={260}
            density="grid"
            emptyText="No items selected"
          />
        </Card>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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
            <div className={`grid grid-cols-1 gap-3 ${isAcMode ? "sm:grid-cols-2 md:grid-cols-3" : "sm:grid-cols-2 md:grid-cols-4"}`}>
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
              <label className={`flex flex-col gap-0.5 ${!isAcMode ? "sm:col-span-2" : ""}`}>
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

              {/* ── AC-mode extras ── */}
              {isAcMode && (
                <>
                  {/* Report Format */}
                  <div className="flex flex-col gap-0.5 sm:col-span-2 md:col-span-3">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Report Format
                    </span>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
                      {REPORT_FORMAT_OPTIONS.map(({ value, label }) => (
                        <label key={value} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="report_format"
                            value={value}
                            checked={form.report_format === value}
                            onChange={() => setForm((p) => ({ ...p, report_format: value }))}
                            className="h-3 w-3 accent-primary"
                          />
                          <span className="text-[11px] text-foreground">{label}</span>
                        </label>
                      ))}

                      {/* Exclude Zero TXNs — inline with the radio group */}
                      <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
                        <input
                          type="checkbox"
                          checked={form.exclude_zero_txns}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, exclude_zero_txns: e.target.checked }))
                          }
                          className="h-3 w-3 accent-primary"
                        />
                        <span className="text-[11px] text-foreground">Exclude Zero TXNs</span>
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Selector area ── */}
        {isAcMode ? (
          /* AC mode: tabbed dual selector */
          <div className="grid gap-2">
            {/* Tab bar */}
            <div className="flex gap-0 border-b border-border">
              {(
                [
                  { key: "primary"   as const, label: primaryTabLabel   },
                  { key: "secondary" as const, label: secondaryTabLabel },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={[
                    "px-4 py-1.5 text-[11px] font-medium transition-colors border-b-2 -mb-px",
                    activeTab === key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {label}
                  {key === "primary" && selectedPrimary.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                      {selectedPrimary.length}
                    </span>
                  )}
                  {key === "secondary" && selectedSecondary.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                      {selectedSecondary.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Primary tab panel */}
            <div className={activeTab === "primary" ? "block" : "hidden"}>
              <SelectorPanel<T>
                availableRows={primaryRows}
                loading={primaryLoading}
                selectedRows={selectedPrimary}
                availableColumns={availablePrimaryColumns}
                selectedColumns={selectedPrimaryColumns}
                valueField={selectorValueField}
                availableLabel={selectorAvailableLabel}
                selectedLabel={selectorSelectedLabel}
                onRowClick={handlePrimaryRowClick}
                onClearAll={() => setSelectedPrimary([])}
              />
            </div>

            {/* Secondary tab panel */}
            <div className={activeTab === "secondary" ? "block" : "hidden"}>
              {secondSelectorValueField && (
                <SelectorPanel<S>
                  availableRows={secondaryRows}
                  loading={secondaryLoading}
                  selectedRows={selectedSecondary}
                  availableColumns={availableSecondaryColumns}
                  selectedColumns={selectedSecondaryColumns}
                  valueField={secondSelectorValueField}
                  availableLabel={secondSelectorAvailableLabel}
                  selectedLabel={secondSelectorSelectedLabel}
                  onRowClick={handleSecondaryRowClick}
                  onClearAll={() => setSelectedSecondary([])}
                />
              )}
            </div>
          </div>
        ) : (
          /* Single mode: original side-by-side selector */
          <SelectorPanel<T>
            availableRows={primaryRows}
            loading={primaryLoading}
            selectedRows={selectedPrimary}
            availableColumns={availablePrimaryColumns}
            selectedColumns={selectedPrimaryColumns}
            valueField={selectorValueField}
            availableLabel={selectorAvailableLabel}
            selectedLabel={selectorSelectedLabel}
            onRowClick={handlePrimaryRowClick}
            onClearAll={() => setSelectedPrimary([])}
          />
        )}

      </section>

      {/* ── Report Dialog ── */}
      {reportHtml !== null && (
        <ReportDialogPage
          title={title}
          Report={HtmlReportRenderer}
          required_values={{ html: reportHtml }}
          excel={handleExcel}
          onClose={() => setReportHtml(null)}
        />
      )}
    </>
  );
}

export default ReportFilterPage;