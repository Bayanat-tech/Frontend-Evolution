import { Plus, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Badge } from "../../../components/ui/Badge";
import { AbsentDetailRow } from "./Absentprocesstypes";
import { calcTotalAmount, calcTotalDeductDays, formatCurrency } from "./Absentprocessutils";

interface AbsentProcessLinesTableProps {
  rows: AbsentDetailRow[];
  onRowsChange: (rows: AbsentDetailRow[]) => void;
  readOnly?: boolean;
}

export function AbsentProcessLinesTable({ rows, onRowsChange, readOnly = false }: AbsentProcessLinesTableProps) {
  const updateRow = (index: number, patch: Partial<AbsentDetailRow>) => {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    onRowsChange([...rows, emptyRow(rows.length + 1)]);
  };

  const removeRow = (index: number) => {
    onRowsChange(rows.filter((_, i) => i !== index).map((r, i) => ({ ...r, serial_no: i + 1 })));
  };

  const totalAmount = calcTotalAmount(rows);
  const totalDeductDays = calcTotalDeductDays(rows);

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h3 className="text-sm font-semibold">Absence Details</h3>
        {!readOnly && (
          <Button type="button" size="sm" variant="outline" onClick={addRow}>
            <Plus size={14} className="mr-1" /> Add Line
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <th className="w-10 px-3 py-2">#</th>
              <th className="px-3 py-2">Employee Code</th>
              <th className="px-3 py-2 text-right">Pay unit</th>
              <th className="px-3 py-2 text-right">Effective Date</th>
              <th className="px-3 py-2 text-center">Absent From</th>
              <th className="px-3 py-2 text-center">Absent To</th>
              <th className="px-3 py-2 text-right">Deduct Days</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Ref Leave Doc No</th>
              {!readOnly && <th className="w-10 px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.serial_no} className={`border-b last:border-0 hover:bg-muted/30 ${row.cancel_status ? "opacity-50" : ""}`}>
                <td className="px-3 py-2 text-muted-foreground">{row.serial_no}</td>
                <td className="px-3 py-2">
                  <Input
                    value={row.employee_code}
                    disabled={readOnly}
                    onChange={(e) => updateRow(index, { employee_code: e.target.value })}
                    className="h-8 min-w-[140px]"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={row.pay_unit ?? ""}
                    disabled={readOnly}
                    onChange={(e) => updateRow(index, { pay_unit: e.target.value })}
                    className="h-8 min-w-[140px]"
                  />
                </td>

                <td className="px-3 py-2">
                  <Input
                    type="date"
                    value={
                      row.recover_from_dt
                        ? new Date(row.recover_from_dt).toISOString().split("T")[0]
                        : ""
                    }
                    disabled={readOnly}
                    onChange={(e) =>
                      updateRow(index, {
                        recover_from_dt: e.target.value
                          ? new Date(e.target.value)
                          : undefined,
                      })
                    }
                    className="h-8"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="date"
                    value={
                      row.recover_from_dt
                        ? new Date(row.recover_from_dt).toISOString().split("T")[0]
                        : ""
                    }
                    disabled={readOnly}
                    onChange={(e) =>
                      updateRow(index, {
                        recover_from_dt: e.target.value
                          ? new Date(e.target.value)
                          : undefined,
                      })
                    }
                    className="h-8"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="date"
                    value={
                      row.recover_from_dt
                        ? new Date(row.recover_from_dt).toISOString().split("T")[0]
                        : ""
                    }
                    disabled={readOnly}
                    onChange={(e) =>
                      updateRow(index, {
                        recover_from_dt: e.target.value
                          ? new Date(e.target.value)
                          : undefined,
                      })
                    }
                    className="h-8"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  {readOnly ? (
                    row.deduct_from_leave
                  ) : (
                    <select
                      value={row.deduct_from_leave}
                      onChange={(e) => updateRow(index, { deduct_from_leave: e.target.value })}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="N">N</option>
                      <option value="Y">Y</option>
                    </select>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    value={row.deduct_noof_leavedays}
                    disabled={readOnly}
                    onChange={(e) => updateRow(index, { deduct_noof_leavedays: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-right"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    value={row.amount}
                    disabled={readOnly}
                    onChange={(e) => updateRow(index, { amount: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-right"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={row.ref_leave_doc_no ?? ""}
                    disabled={readOnly}
                    onChange={(e) => updateRow(index, { ref_leave_doc_no: e.target.value })}
                    className="h-8"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  {readOnly ? (
                    <Badge variant={row.cancel_status ? "outline" : "default"} className={row.cancel_status ? "border-destructive text-destructive" : ""}>
                      {row.cancel_status ? "Cancelled" : "Active"}
                    </Badge>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateRow(index, { cancel_status: row.cancel_status ? null : "C" })}
                      className="inline-flex"
                    >
                      <Badge variant={row.cancel_status ? "outline" : "default"} className={row.cancel_status ? "cursor-pointer border-destructive text-destructive" : "cursor-pointer"}>
                        {row.cancel_status ? "Cancelled" : "Active"}
                      </Badge>
                    </button>
                  )}
                </td>
                {!readOnly && (
                  <td className="px-3 py-2 text-center">
                    <Button size="icon" variant="ghost" onClick={() => removeRow(index)} title="Remove line">
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 9 : 10} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No absence lines added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-8 border-t bg-muted/30 px-5 py-3">
        <div className="text-sm">
          <span className="text-muted-foreground">Total Deduct Days: </span>
          <span className="font-semibold tabular-nums">{totalDeductDays}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Total Amount: </span>
          <span className="font-semibold tabular-nums">{formatCurrency(totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}

function emptyRow(serial: number): AbsentDetailRow {
  return {
    serial_no: serial,
    employee_code: "",
    amount: 0,
    allocated_amt: 0,
    balance_amt: 0,
    deduct_from_leave: "N",
    deduct_noof_leavedays: 0,
    ref_leave_doc_no: "",
    cancel_status: null,
  };
}