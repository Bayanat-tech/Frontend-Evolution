// PoOrderRegisterPage.tsx
"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, RotateCcw, FileText, Download, Loader2 } from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { LookupField } from "../../../components/ui/LookupField";
import { ReportPreviewDialog } from "../../../components/reports/ReportPreviewDialog";
import {
      getPoOrderRegisterReportHtml,
    getPoOrderRegisterReportExcel,
} from "../../../api/transactions";

interface PoOrderRegisterParams {
    loginid: string;
    company_code: string;
    fromdate: string;
    todate: string;
    ac_code: string;
    po_number: string;
    prod_code_from: string;
    prod_code_to: string;
    with_so_ref: string;
    [key: string]: any;
}

const text = (v: any) => (v === null || v === undefined ? "" : String(v));

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

// ─── Product Multi-Select (checkbox list, self-contained) ──────────────────

type LookupRowLike = Record<string, any>;

function ProductMultiSelectField({
    label,
    value,
    onChange,
    valueField,
    displayFields,
    columns,
    loadOptions,
    disabled,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    valueField: string;
    displayFields: string[];
    columns: { field: string; header: string }[];
    loadOptions: () => Promise<LookupRowLike[]>;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<LookupRowLike[]>([]);
    const [query, setQuery] = useState("");
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLDivElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);
    const selectAllRef = useRef<HTMLInputElement | null>(null);

    const selectedValues = useMemo(
        () => value.split(",").map((v) => v.trim()).filter(Boolean),
        [value]
    );

    const getVal = (row: LookupRowLike) => String(row?.[valueField] ?? "");
    const getText = (row: LookupRowLike) =>
        displayFields.map((f) => row?.[f]).filter(Boolean).join(" - ");

    const filteredRows = useMemo(() => {
        const term = query.trim().toLowerCase();
        if (!term) return rows;
        return rows.filter((row) =>
            Object.values(row).some((item) => String(item ?? "").toLowerCase().includes(term))
        );
    }, [query, rows]);

    const allLoadedValues = useMemo(() => rows.map(getVal).filter(Boolean), [rows]);
    const allSelected = allLoadedValues.length > 0 && allLoadedValues.every((v) => selectedValues.includes(v));
    const someSelected = allLoadedValues.some((v) => selectedValues.includes(v));

    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = someSelected && !allSelected;
        }
    }, [someSelected, allSelected]);

    useEffect(() => {
        if (!open) return;

        const place = () => {
            const trigger = triggerRef.current;
            if (!trigger) return;
            const rect = trigger.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const width = Math.min(Math.max(rect.width, 380), Math.min(560, vw - 24));
            const belowSpace = vh - rect.bottom - 10;
            const aboveSpace = rect.top - 10;
            const maxHeight = Math.max(220, Math.min(360, belowSpace >= 200 ? belowSpace : Math.max(belowSpace, aboveSpace)));
            const opensAbove = belowSpace < 200 && aboveSpace > belowSpace;
            const left = Math.min(Math.max(12, rect.left), vw - width - 12);
            const top = opensAbove
                ? Math.max(10, rect.top - maxHeight - 8)
                : Math.min(rect.bottom + 6, vh - maxHeight - 10);
            setPopoverStyle({ position: "fixed", left, top, width, maxHeight, zIndex: 9999 });
        };

        const close = () => setOpen(false);
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (triggerRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
            close();
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };

        place();
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, true);
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("resize", place);
            window.removeEventListener("scroll", place, true);
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const openPopover = async () => {
        if (disabled) return;
        setOpen(true);
        setLoading(true);
        try {
            setRows(await loadOptions());
        } finally {
            setLoading(false);
        }
    };

    const toggleRow = (row: LookupRowLike) => {
        const v = getVal(row);
        const isSelected = selectedValues.includes(v);
        const next = isSelected ? selectedValues.filter((x) => x !== v) : [...selectedValues, v];
        onChange(next.join(","));
    };

    const toggleSelectAll = () => {
        if (allSelected) {
            const next = selectedValues.filter((v) => !allLoadedValues.includes(v));
            onChange(next.join(","));
        } else {
            const next = Array.from(new Set([...selectedValues, ...allLoadedValues]));
            onChange(next.join(","));
        }
    };

    const displayText = rows
        .filter((row) => selectedValues.includes(getVal(row)))
        .map(getText)
        .join(", ");

    return (
        <div style={{ position: "relative" }}>
            <FloatLabel label={label} bgColor="#EEF5FD">
                <div
                    ref={triggerRef}
                    onClick={openPopover}
                    style={{
                        width: "100%",
                        fontSize: 12,
                        padding: "8px 10px",
                        border: "1px solid #d1d5db",
                        borderRadius: 7,
                        background: "#fff",
                        boxSizing: "border-box",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.6 : 1,
                    }}
                >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: displayText ? "#111827" : "#9ca3af" }}>
                        {displayText || "All"}
                    </span>
                    {selectedValues.length > 0 && (
                        <span style={{ fontSize: 10, background: "#dbeafe", color: "#1d4ed8", padding: "2px 8px", borderRadius: 10, fontWeight: 600, marginLeft: 6, flexShrink: 0 }}>
                            {selectedValues.length}
                        </span>
                    )}
                </div>
            </FloatLabel>

            {open && createPortal(
                <div
                    ref={popoverRef}
                    style={{ ...popoverStyle, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", overflow: "hidden" }}
                >
                    {/* Header */}
                    <div style={{ borderBottom: "1px solid #e5e7eb", background: "#f8fbff", padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", fontWeight: 600 }}>
                                {label}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 11, background: "#dbeafe", color: "#1d4ed8", padding: "3px 10px", borderRadius: 10, fontWeight: 600 }}>
                                    {selectedValues.length} selected
                                </span>
                                <span style={{ fontSize: 11, background: "#dbeafe", color: "#1d4ed8", padding: "3px 10px", borderRadius: 10, fontWeight: 600 }}>
                                    {rows.length} total
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    style={{ border: "none", background: "none", cursor: "pointer", color: "#6b7280", fontSize: 14, lineHeight: 1, padding: 2 }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <input
                            type="text"
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search products..."
                            style={{ width: "100%", fontSize: 12, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, outline: "none", boxSizing: "border-box" }}
                        />
                    </div>

                    {/* Table */}
                    <div style={{ overflow: "auto", flex: 1 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead style={{ position: "sticky", top: 0, background: "#1e3a8a", color: "#fff", zIndex: 1 }}>
                                <tr>
                                    <th style={{ width: 34, padding: "8px 10px", textAlign: "center" }}>
                                        <input
                                            ref={selectAllRef}
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={toggleSelectAll}
                                            disabled={loading || allLoadedValues.length === 0}
                                            style={{ width: 14, height: 14, cursor: "pointer" }}
                                        />
                                    </th>
                                    {columns.map((c) => (
                                        <th key={c.field} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>
                                            {c.header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={columns.length + 1} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>Loading...</td></tr>
                                ) : filteredRows.length === 0 ? (
                                    <tr><td colSpan={columns.length + 1} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>No records found</td></tr>
                                ) : (
                                    filteredRows.map((row, idx) => {
                                        const v = getVal(row);
                                        const isSelected = selectedValues.includes(v);
                                        return (
                                            <tr
                                                key={v || idx}
                                                onClick={() => toggleRow(row)}
                                                style={{ cursor: "pointer", background: isSelected ? "#eff6ff" : idx % 2 ? "#fafafa" : "#fff" }}
                                            >
                                                <td style={{ padding: "6px 10px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleRow(row)}
                                                        style={{ width: 14, height: 14, cursor: "pointer" }}
                                                    />
                                                </td>
                                                {columns.map((c) => (
                                                    <td key={c.field} style={{ padding: "6px 10px", color: isSelected ? "#1d4ed8" : "#374151" }}>
                                                        {row?.[c.field] ?? ""}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function PoOrderRegisterPage() {
    const { user } = useAuth();
    const companyCode = user?.company_code ?? "";
    const loginId = user?.loginid ?? user?.username ?? "ADMIN";

    const [error, setError] = useState("");

    const [fromDateIso, setFromDateIso] = useState("");
    const [toDateIso, setToDateIso] = useState("");

    // Supplier (A/c code)
    const [acCode, setAcCode] = useState("");
    const [acName, setAcName] = useState("");

    // PO Number (manual)
    const [poNumber, setPoNumber] = useState("");

    // Product (multi-select, comma-separated codes)
    const [prodCodeFrom, setProdCodeFrom] = useState("");

    // Report Criteria
    const [reportCriteria, setReportCriteria] = useState<"SO_REF_ONLY" | "ALL">("ALL");

    const lastRequestRef = useRef<PoOrderRegisterParams | null>(null);

    // ── Report preview dialog state (matches PurchaseGRNPage pattern) ──────
    const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
    const [reportPreviewUrl, setReportPreviewUrl] = useState("");
    const [reportPreviewError, setReportPreviewError] = useState("");
    const [reportPreviewLoading, setReportPreviewLoading] = useState(false);
    const [reportPreviewExporting, setReportPreviewExporting] = useState(false);

    const dateRangeValid = !fromDateIso || !toDateIso || fromDateIso <= toDateIso;

    const buildRequestParams = (): PoOrderRegisterParams => ({
        loginid: loginId,
        company_code: companyCode,
        fromdate: fromDateIso || "All",
        todate: toDateIso || "All",
        ac_code: acCode || "All",
        po_number: poNumber || "All",
        prod_code_from: prodCodeFrom || "All",
        prod_code_to: "All",
        with_so_ref: reportCriteria === "SO_REF_ONLY" ? "Y" : "N",
    });

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

        if (reportPreviewUrl) window.URL.revokeObjectURL(reportPreviewUrl);
        setReportPreviewUrl("");
        setReportPreviewError("");
        setReportPreviewOpen(true);
        setReportPreviewLoading(true);
        setError("");

        try {
            const html = await getPoOrderRegisterReportHtml(params);
            const blob = new Blob([html], { type: "text/html" });
            const url = window.URL.createObjectURL(blob);
            setReportPreviewUrl(url);
        } catch (err: any) {
            setReportPreviewError(err?.message ?? "Failed to load report. Please try again.");
        } finally {
            setReportPreviewLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRangeValid, fromDateIso, toDateIso, acCode, poNumber, prodCodeFrom, reportCriteria, companyCode, loginId]);
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
            await getPoOrderRegisterReportExcel(lastRequestRef.current);
        } catch (exportError: any) {
            setReportPreviewError(exportError?.message ?? "Error while exporting to Excel");
        } finally {
            setReportPreviewExporting(false);
        }
    };

    const handleReset = () => {
        setFromDateIso(""); setToDateIso("");
        setAcCode(""); setAcName("");
        setPoNumber("");
        setProdCodeFrom("");
        setReportCriteria("ALL");
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
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>PO Order Register</span>
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
                    <div
                        className="field-row"
                        style={{
                            background: "#EEF5FD",
                            borderRadius: 8,
                            padding: "10px 12px",
                        }}
                    >
                        {/* ───────────── First Row ───────────── */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                                gap: 10,
                                alignItems: "end",
                            }}
                        >
                            <div style={{ minWidth: 0 }}>
                                <FloatLabel label="Date From" bgColor={BG}>
                                    <DateField
                                        value={fromDateIso}
                                        onChange={setFromDateIso}
                                        max={toDateIso || undefined}
                                    />
                                </FloatLabel>
                            </div>

                            <div style={{ minWidth: 0 }}>
                                <FloatLabel label="Date To" bgColor={BG}>
                                    <DateField
                                        value={toDateIso}
                                        onChange={setToDateIso}
                                        min={fromDateIso || undefined}
                                    />
                                </FloatLabel>
                            </div>

                            <div style={{ minWidth: 0 }}>
                                <LookupField
                                    label="Supplier"
                                    value={acCode}
                                    displayValue={acName ? `${acCode} - ${acName}` : acCode}
                                    columns={[
                                        { field: "ac_code", header: "Code" },
                                        { field: "ac_name", header: "Name" },
                                        { field: "address", header: "Address" },
                                        { field: "tel", header: "Tel" },
                                        { field: "fax", header: "Fax" },
                                    ]}
                                    valueField="ac_code"
                                    displayFields={["ac_code", "ac_name"]}
                                    loadOptions={() =>
                                        getDynamicLookup({
                                            parameter: "Account_AC_CODE_Serach_HDR",
                                            code1: companyCode,
                                            loginid: loginId,
                                        })
                                    }
                                    disabled={false}
                                    onChange={(value: string, row: any) => {
                                        setAcCode(value);
                                        setAcName(text(getLookupValue(row || {}, "ac_name")));
                                    }}
                                />
                            </div>

                            <div style={{ minWidth: 0 }}>
                                <FloatLabel label="PO Number" bgColor={BG}>
                                    <input
                                        type="text"
                                        value={poNumber}
                                        onChange={(e) => setPoNumber(e.target.value)}
                                        placeholder="number"
                                        style={inputStyle}
                                    />
                                </FloatLabel>
                            </div>
                        </div>

                        {/* ───────────── Second Row : Product (Multi-select checkboxes) ───────────── */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr",
                                gap: 10,
                                marginTop: 12,
                                maxWidth: "50%",
                                alignItems: "end",
                            }}
                        >
                            <div style={{ minWidth: 0 }}>
                                <ProductMultiSelectField
                                    label="Product"
                                    value={prodCodeFrom}
                                    onChange={setProdCodeFrom}
                                    valueField="prod_code"
                                    displayFields={["prod_code", "prod_name"]}
                                    columns={[
                                        { field: "prod_code", header: "Code" },
                                        { field: "prod_name", header: "Name" },
                                        { field: "p_uom", header: "P Uom" },
                                        { field: "unit_price", header: "Unit Price" },
                                    ]}
                                    loadOptions={() =>
                                        getDynamicLookup({
                                            parameter: "PS_POORDER_ENTRY_PRODUCT_LIST",
                                            code1: companyCode,
                                            loginid: loginId,
                                        })
                                    }
                                    disabled={false}
                                />
                            </div>
                        </div>

                        {/* ───────────── Report Criteria ───────────── */}
                        <div
                            style={{
                                marginTop: 14,
                                width: "50%",
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
                                    background: BG,
                                    padding: "0 5px",
                                    fontSize: 11,
                                    color: "#6b7280",
                                    fontWeight: 500,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                }}
                            >
                                Report Criteria
                            </span>

                            <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
                                <label
                                    style={{
                                        display: "flex", alignItems: "center", gap: 7,
                                        fontSize: 12, color: "#374151", cursor: "pointer", whiteSpace: "nowrap",
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="reportCriteria"
                                        value="SO_REF_ONLY"
                                        checked={reportCriteria === "SO_REF_ONLY"}
                                        onChange={() => setReportCriteria("SO_REF_ONLY")}
                                        style={{ width: 16, height: 16, margin: 0, accentColor: "#185FA5", cursor: "pointer" }}
                                    />
                                    With SO Ref. Only
                                </label>

                                <label
                                    style={{
                                        display: "flex", alignItems: "center", gap: 7,
                                        fontSize: 12, color: "#374151", cursor: "pointer", whiteSpace: "nowrap",
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="reportCriteria"
                                        value="ALL"
                                        checked={reportCriteria === "ALL"}
                                        onChange={() => setReportCriteria("ALL")}
                                        style={{ width: 16, height: 16, margin: 0, accentColor: "#185FA5", cursor: "pointer" }}
                                    />
                                    All
                                </label>
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
                                <><Printer size={13} /> Print / Preview</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {reportPreviewOpen && (
                <ReportPreviewDialog
                    title="PO Order Register"
                    pdfUrl={reportPreviewUrl}
                    error={reportPreviewError}
                    exporting={reportPreviewExporting}
                    onExcel={handleReportPreviewExcel}
                    onClose={closeReportPreview}
                    onDownload={() => {}}
                    downloadName="PO_Order_Register_Report.html"
                />
            )}
        </div>
    );
}