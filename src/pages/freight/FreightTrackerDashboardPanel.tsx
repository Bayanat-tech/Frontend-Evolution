import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  Landmark,
  Layers,
  Loader2,
  Lock,
  PackageCheck,
  Plane,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Ship,
  Sparkles,
  Truck,
  Warehouse,
} from "lucide-react";
import { api } from "../../api/client";
import { FreightNotificationDrawer } from "./FreightNotificationDrawer";
import { useAuth } from "../../state/AuthContext";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TrackerDashboardData {
  summary: {
    activeShipments: number;
    completedShipments: number;
    activeHolds: number;
    totalContainers: number;
    offloadedContainers: number;
    doExpiringCount: number;
  };
  stageCounts: {
    CUSTOMER: number;
    FFD_REVIEW: number;
    IN_PROGRESS: number;
    TRANSPORT: number;
    DC_TRANSPORT: number;
    COMPLETED: number;
  };
  taskPipeline: Record<string, { active: number; on_hold: number; completed: number }>;
  activeHolds: Array<{
    JOB_NO: string;
    PRIN_CODE: string;
    BL_NUMBER: string | null;
    CUST_CODE: string | null;
    CUST_NAME: string | null;
    TASK_TYPE: string;
    HOLD_ENTITY: string | null;
    HOLD_REASON: string | null;
    HOLD_REMARK: string | null;
    HELD_AT: string;
    HELD_HOURS: number;
  }>;
  containerCounts: {
    PENDING: number;
    ASSIGNED: number;
    IN_TRANSIT: number;
    BREAKDOWN: number;
    AT_DC: number;
    OFFLOADED: number;
    RETURNED: number;
  };
  doRadar: Array<{
    JOB_NO: string;
    PRIN_CODE: string;
    BL_NUMBER: string | null;
    DO_VALIDITY_DATE: string;
    DAYS_REMAINING: number;
    VESSEL_NAME: string | null;
    PORT_CODE: string | null;
    DESTINATION_PORT: string | null;
    CUST_NAME: string | null;
  }>;
  recentActivity: Array<{
    EVENT_ID: string;
    JOB_NO: string;
    EVENT_TYPE: string;
    STAGE_FROM: string | null;
    STAGE_TO: string | null;
    ACTOR_ID: string;
    REMARK: string | null;
    CREATED_DT: string;
  }>;
}

const STAGES_CONFIG = [
  { key: "CUSTOMER", label: "Customer Upload", icon: FileText, color: "border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300" },
  { key: "FFD_REVIEW", label: "FFD Review", icon: FileCheck, color: "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300" },
  { key: "IN_PROGRESS", label: "Clearance In Progress", icon: Sparkles, color: "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300" },
  { key: "TRANSPORT", label: "Transport Dispatch", icon: Truck, color: "border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300" },
  { key: "DC_TRANSPORT", label: "DC Offloading", icon: Warehouse, color: "border-teal-500 bg-teal-50/50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-300" },
  { key: "COMPLETED", label: "Completed", icon: CheckCircle2, color: "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300" },
];

