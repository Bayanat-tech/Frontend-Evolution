import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useCallback } from "react";
import { LookupField } from "../../../components/ui/LookupField";
import { Button } from "../../../components/ui/Button";
import { Plus, RefreshCw, Save, X, Pencil, Trash2 } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { DataTable } from "../../../components/ui/DataTable";
import { type WmsRow, value } from "../../../utils/inboundHelpers"; // adjust path to match your project

type ActivityRow = WmsRow;   // <-- alias instead of redefining

// ─── Helpers ─────────────────────────────────────────────────────────
function deriveTaxPercentFromCategory(code: string): number {
  if (code === "10100" || code === "11100") return 5;
  return 0;
}

function sqlEscape(str: string) {
  return str.replace(/'/g, "''");
}

// In the component props, keep using ActivityRow — it's now just WmsRow
export function ActivityBillingSection({
  companyCode,
  prinCode,
  jobNo,
  isActivityBilling,
  activityLoading,
  activitySaving,
  activityRows,
  setActivityRows,
  activityEdited,
  setActivityEdited,
  activityTotals,
  loadActivityBilling,
  handleActivityBillingSubmit,
  executeWmsInboundSql,
}: {
  companyCode: string;
  prinCode: string;
  jobNo: string;
  isActivityBilling: boolean;
  activityLoading: boolean;
  activitySaving: boolean;
  activityRows: ActivityRow[];
  setActivityRows: React.Dispatch<React.SetStateAction<ActivityRow[]>>;
  activityEdited: Record<string, ActivityRow>;
  setActivityEdited: React.Dispatch<React.SetStateAction<Record<string, ActivityRow>>>;
  activityTotals: {
    totalBill: number;
    totalTax: number;
    totalAmount: number;
    totalCostTax: number;
    totalCostAmount: number;
  };
  loadActivityBilling: () => void;
  handleActivityBillingSubmit: () => void;
  executeWmsInboundSql: (sql: string) => Promise<any>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  // ── Queries (unchanged) ──
  const { data: activityData = [] } = useQuery({
    queryKey: ["activityBilling", companyCode, prinCode, jobNo],
    enabled: !!companyCode && !!prinCode && !!jobNo,
    queryFn: async () => {
      const sql = `SELECT ACTIVITY_CODE, ACTIVITY FROM MS_ACTIVITY WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY ACTIVITY`;
      const res = await executeWmsInboundSql(sql);
      return Array.isArray(res) ? res : [];
    },
  });

  const { data: txCompntcatCode1Data = [], isLoading: txCompntcatCode1Loading } = useQuery({
    queryKey: ["txCompntcatCode1", companyCode],
    enabled: !!companyCode,
    queryFn: async () => {
      const sql = `SELECT TX_COMPNTCAT_CODE, TX_COMPNTCAT_NAME FROM MS_TAX_COMPNTCATEGORY WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY TX_COMPNTCAT_CODE`;
      const res = await executeWmsInboundSql(sql);
      return Array.isArray(res) ? res : [];
    },
  });

  const { data: taxCategoryData = [], isLoading: taxCategoryLoading } = useQuery({
    queryKey: ["taxCategory", companyCode],
    enabled: !!companyCode,
    queryFn: async () => {
      const sql = `SELECT TX_CAT_CODE, TX_CAT_NAME FROM MS_TAX_CATEGORY WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY TX_CAT_CODE`;
      const res = await executeWmsInboundSql(sql);
      return Array.isArray(res) ? res : [];
    },
  });

  // ── Handlers ──
  const markEdited = useCallback((row: ActivityRow, index: number) => {
    const key = String(value(row, "act_code") || `row_${index}`);
    setActivityEdited((prev) => ({ ...prev, [key]: row }));
  }, [setActivityEdited]);

  const recalcRow = useCallback((row: ActivityRow): ActivityRow => {
    const quantity = Number(value(row, "quantity") ?? 0);
    const billRate = Number(value(row, "bill_rate") ?? 0);
    const costRate = Number(value(row, "cost_rate") ?? 0);
    const taxPercent = Number(value(row, "TX_COMPNT_PERC_1") ?? 0);
    const costTaxPercent = Number(value(row, "TX_COMPNT_PERC_1_COST") ?? 0);

    const bill = quantity * billRate;
    const taxAmount = bill * (taxPercent / 100);
    const cost = quantity * costRate;
    const costTaxAmount = cost * (costTaxPercent / 100);

    return {
      ...row,
      bill,
      cost,
      TX_COMPNT_AMT_1: taxAmount,
      TX_COMPNT_LCURAMT_1: bill + taxAmount,
      TX_COMPNT_AMT_1_COST: costTaxAmount,
      TX_COMPNT_LCURAMT_1_COST: cost + costTaxAmount,
    };
  }, []);

  const handleActivitySelect = useCallback((row: ActivityRow, index: number, selectedRow: any) => {
    setActivityRows((cur) => {
      const next = cur.map((r, i) =>
        i === index
          ? {
              ...r,
              act_code: selectedRow ? String(selectedRow.ACTIVITY_CODE ?? "") : "",
              activity: selectedRow ? String(selectedRow.ACTIVITY ?? "") : "",
            }
          : r
      );
      markEdited(next[index], index);
      return next;
    });
  }, [setActivityRows, markEdited]);

  const handleRateChange = useCallback((
    row: ActivityRow,
    index: number,
    field: "quantity" | "bill_rate" | "cost_rate" | "TX_COMPNT_PERC_1" | "TX_COMPNT_PERC_1_COST",
    rawValue: string
  ) => {
    const num = Number(rawValue);
    const safe = Number.isFinite(num) ? num : 0;

    setActivityRows((cur) => {
      const next = cur.map((r, i) => {
        if (i !== index) return r;
        const updated = recalcRow({ ...r, [field]: safe });
        return updated;
      });
      markEdited(next[index], index);
      return next;
    });
  }, [setActivityRows, recalcRow, markEdited]);

  const handleTaxCompntcatSelect = useCallback((row: ActivityRow, index: number, side: "bill" | "cost", selectedRow: any) => {
    const code = selectedRow ? String(selectedRow.TX_COMPNTCAT_CODE ?? "") : "";
    const perc = deriveTaxPercentFromCategory(code);

    setActivityRows((cur) => {
      const next = cur.map((r, i) => {
        if (i !== index) return r;
        const base = {
          ...r,
          ...(side === "bill"
            ? { TX_COMPNTCAT_CODE_1: code, TX_COMPNT_PERC_1: perc }
            : { TX_COMPNTCAT_CODE_1_COST: code, TX_COMPNT_PERC_1_COST: perc }),
        };
        return recalcRow(base);
      });
      markEdited(next[index], index);
      return next;
    });
  }, [setActivityRows, recalcRow, markEdited]);

  const handleTaxCategorySelect = useCallback((row: ActivityRow, index: number, side: "bill" | "cost", selectedRow: any) => {
    const code = selectedRow ? String(selectedRow.TX_CAT_CODE ?? "") : "";
    setActivityRows((cur) => {
      const next = cur.map((r, i) =>
        i === index
          ? { ...r, ...(side === "bill" ? { TX_CAT_CODE: code } : { TX_CAT_CODE_COST: code }) }
          : r
      );
      markEdited(next[index], index);
      return next;
    });
  }, [setActivityRows, markEdited]);

  const handleOtherServicesChange = useCallback((row: ActivityRow, index: number, val: string) => {
    setActivityRows((cur) => {
      const next = cur.map((r, i) => (i === index ? { ...r, other_services: val } : r));
      markEdited(next[index], index);
      return next;
    });
  }, [setActivityRows, markEdited]);

  // ── Add / Edit Dialog State ──
  const emptyForm = (): ActivityRow => {
    const noCompntcatMaster = !txCompntcatCode1Loading && txCompntcatCode1Data.length === 0;

    return {
      act_code: "",
      activity: "",
      quantity: 0,
      bill_rate: 0,
      bill: 0,
      cost_rate: 0,
      cost: 0,
      other_services: "",
      TX_COMPNT_AMT_1: 0,
      TX_COMPNT_LCURAMT_1: 0,
      TX_COMPNT_AMT_1_COST: 0,
      TX_COMPNT_LCURAMT_1_COST: 0,
      // always present, just vary by legacy rule
      TX_COMPNTCAT_CODE_1: noCompntcatMaster ? "11100" : "",
      TX_COMPNTCAT_CODE_1_COST: noCompntcatMaster ? "11100" : "",
      TX_COMPNT_PERC_1: noCompntcatMaster ? 5 : 0,
      TX_COMPNT_PERC_1_COST: noCompntcatMaster ? 5 : 0,
      TX_CAT_CODE: noCompntcatMaster ? "" : "00",
      TX_CAT_CODE_COST: noCompntcatMaster ? "" : "00",
    };
  };

  const [formRow, setFormRow] = useState<ActivityRow>(emptyForm());

  const openAddDialog = () => {
    setEditIndex(null);
    setFormRow(emptyForm());
    setDialogOpen(true);
  };

  const openEditDialog = useCallback((index: number) => {
    setEditIndex(index);
    setFormRow({ ...activityRows[index] });
    setDialogOpen(true);
  }, [activityRows]);

  const handleDelete = useCallback((index: number) => {
    const row = activityRows[index];
    const key = String(value(row, "act_code") || `row_${index}`);
    setActivityEdited((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setActivityRows((cur) => cur.filter((_, i) => i !== index));
  }, [activityRows, setActivityRows, setActivityEdited]);

  const commitFormRow = () => {
    const final = recalcRow(formRow);
    if (editIndex !== null) {
      setActivityRows((cur) => {
        const next = cur.map((r, i) => (i === editIndex ? final : r));
        return next;
      });
      markEdited(final, editIndex);
    } else {
      setActivityRows((cur) => [...cur, final]);
    }
    setDialogOpen(false);
    setEditIndex(null);
  };

  const columns = useMemo(() => {
    const cellClass = "px-3 py-1.5";
    const textClass = "text-sm text-foreground";

    return [
      {
        id: "actions",
        header: "Actions",
        size: 90,
        cell: ({ row }: { row: { original: ActivityRow; index: number } }) => (
          <div className={`${cellClass} flex items-center gap-1`}>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => openEditDialog(row.index)}
              title="Edit"
            >
              <Pencil size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => handleDelete(row.index)}
              title="Delete"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
      {
        id: "activity",
        header: "Activity",
        accessorKey: "act_code",
        size: 220,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={cellClass}>
            <span className={textClass}>
              {String(value(row.original, "activity") || value(row.original, "act_code") || "")}
            </span>
          </div>
        ),
      },
      {
        id: "quantity",
        header: "Quantity",
        accessorKey: "quantity",
        size: 100,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={`${cellClass} text-right`}>
            <span className={textClass}>
              {String(value(row.original, "quantity") ?? 0)}
            </span>
          </div>
        ),
      },
      {
        id: "bill_rate",
        header: "Bill Rate",
        accessorKey: "bill_rate",
        size: 110,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={`${cellClass} text-right`}>
            <span className={textClass}>
              {Number(value(row.original, "bill_rate") ?? 0).toFixed(2)}
            </span>
          </div>
        ),
      },
      {
        id: "bill",
        header: "Bill",
        accessorKey: "bill",
        size: 110,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={`${cellClass} text-right font-medium text-foreground`}>
            {Number(value(row.original, "bill") ?? 0).toFixed(2)}
          </div>
        ),
      },
      {
        id: "tx_compnt_perc_1",
        header: "Tax %",
        accessorKey: "TX_COMPNT_PERC_1",
        size: 90,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={`${cellClass} text-right`}>
            <span className={textClass}>
              {Number(value(row.original, "TX_COMPNT_PERC_1") ?? 0).toFixed(2)}
            </span>
          </div>
        ),
      },
      {
        id: "tx_compnt_amt_1",
        header: "Tax Amt",
        accessorKey: "TX_COMPNT_AMT_1",
        size: 110,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={`${cellClass} text-right font-medium text-foreground`}>
            {Number(value(row.original, "TX_COMPNT_AMT_1") ?? 0).toFixed(2)}
          </div>
        ),
      },
      {
        id: "tx_compnt_lcuramt_1",
        header: "Total Amt",
        accessorKey: "TX_COMPNT_LCURAMT_1",
        size: 110,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={`${cellClass} text-right font-semibold text-primary`}>
            {Number(value(row.original, "TX_COMPNT_LCURAMT_1") ?? 0).toFixed(2)}
          </div>
        ),
      },
      {
        id: "tx_compnt_perc_1_cost",
        header: "Cost Tax %",
        accessorKey: "TX_COMPNT_PERC_1_COST",
        size: 90,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={`${cellClass} text-right`}>
            <span className={textClass}>
              {Number(value(row.original, "TX_COMPNT_PERC_1_COST") ?? 0).toFixed(2)}
            </span>
          </div>
        ),
      },
      {
        id: "tx_compnt_amt_1_cost",
        header: "Cost Tax Amt",
        accessorKey: "TX_COMPNT_AMT_1_COST",
        size: 110,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={`${cellClass} text-right font-medium text-foreground`}>
            {Number(value(row.original, "TX_COMPNT_AMT_1_COST") ?? 0).toFixed(2)}
          </div>
        ),
      },
      {
        id: "tx_compnt_lcuramt_1_cost",
        header: "Total Cost",
        accessorKey: "TX_COMPNT_LCURAMT_1_COST",
        size: 110,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={`${cellClass} text-right font-semibold text-primary`}>
            {Number(value(row.original, "TX_COMPNT_LCURAMT_1_COST") ?? 0).toFixed(2)}
          </div>
        ),
      },
      {
        id: "cost_rate",
        header: "Cost Rate",
        accessorKey: "cost_rate",
        size: 110,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={`${cellClass} text-right`}>
            <span className={textClass}>
              {Number(value(row.original, "cost_rate") ?? 0).toFixed(2)}
            </span>
          </div>
        ),
      },
      {
        id: "tx_compntcat_code_1",
        header: "Tax Component Category",
        accessorKey: "TX_COMPNTCAT_CODE_1",
        size: 220,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={cellClass}>
            <span className={textClass}>
              {String(value(row.original, "TX_COMPNTCAT_CODE_1") || "")}
            </span>
          </div>
        ),
      },
      {
        id: "tx_cat_code",
        header: "Tax Category",
        accessorKey: "TX_CAT_CODE",
        size: 220,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={cellClass}>
            <span className={textClass}>
              {String(value(row.original, "TX_CAT_CODE") || "")}
            </span>
          </div>
        ),
      },
      {
        id: "tx_compntcat_code_1_cost",
        header: "Cost Tax Comp Cat",
        accessorKey: "TX_COMPNTCAT_CODE_1_COST",
        size: 220,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={cellClass}>
            <span className={textClass}>
              {String(value(row.original, "TX_COMPNTCAT_CODE_1_COST") || "")}
            </span>
          </div>
        ),
      },
      {
        id: "tx_cat_code_cost",
        header: "Cost Tax Category",
        accessorKey: "TX_CAT_CODE_COST",
        size: 220,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={cellClass}>
            <span className={textClass}>
              {String(value(row.original, "TX_CAT_CODE_COST") || "")}
            </span>
          </div>
        ),
      },
      {
        id: "other_services",
        header: "Other Services",
        accessorKey: "other_services",
        size: 160,
        cell: ({ row }: { row: { original: ActivityRow } }) => (
          <div className={cellClass}>
            <span className={textClass}>
              {String(value(row.original, "other_services") || "")}
            </span>
          </div>
        ),
      },
    ];
  }, [openEditDialog, handleDelete]);

  // ── Toolbar ──
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={openAddDialog}>
        <Plus size={14} /> Add Activity
      </Button>
      <Button size="sm" variant="outline" onClick={loadActivityBilling}>
        <RefreshCw size={14} /> Refresh
      </Button>
      <Button size="sm" onClick={handleActivityBillingSubmit} >
        <Save size={14} /> {activitySaving ? "Saving..." : "Submit"}
      </Button>
    </div>
  );

  if (!isActivityBilling) return null;

  const isEditing = editIndex !== null;

  return (
    <section className="grid gap-3">
      {/* Header stats */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-4 py-3 shadow-sm">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {activityLoading ? "Loading" : `${activityRows.length} Rows`}
          </div>
          <div className="text-xs text-muted-foreground">
            Activity Billing — adjust bill / cost rates per activity, then submit to update.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns as any}
        data={activityRows}
        loading={activityLoading}
        emptyText="No records found"
        height={520}
        density="compact"
        enablePagination={false}
        toolbar={null}
        enableExport
        exportFilename={`activity-billing-${jobNo}.csv`}
      />

      {/* Footer */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>
          Showing {activityRows.length === 0 ? 0 : 1}-{activityRows.length} of {activityRows.length}
        </span>
        {Object.keys(activityEdited).length > 0 && (
          <span className="font-medium text-primary">
            {Object.keys(activityEdited).length} unsaved change(s)
          </span>
        )}
      </div>

      {/* ── Add / Edit Activity Dialog ── */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-[2px]">
          <div className="grid w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border bg-card shadow-2xl">
            {/* Dialog Header */}
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="text-sm font-semibold text-foreground">
                {isEditing ? "Edit Activity" : "Add Activity"}
              </h3>
              <Button size="icon" variant="ghost" onClick={() => { setDialogOpen(false); setEditIndex(null); }}>
                <X size={16} />
              </Button>
            </div>

            {/* Dialog Body */}
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {/* Activity */}
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Activity</label>
                <LookupField
                  compact
                  value={String(value(formRow, "act_code") || "")}
                  displayValue={String(value(formRow, "activity") || "")}
                  columns={[
                    { field: "ACTIVITY_CODE", header: "Code" },
                    { field: "ACTIVITY", header: "Activity" },
                  ]}
                  valueField="ACTIVITY_CODE"
                  displayFields={["ACTIVITY"]}
                  loadOptions={async (query?: string) => {
                    if (!query) return activityData;
                    const term = query.toLowerCase();
                    return activityData.filter(
                      (r: any) =>
                        String(r.ACTIVITY_CODE ?? "").toLowerCase().includes(term) ||
                        String(r.ACTIVITY ?? "").toLowerCase().includes(term)
                    );
                  }}
                  onChange={(_val: any, selectedRow: any) =>
                    setFormRow((r) => ({
                      ...r,
                      act_code: selectedRow ? String(selectedRow.ACTIVITY_CODE ?? "") : "",
                      activity: selectedRow ? String(selectedRow.ACTIVITY ?? "") : "",
                    }))
                  }
                  placeholder="Select activity"
                />
              </div>

              {/* Quantity */}
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Quantity</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={String(value(formRow, "quantity") ?? 0)}
                  onChange={(e: any) => setFormRow((r) => recalcRow({ ...r, quantity: Number(e.target.value) || 0 }))}
                />
              </div>

              {/* Bill Rate */}
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Bill Rate</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={String(value(formRow, "bill_rate") ?? 0)}
                  onChange={(e: any) => setFormRow((r) => recalcRow({ ...r, bill_rate: Number(e.target.value) || 0 }))}
                />
              </div>

              {/* Tax Component Category (Bill) */}
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tax Component Category</label>
                <LookupField
                  compact
                  value={String(value(formRow, "TX_COMPNTCAT_CODE_1") || "")}
                  displayValue={String(value(formRow, "TX_COMPNTCAT_CODE_1") || "")}
                  columns={[
                    { field: "TX_COMPNTCAT_CODE", header: "Code" },
                    { field: "TX_COMPNTCAT_NAME", header: "Description" },
                  ]}
                  valueField="TX_COMPNTCAT_CODE"
                  displayFields={["TX_COMPNTCAT_NAME"]}
                  loadOptions={async (query?: string) => {
                    if (txCompntcatCode1Loading) return [];
                    if (!query) return txCompntcatCode1Data;
                    const term = query.toLowerCase();
                    return txCompntcatCode1Data.filter(
                      (r: any) =>
                        String(r.TX_COMPNTCAT_CODE ?? "").toLowerCase().includes(term) ||
                        String(r.TX_COMPNTCAT_NAME ?? "").toLowerCase().includes(term)
                    );
                  }}
                  onChange={(_val: any, selectedRow: any) => {
                    const code = selectedRow ? String(selectedRow.TX_COMPNTCAT_CODE ?? "") : "";
                    setFormRow((r) => recalcRow({ ...r, TX_COMPNTCAT_CODE_1: code, TX_COMPNT_PERC_1: deriveTaxPercentFromCategory(code) }));
                  }}
                  placeholder="Select tax code"
                />
              </div>

              {/* Tax Category (Bill) */}
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tax Category</label>
                <LookupField
                  compact
                  value={String(value(formRow, "TX_CAT_CODE") || "")}
                  displayValue={String(value(formRow, "TX_CAT_CODE") || "")}
                  columns={[
                    { field: "TX_CAT_CODE", header: "Code" },
                    { field: "TX_CAT_NAME", header: "Description" },
                  ]}
                  valueField="TX_CAT_CODE"
                  displayFields={["TX_CAT_NAME"]}
                  loadOptions={async (query?: string) => {
                    if (taxCategoryLoading) return [];
                    if (!query) return taxCategoryData;
                    const term = query.toLowerCase();
                    return taxCategoryData.filter(
                      (r: any) =>
                        String(r.TX_CAT_CODE ?? "").toLowerCase().includes(term) ||
                        String(r.TX_CAT_NAME ?? "").toLowerCase().includes(term)
                    );
                  }}
                  onChange={(_val: any, selectedRow: any) =>
                    setFormRow((r) => ({ ...r, TX_CAT_CODE: selectedRow ? String(selectedRow.TX_CAT_CODE ?? "") : "" }))
                  }
                  placeholder="Select tax category"
                />
              </div>

              {/* Tax % (Bill) */}
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tax %</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={String(value(formRow, "TX_COMPNT_PERC_1") ?? 0)}
                  onChange={(e: any) => setFormRow((r) => recalcRow({ ...r, TX_COMPNT_PERC_1: Number(e.target.value) || 0 }))}
                />
              </div>

              {/* Cost Rate */}
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cost Rate</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={String(value(formRow, "cost_rate") ?? 0)}
                  onChange={(e: any) => setFormRow((r) => recalcRow({ ...r, cost_rate: Number(e.target.value) || 0 }))}
                />
              </div>

              {/* Tax Component Category (Cost) */}
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cost Tax Comp Cat</label>
                <LookupField
                  compact
                  value={String(value(formRow, "TX_COMPNTCAT_CODE_1_COST") || "")}
                  displayValue={String(value(formRow, "TX_COMPNTCAT_CODE_1_COST") || "")}
                  columns={[
                    { field: "TX_COMPNTCAT_CODE", header: "Code" },
                    { field: "TX_COMPNTCAT_NAME", header: "Description" },
                  ]}
                  valueField="TX_COMPNTCAT_CODE"
                  displayFields={["TX_COMPNTCAT_NAME"]}
                  loadOptions={async (query?: string) => {
                    if (txCompntcatCode1Loading) return [];
                    if (!query) return txCompntcatCode1Data;
                    const term = query.toLowerCase();
                    return txCompntcatCode1Data.filter(
                      (r: any) =>
                        String(r.TX_COMPNTCAT_CODE ?? "").toLowerCase().includes(term) ||
                        String(r.TX_COMPNTCAT_NAME ?? "").toLowerCase().includes(term)
                    );
                  }}
                  onChange={(_val: any, selectedRow: any) => {
                    const code = selectedRow ? String(selectedRow.TX_COMPNTCAT_CODE ?? "") : "";
                    setFormRow((r) => recalcRow({ ...r, TX_COMPNTCAT_CODE_1_COST: code, TX_COMPNT_PERC_1_COST: deriveTaxPercentFromCategory(code) }));
                  }}
                  placeholder="Select tax code"
                />
              </div>

              {/* Tax Category (Cost) */}
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cost Tax Category</label>
                <LookupField
                  compact
                  value={String(value(formRow, "TX_CAT_CODE_COST") || "")}
                  displayValue={String(value(formRow, "TX_CAT_CODE_COST") || "")}
                  columns={[
                    { field: "TX_CAT_CODE", header: "Code" },
                    { field: "TX_CAT_NAME", header: "Description" },
                  ]}
                  valueField="TX_CAT_CODE"
                  displayFields={["TX_CAT_NAME"]}
                  loadOptions={async (query?: string) => {
                    if (taxCategoryLoading) return [];
                    if (!query) return taxCategoryData;
                    const term = query.toLowerCase();
                    return taxCategoryData.filter(
                      (r: any) =>
                        String(r.TX_CAT_CODE ?? "").toLowerCase().includes(term) ||
                        String(r.TX_CAT_NAME ?? "").toLowerCase().includes(term)
                    );
                  }}
                  onChange={(_val: any, selectedRow: any) =>
                    setFormRow((r) => ({ ...r, TX_CAT_CODE_COST: selectedRow ? String(selectedRow.TX_CAT_CODE ?? "") : "" }))
                  }
                  placeholder="Select tax category"
                />
              </div>

              {/* Tax % (Cost) */}
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cost Tax %</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={String(value(formRow, "TX_COMPNT_PERC_1_COST") ?? 0)}
                  onChange={(e: any) => setFormRow((r) => recalcRow({ ...r, TX_COMPNT_PERC_1_COST: Number(e.target.value) || 0 }))}
                />
              </div>

              {/* Other Services */}
              <div className="grid gap-1.5 sm:col-span-2 lg:col-span-3">
                <label className="text-xs font-medium text-muted-foreground">Other Services</label>
                <Input
                  type="text"
                  value={String(value(formRow, "other_services") || "")}
                  onChange={(e: any) => setFormRow((r) => ({ ...r, other_services: e.target.value }))}
                  placeholder="Enter other services"
                />
              </div>
            </div>

            {/* Computed Preview */}
            <div className="grid grid-cols-3 gap-3 border-y bg-muted/30 px-5 py-3 text-xs">
              <div className="text-right">
                <span className="text-muted-foreground">Bill:</span>{" "}
                <strong className="text-foreground">{Number(value(formRow, "bill") ?? 0).toFixed(2)}</strong>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground">Tax Amt:</span>{" "}
                <strong className="text-foreground">{Number(value(formRow, "TX_COMPNT_AMT_1") ?? 0).toFixed(2)}</strong>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground">Total Amt:</span>{" "}
                <strong className="text-primary">{Number(value(formRow, "TX_COMPNT_LCURAMT_1") ?? 0).toFixed(2)}</strong>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground">Cost:</span>{" "}
                <strong className="text-foreground">{Number(value(formRow, "cost") ?? 0).toFixed(2)}</strong>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground">Cost Tax:</span>{" "}
                <strong className="text-foreground">{Number(value(formRow, "TX_COMPNT_AMT_1_COST") ?? 0).toFixed(2)}</strong>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground">Total Cost:</span>{" "}
                <strong className="text-primary">{Number(value(formRow, "TX_COMPNT_LCURAMT_1_COST") ?? 0).toFixed(2)}</strong>
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => { setDialogOpen(false); setEditIndex(null); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={commitFormRow}>
                {isEditing ? (
                  <>
                    <Save size={14} className="mr-1" /> Save Changes
                  </>
                ) : (
                  <>
                    <Plus size={14} className="mr-1" /> Add to Table
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}