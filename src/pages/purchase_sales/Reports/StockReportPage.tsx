// "use client";

// import { useCallback, useEffect, useRef, useState } from "react";
// import { CalendarDays, Eye, Package, X } from "lucide-react";
// import { useAuth } from "../../../state/AuthContext";
// import { getDynamicLookup, LookupRow } from "../../../api/lookups";
// import { getStockSummaryReportExcel, getStockSummaryReportHtml, getStockTransactionReportExcel, getStockTransactionReportHtml } from "../../../api/transactions";
// import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
// import { Button } from "../../../components/ui/Button";
// import { BiscDatePicker } from "../../../components/ui/BiscDatePicker";
// import { MultiSelectField, type MultiSelectOption } from "../../../components/ui/MultiSelectField";
// import { PurchaseReportPreview } from "./Purchasereportpreview";
// import { openPurchaseReport } from "./PurchaseReportPreviewState";

// interface StockReportParams {
//     loginid: string;
//     company_code: string;
//     fromdate: string;
//     todate: string;
//     prod_code: string;
//     report_type: "SUMMARY" | "TRANSACTION";
//     [key: string]: any;
// }

// const LOOKUP_PARAMS = {
//     prodCode: "PURSALES_STOCK_PRODUCT_19082026",
// } as const;

// // ── Helpers ────────────────────────────────────────────────────────────────
// function toApiCodeString(values: string[]) {
//     return values.length ? values.join(",") : "All";
// }

// function toInputDate(value: string) {
//     if (!value) return "";
//     if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
//     const d = new Date(value);
//     return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
// }

// function toDisplayDate(value: string) {
//     const v = toInputDate(value);
//     if (!v) return "";
//     const [y, m, d] = v.split("-");
//     return `${d}/${m}/${y}`;
// }

// function firstExisting(row: LookupRow, key: string) {
//     return row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
// }

// function useStockLookup(
//     parameter: string,
//     companyCode: string,
//     valueField: string,
//     nameField: string,
//     loginId: string
// ) {
//     const [options, setOptions] = useState<MultiSelectOption[]>([]);
//     const [loading, setLoading] = useState(false);

//     useEffect(() => {
//         let alive = true;
//         setLoading(true);
//         getDynamicLookup({
//             parameter,
//             loginid: loginId,
//             code1: companyCode,
//             code2: "", code3: "", code4: "",
//             number1: 0, number2: 0, number3: 0, number4: 0,
//             date1: null, date2: null, date3: null, date4: null,
//         })
//             .then((rows) => {
//                 if (!alive) return;
//                 const safeRows = Array.isArray(rows) ? rows : [];
//                 setOptions(
//                     safeRows
//                         .map((row: LookupRow) => {
//                             const value = String(firstExisting(row, valueField) ?? "");
//                             const name = nameField ? String(firstExisting(row, nameField) ?? "") : "";
//                             return { value, label: name && name !== value ? `${value} - ${name}` : value };
//                         })
//                         .filter((x) => x.value)
//                 );
//             })
//             .catch(() => alive && setOptions([]))
//             .finally(() => alive && setLoading(false));
//         return () => { alive = false; };
//     }, [parameter, companyCode, valueField, nameField, loginId]);

//     return { options, loading };
// }

// // ── Page ───────────────────────────────────────────────────────────────────
// export default function StockReportPage() {
//     const { user } = useAuth();
//     const companyCode = user?.company_code ?? "";
//     const loginId = user?.loginid ?? user?.username ?? "ADMIN";

//     const [fromDate, setFromDate] = useState("");
//     const [toDate, setToDate] = useState("");
//     const [prodCodes, setProdCodes] = useState<string[]>([]);
//     const [loading, setLoading] = useState(false);
//     const [error, setError] = useState("");
//     const [message, setMessage] = useState("Select filters and run the report.");
//     const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
//     const lastRequestRef = useRef<StockReportParams | null>(null);

//     const [reportType, setReportType] = useState<"SUMMARY" | "TRANSACTION">("SUMMARY");

//     // NOTE: change "prod_code" / "prod_name" to the actual column names returned by the lookup
//     const prodLookup = useStockLookup(LOOKUP_PARAMS.prodCode, companyCode, "prod_code", "prod_name", loginId);

//     const companyName: string =
//         (user as any)?.company_name || (user as any)?.COMPANY_NAME || companyCode;



