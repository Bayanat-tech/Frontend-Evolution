import React, { useEffect, useState } from "react";
import { Layers, Search } from "lucide-react";
import { tmsApi } from "../../api/tms";

export const VehicleTypesPage: React.FC = () => {
  const [types, setTypes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await tmsApi.getVehicleTypes();
        if (res.success) setTypes(res.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = types.filter(t =>
    (t.VTYPE_NAME || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.VTYPE_CODE || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.AXLE_TYPE || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="text-blue-600" size={24} />
            Vehicle Types & Specifications
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Reference specifications, axle types, tyre configurations and volumes.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search vehicle types..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full text-center py-10 text-slate-400">Loading vehicle types...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-10 text-slate-400">No vehicle types found.</div>
        ) : (
          filtered.map(t => (
            <div key={t.VTYPE_CODE} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 hover:border-blue-300 transition">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-base">{t.VTYPE_NAME}</span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md">
                  {t.VTYPE_CODE}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block">Axle Type:</span>
                  <span className="font-medium text-slate-700">{t.AXLE_TYPE || "Standard"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">No of Tyres:</span>
                  <span className="font-medium text-slate-700">{t.NO_OF_TYRES || "-"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Volume:</span>
                  <span className="font-medium text-slate-700">{t.VOLUMN ? `${t.VOLUMN} CBM` : "-"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Max Weight:</span>
                  <span className="font-medium text-slate-700">{t.WEIGHT ? `${t.WEIGHT} KG` : "-"}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
