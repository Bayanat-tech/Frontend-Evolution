import { AlertCircle, Briefcase, CheckCircle2, ChevronUp, FileText, Plus, Receipt, RefreshCw, Trash2, X, Zap } from "lucide-react";
import { TransactionChildRow, TransactionDetail } from "../../api/transactions";
import { getDynamicLookup, getLookupValue, LookupRow } from "../../api/lookups";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { LookupField } from "../ui/LookupField";
import { useAuth } from "../../state/AuthContext";

function text(value: unknown) {
  if (value == null) return "";
  return String(value);
}

function dateInput(value: unknown) {
  if (!value) return "";
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

interface SmartInlineAllocationTableProps {
  detail: TransactionDetail;
  rows: TransactionChildRow[];
  loading?: boolean;
  disabled?: boolean;
  formatAmount: (value: number) => string;
  onChange: (childId: string, patch: Partial<TransactionChildRow>) => void;
  onRemove: (childId: string) => void;
  onAdd: () => void;
  onSetChildTable?: (table: "invoice" | "job" | "expense") => void;
  onRefreshInvoices?: () => void;
  onInvNoBlur?: (childId: string, invNo: string, parentId?: string) => void;
  onClose: () => void;
}

export function SmartInlineAllocationTable({
  detail,
  rows,
  loading = false,
  disabled = false,
  formatAmount,
  onChange,
  onRemove,
  onAdd,
  onSetChildTable,
  onRefreshInvoices,
  onInvNoBlur,
  onClose,
}: SmartInlineAllocationTableProps) {
  const { user } = useAuth();
  const childTable = detail.child_table;

  const totalAllocated = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const parentAmount = Number(detail.amount) || 0;
  const diff = parentAmount - totalAllocated;
  const isMatched = Math.abs(diff) < 0.001;

  const handleAllocateAll = () => {
    rows.forEach((r) => {
      const maxAmt = Number(r.c_bal_amt_org || r.inv_amt || 0);
      if (maxAmt > 0) {
        onChange(r.id, { amount: maxAmt });
      }
    });
  };

  const handleFillDiff = () => {
    if (diff <= 0) return;
    let remaining = diff;
    for (const r of rows) {
      if (remaining <= 0) break;
      const currentAllocated = Number(r.amount) || 0;
      const maxAllowed = Number(r.c_bal_amt_org || r.inv_amt || 0);
      const canAdd = maxAllowed > currentAllocated ? maxAllowed - currentAllocated : remaining;
      const toAdd = Math.min(remaining, canAdd);
      if (toAdd > 0) {
        onChange(r.id, { amount: currentAllocated + toAdd });
        remaining -= toAdd;
      }
    }
  };

  const headers =
    childTable === "invoice"
      ? ["#", "Invoice No", "Invoice Date", "Invoice Amount", "Outstanding", "Allocated Amount", ""]
      : childTable === "job"
        ? ["#", "Job No", "Doc Ref", "Doc Ref 2", "Amount", ""]
        : ["#", "Expense Type", "Expense Subtype", "Description", "Job No", "Amount", ""];

  return (
    <div className="my-1.5 rounded-lg border border-blue-200/90 bg-white shadow-sm overflow-hidden text-xs">
      {/* Sub-toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-white px-3 py-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00378C] text-white">
            {childTable === "invoice" ? (
              <FileText size={11} />
            ) : childTable === "job" ? (
              <Briefcase size={11} />
            ) : (
              <Receipt size={11} />
            )}
          </span>
          <span className="font-bold text-[#00378C] tracking-wide uppercase text-[11px]">
            {childTable === "invoice"
              ? "Invoice Allocations"
              : childTable === "job"
                ? "Job Allocations"
                : childTable === "expense"
                  ? "Expense Allocations"
                  : "Line Allocations"}
          </span>
          <span className="text-slate-500 font-medium">
            (Line #{detail.serial_no}: <strong className="text-slate-800">{detail.ac_code}</strong> {detail.ac_name ? `- ${detail.ac_name}` : ""})
          </span>

          {childTable && (
            <div className="flex items-center gap-1.5 ml-2">
              <span className="inline-flex items-center rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-mono text-slate-700 shadow-2xs">
                Allocated: <strong className="ml-1 text-[#00378C]">{formatAmount(totalAllocated)}</strong>
                <span className="mx-1 text-slate-300">/</span>
                Line: <strong className="ml-1 text-slate-900">{formatAmount(parentAmount)}</strong>
              </span>

              {isMatched ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 size={11} /> Matched
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  <AlertCircle size={11} /> Diff: {formatAmount(Math.abs(diff))}
                </span>
              )}

              {childTable === "invoice" && rows.length > 0 && !isMatched && diff > 0 && (
                <button
                  type="button"
                  onClick={handleFillDiff}
                  disabled={disabled}
                  className="inline-flex items-center gap-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors"
                  title="Allocate remaining difference to invoice lines"
                >
                  <Zap size={10} /> Auto-Fill Diff ({formatAmount(diff)})
                </button>
              )}

              {childTable === "invoice" && rows.length > 0 && (
                <button
                  type="button"
                  onClick={handleAllocateAll}
                  disabled={disabled}
                  className="inline-flex items-center gap-1 rounded bg-blue-50 hover:bg-blue-100 text-[#00378C] border border-blue-200 px-2 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors"
                  title="Allocate full outstanding balance to all invoices"
                >
                  <CheckCircle2 size={10} /> Allocate All
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!childTable && onSetChildTable && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500">Attach:</span>
              <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 text-[#00378C]" onClick={() => onSetChildTable("job")} disabled={disabled}>
                + Job
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 text-[#00378C]" onClick={() => onSetChildTable("expense")} disabled={disabled}>
                + Expense
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 text-[#00378C]" onClick={() => onSetChildTable("invoice")} disabled={disabled}>
                + Invoices
              </Button>
            </div>
          )}

          {childTable === "invoice" && onRefreshInvoices && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px] text-slate-600 hover:text-[#00378C]"
              onClick={onRefreshInvoices}
              disabled={disabled || loading}
              title="Reload outstanding invoices from server"
            >
              <RefreshCw size={11} className={`mr-1 ${loading ? "animate-spin" : ""}`} /> Reload
            </Button>
          )}

          {childTable && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2.5 text-[11px] font-semibold text-[#00378C] border-[#00378C]/40 hover:bg-blue-50"
              onClick={onAdd}
              disabled={disabled}
            >
              <Plus size={12} className="mr-1" /> Add Row
            </Button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center h-6 w-6 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 ml-1 cursor-pointer"
            title="Collapse allocation table"
          >
            <ChevronUp size={14} />
          </button>
        </div>
      </div>

      {/* Sub-table Body */}
      <div className="max-h-[220px] overflow-auto">
        <table className="w-full min-w-[760px] text-xs border-collapse">
          <thead className="sticky top-0 bg-[#00378C] text-white shadow-2xs z-10">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className={`px-2.5 py-1.5 font-semibold text-[11px] text-left text-white ${h === "Allocated Amount" || h === "Amount" || h === "Outstanding" || h === "Invoice Amount" ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={headers.length} className="px-3 py-6 text-center text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><RefreshCw size={13} className="animate-spin text-[#00378C]" /> Loading allocations...</span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-3 py-6 text-center text-slate-500">
                  <p className="font-semibold text-xs text-slate-600">No allocation lines found for this line.</p>
                  <span className="text-[11px] text-slate-400">Click &quot;Add Row&quot; above to add an allocation.</span>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors">
                  <td className="w-8 px-2 py-1 font-mono text-[11px] text-slate-500">{row.dtl_sr_no}</td>

                  {childTable === "invoice" ? (
                    <>
                      <td className="w-48 px-2 py-1">
                        <input
                          className="h-6 w-full rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-900 focus:border-[#00378C] focus:outline-none"
                          disabled={disabled}
                          placeholder="Invoice No"
                          value={text(row.inv_no)}
                          onChange={(e) => onChange(row.id, { inv_no: e.target.value })}
                          onBlur={(e) => onInvNoBlur?.(row.id, e.target.value, detail.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              onInvNoBlur?.(row.id, (e.target as HTMLInputElement).value, detail.id);
                            }
                          }}
                        />
                      </td>
                      <td className="w-32 px-2 py-1">
                        <Input
                          className="h-6 text-xs"
                          disabled={disabled}
                          type="date"
                          value={dateInput(row.inv_date)}
                          onChange={(e) => onChange(row.id, { inv_date: e.target.value })}
                        />
                      </td>
                      <td className="w-28 px-2 py-1 text-right font-mono text-[11px] text-slate-600">
                        {text(row.inv_amt)}
                      </td>
                      <td className="w-28 px-2 py-1 text-right font-mono text-[11px] font-medium text-slate-700">
                        {text(row.c_bal_amt_org)}
                      </td>
                      <td className="w-44 px-2 py-1">
                        <div className="flex items-center gap-1">
                          <Input
                            className="h-6 text-xs font-mono flex-1"
                            disabled={disabled}
                            type="number"
                            style={{ textAlign: "right" }}
                            step="0.001"
                            value={Number(((Number(row.amount) || 0) * (Number(row.ex_rate) || 1)).toFixed(3))}
                            onChange={(e) => onChange(row.id, { amount: Number(e.target.value || 0) })}
                          />
                          {Number(row.c_bal_amt_org || row.inv_amt || 0) > 0 && (
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => onChange(row.id, { amount: Number(row.c_bal_amt_org || row.inv_amt || 0) })}
                              className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 hover:bg-blue-50 hover:text-[#00378C] border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                              title="Allocate full outstanding amount"
                            >
                              Full
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  ) : childTable === "job" ? (
                    <>
                      <td className="w-48 px-2 py-1">
                        <LookupField
                          label="Job No"
                          compact
                          placeholder="Job No"
                          value={text(row.job_no)}
                          displayValue={text(row.job_no)}
                          columns={[
                            { field: "job_no", header: "Job No" },
                            { field: "job_date", header: "Job Date" },
                            { field: "confrim_date", header: "Confirm Date" },
                            { field: "prin_code", header: "Principal Code" },
                          ]}
                          valueField="job_no"
                          displayFields={["job_no", "job_date", "confrim_date", "prin_code"]}
                          loadOptions={() =>
                            getDynamicLookup({
                              parameter: "AC_BP_BR_TR_TI_JOBDETAIL",
                              loginid: user?.loginid ?? "",
                              code1: user?.company_code ?? "",
                            })
                          }
                          disabled={disabled}
                          onChange={(value) => onChange(row.id, { job_no: value })}
                        />
                      </td>
                      <td className="w-36 px-2 py-1">
                        <Input
                          className="h-6 text-xs"
                          disabled={disabled}
                          value={text(row.doc_refno)}
                          onChange={(e) => onChange(row.id, { doc_refno: e.target.value })}
                        />
                      </td>
                      <td className="w-36 px-2 py-1">
                        <Input
                          className="h-6 text-xs"
                          disabled={disabled}
                          value={text(row.doc_refno_2)}
                          onChange={(e) => onChange(row.id, { doc_refno_2: e.target.value })}
                        />
                      </td>
                      <td className="w-36 px-2 py-1">
                        <Input
                          className="h-6 text-xs font-mono"
                          disabled={disabled}
                          type="number"
                          style={{ textAlign: "right" }}
                          step="0.001"
                          value={Number(row.amount || 0)}
                          onChange={(e) => onChange(row.id, { amount: Number(e.target.value || 0) })}
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="w-44 px-2 py-1">
                        <LookupField
                          label="Expense Type"
                          compact
                          placeholder="Expense type"
                          value={text(row.exp_type_code)}
                          displayValue={
                            text(row.exp_type_code)
                              ? `${row.exp_type_code} - ${row.exp_type_description}`
                              : ""
                          }
                          columns={[
                            { field: "exp_type_code", header: "Expense Type Code" },
                            { field: "exp_description", header: "Expense Type Description" },
                          ]}
                          valueField="exp_type_code"
                          displayFields={["exp_type_code", "exp_type_description"]}
                          loadOptions={() =>
                            getDynamicLookup({
                              parameter: "AC_BP_BR_EXP_TYPE_CODE",
                              loginid: user?.loginid ?? "",
                              code1: user?.company_code ?? "",
                            })
                          }
                          disabled={disabled}
                          onChange={(value, lookupRow) =>
                            onChange(row.id, {
                              exp_type_code: value,
                              exp_type_description: value
                                ? text(getLookupValue(lookupRow || {}, "exp_type_description"))
                                : "",
                              exp_subtype_code: "",
                              exp_subtype_description: "",
                            })
                          }
                        />
                      </td>
                      <td className="w-44 px-2 py-1">
                        <LookupField
                          key={`subtype-${row.id}-${row.exp_type_code || "none"}`}
                          label="Expense Subtype"
                          compact
                          placeholder="Expense subtype"
                          value={text(row.exp_subtype_description)}
                          displayValue={
                            text(row.exp_subtype_code)
                              ? `${row.exp_subtype_code} - ${row.exp_subtype_description}`
                              : ""
                          }
                          columns={[
                            { field: "exp_subtype_code", header: "Expense Subtype Code" },
                            { field: "exp_subtype_description", header: "Expense Subtype Description" },
                          ]}
                          valueField="exp_subtype_code"
                          displayFields={["exp_subtype_code", "exp_subtype_description"]}
                          loadOptions={() => {
                            const currentExpType = text(row.exp_type_code);
                            if (!currentExpType) return Promise.resolve([]);
                            return getDynamicLookup({
                              parameter: "AC_BP_BR_EXP_SUBTYPE_CODE",
                              loginid: user?.loginid ?? "",
                              code1: user?.company_code ?? "",
                              code2: currentExpType,
                            });
                          }}
                          disabled={disabled || !row.exp_type_code}
                          onChange={(value, lookupRow) =>
                            onChange(row.id, {
                              exp_subtype_code: value,
                              exp_subtype_description: value
                                ? text(getLookupValue(lookupRow || {}, "exp_subtype_description"))
                                : "",
                            })
                          }
                        />
                      </td>
                      <td className="w-36 px-2 py-1">
                        <Input
                          className="h-6 text-xs"
                          disabled={disabled}
                          value={text(row.exp_description)}
                          onChange={(e) => onChange(row.id, { exp_description: e.target.value })}
                        />
                      </td>
                      <td className="w-28 px-2 py-1">
                        <Input
                          className="h-6 text-xs"
                          disabled={disabled}
                          value={text(row.job_no)}
                          onChange={(e) => onChange(row.id, { job_no: e.target.value })}
                        />
                      </td>
                      <td className="w-32 px-2 py-1">
                        <Input
                          className="h-6 text-xs font-mono"
                          disabled={disabled}
                          type="number"
                          style={{ textAlign: "right" }}
                          step="0.001"
                          value={Number(row.amount || 0)}
                          onChange={(e) => onChange(row.id, { amount: Number(e.target.value || 0) })}
                        />
                      </td>
                    </>
                  )}

                  <td className="w-8 px-2 py-1 text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onRemove(row.id)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove allocation row"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

