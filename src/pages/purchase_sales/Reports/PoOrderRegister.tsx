"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search } from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { LookupField } from "../../../components/ui/LookupField";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { ReportPreviewDialog } from "../../../components/reports/ReportPreviewDialog";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
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

    const selectedValues = React.useMemo(
        () => value.split(",").map((v) => v.trim()).filter(Boolean),
        [value]
    );

    const getVal = (row: LookupRowLike) => String(row?.[valueField] ?? "");
    const getText = (row: LookupRowLike) =>
        displayFields.map((f) => row?.[f]).filter(Boolean).join(" - ");

    const filteredRows = React.useMemo(() => {
        const term = query.trim().toLowerCase();
        if (!term) return rows;
        return rows.filter((row) =>
            Object.values(row).some((item) => String(item ?? "").toLowerCase().includes(term))
        );
    }, [query, rows]);

    const allLoadedValues = React.useMemo(() => rows.map(getVal).filter(Boolean), [rows]);
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
        <div className="freight-report-multi-select" style={{ position: "relative" }}>
            <Field label={label}>
                <div
                    ref={triggerRef}
                    onClick={openPopover}
                    className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
                    style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
                    }}
                >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: displayText ? "inherit" : "#9ca3af" }}>
                        {displayText || "All"}
                    </span>
                    {selectedValues.length > 0 && (
                        <span style={{ fontSize: 10, background: "#dbeafe", color: "#1d4ed8", padding: "2px 8px", borderRadius: 10, fontWeight: 600, marginLeft: 6, flexShrink: 0 }}>
                            {selectedValues.length}
                        </span>
                    )}
                </div>
            </Field>
            <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 4 }}>Click to select multiple</div>

            {open && createPortal(
                <div
                    ref={popoverRef}
                    style={{ ...popoverStyle, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", overflow: "hidden" }}
                >
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
                                <button type="button" onClick={() => setOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "#6b7280", fontSize: 14, lineHeight: 1, padding: 2 }}>✕</button>
                            </div>
                        </div>
                        <input
                            type="text" autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search products..."
                            style={{ width: "100%", fontSize: 12, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, outline: "none", boxSizing: "border-box" }}
                        />
                    </div>
                    <div style={{ overflow: "auto", flex: 1 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead style={{ position: "sticky", top: 0, background: "#1e3a8a", color: "#fff", zIndex: 1 }}>
                                <tr>
                                    <th style={{ width: 34, padding: "8px 10px", textAlign: "center" }}>
                                        <input
                                            ref={selectAllRef} type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                                            disabled={loading || allLoadedValues.length === 0}
                                            style={{ width: 14, height: 14, cursor: "pointer" }}
                                        />
                                    </th>
                                    {columns.map((c) => (
                                        <th key={c.field} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600 }}>{c.header}</th>
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
                                            <tr key={v || idx} onClick={() => toggleRow(row)} style={{ cursor: "pointer", background: isSelected ? "#eff6ff" : idx % 2 ? "#fafafa" : "#fff" }}>
                                                <td style={{ padding: "6px 10px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                                                    <input type="checkbox" checked={isSelected} onChange={() => toggleRow(row)} style={{ width: 14, height: 14, cursor: "pointer" }} />
                                                </td>
                                                {columns.map((c) => (
                                                    <td key={c.field} style={{ padding: "6px 10px", color: isSelected ? "#1d4ed8" : "#374151" }}>{row?.[c.field] ?? ""}</td>
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
    const userRecord = (user || {}) as Record<string, unknown>;
    const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "");
    const loginId = String(userRecord.loginid || userRecord.username || "ADMIN");

    const [fromDateIso, setFromDateIso] = useState("");
    const [toDateIso, setToDateIso] = useState("");
    const [acCode, setAcCode] = useState("");
    const [acName, setAcName] = useState("");
    const [poNumber, setPoNumber] = useState("");
    const [prodCodeFrom, setProdCodeFrom] = useState("");
    const [reportCriteria, setReportCriteria] = useState<"SO_REF_ONLY" | "ALL">("ALL");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("Select filters and run the report.");

    const lastRequestRef = useRef<PoOrderRegisterParams | null>(null);

    const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
    const [reportPreviewUrl, setReportPreviewUrl] = useState("");
    const [reportPreviewError, setReportPreviewError] = useState("");
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

    useEffect(() => {
        return () => {
            if (reportPreviewUrl) window.URL.revokeObjectURL(reportPreviewUrl);
        };
    }, [reportPreviewUrl]);

    const runReport = useCallback(async () => {
        if (!dateRangeValid) return;
        const params = buildRequestParams();
        lastRequestRef.current = params;

        if (reportPreviewUrl) window.URL.revokeObjectURL(reportPreviewUrl);
        setReportPreviewUrl("");
        setReportPreviewError("");
        setReportPreviewOpen(true);
        setLoading(true);
        setMessage("");

        try {
            const html = await getPoOrderRegisterReportHtml(params);
            const blob = new Blob([html], { type: "text/html" });
            const url = window.URL.createObjectURL(blob);
            setReportPreviewUrl(url);
            setMessage("Report generated.");
        } catch (err: any) {
            const errorMessage = err?.response?.data?.details || err?.message || "Failed to load report. Please try again.";
            setReportPreviewError(errorMessage);
            setMessage(errorMessage);
        } finally {
            setLoading(false);
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

    function resetFilters() {
        setFromDateIso(""); setToDateIso("");
        setAcCode(""); setAcName("");
        setPoNumber("");
        setProdCodeFrom("");
        setReportCriteria("ALL");
        setMessage("Select filters and run the report.");
    }

    return (
        <section className="freight-ui-standard freight-report-screen">
            <div className="freight-report-card">
                <div className="freight-report-titlebar">
                    <h1>PO Order Register</h1>
                    <span className="freight-report-title-dot" aria-hidden="true" />
                </div>

                <ReportFilterHeader onClear={resetFilters} />

<div className="freight-report-fields grid gap-4 p-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    <Field label="Date From">
        <DateField value={fromDateIso} onChange={setFromDateIso} max={toDateIso || undefined} />
    </Field>

    <Field label="Date To">
        <DateField value={toDateIso} onChange={setToDateIso} min={fromDateIso || undefined} />
    </Field>

    <Field label="Supplier">
        <LookupField
            label=""
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
                getDynamicLookup({ parameter: "Account_AC_CODE_Serach_HDR", code1: companyCode, loginid: loginId })
            }
            disabled={false}
            onChange={(value, row) => {
                setAcCode(value);
                setAcName(text(getLookupValue(row || {}, "ac_name")));
            }}
        />
    </Field>

    <Field label="PO Number">
        <Input className="h-8" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="number" />
    </Field>

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
            getDynamicLookup({ parameter: "PS_POORDER_ENTRY_PRODUCT_LIST", code1: companyCode, loginid: loginId })
        }
        disabled={false}
    />

    <div>
        <Field label="Report Criteria">
            <div className="flex items-center gap-2 h-8">
                {[
                    { value: "SO_REF_ONLY", label: "With SO Ref." },
                    { value: "ALL", label: "All" },
                ].map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => setReportCriteria(opt.value as "SO_REF_ONLY" | "ALL")}
                        className={`h-8 flex-1 rounded-md border px-2 text-xs font-medium normal-case transition-colors ${
                            reportCriteria === opt.value
                                ? "border-blue-600 bg-blue-50 text-blue-700"
                                : "border-border bg-background text-foreground hover:bg-muted"
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </Field>
    </div>
</div>

                <div className="freight-report-actions">
                    <Button type="button" size="sm" onClick={runReport} disabled={loading || !dateRangeValid}>
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Generate Report
                    </Button>
                </div>
                {message ? <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p> : null}
            </div>

            {reportPreviewOpen && (
                <ReportPreviewDialog
                    title="PO Order Register"
                    pdfUrl={reportPreviewUrl}
                    error={reportPreviewError}
                    exporting={reportPreviewExporting}
                    onExcel={handleReportPreviewExcel}
                    onClose={closeReportPreview}
                    onDownload={() => { }}
                    downloadName="PO_Order_Register_Report.html"
                />
            )}
        </section>
    );
}