import {
  forwardRef, useImperativeHandle, useRef, useState, type ChangeEvent, type ReactNode,
} from "react";
import { FileText, FileX2, IdCard, Receipt, Save, User } from "lucide-react";
import { Input } from "../../components/ui/Input";
import { ParamLookup } from "../../components/ui/HrLookups";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";
import { fromInputDate, toInputDatenull } from "../../hooks/apiDate";
// TODO: confirm these API names/paths with your backend module
// import { getVisaLabourCancelDetails, insUpdVisaLabourCancel } from "../../api/hr";

/* ================= TYPES ================= */

export type VisaLabourCancelFormHandle = {
  save: () => Promise<void>;
};

type Props = {
  onSaved?: () => void;
};

export type TSettlementRow = {
  doc_no: string;
  doc_date: Date | null;
  join_date: Date | null;
  separation_date: Date | null;
  accrual_type: string;
  settlement_units: number | null;
  settlement_amount: number | null;
  settled_status: string;
};

export type TVisaLabourCancel = {
  company_code: string;
  div_code: string;
  dept_code: string;
  section_code: string;
  employee_code: string;
  employee_name: string;

  /* Labour card */
  labourcard_no: string;
  labourcard_status: string;
  labourcard_valid_from: Date | null;
  labourcard_valid_to: Date | null;
  labourcard_cancelled: string; // "Y" | "N" | ""
  labourcard_cancel_date: Date | null;
  labourcard_remarks: string;

  /* Pasi / Visa */
  visa_type: string;
  visa_valid_from: Date | null;
  visa_valid_to: Date | null;
  visa_cancelled: string; // "Y" | "N" | ""
  visa_cancel_date: Date | null;
  visa_cancel_ref_no: string;
  visa_remarks: string;
};

type K = keyof TVisaLabourCancel;

/* ================= HELPERS ================= */

const CTL = "h-7 text-xs";
const nil = null as never;

const SELECT_CLS =
  "h-7 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60";
const TEXTAREA_CLS =
  "min-h-[90px] w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60";

const buildInitial = (companyCode: string): TVisaLabourCancel => ({
  company_code: companyCode, div_code: "", dept_code: "", section_code: "",
  employee_code: "", employee_name: "",
  labourcard_no: "", labourcard_status: "", labourcard_valid_from: nil, labourcard_valid_to: nil,
  labourcard_cancelled: "", labourcard_cancel_date: nil, labourcard_remarks: "",
  visa_type: "", visa_valid_from: nil, visa_valid_to: nil,
  visa_cancelled: "", visa_cancel_date: nil, visa_cancel_ref_no: "", visa_remarks: "",
});

const REQUIRED: [K, string][] = [
  ["div_code", "Division"], ["dept_code", "Department"], ["section_code", "Section"],
  ["employee_code", "Employee"],
  ["labourcard_no", "Labour Card No."], ["labourcard_status", "Status"],
  ["labourcard_valid_from", "Valid From"], ["labourcard_valid_to", "Valid To"],
  ["visa_type", "Pasi / Visa Type"], ["visa_valid_from", "Valid From"], ["visa_valid_to", "Valid To"],
];

const DATE_RANGES: [K, K][] = [
  ["labourcard_valid_from", "labourcard_valid_to"],
  ["visa_valid_from", "visa_valid_to"],
];

const validate = (v: TVisaLabourCancel): Partial<Record<K, string>> => {
  const errors: Partial<Record<K, string>> = {};
  REQUIRED.forEach(([k]) => {
    if (v[k] === null || v[k] === undefined || v[k] === "") errors[k] = "Required";
  });
  DATE_RANGES.forEach(([from, to]) => {
    if (v[from] && v[to] && new Date(v[to] as Date) < new Date(v[from] as Date)) {
      errors[to] = "Must be after start date";
    }
  });
  if (v.labourcard_cancelled === "Y" && !v.labourcard_cancel_date) {
    errors.labourcard_cancel_date = "Required";
  }
  if (v.visa_cancelled === "Y" && !v.visa_cancel_date) {
    errors.visa_cancel_date = "Required";
  }
  return errors;
};

