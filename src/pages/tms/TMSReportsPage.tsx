import React, { useEffect, useState } from "react";
import { BarChart3, Download, Printer, Filter, Calendar, FileSpreadsheet, RefreshCw } from "lucide-react";
import { tmsApi } from "../../api/tms";

interface ReportTab {
  id: string;
  name: string;
  description: string;
}

const reportTabs: ReportTab[] = [
  { id: "trip-register", name: "Trip Sheet Register", description: "All trip sheets, routes, odometer readings, revenue and drivers" },
  { id: "daily-activity", name: "Daily Trip Activity", description: "Daily aggregated trips, total kilometers, revenue and advances" },
  { id: "driver-efficiency", name: "Driver Efficiency", description: "Trips per driver, total mileage completed and earnings" },
  { id: "vehicle-efficiency", name: "Vehicle Efficiency", description: "Fleet mileage, trips completed and fuel cost per vehicle" },
  { id: "fuel-analysis", name: "Fuel Consumption Analysis", description: "Fuel filling totals, average rate and total expenditure by fuel type" },
];

export const TMSReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("trip-register");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReport = async (tabId: string) => {
    try {
      setLoading(true);
      const res = await tmsApi.getReport(tabId);
      if (res.success) {
        setData(res.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(activeTab);
  }, [activeTab]);

  const exportCSV = () => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(","),
      ...data.map(row => headers.map(h => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(","))
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `TMS_${activeTab}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="text-blue-600" size={24} />
            Transport Reports & Intelligence
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Comprehensive audit, efficiency metrics, trip logs and fuel consumption.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchReport(activeTab)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            disabled={data.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition disabled:opacity-50"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-2">
        {reportTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Report Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              {reportTabs.find(t => t.id === activeTab)?.name}
            </h2>
            <p className="text-xs text-slate-500">
              {reportTabs.find(t => t.id === activeTab)?.description}
            </p>
          </div>
          <span className="text-xs bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
            {data.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">Generating report...</div>
          ) : data.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">No report data found.</div>
          ) : (
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                <tr>
                  {Object.keys(data[0]).map(k => (
                    <th key={k} className="py-3 px-3.5 tracking-wider whitespace-nowrap">
                      {k.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {Object.keys(row).map(k => {
                      const val = row[k];
                      const isDate = k.includes("DATE") && val;
                      const isNumber = typeof val === "number";
                      return (
                        <td key={k} className={`py-2.5 px-3.5 whitespace-nowrap ${isNumber ? "font-mono" : ""}`}>
                          {isDate ? new Date(val).toLocaleDateString() : val !== null && val !== undefined ? String(val) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
