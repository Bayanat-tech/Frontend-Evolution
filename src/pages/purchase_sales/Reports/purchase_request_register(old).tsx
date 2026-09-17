// PrRegisterOldPage.tsx
"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Printer, RotateCcw, FileText, Loader2 } from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { LookupField } from "../../../components/ui/LookupField";
import { ReportPreviewDialog } from "../../../components/reports/ReportPreviewDialog";
import {
    getPrRegisterOldSummaryReportHtml,
    getPrRegisterOldSummaryReportExcel,
    getPrRegisterOldDetailReportHtml,
    getPrRegisterOldDetailReportExcel,
} from "../../../api/transactions";

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

const text = (v: any) => (v === null || v === undefined ? "" : String(v));

// Display Value -> Data Value, from the Status lookup grid
const STATUS_OPTIONS: { displayValue: string; dataValue: string }[] = [
    { displayValue: "ALL", dataValue: "All" },
    { displayValue: "PENDING", dataValue: "PENDING" },
    { displayValue: "APPROVED", dataValue: "APPROVED" },
    { displayValue: "REJECTED", dataValue: "REJECTED" },
];

// ─── Shared styles ─────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    width: "100%",
    fontSize: 12,
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 7,
    background: "#fff",
    color: "#111827",
    boxSizing: "border-box",
    outline: "none",
};

function FloatLabel({ label, required, children, bgColor = "#fff" }: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
    bgColor?: string;
}) {
    return (
        <div style={{ position: "relative", marginTop: 6 }}>
            <span style={{
                position: "absolute", top: -8, left: 10, fontSize: 11, color: "#6b7280",
                background: bgColor, padding: "0 4px", zIndex: 1, textTransform: "uppercase",
                letterSpacing: "0.05em", fontWeight: 500,
            }}>
                {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
            </span>
            {children}
        </div>
    );
}

const DateField: React.FC<{
    value: string; onChange: (v: string) => void; max?: string; min?: string;
}> = ({ value, onChange, max, min }) => (
    <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        style={{ ...inputStyle, color: value ? "#111827" : "#9ca3af", cursor: "pointer" }}
    />
);

const TextField: React.FC<{
    value: string; onChange: (v: string) => void; placeholder?: string;
}> = ({ value, onChange, placeholder }) => (
    <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
    />
);

const SelectField: React.FC<{
    value: string;
    onChange: (v: string) => void;
    options: { displayValue: string; dataValue: string }[];
}> = ({ value, onChange, options }) => (
    <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, cursor: "pointer", color: value ? "#111827" : "#9ca3af" }}
    >
        {options.map((opt) => (
            <option key={opt.dataValue} value={opt.dataValue}>
                {opt.displayValue}
            </option>
        ))}
    </select>
);

// ─── Main Component ─────────────────────────────────────────────────────────

