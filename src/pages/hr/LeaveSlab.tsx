// src/pages/hr/LeaveSlap.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { getDynamicLookup } from "../../api/lookups";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Button } from "../../components/ui/Button";
import { api } from "../../api/client";
import { useAuth } from "../../state/AuthContext";
import { useToast } from "../../components/ui/AlertToast";

// ---------- Types ----------
export type LeaveSlapRow = {
  id: string;
  sino: number;
  daysFrom: number | "";
  daysTo: number | "";
  deductionAmount: number | "";
  deductionPct: number | "";
  calculationBase: string;
  calculationBaseDesc?: string;
  status: "A" | "I";
  remarks: string;
};

type FormState = {
  daysFrom: string;
  daysTo: string;
  deductionAmount: string;
  deductionPct: string;
  calculationBase: string;
  calculationBaseDesc: string;
  status: "A" | "I";
  remarks: string;
};

const emptyForm: FormState = {
  daysFrom: "",
  daysTo: "",
  deductionAmount: "",
  deductionPct: "",
  calculationBase: "",
  calculationBaseDesc: "",
  status: "A",
  remarks: "",
};

// ---------- api ----------
export type LeaveSlapSavePayload = {
  companyCode: string;
  leaveType: string;
  loginid?: string;
  rows: {
    slno: number;
    daysFrom: number | "";
    daysTo: number | "";
    deductionAmount: number | "";
    deductionPct: number | "";
    calculationBase: string;
    status: "A" | "I";
    remarks: string;
  }[];
};

export async function saveLeaveSlap(payload: LeaveSlapSavePayload) {
  try {
    const response = await api.post<{
      success: boolean;
      message?: string;
      details?: string;
      data?: string;
    }>("/api/hr/leaveslap/save", payload);

    if (!response.data.success) {
      throw new Error(
        response.data.details ||
          response.data.message ||
          "Unable to save leave slap",
      );
    }

    return response.data.data || response.data.message || "Saved successfully";
  } catch (error) {
    throw new Error((error as Error).message || "Unable to save leave slap");
  }
}

