import { Plus, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Badge } from "../../../components/ui/Badge";
import { AbsentDetailRow } from "./Absentprocesstypes";
import { recalcRow, calcTotalAmount, calcTotalDays, formatCurrency } from "./Absentprocessutils";

interface AbsentProcessLinesTableProps {
  rows: AbsentDetailRow[];
  onRowsChange: (rows: AbsentDetailRow[]) => void;
  readOnly?: boolean;
}

export function AbsentProcessLinesTable({ rows, onRowsChange, readOnly = false }: AbsentProcessLinesTableProps) {
  const updateRow = (index: number, patch: Partial<AbsentDetailRow>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    const touchedDates = "absent_from_date" in patch || "absent_to_date" in patch;
    onRowsChange(touchedDates ? next.map((r, i) => (i === index ? recalcRow(r) : r)) : next);
  };

  const addRow = () => {
    onRowsChange([
      ...rows,
      { serial_no: rows.length + 1, pay_unit: "", description: "", effective_from: "", absent_from_date: "", absent_to_date: "", no_of_days: 0, amount: 0, ref_leave_doc_no: "", is_canceled: false },
    ]);
  };

  const removeRow = (index: number) => {
    onRowsChange(rows.filter((_, i) => i !== index).map((r, i) => ({ ...r, serial_no: i + 1 })));
  };

  const totalAmount = calcTotalAmount(rows);
  const totalDays = calcTotalDays(rows);

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
              <th className="px-3 py-2">Pay Unit</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Effective From</th>
              <th className="px-3 py-2">Absent From</th>
              <th className="px-3 py-2">Absent To</th>
              <th className="px-3 py-2 text-right">No. of Days</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Ref Leave Doc No</th>
              <th className="px-3 py-2 text-center">Status</th>
              {!readOnly && <th className="w-10 px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.serial_no} className={`border-b last:border-0 hover:bg-muted/30 ${row.is_canceled ? "opacity-50" : ""}`}>
                <td className="px-3 py-2 text-muted-foreground">{row.serial_no}</td>
                <td className="px-3 py-2">
                  <Input value={row.pay_unit} disabled={readOnly} onChange={(e) => updateRow(index, { pay_unit: e.target.value })} className="h-8" />
                </td>
                <td className="px-3 py-2">
                  <Input value={row.description} disabled={readOnly} onChange={(e) => updateRow(index, { description: e.target.value })} className="h-8 min-w-[180px]" />
                </td>
                <td className="px-3 py-2">
                  <Input type="date" value={row.effective_from} disabled={readOnly} onChange={(e) => updateRow(index, { effective_from: e.target.value })} className="h-8" />
                </td>
                <td className="px-3 py-2">
                  <Input type="date" value={row.absent_from_date} disabled={readOnly} onChange={(e) => updateRow(index, { absent_from_date: e.target.value })} className="h-8" />
                </td>
                <td className="px-3 py-2">
                  <Input type="date" value={row.absent_to_date} disabled={readOnly} onChange={(e) => updateRow(index, { absent_to_date: e.target.value })} className="h-8" />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{row.no_of_days}</td>
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
                  <Input value={row.ref_leave_doc_no} disabled={readOnly} onChange={(e) => updateRow(index, { ref_leave_doc_no: e.target.value })} className="h-8" />
                </td>
                <td className="px-3 py-2 text-center">
                  {readOnly ? (
                    <Badge variant={row.is_canceled ? "outline" : "default"} className={row.is_canceled ? "border-destructive text-destructive" : ""}>
                      {row.is_canceled ? "Cancelled" : "Active"}
                    </Badge>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateRow(index, { is_canceled: !row.is_canceled })}
                      className="inline-flex"
                    >
                      <Badge variant={row.is_canceled ? "outline" : "default"} className={row.is_canceled ? "cursor-pointer border-destructive text-destructive" : "cursor-pointer"}>
                        {row.is_canceled ? "Cancelled" : "Active"}
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
                <td colSpan={readOnly ? 10 : 11} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No absence lines added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-8 border-t bg-muted/30 px-5 py-3">
        <div className="text-sm">
          <span className="text-muted-foreground">Total Days: </span>
          <span className="font-semibold tabular-nums">{totalDays}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Total Amount: </span>
          <span className="font-semibold tabular-nums">{formatCurrency(totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}