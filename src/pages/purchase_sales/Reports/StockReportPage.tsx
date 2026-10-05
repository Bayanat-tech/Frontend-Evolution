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

const LOOKUP_PARAMS = {
    prodCode: "PURSALES_STOCK_PRODUCT_19082026",
} as const;

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

    // NOTE: change "prod_code" / "prod_name" to the actual column names returned by the lookup
    const prodLookup = useStockLookup(LOOKUP_PARAMS.prodCode, companyCode, "prod_code", "prod_name", loginId);

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
    }), [companyCode, fromDate, loginId, prodCodes, toDate, reportType]);
    const fetchReport = useCallback(async (params: StockReportParams) => {
        setLoading(true);
        setError("");
        setMessage("");
        lastRequestRef.current = params;

        const preview = openPurchaseReport("Stock Report");

        const isSummary = params.report_type === "SUMMARY";
        const fetchHtml = isSummary ? getStockSummaryReportHtml : getStockTransactionReportHtml;
        const fetchExcel = isSummary ? getStockSummaryReportExcel : getStockTransactionReportExcel;

        try {
            const html = await fetchHtml(params);

            preview.ready({
                html,
                filename: `stock_${isSummary ? "summary" : "transaction"}_${new Date().toISOString().slice(0, 10)}`,
                orientation: "landscape",
                stripChrome: true,
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
                    <MultiSelectField
                        className="freight-report-multi-select"
                        label="Prod Code"
                        options={prodLookup.options}
                        loading={prodLookup.loading}
                        value={prodCodes}
                        onChange={setProdCodes}
                    />
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