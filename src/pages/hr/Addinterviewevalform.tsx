import { Save, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import hrIntEvalFormServiceInstance from "./upsertHrIntEvalFormApi";

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

export function Addinterviewevalform({ mode, existingData, onClose }: Props) {
  const { user } = useAuth();
  const readonly = mode === "view";
  const isEdit = mode === "edit";

  const [form, setForm] = useState<TInterviewEval>({ ...EMPTY });
  const [errors, setErrors] = useState<Partial<Record<keyof TInterviewEval, string>>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [deptList, setDeptList] = useState<DeptOption[]>([]);

  // ── Load departments ────────────────────────────────────────────────────
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

  // ── Populate form on edit / view ────────────────────────────────────────
  useEffect(() => {
    if ((isEdit || readonly) && existingData) {
      setForm({
        ...EMPTY,
        ...existingData,
        doc_date: toDate(existingData.doc_date) || today,
        intrvw_date: toDate(existingData.intrvw_date),
      });
    }
  }, [isEdit, readonly, existingData]);

  const set = (field: keyof TInterviewEval, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Validation ──────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const next: Partial<Record<keyof TInterviewEval, string>> = {};
    if (!form.doc_date) next.doc_date = "Doc Date is required";
    if (!form.cand_name?.trim()) next.cand_name = "Candidate Name is required";
    if (!form.dept?.trim()) next.dept = "Department is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // ── Submit (uses hrIntEvalFormServiceInstance, same as original) ─────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setApiError("");
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
      onClose(true);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Unable to save interview evaluation",
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Field helpers ───────────────────────────────────────────────────────
  const field = (
    label: string,
    key: keyof TInterviewEval,
    type: "text" | "date" | "textarea" = "text",
    required = false,
    extraDisabled = false,
  ) => (
    <label className="field" key={key}>
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      {type === "textarea" ? (
        <textarea
          className="input"
          rows={3}
          disabled={readonly || extraDisabled}
          value={String(form[key] ?? "")}
          onChange={(e) => set(key, e.target.value)}
          style={{ resize: "vertical", fontFamily: "inherit" }}
        />
      ) : (
        <Input
          type={type}
          disabled={readonly || extraDisabled}
          value={String(form[key] ?? "")}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
      {errors[key] && (
        <span className="text-destructive text-xs mt-0.5">{errors[key]}</span>
      )}
    </label>
  );

  const evalField = (label: string, key: keyof TInterviewEval) => (
    <label className="field" key={key}>
      <span>{label}</span>
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
    </label>
  );

  // ── UI ──────────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-4">
      {apiError && <div className="alert error">{apiError}</div>}

      {/* ── Document ──────────────────────────────────────────────────────── */}
      <Card>
        {/* <CardHeader>
          <div>
            <p className="eyebrow">Document</p>
            <h2 className="m-0 text-sm font-semibold">Basic Information</h2>
          </div>
        </CardHeader> */}
       <CardContent className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <label className="field">
            <span>Doc No</span>
            <Input
              disabled
              value={form.doc_no != null ? String(form.doc_no) : "Autogenerated"}
            />
          </label>

          {/* <label className="field">
            <span>Doc Type</span>
            <Select
              disabled={readonly}
              value={form.doc_type ?? "MRF"}
              onChange={(e) => set("doc_type", e.target.value)}
            >
              <option value="MRF">Interview Evaluation</option>
            </Select>
          </label> */}

          <label className="field">
            <span>Doc Date <strong className="text-destructive">*</strong></span>
            <Input
              type="date"
              disabled={readonly}
              value={form.doc_date ?? ""}
              onChange={(e) => set("doc_date", e.target.value)}
            />
            {errors.doc_date && (
              <span className="text-destructive text-xs mt-0.5">{errors.doc_date}</span>
            )}
          </label>

          {field("Ref No", "doc_ref_no")}
          {field("Candidate No", "cand_no")}
        </CardContent>
      {/* </Card> */}

      {/* ── Candidate ─────────────────────────────────────────────────────── */}
      {/* <Card> */}
        {/* <CardHeader>
          <div>
            <p className="eyebrow">Candidate</p>
            <h2 className="m-0 text-sm font-semibold">Interview Details</h2>
          </div>
        </CardHeader> */}
       <CardContent className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <label className="field">
            <span>Candidate Name <strong className="text-destructive">*</strong></span>
            <Input
              disabled={readonly}
              value={form.cand_name ?? ""}
              onChange={(e) => set("cand_name", e.target.value)}
            />
            {errors.cand_name && (
              <span className="text-destructive text-xs mt-0.5">{errors.cand_name}</span>
            )}
          </label>

          {field("Position Applied For", "pos_appl_for")}

          <label className="field">
            <span>Department <strong className="text-destructive">*</strong></span>
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
            {errors.dept && (
              <span className="text-destructive text-xs mt-0.5">{errors.dept}</span>
            )}
          </label>

          {field("Interviewer Name", "intvr_name")}
          {field("Interview Date", "intrvw_date", "date")}

          <label className="field">
            <span>Hired</span>
            <Select
              disabled={readonly}
              value={form.hire_flag ?? ""}
              onChange={(e) => set("hire_flag", e.target.value)}
            >
              <option value="">-- Select --</option>
              <option value="Y">Yes</option>
              <option value="N">No</option>
            </Select>
          </label>
        </CardContent>
      {/* </Card> */}

      {/* ── Evaluation ────────────────────────────────────────────────────── */}
      {/* <Card> */}
        {/* <CardHeader>
          <div>
            <p className="eyebrow">Evaluation</p>
            <h2 className="m-0 text-sm font-semibold">Candidate Evaluation</h2>
          </div>
        </CardHeader> */}
        <CardContent className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {evalField("Specific Job Skill", "spec_job_skill")}
          {evalField("Relevant Job Experience", "rel_job_exp")}
          {evalField("Relevant Edu / Training", "rel_edu_training")}
          {evalField("Initiative", "initiative")}
          {evalField("Communication Skills", "comm_skills")}
          {evalField("Attitude", "attitude")}
          {evalField("Interest in Company / Position", "interest_comp_pos")}
        </CardContent>
      {/* </Card> */}

      {/* ── Remarks ───────────────────────────────────────────────────────── */}
      {/* <Card> */}
        {/* <CardHeader>
          <div>
            <p className="eyebrow">Remarks</p>
            <h2 className="m-0 text-sm font-semibold">Comments & Observations</h2>
          </div>
        </CardHeader> */}
        <CardContent className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {field("Positive Points", "pos_points", "textarea")}
          {field("Negative Points", "neg_points", "textarea")}
          {field("Overall Observation / Comment", "obs_comment", "textarea")}
          {field("Interviewer Signature / Name", "sign_4")}
        </CardContent>
      </Card>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
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
    </div>
  );
}