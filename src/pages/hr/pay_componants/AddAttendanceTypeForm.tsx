import { IdCard, ListChecks, StickyNote } from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";
import { executeDynamicMutationColumn90 } from "../../../api/lookups";
import { useToast } from "../../../components/ui/AlertToast";
import { Field, SectionPanel } from "../../../components/ui/Formblocks";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { useLookupOptions } from "../../../components/ui/Uselookupoptions";
import { useAuth } from "../../../state/AuthContext";
import type { TAttendanceTypeRow } from "../../../pages/hr/pay_componants/AttendanceTypePage";

/** Exposed to the parent so the header Save button can trigger save() */
export type AttendanceFormHandle = {
  save: () => Promise<void>;
};

export type TAttendanceTypeForm = {
  COMPANY_CODE: string;
  ATTEND_TYPE: string;
  ATTEND_DESC: string;
  ATTEND_SHORT_DESC: string;
  ATTENDANCE_CATEGORY: string;
  ATTEND_PERIODICITY: string;
  STATUS: string;
  REMARKS: string;
};

type FormMode = "add" | "edit" | "view";

type Props = {
  mode: FormMode;
  existingData?: Partial<TAttendanceTypeRow>;
  onClose: (shouldRefetch?: boolean) => void;
};

type CodeOption = { value_code: string; value_desc: string };
const mapCode = (r: Record<string, unknown>): CodeOption => ({
  value_code: String(r.VALUE_CODE ?? ""),
  value_desc: String(r.VALUE_DESC ?? ""),
});

export const AddAttendanceTypeForm = forwardRef<AttendanceFormHandle, Props>(
  function AddAttendanceTypeForm({ mode, existingData, onClose }, ref) {
    const { user } = useAuth();
    const { toast } = useToast();
    const readonly = mode === "view";
    const isEdit = mode === "edit";
    const loginid = user?.loginid ?? "";
    const companyCode = existingData?.COMPANY_CODE || user?.company_code || "";

    // These three lookups were always called with code1 only → pass code2 = ""
    const statusOptions = useLookupOptions("PAY_COMPONENT_STATUS_CodeValue", mapCode, "statuses", "");
    const categoryOptions = useLookupOptions("PAY_COMPONENT_ATTENDANCE_CATEGORY", mapCode, "categories", "");
    const periodicityOptions = useLookupOptions("PAY_COMPONENT_ATTENDANCE_PERIODICITY", mapCode, "periodicities", "");

    // The list row already carries every field, so no second lookup is needed.
    const [form, setForm] = useState<TAttendanceTypeForm>(() => ({
      COMPANY_CODE: companyCode,
      ATTEND_TYPE: String(existingData?.ATTEND_TYPE ?? ""),
      ATTEND_DESC: String(existingData?.ATTEND_DESC ?? ""),
      ATTEND_SHORT_DESC: String(existingData?.ATTEND_SHORT_DESC ?? ""),
      ATTENDANCE_CATEGORY: String(existingData?.ATTENDANCE_CATEGORY ?? ""),
      ATTEND_PERIODICITY: String(existingData?.ATTEND_PERIODICITY ?? ""),
      STATUS: String(existingData?.STATUS ?? "A"),
      REMARKS: String(existingData?.REMARKS ?? ""),
    }));
    const [errors, setErrors] = useState<Partial<Record<keyof TAttendanceTypeForm, string>>>({});

    const set = (field: keyof TAttendanceTypeForm, value: string) =>
      setForm((prev) => ({ ...prev, [field]: value }));

    // ── Validation ──
    const validate = (): string | null => {
      const next: Partial<Record<keyof TAttendanceTypeForm, string>> = {};
      if (isEdit && !form.ATTEND_TYPE) next.ATTEND_TYPE = "Attend Type is required";
      if (!form.ATTEND_DESC.trim()) next.ATTEND_DESC = "Description is required";
      setErrors(next);
      return Object.values(next)[0] ?? null;
    };

    // ── Submit (called by the page header Save button) ──
    // NOTE: the backend WHEN block for 'attendance_type_ins_upd' still needs to exist
    // (same count-check pattern as 'Payroll_accountsetup_ins_upd').
    const handleSubmit = async () => {
      const error = validate();
      if (error) {
        toast.warning(error);
        return;
      }
      try {
        await executeDynamicMutationColumn90({
          parameter: "attendance_type_ins_upd",
          loginid,
          val1s1: form.COMPANY_CODE,
          val1s2: form.ATTEND_TYPE,
          val1s3: form.ATTEND_DESC,
          val1s4: form.ATTEND_SHORT_DESC,
          val1s5: form.ATTENDANCE_CATEGORY,
          val1s6: form.ATTEND_PERIODICITY,
          val1s7: form.STATUS,
          val1s8: form.REMARKS,
        });
        toast.success(isEdit ? "Attendance type updated successfully" : "Attendance type saved successfully");
        onClose(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save attendance type");
      }
    };

    useImperativeHandle(ref, () => ({ save: handleSubmit }));

    // ── UI ──
    return (
      <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
        <SectionPanel title="Identification" icon={IdCard}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Attend Type" required={isEdit} error={errors.ATTEND_TYPE}>
              <Input
                disabled
                value={form.ATTEND_TYPE}
                placeholder={isEdit ? "" : "Auto-generated"}
                onChange={(e) => set("ATTEND_TYPE", e.target.value)}
              />
            </Field>

            <Field label="Description" required error={errors.ATTEND_DESC}>
              <Input
                disabled={readonly}
                value={form.ATTEND_DESC}
                onChange={(e) => set("ATTEND_DESC", e.target.value)}
              />
            </Field>

            <Field label="Short Description">
              <Input
                disabled={readonly}
                value={form.ATTEND_SHORT_DESC}
                onChange={(e) => set("ATTEND_SHORT_DESC", e.target.value)}
              />
            </Field>
          </div>
        </SectionPanel>

        <SectionPanel title="Classification" icon={ListChecks}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Category">
              <Select
                disabled={readonly}
                value={form.ATTENDANCE_CATEGORY}
                onChange={(e) => set("ATTENDANCE_CATEGORY", e.target.value)}
              >
                <option value="">-- Select --</option>
                {categoryOptions.map((o) => (
                  <option key={o.value_code} value={o.value_code}>
                    {o.value_desc}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Periodicity">
              <Select
                disabled={readonly}
                value={form.ATTEND_PERIODICITY}
                onChange={(e) => set("ATTEND_PERIODICITY", e.target.value)}
              >
                <option value="">-- Select --</option>
                {periodicityOptions.map((o) => (
                  <option key={o.value_code} value={o.value_code}>
                    {o.value_desc}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Status">
              <Select disabled={readonly} value={form.STATUS} onChange={(e) => set("STATUS", e.target.value)}>
                <option value="">-- Select --</option>
                {statusOptions.map((o) => (
                  <option key={o.value_code} value={o.value_code}>
                    {o.value_desc}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </SectionPanel>

        <SectionPanel title="Notes" icon={StickyNote}>
          <Field label="Remarks">
            <textarea
              className="input"
              rows={3}
              disabled={readonly}
              value={form.REMARKS}
              onChange={(e) => set("REMARKS", e.target.value)}
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
          </Field>
        </SectionPanel>
      </div>
    );
  },
);

export default AddAttendanceTypeForm;