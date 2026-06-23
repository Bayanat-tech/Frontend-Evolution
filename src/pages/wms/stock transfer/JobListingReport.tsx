"use client";

import { useState } from "react";
import { RotateCcw, Download, Printer, Loader2, ChevronDown, Calendar, Briefcase, Users, Tag } from "lucide-react";
import { getDynamicLookupaccount } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { LookupField } from "../../../components/ui/LookupField";
import { exportJobListingExcel, jobListingReport } from "../../../api/transactions";

type JobType = "pending" | "confirmed" | "cancelled" | "invoiced" | "all" | "cancelled-detail";
interface DateRange { from: string; to: string; }

const formatDate = (date: string) => {
    if (!date) return "";
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

const JOB_TYPES: { key: JobType; label: string; ls_cancel: string; ls_confirmed: string; ls_invoice: string; color: string }[] = [
    { key: "pending", label: "Pending to confirm", ls_cancel: "N", ls_confirmed: "Pending", ls_invoice: "Pending", color: "#F59E0B" },
    { key: "confirmed", label: "Confirmed · pending invoice", ls_cancel: "N", ls_confirmed: "Confirmed", ls_invoice: "Pending", color: "#10B981" },
    { key: "cancelled", label: "Cancelled", ls_cancel: "Y", ls_confirmed: "All", ls_invoice: "ALL", color: "#EF4444" },
    { key: "invoiced", label: "Invoiced", ls_cancel: "N", ls_confirmed: "Confirmed", ls_invoice: "Invoiced", color: "#6366F1" },
    { key: "all", label: "All jobs", ls_cancel: "All", ls_confirmed: "All", ls_invoice: "All", color: "#3B82F6" },
    { key: "cancelled-detail", label: "Cancelled with detail", ls_cancel: "All", ls_confirmed: "All", ls_invoice: "All", color: "#8B5CF6" },
];

const JOB_CLASS_OPTIONS = [
    { label: "Normal", value: "N" },
    { label: "Non Inventory", value: "O" },
    { label: "Sales Return", value: "R" },
    { label: "Manual Putaway", value: "M" },
];

const SectionCard = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: "1px solid #F3F4F6", background: "#FAFAFA" }}>
            <span style={{ color: "#185FA5", display: "flex" }}>{icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
        </div>
        <div style={{ padding: "12px 14px 10px" }}>{children}</div>
    </div>
);

const ClassSelect = ({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (v: string) => void }) => (
    <div style={{ position: "relative" }}>
        <select value={value} onChange={e => onChange(e.target.value)}
            style={{ width: "100%", height: 34, padding: "0 28px 0 10px", fontSize: 12, border: "1px solid #E5E7EB", borderRadius: 7, background: "#fff", color: value ? "#111827" : "#9CA3AF", outline: "none", appearance: "none", WebkitAppearance: "none", cursor: "pointer", fontFamily: "inherit" }}>
            <option value="">{placeholder}</option>
            {JOB_CLASS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
    </div>
);

const FloatField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ position: "relative", paddingTop: 6 }}>
        <span style={{ position: "absolute", top: -1, left: 10, fontSize: 10, fontWeight: 500, color: "#6B7280", background: "#fff", padding: "0 3px", zIndex: 1 }}>{label}</span>
        {children}
    </div>
);

const LookupWrapper = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ position: "relative", paddingTop: 6 }}>
        <span style={{ position: "absolute", top: -1, left: 10, fontSize: 10, fontWeight: 500, color: "#6B7280", background: "#fff", padding: "0 3px", zIndex: 1 }}>{label}</span>
        {children}
    </div>
);

const DateBox = ({ label, range, onChange, accentColor }: { label: string; range: DateRange; onChange: (r: DateRange) => void; accentColor: string }) => (
    <div style={{ border: `1px solid ${accentColor}30`, borderRadius: 9, padding: "10px 12px", background: `${accentColor}06`, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: accentColor }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: accentColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 6 }}>
            <div>
                <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 500, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>From</div>
                <input type="date" value={range.from} onChange={e => onChange({ ...range, from: e.target.value })}
                    style={{ width: "100%", height: 32, padding: "0 7px", fontSize: 11, border: "1px solid #E5E7EB", borderRadius: 6, background: "#fff", color: "#111827", outline: "none", fontFamily: "inherit" }} />
            </div>
            <div style={{ fontSize: 13, color: "#D1D5DB", marginTop: 14 }}>→</div>
            <div>
                <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 500, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>To</div>
                <input type="date" value={range.to} onChange={e => onChange({ ...range, to: e.target.value })}
                    style={{ width: "100%", height: 32, padding: "0 7px", fontSize: 11, border: "1px solid #E5E7EB", borderRadius: 6, background: "#fff", color: "#111827", outline: "none", fontFamily: "inherit" }} />
            </div>
        </div>
    </div>
);

