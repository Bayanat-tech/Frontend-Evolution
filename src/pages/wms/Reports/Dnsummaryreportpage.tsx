"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    BarChart2,
    RotateCcw,
    Printer,
    Loader2,
    ChevronUp,
    ChevronDown,
    Check,
    ChevronDown as ChevronDownSmall,
    X,
    FileSpreadsheet,
    RefreshCw,
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

// ─── Shared styles ────────────────────────────────────────────────────────────

const fieldLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    color: "#6b7280",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
    width: "100%",
    fontSize: 12,
    padding: "6px 9px",
    border: "0.5px solid #d1d5db",
    borderRadius: 6,
    background: "#fff",
    color: "#111827",
    boxSizing: "border-box",
};

// ─── Generic lookup fetcher ───────────────────────────────────────────────────

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
            parameter,
            loginid: loginId,
            code1,
            code2,
            code3,
            code4: "",
            number1: 0, number2: 0, number3: 0, number4: 0,
            date1: null, date2: null, date3: null, date4: null,
        });

        if (Array.isArray(res) && res.length > 0) {
            console.log(`[${parameter}] First record keys:`, Object.keys(res[0]));
        } else {
            console.warn(`[${parameter}] Empty or non-array response:`, res);
        }

        return Array.isArray(res)
            ? res
                .filter((x: any) => x[codeKey] != null && String(x[codeKey]).trim() !== "")
                .map((x: any) => ({
                    code: String(x[codeKey]),
                    name: x[nameKey] ?? "",
                }))
            : [];
    } catch (err) {
        console.error(`[${parameter}] Fetch error:`, err);
        return [];
    }
};

// ─── Simple Searchable Dropdown (single select) ───────────────────────────────