const fmtDate = (d: Date | null | undefined) => {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime()) || dt.getTime() === 0) return "";
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
};

/* ─────────────── UI building blocks ─────────────── */

function HeaderBlock({
  label,
  icon,
  children,
  gridCols = "grid-cols-2",
  bodyClass,
  className = "",
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  gridCols?: string;
  bodyClass?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-md border border-[#cbd5e1] bg-card ${className}`}>
      <div className="flex items-center gap-2 border-b border-[#cbd5e1] bg-slate-50 px-2.5 py-1">
        <span className="grid h-5 w-5 place-items-center rounded bg-[#00378C] text-white">
          {icon}
        </span>
        <span className="text-xs font-bold text-[#00378C]">{label}</span>
      </div>
      <div
        className={
          bodyClass ?? `grid gap-x-2 gap-y-1.5 px-2.5 py-2 ${gridCols} max-md:grid-cols-1`
        }
      >
        {children}
      </div>
    </div>
  );
}

function CField({
  label,
  required,
  error,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-0.5 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      {children}
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </label>
  );
}

/* ================= FORM ================= */

export const VisaLabourCardCancelForm = forwardRef<VisaLabourCancelFormHandle, Props>(
  function VisaLabourCardCancelForm({ onSaved }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();

    const [form, setForm] = useState<TVisaLabourCancel>(() =>
      buildInitial(user?.company_code ?? "BSG"),
    );
    const [errors, setErrors] = useState<Partial<Record<K, string>>>({});
    const [settlements, setSettlements] = useState<TSettlementRow[]>([]);

    const patch = (p: Partial<TVisaLabourCancel>) => {
      setForm((prev) => ({ ...prev, ...p }));
      setErrors((prev) => {
        const next = { ...prev };
        (Object.keys(p) as K[]).forEach((k) => delete next[k]);
        return next;
      });
    };
    const set = (name: K, value: unknown) => patch({ [name]: value } as Partial<TVisaLabourCancel>);
    const pick = (name: K) => (v: string) => set(name, v);

    const text = (name: K) => ({
      value: (form[name] as string | null) ?? "",
      onChange: (e: ChangeEvent<HTMLInputElement>) => set(name, e.target.value),
    });
    const date = (name: K) => ({
      type: "date" as const,
      value: toInputDatenull(form[name] as Date | null),
      onChange: (e: ChangeEvent<HTMLInputElement>) => set(name, fromInputDate(e.target.value)),
    });

    /* Load labour card / visa / settlement data when an employee is picked */
    const handleEmployeeChange = async (code: string) => {
      patch({ employee_code: code });
      if (!code) {
        setSettlements([]);
        return;
      }
      try {
        // const res = await getVisaLabourCancelDetails(code);
        const res: any = null; // TODO: replace with the API call above
        console.log("getVisaLabourCancelDetails would be called for employee:", code);
        if (res) {
          const { settlements: rows, ...details } = res as Partial<TVisaLabourCancel> & {
            settlements?: TSettlementRow[];
          };
          patch(details);
          setSettlements(rows ?? []);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load employee details");
      }
    };

    const handleSave = async () => {
      const found = validate(form);
      setErrors(found);
      if (Object.keys(found).length) {
        toast.warning("Please fill all required fields");
        return;
      }
      try {
        // const response = await insUpdVisaLabourCancel(form);
        const response: any = true; // TODO: replace with the API call above
        console.log("insUpdVisaLabourCancel payload", form);
        if (response) {
          toast.success("Visa and labour card cancelled successfully");
          onSaved?.();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save cancellation");
      }
    };

    useImperativeHandle(ref, () => ({ save: handleSave }));

    const lcCancelled = form.labourcard_cancelled === "Y";
    const visaCancelled = form.visa_cancelled === "Y";

    return (
      <div style={{ zoom: 0.8 }} className="freight-workspace-ui freight-dense-form freight-ui-standard grid items-start gap-1.5">

        {/* ══════════ EMPLOYEE DETAILS ══════════ */}
        <HeaderBlock
          label="Employee Information"
          icon={<User size={11} />}
          bodyClass="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2 p-2"
        >
          <CField label="Company">
            <Input className={CTL} value={form.company_code} disabled readOnly />
          </CField>
          <CField label="Division" required error={errors.div_code}>
            <ParamLookup
              parameter="HR_DROPDOWN_MS_DIVISION" valueField="div_code" descField="div_name" descHeader="Division"
              value={form.div_code}
              onChange={(v: any) => patch({ div_code: v, dept_code: "", section_code: "", employee_code: "" })}
            />
          </CField>
          <CField label="Department" required error={errors.dept_code}>
            <ParamLookup
              key={form.div_code} parameter="HR_DROPDOWN_MS_DEPARTMENT" code2={form.div_code ?? ""}
              valueField="dept_code" descField="dept_name" descHeader="Department"
              value={form.dept_code} disabled={!form.div_code}
              onChange={(v: any) => patch({ dept_code: v, section_code: "", employee_code: "" })}
            />
          </CField>
          <CField label="Section" required error={errors.section_code}>
            <ParamLookup
              key={form.dept_code} parameter="HR_DROPDOWN_MS_SECTION" code2={form.div_code ?? ""} code3={form.dept_code ?? ""}
              valueField="section_code" descField="section_name" descHeader="Section"
              value={form.section_code} disabled={!form.dept_code}
              onChange={(v: any) => patch({ section_code: v, employee_code: "" })}
            />
          </CField>
          <CField label="Employee" required error={errors.employee_code} className="sm:col-span-2">
            <ParamLookup
              key={`${form.dept_code}-${form.section_code}`} parameter="HR_DROPDOWN_MS_EMPLOYEE"
              code2={form.div_code ?? ""} code3={form.dept_code ?? ""}
              valueField="employee_code" descField="rpt_name" descHeader="Employee"
              value={form.employee_code} disabled={!form.section_code}
              onChange={handleEmployeeChange}
            />
          </CField>
        </HeaderBlock>

        {/* ══════════ LABOUR CARD + PASI / VISA ══════════ */}
        <div className="grid items-start gap-1.5 xl:grid-cols-2">

          {/* Labour Card */}
          <HeaderBlock label="Labour Card" icon={<IdCard size={11} />} gridCols="grid-cols-1 sm:grid-cols-2">
            <CField label="Labour Card No." required error={errors.labourcard_no}>
              <Input className={CTL} {...text("labourcard_no")} />
            </CField>
            <CField label="Status" required error={errors.labourcard_status}>
              <ParamLookup
                parameter="MS_EMP_HR_LABOUR_CARD_STATUS" valueField="value_code" descField="value_desc"
                value={form.labourcard_status} onChange={pick("labourcard_status")}
              />
            </CField>
            <CField label="Valid From" required error={errors.labourcard_valid_from}>
              <Input className={CTL} {...date("labourcard_valid_from")} />
            </CField>
            <CField label="Valid To" required error={errors.labourcard_valid_to}>
              <Input
                className={CTL} {...date("labourcard_valid_to")}
                min={toInputDatenull(form.labourcard_valid_from)} disabled={!form.labourcard_valid_from}
              />
            </CField>
            <CField label="Labour Card Cancelled">
              <select
                className={SELECT_CLS} value={form.labourcard_cancelled}
                onChange={(e) =>
                  patch({
                    labourcard_cancelled: e.target.value,
                    ...(e.target.value !== "Y" ? { labourcard_cancel_date: nil } : {}),
                  })
                }
              >
                <option value="">Select</option>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </select>
            </CField>
            <CField label="Cancel Date" required={lcCancelled} error={errors.labourcard_cancel_date}>
              <Input className={CTL} {...date("labourcard_cancel_date")} disabled={!lcCancelled} />
            </CField>
            <CField label="Remarks" className="sm:col-span-2">
              <textarea
                className={TEXTAREA_CLS} value={form.labourcard_remarks}
                onChange={(e) => set("labourcard_remarks", e.target.value)}
              />
            </CField>
          </HeaderBlock>

          {/* Pasi / Visa */}
          <HeaderBlock label="Pasi / Visa" icon={<FileText size={11} />} gridCols="grid-cols-1 sm:grid-cols-2">
            <CField label="Pasi / Visa Type" required error={errors.visa_type} className="sm:col-span-2">
              <ParamLookup
                parameter="MS_EMP_HR_VISA_TYPE" valueField="value_code" descField="value_desc"
                value={form.visa_type} onChange={pick("visa_type")}
              />
            </CField>
            <CField label="Valid From" required error={errors.visa_valid_from}>
              <Input className={CTL} {...date("visa_valid_from")} />
            </CField>
            <CField label="Valid To" required error={errors.visa_valid_to}>
              <Input
                className={CTL} {...date("visa_valid_to")}
                min={toInputDatenull(form.visa_valid_from)} disabled={!form.visa_valid_from}
              />
            </CField>
            <CField label="Pasi / Visa Cancelled">
              <select
                className={SELECT_CLS} value={form.visa_cancelled}
                onChange={(e) =>
                  patch({
                    visa_cancelled: e.target.value,
                    ...(e.target.value !== "Y" ? { visa_cancel_date: nil } : {}),
                  })
                }
              >
                <option value="">Select</option>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </select>
            </CField>
            <CField label="Cancel Date" required={visaCancelled} error={errors.visa_cancel_date}>
              <Input className={CTL} {...date("visa_cancel_date")} disabled={!visaCancelled} />
            </CField>
            <CField label="Cancel Ref. No." className="sm:col-span-2">
              <Input className={CTL} {...text("visa_cancel_ref_no")} disabled={!visaCancelled} />
            </CField>
            <CField label="Remarks" className="sm:col-span-2">
              <textarea
                className={TEXTAREA_CLS} value={form.visa_remarks}
                onChange={(e) => set("visa_remarks", e.target.value)}
              />
            </CField>
          </HeaderBlock>
        </div>

        {/* ══════════ EMPLOYEE FINAL SETTLEMENT ══════════ */}
        <HeaderBlock
          label="Employee Final Settlement"
          icon={<Receipt size={11} />}
          bodyClass="overflow-x-auto p-0"
        >
          <table className="w-full min-w-[820px] border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-left">
                {["Doc No", "Doc Date", "Join Date", "Separation Date", "Accrual Type", "Settlement Units", "Settlement Amount", "Settled Status"].map((h) => (
                  <th
                    key={h}
                    className="border-b border-r border-[#cbd5e1] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 last:border-r-0"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-xs text-muted-foreground">
                    {form.employee_code ? "No settlement records found" : "Select an employee to view final settlement"}
                  </td>
                </tr>
              ) : (
                settlements.map((r, i) => (
                  <tr key={`${r.doc_no}-${i}`} className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-slate-50">
                    <td className="px-2 py-1">{r.doc_no}</td>
                    <td className="px-2 py-1">{fmtDate(r.doc_date)}</td>
                    <td className="px-2 py-1">{fmtDate(r.join_date)}</td>
                    <td className="px-2 py-1">{fmtDate(r.separation_date)}</td>
                    <td className="px-2 py-1">{r.accrual_type}</td>
                    <td className="px-2 py-1 text-right">{r.settlement_units ?? ""}</td>
                    <td className="px-2 py-1 text-right">{r.settlement_amount ?? ""}</td>
                    <td className="px-2 py-1">{r.settled_status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </HeaderBlock>
      </div>
    );
  },
);

/* ================= PAGE (default export — used by workspaceRoutes) ================= */

export default function VisaLabourCardCancelPage() {
  const formRef = useRef<VisaLabourCancelFormHandle>(null);
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await formRef.current?.save();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-2 p-2">
      <div className="flex items-center justify-between rounded-md border border-[#cbd5e1] bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded bg-[#00378C] text-white">
            <FileX2 size={15} />
          </span>
          <h1 className="text-base font-bold text-foreground">Visa and Labour Card Cancel</h1>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-[#00378C] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={15} />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* key remount clears the form after a successful save */}
      <VisaLabourCardCancelForm
        key={formKey}
        ref={formRef}
        onSaved={() => setFormKey((k) => k + 1)}
      />
    </div>
  );
}