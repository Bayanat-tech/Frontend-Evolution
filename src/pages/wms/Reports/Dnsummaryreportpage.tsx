"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
    Printer,
    RotateCcw,
    FileText,
    Download,
    Eye,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookupaccount, getLookupText, getLookupValue, LookupRow } from "../../../api/lookups";
import {
    getDnSummaryReportHtml,
    getDnSummaryReportExcelDownload,
} from "../../../api/transactions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Params {
    prin_code: string;   // "All" or comma-joined PRIN_CODEs
    from_date: string;   // "All" or "DD/MM/YYYY"
    to_date:   string;   // "All" or "DD/MM/YYYY"
}

const ALL_PARAMS: Params = { prin_code: "All", from_date: "All", to_date: "All" };

// ★ Sentinel used inside the `selected` array to represent "All selected".
//   We never join this into the API param directly — the parent translates
//   it (or an empty array) into the literal string "All" that the backend
//   proc already understands and skips the filter for.
const ALL_SENTINEL = "__ALL__";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a date input value (YYYY-MM-DD) → DD/MM/YYYY string for the API, or "All" if empty */
const toApiDateString = (isoDate: string): string => {
    if (!isoDate) return "All";
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
};

/**
 * Turns the dropdown's `selected` array into the value the API expects.
 * - []                -> "All"        (nothing picked = no filter)
 * - [ALL_SENTINEL]     -> "All"        (user explicitly picked "All")
 * - ["P001","P002"]    -> "P001,P002"  (specific codes)
 */
const toApiCodeString = (selected: string[]): string => {
    if (selected.length === 0) return "All";
    if (selected.includes(ALL_SENTINEL)) return "All";
    return selected.join(",");
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
                ...inputStyle,
                color: value ? "#111827" : "#9ca3af",
                cursor: "pointer",
            }}
        />
    </div>
);

// ─── Multi-select checkbox dropdown (same pattern as Transaction Report) ──────

type MultiSelectDropdownProps = {
    label: string;
    required?: boolean;
    selected: string[];
    onChange: (values: string[]) => void;
    loadOptions: () => Promise<LookupRow[]>;
    valueField: string;
    displayFields: string[];
    placeholder?: string;
    bgColor?: string;
};

