import React, { useEffect, useState, useMemo } from "react";
import {
  FileCheck2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  ExternalLink,
  ShieldCheck,
  Building2,
  RefreshCw,
  Loader2,
  Calendar,
  X,
  FileText
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../state/AuthContext";

type ProTaskRow = {
  TASK_ID: string;
  JOB_NO: string;
  PRIN_CODE: string;
  BL_NUMBER: string;
  CUST_CODE: string;
  CUST_NAME?: string;
  FLOW_LEVEL: number;
  TASK_TYPE: string;
  STATUS: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD" | "SKIPPED";
  ASSIGNED_TEAM?: string;
  ASSIGNED_TO?: string;
  HOLD_ENTITY?: string;
  HOLD_REASON?: string;
  HOLD_REMARK?: string;
  RELEASE_REMARK?: string;
  DUE_AT?: string;
  CREATED_DT?: string;
  HOURS_OPEN?: number;
  PERMIT_REF?: string;
  PERMIT_NOT_REQUIRED?: string;
  EXPORT_BAYAN_NO?: string;
  CURRENT_STAGE?: string;
  SHIPMENT_TYPE?: string;
  IS_DRY?: string;
};

export const FreightProQueuePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<ProTaskRow[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Edit / Action modal
  const [selectedTask, setSelectedTask] = useState<ProTaskRow | null>(null);
  const [permitRef, setPermitRef] = useState("");
  const [permitNotReq, setPermitNotReq] = useState(false);
  const [bayanNo, setBayanNo] = useState("");
  const [holdEntity, setHoldEntity] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.post("/api/freight/tracker/pro-queue/list", {
        company_code: (user as any)?.company_code || "BSG",
        task_type: typeFilter,
        status: statusFilter,
      });
      if (res.data?.success) {
        setTasks(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to load PRO tasks", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [typeFilter, statusFilter]);

  const openEditModal = (t: ProTaskRow) => {
    setSelectedTask(t);
    setPermitRef(t.PERMIT_REF || "");
    setPermitNotReq(t.PERMIT_NOT_REQUIRED === "Y");
    setBayanNo(t.EXPORT_BAYAN_NO || "");
    setHoldEntity(t.HOLD_ENTITY || "");
    setHoldReason(t.HOLD_REMARK || t.HOLD_REASON || "");
  };

  const handleSavePermit = async () => {
    if (!selectedTask) return;
    try {
      setActionLoading(true);
      await api.post("/api/freight/tracker/pro-queue/save", {
        company_code: (user as any)?.company_code || "BSG",
        job_no: selectedTask.JOB_NO,
        prin_code: selectedTask.PRIN_CODE,
        permit_ref: permitRef,
        permit_not_required: permitNotReq ? "Y" : "N",
        export_bayan_no: bayanNo,
        user_id: user?.loginid || "PRO_USER",
      });
      setSelectedTask(null);
      await fetchTasks();
    } catch (err: any) {
      alert("Failed to save PRO details: " + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleHold = async (newStatus: "ON_HOLD" | "IN_PROGRESS" | "COMPLETED") => {
    if (!selectedTask) return;
    try {
      setActionLoading(true);
      await api.post("/api/freight/tracker/task/update", {
        task_id: selectedTask.TASK_ID,
        status: newStatus,
        hold_entity: newStatus === "ON_HOLD" ? holdEntity || "MINISTRY_OF_AGRICULTURE" : null,
        hold_reason: newStatus === "ON_HOLD" ? holdReason || "Awaiting inspection approval" : null,
        hold_remark: newStatus === "ON_HOLD" ? holdReason : null,
        release_remark: newStatus === "COMPLETED" ? "Cleared by PRO" : null,
        user_id: user?.loginid || "PRO_USER",
      });
      setSelectedTask(null);
      await fetchTasks();
    } catch (err: any) {
      alert("Failed to update task: " + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        t.JOB_NO?.toLowerCase().includes(q) ||
        t.BL_NUMBER?.toLowerCase().includes(q) ||
        t.CUST_NAME?.toLowerCase().includes(q) ||
        t.TASK_TYPE?.toLowerCase().includes(q) ||
        t.EXPORT_BAYAN_NO?.toLowerCase().includes(q) ||
        t.PERMIT_REF?.toLowerCase().includes(q);
      return matchSearch;
    });
  }, [tasks, search]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      inProgress: tasks.filter((t) => t.STATUS === "IN_PROGRESS").length,
      onHold: tasks.filter((t) => t.STATUS === "ON_HOLD").length,
      completed: tasks.filter((t) => t.STATUS === "COMPLETED").length,
    };
  }, [tasks]);

  return (
    <div className="space-y-4">
      {/* Workbench Header & Stats Banner */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total PRO Queue</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-blue-200/80 bg-blue-50/50 p-4 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20">
          <div className="rounded-lg bg-blue-100 p-2.5 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-blue-700 dark:text-blue-400">In Progress / Active</div>
            <div className="text-xl font-bold text-blue-900 dark:text-blue-200">{stats.inProgress}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="rounded-lg bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-amber-700 dark:text-amber-400">Government / Port Holds</div>
            <div className="text-xl font-bold text-amber-900 dark:text-amber-200">{stats.onHold}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="rounded-lg bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Cleared & Passed</div>
            <div className="text-xl font-bold text-emerald-900 dark:text-emerald-200">{stats.completed}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Job, BL, Bayan, Customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Types</option>
              <option value="PERMIT">Ministry Permits</option>
              <option value="BAYAN">Customs Bayan</option>
              <option value="CCRO">CCRO Release</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Statuses</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        <button
          onClick={fetchTasks}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* PRO Tasks Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Job & BL No</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Task Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Customs Bayan</th>
                <th className="px-4 py-3">Ministry Permit</th>
                <th className="px-4 py-3">Hold Details</th>
                <th className="px-4 py-3">Open (Hrs)</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && tasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-500" />
                    Loading PRO clearance queue...
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    No active PRO clearance tasks matching current filters.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => {
                  const isHold = t.STATUS === "ON_HOLD";
                  const isDone = t.STATUS === "COMPLETED";
                  return (
                    <tr
                      key={t.TASK_ID}
                      className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 dark:text-white">{t.JOB_NO}</div>
                        <div className="text-[11px] text-slate-400">BL: {t.BL_NUMBER || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[160px] truncate font-medium text-slate-800 dark:text-slate-200">
                          {t.CUST_NAME || t.CUST_CODE || "—"}
                        </div>
                        <div className="text-[11px] text-slate-400">{t.SHIPMENT_TYPE || "IMPORT"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                          {t.TASK_TYPE}
                        </span>
                        <div className="text-[10px] text-slate-400">Level {t.FLOW_LEVEL}</div>
                      </td>
                      <td className="px-4 py-3">
                        {isHold ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                            <AlertTriangle className="h-3 w-3" /> ON HOLD
                          </span>
                        ) : isDone ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> CLEARED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                            <Clock className="h-3 w-3" /> IN PROGRESS
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {t.EXPORT_BAYAN_NO ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] dark:bg-slate-800">
                            {t.EXPORT_BAYAN_NO}
                          </span>
                        ) : (
                          <span className="italic text-slate-400">Pending Bayan</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.PERMIT_NOT_REQUIRED === "Y" ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">
                            NOT REQUIRED
                          </span>
                        ) : t.PERMIT_REF ? (
                          <div className="font-medium text-emerald-600 dark:text-emerald-400">
                            {t.PERMIT_REF}
                          </div>
                        ) : (
                          <span className="text-[11px] italic text-amber-600 dark:text-amber-400">
                            Awaiting Ref
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isHold ? (
                          <div className="max-w-[150px]">
                            <div className="truncate font-semibold text-amber-700 dark:text-amber-300">
                              {t.HOLD_ENTITY || "Hold Active"}
                            </div>
                            <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                              {t.HOLD_REMARK || t.HOLD_REASON || "No remark"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {t.HOURS_OPEN != null ? `${t.HOURS_OPEN}h` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(t)}
                            className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60"
                          >
                            Update
                          </button>
                          <button
                            onClick={() => navigate(`/freight/jobs?jobNo=${t.JOB_NO}`)}
                            title="Open Job Details"
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRO Action Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  PRO Clearance: {selectedTask.JOB_NO}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  BL: {selectedTask.BL_NUMBER || "—"} | Task: {selectedTask.TASK_TYPE}
                </p>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  Customs Bayan Number
                </label>
                <input
                  type="text"
                  value={bayanNo}
                  onChange={(e) => setBayanNo(e.target.value)}
                  placeholder="e.g. BYN-2026-9901"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Ministry Permit Reference / Approval No
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={permitNotReq}
                      onChange={(e) => setPermitNotReq(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Not Required
                  </label>
                </div>
                <input
                  type="text"
                  disabled={permitNotReq}
                  value={permitRef}
                  onChange={(e) => setPermitRef(e.target.value)}
                  placeholder={permitNotReq ? "Permit marked not required" : "e.g. MOA/EXP/2026/0411"}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                <div className="mb-2 font-semibold text-amber-800 dark:text-amber-300">
                  Government / Port Hold Controls
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-600 dark:text-slate-400">
                      Hold Entity / Ministry
                    </label>
                    <select
                      value={holdEntity}
                      onChange={(e) => setHoldEntity(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">Select Entity (if holding)</option>
                      <option value="MINISTRY_OF_AGRICULTURE">Ministry of Agriculture</option>
                      <option value="MINISTRY_OF_HEALTH">Ministry of Health</option>
                      <option value="CUSTOMS_INSPECTION">Customs Physical Inspection</option>
                      <option value="ENVIRONMENT_AUTHORITY">Environment Authority</option>
                      <option value="PORT_AUTHORITY">Port Authority Security</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-600 dark:text-slate-400">
                      Reason / Hold Remark
                    </label>
                    <input
                      type="text"
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                      placeholder="e.g. Sample taken for lab testing"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => handleToggleHold("ON_HOLD")}
                    disabled={actionLoading}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Place On Hold
                  </button>
                  <button
                    onClick={() => handleToggleHold("IN_PROGRESS")}
                    disabled={actionLoading}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Release Hold / In Progress
                  </button>
                  <button
                    onClick={() => handleToggleHold("COMPLETED")}
                    disabled={actionLoading}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Complete & Clear Task
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                onClick={() => setSelectedTask(null)}
                className="rounded-lg px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                onClick={handleSavePermit}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Bayan & Permit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

