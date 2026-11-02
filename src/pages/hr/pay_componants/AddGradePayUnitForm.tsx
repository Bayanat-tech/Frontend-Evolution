// Grade Pay Unit form — new UI
//  • Merges the old AddGradePayUnitForm + GradePayUnitHeaderForm (formik removed)
//  • forwardRef + useImperativeHandle → page header "Save" button calls save()
//  • SectionPanel / Field from shared FormBlocks, toast for all feedback
//  • Row delete uses Dialog tone="danger" instead of window.confirm

import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, IdCard, ListChecks, Plus, Trash2 } from "lucide-react";
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../../api/lookups";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { Field, SectionPanel } from "../../../components/ui/Formblocks";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { useAuth } from "../../../state/AuthContext";
import hrGradeComponentServiceInstance from "./insUpdHrGrade";

/* ================= TYPES ================= */

/** Exposed to the page so the header Save button can trigger save() */
export type GradePayUnitFormHandle = {
  save: () => Promise<void>;
};

type Props = {
  divCode: string;
  divName: string;
  readonly?: boolean;
};

type PayUnitRow = {
  id: string;
  /** true once the row has come from the backend (needs an API call to delete) */
  persisted: boolean;
  pay_comp_id: string;
  pay_comp_desc: string;
  pay_comp_short_desc: string;
  min_pay_amt: number;
  medium_pay_amt: number;
  max_pay_amt: number;
  approved_date: string;
  status: string;
  remarks: string;
  /** Full backend row (UPPERCASE keys) so fields this screen doesn't edit survive a save */
  raw: Record<string, unknown>;
};

type GradeOption = { grade_code: string; grade_name: string };
type PayUnitOption = { pay_comp_id: string; pay_comp_desc: string; pay_comp_short_desc: string };
type CodeOption = { value_code: string; value_desc: string };

type AmountKey = "min_pay_amt" | "medium_pay_amt" | "max_pay_amt";
const AMOUNT_FIELDS: ReadonlyArray<readonly [AmountKey, string]> = [
  ["min_pay_amt", "Minimum Pay Amount"],
  ["medium_pay_amt", "Medium Pay Amount"],
  ["max_pay_amt", "Maximum Pay Amount"],
];

/* ================= HELPERS ================= */

const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

function uppercaseKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key in row) out[key.toUpperCase()] = row[key];
  return out;
}

function toDate(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value).trim());
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

const createEmptyRow = (): PayUnitRow => ({
  id: newId(),
  persisted: false,
  pay_comp_id: "",
  pay_comp_desc: "",
  pay_comp_short_desc: "",
  min_pay_amt: 0,
  medium_pay_amt: 0,
  max_pay_amt: 0,
  approved_date: "",
  status: "",
  remarks: "",
  raw: {},
});

/* ── Lookup option mappers (module-level so they stay referentially stable) ── */
const mapGrade = (r: Record<string, unknown>): GradeOption => ({
  grade_code: String(r.GRADE_CODE ?? ""),
  grade_name: String(r.GRADE_NAME ?? ""),
});
const mapPayUnit = (r: Record<string, unknown>): PayUnitOption => ({
  pay_comp_id: String(r.PAY_COMP_ID ?? ""),
  pay_comp_desc: String(r.PAY_COMP_DESC ?? ""),
  pay_comp_short_desc: String(r.PAY_COMP_SHORT_DESC ?? ""),
});
const mapCode = (r: Record<string, unknown>): CodeOption => ({
  value_code: String(r.VALUE_CODE ?? ""),
  value_desc: String(r.VALUE_DESC ?? ""),
});

