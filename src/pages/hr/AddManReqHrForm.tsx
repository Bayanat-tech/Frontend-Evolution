import {
  forwardRef, useImperativeHandle, useState,
  type ChangeEvent, type ReactNode,
} from "react";
import {
  Award, Briefcase, ClipboardList, Copy, FileText, MessageSquare, PenLine, Search, Wallet,
} from "lucide-react";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";
import { insUpdHrManReq } from "../../api/hr";
import { fromInputDate, toInputDatenull } from "../../hooks/apiDate";
import { TManReqHr } from "./ManReqMasterPage";
import { ParamLookup } from "../../components/ui/HrLookups";

/* ================= TYPES ================= */

export type ManReqFormHandle = { save: () => Promise<boolean | void> };
export type SavedManReq = { doc_no?: number };

type Props = {
  isEditMode: boolean;
  existingData?: TManReqHr;
  onSaved: (saved: SavedManReq) => void;
};

type TForm = {
  company_code: string;
  doc_type: string;
  doc_no: number | null;
  doc_ref_no: string;
  pos_title: string;
  no_of_pos: number | null;
  reports_to: string;
  dept: string;
  req_date: Date | null;
  dept_mgr: string;
  total_exp: number | null;
  rev_exp: number | null;
  qual: string;
  sal_range_frm: number | null;
  sal_range_to: number | null;
  req_skills: string;
  sec_skills: string;
  role_desc: string;
  req_reason: string;
  disqual: string;
  tgt_company: string;
  other_info: string;
  sign_1: string;
  sign_2: string;
  sign_3: string;
  sign_4: string;
  comments: string;
  user_id: string;
  user_dt: Date | null;
  doc_date: Date | null;
};
type K = keyof TForm;

/* ================= HELPERS ================= */

const CTL = "h-7 text-xs";
const TA =
  "w-full resize-y rounded-md border border-input bg-background px-2 py-1 text-xs min-h-[56px] " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const buildInitial = (companyCode: string, loginid: string): TForm => ({
  company_code: companyCode,
  doc_type: "",
  doc_no: null,
  doc_ref_no: "",
  pos_title: "",
  no_of_pos: null,
  reports_to: "",
  dept: "",
  req_date: null,
  dept_mgr: "",
  total_exp: null,
  rev_exp: null,
  qual: "",
  sal_range_frm: null,
  sal_range_to: null,
  req_skills: "",
  sec_skills: "",
  role_desc: "",
  req_reason: "",
  disqual: "",
  tgt_company: "",
  other_info: "",
  sign_1: "",
  sign_2: "",
  sign_3: "",
  sign_4: "",
  comments: "",
  user_id: loginid,
  user_dt: null,
  doc_date: new Date(),
});

const mergeExisting = (base: TForm, existing?: TManReqHr): TForm => {
  if (!existing) return base;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    const v = (existing as Record<string, unknown>)[key];
    if (v === undefined) continue;
    out[key] = v instanceof Date && v.getTime() === 0 ? null : v;
  }
  return out as TForm;
};

const validate = (v: TForm): Partial<Record<K, string>> => {
  const errors: Partial<Record<K, string>> = {};
  if (!v.pos_title) errors.pos_title = "Required";
  if (!v.dept) errors.dept = "Required";
  if (!v.req_date) errors.req_date = "Required";
  if (v.sal_range_frm != null && v.sal_range_to != null && v.sal_range_to < v.sal_range_frm) {
    errors.sal_range_to = "Must be >= From";
  }
  return errors;
};

const extractSaved = (res: unknown): SavedManReq => {
  const r = res as any;
  const candidates = [r, r?.data, r?.data?.[0], r?.data?.data, r?.[0], r?.result, r?.result?.[0]];
  const out: SavedManReq = {};
  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    for (const [key, val] of Object.entries(c as Record<string, unknown>)) {
      if (val == null || val === "" || typeof val === "object") continue;
      const k = key.toLowerCase();
      if (!out.doc_no && (k === "doc_no" || k === "docno" || k === "document_no")) {
        out.doc_no = Number(val);
      }
    }
  }
  return out;
};

/* ─────────────── UI building blocks ─────────────── */

