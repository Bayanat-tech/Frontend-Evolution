import { AlertCircle, Briefcase, CheckCircle2, ChevronUp, FileText, Plus, Receipt, RefreshCw, Trash2, Zap } from "lucide-react";
import { TransactionChildRow, TransactionDetail } from "../../api/transactions";
import { getDynamicLookup, getLookupValue } from "../../api/lookups";
import { BiscDatePicker } from "../ui/BiscDatePicker";
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

  const handleAllocateAll = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    rows.forEach((r) => {
      const maxAmt = Number(r.c_bal_amt_org || r.inv_amt || 0);
      if (maxAmt > 0) {
        onChange(r.id, { amount: maxAmt });
      }
    });
  };

  const handleFillDiff = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
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

  // Define compact column configs with fixed widths
  const colConfigs =
    childTable === "invoice"
      ? [
          { key: "sr", header: "#", width: 28, align: "center" },
          { key: "inv_no", header: "Invoice No", width: 130, align: "left" },
          { key: "inv_date", header: "Invoice Date", width: 120, align: "left" },
          { key: "inv_amt", header: "Invoice Amount", width: 100, align: "right" },
          { key: "outstanding", header: "Outstanding", width: 100, align: "right" },
          { key: "allocated", header: "Allocated Amount", width: 120, align: "right" },
          { key: "action", header: "", width: 27, align: "center" },
        ]
      : childTable === "job"
        ? [
            { key: "sr", header: "#", width: 28, align: "center" },
            { key: "job_no", header: "Job No", width: 150, align: "left" },
            { key: "doc_refno", header: "Doc Ref", width: 115, align: "left" },
            { key: "doc_refno_2", header: "Doc Ref 2", width: 115, align: "left" },
            { key: "amount", header: "Amount", width: 105, align: "right" },
            { key: "action", header: "", width: 27, align: "center" },
          ]
        : [
            { key: "sr", header: "#", width: 28, align: "center" },
            { key: "exp_type", header: "Expense Type", width: 125, align: "left" },
            { key: "exp_subtype", header: "Expense Subtype", width: 125, align: "left" },
            { key: "description", header: "Description", width: 130, align: "left" },
            { key: "job_no", header: "Job No", width: 95, align: "left" },
            { key: "amount", header: "Amount", width: 105, align: "right" },
            { key: "action", header: "", width: 27, align: "center" },
          ];

  const totalTableWidth = colConfigs.reduce((sum, col) => sum + col.width, 0);

  return (
    <div className="finance-allocation-panel my-0.5 rounded border border-slate-300 bg-white shadow-2xs overflow-hidden text-xs w-fit max-w-full">
      {/* Sub-toolbar: Ultra-compact, no unwanted verbose titles */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200 bg-slate-100/90 px-2 py-1 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Compact Child Type Badge */}
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#173f6c] text-white text-[10px] font-semibold uppercase tracking-wide shadow-2xs">
            {childTable === "invoice" ? (
              <FileText size={10} />
            ) : childTable === "job" ? (
              <Briefcase size={10} />
            ) : (
              <Receipt size={10} />
            )}
            <span>
              {childTable === "invoice"
                ? "Invoices"
                : childTable === "job"
                  ? "Job"
                  : childTable === "expense"
                    ? "Expense"
                    : "Allocations"}
            </span>
          </span>

          {childTable && (
            <div className="flex items-center gap-1 flex-wrap">
              {/* Summary Chip */}
              <span className="inline-flex items-center rounded bg-white border border-slate-300 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 shadow-2xs">
                Allocated: <strong className="ml-1 text-slate-900">{formatAmount(totalAllocated)}</strong>
                <span className="mx-1 text-slate-300">/</span>
                Line: <strong className="ml-1 text-slate-900">{formatAmount(parentAmount)}</strong>
              </span>

              {/* Status Badge */}
              {isMatched ? (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-700">
                  <CheckCircle2 size={10} /> Matched
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-300 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-700">
                  <AlertCircle size={10} /> Diff: {formatAmount(Math.abs(diff))}
                </span>
              )}

              {/* Action Buttons: Auto-Fill & Allocate All */}
              {childTable === "invoice" && rows.length > 0 && !isMatched && diff > 0 && (
                <button
                  type="button"
                  onClick={handleFillDiff}
                  disabled={disabled}
                  className="inline-flex items-center gap-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-1.5 py-0.5 text-[9.5px] font-semibold cursor-pointer transition-colors"
                  title="Allocate remaining difference to invoice lines"
                >
                  <Zap size={9} /> Fill Diff ({formatAmount(diff)})
                </button>
              )}

              {childTable === "invoice" && rows.length > 0 && (
                <button
                  type="button"
                  onClick={handleAllocateAll}
                  disabled={disabled}
                  className="inline-flex items-center gap-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 px-1.5 py-0.5 text-[9.5px] font-semibold cursor-pointer transition-colors"
                  title="Allocate full outstanding balance to all invoices"
                >
                  <CheckCircle2 size={9} /> Allocate All
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right-side actions: Add, Reload, Collapse */}
        <div className="flex items-center gap-1">
          {!childTable && onSetChildTable && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500">Attach:</span>
              <button
                type="button"
                className="h-5 px-1.5 text-[10px] font-semibold rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                onClick={() => onSetChildTable("job")}
                disabled={disabled}
              >
                + Job
              </button>
              <button
                type="button"
                className="h-5 px-1.5 text-[10px] font-semibold rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                onClick={() => onSetChildTable("expense")}
                disabled={disabled}
              >
                + Expense
              </button>
              <button
                type="button"
                className="h-5 px-1.5 text-[10px] font-semibold rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                onClick={() => onSetChildTable("invoice")}
                disabled={disabled}
              >
                + Invoices
              </button>
            </div>
          )}

          {childTable === "invoice" && onRefreshInvoices && (
            <button
              type="button"
              className="inline-flex items-center h-5 px-1.5 text-[10px] font-medium rounded border border-slate-300 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
              onClick={onRefreshInvoices}
              disabled={disabled || loading}
              title="Reload outstanding invoices from server"
            >
              <RefreshCw size={10} className={`mr-1 ${loading ? "animate-spin" : ""}`} /> Reload
            </button>
          )}

          {childTable && (
            <button
              type="button"
              className="inline-flex items-center h-5 px-2 text-[10px] font-bold rounded bg-[#173f6c] text-white hover:bg-[#1f5087] shadow-2xs cursor-pointer transition-colors"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAdd();
              }}
              disabled={disabled}
              title="Add a new allocation row"
            >
              <Plus size={10} className="mr-0.5" /> Add Row
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="inline-flex items-center justify-center h-5 w-5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
            title="Collapse allocation table"
          >
            <ChevronUp size={12} />
          </button>
        </div>
      </div>

      {/* Sub-table Body: Compact height, fixed width with Steel Navy Header */}
      <div className="max-h-[160px] overflow-auto">
        <table
          className="table-fixed text-xs border-collapse"
          style={{ width: `${totalTableWidth}px` }}
        >
          <colgroup>
            {colConfigs.map((col, i) => (
              <col key={i} style={{ width: `${col.width}px` }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 bg-[#173f6c] text-white shadow-2xs z-10">
            <tr>
              {colConfigs.map((col, i) => (
                <th
                  key={i}
                  className={`px-1.5 py-1 text-[10.5px] font-semibold text-white tracking-wider border-r border-[#26538c]/70 last:border-r-0 ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left"
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colConfigs.length} className="px-2 py-4 text-center text-slate-400">
                  <span className="inline-flex items-center gap-1 text-[11px]">
                    <RefreshCw size={11} className="animate-spin text-slate-600" /> Loading allocations...
                  </span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colConfigs.length} className="px-2 py-3 text-center text-slate-500 bg-white">
                  <p className="font-medium text-[11px] text-slate-600">No allocation lines found.</p>
                  <span className="text-[10px] text-slate-400">Click &quot;+ Add Row&quot; above to add an allocation.</span>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors"
                >
                  {/* # Column */}
                  <td className="px-1 py-0.5 text-center font-mono text-[10.5px] text-slate-500">
                    {row.dtl_sr_no}
                  </td>

                  {childTable === "invoice" ? (
                    <>
                      {/* Invoice No */}
                      <td className="px-1 py-0.5">
                        <input
                          className="h-[22px] w-full rounded border border-slate-300 bg-white px-1.5 py-0 text-[11px] font-medium text-slate-900 focus:border-[#173f6c] focus:outline-none"
                          disabled={disabled}
                          placeholder="Invoice No"
                          value={text(row.inv_no)}
                          onChange={(e) => onChange(row.id, { inv_no: e.target.value })}
                          onBlur={(e) => onInvNoBlur?.(row.id, e.target.value, detail.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                              onInvNoBlur?.(row.id, (e.target as HTMLInputElement).value, detail.id);
                            }
                          }}
                        />
                      </td>

                      {/* Invoice Date with compact BiscDatePicker */}
                      <td className="px-1 py-0.5">
                        <BiscDatePicker
                          compact
                          disabled={disabled}
                          value={dateInput(row.inv_date)}
                          onChange={(val) => onChange(row.id, { inv_date: val })}
                        />
                      </td>

                      {/* Invoice Amount */}
                      <td className="px-1.5 py-0.5 text-right font-mono text-[10.5px] text-slate-600 truncate">
                        {row.inv_amt != null ? formatAmount(Number(row.inv_amt)) : "-"}
                      </td>

                      {/* Outstanding */}
                      <td className="px-1.5 py-0.5 text-right font-mono text-[10.5px] font-semibold text-slate-800 truncate">
                        {row.c_bal_amt_org != null ? formatAmount(Number(row.c_bal_amt_org)) : "-"}
                      </td>

                      {/* Allocated Amount with compact Full button */}
                      <td className="px-1 py-0.5">
                        <div className="flex items-center gap-1">
                          <input
                            className="h-[22px] w-full rounded border border-slate-300 bg-white px-1.5 py-0 text-[11px] font-mono text-right text-slate-900 focus:border-[#173f6c] focus:outline-none"
                            disabled={disabled}
                            type="number"
                            step="0.001"
                            value={Number(row.amount || 0)}
                            onChange={(e) => onChange(row.id, { amount: Number(e.target.value || 0) })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                e.stopPropagation();
                              }
                            }}
                          />
                          {Number(row.c_bal_amt_org || row.inv_amt || 0) > 0 && (
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onChange(row.id, { amount: Number(row.c_bal_amt_org || row.inv_amt || 0) });
                              }}
                              className="h-[20px] px-1 text-[9px] font-bold rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 transition-colors cursor-pointer shrink-0"
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
                      {/* Job No */}
                      <td className="px-1 py-0.5">
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

                      {/* Doc Ref */}
                      <td className="px-1 py-0.5">
                        <input
                          className="h-[22px] w-full rounded border border-slate-300 bg-white px-1.5 py-0 text-[11px] text-slate-900 focus:border-[#173f6c] focus:outline-none"
                          disabled={disabled}
                          value={text(row.doc_refno)}
                          onChange={(e) => onChange(row.id, { doc_refno: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        />
                      </td>

                      {/* Doc Ref 2 */}
                      <td className="px-1 py-0.5">
                        <input
                          className="h-[22px] w-full rounded border border-slate-300 bg-white px-1.5 py-0 text-[11px] text-slate-900 focus:border-[#173f6c] focus:outline-none"
                          disabled={disabled}
                          value={text(row.doc_refno_2)}
                          onChange={(e) => onChange(row.id, { doc_refno_2: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        />
                      </td>

                      {/* Amount */}
                      <td className="px-1 py-0.5">
                        <input
                          className="h-[22px] w-full rounded border border-slate-300 bg-white px-1.5 py-0 text-[11px] font-mono text-right text-slate-900 focus:border-[#173f6c] focus:outline-none"
                          disabled={disabled}
                          type="number"
                          step="0.001"
                          value={Number(row.amount || 0)}
                          onChange={(e) => onChange(row.id, { amount: Number(e.target.value || 0) })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      {/* Expense Type */}
                      <td className="px-1 py-0.5">
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
                          displayFields={["exp_type_code", "exp_description"]}
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

                      {/* Expense Subtype */}
                      <td className="px-1 py-0.5">
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

                      {/* Description */}
                      <td className="px-1 py-0.5">
                        <input
                          className="h-[22px] w-full rounded border border-slate-300 bg-white px-1.5 py-0 text-[11px] text-slate-900 focus:border-[#173f6c] focus:outline-none"
                          disabled={disabled}
                          value={text(row.exp_description)}
                          onChange={(e) => onChange(row.id, { exp_description: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        />
                      </td>

                      {/* Job No */}
                      <td className="px-1 py-0.5">
                        <input
                          className="h-[22px] w-full rounded border border-slate-300 bg-white px-1.5 py-0 text-[11px] text-slate-900 focus:border-[#173f6c] focus:outline-none"
                          disabled={disabled}
                          value={text(row.job_no)}
                          onChange={(e) => onChange(row.id, { job_no: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        />
                      </td>

                      {/* Amount */}
                      <td className="px-1 py-0.5">
                        <input
                          className="h-[22px] w-full rounded border border-slate-300 bg-white px-1.5 py-0 text-[11px] font-mono text-right text-slate-900 focus:border-[#173f6c] focus:outline-none"
                          disabled={disabled}
                          type="number"
                          step="0.001"
                          value={Number(row.amount || 0)}
                          onChange={(e) => onChange(row.id, { amount: Number(e.target.value || 0) })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        />
                      </td>
                    </>
                  )}

                  {/* Action Column */}
                  <td className="px-1 py-0.5 text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemove(row.id);
                      }}
                      className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove allocation row"
                    >
                      <Trash2 size={11} />
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
