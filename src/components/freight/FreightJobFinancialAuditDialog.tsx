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
  srno?: string;
  SRNO?: string;
  act_code?: string;
  ACT_CODE?: string;
  activity?: string;
  ACTIVITY?: string;
  other_services?: string;
  OTHER_SERVICES?: string;
  bill?: number;
  BILL?: number;
  bill_oc?: number;
  BILL_OC?: number;
  bill_lcur?: number;
  actual_cost?: number;
  ACTUAL_COST?: number;
  partners_price?: number;
  PARTNERS_PRICE?: number;
  transport_price?: number;
  TRANSPORT_PRICE?: number;
  broker_code?: string;
  BROKER_CODE?: string;
  broker_name?: string;
  BROKER_NAME?: string;
  broker_acref?: string;
  BROKER_ACREF?: string;
  transporter_code?: string;
  TRANSPORTER_CODE?: string;
  transporter_name?: string;
  TRANSPORTER_NAME?: string;
  transporter_ac_code?: string;
  TRANSPORTER_AC_CODE?: string;
  consolidated_invno?: string;
  CONSOLIDATED_INVNO?: string;
  invoice_no?: string;
  INVOICE_NO?: string;
  pi_no?: string;
  PI_NO?: string;
  ac_curr_code?: string;
  partner_curr_code?: string;
  tp_curr_code?: string;
  vehicle_no?: string;
  VEHICLE_NO?: string;
}

interface BookedPILine {
  DOC_NO?: string;
  doc_no?: string;
  DOC_DATE?: string;
  doc_date?: string;
  AC_CODE?: string;
  ac_code?: string;
  AMOUNT?: number;
  amount?: number;
  REMARKS?: string;
  remarks?: string;
  DOC_REFNO?: string;
  JOB_NO?: string;
}

interface SalesInvoiceRecord {
  DOC_TYPE?: string;
  DOC_NO?: string;
  DOC_DATE?: string;
  REF_NO?: string;
  NET_AMOUNT?: number;
  GROSS_AMOUNT?: number;
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
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoiceRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"summary" | "vendor_costs" | "customer_revenue">("summary");
  const [costFilter, setCostFilter] = useState<"all" | "booked" | "unbooked">("all");

