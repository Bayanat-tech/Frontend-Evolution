import { Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { executeDynamicMutationColumn90, getDynamicLookup, LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import { TManpowerTransaction } from "./HrManpower";

type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<TManpowerTransaction>;
  onClose: (shouldRefetch?: boolean) => void;
};

const DEFAULT_AREAS = [
  "Competence/Job Knowledge",
  "Accountability/Adherence to schedules",
  "Commitment /Job involvement /Responsiveness",
  "Learning Ability",
  "Communication Skills",
];

const STEPS = ["Document & Employee", "Key Responsibilities", "Performance", "Decision & Signatories"];

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

function extractDocNo(data: Record<string, unknown> | undefined): string {
  const raw = data?.doc_no ?? data?.DOC_NO ?? null;
  if (raw === null || raw === undefined) return "";
  const str = String(raw).trim();
  if (!str || str === "undefined" || str === "null" || str === "0") return "";
  return str;
}

export function AddHrManpowerForm({ mode, existingData, onClose }: Props) {
  const { user } = useAuth();
  const readonly = mode === "view";
  const isEdit = mode === "edit";
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<TManpowerTransaction>({ ...EMPTY });
  const [errors, setErrors] = useState<Partial<Record<keyof TManpowerTransaction, string>>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [loadingRecord, setLoadingRecord] = useState(false);

  const docNoFromGrid = extractDocNo(existingData as Record<string, unknown>);

  useEffect(() => {
    if ((isEdit || readonly) && existingData) {
      setForm({
        ...EMPTY,
        ...existingData,
        doc_date: toDate(existingData.doc_date),
        doj: toDate(existingData.doj),
        conf_due_dt: toDate(existingData.conf_due_dt),
        extended_till: toDate(existingData.extended_till),
        date_1: toDate(existingData.date_1),
        date_2: toDate(existingData.date_2),
        date_3: toDate(existingData.date_3),
      });
    }
  }, [isEdit, readonly, existingData]);

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

        setForm({
          ...EMPTY,
          ...normalised,
          doc_date: toDate(normalised.doc_date),
          doj: toDate(normalised.doj),
          conf_due_dt: toDate(normalised.conf_due_dt),
          extended_till: toDate(normalised.extended_till),
          date_1: toDate(normalised.date_1),
          date_2: toDate(normalised.date_2),
          date_3: toDate(normalised.date_3),
        });
      } catch (error) {
        if (!cancelled) {
          setApiError(error instanceof Error ? error.message : "Unable to load full record");
        }
      } finally {
        if (!cancelled) setLoadingRecord(false);
      }
    };

    void fetchFullRecord();

    return () => {
      cancelled = true;
    };
  }, [isEdit, readonly, docNoFromGrid, companyCode, loginid]);

  const set = (field: keyof TManpowerTransaction, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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

  const validate = (): boolean => {
    const next: Partial<Record<keyof TManpowerTransaction, string>> = {};
    if (!form.cand_name?.trim()) next.cand_name = "Candidate Name is required";
    if (!form.desig?.trim()) next.desig = "Designation is required";
    if (!form.doj) next.doj = "Date of Joining is required";
    if (!form.conf_due_dt) next.conf_due_dt = "Confirmation Due Date is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      setActiveStep(0);
      return;
    }
    setSaving(true);
    setApiError("");
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

      onClose(true);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to save record");
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof TManpowerTransaction, required = false) => (
    <label className="field" key={key}>
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      <Input
        disabled={readonly}
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
      />
      {errors[key] && <span className="text-destructive text-xs mt-0.5">{errors[key]}</span>}
    </label>
  );

  const dateField = (label: string, key: keyof TManpowerTransaction, required = false) => (
    <label className="field" key={key}>
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      <Input
        type="date"
        disabled={readonly}
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
      />
      {errors[key] && <span className="text-destructive text-xs mt-0.5">{errors[key]}</span>}
    </label>
  );

  const lookupField = (
    label: string,
    key: keyof TManpowerTransaction,
    parameter: string,
    valueField: string,
    displayFields: string[],
    columns: { field: string; header: string }[],
    required = false,
  ) => (
    <label className="field" key={key}>
      <LookupField
        label={label}
        required={required}
        value={String(form[key] ?? "")}
        columns={columns}
        valueField={valueField}
        displayFields={displayFields}
        loadOptions={() => fetchLookup(parameter)}
        onChange={(value) => set(key, value)}
        disabled={readonly}
      />
      {errors[key] && <span className="text-destructive text-xs mt-0.5">{errors[key]}</span>}
    </label>
  );

  const ratingSelect = (num: number) => {
    const key = `rating_${num}` as keyof TManpowerTransaction;
    return (
      <Select
        disabled={readonly}
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
      >
        <option value="">-</option>
        {[1, 2, 3, 4, 5].map((v) => (
          <option key={v} value={String(v)}>
            {v}
          </option>
        ))}
      </Select>
    );
  };

  const commentField = (num: number) => {
    const key = `comment${num}` as keyof TManpowerTransaction;
    return (
      <Input
        placeholder="Comments"
        disabled={readonly}
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
      />
    );
  };

  const renderStepDocumentEmployee = () => (
    <Card>
      <CardHeader>
        <div>
          <p className="eyebrow">Document</p>
          <h2 className="m-0 text-sm font-semibold">Document Information</h2>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {dateField("Doc Date", "doc_date")}
        {field("Reference No", "doc_ref_no")}
      </CardContent>
      <CardHeader>
        <div>
          <p className="eyebrow">Employee</p>
          <h2 className="m-0 text-sm font-semibold">Employee Details</h2>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
      </CardContent>
    </Card>
  );

  const renderStepKeyResponsibilities = () => (
    <Card>
      <CardHeader>
        <div>
          <p className="eyebrow">Responsibilities</p>
          <h2 className="m-0 text-sm font-semibold">Key Responsibilities</h2>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {field("Responsibility 1", "kr_1")}
        {field("Responsibility 2", "kr_2")}
        {field("Responsibility 3", "kr_3")}
        {field("Responsibility 4", "kr_4")}
        {field("Responsibility 5", "kr_5")}
      </CardContent>
    </Card>
  );

  const renderStepPerformance = () => (
    <Card>
      <CardHeader>
        <div>
          <p className="eyebrow">Assessment</p>
          <h2 className="m-0 text-sm font-semibold">Performance Assessment</h2>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="grid grid-cols-[2.5fr_0.6fr_3fr] gap-2 text-xs font-semibold text-muted-foreground">
          <span>Assessment Area</span>
          <span>Rating</span>
          <span>Comments</span>
        </div>
        {DEFAULT_AREAS.map((area, i) => {
          const num = i + 1;
          const areaKey = `assesmnt_area${num}` as keyof TManpowerTransaction;
          const displayArea = String(form[areaKey] ?? area);
          return (
            <div key={num} className="grid grid-cols-[2.5fr_0.6fr_3fr] items-center gap-2">
              <span className="truncate rounded-md border bg-muted/40 px-2 py-1.5 text-sm" title={displayArea}>
                {displayArea}
              </span>
              {ratingSelect(num)}
              {commentField(num)}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );

  const renderStepDecisionSignatories = () => (
    <>
      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Decision</p>
            <h2 className="m-0 text-sm font-semibold">Confirmation Decision</h2>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="field">
            <span>Confirmed</span>
            <Select
              disabled={readonly}
              value={form.confirmed ?? ""}
              onChange={(e) => set("confirmed", e.target.value)}
            >
              <option value="">-</option>
              <option value="Y">Yes</option>
              <option value="N">No</option>
            </Select>
          </label>
          {field("Extended", "extended")}
          {dateField("Extended Till", "extended_till")}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Signatories</p>
            <h2 className="m-0 text-sm font-semibold">Signatories</h2>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {field("Signatory 1", "sign_1")}
          {dateField("Date 1", "date_1")}
          {field("Signatory 2", "sign_2")}
          {dateField("Date 2", "date_2")}
          {field("Signatory 3", "sign_3")}
          {dateField("Date 3", "date_3")}
        </CardContent>
      </Card>
    </>
  );

  const renderActiveStep = () => {
    switch (activeStep) {
      case 0:
        return renderStepDocumentEmployee();
      case 1:
        return renderStepKeyResponsibilities();
      case 2:
        return renderStepPerformance();
      case 3:
        return renderStepDecisionSignatories();
      default:
        return null;
    }
  };

  return (
    <div className="grid gap-4">
      {apiError && <div className="alert error">{apiError}</div>}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div>
          <p className="eyebrow m-0">
            {readonly ? "View Only" : isEdit ? "Edit Mode" : "Autogenerated"}
          </p>
          <p className="m-0 text-sm font-semibold text-foreground">
            {form.doc_no ? `Doc No: ${form.doc_no}` : "New Document"}
          </p>
        </div>
        {loadingRecord && <span className="text-xs text-muted-foreground">Loading record...</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <Button
            key={label}
            type="button"
            size="sm"
            variant={activeStep === index ? "default" : "outline"}
            onClick={() => setActiveStep(index)}
          >
            {index + 1}. {label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4">{loadingRecord ? <p className="text-sm text-muted-foreground">Loading full record...</p> : renderActiveStep()}</div>

      <div className="flex justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={activeStep === 0}
          onClick={() => setActiveStep((prev) => Math.max(prev - 1, 0))}
        >
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onClose(false)}>
            <X size={15} /> {readonly ? "Close" : "Cancel"}
          </Button>
          {activeStep < STEPS.length - 1 && (
            <Button
              type="button"
              onClick={() => setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1))}
            >
              Next
            </Button>
          )}
          {!readonly && activeStep === STEPS.length - 1 && (
            <Button disabled={saving} onClick={handleSubmit}>
              <Save size={15} /> {saving ? "Saving..." : isEdit ? "Update" : "Submit"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}