import React, { useEffect, useState } from "react";
import { Fuel, Plus, Search, Trash2, X, CreditCard, DollarSign } from "lucide-react";
import { tmsApi, TMSFuelFilling, TMSVehicle, TMSDriver } from "../../api/tms";

export const FuelFillingPage: React.FC = () => {
  const [fillings, setFillings] = useState<TMSFuelFilling[]>([]);
  const [vehicles, setVehicles] = useState<TMSVehicle[]>([]);
  const [drivers, setDrivers] = useState<TMSDriver[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [formData, setFormData] = useState<any>({
    doc_no: "",
    doc_date: new Date().toISOString().substring(0, 10),
    vehicle_code: "",
    emp_id: "",
    meter_reading: 0,
    fuel_type: "DIESEL",
    qty_gallon: 0,
    unit_price: 0,
    amount: 0,
    station_name: "",
    location: "",
    payment_mode: "CASH",
    fuel_card_no: ""
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [fRes, vRes, dRes] = await Promise.all([
        tmsApi.getFuelFilling(),
        tmsApi.getVehicles(),
        tmsApi.getDrivers()
      ]);
      if (fRes.success) setFillings(fRes.data || []);
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
      doc_no: "",
      doc_date: new Date().toISOString().substring(0, 10),
      vehicle_code: vehicles.length > 0 ? vehicles[0].VEHICLE_NO : "",
      emp_id: drivers.length > 0 ? drivers[0].EMP_ID : "",
      meter_reading: 0,
      fuel_type: "DIESEL",
      qty_gallon: 0,
      unit_price: 0,
      amount: 0,
      station_name: "",
      location: "",
      payment_mode: "CASH",
      fuel_card_no: ""
    });
    setModalOpen(true);
  };

  const handleQtyPriceChange = (qty: number, price: number) => {
    setFormData({
      ...formData,
      qty_gallon: qty,
      unit_price: price,
      amount: Math.round(qty * price * 100) / 100
    });
  };

  const handleDelete = async (docNo: string) => {
    if (!window.confirm(`Are you sure you want to delete fuel record ${docNo}?`)) return;
    try {
      const res = await tmsApi.deleteFuelFilling(docNo);
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
      const res = await tmsApi.saveFuelFilling(formData);
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

  const filtered = fillings.filter(f =>
    (f.DOC_NO || "").toLowerCase().includes(search.toLowerCase()) ||
    (f.VEHICLE_CODE || "").toLowerCase().includes(search.toLowerCase()) ||
    (f.DRIVER_NAME || "").toLowerCase().includes(search.toLowerCase()) ||
    (f.STATION_NAME || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Fuel className="text-emerald-600" size={24} />
            Fuel Filling Register
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Track petrol/diesel refills, fuel cards, meter readings and pump stations.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search fuel record, vehicle..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <Plus size={16} />
            Log Fuel Filling
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Ref #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Driver</th>
                <th className="py-3 px-4">Odometer (KM)</th>
                <th className="py-3 px-4">Qty (L/Gal)</th>
                <th className="py-3 px-4">Rate</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Station / Card</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-8 text-slate-400">Loading fuel records...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-slate-400">No fuel records found.</td></tr>
              ) : (
                filtered.map(f => (
                  <tr key={f.DOC_NO} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-emerald-600">{f.DOC_NO}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {f.DOC_DATE ? new Date(f.DOC_DATE).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{f.VEHICLE_CODE || "-"}</td>
                    <td className="py-3 px-4 text-xs">{f.DRIVER_NAME || f.EMP_ID || "-"}</td>
                    <td className="py-3 px-4 text-xs font-mono">{Number(f.METER_READING || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-700">{Number(f.QTY_GALLON || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-xs font-mono">{Number(f.UNIT_PRICE || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-xs font-bold text-slate-800">{Number(f.AMOUNT || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      <div>{f.STATION_NAME || "-"}</div>
                      {f.FUEL_CARD_NO && <div className="text-slate-400 font-mono">Card: {f.FUEL_CARD_NO}</div>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleDelete(f.DOC_NO)} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded">
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
              <h3 className="font-bold text-slate-800 text-base">Record Fuel Filling</h3>
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
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fuel Type</label>
                  <select
                    value={formData.fuel_type}
                    onChange={e => setFormData({ ...formData, fuel_type: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="DIESEL">DIESEL</option>
                    <option value="PETROL_95">PETROL 95 (SPECIAL)</option>
                    <option value="PETROL_98">PETROL 98 (SUPER)</option>
                    <option value="CNG">CNG</option>
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
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
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

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Odometer (KM)</label>
                  <input
                    type="number"
                    value={formData.meter_reading}
                    onChange={e => setFormData({ ...formData, meter_reading: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Qty (L/Gal) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={formData.qty_gallon}
                    onChange={e => handleQtyPriceChange(Number(e.target.value), formData.unit_price)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Unit Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.unit_price}
                    onChange={e => handleQtyPriceChange(formData.qty_gallon, Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="bg-emerald-50 p-3 rounded-lg flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-900">Calculated Amount:</span>
                <span className="text-base font-bold text-emerald-900">{Number(formData.amount || 0).toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Filling Station</label>
                  <input
                    type="text"
                    value={formData.station_name}
                    onChange={e => setFormData({ ...formData, station_name: e.target.value })}
                    placeholder="e.g. ENOC / ADNOC"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fuel Card No</label>
                  <input
                    type="text"
                    value={formData.fuel_card_no}
                    onChange={e => setFormData({ ...formData, fuel_card_no: e.target.value })}
                    placeholder="e.g. CARD-9821"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
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
                  className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  Save Fuel Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
