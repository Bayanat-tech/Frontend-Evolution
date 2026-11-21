import React, { useEffect, useState } from "react";
import { ClipboardList, Plus, Search, Trash2, X, PlusCircle } from "lucide-react";
import { tmsApi, TMSRequest } from "../../api/tms";

export const TransportRequestPage: React.FC = () => {
  const [requests, setRequests] = useState<TMSRequest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [formData, setFormData] = useState<any>({
    doc_type: "TR",
    doc_no: 0,
    doc_date: new Date().toISOString().substring(0, 10),
    requested_by: "",
    requested_date: new Date().toISOString().substring(0, 10),
    job_type: "DELIVERY",
    dept_code: "LOGISTICS",
    priority: "N",
    remarks: "",
    items: [
      { start_point: "", end_point: "", cust_code: "", total_volume: 0, total_tonnage: 0, remarks: "" }
    ]
  });

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await tmsApi.getRequests();
      if (res.success) setRequests(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const openNew = () => {
    setFormData({
      doc_type: "TR",
      doc_no: 0,
      doc_date: new Date().toISOString().substring(0, 10),
      requested_by: "",
      requested_date: new Date().toISOString().substring(0, 10),
      job_type: "DELIVERY",
      dept_code: "LOGISTICS",
      priority: "N",
      remarks: "",
      items: [
        { start_point: "", end_point: "", cust_code: "", total_volume: 0, total_tonnage: 0, remarks: "" }
      ]
    });
    setModalOpen(true);
  };

  const addItemRow = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { start_point: "", end_point: "", cust_code: "", total_volume: 0, total_tonnage: 0, remarks: "" }
      ]
    });
  };

  const removeItemRow = (idx: number) => {
    if (formData.items.length <= 1) return;
    setFormData({
      ...formData,
      items: formData.items.filter((_: any, i: number) => i !== idx)
    });
  };

  const updateItem = (idx: number, field: string, val: any) => {
    const updated = [...formData.items];
    updated[idx] = { ...updated[idx], [field]: val };
    setFormData({ ...formData, items: updated });
  };

  const handleDelete = async (docNo: number) => {
    if (!window.confirm(`Are you sure you want to delete transport request TR-${docNo}?`)) return;
    try {
      const res = await tmsApi.deleteRequest(docNo);
      if (res.success) {
        loadRequests();
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
      const res = await tmsApi.saveRequest(formData);
      if (res.success) {
        setModalOpen(false);
        loadRequests();
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filtered = requests.filter(r =>
    String(r.DOC_NO).includes(search) ||
    (r.REQUESTED_BY || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.REMARKS || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="text-blue-600" size={24} />
            Transport Requests
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Booking orders, customer requirements, dispatch scheduling.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search request #, user..."
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
            New Request
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Doc No</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Requested By</th>
                <th className="py-3 px-4">Job Type</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading requests...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">No transport requests found.</td></tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.DOC_NO} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-blue-600">TR-{r.DOC_NO}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {r.DOC_DATE ? new Date(r.DOC_DATE).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{r.REQUESTED_BY || "-"}</td>
                    <td className="py-3 px-4 text-xs">{r.JOB_TYPE || "LOCAL"}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        r.PRIORITY === "Y" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600"
                      }`}>
                        {r.PRIORITY === "Y" ? "HIGH" : "NORMAL"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate">{r.REMARKS || "-"}</td>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-base">New Transport Request</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Doc Date</label>
                  <input
                    type="date"
                    value={formData.doc_date}
                    onChange={e => setFormData({ ...formData, doc_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Requested By</label>
                  <input
                    type="text"
                    value={formData.requested_by}
                    onChange={e => setFormData({ ...formData, requested_by: e.target.value })}
                    placeholder="Requester name"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Job Type</label>
                  <select
                    value={formData.job_type}
                    onChange={e => setFormData({ ...formData, job_type: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DELIVERY">DELIVERY</option>
                    <option value="PICKUP">PICKUP</option>
                    <option value="INTERNAL_TRANSFER">INTERNAL TRANSFER</option>
                    <option value="EXPORT">EXPORT</option>
                    <option value="IMPORT">IMPORT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="N">NORMAL</option>
                    <option value="Y">HIGH / URGENT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks</label>
                  <input
                    type="text"
                    value={formData.remarks}
                    onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Pickup / Delivery Lines</h4>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    <PlusCircle size={14} /> Add Line
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.items.map((it: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Origin Point"
                          value={it.start_point}
                          onChange={e => updateItem(i, "start_point", e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Destination Point"
                          value={it.end_point}
                          onChange={e => updateItem(i, "end_point", e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                        />
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          placeholder="Vol (CBM)"
                          value={it.total_volume}
                          onChange={e => updateItem(i, "total_volume", Number(e.target.value))}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                        />
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          placeholder="Tonnage (KG)"
                          value={it.total_tonnage}
                          onChange={e => updateItem(i, "total_tonnage", Number(e.target.value))}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                        />
                      </div>
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(i)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
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
                  Create Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
