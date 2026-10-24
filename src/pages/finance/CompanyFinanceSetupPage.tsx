import { Building2, Calendar, CheckCircle2, Clock, DollarSign, Edit2, FileText, Lock, Plus, Save, Trash2, X } from "lucide-react";
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

const inputClass =
  "h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#00378C] focus:outline-none focus:ring-1 focus:ring-[#00378C]/30 disabled:bg-slate-50 disabled:text-slate-500";

const labelClass = "block text-[11px] font-semibold text-slate-600 mb-1";

export function CompanyFinanceSetupPage() {
  const { user } = useAuth();
  const companyCode = useMemo(() => String(user?.company_code || "BSG").trim().toUpperCase(), [user]);

  const [loading, setLoading] = useState(true);
  const [savingSetup, setSavingSetup] = useState(false);
  const [data, setData] = useState<CompanyFinanceSetupData | null>(null);

  // Alert state
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info" | "warning"; message: string } | null>(null);

  // Active Tab
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
      setNotice({
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

      if (!form.ac_fy_period) {
        setNotice({ type: "error", message: "Please select an Active Financial Period." });
        return;
      }
      if (form.doc_edit_from && form.doc_edit_to && form.doc_edit_from > form.doc_edit_to) {
        setNotice({ type: "error", message: "Lock From Date cannot be after Lock To Date." });
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

      setNotice({
        type: "success",
        message: res.message || "Company finance settings saved successfully.",
      });

      await loadData();
    } catch (err: any) {
      setNotice({
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
        setNotice({ type: "error", message: "Financial Period code is required." });
        return;
      }
      if (!periodForm.date_from || !periodForm.date_to) {
        setNotice({ type: "error", message: "Start date and End date are required." });
        return;
      }
      if (periodForm.date_from > periodForm.date_to) {
        setNotice({ type: "error", message: "Start date cannot be after End date." });
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
      setNotice({
        type: "success",
        message: res.message || `Financial period ${periodForm.fy_period} saved successfully.`,
      });
      setPeriodDialogOpen(false);
      await loadData();
    } catch (err: any) {
      setNotice({
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

      setNotice({
        type: "success",
        message: `Active Financial Period set to ${fyPeriod}.`,
      });
      await loadData();
    } catch (err: any) {
      setNotice({
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

      setNotice({
        type: "success",
        message: res.message || `Financial period ${periodToDelete} deleted successfully.`,
      });
      setDeleteConfirmOpen(false);
      setPeriodToDelete(null);
      await loadData();
    } catch (err: any) {
      setNotice({
        type: "error",
        message: err.message || "Failed to delete financial period",
      });
    } finally {
      setDeletingPeriod(false);
    }
  };

  const periodColumns = useMemo<ColumnDef<CompanyFinanceSetupData["fy_periods"][0]>[]>(() => [
    {
      accessorKey: "FY_PERIOD",
      header: "Period",
      size: 140,
      minSize: 110,
      cell: ({ row }) => {
        const p = row.original;
        const isActive = p.FY_PERIOD === data?.company_info?.AC_FY_PERIOD;
        return (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-semibold text-slate-900">{p.FY_PERIOD}</span>
            {isActive && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Active
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "DATE_FROM",
      header: "Start Date",
      size: 160,
      minSize: 130,
      cell: ({ row }) => (
        <span className="text-slate-700 font-mono text-xs whitespace-nowrap">{row.original.DATE_FROM || "--"}</span>
      ),
    },
    {
      accessorKey: "DATE_TO",
      header: "End Date",
      size: 160,
      minSize: 130,
      cell: ({ row }) => (
        <span className="text-slate-700 font-mono text-xs whitespace-nowrap">{row.original.DATE_TO || "--"}</span>
      ),
    },
    {
      accessorKey: "SORT_ORDER",
      header: "Sort Order",
      size: 120,
      minSize: 100,
      cell: ({ row }) => <span className="text-slate-600 text-xs whitespace-nowrap">{row.original.SORT_ORDER ?? "--"}</span>,
    },
    {
      id: "actions",
      header: () => <div className="text-center">Actions</div>,
      size: 120,
      minSize: 100,
      cell: ({ row }) => {
        const p = row.original;
        const isActive = p.FY_PERIOD === data?.company_info?.AC_FY_PERIOD;
        return (
          <div className="flex items-center justify-center gap-1.5">
            {!isActive && (
              <button
                type="button"
                onClick={() => handleQuickSetActive(p.FY_PERIOD)}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition-colors"
                title="Set as Active Financial Period"
              >
                <CheckCircle2 size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={() => openEditPeriodDialog(p)}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-600 hover:text-[#00378C] hover:bg-blue-50 border border-slate-200 transition-colors"
              title="Edit Period Dates"
            >
              <Edit2 size={14} />
            </button>
            {!isActive && (
              <button
                type="button"
                onClick={() => confirmDeletePeriod(p.FY_PERIOD)}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors"
                title="Delete Period"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      },
    },
  ], [data?.company_info?.AC_FY_PERIOD]);

  return (
    <section className="finance-list-page finance-utility-page grid gap-2 p-1">
      {/* Standard Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#00378C]/10 text-[#00378C]">
            <Building2 size={15} />
          </div>
          <h1 className="m-0 truncate text-[15px] font-semibold tracking-tight text-slate-900">
            Company Finance Setup
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "periods" && (
            <Button
              onClick={openAddPeriodDialog}
              size="sm"
              className="h-8 text-xs bg-[#00378C] hover:bg-[#002b6d] text-white flex items-center gap-1.5"
            >
              <Plus size={14} />
              Add Period
            </Button>
          )}
          {activeTab === "setup" && (
            <Button
              onClick={handleSaveSetup}
              disabled={savingSetup || loading}
              size="sm"
              className="h-8 text-xs bg-[#00378C] hover:bg-[#002b6d] text-white flex items-center gap-1.5"
            >
              <Save size={14} />
              {savingSetup ? "Saving..." : "Save Settings"}
            </Button>
          )}
        </div>
      </div>

      {/* Alert Notification */}
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      {/* Compact Tab Switcher */}
      <div className="flex items-center gap-2 px-1">
        <button
          onClick={() => setActiveTab("setup")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            activeTab === "setup"
              ? "bg-[#00378C] text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Company Period & Locking
        </button>
        <button
          onClick={() => setActiveTab("periods")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            activeTab === "periods"
              ? "bg-[#00378C] text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Financial Years ({data?.fy_periods?.length || 0})
        </button>
      </div>

      {/* TAB 1: COMPANY PERIOD & LOCKING CONTROLS */}
      {activeTab === "setup" && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          {/* Section 1: Period & Locking */}
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-100 flex items-center gap-1.5">
              <Lock size={13} className="text-[#00378C]" />
              Financial Period & Locking Controls
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>
                  Active Financial Period <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.ac_fy_period}
                  onChange={(e) => {
                    const sel = e.target.value;
                    const periodObj = data?.fy_periods.find((p) => p.FY_PERIOD === sel);
                    setForm((prev) => ({
                      ...prev,
                      ac_fy_period: sel,
                      doc_edit_from: periodObj?.DATE_FROM || prev.doc_edit_from,
                      doc_edit_to: periodObj?.DATE_TO || prev.doc_edit_to,
                    }));
                  }}
                  className={inputClass}
                >
                  <option value="">-- Select Active FY --</option>
                  {data?.fy_periods.map((p) => (
                    <option key={p.FY_PERIOD} value={p.FY_PERIOD}>
                      {p.FY_PERIOD} ({p.DATE_FROM || "?"} to {p.DATE_TO || "?"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Opening Financial Period</label>
                <select
                  value={form.opn_fy_period}
                  onChange={(e) => setForm((prev) => ({ ...prev, opn_fy_period: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">-- Match Active FY --</option>
                  {data?.fy_periods.map((p) => (
                    <option key={p.FY_PERIOD} value={p.FY_PERIOD}>
                      {p.FY_PERIOD}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Doc Edit From (Lock Date)
                </label>
                <input
                  type="date"
                  value={form.doc_edit_from}
                  onChange={(e) => setForm((prev) => ({ ...prev, doc_edit_from: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Doc Edit To (Max Date)
                </label>
                <input
                  type="date"
                  value={form.doc_edit_to}
                  onChange={(e) => setForm((prev) => ({ ...prev, doc_edit_to: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
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
                className="w-3.5 h-3.5 text-[#00378C] rounded border-slate-300"
              />
              <label htmlFor="doc_date_editable" className="text-xs font-medium text-slate-700 cursor-pointer">
                Allow Document Date Modification (DOC_DATE_EDITABLE)
              </label>
            </div>
          </div>

          {/* Section 2: Currency & Decimals */}
          <div className="pt-3 border-t border-slate-100">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-100 flex items-center gap-1.5">
              <DollarSign size={13} className="text-emerald-600" />
              Currency & Decimal Precision
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>Base Currency</label>
                <input
                  type="text"
                  maxLength={3}
                  value={form.base_curr_code}
                  onChange={(e) => setForm((prev) => ({ ...prev, base_curr_code: e.target.value.toUpperCase() }))}
                  className={`${inputClass} uppercase`}
                  placeholder="SAR"
                />
              </div>

              <div>
                <label className={labelClass}>Amount Decimals</label>
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={form.amount_decimal_nos}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount_decimal_nos: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Price Decimals</label>
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={form.price_decimal_nos}
                  onChange={(e) => setForm((prev) => ({ ...prev, price_decimal_nos: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Local Currency Decimals</label>
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={form.lcur_decimal_nos}
                  onChange={(e) => setForm((prev) => ({ ...prev, lcur_decimal_nos: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Audit Info */}
          {data?.ac_setup && (
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
              <span>
                Last Updated: <strong className="text-slate-700">{data.ac_setup.UPDATED_AT || "--"}</strong>
              </span>
              <span>
                Updated By: <strong className="text-slate-700">{data.ac_setup.UPDATED_BY || "Admin"}</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FINANCIAL YEARS MASTER */}
      {activeTab === "periods" && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
          <DataTable
            columns={periodColumns}
            data={data?.fy_periods || []}
            loading={loading}
            emptyText="No financial periods found for this company."
            height="calc(100dvh - 170px)"
            minWidth={850}
            density="compact"
          />
        </div>
      )}

      {/* Add / Edit Financial Period Dialog */}
      <Dialog
        open={periodDialogOpen}
        onClose={() => setPeriodDialogOpen(false)}
        title={periodForm.isEdit ? `Edit Financial Period: ${periodForm.fy_period}` : "Add Financial Period"}
      >
        <form onSubmit={handleSavePeriod} className="space-y-3 p-2">
          <div>
            <label className={labelClass}>
              Period Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={periodForm.isEdit}
              value={periodForm.fy_period}
              onChange={(e) => setPeriodForm((prev) => ({ ...prev, fy_period: e.target.value.trim() }))}
              placeholder="e.g. 226, 227"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={periodForm.date_from}
                onChange={(e) => setPeriodForm((prev) => ({ ...prev, date_from: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                End Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={periodForm.date_to}
                onChange={(e) => setPeriodForm((prev) => ({ ...prev, date_to: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Sort Order</label>
            <input
              type="number"
              value={periodForm.sort_order}
              onChange={(e) => setPeriodForm((prev) => ({ ...prev, sort_order: Number(e.target.value) }))}
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPeriodDialogOpen(false)}
              disabled={savingPeriod}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
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
        <div className="space-y-3 p-2">
          <p className="text-xs text-slate-700">
            Are you sure you want to delete Financial Period <strong className="text-rose-600">{periodToDelete}</strong>?
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deletingPeriod}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDeletePeriod}
              disabled={deletingPeriod}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deletingPeriod ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