//     const dateRangeValid = !fromDate || !toDate || fromDate <= toDate;

//     const prodDisplay =
//         prodCodes.length === 0
//             ? "All products"
//             : prodCodes.length === 1
//                 ? prodLookup.options.find((x) => x.value === prodCodes[0])?.label || prodCodes[0]
//                 : `${prodCodes.length} products selected`;

//     const buildRequestParams = useCallback((): StockReportParams => ({
//         loginid: loginId,
//         company_code: companyCode,
//         fromdate: fromDate || "All",
//         todate: toDate || "All",
//         prod_code: toApiCodeString(prodCodes),
//         report_type: reportType,
//     }), [companyCode, fromDate, loginId, prodCodes, toDate, reportType]);
//     const fetchReport = useCallback(async (params: StockReportParams) => {
//         setLoading(true);
//         setError("");
//         setMessage("");
//         lastRequestRef.current = params;

//         const isSummary = params.report_type === "SUMMARY";
// const reportTitle = isSummary ? "Stock Summary Report" : "Stock Transaction Report";
// const preview = openPurchaseReport(reportTitle);
//         const fetchHtml = isSummary ? getStockSummaryReportHtml : getStockTransactionReportHtml;
//         const fetchExcel = isSummary ? getStockSummaryReportExcel : getStockTransactionReportExcel;

//         try {
//             const html = await fetchHtml(params);

//             preview.ready({
//                 html,
//                 filename: `stock_${isSummary ? "summary" : "transaction"}_${new Date().toISOString().slice(0, 10)}`,
//                 orientation: "landscape",
//                 // stripChrome: true,
//                 onExcel: async () => {
//                     await fetchExcel(params);
//                 },
//             });

//             setHasGeneratedReport(true);
//             setMessage("Report generated successfully.");
//         } catch (err: any) {
//             const msg = err?.message || "Failed to load report. Please try again.";
//             preview.fail(new Error(msg));
//             setError(msg);
//             setMessage(msg);
//         } finally {
//             setLoading(false);
//         }
//     }, []);

//     function handleGenerate() {
//         if (!dateRangeValid) return;
//         void fetchReport(buildRequestParams());
//     }

//     function handleReset() {
//         setFromDate("");
//         setToDate("");
//         setProdCodes([]);
//         setError("");
//         setMessage("Select filters and run the report.");
//         setHasGeneratedReport(false);
//     }

//     return (
//         <section className="freight-ui-standard freight-report-screen">
//             <div className="freight-report-card">
//                 <div className="freight-report-titlebar">
//                     <h1>Stock Report</h1>
//                     <span className="freight-report-title-dot" aria-hidden="true" />
//                 </div>

//                 <ReportFilterHeader onClear={handleReset} />

//                 {error && (
//                     <div className="mx-3 mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">⚠️ {error}</div>
//                 )}
//                 {!dateRangeValid && (
//                     <div className="mx-3 mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">From date must be on or before To date.</div>
//                 )}

//                 <div className="freight-report-summary grid grid-cols-1 gap-2 border-b bg-muted/10 p-3 md:grid-cols-2">
//                     <SummaryStripItem
//                         icon={CalendarDays}
//                         label="Period"
//                         value={`${toDisplayDate(fromDate) || "Start"} – ${toDisplayDate(toDate) || "Today"}`}
//                     />
//                     <SummaryStripItem icon={Package} label="Prod Code" value={prodDisplay} />
//                 </div>
//                 <div className="freight-report-fields grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
//                     <MultiSelectField
//                         className="freight-report-multi-select"
//                         label="Prod Code"
//                         options={prodLookup.options}
//                         loading={prodLookup.loading}
//                         value={prodCodes}
//                         onChange={setProdCodes}
//                     />
//                     <Field label="From">
//                         <ClearableDate value={fromDate} onClear={() => setFromDate("")}>
//                             <BiscDatePicker value={toInputDate(fromDate)} onChange={setFromDate} />
//                         </ClearableDate>
//                     </Field>
//                     <Field label="To">
//                         <ClearableDate value={toDate} onClear={() => setToDate("")}>
//                             <BiscDatePicker value={toInputDate(toDate)} onChange={setToDate} />
//                         </ClearableDate>
//                     </Field>

