// AddHrJoiningForm.tsx
//
// HR Joining form — Freight-style:
//  • forwardRef + useImperativeHandle → parent header "Save" button calls save()
//  • SectionPanel / Field from shared Formblocks
//  • toast for validation / API feedback (no inline notice banners)
//  • No bottom Cancel/Submit row — Close / Save live in the page header

import { Briefcase, FileText, ListChecks, Plus, Trash2, X } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Field, SectionPanel } from "../../components/ui/Formblocks";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import hrJoinServiceInstance from "./insUpdHrJoinRpt";

/* ✅ Expose save() to the parent (header Save button) */
export type HrJoiningFormHandle = {
  save: () => Promise<void>;
};

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

export type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<THrJoining> | null;
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

const buildInitial = (mode: FormMode, existingData?: Partial<THrJoining> | null): THrJoining =>
  mode !== "add" && existingData
    ? {
        ...EMPTY,
        ...existingData,
        doc_date: toDate(existingData.doc_date),
        join_date: toDate(existingData.join_date),
        date_1: toDate(existingData.date_1),
      }
    : { ...EMPTY };

const makeRowId = () => `row_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const fmtAmount = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
            <X size={14} /> Cancel
          </Button>
          <Button onClick={handleAdd}>
            <Plus size={14} /> Add to List
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Pay Component" required error={errors.pay_comp_id}>
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
        </Field>
        <Field label="Amount" required error={errors.pay_comp_amt}>
          <Input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setErrors((p) => ({ ...p, pay_comp_amt: undefined }));
            }}
          />
        </Field>
      </div>
    </Dialog>
  );
}

// ── Main Form (forwardRef so parent can trigger save) ────────────────────────

export const AddHrJoiningForm = forwardRef<HrJoiningFormHandle, Props>(function AddHrJoiningForm(
  { mode, existingData, onClose },
  ref,
) {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";
  const readonly = mode === "view";
  const isEdit = mode === "edit";

  const [form, setForm] = useState<THrJoining>(() => buildInitial(mode, existingData));
  const [payComponents, setPayComponents] = useState<PayComponentRow[]>(() =>
    mode !== "add"
      ? (existingData?.payComponents || []).map((r, i) => ({
          ...r,
          _rowId: r._rowId || `existing_${i}`,
        }))
      : [],
  );
  const [errors, setErrors] = useState<{ doc_date?: string; cand_no?: string; cand_name?: string }>({});
  const [modalOpen, setModalOpen] = useState(false);

  const [divOptions, setDivOptions] = useState<DivisionOption[]>([]);
  const [desigOptions, setDesigOptions] = useState<DesigOption[]>([]);
  const [payCompOptions, setPayCompOptions] = useState<PayCompOption[]>([]);
  const [divLoading, setDivLoading] = useState(false);
  const [desigLoading, setDesigLoading] = useState(false);
  const [payCompLoading, setPayCompLoading] = useState(false);

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
    [loginid, companyCode],
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

  const text = (key: keyof THrJoining, type: "text" | "date" = "text") => ({
    type,
    disabled: readonly,
    value: String(form[key] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value),
  });

  // ── Pay component row helpers ────────────────────────────────────────────
  const handleModalAdd = (data: Omit<PayComponentRow, "_rowId">) =>
    setPayComponents((prev) => [...prev, { ...data, _rowId: makeRowId() }]);

  const handleDeleteRow = (rowId: string) =>
    setPayComponents((prev) => prev.filter((r) => r._rowId !== rowId));

  const totalAmount = payComponents.reduce((sum, r) => sum + (Number(r.pay_comp_amt) || 0), 0);

  // ── Validation ───────────────────────────────────────────────────────────
  const validate = (): string | null => {
    const next: typeof errors = {};
    if (!form.doc_date) next.doc_date = "Doc Date is required";
    if (!form.cand_no?.toString().trim()) next.cand_no = "Candidate No is required";
    if (!form.cand_name?.trim()) next.cand_name = "Candidate Name is required";
    setErrors(next);
    return Object.values(next)[0] ?? null;
  };

  // ── Save (called by the page header Save button) ─────────────────────────
  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      toast.warning(error);
      return;
    }

    try {
      await hrJoinServiceInstance.insUpdHrJoinRpt({
        header: {
          company_code: companyCode,
          doc_no: form.doc_no ? Number(form.doc_no) : undefined,
          doc_date: form.doc_date || undefined,
          doc_type: form.doc_type || "MRF", // preserve existing doc_type on edit, default only on add
          doc_ref_no: form.doc_ref_no || undefined,
          cand_no:
            form.cand_no !== undefined && form.cand_no !== "" ? String(form.cand_no) : undefined,
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
      toast.success(isEdit ? "Joining updated successfully" : "Joining saved successfully");
      onClose(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save joining record");
    }
  };

  /* ✅ Expose save() to parent */
  useImperativeHandle(ref, () => ({
    save: handleSubmit,
  }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
      <SectionPanel title="Document Information" icon={FileText}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Doc No">
            <Input disabled value={String(form.doc_no ?? "Autogenerated")} />
          </Field>
          <Field label="Doc Date" required error={errors.doc_date}>
            <Input {...text("doc_date", "date")} />
          </Field>
          <Field label="Ref No">
            <Input {...text("doc_ref_no")} />
          </Field>
          <Field label="Candidate No" required error={errors.cand_no}>
            <Input {...text("cand_no")} />
          </Field>
          <Field label="Candidate Name" required error={errors.cand_name} className="md:col-span-2">
            <Input {...text("cand_name")} />
          </Field>
        </div>
      </SectionPanel>

      <SectionPanel title="Employment & Bank Details" icon={Briefcase}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Division">
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
          </Field>
          <Field label="Designation">
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
          </Field>
          <Field label="Joining Date">
            <Input {...text("join_date", "date")} />
          </Field>
          <Field label="Bank">
            <Input {...text("bank")} />
          </Field>

          <Field label="Branch">
            <Input {...text("branch")} />
          </Field>
          <Field label="Account Number">
            <Input {...text("bank_acct_number")} />
          </Field>
          <Field label="Signature (HR/Admin)">
            <Input {...text("sign_1")} />
          </Field>
          <Field label="Approval Date">
            <Input {...text("date_1", "date")} />
          </Field>
        </div>
      </SectionPanel>

      <SectionPanel title={`Pay Components (${payComponents.length})`} icon={ListChecks}>
        <div className="grid gap-2">
          {!readonly && (
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={() => setModalOpen(true)}>
                <Plus size={12} /> Add Row
              </Button>
            </div>
          )}

          <div className="overflow-auto rounded-md border">
            <table className="w-full min-w-[600px] text-[12px]">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="px-2 py-2 text-left w-16">#</th>
                  <th className="px-2 py-2 text-left w-40">ID</th>
                  <th className="px-2 py-2 text-left">Pay Component</th>
                  <th className="px-2 py-2 text-right w-44">Amount</th>
                  {!readonly && <th className="px-2 py-2 text-left w-16">Action</th>}
                </tr>
              </thead>
              <tbody>
                {payComponents.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-muted-foreground"
                      colSpan={readonly ? 4 : 5}
                    >
                      {readonly ? "No components" : "No components — click Add Row"}
                    </td>
                  </tr>
                ) : (
                  payComponents.map((row, index) => (
                    <tr className="border-t" key={row._rowId}>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">{index + 1}</td>
                      <td className="px-2 py-1.5">{row.pay_comp_id}</td>
                      <td className="px-2 py-1.5">{row.pay_comp_desc}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmtAmount(Number(row.pay_comp_amt))}
                      </td>
                      {!readonly && (
                        <td className="px-2 py-1">
                          <button
                            type="button"
                            title="Remove row"
                            onClick={() => handleDeleteRow(row._rowId)}
                            className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {payComponents.length > 0 && (
                <tfoot className="border-t bg-secondary/40">
                  <tr>
                    <td className="px-2 py-2 text-right font-medium" colSpan={3}>
                      Total Amount
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-primary tabular-nums">
                      {fmtAmount(totalAmount)}
                    </td>
                    {!readonly && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </SectionPanel>

      {/* ── Add Pay Component Modal ── */}
      <AddPayComponentModal
        open={modalOpen}
        options={payCompOptions}
        loading={payCompLoading}
        onClose={() => setModalOpen(false)}
        onAdd={handleModalAdd}
      />
    </div>
  );
});