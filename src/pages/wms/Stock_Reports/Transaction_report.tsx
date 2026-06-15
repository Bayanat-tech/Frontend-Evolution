"use client";

import React, { useState } from "react";
import {
    Search,
    Printer,
    RotateCcw,
    BarChart2,
} from "lucide-react";
import { getDynamicLookup, getDynamicLookupaccount } from "../../../api/lookups";
import { LookupField } from "../../../components/ui/LookupField";

// ─── Shared styles (same palette as AC_StatementPage) ─────────────────────────

const fieldLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    color: "#6b7280",
    marginBottom: 1,
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

const lookupInputStyle: React.CSSProperties = {
    ...inputStyle,
    paddingRight: 30,
};

const lookupIconStyle: React.CSSProperties = {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#6b7280",
    pointerEvents: "none",
};

const radioLabelStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    cursor: "pointer",
    color: "#374151",
    padding: "3px 0",
};

// ─── Reusable field components ─────────────────────────────────────────────────

function TextField({
    label,
    value,
    onChange,
    required,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    required?: boolean;
}) {
    return (
        <div>
            <div style={fieldLabelStyle}>
                {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
            </div>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={inputStyle}
            />
        </div>
    );
}

function LookupTextField({
    label,
    value,
    onChange,
    required,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    required?: boolean;
}) {
    return (
        <div>
            <div style={fieldLabelStyle}>
                {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
            </div>
            <div style={{ position: "relative" }}>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={lookupInputStyle}
                />
                <Search size={14} style={lookupIconStyle} />
            </div>
        </div>
    );
}

function DateField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div>
            <div style={fieldLabelStyle}>{label}</div>
            <input
                type="date"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={inputStyle}
            />
        </div>
    );
}

// ─── Report grouping options ───────────────────────────────────────────────────

