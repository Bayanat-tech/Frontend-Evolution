// src/pages/hr/Addemployeetransferform.tsx
//
// Employee Transfer form — same pattern as the Grade Master form:
//  • forwardRef + useImperativeHandle → the page header calls save() / submit()
//  • SectionPanel / Field / CodeNameLookup building blocks (defined below)
//  • toast for validation / API feedback (no inline alert banner)
//  • No bottom button row — List / Close / Save / Submit live in the page header

import { ArrowRightLeft, StickyNote, UserCog } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { executeDynamicMutation, getDynamicLookup, type LookupRow } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";

/* ─────────────────────────────────────────────────────────────
   Option helpers
   Every org dropdown (division / department / section / designation /
   employee) is just { code, name } — one shape, one lookup component.
   ───────────────────────────────────────────────────────────── */

export type Option = { code: string; name: string };

export function toOption(
  row: Record<string, unknown> | null | undefined,
  codeKey: string,
  nameKey: string,
): Option | null {
  const code = String(row?.[codeKey] ?? "");
  if (!code) return null;
  return { code, name: String(row?.[nameKey] ?? "") };
}

/** "CODE - Name" when a name is known, otherwise the bare code. */
export function optionLabel(o?: Option | null): string {
  if (!o?.code) return "";
  return o.name && o.name !== o.code ? `${o.code} - ${o.name}` : o.code;
}

/** Same idea for flat row fields (used by the list page). */
export function codeName(code?: unknown, name?: unknown): string {
  const c = String(code ?? "");
  const n = String(name ?? "");
  if (!c) return "";
  return n && n !== c ? `${c} - ${n}` : c;
}

/* ─────────────────────────────────────────────────────────────
   SectionPanel — Freight structure (same as Grade Master form)
   ───────────────────────────────────────────────────────────── */
export function SectionPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="freight-panel-title flex items-center gap-2 border-b bg-muted/35 px-3 py-2">
        <span className="freight-section-icon">
          <Icon size={16} />
        </span>
        <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
      </div>
      <div className="freight-panel-body p-3">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Field — Freight label styling, with inline error
   ───────────────────────────────────────────────────────────── */
export function Field({
  label,
  required,
  error,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`freight-field-label group flex min-w-0 flex-col gap-0.5 ${className}`}>
      <span className="text-[11px] font-medium text-muted-foreground transition-colors group-focus-within:text-primary">
        {label}
        {required && <strong className="ml-0.5 font-bold text-destructive"> *</strong>}
      </span>
      {children}
      {error && <span className="text-[10.5px] text-destructive">{error}</span>}
    </label>
  );
}

export function ReadOnlyField({
  label,
  value,
  loading,
  className,
}: {
  label: string;
  value: string;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Field label={label} className={className}>
      <Input type="text" disabled readOnly value={loading ? "Loading..." : value} />
    </Field>
  );
}

/* ─────────────────────────────────────────────────────────────
   CodeNameLookup — generic LookupField wrapper
   ───────────────────────────────────────────────────────────── */
type CodeNameLookupProps = {
  label: string;
  value: Option | null;
  onChange: (next: Option | null) => void;
  loadOptions: (query?: string) => Promise<LookupRow[]>;
  /** Row keys returned by the lookup, e.g. "div_code" / "div_name". */
  codeField: string;
  nameField: string;
  nameHeader?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
};

export function CodeNameLookup({
  label,
  value,
  onChange,
  loadOptions,
  codeField,
  nameField,
  nameHeader,
  required,
  disabled,
  error,
  className,
}: CodeNameLookupProps) {
  return (
    <Field label={label} required={required} error={error} className={className}>
      <LookupField
        compact
        dense
        label={label}
        disabled={disabled}
        value={value?.code ?? ""}
        displayValue={optionLabel(value)}
        columns={[
          { field: codeField, header: "Code" },
          { field: nameField, header: nameHeader ?? label },
        ]}
        valueField={codeField}
        displayFields={[codeField, nameField]}
        loadOptions={loadOptions}
        placeholder={`Select ${label.toLowerCase()}`}
        onChange={(_: unknown, row: Record<string, unknown> | null) => onChange(toOption(row, codeField, nameField))}
      />
    </Field>
  );
}


