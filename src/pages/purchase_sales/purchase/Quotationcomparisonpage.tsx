// import { useEffect, useMemo, useState } from "react";
// import {
//   Division,
//   getDivisions,
// } from "../../../api/transactions";
// import { Button } from "../../../components/ui/Button";
// import { Select } from "../../../components/ui/Select";
// import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";
// import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
// import { useAuth } from "../../../state/AuthContext";
// import { formatAmount, numberOrZero, text } from "./Purchaseorderutils";
// import { insertQuotationComparison } from "../../../api/purchaseSales";

// interface QuotationOption {
//   doc_no: string;
//   doc_date?: string;
//   ac_code?: string;
//   ac_name?: string;
// }

// /*
//  * One row of VW_QUOTATION_COMPARISON, as returned by
//  * PS_QUOTATION_ENTRY_DETAIL_COMPARISON for a given comparison_id.
//  */
// interface ComparisonRow {
//   quotation_no: string;
//   prod_code: string;
//   prod_name: string;
//   amount: number;
// }

// export function QuotationComparisonPage({
//   onClose,
// }: {
//   onClose?: () => void;
// } = {}) {
//   const { user } = useAuth();

//   const companyCode = user?.company_code;
//   const loginid = user?.loginid || user?.username || "ADMIN";

//   const [divisions, setDivisions] = useState<Division[]>([]);
//   const [divCode, setDivCode] = useState("");

//   const [quotationOptions, setQuotationOptions] = useState<QuotationOption[]>([]);
//   const [loadingQuotations, setLoadingQuotations] = useState(false);

//   const [selectedDocNos, setSelectedDocNos] = useState<string[]>([]);
//   const [dropdownOpen, setDropdownOpen] = useState(false);

//   const [comparisonId, setComparisonId] = useState<number | null>(null);
//   const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>([]);
//   const [loadingItems, setLoadingItems] = useState(false);
//   const [showComparison, setShowComparison] = useState(false);
//   const [lowestDocNo, setLowestDocNo] = useState<string | null>(null);
//   const [filteredQuotationOptions, setFilteredQuotationOptions] =
//     useState<QuotationOption[]>([]);

//   const [notice, setNotice] = useState<{
//     type: "success" | "error";
//     message: string;
//   } | null>(null);

//   /* Load divisions */
//   useEffect(() => {
//     void getDivisions()
//       .then(setDivisions)
//       .catch(() => setDivisions([]));
//   }, []);

//   /* Load quotations for selected division */
//   useEffect(() => {
//     if (!divCode) {
//       setQuotationOptions([]);
//       return;
//     }

//     let mounted = true;
//     setLoadingQuotations(true);

//     (async () => {
//       try {
//         const response = await getDynamicLookup({
//           parameter: "PS_POORDER_ENTRY_QUOTATION_NO_DETAIL",
//           code1: companyCode,
//           loginid,
//           code2: divCode,
//           code3: "PQO",
//         });
//         if (mounted) {
//           const quotations = (response || []) as unknown as QuotationOption[];

//           setQuotationOptions(quotations);

//           const filtered = await filterQuotationsBySameProducts(quotations);

//           if (mounted) {
//             setFilteredQuotationOptions(filtered);
//           }
//         }
//       } catch {
//         if (mounted) {
//           setQuotationOptions([]);
//           setNotice({ type: "error", message: "Unable to load quotations" });
//         }
//       } finally {
//         if (mounted) setLoadingQuotations(false);
//       }
//     })();

//     return () => {
//       mounted = false;
//     };
//   }, [divCode, companyCode, loginid]);

//   function toggleQuotation(docNo: string) {
//     setSelectedDocNos((prev) =>
//       prev.includes(docNo) ? prev.filter((d) => d !== docNo) : [...prev, docNo]
//     );

//     setLowestDocNo(null);
//     setShowComparison(false);
//     setComparisonId(null);
//     setComparisonRows([]);
//   }

