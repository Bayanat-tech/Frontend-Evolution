import { Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { executeDynamicMutationColumn90, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TTrainingFeedback = {
  company_code:   string;
  doc_type:       string;
  doc_no:         string;
  doc_ref_no:     string;
  doc_date:       string;
  cand_no:        string;
  cand_name:      string;
  desig:          string;
  dept:           string;
  grade:          string;
  course_att:     string;
  report_to:      string;
  q1_rating_cm:   string;
  q2_rating_cm:   string;
  q3_rating_cm:   string;
  q4_rating_cm:   string;
  q1_rating_tr:   string;
  q2_rating_tr:   string;
  q3_rating_tr:   string;
  q4_rating_tr:   string;
  q1_rating_inf:  string;
  q2_rating_inf:  string;
  q1_rating_exp:  string;
  q2_rating_exp:  string;
  q3_rating_exp:  string;
  q3_rating_exp1: string;
  comments:       string;
  sign_1:         string;
  date_1:         string;
  sign_2:         string;
  date_2:         string;
  sign_3:         string;
  date_3:         string;
  user_id:        string;
  user_dt:        string;
};

type TEmployee = {
  employee_id:   string;
  employee_code: string;
  rpt_name:      string;
  dept_name:     string;
  desg_name:     string;
  grade_name:    string;
  manager_name:  string;
};

type FormMode = "add" | "edit" | "view";

type Props = {
  mode:          FormMode;
  existingData?: Partial<TTrainingFeedback>;
  onClose:       (shouldRefetch?: boolean) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toDate(value: unknown): string {
  if (!value) return "";
  const str = String(value).trim();
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const RATING_OPTIONS = ["1", "2", "3", "4", "5"];

const EMPTY_FORM: TTrainingFeedback = {
  company_code:   "",
  doc_type:       "TRF",
  doc_no:         "",
  doc_ref_no:     "",
  doc_date:       new Date().toISOString().slice(0, 10),
  cand_no:        "",
  cand_name:      "",
  desig:          "",
  dept:           "",
  grade:          "",
  course_att:     "",
  report_to:      "",
  q1_rating_cm:   "",
  q2_rating_cm:   "",
  q3_rating_cm:   "",
  q4_rating_cm:   "",
  q1_rating_tr:   "",
  q2_rating_tr:   "",
  q3_rating_tr:   "",
  q4_rating_tr:   "",
  q1_rating_inf:  "",
  q2_rating_inf:  "",
  q1_rating_exp:  "",
  q2_rating_exp:  "",
  q3_rating_exp:  "",
  q3_rating_exp1: "",
  comments:       "",
  sign_1:         "",
  date_1:         "",
  sign_2:         "",
  date_2:         "",
  sign_3:         "",
  date_3:         "",
  user_id:        "",
  user_dt:        "",
};

// ─────────────────────────────────────────────────────────────────────────────
// Rating Section
// ─────────────────────────────────────────────────────────────────────────────

type RatingSectionProps = {
  eyebrow:   string;
  title:     string;
  questions: { label: string; field: keyof TTrainingFeedback }[];
  form:      TTrainingFeedback;
  readonly:  boolean;
  onChange:  (field: keyof TTrainingFeedback, value: string) => void;
};

function RatingSection({ eyebrow, title, questions, form, readonly, onChange }: RatingSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="m-0 text-sm font-semibold">{title}</h2>
        </div>
      </CardHeader>
      <CardContent
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(questions.length, 4)}, 1fr)` }}
      >
        {questions.map(({ label, field }) => (
          <label className="field" key={field as string}>
            <span>{label}</span>
            <Select
              disabled={readonly}
              value={String(form[field] ?? "")}
              onChange={(e) => onChange(field, e.target.value)}
            >
              <option value="">—</option>
              {RATING_OPTIONS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </Select>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Form Component
// ─────────────────────────────────────────────────────────────────────────────

export function AddTrainingFeedbackForm({ mode, existingData, onClose }: Props) {
  const { user }    = useAuth();
  const loginid     = user?.loginid      || "ADMIN";
  const companyCode = user?.company_code || "";
  const readonly    = mode === "view";
  const isEdit      = mode === "edit";

  // ── Form state ──────────────────────────────────────────────────────────────

  const [form, setForm] = useState<TTrainingFeedback>({
    ...EMPTY_FORM,
    company_code: companyCode,
    user_id:      loginid,
  });
  const [errors,   setErrors]   = useState<Partial<Record<keyof TTrainingFeedback, string>>>({});
  const [saving,   setSaving]   = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if ((isEdit || readonly) && existingData) {
      setForm({
        ...EMPTY_FORM,
        company_code: companyCode,
        user_id:      loginid,
        ...existingData,
        doc_date: toDate(existingData.doc_date) || EMPTY_FORM.doc_date,
        date_1:   toDate(existingData.date_1),
        date_2:   toDate(existingData.date_2),
        date_3:   toDate(existingData.date_3),
      });
    }
  }, [isEdit, readonly, existingData, companyCode, loginid]);

  const set = (field: keyof TTrainingFeedback, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Employee list ────────────────────────────────────────────────────────────

  const [employeeList, setEmployeeList] = useState<TEmployee[]>([]);
  const [empLoading,   setEmpLoading]   = useState(false);

  useEffect(() => {
    if (!companyCode) return;
    setEmpLoading(true);
    getDynamicLookup({
      parameter: "HR_TRANSACTIONS_MEMO_AND_FORMS_HR_EMPLOYEE_LIST_WITH_MANAGER",
      loginid,
      code1: companyCode,
      code2: "NULL", code3: "NULL", code4: "NULL",
      number1: 0, number2: 0, number3: 0, number4: 0,
      date1: null, date2: null, date3: null, date4: null,
    })
      .then((data) =>
        setEmployeeList(Array.isArray(data) ? (data as TEmployee[]) : []),
      )
      .catch(() => {})
      .finally(() => setEmpLoading(false));
  }, [companyCode, loginid]);

  const selectedEmployee = useMemo(
    () =>
      employeeList.find(
        (e) =>
          e.employee_code === form.cand_no ||
          e.rpt_name      === form.cand_name,
      ) ?? null,
    [employeeList, form.cand_no, form.cand_name],
  );

  const handleEmployeeSelect = (employeeCode: string) => {
    const emp = employeeList.find((e) => e.employee_code === employeeCode);
    if (!emp) {
      setForm((prev) => ({
        ...prev,
        cand_no: "",
        cand_name: "",
        desig: "",
        dept: "",
        grade: "",
        report_to: "",
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      cand_no:   emp.employee_code || emp.employee_id,
      cand_name: emp.rpt_name,
      desig:     emp.desg_name    || "",
      dept:      emp.dept_name    || "",
      grade:     emp.grade_name   || "",
      report_to: emp.manager_name || "",
    }));
    setErrors((prev) => ({ ...prev, cand_name: undefined }));
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const next: Partial<Record<keyof TTrainingFeedback, string>> = {};
    if (!form.cand_name.trim())  next.cand_name  = "Candidate Name is required";
    if (!form.doc_date)          next.doc_date   = "Doc Date is required";
    if (!form.course_att.trim()) next.course_att = "Course Attended is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setApiError("");
    try {
      await executeDynamicMutationColumn90({
        parameter: "HR_TR_FEEDBACK_FORM_INS_UPD",
        loginid,
        val1s1:  companyCode,
        val1s2:  isEdit ? String(form.doc_no) : "",
        val1s3:  form.doc_type,
        val1s4:  form.doc_ref_no,
        val1s5:  toDate(form.doc_date),
        val1s6:  form.cand_no,
        val1s7:  form.cand_name,
        val1s8:  form.desig,
        val1s9:  form.dept,
        val1s10: form.grade,
        val1s11: form.course_att,
        val1s12: form.report_to,
        val1s13: form.q1_rating_cm,
        val1s14: form.q2_rating_cm,
        val1s15: form.q3_rating_cm,
        val1s16: form.q4_rating_cm,
        val1s17: form.q1_rating_tr,
        val1s18: form.q2_rating_tr,
        val1s19: form.q3_rating_tr,
        val1s20: form.q4_rating_tr,
        val1s21: form.q1_rating_inf,
        val1s22: form.q2_rating_inf,
        val1s23: form.q1_rating_exp,
        val1s24: form.q2_rating_exp,
        val1s25: form.q3_rating_exp,
        val1s26: form.q3_rating_exp1,
        val1s27: form.comments,
        val1s28: form.sign_1,
        val1s29: toDate(form.date_1),
        val1s30: form.sign_2,
        val1s31: toDate(form.date_2),
        val1s32: form.sign_3,
        val1s33: toDate(form.date_3),
      });
      onClose(true);
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : "Unable to save training feedback",
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="grid gap-4">

      {apiError && <div className="alert error">{apiError}</div>}

      {/* ── 1. Document ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Document</p>
            <h2 className="m-0 text-sm font-semibold">
              {form.doc_no ? `Doc No: ${form.doc_no}` : "New Document"}
            </h2>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">

          <label className="field">
            <span>Doc No</span>
            <Input disabled value={form.doc_no || "Autogenerated"} />
          </label>

          <label className="field">
            <span>Doc Type</span>
            <Select
              disabled={readonly}
              value={form.doc_type}
              onChange={(e) => set("doc_type", e.target.value)}
            >
              <option value="TRF">Training Feedback</option>
            </Select>
          </label>

          <label className="field">
            <span>
              Doc Date <strong className="text-destructive">*</strong>
            </span>
            <Input
              type="date"
              disabled={readonly}
              value={form.doc_date}
              onChange={(e) => set("doc_date", e.target.value)}
            />
            {errors.doc_date && (
              <span className="text-destructive text-xs mt-0.5">{errors.doc_date}</span>
            )}
          </label>

          <label className="field">
            <span>Ref No</span>
            <Input
              disabled={readonly}
              value={form.doc_ref_no}
              onChange={(e) => set("doc_ref_no", e.target.value)}
            />
          </label>

          <label className="field">
            <span>
              Course Attended <strong className="text-destructive">*</strong>
            </span>
            <Input
              disabled={readonly}
              value={form.course_att}
              onChange={(e) => set("course_att", e.target.value)}
            />
            {errors.course_att && (
              <span className="text-destructive text-xs mt-0.5">{errors.course_att}</span>
            )}
          </label>

        </CardContent>
      </Card>

      {/* ── 2. Candidate ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Candidate</p>
            <h2 className="m-0 text-sm font-semibold">Employee Details</h2>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">

          {/* Employee dropdown — plain Select, same pattern as Division/Designation in Joining form */}
          <label className="field">
            <span>
              Candidate Name <strong className="text-destructive">*</strong>
            </span>
            {readonly ? (
              <Input disabled value={form.cand_name} />
            ) : (
              <Select
                disabled={empLoading}
                value={selectedEmployee?.employee_code ?? ""}
                onChange={(e) => handleEmployeeSelect(e.target.value)}
              >
                <option value="">
                  {empLoading ? "Loading..." : "Select Candidate"}
                </option>
                {employeeList.map((emp) => (
                  <option key={emp.employee_id} value={emp.employee_code}>
                    {emp.rpt_name} ({emp.employee_code})
                  </option>
                ))}
              </Select>
            )}
            {errors.cand_name && (
              <span className="text-destructive text-xs mt-0.5">{errors.cand_name}</span>
            )}
          </label>

          {/* Auto-filled fields — read-only (not editable) but styled like a normal input, not greyed-out/disabled */}
          {(
            [
              { label: "Candidate No",  field: "cand_no"   },
              { label: "Designation",   field: "desig"     },
              { label: "Department",    field: "dept"      },
              { label: "Grade",         field: "grade"     },
              { label: "Reports To",    field: "report_to" },
            ] as { label: string; field: keyof TTrainingFeedback }[]
          ).map(({ label, field }) => (
            <label key={field as string} className="field">
              <span>{label}</span>
              <Input
                readOnly
                value={String(form[field] ?? "")}
                style={{ background: "var(--background)", opacity: 1, cursor: "default" }}
                title="Auto-filled from Candidate Name"
              />
            </label>
          ))}

        </CardContent>
      </Card>

      {/* ── 3. Ratings ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">

        <RatingSection
          eyebrow="Ratings"
          title="Course Material (CM)"
          form={form}
          readonly={readonly}
          onChange={set}
          questions={[
            { label: "Q1 – Content relevance", field: "q1_rating_cm" },
            { label: "Q2 – Material quality",  field: "q2_rating_cm" },
            { label: "Q3 – Clarity",           field: "q3_rating_cm" },
            { label: "Q4 – Overall",           field: "q4_rating_cm" },
          ]}
        />

        <RatingSection
          eyebrow="Ratings"
          title="Trainer (TR)"
          form={form}
          readonly={readonly}
          onChange={set}
          questions={[
            { label: "Q1 – Knowledge",   field: "q1_rating_tr" },
            { label: "Q2 – Delivery",    field: "q2_rating_tr" },
            { label: "Q3 – Interaction", field: "q3_rating_tr" },
            { label: "Q4 – Overall",     field: "q4_rating_tr" },
          ]}
        />

        <RatingSection
          eyebrow="Ratings"
          title="Infrastructure (INF)"
          form={form}
          readonly={readonly}
          onChange={set}
          questions={[
            { label: "Q1 – Venue & facilities", field: "q1_rating_inf" },
            { label: "Q2 – Equipment",          field: "q2_rating_inf" },
          ]}
        />

        <RatingSection
          eyebrow="Ratings"
          title="Experience (EXP)"
          form={form}
          readonly={readonly}
          onChange={set}
          questions={[
            { label: "Q1 – Practical value",  field: "q1_rating_exp"  },
            { label: "Q2 – Applicability",    field: "q2_rating_exp"  },
            { label: "Q3 – Overall",          field: "q3_rating_exp"  },
            { label: "Q3a – Would recommend", field: "q3_rating_exp1" },
          ]}
        />

      </div>

      {/* ── 4. Comments ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Notes</p>
            <h2 className="m-0 text-sm font-semibold">Overall Comments</h2>
          </div>
        </CardHeader>
        <CardContent>
          <label className="field">
            <span>Comments</span>
            <textarea
              className="input"
              rows={4}
              disabled={readonly}
              value={form.comments}
              onChange={(e) => set("comments", e.target.value)}
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
          </label>
        </CardContent>
      </Card>

      {/* ── 5. Signatures ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Approvals</p>
            <h2 className="m-0 text-sm font-semibold">Signatories</h2>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {([1, 2, 3] as const).map((n) => (
            <div key={n} className="grid gap-2">
              <label className="field">
                <span>Signature {n}</span>
                <Input
                  disabled={readonly}
                  value={String(form[`sign_${n}` as keyof TTrainingFeedback] ?? "")}
                  onChange={(e) =>
                    set(`sign_${n}` as keyof TTrainingFeedback, e.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>Date {n}</span>
                <Input
                  type="date"
                  disabled={readonly}
                  value={String(form[`date_${n}` as keyof TTrainingFeedback] ?? "")}
                  onChange={(e) =>
                    set(`date_${n}` as keyof TTrainingFeedback, e.target.value)
                  }
                />
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onClose(false)}>
          <X size={15} /> {readonly ? "Close" : "Cancel"}
        </Button>
        {!readonly && (
          <Button disabled={saving} onClick={() => void handleSubmit()}>
            <Save size={15} /> {saving ? "Saving..." : isEdit ? "Update" : "Submit"}
          </Button>
        )}
      </div>

    </div>
  );
}