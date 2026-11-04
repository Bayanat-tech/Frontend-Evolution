import React, { useEffect, useState } from "react";
import {
  Mail,
  Clock,
  Plus,
  Trash2,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings,
  Shield,
  Users,
  GitBranch,
  Layers,
  Sliders,
  Check,
  FileText,
  ShieldCheck,
  Landmark,
  Ship,
  Lock,
  Truck,
  Warehouse,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { api } from "../../api/client";
import { useAuth } from "../../state/AuthContext";

interface CCConfig {
  CONFIG_ID: string;
  COMPANY_CODE: string;
  TEAM_CODE: string;
  CC_EMAIL: string;
  CREATED_BY: string;
  CREATED_DT: string;
}

interface DailyReportConfig {
  SEND_TIME: string;
  RECIPIENT_EMAILS: string;
  LAST_SENT_DATE?: string | null;
}

interface WorkflowRole {
  role_id: string;
  role_name: string;
}

interface MasterStage {
  level: number;
  task_type: string;
  title: string;
  subtitle: string;
  defaultRole: string;
}

const STAGE_ICONS: Record<number, React.ReactNode> = {
  1: <FileText className="h-4 w-4" />,
  2: <ShieldCheck className="h-4 w-4" />,
  3: <Landmark className="h-4 w-4" />,
  4: <Ship className="h-4 w-4" />,
  5: <Lock className="h-4 w-4" />,
  6: <Truck className="h-4 w-4" />,
  7: <Warehouse className="h-4 w-4" />,
};

const TEAMS = [
  { code: "ALL", label: "All Teams (Global CC)" },
  { code: "FFD_TEAM", label: "FFD Review & Verification" },
  { code: "PRO_TEAM", label: "PRO Ministry & Permits" },
  { code: "BAYAN_TEAM", label: "Customs Bayan & Duty" },
  { code: "SHIPPING_LINE", label: "Shipping Line DO" },
  { code: "ROP_PORT_POLICE", label: "CCRO & Port Police" },
  { code: "TRANSPORT_FLEET", label: "Transport & Trucking" },
  { code: "DC_WAREHOUSE", label: "DC Warehouse & Yard" },
];

export const FreightTrackerSettingsDialog: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { user } = useAuth();
  const companyCode = (user as any)?.company_code || "BSG";

  const [activeTab, setActiveTab] = useState<"workflow" | "cc" | "daily">("workflow");
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // CC Alert Configuration
  const [ccList, setCcList] = useState<CCConfig[]>([]);
  const [newTeam, setNewTeam] = useState("ALL");
  const [newEmail, setNewEmail] = useState("");
  const [addingCC, setAddingCC] = useState(false);

  // Daily Report Configuration
  const [sendTime, setSendTime] = useState("17:30");
  const [recipients, setRecipients] = useState("");
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [savingDaily, setSavingDaily] = useState(false);
  const [triggering, setTriggering] = useState(false);

  // Workflow & Levels Designer Configuration
  const [selectedFlow, setSelectedFlow] = useState<string>("NORM");
  const [lastLevel, setLastLevel] = useState<number>(7);
  const [levelRoles, setLevelRoles] = useState<Record<number, string>>({
    1: "FFD_TEAM",
    2: "PRO_TEAM",
    3: "BAYAN_TEAM",
    4: "SHIPPING_LINE",
    5: "ROP_PORT_POLICE",
    6: "TRANSPORT_FLEET",
    7: "DC_WAREHOUSE",
  });
  const [availableRoles, setAvailableRoles] = useState<WorkflowRole[]>([]);
  const [masterStages, setMasterStages] = useState<MasterStage[]>([]);
  const [savingWorkflow, setSavingWorkflow] = useState(false);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const [ccRes, repRes, wfRes] = await Promise.all([
        api.post("/api/freight/tracker/admin/cc-configs/list", { company_code: companyCode }),
        api.post("/api/freight/tracker/admin/daily-report/get", { company_code: companyCode }),
        api.post("/api/freight/tracker/admin/workflow-config/get", { company_code: companyCode, flow_code: selectedFlow }),
      ]);

      if (ccRes.data?.success) {
        setCcList(ccRes.data.data || []);
      }
      if (repRes.data?.success && repRes.data.data) {
        setSendTime(repRes.data.data.SEND_TIME || "17:30");
        setRecipients(repRes.data.data.RECIPIENT_EMAILS || "");
        setLastSent(repRes.data.data.LAST_SENT_DATE || null);
      }
      if (wfRes.data?.success && wfRes.data.data) {
        const d = wfRes.data.data;
        if (d.available_roles) setAvailableRoles(d.available_roles);
        if (d.master_stages) setMasterStages(d.master_stages);

        const currentConfig = (d.configurations || []).find((c: any) => c.FLOW_CODE === selectedFlow) ||
          d.configurations?.[0];

        if (currentConfig) {
          setLastLevel(Number(currentConfig.LAST_LEVEL) || 7);
          setLevelRoles({
            1: currentConfig.LEVEL1_ROLE || "FFD_TEAM",
            2: currentConfig.LEVEL2_ROLE || "PRO_TEAM",
            3: currentConfig.LEVEL3_ROLE || "BAYAN_TEAM",
            4: currentConfig.LEVEL4_ROLE || "SHIPPING_LINE",
            5: currentConfig.LEVEL5_ROLE || "ROP_PORT_POLICE",
            6: currentConfig.LEVEL6_ROLE || "TRANSPORT_FLEET",
            7: currentConfig.LEVEL7_ROLE || "DC_WAREHOUSE",
          });
        }
      }
    } catch (err) {
      console.error("Failed to load settings", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchConfigs();
    }
  }, [open, selectedFlow]);

  // Handle Workflow Save
  const handleSaveWorkflow = async () => {
    try {
      setSavingWorkflow(true);
      const res = await api.post("/api/freight/tracker/admin/workflow-config/save", {
        company_code: companyCode,
        flow_code: selectedFlow,
        last_level: lastLevel,
        level1_role: levelRoles[1] || "FFD_TEAM",
        level2_role: levelRoles[2] || "PRO_TEAM",
        level3_role: levelRoles[3] || "BAYAN_TEAM",
        level4_role: levelRoles[4] || "SHIPPING_LINE",
        level5_role: levelRoles[5] || "ROP_PORT_POLICE",
        level6_role: levelRoles[6] || "TRANSPORT_FLEET",
        level7_role: levelRoles[7] || "DC_WAREHOUSE",
      });

      if (res.data?.success) {
        showToast(res.data.message || "Dynamic workflow configuration saved successfully!");
        await fetchConfigs();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to save workflow configuration", "error");
    } finally {
      setSavingWorkflow(false);
    }
  };

  const handleAddCC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.includes("@")) {
      showToast("Please enter a valid email address", "error");
      return;
    }
    try {
      setAddingCC(true);
      const res = await api.post("/api/freight/tracker/admin/cc-configs/save", {
        company_code: companyCode,
        team_code: newTeam,
        cc_email: newEmail.trim(),
        user_id: user?.loginid || "ADMIN",
      });
      if (res.data?.success) {
        showToast("CC email added successfully");
        setNewEmail("");
        await fetchConfigs();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message, "error");
    } finally {
      setAddingCC(false);
    }
  };

  const handleDeleteCC = async (configId: string) => {
    try {
      await api.post("/api/freight/tracker/admin/cc-configs/delete", {
        company_code: companyCode,
        config_id: configId,
      });
      showToast("CC configuration deleted");
      await fetchConfigs();
    } catch (err: any) {
      showToast("Failed to delete CC config", "error");
    }
  };

  const handleSaveDaily = async () => {
    try {
      setSavingDaily(true);
      await api.post("/api/freight/tracker/admin/daily-report/save", {
        company_code: companyCode,
        send_time: sendTime,
        recipient_emails: recipients,
        user_id: user?.loginid || "ADMIN",
      });
      showToast("Daily report settings saved successfully");
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to save daily report settings", "error");
    } finally {
      setSavingDaily(false);
    }
  };

  const handleTriggerDaily = async () => {
    try {
      setTriggering(true);
      const res = await api.post("/api/freight/tracker/admin/daily-report/trigger", {
        company_code: companyCode,
      });
      showToast(res.data?.message || "Daily report dispatched successfully!");
      await fetchConfigs();
    } catch (err: any) {
      showToast("Failed to dispatch daily report", "error");
    } finally {
      setTriggering(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 text-white shadow-md shadow-blue-500/20">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Freight Workflow & Administration
                </h3>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {companyCode}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure dynamic workflow stages, assigned teams, automated CC alerts, and daily digests
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toast alert */}
        {toastMsg && (
          <div
            className={`mx-5 mt-3 flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
              toastMsg.type === "success"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
            }`}
          >
            {toastMsg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{toastMsg.text}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-5 text-xs font-semibold dark:border-slate-800">
          <button
            onClick={() => setActiveTab("workflow")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 transition ${
              activeTab === "workflow"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <GitBranch className="h-4 w-4" />
            Dynamic Workflow & Levels Designer
          </button>
          <button
            onClick={() => setActiveTab("cc")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 transition ${
              activeTab === "cc"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Users className="h-4 w-4" />
            Team CC Alert Recipients ({ccList.length})
          </button>
          <button
            onClick={() => setActiveTab("daily")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 transition ${
              activeTab === "daily"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Clock className="h-4 w-4" />
            Daily Operations Digest
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB 1: WORKFLOW & LEVELS DESIGNER */}
          {activeTab === "workflow" && (
            <div className="space-y-6">
              {/* Flow Selector & Level Slider Header */}
              <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/40 p-4 dark:border-blue-900/30 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      Company Workflow Profile: {companyCode}
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                      Configure how many operational stages are enforced and which team executes each stage.
                    </p>
                  </div>

                  {/* Flow Type selector */}
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
                    {[
                      { code: "NORM", label: "Ocean Import" },
                      { code: "AIR", label: "Air Freight" },
                      { code: "EXP", label: "Export" },
                      { code: "CFS", label: "CFS Transfer" },
                    ].map((f) => (
                      <button
                        key={f.code}
                        type="button"
                        onClick={() => setSelectedFlow(f.code)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          selectedFlow === f.code
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Level selector */}
                <div className="mt-4 border-t border-blue-100/60 pt-4 dark:border-slate-700/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Active Operational Stages: <span className="text-blue-600 dark:text-blue-400">{lastLevel} Stages Active</span>
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lastLevel === 3 && "Fast-track documentation & Bayan clearance"}
                      {lastLevel === 4 && "Ocean port clearance & Delivery Order collection"}
                      {lastLevel === 5 && "Full port clearance with CCRO / Port Police seal release"}
                      {lastLevel === 6 && "Port clearance + Inland transport dispatch"}
                      {lastLevel === 7 && "Complete End-to-End Freight ERP (through warehouse offload)"}
                    </span>
                  </div>

                  {/* Stage level buttons */}
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { lvl: 3, label: "3 Stages", desc: "Fast-Track" },
                      { lvl: 4, label: "4 Stages", desc: "Port Clearance" },
                      { lvl: 5, label: "5 Stages", desc: "Port & Police" },
                      { lvl: 6, label: "6 Stages", desc: "Door Delivery" },
                      { lvl: 7, label: "7 Stages", desc: "Full Freight ERP" },
                    ].map((btn) => (
                      <button
                        key={btn.lvl}
                        type="button"
                        onClick={() => setLastLevel(btn.lvl)}
                        className={`flex flex-col items-center justify-center rounded-xl border p-2.5 transition text-center ${
                          lastLevel === btn.lvl
                            ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-500/20"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        <span className="text-xs font-bold">{btn.label}</span>
                        <span className={`text-[10px] ${lastLevel === btn.lvl ? "text-blue-100" : "text-slate-400"}`}>
                          {btn.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stage Mapping Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Stage-by-Stage Roles & Department Assignment
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Stages 1 to {lastLevel} are active. Stages {lastLevel + 1} to 7 are bypassed for this flow profile.
                  </span>
                </div>

                <div className="space-y-2.5">
                  {(masterStages.length > 0 ? masterStages : [
                    { level: 1, task_type: "FFD_REVIEW", title: "FFD Review", subtitle: "B/L & ETA Verification", defaultRole: "FFD_TEAM" },
                    { level: 2, task_type: "PRO_PERMITS", title: "PRO Permits", subtitle: "Ministry Inspection & Permits", defaultRole: "PRO_TEAM" },
                    { level: 3, task_type: "CUSTOMS_BAYAN", title: "Customs Bayan", subtitle: "Bayan Declaration & Duty", defaultRole: "BAYAN_TEAM" },
                    { level: 4, task_type: "SHIPPING_LINE_DO", title: "Delivery Order (DO)", subtitle: "Shipping Line DO & Validity", defaultRole: "SHIPPING_LINE" },
                    { level: 5, task_type: "CCRO", title: "CCRO / Port Police", subtitle: "Customs & Port Police Clearance", defaultRole: "ROP_PORT_POLICE" },
                    { level: 6, task_type: "TRANSPORT", title: "Transport Dispatch", subtitle: "Fleet & Truck Allocation", defaultRole: "TRANSPORT_FLEET" },
                    { level: 7, task_type: "DC_OFFLOAD", title: "DC Offloading", subtitle: "Warehouse Gate & Offloading", defaultRole: "DC_WAREHOUSE" },
                  ]).map((stg) => {
                    const isActive = stg.level <= lastLevel;
                    return (
                      <div
                        key={stg.level}
                        className={`flex items-center justify-between gap-4 rounded-xl border p-3 transition ${
                          isActive
                            ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800/60 shadow-sm"
                            : "border-dashed border-slate-200 bg-slate-50/50 opacity-50 dark:border-slate-800 dark:bg-slate-900/30"
                        }`}
                      >
                        {/* Stage Identity */}
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                              isActive
                                ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
                                : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                            }`}
                          >
                            {STAGE_ICONS[stg.level] || <Check className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                L{stg.level}
                              </span>
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {stg.title}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {stg.subtitle}
                            </span>
                          </div>
                        </div>

                        {/* Status Tag */}
                        <div className="hidden sm:block">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              Mandatory Stage
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Bypassed in {lastLevel}-Stage Flow
                            </span>
                          )}
                        </div>

                        {/* Assigned Role Dropdown */}
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Role:
                          </label>
                          <select
                            disabled={!isActive}
                            value={levelRoles[stg.level] || stg.defaultRole}
                            onChange={(e) =>
                              setLevelRoles((prev) => ({ ...prev, [stg.level]: e.target.value }))
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:disabled:bg-slate-800/40"
                          >
                            {(availableRoles.length > 0 ? availableRoles : [
                              { role_id: "FFD_TEAM", role_name: "FFD Team" },
                              { role_id: "PRO_TEAM", role_name: "PRO Team" },
                              { role_id: "BAYAN_TEAM", role_name: "Bayan Team" },
                              { role_id: "SHIPPING_LINE", role_name: "Shipping Line" },
                              { role_id: "ROP_PORT_POLICE", role_name: "ROP Port Police" },
                              { role_id: "TRANSPORT_FLEET", role_name: "Transport Fleet" },
                              { role_id: "DC_WAREHOUSE", role_name: "DC Warehouse" },
                              { role_id: "FINANCE", role_name: "Finance & Accounts" },
                              { role_id: "OPS_MANAGER", role_name: "Operations Manager" },
                              { role_id: "CUSTOMER_SERVICE", role_name: "Customer Service" },
                            ]).map((r) => (
                              <option key={r.role_id} value={r.role_id}>
                                {r.role_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setLastLevel(7);
                    setLevelRoles({
                      1: "FFD_TEAM",
                      2: "PRO_TEAM",
                      3: "BAYAN_TEAM",
                      4: "SHIPPING_LINE",
                      5: "ROP_PORT_POLICE",
                      6: "TRANSPORT_FLEET",
                      7: "DC_WAREHOUSE",
                    });
                  }}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Reset to 7-Stage Standard
                </button>

                <button
                  type="button"
                  onClick={handleSaveWorkflow}
                  disabled={savingWorkflow}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingWorkflow ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Save & Apply Company Workflow ({lastLevel} Stages)
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: TEAM CC CONFIGURATION */}
          {activeTab === "cc" && (
            <div className="space-y-4">
              <form onSubmit={handleAddCC} className="flex flex-wrap items-end gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="min-w-[180px] flex-1">
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Target Team / Milestone
                  </label>
                  <select
                    value={newTeam}
                    onChange={(e) => setNewTeam(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {TEAMS.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-[240px] flex-2">
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    CC Email Address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. logistics.lead@bayanat.om"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={addingCC || !newEmail}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {addingCC ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add Recipient
                </button>
              </form>

              {/* Configured CC List */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  Configured CC Notifications
                </div>
                {ccList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No CC rules configured yet. Standard transactional recipients will receive updates.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {ccList.map((cc) => (
                      <div key={cc.CONFIG_ID} className="flex items-center justify-between p-3 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="rounded bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            {TEAMS.find((t) => t.code === cc.TEAM_CODE)?.label || cc.TEAM_CODE}
                          </span>
                          <span className="font-mono text-slate-700 dark:text-slate-200">{cc.CC_EMAIL}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteCC(cc.CONFIG_ID)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DAILY OPERATIONS DIGEST */}
          {activeTab === "daily" && (
            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <h4 className="font-bold text-slate-800 dark:text-slate-200">
                  Automated Daily Ops Digest Email
                </h4>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  Every evening, the Freight Tracker scheduler scans active shipments, checks D/O expiration countdowns, identifies jobs on hold, and sends an executive summary to key stakeholders.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    Scheduled Send Time (Muscat Time)
                  </label>
                  <input
                    type="time"
                    value={sendTime}
                    onChange={(e) => setSendTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    Recipient Email Addresses (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    placeholder="e.g. manager@bayanat.om, logistics@bayanat.om"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {lastSent && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  <strong>Last Sent:</strong> {lastSent}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleTriggerDaily}
                  disabled={triggering}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {triggering ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <Send className="h-4 w-4 text-blue-600" />}
                  Trigger / Send Report Now
                </button>

                <button
                  type="button"
                  onClick={handleSaveDaily}
                  disabled={savingDaily}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingDaily && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Schedule & Recipients
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-100 p-4 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