//   /*
//    * Fetch the pivoted comparison rows for a given comparison_id.
//    * Source: VW_QUOTATION_COMPARISON via PS_QUOTATION_ENTRY_DETAIL_COMPARISON,
//    * filtered server-side by COMPANY_CODE + COMPARISON_ID.
//    */
//   async function loadComparisonRows(compId: number) {
//     setLoadingItems(true);

//     try {
//       const details = await getDynamicLookup({
//         parameter: "PS_QUOTATION_ENTRY_DETAIL_COMPARISON",
//         code1: companyCode,
//         code2: String(compId),
//       });

//       const rows: ComparisonRow[] = (details || [])
//         .filter(
//           (item: any) =>
//             Number(getLookupValue(item, "comparison_id")) === compId
//         )
//         .map((item: any) => ({
//           quotation_no: text(getLookupValue(item, "quotation_no")),
//           prod_code: text(getLookupValue(item, "prod_code")),
//           prod_name: text(getLookupValue(item, "prod_name")),
//           amount: numberOrZero(getLookupValue(item, "amount")),
//         }));

//       setComparisonRows(rows);
//     } catch (error) {
//       console.error("Unable to load comparison rows:", error);
//       setComparisonRows([]);
//       setNotice({ type: "error", message: "Unable to load comparison data" });
//     } finally {
//       setLoadingItems(false);
//     }
//   }
//   async function filterQuotationsBySameProducts(
//     quotations: QuotationOption[]
//   ): Promise<QuotationOption[]> {
//     const productSets = await Promise.all(
//       quotations.map(async (quotation) => {
//         const details = await getDynamicLookup({
//           parameter: "PS_QUOTATION_ENTRY_DETAIL_COMPARISON",
//           code1: companyCode,
//           code2: quotation.doc_no,
//         });

//         const products = new Set(
//           (details || []).map((item: any) =>
//             text(getLookupValue(item, "prod_code"))
//           )
//         );

//         return {
//           quotation,
//           products,
//         };
//       })
//     );

//     if (productSets.length === 0) return [];

//     const firstProducts = productSets[0].products;

//     return productSets
//       .filter(({ products }) =>
//         products.size === firstProducts.size &&
//         [...products].every((code) => firstProducts.has(code))
//       )
//       .map(({ quotation }) => quotation);
//   }

//   async function handleDisplayChart() {
//     if (!divCode) {
//       setQuotationOptions([]);
//       setFilteredQuotationOptions([]);
//       return;
//     }

//     if (selectedDocNos.length === 0) {
//       setNotice({ type: "error", message: "Select at least one quotation" });
//       return;
//     }

//     try {
//       setLoadingItems(true);

//       const quotationNos = selectedDocNos.join(",");

//       const result = await insertQuotationComparison({
//         company_code: companyCode || "",
//         div_code: divCode,
//         quotation_nos: quotationNos,
//         user_id: loginid,
//       });

//       if (result?.comparison_id == null) {
//         throw new Error("No comparison_id returned");
//       }

//       const compId = Number(result.comparison_id);
//       setComparisonId(compId);

//       await loadComparisonRows(compId);

//       setShowComparison(true);
//       setNotice({ type: "success", message: "Quotation comparison created successfully" });
//     } catch (error: any) {
//       console.error("Quotation comparison error:", error);
//       setShowComparison(false);
//       setNotice({
//         type: "error",
//         message: error?.message || "Unable to create quotation comparison",
//       });
//     } finally {
//       setLoadingItems(false);
//     }
//   }

//   /*
//    * Pivot comparisonRows into:
//    *  - products: unique prod_code/prod_name, in first-seen order
//    *  - columns: quotation numbers, in selectedDocNos order (only ones present in data)
//    *  - amountByProductAndDoc: lookup for each cell
//    *  - totalsByDocNo: column totals
//    */
//   const {
//     products,
//     columns,
//     amountByProductAndDoc,
//     totalsByDocNo,
//   } = useMemo(() => {
//     const productOrder: string[] = [];
//     const productNames: Record<string, string> = {};
//     const cellMap: Record<string, Record<string, number>> = {};
//     const totals: Record<string, number> = {};
//     const docNosInData = new Set<string>();

