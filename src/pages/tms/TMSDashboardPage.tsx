import React, { useEffect, useState } from "react";
import { 
  Truck, 
  UserCheck, 
  Route, 
  Fuel, 
  Wrench, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  PlusCircle, 
  ArrowRight,
  RefreshCw
} from "lucide-react";
import { tmsApi } from "../../api/tms";

export const TMSDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<any>({
    totalVehicles: 0,
    totalDrivers: 0,
    totalTrips: 0,
    completedTrips: 0,
    activeTrips: 0,
    totalFuelCost: 0,
    totalFuelQty: 0,
    recentActiveTrips: []
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await tmsApi.getDashboardStats();
      if (res.success) {
        setStats(res.data);
      }
    } catch (e) {
      console.error("Failed to load TMS stats", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Route className="text-blue-600" size={28} />
            Transport Management System (TMS)
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Complete fleet tracking, trip operations, fuel monitoring, and vehicle maintenance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchStats}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fleet Vehicles</p>
            <p className="text-3xl font-extrabold text-slate-800 mt-2">{stats.totalVehicles}</p>
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 mt-2 font-medium">
              Registered in fleet
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Truck size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Drivers</p>
            <p className="text-3xl font-extrabold text-slate-800 mt-2">{stats.totalDrivers}</p>
            <span className="inline-flex items-center gap-1 text-xs text-blue-600 mt-2 font-medium">
              Certified & ready
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <UserCheck size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Trips</p>
            <p className="text-3xl font-extrabold text-amber-600 mt-2">{stats.activeTrips}</p>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 mt-2 font-medium">
              {stats.completedTrips} trips completed
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Fuel Qty</p>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">{Number(stats.totalFuelQty || 0).toLocaleString()} <span className="text-sm font-normal text-slate-500">Gal/L</span></p>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 mt-2 font-medium">
              Cost: {Number(stats.totalFuelCost || 0).toLocaleString()}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Fuel size={24} />
          </div>
        </div>
      </div>

      {/* Main Grid: Active Trips & Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Active Trips Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Clock size={18} className="text-amber-500" />
              In-Progress Trips
            </h2>
            <span className="text-xs bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-full">
              {stats.activeTrips} active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Trip #</th>
                  <th className="py-2.5 px-3">Vehicle</th>
                  <th className="py-2.5 px-3">Driver</th>
                  <th className="py-2.5 px-3">Route (From &rarr; To)</th>
                  <th className="py-2.5 px-3">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recentActiveTrips && stats.recentActiveTrips.length > 0 ? (
                  stats.recentActiveTrips.map((trip: any) => (
                    <tr key={trip.DOC_NO} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-semibold text-blue-600">TT-{trip.DOC_NO}</td>
                      <td className="py-3 px-3 font-medium text-slate-800">{trip.VEHICLE_CODE || "-"}</td>
                      <td className="py-3 px-3 text-slate-600">{trip.EMP_ID || "-"}</td>
                      <td className="py-3 px-3 text-slate-600">
                        {trip.START_POINT || "Origin"} &rarr; {trip.END_POINT || "Destination"}
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-xs">
                        {trip.START_DATE ? new Date(trip.START_DATE).toLocaleDateString() : "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      No trips currently in-progress.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Operations & Quick Navigation */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-800">Operational Hub</h2>
          <div className="space-y-2.5">
            <a
              href="/workspace/tms/operations/trip-tickets"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Route size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600">Trip Tickets</p>
                  <p className="text-xs text-slate-400">Dispatch and monitor trip sheets</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-slate-400 group-hover:text-blue-600" />
            </a>

            <a
              href="/workspace/tms/operations/requests"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <PlusCircle size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600">Transport Requests</p>
                  <p className="text-xs text-slate-400">Customer booking and scheduling</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-slate-400 group-hover:text-blue-600" />
            </a>

            <a
              href="/workspace/tms/operations/fuel-filling"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Fuel size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600">Fuel Filling</p>
                  <p className="text-xs text-slate-400">Track fuel cards, gallons and bills</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-slate-400 group-hover:text-blue-600" />
            </a>

            <a
              href="/workspace/tms/operations/maintenance"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Wrench size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600">Workshop & Service</p>
                  <p className="text-xs text-slate-400">Vehicle maintenance and parts</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-slate-400 group-hover:text-blue-600" />
            </a>

            <a
              href="/workspace/tms/operations/accidents-fines"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600">Fines & Accidents</p>
                  <p className="text-xs text-slate-400">Traffic penalties and claims</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-slate-400 group-hover:text-blue-600" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
