import React, { useEffect, useState } from "react";
import { Truck, Plus, Search, Edit2, Trash2, X, Gauge, Box } from "lucide-react";
import { tmsApi, TMSVehicle } from "../../api/tms";

export const VehicleMasterPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<TMSVehicle[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<TMSVehicle | null>(null);

  const [formData, setFormData] = useState<any>({
    vehicle_no: "",
    vehicle_regno: "",
    vehicle_type: "",
    vehicle_weight: 0,
    vehicle_volume: 0,
    transporter_code: "",
    vehicle_desc: ""
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [vRes, tRes] = await Promise.all([
        tmsApi.getVehicles(),
        tmsApi.getVehicleTypes()
      ]);
      if (vRes.success) setVehicles(vRes.data || []);
      if (tRes.success) setTypes(tRes.data || []);
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
    setEditingVehicle(null);
    setFormData({
      vehicle_no: "",
      vehicle_regno: "",
      vehicle_type: types.length > 0 ? types[0].VTYPE_CODE : "",
      vehicle_weight: 0,
      vehicle_volume: 0,
      transporter_code: "",
      vehicle_desc: ""
    });
    setModalOpen(true);
  };

  const openEdit = (v: TMSVehicle) => {
    setEditingVehicle(v);
    setFormData({
      vehicle_no: v.VEHICLE_NO,
      vehicle_regno: v.VEHICLE_REGNO || "",
      vehicle_type: v.VEHICLE_TYPE || "",
      vehicle_weight: v.VEHICLE_WEIGHT || 0,
      vehicle_volume: v.VEHICLE_VOLUME || 0,
      transporter_code: v.TRANSPORTER_CODE || "",
      vehicle_desc: v.VEHICLE_DESC || ""
    });
    setModalOpen(true);
  };

  const handleDelete = async (vehicleNo: string) => {
    if (!window.confirm(`Are you sure you want to delete vehicle ${vehicleNo}?`)) return;
    try {
      const res = await tmsApi.deleteVehicle(vehicleNo);
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
      const res = await tmsApi.saveVehicle(formData);
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

  const filtered = vehicles.filter(v =>
    (v.VEHICLE_NO || "").toLowerCase().includes(search.toLowerCase()) ||
    (v.VEHICLE_REGNO || "").toLowerCase().includes(search.toLowerCase()) ||
    (v.VEHICLE_DESC || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="text-blue-600" size={24} />
            Vehicle Fleet Master
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Manage company fleet, capacities, registration and types.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search vehicle or plate..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <Plus size={16} />
            Add Vehicle
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Vehicle Code</th>
                <th className="py-3 px-4">Plate / Reg No</th>
                <th className="py-3 px-4">Vehicle Type</th>
                <th className="py-3 px-4">Weight Capacity (KG)</th>
                <th className="py-3 px-4">Volume (CBM)</th>
                <th className="py-3 px-4">Transporter</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading vehicles...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">No vehicle records found.</td></tr>
              ) : (
                filtered.map(v => (
                  <tr key={v.VEHICLE_NO} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-blue-600">{v.VEHICLE_NO}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{v.VEHICLE_REGNO || "-"}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                        {v.VTYPE_NAME || v.VEHICLE_TYPE || "-"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">
                      {Number(v.VEHICLE_WEIGHT || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">
                      {Number(v.VEHICLE_VOLUME || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{v.TRANSPORTER_CODE || "OWN FLEET"}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button onClick={() => openEdit(v)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(v.VEHICLE_NO)} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded">
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
              <h3 className="font-bold text-slate-800 text-base">
                {editingVehicle ? `Edit Vehicle (${editingVehicle.VEHICLE_NO})` : "New Vehicle Registration"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Vehicle Code *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingVehicle}
                    value={formData.vehicle_no}
                    onChange={e => setFormData({ ...formData, vehicle_no: e.target.value.toUpperCase() })}
                    placeholder="e.g. TRK-01"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Registration / Plate No</label>
                  <input
                    type="text"
                    value={formData.vehicle_regno}
                    onChange={e => setFormData({ ...formData, vehicle_regno: e.target.value })}
                    placeholder="e.g. DXB-12345"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Vehicle Type</label>
                <select
                  value={formData.vehicle_type}
                  onChange={e => setFormData({ ...formData, vehicle_type: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Type</option>
                  {types.map(t => (
                    <option key={t.VTYPE_CODE} value={t.VTYPE_CODE}>
                      {t.VTYPE_NAME} ({t.VTYPE_CODE})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Weight Capacity (KG)</label>
                  <input
                    type="number"
                    value={formData.vehicle_weight}
                    onChange={e => setFormData({ ...formData, vehicle_weight: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Volume (CBM)</label>
                  <input
                    type="number"
                    value={formData.vehicle_volume}
                    onChange={e => setFormData({ ...formData, vehicle_volume: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Transporter / Fleet Owner</label>
                <input
                  type="text"
                  value={formData.transporter_code}
                  onChange={e => setFormData({ ...formData, transporter_code: e.target.value })}
                  placeholder="e.g. OWN or external vendor"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={formData.vehicle_desc}
                  onChange={e => setFormData({ ...formData, vehicle_desc: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