const GROUP_OPTIONS = [
    "Product",
    "Product + Lot No.",
    "Product + Doc. Ref.",
    "Site + Location + Product",
    "Group + Brand + Product",
    "Brand + Product",
    "Customerwise",
    "Job wise Summary",
    "With out Transfers",
    "With out Transfers - Exp Date",
    "Product with Transaction Totals",
    "Production Report",
    "Production Report Crosstab",
    "Model No. + Product",
    "Product + Batch No.",
];

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function TransactionReportPage() {
    // Header field
    const [principal, setPrincipal] = useState([
        {
            prin_code: "",
            prin_name: "",
        },
    ]);
    // Product
    const [productFrom, setProductFrom] = useState("");
    const [productFromName, setProductFromName] = useState("");
    const [productTo, setProductTo] = useState("");

    // Site
    const [siteFrom, setSiteFrom] = useState("");
    const [siteTo, setSiteTo] = useState("");

    // Location
    const [locationFrom, setLocationFrom] = useState("");
    const [locationTo, setLocationTo] = useState("");

    // Dates
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [expDateFrom, setExpDateFrom] = useState("");
    const [expDateTo, setExpDateTo] = useState("");

    // Job No
    const [jobNo, setJobNo] = useState("");

    // Customer
    const [customerFrom, setCustomerFrom] = useState("");
    const [customerFromName, setCustomerFromName] = useState("");
    const [customerTo, setCustomerTo] = useState("");

    // Txn type
    const [txnType, setTxnType] = useState("");

    // Doc ref
    const [docRefFrom, setDocRefFrom] = useState("");
    const [docRefTo, setDocRefTo] = useState("");

    // Lot No
    const [lotNoFrom, setLotNoFrom] = useState("");
    const [lotNoTo, setLotNoTo] = useState("");

    // Batch No
    const [batchNoFrom, setBatchNoFrom] = useState("");
    const [batchNoTo, setBatchNoTo] = useState("");

    // Report group on
    const [groupedOn, setGroupedOn] = useState("Group + Brand + Product");

    const reportDate = (() => {
        const d = new Date();
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
    })();

    const handleReset = () => {
        setPrincipal([
            {
                prin_code: "",
                prin_name: "",
            },
        ]);
        setProductFrom(""); setProductFromName(""); setProductTo("");
        setSiteFrom(""); setSiteTo("");
        setLocationFrom(""); setLocationTo("");
        setDateFrom(""); setDateTo("");
        setExpDateFrom(""); setExpDateTo("");
        setJobNo("");
        setCustomerFrom(""); setCustomerFromName(""); setCustomerTo("");
        setTxnType("");
        setDocRefFrom(""); setDocRefTo("");
        setLotNoFrom(""); setLotNoTo("");
        setBatchNoFrom(""); setBatchNoTo("");
        setGroupedOn("Group + Brand + Product");
    };

    const handleGenerate = () => {
        // UI only — no API call wired yet
        console.log("Generate Transaction Report", {
            principal, productFrom, productTo, siteFrom, siteTo,
            locationFrom, locationTo, dateFrom, dateTo,
            expDateFrom, expDateTo, jobNo,
            customerFrom, customerTo, txnType,
            docRefFrom, docRefTo, lotNoFrom, lotNoTo,
            batchNoFrom, batchNoTo, groupedOn,
        });
    };

    return (
        <div style={{ background: "#f3f4f6", padding: "6px 10px", fontFamily: "system-ui, sans-serif" }}>
            <style>{`
        .group-option:hover { background: #f0f7ff; }
        .action-btn:hover { background: #f9fafb !important; }
        .action-btn-primary:hover { background: #0C447C !important; border-color: #0C447C !important; }
      `}</style>

            <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>

                {/* ══ Main filter card ══════════════════════════════════════════════ */}
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "5px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <BarChart2 size={18} color="#185FA5" />
                        <span style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>Transaction Report filter</span>
                    </div>

                    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                        {/* ── Left: form fields ───────────────────────────────────────── */}
                        <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ position: "relative" }}>
                                <span
                                    style={{
                                        position: "absolute",
                                        top: -8,
                                        left: 10,
                                        fontSize: 11,
                                        color: "#6b7280",
                                        background: "#fff",
                                        padding: "0 4px",
                                        zIndex: 1,
                                    }}
                                >
                                    Principal
                                </span>

                                <LookupField
                                    label=""
                                    value={principal[0]?.prin_code || ""}
                                    displayValue={principal[0]?.prin_name || ""}
                                    columns={[
                                        { field: "prin_code", header: "Code" },
                                        { field: "prin_name", header: "Name" },
                                    ]}
                                    valueField="prin_code"
                                    displayFields={["prin_code", "prin_name"]}
                                    loadOptions={() =>
                                        getDynamicLookupaccount({
                                            parameter: "WMS_Stock_principal",
                                            code1: "BSG",
                                            loginid: "ADMIN",
                                        })
                                    }
                                    onChange={(val) =>
                                        setPrincipal([
                                            {
                                                prin_code: val,
                                                prin_name: "",
                                            },
                                        ])
                                    }
                                />
                            </div>




                            {/* Product From / To */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                                <LookupTextField label="Product From" value={productFrom} onChange={setProductFrom} />
                                <LookupTextField label="Product To" value={productTo} onChange={setProductTo} />
                                <TextField label="Product Description" value={productFromName} onChange={setProductFromName} />
                            </div>

                            {/* Site From / To */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <LookupTextField label="Site From" value={siteFrom} onChange={setSiteFrom} />
                                <LookupTextField label="Site To" value={siteTo} onChange={setSiteTo} />
                            </div>

                            {/* Location From / To */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <LookupTextField label="Location From" value={locationFrom} onChange={setLocationFrom} />
                                <LookupTextField label="Location To" value={locationTo} onChange={setLocationTo} />
                            </div>

                            {/* From Date / To Date */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <DateField label="From Date" value={dateFrom} onChange={setDateFrom} />
                                <DateField label="To Date" value={dateTo} onChange={setDateTo} />
                            </div>

                            {/* Exp Date From / To */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <DateField label="Exp Date From" value={expDateFrom} onChange={setExpDateFrom} />
                                <DateField label="Exp Date To" value={expDateTo} onChange={setExpDateTo} />
                            </div>

                            {/* Job No */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <LookupTextField label="Job No" value={jobNo} onChange={setJobNo} />
                                <div />
                            </div>

                            {/* Customer From / To */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                                <LookupTextField label="Customer From" value={customerFrom} onChange={setCustomerFrom} />
                                <LookupTextField label="Customer To" value={customerTo} onChange={setCustomerTo} />
                                <TextField label="Customer Description" value={customerFromName} onChange={setCustomerFromName} />
                            </div>

                            {/* Txn Type */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <div>
                                    <div style={fieldLabelStyle}>Txn Type</div>
                                    <select
                                        value={txnType}
                                        onChange={(e) => setTxnType(e.target.value)}
                                        style={inputStyle}
                                    >
                                        <option value="">Select...</option>
                                        <option value="adj-">ADJ-</option>
                                        <option value="adj+">ADJ+</option>
                                        <option value="exp">EXP</option>
                                        <option value="imp">IMP</option>
                                        <option value="tfi">TFI</option>
                                        <option value="tfo">TFO</option>
                                    </select>
                                </div>
                                <div />
                            </div>

                            {/* Doc Ref From / To */}
                            {/* <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <LookupTextField label="Doc. Ref. From" value={docRefFrom} onChange={setDocRefFrom} />
                <LookupTextField label="Doc. Ref. To" value={docRefTo} onChange={setDocRefTo} />
              </div> */}

                            {/* Lot No From / To */}
                            {/* <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <TextField label="Lot No. From" value={lotNoFrom} onChange={setLotNoFrom} />
                <TextField label="Lot No. To" value={lotNoTo} onChange={setLotNoTo} />
              </div> */}

                            {/* Batch No From / To */}
                            {/* <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <LookupTextField label="Batch No. From" value={batchNoFrom} onChange={setBatchNoFrom} />
                <LookupTextField label="Batch No. To" value={batchNoTo} onChange={setBatchNoTo} />
              </div> */}

                            {/* Report Date */}
                            {/* <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={fieldLabelStyle}>Report Date</div>
                  <input
                    type="text"
                    value={reportDate}
                    readOnly
                    style={{ ...inputStyle, background: "#f3f4f6", color: "#6b7280" }}
                  />
                </div>
                <div />
              </div> */}

                        </div>

                        {/* ── Right: Report Grouped On sidebar ───────────────────────── */}
                        <div style={{
                            flex: "0 0 240px",
                            border: "0.5px solid #d1d5db",
                            borderRadius: 8,
                            padding: "10px 14px",
                            background: "#f9fafb",
                            alignSelf: "stretch",
                        }}>
                            <div style={{ ...fieldLabelStyle, marginBottom: 8, fontSize: 12 }}>Report Grouped On</div>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                {GROUP_OPTIONS.map((opt) => (
                                    <label key={opt} className="group-option" style={radioLabelStyle}>
                                        <input
                                            type="radio"
                                            name="groupedOn"
                                            value={opt}
                                            checked={groupedOn === opt}
                                            onChange={() => setGroupedOn(opt)}
                                            style={{ accentColor: "#185FA5" }}
                                        />
                                        <span style={{ color: groupedOn === opt ? "#185FA5" : "#374151", fontWeight: groupedOn === opt ? 500 : 400 }}>
                                            {opt}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Action bar */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "0.5px solid #e5e7eb" }}>
                        <button
                            className="action-btn"
                            onClick={handleReset}
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151" }}
                        >
                            <RotateCcw size={13} /> Reset
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