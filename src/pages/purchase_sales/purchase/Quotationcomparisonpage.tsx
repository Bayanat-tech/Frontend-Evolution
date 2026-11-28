import { useEffect, useMemo, useState } from "react";
import {
  Division,
  getDivisions,
} from "../../../api/transactions";
import { Button } from "../../../components/ui/Button";
import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";
// NOTE: use the same import path as your Purchase GRN form
import { DivisionPickerDialog } from "../../../components/ui/DivisionPickerDialog";
// NOTE: use the same import path as your Job No form
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { formatAmount, numberOrZero, text } from "./Purchaseorderutils";
import { insertQuotationComparison } from "../../../api/purchaseSales";

interface QuotationOption {
  doc_no: string;
  doc_date?: string;
  ac_code?: string;
  ac_name?: string;
}

/*
 * One row of VW_QUOTATION_COMPARISON, as returned by
 * PS_QUOTATION_ENTRY_DETAIL_COMPARISON for a given comparison_id.
 */
interface ComparisonRow {
  quotation_no: string;
  prod_code: string;
  prod_name: string;
  amount: number;
}

/* <input type="date"> gives YYYY-MM-DD, Oracle expects DD-MM-YYYY. Empty stays empty. */
const toOracleDate = (v: string) => {
  if (!v) return "";
  const [y, m, d] = v.split("-");
  return `${d}-${m}-${y}`;
};

