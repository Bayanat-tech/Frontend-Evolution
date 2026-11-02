// Pay Unit Dependent form — new UI
//  • Merges AddPayUnitDependentForm + PayUnitDependHeaderForm + PayUnitDependDetailForm (formik removed)
//  • forwardRef + useImperativeHandle → page header "Save" button calls save()
//  • Two child grids → Freight tabs; each grid has an inline detail panel ABOVE its table
//    (no add/edit dialogs); row delete uses Dialog tone="danger"
//  • toast for all feedback

import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Globe, IdCard, ListChecks, Plus, Trash2 } from "lucide-react";
import {
  forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState,
} from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../../api/lookups";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { Field, SectionPanel } from "../../../components/ui/Formblocks";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { uppercaseKeys, useLookupOptions } from "../../../components/ui/Uselookupoptions";
import { useAuth } from "../../../state/AuthContext";
import hrPayCompDependServiceInstance, {
  type THrPayCompDependDetail,
  type THrPayCompDependHeader,
} from "./insUpdHrPayCompDepend";

/* ================= TYPES ================= */

export type PayUnitDependentFormHandle = {
  save: () => Promise<void>;
};

type Props = {
  divCode: string;
  divName: string;
  readonly?: boolean;
};

/** "Depend To Pay Unit" grid row */
type DependRow = {
  id: string;
  persisted: boolean;
  depend_pay_comp_type: string;
  percent: number;
  emp_percent: number;
  status: string;
  remarks: string;
};

/** Nationality / limit grid row */
type LimitRow = {
  id: string;
  persisted: boolean;
  country_code: string;
  nationality: string;
  age: number;
  amount: number;
  status: string;
  remarks: string;
};

type PayUnitOption = { pay_comp_id: string; pay_comp_desc: string };
type DependUnitOption = { pay_comp_id: string; pay_comp_desc: string; pay_comp_short_desc: string };
type CodeOption = { value_code: string; value_desc: string };
type CountryOption = { country_code: string; country_name: string; nationality: string };

type DeleteTarget =
  | { kind: "depend"; row: DependRow }
  | { kind: "limit"; row: LimitRow };

const TABS = ["Dependent Pay Units", "Dependent Parameters"];

const LIMIT_STATUS_OPTIONS = [
  { value: "A", label: "Active" },
  { value: "I", label: "Inactive" },
];

/* ================= HELPERS ================= */

const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

const createEmptyDepend = (): DependRow => ({
  id: newId(),
  persisted: false,
  depend_pay_comp_type: "",
  percent: 0,
  emp_percent: 0,
  status: "",
  remarks: "",
});

const createEmptyLimit = (): LimitRow => ({
  id: newId(),
  persisted: false,
  country_code: "",
  nationality: "",
  age: 0,
  amount: 0,
  status: "A",
  remarks: "",
});

const asRows = (res: unknown) =>
  (Array.isArray(res) ? res : []) as unknown as Record<string, unknown>[];

/* ── Lookup mappers (module-level → referentially stable) ── */
const mapPayUnit = (r: Record<string, unknown>): PayUnitOption => ({
  pay_comp_id: String(r.PAY_COMP_ID ?? ""),
  pay_comp_desc: String(r.PAY_COMP_DESC ?? ""),
});
const mapDependUnit = (r: Record<string, unknown>): DependUnitOption => ({
  pay_comp_id: String(r.PAY_COMP_ID ?? ""),
  pay_comp_desc: String(r.PAY_COMP_DESC ?? ""),
  pay_comp_short_desc: String(r.PAY_COMP_SHORT_DESC ?? ""),
});
const mapCode = (r: Record<string, unknown>): CodeOption => ({
  value_code: String(r.VALUE_CODE ?? ""),
  value_desc: String(r.VALUE_DESC ?? ""),
});
const mapCountry = (r: Record<string, unknown>): CountryOption => ({
  country_code: String(r.COUNTRY_CODE ?? ""),
  country_name: String(r.COUNTRY_NAME ?? ""),
  nationality: String(r.NATIONALITY ?? ""),
});

