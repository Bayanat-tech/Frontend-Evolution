// PrRegisterOldPage.tsx
"use client";

import React, { useState, useRef, useCallback } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookup } from "../../../api/lookups";
import { LookupField } from "../../../components/ui/LookupField";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { NewReportDialog } from "../../../components/new_report_format";
import {
    getPrRegisterOldSummaryReportHtml,
    getPrRegisterOldSummaryReportExcel,
    getPrRegisterOldDetailReportHtml,
    getPrRegisterOldDetailReportExcel,
} from "../../../api/transactions";
import { openPurchaseReport } from "./PurchaseReportPreviewState";
import { PurchaseReportPreview } from "./Purchasereportpreview";
import { BiscDatePicker } from "../../../components/ui/BiscDatePicker";
import { toInputDate } from "../../../hooks/apiDate";

interface PrRegisterOldParams {
    loginid: string;
    company_code: string;
    fromdate: string;
    todate: string;
    user_id: string;
    search_text: string;
    status: string;
    report_type: string;
    [key: string]: any;
}

// Display Value -> Data Value, from the Status lookup grid
const STATUS_OPTIONS: { displayValue: string; dataValue: string }[] = [
    { displayValue: "ALL", dataValue: "All" },
    { displayValue: "PENDING", dataValue: "PENDING" },
    { displayValue: "APPROVED", dataValue: "APPROVED" },
    { displayValue: "REJECTED", dataValue: "REJECTED" },
];

// ─── Field wrapper + DateField (same as PoOrderRegisterPage) ───────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
            {label}
            {children}
        </label>
    );
}

