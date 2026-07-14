import { useEffect, useState } from "react";
import { Dialog } from "../../../components/ui/Dialog";
import { Button } from "../../../components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/Table";
import { useAuth } from "../../../state/AuthContext";
import { getStorageSelection, normalizeStorageRow, StorageSelectionRow } from "../../../api/billing";

type StorageSelectionModalProps = {
  prinCode: string;
  consolidatedInvNo: string;
  fromDate?: string | Date | null;
  toDate?: string | Date | null;
  onClose: () => void;
  onSelect: (selectedRows: StorageSelectionRow[]) => void;
};

function formatDate(input: any) {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  return date.toLocaleDateString("en-GB");
}

const toDDMMYYYY = (d?: string | Date | null) => {
  if (!d) return undefined;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return undefined;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getFullYear()}`;
};

export function StorageSelectionModal({
  prinCode,
  consolidatedInvNo,
  fromDate,
  toDate,
  onClose,
  onSelect,
}: StorageSelectionModalProps) {
  const { user } = useAuth();
  const [rows, setRows] = useState<StorageSelectionRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

useEffect(() => {
  if (!user?.loginid || !user?.company_code || !prinCode) {
    setLoading(false); // ← stop the spinner even when we can't fetch
    setRows([]);
    return;
  }
  setLoading(true);
  (async () => {
    try {
      const response = await getStorageSelection({
        loginid: user.loginid ?? "",
        company_code: user.company_code ?? "",
        prin_code: prinCode,
        consolidated_invno: consolidatedInvNo,
        from_date: toDDMMYYYY(fromDate),
        to_date: toDDMMYYYY(toDate),
      });
      const normalized = Array.isArray(response)
        ? response.map((r) => normalizeStorageRow(r, consolidatedInvNo))
        : [];
      setRows(normalized);
      // Pre-check rows already flagged SELECTED = 'Y' by the backend view
      setSelected(new Set(
        normalized.reduce<number[]>((acc, row, i) => {
          if (row.SELECTED === "Y") acc.push(i);
          return acc;
        }, []),
      ));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  })();
}, [prinCode, consolidatedInvNo, user?.loginid, user?.company_code]);
  const toggleRow = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((_, i) => i)));
  };

  const handleSelect = () => {
    onSelect(rows.filter((_, i) => selected.has(i)));
    onClose();
  };

  return (
    <Dialog open wide title="Select Storage" onClose={onClose}>
      <div className="max-h-[420px] overflow-auto rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-secondary/70">
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} />
              </TableHead>
              <TableHead>Serial No</TableHead>
              <TableHead>Reporting Date</TableHead>
              <TableHead>Txn Date</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
{loading ? (
  <TableRow>
    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
      Loading...
    </TableCell>
  </TableRow>
) : !prinCode ? (
  <TableRow>
    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
      Select a Principal Code first.
    </TableCell>
  </TableRow>
) : rows.length === 0 ? (
  <TableRow>
    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
      No storage records found
    </TableCell>
  </TableRow>
) : (

              rows.map((row, index) => {
                const isSelected = selected.has(index);
                return (
                  <TableRow
                    key={index}
                    className={isSelected ? "cursor-pointer bg-primary/10" : "cursor-pointer hover:bg-accent"}
                    onClick={() => toggleRow(index)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleRow(index)} />
                    </TableCell>
                    <TableCell>{row.SEQ_NUMBER}</TableCell>
                    <TableCell>{formatDate(row.RCPT_DATE)}</TableCell>
                    <TableCell>{formatDate(row.TXN_DATE)}</TableCell>
                    <TableCell className="text-right">{row.QTY}</TableCell>
                    <TableCell className="text-right">{row.AMOUNT}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSelect} disabled={selected.size === 0}>Select ({selected.size})</Button>
      </div>
    </Dialog>
  );
}

export default StorageSelectionModal;