//                     <Field label="Report Type">
//                         <div
//                             role="radiogroup"
//                             aria-label="Report type"
//                             className="flex items-center gap-6 rounded-md px-3 shadow-sm"
//                             style={{ border: "1px solid #aebdce", background: "#f4f7fb", height: 31, paddingTop: 1, paddingBottom: 1 }}
//                         >
//                             {[
//                                 { value: "SUMMARY" as const, label: "Summary" },
//                                 { value: "TRANSACTION" as const, label: "Transaction" },
//                             ].map((opt) => {
//                                 const active = reportType === opt.value;
//                                 return (
//                                     <button
//                                         key={opt.value}
//                                         type="button"
//                                         role="radio"
//                                         aria-checked={active}
//                                         onClick={() => setReportType(opt.value)}
//                                         className="flex cursor-pointer select-none items-center gap-2 whitespace-nowrap normal-case"
//                                     >
//                                         <span
//                                             className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${active ? "border-blue-600" : "border-gray-300"
//                                                 }`}
//                                         >
//                                             {active && <span className="h-2 w-2 rounded-full bg-blue-600" />}
//                                         </span>
//                                         <span className={`text-sm font-normal ${active ? "text-blue-700" : "text-foreground"}`}>
//                                             {opt.label}
//                                         </span>
//                                     </button>
//                                 );
//                             })}
//                         </div>
//                     </Field>
//                 </div>




//                 <div className="freight-report-actions flex items-center justify-end gap-2">
//                     <Button type="button" size="sm" onClick={handleGenerate} disabled={loading || !dateRangeValid}>
//                         <Eye size={14} /> {loading ? "Generating..." : "Generate Report"}
//                     </Button>
//                 </div>

//                 {hasGeneratedReport && <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p>}
//             </div>

//             <PurchaseReportPreview />
//         </section>
//     );
// }

// function Field({ label, children }: { label: string; children: React.ReactNode }) {
//     return (
//         <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
//             {label}
//             {children}
//         </label>
//     );
// }

// function SummaryStripItem({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
//     return (
//         <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 shadow-sm">
//             <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon size={16} /></span>
//             <div className="min-w-0 leading-tight">
//                 <div className="text-[9.5px] font-bold uppercase tracking-wider text-primary/70">{label}</div>
//                 <div className="truncate text-[13px] font-semibold text-slate-800" title={value}>{value}</div>
//             </div>
//         </div>
//     );
// }

// function ClearableDate({
//     value,
//     onClear,
//     children,
// }: {
//     value: string;
//     onClear: () => void;
//     children: React.ReactNode;
// }) {
//     return (
//         <div className="relative">
//             {children}
//             {value && (
//                 <button
//                     type="button"
//                     aria-label="Clear date"
//                     title="Clear"
//                     onClick={(e) => {
//                         e.preventDefault();
//                         e.stopPropagation();
//                         onClear();
//                     }}
//                     className="absolute right-9 top-1/2 z-10 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-black transition-colors hover:bg-slate-200"
//                 >
//                     <X size={14} strokeWidth={2.5} />
//                 </button>
//             )}
//         </div>
//     );
// }

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Eye, Package, X } from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookup, LookupRow } from "../../../api/lookups";
import { getStockSummaryReportExcel, getStockSummaryReportHtml, getStockTransactionReportExcel, getStockTransactionReportHtml } from "../../../api/transactions";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { Button } from "../../../components/ui/Button";
import { BiscDatePicker } from "../../../components/ui/BiscDatePicker";
import { MultiSelectField, type MultiSelectOption } from "../../../components/ui/MultiSelectField";
import { PurchaseReportPreview } from "./Purchasereportpreview";
import { openPurchaseReport } from "./PurchaseReportPreviewState";

interface StockReportParams {
    loginid: string;
    company_code: string;
    fromdate: string;
    todate: string;
    prod_code: string;
    report_type: "SUMMARY" | "TRANSACTION";
    [key: string]: any;
}

type GroupBy = "GROUP" | "BRAND" | "CATEGORY" | "TYPE" | "MANUFACTURER" | "SEASON";
type ReportOption = "DETAILED" | "SUMMARY" | "RESERVED";

