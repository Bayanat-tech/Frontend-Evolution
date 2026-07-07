import type { ColumnDef } from "@tanstack/react-table";
import { Calculator, Edit2, Plus, RefreshCw, Save, ShieldX, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getHrLeaveCancel, saveHrPayCompDepend, saveHrPayComponent } from "../../api/hr";
import { executeCommonProcedure, getDynamicLookup, getLookupValue, LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import { SalaryAdvancePage } from "./SalaryAdvancePage";
import {TrainingFeedbackPage} from "./Trainingfeedbackpage";

type Notice = { type: "success" | "error"; message: string } | null;

const baseParams = (parameter: string, loginid: string, companyCode: string, code2 = "", code3 = "", code4 = "") => ({
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
});

export function HrPayrollProcessPage() {
  const { user } = useAuth();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";
  const [division, setDivision] = useState<LookupRow | null>(null);
  const [department, setDepartment] = useState<LookupRow | null>(null);
  const [section, setSection] = useState<LookupRow | null>(null);
  const [employee, setEmployee] = useState<LookupRow | null>(null);
  const [payrollDate, setPayrollDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const divCode = text(division, "div_code");
  const deptCode = text(department, "dept_code");
  const sectionCode = text(section, "section_code");

  const loadEmployees = async () => {
    if (!divCode) {
      setRows([]);
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup(baseParams("PAYROLL_Employees", loginid, companyCode, divCode, deptCode, sectionCode));
      const filtered = employee ? data.filter((row) => text(row, "employee_code") === text(employee, "employee_code")) : data;
      setRows(filtered);
      setSelected({});
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load payroll employees" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEmployees();
  }, [divCode, deptCode, sectionCode, employee]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    {
      id: "select",
      header: "Select",
      size: 70,
      enableColumnFilter: false,
      cell: ({ row }) => {
        const id = rowId(row.original);
        return <input type="checkbox" checked={Boolean(selected[id])} onChange={(event) => setSelected((current) => ({ ...current, [id]: event.target.checked }))} />;
      },
    },
    { accessorKey: "employee_code", header: "Employee Code", size: 150 },
    { accessorKey: "emp_name", header: "Employee Name", size: 260 },
    { accessorKey: "grade_name", header: "Grade", size: 150 },
    { accessorKey: "designation", header: "Designation", size: 190 },
    { accessorKey: "division", header: "Division", size: 150 },
    { accessorKey: "department", header: "Department", size: 170 },
    { accessorKey: "section_name", header: "Section", size: 170 },
    { accessorKey: "join_date", header: "Join Date", size: 130 },
    { accessorKey: "div_payroll_date", header: "Payroll Date", size: 140 },
    { accessorKey: "sal_processed", header: "Sal Processed", size: 140 },
    { accessorKey: "adv_paid", header: "Adv Paid", size: 120 },
  ], [selected]);

  const selectedRows = rows.filter((row) => selected[rowId(row)]);

  const processPayroll = async () => {
    if (!selectedRows.length) {
      setNotice({ type: "error", message: "Select at least one employee to process payroll." });
      return;
    }
    setProcessing(true);
    setNotice(null);
    try {
      await executeCommonProcedure({
        parameter: "HR_PAYROLL_PROCESS",
        loginid,
        val1s1: companyCode,
        val1s2: divCode,
        val1s3: deptCode,
        val1s4: sectionCode,
        val1s5: selectedRows.map((row) => text(row, "employee_code")).join(","),
        val1s6: payrollDate,
      });
      setNotice({ type: "success", message: "Payroll process submitted successfully." });
      await loadEmployees();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to process payroll" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className="grid gap-4">
      <PageTitle title="Payroll Process" subtitle="Filter eligible employees and process payroll using the existing HR payroll procedure." />
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <Card>
        <CardHeader>
          <div><p className="eyebrow">Process Criteria</p><h2 className="m-0 text-sm font-semibold">Payroll Selection</h2></div>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-5">
          <LookupField compact label="Division" value={divCode} displayValue={display(division, "div_code", "div_name")} columns={[{ field: "div_code", header: "Code" }, { field: "div_name", header: "Division" }]} valueField="div_code" displayFields={["div_code", "div_name"]} loadOptions={() => getDynamicLookup(baseParams("Account_division", loginid, companyCode))} onChange={(_, row) => { setDivision(row); setDepartment(null); setSection(null); setEmployee(null); }} />
          <LookupField compact label="Department" value={deptCode} displayValue={display(department, "dept_code", "dept_name")} columns={[{ field: "dept_code", header: "Code" }, { field: "dept_name", header: "Department" }]} valueField="dept_code" displayFields={["dept_code", "dept_name"]} loadOptions={() => getDynamicLookup(baseParams("PAYROLL_Deparatment", loginid, companyCode, divCode))} disabled={!divCode} onChange={(_, row) => { setDepartment(row); setSection(null); setEmployee(null); }} />
          <LookupField compact label="Section" value={sectionCode} displayValue={display(section, "section_code", "section_name")} columns={[{ field: "section_code", header: "Code" }, { field: "section_name", header: "Section" }]} valueField="section_code" displayFields={["section_code", "section_name"]} loadOptions={() => getDynamicLookup(baseParams("PAYROLL_Section", loginid, companyCode, divCode, deptCode))} disabled={!deptCode} onChange={(_, row) => { setSection(row); setEmployee(null); }} />
          <LookupField compact label="Employee" value={text(employee, "employee_code")} displayValue={display(employee, "employee_code", "employee_id")} columns={[{ field: "employee_code", header: "Code" }, { field: "employee_id", header: "Employee" }]} valueField="employee_code" displayFields={["employee_code", "employee_id"]} loadOptions={() => getDynamicLookup(baseParams("PAYROLL_EmployeeCode", loginid, companyCode, divCode, deptCode, sectionCode))} disabled={!sectionCode} onChange={(_, row) => setEmployee(row)} />
          <label className="field"><span>Payroll Date</span><Input type="date" value={payrollDate} onChange={(event) => setPayrollDate(event.target.value)} /></label>
        </CardContent>
      </Card>
      <DataTable columns={columns} data={rows} subtitle="Payroll Employee List" title={`${rows.length.toLocaleString()} Employees`} searchPlaceholder="Search employee..." loading={loading} height={520} minWidth={1740} density="grid" enablePagination pageSize={100} toolbar={<><Button variant="outline" onClick={() => loadEmployees()}><RefreshCw size={15} /> Refresh</Button><Button disabled={processing} onClick={processPayroll}><Calculator size={15} /> {processing ? "Processing..." : "Process Payroll"}</Button></>} getRowId={(row, index) => rowId(row) || `payroll_${index}`} />
    </section>
  );
}

export function HrLeaveCancelPage() {
  const { user } = useAuth();
  const loginid = user?.loginid || "ADMIN";
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  const loadRows = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await getHrLeaveCancel(loginid, 1, 1000);
      setRows(response.tableData.map(normalizeRow));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load leave cancel records" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRows(); }, [loginid]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    { accessorKey: "request_number", header: "Request No", size: 140 },
    { accessorKey: "employee_code", header: "Employee Code", size: 150 },
    { accessorKey: "employee_name", header: "Employee Name", size: 260 },
    { accessorKey: "leave_type", header: "Leave Type", size: 140 },
    { accessorKey: "from_date", header: "From Date", size: 130 },
    { accessorKey: "to_date", header: "To Date", size: 130 },
    { accessorKey: "last_action", header: "Last Action", size: 140 },
    { accessorKey: "created_by", header: "Created By", size: 150 },
  ], []);

  return (
    <section className="grid gap-4">
      <PageTitle title="Leave Cancel" subtitle="Cancelled leave requests from the existing HR leave flow." />
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <DataTable columns={columns} data={rows} subtitle="Leave Cancel List" title={`${rows.length.toLocaleString()} Records`} searchPlaceholder="Search request, employee, leave..." loading={loading} height={640} minWidth={1240} density="grid" enablePagination pageSize={100} toolbar={<Button variant="outline" onClick={loadRows}><RefreshCw size={15} /> Refresh</Button>} getRowId={(row, index) => String(text(row, "request_number") || `leave_${index}`)} />
    </section>
  );
}

