import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  RefreshCw,
  Building2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { api } from "../../api/client";
import { formatDate } from "../../utils/date";

interface FreightJobFinancialAuditDialogProps {
  open: boolean;
  onClose: () => void;
  companyCode: string;
  prinCode: string;
  jobNo: string;
  prinName?: string;
  jobDate?: string;
  transportMode?: string;
  confirmedDate?: string;
  invoicedDate?: string;
}

interface ActivityLine {
  srno: string;
  act_code: string;
  activity: string;
  bill: number;
  bill_lcur: number;
  actual_cost: number;
  partners_price: number;
  transport_price: number;
  broker_code?: string;
  broker_name?: string;
  broker_acref?: string;
  transporter_code?: string;
  transporter_name?: string;
  transporter_ac_code?: string;
  invoice_no?: string;
  pi_no?: string;
  ac_curr_code?: string;
  partner_curr_code?: string;
  tp_curr_code?: string;
  vehicle_no?: string;
}

interface BookedPILine {
  DOC_NO: string;
  DOC_DATE: string;
  AC_CODE: string;
  AMOUNT: number;
  REMARKS: string;
  DOC_REFNO?: string;
}

export function FreightJobFinancialAuditDialog({
  open,
  onClose,
  companyCode,
  prinCode,
  jobNo,
  prinName = "",
  jobDate = "",
  transportMode = "",
  confirmedDate = "",
  invoicedDate = "",
}: FreightJobFinancialAuditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [header, setHeader] = useState<any>(null);
  const [lines, setLines] = useState<ActivityLine[]>([]);
  const [bookedPIList, setBookedPIList] = useState<BookedPILine[]>([]);
  const [activeTab, setActiveTab] = useState<"summary" | "vendor_costs" | "customer_revenue">("summary");
  const [costFilter, setCostFilter] = useState<"all" | "booked" | "unbooked">("all");

  const loadFinancialData = async () => {
    if (!companyCode || !jobNo) return;
    setLoading(true);
    try {
      const response = await api.post<{
        success?: boolean;
        data?: { header?: any; lines?: any[]; booked_pi?: any[] };
      }>("/api/freight/job-activities/get", {
        company_code: companyCode,
        prin_code: prinCode,
        job_no: jobNo,
      });

      const data = response.data?.data;
      setHeader(data?.header || null);
      setLines(Array.isArray(data?.lines) ? data!.lines : []);
      setBookedPIList(Array.isArray(data?.booked_pi) ? data!.booked_pi : []);
    } catch (err) {
      console.error("Failed to load freight job financial audit data:", err);
      setLines([]);
      setBookedPIList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadFinancialData();
    }
  }, [open, companyCode, prinCode, jobNo]);

  // Helper to match booked PI
  const findBookedDoc = (costType: string, actCode: string, amount: number) => {
    if (!bookedPIList.length) return undefined;
    const match = bookedPIList.find((pi) => {
      const rem = String(pi.REMARKS || "").toUpperCase();
      const typeMatch =
        costType === "Agent Cost"
          ? rem.includes("AGENT") || rem.includes("BROKER")
          : costType === "Transporter Cost"
          ? rem.includes("TRANS")
          : rem.includes("OTHER") || rem.includes("ACTUAL");
      const actMatch = rem.includes(actCode.toUpperCase());
      const amtMatch = Math.abs(Number(pi.AMOUNT) - amount) < 0.001;
      return (typeMatch && actMatch) || (typeMatch && amtMatch);
    });
    return match ? { docNo: match.DOC_NO, date: match.DOC_DATE } : undefined;
  };

  // Flattened cost lines
  const costLines = useMemo(() => {
    const list: Array<{
      key: string;
      srno: string;
      cost_type: "Agent Cost" | "Transporter Cost" | "Other Cost";
      act_code: string;
      activity: string;
      vendor_code: string;
      vendor_name: string;
      amount: number;
      curr: string;
      isBooked: boolean;
      bookedDoc?: string;
      bookedDate?: string;
      vehicle_no?: string;
    }> = [];

    lines.forEach((act, idx) => {
      const srno = String(act.srno || idx + 1);
      const actCode = act.act_code || "";
      const activity = act.activity || actCode;

      // 1. Agent Cost
      const partnerPrice = Number(act.partners_price || 0);
      if (partnerPrice > 0) {
        const booked = findBookedDoc("Agent Cost", actCode, partnerPrice);
        list.push({
          key: `${srno}_AGENT`,
          srno,
          cost_type: "Agent Cost",
          act_code: actCode,
          activity,
          vendor_code: act.broker_acref || act.broker_code || "",
          vendor_name: act.broker_name || "Overseas Agent / Broker",
          amount: partnerPrice,
          curr: act.partner_curr_code || "OMR",
          isBooked: Boolean(booked),
          bookedDoc: booked?.docNo,
          bookedDate: booked?.date,
        });
      }

      // 2. Transporter Cost
      const transportPrice = Number(act.transport_price || 0);
      if (transportPrice > 0) {
        const booked = findBookedDoc("Transporter Cost", actCode, transportPrice);
        list.push({
          key: `${srno}_TRANS`,
          srno,
          cost_type: "Transporter Cost",
          act_code: actCode,
          activity,
          vendor_code: act.transporter_ac_code || act.transporter_code || "",
          vendor_name: act.transporter_name || "Transporter",
          amount: transportPrice,
          curr: act.tp_curr_code || "OMR",
          isBooked: Boolean(booked),
          bookedDoc: booked?.docNo,
          bookedDate: booked?.date,
          vehicle_no: act.vehicle_no,
        });
      }

      // 3. Other Cost
      const actualCost = Number(act.actual_cost || 0);
      if (actualCost > 0) {
        const booked = findBookedDoc("Other Cost", actCode, actualCost);
        list.push({
          key: `${srno}_OTHER`,
          srno,
          cost_type: "Other Cost",
          act_code: actCode,
          activity,
          vendor_code: act.broker_acref || act.broker_code || "",
          vendor_name: act.broker_name || "Direct / Port Cost",
          amount: actualCost,
          curr: act.ac_curr_code || "OMR",
          isBooked: Boolean(booked),
          bookedDoc: booked?.docNo,
          bookedDate: booked?.date,
        });
      }
    });

    return list;
  }, [lines, bookedPIList]);

  // Financial KPIs
  const totalRevenue = useMemo(() => {
    return lines.reduce((acc, l) => acc + Number(l.bill || 0), 0);
  }, [lines]);

  const totalCost = useMemo(() => {
    return costLines.reduce((acc, l) => acc + l.amount, 0);
  }, [costLines]);

  const bookedCost = useMemo(() => {
    return costLines.filter((l) => l.isBooked).reduce((acc, l) => acc + l.amount, 0);
  }, [costLines]);

  const pendingCost = totalCost - bookedCost;
  const grossProfit = totalRevenue - totalCost;
  const marginPercentage = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const distinctBookedPIs = useMemo(() => {
    return Array.from(new Set(costLines.map((l) => l.bookedDoc).filter(Boolean)));
  }, [costLines]);

  const filteredCostLines = useMemo(() => {
    if (costFilter === "booked") return costLines.filter((l) => l.isBooked);
    if (costFilter === "unbooked") return costLines.filter((l) => !l.isBooked);
    return costLines;
  }, [costLines, costFilter]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Financial Audit 360° • Job #${jobNo}`}
      wide
      footer={
        <div className="flex w-full items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
            <span>Audit Key: {jobNo}</span>
            <span>•</span>
            <span>Lines: {lines.length}</span>
            <span>•</span>
            <span>Vendor Costs: {costLines.length}</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close Audit
          </Button>
        </div>
      }
    >
      <div className="flex h-[min(82vh,700px)] w-full flex-col gap-3 overflow-hidden text-xs">
        {/* Job Identity Card */}
        <div className="flex flex-wrap items-center justify-between rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2 shrink-0 gap-2 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-[#00378C] text-white font-bold text-xs">
              {transportMode ? transportMode.slice(0, 2).toUpperCase() : "JB"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-[#00378C]">{jobNo}</span>
                <span className="text-[11px] text-slate-500 font-medium">{formatDate(jobDate)}</span>
              </div>
              <div className="text-[11px] font-semibold text-slate-800">
                {prinName || header?.PRIN_NAME || prinCode} <span className="font-mono text-slate-400 font-normal">({prinCode})</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {confirmedDate && (
              <span className="inline-flex items-center gap-1 rounded bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                <ShieldCheck size={11} className="text-sky-600" /> Confirmed {formatDate(confirmedDate)}
              </span>
            )}
            {invoicedDate ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <CheckCircle2 size={11} className="text-emerald-600" /> Invoiced {formatDate(invoicedDate)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                <Clock size={11} className="text-amber-600" /> Pending Customer SI
              </span>
            )}
            {costLines.length > 0 && (
              <span
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold border ${
                  bookedCost >= totalCost && totalCost > 0
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : bookedCost > 0
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : "bg-slate-100 border-slate-200 text-slate-700"
                }`}
              >
                {bookedCost >= totalCost && totalCost > 0
                  ? "Fully Booked (PI)"
                  : bookedCost > 0
                  ? "Partially Booked (PI)"
                  : "Unbooked Costs"}
              </span>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-slate-500 hover:text-slate-800 ml-1"
              onClick={loadFinancialData}
              title="Refresh financial data"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {/* 4 Financial KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 shrink-0">
          {/* 1. Customer Revenue */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2.5 shadow-2xs">
            <div className="flex items-center justify-between text-blue-900 text-[11px] font-semibold">
              <span>Customer Revenue (SI)</span>
              <Receipt size={14} className="text-blue-700" />
            </div>
            <div className="mt-1 font-mono text-base font-bold text-blue-950">
              {totalRevenue.toFixed(3)} <span className="text-[10px] font-normal text-slate-500">OMR</span>
            </div>
            <div className="text-[10px] text-blue-700 mt-0.5">
              {invoicedDate ? "Billed to Customer" : "Estimated from Activities"}
            </div>
          </div>

          {/* 2. Booked Costs */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-900 text-[11px] font-semibold">
              <span>Booked in PI (Actual)</span>
              <CheckCircle2 size={14} className="text-emerald-700" />
            </div>
            <div className="mt-1 font-mono text-base font-bold text-emerald-950">
              {bookedCost.toFixed(3)} <span className="text-[10px] font-normal text-slate-500">OMR</span>
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5 truncate">
              {distinctBookedPIs.length > 0 ? `${distinctBookedPIs.length} Invoice(s): ${distinctBookedPIs.join(", ")}` : "None Booked Yet"}
            </div>
          </div>

          {/* 3. Pending Vendor Costs */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 shadow-2xs">
            <div className="flex items-center justify-between text-amber-900 text-[11px] font-semibold">
              <span>Pending Vendor Costs</span>
              <Clock size={14} className="text-amber-700" />
            </div>
            <div className="mt-1 font-mono text-base font-bold text-amber-950">
              {pendingCost.toFixed(3)} <span className="text-[10px] font-normal text-slate-500">OMR</span>
            </div>
            <div className="text-[10px] text-amber-700 mt-0.5">
              {pendingCost > 0 ? "Awaiting Vendor PI" : "All Costs Booked"}
            </div>
          </div>

          {/* 4. Profit & Gross Margin */}
          <div
            className={`rounded-lg border p-2.5 shadow-2xs ${
              grossProfit >= 0 ? "border-emerald-300 bg-emerald-100/40" : "border-rose-300 bg-rose-50"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800">
              <span>Gross Margin / P&L</span>
              {grossProfit >= 0 ? (
                <TrendingUp size={14} className="text-emerald-700" />
              ) : (
                <TrendingDown size={14} className="text-rose-700" />
              )}
            </div>
            <div
              className={`mt-1 font-mono text-base font-bold ${
                grossProfit >= 0 ? "text-emerald-900" : "text-rose-900"
              }`}
            >
              {grossProfit.toFixed(3)} <span className="text-[10px] font-normal text-slate-500">OMR</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
              <span
                className={`font-bold rounded px-1.5 py-0.2 ${
                  grossProfit >= 0 ? "bg-emerald-200 text-emerald-900" : "bg-rose-200 text-rose-900"
                }`}
              >
                {marginPercentage.toFixed(1)}% Margin
              </span>
              <span className="text-slate-500">({totalCost.toFixed(3)} Total Cost)</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation & Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-200 shrink-0 pt-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "summary"
                  ? "border-[#00378C] text-[#00378C] bg-blue-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Cost & Profit Summary ({costLines.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("vendor_costs")}
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "vendor_costs"
                  ? "border-[#00378C] text-[#00378C] bg-blue-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Vendor Purchase Bookings (PI)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("customer_revenue")}
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "customer_revenue"
                  ? "border-[#00378C] text-[#00378C] bg-blue-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Customer Revenue (SI) ({lines.length})
            </button>
          </div>

          {activeTab === "vendor_costs" && (
            <div className="flex items-center gap-1 pb-1">
              <span className="text-[11px] font-medium text-slate-500">Status:</span>
              <select
                value={costFilter}
                onChange={(e) => setCostFilter(e.target.value as any)}
                className="h-6 text-[11px] font-semibold rounded border border-slate-300 bg-white px-2 py-0 text-slate-800 shadow-2xs focus:border-[#00378C]"
              >
                <option value="all">All Costs ({costLines.length})</option>
                <option value="booked">Booked in PI Only ({costLines.filter((l) => l.isBooked).length})</option>
                <option value="unbooked">Pending Booking ({costLines.filter((l) => !l.isBooked).length})</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Comprehensive Summary Table */}
        <div className="flex-1 overflow-auto rounded border border-slate-200 bg-white shadow-2xs">
          {loading ? (
            <div className="flex h-full items-center justify-center p-8 text-slate-500">
              <RefreshCw size={16} className="animate-spin mr-2 text-[#00378C]" /> Loading financial audit records...
            </div>
          ) : activeTab === "summary" || activeTab === "vendor_costs" ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#00378C] text-[11px] font-semibold text-white shadow-sm z-10">
                <tr>
                  <th className="p-2 w-10 text-white border-r border-white/15">Sr#</th>
                  <th className="p-2 w-28 text-white border-r border-white/15">Cost Type</th>
                  <th className="p-2 text-white border-r border-white/15">Service Activity</th>
                  <th className="p-2 w-44 text-white border-r border-white/15">Vendor / Party</th>
                  <th className="p-2 w-24 text-right text-white border-r border-white/15">Amount (OMR)</th>
                  <th className="p-2 w-44 text-white">Purchase Invoice (PI) Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCostLines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      No vendor costs recorded for this view.
                    </td>
                  </tr>
                ) : (
                  filteredCostLines.map((item) => (
                    <tr
                      key={item.key}
                      className={`hover:bg-slate-50 transition-colors ${
                        item.isBooked ? "bg-emerald-50/25" : ""
                      }`}
                    >
                      <td className="p-2 font-mono text-[11px] text-slate-500">{item.srno}</td>
                      <td className="p-2">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            item.cost_type === "Agent Cost"
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : item.cost_type === "Transporter Cost"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-slate-200 text-slate-800 border border-slate-300"
                          }`}
                        >
                          {item.cost_type}
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="font-semibold text-slate-900">{item.activity}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{item.act_code}</div>
                      </td>
                      <td className="p-2">
                        <div className="font-medium text-slate-800 truncate">{item.vendor_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {item.vendor_code || "-"}{item.vehicle_no ? ` | Veh: ${item.vehicle_no}` : ""}
                        </div>
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">
                        {item.amount.toFixed(3)}
                      </td>
                      <td className="p-2">
                        {item.isBooked ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 border border-emerald-300 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-900 shadow-2xs">
                              <CheckCircle2 size={11} className="text-emerald-700" /> {item.bookedDoc}
                            </span>
                            {item.bookedDate && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {formatDate(item.bookedDate)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            <Clock size={11} className="text-amber-600" /> Pending Booking
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* Tab 3: Customer Revenue (SI) */
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#00378C] text-[11px] font-semibold text-white shadow-sm z-10">
                <tr>
                  <th className="p-2 w-10 text-white border-r border-white/15">Sr#</th>
                  <th className="p-2 text-white border-r border-white/15">Billed Service Activity</th>
                  <th className="p-2 w-28 text-white border-r border-white/15">Activity Code</th>
                  <th className="p-2 w-28 text-right text-white border-r border-white/15">Bill Amount (OMR)</th>
                  <th className="p-2 w-48 text-white">Sales Invoice (SI) Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">
                      No service revenue lines found on this job.
                    </td>
                  </tr>
                ) : (
                  lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 font-mono text-[11px] text-slate-500">{line.srno || idx + 1}</td>
                      <td className="p-2 font-semibold text-slate-900">{line.activity || line.act_code}</td>
                      <td className="p-2 font-mono text-[11px] text-slate-500">{line.act_code}</td>
                      <td className="p-2 text-right font-mono font-bold text-blue-900">
                        {Number(line.bill || 0).toFixed(3)}
                      </td>
                      <td className="p-2">
                        {line.invoice_no ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 border border-emerald-300 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-900">
                            <CheckCircle2 size={11} className="text-emerald-700" /> {line.invoice_no}
                          </span>
                        ) : invoicedDate ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            <CheckCircle2 size={11} className="text-emerald-600" /> Invoiced {formatDate(invoicedDate)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            <Clock size={11} className="text-amber-600" /> Pending Invoicing
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Dialog>
  );
}
