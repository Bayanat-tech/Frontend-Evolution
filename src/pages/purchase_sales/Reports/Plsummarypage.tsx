"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
    Printer,
    RotateCcw,
    FileText,
    Download,
    Eye,
} from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookupaccount, getLookupText, getLookupValue, LookupRow } from "../../../api/lookups";
// ─── Inline API client (merged in so this is a single file) ───────────────
// I don't have visibility into your actual axios/fetch wrapper, so this is a
// plain fetch() call mirroring the shape of your DN Summary calls. Swap in
// whatever helper getDnSummaryReportHtml actually uses if it differs.

interface PLSummaryReportParams {
    parameter: string;
    loginid: string;
    company_code: string;
    mode: ReportMode;
    fromdate: string;
    todate: string;
    docno: string;
    salesman: string;
    group: string;
    brand: string;
    prodcategory: string;
    prodtype: string;
    manu: string;
    cust: string;
}

const PL_API_BASE = "/api/reports/pl-summary";

async function getPLSummaryReportHtml(params: PLSummaryReportParams): Promise<string> {
    const res = await fetch(`${PL_API_BASE}/html`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Failed to generate report");
    }
    return res.text();
}

async function getPLSummaryReportExcelDownload(params: PLSummaryReportParams): Promise<void> {
    const res = await fetch(`${PL_API_BASE}/excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Failed to export Excel");
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "PL_Summary_Report.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}

// ─── NOTE ──────────────────────────────────────────────────────────────────
// Lookup parameter names below marked "CONFIRM" are guesses following your
// existing naming convention (PURCHASE_SALE_MSE_*). Only PRODBRAND,
// PRODCATEGORY and PRODTYPE were given to me explicitly — please verify the
// rest against your actual WMSTST lookup procedures before shipping.
// ────────────────────────────────────────────────────────────────────────────

const LOOKUP_PARAMS = {
    group:        "PURCHASE_SALE_MSE_PRODGROUP",     // CONFIRM
    brand:        "PURCHASE_SALE_MSE_PRODBRAND",
    category:     "PURCHASE_SALE_MSE_PRODCATEGORY",
    type:         "PURCHASE_SALE_MSE_PRODTYPE",
    manufacturer: "PURCHASE_SALE_MSE_MANUFACTURER",  // CONFIRM
    customer:     "PURCHASE_SALE_MSE_CUSTOMER",      // CONFIRM
    salesman:     "PURCHASE_SALE_MSE_SALESMAN",      // CONFIRM
} as const;

// ─── Types ────────────────────────────────────────────────────────────────

export type ReportMode =
    | "invoicewise"
    | "customerwise"
    | "salesmanwise"
    | "customergroupwise"
    | "groupcustomerwise";

const MODE_OPTIONS: { value: ReportMode; label: string }[] = [
    { value: "invoicewise",      label: "Invoice wise" },
    { value: "customerwise",     label: "Customer wise" },
    { value: "salesmanwise",     label: "Salesman wise" },
    { value: "customergroupwise", label: "Customer-Group wise" },
    { value: "groupcustomerwise", label: "Group-Customer wise" },
];

type TabKey = "group" | "brand" | "category" | "type" | "manufacturer" | "customer";

const TABS: { key: TabKey; label: string; lookupParam: string; valueField: string; nameField: string }[] = [
    { key: "group",        label: "Group",        lookupParam: LOOKUP_PARAMS.group,        valueField: "group_code",    nameField: "group_name" },
    { key: "brand",        label: "Brand",        lookupParam: LOOKUP_PARAMS.brand,        valueField: "brand_code",    nameField: "brand_name" },
    { key: "category",     label: "Category",     lookupParam: LOOKUP_PARAMS.category,     valueField: "category_code", nameField: "category_name" },
    { key: "type",         label: "Type",         lookupParam: LOOKUP_PARAMS.type,         valueField: "prodtype_code", nameField: "prodtype_name" },
    { key: "manufacturer", label: "Manufacturer", lookupParam: LOOKUP_PARAMS.manufacturer, valueField: "manu_code",     nameField: "manu_name" },
    { key: "customer",     label: "Customer",     lookupParam: LOOKUP_PARAMS.customer,     valueField: "ac_code",       nameField: "ac_name" },
];

interface Selections {
    group: string[];
    brand: string[];
    category: string[];
    type: string[];
    manufacturer: string[];
    customer: string[];
}

const EMPTY_SELECTIONS: Selections = {
    group: [], brand: [], category: [], type: [], manufacturer: [], customer: [],
};

// ─── Shared styles ─────────────────────────────────────────────────────────

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

// ─── Single-select searchable lookup (Sales Person) ───────────────────────

type SingleLookupProps = {
    label: string;
    value: string;          // "" = All
    onChange: (v: string) => void;
    loadOptions: () => Promise<LookupRow[]>;
    valueField: string;
    displayFields: string[];
    bgColor?: string;
};

function SingleSelectLookup({ label, value, onChange, loadOptions, valueField, displayFields, bgColor = "#fff" }: SingleLookupProps) {
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
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    const openDropdown = async () => {
        const next = !open;
        setOpen(next);
        if (next && rows.length === 0 && !loading) {
            setLoading(true);
            try { setRows(await loadOptions()); } finally { setLoading(false); }
        }
    };

    const term = search.trim().toLowerCase();
    const filtered = term
        ? rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(term)))
        : rows;

    const selectedRow = rows.find((r) => String(getLookupValue(r, valueField) ?? "") === value);
    const displayText = !value ? "All" : selectedRow ? getLookupText(selectedRow, displayFields) : value;

    return (
        <div ref={wrapRef} style={{ position: "relative" }}>
            <FloatLabel label={label} bgColor={bgColor}>
                <button
                    type="button"
                    onClick={openDropdown}
                    style={{ ...inputStyle, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", textAlign: "left" }}
                >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: value ? "#111827" : "#9ca3af" }}>
                        {displayText}
                    </span>
                </button>
            </FloatLabel>
            {open && (
                <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff",
                    border: "0.5px solid #d1d5db", borderRadius: 6, boxShadow: "0 6px 16px rgba(0,0,0,0.1)",
                    zIndex: 50, maxHeight: 260, display: "flex", flexDirection: "column", overflow: "hidden",
                }}>
                    <div style={{ padding: "6px 8px", borderBottom: "0.5px solid #e5e7eb" }}>
                        <input
                            type="text" autoFocus value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            style={{ ...inputStyle, fontSize: 11, padding: "4px 8px" }}
                        />
                    </div>
                    <div style={{ overflowY: "auto", flex: 1 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", background: !value ? "#EFF6FF" : "transparent" }}>
                            <input type="radio" checked={!value} onChange={() => { onChange(""); setOpen(false); setSearch(""); }} />
                            All
                        </label>
                        {loading ? (
                            <div style={{ padding: 12, fontSize: 12, color: "#6b7280", textAlign: "center" }}>Loading...</div>
                        ) : filtered.length === 0 ? (
                            <div style={{ padding: 12, fontSize: 12, color: "#6b7280", textAlign: "center" }}>No records found</div>
                        ) : filtered.map((row, idx) => {
                            const v = String(getLookupValue(row, valueField) ?? "");
                            const text = getLookupText(row, displayFields);
                            return (
                                <label key={v || idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer", background: value === v ? "#F5F9FF" : "transparent" }}>
                                    <input type="radio" checked={value === v} onChange={() => { onChange(v); setOpen(false); setSearch(""); }} />
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#374151" }}>{text}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Dual-list transfer control (Group / Brand / Category / Type / Manufacturer / Customer tabs) ──

type TransferListProps = {
    selected: string[];
    onChange: (values: string[]) => void;
    loadOptions: () => Promise<LookupRow[]>;
    valueField: string;
    nameField: string;
};

function TransferList({ selected, onChange, loadOptions, valueField, nameField }: TransferListProps) {
    const [rows, setRows] = useState<LookupRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        loadOptions()
            .then((r) => { if (!cancelled) { setRows(r); setLoaded(true); } })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const term = search.trim().toLowerCase();
    const availableRows = rows.filter((r) => !selected.includes(String(getLookupValue(r, valueField) ?? "")));
    const filteredAvailable = term
        ? availableRows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(term)))
        : availableRows;

    const selectedRows = selected
        .map((code) => rows.find((r) => String(getLookupValue(r, valueField) ?? "") === code))
        .filter(Boolean) as LookupRow[];

    const addCode = (code: string) => onChange([...selected, code]);
    const removeCode = (code: string) => onChange(selected.filter((c) => c !== code));
    const addAll = () => onChange(rows.map((r) => String(getLookupValue(r, valueField) ?? "")));
    const clearAll = () => onChange([]);

    const listBoxStyle: React.CSSProperties = {
        border: "0.5px solid #d1d5db",
        borderRadius: 6,
        height: 220,
        overflowY: "auto",
        background: "#fff",
    };

    const rowStyle = (highlight: boolean): React.CSSProperties => ({
        display: "grid",
        gridTemplateColumns: "90px 1fr",
        gap: 6,
        padding: "5px 8px",
        fontSize: 12,
        cursor: "pointer",
        borderBottom: "0.5px solid #f3f4f6",
        background: highlight ? "#F5F9FF" : "transparent",
    });

    return (
        <div>
            <div style={{ marginBottom: 6 }}>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search available..."
                    style={{ ...inputStyle, fontSize: 11, padding: "5px 8px", maxWidth: 260 }}
                />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "stretch" }}>
                {/* Available */}
                <div>
                    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", background: "#e5e7eb", fontSize: 11, fontWeight: 600, padding: "5px 8px", borderRadius: "6px 6px 0 0", color: "#374151" }}>
                        <span>Code</span><span>Name</span>
                    </div>
                    <div style={{ ...listBoxStyle, borderRadius: "0 0 6px 6px" }}>
                        {loading && !loaded ? (
                            <div style={{ padding: 12, fontSize: 12, color: "#6b7280", textAlign: "center" }}>Loading...</div>
                        ) : filteredAvailable.length === 0 ? (
                            <div style={{ padding: 12, fontSize: 12, color: "#6b7280", textAlign: "center" }}>No records</div>
                        ) : filteredAvailable.map((row, idx) => {
                            const code = String(getLookupValue(row, valueField) ?? "");
                            const name = String(getLookupValue(row, nameField) ?? "");
                            return (
                                <div key={code || idx} style={rowStyle(false)} onDoubleClick={() => addCode(code)} onClick={() => addCode(code)} title="Click to add">
                                    <span style={{ color: "#185FA5", fontWeight: 500 }}>{code}</span>
                                    <span style={{ color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Transfer buttons */}
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
                    <button type="button" onClick={addAll} style={transferBtnStyle} title="Add all">{"\u00bb"}</button>
                    <button type="button" onClick={clearAll} style={transferBtnStyle} title="Remove all">{"\u00ab"}</button>
                </div>

                {/* Selected */}
                <div>
                    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", background: "#e5e7eb", fontSize: 11, fontWeight: 600, padding: "5px 8px", borderRadius: "6px 6px 0 0", color: "#374151" }}>
                        <span>Code</span><span>Name</span>
                    </div>
                    <div style={{ ...listBoxStyle, borderRadius: "0 0 6px 6px" }}>
                        {selectedRows.length === 0 ? (
                            <div style={{ padding: 12, fontSize: 12, color: "#6b7280", textAlign: "center" }}>All (none selected = no filter)</div>
                        ) : selectedRows.map((row, idx) => {
                            const code = String(getLookupValue(row, valueField) ?? "");
                            const name = String(getLookupValue(row, nameField) ?? "");
                            return (
                                <div key={code || idx} style={rowStyle(true)} onDoubleClick={() => removeCode(code)} onClick={() => removeCode(code)} title="Click to remove">
                                    <span style={{ color: "#185FA5", fontWeight: 500 }}>{code}</span>
                                    <span style={{ color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

const transferBtnStyle: React.CSSProperties = {
    padding: "6px 10px",
    border: "0.5px solid #d1d5db",
    background: "#fff",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    color: "#185FA5",
    fontWeight: 700,
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function PLSummaryPage() {
    const { user } = useAuth();
    const companyCode = user?.company_code ?? "";
    const loginId = user?.loginid ?? user?.username ?? "ADMIN";

    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState("");
    const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
    const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);
    const reportWindowRef = useRef<Window | null>(null);

    const [fromDateIso, setFromDateIso] = useState("");
    const [toDateIso, setToDateIso] = useState("");
    const [invoiceNo, setInvoiceNo] = useState("");
    const [salesman, setSalesman] = useState("");
    const [mode, setMode] = useState<ReportMode>("invoicewise");
    const [activeTab, setActiveTab] = useState<TabKey>("group");
    const [selections, setSelections] = useState<Selections>(EMPTY_SELECTIONS);

    const lastRequestRef = useRef<PLSummaryReportParams | null>(null);

    const dateRangeValid = !fromDateIso || !toDateIso || fromDateIso <= toDateIso;

    const buildRequestParams = (): PLSummaryReportParams => ({
        parameter: "PL_SUMMARY_REPORT",
        loginid: loginId,
        company_code: companyCode,
        mode,
        fromdate: fromDateIso || "All",
        todate: toDateIso || "All",
        docno: invoiceNo || "0",
        salesman: salesman || "All",
        group: selections.group.length ? selections.group.join(",") : "All",
        brand: selections.brand.length ? selections.brand.join(",") : "All",
        prodcategory: selections.category.length ? selections.category.join(",") : "All",
        prodtype: selections.type.length ? selections.type.join(",") : "All",
        manu: selections.manufacturer.length ? selections.manufacturer.join(",") : "All",
        cust: selections.customer.length ? selections.customer.join(",") : "All",
    });

    const fetchReport = useCallback(async (params: PLSummaryReportParams) => {
        setLoading(true);
        setError("");
        lastRequestRef.current = params;

        const newTab = window.open("", "_blank");
        if (!newTab) {
            setLoading(false);
            setError("Your browser blocked the new tab. Please allow pop-ups for this site and try again.");
            return;
        }
        newTab.document.write("<title>P&amp;L Summary Report</title><body style='font-family:sans-serif;padding:40px;color:#6b7280;'>Loading report…</body>");

        try {
            const html = await getPLSummaryReportHtml(params);
            newTab.document.open();
            newTab.document.write(html);
            newTab.document.close();
            reportWindowRef.current = newTab;
            setHasGeneratedReport(true);
            setLastGeneratedAt(new Date());
        } catch (err: any) {
            newTab.document.open();
            newTab.document.write("<title>P&amp;L Summary Report</title><body style='font-family:sans-serif;padding:40px;color:#dc2626;'>Failed to load report. Please close this tab and try again.</body>");
            newTab.document.close();
            setError(err?.message ?? "Failed to load report. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    const handleGenerateReport = () => {
        if (!dateRangeValid) return;
        fetchReport(buildRequestParams());
    };

    const handleReset = () => {
        setFromDateIso(""); setToDateIso(""); setInvoiceNo(""); setSalesman("");
        setMode("invoicewise"); setSelections(EMPTY_SELECTIONS);
        setError(""); setHasGeneratedReport(false); setLastGeneratedAt(null);
    };

    const handlePrint = () => {
        if (reportWindowRef.current && !reportWindowRef.current.closed) {
            reportWindowRef.current.focus();
            reportWindowRef.current.print();
        } else {
            setError("No open report tab to print. Generate the report again.");
        }
    };

    const handleExcel = async () => {
        if (!lastRequestRef.current) {
            setError("Generate the report at least once before exporting to Excel.");
            return;
        }
        setExporting(true);
        try {
            await getPLSummaryReportExcelDownload(lastRequestRef.current);
        } catch (err) {
            console.error("Excel export error:", err);
            alert("Excel export failed. Please try again.");
        } finally {
            setExporting(false);
        }
    };

    const BG = "#EEF5FD";
    const activeTabDef = TABS.find((t) => t.key === activeTab)!;

    return (
        <div style={{ background: "#f3f4f6", padding: "6px 10px", fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
            <style>{`
                .action-btn-primary:hover { background: #1e40af !important; }
                .action-btn-excel:hover { background: #EBF4FF !important; border-color: #185FA5 !important; color: #185FA5 !important; }
                .field-row { background: #EEF5FD; border-radius: 8px; padding: 10px 12px; }
                .tab-btn { padding: 6px 14px; font-size: 12px; border: none; background: transparent; cursor: pointer; color: #6b7280; border-bottom: 2px solid transparent; }
                .tab-btn.active { color: #185FA5; font-weight: 600; border-bottom: 2px solid #185FA5; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>

            <div style={{ maxWidth: 1400, margin: "0 auto" }}>
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "8px 12px" }}>

                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <FileText size={17} color="#185FA5" />
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>P&amp;L Summary Report</span>
                        {hasGeneratedReport && (
                            <span style={{ fontSize: 10, background: "#d1fae5", color: "#065f46", padding: "2px 10px", borderRadius: 12, fontWeight: 500 }}>
                                Report Generated
                            </span>
                        )}
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

                    {/* ── Top fields + Report Criteria (matches image1) ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                        <div className="field-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <FloatLabel label="Date From" bgColor={BG}>
                                <DateField value={fromDateIso} onChange={setFromDateIso} max={toDateIso || undefined} />
                            </FloatLabel>
                            <FloatLabel label="Date To" bgColor={BG}>
                                <DateField value={toDateIso} onChange={setToDateIso} min={fromDateIso || undefined} />
                            </FloatLabel>
                            <FloatLabel label="Invoice No" bgColor={BG}>
                                <input
                                    type="text"
                                    value={invoiceNo}
                                    onChange={(e) => setInvoiceNo(e.target.value)}
                                    placeholder="All"
                                    style={inputStyle}
                                />
                            </FloatLabel>
                            <SingleSelectLookup
                                label="Sales Person"
                                bgColor={BG}
                                value={salesman}
                                onChange={setSalesman}
                                valueField="salesman_code"
                                displayFields={["salesman_code", "salesman_name"]}
                                loadOptions={() =>
                                    getDynamicLookupaccount({
                                        parameter: LOOKUP_PARAMS.salesman,
                                        loginid: loginId,
                                        code1: companyCode,
                                        code2: "", code3: "", code4: "",
                                        number1: 0, number2: 0, number3: 0, number4: 0,
                                        date1: null, date2: null, date3: null, date4: null,
                                    })
                                }
                            />
                        </div>

                        {/* Report Criteria box */}
                        <div style={{ border: "0.5px solid #d1d5db", borderRadius: 8, padding: "8px 12px" }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                                Report Criteria
                            </div>
                            {MODE_OPTIONS.map((opt) => (
                                <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 12, cursor: "pointer", color: "#374151" }}>
                                    <input type="radio" name="reportMode" checked={mode === opt.value} onChange={() => setMode(opt.value)} />
                                    {opt.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* ── Tabs for Group / Brand / Category / Type / Manufacturer / Customer ── */}
                    <div style={{ marginTop: 12 }}>
                        <div style={{ display: "flex", gap: 4, borderBottom: "0.5px solid #e5e7eb" }}>
                            {TABS.map((t) => {
                                const count = selections[t.key].length;
                                return (
                                    <button
                                        key={t.key}
                                        type="button"
                                        className={`tab-btn ${activeTab === t.key ? "active" : ""}`}
                                        onClick={() => setActiveTab(t.key)}
                                    >
                                        {t.label}{count > 0 ? ` (${count})` : ""}
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{ paddingTop: 10 }}>
                            <TransferList
                                selected={selections[activeTabDef.key]}
                                onChange={(vals) => setSelections((s) => ({ ...s, [activeTabDef.key]: vals }))}
                                valueField={activeTabDef.valueField}
                                nameField={activeTabDef.nameField}
                                loadOptions={() =>
                                    getDynamicLookupaccount({
                                        parameter: activeTabDef.lookupParam,
                                        loginid: loginId,
                                        code1: companyCode,
                                        code2: "", code3: "", code4: "",
                                        number1: 0, number2: 0, number3: 0, number4: 0,
                                        date1: null, date2: null, date3: null, date4: null,
                                    })
                                }
                            />
                        </div>
                        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                            Leave a tab's selection empty to include all {activeTabDef.label.toLowerCase()}s.
                        </div>
                    </div>

                    {/* Status bar */}
                    {hasGeneratedReport && (
                        <div style={{ marginTop: 10, padding: "8px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 16 }}>✅</span>
                                <span style={{ fontSize: 12, color: "#065f46" }}>Report generated successfully at {lastGeneratedAt?.toLocaleTimeString()}</span>
                            </div>
                            <button
                                onClick={() => {
                                    if (reportWindowRef.current && !reportWindowRef.current.closed) reportWindowRef.current.focus();
                                    else setError("Report tab is closed. Please generate again.");
                                }}
                                style={{ padding: "4px 12px", background: "#185FA5", color: "#fff", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                            >
                                <Eye size={12} /> Open Report
                            </button>
                        </div>
                    )}

                    {/* Action bar */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, paddingTop: 8, borderTop: "0.5px solid #e5e7eb" }}>
                        <button className="action-btn-excel" onClick={handleReset} disabled={loading}
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151", opacity: loading ? 0.6 : 1 }}>
                            <RotateCcw size={13} /> Reset
                        </button>
                        <button className="action-btn-excel" onClick={handlePrint} disabled={!hasGeneratedReport || loading}
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: (!hasGeneratedReport || loading) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151", opacity: (!hasGeneratedReport || loading) ? 0.5 : 1 }}>
                            <Printer size={13} /> Print
                        </button>
                        <button className="action-btn-excel" onClick={handleExcel} disabled={!hasGeneratedReport || loading || exporting}
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: (!hasGeneratedReport || loading || exporting) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151", opacity: (!hasGeneratedReport || loading || exporting) ? 0.5 : 1 }}>
                            <Download size={13} /> {exporting ? "Exporting..." : "Export Excel"}
                        </button>
                        <button className="action-btn-primary" onClick={handleGenerateReport} disabled={loading || !dateRangeValid}
                            style={{ padding: "7px 16px", border: "0.5px solid #185FA5", background: (loading || !dateRangeValid) ? "#94a3b8" : "#185FA5", cursor: (loading || !dateRangeValid) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#fff", transition: "background 0.2s" }}>
                            {loading ? (
                                <>
                                    <span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                                    Generating...
                                </>
                            ) : (
                                <><Eye size={13} /> View Report</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}