export function HrPayrollAccountSetupPage() {
  const { user } = useAuth();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  const loadRows = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup(baseParams("PAY_COMPONENT_PAY_UNITS", loginid, companyCode));
      setRows(data.map(normalizeRow));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load payroll account setup" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRows(); }, [loginid, companyCode]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    { accessorKey: "pay_comp_id", header: "Pay Component", size: 160 },
    { accessorKey: "pay_comp_desc", header: "Component Description", size: 280 },
    { accessorKey: "pay_comp_short_desc", header: "Short Description", size: 190 },
    { accessorKey: "div_code", header: "Division", size: 120 },
    { accessorKey: "div_name", header: "Division Name", size: 220 },
    { accessorKey: "company_code", header: "Company", size: 120 },
  ], []);

  return (
    <section className="grid gap-4">
      <PageTitle title="Payroll Account Setup" subtitle="Payroll pay component account setup using the existing HR pay component data." />
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <DataTable columns={columns} data={rows} subtitle="Payroll Account Setup List" title={`${rows.length.toLocaleString()} Records`} searchPlaceholder="Search pay component, division..." loading={loading} height={640} minWidth={1100} density="grid" enablePagination pageSize={100} toolbar={<Button variant="outline" onClick={loadRows}><RefreshCw size={15} /> Refresh</Button>} getRowId={(row, index) => `${text(row, "pay_comp_id")}_${text(row, "div_code")}_${index}`} />
    </section>
  );
}

