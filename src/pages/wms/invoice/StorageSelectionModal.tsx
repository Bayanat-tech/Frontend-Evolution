import { useEffect, useState } from "react";
import { Dialog } from "../../../components/ui/Dialog";
import { Button } from "../../../components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/Table";
// import { getStorageDetails } from "../../../api/billing";
import { executeWmsInboundSql } from "../../../api/wms";


type StorageSelectionModalProps = {
  onClose: () => void;
  onSelect: (selectedRows: any[]) => void;
};

function val(row: any, key: string) {
  return row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()] ?? "";
}

function formatDate(input: any) {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  return date.toLocaleDateString("en-GB");
}

const COLUMNS = [
  { key: "prin_code", header: "Principal Code" },
  { key: "txn_date", header: "Txn Date", isDate: true },
  { key: "qty", header: "Qty", align: "right" as const },
  { key: "amount", header: "Amount", align: "right" as const },
];

export async function getStorageDetails(): Promise<any[]> {
  try {
    return await executeWmsInboundSql("SELECT * FROM MNSTORAGE_DET");
  } catch (error) {
    console.error("Error in getStorageDetails:", error instanceof Error ? error.message : error);
    return [];
  }
}

export function StorageSelectionModal({ onClose, onSelect }: StorageSelectionModalProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getStorageDetails();
        setRows(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
              {COLUMNS.map((col) => (
                <TableHead key={col.key} className={col.align === "right" ? "text-right" : undefined}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length + 1} className="py-6 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length + 1} className="py-6 text-center text-muted-foreground">
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
                    {COLUMNS.map((col) => (
                      <TableCell key={col.key} className={col.align === "right" ? "text-right" : undefined}>
                        {col.isDate ? formatDate(val(row, col.key)) : String(val(row, col.key) ?? "")}
                      </TableCell>
                    ))}
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