  const loadFinancialData = async () => {
    if (!companyCode || !jobNo) return;
    setLoading(true);
    try {
      const response = await api.post<{
        success?: boolean;
        data?: { header?: any; lines?: any[]; booked_pi?: any[]; sales_invoices?: any[] };
      }>("/api/freight/job-activities/get", {
        company_code: companyCode,
        prin_code: prinCode,
        job_no: jobNo,
      });

      const data = response.data?.data;
      setHeader(data?.header || null);
      setLines(Array.isArray(data?.lines) ? data!.lines : []);
      setBookedPIList(Array.isArray(data?.booked_pi) ? data!.booked_pi : []);
      setSalesInvoices(Array.isArray(data?.sales_invoices) ? data!.sales_invoices : []);
    } catch (err) {
      console.error("Failed to load freight job financial audit data:", err);
      setLines([]);
      setBookedPIList([]);
      setSalesInvoices([]);
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
  const findBookedDoc = (costType: string, actCode: string, amount: number, fallbackPiNo?: string) => {
    if (bookedPIList.length > 0) {
      const match = bookedPIList.find((pi) => {
        const rem = String(pi.REMARKS || pi.remarks || "").toUpperCase();
        const docJob = String(pi.JOB_NO || "").trim().toUpperCase();
        const typeMatch =
          costType === "Agent Cost"
            ? rem.includes("AGENT") || rem.includes("BROKER")
            : costType === "Transporter Cost"
            ? rem.includes("TRANS")
            : rem.includes("OTHER") || rem.includes("ACTUAL");
        const actMatch = actCode ? rem.includes(actCode.toUpperCase()) : false;
        const amtMatch = Math.abs(Number(pi.AMOUNT ?? pi.amount ?? 0) - amount) < 0.001;

        if (typeMatch && (actMatch || amtMatch)) return true;
        if (actMatch && amtMatch) return true;
        if (docJob === jobNo.toUpperCase() && amtMatch) return true;
        return false;
      });
      if (match) {
        return {
          docNo: match.DOC_NO || match.doc_no || "",
          date: match.DOC_DATE || match.doc_date || "",
        };
      }
    }

    if (fallbackPiNo && fallbackPiNo.trim()) {
      return { docNo: fallbackPiNo.trim(), date: "" };
    }

    return undefined;
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

    lines.forEach((act: any, idx: number) => {
      const srno = String(act.srno ?? act.SRNO ?? idx + 1);
      const actCode = String(act.act_code ?? act.ACT_CODE ?? "");
      const activity = String(act.activity ?? act.ACTIVITY ?? act.other_services ?? act.OTHER_SERVICES ?? actCode);
      const piNoDb = String(act.pi_no ?? act.PI_NO ?? "").trim();

      // 1. Agent Cost
      const partnerPrice = Number(act.partners_price ?? act.PARTNERS_PRICE ?? 0);
      if (partnerPrice > 0) {
        const booked = findBookedDoc("Agent Cost", actCode, partnerPrice, piNoDb);
        const brokerAcref = String(act.broker_acref ?? act.BROKER_ACREF ?? "").trim();
        const brokerCode = String(act.broker_code ?? act.BROKER_CODE ?? "").trim();
        const brokerName = String(act.broker_name ?? act.BROKER_NAME ?? "").trim();
        const curr = String(act.partner_curr_code ?? act.PARTNER_CURR_CODE ?? "OMR");

        list.push({
          key: `${srno}_AGENT`,
          srno,
          cost_type: "Agent Cost",
          act_code: actCode,
          activity,
          vendor_code: brokerAcref || brokerCode,
          vendor_name: brokerName || "Overseas Agent / Broker",
          amount: partnerPrice,
          curr,
          isBooked: Boolean(booked),
          bookedDoc: booked?.docNo,
          bookedDate: booked?.date,
        });
      }

      // 2. Transporter Cost
      const transportPrice = Number(act.transport_price ?? act.TRANSPORT_PRICE ?? 0);
      if (transportPrice > 0) {
        const booked = findBookedDoc("Transporter Cost", actCode, transportPrice, piNoDb);
        const transporterAcCode = String(act.transporter_ac_code ?? act.TRANSPORTER_AC_CODE ?? "").trim();
        const transporterCode = String(act.transporter_code ?? act.TRANSPORTER_CODE ?? "").trim();
        const transporterName = String(act.transporter_name ?? act.TRANSPORTER_NAME ?? "").trim();
        const vehicleNo = String(act.vehicle_no ?? act.VEHICLE_NO ?? "").trim();
        const curr = String(act.tp_curr_code ?? act.TP_CURR_CODE ?? "OMR");

        list.push({
          key: `${srno}_TRANS`,
          srno,
          cost_type: "Transporter Cost",
          act_code: actCode,
          activity,
          vendor_code: transporterAcCode || transporterCode,
          vendor_name: transporterName || "Transporter",
          amount: transportPrice,
          curr,
          isBooked: Boolean(booked),
          bookedDoc: booked?.docNo,
          bookedDate: booked?.date,
          vehicle_no: vehicleNo,
        });
      }

      // 3. Other Cost
      const actualCost = Number(act.actual_cost ?? act.ACTUAL_COST ?? 0);
      if (actualCost > 0) {
        const booked = findBookedDoc("Other Cost", actCode, actualCost, piNoDb);
        const brokerAcref = String(act.broker_acref ?? act.BROKER_ACREF ?? "").trim();
        const brokerCode = String(act.broker_code ?? act.BROKER_CODE ?? "").trim();
        const brokerName = String(act.broker_name ?? act.BROKER_NAME ?? "").trim();
        const curr = String(act.ac_curr_code ?? act.AC_CURR_CODE ?? "OMR");

        list.push({
          key: `${srno}_OTHER`,
          srno,
          cost_type: "Other Cost",
          act_code: actCode,
          activity,
          vendor_code: brokerAcref || brokerCode,
          vendor_name: brokerName || "Direct / Port Cost",
          amount: actualCost,
          curr,
          isBooked: Boolean(booked),
          bookedDoc: booked?.docNo,
          bookedDate: booked?.date,
        });
      }
    });

    return list;
  }, [lines, bookedPIList, jobNo]);

  // Financial KPIs
  const totalRevenue = useMemo(() => {
    const sumLines = lines.reduce((acc, l: any) => {
      const amt = Number(l.bill ?? l.BILL ?? l.bill_oc ?? l.BILL_OC ?? 0);
      return acc + amt;
    }, 0);
    if (sumLines > 0) return sumLines;
    const hdrRev = Number(header?.revenue ?? header?.REVENUE ?? 0);
    return hdrRev;
  }, [lines, header]);

  const totalCost = useMemo(() => {
    return costLines.reduce((acc, l) => acc + l.amount, 0);
  }, [costLines]);

  const bookedCost = useMemo(() => {
    return costLines.filter((l) => l.isBooked).reduce((acc, l) => acc + l.amount, 0);
  }, [costLines]);

  const pendingCost = Math.max(0, totalCost - bookedCost);
  const grossProfit = totalRevenue - totalCost;
  const marginPercentage = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const distinctBookedPIs = useMemo(() => {
    return Array.from(new Set(costLines.map((l) => l.bookedDoc).filter(Boolean)));
  }, [costLines]);

  const primarySalesInvoice = useMemo<SalesInvoiceRecord | null>(() => {
    if (salesInvoices.length > 0) {
      return salesInvoices[0];
    }
    // Check line for consolidated_invno
    for (const l of lines as any[]) {
      const inv = l.consolidated_invno || l.CONSOLIDATED_INVNO || l.invoice_no || l.INVOICE_NO;
      if (inv) return { DOC_NO: String(inv), DOC_TYPE: "SI", REF_NO: String(inv) };
    }
    return null;
  }, [salesInvoices, lines]);

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
                <span className="text-[11px] text-slate-500 font-medium">{formatDate(jobDate || header?.JOB_DATE || header?.job_date)}</span>
              </div>
              <div className="text-[11px] font-semibold text-slate-800">
                {prinName || header?.PRIN_NAME || header?.prin_name || prinCode} <span className="font-mono text-slate-400 font-normal">({prinCode})</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(confirmedDate || header?.CONFIRM_DATE || header?.confirm_date) && (
              <span className="inline-flex items-center gap-1 rounded bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                <ShieldCheck size={11} className="text-sky-600" /> Confirmed {formatDate(confirmedDate || header?.CONFIRM_DATE || header?.confirm_date)}
              </span>
            )}
            {(invoicedDate || header?.INVOICE_DATE || header?.invoice_date || primarySalesInvoice) ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <CheckCircle2 size={11} className="text-emerald-600" /> Invoiced {primarySalesInvoice ? primarySalesInvoice.DOC_NO : formatDate(invoicedDate || header?.INVOICE_DATE)}
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
            <div className="text-[10px] text-blue-700 mt-0.5 truncate">
              {primarySalesInvoice ? `SI: ${primarySalesInvoice.DOC_NO}` : invoicedDate ? "Billed to Customer" : "Estimated from Activities"}
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
              Vendor Purchase Bookings (PI) ({costLines.filter((l) => l.isBooked).length}/{costLines.length})
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

        {/* Tab Content */}
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
                  lines.map((line: any, idx: number) => {
                    const srno = line.srno ?? line.SRNO ?? idx + 1;
                    const actCode = line.act_code ?? line.ACT_CODE ?? "";
                    const activityDesc = line.activity ?? line.ACTIVITY ?? line.other_services ?? line.OTHER_SERVICES ?? actCode;
                    const billAmt = Number(line.bill ?? line.BILL ?? line.bill_oc ?? line.BILL_OC ?? 0);
                    const invNo = line.consolidated_invno || line.CONSOLIDATED_INVNO || line.invoice_no || line.INVOICE_NO || primarySalesInvoice?.DOC_NO || primarySalesInvoice?.REF_NO;
                    const invDate = primarySalesInvoice?.DOC_DATE || invoicedDate || header?.INVOICE_DATE || header?.invoice_date;

                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2 font-mono text-[11px] text-slate-500">{srno}</td>
                        <td className="p-2 font-semibold text-slate-900">{activityDesc}</td>
                        <td className="p-2 font-mono text-[11px] text-slate-500">{actCode}</td>
                        <td className="p-2 text-right font-mono font-bold text-blue-900">
                          {billAmt.toFixed(3)}
                        </td>
                        <td className="p-2">
                          {invNo ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 border border-emerald-300 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-900">
                                <CheckCircle2 size={11} className="text-emerald-700" /> {invNo}
                              </span>
                              {invDate && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {formatDate(invDate)}
                                </span>
                              )}
                            </div>
                          ) : invDate ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              <CheckCircle2 size={11} className="text-emerald-600" /> Invoiced {formatDate(invDate)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              <Clock size={11} className="text-amber-600" /> Pending Invoicing
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Dialog>
  );
}
