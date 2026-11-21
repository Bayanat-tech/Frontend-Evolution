import React, { useEffect, useState } from "react";
import { Wrench, Plus, Search, Trash2, X, AlertCircle } from "lucide-react";
import { tmsApi, TMSMaintenance, TMSVehicle, TMSDriver } from "../../api/tms";

export const VehicleMaintenancePage: React.FC = () => {
  const [records, setRecords] = useState<TMSMaintenance[]>([]);
  const [vehicles, setVehicles] = useState<TMSVehicle[]>([]);
  const [drivers, setDrivers] = useState<TMSDriver[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [formData, setFormData] = useState<any>({
    doc_type: "MT",
    doc_no: "",
    doc_date: new Date().toISOString().substring(0, 10),
    service_station_name: "",
    vehicle_code: "",
    contact_person: "",
    payment_mode: "CASH",
    service_type: "PERIODIC",
    emp_id: "",
    start_meter_reading: 0,
    end_meter_reading: 0,
    remarks: ""
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [mRes, vRes, dRes] = await Promise.all([
        tmsApi.getMaintenance(),
        tmsApi.getVehicles(),
        tmsApi.getDrivers()
      ]);
      if (mRes.success) setRecords(mRes.data || []);
      if (vRes.success) setVehicles(vRes.data || []);
      if (dRes.success) setDrivers(dRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNew = () => {
    setFormData({
      doc_type: "MT",
      doc_no: "",
      doc_date: new Date().toISOString().substring(0, 10),
      service_station_name: "",
      vehicle_code: vehicles.length > 0 ? vehicles[0].VEHICLE_NO : "",
      contact_person: "",
      payment_mode: "CASH",
      service_type: "PERIODIC",
      emp_id: drivers.length > 0 ? drivers[0].EMP_ID : "",
      start_meter_reading: 0,
      end_meter_reading: 0,
      remarks: ""
    });
    setModalOpen(true);
  };

  const handleDelete = async (docNo: string) => {
    if (!window.confirm(`Are you sure you want to delete maintenance record ${docNo}?`)) return;
    try {
      const res = await tmsApi.deleteMaintenance(docNo);
      if (res.success) {
        loadData();
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await tmsApi.saveMaintenance(formData);
      if (res.success) {
        setModalOpen(false);
        loadData();
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filtered = records.filter(m =>
    (m.DOC_NO || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.VEHICLE_CODE || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.SERVICE_STATION_NAME || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.SERVICE_TYPE || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Wrench className="text-amber-600" size={24} />
            Vehicle Maintenance & Workshop
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Manage periodic servicing, breakdown repairs, workshops, and parts.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search maintenance job, vehicle..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <Plus size={16} />
            New Maintenance Job
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Job #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Service Type</th>
                <th className="py-3 px-4">Workshop / Station</th>
                <th className="py-3 px-4">Odometer (KM)</th>
                <th className="py-3 px-4">Driver</th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">Loading maintenance records...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">No maintenance records found.</td></tr>
              ) : (
                filtered.map(m => (
                  <tr key={m.DOC_NO} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-amber-600">{m.DOC_NO}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {m.DOC_DATE ? new Date(m.DOC_DATE).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{m.VEHICLE_CODE || "-"}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                        {m.SERVICE_TYPE || "PERIODIC"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">{m.SERVICE_STATION_NAME || "-"}</td>
                    <td className="py-3 px-4 text-xs font-mono">{Number(m.START_METER_READING || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-xs">{m.DRIVER_NAME || m.EMP_ID || "-"}</td>
                    <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate">{m.REMARKS || "-"}</td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleDelete(m.DOC_NO)} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-base">New Maintenance Order</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.doc_date}
                    onChange={e => setFormData({ ...formData, doc_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Service Type</label>
                  <select
                    value={formData.service_type}
                    onChange={e => setFormData({ ...formData, service_type: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="PERIODIC">PERIODIC SERVICE</option>
                    <option value="BREAKDOWN">BREAKDOWN REPAIR</option>
                    <option value="TYRE_REPLACEMENT">TYRE REPLACEMENT</option>
                    <option value="OIL_CHANGE">OIL & FILTER CHANGE</option>
                    <option value="ACCIDENT_REPAIR">ACCIDENT BODY REPAIR</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Vehicle *</label>
                  <select
                    required
                    value={formData.vehicle_code}
                    onChange={e => setFormData({ ...formData, vehicle_code: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select Vehicle</option>
                    {vehicles.map(v => (
                      <option key={v.VEHICLE_NO} value={v.VEHICLE_NO}>
                        {v.VEHICLE_NO} {v.VEHICLE_REGNO ? `(${v.VEHICLE_REGNO})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Driver</label>
                  <select
                    value={formData.emp_id}
                    onChange={e => setFormData({ ...formData, emp_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select Driver</option>
                    {drivers.map(d => (
                      <option key={d.EMP_ID} value={d.EMP_ID}>
                        {d.EMP_NAME} ({d.EMP_ID})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Workshop / Station Name</label>
                  <input
                    type="text"
                    value={formData.service_station_name}
                    onChange={e => setFormData({ ...formData, service_station_name: e.target.value })}
                    placeholder="e.g. Al Madina Central Garage"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Odometer (KM)</label>
                  <input
                    type="number"
                    value={formData.start_meter_reading}
                    onChange={e => setFormData({ ...formData, start_meter_reading: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Service Details / Work Done</label>
                <textarea
                  rows={3}
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Detail activities, replacement parts, mechanics..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  Save Maintenance Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
