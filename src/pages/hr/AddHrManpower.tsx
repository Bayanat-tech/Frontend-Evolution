// AddHrManpower.tsx
//
// Confirmation Review form — Freight-style:
//  • forwardRef + useImperativeHandle → parent header "Save" button calls save()
//  • Freight tabs replace the Back / Next stepper (Save works from any tab)
//  • SectionPanel / Field from shared Formblocks
//  • toast for validation / API feedback (no inline alert banners)
//  • No bottom button row — Close / Save live in the page header

import {
  ClipboardList, FileText, ListChecks, PenLine, ShieldCheck, UserRound,
} from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { executeDynamicMutationColumn90, getDynamicLookup, type LookupRow } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Field, SectionPanel } from "../../components/ui/Formblocks";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import type { TManpowerTransaction } from "./HrManpower";

/* ✅ Expose save() to the parent (header Save button) */
export type ManpowerFormHandle = {
  save: () => Promise<void>;
};

export type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<TManpowerTransaction> | null;
  onClose: (shouldRefetch?: boolean) => void;
};

const DEFAULT_AREAS = [
  "Competence/Job Knowledge",
  "Accountability/Adherence to schedules",
  "Commitment /Job involvement /Responsiveness",
  "Learning Ability",
  "Communication Skills",
];

const TABS = ["Document & Employee", "Key Responsibilities", "Performance", "Decision & Signatories"];

type Key = keyof TManpowerTransaction;