function HeaderBlock({
  label,
  icon,
  action,
  children,
  gridCols = "grid-cols-2",
  bodyClass,
  className = "",
}: {
  label: string;
  icon: ReactNode;
  action?: ReactNode;
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
        {action && <div className="ml-auto">{action}</div>}
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

export const AddManReqHrForm = forwardRef<ManReqFormHandle, Props>(
  function AddManReqHrForm({ isEditMode, existingData, onSaved }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();

    const [form, setForm] = useState<TForm>(() =>
      mergeExisting(
        buildInitial(user?.company_code ?? "BSG", user?.loginid ?? ""),
        isEditMode ? existingData : undefined,
      ),
    );
    const [errors, setErrors] = useState<Partial<Record<K, string>>>({});

    const patch = (p: Partial<TForm>) => {
      setForm((prev) => ({ ...prev, ...p }));
      setErrors((prev) => {
        const next = { ...prev };
        (Object.keys(p) as K[]).forEach((k) => delete next[k]);
        return next;
      });
    };
    const set = (name: K, value: unknown) => patch({ [name]: value } as Partial<TForm>);

    const text = (name: K) => ({
      value: (form[name] as string | null) ?? "",
      onChange: (e: ChangeEvent<HTMLInputElement>) => set(name, e.target.value),
    });
    const num = (name: K) => ({
      type: "number" as const, min: 0,
      value: (form[name] as number | null) ?? "",
      onChange: (e: ChangeEvent<HTMLInputElement>) =>
        set(name, e.target.value === "" ? null : Math.max(0, Number(e.target.value))),
    });
    const date = (name: K) => ({
      type: "date" as const,
      value: toInputDatenull(form[name] as Date | null),
      onChange: (e: ChangeEvent<HTMLInputElement>) =>
        set(name, fromInputDate(e.target.value)),
    });
    const area = (name: K) => ({
      value: (form[name] as string | null) ?? "",
      onChange: (e: ChangeEvent<HTMLTextAreaElement>) => set(name, e.target.value),
    });

    const handleCopyDoc = () => {
      setForm((prev) => ({
        ...prev,
        doc_no: null,
        doc_ref_no: "",
        doc_date: new Date(),
        user_dt: new Date(),
        user_id: user?.loginid ?? prev.user_id,
      }));
      toast.info("Copied — Save will create a new requisition");
    };

    const handleSave = async () => {
      const found = validate(form);
      setErrors(found);
      if (Object.keys(found).length) {
        toast.warning("Please fill all required fields");
        return;
      }
      try {
        const response = await insUpdHrManReq({
          ...form,
          user_id: form.user_id || (user?.loginid ?? ""),
          user_dt: new Date(),
        });
        if (response) {
          toast.success(isEditMode ? "Requisition updated" : "Requisition created");
          onSaved(extractSaved(response));
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save requisition");
      }
    };

    useImperativeHandle(ref, () => ({ save: handleSave }));

    return (
      <div style={{ zoom: 0.8 }} className="freight-workspace-ui freight-dense-form freight-ui-standard grid items-start gap-1.5">

        {/* ══════════ TOP HALF ══════════ */}
        <div className="grid items-start gap-1.5 xl:grid-cols-3">
          {/* Requisition Details (spans 2 cols) */}
          <div className="xl:col-span-2">
            <HeaderBlock
              label="Manpower Requisition"
              icon={<Briefcase size={11} />}
              bodyClass="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2 p-2"
              action={
                <button
                  type="button"
                  onClick={handleCopyDoc}
                  className="flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                >
                  <Copy size={12} /> Copy Doc
                </button>
              }
            >
              {/* Row 1 */}
              <CField label="Document No">
                <div className="flex gap-1">
                  <Input className={CTL} value={form.doc_no ?? ""} readOnly disabled placeholder="Auto" />
                  <button
                    type="button"
                    title="Lookup document"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md border bg-card hover:bg-slate-50"
                    onClick={() => toast.info("Document lookup not wired yet")}
                  >
                    <Search size={13} />
                  </button>
                </div>
              </CField>
              <CField label="Document Type"><Input className={CTL} {...text("doc_type")} /></CField>
              <CField label="Doc Date"><Input className={CTL} {...date("doc_date")} /></CField>
              <CField label="Ref No"><Input className={CTL} {...text("doc_ref_no")} /></CField>

              {/* Row 2 */}
              <CField label="Position Title" required error={errors.pos_title} className="lg:col-span-2">
                <Input className={CTL} {...text("pos_title")} />
              </CField>
              <CField label="No of Positions"><Input className={CTL} {...num("no_of_pos")} /></CField>
              <CField label="Request Date" required error={errors.req_date}>
                <Input className={CTL} {...date("req_date")} />
              </CField>

              {/* Row 3 */}
              {/* <CField label="Department" required error={errors.dept} className="lg:col-span-2">
                <Input className={CTL} {...text("dept")} />
              </CField> */}   
              <CField label="Department" required error={errors.dept}>
                <ParamLookup parameter="HR_DROPDOWN_MS_DEPARTMENT"  valueField="dept_code" descField="dept_name" descHeader="Department" value={form.dept}  onChange={(v) => patch({ dept: v})} />
              </CField>
              {/* <CField label="Department Manager"><Input className={CTL} {...text("dept_mgr")} /></CField> */}
              <CField label="Department Manager" required error={errors.dept_mgr}>
                <ParamLookup parameter="HR_DROPDOWN_MS_HR_EMPLOYEE"  valueField="employee_id" descField="rpt_name" descHeader="Department Manager" value={form.dept_mgr}  onChange={(v) => patch({ dept_mgr: v})} />
              </CField>
              {/* <CField label="Position Reports To"><Input className={CTL} {...text("reports_to")} /></CField> */}
              <CField label="Position Reports To" required error={errors.reports_to}>
                <ParamLookup parameter="HR_DROPDOWN_MS_HR_EMPLOYEE"  valueField="employee_id" descField="rpt_name" descHeader="Position Reports To" value={form.reports_to}  onChange={(v) => patch({ reports_to: v})} />
              </CField>
            </HeaderBlock>
          </div>

          {/* Experience & Salary (1 col) */}
          <div>
            <HeaderBlock label="Experience & Salary" icon={<Wallet size={11} />} gridCols="grid-cols-2">
              <CField label="Total Experience"><Input className={CTL} {...num("total_exp")} /></CField>
              <CField label="Relevant Exp"><Input className={CTL} {...num("rev_exp")} /></CField>
              <CField label="Qualification" className="col-span-2">
                <Input className={CTL} {...text("qual")} />
              </CField>
              <CField label="Sal Range Frm" error={errors.sal_range_frm}>
                <Input className={CTL} {...num("sal_range_frm")} />
              </CField>
              <CField label="Sal Range To" error={errors.sal_range_to}>
                <Input className={CTL} {...num("sal_range_to")} />
              </CField>
            </HeaderBlock>
          </div>
        </div>

        {/* ══════════ MIDDLE (3 Columns) ══════════ */}
        <div className="grid gap-1.5 xl:grid-cols-3">
          <div className="flex h-full flex-col gap-1.5">
            <HeaderBlock className="flex-1" label="Skills" icon={<Award size={11} />} gridCols="grid-cols-1">
              <CField label="Req Skills"><textarea className={TA} rows={3} {...area("req_skills")} /></CField>
              <CField label="Sec Skills"><textarea className={TA} rows={3} {...area("sec_skills")} /></CField>
            </HeaderBlock>
          </div>

          <div className="flex h-full flex-col gap-1.5">
            <HeaderBlock className="flex-1" label="Role Details" icon={<FileText size={11} />} gridCols="grid-cols-1">
              <CField label="Role Desc"><textarea className={TA} rows={3} {...area("role_desc")} /></CField>
              <CField label="Req Reason"><Input className={CTL} {...text("req_reason")} /></CField>
              <CField label="Disqual"><Input className={CTL} {...text("disqual")} /></CField>
            </HeaderBlock>
          </div>

          <div className="flex h-full flex-col gap-1.5">
            <HeaderBlock
              className="flex-1"
              label="Additional Information"
              icon={<ClipboardList size={11} />}
              gridCols="grid-cols-1"
            >
              {/* Additional info fields */}
              <CField label="Target Company"><Input className={CTL} {...text("tgt_company")} /></CField>
              <CField label="Other Info"><Input className={CTL} {...text("other_info")} /></CField>

              {/* Signatories — two per row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1.5">
                <CField label="Signatory 1"><Input className={CTL} {...text("sign_1")} /></CField>
                <CField label="Signatory 2"><Input className={CTL} {...text("sign_2")} /></CField>
              </div>

              {/* Comments — full-width column */}
              <CField label="Comments">
                <textarea className={TA} rows={3} {...area("comments")} />
              </CField>
            </HeaderBlock>
          </div>
        </div>

        {/* ══════════ BOTTOM: Approvals ══════════ */}
        {/* <HeaderBlock
          label="Approvals"
          icon={<PenLine size={11} />}
          gridCols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
        >
          <CField label="Signatory 1"><Input className={CTL} {...text("sign_1")} /></CField>
          <CField label="Signatory 2"><Input className={CTL} {...text("sign_2")} /></CField> */}
          {/* <CField label="Signatory 3"><Input className={CTL} {...text("sign_3")} /></CField>
          <CField label="Signatory 4"><Input className={CTL} {...text("sign_4")} /></CField> */}
          {/* <CField label="Comments">
                <textarea className={TA} rows={3} {...area("comments")} />
          </CField>
        </HeaderBlock> */}
      </div>
    );
  },
);

export default AddManReqHrForm;