export default function PrRegisterOldPage() {
    const { user } = useAuth();
    const companyCode = user?.company_code ?? "";
    const loginId = user?.loginid ?? user?.username ?? "ADMIN";

    const [error, setError] = useState("");

    const [fromDateIso, setFromDateIso] = useState("");
    const [toDateIso, setToDateIso] = useState("");

    // User ID (lookup, same pattern as Supplier in PoOrderRegister)
    const [userId, setUserId] = useState("");
    const [userName, setUserName] = useState("");

    // Search (manual free text)
    const [searchText, setSearchText] = useState("");

    // Status (static dropdown, Display Value -> Data Value)
    const [status, setStatus] = useState(STATUS_OPTIONS[0].dataValue);

    // Report Type
    const [reportType, setReportType] = useState<"SUMMARY" | "DETAILS">("SUMMARY");

    const lastRequestRef = useRef<PrRegisterOldParams | null>(null);
    const lastReportTypeRef = useRef<"SUMMARY" | "DETAILS">("SUMMARY");

    // ── Report preview dialog state (matches PoOrderRegisterPage pattern) ──
    const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
    const [reportPreviewUrl, setReportPreviewUrl] = useState("");
    const [reportPreviewError, setReportPreviewError] = useState("");
    const [reportPreviewLoading, setReportPreviewLoading] = useState(false);
    const [reportPreviewExporting, setReportPreviewExporting] = useState(false);

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

    // Revoke the blob URL whenever it changes or the component unmounts, so we
    // don't leak memory across repeated report generations.
    useEffect(() => {
        return () => {
            if (reportPreviewUrl) window.URL.revokeObjectURL(reportPreviewUrl);
        };
    }, [reportPreviewUrl]);

    const handleGenerateReport = useCallback(async () => {
        if (!dateRangeValid) return;

        const params = buildRequestParams();
        lastRequestRef.current = params;
        lastReportTypeRef.current = reportType;

        if (reportPreviewUrl) window.URL.revokeObjectURL(reportPreviewUrl);
        setReportPreviewUrl("");
        setReportPreviewError("");
        setReportPreviewOpen(true);
        setReportPreviewLoading(true);
        setError("");

        try {
            const fetchHtml = getReportHtmlFn(reportType);
            const html = await fetchHtml(params);
            const blob = new Blob([html], { type: "text/html" });
            const url = window.URL.createObjectURL(blob);
            setReportPreviewUrl(url);
        } catch (err: any) {
            setReportPreviewError(err?.message ?? "Failed to load report. Please try again.");
        } finally {
            setReportPreviewLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRangeValid, fromDateIso, toDateIso, userId, searchText, status, reportType, companyCode, loginId]);

    const closeReportPreview = () => {
        if (reportPreviewUrl) window.URL.revokeObjectURL(reportPreviewUrl);
        setReportPreviewOpen(false);
        setReportPreviewUrl("");
        setReportPreviewError("");
    };

    const handleReportPreviewExcel = async () => {
        if (!lastRequestRef.current) return;
        setReportPreviewExporting(true);
        try {
            const fetchExcel = getReportExcelFn(lastReportTypeRef.current);
            await fetchExcel(lastRequestRef.current);
        } catch (exportError: any) {
            setReportPreviewError(exportError?.message ?? "Error while exporting to Excel");
        } finally {
            setReportPreviewExporting(false);
        }
    };

    const handleReset = () => {
        setFromDateIso(""); setToDateIso("");
        setUserId(""); setUserName("");
        setSearchText("");
        setStatus(STATUS_OPTIONS[0].dataValue);
        setReportType("SUMMARY");
        setError("");
    };

    const BG = "#EEF5FD";
    return (
        <div style={{ background: "#f3f4f6", padding: "33px 10px", fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
            <style>{`
                .action-btn-primary:hover { background: #1e40af !important; }
                .action-btn-excel:hover { background: #EBF4FF !important; border-color: #185FA5 !important; color: #185FA5 !important; }
                .field-row { background: #EEF5FD; border-radius: 8px; padding: 10px 12px; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>

            <div style={{ maxWidth: 1400, margin: "0 auto" }}>
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "8px 12px" }}>

                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <FileText size={17} color="#185FA5" />
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Purchase Request Register (Old)</span>
                    </div>

                    {error && (
                        <div style={{ marginBottom: 10, padding: "8px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                            <span>⚠️</span>{error}
                            <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#dc2626" }}>✕</button>
                        </div>
                    )}

                    {!dateRangeValid && (
                        <div style={{ marginBottom: 10, padding: "8px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, color: "#92400e", fontSize: 12 }}>
                            From date must be on or before To date.
                        </div>
                    )}

                    {/* ── Filter fields ── */}
                    <div className="field-row" style={{ background: "#EEF5FD", borderRadius: 8, padding: "10px 12px" }}>

                        {/* ───────────── First Row: Date From, Date To, User ID ───────────── */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, alignItems: "end" }}>
                            <div style={{ minWidth: 0 }}>
                                <FloatLabel label="From Date" bgColor={BG}>
                                    <DateField
                                        value={fromDateIso}
                                        onChange={setFromDateIso}
                                        max={toDateIso || undefined}
                                    />
                                </FloatLabel>
                            </div>

                            <div style={{ minWidth: 0 }}>
                                <FloatLabel label="To Date" bgColor={BG}>
                                    <DateField
                                        value={toDateIso}
                                        onChange={setToDateIso}
                                        min={fromDateIso || undefined}
                                    />
                                </FloatLabel>
                            </div>

                            <div style={{ minWidth: 0 }}>
                                <LookupField
                                    label="User ID"
                                    value={userId}
                                    displayValue={userName ? `${userId} - ${userName}` : userId}
                                    columns={[
                                        { field: "userid", header: "User ID" },
                                    ]}
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
                            </div>
                        </div>

                        {/* ───────────── Second Row: Search (manual text) ───────────── */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 12 }}>
                            <div style={{ minWidth: 0 }}>
                                <FloatLabel label="Search" bgColor={BG}>
                                    <TextField
                                        value={searchText}
                                        onChange={setSearchText}
                                        placeholder="Enter search text"
                                    />
                                </FloatLabel>
                            </div>
                        </div>

                        {/* ───────────── Third Row: Status, Report Type ───────────── */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginTop: 12, alignItems: "end" }}>
                            <div style={{ minWidth: 0 }}>
                                <FloatLabel label="Status" bgColor={BG}>
                                    <SelectField
                                        value={status}
                                        onChange={setStatus}
                                        options={STATUS_OPTIONS}
                                    />
                                </FloatLabel>
                            </div>

                            <div
                                style={{
                                    boxSizing: "border-box",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 4,
                                    background: "#fff",
                                    padding: "15px 12px 10px",
                                    position: "relative",
                                }}
                            >
                                <span
                                    style={{
                                        position: "absolute",
                                        top: -8,
                                        left: 10,
                                        background: "#fff",
                                        padding: "0 5px",
                                        fontSize: 11,
                                        color: "#6b7280",
                                        fontWeight: 500,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                    }}
                                >
                                    Report Type
                                </span>

                                <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#374151", cursor: "pointer", whiteSpace: "nowrap" }}>
                                        <input
                                            type="radio"
                                            name="reportType"
                                            value="SUMMARY"
                                            checked={reportType === "SUMMARY"}
                                            onChange={() => setReportType("SUMMARY")}
                                            style={{ width: 16, height: 16, margin: 0, accentColor: "#185FA5", cursor: "pointer" }}
                                        />
                                        Summary
                                    </label>

                                    <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#374151", cursor: "pointer", whiteSpace: "nowrap" }}>
                                        <input
                                            type="radio"
                                            name="reportType"
                                            value="DETAILS"
                                            checked={reportType === "DETAILS"}
                                            onChange={() => setReportType("DETAILS")}
                                            style={{ width: 16, height: 16, margin: 0, accentColor: "#185FA5", cursor: "pointer" }}
                                        />
                                        Details
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4, marginLeft: 4 }}>
                        Leave a field on "All" to include every value for that filter.
                    </div>

                    {/* Action bar */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, paddingTop: 8, borderTop: "0.5px solid #e5e7eb" }}>
                        <button className="action-btn-excel" onClick={handleReset} disabled={reportPreviewLoading}
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: reportPreviewLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151", opacity: reportPreviewLoading ? 0.6 : 1 }}>
                            <RotateCcw size={13} /> Reset
                        </button>
                        <button className="action-btn-primary" onClick={handleGenerateReport} disabled={reportPreviewLoading || !dateRangeValid}
                            style={{ padding: "7px 16px", border: "0.5px solid #185FA5", background: (reportPreviewLoading || !dateRangeValid) ? "#94a3b8" : "#185FA5", cursor: (reportPreviewLoading || !dateRangeValid) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#fff", transition: "background 0.2s" }}>
                            {reportPreviewLoading ? (
                                <>
                                    <Loader2 size={13} className="animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <><Printer size={13} /> Generate Report</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {reportPreviewOpen && (
                <ReportPreviewDialog
                    title="Purchase Request Register (Old)"
                    pdfUrl={reportPreviewUrl}
                    error={reportPreviewError}
                    exporting={reportPreviewExporting}
                    onExcel={handleReportPreviewExcel}
                    onClose={closeReportPreview}
                    onDownload={() => {}}
                    downloadName="PR_Register_Old_Report.html"
                />
            )}
        </div>
    );
}