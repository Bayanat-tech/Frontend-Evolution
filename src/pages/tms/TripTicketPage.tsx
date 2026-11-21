import React, { useEffect, useState } from "react";
import { Route, Plus, Search, CheckCircle2, XCircle, Gauge, Calendar, User, Truck, X } from "lucide-react";
import { tmsApi, TMSTripTicket, TMSDriver, TMSVehicle } from "../../api/tms";

export const TripTicketPage: React.FC = () => {
  const [trips, setTrips] = useState<TMSTripTicket[]>([]);
  const [drivers, setDrivers] = useState<TMSDriver[]>([]);
  const [vehicles, setVehicles] = useState<TMSVehicle[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<TMSTripTicket | null>(null);
  const [cancelModal, setCancelModal] = useState<TMSTripTicket | null>(null);

  // Forms
  const [formData, setFormData] = useState<any>({
    doc_type: "TT",
    doc_no: 0,
    doc_date: new Date().toISOString().substring(0, 10),
    classification: "LOCAL",
    start_point: "",
    end_point: "",
    start_date: new Date().toISOString().substring(0, 10),
    start_meter_reading: 0,
    emp_id: "",
    vehicle_code: "",
    prin_code: "",
    job_no: "",
    req_doc_no: 0,
    cust_code: "",
    base_amount: 0,
    advance_amount: 0,
    container_no: "",
    remarks: ""
  });

  const [confirmData, setConfirmData] = useState<any>({
    end_meter_reading: 0,
    confirm_date: new Date().toISOString().substring(0, 10),
    confirm_remarks: "Completed trip"
  });

  const [cancelReason, setCancelReason] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [tRes, dRes, vRes] = await Promise.all([
        tmsApi.getTripTickets(),
        tmsApi.getDrivers(),
        tmsApi.getVehicles()
      ]);
      if (tRes.success) setTrips(tRes.data || []);
      if (dRes.success) setDrivers(dRes.data || []);
      if (vRes.success) setVehicles(vRes.data || []);
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
      doc_type: "TT",
      doc_no: 0,
      doc_date: new Date().toISOString().substring(0, 10),
      classification: "LOCAL",
      start_point: "",
      end_point: "",
      start_date: new Date().toISOString().substring(0, 10),
      start_meter_reading: 0,
      emp_id: drivers.length > 0 ? drivers[0].EMP_ID : "",
      vehicle_code: vehicles.length > 0 ? vehicles[0].VEHICLE_NO : "",
      prin_code: "",
      job_no: "",
      req_doc_no: 0,
      cust_code: "",
      base_amount: 0,
      advance_amount: 0,
      container_no: "",
      remarks: ""
    });
    setCreateModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await tmsApi.saveTripTicket(formData);
      if (res.success) {
        setCreateModal(false);
        loadData();
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmModal) return;
    try {
      const res = await tmsApi.confirmTripTicket(confirmModal.DOC_NO, confirmData);
      if (res.success) {
        setConfirmModal(null);
        loadData();
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModal) return;
    try {
      const res = await tmsApi.cancelTripTicket(cancelModal.DOC_NO, { reason: cancelReason });
      if (res.success) {
        setCancelModal(null);
        loadData();
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filtered = trips.filter(t =>
    String(t.DOC_NO).includes(search) ||
    (t.VEHICLE_CODE || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.DRIVER_NAME || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.EMP_ID || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.START_POINT || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.END_POINT || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Route className="text-blue-600" size={24} />
            Trip Ticket Operations
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Dispatch vehicles, track kilometer readings, advances, and trip completion.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search trip #, vehicle, driver..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <Plus size={16} />
            New Trip Ticket
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Trip #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Driver</th>
                <th className="py-3 px-4">Route (Start &rarr; End)</th>
                <th className="py-3 px-4">Odometer (Start / End)</th>
                <th className="py-3 px-4">Total KM</th>
                <th className="py-3 px-4">Amount / Adv</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-8 text-slate-400">Loading trip tickets...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-slate-400">No trip tickets found.</td></tr>
              ) : (
                filtered.map(t => {
                  const isConfirmed = t.CONFIRMED === "Y";
                  const isCancelled = t.CANCELLED === "Y";
                  return (
                    <tr key={t.DOC_NO} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-blue-600">TT-{t.DOC_NO}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {t.DOC_DATE ? new Date(t.DOC_DATE).toLocaleDateString() : "-"}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 flex items-center gap-1.5 mt-1">
                        <Truck size={14} className="text-slate-400" />
                        {t.VEHICLE_CODE || "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <User size={14} className="text-slate-400" />
                          <span>{t.DRIVER_NAME || t.EMP_ID || "-"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {t.START_POINT || "Origin"} &rarr; {t.END_POINT || "Dest"}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono">
                        {Number(t.START_METER_READING || 0).toLocaleString()} / {t.END_METER_READING ? Number(t.END_METER_READING).toLocaleString() : "-"}
                      </td>
                      <td className="py-3 px-4 font-medium text-xs text-slate-800">
                        {t.TOTAL_KM ? `${t.TOTAL_KM} KM` : "-"}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-semibold text-slate-800">{Number(t.BASE_AMOUNT || 0).toLocaleString()}</div>
                        {t.ADVANCE_AMOUNT ? <div className="text-amber-600">Adv: {Number(t.ADVANCE_AMOUNT).toLocaleString()}</div> : null}
                      </td>
                      <td className="py-3 px-4">
                        {isCancelled ? (
                          <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-800">
                            Cancelled
                          </span>
                        ) : isConfirmed ? (
                          <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        {!isConfirmed && !isCancelled && (
                          <>
                            <button
                              onClick={() => {
                                setConfirmModal(t);
                                setConfirmData({
                                  end_meter_reading: (t.START_METER_READING || 0) + 100,
                                  confirm_date: new Date().toISOString().substring(0, 10),
                                  confirm_remarks: "Trip successfully completed"
                                });
                              }}
                              title="Complete Trip"
                              className="px-2 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded inline-flex items-center gap-1"
                            >
                              <CheckCircle2 size={12} /> Complete
                            </button>
                            <button
                              onClick={() => {
                                setCancelModal(t);
                                setCancelReason("");
                              }}
                              title="Cancel Trip"
                              className="px-2 py-1 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded inline-flex items-center gap-1"
                            >
                              <XCircle size={12} /> Cancel
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-base">New Trip Ticket</h3>
              <button onClick={() => setCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Trip Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.doc_date}
                    onChange={e => setFormData({ ...formData, doc_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Classification</label>
                  <select
                    value={formData.classification}
                    onChange={e => setFormData({ ...formData, classification: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="LOCAL">LOCAL</option>
                    <option value="INTERSTATE">INTERSTATE</option>
                    <option value="IMPORT">IMPORT</option>
                    <option value="EXPORT">EXPORT</option>
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
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Driver *</label>
                  <select
                    required
                    value={formData.emp_id}
                    onChange={e => setFormData({ ...formData, emp_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Start Point</label>
                  <input
                    type="text"
                    placeholder="Origin location"
                    value={formData.start_point}
                    onChange={e => setFormData({ ...formData, start_point: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">End Point</label>
                  <input
                    type="text"
                    placeholder="Destination location"
                    value={formData.end_point}
                    onChange={e => setFormData({ ...formData, end_point: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Start Odometer (KM)</label>
                  <input
                    type="number"
                    value={formData.start_meter_reading}
                    onChange={e => setFormData({ ...formData, start_meter_reading: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Container / Cargo #</label>
                  <input
                    type="text"
                    value={formData.container_no}
                    onChange={e => setFormData({ ...formData, container_no: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Base Freight Amount</label>
                  <input
                    type="number"
                    value={formData.base_amount}
                    onChange={e => setFormData({ ...formData, base_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Driver Advance Amount</label>
                  <input
                    type="number"
                    value={formData.advance_amount}
                    onChange={e => setFormData({ ...formData, advance_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCreateModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  Dispatch Trip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Completion Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-base">Complete Trip TT-{confirmModal.DOC_NO}</h3>
              <button onClick={() => setConfirmModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleConfirmSubmit} className="p-6 space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 space-y-1">
                <div>Vehicle: <span className="font-bold">{confirmModal.VEHICLE_CODE}</span></div>
                <div>Start Odometer: <span className="font-bold font-mono">{confirmModal.START_METER_READING || 0} KM</span></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">End Odometer Reading (KM) *</label>
                <input
                  type="number"
                  required
                  min={confirmModal.START_METER_READING || 0}
                  value={confirmData.end_meter_reading}
                  onChange={e => setConfirmData({ ...confirmData, end_meter_reading: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  Trip distance: {Math.max(0, confirmData.end_meter_reading - (confirmModal.START_METER_READING || 0))} KM
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Completion Date</label>
                <input
                  type="date"
                  value={confirmData.confirm_date}
                  onChange={e => setConfirmData({ ...confirmData, confirm_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Completion Notes</label>
                <input
                  type="text"
                  value={confirmData.confirm_remarks}
                  onChange={e => setConfirmData({ ...confirmData, confirm_remarks: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  Confirm Completion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-base">Cancel Trip TT-{cancelModal.DOC_NO}</h3>
              <button onClick={() => setCancelModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCancelSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cancellation Reason *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain reason for trip cancellation..."
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCancelModal(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
