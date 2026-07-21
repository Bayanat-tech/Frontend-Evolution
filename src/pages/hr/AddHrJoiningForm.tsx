import { MdAddCircleOutline } from "react-icons/md";
import { Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDynamicLookup, LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { useAuth } from "../../state/AuthContext";
import hrJoinServiceInstance from "./insUpdHrJoinRpt";
import type { ColumnDef } from "@tanstack/react-table";

// ── Types ────────────────────────────────────────────────────────────────────

export type PayComponentRow = {
  _rowId: string;
  pay_comp_id: string;
  pay_comp_desc: string;
  pay_comp_amt: number;
};

export type THrJoining = {
  doc_no?: number | string;
  doc_type?: string;
  doc_date?: string;
  doc_ref_no?: string;
  cand_no?: string | number;
  cand_name?: string;
  division?: string;
  desig?: string;
  join_date?: string;
  bank?: string;
  branch?: string;
  bank_acct_number?: string;
  sign_1?: string;
  date_1?: string;
  payComponents?: PayComponentRow[];
};

type Props = {
  mode: "add" | "edit" | "view";
  existingData?: Partial<THrJoining>;
  onClose: (shouldRefetch?: boolean) => void;
};

type DivisionOption = { div_code: string; div_name: string };
type DesigOption = { desg_code: string; desg_name: string };
type PayCompOption = { pay_comp_id: string; pay_comp_desc: string; pay_comp_short_desc?: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDate(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value).trim());
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

const EMPTY: THrJoining = {
  doc_no: undefined,
  doc_type: "MRF",
  doc_date: "",
  doc_ref_no: "",
  cand_no: "",
  cand_name: "",
  division: "",
  desig: "",
  join_date: "",
  bank: "",
  branch: "",
  bank_acct_number: "",
  sign_1: "",
  date_1: "",
  payComponents: [],
};

// ── Add Pay Component Modal ───────────────────────────────────────────────────

function AddPayComponentModal({
  open,
  options,
  loading,
  onClose,
  onAdd,
}: {
  open: boolean;
  options: PayCompOption[];
  loading: boolean;
  onClose: () => void;
  onAdd: (row: Omit<PayComponentRow, "_rowId">) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<{ pay_comp_id?: string; pay_comp_amt?: string }>({});

  useEffect(() => {
    if (open) {
      setSelectedId("");
      setAmount("");
      setErrors({});
    }
  }, [open]);

  const validate = () => {
    const errs: typeof errors = {};
    if (!selectedId) errs.pay_comp_id = "Please select a pay component";
    if (!amount || isNaN(Number(amount)) || Number(amount) < 0)
      errs.pay_comp_amt = "Please enter a valid amount";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAdd = () => {
    if (!validate()) return;
    const opt = options.find((o) => o.pay_comp_id === selectedId)!;
    onAdd({
      pay_comp_id: opt.pay_comp_id,
      pay_comp_desc: opt.pay_comp_desc,
      pay_comp_amt: Number(amount),
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      title="Add Pay Component"
      compact
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            <X size={15} /> Cancel
          </Button>
          <Button onClick={handleAdd}>
            <MdAddCircleOutline size={15} /> Add to List
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <label className="field">
          <span>
            Pay Component <strong className="text-destructive">*</strong>
          </span>
          <Select
            value={selectedId}
            disabled={loading}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setErrors((p) => ({ ...p, pay_comp_id: undefined }));
            }}
          >
            <option value="">{loading ? "Loading..." : "Select pay component"}</option>
            {options.map((opt) => (
              <option key={opt.pay_comp_id} value={opt.pay_comp_id}>
                {opt.pay_comp_desc} ({opt.pay_comp_id})
              </option>
            ))}
          </Select>
          {errors.pay_comp_id && (
            <span className="text-destructive text-xs mt-0.5">{errors.pay_comp_id}</span>
          )}
        </label>
        <label className="field">
          <span>
            Amount <strong className="text-destructive">*</strong>
          </span>
          <Input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setErrors((p) => ({ ...p, pay_comp_amt: undefined }));
            }}
          />
          {errors.pay_comp_amt && (
            <span className="text-destructive text-xs mt-0.5">{errors.pay_comp_amt}</span>
          )}
        </label>
      </div>
    </Dialog>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────────

export function AddHrJoiningForm({ mode, existingData, onClose }: Props) {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";
  const readonly = mode === "view";
  const isEdit = mode === "edit";

  const [form, setForm] = useState<THrJoining>({ ...EMPTY });
  const [payComponents, setPayComponents] = useState<PayComponentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const [divOptions, setDivOptions] = useState<DivisionOption[]>([]);
  const [desigOptions, setDesigOptions] = useState<DesigOption[]>([]);
  const [payCompOptions, setPayCompOptions] = useState<PayCompOption[]>([]);
  const [divLoading, setDivLoading] = useState(false);
  const [desigLoading, setDesigLoading] = useState(false);
  const [payCompLoading, setPayCompLoading] = useState(false);

  // ── Load form data on edit/view ──────────────────────────────────────────
  useEffect(() => {
    if ((isEdit || readonly) && existingData) {
      setForm({
        ...EMPTY,
        ...existingData,
        doc_date: toDate(existingData.doc_date),
        join_date: toDate(existingData.join_date),
        date_1: toDate(existingData.date_1),
      });
      setPayComponents(
        (existingData.payComponents || []).map((r, i) => ({
          ...r,
          _rowId: r._rowId || `existing_${i}`,
        }))
      );
    }
  }, [isEdit, readonly, existingData]);

  // ── Load dropdowns ───────────────────────────────────────────────────────
  const baseParams = useCallback(
    (parameter: string, code2 = "") => ({
      parameter,
      loginid,
      code1: companyCode,
      code2,
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
    }),
    [loginid, companyCode]
  );

  useEffect(() => {
    const fetchAll = async () => {
      setDivLoading(true);
      setDesigLoading(true);
      setPayCompLoading(true);
      try {
        const [divs, desigs, payComps] = await Promise.all([
          getDynamicLookup(baseParams("AC_ASSETS_DEPRECIATION_DIVISION_LIST")),
          getDynamicLookup(baseParams("MST_HR_MS_HR_DESIGNATION_LIST")),
          getDynamicLookup(baseParams("PAY_COMPONENT_PAYUNIT_DependPayUnit")),
        ]);
        setDivOptions(divs as DivisionOption[]);
        setDesigOptions(desigs as DesigOption[]);
        setPayCompOptions(payComps as PayCompOption[]);
      } catch {
        // silent — dropdowns degrade gracefully
      } finally {
        setDivLoading(false);
        setDesigLoading(false);
        setPayCompLoading(false);
      }
    };
    void fetchAll();
  }, [baseParams]);

  const set = (field: keyof THrJoining, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Pay component row helpers ────────────────────────────────────────────
  const makeRowId = () => `row_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const handleModalAdd = (data: Omit<PayComponentRow, "_rowId">) =>
    setPayComponents((prev) => [...prev, { ...data, _rowId: makeRowId() }]);

  const handleDeleteRow = (rowId: string) =>
    setPayComponents((prev) => prev.filter((r) => r._rowId !== rowId));

  const totalAmount = payComponents.reduce((sum, r) => sum + (Number(r.pay_comp_amt) || 0), 0);

  // ── Pay component columns ────────────────────────────────────────────────
  const payCompColumns = useMemo<ColumnDef<PayComponentRow>[]>(
    () => [
      {
        id: "index",
        header: "#",
        size: 55,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.index + 1}</span>
        ),
      },
      { accessorKey: "pay_comp_id", header: "ID", size: 120 },
      { accessorKey: "pay_comp_desc", header: "Pay Component", size: 260 },
      {
        accessorKey: "pay_comp_amt",
        header: "Amount",
        size: 140,
        cell: ({ getValue }) =>
          Number(getValue<number>()).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
      },
      ...(readonly
        ? []
        : [
            {
              id: "remove",
              header: "",
              size: 60,
              enableColumnFilter: false,
              cell: ({ row }: { row: { original: PayComponentRow } }) => (
                <Button
                  size="icon"
                  variant="ghost"
                  title="Remove"
                  onClick={() => handleDeleteRow(row.original._rowId)}
                >
                  <Trash2 size={14} />
                </Button>
              ),
            } as ColumnDef<PayComponentRow>,
          ]),
    ],
    [readonly, handleDeleteRow]
  );

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.doc_date) { setApiError("Doc Date is required"); return; }
    if (!form.cand_no?.toString().trim()) { setApiError("Candidate No is required"); return; }
    if (!form.cand_name?.trim()) { setApiError("Candidate Name is required"); return; }

    setSaving(true);
    setApiError("");
    try {
      await hrJoinServiceInstance.insUpdHrJoinRpt({
        header: {
          company_code: companyCode,
          doc_no: form.doc_no ? Number(form.doc_no) : undefined,
          doc_date: form.doc_date || undefined,
          doc_type: form.doc_type || "MRF", // ★ FIXED — preserve existing doc_type on edit, default only on add
          doc_ref_no: form.doc_ref_no || undefined,
          cand_no: form.cand_no !== undefined && form.cand_no !== ""
            ? String(form.cand_no)
            : undefined,
          cand_name: form.cand_name || undefined,
          division: form.division || undefined,
          desig: form.desig || undefined,
          join_date: form.join_date || undefined,
          bank: form.bank || undefined,
          branch: form.branch || undefined,
          bank_acct_number: form.bank_acct_number || undefined,
          sign_1: form.sign_1 || undefined,
          date_1: form.date_1 || undefined,
          user_id: loginid,
        },
        details: payComponents.map((r) => ({
          pay_comp_id: r.pay_comp_id,
          pay_comp_amt: Number(r.pay_comp_amt) || 0,
          company_code: companyCode,
          user_id: loginid,
        })),
        loginid,
      });
      onClose(true);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Unable to save joining record"
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-4 overflow-hidden">
      <NoticeToast
        notice={apiError ? { type: "error", message: apiError } : null}
        onClose={() => setApiError("")}
      />

      {/* ── Document ────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <label className="field">
            <span>Doc No</span>
            <Input disabled value={form.doc_no ?? "Autogenerated"} />
          </label>
          <label className="field">
            <span>
              Doc Date <strong className="text-destructive">*</strong>
            </span>
            <Input
              type="date"
              disabled={readonly}
              value={form.doc_date ?? ""}
              onChange={(e) => set("doc_date", e.target.value)}
            />
          </label>
          <label className="field">
            <span>Ref No</span>
            <Input
              disabled={readonly}
              value={form.doc_ref_no ?? ""}
              onChange={(e) => set("doc_ref_no", e.target.value)}
            />
          </label>
          <label className="field">
            <span>
              Candidate No <strong className="text-destructive">*</strong>
            </span>
            <Input
              disabled={readonly}
              value={form.cand_no ?? ""}
              onChange={(e) => set("cand_no", e.target.value)}
            />
          </label>
          <label className="field">
            <span>
              Candidate Name <strong className="text-destructive">*</strong>
            </span>
            <Input
              disabled={readonly}
              value={form.cand_name ?? ""}
              onChange={(e) => set("cand_name", e.target.value)}
            />
          </label>
        </CardContent>

        <CardContent className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <label className="field">
            <span>Division</span>
            <Select
              disabled={readonly || divLoading}
              value={form.division ?? ""}
              onChange={(e) => set("division", e.target.value)}
            >
              <option value="">{divLoading ? "Loading..." : "Select Division"}</option>
              {divOptions.map((d) => (
                <option key={d.div_code} value={d.div_code}>
                  {d.div_name}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            <span>Designation</span>
            <Select
              disabled={readonly || desigLoading}
              value={form.desig ?? ""}
              onChange={(e) => set("desig", e.target.value)}
            >
              <option value="">{desigLoading ? "Loading..." : "Select Designation"}</option>
              {desigOptions.map((d) => (
                <option key={d.desg_code} value={d.desg_code}>
                  {d.desg_name}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            <span>Joining Date</span>
            <Input
              type="date"
              disabled={readonly}
              value={form.join_date ?? ""}
              onChange={(e) => set("join_date", e.target.value)}
            />
          </label>
          <label className="field">
            <span>Bank</span>
            <Input
              disabled={readonly}
              value={form.bank ?? ""}
              onChange={(e) => set("bank", e.target.value)}
            />
          </label>
        </CardContent>

        <CardContent className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <label className="field">
            <span>Branch</span>
            <Input
              disabled={readonly}
              value={form.branch ?? ""}
              onChange={(e) => set("branch", e.target.value)}
            />
          </label>
          <label className="field">
            <span>Account Number</span>
            <Input
              disabled={readonly}
              value={form.bank_acct_number ?? ""}
              onChange={(e) => set("bank_acct_number", e.target.value)}
            />
          </label>
          <label className="field">
            <span>Signature (HR/Admin)</span>
            <Input
              disabled={readonly}
              value={form.sign_1 ?? ""}
              onChange={(e) => set("sign_1", e.target.value)}
            />
          </label>
          <label className="field">
            <span>Approval Date</span>
            <Input
              type="date"
              disabled={readonly}
              value={form.date_1 ?? ""}
              onChange={(e) => set("date_1", e.target.value)}
            />
          </label>
        </CardContent>
      </Card>

      {/* ── Pay Components ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <h2 className="m-0 text-sm font-semibold">
                Pay Components
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({payComponents.length} row{payComponents.length !== 1 ? "s" : ""})
                </span>
              </h2>
            </div>
            {!readonly && (
              <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
                <MdAddCircleOutline size={15} /> Add Row
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-2">
          <DataTable
            columns={payCompColumns}
            data={payComponents}
            title={`${payComponents.length} Components`}
            subtitle=""
            height={220}
            minWidth={600}
            density="grid"
            enablePagination={false}
            getRowId={(row) => row._rowId}
          />
          {payComponents.length > 0 && (
            <div className="flex justify-end pr-1 pt-1">
              <span className="text-xs text-muted-foreground mr-2">Total Amount:</span>
              <span className="text-sm font-bold text-primary">
                {totalAmount.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onClose(false)}>
          <X size={15} /> {readonly ? "Close" : "Cancel"}
        </Button>
        {!readonly && (
          <Button disabled={saving} onClick={handleSubmit}>
            <Save size={15} /> {saving ? "Saving..." : isEdit ? "Update" : "Submit"}
          </Button>
        )}
      </div>

      {/* ── Add Pay Component Modal ──────────────────────────────────────── */}
      <AddPayComponentModal
        open={modalOpen}
        options={payCompOptions}
        loading={payCompLoading}
        onClose={() => setModalOpen(false)}
        onAdd={handleModalAdd}
      />
    </div>
  );
}