"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Printer,
    RotateCcw,
    FileText,
    Download,
    Eye,
} from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookupaccount } from "../../../api/lookups";
import {
    getDnSummaryReportHtml,
    getDnSummaryReportExcelDownload,
} from "../../../api/transactions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Option {
    value: string;
    label: string;
}

interface LookupRow {
    [key: string]: any;
}

interface Params {
    prin_code: string;   // "All" or a specific PRIN_CODE
    from_date: string;   // "All" or "DD/MM/YYYY"
    to_date:   string;   // "All" or "DD/MM/YYYY"
}

const ALL_PARAMS: Params = { prin_code: "All", from_date: "All", to_date: "All" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getField = (row: LookupRow, ...keys: string[]): string => {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null) return String(row[k]);
        const upper = k.toUpperCase();
        if (row[upper] !== undefined && row[upper] !== null) return String(row[upper]);
        const lower = k.toLowerCase();
        if (row[lower] !== undefined && row[lower] !== null) return String(row[lower]);
    }
    return "";
};

const mapCodeNameOptions = (rows: LookupRow[], codeKey: string, nameKey: string): Option[] =>
    rows
        .map((r) => {
            const code = getField(r, codeKey);
            const name = getField(r, nameKey);
            if (!code) return null;
            return { value: code, label: name ? `${code} - ${name}` : code };
        })
        .filter((o): o is Option => !!o)
        .sort((a, b) => a.value.localeCompare(b.value));

/** Format a date input value (YYYY-MM-DD) → DD/MM/YYYY string for the API, or "All" if empty */
const toApiDateString = (isoDate: string): string => {
    if (!isoDate) return "All";
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
};

// ─── Shared styles ─────────────────────────────────────────────────────────────

const fieldLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    color: "#6b7280",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
};

// ─── Reusable components ──────────────────────────────────────────────────────