/** Shared Edit / Delete icon column */
function actionsColumn<T>(onEdit: (row: T) => void, onDelete: (row: T) => void): ColumnDef<T> {
  return {
    id: "actions",
    header: "Actions",
    size: 90,
    enableColumnFilter: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
          onClick={() => onEdit(row.original)}
          title="Edit row"
        >
          <Edit2 size={13} />
        </button>
        <button
          type="button"
          className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
          onClick={() => onDelete(row.original)}
          title="Delete row"
        >
          <Trash2 size={13} />
        </button>
      </div>
    ),
  };
}

function AddRowButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Select a pay unit first" : "Add a row"}
      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Plus size={14} />
      Add Row
    </button>
  );
}

/* ================= FORM ================= */

export const AddPayUnitDependentForm = forwardRef<PayUnitDependentFormHandle, Props>(
  function AddPayUnitDependentForm({ divCode, divName, readonly = false }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();
    const companyCode = user?.company_code ?? "";
    const loginid = user?.loginid ?? "ADMIN";

    const payUnitOptions = useLookupOptions("PAY_COMPONENT_PAYUNIT_Dep_UnitId", mapPayUnit, "pay units");
    const dependUnitOptions = useLookupOptions("PAY_COMPONENT_PAYUNIT_DependPayUnit", mapDependUnit, "dependent pay units");
    const statusOptions = useLookupOptions("PAY_COMPONENT_STATUS_CodeValue", mapCode, "statuses");
    const countryOptions = useLookupOptions("PAY_COMPONENT_PAYUNIT_CountryList", mapCountry, "countries");

    const [tab, setTab] = useState(0);
    const [payCompId, setPayCompId] = useState("");
    const [payCompError, setPayCompError] = useState("");
    const [dependRows, setDependRows] = useState<DependRow[]>([]);
    const [limitRows, setLimitRows] = useState<LimitRow[]>([]);
    const [loadingRows, setLoadingRows] = useState(false);

    // inline detail panels — non-null means the panel is shown above its table
    const [dependDraft, setDependDraft] = useState<DependRow | null>(null);
    const [limitDraft, setLimitDraft] = useState<LimitRow | null>(null);

    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [deleting, setDeleting] = useState(false);

    const loadToken = useRef(0);

    /* ── Load both grids for the selected pay unit ── */
    const loadRows = useCallback(
      async (id: string) => {
        const token = ++loadToken.current;
        if (!id || !companyCode) {
          setDependRows([]);
          setLimitRows([]);
          setLoadingRows(false);
          return;
        }
        setLoadingRows(true);
        try {
          const [headerRes, detailRes] = await Promise.all([
            getDynamicLookup({ parameter: "PAY_COMPONENT_PAY_UNIT", code1: companyCode, code2: id }),
            getDynamicLookup({ parameter: "PAY_COMPONENT_DEPEND", code1: companyCode, code2: id }),
          ]);
          if (token !== loadToken.current) return;

          setDependRows(
            asRows(headerRes).map(uppercaseKeys).map((r) => ({
              id: newId(),
              persisted: true,
              depend_pay_comp_type: String(r.PAY_COMP_ID_DEPEND ?? ""),
              percent: Number(r.PERCENT ?? 0),
              emp_percent: Number(r.EMPR_PERCENT ?? 0),
              status: String(r.STATUS_FLAG ?? ""),
              remarks: String(r.REMARKS ?? ""),
            })),
          );
          setLimitRows(
            asRows(detailRes).map(uppercaseKeys).map((r) => {
              const nationality = String(r.NATIONALITY ?? "");
              return {
                id: newId(),
                persisted: true,
                country_code: nationality, // backend stores the country code in NATIONALITY
                nationality,
                age: Number(r.AGE ?? 0),
                amount: Number(r.AMT_LIMIT ?? 0),
                status: String(r.STATUS ?? ""),
                remarks: String(r.REMARKS ?? ""),
              };
            }),
          );
        } catch (error) {
          if (token !== loadToken.current) return;
          setDependRows([]);
          setLimitRows([]);
          toast.error(error instanceof Error ? error.message : "Unable to load pay unit data");
        } finally {
          if (token === loadToken.current) setLoadingRows(false);
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [companyCode],
    );

    const handlePayCompChange = (id: string) => {
      setPayCompId(id);
      setPayCompError("");
      setDependDraft(null);
      setLimitDraft(null);
      void loadRows(id);
    };

    /* ── Display helpers (derived from lookups, so no race with option loading) ── */
    const dependLabel = (id: string) => {
      const o = dependUnitOptions.find((d) => d.pay_comp_id === id);
      return o ? `${o.pay_comp_desc} (${o.pay_comp_short_desc})` : id || "—";
    };
    const countryLabel = (code: string) => {
      const c = countryOptions.find((o) => o.country_code === code);
      return c ? `${c.country_code} - ${c.country_name}` : code || "—";
    };

    /* ── Depend row panel ── */
    const patchDepend = (patch: Partial<DependRow>) =>
      setDependDraft((prev) => (prev ? { ...prev, ...patch } : prev));

    const saveDependDraft = () => {
      if (!dependDraft) return;
      if (!dependDraft.depend_pay_comp_type) {
        toast.warning("Please select a Depend To Pay Unit");
        return;
      }
      setDependRows((prev) => {
        const index = prev.findIndex((r) => r.id === dependDraft.id);
        if (index === -1) return [...prev, dependDraft];
        const next = [...prev];
        next[index] = dependDraft;
        return next;
      });
      setDependDraft(null);
    };

    /* ── Limit row panel ── */
    const patchLimit = (patch: Partial<LimitRow>) =>
      setLimitDraft((prev) => (prev ? { ...prev, ...patch } : prev));

    const saveLimitDraft = () => {
      if (!limitDraft) return;
      if (!limitDraft.country_code) {
        toast.warning("Please select a Nationality");
        return;
      }
      const duplicate = limitRows.some(
        (r) => r.id !== limitDraft.id && r.nationality !== "" && r.nationality === limitDraft.nationality,
      );
      if (duplicate) {
        toast.warning(`Nationality "${limitDraft.nationality}" already exists. Duplicates are not allowed.`);
        return;
      }
      setLimitRows((prev) => {
        const index = prev.findIndex((r) => r.id === limitDraft.id);
        if (index === -1) return [...prev, limitDraft];
        const next = [...prev];
        next[index] = limitDraft;
        return next;
      });
      setLimitDraft(null);
    };

    /* ── Delete ── */
    const requestDelete = (target: DeleteTarget) => {
      if (!target.row.persisted) {
        // never saved → nothing to delete on the server
        if (target.kind === "depend") setDependRows((prev) => prev.filter((r) => r.id !== target.row.id));
        else setLimitRows((prev) => prev.filter((r) => r.id !== target.row.id));
        return;
      }
      setDeleteTarget(target);
    };

    const confirmDelete = async () => {
      if (!deleteTarget) return;
      setDeleting(true);
      try {
        await executeDynamicDelete({
          parameter:
            deleteTarget.kind === "depend"
              ? "PAY_COMP_PAYUNIT_DEPEND_Delete"
              : "PAY_COMP_PAYUNIT_DEPEND_DETAIL_Delete",
          loginid,
          code1: companyCode,
          code2:
            deleteTarget.kind === "depend"
              ? deleteTarget.row.depend_pay_comp_type
              : deleteTarget.row.nationality,
          // NOTE: the old code sent no pay unit id. Confirm the proc reads code3,
          // otherwise this deletes the row for every pay unit.
          code3: payCompId,
        } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

        if (deleteTarget.kind === "depend") {
          setDependRows((prev) => prev.filter((r) => r.id !== deleteTarget.row.id));
        } else {
          setLimitRows((prev) => prev.filter((r) => r.id !== deleteTarget.row.id));
        }
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
      if (!payCompId.trim()) {
        setPayCompError("Pay Unit is required");
        toast.warning("Please select Pay Unit");
        return;
      }
      if (dependRows.length === 0) {
        setTab(0);
        toast.warning("Please add at least one Depend To Pay Unit row");
        return;
      }
      if (limitRows.length === 0) {
        setTab(1);
        toast.warning("Please add at least one detail row");
        return;
      }
      const nationalities = limitRows.map((d) => d.nationality).filter(Boolean);
      if (nationalities.length !== new Set(nationalities).size) {
        setTab(1);
        toast.warning("Duplicate nationality found in detail rows. Please remove duplicates before saving.");
        return;
      }

      try {
        const headers: THrPayCompDependHeader[] = dependRows.map((h) => ({
          company_code: companyCode,
          pay_comp_id: payCompId.trim(),
          pay_comp_id_depend: h.depend_pay_comp_type.trim(),
          percent: Number(h.percent) || 0,
          empr_percent: Number(h.emp_percent) || 0,
          remarks: h.remarks || undefined,
          status_flag: h.status || "A",
          user_id: user?.loginid ?? "",
          user_dt: new Date(),
        }));

        const details: THrPayCompDependDetail[] = limitRows.map((d) => ({
          company_code: companyCode,
          pay_comp_id: payCompId.trim(),
          // unchanged from the old code: every detail row is linked to the FIRST dependent pay unit
          pay_comp_id_depend: dependRows[0]?.depend_pay_comp_type.trim() ?? "",
          nationality: String(d.nationality).substring(0, 3),
          status: d.status || "A",
          remarks: d.remarks || undefined,
          amt_limit: Number(d.amount) || 0,
          user_id: user?.loginid ?? "",
          user_dt: new Date(),
        }));

        const result = await hrPayCompDependServiceInstance.insUpdHrPayCompDepend({
          header: headers,
          details,
        });
        if (!result.success) throw new Error(result.message || "Failed to save");

        toast.success("Pay unit dependents saved successfully");
        await loadRows(payCompId); // refresh so rows are marked as persisted
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save pay unit dependents");
      }
    };

    useImperativeHandle(ref, () => ({ save: handleSave }));

    /* ── Columns ── */
    const dependColumns = useMemo<ColumnDef<DependRow>[]>(
      () => [
        { id: "srno", header: "No.", size: 60, enableSorting: false, cell: ({ row }) => row.index + 1 },
        {
          accessorKey: "depend_pay_comp_type",
          header: "Depend To Pay Unit",
          size: 240,
          enableSorting: false,
          cell: ({ row }) => dependLabel(row.original.depend_pay_comp_type),
        },
        {
          accessorKey: "percent",
          header: "AMT %",
          size: 100,
          enableSorting: false,
          cell: ({ row }) => <span className="block text-right">{row.original.percent}</span>,
        },
        {
          accessorKey: "emp_percent",
          header: "Employee %",
          size: 120,
          enableSorting: false,
          cell: ({ row }) => <span className="block text-right">{row.original.emp_percent}</span>,
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
              actionsColumn<DependRow>(
                (r) => setDependDraft({ ...r }),
                (r) => requestDelete({ kind: "depend", row: r }),
              ),
            ]),
      ],
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [readonly, statusOptions, dependUnitOptions],
    );

    const limitColumns = useMemo<ColumnDef<LimitRow>[]>(
      () => [
        { id: "srno", header: "No.", size: 60, enableSorting: false, cell: ({ row }) => row.index + 1 },
        {
          accessorKey: "country_code",
          header: "Nationality",
          size: 200,
          enableSorting: false,
          cell: ({ row }) => countryLabel(row.original.country_code),
        },
        {
          accessorKey: "age",
          header: "Age",
          size: 100,
          enableSorting: false,
          cell: ({ row }) => <span className="block text-right">{row.original.age}</span>,
        },
        {
          accessorKey: "amount",
          header: "Amount",
          size: 120,
          enableSorting: false,
          cell: ({ row }) => <span className="block text-right">{row.original.amount}</span>,
        },
        {
          accessorKey: "status",
          header: "Status",
          size: 120,
          enableSorting: false,
          cell: ({ row }) =>
            LIMIT_STATUS_OPTIONS.find((o) => o.value === row.original.status)?.label ?? "—",
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
              actionsColumn<LimitRow>(
                (r) => setLimitDraft({ ...r }),
                (r) => requestDelete({ kind: "limit", row: r }),
              ),
            ]),
      ],
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [readonly, countryOptions],
    );

    const isEditingDepend = !!dependDraft && dependRows.some((r) => r.id === dependDraft.id);
    const isEditingLimit = !!limitDraft && limitRows.some((r) => r.id === limitDraft.id);

    const tabLabels = [`${TABS[0]} (${dependRows.length})`, `${TABS[1]} (${limitRows.length})`];

    /* ── UI ── */
    return (
      <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
        <SectionPanel title="Identification" icon={IdCard}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Division">
              <Input disabled readOnly value={divCode && divName ? `${divCode} - ${divName}` : divCode} />
            </Field>

            <Field label="Pay Unit" required error={payCompError}>
              <Select
                disabled={readonly}
                value={payCompId}
                onChange={(e) => handlePayCompChange(e.target.value)}
              >
                <option value="">-- Select --</option>
                {payUnitOptions.map((p) => (
                  <option key={p.pay_comp_id} value={p.pay_comp_id}>
                    {p.pay_comp_id} - {p.pay_comp_desc}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </SectionPanel>

        {/* ── Tabs shell (Freight style) ── */}
        <div className="freight-tabs-shell grid gap-0 rounded-md border bg-card shadow-sm">
          <div className="freight-tabs-list flex overflow-x-auto">
            {tabLabels.map((label, index) => (
              <button
                key={TABS[index]}
                type="button"
                onClick={() => setTab(index)}
                aria-pressed={tab === index}
                className={`freight-workspace-tab ${tab === index ? "active" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="freight-tabs-panel border-t p-3 grid gap-3">
            {/* ══ TAB 0 — Dependent Pay Units ══ */}
            {tab === 0 && (
              <>
                {dependDraft && (
                  <SectionPanel title="Dependent Pay Unit Details" icon={ListChecks}>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Depend To Pay Unit" required>
                        <Select
                          value={dependDraft.depend_pay_comp_type}
                          onChange={(e) => patchDepend({ depend_pay_comp_type: e.target.value })}
                        >
                          <option value="">-- Select --</option>
                          {dependUnitOptions.map((o) => (
                            <option key={o.pay_comp_id} value={o.pay_comp_id}>
                              {o.pay_comp_desc} - {o.pay_comp_short_desc}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      {(
                        [
                          ["percent", "AMT %"],
                          ["emp_percent", "Employee %"],
                        ] as const
                      ).map(([key, label]) => (
                        <Field key={key} label={label}>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            max={100}
                            className="text-right"
                            value={dependDraft[key]}
                            onChange={(e) => patchDepend({ [key]: parseFloat(e.target.value) || 0 })}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              patchDepend({ [key]: Number.isNaN(val) ? 0 : parseFloat(val.toFixed(2)) });
                            }}
                          />
                        </Field>
                      ))}

                      <Field label="Status">
                        <Select
                          value={dependDraft.status}
                          onChange={(e) => patchDepend({ status: e.target.value })}
                        >
                          <option value="">-- Select --</option>
                          {statusOptions.map((s) => (
                            <option key={s.value_code} value={s.value_code}>
                              {s.value_code} - {s.value_desc}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field label="Remarks" className="md:col-span-2">
                        <Input
                          value={dependDraft.remarks}
                          onChange={(e) => patchDepend({ remarks: e.target.value })}
                        />
                      </Field>
                    </div>

                    <div className="mt-3 flex justify-end gap-1.5">
                      <Button type="button" size="sm" variant="outline" onClick={() => setDependDraft(null)}>
                        Cancel
                      </Button>
                      {!readonly && (
                        <Button type="button" size="sm" onClick={saveDependDraft}>
                          {isEditingDepend ? "Update Row" : "Add Row"}
                        </Button>
                      )}
                    </div>
                  </SectionPanel>
                )}

                <DataTable
                  columns={dependColumns}
                  data={dependRows}
                  title={loadingRows ? "Loading" : `${dependRows.length.toLocaleString()} Dependent Pay Units`}
                  subtitle="Dependent Pay Unit Parameters"
                  loading={loadingRows}
                  emptyText={payCompId ? "No rows added" : "Select a pay unit to load its rows"}
                  height={300}
                  minWidth={900}
                  density="grid"
                  getRowId={(row) => row.id}
                  toolbar={
                    !readonly ? (
                      <AddRowButton
                        disabled={!payCompId}
                        onClick={() => setDependDraft(createEmptyDepend())}
                      />
                    ) : undefined
                  }
                />
              </>
            )}

            {/* ══ TAB 1 — Dependent Parameters ══ */}
            {tab === 1 && (
              <>
                {limitDraft && (
                  <SectionPanel title="Dependent Parameter Details" icon={Globe}>
                    <div className="grid gap-3 md:grid-cols-4">
                      <Field label="Nationality" required>
                        <Select
                          value={limitDraft.country_code}
                          onChange={(e) => {
                            const picked = countryOptions.find((o) => o.country_code === e.target.value);
                            patchLimit({
                              country_code: picked?.country_code ?? "",
                              nationality: picked?.nationality ?? "",
                            });
                          }}
                        >
                          <option value="">-- Select --</option>
                          {countryOptions.map((o) => (
                            <option key={o.country_code} value={o.country_code}>
                              {o.country_code} - {o.country_name}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field label="Age">
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          className="text-right"
                          value={limitDraft.age}
                          onChange={(e) => patchLimit({ age: parseFloat(e.target.value) || 0 })}
                        />
                      </Field>

                      <Field label="Amount">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="text-right"
                          value={limitDraft.amount}
                          onChange={(e) => patchLimit({ amount: parseFloat(e.target.value) || 0 })}
                        />
                      </Field>

                      <Field label="Status">
                        <Select value={limitDraft.status} onChange={(e) => patchLimit({ status: e.target.value })}>
                          <option value="">-- Select --</option>
                          {LIMIT_STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.value} - {o.label}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field label="Remarks" className="md:col-span-4">
                        <textarea
                          className="input"
                          rows={2}
                          value={limitDraft.remarks}
                          onChange={(e) => patchLimit({ remarks: e.target.value })}
                          style={{ resize: "vertical", fontFamily: "inherit" }}
                        />
                      </Field>
                    </div>

                    <div className="mt-3 flex justify-end gap-1.5">
                      <Button type="button" size="sm" variant="outline" onClick={() => setLimitDraft(null)}>
                        Cancel
                      </Button>
                      {!readonly && (
                        <Button type="button" size="sm" onClick={saveLimitDraft}>
                          {isEditingLimit ? "Update Row" : "Add Row"}
                        </Button>
                      )}
                    </div>
                  </SectionPanel>
                )}

                <DataTable
                  columns={limitColumns}
                  data={limitRows}
                  title={loadingRows ? "Loading" : `${limitRows.length.toLocaleString()} Parameters`}
                  subtitle="Dependent Parameters"
                  loading={loadingRows}
                  emptyText={payCompId ? "No rows added" : "Select a pay unit to load its rows"}
                  height={300}
                  minWidth={800}
                  density="grid"
                  getRowId={(row) => row.id}
                  toolbar={
                    !readonly ? (
                      <AddRowButton
                        disabled={!payCompId}
                        onClick={() => setLimitDraft(createEmptyLimit())}
                      />
                    ) : undefined
                  }
                />
              </>
            )}
          </div>
        </div>

        {/* ── Delete confirmation dialog ── */}
        <Dialog
          open={!!deleteTarget}
          title="Delete Row"
          description={
            deleteTarget
              ? deleteTarget.kind === "depend"
                ? `Delete ${dependLabel(deleteTarget.row.depend_pay_comp_type)}?`
                : `Delete ${countryLabel(deleteTarget.row.country_code)}?`
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
            This action cannot be undone. Are you sure you want to delete this row?
          </p>
        </Dialog>
      </div>
    );
  },
);

export default AddPayUnitDependentForm;