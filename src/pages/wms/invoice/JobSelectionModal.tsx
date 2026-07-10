import { useEffect, useState } from "react";
import { Dialog } from "../../../components/ui/Dialog";
import { Button } from "../../../components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/Table";
import { useAuth } from "../../../state/AuthContext";
import { getInvoiceJobSelection } from "../../../api/billing";

type JobSelectionModalProps = {
  prinCode: string;
  invoiceNo: string;
  fromDate?: string | Date | null;
  toDate?: string | Date | null;
  onClose: () => void;
  onSelect: (selectedJobs: any[]) => void;
};

const normalizeRow = (row: any) => ({
  job_no: row.job_no ?? row.JOB_NO ?? "",
  quantity: row.quantity ?? "",
  activity: row.activity ?? row.ACTIVITY ?? "",
  act_code: row.act_code ?? row.ACT_CODE ?? "",
  bill: Number(row.bill ?? row.BILL ?? 0),
  actual_cost: Number(row.actual_cost ?? row.ACTUAL_COST ?? 0),
  bill_rate: Number(row.bill_rate ?? row.BILL_RATE ?? 0),
  cost_rate: Number(row.cost_rate ?? row.COST_RATE ?? 0),
  job_date: row.job_date ?? row.JOB_DATE ?? null,
});

const toDDMMYYYY = (d?: string | Date | null) => {
  if (!d) return undefined;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return undefined;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getFullYear()}`;
};

export function JobSelectionModal({ prinCode, invoiceNo, fromDate, toDate, onClose, onSelect }: JobSelectionModalProps) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ReturnType<typeof normalizeRow>[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.loginid || !user?.company_code || !prinCode) return;
    (async () => {
      setLoading(true);
      try {
        const response = await getInvoiceJobSelection({
          loginid: user.loginid!,
          company_code: user.company_code!,
          prin_code: prinCode,
          from_date: toDDMMYYYY(fromDate),
          to_date: toDDMMYYYY(toDate),
        });
        setJobs(Array.isArray(response) ? response.map(normalizeRow) : []);
      } catch {
        setJobs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [prinCode, invoiceNo, user?.loginid, user?.company_code]);

  const rowKey = (row: ReturnType<typeof normalizeRow>) => `${row.job_no}||${row.act_code}`;

  const toggleRow = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === jobs.length) setSelected(new Set());
    else setSelected(new Set(jobs.map(rowKey)));
  };

  const handleSelect = () => {
    onSelect(jobs.filter((row) => selected.has(rowKey(row))));
    onClose();
  };

  return (
    <Dialog open wide title="Select Jobs" onClose={onClose}>
      <div className="max-h-[420px] overflow-auto rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-secondary/70">
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" checked={jobs.length > 0 && selected.size === jobs.length} onChange={toggleAll} />
              </TableHead>
              <TableHead>Job No</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>Act Code</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Bill</TableHead>
              <TableHead className="text-right">Actual Cost</TableHead>
              <TableHead className="text-right">Bill Rate</TableHead>
              <TableHead className="text-right">Cost Rate</TableHead>
              <TableHead>Job Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">No jobs found</TableCell>
              </TableRow>
            ) : (
              jobs.map((row) => {
                const key = rowKey(row);
                const isSelected = selected.has(key);
                return (
                  <TableRow
                    key={key}
                    className={isSelected ? "cursor-pointer bg-primary/10" : "cursor-pointer hover:bg-accent"}
                    onClick={() => toggleRow(key)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleRow(key)} />
                    </TableCell>
                    <TableCell>{row.job_no}</TableCell>
                    <TableCell>{row.activity}</TableCell>
                    <TableCell>{row.act_code}</TableCell>
                    <TableCell className="text-right">{row.quantity}</TableCell>
                    <TableCell className="text-right">{row.bill}</TableCell>
                    <TableCell className="text-right">{row.actual_cost}</TableCell>
                    <TableCell className="text-right">{row.bill_rate}</TableCell>
                    <TableCell className="text-right">{row.cost_rate}</TableCell>
                    <TableCell>{row.job_date ? new Date(row.job_date).toLocaleDateString() : ""}</TableCell>
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

export default JobSelectionModal;