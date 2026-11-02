import React, { useEffect, useState, useMemo } from "react";
import {
  Truck,
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Loader2,
  Calendar,
  ExternalLink,
  ShieldCheck,
  X,
  FileText,
  Warehouse,
  MapPin
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../state/AuthContext";

type DcContainerRow = {
  CONTAINER_ID: string;
  JOB_NO: string;
  PRIN_CODE: string;
  BL_NUMBER: string;
  CUST_NAME?: string;
  CONTAINER_NUMBER: string;
  SEAL_NO?: string;
  STATUS: "PENDING" | "ASSIGNED" | "IN_TRANSIT" | "AT_DC" | "BREAKDOWN" | "OFFLOADED" | "EMPTY_RETURNED";
  TRUCK_PLATE_NUMBER?: string;
  DRIVER_NAME?: string;
  EXPECTED_ARRIVAL_AT?: string;
  ARRIVED_AT?: string;
  ACTUAL_PULL_OUT_DATE?: string;
  OFFLOADED_AT?: string;
  OFFLOADED_BY?: string;
  DC_REMARK?: string;
  TRANSPORT_REMARK?: string;
  CUSTOMS_RELEASE_STATUS?: string;
  OFFLOADING_POINT_ID?: string;
  EMPTY_RETURN_POINT_ID?: string;
  CURRENT_STAGE?: string;
  SHIPMENT_TYPE?: string;
};

export const FreightDcStationPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [containers, setContainers] = useState<DcContainerRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Edit / Gate-In modal
  const [selectedContainer, setSelectedContainer] = useState<DcContainerRow | null>(null);
  const [editStatus, setEditStatus] = useState<string>("");
  const [truckPlate, setTruckPlate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [dcRemark, setDcRemark] = useState("");
  const [markArrived, setMarkArrived] = useState(false);

  // Offload modal
  const [offloadTarget, setOffloadTarget] = useState<DcContainerRow | null>(null);
  const [offloadRemark, setOffloadRemark] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchContainers = async () => {
    try {
      setLoading(true);
      const res = await api.post("/api/freight/tracker/dc-station/list", {
        company_code: (user as any)?.company_code || "BSG",
      });
      if (res.data?.success) {
        setContainers(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to load DC containers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
  }, []);

  const openEditModal = (c: DcContainerRow) => {
    setSelectedContainer(c);
    setEditStatus(c.STATUS || "IN_TRANSIT");
    setTruckPlate(c.TRUCK_PLATE_NUMBER || "");
    setDriverName(c.DRIVER_NAME || "");
    setDcRemark(c.DC_REMARK || "");
    setMarkArrived(!!c.ARRIVED_AT);
  };

  const handleSaveContainer = async () => {
    if (!selectedContainer) return;
    try {
      setActionLoading(true);
      await api.post("/api/freight/tracker/dc-station/update-container", {
        container_id: selectedContainer.CONTAINER_ID,
        status: editStatus,
        truck_plate_number: truckPlate,
        driver_name: driverName,
        dc_remark: dcRemark,
        arrived: markArrived ? "Y" : "N",
      });
      setSelectedContainer(null);
      await fetchContainers();
    } catch (err: any) {
      alert("Failed to update container: " + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmOffload = async () => {
    if (!offloadTarget) return;
    try {
      setActionLoading(true);
      await api.post("/api/freight/tracker/container-offload", {
        company_code: (user as any)?.company_code || "BSG",
        job_no: offloadTarget.JOB_NO,
        prin_code: offloadTarget.PRIN_CODE,
        container_number: offloadTarget.CONTAINER_NUMBER,
        dc_remark: offloadRemark || "Container offloaded safely at DC",
        user_id: user?.loginid || "DC_OPERATOR",
      });
      setOffloadTarget(null);
      await fetchContainers();
    } catch (err: any) {
      alert("Failed to offload container: " + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const filteredContainers = useMemo(() => {
    return containers.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        c.CONTAINER_NUMBER?.toLowerCase().includes(q) ||
        c.SEAL_NO?.toLowerCase().includes(q) ||
        c.JOB_NO?.toLowerCase().includes(q) ||
        c.BL_NUMBER?.toLowerCase().includes(q) ||
        c.CUST_NAME?.toLowerCase().includes(q) ||
        c.TRUCK_PLATE_NUMBER?.toLowerCase().includes(q) ||
        c.DRIVER_NAME?.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && c.STATUS !== "OFFLOADED" && c.STATUS !== "EMPTY_RETURNED") ||
        c.STATUS === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [containers, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: containers.length,
      inTransit: containers.filter((c) => c.STATUS === "IN_TRANSIT").length,
      atDc: containers.filter((c) => c.STATUS === "AT_DC").length,
      breakdown: containers.filter((c) => c.STATUS === "BREAKDOWN").length,
      offloaded: containers.filter((c) => c.STATUS === "OFFLOADED" || c.STATUS === "EMPTY_RETURNED").length,
    };
  }, [containers]);

  return (
    <div className="space-y-4">
      {/* Workbench Header & Stats Banner */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Containers</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-sky-200/80 bg-sky-50/50 p-4 shadow-sm dark:border-sky-900/50 dark:bg-sky-950/20">
          <div className="rounded-lg bg-sky-100 p-2.5 text-sky-700 dark:bg-sky-900 dark:text-sky-300">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-sky-700 dark:text-sky-400">In Transit (Road)</div>
            <div className="text-xl font-bold text-sky-900 dark:text-sky-200">{stats.inTransit}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-4 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <div className="rounded-lg bg-indigo-100 p-2.5 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
            <Warehouse className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-indigo-700 dark:text-indigo-400">At DC Yard (Awaiting)</div>
            <div className="text-xl font-bold text-indigo-900 dark:text-indigo-200">{stats.atDc}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-rose-200/80 bg-rose-50/50 p-4 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/20">
          <div className="rounded-lg bg-rose-100 p-2.5 text-rose-700 dark:bg-rose-900 dark:text-rose-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-rose-700 dark:text-rose-400">Breakdown / Alert</div>
            <div className="text-xl font-bold text-rose-900 dark:text-rose-200">{stats.breakdown}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="rounded-lg bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Offloaded & Done</div>
            <div className="text-xl font-bold text-emerald-900 dark:text-emerald-200">{stats.offloaded}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Container, Seal, Driver, Job..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Containers</option>
              <option value="ACTIVE">Active (In Transit / At DC)</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="AT_DC">At DC Yard</option>
              <option value="BREAKDOWN">Breakdown</option>
              <option value="OFFLOADED">Offloaded</option>
            </select>
          </div>
        </div>

        <button
          onClick={fetchContainers}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Container Fleet Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Container & Seal</th>
                <th className="px-4 py-3">Job & Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Truck & Driver</th>
                <th className="px-4 py-3">Gate In / Arrival</th>
                <th className="px-4 py-3">Offloading Record</th>
                <th className="px-4 py-3">DC Remarks</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && containers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-500" />
                    Loading DC container stream...
                  </td>
                </tr>
              ) : filteredContainers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No containers found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredContainers.map((c) => {
                  const isOffloaded = c.STATUS === "OFFLOADED" || c.STATUS === "EMPTY_RETURNED";
                  const isAtDc = c.STATUS === "AT_DC";
                  const isBreakdown = c.STATUS === "BREAKDOWN";
                  const isInTransit = c.STATUS === "IN_TRANSIT";

                  return (
                    <tr
                      key={c.CONTAINER_ID}
                      className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {c.CONTAINER_NUMBER}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Seal: {c.SEAL_NO || "Pending Seal"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-blue-600 dark:text-blue-400">{c.JOB_NO}</div>
                        <div className="max-w-[150px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {c.CUST_NAME || c.BL_NUMBER || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isBreakdown ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">
                            <AlertTriangle className="h-3 w-3" /> BREAKDOWN
                          </span>
                        ) : isOffloaded ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> OFFLOADED
                          </span>
                        ) : isAtDc ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
                            <Warehouse className="h-3 w-3" /> AT DC YARD
                          </span>
                        ) : isInTransit ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-900/60 dark:text-sky-200">
                            <Truck className="h-3 w-3" /> IN TRANSIT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <Clock className="h-3 w-3" /> {c.STATUS}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.TRUCK_PLATE_NUMBER ? (
                          <div>
                            <div className="font-mono font-medium text-slate-800 dark:text-slate-200">
                              {c.TRUCK_PLATE_NUMBER}
                            </div>
                            <div className="text-[11px] text-slate-400">{c.DRIVER_NAME || "Assigned Driver"}</div>
                          </div>
                        ) : (
                          <span className="italic text-slate-400">Unassigned Truck</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.ARRIVED_AT ? (
                          <div className="text-slate-700 dark:text-slate-300">
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">Gate-in: </span>
                            {c.ARRIVED_AT}
                          </div>
                        ) : (
                          <span className="text-slate-400">Not arrived</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.OFFLOADED_AT ? (
                          <div>
                            <div className="font-medium text-emerald-600 dark:text-emerald-400">
                              {c.OFFLOADED_AT}
                            </div>
                            <div className="text-[10px] text-slate-400">By {c.OFFLOADED_BY || "Operator"}</div>
                          </div>
                        ) : (
                          <span className="italic text-slate-400">Pending Offload</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[160px] truncate text-slate-600 dark:text-slate-400">
                          {c.DC_REMARK || c.TRANSPORT_REMARK || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isOffloaded && (
                            <button
                              onClick={() => {
                                setOffloadTarget(c);
                                setOffloadRemark("");
                              }}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                            >
                              Offload
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(c)}
                            className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => navigate(`/freight/jobs?jobNo=${c.JOB_NO}`)}
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

      {/* Edit / Transport Modal */}
      {selectedContainer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Container: {selectedContainer.CONTAINER_NUMBER}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Job: {selectedContainer.JOB_NO} | Customer: {selectedContainer.CUST_NAME || "—"}
                </p>
              </div>
              <button
                onClick={() => setSelectedContainer(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  Container Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="ASSIGNED">ASSIGNED (Port Pull-out)</option>
                  <option value="IN_TRANSIT">IN TRANSIT (Road Transport)</option>
                  <option value="AT_DC">AT DC (Arrived at Warehouse Yard)</option>
                  <option value="BREAKDOWN">BREAKDOWN / ALERT (Truck Breakdown)</option>
                  <option value="OFFLOADED">OFFLOADED (Emptying Complete)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  Truck Plate Number
                </label>
                <input
                  type="text"
                  value={truckPlate}
                  onChange={(e) => setTruckPlate(e.target.value)}
                  placeholder="e.g. 8492-B"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  Driver Name / Contact
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g. Salim Al-Harthy"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  DC Yard & Condition Remarks
                </label>
                <textarea
                  rows={2}
                  value={dcRemark}
                  onChange={(e) => setDcRemark(e.target.value)}
                  placeholder="e.g. Arrived Bay 4, seal intact"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="markArrived"
                  checked={markArrived}
                  onChange={(e) => setMarkArrived(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="markArrived" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Record Gate-In Arrival at DC (Set Arrival Timestamp Now)
                </label>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                onClick={() => setSelectedContainer(null)}
                className="rounded-lg px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveContainer}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Offload Modal */}
      {offloadTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm Offloading
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Container: {offloadTarget.CONTAINER_NUMBER} | Job: {offloadTarget.JOB_NO}
                </p>
              </div>
              <button
                onClick={() => setOffloadTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
                <div className="font-bold">Warehouse Offload Confirmation</div>
                <div className="text-[11px] mt-0.5">
                  This action marks the container as <strong>OFFLOADED</strong>, completes the delivery milestone, and notifies operations.
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  DC Supervisor / Warehouse Remark
                </label>
                <textarea
                  rows={2}
                  value={offloadRemark}
                  onChange={(e) => setOffloadRemark(e.target.value)}
                  placeholder="e.g. Unloaded into Zone C, cargo intact without damage"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                onClick={() => setOffloadTarget(null)}
                className="rounded-lg px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOffload}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm & Complete Offload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

