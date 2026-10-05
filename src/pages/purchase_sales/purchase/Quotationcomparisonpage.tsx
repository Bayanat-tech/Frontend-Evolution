import { useEffect, useMemo, useState } from "react";
import {
  Division,
  getDivisions,
} from "../../../api/transactions";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";
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

  const [quotationOptions, setQuotationOptions] = useState<QuotationOption[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);

  const [selectedDocNos, setSelectedDocNos] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [comparisonId, setComparisonId] = useState<number | null>(null);
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [lowestDocNo, setLowestDocNo] = useState<string | null>(null);

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  /* Load divisions */
  useEffect(() => {
    void getDivisions()
      .then(setDivisions)
      .catch(() => setDivisions([]));
  }, []);

  /* Load quotations for selected division */
  useEffect(() => {
    if (!divCode) {
      setQuotationOptions([]);
      return;
    }

    let mounted = true;
    setLoadingQuotations(true);

    (async () => {
      try {
        const response = await getDynamicLookup({
          parameter: "PS_POORDER_ENTRY_QUOTATION_NO_DETAIL",
          code1: companyCode,
          loginid,
          code2: divCode,
          code3: "PQA",
        });

        if (mounted) {
          setQuotationOptions((response || []) as unknown as QuotationOption[]);
        }
      } catch {
        if (mounted) {
          setQuotationOptions([]);
          setNotice({ type: "error", message: "Unable to load quotations" });
        }
      } finally {
        if (mounted) setLoadingQuotations(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [divCode, companyCode, loginid]);

  function toggleQuotation(docNo: string) {
    setSelectedDocNos((prev) =>
      prev.includes(docNo) ? prev.filter((d) => d !== docNo) : [...prev, docNo]
    );

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

  async function handleDisplayChart() {
    if (!divCode) {
      setNotice({ type: "error", message: "Please select division" });
      return;
    }

    if (selectedDocNos.length === 0) {
      setNotice({ type: "error", message: "Select at least one quotation" });
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
      setNotice({ type: "success", message: "Quotation comparison created successfully" });
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
      products: productOrder.map((code) => ({ code, name: productNames[code] })),
      columns: cols,
      amountByProductAndDoc: cellMap,
      totalsByDocNo: totals,
    };
  }, [comparisonRows, selectedDocNos]);

  function handleShowLowest() {
    if (columns.length < 2) {
      setNotice({ type: "error", message: "Select at least 2 quotations to compare" });
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

  return (
    <section className="grid gap-4 p-4">
      <div className="finance-list-title">
        <h6 className="m-0 text-xl font-semibold tracking-tight">Quotation Comparison</h6>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="field flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold text-foreground/75">Division</span>
          <Select
            value={divCode}
            onChange={(e) => {
              setDivCode(e.target.value);
              setSelectedDocNos([]);
              setComparisonRows([]);
              setLowestDocNo(null);
              setShowComparison(false);
              setComparisonId(null);
            }}
          >
            <option value="">Select division</option>
            {divisions.map((d) => (
              <option key={d.div_code} value={d.div_code}>
                {d.div_name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="relative w-full max-w-md">
        <span className="text-[9px] font-semibold text-foreground/75">Select Quotations</span>

        <button
          type="button"
          className="mt-0.5 flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400"
          onClick={() => setDropdownOpen((open) => !open)}
          disabled={!divCode}
        >
          <span className="truncate text-gray-700">
            {selectedDocNos.length === 0 ? "Select quotations..." : `${selectedDocNos.length} selected`}
          </span>
          <span className="ml-2 text-gray-400">▾</span>
        </button>

        {dropdownOpen && (
          <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-white shadow-lg">
            {loadingQuotations && (
              <div className="px-3 py-2 text-xs text-gray-400">Loading...</div>
            )}

            {!loadingQuotations && quotationOptions.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">No quotations found</div>
            )}

            {quotationOptions.map((q) => (
              <label
                key={q.doc_no}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedDocNos.includes(q.doc_no)}
                  onChange={() => toggleQuotation(q.doc_no)}
                />
                <span>
                  {q.doc_no}
                  {q.doc_date ? ` — ${q.doc_date}` : ""}
                </span>
              </label>
            ))}
          </div>
        )}

        {selectedDocNos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedDocNos.map((docNo) => (
              <span
                key={docNo}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700"
              >
                {docNo}
                <button
                  type="button"
                  className="text-blue-500 hover:text-blue-800"
                  onClick={() => toggleQuotation(docNo)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {selectedDocNos.length > 0 && (
        <Button type="button" onClick={handleDisplayChart} className="w-fit">
          Display Chart
        </Button>
      )}

      {showComparison && comparisonId !== null && (
        <div className="text-xs text-gray-500">Comparison ID: {comparisonId}</div>
      )}

      {showComparison &&
        (loadingItems ? (
          <p className="text-sm text-gray-500">Loading items...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-1 pr-2">Product</th>
                  {columns.map((docNo) => (
                    <th
                      key={docNo}
                      className={`py-1 px-2 text-right ${
                        lowestDocNo === docNo ? "text-emerald-700" : ""
                      }`}
                    >
                      {docNo}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {products.map((p) => (
                  <tr key={p.code} className="border-t">
                    <td className="py-1 pr-2">{p.name || p.code}</td>
                    {columns.map((docNo) => (
                      <td
                        key={docNo}
                        className={`py-1 px-2 text-right ${
                          lowestDocNo === docNo ? "bg-emerald-50" : ""
                        }`}
                      >
                        {formatAmount(amountByProductAndDoc[p.code]?.[docNo] ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="py-1 pr-2 text-right">Total</td>
                  {columns.map((docNo) => (
                    <td
                      key={docNo}
                      className={`py-1 px-2 text-right ${
                        lowestDocNo === docNo ? "text-emerald-700" : ""
                      }`}
                    >
                      {formatAmount(totalsByDocNo[docNo] || 0)}
                      {lowestDocNo === docNo && " (Lowest)"}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        ))}

      {showComparison && columns.length >= 2 && (
        <Button type="button" onClick={handleShowLowest} className="w-fit">
          Show Lowest Quotation
        </Button>
      )}
    </section>
  );
}