function MultiSelectDropdown({
    label,
    required,
    selected,
    onChange,
    loadOptions,
    valueField,
    displayFields,
    placeholder = "All",
    bgColor = "#fff",
}: MultiSelectDropdownProps) {
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState<LookupRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const wrapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
                setSearch("");
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setOpen(false);
                setSearch("");
            }
        };
        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, [open]);

    const openDropdown = async () => {
        const next = !open;
        setOpen(next);
        if (next && rows.length === 0 && !loading) {
            setLoading(true);
            try {
                setRows(await loadOptions());
            } finally {
                setLoading(false);
            }
        }
    };

    const term = search.trim().toLowerCase();
    const filteredRows = term
        ? rows.filter((row) => Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(term)))
        : rows;

    const allValues = rows.map((r) => String(getLookupValue(r, valueField) ?? "")).filter(Boolean);

    // ★ FIX: "All selected" is now determined by the explicit sentinel OR by
    //   every individual value happening to be checked — not by expanding
    //   into the full list of codes on selection.
    const isAllSelected =
        selected.includes(ALL_SENTINEL) ||
        (allValues.length > 0 && allValues.every((v) => selected.includes(v)));

    // ★ FIX: clicking "All" now stores the ALL_SENTINEL instead of every
    //   individual code. This is what lets the parent translate the
    //   selection back into the literal "All" the API expects.
    const toggleAll = () => {
        if (isAllSelected) onChange([]);
        else onChange([ALL_SENTINEL]);
    };

    // ★ FIX: if the sentinel is currently active and the user unchecks one
    //   specific item, expand to "all except that one" first, so partial
    //   deselection still works as expected.
    const toggleOne = (val: string) => {
        const base = selected.includes(ALL_SENTINEL) ? allValues : selected;
        if (base.includes(val)) onChange(base.filter((v) => v !== val));
        else onChange([...base, val]);
    };

    const displayText = isAllSelected
        ? "All"
        : selected.length === 0
        ? placeholder
        : selected.length === 1
        ? (() => {
              const row = rows.find((r) => String(getLookupValue(r, valueField) ?? "") === selected[0]);
              return row ? getLookupText(row, displayFields.length ? displayFields : [valueField]) : selected[0];
          })()
        : `${selected.length} selected`;

    return (
        <div ref={wrapRef} style={{ position: "relative" }}>
            <FloatLabel label={label} required={required} bgColor={bgColor}>
                <button
                    type="button"
                    onClick={openDropdown}
                    style={{
                        ...inputStyle,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        textAlign: "left",
                    }}
                >
                    <span
                        style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: selected.length ? "#111827" : "#9ca3af",
                        }}
                    >
                        {displayText}
                    </span>
                    {open ? (
                        <ChevronUp size={14} color="#6b7280" style={{ flexShrink: 0, marginLeft: 6 }} />
                    ) : (
                        <ChevronDown size={14} color="#6b7280" style={{ flexShrink: 0, marginLeft: 6 }} />
                    )}
                </button>
            </FloatLabel>

            {open && (
                <div
                    style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        background: "#fff",
                        border: "0.5px solid #d1d5db",
                        borderRadius: 6,
                        boxShadow: "0 6px 16px rgba(0,0,0,0.1)",
                        zIndex: 50,
                        maxHeight: 260,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                    }}
                >
                    <div style={{ padding: "6px 8px", borderBottom: "0.5px solid #e5e7eb", flexShrink: 0 }}>
                        <input
                            type="text"
                            autoFocus
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            style={{ ...inputStyle, fontSize: 11, padding: "4px 8px" }}
                        />
                    </div>
                    <div style={{ overflowY: "auto", flex: 1 }}>
                        {loading ? (
                            <div style={{ padding: 12, fontSize: 12, color: "#6b7280", textAlign: "center" }}>Loading...</div>
                        ) : filteredRows.length === 0 ? (
                            <div style={{ padding: 12, fontSize: 12, color: "#6b7280", textAlign: "center" }}>No records found</div>
                        ) : (
                            <>
                                <label
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "7px 10px",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        background: isAllSelected ? "#EFF6FF" : "transparent",
                                        color: isAllSelected ? "#185FA5" : "#111827",
                                        borderBottom: "0.5px solid #f3f4f6",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={toggleAll}
                                        style={{ accentColor: "#185FA5", width: 14, height: 14 }}
                                    />
                                    All
                                </label>
                                {filteredRows.map((row, idx) => {
                                    const val = String(getLookupValue(row, valueField) ?? "");
                                    // ★ FIX: when the sentinel is active, every row should render as checked
                                    const checked = isAllSelected || selected.includes(val);
                                    const text = getLookupText(row, displayFields.length ? displayFields : [valueField]);
                                    return (
                                        <label
                                            key={val || idx}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                padding: "6px 10px",
                                                fontSize: 12,
                                                cursor: "pointer",
                                                background: checked ? "#F5F9FF" : "transparent",
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleOne(val)}
                                                style={{ accentColor: "#185FA5", width: 14, height: 14 }}
                                            />
                                            <span
                                                style={{
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    color: "#374151",
                                                }}
                                            >
                                                {text}
                                            </span>
                                        </label>
                                    );
                                })}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

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

    // ── Filter values
    const [principalCodes, setPrincipalCodes] = useState<string[]>([]); // multi-select
    const [fromDateIso, setFromDateIso] = useState<string>("");   // "" = All
    const [toDateIso,   setToDateIso]   = useState<string>("");   // "" = All

    const lastParamsRef = useRef<Params>(ALL_PARAMS);

    const dateRangeValid = !fromDateIso || !toDateIso || fromDateIso <= toDateIso;

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

    // ── Apply current filter selections
    const handleGenerateReport = () => {
        if (!dateRangeValid) return;
        const params: Params = {
            // ★ FIX: use the sentinel-aware converter instead of blindly
            //   joining principalCodes — this is what makes "All" send the
            //   literal "All" string to the API instead of every code.
            prin_code: toApiCodeString(principalCodes),
            from_date: toApiDateString(fromDateIso),
            to_date:   toApiDateString(toDateIso),
        };
        fetchReport(params);
    };

    const handleReset = () => {
        setPrincipalCodes([]);
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
                        <MultiSelectDropdown
                            label="Principal"
                            bgColor={BG}
                            selected={principalCodes}
                            onChange={setPrincipalCodes}
                            valueField="prin_code"
                            displayFields={["prin_code", "prin_name"]}
                            placeholder="All"
                            loadOptions={() =>
                                getDynamicLookupaccount({
                                    parameter: "WMS_Stock_principal",
                                    loginid: loginId,
                                    code1: companyCode,
                                    code2: "", code3: "", code4: "",
                                    number1: 0, number2: 0, number3: 0, number4: 0,
                                    date1: null, date2: null, date3: null, date4: null,
                                })
                            }
                        />
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