import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { getWmsMaster } from "../../../api/wms";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { TPersnolHr } from "./employee-hr.types";
import { getDynamicLookup } from "../../../api/lookups";
import ImageCrop from "./ImageCrop";

const toInputDate = (value: Date | null | undefined) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const fromInputDate = (value: string): Date | null => (value ? new Date(value) : null);

const PersnolInfoForm = ({
  handleNext,
  persnolInfo,
  setPersnolInfo,
  isEditMode,
}: {
  isEditMode: boolean;
  handleNext: () => void;
  persnolInfo: TPersnolHr;
  setPersnolInfo: (value: TPersnolHr) => void;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState<TPersnolHr>(persnolInfo);
  const [fileUploadDialog, setFileUploadDialog] = useState(false);

  useEffect(() => {
    if (persnolInfo && Object.keys(persnolInfo).length) setForm(persnolInfo);
  }, [persnolInfo]);

  const requiredFields: (keyof TPersnolHr)[] = [
    "alternate_id", "rpt_name", "grade_code", "desg_code", "labour_desg_code",
    "category_code", "birth_date", "join_date", "probation_end_date",
    "probation_confirm_date", "country_code", "emp_status", "div_code",
    "dept_code", "section_code",
  ];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const missing = requiredFields.filter((field) => !form[field]);
    if (missing.length) {
      toast.warning("Please fill all required fields");
      return;
    }
    setPersnolInfo(form);
    handleNext();
  };

  const handleUploadedFile = (fileUrl: string) => {
    setForm((c) => ({ ...c, emp_photo: fileUrl }));
    setFileUploadDialog(false);
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <h2 className="m-0 text-lg font-semibold text-foreground">Persnol Information</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            <LookupField
              label="Employee Division"
              value={form.div_code ?? ""}
              valueField="div_code"
              displayFields={["div_code", "div_name"]}
              columns={[
                { field: "div_code", header: "Code" },
                { field: "div_name", header: "Division" },
              ]}
              loadOptions={async () => {
                const res = await getDynamicLookup({
                  parameter: "MS_EMP_HR_EMPLOYEE_DIVISION",
                  loginid: user?.loginid ?? "",
                  code1: user?.company_code ?? "",
                });
                return Array.isArray(res) ? res : [];
              }}
              onChange={(value) => setForm((c) => ({ ...c, div_code: value, dept_code: "", section_code: "" }))}
            />

            <LookupField
              label="Employee Dept"
              value={form.dept_code ?? ""}
              valueField="dept_code"
              displayFields={["dept_code", "dept_name"]}
              columns={[
                { field: "dept_code", header: "Code" },
                { field: "dept_name", header: "Department" },
              ]}
              disabled={!form.div_code}
              loadOptions={async () => {
                const res = await getDynamicLookup({
                  parameter: "MS_EMP_HR_EMPLOYEE_DEPARTMENT",
                  loginid: user?.loginid ?? "",
                  code1: user?.company_code ?? "",
                  code2: form.div_code ?? "",
                });
                return Array.isArray(res) ? res : [];
              }}
              onChange={(value) => setForm((c) => ({ ...c, dept_code: value, section_code: "" }))}
            />

            <LookupField
              label="Employee Section"
              value={form.section_code ?? ""}
              valueField="section_code"
              displayFields={["section_code", "section_name"]}
              columns={[
                { field: "section_code", header: "Code" },
                { field: "section_name", header: "Section" },
              ]}
              disabled={!form.dept_code}
              loadOptions={async () => {
                const res = await getDynamicLookup({
                  parameter: "MS_EMP_HR_EMPLOYEE_SECTION",
                  loginid: user?.loginid ?? "",
                  code1: user?.company_code ?? "",
                  code2: form.dept_code ?? "",
                });
                return Array.isArray(res) ? res : [];
              }}
              onChange={(value) => setForm((c) => ({ ...c, section_code: value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setFileUploadDialog(true)}
                disabled
                className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border hover:border-primary"
                title={form.emp_photo ? "Change Picture" : "Upload Profile Picture"}
              >
                {form.emp_photo ? (
                  <img src={form.emp_photo} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">Upload</span>
                )}
              </button>
              <span className="text-xs text-muted-foreground">Profile Picture</span>
            </div>

            <div className="grid gap-3">
              <Field label="Name" required>
                <Input value={form.rpt_name} onChange={(e) => setForm((c) => ({ ...c, rpt_name: e.target.value }))} />
              </Field>
              <Field label="Date Of Birth" required>
                <Input
                  type="date"
                  value={toInputDate(form.birth_date)}
                  onChange={(e) => setForm((c) => ({ ...c, birth_date: fromInputDate(e.target.value) as Date }))}
                />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {isEditMode && (
              <Field label="Employee Code" required>
                <Input value={form.employee_code} disabled />
              </Field>
            )}
            <Field label="Alternate Id" required>
              <Input
                disabled={isEditMode}
                value={form.alternate_id}
                onChange={(e) => setForm((c) => ({ ...c, alternate_id: e.target.value }))}
              />
            </Field>
          </div>

          <LookupField
            label="Grade"
            value={form.grade_code ?? ""}
            valueField="grade_code"
            displayFields={["grade_code", "grade_name"]}
            columns={[
              { field: "grade_code", header: "Code" },
              { field: "grade_name", header: "Grade" },
            ]}
            loadOptions={async () => {
              const res = await getDynamicLookup({
                parameter: "MS_EMP_HR_EMPLOYEE_GRADE",
                loginid: user?.loginid ?? "",
                code1: user?.company_code ?? "",
              });
              return Array.isArray(res) ? res : [];
            }}
            onChange={(value) => setForm((c) => ({ ...c, grade_code: value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <LookupField
              label="Designation"
              value={form.desg_code ?? ""}
              valueField="desg_code"
              displayFields={["desg_code", "desg_name"]}
              columns={[
                { field: "desg_code", header: "Code" },
                { field: "desg_name", header: "Designation" },
              ]}
              loadOptions={async () => {
                const res = await getDynamicLookup({
                  parameter: "MS_EMP_HR_EMPLOYEE_DESIGNATION",
                  loginid: user?.loginid ?? "",
                  code1: user?.company_code ?? "",
                });
                return Array.isArray(res) ? res : [];
              }}
              onChange={(value) => setForm((c) => ({ ...c, desg_code: value }))}
            />

            <LookupField
              label="Formal Designation"
              value={form.labour_desg_code ?? ""}
              valueField="labour_desg_code"
              displayFields={["labour_desg_code", "labour_desg_name"]}
              columns={[
                { field: "labour_desg_code", header: "Code" },
                { field: "labour_desg_name", header: "Formal Designation" },
              ]}
              loadOptions={async () => {
                const res = await getDynamicLookup({
                  parameter: "MS_EMP_HR_EMPLOYEE_LABOUR_DESG",
                  loginid: user?.loginid ?? "",
                  code1: user?.company_code ?? "",
                });
                return Array.isArray(res) ? res : [];
              }}
              onChange={(value) => setForm((c) => ({ ...c, labour_desg_code: value }))}
            />
          </div>
        </div>

        <div className="grid gap-3">
          <LookupField
            label="Category"
            value={form.category_code ?? ""}
            valueField="category_code"
            displayFields={["category_code", "category_name"]}
            columns={[
              { field: "category_code", header: "Code" },
              { field: "category_name", header: "Category" },
            ]}
            loadOptions={async () => {
              const res = await getDynamicLookup({
                parameter: "MS_EMP_HR_EMPLOYEE_CATEGORY",
                loginid: user?.loginid ?? "",
                code1: user?.company_code ?? "",
              });
              return Array.isArray(res) ? res : [];
            }}
            onChange={(value) => setForm((c) => ({ ...c, category_code: value }))}
          />

          <Field label="Date Of Joining" required>
            <Input
              type="date"
              value={toInputDate(form.join_date)}
              max={toInputDate(form.probation_end_date)}
              onChange={(e) => setForm((c) => ({ ...c, join_date: fromInputDate(e.target.value) as Date }))}
            />
          </Field>

          <Field label="Probation End Date" required>
            <Input
              type="date"
              value={toInputDate(form.probation_end_date)}
              min={toInputDate(form.join_date)}
              onChange={(e) => setForm((c) => ({ ...c, probation_end_date: fromInputDate(e.target.value) as Date }))}
            />
          </Field>

          <Field label="Confirmation Date" required>
            <Input
              type="date"
              value={toInputDate(form.probation_confirm_date)}
              onChange={(e) => setForm((c) => ({ ...c, probation_confirm_date: fromInputDate(e.target.value) as Date }))}
            />
          </Field>

          <LookupField
            label="Employment Status"
            value={form.emp_status ?? ""}
            valueField="empstatus_code"
            displayFields={["empstatus_code", "empstatus_name"]}
            columns={[
              { field: "empstatus_code", header: "Code" },
              { field: "empstatus_name", header: "Status" },
            ]}
            loadOptions={async () => {
              const res = await getDynamicLookup({
                parameter: "MS_EMP_HR_EMPLOYEE_STATUS",
                loginid: user?.loginid ?? "",
                code1: user?.company_code ?? "",
              });
              return Array.isArray(res) ? res : [];
            }}
            onChange={(value) => setForm((c) => ({ ...c, emp_status: value }))}
          />

          <LookupField
            label="Country"
            value={form.country_code ?? ""}
            valueField="country_code"
            displayFields={["country_code", "country_name"]}
            columns={[
              { field: "country_code", header: "Code" },
              { field: "country_name", header: "Country" },
            ]}
            loadOptions={async () => {
              const res = await getWmsMaster("country", { page: 1, limit: 100000 });
              return res?.tableData ?? [];
            }}
            onChange={(value) => setForm((c) => ({ ...c, country_code: value }))}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit">Next</Button>
      </div>

      {fileUploadDialog && (
        <ImageCrop
          Image={form.emp_photo}
          open={fileUploadDialog}
          onClose={() => setFileUploadDialog(false)}
          onSubmit={handleUploadedFile}
          dialogTitle="Upload Profile Picture"
        />
      )}
    </form>
  );
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      {children}
    </label>
  );
}

export default PersnolInfoForm;