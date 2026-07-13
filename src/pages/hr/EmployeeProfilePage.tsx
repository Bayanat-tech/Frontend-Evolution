import { CalendarDays, IdCard, Mail, MapPin, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { getHrEmployees, type HrEmployee } from "../../api/hr";
import { Button } from "../../components/ui/Button";
import NoticeToast, { type ToastNotice } from "../../components/ui/NoticeToast";
import { useAuth } from "../../state/AuthContext";

export function EmployeeProfilePage() {
  const { user } = useAuth();
  const loginId = String(user?.loginid1 || user?.LOGINID1 || user?.loginid || user?.LOGINID || user?.username || "");
  const [employee, setEmployee] = useState<HrEmployee | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<ToastNotice>(null);

  const loadProfile = async () => {
    if (!loginId) {
      setNotice({ type: "error", message: "Login employee code is missing" });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const rows = await getHrEmployees(loginId);
      const currentEmployee = rows.find((row) => sameId(row.EMPLOYEE_ID, loginId) || sameId(row.EMPLOYEE_CODE, loginId)) || rows[0] || null;
      setEmployee(currentEmployee);
      if (!currentEmployee) setNotice({ type: "error", message: "No employee profile found for logged-in user" });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load employee profile" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [loginId]);

  const initials = useMemo(() => {
    const name = display(employee, ["RPT_NAME", "EMPLOYEE_NAME", "PASSPORT_NAME"]);
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "HR";
  }, [employee]);

  const status = display(employee, ["EMP_STATUS", "STATUS"]) || "Active";
  const name = display(employee, ["RPT_NAME", "EMPLOYEE_NAME", "PASSPORT_NAME"]) || "Employee Profile";
  const employeeCode = display(employee, ["EMPLOYEE_CODE", "EMPLOYEE_ID"]) || loginId;

  return (
    <section className="employee-profile-page">
      <div className="employee-profile-header">
        <div className="employee-profile-avatar">
          <UserRound size={22} />
        </div>
        <div className="min-w-0">
          <p className="leave-flow-eyebrow">HR Master</p>
          <h1>Employee Profile</h1>
          <p>{employee ? `${employeeCode} - ${name}` : "Logged-in employee profile"}</p>
        </div>
        <Button variant="outline" onClick={() => void loadProfile()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </Button>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <div className="employee-profile-shell">
        <aside className="employee-profile-summary">
          <div className="employee-profile-photo">{initials}</div>
          <h2>{name}</h2>
          <p>{employeeCode}</p>
          <span className={status.toLowerCase().includes("inactive") ? "employee-profile-status is-muted" : "employee-profile-status"}>
            <ShieldCheck size={14} /> {status}
          </span>
          <div className="employee-profile-contact">
            <ProfileLine icon={<IdCard size={15} />} label="Alternate ID" value={display(employee, ["ALTERNATE_ID"])} />
            <ProfileLine icon={<Mail size={15} />} label="Email" value={display(employee, ["EMAIL", "EMAIL_ID", "OFFICIAL_EMAIL"])} />
            <ProfileLine icon={<MapPin size={15} />} label="Nationality" value={display(employee, ["NATIONALITY", "COUNTRY"])} />
          </div>
        </aside>

        <div className="employee-profile-details">
          <ProfileSection
            title="Organization"
            fields={[
              ["Division", display(employee, ["DIV_NAME"])],
              ["Department", display(employee, ["DEPT_NAME"])],
              ["Section", display(employee, ["SECTION_NAME"])],
              ["Category", display(employee, ["CATEGORY_NAME"])],
            ]}
          />
          <ProfileSection
            title="Designation"
            fields={[
              ["Grade", display(employee, ["GRADE_NAME"])],
              ["Designation", display(employee, ["DESG_NAME"])],
              ["Formal Designation", display(employee, ["LABOUR_DESG_CODE", "DESG_CODE"])],
              ["Employee ID", display(employee, ["EMPLOYEE_ID"])],
            ]}
          />
          <ProfileSection
            title="Employment Dates"
            icon={<CalendarDays size={16} />}
            fields={[
              ["Date of Birth", formatDate(display(employee, ["DOB", "DATE_OF_BIRTH"]))],
              ["Date of Joining", formatDate(display(employee, ["JOIN_DATE"]))],
              ["Probation End Date", formatDate(display(employee, ["PROBATION_END_DATE"]))],
              ["Confirmation Date", formatDate(display(employee, ["PROBATION_CONFIRM_DATE"]))],
            ]}
          />
          <ProfileSection
            title="Approver Mapping"
            fields={[
              ["Immediate Supervisor", display(employee, ["IMMEDIATE_SUPERVISOR", "SUPERVISOR_EMPID"])],
              ["Department Head", display(employee, ["DEPT_HEAD", "DEPT_HEAD_EMPID"])],
              ["HOD", display(employee, ["HOD", "MANGR_EMPID"])],
              ["Company", display(employee, ["COMPANY_CODE", "COMPANY_NAME"])],
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function ProfileSection({ title, icon, fields }: { title: string; icon?: ReactNode; fields: Array<[string, string]> }) {
  return (
    <section className="employee-profile-card">
      <h3>{icon}{title}</h3>
      <div className="employee-profile-fields">
        {fields.map(([label, value]) => (
          <div key={label} className="employee-profile-field">
            <span>{label}</span>
            <strong>{value || "-"}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div>
      {icon}
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function display(row: HrEmployee | null, keys: string[]) {
  if (!row) return "";
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return "";
}

function sameId(value: unknown, loginId: string) {
  return String(value || "").trim() === loginId.trim();
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}
