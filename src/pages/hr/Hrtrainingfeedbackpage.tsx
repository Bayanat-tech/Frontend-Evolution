// pages/HR/HrTrainingFeedbackPage.tsx

import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, executeDynamicMutationColumn90, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Notice = { type: "success" | "error"; message: string } | null;

type TTrainingFeedback = {
  company_code: string;
  doc_type: string;
  doc_no: string;
  doc_ref_no: string;
  cand_no: string;
  cand_name: string;
  desig: string;
  dept: string;
  grade: string;
  course_att: string;
  q1_rating_cm: string; q2_rating_cm: string; q3_rating_cm: string; q4_rating_cm: string;
  q1_rating_tr: string; q2_rating_tr: string; q3_rating_tr: string; q4_rating_tr: string;
  q1_rating_inf: string; q2_rating_inf: string;
  q1_rating_exp: string; q2_rating_exp: string; q3_rating_exp: string; q3_rating_exp1: string;
  comments: string;
  sign_1: string; date_1: string | null;
  sign_2: string; date_2: string | null;
  sign_3: string; date_3: string | null;
  user_id: string;
  user_dt: string | null;
  doc_date: string | null;
  report_to: string;
};

type TEmployee = {
  employee_id: string;
  employee_code: string;
  rpt_name: string;
  dept_name: string;
  desg_name: string;
  div_name: string;
  grade_name: string;
  grade_code: string;
  dept_code: string;
  desg_code: string;
  manager_name: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function baseParams(
  parameter: string,
  loginid: string,
  companyCode: string,
  code2 = "",
  code3 = "",
  code4 = ""
) {
  return {
    parameter, loginid,
    code1: companyCode, code2, code3, code4,
    number1: 0, number2: 0, number3: 0, number4: 0,
    date1: null, date2: null, date3: null, date4: null,
  };
}

/** Converts any date-like value to "YYYY-MM-DD" string, or "" if invalid. */
function toDate(value: unknown): string {
  if (!value) return "";
  const str = String(value).trim();
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Try native Date parsing
  const d = new Date(str);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const RATING_OPTIONS = ["1", "2", "3", "4", "5"];

// ─────────────────────────────────────────────────────────────────────────────
// TRAINING FEEDBACK PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function TrainingFeedbackPage() {
  const { user } = useAuth();
  const loginid     = user?.loginid       || "ADMIN";
  const companyCode = user?.company_code  || "";

  const [rows,         setRows]         = useState<TTrainingFeedback[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [notice,       setNotice]       = useState<Notice>(null);
  const [popup,        setPopup]        = useState<{ open: boolean; mode: "add" | "edit" | "view"; data: Partial<TTrainingFeedback> }>
                                          ({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<TTrainingFeedback | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // ── Load list ───────────────────────────────────────────────────────────────

  const loadRows = async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup(
        baseParams("HR_TRANSACTIONS_MEMO_AND_FORMS_HR_TR_FEEDBACK_FORM_SELECT", loginid, companyCode, "NULL", "NULL", "NULL")
      );
      setRows(Array.isArray(data) ? (data as TTrainingFeedback[]) : []);
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to load records" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRows(); }, [companyCode]);

  // ── Fetch single full record ─────────────────────────────────────────────────

  const fetchSingle = async (docNo: string): Promise<Partial<TTrainingFeedback>> => {
    try {
      const data = await getDynamicLookup(
        baseParams("HR_TRANSACTIONS_MEMO_AND_FORMS_HR_TR_FEEDBACK_FORM_FETCH", loginid, companyCode, docNo, "NULL", "NULL")
      );
      const list = Array.isArray(data) ? data : [];
      return list[0] ? (list[0] as TTrainingFeedback) : {};
    } catch { return {}; }
  };

  const openEdit = async (row: TTrainingFeedback) => {
    const full = await fetchSingle(row.doc_no);
    setPopup({ open: true, mode: "edit", data: Object.keys(full).length ? full : row });
  };

  const openView = async (row: TTrainingFeedback) => {
    const full = await fetchSingle(row.doc_no);
    setPopup({ open: true, mode: "view", data: Object.keys(full).length ? full : row });
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await executeDynamicDelete({
        parameter: "MST_HR_TR_FEEDBACK_FORM_DELETE",
        loginid,
        code1: deleteTarget.doc_no,
        code2: companyCode,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Record deleted successfully." });
      void loadRows();
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Delete failed" });
    } finally {
      setDeleting(false);
    }
  };

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<TTrainingFeedback>[]>(() => [
    { accessorKey: "doc_no",     header: "Doc No",          size: 100 },
    { accessorKey: "doc_type",   header: "Doc Type",        size: 100 },
    { accessorKey: "doc_ref_no", header: "Doc Ref No",      size: 120 },
    { accessorKey: "doc_date",   header: "Doc Date",        size: 110 },
    { accessorKey: "cand_no",    header: "Cand No",         size: 100 },
    { accessorKey: "cand_name",  header: "Candidate Name",  size: 200 },
    { accessorKey: "desig",      header: "Designation",     size: 140 },
    { accessorKey: "dept",       header: "Department",      size: 130 },
    { accessorKey: "grade",      header: "Grade",           size: 90  },
    { accessorKey: "course_att", header: "Course Attended", size: 160 },
    { accessorKey: "report_to",  header: "Report To",       size: 130 },
    {
      id: "actions", header: "Actions", size: 100, enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" title="Edit"   onClick={() => openEdit(row.original)}><Edit2  size={14} /></Button>
          <Button size="icon" variant="ghost" title="View"   onClick={() => openView(row.original)}><Eye    size={14} /></Button>
          <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleteTarget(row.original)}><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ], []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <section className="grid gap-4">

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Training Feedback</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Manage employee training feedback forms.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => setPopup({ open: true, mode: "add", data: {} })}>
            <Plus size={15} /> Create Feedback
          </Button>
        </div>
      </div>

      {notice && (
        <div className={notice.type === "error" ? "alert error" : "alert success"}>{notice.message}</div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        title={`${rows.length.toLocaleString()} Records`}
        subtitle="Training Feedback List"
        searchPlaceholder="Search candidate, course, doc..."
        loading={loading}
        height={560}
        minWidth={1480}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => String(row.doc_no)}
      />

      {/* Add / Edit / View dialog */}
      {popup.open && (
        <Dialog
          open
          wide
          title={
            popup.mode === "add"  ? "Add Training Feedback"  :
            popup.mode === "edit" ? "Edit Training Feedback" :
                                    "View Training Feedback"
          }
          onClose={() => setPopup(p => ({ ...p, open: false }))}
        >
          <TrainingFeedbackForm
            mode={popup.mode}
            existingData={popup.data}
            onClose={(refetch) => {
              setPopup(p => ({ ...p, open: false }));
              if (refetch) void loadRows();
            }}
            onNotice={setNotice}
          />
        </Dialog>
      )}

      {/* Delete confirm dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete Feedback"
        description="This action cannot be undone."
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Delete feedback for <strong>{deleteTarget?.cand_name}</strong> (Doc: {deleteTarget?.doc_no})?
        </p>
      </Dialog>

    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAINING FEEDBACK FORM
// ─────────────────────────────────────────────────────────────────────────────

function TrainingFeedbackForm({
  mode,
  existingData,
  onClose,
  onNotice,
}: {
  mode: "add" | "edit" | "view";
  existingData: Partial<TTrainingFeedback>;
  onClose: (refetch?: boolean) => void;
  onNotice: (n: Notice) => void;
}) {
  const { user } = useAuth();
  const loginid     = user?.loginid      || "ADMIN";
  const companyCode = user?.company_code || "";
  const readonly    = mode === "view";
  const isEdit      = mode === "edit";

  // ── Form state ──────────────────────────────────────────────────────────────

  const [form, setForm] = useState<TTrainingFeedback>({
    company_code: companyCode,
    doc_type: "", doc_no: "", doc_ref_no: "",
    cand_no: "", cand_name: "", desig: "", dept: "", grade: "", course_att: "",
    q1_rating_cm: "", q2_rating_cm: "", q3_rating_cm: "", q4_rating_cm: "",
    q1_rating_tr: "", q2_rating_tr: "", q3_rating_tr: "", q4_rating_tr: "",
    q1_rating_inf: "", q2_rating_inf: "",
    q1_rating_exp: "", q2_rating_exp: "", q3_rating_exp: "", q3_rating_exp1: "",
    comments: "",
    sign_1: "",
    sign_2: "",
    sign_3: "",
    user_id: loginid, user_dt: null, report_to: "",
    ...existingData,
    doc_date: toDate(existingData.doc_date),
    date_1:   toDate(existingData.date_1),
    date_2:   toDate(existingData.date_2),
    date_3:   toDate(existingData.date_3),
  });

  const [saving, setSaving] = useState(false);

  const set = (field: keyof TTrainingFeedback, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  // ── Employee autocomplete ───────────────────────────────────────────────────

  const [employeeList, setEmployeeList] = useState<TEmployee[]>([]);
  const [empSearch,    setEmpSearch]    = useState("");
  const [empOpen,      setEmpOpen]      = useState(false);

  useEffect(() => {
    if (!companyCode) return;
    getDynamicLookup(
      baseParams("HR_TRANSACTIONS_MEMO_AND_FORMS_HR_EMPLOYEE_LIST_WITH_MANAGER", loginid, companyCode, "NULL", "NULL", "NULL")
    ).then(data => setEmployeeList(Array.isArray(data) ? (data as TEmployee[]) : []))
     .catch(() => {});
  }, [companyCode]);

  // Rehydrate selected employee label on edit/view
  const selectedEmployee = useMemo(() =>
    employeeList.find(e =>
      e.employee_code === form.cand_no ||
      e.employee_id   === form.cand_no ||
      e.rpt_name      === form.cand_name
    ) ?? null,
    [employeeList, form.cand_no, form.cand_name]
  );

  const filteredEmployees = useMemo(() => {
    if (!empSearch.trim()) return employeeList.slice(0, 50);
    const q = empSearch.toLowerCase();
    return employeeList
      .filter(e =>
        (e.rpt_name      || "").toLowerCase().includes(q) ||
        (e.employee_code || "").toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [employeeList, empSearch]);

  const handleEmployeeSelect = (emp: TEmployee) => {
    setForm(prev => ({
      ...prev,
      cand_no:   emp.employee_code || emp.employee_id,
      cand_name: emp.rpt_name,
      desig:     emp.desg_name,
      dept:      emp.dept_name,
      grade:     emp.grade_name,
      report_to: emp.manager_name,
    }));
    setEmpSearch("");
    setEmpOpen(false);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.cand_name.trim()) {
      onNotice({ type: "error", message: "Candidate Name is required" });
      return;
    }
    setSaving(true);
    try {
      await executeDynamicMutationColumn90({
        parameter: "HR_TR_FEEDBACK_FORM_ins_upd",
        loginid,
        val1s1:  companyCode,
        val1s2:  isEdit ? String(form.doc_no ?? "") : "",
        val1s3:  form.doc_type,
        val1s4:  form.doc_ref_no,
        val1s5:  form.doc_date  ?? "",
        val1s6:  form.cand_no,
        val1s7:  form.cand_name,
        val1s8:  form.desig,
        val1s9:  form.dept,
        val1s10: form.grade,
        val1s11: form.course_att,
        val1s12: form.report_to,
        val1s13: form.q1_rating_cm, val1s14: form.q2_rating_cm,
        val1s15: form.q3_rating_cm, val1s16: form.q4_rating_cm,
        val1s17: form.q1_rating_tr, val1s18: form.q2_rating_tr,
        val1s19: form.q3_rating_tr, val1s20: form.q4_rating_tr,
        val1s21: form.q1_rating_inf, val1s22: form.q2_rating_inf,
        val1s23: form.q1_rating_exp, val1s24: form.q2_rating_exp,
        val1s25: form.q3_rating_exp, val1s26: form.q3_rating_exp1,
        val1s27: form.comments,
        val1s28: form.sign_1, val1s29: form.date_1 ?? "",
        val1s30: form.sign_2, val1s31: form.date_2 ?? "",
        val1s32: form.sign_3, val1s33: form.date_3 ?? "",
      });
      onNotice({ type: "success", message: "Training feedback saved successfully." });
      onClose(true);
    } catch (err) {
      onNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to save record" });
    } finally {
      setSaving(false);
    }
  };

  // ── Field helpers ───────────────────────────────────────────────────────────

  const F = ({ label, field, type = "text" }: {
    label: string;
    field: keyof TTrainingFeedback;
    type?: string;
  }) => (
    <label className="field">
      <span>{label}</span>
      <Input
        type={type}
        disabled={readonly}
        value={String(form[field] ?? "")}
        onChange={e => set(field, e.target.value)}
      />
    </label>
  );

  const FAutoFilled = ({ label, field }: { label: string; field: keyof TTrainingFeedback }) => (
    <label className="field">
      <span>{label}</span>
      <Input
        disabled
        value={String(form[field] ?? "")}
        style={{ background: "var(--muted)", opacity: 1 }}
        title="Auto-filled from Candidate Name selection"
      />
    </label>
  );

  const RatingGroup = ({ label, fields }: { label: string; fields: (keyof TTrainingFeedback)[] }) => (
    <Card>
      <CardHeader>
        <div>
          <p className="eyebrow">Ratings</p>
          <h2 className="m-0 text-sm font-semibold">{label}</h2>
        </div>
      </CardHeader>
      <CardContent
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${fields.length}, 1fr)` }}
      >
        {fields.map((f, i) => (
          <label key={f as string} className="field">
            <span>Q{i + 1}{f === "q3_rating_exp1" ? "a" : ""}</span>
            <Select
              disabled={readonly}
              value={String(form[f] ?? "")}
              onChange={e => set(f, e.target.value)}
            >
              <option value="">-</option>
              {RATING_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
            </Select>
          </label>
        ))}
      </CardContent>
    </Card>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="grid gap-4">

      {/* ── Document & Candidate ── */}
      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Document & Candidate</p>
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

          <F label="Doc Type"        field="doc_type" />
          <F label="Doc Ref No"      field="doc_ref_no" />
          <F label="Doc Date"        field="doc_date"   type="date" />
          <F label="Course Attended" field="course_att" />

          {/* Employee autocomplete */}
          <label className="field" style={{ position: "relative" }}>
            <span>Candidate Name <strong className="text-destructive">*</strong></span>
            {readonly ? (
              <Input disabled value={form.cand_name} />
            ) : (
              <div style={{ position: "relative" }}>
                <Input
                  placeholder="Search employee…"
                  value={
                    empSearch ||
                    (selectedEmployee
                      ? `${selectedEmployee.employee_code} - ${selectedEmployee.rpt_name}`
                      : form.cand_name)
                  }
                  onChange={e => { setEmpSearch(e.target.value); setEmpOpen(true); }}
                  onFocus={() => setEmpOpen(true)}
                  onBlur={() => setTimeout(() => setEmpOpen(false), 150)}
                />
                {empOpen && filteredEmployees.length > 0 && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                    background: "var(--card)", border: "1px solid var(--border)",
                    borderRadius: 6, maxHeight: 220, overflowY: "auto",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                  }}>
                    {filteredEmployees.map(emp => (
                      <div
                        key={emp.employee_id}
                        onMouseDown={() => handleEmployeeSelect(emp)}
                        style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--muted)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                      >
                        <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>{emp.rpt_name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                          {emp.employee_code} | {emp.desg_name} | {emp.dept_name} | {emp.grade_name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </label>

          {/* Autofilled read-only fields */}
          <FAutoFilled label="Candidate No" field="cand_no"   />
          <FAutoFilled label="Designation"  field="desig"     />
          <FAutoFilled label="Department"   field="dept"      />
          <FAutoFilled label="Grade"        field="grade"     />
          <FAutoFilled label="Report To"    field="report_to" />

        </CardContent>
      </Card>

      {/* ── Ratings (2-column grid) ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <RatingGroup
          label="Course Material Ratings (CM)"
          fields={["q1_rating_cm", "q2_rating_cm", "q3_rating_cm", "q4_rating_cm"]}
        />
        <RatingGroup
          label="Trainer Ratings (TR)"
          fields={["q1_rating_tr", "q2_rating_tr", "q3_rating_tr", "q4_rating_tr"]}
        />
        <RatingGroup
          label="Infrastructure Ratings (INF)"
          fields={["q1_rating_inf", "q2_rating_inf"]}
        />
        <RatingGroup
          label="Experience Ratings (EXP)"
          fields={["q1_rating_exp", "q2_rating_exp", "q3_rating_exp", "q3_rating_exp1"]}
        />
      </div>

      {/* ── Comments ── */}
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
              rows={3}
              disabled={readonly}
              value={form.comments}
              onChange={e => set("comments", e.target.value)}
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
          </label>
        </CardContent>
      </Card>

      {/* ── Signatures ── */}
      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Signatures</p>
            <h2 className="m-0 text-sm font-semibold">Signatories</h2>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {([1, 2, 3] as const).map(n => (
            <div key={n} className="grid gap-2">
              <F label={`Signature ${n}`} field={`sign_${n}` as keyof TTrainingFeedback} />
              <F label={`Date ${n}`}      field={`date_${n}` as keyof TTrainingFeedback} type="date" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Buttons ── */}
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