function FloatLabel({ label, required, children, bgColor = "#fff" }: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
    bgColor?: string;
}) {
    return (
        <div style={{ position: "relative", marginTop: 6 }}>
            <span style={{
                position: "absolute",
                top: -8,
                left: 10,
                fontSize: 11,
                color: "#6b7280",
                background: bgColor,
                padding: "0 4px",
                zIndex: 1,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 500,
            }}>
                {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
            </span>
            {children}
        </div>
    );
}

const selectStyle: React.CSSProperties = {
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

const SelectField: React.FC<{
    label: string;
    options: Option[];
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    loading?: boolean;
}> = ({ label, options, value, onChange, placeholder, loading }) => (
    <div style={{ marginBottom: 0 }}>
        {label && <label style={fieldLabelStyle}>{label}</label>}
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={loading}
            style={{
                ...selectStyle,
                background: loading ? "#f9fafb" : "#fff",
                cursor: loading ? "not-allowed" : "pointer",
            }}
        >
            <option value="All">{loading ? "Loading…" : (placeholder ?? "All")}</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
);

const DateField: React.FC<{
    label: string;
    value: string;        // YYYY-MM-DD (native date input format), "" = All
    onChange: (v: string) => void;
    max?: string;
    min?: string;
}> = ({ label, value, onChange, max, min }) => (
    <div>
        {label && <label style={fieldLabelStyle}>{label}</label>}
        <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            min={min}
            max={max}
            style={{
                ...selectStyle,
                color: value ? "#111827" : "#9ca3af",
                cursor: "pointer",
            }}
        />
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DNSummaryReportPage() {
    const { user } = useAuth();
    const companyCode = user?.company_code ?? "";
    const loginId = user?.loginid ?? user?.username ?? "ADMIN";

    // ── UI state
    const [loading,   setLoading]   = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error,      setError]      = useState<string>("");
    const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
    const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

    const reportWindowRef = useRef<Window | null>(null);

    // ── Filter options
    const [principalOptions, setPrincipalOptions] = useState<Option[]>([]);
    const [optLoading, setOptLoading] = useState(false);

    // ── Filter values — native date-input strings for the UI; "All" sentinel for params
    const [principal, setPrincipal] = useState<string>("All");
    const [fromDateIso, setFromDateIso] = useState<string>("");   // "" = All
    const [toDateIso,   setToDateIso]   = useState<string>("");   // "" = All

    const lastParamsRef = useRef<Params>(ALL_PARAMS);

    const dateRangeValid = !fromDateIso || !toDateIso || fromDateIso <= toDateIso;

    // ── Load principal options (independent of report filters)
    useEffect(() => {
        (async () => {
            setOptLoading(true);
            try {
                const res = await getDynamicLookupaccount({
                    parameter: "WMS_Stock_principal", loginid: loginId,
                    code1: companyCode, code2: "", code3: "", code4: "",
                    number1: 0, number2: 0, number3: 0, number4: 0,
                    date1: null, date2: null, date3: null, date4: null,
                });
                const rows = Array.isArray(res) ? res : [];
                setPrincipalOptions(mapCodeNameOptions(rows, "prin_code", "prin_name"));
            } catch (err) {
                console.error("[WMS_Stock_principal] Fetch error:", err);
            } finally {
                setOptLoading(false);
            }
        })();
    }, [companyCode, loginId]);

    // ── Fetch the report HTML from the API and open it in a new browser tab
    const fetchReport = useCallback(async (p: Params) => {
        setLoading(true);
        setError("");
        lastParamsRef.current = p;

        const newTab = window.open("", "_blank");
        if (!newTab) {
            setLoading(false);
            setError("Your browser blocked the new tab. Please allow pop-ups for this site and try again.");
            return;
        }
        newTab.document.write(
            "<title>DN Summary Report</title><body style='font-family:sans-serif;padding:40px;color:#6b7280;'>Loading report…</body>"
        );

        try {
            const html = await getDnSummaryReportHtml({
                parameter: "WMS_Stock_DN_Summary_Report",
                loginid:   loginId,
                code1:     companyCode,
                code2:     p.prin_code,
                code3:     p.from_date,
                code4:     p.to_date,
            });

            newTab.document.open();
            newTab.document.write(html);
            newTab.document.close();

            reportWindowRef.current = newTab;
            setHasGeneratedReport(true);
            setLastGeneratedAt(new Date());
        } catch (err: any) {
            newTab.document.open();
            newTab.document.write(
                "<title>DN Summary Report</title><body style='font-family:sans-serif;padding:40px;color:#dc2626;'>Failed to load report. Please close this tab and try again.</body>"
            );
            newTab.document.close();
            setError(err?.message ?? "Failed to load report. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [loginId, companyCode]);

    // ── Auto-load on mount with "All" defaults — full dataset, no filters
    // NOTE: most browsers block auto-opened tabs that aren't triggered by a user
    // gesture, so we don't auto-fetch on mount anymore — the user clicks "View Report".

    // ── Apply current filter selections
    const handleGenerateReport = () => {
        if (!dateRangeValid) return;
        const params: Params = {
            prin_code: principal || "All",
            from_date: toApiDateString(fromDateIso),
            to_date:   toApiDateString(toDateIso),
        };
        fetchReport(params);
    };

    const handleReset = () => {
        setPrincipal("All");
        setFromDateIso("");
        setToDateIso("");
        setError("");
        setHasGeneratedReport(false);
        setLastGeneratedAt(null);
    };

    // ── Print (targets the most recently opened report tab)
    const handlePrint = () => {
        if (reportWindowRef.current && !reportWindowRef.current.closed) {
            reportWindowRef.current.focus();
            reportWindowRef.current.print();
        } else {
            setError("No open report tab to print. Generate the report again.");
        }
    };

    const handleExcel = async () => {
        setExporting(true);
        try {
            await getDnSummaryReportExcelDownload({
                parameter: "WMS_Stock_DN_Summary_Report",
                loginid:   loginId,
                code1:     companyCode,
                code2:     lastParamsRef.current.prin_code,
                code3:     lastParamsRef.current.from_date,
                code4:     lastParamsRef.current.to_date,
            });
        } catch (err) {
            console.error("Excel export error:", err);
            alert("Excel export failed. Please try again.");
        } finally {
            setExporting(false);
        }
    };

    const BG = "#EEF5FD";

    return (
        <div style={{ background: "#f3f4f6", padding: "6px 10px", fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
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
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>DN Summary Report</span>
                        {hasGeneratedReport && (
                            <span style={{
                                fontSize: 10,
                                background: "#d1fae5",
                                color: "#065f46",
                                padding: "2px 10px",
                                borderRadius: 12,
                                fontWeight: 500,
                            }}>
                                Report Generated
                            </span>
                        )}
                    </div>

                    {/* Error display */}
                    {error && (
                        <div style={{
                            marginBottom: 10,
                            padding: "8px 14px",
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: 6,
                            color: "#dc2626",
                            fontSize: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}>
                            <span>⚠️</span>
                            {error}
                            <button
                                onClick={() => setError("")}
                                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#dc2626" }}
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {!dateRangeValid && (
                        <div style={{
                            marginBottom: 10,
                            padding: "8px 14px",
                            background: "#fffbeb",
                            border: "1px solid #fde68a",
                            borderRadius: 6,
                            color: "#92400e",
                            fontSize: 12,
                        }}>
                            From date must be on or before To date.
                        </div>
                    )}

                    {/* ── Form fields ── */}
                    <div className="field-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 6, width: "100%" }}>
                        <FloatLabel label="Principal" bgColor={BG}>
                            <SelectField
                                label=""
                                options={principalOptions}
                                value={principal}
                                onChange={setPrincipal}
                                placeholder="All"
                                loading={optLoading}
                            />
                        </FloatLabel>
                        <FloatLabel label="From Date" bgColor={BG}>
                            <DateField
                                label=""
                                value={fromDateIso}
                                onChange={setFromDateIso}
                                max={toDateIso || undefined}
                            />
                        </FloatLabel>
                        <FloatLabel label="To Date" bgColor={BG}>
                            <DateField
                                label=""
                                value={toDateIso}
                                onChange={setToDateIso}
                                min={fromDateIso || undefined}
                            />
                        </FloatLabel>
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4, marginLeft: 4 }}>
                        Leave dates blank to include all transaction dates
                    </div>

                    {/* Status bar when report is generated */}
                    {hasGeneratedReport && (
                        <div style={{
                            marginTop: 10,
                            padding: "8px 14px",
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                            borderRadius: 6,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 16 }}>✅</span>
                                <span style={{ fontSize: 12, color: "#065f46" }}>
                                    Report generated successfully at {lastGeneratedAt?.toLocaleTimeString()}
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    if (reportWindowRef.current && !reportWindowRef.current.closed) {
                                        reportWindowRef.current.focus();
                                    } else {
                                        setError("Report tab is closed. Please generate again.");
                                    }
                                }}
                                style={{
                                    padding: "4px 12px",
                                    background: "#185FA5",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 4,
                                    fontSize: 11,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                }}
                            >
                                <Eye size={12} /> Open Report
                            </button>
                        </div>
                    )}

                    {/* Action bar */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, paddingTop: 8, borderTop: "0.5px solid #e5e7eb" }}>
                        <button
                            className="action-btn-excel"
                            onClick={handleReset}
                            disabled={loading}
                            style={{
                                padding: "7px 16px",
                                border: "0.5px solid #d1d5db",
                                background: "#fff",
                                cursor: loading ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                borderRadius: 6,
                                color: "#374151",
                                opacity: loading ? 0.6 : 1,
                            }}
                        >
                            <RotateCcw size={13} /> Reset
                        </button>

                        <button
                            className="action-btn-excel"
                            onClick={handlePrint}
                            disabled={!hasGeneratedReport || loading}
                            style={{
                                padding: "7px 16px",
                                border: "0.5px solid #d1d5db",
                                background: "#fff",
                                cursor: (!hasGeneratedReport || loading) ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                borderRadius: 6,
                                color: "#374151",
                                opacity: (!hasGeneratedReport || loading) ? 0.5 : 1,
                            }}
                        >
                            <Printer size={13} /> Print
                        </button>

                        <button
                            className="action-btn-excel"
                            onClick={handleExcel}
                            disabled={!hasGeneratedReport || loading || exporting}
                            style={{
                                padding: "7px 16px",
                                border: "0.5px solid #d1d5db",
                                background: "#fff",
                                cursor: (!hasGeneratedReport || loading || exporting) ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                borderRadius: 6,
                                color: "#374151",
                                opacity: (!hasGeneratedReport || loading || exporting) ? 0.5 : 1,
                            }}
                        >
                            <Download size={13} /> {exporting ? "Exporting..." : "Export Excel"}
                        </button>

                        <button
                            className="action-btn-primary"
                            onClick={handleGenerateReport}
                            disabled={loading || !dateRangeValid}
                            style={{
                                padding: "7px 16px",
                                border: "0.5px solid #185FA5",
                                background: (loading || !dateRangeValid) ? "#94a3b8" : "#185FA5",
                                cursor: (loading || !dateRangeValid) ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                borderRadius: 6,
                                color: "#fff",
                                transition: "background 0.2s",
                            }}
                        >
                            {loading ? (
                                <>
                                    <span style={{
                                        width: 12,
                                        height: 12,
                                        border: "2px solid rgba(255,255,255,0.3)",
                                        borderTop: "2px solid #fff",
                                        borderRadius: "50%",
                                        animation: "spin 0.8s linear infinite",
                                    }} />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Eye size={13} /> View Report
                                </>
                            )}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}