export function FreightTrackerDashboardPanel({ onSelectJob }: { onSelectJob?: (jobNo: string) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");

  const [data, setData] = useState<TrackerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post<{ success: boolean; data: TrackerDashboardData }>("/api/freight/tracker/dashboard", {
        company_code: companyCode,
      });
      if (res.data.success) {
        setData(res.data.data);
      } else {
        setError("Failed to load Tracker dashboard data.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load Tracker dashboard.");
    } finally {
      setLoading(false);
    }
  }, [companyCode]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const handleOpenJob = (jobNo: string) => {
    if (onSelectJob) {
      onSelectJob(jobNo);
    } else {
      navigate(`/workspace/freight-sea-import?open=${encodeURIComponent(jobNo)}`);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-sm font-medium">Loading Live Shipment Tracker Operations...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto my-12 max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-600" />
        <p className="font-semibold">{error}</p>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try Again
        </button>
      </div>
    );
  }

  const summary = data?.summary || {
    activeShipments: 0,
    completedShipments: 0,
    activeHolds: 0,
    totalContainers: 0,
    offloadedContainers: 0,
    doExpiringCount: 0,
  };

  const stageCounts = data?.stageCounts || {
    CUSTOMER: 0,
    FFD_REVIEW: 0,
    IN_PROGRESS: 0,
    TRANSPORT: 0,
    DC_TRANSPORT: 0,
    COMPLETED: 0,
  };

  const taskPipeline = data?.taskPipeline || {};
  const activeHolds = data?.activeHolds || [];
  const containerCounts = data?.containerCounts || {
    PENDING: 0,
    ASSIGNED: 0,
    IN_TRANSIT: 0,
    BREAKDOWN: 0,
    AT_DC: 0,
    OFFLOADED: 0,
    RETURNED: 0,
  };
  const doRadar = data?.doRadar || [];
  const recentActivity = data?.recentActivity || [];

  return (
    <div className="space-y-6 p-4">
      {/* ── Top Header / Quick Action ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
          <FreightNotificationDrawer onSelectJob={onSelectJob} />
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Shipment Tracker Command Center
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time multi-level operations: Customs Bayan, MOAF Permits, Shipping Line DOs & DC Offloading
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── 1. Top KPI Metrics Strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* Active Shipments */}
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-white p-4 shadow-sm dark:border-blue-900/30 dark:from-blue-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Active Shipments</span>
            <Ship className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{summary.activeShipments}</span>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">In Pipeline</span>
          </div>
        </div>

        {/* Containers Pipeline */}
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-4 shadow-sm dark:border-indigo-900/30 dark:from-indigo-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Containers</span>
            <Boxes className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{summary.totalContainers}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {summary.offloadedContainers} offloaded
            </span>
          </div>
        </div>

        {/* Active Holds */}
        <div
          className={`rounded-xl border p-4 shadow-sm transition ${
            summary.activeHolds > 0
              ? "border-red-200 bg-red-50/80 dark:border-red-900/40 dark:bg-red-950/20"
              : "border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${summary.activeHolds > 0 ? "text-red-700 dark:text-red-300" : "text-slate-600 dark:text-slate-400"}`}>
              Active Holds
            </span>
            <ShieldAlert className={`h-4 w-4 ${summary.activeHolds > 0 ? "text-red-600 dark:text-red-400 animate-pulse" : "text-slate-400"}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${summary.activeHolds > 0 ? "text-red-700 dark:text-red-400" : "text-slate-900 dark:text-slate-100"}`}>
              {summary.activeHolds}
            </span>
            <span className="text-[11px] text-slate-500">
              {summary.activeHolds > 0 ? "Requires action" : "Clear"}
            </span>
          </div>
        </div>

        {/* DO Expiry Alert Radar */}
        <div
          className={`rounded-xl border p-4 shadow-sm transition ${
            summary.doExpiringCount > 0
              ? "border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20"
              : "border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${summary.doExpiringCount > 0 ? "text-amber-800 dark:text-amber-300" : "text-slate-600 dark:text-slate-400"}`}>
              DO Expiry Radar
            </span>
            <Clock className={`h-4 w-4 ${summary.doExpiringCount > 0 ? "text-amber-600 dark:text-amber-400 animate-bounce" : "text-slate-400"}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${summary.doExpiringCount > 0 ? "text-amber-700 dark:text-amber-400" : "text-slate-900 dark:text-slate-100"}`}>
              {summary.doExpiringCount}
            </span>
            <span className="text-[11px] text-slate-500">≤ 3 days left</span>
          </div>
        </div>

        {/* Container Breakdowns */}
        <div
          className={`rounded-xl border p-4 shadow-sm ${
            containerCounts.BREAKDOWN > 0
              ? "border-red-300 bg-red-100/50 dark:border-red-800 dark:bg-red-950/40"
              : "border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Breakdowns</span>
            <AlertOctagon className={`h-4 w-4 ${containerCounts.BREAKDOWN > 0 ? "text-red-600 animate-pulse" : "text-slate-400"}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{containerCounts.BREAKDOWN}</span>
            <span className="text-[11px] text-slate-500">Fleet status</span>
          </div>
        </div>

        {/* Completed Shipments */}
        <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-4 shadow-sm dark:border-emerald-900/30 dark:from-emerald-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{summary.completedShipments}</span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Delivered</span>
          </div>
        </div>
      </div>

      {/* ── 2. Interactive Pipeline Stage Funnel ─────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Live Stage Funnel</h2>
          </div>
          <span className="text-xs text-slate-500">End-to-End Milestone Flow</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STAGES_CONFIG.map((stage, idx) => {
            const count = stageCounts[stage.key as keyof typeof stageCounts] || 0;
            const Icon = stage.icon;
            return (
              <div
                key={stage.key}
                className={`relative flex flex-col justify-between rounded-xl border p-3.5 transition hover:shadow-md ${stage.color}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Step {idx + 1}
                  </span>
                  <Icon className="h-4 w-4 opacity-75" />
                </div>
                <div className="my-2">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{stage.label}</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{count}</div>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {stage.key === "IN_PROGRESS" ? "Parallel clearance" : "Active jobs"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Clearance In-Progress Breakdown (Permit, Bayan, DO, CCRO) */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Clearance In-Progress Breakdown (Parallel Level Sub-tasks):
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { type: "FFD_REVIEW", label: "FFD Review", icon: FileText },
              { type: "PERMIT", label: "PRO Ministry Permits", icon: ShieldCheck },
              { type: "BAYAN", label: "Customs Bayan", icon: Landmark },
              { type: "DO", label: "Shipping Line DO", icon: Ship },
            ].map((sub) => {
              const taskInfo = taskPipeline[sub.type] || { active: 0, on_hold: 0, completed: 0 };
              const SubIcon = sub.icon;
              return (
                <div
                  key={sub.type}
                  className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/50"
                >
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <SubIcon className="h-3.5 w-3.5 text-slate-500" />
                      {sub.label}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {taskInfo.active + taskInfo.on_hold} open
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px]">
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-semibold">
                      {taskInfo.active} active
                    </span>
                    {taskInfo.on_hold > 0 && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-semibold">
                        {taskInfo.on_hold} on hold
                      </span>
                    )}
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold">
                      {taskInfo.completed} done
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 3. Active Holds Radar & DO Expiry Radar (Two Column Grid) ────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Active Holds Radar */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Active Holds Radar</h2>
            </div>
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-950/60 dark:text-red-400">
              {activeHolds.length} Blocked
            </span>
          </div>

          {activeHolds.length === 0 ? (
            <div className="flex h-44 flex-col items-center justify-center gap-1.5 text-slate-400">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">All shipments moving cleanly!</span>
              <span className="text-[11px] text-slate-400">No active holds recorded from customs, shipping line, or ROP.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 dark:border-slate-800">
                    <th className="pb-2 font-medium">Job / B/L</th>
                    <th className="pb-2 font-medium">Task</th>
                    <th className="pb-2 font-medium">Entity & Reason</th>
                    <th className="pb-2 font-medium text-right">Duration</th>
                    <th className="pb-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeHolds.map((h, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5">
                        <div className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer" onClick={() => handleOpenJob(h.JOB_NO)}>
                          {h.JOB_NO}
                        </div>
                        <div className="text-[11px] text-slate-400">{h.BL_NUMBER || "No BL"}</div>
                      </td>
                      <td className="py-2.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {h.TASK_TYPE}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <div className="font-semibold text-red-600 dark:text-red-400">{h.HOLD_ENTITY || "OTHER"}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[150px]">{h.HOLD_REASON || h.HOLD_REMARK || "On Hold"}</div>
                      </td>
                      <td className="py-2.5 text-right font-medium">
                        <span className={h.HELD_HOURS >= 48 ? "text-red-600 font-bold" : "text-amber-600"}>
                          {h.HELD_HOURS}h
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenJob(h.JOB_NO)}
                          className="rounded bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
                        >
                          Resolve
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* DO Expiry Radar */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Delivery Order (DO) Expiry Radar</h2>
            </div>
            <span className="text-xs text-slate-500">Upcoming Expirations</span>
          </div>

          {doRadar.length === 0 ? (
            <div className="flex h-44 flex-col items-center justify-center gap-1.5 text-slate-400">
              <Ship className="h-7 w-7 text-blue-500" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">No DOs under immediate expiration</span>
              <span className="text-[11px] text-slate-400">All delivery orders have safe validity buffers.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 dark:border-slate-800">
                    <th className="pb-2 font-medium">Job / BL</th>
                    <th className="pb-2 font-medium">Customer / Vessel</th>
                    <th className="pb-2 font-medium">Validity Date</th>
                    <th className="pb-2 font-medium text-right">Days Left</th>
                    <th className="pb-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {doRadar.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5">
                        <div className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer" onClick={() => handleOpenJob(row.JOB_NO)}>
                          {row.JOB_NO}
                        </div>
                        <div className="text-[11px] text-slate-400">{row.BL_NUMBER || "N/A"}</div>
                      </td>
                      <td className="py-2.5">
                        <div className="truncate max-w-[140px] font-medium text-slate-800 dark:text-slate-200">{row.CUST_NAME || "Customer"}</div>
                        <div className="text-[11px] text-slate-400">{row.VESSEL_NAME || "Vessel"}</div>
                      </td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-400">
                        {row.DO_VALIDITY_DATE ? new Date(row.DO_VALIDITY_DATE).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2.5 text-right font-bold">
                        <span className={row.DAYS_REMAINING <= 1 ? "text-red-600 animate-pulse" : row.DAYS_REMAINING <= 3 ? "text-amber-600" : "text-slate-700 dark:text-slate-300"}>
                          {row.DAYS_REMAINING}d
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenJob(row.JOB_NO)}
                          className="rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Container Fleet Pipeline & Real-Time Live Activity ─────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Container Status Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-purple-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Container Execution</h2>
            </div>
            <span className="text-xs text-slate-500">Fleet Pipeline</span>
          </div>

          <div className="space-y-2.5">
            {[
              { label: "Awaiting Truck / Pending", count: containerCounts.PENDING, color: "bg-slate-100 text-slate-700" },
              { label: "Truck Assigned", count: containerCounts.ASSIGNED, color: "bg-blue-100 text-blue-700" },
              { label: "In Transit from Port", count: containerCounts.IN_TRANSIT, color: "bg-purple-100 text-purple-700" },
              { label: "Breakdown Reported", count: containerCounts.BREAKDOWN, color: "bg-red-100 text-red-700" },
              { label: "Arrived at DC Gate", count: containerCounts.AT_DC, color: "bg-amber-100 text-amber-700" },
              { label: "Offloaded at Warehouse", count: containerCounts.OFFLOADED, color: "bg-teal-100 text-teal-700" },
              { label: "Empty Returned to Port", count: containerCounts.RETURNED, color: "bg-emerald-100 text-emerald-700" },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-100 p-2 text-xs dark:border-slate-800">
                <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                <span className={`rounded-full px-2 py-0.5 font-bold ${item.color}`}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Real-Time Live Activity Event Log */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Live Activity Feed</h2>
            </div>
            <span className="text-xs text-slate-500">Recent Operational Events</span>
          </div>

          {recentActivity.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-xs text-slate-400">
              No recent tracking activity recorded yet.
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[340px] pr-1">
              {recentActivity.map((evt, idx) => {
                const isHold = evt.EVENT_TYPE.includes("HOLD");
                const isComplete = evt.EVENT_TYPE.includes("COMPLETED");
                return (
                  <div
                    key={evt.EVENT_ID || idx}
                    className="flex items-start gap-3 rounded-lg border border-slate-100 p-2.5 text-xs transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                  >
                    <div className="mt-0.5">
                      {isHold ? (
                        <ShieldAlert className="h-4 w-4 text-red-500" />
                      ) : isComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Activity className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          Job:{" "}
                          <span className="text-blue-600 hover:underline cursor-pointer" onClick={() => handleOpenJob(evt.JOB_NO)}>
                            {evt.JOB_NO}
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {evt.CREATED_DT ? new Date(evt.CREATED_DT).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                        </span>
                      </div>
                      <p className="mt-0.5 text-slate-600 dark:text-slate-300 font-medium">
                        {evt.REMARK || evt.EVENT_TYPE}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                        <span>By {evt.ACTOR_ID}</span>
                        {evt.STAGE_TO && (
                          <span className="rounded bg-slate-100 px-1 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Stage: {evt.STAGE_TO}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

