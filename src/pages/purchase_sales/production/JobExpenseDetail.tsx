import { Plus, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { ExpenseRow } from "../purchase/Purchaseordertypes";
import { text } from "../purchase/Purchaseorderutils";

export function OtherExpensesTable({
    rows,
    updateRow,
    addRow,
    removeRow,
    headerAndLineDisabled,
    companyCode,
    loginid,
}: {
    rows: ExpenseRow[];
    updateRow: (id: string, patch: Partial<ExpenseRow>) => void;
    addRow: () => void;
    removeRow: (id: string) => void;
    headerAndLineDisabled: boolean;
    companyCode?: string;
    loginid?: string;
}) {
    const totalValue = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const totalLcurAmount = rows.reduce((sum, row) => sum + (Number(row.lcur_amount) || 0), 0);

    const recalcLcurAmount = (amount: number, exRate: number) => Number((amount * exRate).toFixed(2));

    return (
        <div className="commercial-lines-card rounded-md border bg-card">
            <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-1.5">
                <div>
                    <p className="eyebrow m-0">Other Expenses</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Other Expenses</h3>
                </div>
                <div className="flex items-center gap-2">
                    <Button disabled={headerAndLineDisabled} size="sm" type="button" variant="outline" onClick={addRow}>
                        <Plus size={14} /> Add Expense
                    </Button>
                </div>
            </div>
            <div className="commercial-lines-scroll max-h-[45vh] overflow-auto">
                <table className="finance-lines-table w-full min-w-[1400px] text-sm">
                    <thead className="text-xs text-primary-foreground">
                        <tr>
                            <th className="px-2 py-2 text-left" style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--primary, #1d4ed8)", width: "48px", minWidth: "48px" }}>SNo</th>
                            <th className="px-2 py-2 text-left" style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--primary, #1d4ed8)", width: "160px", minWidth: "160px" }}>Type</th>
                            <th className="px-2 py-2 text-left" style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--primary, #1d4ed8)", width: "220px", minWidth: "220px" }}>Employee</th>
                            <th className="px-2 py-2 text-left" style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--primary, #1d4ed8)", width: "300px", minWidth: "300px" }}>Remarks</th>
                            <th className="px-2 py-2 text-left" style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--primary, #1d4ed8)", width: "120px", minWidth: "120px" }}>Value</th>
                            <th className="px-2 py-2 text-left" style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--primary, #1d4ed8)", width: "130px", minWidth: "130px" }}>Currency</th>
                            <th className="px-2 py-2 text-left" style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--primary, #1d4ed8)", width: "100px", minWidth: "100px" }}>Ex Rate</th>
                            <th className="px-2 py-2 text-left" style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--primary, #1d4ed8)", width: "130px", minWidth: "130px" }}>Lcur Amount</th>
                            <th className="px-2 py-2 text-center" style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--primary, #1d4ed8)", width: "60px", minWidth: "60px" }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={9}>No expenses yet</td></tr>
                        ) : rows.map((row, index) => (
                            <tr className="border-t odd:bg-muted/20" key={row.id}>
                                <td className="px-2 py-1 text-xs w-12">{index + 1}</td>

                                <td className="px-2 py-1">
                                    <select
                                        className="finance-money-input w-full rounded-md border bg-card px-2 py-1 text-sm"
                                        value={row.exp_code || ""}
                                        disabled={headerAndLineDisabled}
                                        onChange={(event) => updateRow(row.id, { exp_code: event.target.value })}
                                    >
                                        <option value="">Select</option>
                                        <option value="I">Internal</option>
                                        <option value="E">External</option>
                                    </select>
                                </td>

                                <td className="px-2 py-1">
                                    <LookupField
                                        label=""
                                        value={row.employee_id || ""}
                                        displayValue={row.employee_id || ""}
                                        columns={[{ field: "employee_id", header: "Code" }, { field: "rpt_name", header: "Name" }]}
                                        valueField="employee_id"
                                        displayFields={["employee_id", "rpt_name"]}
                                        loadOptions={() =>
                                            getDynamicLookup({
                                                parameter: "PS_POORDER_ENTRY_EMPLOYEE_LIST",
                                                code1: companyCode,
                                                code2: row.div_code || "",
                                                code3: row.exp_code || "",
                                                loginid: loginid || "ADMIN",
                                            })
                                        }
                                        disabled={headerAndLineDisabled}
                                        onChange={(value) => updateRow(row.id, { employee_id: value })}
                                    />
                                </td>

                                <td className="px-2 py-1">
                                    <Input
                                        disabled={headerAndLineDisabled}
                                        value={row.remarks || ""}
                                        onChange={(event) => updateRow(row.id, { remarks: text(event.target.value) })}
                                    />
                                </td>

                                <td className="finance-amount-cell px-2 py-1">
                                    <Input
                                        className="finance-money-input"
                                        disabled={headerAndLineDisabled}
                                        type="number"
                                        style={{ textAlign: "right" }}
                                        step="0.01"
                                        value={row.amount}
                                        onChange={(event) => {
                                            const amount = Number(event.target.value || 0);
                                            updateRow(row.id, { amount, lcur_amount: recalcLcurAmount(amount, Number(row.ex_rate) || 1) });
                                        }}
                                    />
                                </td>

                                <td className="px-2 py-1">
                                    <LookupField
                                        label=""
                                        value={row.curr_code || ""}
                                        displayValue={row.curr_code || ""}
                                        columns={[{ field: "curr_code", header: "Code" }, { field: "curr_name", header: "Name" }]}
                                        valueField="curr_code"
                                        displayFields={["curr_code"]}
                                        loadOptions={() => getDynamicLookup({ parameter: "Account_Currency_CODE_Serach", code1: companyCode, loginid: loginid || "ADMIN" })}
                                        disabled={headerAndLineDisabled}
                                        onChange={(value, selectedRow) => updateRow(row.id, {
                                            curr_code: value,
                                            ex_rate: Number(getLookupValue(selectedRow || {}, "ex_rate")) || row.ex_rate,
                                        })}
                                    />
                                </td>

                                <td className="finance-amount-cell px-2 py-1">
                                    <Input
                                        className="finance-money-input"
                                        disabled={headerAndLineDisabled}
                                        type="number"
                                        style={{ textAlign: "right" }}
                                        step="0.0001"
                                        value={row.ex_rate}
                                        onChange={(event) => {
                                            const exRate = Number(event.target.value || 0);
                                            updateRow(row.id, { ex_rate: exRate, lcur_amount: recalcLcurAmount(Number(row.amount) || 0, exRate) });
                                        }}
                                    />
                                </td>

                                <td className="finance-amount-cell px-2 py-1">
                                    <Input
                                        className="finance-money-input"
                                        disabled={headerAndLineDisabled}
                                        type="number"
                                        style={{ textAlign: "right" }}
                                        step="0.01"
                                        value={row.lcur_amount}
                                        onChange={(event) => updateRow(row.id, { lcur_amount: Number(event.target.value || 0) })}
                                    />
                                </td>

                                <td className="px-2 py-1 text-center">
                                    <Button disabled={headerAndLineDisabled} size="icon" type="button" variant="ghost" onClick={() => removeRow(row.id)}>
                                        <X size={14} />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex items-center justify-end gap-8 border-t px-3 py-2 text-sm">
                <span className="text-muted-foreground font-semibold">Total :</span>
                <strong className="w-28 text-right">{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                <strong className="w-28 text-right">{totalLcurAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
        </div>
    );
}