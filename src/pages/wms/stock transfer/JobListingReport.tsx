"use client";

import { useState } from "react";
import { RotateCcw, Download, Printer, Loader2, ChevronDown } from "lucide-react";
import { getDynamicLookup, getDynamicLookupaccount } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { LookupField } from "../../../components/ui/LookupField";
import { jobListingReport } from "../../../api/transactions";

type JobType = "pending" | "confirmed" | "cancelled" | "invoiced" | "all" | "cancelled-detail";
interface DateRange { from: string; to: string; }

const formatDate = (date: string) => {
    if (!date) return "";
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

const FL = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{children}</div>
);

const DatePair = ({ label, range, onChange }: { label: string; range: DateRange; onChange: (r: DateRange) => void }) => (
    <div>
        <FL>{label}</FL>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 4 }}>
            <input type="date" value={range.from} onChange={e => onChange({ ...range, from: e.target.value })}
                style={{ width: "100%", height: 32, padding: "0 6px", fontSize: 11, border: "0.5px solid #d1d5db", borderRadius: 6, background: "#fff", color: "#111827", outline: "none" }} />
            <span style={{ fontSize: 10, color: "#9ca3af" }}>–</span>
            <input type="date" value={range.to} onChange={e => onChange({ ...range, to: e.target.value })}
                style={{ width: "100%", height: 32, padding: "0 6px", fontSize: 11, border: "0.5px solid #d1d5db", borderRadius: 6, background: "#fff", color: "#111827", outline: "none" }} />
        </div>
    </div>
);


const JOB_TYPES: { key: JobType; label: string; ls_cancel: string; ls_confirmed: string; ls_invoice: string }[] = [
    { key: "pending",          label: "Pending to confirm",             ls_cancel: "N", ls_confirmed: "Pending",    ls_invoice: "Pending"    },
    { key: "confirmed",        label: "Confirmed · pending to invoice", ls_cancel: "N", ls_confirmed: "Confirmed",  ls_invoice: "Pending"    },
    { key: "cancelled",        label: "Cancelled",                      ls_cancel: "Y", ls_confirmed: "All",  ls_invoice: "ALL"    },
    { key: "invoiced",         label: "Invoiced",                       ls_cancel: "N", ls_confirmed: "Confirmed",  ls_invoice: "Invoiced"   },
    { key: "all",              label: "All",                            ls_cancel: "All", ls_confirmed: "All",        ls_invoice: "All"        },
    { key: "cancelled-detail", label: "Cancelled with detail",          ls_cancel: "All", ls_confirmed: "All",  ls_invoice: "All"    },
];

const LOOKUP_PROPS = (parameter: string, user: any) => ({
    columns: [{ field: "code", header: "Code" }, { field: "name", header: "Name" }] as any,
    valueField: "code" as any,
    displayFields: ["code", "name"] as any,
    loadOptions: () => getDynamicLookupaccount({ parameter:"WMS_Stock_principal", code1: user?.company_code, loginid: user?.loginid || user?.username || "ADMIN" }),
});
const JOB_CLASS_OPTIONS = ["Normal", "Non Inventory", "Sales Return", "Manual Putaway"];

const G4: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 14 };
const G3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 };
const divStyle: React.CSSProperties = { height: "0.5px", background: "#e5e7eb", margin: "4px 0 14px" };
const secLabel = (txt: string) => (
    <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{txt}</div>
);

