import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Truck, CheckSquare, Square, RefreshCw, AlertCircle, Package, CheckCircle2 } from "lucide-react";
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
  tx_compnt_1_expmt?: string;
  booked_pi_no?: string;
  isBooked?: boolean;
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
  const [bookedPIList, setBookedPIList] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // PowerBuilder Filters
  const [filterBySupplier, setFilterBySupplier] = useState<boolean>(Boolean(supplierCode));
  const [statusFilter, setStatusFilter] = useState<"unbooked" | "booked" | "all">("unbooked"); // PB default: unbooked only
  const [hideFullyBookedJobs, setHideFullyBookedJobs] = useState<boolean>(true); // PB default: do not show fully booked jobs
  const [expenseSearch, setExpenseSearch] = useState("");

  // Map of selected items: key -> SelectedFreightExpense
  const [selectedMap, setSelectedMap] = useState<Map<string, SelectedFreightExpense>>(new Map());

  const fetchJobs = useCallback(
    async (query: string, supplierOverride?: string | null) => {
      if (!companyCode) return;
      setLoadingJobs(true);
      try {
        const suppToUse =
          supplierOverride !== undefined
            ? supplierOverride
            : filterBySupplier && supplierCode
            ? supplierCode.trim()
            : null;

        const response = await api.post<{ success?: boolean; data?: any[] }>(
          "/api/freight/job-activities/jobs",
          {
            company_code: companyCode,
            search: query || "",
            supplier_code: suppToUse || undefined,
          }
        );
        const data = response.data?.data || [];
        const jobList = Array.isArray(data) ? data : [];
        setJobs(jobList);
        if (jobList.length > 0) {
          void handleSelectJob(jobList[0]);
        } else {
          setSelectedJob(null);
          setActivities([]);
        }
      } catch (err) {
        console.error("Failed to load freight jobs:", err);
        setJobs([]);
        setSelectedJob(null);
        setActivities([]);
      } finally {
        setLoadingJobs(false);
      }
    },
    [companyCode, filterBySupplier, supplierCode]
  );

  // Reset or load jobs when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedMap(new Map());
      setSelectedJob(null);
      setActivities([]);
      setBookedPIList([]);
      const shouldFilter = Boolean(supplierCode);
      setFilterBySupplier(shouldFilter);
      setStatusFilter("unbooked");
      setHideFullyBookedJobs(true);
      void fetchJobs("", shouldFilter ? supplierCode.trim() : null);
    }
  }, [open, companyCode, supplierCode]);

  const handleSelectJob = async (job: any) => {
    setSelectedJob(job);
    setLoadingActivities(true);
    try {
      const response = await api.post<{ success?: boolean; data?: { header?: any; lines?: any[]; booked_pi?: any[] } }>(
        "/api/freight/job-activities/get",
        {
          company_code: companyCode,
          prin_code: job.prin_code || job.PRIN_CODE,
          job_no: job.job_no || job.JOB_NO,
        }
      );
      const lines = response.data?.data?.lines || [];
      const bookedPi = response.data?.data?.booked_pi || [];
      setActivities(Array.isArray(lines) ? lines : []);
      setBookedPIList(Array.isArray(bookedPi) ? bookedPi : []);
    } catch (err) {
      console.error("Failed to load job activities:", err);
      setActivities([]);
      setBookedPIList([]);
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

    // Helper to check if an expense was already booked in TR_AC_DETAIL (DOC_TYPE = 'PI')
    const findBookedPI = (costType: string, actCode: string, amount: number) => {
      if (!bookedPIList.length) return undefined;
      const match = bookedPIList.find((pi: any) => {
        const rem = String(pi.REMARKS || "").toUpperCase();
        const jNo = String(pi.JOB_NO || "").trim().toUpperCase();
        if (jNo && jNo !== jobNo.toUpperCase()) return false;

        const typeMatch =
          costType === "Agent Cost"
            ? rem.includes("AGENT") || rem.includes("BROKER")
            : costType === "Transporter Cost"
            ? rem.includes("TRANS")
            : rem.includes("OTHER") || rem.includes("ACTUAL");
        if (!typeMatch) return false;

        const actMatch = rem.includes(actCode.toUpperCase());
        if (!actMatch) return false;

        const amtMatch = Math.abs(Number(pi.AMOUNT) - amount) < 0.001;
        return amtMatch;
      });
      return match ? String(match.DOC_NO) : undefined;
    };

    activities.forEach((act: any, idx: number) => {
      const srno = String(act.srno || act.SRNO || idx + 1);
      const actCode = String(act.act_code || act.ACT_CODE || "");
      const activityDesc = String(act.activity || act.ACTIVITY || act.other_services || act.OTHER_SERVICES || actCode);
      const directPiNo = String(act.pi_no || act.PI_NO || "").trim();

      const actualCost = Number(act.actual_cost || act.ACTUAL_COST || 0);
      const partnerPrice = Number(act.partners_price || act.PARTNERS_PRICE || 0);
      const transportPrice = Number(act.transport_price || act.TRANSPORT_PRICE || 0);

      const brokerCode = String(act.broker_code || act.BROKER_CODE || "").trim();
      const brokerName = String(act.broker_name || act.BROKER_NAME || act.agent_name || "");
      const brokerAcref = String(act.broker_acref || act.BROKER_ACREF || "").trim();
      const transporterCode = String(act.transporter_code || act.TRANSPORTER_CODE || "").trim();
      const transporterName = String(act.transporter_name || act.TRANSPORTER_NAME || "");
      const transporterAcCode = String(
        act.transporter_ac_code || act.TRANSPORTER_AC_CODE || act.ac_code || act.AC_CODE || ""
      ).trim();
      const vehicleNo = String(act.vehicle_no || act.VEHICLE_NO || "");

      const txCat = String(act.tx_cat_code_cost || act.tx_cat_code || "");
      const txCompntCat = String(act.tx_compntcat_code_1_cost || act.tx_compntcat_code_1 || "");
      const txPerc = Number(act.tx_compnt_perc_1_cost || act.tx_compnt_perc_1 || 0);
      const txExpmt = String(act.tx_compnt_1_expmt_cost || act.tx_compnt_1_expmt || (txPerc > 0 ? "S" : "N"));

      // 1. Agent Cost line
      if (partnerPrice > 0) {
        const isMatch = Boolean(
          cleanSupplier &&
            (brokerCode.toUpperCase() === cleanSupplier ||
              (brokerAcref && brokerAcref.toUpperCase() === cleanSupplier))
        );
        const curr = String(act.partner_curr_code || "");
        const ex = Number(act.partner_ex_rate || 1);
        const bookedDoc = findBookedPI("Agent Cost", actCode, partnerPrice);
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
          vendor_code: brokerAcref || brokerCode,
          vendor_name: brokerName || "Agent / Partner",
          isSupplierMatch: isMatch,
          tx_cat_code: txCat,
          tx_compntcat_code_1: txCompntCat,
          tx_compnt_perc_1: txPerc,
          tx_compnt_1_expmt: txExpmt,
          booked_pi_no: bookedDoc,
          isBooked: Boolean(bookedDoc),
        });
      }

      // 2. Transporter Cost line
      if (transportPrice > 0) {
        const isMatch = Boolean(
          cleanSupplier &&
            (transporterCode.toUpperCase() === cleanSupplier ||
              (transporterAcCode && transporterAcCode.toUpperCase() === cleanSupplier))
        );
        const curr = String(act.tp_curr_code || "");
        const ex = Number(act.tp_ex_rate || 1);
        const bookedDoc = findBookedPI("Transporter Cost", actCode, transportPrice);
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
          vendor_code: transporterAcCode || transporterCode,
          vendor_name: transporterName || "Transporter",
          vehicle_no: vehicleNo,
          isSupplierMatch: isMatch,
          tx_cat_code: txCat,
          tx_compntcat_code_1: txCompntCat,
          tx_compnt_perc_1: txPerc,
          tx_compnt_1_expmt: txExpmt,
          booked_pi_no: bookedDoc,
          isBooked: Boolean(bookedDoc),
        });
      }

      // 3. Other Cost line (PowerBuilder dw_3 supplier_type = 'ACTUAL', SUPPLIER_ACC = '2020100000')
      // Other cost is an internal/direct job expense and does NOT belong to the Agent/Broker
      if (actualCost > 0) {
        const otherAcCode = "2020100000";
        const isMatch = Boolean(
          cleanSupplier &&
            (cleanSupplier === otherAcCode || cleanSupplier.includes("202010"))
        );
        const curr = String(act.ac_curr_code || "");
        const ex = Number(act.ac_ex_rate || 1);
        const bookedDoc = findBookedPI("Other Cost", actCode, actualCost);
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
          vendor_code: otherAcCode,
          vendor_name: "Direct / Provision Cost",
          isSupplierMatch: isMatch,
          tx_cat_code: txCat,
          tx_compntcat_code_1: txCompntCat,
          tx_compnt_perc_1: txPerc,
          tx_compnt_1_expmt: txExpmt,
          booked_pi_no: bookedDoc,
          isBooked: Boolean(bookedDoc),
        });
      }
    });

    return items;
  }, [selectedJob, activities, bookedPIList, supplierCode]);

  // Filtered jobs for left panel: Only jobs with activities & expense amounts can be booked in Purchase Booking
  const visibleJobs = useMemo(() => {
    return jobs.filter((j) => {
      const actCount = Number(j.activity_count ?? j.ACTIVITY_COUNT ?? 0);
      const expense = Number(j.expense ?? j.EXPENSE ?? 0);
      if (actCount <= 0 || expense <= 0) return false;
      if (hideFullyBookedJobs && j.is_fully_booked) return false;
      return true;
    });
  }, [jobs, hideFullyBookedJobs]);

  // Filtered expenses (PowerBuilder logic: hide booked by default)
  const visibleExpenses = useMemo(() => {
    let list = flattenedExpenses;
    if (statusFilter === "unbooked") {
      list = list.filter((item) => !item.isBooked);
    } else if (statusFilter === "booked") {
      list = list.filter((item) => item.isBooked);
    }
    if (filterBySupplier && supplierCode) {
      list = list.filter((item) => item.isSupplierMatch);
    }
    if (expenseSearch.trim()) {
      const q = expenseSearch.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.act_code.toLowerCase().includes(q) ||
          item.activity.toLowerCase().includes(q) ||
          item.cost_type.toLowerCase().includes(q) ||
          (item.vendor_code && item.vendor_code.toLowerCase().includes(q)) ||
          (item.vendor_name && item.vendor_name.toLowerCase().includes(q)) ||
          (item.vehicle_no && item.vehicle_no.toLowerCase().includes(q)) ||
          (item.booked_pi_no && item.booked_pi_no.toLowerCase().includes(q))
      );
    }
    return list;
  }, [flattenedExpenses, statusFilter, filterBySupplier, supplierCode, expenseSearch]);

  const allExpensesCount = flattenedExpenses.length;
  const bookedExpensesCount = useMemo(() => flattenedExpenses.filter((e) => e.isBooked).length, [flattenedExpenses]);
  const allExpensesBooked = allExpensesCount > 0 && bookedExpensesCount === allExpensesCount;

  const toggleSelectExpense = (item: FlattenedExpenseItem) => {
    if (item.isBooked) return; // Prevent selecting already booked lines
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
    const selectable = visibleExpenses.filter((e) => !e.isBooked);
    if (!selectable.length) return;
    setSelectedMap((prev) => {
      const next = new Map(prev);
      const allSelected = selectable.every((e) => next.has(e.key));
      if (allSelected) {
        selectable.forEach((e) => next.delete(e.key));
      } else {
        selectable.forEach((e) => {
          const { key, srno, isSupplierMatch, ...cleanData } = e;
          next.set(e.key, cleanData);
        });
      }
      return next;
    });
  };

  const selectableVisible = useMemo(() => visibleExpenses.filter((e) => !e.isBooked), [visibleExpenses]);
  const allVisibleSelected =
    selectableVisible.length > 0 && selectableVisible.every((e) => selectedMap.has(e.key));

  const totalSelectedAmount = useMemo(() => {
    let sum = 0;
    selectedMap.forEach((v) => {
      sum += Number(v.amount || 0);
    });
    return sum;
  }, [selectedMap]);

  const handleConfirm = () => {
    const items = Array.from(selectedMap.values()).filter((e) => !e.isBooked);
    if (items.length === 0) return;
    onSelect(items);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Load Freight Job Activities (Purchase Booking)"
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
              disabled={selectedMap.size === 0 || allExpensesBooked}
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
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-blue-950">
                <input
                  type="checkbox"
                  checked={filterBySupplier}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFilterBySupplier(checked);
                    void fetchJobs(jobSearch, checked && supplierCode ? supplierCode.trim() : null);
                  }}
                  className="rounded border-slate-300 text-[#00378C] focus:ring-[#00378C]"
                />
                <span>Filter activities matching this Supplier</span>
              </label>
            </div>
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
          <div className="col-span-12 md:col-span-3 flex flex-col rounded-md border border-slate-200 bg-white shadow-2xs overflow-hidden">
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
              {/* PB Filter: Hide fully booked jobs */}
              <div className="flex items-center justify-between text-[10px] text-slate-600 pt-0.5">
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hideFullyBookedJobs}
                    onChange={(e) => setHideFullyBookedJobs(e.target.checked)}
                    className="rounded border-slate-300 text-[#00378C]"
                  />
                  <span>Hide fully booked jobs</span>
                </label>
                <span className="text-slate-400 font-mono">
                  {visibleJobs.length}/{jobs.length}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loadingJobs ? (
                <div className="p-4 text-center text-slate-500 text-xs">Loading freight jobs...</div>
              ) : visibleJobs.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">
                  {jobs.length > 0 && hideFullyBookedJobs
                    ? "All jobs are already fully booked. Uncheck 'Hide fully booked jobs' to inspect."
                    : "No freight jobs found"}
                </div>
              ) : (
                visibleJobs.map((job: any) => {
                  const jobNo = job.job_no || job.JOB_NO;
                  const isCurrent = (selectedJob?.job_no || selectedJob?.JOB_NO) === jobNo;
                  const dateStr = formatDate(job.job_date || job.JOB_DATE);
                  const prinName = job.prin_name || job.PRIN_NAME || job.prin_code || job.PRIN_CODE || "-";
                  const expense = Number(job.expense || job.EXPENSE || 0);
                  const isFullyBooked = Boolean(job.is_fully_booked);
                  const lastPiNo = job.last_pi_no;

                  return (
                    <button
                      key={jobNo}
                      type="button"
                      onClick={() => handleSelectJob(job)}
                      className={`w-full text-left p-2.5 transition-colors cursor-pointer flex flex-col gap-1 ${
                        isCurrent
                          ? "bg-blue-50/80 border-l-4 border-l-[#00378C]"
                          : isFullyBooked
                          ? "bg-slate-50/60 opacity-75 hover:bg-slate-100/70"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#00378C]">{jobNo}</span>
                        <div className="flex items-center gap-1">
                          {isFullyBooked && lastPiNo ? (
                            <span className="rounded bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                              Booked: {lastPiNo}
                            </span>
                          ) : job.pi_line_count > 0 ? (
                            <span className="rounded bg-amber-100 border border-amber-200 px-1.5 py-0.2 text-[9px] font-semibold text-amber-800">
                              Part Booked
                            </span>
                          ) : null}
                          <span className="text-[10px] text-slate-500">{dateStr}</span>
                        </div>
                      </div>
                      <div className="truncate text-[11px] text-slate-600 font-medium">
                        {prinName}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                        <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.2 font-mono">
                          {job.transport_mode || job.TRANSPORT_MODE || "Mode"} / {job.job_type || job.JOB_TYPE || "Type"}
                        </span>
                        {expense > 0 && (
                          <span className={`font-semibold ${isFullyBooked ? "text-slate-500 line-through" : "text-rose-700"}`}>
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
          <div className="col-span-12 md:col-span-9 flex flex-col rounded-md border border-slate-200 bg-white shadow-2xs overflow-hidden">
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
                {bookedExpensesCount > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.2 text-[10px] font-semibold text-emerald-800">
                    {bookedExpensesCount} booked in PI
                  </span>
                )}
              </div>

              {selectedJob && (
                <div className="flex items-center gap-2">
                  {/* PB Mode toggle: Hide already booked lines */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded px-2 py-0.5 shadow-2xs">
                    <span className="text-[11px] font-semibold text-slate-600">Filter:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="h-5.5 text-[11px] font-bold rounded border-0 bg-transparent py-0 pl-1 pr-5 text-[#00378C] focus:ring-0 cursor-pointer"
                    >
                      <option value="unbooked">Unbooked Only (Default)</option>
                      <option value="booked">Already Booked in PI</option>
                      <option value="all">All Expenses (Booked & Unbooked)</option>
                    </select>
                  </div>

                  {visibleExpenses.length > 0 && (
                    <>
                      <div className="relative w-36">
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
                        disabled={selectableVisible.length === 0}
                        className="h-6 text-[11px] px-2"
                      >
                        {allVisibleSelected ? "Deselect All" : "Select All"}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              {!selectedJob ? (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400">
                  <Package size={36} className="text-slate-300 mb-2" />
                  <p className="text-xs font-medium">Please select a freight job from the left list.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Unbooked activities with supplier costs will appear here for purchase booking.
                  </p>
                </div>
              ) : loadingActivities ? (
                <div className="flex h-full items-center justify-center p-8 text-slate-500 text-xs">
                  <RefreshCw size={16} className="animate-spin mr-2 text-[#00378C]" /> Loading activities...
                </div>
              ) : allExpensesBooked && statusFilter === "unbooked" ? (
                /* Attractive PowerBuilder View: When all expenses are already booked in PI */
                <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-600">
                  <div className="rounded-full bg-emerald-100 p-3 text-emerald-600 mb-3 border border-emerald-200 shadow-xs">
                    <CheckCircle2 size={38} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">
                    All Expenses for this Job are Already Booked
                  </h4>
                  <p className="text-xs text-slate-600 mt-1.5 max-w-md">
                    All supplier and agent expenses for Job{" "}
                    <strong className="text-[#00378C] font-mono">
                      {selectedJob.job_no || selectedJob.JOB_NO}
                    </strong>{" "}
                    have already been booked into Purchase Invoice(s):
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    {Array.from(new Set(flattenedExpenses.map((e) => e.booked_pi_no).filter(Boolean))).map((pi) => (
                      <span
                        key={pi}
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1 font-mono font-bold text-emerald-800 text-xs shadow-2xs"
                      >
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        {pi}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStatusFilter("booked")}
                      className="rounded-md bg-[#00378C] hover:bg-[#002d72] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors cursor-pointer"
                    >
                      View Booked Lines in History
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className="rounded-md border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
                    >
                      Show All Lines
                    </button>
                  </div>
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
                  <thead className="sticky top-0 bg-[#00378C] text-[11px] font-semibold text-white shadow-sm z-10">
                    <tr>
                      <th className="p-2 w-8 text-center text-white border-r border-white/15">
                        <button
                          type="button"
                          onClick={handleSelectAllVisible}
                          disabled={selectableVisible.length === 0}
                          className="cursor-pointer disabled:opacity-40"
                        >
                          {allVisibleSelected ? (
                            <CheckSquare size={14} className="text-white" />
                          ) : (
                            <Square size={14} className="text-white/60" />
                          )}
                        </button>
                      </th>
                      <th className="p-2 w-12 text-white border-r border-white/15">Sr#</th>
                      <th className="p-2 w-28 text-white border-r border-white/15">Cost Type</th>
                      <th className="p-2 text-white border-r border-white/15">Activity</th>
                      <th className="p-2 w-44 text-white border-r border-white/15">Vendor / Party</th>
                      <th className="p-2 w-20 text-white border-r border-white/15">Currency</th>
                      <th className="p-2 w-24 text-right text-white">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleExpenses.map((item) => {
                      const isChecked = selectedMap.has(item.key);
                      const isBooked = Boolean(item.isBooked);
                      return (
                        <tr
                          key={item.key}
                          onClick={() => !isBooked && toggleSelectExpense(item)}
                          className={`transition-colors ${
                            isBooked
                              ? "bg-slate-50/80 text-slate-400 cursor-not-allowed"
                              : isChecked
                              ? "bg-blue-50/70 cursor-pointer"
                              : item.isSupplierMatch
                              ? "bg-emerald-50/40 hover:bg-slate-50 cursor-pointer"
                              : "hover:bg-slate-50 cursor-pointer"
                          }`}
                        >
                          <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={isBooked}
                              onClick={() => toggleSelectExpense(item)}
                              className={`cursor-pointer ${isBooked ? "opacity-30 cursor-not-allowed" : ""}`}
                              title={isBooked ? `Already booked in ${item.booked_pi_no}` : "Select for invoice"}
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
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  isBooked
                                    ? "bg-slate-200 text-slate-500"
                                    : item.cost_type === "Agent Cost"
                                    ? "bg-purple-100 text-purple-800"
                                    : item.cost_type === "Transporter Cost"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-200 text-slate-800"
                                }`}
                              >
                                {item.cost_type}
                              </span>
                              {isBooked && (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-800">
                                  Booked: {item.booked_pi_no}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <div className={`font-semibold ${isBooked ? "text-slate-500 line-through" : "text-slate-900"}`}>
                              {item.activity}
                            </div>
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
                          <td className={`p-2 text-right font-mono font-bold ${isBooked ? "text-slate-400" : "text-slate-900"}`}>
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