// TODO: confirm every lookup parameter name + column names against your Oracle package.
const LOOKUP_PARAMS = {
    prodCode: "PURSALES_STOCK_PRODUCT_19082026",
    division: "PURSALES_STOCK_DIVISION_19082026",
    group: "PURSALES_STOCK_GROUP_19082026",
    brand: "PURSALES_STOCK_BRAND_19082026",
    category: "PURSALES_STOCK_CATEGORY_19082026",
    type: "PURSALES_STOCK_TYPE_19082026",
    manufacturer: "PURSALES_STOCK_MANUFACTURER_19082026",
    season: "PURSALES_STOCK_SEASON_19082026",
} as const;

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
    { value: "GROUP", label: "Product Group" },
    { value: "BRAND", label: "Product Brand" },
    { value: "CATEGORY", label: "Product Category" },
    { value: "TYPE", label: "Product Type" },
    { value: "MANUFACTURER", label: "Product Manufacturer" },
    { value: "SEASON", label: "Season" },
];

const REPORT_OPTIONS: { value: ReportOption; label: string }[] = [
    { value: "DETAILED", label: "Detailed" },
    { value: "SUMMARY", label: "Summary" },
    { value: "RESERVED", label: "Reserved" },
];

const QTY_FILTER_OPTIONS = [
    { value: "All", label: "All" },
    { value: "<>0", label: "<>0" },
    { value: "=0", label: "=0" },
    { value: ">0", label: ">0" },
    { value: "<0", label: "<0" },
];

const INVENTORY_OPTIONS = [
    { value: "All", label: "All" },
    { value: "Y", label: "Inventory" },
    { value: "N", label: "Non-Inventory" },
];

