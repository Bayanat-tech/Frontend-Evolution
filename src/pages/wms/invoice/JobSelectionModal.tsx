import { useEffect, useMemo, useState } from "react";
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
  existingKeys?: string[]; // "job_no||act_code" of jobs already added to the invoice
  onClose: () => void;
  onSelect: (selectedJobs: any[]) => void;
};

const normalizeRow = (row: any) => ({
  job_no: row.job_no ?? row.JOB_NO ?? "",
  invoice_no: row.invoice_no ?? row.INVOICE_NO ?? "",
  // Original SRNO of this row on its own source job invoice (TN_INVOICE_DET).
  // Needed later so PROC_UPDATE_INVOICE_DTLS can find and link the right row —
  // must NOT be confused with any locally-generated UI sequence number.
  srno: row.srno ?? row.SRNO ?? null,
  prin_code: row.prin_code ?? row.PRIN_CODE ?? "",
  quantity: row.quantity ?? row.QUANTITY ?? "",
  activity: row.activity ?? row.ACTIVITY ?? "",
  act_code: row.act_code ?? row.ACT_CODE ?? "",
  act_group_name: row.act_group_name ?? row.ACT_GROUP_NAME ?? "",
  activity_group_code: row.activity_group_code ?? row.ACTIVITY_GROUP_CODE ?? "",
  bill: Number(row.bill ?? row.BILL ?? 0),
  actual_cost: Number(row.actual_cost ?? row.ACTUAL_COST ?? 0),
  bill_rate: Number(row.bill_rate ?? row.BILL_RATE ?? 0),
  cost_rate: Number(row.cost_rate ?? row.COST_RATE ?? 0),
  job_date: row.job_date ?? row.JOB_DATE ?? null,
  selected: (row.selected ?? row.SELECTED) === "Y",
});

