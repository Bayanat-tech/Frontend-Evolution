import { AlertCircle, Calendar, CheckCircle2, Clock, DollarSign, Edit3, Lock, Plus, RefreshCw, Save, ShieldCheck, Trash2, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  CompanyFinanceSetupData,
  getCompanyFinanceSetup,
  saveCompanyFinanceSetup,
  saveFyPeriod,
  SaveFyPeriodPayload
} from "../../api/transactions";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";
import type { ColumnDef } from "@tanstack/react-table";

type PeriodFormState = {
  fy_period: string;
  date_from: string;
  date_to: string;
  sort_order: number;
  isEdit: boolean;
};

export function CompanyFinanceSetupPage() {
  const { user } = useAuth();
  const companyCode = useMemo(() => String(user?.company_code || "BSG").trim().toUpperCase(), [user]);

  const [loading, setLoading] = useState(true);
  const [savingSetup, setSavingSetup] = useState(false);
  const [data, setData] = useState<CompanyFinanceSetupData | null>(null);

  // Alert state
  const [alert, setAlert] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Active Tab: "setup" | "periods"
  const [activeTab, setActiveTab] = useState<"setup" | "periods">("setup");

  // Company Finance Setup Form State
  const [form, setForm] = useState<{
    ac_fy_period: string;
    opn_fy_period: string;
    doc_edit_from: string;
    doc_edit_to: string;
    doc_date_editable: "Y" | "N";
    base_curr_code: string;
    amount_decimal_nos: number;
    price_decimal_nos: number;
    lcur_decimal_nos: number;
  }>({
    ac_fy_period: "",
    opn_fy_period: "",
    doc_edit_from: "",
    doc_edit_to: "",
    doc_date_editable: "Y",
    base_curr_code: "SAR",
    amount_decimal_nos: 2,
    price_decimal_nos: 2,
    lcur_decimal_nos: 2,
  });

  // Period Dialog state
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [periodForm, setPeriodForm] = useState<PeriodFormState>({
    fy_period: "",
    date_from: "",
    date_to: "",
    sort_order: 10,
    isEdit: false,
  });

  // Period Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [periodToDelete, setPeriodToDelete] = useState<string | null>(null);
  const [deletingPeriod, setDeletingPeriod] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getCompanyFinanceSetup(companyCode);
      if (res) {
        setData(res);
        setForm({
          ac_fy_period: res.company_info?.AC_FY_PERIOD || res.fy_periods[res.fy_periods.length - 1]?.FY_PERIOD || "",
          opn_fy_period: res.company_info?.OPN_FY_PERIOD || res.company_info?.AC_FY_PERIOD || "",
          doc_edit_from: res.ac_setup?.DOC_EDIT_FROM || "",
          doc_edit_to: res.ac_setup?.DOC_EDIT_TO || "",
          doc_date_editable: (res.ac_setup?.DOC_DATE_EDITABLE as any) === "N" ? "N" : "Y",
          base_curr_code: res.ac_setup?.BASE_CURR_CODE || res.company_info?.CURRENCY || "SAR",
          amount_decimal_nos: res.ac_setup?.AMOUNT_DECIMAL_NOS ?? 2,
          price_decimal_nos: res.ac_setup?.PRICE_DECIMAL_NOS ?? 2,
          lcur_decimal_nos: res.ac_setup?.LCUR_DECIMAL_NOS ?? 2,
        });
      }
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.message || "Failed to load company finance settings",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyCode]);

  const handleSaveSetup = async () => {
    try {
      setSavingSetup(true);

      // Validation
      if (!form.ac_fy_period) {
        setAlert({ type: "error", message: "Please select an Active Financial Period." });
        return;
      }
      if (form.doc_edit_from && form.doc_edit_to && form.doc_edit_from > form.doc_edit_to) {
        setAlert({ type: "error", message: "Lock From Date cannot be after Lock To Date." });
        return;
      }

      const res = await saveCompanyFinanceSetup({
        company_code: companyCode,
        ac_fy_period: form.ac_fy_period,
        opn_fy_period: form.opn_fy_period || form.ac_fy_period,
        doc_edit_from: form.doc_edit_from || null,
        doc_edit_to: form.doc_edit_to || null,
        doc_date_editable: form.doc_date_editable,
        base_curr_code: form.base_curr_code,
        amount_decimal_nos: Number(form.amount_decimal_nos),
        price_decimal_nos: Number(form.price_decimal_nos),
        lcur_decimal_nos: Number(form.lcur_decimal_nos),
      });

      setAlert({
        type: "success",
        message: res.message || "Company finance setup saved successfully.",
      });

      await loadData();
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.message || "Failed to save company finance settings",
      });
    } finally {
      setSavingSetup(false);
    }
  };

  const openAddPeriodDialog = () => {
    const nextSort = (data?.fy_periods?.length || 0) + 10;
    setPeriodForm({
      fy_period: "",
      date_from: "",
      date_to: "",
      sort_order: nextSort,
      isEdit: false,
    });
    setPeriodDialogOpen(true);
  };

  const openEditPeriodDialog = (p: CompanyFinanceSetupData["fy_periods"][0]) => {
    setPeriodForm({
      fy_period: p.FY_PERIOD,
      date_from: p.DATE_FROM || "",
      date_to: p.DATE_TO || "",
      sort_order: p.SORT_ORDER || 10,
      isEdit: true,
    });
    setPeriodDialogOpen(true);
  };

  const handleSavePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingPeriod(true);

      if (!periodForm.fy_period.trim()) {
        setAlert({ type: "error", message: "Financial Period code is required." });
        return;
      }
      if (!periodForm.date_from || !periodForm.date_to) {
        setAlert({ type: "error", message: "Start date and End date are required." });
        return;
      }
      if (periodForm.date_from > periodForm.date_to) {
        setAlert({ type: "error", message: "Start date cannot be after End date." });
        return;
      }

      const payload: SaveFyPeriodPayload = {
        company_code: companyCode,
        fy_period: periodForm.fy_period.trim(),
        date_from: periodForm.date_from,
        date_to: periodForm.date_to,
        sort_order: Number(periodForm.sort_order),
        action: periodForm.isEdit ? "UPD" : "INS",
      };

      const res = await saveFyPeriod(payload);
      setAlert({
        type: "success",
        message: res.message || `Financial period ${periodForm.fy_period} saved successfully.`,
      });
      setPeriodDialogOpen(false);
      await loadData();
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.message || "Failed to save financial period",
      });
    } finally {
      setSavingPeriod(false);
    }
  };

  const handleQuickSetActive = async (fyPeriod: string) => {
    try {
      setSavingSetup(true);
      // Find period dates
      const target = data?.fy_periods.find((p) => p.FY_PERIOD === fyPeriod);
      const res = await saveCompanyFinanceSetup({
        company_code: companyCode,
        ac_fy_period: fyPeriod,
        opn_fy_period: form.opn_fy_period || fyPeriod,
        doc_edit_from: target?.DATE_FROM || form.doc_edit_from || null,
        doc_edit_to: target?.DATE_TO || form.doc_edit_to || null,
        doc_date_editable: form.doc_date_editable,
        base_curr_code: form.base_curr_code,
        amount_decimal_nos: Number(form.amount_decimal_nos),
        price_decimal_nos: Number(form.price_decimal_nos),
        lcur_decimal_nos: Number(form.lcur_decimal_nos),
      });

      setAlert({
        type: "success",
        message: `Active Financial Period switched to ${fyPeriod} successfully.`,
      });
      await loadData();
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.message || "Failed to set active period",
      });
    } finally {
      setSavingSetup(false);
    }
  };

  const confirmDeletePeriod = (fyPeriod: string) => {
    setPeriodToDelete(fyPeriod);
    setDeleteConfirmOpen(true);
  };

  const handleDeletePeriod = async () => {
    if (!periodToDelete) return;
    try {
      setDeletingPeriod(true);
      const res = await saveFyPeriod({
        company_code: companyCode,
        fy_period: periodToDelete,
        date_from: "2000-01-01",
        date_to: "2000-01-01",
        action: "DEL",
      });

      setAlert({
        type: "success",
        message: res.message || `Financial period ${periodToDelete} deleted successfully.`,
      });
      setDeleteConfirmOpen(false);
      setPeriodToDelete(null);
      await loadData();
    } catch (err: any) {
      setAlert({
        type: "error",
        message: err.message || "Failed to delete financial period",
      });
    } finally {
      setDeletingPeriod(false);
    }
  };

  const periodColumns: ColumnDef<CompanyFinanceSetupData["fy_periods"][0]>[] = [
    {
      accessorKey: "FY_PERIOD",
      header: "Period Code",
      cell: ({ row }) => {
        const p = row.original;
        const isActive = p.FY_PERIOD === data?.company_info?.AC_FY_PERIOD;
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">{p.FY_PERIOD}</span>
            {isActive && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Active FY
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "DATE_FROM",
      header: "Start Date",
      cell: ({ row }) => (
        <span className="text-slate-700 font-mono text-xs">{row.original.DATE_FROM || "--"}</span>
      ),
    },
    {
      accessorKey: "DATE_TO",
      header: "End Date",
      cell: ({ row }) => (
        <span className="text-slate-700 font-mono text-xs">{row.original.DATE_TO || "--"}</span>
      ),
    },
    {
      accessorKey: "SORT_ORDER",
      header: "Sort Order",
      cell: ({ row }) => <span className="text-slate-600">{row.original.SORT_ORDER ?? "--"}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const p = row.original;
        const isActive = p.FY_PERIOD === data?.company_info?.AC_FY_PERIOD;
        return (
          <div className="flex items-center gap-2">
            {!isActive && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                onClick={() => handleQuickSetActive(p.FY_PERIOD)}
                title="Set this financial period as current active"
              >
                Set Active
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 text-slate-700 hover:bg-slate-100"
              onClick={() => openEditPeriodDialog(p)}
              title="Edit Period Dates"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1" />
              Edit
            </Button>
            {!isActive && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 text-rose-600 border-rose-300 hover:bg-rose-50"
                onClick={() => confirmDeletePeriod(p.FY_PERIOD)}
                title="Delete Period"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const activePeriodDetails = useMemo(() => {
    return data?.fy_periods.find((p) => p.FY_PERIOD === (form.ac_fy_period || data?.company_info?.AC_FY_PERIOD));
  }, [data, form.ac_fy_period]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100 text-[#00378C] rounded-lg">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Company Finance & Financial Period Setup</h1>
              <p className="text-sm text-slate-500">
                Company: <strong className="text-slate-800">{companyCode}</strong> —{" "}
                {data?.company_info?.COMPANY_NAME || "Company Setup"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={handleSaveSetup}
            disabled={savingSetup || loading}
            className="bg-[#00378C] hover:bg-[#002b6d] text-white flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingSetup ? "Saving Settings..." : "Save Company Settings"}
          </Button>
        </div>
      </div>

      {/* Global Alert Notification */}
      {alert && (
        <AutoDismissAlert
          notice={alert}
          onClose={() => setAlert(null)}
          duration={6000}
        />
      )}

      {/* Enterprise Security & Period Locking Banner */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm flex items-start gap-3">
        <Lock className="w-5 h-5 text-[#00378C] mt-0.5 shrink-0" />
        <div className="text-sm text-slate-700 space-y-1">
          <p className="font-semibold text-[#00378C]">
            Enterprise Financial Period & Closed Books Locking
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            All accounting transactions (Purchase Invoices, Sales Invoices, Bank Payments, Bank Receipts, Journal Vouchers)
            are restricted strictly to the <strong>Active Financial Period</strong>. Backdated entries prior to the{" "}
            <strong>Lock Date (Doc Edit From)</strong> are physically blocked to ensure compliance and audit integrity.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("setup")}
          className={`py-2.5 px-5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "setup"
              ? "border-[#00378C] text-[#00378C]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Company Period & Locking Controls
        </button>
        <button
          onClick={() => setActiveTab("periods")}
          className={`py-2.5 px-5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "periods"
              ? "border-[#00378C] text-[#00378C]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          Financial Years Master ({data?.fy_periods?.length || 0})
        </button>
      </div>

      {/* TAB 1: COMPANY SETUP & LOCKING CONTROLS */}
      {activeTab === "setup" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Controls Card */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#00378C]" />
                Financial Period & Entry Lock Window
              </h2>
              <p className="text-xs text-slate-500">
                Configure the active financial year and the editable date range for transaction entries.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Active Financial Period */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Active Financial Period <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.ac_fy_period}
                  onChange={(e) => {
                    const selectedFy = e.target.value;
                    const periodObj = data?.fy_periods.find((p) => p.FY_PERIOD === selectedFy);
                    setForm((prev) => ({
                      ...prev,
                      ac_fy_period: selectedFy,
                      // Automatically adjust lock window if dates exist
                      doc_edit_from: periodObj?.DATE_FROM || prev.doc_edit_from,
                      doc_edit_to: periodObj?.DATE_TO || prev.doc_edit_to,
                    }));
                  }}
                  className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-[#00378C] focus:outline-none"
                >
                  <option value="">-- Select Active Financial Period --</option>
                  {data?.fy_periods.map((p) => (
                    <option key={p.FY_PERIOD} value={p.FY_PERIOD}>
                      {p.FY_PERIOD} ({p.DATE_FROM || "?"} to {p.DATE_TO || "?"})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500">
                  New documents automatically inherit this active financial period.
                </span>
              </div>

              {/* Opening Financial Period */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Opening Financial Period
                </label>
                <select
                  value={form.opn_fy_period}
                  onChange={(e) => setForm((prev) => ({ ...prev, opn_fy_period: e.target.value }))}
                  className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-[#00378C] focus:outline-none"
                >
                  <option value="">-- Match Active Financial Period --</option>
                  {data?.fy_periods.map((p) => (
                    <option key={p.FY_PERIOD} value={p.FY_PERIOD}>
                      {p.FY_PERIOD}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500">
                  Opening balances period reference.
                </span>
              </div>

              {/* Lock From Date (DOC_EDIT_FROM) */}
              <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200">
                <label className="block text-xs font-semibold text-amber-900 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  Doc Edit From Date (Lock Date)
                </label>
                <Input
                  type="date"
                  value={form.doc_edit_from}
                  onChange={(e) => setForm((prev) => ({ ...prev, doc_edit_from: e.target.value }))}
                  className="bg-white border-amber-300 focus:border-amber-600"
                />
                <span className="text-[11px] text-amber-800 block mt-1">
                  Entries <strong>before</strong> this date are locked. Prevents backdated entries.
                </span>
              </div>

              {/* Lock To Date (DOC_EDIT_TO) */}
              <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-200">
                <label className="block text-xs font-semibold text-blue-900 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-700" />
                  Doc Edit To Date (Max Entry Date)
                </label>
                <Input
                  type="date"
                  value={form.doc_edit_to}
                  onChange={(e) => setForm((prev) => ({ ...prev, doc_edit_to: e.target.value }))}
                  className="bg-white border-blue-300 focus:border-[#00378C]"
                />
                <span className="text-[11px] text-blue-800 block mt-1">
                  Entries <strong>after</strong> this date cannot be saved.
                </span>
              </div>
            </div>

            {/* Document Date Editable Checkbox */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
              <input
                type="checkbox"
                id="doc_date_editable"
                checked={form.doc_date_editable === "Y"}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    doc_date_editable: e.target.checked ? "Y" : "N",
                  }))
                }
                className="w-4 h-4 text-[#00378C] rounded border-slate-300 focus:ring-[#00378C]"
              />
              <label htmlFor="doc_date_editable" className="text-xs font-semibold text-slate-800 cursor-pointer">
                Allow Document Date Modification (DOC_DATE_EDITABLE)
              </label>
              <span className="text-[11px] text-slate-500">
                When unchecked, operators cannot alter transaction dates in invoice and payment entry screens.
              </span>
            </div>

            {/* Currency & Decimal Settings */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Currency & Decimal Precision
                </h3>
                <p className="text-xs text-slate-500">
                  Global currency code and rounding decimals for this schema.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Base Currency
                  </label>
                  <Input
                    type="text"
                    value={form.base_curr_code}
                    onChange={(e) => setForm((prev) => ({ ...prev, base_curr_code: e.target.value.toUpperCase() }))}
                    maxLength={3}
                    placeholder="SAR"
                    className="uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount Decimals
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={4}
                    value={form.amount_decimal_nos}
                    onChange={(e) => setForm((prev) => ({ ...prev, amount_decimal_nos: Number(e.target.value) }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Price Decimals
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={4}
                    value={form.price_decimal_nos}
                    onChange={(e) => setForm((prev) => ({ ...prev, price_decimal_nos: Number(e.target.value) }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Local Curr Decimals
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={4}
                    value={form.lcur_decimal_nos}
                    onChange={(e) => setForm((prev) => ({ ...prev, lcur_decimal_nos: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Info Card */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Active Configuration Overview
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Company Code</span>
                  <span className="font-semibold text-slate-800">{companyCode}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Active FY Period</span>
                  <span className="font-bold text-[#00378C]">{form.ac_fy_period || "--"}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">FY Start - End</span>
                  <span className="font-mono text-slate-700">
                    {activePeriodDetails?.DATE_FROM || "--"} to {activePeriodDetails?.DATE_TO || "--"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Locked Before</span>
                  <span className="font-mono text-amber-700 font-semibold">
                    {form.doc_edit_from || "--"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Locked After</span>
                  <span className="font-mono text-blue-700 font-semibold">
                    {form.doc_edit_to || "--"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Base Currency</span>
                  <span className="font-semibold text-slate-800">{form.base_curr_code}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Last Updated</span>
                  <span className="text-slate-600">
                    {data?.ac_setup?.UPDATED_AT || "--"} ({data?.ac_setup?.UPDATED_BY || "Admin"})
                  </span>
                </div>
              </div>

              <Button
                onClick={handleSaveSetup}
                disabled={savingSetup || loading}
                className="w-full bg-[#00378C] hover:bg-[#002b6d] text-white flex items-center justify-center gap-2 mt-4"
              >
                <Save className="w-4 h-4" />
                {savingSetup ? "Saving..." : "Apply Settings"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FINANCIAL YEARS MASTER */}
      {activeTab === "periods" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#00378C]" />
                Financial Periods (MS_FY_PERIOD)
              </h2>
              <p className="text-xs text-slate-500">
                Define and maintain financial periods, dates, and boundaries.
              </p>
            </div>
            <Button
              onClick={openAddPeriodDialog}
              className="bg-[#00378C] hover:bg-[#002b6d] text-white flex items-center gap-1.5"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Add Financial Period
            </Button>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <DataTable
              columns={periodColumns}
              data={data?.fy_periods || []}
              loading={loading}
              emptyText="No financial periods found for this company."
            />
          </div>
        </div>
      )}

      {/* Add / Edit Financial Period Dialog */}
      <Dialog
        open={periodDialogOpen}
        onClose={() => setPeriodDialogOpen(false)}
        title={periodForm.isEdit ? `Edit Financial Period: ${periodForm.fy_period}` : "Add Financial Period"}
      >
        <form onSubmit={handleSavePeriod} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Period Code <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                required
                value={periodForm.fy_period}
                disabled={periodForm.isEdit}
                onChange={(e) => setPeriodForm((prev) => ({ ...prev, fy_period: e.target.value.trim() }))}
                placeholder="e.g. 226, 227"
              />
              <span className="text-[11px] text-slate-500">
                Typically 3 digits: e.g. 226 represents 2026 financial year.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="date"
                  required
                  value={periodForm.date_from}
                  onChange={(e) => setPeriodForm((prev) => ({ ...prev, date_from: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  End Date <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="date"
                  required
                  value={periodForm.date_to}
                  onChange={(e) => setPeriodForm((prev) => ({ ...prev, date_to: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sort Order
              </label>
              <Input
                type="number"
                value={periodForm.sort_order}
                onChange={(e) => setPeriodForm((prev) => ({ ...prev, sort_order: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPeriodDialogOpen(false)}
              disabled={savingPeriod}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={savingPeriod}
              className="bg-[#00378C] hover:bg-[#002b6d] text-white"
            >
              {savingPeriod ? "Saving..." : periodForm.isEdit ? "Update Period" : "Create Period"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete Financial Period"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-200">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-900 space-y-1">
              <p className="font-semibold">
                Are you sure you want to delete Financial Period {periodToDelete}?
              </p>
              <p>
                This action cannot be undone. Note that deletion will be blocked by database integrity
                if any accounting transactions already reference this financial period.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deletingPeriod}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDeletePeriod}
              disabled={deletingPeriod}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deletingPeriod ? "Deleting..." : "Confirm Delete"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