/** One generic hook replaces the old useGradeOptions / useDependUnitOptions / useCodeOptions */
function useLookupOptions<T>(
  parameter: string,
  map: (row: Record<string, unknown>) => T,
  label: string,
): T[] {
  const { user } = useAuth();
  const { toast } = useToast();
  const [options, setOptions] = useState<T[]>([]);
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";

  useEffect(() => {
    if (!companyCode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getDynamicLookup({ parameter, code1: companyCode, code2: loginid });
        const rows = (Array.isArray(res) ? res : []) as unknown as Record<string, unknown>[];
        if (!cancelled) setOptions(rows.map(uppercaseKeys).map(map));
      } catch {
        if (!cancelled) {
          setOptions([]);
          toast.error(`Unable to load ${label}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameter, companyCode, loginid]);

  return options;
}

/* ================= FORM ================= */

export const AddGradePayUnitForm = forwardRef<GradePayUnitFormHandle, Props>(
  function AddGradePayUnitForm({ divCode, divName, readonly = false }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();
    const companyCode = user?.company_code ?? "";
    const loginid = user?.loginid ?? "ADMIN";

    const gradeOptions = useLookupOptions("PAY_COMPONENT_GradeId", mapGrade, "grades");
    const payUnitOptions = useLookupOptions("PAY_COMPONENT_PAYUNIT_DependPayUnit", mapPayUnit, "pay units");
    const statusOptions = useLookupOptions("PAY_COMPONENT_STATUS_CodeValue", mapCode, "statuses");

    const [gradeCode, setGradeCode] = useState("");
    const [gradeError, setGradeError] = useState("");
    const [rows, setRows] = useState<PayUnitRow[]>([]);
    const [loadingRows, setLoadingRows] = useState(false);

    // add / edit row panel — `draft` being non-null means the panel is shown above the table
    const [draft, setDraft] = useState<PayUnitRow | null>(null);

    // delete dialog
    const [deleteTarget, setDeleteTarget] = useState<PayUnitRow | null>(null);
    const [deleting, setDeleting] = useState(false);

    // guards against out-of-order responses when the grade is switched quickly
    const loadToken = useRef(0);

    /* ── Load rows for the selected grade ── */
    const loadGradeRows = useCallback(
      async (code: string) => {
        const token = ++loadToken.current;
        if (!code || !companyCode) {
          setRows([]);
          setLoadingRows(false);
          return;
        }
        setLoadingRows(true);
        try {
          const res = await getDynamicLookup({
            parameter: "PAY_COMPONENT_Grade_Data",
            code1: companyCode,
            code2: code,
          });
          if (token !== loadToken.current) return;
          const raw = (Array.isArray(res) ? res : []) as unknown as Record<string, unknown>[];
          setRows(
            raw.map(uppercaseKeys).map((r) => ({
              id: newId(),
              persisted: true,
              pay_comp_id: String(r.PAY_COMP_ID ?? ""),
              pay_comp_desc: String(r.PAY_COMP_DESC ?? ""),
              pay_comp_short_desc: String(r.PAY_COMP_SHORT_DESC ?? ""),
              min_pay_amt: Number(r.MIN_PAY_AMT ?? 0),
              medium_pay_amt: Number(r.MEDIUM_PAY_AMT ?? 0),
              max_pay_amt: Number(r.MAX_PAY_AMT ?? 0),
              approved_date: toDate(r.APPROVED_DATE),
              status: String(r.STATUS ?? ""),
              remarks: String(r.REMARKS ?? ""),
              raw: r,
            })),
          );
        } catch (error) {
          if (token !== loadToken.current) return;
          setRows([]);
          toast.error(error instanceof Error ? error.message : "Unable to load grade pay units");
        } finally {
          if (token === loadToken.current) setLoadingRows(false);
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [companyCode],
    );

    const handleGradeChange = (code: string) => {
      setGradeCode(code);
      setGradeError("");
      void loadGradeRows(code);
    };

    /* ── Row panel handlers ── */
    const openAddRow = () => setDraft(createEmptyRow());
    const openEditRow = (row: PayUnitRow) => setDraft({ ...row });
    const closeRowPanel = () => setDraft(null);
    const patchDraft = (patch: Partial<PayUnitRow>) =>
      setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

    const saveDraft = () => {
      if (!draft) return;
      if (!draft.pay_comp_id) {
        toast.warning("Please select a Pay Unit");
        return;
      }
      setRows((prev) => {
        const index = prev.findIndex((r) => r.id === draft.id);
        if (index === -1) return [...prev, draft];
        const next = [...prev];
        next[index] = draft;
        return next;
      });
      setDraft(null);
    };

    /* ── Delete ── */
    const requestDelete = (row: PayUnitRow) => {
      if (!row.persisted) {
        // never saved → nothing to delete on the server
        setRows((prev) => prev.filter((r) => r.id !== row.id));
        return;
      }
      setDeleteTarget(row);
    };

    const confirmDelete = async () => {
      if (!deleteTarget) return;
      setDeleting(true);
      try {
        await executeDynamicDelete({
          parameter: "PAY_COMPONENT_GradePay_Delete",
          loginid,
          code1: companyCode,
          code2: deleteTarget.pay_comp_id,
          // NOTE: the old code sent only company + pay unit (no grade). Confirm the
          // proc reads code3, otherwise this deletes the pay unit for every grade.
          code3: gradeCode,
        } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
        toast.success("Row deleted successfully");
        setDeleteTarget(null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to delete row");
      } finally {
        setDeleting(false);
      }
    };

    /* ── Save (called by the page header Save button) ── */
    const handleSave = async () => {
      if (!gradeCode.trim()) {
        setGradeError("Grade is required");
        toast.warning("Please select a Grade");
        return;
      }
      if (rows.length === 0) {
        toast.warning("Please add at least one row");
        return;
      }
      try {
        const grade = gradeOptions.find((g) => g.grade_code === gradeCode);
        const payload = rows.map((r, index) => {
          const num = (key: string) => Number(r.raw[key] ?? 0);
          const str = (key: string) => String(r.raw[key] ?? "");
          return {
            company_code: companyCode,
            grade_code: gradeCode,
            grade_name: grade?.grade_name ?? "",
            pay_comp_id: r.pay_comp_id,
            min_pay_amt: r.min_pay_amt,
            medium_pay_amt: r.medium_pay_amt,
            max_pay_amt: r.max_pay_amt,
            approved_date: r.approved_date || "",
            status: r.status || "A",
            remarks: r.remarks || "",
            user_id: loginid,
            sort_order: index + 1,
            // fields this screen doesn't edit — carried over from the loaded row
            reimbursement: str("REIMBURSEMENT"),
            min_reimb_amt: num("MIN_REIMB_AMT"),
            max_reimb_amt: num("MAX_REIMB_AMT"),
            emp_percent: num("EMP_PERCENT"),
            grade_paycomp_amt: num("GRADE_PAYCOMP_AMT"),
            old_grade_paycomp_amt: num("OLD_GRADE_PAYCOMP_AMT"),
            arrears_posted: str("ARREARS_POSTED"),
            arrears_amt: num("ARREARS_AMT"),
            approval_status: str("APPROVAL_STATUS"),
            old_min_pay_amt: num("OLD_MIN_PAY_AMT"),
            old_medium_pay_amt: num("OLD_MEDIUM_PAY_AMT"),
            old_max_pay_amt: num("OLD_MAX_PAY_AMT"),
            arrears_percent: num("ARREARS_PERCENT"),
          };
        });

        const result = await hrGradeComponentServiceInstance.upsertHrGradeComponentApi({
          data: payload,
          loginid,
        });
        if (!result.success) throw new Error(result.message || "Save failed");

        toast.success("Grade pay units saved successfully");
        await loadGradeRows(gradeCode); // refresh so rows are marked as persisted
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save grade pay units");
      }
    };

    useImperativeHandle(ref, () => ({ save: handleSave }));

    /* ── Columns ── */
    const columns = useMemo<ColumnDef<PayUnitRow>[]>(
      () => [
        {
          id: "srno",
          header: "No.",
          size: 60,
          enableSorting: false,
          cell: ({ row }) => row.index + 1,
        },
        {
          accessorKey: "pay_comp_id",
          header: "Pay Unit",
          size: 240,
          enableSorting: false,
          cell: ({ row }) =>
            row.original.pay_comp_desc
              ? `${row.original.pay_comp_desc} (${row.original.pay_comp_short_desc})`
              : row.original.pay_comp_id || "—",
        },
        {
          accessorKey: "min_pay_amt",
          header: "Min Pay Amount",
          size: 140,
          enableSorting: false,
          cell: ({ row }) => <span className="block text-right">{row.original.min_pay_amt}</span>,
        },
        {
          accessorKey: "medium_pay_amt",
          header: "Medium Pay Amount",
          size: 150,
          enableSorting: false,
          cell: ({ row }) => <span className="block text-right">{row.original.medium_pay_amt}</span>,
        },
        {
          accessorKey: "max_pay_amt",
          header: "Max Pay Amount",
          size: 140,
          enableSorting: false,
          cell: ({ row }) => <span className="block text-right">{row.original.max_pay_amt}</span>,
        },
        {
          accessorKey: "approved_date",
          header: "Approved Date",
          size: 130,
          enableSorting: false,
          cell: ({ row }) => <span className="block text-center">{row.original.approved_date || "—"}</span>,
        },
        {
          accessorKey: "status",
          header: "Status",
          size: 120,
          enableSorting: false,
          cell: ({ row }) =>
            statusOptions.find((o) => o.value_code === row.original.status)?.value_desc ??
            (row.original.status || "—"),
        },
        {
          accessorKey: "remarks",
          header: "Remarks",
          size: 180,
          enableSorting: false,
          cell: ({ row }) => row.original.remarks || "—",
        },
        ...(readonly
          ? []
          : [
              {
                id: "actions",
                header: "Actions",
                size: 90,
                enableColumnFilter: false,
                cell: ({ row }) => (
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      onClick={() => openEditRow(row.original)}
                      title="Edit row"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      onClick={() => requestDelete(row.original)}
                      title="Delete row"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ),
              } as ColumnDef<PayUnitRow>,
            ]),
      ],
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [readonly, statusOptions],
    );

    const isEditingRow = !!draft && rows.some((r) => r.id === draft.id);

    /* ── UI ── */
    return (
      <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
        <SectionPanel title="Identification" icon={IdCard}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Division">
              <Input
                disabled
                readOnly
                value={divCode && divName ? `${divCode} - ${divName}` : divCode}
              />
            </Field>

            <Field label="Grade" required error={gradeError}>
              <Select
                disabled={readonly}
                value={gradeCode}
                onChange={(e) => handleGradeChange(e.target.value)}
              >
                <option value="">-- Select --</option>
                {gradeOptions.map((g) => (
                  <option key={g.grade_code} value={g.grade_code}>
                    {g.grade_code} - {g.grade_name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </SectionPanel>

        {/* ── Pay Unit Details (inline add / edit panel, above the table) ── */}
        {draft && (
          <SectionPanel
            title="Pay Unit Details"
            icon={ListChecks}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Pay Unit" required className=" !w-[300px] md:col-span-3">
                <Select
                  value={draft.pay_comp_id}
                  onChange={(e) => {
                    const picked = payUnitOptions.find((p) => p.pay_comp_id === e.target.value);
                    patchDraft({
                      pay_comp_id: picked?.pay_comp_id ?? "",
                      pay_comp_desc: picked?.pay_comp_desc ?? "",
                      pay_comp_short_desc: picked?.pay_comp_short_desc ?? "",
                    });
                  }}
                >
                  <option value="">-- Select Pay Unit --</option>
                  {payUnitOptions.map((p) => (
                    <option key={p.pay_comp_id} value={p.pay_comp_id}>
                      {p.pay_comp_desc} - {p.pay_comp_short_desc}
                    </option>
                  ))}
                </Select>
              
              </Field>

              {AMOUNT_FIELDS.map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    className="text-right font-mono"
                    value={draft[key]}
                    onChange={(e) => patchDraft({ [key]: parseFloat(e.target.value) || 0 })}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      patchDraft({ [key]: Number.isNaN(val) ? 0 : parseFloat(val.toFixed(2)) });
                    }}
                  />
                </Field>
              ))}

              <Field label="Approved Date">
                <Input
                  type="date"
                  value={draft.approved_date}
                  onChange={(e) => patchDraft({ approved_date: e.target.value })}
                />
              </Field>

              <Field label="Status">
                <Select value={draft.status} onChange={(e) => patchDraft({ status: e.target.value })}>
                  <option value="">-- Select --</option>
                  {statusOptions.map((s) => (
                    <option key={s.value_code} value={s.value_code}>
                      {s.value_code} - {s.value_desc}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Remarks">
                <Input value={draft.remarks} onChange={(e) => patchDraft({ remarks: e.target.value })} />
              </Field>
            </div>

            <div className="mt-3 flex justify-end gap-1.5">
              <Button type="button" size="sm" variant="outline" onClick={closeRowPanel}>
                Cancel
              </Button>
              {!readonly && (
                <Button type="button" size="sm" onClick={saveDraft}>
                  {isEditingRow ? "Update Row" : "Add Row"}
                </Button>
              )}
            </div>
          </SectionPanel>
        )}

        <DataTable
          columns={columns}
          data={rows}
          title={loadingRows ? "Loading" : `${rows.length.toLocaleString()} Pay Units`}
          subtitle="Grade Pay Unit Parameters"
          loading={loadingRows}
          emptyText={gradeCode ? "No pay units added" : "Select a grade to load its pay units"}
          height={320}
          minWidth={1000}
          density="grid"
          getRowId={(row) => row.id}
          toolbar={
            !readonly ? (
              <button
                type="button"
                onClick={openAddRow}
                disabled={!gradeCode}
                title={gradeCode ? "Add a pay unit row" : "Select a grade first"}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={14} />
                Add Row
              </button>
            ) : undefined
          }
        />

        {/* ── Delete confirmation dialog ── */}
        <Dialog
          open={!!deleteTarget}
          title="Delete Row"
          description={
            deleteTarget
              ? `Delete ${deleteTarget.pay_comp_desc || deleteTarget.pay_comp_id}?`
              : undefined
          }
          compact
          tone="danger"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </>
          }
        >
          <p className="m-0 text-sm text-muted-foreground">
            This action cannot be undone. Are you sure you want to delete this pay unit row?
          </p>
        </Dialog>
      </div>
    );
  },
);

export default AddGradePayUnitForm;