const toDDMMYYYY = (d?: string | Date | null) => {
  if (!d) return undefined;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return undefined;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getFullYear()}`;
};

function rowKeyOf(row: ReturnType<typeof normalizeRow>) {
  return `${row.job_no}||${row.act_code}`;
}

const ALL_GROUPS = "__all__";
const ALL_ACTIVITIES = "__all__";

export function JobSelectionModal({
  prinCode,
  invoiceNo,
  fromDate,
  toDate,
  existingKeys = [],
  onClose,
  onSelect,
}: JobSelectionModalProps) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ReturnType<typeof normalizeRow>[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState<string>(ALL_GROUPS); // holds activity_group_code
  const [activityFilter, setActivityFilter] = useState<string>(ALL_ACTIVITIES);

  // Jobs already added to the invoice (Job Details grid) — never show these again here.
  const excludeSet = useMemo(() => new Set(existingKeys), [existingKeys]);

  useEffect(() => {
    if (!user?.loginid || !user?.company_code || !prinCode) {
      setLoading(false);
      setJobs([]);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const response = await getInvoiceJobSelection({
          loginid: user.loginid ?? "",
          company_code: user.company_code ?? "",
          prin_code: prinCode,
          invoice_no: invoiceNo,
          from_date: toDDMMYYYY(fromDate),
          to_date: toDDMMYYYY(toDate),
        });
        const normalized = Array.isArray(response)
          ? response
              .map(normalizeRow)
              // de-dupe identical job_no + act_code rows returned by the query
              .filter((row, index, arr) => arr.findIndex((r) => rowKeyOf(r) === rowKeyOf(row)) === index)
              // drop jobs that are already selected/added on the invoice
              .filter((row) => !excludeSet.has(rowKeyOf(row)))
          : [];
        setJobs(normalized);
        // Pre-check rows already flagged SELECTED = 'Y' by the backend view
        setSelected(new Set(normalized.filter((r) => r.selected).map(rowKeyOf)));
        setGroupFilter(ALL_GROUPS);
        setActivityFilter(ALL_ACTIVITIES);
      } catch {
        setJobs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [prinCode, invoiceNo, user?.loginid, user?.company_code, excludeSet]);

  // Distinct activity groups present in the fetched jobs — keyed by activity_group_code
  // (the reliable match key), displayed using act_group_name as the label.
  const groupOptions = useMemo(() => {
    const byCode = new Map<string, string>();
    jobs.forEach((row) => {
      if (row.activity_group_code && !byCode.has(row.activity_group_code)) {
        byCode.set(row.activity_group_code, row.act_group_name || row.activity_group_code);
      }
    });
    return Array.from(byCode.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [jobs]);

  // Distinct activity names, scoped to the currently selected group code — only
  // activities whose activity_group_code matches the selected group show up.
  const activityOptions = useMemo(() => {
    const names = new Set<string>();
    jobs
      .filter((row) => groupFilter === ALL_GROUPS || row.activity_group_code === groupFilter)
      .forEach((row) => {
        if (row.activity) names.add(row.activity);
      });
    return Array.from(names).sort();
  }, [jobs, groupFilter]);

  // If the selected activity no longer applies to the selected group, reset it
  useEffect(() => {
    if (activityFilter !== ALL_ACTIVITIES && !activityOptions.includes(activityFilter)) {
      setActivityFilter(ALL_ACTIVITIES);
    }
  }, [activityOptions, activityFilter]);

  const visibleJobs = useMemo(
    () =>
      jobs.filter((row) => {
        if (groupFilter !== ALL_GROUPS && row.activity_group_code !== groupFilter) return false;
        if (activityFilter !== ALL_ACTIVITIES && row.activity !== activityFilter) return false;
        return true;
      }),
    [jobs, groupFilter, activityFilter],
  );

  const toggleRow = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // "Select all" only affects the currently visible (filtered) rows.
  const allVisibleSelected = visibleJobs.length > 0 && visibleJobs.every((row) => selected.has(rowKeyOf(row)));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleJobs.forEach((row) => next.delete(rowKeyOf(row)));
      } else {
        visibleJobs.forEach((row) => next.add(rowKeyOf(row)));
      }
      return next;
    });
  };

  const handleSelect = () => {
    onSelect(jobs.filter((row) => selected.has(rowKeyOf(row))));
    onClose();
  };

  const hasActiveFilter = groupFilter !== ALL_GROUPS || activityFilter !== ALL_ACTIVITIES;
  const clearFilters = () => {
    setGroupFilter(ALL_GROUPS);
    setActivityFilter(ALL_ACTIVITIES);
  };

  return (
    <Dialog open wide title="Select Jobs" onClose={onClose}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Activity Group</span>
        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value={ALL_GROUPS}>All Groups</option>
          {groupOptions.map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>

        <span className="ml-2 text-xs font-medium text-muted-foreground">Activity</span>
        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={activityFilter}
          onChange={(e) => setActivityFilter(e.target.value)}
        >
          <option value={ALL_ACTIVITIES}>All Activities</option>
          {activityOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        {hasActiveFilter && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        )}
      </div>

      <div className="max-h-[420px] overflow-auto rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-secondary/70">
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} />
              </TableHead>
              <TableHead>Job No</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>Act Code</TableHead>
              <TableHead>Activity Group</TableHead>
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
                <TableCell colSpan={11} className="py-6 text-center text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : visibleJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-6 text-center text-muted-foreground">
                  {jobs.length === 0 ? "No jobs found" : "No jobs found for the selected filters"}
                </TableCell>
              </TableRow>
            ) : (
              visibleJobs.map((row) => {
                const key = rowKeyOf(row);
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
                    <TableCell>{row.act_code ? `${row.act_code} - ${row.activity}` : row.activity}</TableCell>
                    <TableCell>{row.act_code}</TableCell>
                    <TableCell>
                      {row.activity_group_code ? `${row.activity_group_code} - ${row.act_group_name}` : row.act_group_name}
                    </TableCell>
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