type PayUnitMode = "units" | "dependant";

export function HrPayUnitsPage({ mode }: { mode: PayUnitMode }) {
  const { user } = useAuth();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";
  const dependant = mode === "dependant";
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [editor, setEditor] = useState<{ mode: "add" | "edit" | "view"; row?: LookupRow } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadRows = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup(baseParams("PAY_COMPONENT_PAY_UNITS", loginid, companyCode));
      setRows(data.map(normalizeRow));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load pay units" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRows(); }, [loginid, companyCode]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    { accessorKey: "pay_comp_id", header: "Pay Unit", size: 140 },
    { accessorKey: "pay_comp_desc", header: "Description", size: 280 },
    { accessorKey: "pay_comp_short_desc", header: "Short Description", size: 180 },
    { accessorKey: "pay_comp_type", header: "Type", size: 110 },
    { accessorKey: "pay_comp_earn_ded", header: "Earn/Ded", size: 110 },
    { accessorKey: "periodicity", header: "Periodicity", size: 120 },
    { accessorKey: "taxable", header: "Taxable", size: 100 },
    { accessorKey: "status", header: "Status", size: 100 },
    { accessorKey: "div_code", header: "Division", size: 110 },
    { accessorKey: "div_name", header: "Division Name", size: 190 },
    {
      id: "actions",
      header: "Actions",
      size: 95,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original })}><Edit2 size={14} /></Button>
          <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "view", row: row.original })}><ShieldX size={14} /></Button>
        </div>
      ),
    },
  ], []);

  const title = dependant ? "Pay Units Dependant" : "Pay Units";

  return (
    <section className="grid gap-4">
      <PageTitle title={title} subtitle={dependant ? "Maintain dependent pay unit rules and nationality limits." : "Maintain pay component units, payroll flags, and account-linked setup."} />
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <DataTable
        columns={columns}
        data={rows}
        subtitle={`${title} List`}
        title={`${rows.length.toLocaleString()} Records`}
        searchPlaceholder={`Search ${title.toLowerCase()}...`}
        loading={loading}
        height={640}
        minWidth={1500}
        density="grid"
        enablePagination
        pageSize={100}
        toolbar={<><Button variant="outline" onClick={loadRows}><RefreshCw size={15} /> Refresh</Button><Button onClick={() => setEditor({ mode: "add" })}><Plus size={15} /> Add</Button></>}
        getRowId={(row, index) => `${text(row, "pay_comp_id")}_${text(row, "div_code")}_${index}`}
      />
      {editor && (
        <PayUnitEditor
          mode={editor.mode}
          dependant={dependant}
          row={editor.row}
          companyCode={companyCode}
          loginid={loginid}
          onClose={() => setEditor(null)}
          onSaved={async (message) => {
            setEditor(null);
            setNotice({ type: "success", message });
            await loadRows();
          }}
          saving={saving}
          setSaving={setSaving}
        />
      )}
    </section>
  );
}