//     comparisonRows.forEach((row) => {
//       if (!productNames[row.prod_code]) {
//         productOrder.push(row.prod_code);
//         productNames[row.prod_code] = row.prod_name;
//       }

//       if (!cellMap[row.prod_code]) {
//         cellMap[row.prod_code] = {};
//       }

//       cellMap[row.prod_code][row.quotation_no] = row.amount;
//       totals[row.quotation_no] = (totals[row.quotation_no] || 0) + row.amount;
//       docNosInData.add(row.quotation_no);
//     });

//     const cols = selectedDocNos.filter((d) => docNosInData.has(d));

//     return {
//       products: productOrder.map((code) => ({ code, name: productNames[code] })),
//       columns: cols,
//       amountByProductAndDoc: cellMap,
//       totalsByDocNo: totals,
//     };
//   }, [comparisonRows, selectedDocNos]);

//   /* Items of the lowest quotation only (shown in a separate table) */
//   const lowestItems = useMemo(() => {
//     if (!lowestDocNo) return [];
//     return comparisonRows.filter((row) => row.quotation_no === lowestDocNo);
//   }, [comparisonRows, lowestDocNo]);

//   const lowestQuotationInfo = useMemo(
//     () => quotationOptions.find((q) => q.doc_no === lowestDocNo),
//     [quotationOptions, lowestDocNo]
//   );



//   function handleShowLowest() {
//     if (columns.length < 2) {
//       setNotice({ type: "error", message: "Select at least 2 quotations to compare" });
//       return;
//     }

//     let lowest: string | null = null;
//     let lowestAmt = Infinity;

//     columns.forEach((docNo) => {
//       const total = totalsByDocNo[docNo] ?? 0;
//       if (total < lowestAmt) {
//         lowestAmt = total;
//         lowest = docNo;
//       }
//     });

//     setLowestDocNo(lowest);
//   }

//   return (
//     <section className="grid gap-5 p-5">
//       <div className="finance-list-title border-b pb-3">
//         <h6 className="m-0 text-xl font-semibold tracking-tight">Quotation Comparison</h6>
//         <p className="m-0 mt-1 text-xs text-gray-500">
//           Select a division and quotations to compare item-wise amounts.
//         </p>
//       </div>

//       <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

//       {/* Filters */}
//       <div className="grid gap-4 rounded-lg border bg-white p-4 shadow-sm md:grid-cols-2">
//         <label className="field flex flex-col gap-1">
//           <span className="text-xs font-semibold text-foreground/75">Division</span>
//           <Select
//             value={divCode}
//             onChange={(e) => {
//               setDivCode(e.target.value);
//               setSelectedDocNos([]);
//               setComparisonRows([]);
//               setLowestDocNo(null);
//               setShowComparison(false);
//               setComparisonId(null);
//             }}
//           >
//             <option value="">Select division</option>
//             {divisions.map((d) => (
//               <option key={d.div_code} value={d.div_code}>
//                 {d.div_name}
//               </option>
//             ))}
//           </Select>
//         </label>

//         <div className="relative flex flex-col gap-1">
//           <span className="text-xs font-semibold text-foreground/75">Quotations</span>

//           <button
//             type="button"
//             className="flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left text-sm disabled:bg-gray-50 disabled:text-gray-400"
//             onClick={() => setDropdownOpen((open) => !open)}
//             disabled={!divCode}
//           >
//             <span className="truncate text-gray-700">
//               {selectedDocNos.length === 0 ? "Select quotations..." : `${selectedDocNos.length} selected`}
//             </span>
//             <span className="ml-2 text-gray-400">▾</span>
//           </button>

//           {dropdownOpen && (
//             <div className="absolute top-full z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
//               {loadingQuotations && (
//                 <div className="px-3 py-2 text-xs text-gray-400">Loading...</div>
//               )}

//               {!loadingQuotations && quotationOptions.length === 0 && (
//                 <div className="px-3 py-2 text-xs text-gray-400">No quotations found</div>
//               )}

