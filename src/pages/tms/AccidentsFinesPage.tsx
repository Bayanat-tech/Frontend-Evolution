import React, { useEffect, useState } from "react";
import { AlertTriangle, Plus, Search, Trash2, X, ShieldAlert, FileText } from "lucide-react";
import { tmsApi, TMSAccidentFine, TMSVehicle, TMSDriver } from "../../api/tms";

export const AccidentsFinesPage: React.FC = () => {
  const [records, setRecords] = useState<TMSAccidentFine[]>([]);
  const [vehicles, setVehicles] = useState<TMSVehicle[]>([]);
  const [drivers, setDrivers] = useState<TMSDriver[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [formData, setFormData] = useState<any>({
    doc_type: "AF",
    doc_no: "",
    doc_date: new Date().toISOString().substring(0, 10),
    vehicle_code: "",
    emp_id: "",
    classification: "FINE",
    fine_code: "",
    amount: 0,
    location: "",
    accident_status: "PENDING",
    accident_date: new Date().toISOString().substring(0, 10),
    police_rep_no: "",
    insurance_claim_no: "",
    remarks: ""
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [aRes, vRes, dRes] = await Promise.all([
        tmsApi.getAccidentsFines(),
        tmsApi.getVehicles(),
        tmsApi.getDrivers()
      ]);
      if (aRes.success) setRecords(aRes.data || []);
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
      doc_type: "AF",
      doc_no: "",
      doc_date: new Date().toISOString().substring(0, 10),
      vehicle_code: vehicles.length > 0 ? vehicles[0].VEHICLE_NO : "",
      emp_id: drivers.length > 0 ? drivers[0].EMP_ID : "",
      classification: "FINE",
      fine_code: "SPEEDING",
      amount: 0,
      location: "",
      accident_status: "PENDING",
      accident_date: new Date().toISOString().substring(0, 10),
      police_rep_no: "",
      insurance_claim_no: "",
      remarks: ""
    });
    setModalOpen(true);
  };

  const handleDelete = async (docNo: string) => {
    if (!window.confirm(`Are you sure you want to delete record ${docNo}?`)) return;
    try {
      const res = await tmsApi.deleteAccidentFine(docNo);
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
      const res = await tmsApi.saveAccidentFine(formData);
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

  const filtered = records.filter(r =>
    (r.DOC_NO || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.VEHICLE_CODE || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.DRIVER_NAME || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.FINE_CODE || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.POLICE_REP_NO || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="text-rose-600" size={24} />
            Accidents & Traffic Fines
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Track traffic penalties, police reports, accident damage, and insurance claims.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search fine, vehicle, police ref..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <Plus size={16} />
            Record Fine / Accident
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
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Driver</th>
                <th className="py-3 px-4">Violation / Reason</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Police / Claim #</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-8 text-slate-400">Loading fine & accident records...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-slate-400">No records found.</td></tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.DOC_NO} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-rose-600">{r.DOC_NO}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {r.DOC_DATE ? new Date(r.DOC_DATE).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        r.CLASSIFICATION === "ACCIDENT" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {r.CLASSIFICATION || "FINE"}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{r.VEHICLE_CODE || "-"}</td>
                    <td className="py-3 px-4 text-xs">{r.DRIVER_NAME || r.EMP_ID || "-"}</td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">{r.FINE_CODE || "-"}</td>
                    <td className="py-3 px-4 text-xs font-bold text-slate-800">{Number(r.AMOUNT || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                      {r.POLICE_REP_NO || r.INSURANCE_CLAIM_NO || "-"}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        r.ACCIDENT_STATUS === "SETTLED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                      }`}>
                        {r.ACCIDENT_STATUS || "PENDING"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleDelete(r.DOC_NO)} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded">
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
              <h3 className="font-bold text-slate-800 text-base">Record Incident / Fine</h3>
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
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                  <select
                    value={formData.classification}
                    onChange={e => setFormData({ ...formData, classification: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="FINE">TRAFFIC FINE</option>
                    <option value="ACCIDENT">VEHICLE ACCIDENT</option>
                    <option value="VIOLATION">RTA / POLICE VIOLATION</option>
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
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
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
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fine / Incident Code</label>
                  <input
                    type="text"
                    value={formData.fine_code}
                    onChange={e => setFormData({ ...formData, fine_code: e.target.value })}
                    placeholder="e.g. SPEEDING, RED_LIGHT, COLLISION"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Penalty Amount</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Police Report No</label>
                  <input
                    type="text"
                    value={formData.police_rep_no}
                    onChange={e => setFormData({ ...formData, police_rep_no: e.target.value })}
                    placeholder="Police ref #"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Insurance Claim No</label>
                  <input
                    type="text"
                    value={formData.insurance_claim_no}
                    onChange={e => setFormData({ ...formData, insurance_claim_no: e.target.value })}
                    placeholder="Claim #"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Street or highway"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                  <select
                    value={formData.accident_status}
                    onChange={e => setFormData({ ...formData, accident_status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="SETTLED">SETTLED</option>
                    <option value="DISPUTED">DISPUTED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
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
                  className="px-5 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
