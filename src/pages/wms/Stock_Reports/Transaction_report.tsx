"use client";

import React, { useEffect, useRef, useState } from "react";
import { Printer, RotateCcw, BarChart2, Download, ChevronDown, ChevronUp } from "lucide-react";
import { getDynamicLookupaccount, getLookupText, getLookupValue, LookupRow } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { exportTransactionProductExcel, exportTransactionWithoutTransfersExcel, TransationReport, TransationReportwithoutTransafer } from "../../../api/transactions";

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
    padding: "6px 9px",
    border: "0.5px solid #d1d5db",
    borderRadius: 6,
    background: "#fff",
    color: "#111827",
    boxSizing: "border-box",
};

// ─── Reusable components ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div style={fieldLabelStyle}>{label}</div>
            {children}
        </div>
    );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={inputStyle}
        />
    );
}

function FloatLabel({ label, required, children, bgColor = "#fff" }: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
    bgColor?: string;
}) {
    return (
        <div style={{ position: "relative", marginTop: 6 }}>
            <span style={{
                position: "absolute", top: -8, left: 10,
                fontSize: 11, color: "#6b7280", background: bgColor,
                padding: "0 4px", zIndex: 1, textTransform: "uppercase",
                letterSpacing: "0.05em", fontWeight: 500,
            }}>
                {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
            </span>
            {children}
        </div>
    );
}

// ─── Multi-select checkbox dropdown (matches "All + checkbox list" design) ────

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
    const isAllSelected = allValues.length > 0 && allValues.every((v) => selected.includes(v));

    const toggleAll = () => {
        if (isAllSelected) onChange([]);
        else onChange(allValues);
    };

    const toggleOne = (val: string) => {
        if (selected.includes(val)) onChange(selected.filter((v) => v !== val));
        else onChange([...selected, val]);
    };

    const displayText =
        isAllSelected && allValues.length > 0
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
                                    const checked = selected.includes(val);
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

// ─── Group options ────────────────────────────────────────────────────────────

const formatDateOracle = (iso: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    return `${d}-${months[parseInt(m, 10) - 1]}-${y}`;
};

const GROUP_OPTIONS = [
    { value: "PRODUCT",             label: "Product" },
    { value: "PRODUCT_LOT",         label: "Product + Lot No." },
    { value: "PRODUCT_DOC",         label: "Product + Doc. Ref." },
    { value: "SITE_LOC_PRODUCT",    label: "Product + Site + Location" },
    { value: "GROUP_BRAND_PRODUCT", label: "Product + Group + Brand" },
    { value: "BRAND_PRODUCT",       label: "Product + Brand" },
    { value: "model_product",       label: "Product + Model No." },
    { value: "product_batch",       label: "Product + Batch No." },
    { value: "WITHOUT_TRANSFERS",   label: "Without Transfers" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TransactionReportPage() {
    const { user } = useAuth();

    const [generatingExcel, setGeneratingExcel] = useState(false);
    const [reportError, setReportError]         = useState<string | null>(null);

    const [principalCodes, setPrincipalCodes]   = useState<string[]>([]);
    const [productCodes, setProductCodes]       = useState<string[]>([]);
    const [siteCodes, setSiteCodes]             = useState<string[]>([]);
    const [locationCodes, setLocationCodes]     = useState<string[]>([]);
    const [customerCodes, setCustomerCodes]     = useState<string[]>([]);
    const [lotNoCodes, setLotNoCodes]           = useState<string[]>([]);
    const [batchNoCodes, setBatchNoCodes]       = useState<string[]>([]);
    const [docRefCodes, setDocRefCodes]         = useState<string[]>([]);
    const [jobNoCodes, setJobNoCodes]           = useState<string[]>([]);

    const [dateFrom, setDateFrom]                 = useState("");
    const [dateTo, setDateTo]                     = useState("");
    const [expDateFrom, setExpDateFrom]           = useState("");
    const [expDateTo, setExpDateTo]               = useState("");
    const [txnType, setTxnType]                   = useState("");
    const [groupedOn, setGroupedOn]               = useState("PRODUCT");

    const reportDate = (() => {
        const d = new Date();
        return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    })();

    const handleReset = () => {
        setPrincipalCodes([]);
        setProductCodes([]);
        setSiteCodes([]);
        setLocationCodes([]);
        setCustomerCodes([]);
        setLotNoCodes([]);
        setBatchNoCodes([]);
        setDocRefCodes([]);
        setJobNoCodes([]);
        setDateFrom(""); setDateTo("");
        setExpDateFrom(""); setExpDateTo("");
        setTxnType("");
        setGroupedOn("PRODUCT");
    };

    const buildParams = () => {
    const isWithout = groupedOn === "WITHOUT_TRANSFERS";

    if (isWithout) {
        const prodFrom  = productCodes[0] || "";
        const prodTo    = productCodes[productCodes.length - 1] || "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";
        const siteFrom  = siteCodes[0] || "";
        const siteTo    = siteCodes[siteCodes.length - 1] || "zzzzz";
        const locFrom   = locationCodes[0] || "";
        const locTo     = locationCodes[locationCodes.length - 1] || "zzzzzzzzzzzzzzz";
        const custFrom  = customerCodes[0] || "";
        const custTo    = customerCodes[customerCodes.length - 1] || "zzzzz";
        const lotFrom   = lotNoCodes[0] || "";
        const lotTo     = lotNoCodes[lotNoCodes.length - 1] || "zzzzzzzzzzzzzzzzzzzz";
        const batchFrom = batchNoCodes[0] || "";
        const batchTo   = batchNoCodes[batchNoCodes.length - 1] || "zzzzzzzzzzzzzzzzzzzz";

        return {
            parameter: "WMS_Stock_TRANSACTION_WITHOUT_TRANSFER_REPORT",
            groupedOn,
            loginid: user?.loginid || user?.username || "ADMIN",
            code1:  user?.company_code || "",
            code2:  principalCodes[0] || "",
            code3:  prodFrom,
            code4:  prodTo,
            code5:  siteFrom,
            code6:  siteTo,
            code7:  locFrom,
            code8:  locTo,
            code9:  custFrom,
            code10: custTo,
            code11: lotFrom,
            code12: lotTo,
            code13: batchFrom,
            code14: batchTo,
            code15: txnType || "",
            code16: txnType || "",
            code17: "", code18: "", code19: "",
            code20: docRefCodes[0] || "",
            date1:  expDateFrom ? formatDateOracle(expDateFrom) : "",
            date2:  expDateTo   ? formatDateOracle(expDateTo)   : "",
            date3:  dateFrom    ? formatDateOracle(dateFrom)    : "",
            date4:  dateTo      ? formatDateOracle(dateTo)      : "",
        };
    }

    // PRODUCT 
    return {
        parameter: "WMS_Stock_TRANSACTION_PRODUCT_REPORT",
        groupedOn,
        loginid: user?.loginid || user?.username || "ADMIN",
        code1:  user?.company_code || "",
        code2:  principalCodes.join(",") || "",
        code3:  productCodes.join(",")   || "",
        code4:  productCodes.join(",")   || "",
        code5:  siteCodes.join(",")      || "",
        code6:  siteCodes.join(",")      || "",
        code7:  locationCodes.join(",")  || "",
        code8:  locationCodes.join(",")  || "",
        code9:  customerCodes.join(",")  || "",
        code10: customerCodes.join(",")  || "",
        code11: lotNoCodes.join(",")     || "",
        code12: lotNoCodes.join(",")     || "",
        code13: batchNoCodes.join(",")   || "",
        code14: batchNoCodes.join(",")   || "",
        date1:  expDateFrom ? formatDateOracle(expDateFrom) : "",
        date2:  expDateTo   ? formatDateOracle(expDateTo)   : "",
        date3:  dateFrom    ? formatDateOracle(dateFrom)    : "",
        date4:  dateTo      ? formatDateOracle(dateTo)      : "",
    };
};

    const handleExportExcel = async () => {
        setReportError(null);
        setGeneratingExcel(true);
        try {
            if (groupedOn === "WITHOUT_TRANSFERS") {
                await exportTransactionWithoutTransfersExcel(buildParams());
            } else {
                await exportTransactionProductExcel(buildParams());
            }
        } catch (err: any) {
            setReportError(err.message || "Failed to generate report.");
        } finally {
            setGeneratingExcel(false);
        }
    };

    const handleGenerate = async () => {
        if (principalCodes.length === 0) {
            setReportError("Please select a Principal before generating.");
            return;
        }
        setReportError(null);
        try {
            if (groupedOn === "WITHOUT_TRANSFERS") {
                await TransationReportwithoutTransafer(buildParams());
            } else {
                await TransationReport(buildParams());
            }
        } catch (err: any) {
            setReportError("Failed to generate report.");
            console.error(err);
        }
    };

    // equal 2-col and 3-col grids
    const row2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
    const row3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 };
    const BG = "#EEF5FD";

    return (
        <div style={{ background: "#f3f4f6", padding: "6px 10px", fontFamily: "system-ui, sans-serif" }}>
            <style>{`
                .grp-opt:hover        { background: #EFF6FF !important; }
                .action-btn:hover     { background: #f9fafb !important; }
                .action-btn-excel:hover { background: #EBF4FF !important; border-color: #185FA5 !important; color: #185FA5 !important; }
                .field-row            { background: #EEF5FD; border-radius: 8px; padding: 12px 14px; }
            `}</style>

            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "10px 14px" }}>

                    {/* ── Header ── */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <BarChart2 size={17} color="#185FA5" />
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Transaction Report Filter</span>
                    </div>

                    {/* ── Main grid: fields + sidebar ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 16, alignItems: "start" }}>

                        {/* ═══ LEFT FIELDS ═══ */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                            {/* 1 ── Principal: full width */}
                            <div className="field-row">
                                <MultiSelectDropdown
                                    label="Principal"
                                    required
                                    bgColor={BG}
                                    selected={principalCodes}
                                    onChange={setPrincipalCodes}
                                    valueField="prin_code"
                                    displayFields={["prin_code", "prin_name"]}
                                    loadOptions={() =>
                                        getDynamicLookupaccount({
                                            parameter: "WMS_Stock_principal",
                                            loginid: user?.loginid || user?.username || "ADMIN",
                                            code1:  user?.company_code || "",
                                            code2:  principalCodes.join(",") || "",
                                            code3:  productCodes.join(",")  || "",
                                            code4:  siteCodes.join(",")     || "",
                                            code5:  locationCodes.join(",") || "",
                                            code6:  customerCodes.join(",") || "",
                                            code7:  jobNoCodes.join(",")    || "",
                                            code8:  txnType                || "",
                                            code9:  docRefCodes.join(",")   || "",
                                            code10: lotNoCodes.join(",")    || "",
                                            date1:  dateFrom    ? formatDateOracle(dateFrom)    : "",
                                            date2:  dateTo      ? formatDateOracle(dateTo)      : "",
                                            date3:  expDateFrom ? formatDateOracle(expDateFrom) : "",
                                            date4:  expDateTo   ? formatDateOracle(expDateTo)   : "",
                                        })
                                    }
                                />
                            </div>

                            {/* 2 ── Product | Site  (2 equal cols) */}
                            <div className="field-row" style={row2}>
                                <MultiSelectDropdown
                                    label="Product"
                                    bgColor={BG}
                                    selected={productCodes}
                                    onChange={setProductCodes}
                                    valueField="prod_code"
                                    displayFields={["prod_code", "prod_name"]}
                                    loadOptions={() =>
                                        getDynamicLookupaccount({
                                            parameter: "WMS_Stock_product_transfer_report",
                                            code1: user?.company_code || "",
                                            code2: principalCodes.join(",") || "",
                                        })
                                    }
                                />
                                <MultiSelectDropdown
                                    label="Site"
                                    bgColor={BG}
                                    selected={siteCodes}
                                    onChange={setSiteCodes}
                                    valueField="SITE_CODE"
                                    displayFields={["SITE_CODE", "SITE_NAME"]}
                                    loadOptions={() =>
                                        getDynamicLookupaccount({
                                            parameter: "WMS_Stock_Site_transfer_report",
                                            code1: user?.company_code || "",
                                        })
                                    }
                                />
                            </div>

                            {/* 3 ── Location | Customer  (2 equal cols) */}
                            <div className="field-row" style={row2}>
                                <MultiSelectDropdown
                                    label="Location"
                                    bgColor={BG}
                                    selected={locationCodes}
                                    onChange={setLocationCodes}
                                    valueField="LOCATION_CODE"
                                    displayFields={["LOCATION_CODE", "LOC_DESC"]}
                                    loadOptions={() =>
                                        getDynamicLookupaccount({
                                            parameter: "WMS_Stock_Location_transfer_report",
                                            code1: user?.company_code || "",
                                            code2: siteCodes.join(",") || "",
                                        })
                                    }
                                />
                                <MultiSelectDropdown
                                    label="Customer"
                                    bgColor={BG}
                                    selected={customerCodes}
                                    onChange={setCustomerCodes}
                                    valueField="CUST_CODE"
                                    displayFields={["CUST_CODE", "CUST_NAME"]}
                                    loadOptions={() =>
                                        getDynamicLookupaccount({
                                            parameter: "WMS_Stock_Customer_transfer_report",
                                            code1: user?.company_code || "",
                                            code2: principalCodes.join(",") || "",
                                        })
                                    }
                                />
                            </div>

                            {/* 4 ── Txn Date | Exp Date  (2 equal cols) */}
                            <div className="field-row" style={row2}>
                                <fieldset style={{ border: "0.5px solid #BFDBFE", borderRadius: 6, padding: "6px 10px 10px", margin: 0, background: "transparent" }}>
                                    <legend style={{ fontSize: 10, color: "#6b7280", padding: "0 4px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
                                        Transaction Date
                                    </legend>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <Field label="From">
                                            <DateInput value={dateFrom} onChange={setDateFrom} />
                                        </Field>
                                        <Field label="To">
                                            <DateInput value={dateTo} onChange={setDateTo} />
                                        </Field>
                                    </div>
                                </fieldset>

                                <fieldset style={{ border: "0.5px solid #BFDBFE", borderRadius: 6, padding: "6px 10px 10px", margin: 0, background: "transparent" }}>
                                    <legend style={{ fontSize: 10, color: "#6b7280", padding: "0 4px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
                                        Exp Date
                                    </legend>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <Field label="From">
                                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                                <DateInput value={expDateFrom} onChange={setExpDateFrom} />
                                                {expDateFrom && (
                                                    <button onClick={() => setExpDateFrom("")}
                                                        style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>✕</button>
                                                )}
                                            </div>
                                        </Field>
                                        <Field label="To">
                                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                                <DateInput value={expDateTo} onChange={setExpDateTo} />
                                                {expDateTo && (
                                                    <button onClick={() => setExpDateTo("")}
                                                        style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>✕</button>
                                                )}
                                            </div>
                                        </Field>
                                    </div>
                                </fieldset>
                            </div>

                            {/* 5 ── Lot No | Batch No | Doc Ref  (3 equal cols) */}
                            <div className="field-row" style={row3}>
                                <MultiSelectDropdown
                                    label="Lot No."
                                    bgColor={BG}
                                    selected={lotNoCodes}
                                    onChange={setLotNoCodes}
                                    valueField="LOT_NO"
                                    displayFields={["LOT_NO"]}
                                    loadOptions={() =>
                                        getDynamicLookupaccount({
                                            parameter: "WMS_Stock_Lot_no",
                                            code1: user?.company_code || "",
                                            code2: principalCodes.join(",") || "",
                                        })
                                    }
                                />
                                <MultiSelectDropdown
                                    label="Batch No."
                                    bgColor={BG}
                                    selected={batchNoCodes}
                                    onChange={setBatchNoCodes}
                                    valueField="BATCH_NO"
                                    displayFields={["BATCH_NO"]}
                                    loadOptions={() =>
                                        getDynamicLookupaccount({
                                            parameter: "WMS_Stock_batch_no",
                                            code1: user?.company_code || "",
                                            code2: principalCodes.join(",") || "",
                                        })
                                    }
                                />
                                <MultiSelectDropdown
                                    label="Doc. Ref."
                                    bgColor={BG}
                                    selected={docRefCodes}
                                    onChange={setDocRefCodes}
                                    valueField="DOC_REF"
                                    displayFields={["DOC_REF"]}
                                    loadOptions={() =>
                                        getDynamicLookupaccount({
                                            parameter: "WMS_Stock_DOC_REF",
                                            code1: user?.company_code || "",
                                            code2: principalCodes.join(",") || "",
                                        })
                                    }
                                />
                            </div>

                            {/* 6 ── Txn Type | Job No  (2 equal cols) */}
                            <div className="field-row" style={row2}>
                                <Field label="Txn Type">
                                    <select value={txnType} onChange={(e) => setTxnType(e.target.value)} style={inputStyle}>
                                        <option value="">All</option>
                                        <option value="ADJ-">ADJ-</option>
                                        <option value="ADJ+">ADJ+</option>
                                        <option value="EXP">EXP</option>
                                        <option value="IMP">IMP</option>
                                        <option value="TFI">TFI</option>
                                        <option value="TFO">TFO</option>
                                    </select>
                                </Field>
                                <MultiSelectDropdown
                                    label="Job No"
                                    bgColor={BG}
                                    selected={jobNoCodes}
                                    onChange={setJobNoCodes}
                                    valueField="JOB_NO"
                                    displayFields={["JOB_NO", "JOB_TYPE"]}
                                    loadOptions={() =>
                                        getDynamicLookupaccount({
                                            parameter: "WMS_Stock_Job_transfer_report",
                                            code1: user?.company_code || "",
                                        })
                                    }
                                />
                            </div>

                            {/* Error */}
                            {reportError && (
                                <div style={{ fontSize: 12, color: "#dc2626", padding: "6px 10px", background: "#fef2f2", borderRadius: 6, border: "0.5px solid #fecaca" }}>
                                    {reportError}
                                </div>
                            )}

                        </div>

                        {/* ═══ RIGHT: Report Grouped On sidebar ═══ */}
                        <div style={{
                            border: "0.5px solid #e5e7eb",
                            borderRadius: 8,
                            overflow: "hidden",
                            background: "#fff",
                            position: "sticky",
                            top: 8,
                        }}>
                            <div style={{
                                background: "#185FA5",
                                padding: "8px 12px",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#fff",
                                letterSpacing: "0.05em",
                                textTransform: "uppercase",
                            }}>
                                Report Grouped On
                            </div>
                            <div style={{ padding: "4px 0" }}>
                                {GROUP_OPTIONS.map((opt) => {
                                    const isSelected = groupedOn === opt.value;
                                    return (
                                        <label
                                            key={opt.value}
                                            className="grp-opt"
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                fontSize: 12,
                                                cursor: "pointer",
                                                padding: "5px 12px",
                                                borderLeft: isSelected ? "3px solid #185FA5" : "3px solid transparent",
                                                background: isSelected ? "#EEF5FD" : "transparent",
                                                transition: "all 0.15s ease",
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                name="groupedOn"
                                                value={opt.value}
                                                checked={isSelected}
                                                onChange={() => setGroupedOn(opt.value.toUpperCase())}
                                                style={{ display: "none" }}
                                            />
                                            <span style={{
                                                width: 7, height: 7, borderRadius: "50%",
                                                background: isSelected ? "#185FA5" : "#d1d5db",
                                                flexShrink: 0,
                                                transition: "background 0.15s ease",
                                            }} />
                                            <span style={{
                                                color: isSelected ? "#0C447C" : "#374151",
                                                fontWeight: isSelected ? 600 : 400,
                                            }}>
                                                {opt.label}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                    </div>

                    {/* ── Action bar ── */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, paddingTop: 8, borderTop: "0.5px solid #e5e7eb" }}>
                        <button
                            className="action-btn"
                            onClick={handleReset}
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151" }}
                        >
                            <RotateCcw size={13} /> Reset
                        </button>
                        <button
                            className="action-btn action-btn-excel"
                            onClick={handleExportExcel}
                            disabled={generatingExcel}
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: generatingExcel ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151", opacity: generatingExcel ? 0.7 : 1 }}
                        >
                            <Download size={13} /> {generatingExcel ? "Exporting..." : "Export Excel"}
                        </button>
                        <button
                            className="action-btn-primary"
                            onClick={handleGenerate}
                            style={{ padding: "7px 16px", border: "0.5px solid #185FA5", background: "#185FA5", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#fff" }}
                        >
                            <Printer size={13} /> Generate Report
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}