interface SearchableDropdownProps {
    label: string;
    value: LookupOption | null;
    onChange: (v: LookupOption | null) => void;
    options: LookupOption[];
    placeholder?: string;
    disabled?: boolean;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
    label,
    value,
    onChange,
    options,
    placeholder = "Search...",
    disabled = false,
}) => {
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!value) setSearch("");
    }, [value]);

    const filtered = options.filter((o) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q);
    });

    const displayValue = search !== "" ? search : value ? `${value.code} - ${value.name}` : "";

    return (
        <div style={{ position: "relative" }}>
            <div style={fieldLabelStyle}>{label}</div>
            <input
                type="text"
                placeholder={placeholder}
                value={displayValue}
                onChange={(e) => {
                    setSearch(e.target.value);
                    setOpen(true);
                    if (value) onChange(null);
                }}
                onFocus={() => !disabled && setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                disabled={disabled}
                style={{
                    ...inputStyle,
                    background: disabled ? "#f9fafb" : "#fff",
                    cursor: disabled ? "not-allowed" : "text",
                    color: disabled ? "#9ca3af" : "#111827",
                }}
            />
            {open && !disabled && (
                <div style={{
                    position: "absolute", zIndex: 300, top: "calc(100% + 2px)", left: 0, right: 0,
                    background: "#fff", border: "0.5px solid #d1d5db", borderRadius: 6,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 180, overflowY: "auto",
                }}>
                    <div
                        className="dd-option"
                        style={{ padding: "6px 12px", fontSize: 11, color: "#9ca3af", cursor: "pointer", borderBottom: "0.5px solid #f3f4f6" }}
                        onMouseDown={() => { onChange(null); setSearch(""); setOpen(false); }}
                    >
                        — All —
                    </div>
                    {filtered.length === 0 ? (
                        <div style={{ padding: "8px 12px", fontSize: 12, color: "#9ca3af" }}>No results found</div>
                    ) : (
                        filtered.map((o) => (
                            <div
                                key={o.code}
                                className="dd-option"
                                style={{ padding: "7px 12px", fontSize: 12, cursor: "pointer" }}
                                onMouseDown={() => { onChange(o); setSearch(""); setOpen(false); }}
                            >
                                <span style={{ fontWeight: 500 }}>{o.code}</span>
                                <span style={{ color: "#6b7280", marginLeft: 6 }}>{o.name}</span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Multi-Select Checkbox Dropdown ──────────────────────────────────────────

interface MultiSelectDropdownProps {
    label: string;
    selected: LookupOption[];
    onChange: (v: LookupOption[]) => void;
    options: LookupOption[];
    placeholder?: string;
    disabled?: boolean;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
    label,
    selected,
    onChange,
    options,
    placeholder = "Select products...",
    disabled = false,
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filtered = options.filter((o) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q);
    });

    const isSelected = (code: string) => selected.some((s) => s.code === code);

    const toggleItem = (opt: LookupOption) => {
        if (isSelected(opt.code)) {
            onChange(selected.filter((s) => s.code !== opt.code));
        } else {
            onChange([...selected, opt]);
        }
    };

    const toggleAll = () => {
        if (selected.length === options.length) {
            onChange([]);
        } else {
            onChange([...options]);
        }
    };

    const removeTag = (code: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(selected.filter((s) => s.code !== code));
    };

    return (
        <div ref={containerRef} style={{ position: "relative" }}>
            <div style={fieldLabelStyle}>{label}</div>

            <div
                onClick={() => !disabled && setOpen((p) => !p)}
                style={{
                    minHeight: 34,
                    padding: "4px 32px 4px 8px",
                    border: "0.5px solid #d1d5db",
                    borderRadius: 6,
                    background: disabled ? "#f9fafb" : "#fff",
                    cursor: disabled ? "not-allowed" : "pointer",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    alignItems: "center",
                    position: "relative",
                    boxSizing: "border-box",
                }}
            >
                {selected.length === 0 ? (
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>{placeholder}</span>
                ) : selected.length > 3 ? (
                    <span style={{
                        fontSize: 11, background: "#eff6ff", color: "#185FA5",
                        borderRadius: 4, padding: "2px 7px", fontWeight: 500,
                    }}>
                        {selected.length} products selected
                    </span>
                ) : (
                    selected.map((s) => (
                        <span key={s.code} style={{
                            fontSize: 11, background: "#eff6ff", color: "#185FA5",
                            borderRadius: 4, padding: "2px 6px", display: "flex",
                            alignItems: "center", gap: 3, fontWeight: 500,
                        }}>
                            {s.code}
                            {!disabled && (
                                <X
                                    size={10}
                                    style={{ cursor: "pointer", marginTop: 1 }}
                                    onMouseDown={(e) => removeTag(s.code, e as any)}
                                />
                            )}
                        </span>
                    ))
                )}
                <ChevronDownSmall
                    size={14}
                    style={{
                        position: "absolute", right: 8, top: "50%",
                        transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
                        color: "#9ca3af", transition: "transform 0.2s",
                        pointerEvents: "none",
                    }}
                />
            </div>

            {open && !disabled && (
                <div style={{
                    position: "absolute", zIndex: 300, top: "calc(100% + 2px)", left: 0, right: 0,
                    background: "#fff", border: "0.5px solid #d1d5db", borderRadius: 6,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                }}>
                    <div style={{ padding: "8px 10px", borderBottom: "0.5px solid #f3f4f6" }}>
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                            style={{ ...inputStyle, fontSize: 11 }}
                        />
                    </div>

                    {options.length > 0 && (
                        <div
                            className="dd-option"
                            style={{
                                padding: "7px 12px", fontSize: 11, cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 8,
                                borderBottom: "0.5px solid #f3f4f6", color: "#6b7280",
                            }}
                            onMouseDown={(e) => { e.preventDefault(); toggleAll(); }}
                        >
                            <div style={{
                                width: 14, height: 14, border: "1.5px solid #d1d5db",
                                borderRadius: 3, background: selected.length === options.length ? "#185FA5" : "#fff",
                                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                                {selected.length === options.length && <Check size={9} color="#fff" strokeWidth={3} />}
                                {selected.length > 0 && selected.length < options.length && (
                                    <div style={{ width: 8, height: 2, background: "#185FA5", borderRadius: 1 }} />
                                )}
                            </div>
                            Select All ({options.length})
                        </div>
                    )}

                    <div style={{ maxHeight: 200, overflowY: "auto" }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: "10px 12px", fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
                                No products found
                            </div>
                        ) : (
                            filtered.map((o) => (
                                <div
                                    key={o.code}
                                    className="dd-option"
                                    style={{
                                        padding: "7px 12px", fontSize: 12, cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: 8,
                                        background: isSelected(o.code) ? "#f0f7ff" : "transparent",
                                    }}
                                    onMouseDown={(e) => { e.preventDefault(); toggleItem(o); }}
                                >
                                    <div style={{
                                        width: 14, height: 14, border: "1.5px solid",
                                        borderColor: isSelected(o.code) ? "#185FA5" : "#d1d5db",
                                        borderRadius: 3,
                                        background: isSelected(o.code) ? "#185FA5" : "#fff",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        flexShrink: 0, transition: "all 0.15s",
                                    }}>
                                        {isSelected(o.code) && <Check size={9} color="#fff" strokeWidth={3} />}
                                    </div>
                                    <span style={{ fontWeight: 500, color: "#374151" }}>{o.code}</span>
                                    <span style={{ color: "#6b7280", fontSize: 11 }}>{o.name}</span>
                                </div>
                            ))
                        )}
                    </div>

                    {selected.length > 0 && (
                        <div style={{
                            padding: "6px 12px", borderTop: "0.5px solid #f3f4f6",
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                        }}>
                            <span style={{ fontSize: 11, color: "#6b7280" }}>{selected.length} selected</span>
                            <button
                                onMouseDown={(e) => { e.preventDefault(); onChange([]); }}
                                style={{
                                    fontSize: 11, color: "#dc2626", background: "none",
                                    border: "none", cursor: "pointer", padding: "2px 4px",
                                }}
                            >
                                Clear all
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DNSummaryReportPage() {
    const { user } = useAuth();
    const companyCode = user?.company_code ?? "";
    const loginId = user?.loginid ?? user?.username ?? "ADMIN";

    // ── Lookup options ────────────────────────────────────────────────────────
    const [principalOptions, setPrincipalOptions] = useState<LookupOption[]>([]);
    const [groupOptions, setGroupOptions] = useState<LookupOption[]>([]);
    const [productOptions, setProductOptions] = useState<LookupOption[]>([]);

    // ── Selected filter values ────────────────────────────────────────────────
    const [principal, setPrincipal] = useState<LookupOption | null>(null);
    const [group, setGroup] = useState<LookupOption | null>(null);
    const [selectedProducts, setSelectedProducts] = useState<LookupOption[]>([]);

    // ── UI state ──────────────────────────────────────────────────────────────
    const [generating, setGenerating] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(true);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(false);

    // ── Report viewer state ───────────────────────────────────────────────────
    const [reportHtml, setReportHtml] = useState<string>("");
    const [excelLoading, setExcelLoading] = useState(false);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const lastParamsRef = useRef<{
        prinCode: string;
        groupCode: string;
        prodCode: string;
    } | null>(null);

    // ── Derived flags ─────────────────────────────────────────────────────────
    // All 3 fields must be selected: principal, group, and at least 1 product
    const allFieldsSelected = !!principal && !!group && selectedProducts.length > 0;
    const reportReady = !generating && !reportError && !!reportHtml;

    // ── Load principals on mount ──────────────────────────────────────────────
    useEffect(() => {
        fetchLookup(
            "WMS_Stock_principal",
            loginId,
            companyCode,
            "",
            "",
            "prin_code",
            "prin_name",
        ).then(setPrincipalOptions);
    }, [companyCode, loginId]);

    // ── Load groups when principal changes ────────────────────────────────────
    useEffect(() => {
        setGroup(null);
        setGroupOptions([]);
        setSelectedProducts([]);
        setProductOptions([]);
        if (!principal) return;
        setLoadingGroups(true);
        fetchLookup(
            "WMS_Stock_prodgroup",
            loginId,
            companyCode,
            principal.code,
            "",
            "group_code",
            "group_name"
        ).then((opts) => {
            setGroupOptions(opts);
            setLoadingGroups(false);
        });
    }, [principal]);

    // ── Load products when group changes ──────────────────────────────────────
    useEffect(() => {
        setSelectedProducts([]);
        setProductOptions([]);
        if (!principal || !group) return;
        setLoadingProducts(true);
        fetchLookup(
            "WMS_Stock_product",
            loginId,
            companyCode,
            principal.code,
            group.code,
            "prod_code",
            "prod_name"
        ).then((opts) => {
            setProductOptions(opts);
            setLoadingProducts(false);
        });
    }, [group, principal]);

    // ── Reset ─────────────────────────────────────────────────────────────────
    const handleReset = () => {
        setPrincipal(null);
        setGroup(null);
        setSelectedProducts([]);
        setReportError(null);
        setReportHtml("");
        lastParamsRef.current = null;
    };

    // ── Generate ──────────────────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (!allFieldsSelected) return;
        setReportError(null);
        setReportHtml("");
        setGenerating(true);

        const params = {
            prinCode:  principal!.code,
            groupCode: group!.code,
            prodCode:  selectedProducts.map((p) => p.code).join(","),
        };
        lastParamsRef.current = params;

        try {
            const html = await getDnSummaryReportHtml({
                parameter: "WMS_Stock_DN_Summary_Report",
                loginid:   loginId,
                code1:     companyCode,
                code2:     params.prinCode,
                code3:     params.groupCode,
                code4:     params.prodCode,
            });
            setReportHtml(html);
        } catch (err: any) {
            setReportError(err?.message ?? "Failed to generate report. Please try again.");
            console.error(err);
        } finally {
            setGenerating(false);
        }
    };

    // ── Print ─────────────────────────────────────────────────────────────────
    const handlePrint = () => {
        iframeRef.current?.contentWindow?.postMessage("print", "*");
    };

    // ── Excel export ──────────────────────────────────────────────────────────
    const handleExcel = async () => {
        if (!lastParamsRef.current) return;
        setExcelLoading(true);
        try {
            await getDnSummaryReportExcelDownload({
                parameter: "WMS_Stock_DN_Summary_Report",
                loginid:   loginId,
                code1:     companyCode,
                code2:     lastParamsRef.current.prinCode,
                code3:     lastParamsRef.current.groupCode,
                code4:     lastParamsRef.current.prodCode,
            });
        } catch (err) {
            console.error("Excel export error:", err);
        } finally {
            setExcelLoading(false);
        }
    };

    // ── Shared disabled button style helper ───────────────────────────────────
    const disabledStyle = (base: React.CSSProperties, isDisabled: boolean): React.CSSProperties => ({
        ...base,
        opacity:       isDisabled ? 0.45 : 1,
        cursor:        isDisabled ? "not-allowed" : "pointer",
        pointerEvents: isDisabled ? "none" : "auto",
    });

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={{ background: "#f3f4f6", padding: "16px", fontFamily: "system-ui, sans-serif", minHeight: "100%" }}>
            <style>{`
                .action-btn:hover                           { background: #f9fafb !important; }
                .action-btn-primary:not(:disabled):hover   { background: #0C447C !important; border-color: #0C447C !important; }
                .action-btn-green:not(:disabled):hover     { background: #15693c !important; border-color: #15693c !important; }
                .action-btn-outline:not(:disabled):hover   { background: #f0f7ff !important; }
                .dd-option:hover                            { background: #f0f7ff; }
                .collapse-btn:hover                         { background: #f0f7ff !important; }
                @keyframes spin                             { to { transform: rotate(360deg); } }
            `}</style>

            <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

                {/* ══ Filter Card ═══════════════════════════════════════════════ */}
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>

                    {/* ── Card header: title + Print/Excel + collapse toggle ── */}
                    <div
                        style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "14px 20px",
                            borderBottom: filtersOpen ? "0.5px solid #e5e7eb" : "none",
                        }}
                    >
                        {/* Left: icon + title — clicking this toggles collapse */}
                        <div
                            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1 }}
                            onClick={() => setFiltersOpen((p) => !p)}
                        >
                            <BarChart2 size={18} color="#185FA5" />
                            <span style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>
                                DN Summary Report
                            </span>
                        </div>

                        {/* Right: Print + Excel + collapse chevron */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

                            {/* Print — disabled until report is ready */}
                            <button
                                className="action-btn-outline"
                                onClick={handlePrint}
                                disabled={!reportReady}
                                title={!reportReady ? "Generate a report first" : "Print / Save as PDF"}
                                style={disabledStyle({
                                    padding: "6px 14px",
                                    border: "0.5px solid #d1d5db",
                                    background: "#fff",
                                    display: "flex", alignItems: "center", gap: 6,
                                    fontSize: 12, borderRadius: 6, color: "#374151",
                                }, !reportReady)}
                            >
                                <Printer size={13} /> Print / PDF
                            </button>

                            {/* Export Excel — disabled until report is ready */}
                            <button
                                className="action-btn-green"
                                onClick={handleExcel}
                                disabled={!reportReady || excelLoading}
                                title={!reportReady ? "Generate a report first" : "Export to Excel"}
                                style={disabledStyle({
                                    padding: "6px 14px",
                                    border: "0.5px solid #1a7f4b",
                                    background: "#1a7f4b",
                                    display: "flex", alignItems: "center", gap: 6,
                                    fontSize: 12, borderRadius: 6, color: "#fff",
                                }, !reportReady || excelLoading)}
                            >
                                {excelLoading
                                    ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Exporting…</>
                                    : <><FileSpreadsheet size={13} /> Export Excel</>
                                }
                            </button>

                            {/* Collapse toggle */}
                            <button
                                className="collapse-btn"
                                onClick={() => setFiltersOpen((p) => !p)}
                                style={{
                                    background: "none", border: "none", cursor: "pointer",
                                    padding: "4px 6px", borderRadius: 6, color: "#6b7280",
                                }}
                            >
                                {filtersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        </div>
                    </div>

                    {filtersOpen && (
                        <div style={{ padding: "20px 24px" }}>

                            {/* ── Filter grid ── */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>

                                {/* Principal */}
                                <div style={{ minWidth: 240, flex: "1 1 240px" }}>
                                    <SearchableDropdown
                                        label="Principal *"
                                        value={principal}
                                        onChange={setPrincipal}
                                        options={principalOptions}
                                        placeholder="Search principal..."
                                    />
                                </div>

                                {/* Group */}
                                <div style={{ minWidth: 240, flex: "1 1 240px" }}>
                                    <SearchableDropdown
                                        label={loadingGroups ? "Group (loading…) *" : "Group *"}
                                        value={group}
                                        onChange={setGroup}
                                        options={groupOptions}
                                        placeholder={principal ? "Search group..." : "Select a principal first"}
                                        disabled={!principal || loadingGroups}
                                    />
                                </div>

                                {/* Product */}
                                <div style={{ minWidth: 240, flex: "2 1 300px" }}>
                                    <MultiSelectDropdown
                                        label={loadingProducts ? "Product (loading…) *" : "Product *"}
                                        selected={selectedProducts}
                                        onChange={setSelectedProducts}
                                        options={productOptions}
                                        placeholder={
                                            !principal
                                                ? "Select a principal first"
                                                : !group
                                                    ? "Select a group first"
                                                    : loadingProducts
                                                        ? "Loading products…"
                                                        : "Select products…"
                                        }
                                        disabled={!principal || !group || loadingProducts}
                                    />
                                </div>
                            </div>

                            {/* Validation hint — shown when not all fields are filled */}
                            {!allFieldsSelected && (
                                <div style={{
                                    marginTop: 10, fontSize: 11, color: "#92400e",
                                    background: "#fffbeb", border: "0.5px solid #fcd34d",
                                    borderRadius: 6, padding: "5px 10px",
                                }}>
                                    ⚠ Please select Principal, Group, and at least one Product to generate the report.
                                </div>
                            )}

                            {/* Error banner */}
                            {reportError && (
                                <div style={{
                                    marginTop: 14, fontSize: 12, color: "#dc2626",
                                    background: "#fef2f2", border: "0.5px solid #fecaca",
                                    borderRadius: 6, padding: "6px 12px",
                                }}>
                                    ⚠ {reportError}
                                </div>
                            )}

                            {/* Action bar */}
                            <div style={{
                                display: "flex", justifyContent: "flex-end", gap: 8,
                                paddingTop: 20, marginTop: 20, borderTop: "0.5px solid #e5e7eb",
                            }}>
                                <button
                                    className="action-btn"
                                    onClick={handleReset}
                                    disabled={generating}
                                    style={{
                                        padding: "7px 16px", border: "0.5px solid #d1d5db",
                                        background: "#fff",
                                        cursor: generating ? "not-allowed" : "pointer",
                                        display: "flex", alignItems: "center", gap: 6,
                                        fontSize: 12, borderRadius: 6, color: "#374151",
                                        opacity: generating ? 0.6 : 1,
                                    }}
                                >
                                    <RotateCcw size={13} /> Reset
                                </button>

                                {/* Generate — disabled until all 3 fields are selected */}
                                <button
                                    className="action-btn-primary"
                                    onClick={handleGenerate}
                                    disabled={!allFieldsSelected || generating}
                                    title={!allFieldsSelected ? "Select Principal, Group and Product first" : ""}
                                    style={disabledStyle({
                                        padding: "7px 16px",
                                        border: "0.5px solid #185FA5",
                                        background: "#185FA5",
                                        display: "flex", alignItems: "center", gap: 6,
                                        fontSize: 12, borderRadius: 6, color: "#fff",
                                    }, !allFieldsSelected || generating)}
                                >
                                    {generating
                                        ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating…</>
                                        : <><Printer size={13} /> Generate Report</>
                                    }
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ══ Report Viewer Card ════════════════════════════════════════ */}
                {(generating || reportError || reportHtml) && (
                    <div style={{
                        background: "#fff", border: "0.5px solid #e5e7eb",
                        borderRadius: 12, overflow: "hidden",
                        display: "flex", flexDirection: "column",
                    }}>
                        {/* Loading state */}
                        {generating && (
                            <div style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 8, padding: "60px 24px",
                                fontSize: 13, color: "#6b7280",
                            }}>
                                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                                Loading report…
                            </div>
                        )}

                        {/* Error state */}
                        {!generating && reportError && (
                            <div style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                padding: "60px 24px",
                                fontSize: 13, color: "#dc2626",
                            }}>
                                ⚠ {reportError}
                            </div>
                        )}

                        {/* Report iframe */}
                        {reportReady && (
                            <iframe
                                ref={iframeRef}
                                srcDoc={reportHtml}
                                title="DN Summary Report"
                                style={{
                                    width: "100%",
                                    minHeight: "70vh",
                                    border: "none",
                                    display: "block",
                                }}
                            />
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}