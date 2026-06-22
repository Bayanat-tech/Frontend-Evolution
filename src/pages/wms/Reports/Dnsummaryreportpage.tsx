"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    BarChart2,
    RotateCcw,
    Printer,
    Loader2,
    X,
    FileSpreadsheet,
    RefreshCw,
    AlertTriangle,
    SlidersHorizontal,
    Calendar,
} from "lucide-react";
import { getDynamicLookupaccount } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import {
    getDnSummaryReportHtml,
    getDnSummaryReportExcelDownload,
} from "../../../api/transactions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LookupOption {
    code: string;
    name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fetchLookup = async (
    parameter: string,
    loginId: string,
    code1: string,
    code2: string,
    code3: string,
    codeKey: string,
    nameKey: string,
): Promise<LookupOption[]> => {
    try {
        const res = await getDynamicLookupaccount({
            parameter, loginid: loginId, code1, code2, code3, code4: "",
            number1: 0, number2: 0, number3: 0, number4: 0,
            date1: null, date2: null, date3: null, date4: null,
        });
        return Array.isArray(res)
            ? res
                .filter((x: any) => x[codeKey] != null && String(x[codeKey]).trim() !== "")
                .map((x: any) => ({ code: String(x[codeKey]), name: x[nameKey] ?? "" }))
            : [];
    } catch (err) {
        console.error(`[${parameter}] Fetch error:`, err);
        return [];
    }
};

/** Format a date input value (YYYY-MM-DD) → DD/MM/YYYY string for the API */
const toApiDateString = (isoDate: string): string => {
    if (!isoDate) return "";
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
};

// ─── Shared field label ───────────────────────────────────────────────────────

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label style={{
        display: "block", fontSize: 10, fontWeight: 600, color: "#6b7280",
        textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5,
    }}>
        {children}
    </label>
);

// ─── Searchable Dropdown ──────────────────────────────────────────────────────

