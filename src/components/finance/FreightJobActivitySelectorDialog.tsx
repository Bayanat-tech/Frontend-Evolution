import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Truck, CheckSquare, Square, RefreshCw, X, AlertCircle, Filter, DollarSign, Package } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { api } from "../../api/client";
import { formatDate } from "../../utils/date";

export interface SelectedFreightExpense {
  job_no: string;
  prin_code?: string;
  act_code: string;
  activity: string;
  cost_type: "Other Cost" | "Agent Cost" | "Transporter Cost";
  amount: number;
  curr_code?: string;
  ex_rate?: number;
  lcur_amount?: number;
  vendor_code?: string;
  vendor_name?: string;
  vehicle_no?: string;
  tx_cat_code?: string;
  tx_compntcat_code_1?: string;
  tx_compnt_perc_1?: number;
}

interface FreightJobActivitySelectorDialogProps {
  open: boolean;
  onClose: () => void;
  companyCode: string;
  supplierCode?: string;
  supplierName?: string;
  onSelect: (activities: SelectedFreightExpense[]) => void;
}

interface FlattenedExpenseItem extends SelectedFreightExpense {
  key: string;
  srno: string;
  isSupplierMatch: boolean;
}

export function FreightJobActivitySelectorDialog({
  open,
  onClose,
  companyCode,
  supplierCode = "",
  supplierName = "",
  onSelect,
}: FreightJobActivitySelectorDialogProps) {
  const [jobSearch, setJobSearch] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);

  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Filter state
  const [filterBySupplier, setFilterBySupplier] = useState<boolean>(Boolean(supplierCode));
  const [expenseSearch, setExpenseSearch] = useState("");

  // Map of selected items: key -> SelectedFreightExpense
  const [selectedMap, setSelectedMap] = useState<Map<string, SelectedFreightExpense>>(new Map());

  // Reset or load jobs when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedMap(new Map());
      setSelectedJob(null);
      setActivities([]);
      setFilterBySupplier(Boolean(supplierCode));
      void fetchJobs("");
    }
  }, [open, companyCode, supplierCode]);

  const fetchJobs = useCallback(async (query: string) => {
    if (!companyCode) return;
    setLoadingJobs(true);
    try {
      const response = await api.post<{ success?: boolean; data?: any[] }>("/api/freight/job-activities/jobs", {
        company_code: companyCode,
        search: query || "",
      });
      const data = response.data?.data || [];
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load freight jobs:", err);
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, [companyCode]);

  const handleSelectJob = async (job: any) => {
    setSelectedJob(job);
    setLoadingActivities(true);
    try {
      const response = await api.post<{ success?: boolean; data?: { header?: any; lines?: any[] } }>(
        "/api/freight/job-activities/get",
        {
          company_code: companyCode,
          prin_code: job.prin_code || job.PRIN_CODE,
          job_no: job.job_no || job.JOB_NO,
        }
      );
      const lines = response.data?.data?.lines || [];
      setActivities(Array.isArray(lines) ? lines : []);
    } catch (err) {
      console.error("Failed to load job activities:", err);
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  // Convert raw activities into discrete expense items (Other Cost, Agent Cost, Transporter Cost)
  const flattenedExpenses = useMemo<FlattenedExpenseItem[]>(() => {
    if (!selectedJob || !activities.length) return [];
    const jobNo = String(selectedJob.job_no || selectedJob.JOB_NO || "");
    const prinCode = String(selectedJob.prin_code || selectedJob.PRIN_CODE || "");
    const cleanSupplier = supplierCode.trim().toUpperCase();

    const items: FlattenedExpenseItem[] = [];

    activities.forEach((act: any, idx: number) => {
      const srno = String(act.srno || act.SRNO || idx + 1);
      const actCode = String(act.act_code || act.ACT_CODE || "");
      const activityDesc = String(act.activity || act.ACTIVITY || actCode);

      const actualCost = Number(act.actual_cost || act.ACTUAL_COST || 0);
      const partnerPrice = Number(act.partners_price || act.PARTNERS_PRICE || 0);
      const transportPrice = Number(act.transport_price || act.TRANSPORT_PRICE || 0);

      const brokerCode = String(act.broker_code || act.BROKER_CODE || "").trim();
      const brokerName = String(act.broker_name || act.BROKER_NAME || act.agent_name || "");
      const transporterCode = String(act.transporter_code || act.TRANSPORTER_CODE || "").trim();
      const transporterName = String(act.transporter_name || act.TRANSPORTER_NAME || "");
      const vehicleNo = String(act.vehicle_no || act.VEHICLE_NO || "");

      const txCat = String(act.tx_cat_code_cost || act.tx_cat_code || "");
      const txCompntCat = String(act.tx_compntcat_code_1_cost || act.tx_compntcat_code_1 || "");
      const txPerc = Number(act.tx_compnt_perc_1_cost || act.tx_compnt_perc_1 || 0);

      // 1. Agent Cost line
      if (partnerPrice > 0) {
        const isMatch = Boolean(cleanSupplier && brokerCode.toUpperCase() === cleanSupplier);
        const curr = String(act.partner_curr_code || "");
        const ex = Number(act.partner_ex_rate || 1);
        items.push({
          key: `${jobNo}_${srno}_AGENT`,
          srno,
          job_no: jobNo,
          prin_code: prinCode,
          act_code: actCode,
          activity: activityDesc,
          cost_type: "Agent Cost",
          amount: partnerPrice,
          curr_code: curr,
          ex_rate: ex,
          lcur_amount: partnerPrice * ex,
          vendor_code: brokerCode,
          vendor_name: brokerName || "Agent / Partner",
          isSupplierMatch: isMatch,
          tx_cat_code: txCat,
          tx_compntcat_code_1: txCompntCat,
          tx_compnt_perc_1: txPerc,
        });
      }

      // 2. Transporter Cost line
      if (transportPrice > 0) {
        const isMatch = Boolean(cleanSupplier && transporterCode.toUpperCase() === cleanSupplier);
        const curr = String(act.tp_curr_code || "");
        const ex = Number(act.tp_ex_rate || 1);
        items.push({
          key: `${jobNo}_${srno}_TRANS`,
          srno,
          job_no: jobNo,
          prin_code: prinCode,
          act_code: actCode,
          activity: activityDesc,
          cost_type: "Transporter Cost",
          amount: transportPrice,
          curr_code: curr,
          ex_rate: ex,
          lcur_amount: transportPrice * ex,
          vendor_code: transporterCode,
          vendor_name: transporterName || "Transporter",
          vehicle_no: vehicleNo,
          isSupplierMatch: isMatch,
          tx_cat_code: txCat,
          tx_compntcat_code_1: txCompntCat,
          tx_compnt_perc_1: txPerc,
        });
      }

      // 3. Other Cost line
      if (actualCost > 0) {
        const isMatch = Boolean(cleanSupplier && brokerCode && brokerCode.toUpperCase() === cleanSupplier);
        const curr = String(act.ac_curr_code || "");
        const ex = Number(act.ac_ex_rate || 1);
        items.push({
          key: `${jobNo}_${srno}_OTHER`,
          srno,
          job_no: jobNo,
          prin_code: prinCode,
          act_code: actCode,
          activity: activityDesc,
          cost_type: "Other Cost",
          amount: actualCost,
          curr_code: curr,
          ex_rate: ex,
          lcur_amount: actualCost * ex,
          vendor_code: brokerCode,
          vendor_name: brokerName || "Direct / Other Cost",
          isSupplierMatch: isMatch,
          tx_cat_code: txCat,
          tx_compntcat_code_1: txCompntCat,
          tx_compnt_perc_1: txPerc,
        });
      }
    });

    return items;
  }, [selectedJob, activities, supplierCode]);

  // Filtered by supplier and search
  const visibleExpenses = useMemo(() => {
    let list = flattenedExpenses;
    if (filterBySupplier && supplierCode) {
      list = list.filter((item) => item.isSupplierMatch);
    }
    if (expenseSearch.trim()) {
      const q = expenseSearch.trim().toLowerCase();
      list = list.filter((item) =>
        item.act_code.toLowerCase().includes(q) ||
        item.activity.toLowerCase().includes(q) ||
        item.cost_type.toLowerCase().includes(q) ||
        (item.vendor_code && item.vendor_code.toLowerCase().includes(q)) ||
        (item.vendor_name && item.vendor_name.toLowerCase().includes(q)) ||
        (item.vehicle_no && item.vehicle_no.toLowerCase().includes(q))
      );
    }
    return list;
  }, [flattenedExpenses, filterBySupplier, supplierCode, expenseSearch]);

  const toggleSelectExpense = (item: FlattenedExpenseItem) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(item.key)) {
        next.delete(item.key);
      } else {
        const { key, srno, isSupplierMatch, ...cleanData } = item;
        next.set(item.key, cleanData);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      const allSelected = visibleExpenses.every((e) => next.has(e.key));
      if (allSelected) {
        visibleExpenses.forEach((e) => next.delete(e.key));
      } else {
        visibleExpenses.forEach((e) => {
          const { key, srno, isSupplierMatch, ...cleanData } = e;
          next.set(e.key, cleanData);
        });
      }
      return next;
    });
  };

  const allVisibleSelected = visibleExpenses.length > 0 && visibleExpenses.every((e) => selectedMap.has(e.key));

  const totalSelectedAmount = useMemo(() => {
    let sum = 0;
    selectedMap.forEach((v) => {
      sum += Number(v.amount || 0);
    });
    return sum;
  }, [selectedMap]);

  const handleConfirm = () => {
    const items = Array.from(selectedMap.values());
    if (items.length === 0) return;
    onSelect(items);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Load Freight Job Activities (Purchase Booking)"
      description="Select freight cost and activity lines to auto-populate into Purchase Invoice"
      wide
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold text-slate-700">
              Selected: <span className="text-[#00378C] font-bold">{selectedMap.size}</span> lines
            </span>
            {selectedMap.size > 0 && (
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 border border-emerald-200">
                Total: {totalSelectedAmount.toFixed(3)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selectedMap.size === 0}
              onClick={handleConfirm}
              className="bg-[#00378C] hover:bg-[#002d72] text-white"
            >
              Load {selectedMap.size > 0 ? `(${selectedMap.size}) Lines` : ""} into Invoice
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex h-[min(80vh,680px)] w-full flex-col gap-2 overflow-hidden text-xs">
        {/* Supplier Banner */}
        {supplierCode ? (
          <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs text-blue-900 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Invoice Supplier:</span>
              <span className="rounded bg-white px-2 py-0.5 font-mono text-blue-800 border border-blue-200">
                {supplierCode}
              </span>
              <span className="font-medium text-slate-700">{supplierName}</span>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-blue-950">
              <input
                type="checkbox"
                checked={filterBySupplier}
                onChange={(e) => setFilterBySupplier(e.target.checked)}
                className="rounded border-slate-300 text-[#00378C] focus:ring-[#00378C]"
              />
              <span>Filter activities matching this Supplier</span>
            </label>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 shrink-0">
            <AlertCircle size={14} className="text-amber-600 shrink-0" />
            <span>No supplier selected on the invoice header. You can pick any freight cost activity lines below.</span>
          </div>
        )}

        {/* Master / Detail Split Grid */}
        <div className="grid grid-cols-12 gap-3 min-h-0 flex-1 overflow-hidden">
          {/* Left Column: Freight Jobs List (col-span-4) */}
          <div className="col-span-4 flex flex-col rounded-md border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 p-2 flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Package size={13} className="text-[#00378C]" /> Freight Jobs
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-slate-500 hover:text-slate-800"
                  onClick={() => fetchJobs(jobSearch)}
                  title="Refresh jobs"
                >
                  <RefreshCw size={12} className={loadingJobs ? "animate-spin" : ""} />
                </Button>
              </div>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
                <Input
                  value={jobSearch}
                  onChange={(e) => {
                    setJobSearch(e.target.value);
                    void fetchJobs(e.target.value);
                  }}
                  placeholder="Search job no, principal..."
                  className="h-7 pl-7 text-xs"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loadingJobs ? (
                <div className="p-4 text-center text-slate-500 text-xs">Loading freight jobs...</div>
              ) : jobs.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">No freight jobs found</div>
              ) : (
                jobs.map((job: any) => {
                  const jobNo = job.job_no || job.JOB_NO;
                  const isCurrent = (selectedJob?.job_no || selectedJob?.JOB_NO) === jobNo;
                  const dateStr = formatDate(job.job_date || job.JOB_DATE);
                  const prinName = job.prin_name || job.PRIN_NAME || job.prin_code || job.PRIN_CODE || "-";
                  const expense = Number(job.expense || job.EXPENSE || 0);

                  return (
                    <button
                      key={jobNo}
                      type="button"
                      onClick={() => handleSelectJob(job)}
                      className={`w-full text-left p-2.5 transition-colors cursor-pointer flex flex-col gap-1 ${
                        isCurrent
                          ? "bg-blue-50/80 border-l-4 border-l-[#00378C]"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#00378C]">{jobNo}</span>
                        <span className="text-[10px] text-slate-500">{dateStr}</span>
                      </div>
                      <div className="truncate text-[11px] text-slate-600 font-medium">
                        {prinName}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                        <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.2 font-mono">
                          {job.transport_mode || job.TRANSPORT_MODE || "Mode"} / {job.job_type || job.JOB_TYPE || "Type"}
                        </span>
                        {expense > 0 && (
                          <span className="font-semibold text-rose-700">
                            Exp: {expense.toFixed(3)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Activities & Expenses (col-span-8) */}
          <div className="col-span-8 flex flex-col rounded-md border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 p-2 flex items-center justify-between shrink-0 gap-2">
              <div className="flex items-center gap-2">
                <Truck size={14} className="text-[#00378C]" />
                <span className="font-bold text-slate-800 text-xs">
                  {selectedJob
                    ? `Expenses for Job #${selectedJob.job_no || selectedJob.JOB_NO}`
                    : "Select a job on the left to view expense lines"}
                </span>
                {visibleExpenses.length > 0 && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.2 text-[10px] font-bold text-blue-800">
                    {visibleExpenses.length} lines
                  </span>
                )}
              </div>

              {selectedJob && visibleExpenses.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="relative w-44">
                    <Search size={12} className="absolute left-2 top-2 text-slate-400" />
                    <Input
                      value={expenseSearch}
                      onChange={(e) => setExpenseSearch(e.target.value)}
                      placeholder="Filter lines..."
                      className="h-6 pl-6 text-[11px]"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleSelectAllVisible}
                    className="h-6 text-[11px] px-2"
                  >
                    {allVisibleSelected ? "Deselect All" : "Select All"}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              {!selectedJob ? (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400">
                  <Package size={36} className="text-slate-300 mb-2" />
                  <p className="text-xs font-medium">Please select a freight job from the left list.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Activities with booked costs (Agent, Transporter, Other) will appear here.</p>
                </div>
              ) : loadingActivities ? (
                <div className="flex h-full items-center justify-center p-8 text-slate-500 text-xs">
                  <RefreshCw size={16} className="animate-spin mr-2 text-[#00378C]" /> Loading activities...
                </div>
              ) : visibleExpenses.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400">
                  <AlertCircle size={32} className="text-amber-400 mb-2" />
                  <p className="text-xs font-medium text-slate-600">No expense lines available for this view.</p>
                  {filterBySupplier && supplierCode && (
                    <div className="mt-2 text-[11px] text-slate-500">
                      <span>No lines match supplier <strong>{supplierCode}</strong>. </span>
                      <button
                        type="button"
                        onClick={() => setFilterBySupplier(false)}
                        className="text-[#00378C] font-semibold underline hover:text-blue-800 ml-1"
                      >
                        Turn off supplier filter to see all {flattenedExpenses.length} expense lines
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 text-[11px] font-semibold text-slate-700 border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-2 w-8 text-center">
                        <button
                          type="button"
                          onClick={handleSelectAllVisible}
                          className="cursor-pointer"
                        >
                          {allVisibleSelected ? (
                            <CheckSquare size={14} className="text-[#00378C]" />
                          ) : (
                            <Square size={14} className="text-slate-400" />
                          )}
                        </button>
                      </th>
                      <th className="p-2 w-12">Sr#</th>
                      <th className="p-2 w-28">Cost Type</th>
                      <th className="p-2">Activity</th>
                      <th className="p-2 w-44">Vendor / Party</th>
                      <th className="p-2 w-20">Currency</th>
                      <th className="p-2 w-24 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleExpenses.map((item) => {
                      const isChecked = selectedMap.has(item.key);
                      return (
                        <tr
                          key={item.key}
                          onClick={() => toggleSelectExpense(item)}
                          className={`cursor-pointer transition-colors ${
                            isChecked
                              ? "bg-blue-50/70"
                              : item.isSupplierMatch
                              ? "bg-emerald-50/40 hover:bg-slate-50"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => toggleSelectExpense(item)}
                              className="cursor-pointer"
                            >
                              {isChecked ? (
                                <CheckSquare size={14} className="text-[#00378C]" />
                              ) : (
                                <Square size={14} className="text-slate-400" />
                              )}
                            </button>
                          </td>
                          <td className="p-2 font-mono text-[11px] text-slate-500">{item.srno}</td>
                          <td className="p-2">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                item.cost_type === "Agent Cost"
                                  ? "bg-purple-100 text-purple-800"
                                  : item.cost_type === "Transporter Cost"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-200 text-slate-800"
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
                            <div className="truncate font-medium text-slate-800">
                              {item.vendor_name || "-"}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {item.vendor_code || ""}
                              {item.vehicle_no ? ` | Veh: ${item.vehicle_no}` : ""}
                            </div>
                          </td>
                          <td className="p-2 font-mono text-[11px] text-slate-600">
                            {item.curr_code || "OMR"}
                            {Number(item.ex_rate || 1) !== 1 && ` @ ${item.ex_rate}`}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900">
                            {item.amount.toFixed(3)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

