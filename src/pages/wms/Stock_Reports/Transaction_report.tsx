"use client";

import React, { useState } from "react";
import {
    Printer,
    RotateCcw,
    BarChart2,
} from "lucide-react";
import { getDynamicLookupaccount } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { LookupField } from "../../../components/ui/LookupField";

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

const radioLabelStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 12,
    cursor: "pointer",
    color: "#374151",
    padding: "4px 8px",
    borderRadius: 5,
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

function TextInput({ value, onChange, readOnly }: { value: string; onChange?: (v: string) => void; readOnly?: boolean }) {
    return (
        <input
            type="text"
            value={value}
            readOnly={readOnly}
            onChange={(e) => onChange?.(e.target.value)}
            style={{ ...inputStyle, background: readOnly ? "#f3f4f6" : "#fff", color: readOnly ? "#6b7280" : "#111827" }}
        />
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

function FloatLabel({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div style={{ position: "relative", marginTop: 6 }}>
            <span style={{
                position: "absolute", top: -8, left: 10,
                fontSize: 11, color: "#6b7280", background: "#fff",
                padding: "0 4px", zIndex: 1, textTransform: "uppercase",
                letterSpacing: "0.05em", fontWeight: 500,
            }}>
                {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
            </span>
            {children}
        </div>
    );
}

// ─── Group options ────────────────────────────────────────────────────────────

const GROUP_OPTIONS = [
    { value: "product", label: "Product" },
    { value: "product_lot", label: "Product + Lot No." },
    { value: "product_doc", label: "Product + Doc. Ref." },
    { value: "site_loc_product", label: "Site + Location + Product" },
    { value: "group_brand_product", label: "Group + Brand + Product" },
    { value: "brand_product", label: "Brand + Product" },
    { value: "customerwise", label: "Customerwise" },
    { value: "job_summary", label: "Job wise Summary" },
    { value: "without_transfers", label: "Without Transfers" },
    { value: "without_transfers_exp", label: "Without Transfers - Exp Date" },
    { value: "product_txn_totals", label: "Product with Transaction Totals" },
    { value: "production_report", label: "Production Report" },
    { value: "production_crosstab", label: "Production Report Crosstab" },
    { value: "model_product", label: "Model No. + Product" },
    { value: "product_batch", label: "Product + Batch No." },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TransactionReportPage() {
    const { user } = useAuth();

    // Principal
    const [principal, setPrincipal] = useState([{ prin_code: "", prin_name: "" }]);

    // Product
    const [productFrom, setProductFrom] = useState("");
    const [productFromName, setProductFromName] = useState("");
    const [productTo, setProductTo] = useState("");
    const [productToName, setProductToName] = useState("");
    const [productDesc, setProductDesc] = useState("");

    // Site
    const [siteFrom, setSiteFrom] = useState("");
    const [siteFromName, setSiteFromName] = useState("");
    const [siteTo, setSiteTo] = useState("");
    const [siteToName, setSiteToName] = useState("");

    // Location
    const [locationFrom, setLocationFrom] = useState("");
    const [locationFromName, setLocationFromName] = useState("");
    const [locationTo, setLocationTo] = useState("");
    const [locationToName, setLocationToName] = useState("");

    // Dates
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [expDateFrom, setExpDateFrom] = useState("");
    const [expDateTo, setExpDateTo] = useState("");

    // Job No
    const [jobNo, setJobNo] = useState("");
    const [jobNoName, setJobNoName] = useState("");

    // Customer
    const [customerFrom, setCustomerFrom] = useState("");
    const [customerFromName, setCustomerFromName] = useState("");
    const [customerTo, setCustomerTo] = useState("");
    const [customerToName, setCustomerToName] = useState("");
    // Txn Type
    const [txnType, setTxnType] = useState("");

    // Doc Ref
    const [docRefFrom, setDocRefFrom] = useState("");
    const [docRefTo, setDocRefTo] = useState("");

    // Lot No
    const [lotNoFrom, setLotNoFrom] = useState("");
    const [lotNoTo, setLotNoTo] = useState("");

    // Batch No
    const [batchNoFrom, setBatchNoFrom] = useState("");
    const [batchNoTo, setBatchNoTo] = useState("");

    // Report group
    const [groupedOn, setGroupedOn] = useState("group_brand_product");

    const reportDate = (() => {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    })();

    const handleReset = () => {
        setPrincipal([{ prin_code: "", prin_name: "" }]);
        setProductFrom(""); setProductFromName("");
        setProductTo(""); setProductToName("");
        setProductDesc("");
        setSiteFrom(""); setSiteFromName("");
        setSiteTo(""); setSiteToName("");
        setLocationFrom(""); setLocationFromName("");
        setLocationTo(""); setLocationToName("");
        setDateFrom(""); setDateTo("");
        setExpDateFrom(""); setExpDateTo("");
        setJobNo(""); setJobNoName("");
        setCustomerFrom(""); setCustomerFromName("");
        setCustomerTo(""); setCustomerToName("");
        setTxnType("");
        setDocRefFrom(""); setDocRefTo("");
        setLotNoFrom(""); setLotNoTo("");
        setBatchNoFrom(""); setBatchNoTo("");
        setGroupedOn("group_brand_product");
    };

    const handleGenerate = () => {
        console.log("Generate Transaction Report", {
            principal: principal[0]?.prin_code,
            productFrom, productTo,
            siteFrom, siteTo,
            locationFrom, locationTo,
            dateFrom, dateTo,
            expDateFrom, expDateTo,
            jobNo, customerFrom, customerTo,
            txnType, docRefFrom, docRefTo,
            lotNoFrom, lotNoTo,
            batchNoFrom, batchNoTo,
            groupedOn,
        });
    };

    const row2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
    const row3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 };

    return (
        <div style={{ background: "#f3f4f6", padding: "6px 10px", fontFamily: "system-ui, sans-serif" }}>
            <style>{`
                .grp-opt:hover { background: #EFF6FF !important; }
                .action-btn:hover { background: #f9fafb !important; }
                .action-btn-primary:hover { background: #0C447C !important; border-color: #0C447C !important; }
            `}</style>

            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "8px 12px" }}>

                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <BarChart2 size={17} color="#185FA5" />
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Transaction Report Filter</span>
                    </div>

                    {/* Main layout */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 16, alignItems: "start" }}>

                        {/* ── Left: form fields ── */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                            {/* Principal */}
                            {/* <FloatLabel label="Principal" required>
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
                                            code1: user?.company_code || "",
                                            loginid: user?.loginid || user?.username || "ADMIN",
                                        })
                                    }
                                    onChange={(val) => setPrincipal([{ prin_code: val, prin_name: "" }])}
                                />
                            </FloatLabel> */}

                            {/* Product From | Product To | Description */}
                            {/* <div style={row3}>
                                <FloatLabel label="Product From">
                                    <LookupField
                                        label=""
                                        value={productFrom}
                                        displayValue={productFromName}
                                        columns={[
                                            { field: "prod_code", header: "Code" },
                                            { field: "prod_name", header: "Name" },
                                        ]}
                                        valueField="prod_code"
                                        displayFields={["prod_code", "prod_name"]}
                                        loadOptions={() =>
                                            getDynamicLookupaccount({
                                                parameter: "WMS_Stock_product_transfer_report",
                                                code1: user?.company_code || "",
                                                code2: principal[0]?.prin_code || "",
                                                code3: "",
                                            })
                                        }
                                        onChange={(val) => setProductFrom(val)}
                                    />
                                </FloatLabel>
                                <FloatLabel label="Product To">
                                    <LookupField
                                        label=""
                                        value={productTo}
                                        displayValue={productToName}
                                        columns={[
                                            { field: "prod_code", header: "Code" },
                                            { field: "prod_name", header: "Name" },
                                        ]}
                                        valueField="prod_code"
                                        displayFields={["prod_code", "prod_name"]}
                                        loadOptions={() =>
                                            getDynamicLookupaccount({
                                                parameter: "WMS_Stock_product_transfer_report",
                                                code1: user?.company_code || "",
                                                code2: principal[0]?.prin_code || "",
                                                code3: "",
                                            })
                                        }
                                        onChange={(val) => setProductTo(val)}
                                    />
                                </FloatLabel>
                                <Field label="Product Description">
                                    <TextInput value={productDesc} onChange={setProductDesc} />
                                </Field>
                            </div>  */}


                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 6, width: "100%" }}>
                                <FloatLabel label="Principal" required>
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
                                                code1: user?.company_code || "",
                                                loginid: user?.loginid || user?.username || "ADMIN",
                                            })
                                        }
                                        onChange={(val) => setPrincipal([{ prin_code: val, prin_name: "" }])}
                                    />
                                </FloatLabel>
                                <FloatLabel label="Product From">
                                    <LookupField
                                        label=""
                                        value={productFrom}
                                        displayValue={productFromName}
                                        columns={[
                                            { field: "prod_code", header: "Code" },
                                            { field: "prod_name", header: "Name" },
                                        ]}
                                        valueField="prod_code"
                                        displayFields={["prod_code", "prod_name"]}
                                        loadOptions={() =>
                                            getDynamicLookupaccount({
                                                parameter: "WMS_Stock_product_transfer_report",
                                                code1: user?.company_code || "",
                                                code2: principal[0]?.prin_code || "",

                                            })
                                        }
                                        onChange={(val) => setProductFrom(val)}
                                    />
                                </FloatLabel>
                                <FloatLabel label="Product To">
                                    <LookupField
                                        label=""
                                        value={productTo}
                                        displayValue={productToName}
                                        columns={[
                                            { field: "prod_code", header: "Code" },
                                            { field: "prod_name", header: "Name" },
                                        ]}
                                        valueField="prod_code"
                                        displayFields={["prod_code", "prod_name"]}
                                        loadOptions={() =>
                                            getDynamicLookupaccount({
                                                parameter: "WMS_Stock_product_transfer_report",
                                                code1: user?.company_code || "",
                                                code2: principal[0]?.prin_code || "",

                                            })
                                        }
                                        onChange={(val) => setProductTo(val)}
                                    />
                                </FloatLabel>
                                {/* <Field label="Product Description">
        <TextInput value={productDesc} onChange={setProductDesc} />
    </Field> */}
                            </div>

                            {/* Site From | Site To */}
                            <div style={row2}>
                                <FloatLabel label="Site From">
                                    <LookupField
                                        label=""
                                        value={siteFrom}
                                        displayValue={siteFromName}
                                        columns={[
                                            { field: "SITE_CODE", header: "Code" },
                                            { field: "SITE_NAME", header: "Name" },
                                        ]}
                                        valueField="SITE_CODE"
                                        displayFields={["SITE_CODE", "SITE_NAME"]}
                                        loadOptions={() =>
                                            getDynamicLookupaccount({
                                                parameter: "WMS_Stock_Site_transfer_report",
                                                code1: user?.company_code || "",
                                            })
                                        }
                                        onChange={(val) => setSiteFrom(val)}
                                    />
                                </FloatLabel>
                                <FloatLabel label="Site To">
                                    <LookupField
                                        label=""
                                        value={siteTo}
                                        displayValue={siteToName}
                                        columns={[
                                            { field: "SITE_CODE", header: "Code" },
                                            { field: "SITE_NAME", header: "Name" },
                                        ]}
                                        valueField="SITE_CODE"
                                        displayFields={["SITE_CODE", "SITE_NAME"]}
                                        loadOptions={() =>
                                            getDynamicLookupaccount({
                                                parameter: "WMS_Stock_Site_transfer_report",
                                                code1: user?.company_code || "",
                                            })
                                        }
                                        onChange={(val) => setSiteTo(val)}
                                    />
                                </FloatLabel>
                            </div>

                            {/* Location From | Location To */}
                            <div style={row2}>
                                <FloatLabel label="Location From">
                                    <LookupField
                                        label=""
                                        value={locationFrom}
                                        displayValue={locationFromName}
                                        columns={[
                                            { field: "LOCATION_CODE", header: "Code" },
                                            { field: "LOC_DESC", header: "Description" },
                                        ]}
                                        valueField="LOCATION_CODE"
                                        displayFields={["LOCATION_CODE", "LOC_DESC"]}
                                        loadOptions={() =>
                                            getDynamicLookupaccount({
                                                parameter: "WMS_Stock_Location_transfer_report",
                                                code1: user?.company_code || "",
                                                code2: siteFrom || "",
                                            })
                                        }
                                        onChange={(val) => setLocationFrom(val)}
                                    />
                                </FloatLabel>
                                <FloatLabel label="Location To">
                                    <LookupField
                                        label=""
                                        value={locationTo}
                                        displayValue={locationToName}
                                        columns={[
                                            { field: "LOCATION_CODE", header: "Code" },
                                            { field: "LOC_DESC", header: "Description" },
                                        ]}
                                        valueField="LOCATION_CODE"
                                        displayFields={["LOCATION_CODE", "LOC_DESC"]}
                                        loadOptions={() =>
                                            getDynamicLookupaccount({
                                                parameter: "WMS_Stock_Location_transfer_report",
                                                code1: user?.company_code || "",
                                                code2: siteTo || "",
                                            })
                                        }
                                        onChange={(val) => setLocationTo(val)}
                                    />
                                </FloatLabel>
                            </div>

                            {/* From Date | To Date */}
                            {/* <fieldset style={{ border: "0.5px solid #d1d5db", borderRadius: 6, padding: "6px 12px 10px", margin: 0 }}>
                                <legend style={{ fontSize: 10, color: "#6b7280", padding: "0 4px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
                                    Transaction Date
                                </legend>
                                <div style={row2}>
                                    <Field label="From Date"><DateInput value={dateFrom} onChange={setDateFrom} /></Field>
                                    <Field label="To Date"><DateInput value={dateTo} onChange={setDateTo} /></Field>
                                </div>
                            </fieldset> */}

                            {/* Exp Date From | Exp Date To */}
                            {/* <fieldset style={{ border: "0.5px solid #d1d5db", borderRadius: 6, padding: "6px 12px 10px", margin: 0 }}>
                                <legend style={{ fontSize: 10, color: "#6b7280", padding: "0 4px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
                                    Transaction EXP Date
                                </legend>
                                <div style={row2}>
                                    <Field label="Exp Date From"><DateInput value={expDateFrom} onChange={setExpDateFrom} /></Field>
                                    <Field label="Exp Date To"><DateInput value={expDateTo} onChange={setExpDateTo} /></Field>
                                </div>
                            </fieldset> */}


                            <div
                                style={{
                                    display: "flex",
                                    gap: "12px",
                                    width: "100%",
                                }}
                            >
                                {/* Transaction Date */}
                                <fieldset
                                    style={{
                                        flex: 1,
                                        border: "0.5px solid #d1d5db",
                                        borderRadius: 6,
                                        padding: "6px 12px 10px",
                                        margin: 0,
                                    }}
                                >
                                    <legend
                                        style={{
                                            fontSize: 10,
                                            color: "#6b7280",
                                            padding: "0 4px",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            fontWeight: 500,
                                        }}
                                    >
                                        Transaction Date
                                    </legend>
                                    <div style={row2}>
                                        <Field label="From Date">
                                            <DateInput value={dateFrom} onChange={setDateFrom} />
                                        </Field>
                                        <Field label="To Date">
                                            <DateInput value={dateTo} onChange={setDateTo} />
                                        </Field>
                                    </div>
                                </fieldset>

                                {/* Transaction EXP Date */}
                                <fieldset
                                    style={{
                                        flex: 1,
                                        border: "0.5px solid #d1d5db",
                                        borderRadius: 6,
                                        padding: "6px 12px 10px",
                                        margin: 0,
                                    }}
                                >
                                    <legend
                                        style={{
                                            fontSize: 10,
                                            color: "#6b7280",
                                            padding: "0 4px",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            fontWeight: 500,
                                        }}
                                    >
                                        Transaction EXP Date
                                    </legend>
                                    <div style={row2}>
                                        <Field label="Exp Date From">
                                            <DateInput value={expDateFrom} onChange={setExpDateFrom} />
                                        </Field>
                                        <Field label="Exp Date To">
                                            <DateInput value={expDateTo} onChange={setExpDateTo} />
                                        </Field>
                                    </div>
                                </fieldset>
                            </div>


                            {/* Customer From | Customer To | Description */}
                            <div style={row2}>
                                <FloatLabel label="Customer From">
                                    <LookupField
                                        label=""
                                        value={customerFrom}
                                        displayValue={customerFromName}
                                        columns={[
                                            { field: "CUST_CODE", header: "Code" },
                                            { field: "CUST_NAME", header: "Name" },
                                        ]}
                                        valueField="CUST_CODE"
                                        displayFields={["CUST_CODE", "CUST_NAME"]}
                                        loadOptions={() =>
                                            getDynamicLookupaccount({
                                                parameter: "WMS_Stock_Customer_transfer_report",
                                                code1: user?.company_code || "",
                                                code2: principal[0]?.prin_code || "",
                                            })
                                        }
                                        onChange={(val) => setCustomerFrom(val)}
                                    />
                                </FloatLabel>
                                <FloatLabel label="Customer To">
                                    <LookupField
                                        label=""
                                        value={customerTo}
                                        displayValue={customerToName}
                                        columns={[
                                            { field: "CUST_CODE", header: "Code" },
                                            { field: "CUST_NAME", header: "Name" },
                                        ]}
                                        valueField="CUST_CODE"
                                        displayFields={["CUST_CODE", "CUST_NAME"]}
                                        loadOptions={() =>
                                            getDynamicLookupaccount({
                                                parameter: "WMS_Stock_Customer_transfer_report",
                                                code1: user?.company_code || "",
                                                code2: principal[0]?.prin_code || "",
                                            })
                                        }
                                        onChange={(val) => setCustomerTo(val)}
                                    />
                                </FloatLabel>
                            </div>

                            {/* Job No */}
                            <div style={row2}>
                                <FloatLabel label="Job No">
                                    <LookupField
                                        label=""
                                        value={jobNo}
                                        displayValue={jobNoName}
                                        columns={[
                                            { field: "JOB_NO", header: "Job No" },
                                            { field: "JOB_TYPE", header: "Type" },
                                            { field: "JOB_DATE", header: "Date" },
                                        ]}
                                        valueField="JOB_NO"
                                        displayFields={["JOB_NO", "JOB_TYPE"]}
                                        loadOptions={() =>
                                            getDynamicLookupaccount({
                                                parameter: "WMS_Stock_Job_transfer_report",
                                                code1: user?.company_code || "",
                                            })
                                        }
                                        onChange={(val) => setJobNo(val)}
                                    />
                                </FloatLabel>

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
                                <div />
                            </div>

                            {/* Txn Type */}
                            {/* <div style={row2}>
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
                                <div />
                            </div> */}

                            {/* Doc Ref From | Doc Ref To */}
                            {/* <div style={row2}>
                                <Field label="Doc. Ref. From"><TextInput value={docRefFrom} onChange={setDocRefFrom} /></Field>
                                <Field label="Doc. Ref. To"><TextInput value={docRefTo} onChange={setDocRefTo} /></Field>
                            </div> */}

                            {/* Lot No From | Lot No To */}
                            {/* <div style={row2}>
                                <Field label="Lot No. From"><TextInput value={lotNoFrom} onChange={setLotNoFrom} /></Field>
                                <Field label="Lot No. To"><TextInput value={lotNoTo} onChange={setLotNoTo} /></Field>
                            </div> */}

                            {/* Batch No From | Batch No To */}
                            {/* <div style={row2}>
                                <Field label="Batch No. From"><TextInput value={batchNoFrom} onChange={setBatchNoFrom} /></Field>
                                <Field label="Batch No. To"><TextInput value={batchNoTo} onChange={setBatchNoTo} /></Field>
                            </div> */}

                            {/* Report Date */}
                            {/* <div style={row2}>
                                <Field label="Report Date">
                                    <TextInput value={reportDate} readOnly />
                                </Field>
                                <div />
                            </div> */}

                        </div>

                        {/* ── Right: Report Grouped On sidebar ── */}
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
                                {GROUP_OPTIONS.map((opt) => (
                                    <label
                                        key={opt.value}
                                        className="grp-opt"
                                        style={{
                                            ...radioLabelStyle,
                                            background: groupedOn === opt.value ? "#E6F1FB" : "transparent",
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="groupedOn"
                                            value={opt.value}
                                            checked={groupedOn === opt.value}
                                            onChange={() => setGroupedOn(opt.value)}
                                            style={{ accentColor: "#185FA5", cursor: "pointer" }}
                                        />
                                        <span style={{
                                            color: groupedOn === opt.value ? "#0C447C" : "#374151",
                                            fontWeight: groupedOn === opt.value ? 500 : 400,
                                            fontSize: 12,
                                        }}>
                                            {opt.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Action bar */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, paddingTop: 8, borderTop: "0.5px solid #e5e7eb" }}>
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