//               {filteredQuotationOptions.map((q) => (
//                 <label
//                   key={q.doc_no}
//                   className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
//                 >
//                   <input
//                     type="checkbox"
//                     checked={selectedDocNos.includes(q.doc_no)}
//                     onChange={() => toggleQuotation(q.doc_no)}
//                   />
//                   <span>
//                     {q.doc_no}
//                     {q.doc_date ? ` — ${q.doc_date}` : ""}
//                   </span>
//                 </label>
//               ))}
//             </div>
//           )}
//         </div>

//         {selectedDocNos.length > 0 && (
//           <div className="flex flex-wrap items-center gap-2 md:col-span-2">
//             {selectedDocNos.map((docNo) => (
//               <span
//                 key={docNo}
//                 className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
//               >
//                 {docNo}
//                 <button
//                   type="button"
//                   className="text-blue-500 hover:text-blue-800"
//                   onClick={() => toggleQuotation(docNo)}
//                 >
//                   ×
//                 </button>
//               </span>
//             ))}
//           </div>
//         )}

//         {selectedDocNos.length > 0 && (
//           <div className="md:col-span-2">
//             <Button type="button" onClick={handleDisplayChart} className="w-fit">
//               Display Chart
//             </Button>
//           </div>
//         )}
//       </div>

//       {/* Comparison table */}
//       {showComparison && (
//         <div className="rounded-lg border bg-white shadow-sm">
//           <div className="flex items-center justify-between border-b px-4 py-3">
//             <h6 className="m-0 text-sm font-semibold">Item-wise Comparison</h6>
//             {comparisonId !== null && (
//               <span className="text-xs text-gray-500">Comparison ID: {comparisonId}</span>
//             )}
//           </div>

//           {loadingItems ? (
//             <p className="p-4 text-sm text-gray-500">Loading items...</p>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="w-full border-collapse text-xs">
//                 <thead>
//                   <tr className="border-b bg-gray-50 text-left text-gray-600">
//                     <th className="px-4 py-2 font-semibold">Product</th>
//                     {columns.map((docNo) => (
//                       <th key={docNo} className="px-4 py-2 text-right font-semibold">
//                         {docNo}
//                       </th>
//                     ))}
//                   </tr>
//                 </thead>

//                 <tbody>
//                   {products.map((p) => (
//                     <tr key={p.code} className="border-b last:border-b-0 hover:bg-gray-50">
//                       <td className="px-4 py-2">{p.name || p.code}</td>
//                       {columns.map((docNo) => (
//                         <td key={docNo} className="px-4 py-2 text-right tabular-nums">
//                           {formatAmount(amountByProductAndDoc[p.code]?.[docNo] ?? 0)}
//                         </td>
//                       ))}
//                     </tr>
//                   ))}
//                 </tbody>

//                 <tfoot>
//                   <tr className="border-t-2 bg-gray-50 font-semibold">
//                     <td className="px-4 py-2 text-right">Total</td>
//                     {columns.map((docNo) => (
//                       <td key={docNo} className="px-4 py-2 text-right tabular-nums">
//                         {formatAmount(totalsByDocNo[docNo] || 0)}
//                       </td>
//                     ))}
//                   </tr>
//                 </tfoot>
//               </table>
//             </div>
//           )}
//         </div>
//       )}

//       {showComparison && !loadingItems && columns.length >= 2 && (
//         <Button type="button" onClick={handleShowLowest} className="w-fit">
//           Show Lowest Quotation
//         </Button>
//       )}

//       {/* Lowest quotation table (separate) */}
//       {showComparison && lowestDocNo && (
//         <div className="rounded-lg border bg-white shadow-sm">
//           <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
//             <h6 className="m-0 text-sm font-semibold">Lowest Quotation</h6>
//             <div className="text-xs text-gray-600">
//               <span className="font-semibold">{lowestDocNo}</span>
//               {lowestQuotationInfo?.ac_name ? ` — ${lowestQuotationInfo.ac_name}` : ""}
//             </div>
//           </div>

