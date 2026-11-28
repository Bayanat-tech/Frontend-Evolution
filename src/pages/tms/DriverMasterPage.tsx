import React, { useEffect, useState } from "react";
import { UserCheck, Plus, Search, Edit2, Trash2, X, Phone, Mail, FileBadge } from "lucide-react";
import { tmsApi, TMSDriver } from "../../api/tms";

export const DriverMasterPage: React.FC = () => {
  const [drivers, setDrivers] = useState<TMSDriver[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<TMSDriver | null>(null);

  const [formData, setFormData] = useState<any>({
    emp_id: "",
    emp_name: "",
    mobile_no: "",
    phone_no: "",
    e_mail: "",
    driving_lic_no: "",
    issue_place: "",
    issue_date: "",
    valid_upto: "",
    permanent_address: "",
    empstatus_code: "ACTIVE"
  });

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const res = await tmsApi.getDrivers();
      if (res.success) setDrivers(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, []);

  const openNew = () => {
    setEditingDriver(null);
    setFormData({
      emp_id: "",
      emp_name: "",
      mobile_no: "",
      phone_no: "",
      e_mail: "",
      driving_lic_no: "",
      issue_place: "",
      issue_date: "",
      valid_upto: "",
      permanent_address: "",
      empstatus_code: "ACTIVE"
    });
    setModalOpen(true);
  };

  const openEdit = (d: TMSDriver) => {
    setEditingDriver(d);
    setFormData({
      emp_id: d.EMP_ID,
      emp_name: d.EMP_NAME,
      mobile_no: d.MOBILE_NO || "",
      phone_no: d.PHONE_NO || "",
      e_mail: d.E_MAIL || "",
      driving_lic_no: d.DRIVING_LIC_NO || "",
      issue_place: d.ISSUE_PLACE || "",
      issue_date: d.ISSUE_DATE ? d.ISSUE_DATE.substring(0, 10) : "",
      valid_upto: d.VALID_UPTO ? d.VALID_UPTO.substring(0, 10) : "",
      permanent_address: d.PERMANENT_ADDRESS || "",
      empstatus_code: d.EMPSTATUS_CODE || "ACTIVE"
    });
    setModalOpen(true);
  };

  const handleDelete = async (empId: string) => {
    if (!window.confirm(`Are you sure you want to delete driver ${empId}?`)) return;
    try {
      const res = await tmsApi.deleteDriver(empId);
      if (res.success) {
        loadDrivers();
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
      const res = await tmsApi.saveDriver(formData);
      if (res.success) {
        setModalOpen(false);
        loadDrivers();
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filtered = drivers.filter(d => 
    (d.EMP_NAME || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.EMP_ID || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.DRIVING_LIC_NO || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="text-blue-600" size={24} />
            Driver Master
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Manage drivers, licenses, permits, and active status.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search driver or license..."
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
            Add Driver
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Driver ID</th>
                <th className="py-3 px-4">Driver Name</th>
                <th className="py-3 px-4">License No</th>
                <th className="py-3 px-4">License Expiry</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading drivers...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">No driver records found.</td></tr>
              ) : (
                filtered.map(d => (
                  <tr key={d.EMP_ID} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-blue-600">{d.EMP_ID}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{d.EMP_NAME}</td>
                    <td className="py-3 px-4 text-slate-600 flex items-center gap-1.5 mt-1">
                      <FileBadge size={14} className="text-slate-400" />
                      {d.DRIVING_LIC_NO || "-"}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {d.VALID_UPTO ? new Date(d.VALID_UPTO).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {d.MOBILE_NO && <div className="flex items-center gap-1"><Phone size={12} /> {d.MOBILE_NO}</div>}
                      {d.E_MAIL && <div className="flex items-center gap-1 text-slate-400"><Mail size={12} /> {d.E_MAIL}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        d.EMPSTATUS_CODE === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                      }`}>
                        {d.EMPSTATUS_CODE || "ACTIVE"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button onClick={() => openEdit(d)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(d.EMP_ID)} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded">
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
                {editingDriver ? `Edit Driver (${editingDriver.EMP_ID})` : "New Driver Registration"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Driver Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.emp_name}
                  onChange={e => setFormData({ ...formData, emp_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mobile No</label>
                  <input
                    type="text"
                    value={formData.mobile_no}
                    onChange={e => setFormData({ ...formData, mobile_no: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.e_mail}
                    onChange={e => setFormData({ ...formData, e_mail: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">License No</label>
                  <input
                    type="text"
                    value={formData.driving_lic_no}
                    onChange={e => setFormData({ ...formData, driving_lic_no: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Issue Place</label>
                  <input
                    type="text"
                    value={formData.issue_place}
                    onChange={e => setFormData({ ...formData, issue_place: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={formData.issue_date}
                    onChange={e => setFormData({ ...formData, issue_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">License Expiry Date</label>
                  <input
                    type="date"
                    value={formData.valid_upto}
                    onChange={e => setFormData({ ...formData, valid_upto: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Address</label>
                <textarea
                  rows={2}
                  value={formData.permanent_address}
                  onChange={e => setFormData({ ...formData, permanent_address: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                <select
                  value={formData.empstatus_code}
                  onChange={e => setFormData({ ...formData, empstatus_code: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="ON_LEAVE">ON LEAVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
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
                  Save Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
