"use client";

import React, { useState, useEffect } from "react";
import {
    BarChart2,
    RotateCcw,
    Printer,
    Loader2,
    Search,
    ChevronUp,
    ChevronDown,
} from "lucide-react";
import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { openVisaExpiryReport } from "../../../api/transactions";


// ─── Types ──────────────────────────────────────────────────────────────────────

interface LookupOption {
    code: string;
    name: string;
}

type EmployeeFilter = "A" | "ALL";

// ─── Date helpers ────────────────────────────────────────────────────────────────

const getToday = (): string => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

const getNextMonth = (): string => {
    const n = new Date();
    n.setMonth(n.getMonth() + 1);
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

const formatDisplay = (iso: string): string => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
};

// ─── Shared styles (identical palette to ProfitLossPage) ─────────────────────────

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

const radioLabelStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    cursor: "pointer",
    color: "#374151",
};

// ─── Searchable Dropdown (same pattern as ProfitLossPage division) ────────────────

interface SearchableDropdownProps {
    label: string;
    value: LookupOption | null;
    onChange: (v: LookupOption | null) => void;
    options: LookupOption[];
    placeholder?: string;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
    label,
    value,
    onChange,
    options,
    placeholder = "Search...",
}) => {
    const [search, setSearch]     = useState("");
    const [open, setOpen]         = useState(false);
    const [display, setDisplay]   = useState("");

    useEffect(() => {
        if (!value) { setDisplay(""); setSearch(""); }
    }, [value]);

    const filtered = options.filter(
        (o) =>
            o.code.toLowerCase().includes(search.toLowerCase()) ||
            o.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ position: "relative" }}>
            <div style={fieldLabelStyle}>{label}</div>
            <input
                type="text"
                placeholder={placeholder}
                value={search !== "" ? search : display}
                onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                style={inputStyle}
            />
            {open && filtered.length > 0 && (
                <div style={{
                    position: "absolute", zIndex: 200, top: "calc(100% + 2px)", left: 0, right: 0,
                    background: "#fff", border: "0.5px solid #d1d5db", borderRadius: 6,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 180, overflowY: "auto",
                }}>
                    {/* Clear option */}
                    <div
                        className="dd-option"
                        style={{ padding: "6px 12px", fontSize: 11, color: "#9ca3af", cursor: "pointer", borderBottom: "0.5px solid #f3f4f6" }}
                        onMouseDown={() => {
                            onChange(null);
                            setDisplay("");
                            setSearch("");
                            setOpen(false);
                        }}
                    >
                        — All —
                    </div>
                    {filtered.map((o) => (
                        <div
                            key={o.code}
                            className="dd-option"
                            style={{ padding: "7px 12px", fontSize: 12, cursor: "pointer" }}
                            onMouseDown={() => {
                                onChange(o);
                                setDisplay(`${o.code} - ${o.name}`);
                                setSearch("");
                                setOpen(false);
                            }}
                        >
                            <span style={{ fontWeight: 500 }}>{o.code}</span>
                            <span style={{ color: "#6b7280", marginLeft: 6 }}>{o.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Generic lookup fetcher ───────────────────────────────────────────────────────

const fetchLookup = async (
    parameter: string,
    loginId: string,
    companyCode: string,
    codeKey: string,
    nameKey: string
): Promise<LookupOption[]> => {
    try {
        const res = await getDynamicLookup({
            parameter,
            loginid: loginId,
            code1: companyCode,
            code2: "", code3: "", code4: "",
            number1: 0, number2: 0, number3: 0, number4: 0,
            date1: null, date2: null, date3: null, date4: null,
        });
        return Array.isArray(res)
            ? res.map((x: any) => ({ code: x[codeKey], name: x[nameKey] }))
            : [];
    } catch {
        return [];
    }
};

// ─── Main Component ───────────────────────────────────────────────────────────────

export default function VisaExpiryListingPage() {
    const { user } = useAuth();
    const companyCode = user?.company_code ?? "";
    const loginId     = user?.loginid ?? user?.username ?? "ADMIN";

    // ── Lookup options ────────────────────────────────────────────────────────────
    const [divisionOptions,    setDivisionOptions]    = useState<LookupOption[]>([]);
    const [departmentOptions,  setDepartmentOptions]  = useState<LookupOption[]>([]);
    const [sectionOptions,     setSectionOptions]     = useState<LookupOption[]>([]);
    const [gradeOptions,       setGradeOptions]       = useState<LookupOption[]>([]);
    const [designationOptions, setDesignationOptions] = useState<LookupOption[]>([]);
    const [employeeOptions,    setEmployeeOptions]    = useState<LookupOption[]>([]);
    const [sponsorOptions,     setSponsorOptions]     = useState<LookupOption[]>([]);

    // ── Selected filter values ────────────────────────────────────────────────────
    const [division,    setDivision]    = useState<LookupOption | null>(null);
    const [department,  setDepartment]  = useState<LookupOption | null>(null);
    const [section,     setSection]     = useState<LookupOption | null>(null);
    const [grade,       setGrade]       = useState<LookupOption | null>(null);
    const [designation, setDesignation] = useState<LookupOption | null>(null);
    const [employee,    setEmployee]    = useState<LookupOption | null>(null);
    const [sponsor,     setSponsor]     = useState<LookupOption | null>(null);

    // ── Date + radio ──────────────────────────────────────────────────────────────
    const [visaExpiryFrom,  setVisaExpiryFrom]  = useState(getToday());
    const [visaExpiryTo,    setVisaExpiryTo]    = useState(getNextMonth());
    const [employeeFilter,  setEmployeeFilter]  = useState<EmployeeFilter>("A");

    // ── UI state ──────────────────────────────────────────────────────────────────
    const [generating,   setGenerating]   = useState(false);
    const [reportError,  setReportError]  = useState<string | null>(null);
    const [filtersOpen,  setFiltersOpen]  = useState(true);

    // ── Fetch all lookups on mount ────────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            const [div, dept, sec, grd, desig, emp, spon] = await Promise.all([
                fetchLookup("AC_ASSETS_DEPRECIATION_DIVISION_LIST", loginId, companyCode, "div_code",     "div_name"),
                fetchLookup("HR_CAM_DEPARTMENT_DEPTCODE",           loginId, companyCode, "dept_code",    "dept_short_name"),
                fetchLookup("AC_ASSETS_SECTION",                    loginId, companyCode, "section_code", "section_name"),
                fetchLookup("AC_ASSETS_HR_GRADE_LIST",              loginId, companyCode, "grade_code",   "grade_name"),
                fetchLookup("MST_HR_MS_HR_DESIGNATION_LIST",        loginId, companyCode, "desg_code",    "desg_name"),
                fetchLookup("AC_ASSETS_HR_EMPLOYEE_LIST",           loginId, companyCode, "emp_id",       "emp_name"),
                fetchLookup("AC_ASSETS_HR_SPONSOR",                 loginId, companyCode, "sponsor_name", "sponsor_short_name"),
            ]);
            setDivisionOptions(div);
            setDepartmentOptions(dept);
            setSectionOptions(sec);
            setGradeOptions(grd);
            setDesignationOptions(desig);
            setEmployeeOptions(emp);
            setSponsorOptions(spon);
        };
        load();
    }, []);

    // ── Reset ─────────────────────────────────────────────────────────────────────
    const handleReset = () => {
        setDivision(null);
        setDepartment(null);
        setSection(null);
        setGrade(null);
        setDesignation(null);
        setEmployee(null);
        setSponsor(null);
        setVisaExpiryFrom(getToday());
        setVisaExpiryTo(getNextMonth());
        setEmployeeFilter("A");
        setReportError(null);
    };

    // ── Generate ──────────────────────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (!visaExpiryFrom || !visaExpiryTo) {
            setReportError("Please select both Visa Expiry From and To dates.");
            return;
        }

        setReportError(null);
        setGenerating(true);

        try {
            await openVisaExpiryReport({
                parameter: "HR_VISA_EXPIRY_REPORT",
                loginid:   loginId,
                code1:     companyCode,
                code2:     division?.code    ?? "",   // div_code
                code3:     department?.code  ?? "",   // dept_code
                code4:     section?.code     ?? "",   // section_code
                code5:     grade?.code       ?? "",   // grade_code
                code6:     designation?.code ?? "",   // desg_code
                code7:     employee?.code    ?? "",   // emp_id
                code8:     sponsor?.code     ?? "",   // sponsor_code
                code9:     employeeFilter,             // A | ALL
                date1:     visaExpiryFrom,             // visa_expiry_from
                date2:     visaExpiryTo,               // visa_expiry_to
            });
        } catch (err: any) {
            setReportError(err?.message ?? "Failed to generate report. Please try again.");
            console.error(err);
        } finally {
            setGenerating(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────────
    return (
        <div style={{ background: "#f3f4f6", padding: "16px", fontFamily: "system-ui, sans-serif", minHeight: "100%" }}>
            <style>{`
                .action-btn:hover          { background: #f9fafb !important; }
                .action-btn-primary:hover  { background: #0C447C !important; border-color: #0C447C !important; }
                .dd-option:hover           { background: #f0f7ff; }
                .collapse-btn:hover        { background: #f0f7ff !important; }
                @keyframes spin            { to { transform: rotate(360deg); } }
            `}</style>

            <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

                {/* ══ Card 1 — Filters ═══════════════════════════════════════════════ */}
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>

                    {/* Card header — collapsible */}
                    <div
                        style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "16px 24px", cursor: "pointer", borderBottom: filtersOpen ? "0.5px solid #e5e7eb" : "none",
                        }}
                        onClick={() => setFiltersOpen((p) => !p)}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <BarChart2 size={18} color="#185FA5" />
                            <span style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>
                                Visa Expiry Report Filter
                            </span>
                        </div>
                        <button
                            className="collapse-btn"
                            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 6, color: "#6b7280" }}
                        >
                            {filtersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    </div>

                    {filtersOpen && (
                        <div style={{ padding: "20px 24px" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>

                                {/* ── Col 1: Division, Department, Section ── */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 240, flex: "1 1 240px" }}>
                                    <SearchableDropdown
                                        label="Division"
                                        value={division}
                                        onChange={setDivision}
                                        options={divisionOptions}
                                        placeholder="Search division..."
                                    />
                                    <SearchableDropdown
                                        label="Department"
                                        value={department}
                                        onChange={setDepartment}
                                        options={departmentOptions}
                                        placeholder="Search department..."
                                    />
                                    <SearchableDropdown
                                        label="Section"
                                        value={section}
                                        onChange={setSection}
                                        options={sectionOptions}
                                        placeholder="Search section..."
                                    />
                                </div>

                                {/* ── Col 2: Grade, Designation, Employee, Sponsor ── */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 240, flex: "1 1 240px" }}>
                                    <SearchableDropdown
                                        label="Grade"
                                        value={grade}
                                        onChange={setGrade}
                                        options={gradeOptions}
                                        placeholder="Search grade..."
                                    />
                                    <SearchableDropdown
                                        label="Designation"
                                        value={designation}
                                        onChange={setDesignation}
                                        options={designationOptions}
                                        placeholder="Search designation..."
                                    />
                                    <SearchableDropdown
                                        label="Employee Code"
                                        value={employee}
                                        onChange={setEmployee}
                                        options={employeeOptions}
                                        placeholder="Search employee..."
                                    />
                                    <SearchableDropdown
                                        label="Sponsor"
                                        value={sponsor}
                                        onChange={setSponsor}
                                        options={sponsorOptions}
                                        placeholder="Search sponsor..."
                                    />
                                </div>

                                {/* ── Col 3: Visa Expiry dates + Employee type ── */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 220, flex: "1 1 220px" }}>

                                    {/* Visa Expiry date range */}
                                    <fieldset style={{ border: "0.5px solid #d1d5db", borderRadius: 6, padding: "6px 12px 12px", margin: 0 }}>
                                        <legend style={{ fontSize: 10, color: "#6b7280", padding: "0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            Visa Expiry
                                        </legend>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                                            <div>
                                                <div style={{ ...fieldLabelStyle, marginBottom: 3 }}>From</div>
                                                <input
                                                    type="date"
                                                    value={visaExpiryFrom}
                                                    max={visaExpiryTo || undefined}
                                                    onChange={(e) => setVisaExpiryFrom(e.target.value)}
                                                    style={inputStyle}
                                                />
                                            </div>
                                            <div>
                                                <div style={{ ...fieldLabelStyle, marginBottom: 3 }}>To</div>
                                                <input
                                                    type="date"
                                                    value={visaExpiryTo}
                                                    min={visaExpiryFrom || undefined}
                                                    onChange={(e) => setVisaExpiryTo(e.target.value)}
                                                    style={inputStyle}
                                                />
                                            </div>
                                        </div>
                                    </fieldset>

                                    {/* Employee type radio */}
                                    <fieldset style={{ border: "0.5px solid #d1d5db", borderRadius: 6, padding: "6px 12px 12px", margin: 0 }}>
                                        <legend style={{ fontSize: 10, color: "#6b7280", padding: "0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            Employee Type
                                        </legend>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                                            <label style={radioLabelStyle}>
                                                <input
                                                    type="radio"
                                                    name="empFilter"
                                                    value="A"
                                                    checked={employeeFilter === "A"}
                                                    onChange={() => setEmployeeFilter("A")}
                                                    style={{ accentColor: "#185FA5" }}
                                                />
                                                Active Employees
                                            </label>
                                            <label style={radioLabelStyle}>
                                                <input
                                                    type="radio"
                                                    name="empFilter"
                                                    value="ALL"
                                                    checked={employeeFilter === "ALL"}
                                                    onChange={() => setEmployeeFilter("ALL")}
                                                    style={{ accentColor: "#185FA5" }}
                                                />
                                                All Employees
                                            </label>
                                        </div>
                                    </fieldset>
                                </div>
                            </div>

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
                        </div>
                    )}
                </div>

                {/* ══ Card 2 — Summary + Action bar ══════════════════════════════════ */}
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "20px 24px" }}>

                    {/* Summary panel */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={fieldLabelStyle}>Report Summary</div>
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                            gap: "12px 24px",
                            background: "#f9fafb",
                            border: "0.5px solid #e5e7eb",
                            borderRadius: 8,
                            padding: "14px 16px",
                            marginTop: 8,
                        }}>
                            {[
                                ["Division",      division?.name    || "All"],
                                ["Department",    department?.name  || "All"],
                                ["Section",       section?.name     || "All"],
                                ["Grade",         grade?.name       || "All"],
                                ["Designation",   designation?.name || "All"],
                                ["Employee",      employee?.name    || "All"],
                                ["Sponsor",       sponsor?.name     || "All"],
                                ["Expiry From",   formatDisplay(visaExpiryFrom)],
                                ["Expiry To",     formatDisplay(visaExpiryTo)],
                                ["Emp. Type",     employeeFilter === "A" ? "Active" : "All"],
                            ].map(([k, v]) => (
                                <div key={k}>
                                    <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
                                        {k}
                                    </div>
                                    <div style={{
                                        fontSize: 12, fontWeight: 500, color: "#111827",
                                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                    }}>
                                        {v}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action bar */}
                    <div style={{
                        display: "flex", justifyContent: "flex-end", gap: 8,
                        paddingTop: 14, borderTop: "0.5px solid #e5e7eb",
                    }}>
                        <button
                            className="action-btn"
                            onClick={handleReset}
                            disabled={generating}
                            style={{
                                padding: "7px 16px", border: "0.5px solid #d1d5db",
                                background: "#fff", cursor: generating ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", gap: 6,
                                fontSize: 12, borderRadius: 6, color: "#374151",
                                opacity: generating ? 0.6 : 1,
                            }}
                        >
                            <RotateCcw size={13} /> Reset
                        </button>

                        <button
                            className="action-btn-primary"
                            onClick={handleGenerate}
                            disabled={generating}
                            style={{
                                padding: "7px 16px", border: "0.5px solid #185FA5",
                                background: "#185FA5", cursor: generating ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", gap: 6,
                                fontSize: 12, borderRadius: 6, color: "#fff",
                                opacity: generating ? 0.7 : 1,
                            }}
                        >
                            {generating
                                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating…</>
                                : <><Printer size={13} /> Generate Report</>
                            }
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}