export function HrWarningLetterPage() {
  return <SalaryAdvancePage />;
}


export function Hrtrainingfeedbackpage(){
return <TrainingFeedbackPage />;
}


function PayUnitEditor({
  mode,
  dependant,
  row,
  companyCode,
  loginid,
  onClose,
  onSaved,
  saving,
  setSaving,
}: {
  mode: "add" | "edit" | "view";
  dependant: boolean;
  row?: LookupRow;
  companyCode: string;
  loginid: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
  saving: boolean;
  setSaving: (saving: boolean) => void;
}) {
  const readonly = mode === "view";
  const [form, setForm] = useState<Record<string, unknown>>(() => ({
    company_code: companyCode,
    pay_comp_id: text(row, "pay_comp_id"),
    pay_comp_desc: text(row, "pay_comp_desc"),
    pay_comp_short_desc: text(row, "pay_comp_short_desc"),
    pay_comp_type: text(row, "pay_comp_type"),
    pay_comp_earn_ded: text(row, "pay_comp_earn_ded"),
    periodicity: text(row, "periodicity"),
    taxable: text(row, "taxable"),
    round_off_to: text(row, "round_off_to") || 0,
    status: text(row, "status") || "A",
    attendance_dependency: text(row, "attendance_dependency"),
    pay_comp_class: text(row, "pay_comp_class"),
    pay_flag: text(row, "pay_flag"),
    pay_comp_dependent: text(row, "pay_comp_dependent"),
    type: text(row, "type"),
    sort_order: Number(text(row, "sort_order") || 0),
    leave_paid: text(row, "leave_paid"),
    salary_link: text(row, "salary_link"),
    div_code: text(row, "div_code"),
    div_name: text(row, "div_name"),
    remarks: text(row, "remarks"),
  }));
  const [detailRows, setDetailRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(Boolean(row));
  const [error, setError] = useState("");
  const payCompId = String(form.pay_comp_id || "");

  useEffect(() => {
    const loadDetail = async () => {
      if (!row || !payCompId) return;
      setLoading(true);
      setError("");
      try {
        const headerParameter = dependant ? "PAY_COMPONENT_PAY_UNIT" : "PAY_COMPONENT_PAY_UNITS";
        const detailParameter = dependant ? "PAY_COMPONENT_DEPEND" : "PAY_COMPONENT_PAY_COMP_DEPEND";
        const [headerData, detailData] = await Promise.all([
          getDynamicLookup(baseParams(headerParameter, loginid, companyCode, payCompId)),
          getDynamicLookup(baseParams(detailParameter, loginid, companyCode, payCompId)),
        ]);
        const header = normalizeRow(headerData[0] || row);
        setForm((current) => ({ ...current, ...header, company_code: companyCode }));
        setDetailRows(detailData.map(normalizeRow));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load pay unit details");
      } finally {
        setLoading(false);
      }
    };
    void loadDetail();
  }, [companyCode, dependant, loginid, payCompId, row]);

  const update = (field: string, value: unknown) => setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    if (!String(form.pay_comp_desc || "").trim()) {
      setError("Pay Component Description is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (dependant) {
        const headerRows = detailRows.length
          ? detailRows
          : [{ pay_comp_id_depend: String(form.pay_comp_dependent || ""), percent: 0, empr_percent: 0, status_flag: String(form.status || "A"), remarks: String(form.remarks || "") }];
        await saveHrPayCompDepend({
          header: headerRows.map((detail) => ({
            company_code: companyCode,
            pay_comp_id: String(form.pay_comp_id || ""),
            pay_comp_id_depend: text(detail, "pay_comp_id_depend"),
            percent: Number(text(detail, "percent") || 0),
            empr_percent: Number(text(detail, "empr_percent") || 0),
            remarks: text(detail, "remarks"),
            status_flag: text(detail, "status_flag") || text(detail, "status") || "A",
            user_id: loginid,
            user_dt: new Date().toISOString(),
          })),
          details: detailRows.map((detail) => ({
            company_code: companyCode,
            pay_comp_id: String(form.pay_comp_id || ""),
            pay_comp_id_depend: text(detail, "pay_comp_id_depend"),
            nationality: text(detail, "nationality") || text(detail, "country_code"),
            age: Number(text(detail, "age") || 0),
            status: text(detail, "status") || "A",
            remarks: text(detail, "remarks"),
            amt_limit: Number(text(detail, "amt_limit") || text(detail, "amount") || 0),
            user_id: loginid,
            user_dt: new Date().toISOString(),
          })),
        });
      } else {
        await saveHrPayComponent({
          header: {
            company_code: companyCode,
            pay_comp_id: String(form.pay_comp_id || ""),
            pay_comp_desc: String(form.pay_comp_desc || ""),
            pay_comp_short_desc: String(form.pay_comp_short_desc || ""),
            pay_comp_type: String(form.pay_comp_type || ""),
            pay_comp_earn_ded: String(form.pay_comp_earn_ded || ""),
            periodicity: String(form.periodicity || ""),
            taxable: String(form.taxable || ""),
            round_off_to: Number(form.round_off_to || 0),
            remarks: String(form.remarks || ""),
            status: String(form.status || "A"),
            user_id: loginid,
            user_dt: new Date().toISOString(),
            attendance_dependency: String(form.attendance_dependency || ""),
            pay_comp_class: String(form.pay_comp_class || ""),
            pay_flag: String(form.pay_flag || ""),
            pay_comp_dependent: String(form.pay_comp_dependent || ""),
            type: String(form.type || ""),
            sort_order: Number(form.sort_order || 0),
            leave_paid: String(form.leave_paid || ""),
            salary_link: String(form.salary_link || ""),
            div_code: String(form.div_code || ""),
          },
          details: detailRows.map((detail, index) => ({
            company_code: companyCode,
            pay_comp_id: String(form.pay_comp_id || ""),
            pay_comp_id_depend: text(detail, "pay_comp_id_depend"),
            percent: Number(text(detail, "percent") || 0),
            pay_comp_desc: text(detail, "pay_comp_desc"),
            sort_order: Number(text(detail, "sort_order") || index + 1),
            user_id: loginid,
            user_dt: new Date().toISOString(),
          })),
        });
      }
      await onSaved(`${dependant ? "Pay units dependant" : "Pay unit"} saved successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save pay unit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open title={`${mode === "add" ? "Add" : mode === "view" ? "View" : "Edit"} ${dependant ? "Pay Units Dependant" : "Pay Unit"}`} wide onClose={onClose}>
      <div className="grid gap-4">
        <NoticeToast notice={error ? { type: "error", message: error } : null} onClose={() => setError("")} />
        {loading && <div className="alert">Loading pay unit details...</div>}
        <Card>
          <CardHeader><div><p className="eyebrow">Header</p><h2 className="m-0 text-sm font-semibold">Pay Component Information</h2></div></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="field"><span>Pay Component ID</span><Input disabled={readonly || mode !== "add"} value={String(form.pay_comp_id || "")} onChange={(event) => update("pay_comp_id", event.target.value)} /></label>
            <label className="field"><span>Description *</span><Input disabled={readonly} value={String(form.pay_comp_desc || "")} onChange={(event) => update("pay_comp_desc", event.target.value)} /></label>
            <label className="field"><span>Short Description</span><Input disabled={readonly} value={String(form.pay_comp_short_desc || "")} onChange={(event) => update("pay_comp_short_desc", event.target.value)} /></label>
            <label className="field"><span>Type</span><Input disabled={readonly} value={String(form.pay_comp_type || "")} onChange={(event) => update("pay_comp_type", event.target.value)} /></label>
            <label className="field"><span>Earn/Ded</span><Select disabled={readonly} value={String(form.pay_comp_earn_ded || "")} onChange={(event) => update("pay_comp_earn_ded", event.target.value)}><option value="">Select</option><option value="E">Earning</option><option value="D">Deduction</option></Select></label>
            <label className="field"><span>Periodicity</span><Input disabled={readonly} value={String(form.periodicity || "")} onChange={(event) => update("periodicity", event.target.value)} /></label>
            <label className="field"><span>Taxable</span><Select disabled={readonly} value={String(form.taxable || "")} onChange={(event) => update("taxable", event.target.value)}><option value="">Select</option><option value="Y">Yes</option><option value="N">No</option></Select></label>
            <label className="field"><span>Status</span><Select disabled={readonly} value={String(form.status || "A")} onChange={(event) => update("status", event.target.value)}><option value="A">Active</option><option value="I">Inactive</option><option value="Y">Yes</option><option value="N">No</option></Select></label>
            <LookupField compact label="Division" value={String(form.div_code || "")} displayValue={[form.div_code, form.div_name].filter(Boolean).join(" - ")} columns={[{ field: "div_code", header: "Code" }, { field: "div_name", header: "Division" }]} valueField="div_code" displayFields={["div_code", "div_name"]} loadOptions={() => getDynamicLookup(baseParams("Account_division", loginid, companyCode))} disabled={readonly} onChange={(value, selectedRow) => setForm((current) => ({ ...current, div_code: value, div_name: text(selectedRow, "div_name") }))} />
            <label className="field xl:col-span-3"><span>Remarks</span><Input disabled={readonly} value={String(form.remarks || "")} onChange={(event) => update("remarks", event.target.value)} /></label>
          </CardContent>
        </Card>
        <DataTable columns={dependant ? dependantDetailColumns : unitDetailColumns} data={detailRows} subtitle={dependant ? "Dependent Rules" : "Component Dependencies"} title={`${detailRows.length} Detail Rows`} height={260} minWidth={dependant ? 980 : 820} density="grid" enablePagination pageSize={25} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}><X size={15} /> Close</Button>
          {!readonly && <Button disabled={saving} onClick={save}><Save size={15} /> {saving ? "Saving..." : "Save"}</Button>}
        </div>
      </div>
    </Dialog>
  );
}

const unitDetailColumns: ColumnDef<LookupRow>[] = [
  { accessorKey: "pay_comp_id_depend", header: "Depend Pay Unit", size: 170 },
  { accessorKey: "pay_comp_desc", header: "Description", size: 260 },
  { accessorKey: "percent", header: "Percent", size: 110 },
  { accessorKey: "sort_order", header: "Sort", size: 90 },
  { accessorKey: "country_name", header: "Country", size: 180 },
];

const dependantDetailColumns: ColumnDef<LookupRow>[] = [
  { accessorKey: "pay_comp_id_depend", header: "Depend Pay Unit", size: 170 },
  { accessorKey: "nationality", header: "Nationality", size: 180 },
  { accessorKey: "country_name", header: "Country", size: 180 },
  { accessorKey: "age", header: "Age", size: 90 },
  { accessorKey: "amt_limit", header: "Amount Limit", size: 140 },
  { accessorKey: "status", header: "Status", size: 110 },
  { accessorKey: "remarks", header: "Remarks", size: 240 },
];

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="m-0 flex items-center gap-2 text-2xl font-semibold text-foreground"><ShieldX className="text-primary" size={22} /> {title}</h1>
        <p className="m-0 mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function text(row: LookupRow | null | undefined, field: string) {
  if (!row) return "";
  return String(getLookupValue(row, field) || "");
}

function display(row: LookupRow | null, codeField: string, nameField: string) {
  if (!row) return "";
  return [text(row, codeField), text(row, nameField)].filter(Boolean).join(" - ");
}

function rowId(row: LookupRow) {
  return text(row, "employee_code") || text(row, "employee_id") || JSON.stringify(row);
}

function normalizeRow(row: LookupRow) {
  const next: LookupRow = { ...row };
  Object.entries(row || {}).forEach(([key, value]) => {
    next[key.toLowerCase()] = value;
  });
  return next;
}