const ACTIVE_OPTIONS = [
    { value: "All", label: "All" },
    { value: "Y", label: "Y" },
    { value: "N", label: "N" },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function toApiCodeString(values: string[]) {
    return values.length ? values.join(",") : "All";
}

function toInputDate(value: string) {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function toDisplayDate(value: string) {
    const v = toInputDate(value);
    if (!v) return "";
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
}

function firstExisting(row: LookupRow, key: string) {
    return row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
}

function useStockLookup(
    parameter: string,
    companyCode: string,
    valueField: string,
    nameField: string,
    loginId: string
) {
    const [options, setOptions] = useState<MultiSelectOption[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        getDynamicLookup({
            parameter,
            loginid: loginId,
            code1: companyCode,
            code2: "", code3: "", code4: "",
            number1: 0, number2: 0, number3: 0, number4: 0,
            date1: null, date2: null, date3: null, date4: null,
        })
            .then((rows) => {
                if (!alive) return;
                const safeRows = Array.isArray(rows) ? rows : [];
                setOptions(
                    safeRows
                        .map((row: LookupRow) => {
                            const value = String(firstExisting(row, valueField) ?? "");
                            const name = nameField ? String(firstExisting(row, nameField) ?? "") : "";
                            return { value, label: name && name !== value ? `${value} - ${name}` : value };
                        })
                        .filter((x) => x.value)
                );
            })
            .catch(() => alive && setOptions([]))
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [parameter, companyCode, valueField, nameField, loginId]);

    return { options, loading };
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function StockReportPage() {
    const { user } = useAuth();
    const companyCode = user?.company_code ?? "";
    const loginId = user?.loginid ?? user?.username ?? "ADMIN";

    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [prodCodes, setProdCodes] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("Select filters and run the report.");
    const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
    const lastRequestRef = useRef<StockReportParams | null>(null);

    const [reportType, setReportType] = useState<"SUMMARY" | "TRANSACTION">("SUMMARY");

    // New filters (from legacy Stock Report screen, column criteria excluded)
    const [divisionCodes, setDivisionCodes] = useState<string[]>([]);
    const [groupCodes, setGroupCodes] = useState<string[]>([]);
    const [brandCodes, setBrandCodes] = useState<string[]>([]);
    const [categoryCodes, setCategoryCodes] = useState<string[]>([]);
    const [typeCodes, setTypeCodes] = useState<string[]>([]);
    const [manufacturerCodes, setManufacturerCodes] = useState<string[]>([]);
    const [seasonCodes, setSeasonCodes] = useState<string[]>([]);
    const [groupBy, setGroupBy] = useState<GroupBy>("GROUP");
    const [reportOption, setReportOption] = useState<ReportOption>("DETAILED");
    const [qtyFilter, setQtyFilter] = useState("<>0");
    const [inventory, setInventory] = useState("All");
    const [active, setActive] = useState("Y");
    const [sortByName, setSortByName] = useState(false);

    // NOTE: change "prod_code" / "prod_name" to the actual column names returned by the lookup
    const prodLookup = useStockLookup(LOOKUP_PARAMS.prodCode, companyCode, "prod_code", "prod_name", loginId);
    const divisionLookup = useStockLookup(LOOKUP_PARAMS.division, companyCode, "div_code", "div_name", loginId);
    const groupLookup = useStockLookup(LOOKUP_PARAMS.group, companyCode, "group_code", "group_name", loginId);
    const brandLookup = useStockLookup(LOOKUP_PARAMS.brand, companyCode, "brand_code", "brand_name", loginId);
    const categoryLookup = useStockLookup(LOOKUP_PARAMS.category, companyCode, "category_code", "category_name", loginId);
    const typeLookup = useStockLookup(LOOKUP_PARAMS.type, companyCode, "type_code", "type_name", loginId);
    const manufacturerLookup = useStockLookup(LOOKUP_PARAMS.manufacturer, companyCode, "manufacturer_code", "manufacturer_name", loginId);
    const seasonLookup = useStockLookup(LOOKUP_PARAMS.season, companyCode, "season_code", "season_name", loginId);

    const companyName: string =
        (user as any)?.company_name || (user as any)?.COMPANY_NAME || companyCode;



    const dateRangeValid = !fromDate || !toDate || fromDate <= toDate;

    const prodDisplay =
        prodCodes.length === 0
            ? "All products"
            : prodCodes.length === 1
                ? prodLookup.options.find((x) => x.value === prodCodes[0])?.label || prodCodes[0]
                : `${prodCodes.length} products selected`;

    const buildRequestParams = useCallback((): StockReportParams => ({
        loginid: loginId,
        company_code: companyCode,
        fromdate: fromDate || "All",
        todate: toDate || "All",
        prod_code: toApiCodeString(prodCodes),
        report_type: reportType,
        div_code: toApiCodeString(divisionCodes),
        group_code: toApiCodeString(groupCodes),
        brand_code: toApiCodeString(brandCodes),
        category_code: toApiCodeString(categoryCodes),
        type_code: toApiCodeString(typeCodes),
        manufacturer_code: toApiCodeString(manufacturerCodes),
        season_code: toApiCodeString(seasonCodes),
        group_by: groupBy,
        report_option: reportOption,
        qty_filter: qtyFilter,
        inventory,
        active,
        sort_by_name: sortByName ? "Y" : "N",
    }), [
        companyCode, fromDate, loginId, prodCodes, toDate, reportType,
        divisionCodes, groupCodes, brandCodes, categoryCodes, typeCodes, manufacturerCodes, seasonCodes,
        groupBy, reportOption, qtyFilter, inventory, active, sortByName,
    ]);
    const fetchReport = useCallback(async (params: StockReportParams) => {
        setLoading(true);
        setError("");
        setMessage("");
        lastRequestRef.current = params;

        const isSummary = params.report_type === "SUMMARY";
        const reportTitle = isSummary ? "Stock Summary Report" : "Stock Transaction Report";
        const preview = openPurchaseReport(reportTitle);
        const fetchHtml = isSummary ? getStockSummaryReportHtml : getStockTransactionReportHtml;
        const fetchExcel = isSummary ? getStockSummaryReportExcel : getStockTransactionReportExcel;

        try {
            const html = await fetchHtml(params);

            preview.ready({
                html,
                filename: `stock_${isSummary ? "summary" : "transaction"}_${new Date().toISOString().slice(0, 10)}`,
                orientation: "landscape",
                // stripChrome: true,
                onExcel: async () => {
                    await fetchExcel(params);
                },
            });

            setHasGeneratedReport(true);
            setMessage("Report generated successfully.");
        } catch (err: any) {
            const msg = err?.message || "Failed to load report. Please try again.";
            preview.fail(new Error(msg));
            setError(msg);
            setMessage(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    function handleGenerate() {
        if (!dateRangeValid) return;
        void fetchReport(buildRequestParams());
    }

    function handleReset() {
        setFromDate("");
        setToDate("");
        setProdCodes([]);
        setDivisionCodes([]);
        setGroupCodes([]);
        setBrandCodes([]);
        setCategoryCodes([]);
        setTypeCodes([]);
        setManufacturerCodes([]);
        setSeasonCodes([]);
        setGroupBy("GROUP");
        setReportOption("DETAILED");
        setQtyFilter("<>0");
        setInventory("All");
        setActive("Y");
        setSortByName(false);
        setError("");
        setMessage("Select filters and run the report.");
        setHasGeneratedReport(false);
    }

    return (
        <section className="freight-ui-standard freight-report-screen">
            <div className="freight-report-card">
                <div className="freight-report-titlebar">
                    <h1>Stock Report</h1>
                    <span className="freight-report-title-dot" aria-hidden="true" />
                </div>

                <ReportFilterHeader onClear={handleReset} />
                <div className="md:col-span-2 xl:col-span-2">
                    <RadioField label="Group By" value={groupBy} options={GROUP_BY_OPTIONS} onChange={setGroupBy} wrap />
                </div>
                {error && (
                    <div className="mx-3 mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">⚠️ {error}</div>
                )}
                {!dateRangeValid && (
                    <div className="mx-3 mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">From date must be on or before To date.</div>
                )}

                <div className="freight-report-summary grid grid-cols-1 gap-2 border-b bg-muted/10 p-3 md:grid-cols-2">
                    <SummaryStripItem
                        icon={CalendarDays}
                        label="Period"
                        value={`${toDisplayDate(fromDate) || "Start"} – ${toDisplayDate(toDate) || "Today"}`}
                    />
                    <SummaryStripItem icon={Package} label="Prod Code" value={prodDisplay} />
                </div>
                <div className="freight-report-fields grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
                     <Field label="From">
                        <ClearableDate value={fromDate} onClear={() => setFromDate("")}>
                            <BiscDatePicker value={toInputDate(fromDate)} onChange={setFromDate} />
                        </ClearableDate>
                    </Field>
                    <Field label="To">
                        <ClearableDate value={toDate} onClear={() => setToDate("")}>
                            <BiscDatePicker value={toInputDate(toDate)} onChange={setToDate} />
                        </ClearableDate>
                    </Field>

                    <MultiSelectField
                        className="freight-report-multi-select"
                        label="Division"
                        options={divisionLookup.options}
                        loading={divisionLookup.loading}
                        value={divisionCodes}
                        onChange={setDivisionCodes}
                    />
                    <MultiSelectField
                        className="freight-report-multi-select"
                        label="Prod Code"
                        options={prodLookup.options}
                        loading={prodLookup.loading}
                        value={prodCodes}
                        onChange={setProdCodes}
                    />
                    <MultiSelectField
                        className="freight-report-multi-select"
                        label="Product Group"
                        options={groupLookup.options}
                        loading={groupLookup.loading}
                        value={groupCodes}
                        onChange={setGroupCodes}
                    />
                    <MultiSelectField
                        className="freight-report-multi-select"
                        label="Brand"
                        options={brandLookup.options}
                        loading={brandLookup.loading}
                        value={brandCodes}
                        onChange={setBrandCodes}
                    />
                    <MultiSelectField
                        className="freight-report-multi-select"
                        label="Category"
                        options={categoryLookup.options}
                        loading={categoryLookup.loading}
                        value={categoryCodes}
                        onChange={setCategoryCodes}
                    />
                    <MultiSelectField
                        className="freight-report-multi-select"
                        label="Type"
                        options={typeLookup.options}
                        loading={typeLookup.loading}
                        value={typeCodes}
                        onChange={setTypeCodes}
                    />
                    <MultiSelectField
                        className="freight-report-multi-select"
                        label="Manufacturer"
                        options={manufacturerLookup.options}
                        loading={manufacturerLookup.loading}
                        value={manufacturerCodes}
                        onChange={setManufacturerCodes}
                    />
                    <MultiSelectField
                        className="freight-report-multi-select"
                        label="Season"
                        options={seasonLookup.options}
                        loading={seasonLookup.loading}
                        value={seasonCodes}
                        onChange={setSeasonCodes}
                    />
                   
                    <Field label="Report Type">
                        <div
                            role="radiogroup"
                            aria-label="Report type"
                            className="flex items-center gap-6 rounded-md px-3 shadow-sm"
                            style={{ border: "1px solid #aebdce", background: "#f4f7fb", height: 31, paddingTop: 1, paddingBottom: 1 }}
                        >
                            {[
                                { value: "SUMMARY" as const, label: "Summary" },
                                { value: "TRANSACTION" as const, label: "Transaction" },
                            ].map((opt) => {
                                const active = reportType === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => setReportType(opt.value)}
                                        className="flex cursor-pointer select-none items-center gap-2 whitespace-nowrap normal-case"
                                    >
                                        <span
                                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${active ? "border-blue-600" : "border-gray-300"
                                                }`}
                                        >
                                            {active && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                                        </span>
                                        <span className={`text-sm font-normal ${active ? "text-blue-700" : "text-foreground"}`}>
                                            {opt.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </Field>

                    {/* <RadioField label="Option" value={reportOption} options={REPORT_OPTIONS} onChange={setReportOption} /> */}


                    {/* 
                    <SelectField label="Filter" value={qtyFilter} options={QTY_FILTER_OPTIONS} onChange={setQtyFilter} />
                    <SelectField label="Inventory" value={inventory} options={INVENTORY_OPTIONS} onChange={setInventory} />
                    <SelectField label="Active" value={active} options={ACTIVE_OPTIONS} onChange={setActive} /> */}

                    {/* <Field label="Sort">
                        <div
                            className="flex items-center rounded-md px-3 shadow-sm"
                            style={{ border: "1px solid #aebdce", background: "#f4f7fb", height: 31 }}
                        >
                            <button
                                type="button"
                                role="checkbox"
                                aria-checked={sortByName}
                                onClick={() => setSortByName((v) => !v)}
                                className="flex cursor-pointer select-none items-center gap-2 whitespace-nowrap normal-case"
                            >
                                <span
                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${sortByName ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"
                                        }`}
                                >
                                    {sortByName && <span className="text-[10px] leading-none">✓</span>}
                                </span>
                                <span className={`text-sm font-normal ${sortByName ? "text-blue-700" : "text-foreground"}`}>
                                    Sort by Product Name
                                </span>
                            </button>
                        </div>
                    </Field> */}
                </div>




                <div className="freight-report-actions flex items-center justify-end gap-2">
                    <Button type="button" size="sm" onClick={handleGenerate} disabled={loading || !dateRangeValid}>
                        <Eye size={14} /> {loading ? "Generating..." : "Generate Report"}
                    </Button>
                </div>

                {hasGeneratedReport && <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p>}
            </div>

            <PurchaseReportPreview />
        </section>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
            {label}
            {children}
        </label>
    );
}

function RadioField<T extends string>({
    label,
    value,
    options,
    onChange,
    wrap = false,
}: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
    wrap?: boolean;
}) {
    return (
        <Field label={label}>
            <div
                role="radiogroup"
                aria-label={label}
                className={`flex items-center rounded-md px-3 shadow-sm ${wrap ? "flex-wrap gap-x-5 gap-y-1 py-1" : "gap-6"}`}
                style={{ border: "1px solid #aebdce", background: "#f4f7fb", minHeight: 31 }}
            >
                {options.map((opt) => {
                    const isActive = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            onClick={() => onChange(opt.value)}
                            className="flex cursor-pointer select-none items-center gap-2 whitespace-nowrap normal-case"
                        >
                            <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isActive ? "border-blue-600" : "border-gray-300"
                                    }`}
                            >
                                {isActive && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                            </span>
                            <span className={`text-sm font-normal ${isActive ? "text-blue-700" : "text-foreground"}`}>
                                {opt.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </Field>
    );
}

function SelectField({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
}) {
    return (
        <Field label={label}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="rounded-md px-3 text-sm font-normal normal-case text-foreground shadow-sm"
                style={{ border: "1px solid #aebdce", background: "#f4f7fb", height: 31 }}
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </Field>
    );
}

function SummaryStripItem({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
    return (
        <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 shadow-sm">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon size={16} /></span>
            <div className="min-w-0 leading-tight">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-primary/70">{label}</div>
                <div className="truncate text-[13px] font-semibold text-slate-800" title={value}>{value}</div>
            </div>
        </div>
    );
}

function ClearableDate({
    value,
    onClear,
    children,
}: {
    value: string;
    onClear: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="relative">
            {children}
            {value && (
                <button
                    type="button"
                    aria-label="Clear date"
                    title="Clear"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onClear();
                    }}
                    className="absolute right-9 top-1/2 z-10 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-black transition-colors hover:bg-slate-200"
                >
                    <X size={14} strokeWidth={2.5} />
                </button>
            )}
        </div>
    );
}