// Interview Evaluation form — new UI (modelled on AddGradeMasterForm):
//  • forwardRef + useImperativeHandle → parent header "Save" button calls save()
//  • Freight-style collapsible sections + shared Field block
//  • toast for validation / API feedback (no inline alert banner)
//  • No bottom Cancel/Submit row — List / Close / Save live in the page header

import { ChevronDown, IdCard, ListChecks, StickyNote, UserCog } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useState,
} from "react";
import { getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Field } from "../../components/ui/Formblocks";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import hrIntEvalFormServiceInstance from "./upsertHrIntEvalFormApi";

/* ✅ Expose save() to the parent (header Save button) */
export type InterviewEvalFormHandle = {
  save: () => Promise<void>;
};

// ── Evaluation options ──────────────────────────────────────────────────────
const EVAL_OPTIONS = [
  { value: "", label: "-- Select --" },
  { value: "P", label: "P - Poor" },
  { value: "F", label: "F - Fair" },
  { value: "S", label: "S - Satisfactory" },
  { value: "G", label: "G - Good" },
  { value: "E", label: "E - Excellent" },
];

export type TInterviewEval = {
  doc_no?: string | number | null;
  doc_type?: string;
  doc_date?: string;
  doc_ref_no?: string;
  cand_no?: string;
  cand_name?: string;
  pos_appl_for?: string;
  dept?: string;
  intvr_name?: string;
  intrvw_date?: string;
  hire_flag?: string;
  spec_job_skill?: string;
  rel_job_exp?: string;
  rel_edu_training?: string;
  initiative?: string;
  comm_skills?: string;
  attitude?: string;
  interest_comp_pos?: string;
  pos_points?: string;
  neg_points?: string;
  obs_comment?: string;
  sign_4?: string;
};

type DeptOption = {
  dept_code: string;
  dept_short_name: string;
};

type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<TInterviewEval>;
  onClose: (shouldRefetch?: boolean) => void;
};