// ---------- Component ----------
export default function LeaveSlapPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const companyCode = user?.company_code ?? "";
  const companyName = user?.company_name ?? companyCode;
  const loginid = user?.loginid ?? "";

  const [leaveType, setLeaveType] = useState("");
  const [leaveTypeDesc, setLeaveTypeDesc] = useState("");
  const [rows, setRows] = useState<LeaveSlapRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  // ---------- Lookups ----------
  const loadLeaveTypes = useCallback(
    async (query?: string) => {
      return getDynamicLookup({
        parameter: "HR_LEAVE_SLAP_DROP_DOWN_LEAVE_TYPE",
        loginid,
        code1: companyCode,
        code2: query ?? "",
        code3: "",
        code4: "",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
    },
    [companyCode, loginid],
  );

  const loadCalculationBase = useCallback(
    async (query?: string) => {
      return getDynamicLookup({
        parameter: "HR_LEAVE_SLAP_DROP_DOWN_CALCULATION_BASE",
        loginid,
        code1: companyCode,
        code2: query ?? "",
        code3: "",
        code4: "",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
    },
    [companyCode, loginid],
  );

  // ---------- Load data when Leave Type selected ----------
  useEffect(() => {
    if (!leaveType || !companyCode) {
      setRows([]);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await getDynamicLookup({
          parameter: "HR_LEAVE_SLAP_MAIN_PAGE_DATA",
          loginid,
          code1: companyCode,
          code2: leaveType,
          code3: "",
          code4: "",
          number1: 0,
          number2: 0,
          number3: 0,
          number4: 0,
          date1: null,
          date2: null,
          date3: null,
          date4: null,
        });

        if (cancelled) return;

        const mapped: LeaveSlapRow[] = (data || []).map((r: any, index: number) => {
          const slno = Number(r.SLNO ?? r.slno ?? index + 1);
          const daysFromRaw = r.DAYS_FROM ?? r.days_from;
          const daysToRaw = r.DAYS_TO ?? r.days_to;
          const dedAmtRaw = r.DED_AMT ?? r.ded_amt;
          const dedPerRaw = r.DED_PER ?? r.ded_per;
          const dedBase = String(r.DED_BASE ?? r.ded_base ?? "");
          const statusRaw = String(r.STATUS ?? r.status ?? "A").toUpperCase();

          return {
            id: `${r.COMPANY_CODE ?? r.company_code ?? companyCode}-${r.LEAVE_TYPE ?? r.leave_type ?? leaveType}-${slno}`,
            sino: slno,
            daysFrom: daysFromRaw === null || daysFromRaw === undefined ? "" : Number(daysFromRaw),
            daysTo: daysToRaw === null || daysToRaw === undefined ? "" : Number(daysToRaw),
            deductionAmount: dedAmtRaw === null || dedAmtRaw === undefined ? "" : Number(dedAmtRaw),
            deductionPct: dedPerRaw === null || dedPerRaw === undefined ? "" : Number(dedPerRaw),
            calculationBase: dedBase,
            calculationBaseDesc: dedBase,
            status: (statusRaw === "I" ? "I" : "A") as "A" | "I",
            remarks: String(r.REMARKS ?? r.remarks ?? ""),
          };
        });

        mapped.sort((a, b) => a.sino - b.sino);
        setRows(mapped);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setRows([]);
          toast.error(err instanceof Error ? err.message : "Unable to load leave slap data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [leaveType, companyCode, loginid, toast]);

  // ---------- Helpers ----------
  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row: LeaveSlapRow) => {
    setEditingId(row.id);
    setForm({
      daysFrom: String(row.daysFrom ?? ""),
      daysTo: String(row.daysTo ?? ""),
      deductionAmount: String(row.deductionAmount ?? ""),
      deductionPct: String(row.deductionPct ?? ""),
      calculationBase: row.calculationBase,
      calculationBaseDesc: row.calculationBaseDesc ?? row.calculationBase,
      status: row.status,
      remarks: row.remarks ?? "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setRows((prev) =>
      prev
        .filter((r) => r.id !== id)
        .map((r, idx) => ({ ...r, sino: idx + 1 })),
    );
    toast.success("Row removed");
  };

  const handleDialogSave = () => {
    const daysFrom = form.daysFrom === "" ? "" : Number(form.daysFrom);
    const daysTo = form.daysTo === "" ? "" : Number(form.daysTo);
    const deductionAmount = form.deductionAmount === "" ? "" : Number(form.deductionAmount);
    const deductionPct = form.deductionPct === "" ? "" : Number(form.deductionPct);

    if (daysFrom === "" || daysTo === "") {
      toast.warning("Days From and Days To are required");
      return;
    }
    if (Number(daysFrom) > Number(daysTo)) {
      toast.warning("Days From cannot be greater than Days To");
      return;
    }

    const payload: Omit<LeaveSlapRow, "id" | "sino"> = {
      daysFrom,
      daysTo,
      deductionAmount,
      deductionPct,
      calculationBase: form.calculationBase,
      calculationBaseDesc: form.calculationBaseDesc,
      status: form.status,
      remarks: form.remarks.trim(),
    };

    if (editingId) {
      setRows((prev) =>
        prev.map((r) => (r.id === editingId ? { ...r, ...payload } : r)),
      );
      toast.success("Row updated");
    } else {
      setRows((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sino: prev.length + 1,
          ...payload,
        },
      ]);
      toast.success("Row added");
    }

    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSaveAll = async () => {
    if (!leaveType) {
      toast.warning("Please select Leave Type first");
      return;
    }
    if (rows.length === 0) {
      toast.warning("Nothing to save");
      return;
    }

    setSaving(true);
    try {
      const message = await saveLeaveSlap({
        companyCode,
        leaveType,
        loginid,
        rows: rows.map((r) => ({
          slno: r.sino,
          daysFrom: r.daysFrom,
          daysTo: r.daysTo,
          deductionAmount: r.deductionAmount,
          deductionPct: r.deductionPct,
          calculationBase: r.calculationBase,
          status: r.status,
          remarks: r.remarks,
        })),
      });

      toast.success(message || "Saved successfully");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Columns ----------
  const columns = useMemo<ColumnDef<LeaveSlapRow>[]>(
    () => [
      { accessorKey: "sino", header: "Sino", size: 60 },
      { accessorKey: "daysFrom", header: "Days From", size: 90 },
      { accessorKey: "daysTo", header: "Days To", size: 90 },
      {
        accessorKey: "deductionAmount",
        header: "Deduction Amount",
        size: 130,
        cell: ({ getValue }) => {
          const v = getValue();
          return v === "" || v == null ? "" : Number(v).toLocaleString();
        },
      },
      { accessorKey: "deductionPct", header: "Deduction %", size: 100 },
      {
        accessorKey: "calculationBase",
        header: "Calculation Base",
        size: 140,
        cell: ({ row }) =>
          row.original.calculationBaseDesc || row.original.calculationBase || "",
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 90,
        cell: ({ getValue }) => (getValue() === "A" ? "Active" : "Inactive"),
      },
      { accessorKey: "remarks", header: "Remarks", size: 180 },
      {
        id: "actions",
        header: "Actions",
        size: 110,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="Edit"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row.original);
              }}
            >
              <Pencil size={14} />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="Delete"
              className="text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row.original.id);
              }}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  // ---------- Render ----------
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-[#aebbd0] bg-white px-4 py-3 shadow-sm">
        <div className="min-w-[280px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Company <span className="text-destructive">*</span>
          </label>
          <Input
            value={`${companyName}${companyCode ? ` (${companyCode})` : ""}`}
            disabled
            className="h-9 bg-muted/40"
          />
        </div>

        <div className="min-w-[320px] flex-1">
          <LookupField
            label="Leave"
            required
            value={leaveType}
            displayValue={leaveTypeDesc}
            columns={[
              { field: "leave_type", header: "Code" },
              { field: "leave_type_desc", header: "Description" },
              { field: "maximum_days_allow", header: "Max Days" },
              { field: "min_service_days_required", header: "Min Service Days" },
            ]}
            valueField="leave_type"
            displayFields={["leave_type", "leave_type_desc"]}
            loadOptions={loadLeaveTypes}
            onChange={(val, row) => {
              setLeaveType(val);
              setLeaveTypeDesc(
                row
                  ? `${row.leave_type ?? row.LEAVE_TYPE ?? ""} ${row.leave_type_desc ?? row.LEAVE_TYPE_DESC ?? ""}`.trim()
                  : "",
              );
            }}
            placeholder="Select leave type..."
          />
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <Button type="button" onClick={openAdd} disabled={!leaveType}>
            <Plus size={16} className="mr-1" />
            Add
          </Button>
          <Button
            type="button"
            onClick={handleSaveAll}
            disabled={!leaveType || rows.length === 0 || saving}
          >
            <Save size={16} className="mr-1" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          density="compact"
          height="calc(100vh - 220px)"
          emptyText={
            leaveType
              ? "No leave slap records. Click Add to create one."
              : "Select a Leave Type to view / maintain slap."
          }
          enablePagination={false}
          enableColumnFilters={false}
          enableExport={false}
        />
      </div>

      <Dialog
        open={dialogOpen}
        title={editingId ? "Edit Leave Slap" : "Add Leave Slap"}
        description="Enter the range and deduction details."
        onClose={() => {
          setDialogOpen(false);
          setEditingId(null);
          setForm(emptyForm);
        }}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleDialogSave}>
              {editingId ? "Update" : "Add"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>
              Days From <span className="text-destructive">*</span>
            </span>
            <Input
              type="number"
              min={0}
              value={form.daysFrom}
              onChange={(e) => setForm((f) => ({ ...f, daysFrom: e.target.value }))}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>
              Days To <span className="text-destructive">*</span>
            </span>
            <Input
              type="number"
              min={0}
              value={form.daysTo}
              onChange={(e) => setForm((f) => ({ ...f, daysTo: e.target.value }))}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Deduction Amount</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.deductionAmount}
              onChange={(e) =>
                setForm((f) => ({ ...f, deductionAmount: e.target.value }))
              }
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Deduction %</span>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.deductionPct}
              onChange={(e) =>
                setForm((f) => ({ ...f, deductionPct: e.target.value }))
              }
            />
          </label>

          <div className="sm:col-span-2">
            <LookupField
              label="Calculation Base"
              value={form.calculationBase}
              displayValue={form.calculationBaseDesc}
              columns={[
                { field: "VALUE_CODE", header: "Code" },
                { field: "VALUE_DESC", header: "Description" },
              ]}
              valueField="VALUE_CODE"
              displayFields={["VALUE_DESC"]}
              loadOptions={loadCalculationBase}
              onChange={(val, row) => {
                setForm((f) => ({
                  ...f,
                  calculationBase: val,
                  calculationBaseDesc: row
                    ? String(row.VALUE_DESC ?? row.value_desc ?? val)
                    : val,
                }));
              }}
              compact
            />
          </div>

          <label className="grid gap-1 text-sm">
            <span>Status</span>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as "A" | "I",
                }))
              }
            >
              <option value="A">Active</option>
              <option value="I">Inactive</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm sm:col-span-2">
            <span>Remarks</span>
            <Input
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              placeholder="Optional remarks"
            />
          </label>
        </div>
      </Dialog>
    </div>
  );
}