"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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

// ─── Select (single value) ─────────────────────────────────────────────────────

const fieldLabelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 4,
};

const SelectField: React.FC<{
    label: string;
    options: Option[];
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    loading?: boolean;
}> = ({ label, options, value, onChange, placeholder, loading }) => (
    <div style={{ marginBottom: 14 }}>
        <label style={fieldLabelStyle}>{label}</label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={loading}
            style={{
                width: "100%", fontSize: 12, padding: "8px 10px",
                border: "1px solid #d1d5db", borderRadius: 7,
                background: loading ? "#f9fafb" : "#fff",
                color: "#111827", boxSizing: "border-box",
                outline: "none", cursor: loading ? "not-allowed" : "pointer",
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
    <div style={{ marginBottom: 14 }}>
        <label style={fieldLabelStyle}>{label}</label>
        <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            min={min}
            max={max}
            style={{
                width: "100%", fontSize: 12, padding: "8px 10px",
                border: "1px solid #d1d5db", borderRadius: 7,
                background: "#fff", color: value ? "#111827" : "#9ca3af",
                boxSizing: "border-box", outline: "none", cursor: "pointer",
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
    const [panelOpen, setPanelOpen] = useState(false);
    const [loading,   setLoading]   = useState(false);
    const [exporting, setExporting] = useState(false);
    const [reportHtml, setReportHtml] = useState<string>("");
    const [error,      setError]      = useState<string>("");

    // ── Filter options
    const [principalOptions, setPrincipalOptions] = useState<Option[]>([]);
    const [optLoading, setOptLoading] = useState(false);

    // ── Filter values — native date-input strings for the UI; "All" sentinel for params
    const [principal, setPrincipal] = useState<string>("All");
    const [fromDateIso, setFromDateIso] = useState<string>("");   // "" = All
    const [toDateIso,   setToDateIso]   = useState<string>("");   // "" = All

    const iframeRef = useRef<HTMLIFrameElement>(null);
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

    // ── Fetch HTML report
    const fetchReport = useCallback(async (p: Params) => {
        setLoading(true);
        setError("");
        lastParamsRef.current = p;
        try {
            const html = await getDnSummaryReportHtml({
                parameter: "WMS_Stock_DN_Summary_Report",
                loginid:   loginId,
                code1:     companyCode,
                code2:     p.prin_code,
                code3:     p.from_date,
                code4:     p.to_date,
            });
            setReportHtml(html);
        } catch (err: any) {
            setError(err?.message ?? "Failed to load report. Please try again.");
            setReportHtml("");
        } finally {
            setLoading(false);
        }
    }, [loginId, companyCode]);

    // ── Auto-load on mount with "All" defaults — full dataset, no filters
    useEffect(() => {
        fetchReport(ALL_PARAMS);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Apply current filter selections
    const handleViewReport = () => {
        if (!dateRangeValid) return;
        const params: Params = {
            prin_code: principal || "All",
            from_date: toApiDateString(fromDateIso),
            to_date:   toApiDateString(toDateIso),
        };
        fetchReport(params);
        setPanelOpen(false);
    };

    const handleReset = () => {
        setPrincipal("All");
        setFromDateIso("");
        setToDateIso("");
        fetchReport(ALL_PARAMS);
    };

    const handlePrint = () => {
        iframeRef.current?.contentWindow?.postMessage("print", "*");
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

    // ── Styles (blue theme, matches Stock Detail Report)
    const THEME = "#1d4ed8";
    const THEME_DARK = "#1e40af";
    const THEME_LIGHT = "#bfdbfe";

    const btnBase: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 14px",
        borderRadius: 8,
        border: "1px solid #d1d5db",
        background: "#fff",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
        color: "#374151",
        whiteSpace: "nowrap",
        transition: "background 0.15s",
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f1f5f9", overflow: "hidden" }}>

            {/* ── Top toolbar ── */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 20px",
                background: "#fff",
                borderBottom: "1px solid #e5e7eb",
                flexShrink: 0,
                gap: 12,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}>
                {/* Title */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: 8,
                        background: THEME,
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="9" y1="13" x2="15" y2="13" />
                            <line x1="9" y1="17" x2="15" y2="17" />
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>DN Summary Report</div>
                        <div style={{ fontSize: 10, color: "#6b7280" }}>Delivery Note Summary</div>
                    </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {/* Print */}
                    <button
                        style={btnBase}
                        onClick={handlePrint}
                        disabled={!reportHtml || loading}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                        </svg>
                        Print
                    </button>

                    {/* Excel */}
                    <button
                        style={{ ...btnBase, color: "#166534", borderColor: "#86efac" }}
                        onClick={handleExcel}
                        disabled={!reportHtml || loading || exporting}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f0fdf4")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                    >
                        {exporting ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                            </svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
                            </svg>
                        )}
                        {exporting ? "Exporting…" : "Excel"}
                    </button>

                    {/* Parameters toggle */}
                    <button
                        style={{
                            ...btnBase,
                            background: panelOpen ? THEME : "#fff",
                            color: panelOpen ? "#fff" : "#374151",
                            borderColor: panelOpen ? THEME : "#d1d5db",
                        }}
                        onClick={() => setPanelOpen((p) => !p)}
                        onMouseEnter={(e) => { if (!panelOpen) e.currentTarget.style.background = "#f9fafb"; }}
                        onMouseLeave={(e) => { if (!panelOpen) e.currentTarget.style.background = "#fff"; }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" />
                            <line x1="4" y1="18" x2="20" y2="18" />
                        </svg>
                        Parameters
                    </button>
                </div>
            </div>

            {/* ── Content area ── */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

                {/* ── Report iframe ── */}
                <div style={{
                    flex: 1,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    transition: "margin-right 0.3s ease",
                    marginRight: panelOpen ? 320 : 0,
                }}>
                    {loading && (
                        <div style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(255,255,255,0.85)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 50,
                            gap: 12,
                        }}>
                            <div style={{
                                width: 40, height: 40,
                                border: "3px solid #e5e7eb",
                                borderTop: `3px solid ${THEME}`,
                                borderRadius: "50%",
                                animation: "spin 0.8s linear infinite",
                            }} />
                            <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Loading report…</span>
                        </div>
                    )}

                    {error && !loading && (
                        <div style={{
                            margin: 20,
                            padding: "14px 18px",
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: 8,
                            color: "#dc2626",
                            fontSize: 13,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {reportHtml && !error && (
                        <iframe
                            ref={iframeRef}
                            srcDoc={reportHtml}
                            style={{
                                flex: 1,
                                border: "none",
                                width: "100%",
                                height: "100%",
                            }}
                            title="DN Summary Report"
                        />
                    )}

                    {!reportHtml && !loading && !error && (
                        <div style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#9ca3af",
                            gap: 12,
                        }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <span style={{ fontSize: 13 }}>No report loaded</span>
                        </div>
                    )}
                </div>

                {/* ── Slide-in Parameter Panel ── */}
                <div style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: 320,
                    background: "#fff",
                    borderLeft: "1px solid #e5e7eb",
                    boxShadow: "-4px 0 20px rgba(0,0,0,0.08)",
                    transform: panelOpen ? "translateX(0)" : "translateX(100%)",
                    transition: "transform 0.3s ease",
                    display: "flex",
                    flexDirection: "column",
                    zIndex: 40,
                    overflow: "hidden",
                }}>
                    {/* Panel header */}
                    <div style={{
                        padding: "14px 18px",
                        borderBottom: "1px solid #e5e7eb",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: THEME,
                        flexShrink: 0,
                    }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>Report Parameters</div>
                            <div style={{ fontSize: 10, color: THEME_LIGHT, marginTop: 2 }}>Adjust filters and view report</div>
                        </div>
                        <button
                            onClick={() => setPanelOpen(false)}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#fff" }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    {/* Scrollable params */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
                        {!dateRangeValid && (
                            <div style={{
                                marginBottom: 14,
                                padding: "8px 10px",
                                background: "#fffbeb",
                                border: "1px solid #fde68a",
                                borderRadius: 6,
                                color: "#92400e",
                                fontSize: 11,
                            }}>
                                From date must be on or before To date.
                            </div>
                        )}

                        <SelectField
                            label="Principal Code"
                            options={principalOptions}
                            value={principal}
                            onChange={setPrincipal}
                            placeholder="All"
                            loading={optLoading}
                        />

                        {/* Date range */}
                        <div style={{
                            background: "#f8fafc", borderRadius: 8, padding: "12px 14px",
                            border: "1px solid #e5e7eb", marginBottom: 4,
                        }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 10 }}>
                                Transaction Date Range
                            </div>
                            <DateField
                                label="From Date"
                                value={fromDateIso}
                                onChange={setFromDateIso}
                                max={toDateIso || undefined}
                            />
                            <DateField
                                label="To Date"
                                value={toDateIso}
                                onChange={setToDateIso}
                                min={fromDateIso || undefined}
                            />
                            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: -6 }}>
                                Leave blank to include all dates
                            </div>
                        </div>
                    </div>

                    {/* Panel footer */}
                    <div style={{ padding: "14px 18px", borderTop: "1px solid #e5e7eb", flexShrink: 0, display: "flex", gap: 8 }}>
                        <button
                            onClick={handleReset}
                            disabled={loading}
                            style={{
                                flex: 1,
                                padding: "10px",
                                background: "#fff",
                                color: "#374151",
                                border: "1px solid #d1d5db",
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: loading ? "not-allowed" : "pointer",
                                opacity: loading ? 0.5 : 1,
                            }}
                        >
                            Reset
                        </button>
                        <button
                            onClick={handleViewReport}
                            disabled={loading || !dateRangeValid}
                            style={{
                                flex: 2,
                                padding: "10px",
                                background: (loading || !dateRangeValid) ? "#9ca3af" : THEME,
                                color: "#fff",
                                border: "none",
                                borderRadius: 8,
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: (loading || !dateRangeValid) ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => { if (!loading && dateRangeValid) e.currentTarget.style.background = THEME_DARK; }}
                            onMouseLeave={(e) => { if (!loading && dateRangeValid) e.currentTarget.style.background = THEME; }}
                        >
                            {loading ? (
                                <>
                                    <div style={{
                                        width: 14, height: 14,
                                        border: "2px solid rgba(255,255,255,0.3)",
                                        borderTop: "2px solid #fff",
                                        borderRadius: "50%",
                                        animation: "spin 0.8s linear infinite",
                                    }} />
                                    Loading…
                                </>
                            ) : (
                                <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                                    </svg>
                                    View Report
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}