function toDate(value: unknown): string {
  if (!value) return "";
  const normalized = String(value).trim();
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

const today = new Date().toISOString().slice(0, 10);

const EMPTY: TInterviewEval = {
  doc_no: null,
  doc_type: "MRF",
  doc_date: today,
  doc_ref_no: "",
  cand_no: "",
  cand_name: "",
  pos_appl_for: "",
  dept: "",
  intvr_name: "",
  intrvw_date: "",
  hire_flag: "",
  spec_job_skill: "",
  rel_job_exp: "",
  rel_edu_training: "",
  initiative: "",
  comm_skills: "",
  attitude: "",
  interest_comp_pos: "",
  pos_points: "",
  neg_points: "",
  obs_comment: "",
  sign_4: "",
};

/* ─────────────────────────────────────────────────────────────
   CollapsibleSection — Freight panel with a clickable title bar.
   The body stays mounted (just hidden) so form state is never lost.
   ───────────────────────────────────────────────────────────── */
function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        title={open ? "Collapse section" : "Expand section"}
        className={`freight-panel-title flex w-full cursor-pointer items-center justify-between gap-2 bg-muted/35 px-3 py-2 text-left transition-colors hover:bg-muted/60 ${
          open ? "border-b" : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={16} />
          </span>
          <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
        </div>
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      <div className={`freight-panel-body p-3 ${open ? "" : "hidden"}`}>{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Form (forwardRef so parent can trigger save)
   ───────────────────────────────────────────────────────────── */
export const Addinterviewevalform = forwardRef<InterviewEvalFormHandle, Props>(
  function Addinterviewevalform({ mode, existingData, onClose }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();
    const readonly = mode === "view";
    const isEdit = mode === "edit";

    // The page remounts this form each time it opens, so initialise from existingData directly.
    const [form, setForm] = useState<TInterviewEval>(() =>
      (isEdit || readonly) && existingData
        ? {
            ...EMPTY,
            ...existingData,
            doc_date: toDate(existingData.doc_date) || today,
            intrvw_date: toDate(existingData.intrvw_date),
          }
        : { ...EMPTY },
    );
    const [errors, setErrors] = useState<Partial<Record<keyof TInterviewEval, string>>>({});
    const [deptList, setDeptList] = useState<DeptOption[]>([]);

    // ── Load departments ──────────────────────────────────────────────────
    const loadDepts = useCallback(async () => {
      try {
        const res = await getDynamicLookup({
          parameter: "HR_CAM_DEPARTMENT_DEPTCODE",
          loginid: user?.loginid ?? "",
          code1: user?.company_code ?? "",
          code2: "",
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
        const list = Array.isArray(res) ? (res as Record<string, unknown>[]) : [];
        setDeptList(
          list.map((d) => ({
            dept_code: String(d.DEPT_CODE ?? d.dept_code ?? ""),
            dept_short_name: String(d.DEPT_SHORT_NAME ?? d.dept_short_name ?? ""),
          })),
        );
      } catch {
        // non-critical; dropdown will be empty
      }
    }, [user?.loginid, user?.company_code]);

    useEffect(() => {
      void loadDepts();
    }, [loadDepts]);

    const set = (key: keyof TInterviewEval, value: unknown) =>
      setForm((prev) => ({ ...prev, [key]: value }));

    // ── Validation ────────────────────────────────────────────────────────
    const validate = (): string | null => {
      const next: Partial<Record<keyof TInterviewEval, string>> = {};
      if (!form.doc_date) next.doc_date = "Doc Date is required";
      if (!form.cand_name?.trim()) next.cand_name = "Candidate Name is required";
      if (!form.dept?.trim()) next.dept = "Department is required";
      setErrors(next);
      return Object.values(next)[0] ?? null;
    };

    // ── Submit (called by the page header Save button) ────────────────────
    const handleSubmit = async () => {
      const error = validate();
      if (error) {
        toast.warning(error);
        return;
      }
      try {
        const docDate = form.doc_date || today;
        const todayStr = new Date().toISOString().slice(0, 10);

        const data = {
          company_code: user?.company_code ?? "",
          doc_type: form.doc_type ?? "MRF",
          ...(isEdit && form.doc_no != null ? { doc_no: Number(form.doc_no) } : {}),
          doc_ref_no: form.doc_ref_no || undefined,
          cand_no: form.cand_no || undefined,
          cand_name: form.cand_name || undefined,
          pos_appl_for: form.pos_appl_for || undefined,
          dept: form.dept || undefined,
          intvr_name: form.intvr_name || undefined,
          intrvw_date: form.intrvw_date || null,
          doc_date: docDate,
          hire_flag: form.hire_flag || undefined,
          spec_job_skill: form.spec_job_skill || undefined,
          rel_job_exp: form.rel_job_exp || undefined,
          rel_edu_training: form.rel_edu_training || undefined,
          initiative: form.initiative || undefined,
          comm_skills: form.comm_skills || undefined,
          attitude: form.attitude || undefined,
          interest_comp_pos: form.interest_comp_pos || undefined,
          pos_points: form.pos_points || undefined,
          neg_points: form.neg_points || undefined,
          obs_comment: form.obs_comment || undefined,
          sign_4: form.sign_4 || undefined,
          user_id: user?.loginid ?? "ADMIN",
          user_dt: todayStr,
        };

        const success = await hrIntEvalFormServiceInstance.upsertHrIntEvalFormApi({
          data,
          loginid: user?.loginid ?? "ADMIN",
        });

        if (!success) throw new Error("Save failed");
        toast.success(
          isEdit ? "Interview evaluation updated successfully" : "Interview evaluation saved successfully",
        );
        onClose(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to save interview evaluation");
      }
    };

    /* ✅ Expose save() to parent */
    useImperativeHandle(ref, () => ({
      save: handleSubmit,
    }));

    // ── Field helpers ─────────────────────────────────────────────────────
    const textField = (
      label: string,
      key: keyof TInterviewEval,
      type: "text" | "date" = "text",
      required = false,
    ) => (
      <Field label={label} required={required} error={errors[key]} key={key}>
        <Input
          type={type}
          disabled={readonly}
          value={String(form[key] ?? "")}
          onChange={(e) => set(key, e.target.value)}
        />
      </Field>
    );

    const textareaField = (label: string, key: keyof TInterviewEval) => (
      <Field label={label} key={key}>
        <textarea
          className="input"
          rows={3}
          disabled={readonly}
          value={String(form[key] ?? "")}
          onChange={(e) => set(key, e.target.value)}
          style={{ resize: "vertical", fontFamily: "inherit" }}
        />
      </Field>
    );

    const evalField = (label: string, key: keyof TInterviewEval) => (
      <Field label={label} key={key}>
        <Select
          disabled={readonly}
          value={String(form[key] ?? "")}
          onChange={(e) => set(key, e.target.value)}
        >
          {EVAL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </Field>
    );

    // ── UI ────────────────────────────────────────────────────────────────
    return (
      <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
        <CollapsibleSection title="Document" icon={IdCard}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Doc No">
              <Input disabled value={form.doc_no != null ? String(form.doc_no) : "Autogenerated"} />
            </Field>

            {textField("Doc Date", "doc_date", "date", true)}
            {textField("Ref No", "doc_ref_no")}
            {textField("Candidate No", "cand_no")}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Candidate & Interview" icon={UserCog}>
          <div className="grid gap-3 md:grid-cols-3">
            {textField("Candidate Name", "cand_name", "text", true)}
            {textField("Position Applied For", "pos_appl_for")}

            <Field label="Department" required error={errors.dept}>
              <Select
                disabled={readonly}
                value={
                  deptList.some((d) => d.dept_code === String(form.dept ?? ""))
                    ? String(form.dept ?? "")
                    : ""
                }
                onChange={(e) => set("dept", e.target.value)}
              >
                <option value="">-- Select Department --</option>
                {deptList.map((d) => (
                  <option key={d.dept_code} value={d.dept_code}>
                    {d.dept_code} - {d.dept_short_name}
                  </option>
                ))}
              </Select>
            </Field>

            {textField("Interviewer Name", "intvr_name")}
            {textField("Interview Date", "intrvw_date", "date")}

            <Field label="Hired">
              <Select
                disabled={readonly}
                value={form.hire_flag ?? ""}
                onChange={(e) => set("hire_flag", e.target.value)}
              >
                <option value="">-- Select --</option>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </Select>
            </Field>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Candidate Evaluation" icon={ListChecks}>
          <div className="grid gap-3 md:grid-cols-4">
            {evalField("Specific Job Skill", "spec_job_skill")}
            {evalField("Relevant Job Experience", "rel_job_exp")}
            {evalField("Relevant Edu / Training", "rel_edu_training")}
            {evalField("Initiative", "initiative")}
            {evalField("Communication Skills", "comm_skills")}
            {evalField("Attitude", "attitude")}
            {evalField("Interest in Company / Position", "interest_comp_pos")}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Comments & Observations" icon={StickyNote}>
          <div className="grid gap-3 md:grid-cols-3">
            {textareaField("Positive Points", "pos_points")}
            {textareaField("Negative Points", "neg_points")}
            {textareaField("Overall Observation / Comment", "obs_comment")}
            {textField("Interviewer Signature / Name", "sign_4")}
          </div>
        </CollapsibleSection>
      </div>
    );
  },
);