/* ✅ Exposed to the parent (header buttons) */
export type TransferFormHandle = {
  /** Validate and save as draft. */
  save: () => Promise<void>;
  /** Validate, ask for confirmation, then save. */
  submit: () => void;
};

export type TEmployeeTransfer = {
  doc_no?: string | number | null;
  doc_type?: string;
  div_code?: string;
  div_name?: string;
  dept_code?: string;
  dept_name?: string;
  section_code?: string;
  section_name?: string;
  employee_id?: string;
  employee_name?: string;
  desg_code?: string;
  desg_name?: string;
  div_code_to?: string;
  div_name_to?: string;
  dept_code_to?: string;
  dept_name_to?: string;
  section_code_to?: string;
  section_name_to?: string;
  desg_code_to?: string;
  desg_name_to?: string;
  remarks?: string;
  user_dt?: string;
};

type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<TEmployeeTransfer>;
  onClose: (shouldRefetch?: boolean) => void;
  /** Lets the header disable its buttons while a save is in flight. */
  onSavingChange?: (saving: boolean) => void;
};

type Placement = {
  division: Option | null;
  department: Option | null;
  section: Option | null;
  designation: Option | null;
};

type Errors = Partial<Record<"employee" | "division" | "department" | "section", string>>;

const today = () => new Date().toISOString().slice(0, 10);

function buildParams(parameter: string, loginid: string, companyCode: string, code2 = "", code3 = "", code4 = "") {
  return {
    parameter,
    loginid,
    code1: companyCode,
    code2,
    code3,
    code4,
    number1: 0,
    number2: 0,
    number3: 0,
    number4: 0,
    date1: null,
    date2: null,
    date3: null,
    date4: null,
  };
}

// Rebuild an Option from a saved row; fall back to the code when no name came back.
const fromRow = (d: Partial<TEmployeeTransfer>, codeKey: string, nameKey: string): Option | null => {
  const opt = toOption(d as Record<string, unknown>, codeKey, nameKey);
  return opt && !opt.name ? { ...opt, name: opt.code } : opt;
};

