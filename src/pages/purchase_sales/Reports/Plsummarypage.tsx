"use client";

import React, { useState, useRef, useCallback } from "react";
import {
    Printer,
    RotateCcw,
    FileText,
    Download,
    Eye,
} from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookupaccount, getLookupText, getLookupValue, LookupRow } from "../../../api/lookups";
import {
    getPLSummaryReportHtml,
    getPLSummaryReportExcel
} from "../../../api/transactions";
import { useEffect } from "react";

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
    [key: string]: any;
}

const LOOKUP_PARAMS = {
    group: "PURCHASE_SALE_MSE_PRODGROUP",
    brand: "PURCHASE_SALE_MSE_PRODBRAND",
    category: "PURCHASE_SALE_MSE_PRODCATEGORY",
    type: "PURCHASE_SALE_MSE_PRODTYPE",
    manufacturer: "PURCHASE_SALE_MSE_MANUFACTURER",
    customer: "PURCHASE_SALE_MSE_CUSTOMER",
    salesman: "PURCHASE_SALE_MSE_SALESMAN",
    docno: "PURCHASE_SALE_SALESINVOICE_DOCNO", // ← new lookup added in procedure
} as const;

export type ReportMode =
    | "invoicewise"
    | "customerwise"
    | "salesmanwise"
    | "customergroupwise"
    | "groupcustomerwise";

const MODE_OPTIONS: { value: ReportMode; label: string }[] = [
    { value: "invoicewise", label: "Invoice wise" },
    { value: "customerwise", label: "Customer wise" },
    { value: "salesmanwise", label: "Salesman wise" },
    { value: "customergroupwise", label: "Customer-Group wise" },
    { value: "groupcustomerwise", label: "Group-Customer wise" },
];

type TabKey = "group" | "brand" | "category" | "type" | "manufacturer" | "customer";

const TABS: { key: TabKey; label: string; lookupParam: string; valueField: string; nameField: string }[] = [
    { key: "group", label: "Group", lookupParam: LOOKUP_PARAMS.group, valueField: "group_code", nameField: "group_name" },
    { key: "brand", label: "Brand", lookupParam: LOOKUP_PARAMS.brand, valueField: "brand_code", nameField: "brand_name" },
    { key: "category", label: "Category", lookupParam: LOOKUP_PARAMS.category, valueField: "category_code", nameField: "category_name" },
    { key: "type", label: "Type", lookupParam: LOOKUP_PARAMS.type, valueField: "prodtype_code", nameField: "prodtype_name" },
    { key: "manufacturer", label: "Manufacturer", lookupParam: LOOKUP_PARAMS.manufacturer, valueField: "manu_code", nameField: "manu_name" },
    { key: "customer", label: "Customer", lookupParam: LOOKUP_PARAMS.customer, valueField: "ac_code", nameField: "ac_name" },
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

// ─── Single-select searchable lookup (Sales Person / Invoice No) ──────────

type SingleLookupProps = {
    label: string;
    value: string;
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

const ALL_SENTINEL = "__ALL__";

type MultiSelectDropdownProps = {
    label: string;
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

    const isAllSelected =
        selected.includes(ALL_SENTINEL) ||
        (allValues.length > 0 && allValues.every((v) => selected.includes(v)));

    const toggleAll = () => {
        if (isAllSelected) onChange([]);
        else onChange([ALL_SENTINEL]);
    };

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
            <FloatLabel label={label} bgColor={bgColor}>
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

function toApiCodeString(selected: string[]): string {
    if (selected.length === 0) return "All";
    if (selected.includes(ALL_SENTINEL)) return "All";
    return selected.join(",");
}

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
    const [invoiceNo, setInvoiceNo] = useState(""); // ← ata doc_no value store hoto (dropdown selected)
    const [salesman, setSalesman] = useState("");
    const [mode, setMode] = useState<ReportMode>("invoicewise");
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
        group: toApiCodeString(selections.group),
        brand: toApiCodeString(selections.brand),
        prodcategory: toApiCodeString(selections.category),
        prodtype: toApiCodeString(selections.type),
        manu: toApiCodeString(selections.manufacturer),
        cust: toApiCodeString(selections.customer),
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
            await getPLSummaryReportExcel(lastRequestRef.current);
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

                    {/* ── Top fields + Report Criteria ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                        <div className="field-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <FloatLabel label="Date From" bgColor={BG}>
                                <DateField value={fromDateIso} onChange={setFromDateIso} max={toDateIso || undefined} />
                            </FloatLabel>
                            <FloatLabel label="Date To" bgColor={BG}>
                                <DateField value={toDateIso} onChange={setToDateIso} min={fromDateIso || undefined} />
                            </FloatLabel>

                            {/* Invoice No — ata SingleSelectLookup dropdown */}
                            <SingleSelectLookup
                                label="Invoice No"
                                bgColor={BG}
                                value={invoiceNo}
                                onChange={setInvoiceNo}
                                valueField="doc_no"
                                displayFields={["inv_no"]}
                                loadOptions={() =>
                                    getDynamicLookupaccount({
                                        parameter: LOOKUP_PARAMS.docno,
                                        loginid: loginId,
                                        code1: companyCode,
                                        code2: "", code3: "", code4: "",
                                        number1: 0, number2: 0, number3: 0, number4: 0,
                                        date1: null, date2: null, date3: null, date4: null,
                                    })
                                }
                            />
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

                    {/* ── Group / Brand / Category / Type / Manufacturer / Customer ── */}
                    <div className="field-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
                        {TABS.map((t) => (
                            <MultiSelectDropdown
                                key={t.key}
                                label={t.label}
                                bgColor={BG}
                                selected={selections[t.key]}
                                onChange={(vals) => setSelections((s) => ({ ...s, [t.key]: vals }))}
                                valueField={t.valueField}
                                displayFields={[t.valueField, t.nameField]}
                                placeholder="All"
                                loadOptions={() =>
                                    getDynamicLookupaccount({
                                        parameter: t.lookupParam,
                                        loginid: loginId,
                                        code1: companyCode,
                                        code2: "", code3: "", code4: "",
                                        number1: 0, number2: 0, number3: 0, number4: 0,
                                        date1: null, date2: null, date3: null, date4: null,
                                    })
                                }
                            />
                        ))}
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4, marginLeft: 4 }}>
                        Leave a field on "All" to include every value for that filter.
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