export function QuotationComparisonPage({
  onClose,
}: {
  onClose?: () => void;
} = {}) {
  const { user } = useAuth();

  const companyCode = user?.company_code;
  const loginid = user?.loginid || user?.username || "ADMIN";

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [divCode, setDivCode] = useState("");
  /* Division picker opens as soon as the page opens */
  const [divisionPicker, setDivisionPicker] = useState(true);

  /* dates are optional */
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [prNo, setPrNo] = useState("");

  const [quotationOptions, setQuotationOptions] = useState<QuotationOption[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);

  const [selectedDocNos, setSelectedDocNos] = useState<string[]>([]);

  const [comparisonId, setComparisonId] = useState<number | null>(null);
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [lowestDocNo, setLowestDocNo] = useState<string | null>(null);
  const [filteredQuotationOptions, setFilteredQuotationOptions] =
    useState<QuotationOption[]>([]);

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  /* a range is only invalid when both dates are set and From is after To */
  const rangeOk = !(fromDate && toDate && fromDate > toDate);

  const divName =
    divisions.find((d) => d.div_code === divCode)?.div_name || divCode;

  /* Load divisions */
  useEffect(() => {
    void getDivisions()
      .then(setDivisions)
      .catch(() => setDivisions([]));
  }, []);

  /* Load quotations once a PR is selected */
  useEffect(() => {
    if (!divCode || !prNo) {
      setQuotationOptions([]);
      setFilteredQuotationOptions([]);
      return;
    }

    let mounted = true;
    setLoadingQuotations(true);

    (async () => {
      try {
        const response = await getDynamicLookup({
          parameter: "PS_QUOTATION_ENTRY_PR_DETAIL",
          code1: companyCode,
          loginid,
          code2: divCode,
          code3: "PQO",
          code4: prNo,
        });

        if (mounted) {
          const quotations = (response || []) as unknown as QuotationOption[];

          setQuotationOptions(quotations);

          const filtered = await filterQuotationsBySameProducts(quotations);

          if (mounted) {
            setFilteredQuotationOptions(filtered);
          }
        }
      } catch {
        if (mounted) {
          setQuotationOptions([]);
          setFilteredQuotationOptions([]);
          setNotice({ type: "error", message: "Unable to load quotations" });
        }
      } finally {
        if (mounted) setLoadingQuotations(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [divCode, companyCode, loginid, prNo]);

  /* Reset everything downstream of the filters */
  function resetResults() {
    setSelectedDocNos([]);
    setComparisonRows([]);
    setLowestDocNo(null);
    setShowComparison(false);
    setComparisonId(null);
  }

  /* Set division (from picker or lookup) and reset everything downstream */
  function changeDivision(code: string) {
    setDivCode(code);
    setPrNo("");
    resetResults();
  }

  /* date change -> PR + quotation lists change, so reset PR/selection/results */
  function changeDates(from: string, to: string) {
    setFromDate(from);
    setToDate(to);
    setPrNo("");
    resetResults();

    if (from && to && from > to) {
      setNotice({ type: "error", message: "From date cannot be after To date" });
    }
  }

  /* PR change -> quotation list changes, so reset selection/results */
  function changePr(value: string) {
    setPrNo(value);
    resetResults();
  }

  function addQuotation(docNo: string) {
    if (!docNo) return;
    setSelectedDocNos((prev) =>
      prev.includes(docNo) ? prev : [...prev, docNo]
    );
    setLowestDocNo(null);
    setShowComparison(false);
    setComparisonId(null);
    setComparisonRows([]);
  }

  function removeQuotation(docNo: string) {
    setSelectedDocNos((prev) => prev.filter((d) => d !== docNo));
    setLowestDocNo(null);
    setShowComparison(false);
    setComparisonId(null);
    setComparisonRows([]);
  }

  /*
   * Fetch the pivoted comparison rows for a given comparison_id.
   * Source: VW_QUOTATION_COMPARISON via PS_QUOTATION_ENTRY_DETAIL_COMPARISON,
   * filtered server-side by COMPANY_CODE + COMPARISON_ID.
   */
  async function loadComparisonRows(compId: number) {
    setLoadingItems(true);

    try {
      const details = await getDynamicLookup({
        parameter: "PS_QUOTATION_ENTRY_DETAIL_COMPARISON",
        code1: companyCode,
        code2: String(compId),
      });

      const rows: ComparisonRow[] = (details || [])
        .filter(
          (item: any) =>
            Number(getLookupValue(item, "comparison_id")) === compId
        )
        .map((item: any) => ({
          quotation_no: text(getLookupValue(item, "quotation_no")),
          prod_code: text(getLookupValue(item, "prod_code")),
          prod_name: text(getLookupValue(item, "prod_name")),
          amount: numberOrZero(getLookupValue(item, "amount")),
        }));

      setComparisonRows(rows);
    } catch (error) {
      console.error("Unable to load comparison rows:", error);
      setComparisonRows([]);
      setNotice({ type: "error", message: "Unable to load comparison data" });
    } finally {
      setLoadingItems(false);
    }
  }

  async function filterQuotationsBySameProducts(
    quotations: QuotationOption[]
  ): Promise<QuotationOption[]> {
    const productSets = await Promise.all(
      quotations.map(async (quotation) => {
        const details = await getDynamicLookup({
          parameter: "PS_QUOTATION_ENTRY_DETAIL_COMPARISON",
          code1: companyCode,
          code2: quotation.doc_no,
        });

        const products = new Set(
          (details || []).map((item: any) =>
            text(getLookupValue(item, "prod_code"))
          )
        );

        return {
          quotation,
          products,
        };
      })
    );

    if (productSets.length === 0) return [];

    const firstProducts = productSets[0].products;

    return productSets
      .filter(
        ({ products }) =>
          products.size === firstProducts.size &&
          [...products].every((code) => firstProducts.has(code))
      )
      .map(({ quotation }) => quotation);
  }

  async function handleDisplayChart() {
    if (!divCode) {
      setNotice({ type: "error", message: "Please select division" });
      return;
    }

    if (selectedDocNos.length < 2) {
      setNotice({
        type: "error",
        message: "Select at least two quotations to compare",
      });
      return;
    }

    try {
      setLoadingItems(true);

      const quotationNos = selectedDocNos.join(",");

      const result = await insertQuotationComparison({
        company_code: companyCode || "",
        div_code: divCode,
        quotation_nos: quotationNos,
        user_id: loginid,
      });

      if (result?.comparison_id == null) {
        throw new Error("No comparison_id returned");
      }

      const compId = Number(result.comparison_id);
      setComparisonId(compId);

      await loadComparisonRows(compId);

      setShowComparison(true);
      setNotice({
        type: "success",
        message: "Quotation comparison created successfully",
      });
    } catch (error: any) {
      console.error("Quotation comparison error:", error);
      setShowComparison(false);
      setNotice({
        type: "error",
        message: error?.message || "Unable to create quotation comparison",
      });
    } finally {
      setLoadingItems(false);
    }
  }

  /*
   * Pivot comparisonRows into:
   *  - products: unique prod_code/prod_name, in first-seen order
   *  - columns: quotation numbers, in selectedDocNos order (only ones present in data)
   *  - amountByProductAndDoc: lookup for each cell
   *  - totalsByDocNo: column totals
   */
  const {
    products,
    columns,
    amountByProductAndDoc,
    totalsByDocNo,
  } = useMemo(() => {
    const productOrder: string[] = [];
    const productNames: Record<string, string> = {};
    const cellMap: Record<string, Record<string, number>> = {};
    const totals: Record<string, number> = {};
    const docNosInData = new Set<string>();

    comparisonRows.forEach((row) => {
      if (!productNames[row.prod_code]) {
        productOrder.push(row.prod_code);
        productNames[row.prod_code] = row.prod_name;
      }

      if (!cellMap[row.prod_code]) {
        cellMap[row.prod_code] = {};
      }

      cellMap[row.prod_code][row.quotation_no] = row.amount;
      totals[row.quotation_no] = (totals[row.quotation_no] || 0) + row.amount;
      docNosInData.add(row.quotation_no);
    });

    const cols = selectedDocNos.filter((d) => docNosInData.has(d));

    return {
      products: productOrder.map((code) => ({
        code,
        name: productNames[code],
      })),
      columns: cols,
      amountByProductAndDoc: cellMap,
      totalsByDocNo: totals,
    };
  }, [comparisonRows, selectedDocNos]);

  /* Items of the lowest quotation only (shown in a separate table) */
  const lowestItems = useMemo(() => {
    if (!lowestDocNo) return [];
    return comparisonRows.filter((row) => row.quotation_no === lowestDocNo);
  }, [comparisonRows, lowestDocNo]);

  const lowestQuotationInfo = useMemo(
    () => quotationOptions.find((q) => q.doc_no === lowestDocNo),
    [quotationOptions, lowestDocNo]
  );

  function handleShowLowest() {
    if (columns.length < 2) {
      setNotice({
        type: "error",
        message: "Select at least 2 quotations to compare",
      });
      return;
    }

    let lowest: string | null = null;
    let lowestAmt = Infinity;

    columns.forEach((docNo) => {
      const total = totalsByDocNo[docNo] ?? 0;
      if (total < lowestAmt) {
        lowestAmt = total;
        lowest = docNo;
      }
    });

    setLowestDocNo(lowest);
  }

  /* ---------- presentation helpers (no business logic) ---------- */

  const fmtDate = (d?: string) => {
    if (!d) return "";
    const [y, m, day] = d.slice(0, 10).split("-");
    return y && m && day ? `${day}-${m}-${y}` : d;
  };

  const supplierOf = (docNo: string) =>
    quotationOptions.find((q) => q.doc_no === docNo)?.ac_name || "";

  const quotedCount = (docNo: string) =>
    products.filter((p) => (amountByProductAndDoc[p.code]?.[docNo] ?? 0) > 0)
      .length;

  /* Cheapest quoted (non-zero) amount in a product row, to flag the best price per item */
  const bestInRow = (code: string) => {
    const vals = columns
      .map((d) => amountByProductAndDoc[code]?.[d] ?? 0)
      .filter((v) => v > 0);
    return vals.length > 1 ? Math.min(...vals) : null;
  };

  const lowestTotal = lowestDocNo ? totalsByDocNo[lowestDocNo] ?? 0 : 0;

  /* CHANGED: one bordered group holding both date inputs */
  const dateGroupClass = `flex h-[38px] w-full items-center rounded-lg border bg-white shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 ${
    !divCode ? "cursor-not-allowed bg-slate-50" : ""
  } ${rangeOk ? "border-slate-200" : "border-rose-400"}`;

  const dateInnerClass =
    "h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-700 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-400";

  return (
    <section className="min-h-full bg-slate-50/80 p-5 md:p-6">
      <DivisionPickerDialog
        open={divisionPicker}
        divisions={divisions}
        description="Choose the division before opening the Quotation comparison."
        onSelect={(division) => {
          changeDivision(division.div_code);
          setDivisionPicker(false);
        }}
        onClose={() => {
          setDivisionPicker(false);
          /* closed without choosing a division -> leave the page */
          if (!divCode) onClose?.();
        }}
      />

      {/* Page header */}
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-slate-900">
            Quotation comparison
          </h1>
          <p className="m-0 mt-1 text-sm text-slate-500">
            Compare supplier quotations item by item and pick the best offer.
          </p>
        </div>

        {showComparison && comparisonId !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
            Comparison
            <span className="font-semibold text-slate-900">#{comparisonId}</span>
          </span>
        )}
      </header>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <div className="mt-4 grid gap-5">
        {/* ============ TOP: selection bar ============ */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
          {/* CHANGED: 5 columns - the two date columns became one group column */}
          <div className="grid items-end gap-4 lg:grid-cols-[minmax(160px,1fr)_minmax(280px,1.4fr)_minmax(140px,0.9fr)_minmax(200px,1.2fr)_auto]">
            {/* Division */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-600">
                Division
              </span>
              <LookupField
                title="Division"
                key={`div-${divisions.length}`}
                label="Division"
                compact
                placeholder="Select division"
                value={divCode}
                displayValue={divName}
                columns={[
                  { field: "div_code", header: "Code" },
                  { field: "div_name", header: "Division" },
                ]}
                valueField="div_code"
                displayFields={["div_code", "div_name"]}
                loadOptions={async () => divisions as any}
                onChange={(value) => changeDivision(text(value))}
              />
            </label>

            {/* CHANGED: From + To date grouped together */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-600">
                Date range
              </span>
              <div className={dateGroupClass}>
                <input
                  type="date"
                  aria-label="From date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => changeDates(e.target.value, toDate)}
                  disabled={!divCode}
                  className={dateInnerClass}
                />
                <span className="shrink-0 px-1 text-xs font-medium text-slate-400">
                  to
                </span>
                <input
                  type="date"
                  aria-label="To date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => changeDates(fromDate, e.target.value)}
                  disabled={!divCode}
                  className={dateInnerClass}
                />
              </div>
            </div>

            {/* PR */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-600">
                Purchase Request (PR)
              </span>
              <LookupField
                key={`pr-${divCode}-${fromDate}-${toDate}`}
                label="PR"
                compact
                placeholder="Select PR"
                value={prNo}
                displayValue={prNo}
                columns={[{ field: "pr_req_no", header: "PR No" }]}
                valueField="pr_req_no"
                displayFields={["pr_req_no"]}
                loadOptions={() =>
                  getDynamicLookup({
                    parameter: "PS_QUOTATION_ENTRY_PR",
                    loginid,
                    code1: companyCode,
                    code2: divCode,
                    code3: toOracleDate(fromDate),
                    code4: toOracleDate(toDate),
                  })
                }
                disabled={!divCode || !rangeOk}
                onChange={(value) => changePr(text(value))}
              />
            </label>

            {/* Quotations — LookupField with search; select adds to multi list */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-600">
                Quotations
              </span>
              <LookupField
                key={`quo-${prNo}-${filteredQuotationOptions.length}`}
                label="Quotations"
                compact
                multiSelect
                placeholder={
                  !prNo
                    ? "Select PR first"
                    : loadingQuotations
                    ? "Loading..."
                    : "Search & add quotation..."
                }
                value=""
                displayValue=""
                columns={[
                  { field: "doc_no", header: "Quotation No" },
                  { field: "ac_name", header: "Supplier" },
                  { field: "doc_date", header: "Date" },
                ]}
                valueField="doc_no"
                displayFields={["doc_no", "ac_name"]}
                loadOptions={async () =>
                  filteredQuotationOptions.map((q) => ({
                    ...q,
                    doc_date: fmtDate(q.doc_date),
                  })) as any
                }
                disabled={!divCode || !prNo || loadingQuotations}
                onChange={(value) => {
                  const docNo = text(value);
                  if (docNo) addQuotation(docNo);
                }}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="invisible text-xs">.</span>
              <Button
                type="button"
                onClick={handleDisplayChart}
                disabled={selectedDocNos.length < 2 || loadingItems}
                className="h-[38px] w-full whitespace-nowrap lg:w-auto"
              >
                {loadingItems ? "Comparing..." : "Compare quotations"}
              </Button>
            </div>
          </div>

          {/* Selected quotation chips */}
          {selectedDocNos.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <span className="mr-1 text-xs font-medium text-slate-500">
                Selected ({selectedDocNos.length}):
              </span>
              {selectedDocNos.map((docNo) => {
                const info = quotationOptions.find((q) => q.doc_no === docNo);
                return (
                  <span
                    key={docNo}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-blue-50 pl-2.5 pr-1.5 py-1 text-xs text-blue-800 ring-1 ring-blue-100"
                  >
                    <span className="truncate font-medium">{docNo}</span>
                    {info?.ac_name && (
                      <span className="hidden truncate text-blue-600/80 sm:inline">
                        · {info.ac_name}
                      </span>
                    )}
                    <button
                      type="button"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-blue-500 transition hover:bg-blue-100 hover:text-blue-800"
                      onClick={() => removeQuotation(docNo)}
                      aria-label={`Remove ${docNo}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              {selectedDocNos.length >= 2 && (
                <span className="ml-auto text-xs text-emerald-600">
                  Ready to compare
                </span>
              )}
            </div>
          )}
        </div>

        {/* ============ RESULTS ============ */}
        <div className="grid min-w-0 gap-5">
          {!showComparison && (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                  />
                </svg>
              </div>
              <p className="m-0 text-base font-medium text-slate-800">
                No comparison yet
              </p>
              <p className="m-0 mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">
                Select a division and a PR (dates optional), search and add at
                least two quotations, then click{" "}
                <span className="font-medium text-slate-700">
                  Compare quotations
                </span>
                .
              </p>
            </div>
          )}

          {showComparison && (
            <>
              {/* Supplier summary cards */}
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                {columns.map((docNo) => {
                  const isLowest = lowestDocNo === docNo;
                  const total = totalsByDocNo[docNo] || 0;
                  const diff = lowestDocNo ? total - lowestTotal : 0;

                  return (
                    <div
                      key={docNo}
                      className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
                        isLowest
                          ? "border-emerald-400 ring-2 ring-emerald-500/20"
                          : "border-slate-200/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="m-0 truncate text-sm font-semibold text-slate-900">
                            {docNo}
                          </p>
                          <p className="m-0 mt-0.5 truncate text-xs text-slate-500">
                            {supplierOf(docNo) || "Supplier not available"}
                          </p>
                        </div>
                        {isLowest && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                            Lowest
                          </span>
                        )}
                      </div>

                      <p className="m-0 mt-4 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
                        {formatAmount(total)}
                      </p>

                      <p className="m-0 mt-1 text-xs text-slate-500">
                        {quotedCount(docNo)} of {products.length} items quoted
                        {lowestDocNo && !isLowest && diff > 0 && (
                          <span className="text-rose-600">
                            {"  ·  +"}
                            {formatAmount(diff)} vs lowest
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Comparison matrix */}
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 className="m-0 text-sm font-semibold text-slate-900">
                      Item-wise comparison
                    </h2>
                    <p className="m-0 mt-0.5 text-xs text-slate-500">
                      Best price per item is highlighted. A dash means the item
                      was not quoted.
                    </p>
                  </div>

                  {!loadingItems && columns.length >= 2 && (
                    <Button
                      type="button"
                      onClick={handleShowLowest}
                      className="w-fit"
                    >
                      Find lowest quotation
                    </Button>
                  )}
                </div>

                {loadingItems ? (
                  <p className="m-0 p-6 text-sm text-slate-500">
                    Loading items...
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50/80 text-left text-xs text-slate-600">
                          <th className="px-5 py-3 font-semibold">Product</th>
                          {columns.map((docNo) => (
                            <th
                              key={docNo}
                              className={`px-5 py-3 text-right font-semibold ${
                                lowestDocNo === docNo ? "text-emerald-800" : ""
                              }`}
                            >
                              {docNo}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {products.map((p) => {
                          const best = bestInRow(p.code);
                          return (
                            <tr
                              key={p.code}
                              className="border-t border-slate-100 hover:bg-slate-50/60"
                            >
                              <td className="px-5 py-3">
                                <span className="block text-slate-900">
                                  {p.name || p.code}
                                </span>
                                <span className="block text-xs text-slate-400">
                                  {p.code}
                                </span>
                              </td>

                              {columns.map((docNo) => {
                                const amt =
                                  amountByProductAndDoc[p.code]?.[docNo] ?? 0;
                                const isBest = best !== null && amt === best;

                                return (
                                  <td
                                    key={docNo}
                                    className={`px-5 py-3 text-right tabular-nums ${
                                      amt === 0
                                        ? "text-slate-300"
                                        : isBest
                                        ? "font-semibold text-emerald-700"
                                        : "text-slate-800"
                                    } ${
                                      lowestDocNo === docNo
                                        ? "bg-emerald-50/40"
                                        : ""
                                    }`}
                                  >
                                    {amt === 0 ? "—" : formatAmount(amt)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>

                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                          <td className="px-5 py-3 text-sm font-semibold text-slate-900">
                            Total
                          </td>
                          {columns.map((docNo) => (
                            <td
                              key={docNo}
                              className={`px-5 py-3 text-right text-sm font-semibold tabular-nums ${
                                lowestDocNo === docNo
                                  ? "text-emerald-800"
                                  : "text-slate-900"
                              }`}
                            >
                              {formatAmount(totalsByDocNo[docNo] || 0)}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Lowest quotation detail */}
              {lowestDocNo && (
                <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/80 px-5 py-4">
                    <div>
                      <h2 className="m-0 text-sm font-semibold text-emerald-900">
                        Lowest quotation
                      </h2>
                      <p className="m-0 mt-0.5 text-xs text-emerald-800/80">
                        {lowestDocNo}
                        {lowestQuotationInfo?.ac_name
                          ? `  ·  ${lowestQuotationInfo.ac_name}`
                          : ""}
                      </p>
                    </div>
                    <p className="m-0 text-xl font-semibold tabular-nums text-emerald-900">
                      {formatAmount(totalsByDocNo[lowestDocNo] || 0)}
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50/80 text-left text-xs text-slate-600">
                          <th className="w-14 px-5 py-3 font-semibold">Sl</th>
                          <th className="px-5 py-3 font-semibold">
                            Product code
                          </th>
                          <th className="px-5 py-3 font-semibold">Product</th>
                          <th className="px-5 py-3 text-right font-semibold">
                            Amount
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {lowestItems.map((row, index) => (
                          <tr
                            key={`${row.prod_code}-${index}`}
                            className="border-t border-slate-100 hover:bg-slate-50/60"
                          >
                            <td className="px-5 py-3 text-slate-400">
                              {index + 1}
                            </td>
                            <td className="px-5 py-3 text-slate-700">
                              {row.prod_code}
                            </td>
                            <td className="px-5 py-3 text-slate-900">
                              {row.prod_name}
                            </td>
                            <td className="px-5 py-3 text-right tabular-nums text-slate-900">
                              {formatAmount(row.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                          <td
                            colSpan={3}
                            className="px-5 py-3 text-right text-sm font-semibold text-slate-900"
                          >
                            Total
                          </td>
                          <td className="px-5 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                            {formatAmount(totalsByDocNo[lowestDocNo] || 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}