export const AddEmployeeTransferForm = forwardRef<TransferFormHandle, Props>(function AddEmployeeTransferForm(
  { mode, existingData, onClose, onSavingChange },
  ref,
) {
  const { user } = useAuth();
  const { toast } = useToast();
  const readonly = mode === "view";
  const isEdit = mode === "edit";
  const locked = readonly || isEdit; // the "from" side never changes once a record exists
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  // The page unmounts this form when it returns to the list, so lazy initial
  // state replaces a "populate on edit/view" effect.
  const seed = existingData ?? {};

  const [employee, setEmployee] = useState<Option | null>(
    seed.employee_id ? { code: seed.employee_id, name: seed.employee_name ?? "" } : null,
  );
  // Current placement: filters until an employee is picked, then that
  // employee's actual record (read-only).
  const [from, setFrom] = useState<Placement>({
    division: fromRow(seed, "div_code", "div_name"),
    department: fromRow(seed, "dept_code", "dept_name"),
    section: fromRow(seed, "section_code", "section_name"),
    designation: fromRow(seed, "desg_code", "desg_name"),
  });
  const [to, setTo] = useState<Placement>({
    division: fromRow(seed, "div_code_to", "div_name_to"),
    department: fromRow(seed, "dept_code_to", "dept_name_to"),
    section: fromRow(seed, "section_code_to", "section_name_to"),
    designation: fromRow(seed, "desg_code_to", "desg_name_to"),
  });
  const [remarks, setRemarks] = useState(seed.remarks ?? "");
  const [date, setDate] = useState((seed.user_dt ?? "").slice(0, 10) || today());

  const [errors, setErrors] = useState<Errors>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSavingState] = useState(false);
  const detailRequest = useRef(0);

  const setSaving = (value: boolean) => {
    setSavingState(value);
    onSavingChange?.(value);
  };

  const orgIsText = locked || Boolean(employee);

  // ── Cascading pickers: clear children in the handler, not in effects ──
  const pickFromDivision = (division: Option | null) =>
    setFrom((p) => ({ ...p, division, department: null, section: null }));
  const pickFromDepartment = (department: Option | null) => setFrom((p) => ({ ...p, department, section: null }));
  const pickToDivision = (division: Option | null) =>
    setTo((p) => ({ ...p, division, department: null, section: null }));
  const pickToDepartment = (department: Option | null) => setTo((p) => ({ ...p, department, section: null }));

  // ── Picking an employee fetches their current placement ───────────────
  const pickEmployee = async (picked: Option | null) => {
    const requestId = ++detailRequest.current;
    setEmployee(picked);
    setErrors((e) => ({ ...e, employee: undefined }));

    if (!picked) {
      setFrom({ division: null, department: null, section: null, designation: null });
      return;
    }

    setLoadingDetail(true);
    try {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_EMP_TRANSFER_EMP_DETAIL", loginid, companyCode, picked.code),
      );
      if (requestId !== detailRequest.current) return; // a newer pick superseded this one
      const row = (Array.isArray(res) ? res[0] : null) as Record<string, unknown> | null;
      if (!row) return;
      setEmployee({ code: picked.code, name: String(row.employee_name ?? row.rpt_name ?? picked.name) });
      setFrom({
        division: toOption(row, "div_code", "div_name"),
        department: toOption(row, "dept_code", "dept_name"),
        section: toOption(row, "section_code", "section_name"),
        designation: toOption(row, "desg_code", "desg_name"),
      });
    } catch (error) {
      if (requestId === detailRequest.current) {
        toast.error(error instanceof Error ? error.message : "Unable to load employee details");
      }
    } finally {
      if (requestId === detailRequest.current) setLoadingDetail(false);
    }
  };

  // ── Lookup loaders ────────────────────────────────────────────────────
  const lookup = useCallback(
    async (parameter: string, c2 = "", c3 = "", c4 = ""): Promise<LookupRow[]> =>
      ((await getDynamicLookup(buildParams(parameter, loginid, companyCode, c2, c3, c4))) as LookupRow[]) ?? [],
    [loginid, companyCode],
  );

  const divisions = () => lookup("EDUCATION_QUALIFICATION_LANG_DIVISION_LIST");
  const departments = (div?: string) => () => lookup("EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE", div ?? "");
  const sections = (div?: string, dept?: string) => () =>
    lookup("EDUCATION_QUALIFICATION_MS_HR_SECTION", div ?? "", dept ?? "");
  const employees = () =>
    lookup(
      "EDUCATION_QUALIFICATION_HR_EMPLOYEE_LIST_WITH_MANAGER",
      from.division?.code ?? "",
      from.department?.code ?? "",
      from.section?.code ?? "",
    );
  const designations = () => lookup("EDUCATION_QUALIFICATION_DESIGNATION_LIST");

  // ── Validation: inline errors + returns the first message for the toast ─
  const validate = (): string | null => {
    const next: Errors = {};
    if (!employee?.code) next.employee = "Employee is required";
    if (!to.division) next.division = "Division to is required";
    if (!to.department) next.department = "Department to is required";
    if (!to.section) next.section = "Section to is required";
    setErrors(next);
    return Object.values(next)[0] ?? null;
  };

  // ── Save — parameter "MST_HR_EMP_TRANSFER" ────────────────────────────
  // Slot layout matches PROC_BUILD_DYNAMIC_INS_UPD_MST_HR:
  //   val1s1 COMPANY  val1s2 DOC_TYPE  val1n1 DOC_NO (edit only)
  //   val1s3-5 from div/dept/section   val1s6 EMPLOYEE_ID
  //   val1s7-9 to div/dept/section     val1s10 REMARKS
  //   wval1s1 APPROVED (always 'N')    wval1s2 DESG_CODE   wval1s3 DESG_CODE_TO
  const persist = async () => {
    setSaving(true);
    try {
      const docNo = isEdit && seed.doc_no != null && seed.doc_no !== "" ? Number(seed.doc_no) : undefined;
      await executeDynamicMutation({
        parameter: "MST_HR_EMP_TRANSFER",
        loginid,
        val1s1: companyCode,
        val1s2: seed.doc_type ?? "ETR",
        val1n1: docNo,
        val1s3: from.division?.code ?? "",
        val1s4: from.department?.code ?? "",
        val1s5: from.section?.code ?? "",
        val1s6: employee?.code ?? "",
        val1s7: to.division?.code ?? "",
        val1s8: to.department?.code ?? "",
        val1s9: to.section?.code ?? "",
        val1s10: remarks,
        wval1s1: "N",
        wval1s2: from.designation?.code ?? "",
        wval1s3: to.designation?.code ?? "",
      });
      toast.success(isEdit ? "Transfer updated successfully" : "Transfer saved successfully");
      onClose(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save employee transfer");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      toast.warning(error);
      return;
    }
    await persist();
  };

  const handleSubmit = () => {
    const error = validate();
    if (error) {
      toast.warning(error);
      return;
    }
    setConfirmOpen(true);
  };

  const confirmSubmit = async () => {
    setConfirmOpen(false);
    await persist();
  };

  /* ✅ Expose save() / submit() to parent */
  useImperativeHandle(ref, () => ({ save: handleSave, submit: handleSubmit }));

  // ── UI ────────────────────────────────────────────────────────────────
  return (
    <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
      <SectionPanel title="Employee" icon={UserCog}>
        <div className="grid gap-3 md:grid-cols-4">
          {orgIsText ? (
            <>
              <ReadOnlyField label="Division" value={optionLabel(from.division)} loading={loadingDetail} />
              <ReadOnlyField label="Department" value={optionLabel(from.department)} loading={loadingDetail} />
              <ReadOnlyField label="Section" value={optionLabel(from.section)} loading={loadingDetail} />
            </>
          ) : (
            <>
              <CodeNameLookup
                label="Division"
                value={from.division}
                onChange={pickFromDivision}
                loadOptions={divisions}
                codeField="div_code"
                nameField="div_name"
              />
              <CodeNameLookup
                label="Department"
                value={from.department}
                onChange={pickFromDepartment}
                loadOptions={departments(from.division?.code)}
                codeField="dept_code"
                nameField="dept_name"
              />
              <CodeNameLookup
                label="Section"
                value={from.section}
                onChange={(section) => setFrom((p) => ({ ...p, section }))}
                loadOptions={sections(from.division?.code, from.department?.code)}
                codeField="section_code"
                nameField="section_name"
              />
            </>
          )}

          <CodeNameLookup
            label="Employee"
            required
            disabled={locked}
            value={employee}
            onChange={pickEmployee}
            loadOptions={employees}
            codeField="employee_id"
            nameField="employee_name"
            error={errors.employee}
            className="md:col-span-2"
          />
          <ReadOnlyField label="Designation" value={optionLabel(from.designation)} loading={loadingDetail} />
          <Field label="Date">
            <Input type="date" disabled={readonly} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
      </SectionPanel>

      <SectionPanel title="Transfer to" icon={ArrowRightLeft}>
        <div className="grid gap-3 md:grid-cols-4">
          <CodeNameLookup
            label="Division to"
            required
            disabled={readonly}
            value={to.division}
            onChange={pickToDivision}
            loadOptions={divisions}
            codeField="div_code"
            nameField="div_name"
            error={errors.division}
          />
          <CodeNameLookup
            label="Department to"
            required
            disabled={readonly}
            value={to.department}
            onChange={pickToDepartment}
            loadOptions={departments(to.division?.code)}
            codeField="dept_code"
            nameField="dept_name"
            error={errors.department}
          />
          <CodeNameLookup
            label="Section to"
            required
            disabled={readonly}
            value={to.section}
            onChange={(section) => setTo((p) => ({ ...p, section }))}
            loadOptions={sections(to.division?.code, to.department?.code)}
            codeField="section_code"
            nameField="section_name"
            error={errors.section}
          />
          <CodeNameLookup
            label="Designation to"
            disabled={readonly}
            value={to.designation}
            onChange={(designation) => setTo((p) => ({ ...p, designation }))}
            loadOptions={designations}
            codeField="desg_code"
            nameField="desg_name"
            nameHeader="Designation"
          />
        </div>
      </SectionPanel>

      <SectionPanel title="Notes" icon={StickyNote}>
        <Field label="Remarks">
          <textarea
            className="input"
            rows={3}
            disabled={readonly}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        </Field>
      </SectionPanel>

      {/* Submit confirmation */}
      <Dialog
        open={confirmOpen}
        title="Submit transfer"
        description="Are you sure you want to submit?"
        compact
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              No
            </Button>
            <Button onClick={() => void confirmSubmit()} disabled={saving}>
              Yes
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          This will submit the transfer for <strong>{employee?.name || "the selected employee"}</strong>.
        </p>
      </Dialog>
    </div>
  );
});