export default function JobReportFilter() {
    const { user } = useAuth();

    const [principalFrom, setPrincipalFrom] = useState<[{ prin_code: string; prin_name: string }]>([{ prin_code: "", prin_name: "" }]);
    const [principalTo, setPrincipalTo] = useState<[{ prin_code: string; prin_name: string }]>([{ prin_code: "", prin_name: "" }]);
    const [jobFrom, setJobFrom] = useState<[{ job_no: string; job_type: string; job_date: string }]>([{ job_no: "", job_type: "", job_date: "" }]);
    const [jobTo, setJobTo] = useState<[{ job_no: string; job_type: string; job_date: string }]>([{ job_no: "", job_type: "", job_date: "" }]);
    const [deptFrom, setDeptFrom] = useState<[{ dept_code: string; dept_name: string }]>([{ dept_code: "", dept_name: "" }]);
    const [deptTo, setDeptTo] = useState<[{ dept_code: string; dept_name: string }]>([{ dept_code: "", dept_name: "" }]);
    const [jobDate, setJobDate] = useState<DateRange>({ from: "2026-06-01", to: new Date().toISOString().split("T")[0] });
    const [confirmDate, setConfirmDate] = useState<DateRange>({ from: "", to: new Date().toISOString().split("T")[0]  });
    const [cancelDate, setCancelDate] = useState<DateRange>({ from: "", to: new Date().toISOString().split("T")[0]  });
    const [classFrom, setClassFrom] = useState("");
    const [classTo, setClassTo] = useState("");
    const [jobType, setJobType] = useState<JobType>("confirmed");
    const [generating, setGenerating] = useState(false);
    const [generatingExcel, setGeneratingExcel] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    const activeType = JOB_TYPES.find(t => t.key === jobType)!;

    const handleReset = () => {
        setPrincipalFrom([{ prin_code: "", prin_name: "" }]);
        setPrincipalTo([{ prin_code: "", prin_name: "" }]);
        setJobFrom([{ job_no: "", job_type: "", job_date: "" }]);
        setJobTo([{ job_no: "", job_type: "", job_date: "" }]);
        setDeptFrom([{ dept_code: "", dept_name: "" }]);
        setDeptTo([{ dept_code: "", dept_name: "" }]);
        setJobDate({ from: "", to: new Date().toISOString().split("T")[0] });
        setConfirmDate({ from: "", to: new Date().toISOString().split("T")[0]  });
        setCancelDate({ from: "", to: new Date().toISOString().split("T")[0] });
        setClassFrom(""); setClassTo("");
        setJobType("confirmed");
        setReportError(null);
    };

    const buildParams = () => {
        const t = JOB_TYPES.find(i => i.key === jobType) || JOB_TYPES.find(i => i.key === "all")!;
        return {
            loginid: user?.loginid || user?.username || "ADMIN",
            parameter: "WMS_Stock_JOB_LISTING_REPORT",
            code1: user?.company_code || "",
            code2: principalFrom?.map(x => x.prin_code).join(",") || "All",
            code3: principalTo?.map(x => x.prin_code).join(",") || "All",
            code4: jobFrom?.map(x => x.job_no).join(",") || "All",
            code5: jobTo?.map(x => x.job_no).join(",") || "All",
            code6: deptFrom?.map(x => x.dept_code).join(",") || "All",
            code7: deptTo?.map(x => x.dept_code).join(",") || "All",
            code8: formatDate(jobDate.from),
            code9: formatDate(jobDate.to),
            code10: formatDate(confirmDate.from),
            code11: formatDate(confirmDate.to),
            code12: formatDate(cancelDate.from),
            code13: formatDate(cancelDate.to),
            code14: classFrom || "All",
            code15: classTo || "All",
            code16: t.ls_cancel,
            code17: t.ls_confirmed,
            code18: t.ls_invoice,
            code20: "RAWSQL",
        };
    };

    const handleGenerate = async () => {
        setReportError(null);
        setGenerating(true);
        try {
            await jobListingReport(buildParams());
            await new Promise(r => setTimeout(r, 1200));
        } catch {
            setReportError("Failed to generate report. Please try again.");
        } finally {
            setGenerating(false);
        }
    };
 const handleExportExcel = async () => {
    console.log("Button Clicked"); // Debug 1
    setReportError(null);
    setGeneratingExcel(true);
    
    try {
        const params = buildParams();
        console.log("Params Built:", params); // Debug 2
        
        await exportJobListingExcel(params);
        console.log("API function finished"); // Debug 3
    } catch (err: any) {
        console.error("Catch Block Error:", err);
        setReportError(err.message || "Failed to generate report.");
    } finally {
        setGeneratingExcel(false);
    }
};

    const prinLookupProps = (onChange: (v: string) => void, value: string, displayValue: string) => ({
        label: "", value, displayValue,
        columns: [{ field: "prin_code", header: "Code" }, { field: "prin_name", header: "Name" }] as any,
        valueField: "prin_code" as any,
        displayFields: ["prin_code", "prin_name"] as any,
        loadOptions: () => getDynamicLookupaccount({ parameter: "WMS_Stock_principal", code1: user?.company_code, loginid: user?.loginid || user?.username || "ADMIN" }),
        onChange,
    });

    return (
        /* ✅ FIX: no height/overflow here — let the page scroll naturally */
        <div style={{ display: "flex", flexDirection: "column", background: "#F1F5F9", fontFamily: "'Inter', system-ui, sans-serif" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
                .act-btn { height: 34px; padding: 0 14px; border: 1px solid #E5E7EB; background: #fff; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; border-radius: 7px; color: #374151; font-family: inherit; font-weight: 500; transition: all 0.12s; white-space: nowrap; }
                .act-btn:hover { background: #F9FAFB; border-color: #D1D5DB; }
                .act-btn-primary { height: 34px; padding: 0 18px; border: 1px solid #185FA5; background: #185FA5; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; border-radius: 7px; color: #fff; font-family: inherit; font-weight: 600; transition: all 0.12s; white-space: nowrap; }
                .act-btn-primary:hover { background: #0C447C; border-color: #0C447C; }
                .act-btn-primary:disabled { background: #93C5FD !important; border-color: #93C5FD !important; cursor: not-allowed; }
                input[type="date"]:focus, input:focus, select:focus { border-color: #185FA5 !important; box-shadow: 0 0 0 3px rgba(24,95,165,0.10) !important; outline: none !important; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
               .group-box {
    padding: 12px 0;
    background: transparent;
}
                .group-title { font-size: 10px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 10px; }
            `}</style>
            <div style={{ padding: "10px 16px", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 500, color: "#111827" }}>
                        <span style={{ color: "#185FA5", fontSize: 15 }}>⚙</span> Job report filter
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 10px", borderRadius: 20, background: "#E6F1FB", color: "#0C447C" }}>
                        {JOB_TYPES.find(t => t.key === jobType)?.label}
                     </span>
             </div>

            {/* ✅ FIX: normal flow, no flex/overflow — just padding */}
            <div style={{ padding: "0px 16px 4px" }}>

                {/* Principal & Job */}
                <SectionCard icon={<Briefcase size={13} />} title="Principal & Job">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div className="group-box">
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <LookupWrapper label="Principal From">
                                    <LookupField {...prinLookupProps(val => setPrincipalFrom([{ prin_code: val, prin_name: "" }]), principalFrom[0]?.prin_code || "", principalFrom[0]?.prin_name || "")} />
                                </LookupWrapper>
                                <LookupWrapper label="Principal To">
                                    <LookupField {...prinLookupProps(val => setPrincipalTo([{ prin_code: val, prin_name: "" }]), principalTo[0]?.prin_code || "", principalTo[0]?.prin_name || "")} />
                                </LookupWrapper>
                            </div>
                        </div>
                        <div className="group-box">
                         
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <LookupWrapper label="Job From">
                                    <LookupField
                                        label="" value={jobFrom[0]?.job_no || ""} displayValue={jobFrom[0]?.job_no || ""}
                                        columns={[{ field: "job_no", header: "Code" }, { field: "job_type", header: "Type" }, { field: "job_date", header: "Date" }] as any}
                                        valueField="job_no" displayFields={["job_no", "job_type", "job_date"] as any}
                                        loadOptions={() => getDynamicLookupaccount({ parameter: "WMS_Stock_Job_transfer_report", code1: user?.company_code, loginid: user?.loginid || user?.username || "ADMIN" })}
                                        onChange={val => setJobFrom([{ job_no: val, job_type: "", job_date: "" }])}
                                    />
                                </LookupWrapper>
                                <LookupWrapper label="Job To">
                                    <LookupField
                                        label="" value={jobTo[0]?.job_no || ""} displayValue={jobTo[0]?.job_no || ""}
                                        columns={[{ field: "job_no", header: "Code" }, { field: "job_type", header: "Type" }, { field: "job_date", header: "Date" }] as any}
                                        valueField="job_no" displayFields={["job_no", "job_type", "job_date"] as any}
                                        loadOptions={() => getDynamicLookupaccount({ parameter: "WMS_Stock_Job_transfer_report", code1: user?.company_code, loginid: user?.loginid || user?.username || "ADMIN" })}
                                        onChange={val => setJobTo([{ job_no: val, job_type: "", job_date: "" }])}
                                    />
                                </LookupWrapper>
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* Department & Class */}
                <SectionCard icon={<Users size={13} />} title="Department & Class">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                        <FloatField label="Dept From">
                            <LookupField
                                label="" value={deptFrom[0]?.dept_code || ""} displayValue={deptFrom[0]?.dept_name || ""}
                                columns={[{ field: "dept_code", header: "Code" }, { field: "dept_name", header: "Name" }] as any}
                                valueField="dept_code" displayFields={["dept_code", "dept_name"] as any}
                                loadOptions={() => getDynamicLookupaccount({ parameter: "WMS_Stock_department", code1: user?.company_code, loginid: user?.loginid || user?.username || "ADMIN" })}
                                onChange={val => setDeptFrom([{ dept_code: val, dept_name: "" }])}
                            />
                        </FloatField>
                        <FloatField label="Dept To">
                            <LookupField
                                label="" value={deptTo[0]?.dept_code || ""} displayValue={deptTo[0]?.dept_name || ""}
                                columns={[{ field: "dept_code", header: "Code" }, { field: "dept_name", header: "Name" }] as any}
                                valueField="dept_code" displayFields={["dept_code", "dept_name"] as any}
                                loadOptions={() => getDynamicLookupaccount({ parameter: "WMS_Stock_department", code1: user?.company_code, loginid: user?.loginid || user?.username || "ADMIN" })}
                                onChange={val => setDeptTo([{ dept_code: val, dept_name: "" }])}
                            />
                        </FloatField>
                        <FloatField label="Class From">
                            <ClassSelect value={classFrom} placeholder="All classes" onChange={setClassFrom} />
                        </FloatField>
                        <FloatField label="Class To">
                            <ClassSelect value={classTo} placeholder="All classes" onChange={setClassTo} />
                        </FloatField>
                    </div>
                </SectionCard>

                {/* Dates */}
                <SectionCard icon={<Calendar size={13} />} title="Date Range">
                    <div style={{ display: "flex", gap: 10 }}>
                        <DateBox label="Job Date" range={jobDate} onChange={setJobDate} accentColor="#185FA5" />
                        <DateBox label="Confirm Date" range={confirmDate} onChange={setConfirmDate} accentColor="#10B981" />
                        <DateBox label="Cancel Date" range={cancelDate} onChange={setCancelDate} accentColor="#EF4444" />
                    </div>
                </SectionCard>

                {/* Job Type */}
                <SectionCard icon={<Tag size={13} />} title="Job Type">
                    <div style={{ position: "relative", maxWidth: 320 }}>
                        <select
                            value={jobType}
                            onChange={e => setJobType(e.target.value as JobType)}
                            style={{
                                width: "100%", height: 36, padding: "0 12px 0 12px",
                                fontSize: 12, fontFamily: "inherit", fontWeight: 500,
                                border: `1.5px solid ${activeType.color}`,
                                borderRadius: 8, background: `${activeType.color}10`,
                                color: activeType.color, outline: "none",
                                appearance: "none", WebkitAppearance: "none", cursor: "pointer",
                            }}
                        >
                            {JOB_TYPES.map(t => (
                                <option key={t.key} value={t.key}>{t.label}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: activeType.color, pointerEvents: "none" }} />
                    </div>
                </SectionCard>

            </div>

            {/* ✅ FIX: sticky bottom — always visible on load, sticks when scrolling */}
            <div style={{ position: "sticky", bottom: 0, zIndex: 10, borderTop: "1px solid #E5E7EB", background: "#fff", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                {reportError && (
                    <span style={{ fontSize: 11, color: "#B91C1C", marginRight: "auto", display: "flex", alignItems: "center", gap: 5 }}>
                        <span>⚠</span> {reportError}
                    </span>
                )}
                <button className="act-btn" onClick={handleReset}><RotateCcw size={13} /> Reset</button>
                <button className="act-btn" onClick={handleExportExcel}>
                     {generatingExcel && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
                     {!generatingExcel && (
                    <Download size={13} />
              
                     )}
                     Export Excel
                       </button>
                <div style={{ width: 1, height: 20, background: "#E5E7EB" }} />
                <button className="act-btn-primary" disabled={generating} onClick={handleGenerate}>
                    {generating
                        ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating...</>
                        : <><Printer size={13} /> Generate Report</>}
                </button>
            </div>
        </div>
    );
}