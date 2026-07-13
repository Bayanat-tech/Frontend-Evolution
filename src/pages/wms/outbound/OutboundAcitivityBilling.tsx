import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Save } from "lucide-react";
import { getDynamicLookup } from "../../../api/lookups";
import { Button } from "../../../components/ui/Button";
import { executeWmsInboundSql } from "../../../api/wms"; // adjust path to wherever this actually lives


// ── Types ──────────────────────────────────────────────────────────────
type ActivityBillingRow = {
  prin_code: string;
  job_no: string;
  act_code: string;
  activity: string;
  quantity: number;
  bill_rate: number | null;
  bill: number | null;
  cost_rate: number | null;
  cost: number | null;
  other_services: string | null;
  company_code: string;
};

type EditedCell = {
  bill_rate?: number;
  cost_rate?: number;
};

// Safe accessor mirroring the `value()` helper used elsewhere in the app
function value<T extends object>(row: T, key: keyof T) {
  return row?.[key];
}

function sqlEscape(input: string | number | null | undefined): string {
  return String(input ?? "").replace(/'/g, "''");
}

export function OutboundAcitivityBilling({
  company_code,
  prin_code,
  job_no,
}: {
  company_code: string;
  prin_code: string;
  job_no: string;
}) {
  const [activityEdited, setActivityEdited] = useState<Record<string, EditedCell>>({});
  const [activitySaving, setActivitySaving] = useState(false);

  const {
    data: activityBillingData,
    isLoading: activityLoading,
    refetch,
  } = useQuery({
    queryKey: ["activity_billing_data", company_code, prin_code, job_no],
    queryFn: async () => {
      const response = await getDynamicLookup({
        parameter: "TBILL_OUTBOUND_ACTIVITY_BILLING",
        loginid: "system",
        code1: company_code,
        code2: prin_code,
        code3: job_no,
      });
      return Array.isArray(response) ? (response as ActivityBillingRow[]) : [];
    },
  });

  // Merge server rows with any in-progress local edits so the table
  // reflects live recalculated bill / cost totals as the user types.
  const activityRows = useMemo(() => {
    const rows = activityBillingData ?? [];
    return rows.map((row) => {
      const key = String(value(row, "act_code") ?? "");
      const edited = activityEdited[key];
      if (!edited) return row;

      const billRate = edited.bill_rate ?? Number(value(row, "bill_rate") ?? 0);
      const costRate = edited.cost_rate ?? Number(value(row, "cost_rate") ?? 0);
      const quantity = Number(value(row, "quantity") ?? 0);

      return {
        ...row,
        bill_rate: billRate,
        cost_rate: costRate,
        bill: quantity * billRate,
        cost: quantity * costRate,
      };
    });
  }, [activityBillingData, activityEdited]);

  const activityTotals = useMemo<{ totalBill: number; totalCost: number }>(() => {
    return activityRows.reduce<{ totalBill: number; totalCost: number }>(
      (acc, row) => {
        acc.totalBill += Number(value(row, "bill") ?? 0);
        acc.totalCost += Number(value(row, "cost") ?? 0);
        return acc;
      },
      { totalBill: 0, totalCost: 0 }
    );
  }, [activityRows]);

  function loadActivityBilling() {
    refetch();
  }

  function handleActivityRateChange(
    row: ActivityBillingRow,
    field: "bill_rate" | "cost_rate",
    rawValue: string
  ) {
    const key = String(value(row, "act_code") ?? "");
    const numericValue = rawValue === "" ? 0 : Number(rawValue);
    if (Number.isNaN(numericValue)) return;

    setActivityEdited((prev) => ({
      ...prev,
      [key]: {
        bill_rate: prev[key]?.bill_rate ?? Number(value(row, "bill_rate") ?? 0),
        cost_rate: prev[key]?.cost_rate ?? Number(value(row, "cost_rate") ?? 0),
        [field]: numericValue,
      },
    }));
  }

  async function handleActivityBillingSubmit() {
    if (Object.keys(activityEdited).length === 0) return;
    setActivitySaving(true);
    try {
      const rowsToSave = activityRows.filter(
        (row) => activityEdited[String(value(row, "act_code") ?? "")]
      );

      for (const row of rowsToSave) {
        const qty = Number(value(row, "quantity") ?? 0);
        const billRate = Number(value(row, "bill_rate") ?? 0);
        const costRate = Number(value(row, "cost_rate") ?? 0);
        const prinCode = String(value(row, "prin_code") ?? "");
        const jobNo = String(value(row, "job_no") ?? "");
        const actCode = String(value(row, "act_code") ?? "");

        const updateSql = `
          UPDATE TN_INVOICE_DET
          SET
            QUANTITY  = ${qty},
            BILL_RATE = ${billRate},
            COST_RATE = ${costRate},
            BILL      = ${qty} * ${billRate},
            COST      = ${qty} * ${costRate}
          WHERE PRIN_CODE = '${sqlEscape(prinCode)}'
            AND JOB_NO    = '${sqlEscape(jobNo)}'
            AND ACT_CODE  = '${sqlEscape(actCode)}'`;

        await executeWmsInboundSql(updateSql);
      }

      setActivityEdited({});
      await refetch();
    } finally {
      setActivitySaving(false);
    }
  }

  return (
    <section className="grid gap-3">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-4 py-3 shadow-sm">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {activityLoading ? "Loading" : `${activityRows.length} Rows`}
          </div>
          <div className="text-xs text-muted-foreground">
            Outbound Activity Billing — adjust bill / cost rates per activity, then submit to update.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadActivityBilling}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button size="sm" onClick={handleActivityBillingSubmit} disabled={activitySaving}>
            <Save size={14} /> {activitySaving ? "Saving..." : "Submit"}
          </Button>
        </div>
      </div>

      {/* ── Table card ── */}
      <div
        className="overflow-auto rounded-md border bg-card shadow-sm"
        style={{ maxHeight: "calc(100vh - 365px)" }}
      >
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="sticky top-0 z-10 bg-muted/50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Activity
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Quantity
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bill Rate
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bill
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cost Rate
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cost
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Other Services
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {activityLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : activityRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No records found
                </td>
              </tr>
            ) : (
              activityRows.map((row, i) => (
                <tr key={`${String(value(row, "act_code") ?? "")}_${i}`} className="hover:bg-muted/30">
                  <td className="px-3 py-2.5 text-foreground">{String(value(row, "activity") || "")}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-foreground">
                    {Number(value(row, "quantity") ?? 0)}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 w-24 rounded-md border border-input bg-background px-2 text-right text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                      value={String(value(row, "bill_rate") ?? 0)}
                      onChange={(e) => handleActivityRateChange(row, "bill_rate", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-foreground">
                    {Number(value(row, "bill") ?? 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 w-24 rounded-md border border-input bg-background px-2 text-right text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                      value={String(value(row, "cost_rate") ?? 0)}
                      onChange={(e) => handleActivityRateChange(row, "cost_rate", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-foreground">
                    {Number(value(row, "cost") ?? 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {String(value(row, "other_services") || "")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {activityRows.length > 0 && (
            <tfoot className="sticky bottom-0 border-t bg-primary/5">
              <tr>
                <td className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-primary">Total</td>
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5 text-right text-sm font-semibold text-primary">
                  {activityTotals.totalBill.toFixed(2)}
                </td>
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5 text-right text-sm font-semibold text-primary">
                  {activityTotals.totalCost.toFixed(2)}
                </td>
                <td className="px-3 py-2.5" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Footer bar ── */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>
          {`Showing ${activityRows.length === 0 ? 0 : 1}-${activityRows.length} of ${activityRows.length}`}
        </span>
        {Object.keys(activityEdited).length > 0 && (
          <span className="font-medium text-primary">{`${Object.keys(activityEdited).length} unsaved change(s)`}</span>
        )}
      </div>
    </section>
  );
}