//           <div className="overflow-x-auto">
//             <table className="w-full border-collapse text-xs">
//               <thead>
//                 <tr className="border-b bg-gray-50 text-left text-gray-600">
//                   <th className="w-12 px-4 py-2 font-semibold">#</th>
//                   <th className="px-4 py-2 font-semibold">Product Code</th>
//                   <th className="px-4 py-2 font-semibold">Product</th>
//                   <th className="px-4 py-2 text-right font-semibold">Amount</th>
//                 </tr>
//               </thead>

//               <tbody>
//                 {lowestItems.map((row, index) => (
//                   <tr
//                     key={`${row.prod_code}-${index}`}
//                     className="border-b last:border-b-0 hover:bg-gray-50"
//                   >
//                     <td className="px-4 py-2 text-gray-500">{index + 1}</td>
//                     <td className="px-4 py-2">{row.prod_code}</td>
//                     <td className="px-4 py-2">{row.prod_name}</td>
//                     <td className="px-4 py-2 text-right tabular-nums">
//                       {formatAmount(row.amount)}
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>

//               <tfoot>
//                 <tr className="border-t-2 bg-gray-50 font-semibold">
//                   <td colSpan={3} className="px-4 py-2 text-right">
//                     Total
//                   </td>
//                   <td className="px-4 py-2 text-right tabular-nums">
//                     {formatAmount(totalsByDocNo[lowestDocNo] || 0)}
//                   </td>
//                 </tr>
//               </tfoot>
//             </table>
//           </div>
//         </div>
//       )}
//     </section>
//   );
// }


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
  const [filteredQuotationOptions, setFilteredQuotationOptions] =
    useState<QuotationOption[]>([]);

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
      setFilteredQuotationOptions([]);
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
          code3: "PQO",
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
      .filter(({ products }) =>
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

  /* ---------- presentation helpers (no business logic) ---------- */

  const fmtDate = (d?: string) => {
    if (!d) return "";
    const [y, m, day] = d.slice(0, 10).split("-");
    return y && m && day ? `${day}-${m}-${y}` : d;
  };

  const supplierOf = (docNo: string) =>
    quotationOptions.find((q) => q.doc_no === docNo)?.ac_name || "";

  const quotedCount = (docNo: string) =>
    products.filter((p) => (amountByProductAndDoc[p.code]?.[docNo] ?? 0) > 0).length;

  /* Cheapest quoted (non-zero) amount in a product row, to flag the best price per item */
  const bestInRow = (code: string) => {
    const vals = columns
      .map((d) => amountByProductAndDoc[code]?.[d] ?? 0)
      .filter((v) => v > 0);
    return vals.length > 1 ? Math.min(...vals) : null;
  };

  const lowestTotal = lowestDocNo ? totalsByDocNo[lowestDocNo] ?? 0 : 0;

  return (
    <section className="min-h-full bg-slate-50 p-6">
      {/* Page header */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-slate-900">
            Quotation comparison
          </h1>
          <p className="m-0 mt-1 text-sm text-slate-500">
            Compare supplier quotations item by item and pick the best offer.
          </p>
        </div>

        {showComparison && comparisonId !== null && (
          <span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
            Comparison <span className="font-semibold text-slate-900">#{comparisonId}</span>
          </span>
        )}
      </header>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <div className="mt-4 grid gap-6">
        {/* ============ TOP: selection bar ============ */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid items-end gap-5 lg:grid-cols-[280px_minmax(0,1fr)_auto]">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-600">Division</span>
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

            <div className="relative flex min-w-0 flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-600">Quotations</span>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm disabled:bg-slate-50 disabled:text-slate-400"
                onClick={() => setDropdownOpen((open) => !open)}
                disabled={!divCode}
              >
                <span className="truncate text-slate-700">
                  {selectedDocNos.length === 0
                    ? "Select quotations..."
                    : `${selectedDocNos.length} selected`}
                </span>
                <span className="ml-2 text-slate-400">▾</span>
              </button>

              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                    {loadingQuotations && (
                      <div className="px-3 py-2 text-xs text-slate-400">Loading...</div>
                    )}

                    {!loadingQuotations && filteredQuotationOptions.length === 0 && (
                      <div className="px-3 py-2 text-xs text-slate-400">
                        No quotations found
                      </div>
                    )}

                    {filteredQuotationOptions.map((q) => (
                      <label
                        key={q.doc_no}
                        className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-blue-800"
                          checked={selectedDocNos.includes(q.doc_no)}
                          onChange={() => toggleQuotation(q.doc_no)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-slate-900">
                            {q.doc_no}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {[q.ac_name, fmtDate(q.doc_date)].filter(Boolean).join("  |  ")}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="invisible text-xs">.</span>
              <Button
                type="button"
                onClick={handleDisplayChart}
                disabled={selectedDocNos.length === 0 || loadingItems}
                className="w-full lg:w-auto"
              >
                {loadingItems ? "Comparing..." : "Compare quotations"}
              </Button>
            </div>
          </div>

          {selectedDocNos.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {selectedDocNos.map((docNo) => (
                <span
                  key={docNo}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
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

        {/* ============ RESULTS ============ */}
        <div className="grid min-w-0 gap-6">
          {!showComparison && (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 text-center">
              <p className="m-0 text-base font-medium text-slate-800">
                No comparison yet
              </p>
              <p className="m-0 mt-1 max-w-sm text-sm text-slate-500">
                Pick a division, tick two or more quotations above, then choose
                Compare quotations.
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
                      className={`rounded-xl border bg-white p-4 ${
                        isLowest
                          ? "border-emerald-500 ring-1 ring-emerald-500"
                          : "border-slate-200"
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
                            {"  |  +"}
                            {formatAmount(diff)} vs lowest
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Comparison matrix */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 className="m-0 text-sm font-semibold text-slate-900">
                      Item-wise comparison
                    </h2>
                    <p className="m-0 mt-0.5 text-xs text-slate-500">
                      Best price per item is highlighted. A dash means the item was not
                      quoted.
                    </p>
                  </div>

                  {!loadingItems && columns.length >= 2 && (
                    <Button type="button" onClick={handleShowLowest} className="w-fit">
                      Find lowest quotation
                    </Button>
                  )}
                </div>

                {loadingItems ? (
                  <p className="m-0 p-6 text-sm text-slate-500">Loading items...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-xs text-slate-600">
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
                              className="border-t border-slate-100 hover:bg-slate-50/70"
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
                                const amt = amountByProductAndDoc[p.code]?.[docNo] ?? 0;
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
                                    } ${lowestDocNo === docNo ? "bg-emerald-50/50" : ""}`}
                                  >
                                    {amt === 0 ? "-" : formatAmount(amt)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>

                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50">
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
                <div className="overflow-hidden rounded-xl border border-emerald-300 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-4">
                    <div>
                      <h2 className="m-0 text-sm font-semibold text-emerald-900">
                        Lowest quotation
                      </h2>
                      <p className="m-0 mt-0.5 text-xs text-emerald-800/80">
                        {lowestDocNo}
                        {lowestQuotationInfo?.ac_name
                          ? `  |  ${lowestQuotationInfo.ac_name}`
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
                        <tr className="bg-slate-50 text-left text-xs text-slate-600">
                          <th className="w-14 px-5 py-3 font-semibold">Sl</th>
                          <th className="px-5 py-3 font-semibold">Product code</th>
                          <th className="px-5 py-3 font-semibold">Product</th>
                          <th className="px-5 py-3 text-right font-semibold">Amount</th>
                        </tr>
                      </thead>

                      <tbody>
                        {lowestItems.map((row, index) => (
                          <tr
                            key={`${row.prod_code}-${index}`}
                            className="border-t border-slate-100 hover:bg-slate-50/70"
                          >
                            <td className="px-5 py-3 text-slate-400">{index + 1}</td>
                            <td className="px-5 py-3 text-slate-700">{row.prod_code}</td>
                            <td className="px-5 py-3 text-slate-900">{row.prod_name}</td>
                            <td className="px-5 py-3 text-right tabular-nums text-slate-900">
                              {formatAmount(row.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50">
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