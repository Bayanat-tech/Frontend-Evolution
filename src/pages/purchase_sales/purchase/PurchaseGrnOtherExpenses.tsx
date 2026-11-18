import { Plus, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { ExpenseRow } from "./Purchaseordertypes";
import { lowerRecord, text } from "./Purchaseorderutils";

export function PurchaseGrnOtherExpenses({
  rows,
  updateRow,
  addRow,
  removeRow,
  disabled,
}: {
  rows: ExpenseRow[];
  updateRow: (id: string, patch: Partial<ExpenseRow>) => void;
  addRow: () => void;
  removeRow: (id: string) => void;
  disabled: boolean;
}) {
  const { user } = useAuth();
  const companyCode = user?.company_code;
  const loginIdOrAdmin = user?.loginid || user?.username || "ADMIN";

  const total = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const lcurTotal = rows.reduce((sum, row) => sum + (Number(row.lcur_amount) || 0), 0);

  return (
    <section className="commercial-lines-card min-w-0 overflow-hidden rounded-md border bg-card">
      <div className="flex items-center justify-between gap-3 border-b bg-secondary/40 px-3 py-2">
        <h3 className="text-sm font-semibold text-foreground">Other Expenses</h3>
        <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={disabled}>
          <Plus size={14} /> Add
        </Button>
      </div>

      <div className="max-h-[32vh] min-w-0 overflow-auto">
        <table className="finance-lines-table w-full min-w-[1200px] border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-[#00378C] text-left font-semibold text-white">
            <tr>
              <th className="w-12 px-2 py-2">SNo.</th>
              <th className="w-44 px-2 py-2">Exp Code</th>
              <th className="w-56 px-2 py-2">Expense Name</th>
              <th className="w-36 px-2 py-2">A/c Code</th>
              <th className="px-2 py-2">Remarks</th>
              <th className="w-36 px-2 py-2 text-right">Amount</th>
              <th className="w-40 px-2 py-2">Currency</th>
              <th className="w-32 px-2 py-2 text-right">Ex Rate</th>
              <th className="w-36 px-2 py-2 text-right">LCur Amount</th>
              <th className="w-12 px-2 py-2" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                  No expenses yet
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr className="border-t odd:bg-muted/20" key={row.id}>
                  <td className="px-2 py-1.5">{index + 1}</td>
                  <td className="px-2 py-1.5">
                    <LookupField
                      label=""
                      value={row.exp_code || ""}
                      displayValue={
                        row.exp_code
                          ? row.expense_name
                            ? `${row.exp_code} - ${row.expense_name}`
                            : row.exp_code
                          : ""
                      }
                      columns={[
                        { field: "expense_code", header: "Code" },
                        { field: "expense_name", header: "Name" },
                        { field: "ac_code", header: "A/c Code" },
                      ]}
                      valueField="expense_code"
                      displayFields={["expense_code", "expense_name"]}
                      loadOptions={() =>
                        getDynamicLookup({
                          parameter: "PS_GRN_ENTRY_MSE_EXPENSES",
                          code1: companyCode,
                          loginid: loginIdOrAdmin,
                        })
                      }
                      disabled={disabled}
                      onChange={(value, lookupRow) => {
                        const r = lowerRecord((lookupRow || {}) as Record<string, unknown>);
                        updateRow(row.id, {
                          exp_code: value || null,
                          expense_name: text(r.expense_name) || null,
                          ac_code: text(r.ac_code) || null,
                        });
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={`Expense name ${index + 1}`}
                      value={row.expense_name || ""}
                      disabled={disabled}
                      onChange={(event) => updateRow(row.id, { expense_name: event.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={`Expense account code ${index + 1}`}
                      value={row.ac_code || ""}
                      disabled
                      readOnly
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={`Expense remarks ${index + 1}`}
                      value={row.remarks || ""}
                      disabled={disabled}
                      onChange={(event) => updateRow(row.id, { remarks: event.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={`Expense amount ${index + 1}`}
                      type="number"
                      min="0"
                      step="0.01"
                      className="text-right"
                      value={row.amount}
                      disabled={disabled}
                      onChange={(event) => {
                        const amount = Number(event.target.value) || 0;
                        updateRow(row.id, {
                          amount,
                          lcur_amount: Number((amount * (Number(row.ex_rate) || 1)).toFixed(2)),
                        });
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <LookupField
                      label=""
                      value={row.curr_code || ""}
                      displayValue={row.curr_code || ""}
                      columns={[
                        { field: "curr_code", header: "Code" },
                        { field: "curr_name", header: "Name" },
                      ]}
                      valueField="curr_code"
                      displayFields={["curr_code", "curr_name"]}
                      loadOptions={() =>
                        getDynamicLookup({
                          parameter: "Account_Currency_CODE_Serach",
                          code1: companyCode,
                          loginid: loginIdOrAdmin,
                        })
                      }
                      disabled={disabled}
                      onChange={(value, lookupRow) => {
                        const exRate =
                          Number(getLookupValue(lookupRow || {}, "ex_rate") || (lookupRow as any)?.ex_rate || row.ex_rate || 1) || 1;
                        updateRow(row.id, {
                          curr_code: value || null,
                          ex_rate: exRate,
                          lcur_amount: Number(((Number(row.amount) || 0) * exRate).toFixed(2)),
                        });
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={`Expense exchange rate ${index + 1}`}
                      type="number"
                      min="0"
                      step="0.0001"
                      className="text-right"
                      value={row.ex_rate}
                      disabled={disabled}
                      onChange={(event) => {
                        const exRate = Number(event.target.value) || 0;
                        updateRow(row.id, {
                          ex_rate: exRate,
                          lcur_amount: Number((Number(row.amount) * exRate).toFixed(2)),
                        });
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={`Expense local currency amount ${index + 1}`}
                      type="number"
                      className="text-right"
                      value={Number(row.lcur_amount || 0).toFixed(2)}
                      disabled
                      readOnly
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete expense ${index + 1}`}
                      onClick={() => removeRow(row.id)}
                      disabled={disabled}
                      className="h-8 w-8 text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-red-300 bg-muted/20">
              <td colSpan={5} className="px-3 py-2 text-right font-semibold">Total:</td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums">{total.toFixed(2)}</td>
              <td colSpan={2} />
              <td className="px-2 py-2 text-right font-semibold tabular-nums">{lcurTotal.toFixed(2)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}