interface SearchableDropdownProps {
    label: string;
    value: LookupOption | null;
    onChange: (v: LookupOption | null) => void;
    options: LookupOption[];
    placeholder?: string;
    disabled?: boolean;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
    label, value, onChange, options, placeholder = "Search...", disabled = false,
}) => {
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(false);

    useEffect(() => { if (!value) setSearch(""); }, [value]);

    const filtered = options.filter((o) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q);
    });

    const displayValue = search !== "" ? search : value ? `${value.code} – ${value.name}` : "";

    return (
        <div style={{ position: "relative" }}>
            <FieldLabel>{label}</FieldLabel>
            <input
                type="text"
                placeholder={placeholder}
                value={displayValue}
                onChange={(e) => { setSearch(e.target.value); setOpen(true); if (value) onChange(null); }}
                onFocus={() => !disabled && setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                disabled={disabled}
                style={{
                    width: "100%", fontSize: 13, padding: "8px 10px",
                    border: "1px solid", borderColor: disabled ? "#e5e7eb" : value ? "#185FA5" : "#d1d5db",
                    borderRadius: 7, background: disabled ? "#f9fafb" : "#fff",
                    color: disabled ? "#9ca3af" : "#111827", boxSizing: "border-box",
                    outline: "none", transition: "border-color 0.15s",
                    cursor: disabled ? "not-allowed" : "text",
                }}
            />
            {open && !disabled && (
                <div style={{
                    position: "absolute", zIndex: 400, top: "calc(100% + 4px)", left: 0, right: 0,
                    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto",
                }}>
                    <div className="dn-opt"
                        style={{ padding: "7px 12px", fontSize: 11, color: "#9ca3af", cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
                        onMouseDown={() => { onChange(null); setSearch(""); setOpen(false); }}>
                        — All —
                    </div>
                    {filtered.length === 0
                        ? <div style={{ padding: "10px 12px", fontSize: 12, color: "#9ca3af", textAlign: "center" }}>No results</div>
                        : filtered.map((o) => (
                            <div key={o.code} className="dn-opt"
                                style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", display: "flex", gap: 8 }}
                                onMouseDown={() => { onChange(o); setSearch(""); setOpen(false); }}>
                                <span style={{ fontWeight: 600, color: "#185FA5", minWidth: 56 }}>{o.code}</span>
                                <span style={{ color: "#6b7280" }}>{o.name}</span>
                            </div>
                        ))
                    }
                </div>
            )}
        </div>
    );
};

// ─── Date Field ───────────────────────────────────────────────────────────────

interface DateFieldProps {
    label: string;
    value: string;           // YYYY-MM-DD (native date input format)
    onChange: (v: string) => void;
    max?: string;
    min?: string;
}

const DateField: React.FC<DateFieldProps> = ({ label, value, onChange, max, min }) => (
    <div style={{ position: "relative" }}>
        <FieldLabel>{label}</FieldLabel>
        <div style={{ position: "relative" }}>
            <input
                type="date"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                min={min}
                max={max}
                style={{
                    width: "100%", fontSize: 13, padding: "8px 36px 8px 10px",
                    border: "1px solid", borderColor: value ? "#185FA5" : "#d1d5db",
                    borderRadius: 7, background: "#fff", color: value ? "#111827" : "#9ca3af",
                    boxSizing: "border-box", outline: "none", transition: "border-color 0.15s",
                    cursor: "pointer", appearance: "none", WebkitAppearance: "none",
                }}
            />
            <Calendar
                size={14}
                color={value ? "#185FA5" : "#9ca3af"}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            />
        </div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DNSummaryReportPage() {
    const { user } = useAuth();
    const companyCode = user?.company_code ?? "";
    const loginId = user?.loginid ?? user?.username ?? "ADMIN";

    // ── Filter state ──────────────────────────────────────────────────────────
    const [principalOptions, setPrincipalOptions] = useState<LookupOption[]>([]);
    const [principal, setPrincipal] = useState<LookupOption | null>(null);
    const [fromDate, setFromDate] = useState<string>("");   // YYYY-MM-DD
    const [toDate, setToDate] = useState<string>("");       // YYYY-MM-DD

    // ── UI state ──────────────────────────────────────────────────────────────
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    // ── Report state ──────────────────────────────────────────────────────────
    const [reportHtml, setReportHtml] = useState<string>("");
    const [excelLoading, setExcelLoading] = useState(false);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const lastParamsRef = useRef<{ prinCode: string; fromDate: string; toDate: string } | null>(null);

    // ── Derived ───────────────────────────────────────────────────────────────
    const allFieldsSelected = !!principal && !!fromDate && !!toDate;
    const dateRangeValid = !fromDate || !toDate || fromDate <= toDate;
    const canGenerate = allFieldsSelected && dateRangeValid;
    const reportReady = !generating && !reportError && !!reportHtml;
    const filledCount = [principal, fromDate, toDate].filter(Boolean).length;

    // ── Load principals ───────────────────────────────────────────────────────
    useEffect(() => {
        fetchLookup("WMS_Stock_principal", loginId, companyCode, "", "", "prin_code", "prin_name")
            .then(setPrincipalOptions);
    }, [companyCode, loginId]);

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleReset = () => {
        setPrincipal(null);
        setFromDate("");
        setToDate("");
        setReportError(null);
        setReportHtml("");
        lastParamsRef.current = null;
    };

    const handleGenerate = async () => {
        if (!canGenerate) return;
        setReportError(null);
        setReportHtml("");
        setGenerating(true);
        setSidebarOpen(false);

        const params = {
            prinCode: principal!.code,
            fromDate: toApiDateString(fromDate),   // e.g. "01/06/2025"
            toDate:   toApiDateString(toDate),     // e.g. "30/06/2025"
        };
        lastParamsRef.current = params;

        try {
            const html = await getDnSummaryReportHtml({
                parameter: "WMS_Stock_DN_Summary_Report",
                loginid:   loginId,
                code1:     companyCode,
                code2:     params.prinCode,
                code3:     params.fromDate,   // fromDate in place of groupCode
                code4:     params.toDate,     // toDate in place of prodCode
            });
            setReportHtml(html);
        } catch (err: any) {
            setReportError(err?.message ?? "Failed to generate report. Please try again.");
            console.error(err);
        } finally {
            setGenerating(false);
        }
    };

    const handlePrint = () => iframeRef.current?.contentWindow?.postMessage("print", "*");

    const handleExcel = async () => {
        if (!lastParamsRef.current) return;
        setExcelLoading(true);
        try {
            await getDnSummaryReportExcelDownload({
                parameter: "WMS_Stock_DN_Summary_Report",
                loginid:   loginId,
                code1:     companyCode,
                code2:     lastParamsRef.current.prinCode,
                code3:     lastParamsRef.current.fromDate,
                code4:     lastParamsRef.current.toDate,
            });
        } catch (err) {
            console.error("Excel export error:", err);
        } finally {
            setExcelLoading(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={{
            background: "#f3f4f6", minHeight: "100vh",
            fontFamily: "system-ui, -apple-system, sans-serif",
            display: "flex", flexDirection: "column",
        }}>
            <style>{`
                .dn-opt:hover { background: #f0f7ff !important; }
                .dn-ghost:hover:not(:disabled) { background: #f3f4f6 !important; }
                .dn-outline:hover:not(:disabled) { background: #f0f7ff !important; border-color: #185FA5 !important; color: #185FA5 !important; }
                .dn-primary:hover:not(:disabled) { background: #0C447C !important; }
                .dn-green:hover:not(:disabled) { background: #15803d !important; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .dn-spin { animation: spin 1s linear infinite; }
                .dn-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.25); z-index: 199; }
                .dn-sidebar {
                    position: fixed; top: 0; right: 0; bottom: 0; z-index: 200;
                    width: 320px; background: #fff;
                    border-left: 1px solid #e5e7eb;
                    display: flex; flex-direction: column;
                    transform: translateX(100%);
                    transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
                }
                .dn-sidebar.open { transform: translateX(0); }
                input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; position: absolute; right: 0; width: 36px; height: 100%; cursor: pointer; }
            `}</style>

            {/* ══ Top bar ════════════════════════════════════════════════════ */}
            <div style={{
                background: "#fff", borderBottom: "1px solid #e5e7eb",
                padding: "0 20px", flexShrink: 0,
            }}>
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    height: 56, gap: 12,
                }}>
                    {/* Title */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 8, background: "#eff6ff",
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                            <BarChart2 size={16} color="#185FA5" />
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", lineHeight: 1.2 }}>DN Summary Report</div>
                            <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.2 }}>Delivery note summary</div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {/* Print */}
                        <button className="dn-outline" onClick={handlePrint} disabled={!reportReady}
                            title={!reportReady ? "Generate a report first" : "Print / Save as PDF"}
                            style={{
                                padding: "6px 13px", border: "1px solid #d1d5db", background: "#fff",
                                display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 7,
                                color: "#374151", cursor: !reportReady ? "not-allowed" : "pointer",
                                opacity: !reportReady ? 0.4 : 1, transition: "all 0.15s", fontWeight: 500,
                            }}>
                            <Printer size={13} /> Print / PDF
                        </button>

                        {/* Excel */}
                        <button className="dn-green" onClick={handleExcel} disabled={!reportReady || excelLoading}
                            title={!reportReady ? "Generate a report first" : "Export to Excel"}
                            style={{
                                padding: "6px 13px", border: "1px solid #16a34a", background: "#16a34a",
                                display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 7,
                                color: "#fff", cursor: (!reportReady || excelLoading) ? "not-allowed" : "pointer",
                                opacity: (!reportReady || excelLoading) ? 0.45 : 1, transition: "all 0.15s", fontWeight: 500,
                            }}>
                            {excelLoading
                                ? <><RefreshCw size={13} className="dn-spin" /> Exporting…</>
                                : <><FileSpreadsheet size={13} /> Export Excel</>
                            }
                        </button>

                        {/* Divider */}
                        <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />

                        {/* Filters */}
                        <button onClick={() => setSidebarOpen((p) => !p)}
                            style={{
                                padding: "6px 13px",
                                border: `1px solid ${sidebarOpen ? "#185FA5" : "#d1d5db"}`,
                                background: sidebarOpen ? "#eff6ff" : "#fff",
                                display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 7,
                                color: sidebarOpen ? "#185FA5" : "#374151",
                                cursor: "pointer", transition: "all 0.15s", fontWeight: 500,
                            }}>
                            <SlidersHorizontal size={13} />
                            Filters
                            {filledCount > 0 && (
                                <span style={{
                                    background: "#185FA5", color: "#fff",
                                    fontSize: 10, fontWeight: 700, lineHeight: 1,
                                    padding: "2px 5px", borderRadius: 20, minWidth: 16, textAlign: "center",
                                }}>
                                    {filledCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ══ Report area ════════════════════════════════════════════════ */}
            <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column" }}>
                <div style={{
                    flex: 1, background: "#fff", border: "1px solid #e5e7eb",
                    borderRadius: 12, overflow: "hidden",
                    display: "flex", flexDirection: "column",
                    height: "calc(100vh - 104px)", minHeight: 400,
                }}>
                    {/* Empty state */}
                    {!generating && !reportError && !reportHtml && (
                        <div style={{
                            flex: 1, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", gap: 12,
                        }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: 12, background: "#f3f4f6",
                                display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                                <BarChart2 size={22} color="#d1d5db" strokeWidth={1.5} />
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>
                                    No report generated yet
                                </div>
                                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                                    Open <strong style={{ color: "#185FA5" }}>Filters</strong> to configure and generate your report
                                </div>
                            </div>
                            <button className="dn-outline" onClick={() => setSidebarOpen(true)}
                                style={{
                                    marginTop: 4, padding: "7px 16px",
                                    border: "1px solid #d1d5db", background: "#fff",
                                    display: "flex", alignItems: "center", gap: 6,
                                    fontSize: 12, borderRadius: 7, color: "#374151",
                                    cursor: "pointer", fontWeight: 500,
                                }}>
                                <SlidersHorizontal size={13} /> Open Filters
                            </button>
                        </div>
                    )}

                    {/* Loading */}
                    {generating && (
                        <div style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                            gap: 10, fontSize: 13, color: "#6b7280",
                        }}>
                            <Loader2 size={18} className="dn-spin" />
                            Generating report…
                        </div>
                    )}

                    {/* Error */}
                    {!generating && reportError && (
                        <div style={{
                            flex: 1, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", gap: 8,
                        }}>
                            <AlertTriangle size={22} color="#dc2626" strokeWidth={1.5} />
                            <div style={{ fontSize: 13, color: "#dc2626" }}>{reportError}</div>
                            <button className="dn-ghost" onClick={() => setSidebarOpen(true)}
                                style={{
                                    marginTop: 4, padding: "6px 14px",
                                    border: "1px solid #d1d5db", background: "#fff",
                                    fontSize: 12, borderRadius: 7, color: "#374151",
                                    cursor: "pointer", fontWeight: 500,
                                }}>
                                Adjust filters
                            </button>
                        </div>
                    )}

                    {/* Report iframe */}
                    {reportReady && (
                        <iframe
                            ref={iframeRef}
                            srcDoc={reportHtml}
                            title="DN Summary Report"
                            style={{ flex: 1, width: "100%", border: "none", display: "block" }}
                        />
                    )}
                </div>
            </div>

            {/* ══ Sidebar overlay ════════════════════════════════════════════ */}
            {sidebarOpen && (
                <div className="dn-overlay" onClick={() => setSidebarOpen(false)} />
            )}

            {/* ══ Sidebar panel ══════════════════════════════════════════════ */}
            <div className={`dn-sidebar${sidebarOpen ? " open" : ""}`}>

                {/* Header */}
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "16px 20px", borderBottom: "1px solid #e5e7eb", flexShrink: 0,
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <SlidersHorizontal size={15} color="#185FA5" />
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Report Filters</span>
                    </div>
                    <button onClick={() => setSidebarOpen(false)}
                        style={{
                            background: "none", border: "none", cursor: "pointer",
                            padding: 4, borderRadius: 6, color: "#6b7280", display: "flex",
                        }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

                    {/* Validation hint */}
                    {(!canGenerate) && (
                        <div style={{
                            display: "flex", alignItems: "flex-start", gap: 7,
                            padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a",
                            borderRadius: 7, fontSize: 11, color: "#92400e", marginBottom: 20, lineHeight: 1.5,
                        }}>
                            <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                            {!dateRangeValid
                                ? "From date must be on or before To date."
                                : "Select a principal and both dates to generate the report."
                            }
                        </div>
                    )}

                    {/* Principal */}
                    <div style={{ marginBottom: 18 }}>
                        <SearchableDropdown
                            label="Principal *"
                            value={principal}
                            onChange={setPrincipal}
                            options={principalOptions}
                            placeholder="Search principal…"
                        />
                    </div>

                    {/* Date range */}
                    <div style={{ marginBottom: 18 }}>
                        <DateField
                            label="From Date *"
                            value={fromDate}
                            onChange={setFromDate}
                            max={toDate || undefined}
                        />
                    </div>

                    <div style={{ marginBottom: 4 }}>
                        <DateField
                            label="To Date *"
                            value={toDate}
                            onChange={setToDate}
                            min={fromDate || undefined}
                        />
                    </div>

                    {/* Date range summary pill */}
                    {fromDate && toDate && dateRangeValid && (
                        <div style={{
                            marginTop: 14, padding: "7px 12px",
                            background: "#eff6ff", border: "1px solid #bfdbfe",
                            borderRadius: 7, fontSize: 11, color: "#0C447C",
                            display: "flex", alignItems: "center", gap: 6,
                        }}>
                            <Calendar size={11} />
                            {toApiDateString(fromDate)} → {toApiDateString(toDate)}
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div style={{
                    padding: "14px 20px", borderTop: "1px solid #e5e7eb",
                    display: "flex", gap: 8, flexShrink: 0,
                }}>
                    <button className="dn-ghost" onClick={handleReset} disabled={generating}
                        style={{
                            flex: 1, padding: "8px", border: "1px solid #d1d5db", background: "#fff",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            fontSize: 12, borderRadius: 7, color: "#374151",
                            cursor: generating ? "not-allowed" : "pointer",
                            opacity: generating ? 0.5 : 1, fontWeight: 500,
                        }}>
                        <RotateCcw size={13} /> Reset
                    </button>
                    <button className="dn-primary" onClick={handleGenerate} disabled={!canGenerate || generating}
                        style={{
                            flex: 2, padding: "8px",
                            border: "1px solid #185FA5", background: "#185FA5",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            fontSize: 12, borderRadius: 7, color: "#fff",
                            cursor: (!canGenerate || generating) ? "not-allowed" : "pointer",
                            opacity: (!canGenerate || generating) ? 0.5 : 1,
                            transition: "background 0.15s", fontWeight: 500,
                        }}>
                        {generating
                            ? <><Loader2 size={13} className="dn-spin" /> Generating…</>
                            : <><BarChart2 size={13} /> Generate Report</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}