export default function JobReportFilter() {
    const { user } = useAuth();

    const [principalFrom, setPrincipalFrom] = useState<[{ prin_code: string; prin_name: string }]>([{ prin_code: "", prin_name: "" }]);
    const [principalFromName, setPrincipalFromName] = useState("AMLS – Freight Forwarding Division");
    const [principalTo, setPrincipalTo] = useState<[{ prin_code: string; prin_name: string }]>([{ prin_code: "", prin_name: "" }]);;
    const [principalToName, setPrincipalToName] = useState("");
    const [jobFrom, setJobFrom] =  useState<[{ job_no: string; job_type: string  , job_date: string }]>([{ job_no: "", job_type: "", job_date: "" }]);;
    const [jobFromName, setJobFromName] = useState("");
    const [jobTo, setJobTo] = useState<[{ job_no: string; job_type: string  , job_date: string }]>([{ job_no: "", job_type: "", job_date: "" }]);;
    const [jobToName, setJobToName] = useState("");
    const [deptFrom, setDeptFrom] = useState<[{ dept_code: string; dept_name: string }]>([{ dept_code: "", dept_name: "" }]);
    const [deptFromName, setDeptFromName] = useState("");
    const [deptTo, setDeptTo] = useState<[{ dept_code: string; dept_name: string }]>([{ dept_code: "", dept_name: "" }]);
    const [deptToName, setDeptToName] = useState("");
    const [jobDate, setJobDate] = useState<DateRange>({ from: "2026-06-01", to: "2026-06-15" });
    const [confirmDate, setConfirmDate] = useState<DateRange>({ from: "", to: "2026-06-15" });
    const [cancelDate, setCancelDate] = useState<DateRange>({ from: "", to: "" });
    const [classFrom, setClassFrom] = useState("");
    const [classTo, setClassTo] = useState("");
    const [jobType, setJobType] = useState<JobType>("confirmed");
    const [generating, setGenerating] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    const handleReset = () => {
        setPrincipalFrom([{ prin_code: "", prin_name: "" }]);
        setPrincipalFromName("");
        setPrincipalTo([{ prin_code: "", prin_name: "" }]);
        setPrincipalToName("");
        setJobFrom([{ job_no: "", job_type: "", job_date: "" }]); setJobFromName("");
        setJobTo([{ job_no: "", job_type: "", job_date: "" }]); setJobToName("");
        setDeptFrom([{ dept_code: "", dept_name: "" }]); setDeptFromName("");
        setDeptTo([{ dept_code: "", dept_name: "" }]); setDeptToName("");
        setJobDate({ from: "", to: "" });
        setConfirmDate({ from: "", to: "" });
        setCancelDate({ from: "", to: "" });
        setClassFrom("Normal"); setClassTo("");
        setJobType("confirmed");
        setReportError(null);
    };
    const ClassSelect = ({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (v: string) => void }) => (
    <div style={{ position: "relative" }}>
        <select value={value} onChange={e => onChange(e.target.value)}
            style={{ width: "100%", height: 32, padding: "0 26px 0 9px", fontSize: 11, border: "0.5px solid #d1d5db", borderRadius: 6, background: "#fff", color: value ? "#111827" : "#9ca3af", outline: "none", appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}>
            <option value="">{placeholder}</option>
            {JOB_CLASS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <span style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", display: "flex", pointerEvents: "none" }}>
            <ChevronDown size={12} />
        </span>
    </div>
);
const buildParams = () => {
  const selectedJobType =
    JOB_TYPES.find((item) => item.key === jobType) ||
    JOB_TYPES.find((item) => item.key === "all")!;

  return {
    loginid: user?.loginid || user?.username || "ADMIN",
    parameter: "WMS_Stock_JOB_LISTING_REPORT",

    code1: user?.company_code || "",

    code2: principalFrom?.map((x) => x.prin_code).join(",") || "All",
    code3: principalTo?.map((x) => x.prin_code).join(",") || "All",

    code4: jobFrom?.map((x) => x.job_no).join(",") || "All",
    code5: jobTo?.map((x) => x.job_no).join(",") || "All",

    code6: deptFrom?.map((x) => x.dept_code).join(",") || "All",
    code7: deptTo?.map((x) => x.dept_code).join(",") || "All",

    code8: formatDate(jobDate.from),
    code9: formatDate(jobDate.to),

    code10: formatDate(confirmDate.from),
    code11: formatDate(confirmDate.to),

    code12: formatDate(cancelDate.from),
    code13: formatDate(cancelDate.to),

    code14: classFrom || "All",
    code15: classTo || "All",

    // These values come from the selected Job Type
    code16: selectedJobType.ls_cancel,
    code17: selectedJobType.ls_confirmed,
    code18: selectedJobType.ls_invoice,

    code20: "RAWSQL",
  };
};
    const handleGenerate = async () => {
        setReportError(null);
        setGenerating(true);
        try {
            console.log("params:", {
                loginid: user?.loginid || user?.username || "ADMIN",
                code1: user?.company_code || "",
                principalFrom, principalTo, jobFrom, jobTo, deptFrom, deptTo,
                jobDateFrom: formatDate(jobDate.from), jobDateTo: formatDate(jobDate.to),
                confirmDateFrom: formatDate(confirmDate.from), confirmDateTo: formatDate(confirmDate.to),
                cancelDateFrom: formatDate(cancelDate.from), cancelDateTo: formatDate(cancelDate.to),
                classFrom, classTo, jobType,
                parameter: "VW_WMS_JOB_LISTING_RPT",
            });
            // TODO: await jobReport(buildParams());
           await jobListingReport(buildParams());
            await new Promise(r => setTimeout(r, 1200));
        } catch (err: any) {
            setReportError("Failed to generate report. Please try again.");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div style={{ background: "#f3f4f6", padding: 12, fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
            <style>{`
                .jtype-btn { padding: 6px 10px; border-radius: 6px; border: 0.5px solid #e5e7eb; background: #f9fafb; cursor: pointer; font-size: 11px; color: #6b7280; text-align: left; display: flex; align-items: center; gap: 6px; width: 100%; transition: all 0.1s; }
                .jtype-btn.active { background: #E6F1FB; border-color: #185FA5; color: #0C447C; font-weight: 500; }
                .jtype-btn:hover:not(.active) { background: #fff; border-color: #d1d5db; }
                .abtn { height: 32px; padding: 0 14px; border: 0.5px solid #d1d5db; background: #fff; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; border-radius: 6px; color: #374151; }
                .abtn:hover { background: #f9fafb; }
                .abtn-p { height: 32px; padding: 0 16px; border: 0.5px solid #185FA5; background: #185FA5; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; border-radius: 6px; color: #fff; font-weight: 500; }
                .abtn-p:hover { background: #0C447C; border-color: #0C447C; }
                .abtn-p:disabled { background: #93c5fd !important; border-color: #93c5fd !important; cursor: not-allowed; }
                input[type="date"]:focus, input:focus { border-color: #185FA5 !important; box-shadow: 0 0 0 2px rgba(24,95,165,0.10); }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>

            <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12 }}>

                {/* header */}
                <div style={{ padding: "10px 16px", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 500, color: "#111827" }}>
                        <span style={{ color: "#185FA5", fontSize: 15 }}>⚙</span> Job report filter
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 10px", borderRadius: 20, background: "#E6F1FB", color: "#0C447C" }}>
                        {JOB_TYPES.find(t => t.key === jobType)?.label}
                    </span>
                </div>

                <div style={{ padding: "14px 16px 0" }}>

                    {/* row 1 — principal from / to / job from / job to */}
                    {secLabel("Principal & Job")}
                    <div style={G4}>
                        <div>
                            
                             <div style={{ position: "relative" }}>
                                    <span style={{ position: "absolute", top: -8, left: 10, fontSize: 11, color: "#6b7280", background: "#fff", padding: "0 4px", zIndex: 1 }}>
                                        Principal From
                                    </span>
                                    <LookupField
                                        label=""
                                        value={principalFrom[0]?.prin_code || ""}
                                        displayValue={principalFrom[0]?.prin_name || ""}
                                        columns={[{ field: "prin_code", header: "Code" }, { field: "prin_name", header: "Name" }]}
                                        valueField="prin_code"
                                        displayFields={["prin_code", "prin_name"]}
                                        loadOptions={() => getDynamicLookupaccount({
                                            parameter: "WMS_Stock_principal",
                                            code1: user?.company_code,
                                            loginid: user?.loginid || user?.username || "ADMIN",
                                        })}
                                        onChange={(val) => setPrincipalFrom([{ prin_code: val, prin_name: "" }])}
                                    />
                                </div>
                        </div>
                           <div>
                            
                             <div style={{ position: "relative" }}>
                                    <span style={{ position: "absolute", top: -8, left: 10, fontSize: 11, color: "#6b7280", background: "#fff", padding: "0 4px", zIndex: 1 }}>
                                        Principal To
                                    </span>
                                    <LookupField
                                        label=""
                                        value={principalTo[0]?.prin_code || ""}
                                        displayValue={principalTo[0]?.prin_name || ""}
                                        columns={[{ field: "prin_code", header: "Code" }, { field: "prin_name", header: "Name" }]}
                                        valueField="prin_code"
                                        displayFields={["prin_code", "prin_name"]}
                                        loadOptions={() => getDynamicLookupaccount({
                                            parameter: "WMS_Stock_principal",
                                            code1: user?.company_code,
                                            loginid: user?.loginid || user?.username || "ADMIN",
                                        })}
                                        onChange={(val) => setPrincipalTo([{ prin_code: val, prin_name: "" }])}
                                    />
                                </div>
                        </div>
                        <div>
   <div style={{ position: "relative" }}>
                                    <span style={{ position: "absolute", top: -8, left: 10, fontSize: 11, color: "#6b7280", background: "#fff", padding: "0 4px", zIndex: 1 }}>
                                        Job From
                                    </span>
                                    <LookupField
                                        label=""
                                        value={jobFrom[0]?.job_no || ""}
                                        displayValue={jobFrom[0]?.job_no || ""}
                                        columns={[{ field: "job_no", header: "Code" }, { field: "job_type", header: "Type" },{ field: "job_date", header: "Date" }]}
                                        valueField="job_no"
                                        displayFields={["job_no", "job_type", "job_date"]}
                                        loadOptions={() => getDynamicLookupaccount({
                                            parameter: "WMS_Stock_Job_transfer_report",
                                            code1: user?.company_code,
                                            loginid: user?.loginid || user?.username || "ADMIN",
                                        })}
                                        onChange={(val) => setJobFrom([{ job_no: val, job_type: "", job_date: "" }])}
                                    />
                                </div>
                        </div>
                        <div>
                              <div style={{ position: "relative" }}>
                                    <span style={{ position: "absolute", top: -8, left: 10, fontSize: 11, color: "#6b7280", background: "#fff", padding: "0 4px", zIndex: 1 }}>
                                        Job To
                                    </span>
                                    <LookupField
                                        label=""
                                        value={jobTo[0]?.job_no || ""}
                                        displayValue={jobTo[0]?.job_no || ""}
                                        columns={[{ field: "job_no", header: "Code" }, { field: "job_type", header: "Type" },{ field: "job_date", header: "Date" }]}
                                        valueField="job_no"
                                        displayFields={["job_no", "job_type", "job_date"]}
                                        loadOptions={() => getDynamicLookupaccount({
                                            parameter: "WMS_Stock_Job_transfer_report",
                                            code1: user?.company_code,
                                            loginid: user?.loginid || user?.username || "ADMIN",
                                        })}
                                        onChange={(val) => setJobTo([{ job_no: val, job_type: "", job_date: "" }])}
                                    />
                                </div>
                        </div>
                    </div>

                    <div style={divStyle} />

                    {/* row 2 — dept from / dept to / class from / class to */}
                    {secLabel("Department & Class")}
                    <div style={G4}>
                        <div>
                            <LookupField
                                        label=""
                                        value={deptFrom[0]?.dept_code || ""}
                                        displayValue={deptFrom[0]?.dept_name || ""}
                                        columns={[{ field: "dept_code", header: "Code" }, { field: "dept_name", header: "Name" }]}
                                        valueField="dept_code"
                                        displayFields={["dept_code", "dept_name"]}
                                        loadOptions={() => getDynamicLookupaccount({
                                            parameter: "WMS_Stock_department",
                                            code1: user?.company_code,
                                            loginid: user?.loginid || user?.username || "ADMIN",
                                        })}
                                        onChange={(val) => setDeptFrom([{ dept_code: val, dept_name: "" }])}
                                    />
                        </div>
                        <div>
                           <LookupField
                                        label=""
                                        value={deptTo[0]?.dept_code || ""}
                                        displayValue={deptTo[0]?.dept_name || ""}
                                        columns={[{ field: "dept_code", header: "Code" }, { field: "dept_name", header: "Name" }]}
                                        valueField="dept_code"
                                        displayFields={["dept_code", "dept_name"]}
                                        loadOptions={() => getDynamicLookupaccount({
                                            parameter: "WMS_Stock_department",
                                            code1: user?.company_code,
                                            loginid: user?.loginid || user?.username || "ADMIN",
                                        })}
                                        onChange={(val) => setDeptTo([{ dept_code: val, dept_name: "" }])}
                                    />
                        </div>
                        <div>
                            <FL>Job class from</FL>
                            <ClassSelect value={classFrom} placeholder="All classes" onChange={setClassFrom} />
                        </div>
                        <div>
                            <FL>Job class to</FL>
                            <ClassSelect value={classTo} placeholder="All classes" onChange={setClassTo} />
                        </div>
                    </div>

                    <div style={divStyle} />

                    {/* row 3 — job date / confirm date / cancel date */}
                    {secLabel("Dates")}
                    <div style={G3}>
                        <DatePair label="Job date" range={jobDate} onChange={setJobDate} />
                        <DatePair label="Confirm date" range={confirmDate} onChange={setConfirmDate} />
                        <DatePair label="Cancel date" range={cancelDate} onChange={setCancelDate} />
                    </div>

                    <div style={divStyle} />

                    {/* row 4 — job type */}
                    {secLabel("Job type")}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 14 }}>
                        {JOB_TYPES.map(({ key, label }) => (
                            <button key={key} className={`jtype-btn${jobType === key ? " active" : ""}`}
                                onClick={() => { setJobType(key); setReportError(null); }}>
                                <span style={{ lineHeight: 1.3 }}>{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* error */}
                    {reportError && (
                        <div style={{ margin: "0 0 10px", padding: "7px 12px", background: "#fef2f2", border: "0.5px solid #fca5a5", borderRadius: 6, fontSize: 12, color: "#b91c1c", display: "flex", alignItems: "center", gap: 8 }}>
                            ⚠ {reportError}
                        </div>
                    )}

                    {/* sticky action bar */}
                    <div style={{ position: "sticky", bottom: 0, zIndex: 10, display: "flex", justifyContent: "flex-end", gap: 8, padding: "10px 16px", margin: "0 -16px", borderTop: "0.5px solid #e5e7eb", background: "#fff" }}>
                        <button className="abtn" onClick={handleReset}><RotateCcw size={12} /> Reset</button>
                        <button className="abtn"><Download size={12} /> Export</button>
                        <div style={{ width: "0.5px", background: "#e5e7eb", alignSelf: "stretch" }} />
                        <button className="abtn-p" disabled={generating} onClick={handleGenerate}>
                            {generating
                                ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Generating...</>
                                : <><Printer size={12} /> Generate report</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}