function DateField({ value, onChange, max, min }: { value: string; onChange: (v: string) => void; max?: string; min?: string }) {
    return (
        <input
            type="date"
            className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
            value={value}
            min={min}
            max={max}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function PrRegisterOldPage() {
    const { user } = useAuth();
    const companyCode = user?.company_code ?? "";
    const loginId = user?.loginid ?? user?.username ?? "ADMIN";

    const [fromDateIso, setFromDateIso] = useState("");
    const [toDateIso, setToDateIso] = useState("");
      const [fromDate, setFromDate] = useState("");
      const [toDate, setToDate] = useState("");

    // User ID (lookup, same pattern as Supplier in PoOrderRegister)
    const [userId, setUserId] = useState("");
    const [userName, setUserName] = useState("");

    // Search (manual free text)
    const [searchText, setSearchText] = useState("");

    // Status (static dropdown, Display Value -> Data Value)
    const [status, setStatus] = useState(STATUS_OPTIONS[0].dataValue);

    // Report Type
    const [reportType, setReportType] = useState<"SUMMARY" | "DETAILS">("SUMMARY");

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("Select filters and run the report.");

    const lastRequestRef = useRef<PrRegisterOldParams | null>(null);
    const lastReportTypeRef = useRef<"SUMMARY" | "DETAILS">("SUMMARY");

    const dateRangeValid = !fromDateIso || !toDateIso || fromDateIso <= toDateIso;

    const buildRequestParams = (): PrRegisterOldParams => ({
        loginid: loginId,
        company_code: companyCode,
        fromdate: fromDateIso || "All",
        todate: toDateIso || "All",
        user_id: userId || "All",
        search_text: searchText || "All",
        status: status || "All",
        report_type: reportType,
    });

    // Picks the right HTML/Excel API function based on which Report Type is selected
    const getReportHtmlFn = (type: "SUMMARY" | "DETAILS") =>
        type === "DETAILS" ? getPrRegisterOldDetailReportHtml : getPrRegisterOldSummaryReportHtml;

    const getReportExcelFn = (type: "SUMMARY" | "DETAILS") =>
        type === "DETAILS" ? getPrRegisterOldDetailReportExcel : getPrRegisterOldSummaryReportExcel;

    const handleGenerateReport = useCallback(async () => {
        if (!dateRangeValid) return;

        const params = buildRequestParams();
        lastRequestRef.current = params;
        lastReportTypeRef.current = reportType;

        setLoading(true);
        setMessage("");

        const preview = openPurchaseReport(
            reportType === "DETAILS" ? "Purchase Request Register (Old) - Details" : "Purchase Request Register (Old) - Summary"
        );

        try {
            const fetchHtml = getReportHtmlFn(reportType);
            const html = await fetchHtml(params);
            preview.ready({
                html,
                filename: `pr_register_old_${reportType.toLowerCase()}_${new Date().toISOString().slice(0, 10)}`,
                orientation: reportType === "DETAILS" ? "landscape" : "portrait",
                onExcel: async () => {
                    const fetchExcel = getReportExcelFn(reportType);
                    await fetchExcel(params);
                },
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
    }, [dateRangeValid, fromDateIso, toDateIso, userId, searchText, status, reportType, companyCode, loginId]);

    // const closeReportPreview = () => {
    //     setReportPreviewOpen(false);
    //     setReportHtml(null);
    //     setReportPreviewError("");
    // };

    // const handleReportPreviewExcel = async () => {
    //     if (!lastRequestRef.current) return;
    //     setReportPreviewExporting(true);
    //     try {
    //         const fetchExcel = getReportExcelFn(lastReportTypeRef.current);
    //         await fetchExcel(lastRequestRef.current);
    //     } catch (exportError: any) {
    //         setReportPreviewError(exportError?.message ?? "Error while exporting to Excel");
    //     } finally {
    //         setReportPreviewExporting(false);
    //     }
    // };

    function resetFilters() {
        setFromDateIso(""); setToDateIso("");
        setUserId(""); setUserName("");
        setSearchText("");
        setStatus(STATUS_OPTIONS[0].dataValue);
        setReportType("SUMMARY");
        setMessage("Select filters and run the report.");
    }

    return (
        <section className="freight-ui-standard freight-report-screen">
            <div className="freight-report-card">
                <div className="freight-report-titlebar">
                    <h1>Purchase Request Register (Old)</h1>
                    <span className="freight-report-title-dot" aria-hidden="true" />
                </div>

                <ReportFilterHeader onClear={resetFilters} />

                <div className="freight-report-fields grid gap-4 p-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {/* <Field label="From Date">
                        <DateField value={fromDateIso} onChange={setFromDateIso} max={toDateIso || undefined} />
                    </Field>

                    <Field label="To Date">
                        <DateField value={toDateIso} onChange={setToDateIso} min={fromDateIso || undefined} />
                    </Field> */}

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


                    <Field label="User ID">
                        <LookupField
                            label=""
                            value={userId}
                            displayValue={userName ? `${userId} - ${userName}` : userId}
                            columns={[{ field: "userid", header: "User ID" }]}
                            valueField="userid"
                            displayFields={["userid"]}
                            loadOptions={() =>
                                getDynamicLookup({
                                    parameter: "PR_REGISTER_OLD_USER_ID_19082026",
                                    loginid: loginId,
                                })
                            }
                            disabled={false}
                            onChange={(value: string) => {
                                setUserId(value);
                                setUserName("");
                            }}
                        />
                    </Field>

                    <Field label="Search">
                        <Input
                            className="h-8"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Enter search text"
                        />
                    </Field>

                    <Field label="Status">
                        <select
                            className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            {STATUS_OPTIONS.map((opt) => (
                                <option key={opt.dataValue} value={opt.dataValue}>
                                    {opt.displayValue}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <div className="sm:col-span-1">
                        <Field label="Report Type">
                            <div
                                className="flex flex-row items-center gap-x-7 rounded-md px-4 py-1 shadow-sm"
                                style={{ border: "1px solid #aebdce", background: "#f4f7fb", minHeight: 30, display: "flex", flexDirection: "row", alignItems: "center" }}
                            >
                                {[
                                    { value: "SUMMARY" as const, label: "Summary" },
                                    { value: "DETAILS" as const, label: "Details" },
                                ].map((opt) => (
                                    <div
                                        key={opt.value}
                                        onClick={() => setReportType(opt.value)}
                                        className="flex flex-row items-center gap-2 cursor-pointer select-none whitespace-nowrap"
                                        style={{ display: "flex", flexDirection: "row", alignItems: "center" }}
                                    >
                                        {/* Radio Circle */}
                                        <span
                                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${reportType === opt.value ? "border-blue-600" : "border-gray-300"
                                                }`}
                                            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                                        >
                                            {reportType === opt.value && (
                                                <span className="h-2 w-2 rounded-full bg-blue-600" />
                                            )}
                                        </span>

                                        {/* Text Label */}
                                        <span
                                            className={`text-sm font-normal ${reportType === opt.value ? "text-blue-700" : "text-foreground"
                                                }`}
                                        >
                                            {opt.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Field>
                    </div>


                </div>

                <div className="freight-report-actions">
                    <Button type="button" size="sm" onClick={handleGenerateReport} disabled={loading || !dateRangeValid}>
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Generate Report
                    </Button>
                </div>
                {message ? <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p> : null}
            </div>

            <PurchaseReportPreview />
        </section>
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