function toDate(value: unknown): string {
  if (!value) return "";
  const normalized = String(value).trim();
  if (!normalized) return "";
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

const EMPTY: TManpowerTransaction = {
  doc_type: "MRF",
  doc_no: "",
  doc_ref_no: "",
  doc_date: "",
  cand_no: "",
  cand_name: "",
  desig: "",
  division: "",
  reviewer: "",
  grade: "",
  doj: "",
  conf_due_dt: "",
  kr_1: "",
  kr_2: "",
  kr_3: "",
  kr_4: "",
  kr_5: "",
  assesmnt_area1: DEFAULT_AREAS[0],
  assesmnt_area2: DEFAULT_AREAS[1],
  assesmnt_area3: DEFAULT_AREAS[2],
  assesmnt_area4: DEFAULT_AREAS[3],
  assesmnt_area5: DEFAULT_AREAS[4],
  rating_1: "",
  rating_2: "",
  rating_3: "",
  rating_4: "",
  rating_5: "",
  comment1: "",
  comment2: "",
  comment3: "",
  comment4: "",
  comment5: "",
  confirmed: "",
  extended: "",
  extended_till: "",
  sign_1: "",
  date_1: "",
  sign_2: "",
  date_2: "",
  sign_3: "",
  date_3: "",
};

const normalizeDates = (data: Partial<TManpowerTransaction>): TManpowerTransaction => ({
  ...EMPTY,
  ...data,
  doc_date: toDate(data.doc_date),
  doj: toDate(data.doj),
  conf_due_dt: toDate(data.conf_due_dt),
  extended_till: toDate(data.extended_till),
  date_1: toDate(data.date_1),
  date_2: toDate(data.date_2),
  date_3: toDate(data.date_3),
});

function extractDocNo(data: Record<string, unknown> | null | undefined): string {
  const raw = data?.doc_no ?? data?.DOC_NO ?? null;
  if (raw === null || raw === undefined) return "";
  const str = String(raw).trim();
  if (!str || str === "undefined" || str === "null" || str === "0") return "";
  return str;
}

/* ─────────────────────────────────────────────────────────────
   Main Form (forwardRef so parent can trigger save)
   ───────────────────────────────────────────────────────────── */
export const AddHrManpowerForm = forwardRef<ManpowerFormHandle, Props>(function AddHrManpowerForm(
  { mode, existingData, onClose },
  ref,
) {
  const { user } = useAuth();
  const { toast } = useToast();
  const readonly = mode === "view";
  const isEdit = mode === "edit";
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [tab, setTab] = useState(0);
  const [form, setForm] = useState<TManpowerTransaction>(() =>
    mode !== "add" && existingData ? normalizeDates(existingData) : { ...EMPTY },
  );
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [loadingRecord, setLoadingRecord] = useState(false);

  const docNoFromGrid = extractDocNo(existingData as Record<string, unknown> | null);

  // ── Fetch the full record on edit / view (grid row only has a subset) ───
  useEffect(() => {
    if (!(isEdit || readonly) || !docNoFromGrid || !companyCode) return;

    let cancelled = false;

    const fetchFullRecord = async () => {
      setLoadingRecord(true);
      try {
        const response = await getDynamicLookup({
          parameter: "HR_TRANSACTIONS_MEMO_AND_FORMS_HR_CONF_REVW_FORM_FETCH",
          loginid,
          code1: companyCode,
          code2: docNoFromGrid,
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

        const row = Array.isArray(response) ? response[0] : response;
        if (!row || typeof row !== "object" || cancelled) return;

        const normalised = Object.fromEntries(
          Object.entries(row as Record<string, unknown>).map(([k, v]) => [k.toLowerCase(), v]),
        ) as Partial<TManpowerTransaction>;

        setForm(normalizeDates(normalised));
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Unable to load full record");
        }
      } finally {
        if (!cancelled) setLoadingRecord(false);
      }
    };

    void fetchFullRecord();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, readonly, docNoFromGrid, companyCode, loginid]);

  const set = (field: Key, value: unknown) => setForm((prev) => ({ ...prev, [field]: value }));

  const fetchLookup = async (parameter: string): Promise<LookupRow[]> => {
    const response = await getDynamicLookup({
      parameter,
      loginid,
      code1: companyCode,
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
    return Array.isArray(response) ? (response as LookupRow[]) : [];
  };

  // ── Validation ───────────────────────────────────────────────────────────
  const validate = (): string | null => {
    const next: Partial<Record<Key, string>> = {};
    if (!form.cand_name?.trim()) next.cand_name = "Candidate Name is required";
    if (!form.desig?.trim()) next.desig = "Designation is required";
    if (!form.doj) next.doj = "Date of Joining is required";
    if (!form.conf_due_dt) next.conf_due_dt = "Confirmation Due Date is required";
    setErrors(next);

    const first = Object.values(next)[0];
    if (first) setTab(0); // all required fields live on the first tab
    return first ?? null;
  };

  // ── Save (called by the page header Save button) ─────────────────────────
  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      toast.warning(error);
      return;
    }

    try {
      await executeDynamicMutationColumn90({
        parameter: "hr_conf_revw_form_ins_upd",
        loginid,
        val1s1: companyCode,
        val1s2: isEdit && form.doc_no ? String(form.doc_no) : "",
        val1s3: form.doc_type ?? "MRF",
        val1s4: form.doc_ref_no ?? "",
        val1s5: toDate(form.doc_date),
        val1s6: form.cand_no ?? "",
        val1s7: form.cand_name ?? "",
        val1s8: form.desig ?? "",
        val1s9: form.grade ?? "",
        val1s10: form.division ?? "",
        val1s11: form.reviewer ?? "",
        val1s12: toDate(form.doj),
        val1s13: toDate(form.conf_due_dt),
        val1s14: form.kr_1 ?? "",
        val1s15: form.kr_2 ?? "",
        val1s16: form.kr_3 ?? "",
        val1s17: form.kr_4 ?? "",
        val1s18: form.kr_5 ?? "",
        val1s19: form.assesmnt_area1 ?? "",
        val1s20: form.assesmnt_area2 ?? "",
        val1s21: form.assesmnt_area3 ?? "",
        val1s22: form.assesmnt_area4 ?? "",
        val1s23: form.assesmnt_area5 ?? "",
        val1s24: form.rating_1 ?? "",
        val1s25: form.rating_2 ?? "",
        val1s26: form.rating_3 ?? "",
        val1s27: form.rating_4 ?? "",
        val1s28: form.rating_5 ?? "",
        val1s29: form.comment1 ?? "",
        val1s30: form.comment2 ?? "",
        val1s31: form.comment3 ?? "",
        val1s32: form.comment4 ?? "",
        val1s33: form.comment5 ?? "",
        val1s34: form.confirmed ?? "",
        val1s35: form.extended ?? "",
        val1s36: toDate(form.extended_till),
        val1s37: form.sign_1 ?? "",
        val1s38: toDate(form.date_1),
        val1s39: form.sign_2 ?? "",
        val1s40: toDate(form.date_2),
        val1s41: form.sign_3 ?? "",
        val1s42: toDate(form.date_3),
      });

      toast.success(isEdit ? "Record updated successfully" : "Record saved successfully");
      onClose(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save record");
    }
  };

  /* ✅ Expose save() to parent */
  useImperativeHandle(ref, () => ({
    save: handleSubmit,
  }));

  // ── Field helpers (built on the shared Field) ────────────────────────────
  const field = (label: string, key: Key, required = false, className?: string) => (
    <Field label={label} required={required} error={errors[key]} className={className}>
      <Input
        disabled={readonly}
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
      />
    </Field>
  );

  const dateField = (label: string, key: Key, required = false) => (
    <Field label={label} required={required} error={errors[key]}>
      <Input
        type="date"
        disabled={readonly}
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
      />
    </Field>
  );

  const lookupField = (
    label: string,
    key: Key,
    parameter: string,
    valueField: string,
    displayFields: string[],
    columns: { field: string; header: string }[],
    required = false,
  ) => (
    <Field label={label} required={required} error={errors[key]}>
      <LookupField
        compact
        label={label}
        value={String(form[key] ?? "")}
        columns={columns}
        valueField={valueField}
        displayFields={displayFields}
        loadOptions={() => fetchLookup(parameter)}
        onChange={(value) => set(key, value)}
        disabled={readonly}
      />
    </Field>
  );

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
      <div className="freight-tabs-shell grid gap-0 rounded-md border bg-card shadow-sm">
        <div className="freight-tabs-list flex overflow-x-auto">
          {TABS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setTab(index)}
              aria-pressed={tab === index}
              className={`freight-workspace-tab ${tab === index ? "active" : ""}`}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>

        <div className="freight-tabs-panel border-t p-3 grid gap-3">
          {loadingRecord && (
            <p className="m-0 text-xs text-muted-foreground">Loading full record...</p>
          )}

          {/* ══ TAB 0 — Document & Employee ══ */}
          {tab === 0 && (
            <>
              <SectionPanel title="Document Information" icon={FileText}>
                <div className="grid gap-3 md:grid-cols-3">
                  {dateField("Doc Date", "doc_date")}
                  {field("Reference No", "doc_ref_no")}
                </div>
              </SectionPanel>

              <SectionPanel title="Employee Details" icon={UserRound}>
                <div className="grid gap-3 md:grid-cols-3">
                  {field("Candidate No", "cand_no")}
                  {field("Candidate Name", "cand_name", true)}
                  {lookupField(
                    "Designation",
                    "desig",
                    "HR_TRANSACTIONS_MEMO_AND_FORMS_HR_DESIG_LIST",
                    "desig_code",
                    ["desig_name"],
                    [
                      { field: "desig_code", header: "Code" },
                      { field: "desig_name", header: "Name" },
                    ],
                    true,
                  )}
                  {lookupField(
                    "Division",
                    "division",
                    "HR_TRANSACTIONS_MEMO_AND_FORMS_HR_DIVISION_LIST",
                    "div_code",
                    ["div_name"],
                    [
                      { field: "div_code", header: "Code" },
                      { field: "div_name", header: "Name" },
                    ],
                  )}
                  {lookupField(
                    "Reviewer",
                    "reviewer",
                    "HR_TRANSACTIONS_MEMO_AND_FORMS_HR_RPT_NAME_LIST",
                    "employee_id",
                    ["rpt_name"],
                    [
                      { field: "employee_id", header: "Employee ID" },
                      { field: "rpt_name", header: "Name" },
                    ],
                  )}
                  {lookupField(
                    "Grade",
                    "grade",
                    "HR_TRANSACTIONS_MEMO_AND_FORMS_HR_GRADE_LIST",
                    "grade_code",
                    ["grade_name"],
                    [
                      { field: "grade_code", header: "Code" },
                      { field: "grade_name", header: "Name" },
                    ],
                  )}
                  {dateField("Date of Joining", "doj", true)}
                  {dateField("Confirmation Due Date", "conf_due_dt", true)}
                </div>
              </SectionPanel>
            </>
          )}

          {/* ══ TAB 1 — Key Responsibilities ══ */}
          {tab === 1 && (
            <SectionPanel title="Key Responsibilities" icon={ClipboardList}>
              <div className="grid gap-3 md:grid-cols-2">
                {field("Responsibility 1", "kr_1")}
                {field("Responsibility 2", "kr_2")}
                {field("Responsibility 3", "kr_3")}
                {field("Responsibility 4", "kr_4")}
                {field("Responsibility 5", "kr_5")}
              </div>
            </SectionPanel>
          )}

          {/* ══ TAB 2 — Performance ══ */}
          {tab === 2 && (
            <SectionPanel title="Performance Assessment" icon={ListChecks}>
              <div className="grid gap-2">
                <div className="grid grid-cols-[2.5fr_0.6fr_3fr] gap-2 text-[11px] font-medium text-muted-foreground">
                  <span>Assessment Area</span>
                  <span>Rating</span>
                  <span>Comments</span>
                </div>
                {DEFAULT_AREAS.map((area, i) => {
                  const num = i + 1;
                  const areaKey = `assesmnt_area${num}` as Key;
                  const ratingKey = `rating_${num}` as Key;
                  const commentKey = `comment${num}` as Key;
                  const displayArea = String(form[areaKey] ?? area);
                  return (
                    <div key={num} className="grid grid-cols-[2.5fr_0.6fr_3fr] items-center gap-2">
                      <span
                        className="truncate rounded-md border bg-muted/40 px-2 py-1.5 text-[12px]"
                        title={displayArea}
                      >
                        {displayArea}
                      </span>
                      <Select
                        disabled={readonly}
                        value={String(form[ratingKey] ?? "")}
                        onChange={(e) => set(ratingKey, e.target.value)}
                      >
                        <option value="">-</option>
                        {[1, 2, 3, 4, 5].map((v) => (
                          <option key={v} value={String(v)}>
                            {v}
                          </option>
                        ))}
                      </Select>
                      <Input
                        placeholder="Comments"
                        disabled={readonly}
                        value={String(form[commentKey] ?? "")}
                        onChange={(e) => set(commentKey, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            </SectionPanel>
          )}

          {/* ══ TAB 3 — Decision & Signatories ══ */}
          {tab === 3 && (
            <>
              <SectionPanel title="Confirmation Decision" icon={ShieldCheck}>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Confirmed">
                    <Select
                      disabled={readonly}
                      value={form.confirmed ?? ""}
                      onChange={(e) => set("confirmed", e.target.value)}
                    >
                      <option value="">-</option>
                      <option value="Y">Yes</option>
                      <option value="N">No</option>
                    </Select>
                  </Field>
                  {field("Extended", "extended")}
                  {dateField("Extended Till", "extended_till")}
                </div>
              </SectionPanel>

              <SectionPanel title="Signatories" icon={PenLine}>
                <div className="grid gap-3 md:grid-cols-3">
                  {field("Signatory 1", "sign_1")}
                  {dateField("Date 1", "date_1")}
                  <div className="hidden md:block" />
                  {field("Signatory 2", "sign_2")}
                  {dateField("Date 2", "date_2")}
                  <div className="hidden md:block" />
                  {field("Signatory 3", "sign_3")}
                  {dateField("Date 3", "date_3")}
                </div>
              </SectionPanel>
            </>
          )}
        </div>
      </div>
    </div>
  );
});