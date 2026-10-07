import {
  AlertCircle,
  ChevronDown,
  Edit2,
  Eye,
  FileSpreadsheet,
  PenLine,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { pamsDelete, pamsSave, pamsSelect } from "../../api/pams";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";
import type { LookupRow } from "../../api/lookups";
import ImportKpiEdi from "./Importkpiedi";
import { useToast } from "../../components/ui/AlertToast";

type Row = Record<string, unknown>;

const KPI_ACTIVITY_TYPE_CODE = "00001";
const KPI_CHARACTERISTIC_TYPE_CODE = "00002";

type TabKey = "groups" | "activities" | "characteristic";
type AddMode = "manual" | "import";

type KpiForm = {
  KPI_CODE: string;
  KPI_TYPE_CODE: string;
  KPI_DESC: string;
  DIVISION_CODE: string;
  DEPARTMENT_CODE: string;
  SECTION_CODE: string;
  DESG_CODE: string;
  STANDARD_WEIGHTAGE: number;
};

type Activity = { srno: number; desc: string };

type DesignationGroup = {
  key: string;
  designationLabel: string;
  rows: Row[];
  totalWeightage: number;
};

export type DesignationInfo = {
  divCode: string;
  divName: string;
  deptCode: string;
  deptName: string;
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function number(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRow(row: Row): Row {
  const normalized: Row = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    normalized[key] = value;
    normalized[key.toUpperCase()] = value;
    normalized[key.toLowerCase()] = value;
  });
  return normalized;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  return String(value);
}

function orgLabel(row: Row, codeKey: string, nameKey: string): string {
  const code = text(row[codeKey]);
  const name = text(row[nameKey]);
  if (code && name) return `${code} - ${name}`;
  return code || name || "-";
}

function displayLookup(list: Row[], codeKey: string, nameKey: string, code: string): string {
  if (!code) return "";
  const found = list.find((r) => text(r[codeKey]) === code);
  if (!found) return code;
  const name = text(found[nameKey]);
  if (!name) return code;
  if (name.startsWith(code)) return name;
  return `${code} - ${name}`;
}

function splitActivities(value: unknown): string[] {
  const raw = text(value);
  if (!raw) return [];
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

function findDuplicateActivityIndices(activities: Activity[]): number[] {
  const seen = new Map<string, number>();
  const dupIdx = new Set<number>();

  activities.forEach((act, idx) => {
    const key = act.desc.trim().toLowerCase();
    if (!key) return;
    if (seen.has(key)) {
      dupIdx.add(seen.get(key)!);
      dupIdx.add(idx);
    } else {
      seen.set(key, idx);
    }
  });

  return Array.from(dupIdx).sort((a, b) => a - b);
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Async fetchers
// ─────────────────────────────────────────────────────────────
async function fetchKpiTypes(loginid: string, companyCode: string): Promise<Row[]> {
  try {
    const data = await pamsSelect({ parameter: "kpi_type", loginid, code1: companyCode });
    return data.map(normalizeRow);
  } catch {
    return [];
  }
}

async function fetchDivisions(loginid: string, companyCode: string): Promise<Row[]> {
  try {
    const data = await pamsSelect({ parameter: "employee_division", loginid, code1: companyCode });
    return data.map(normalizeRow).filter((r) => text(r.DIV_CODE).toUpperCase() !== "ALL");
  } catch {
    return [];
  }
}

async function fetchDepartments(
  loginid: string,
  companyCode: string,
  divCode: string
): Promise<Row[]> {
  if (!divCode) return [];
  try {
    const data = await pamsSelect({
      parameter: "employee_department",
      loginid,
      code1: companyCode,
      code2: divCode,
    });
    return data.map(normalizeRow).filter((r) => text(r.DEPT_CODE).toUpperCase() !== "ALL");
  } catch {
    return [];
  }
}

async function fetchDesignations(
  loginid: string,
  companyCode: string,
  divCode: string,
  deptCode: string
): Promise<Row[]> {
  if (!divCode || !deptCode) return [];
  try {
    const data = await pamsSelect({
      parameter: "employee_designation",
      loginid,
      code1: companyCode,
      code2: divCode,
      code3: deptCode,
      code4: "All",
    });
    return data.map(normalizeRow).filter((r) => text(r.DESG_CODE).toUpperCase() !== "ALL");
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
export function KpiGroupPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleteCheckLoading, setDeleteCheckLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>("groups");
  const isGroupsTab = activeTab === "groups";
  const isActivitiesTab = activeTab === "activities";
  const isCharacteristicTab = activeTab === "characteristic";

  const [addMode, setAddMode] = useState<AddMode>("manual");

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedDivisionLabel, setSelectedDivisionLabel] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDepartmentLabel, setSelectedDepartmentLabel] = useState("");

  const [duplicateIndices, setDuplicateIndices] = useState<number[]>([]);

  const [form, setForm] = useState<KpiForm>({
    KPI_CODE: "",
    KPI_TYPE_CODE: "",
    KPI_DESC: "",
    DIVISION_CODE: "",
    DEPARTMENT_CODE: "",
    SECTION_CODE: "",
    DESG_CODE: "",
    STANDARD_WEIGHTAGE: 0,
  });

  const [kpiTypeList, setKpiTypeList] = useState<Row[]>([]);
  const [divisionList, setDivisionList] = useState<Row[]>([]);
  const [departmentList, setDepartmentList] = useState<Row[]>([]);
  const [designationList, setDesignationList] = useState<Row[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [designationLookup, setDesignationLookup] = useState<
    Record<string, DesignationInfo>
  >({});

  const tabTypeCode = isCharacteristicTab
    ? KPI_CHARACTERISTIC_TYPE_CODE
    : KPI_ACTIVITY_TYPE_CODE;

  // ═════════════════════════════════════════════════════════
  // LOAD ROWS
  // ═════════════════════════════════════════════════════════
  const loadRows = async () => {
    setLoading(true);
    try {
      const data = await pamsSelect({ parameter: "kpi", loginid, code1: companyCode });
      setRows(data.map(normalizeRow));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load KPI Groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginid, companyCode]);

  useEffect(() => {
    void (async () => {
      const divs = await fetchDivisions(loginid, companyCode);
      setDivisionList(divs);
    })();
  }, [loginid, companyCode]);

  useEffect(() => {
    void (async () => {
      try {
        const map: Record<string, DesignationInfo> = {};
        const divs = await fetchDivisions(loginid, companyCode);

        for (const dv of divs) {
          const divCode = text(dv.DIV_CODE);
          const divName = text(dv.DIV_NAME);
          if (!divCode) continue;

          const depts = await fetchDepartments(loginid, companyCode, divCode);
          for (const dp of depts) {
            const deptCode = text(dp.DEPT_CODE);
            const deptName = text(dp.DEPT_NAME);
            if (!deptCode) continue;

            const desgs = await fetchDesignations(loginid, companyCode, divCode, deptCode);
            for (const dg of desgs) {
              const desgCode = text(dg.DESG_CODE);
              if (!desgCode) continue;
              if (!map[desgCode]) {
                map[desgCode] = { divCode, divName, deptCode, deptName };
              }
            }
          }
        }

        setDesignationLookup(map);
      } catch {
        setDesignationLookup({});
      }
    })();
  }, [loginid, companyCode]);

  useEffect(() => {
    if (divisionList.length > 0 && !selectedDivision) {
      const first = divisionList[0];
      const code = text(first.DIV_CODE);
      setSelectedDivision(code);
      setSelectedDivisionLabel(`${code} - ${text(first.DIV_NAME)}`);
    }
  }, [divisionList, selectedDivision]);

  useEffect(() => {
    if (!selectedDivision) {
      setDepartmentList([]);
      setSelectedDepartment("");
      setSelectedDepartmentLabel("");
      return;
    }
    void (async () => {
      const depts = await fetchDepartments(loginid, companyCode, selectedDivision);
      setDepartmentList(depts);
      if (depts.length > 0) {
        const first = depts[0];
        const code = text(first.DEPT_CODE);
        setSelectedDepartment(code);
        setSelectedDepartmentLabel(`${code} - ${text(first.DEPT_NAME)}`);
      } else {
        setSelectedDepartment("");
        setSelectedDepartmentLabel("");
      }
    })();
  }, [selectedDivision, loginid, companyCode]);

  const filteredRows = useMemo(() => {
    if (!selectedDivision || !selectedDepartment) return [];
    return rows.filter((r) => {
      const div = text(r.DIVISION_CODE ?? r.DIV_CODE);
      const dept = text(r.DEPARTMENT_CODE ?? r.DEPT_CODE);
      const typeCode = text(r.KPI_TYPE_CODE);
      return div === selectedDivision && dept === selectedDepartment && typeCode === tabTypeCode;
    });
  }, [rows, selectedDivision, selectedDepartment, tabTypeCode]);

  const designationGroups = useMemo<DesignationGroup[]>(() => {
    const map = new Map<string, DesignationGroup>();
    filteredRows.forEach((r) => {
      const code = text(r.DESG_CODE);
      const name = text(r.DESG_NAME);
      if (!code && !name) return;
      const key = `${code}__${name}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          designationLabel: orgLabel(r, "DESG_CODE", "DESG_NAME"),
          rows: [],
          totalWeightage: 0,
        });
      }
      const g = map.get(key)!;
      g.rows.push(r);
      g.totalWeightage += number(r.STANDARD_WEIGHTAGE);
    });
    return Array.from(map.values()).sort((a, b) =>
      a.designationLabel.localeCompare(b.designationLabel)
    );
  }, [filteredRows]);

  const isExpanded = (key: string) => expandedGroups[key] !== false;
  const toggleGroup = (key: string) => {
    const current = expandedGroups[key] !== false;
    setExpandedGroups((prev) => ({ ...prev, [key]: !current }));
  };

  const grandTotal = useMemo(
    () => filteredRows.reduce((s, r) => s + number(r.STANDARD_WEIGHTAGE), 0),
    [filteredRows]
  );

  // ═════════════════════════════════════════════════════════
  // ACTIVITY HANDLERS
  // ═════════════════════════════════════════════════════════
  const addActivity = () => setActivities((p) => [...p, { srno: 0, desc: "" }]);

  const updateActivity = (idx: number, desc: string) =>
    setActivities((prev) => {
      const next = prev.map((a, i) => (i === idx ? { ...a, desc } : a));
      setDuplicateIndices(findDuplicateActivityIndices(next));
      return next;
    });

  const removeActivity = (idx: number) =>
    setActivities((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setDuplicateIndices(findDuplicateActivityIndices(next));
      return next;
    });

  const loadActivities = async (kpiCode: string) => {
    if (!kpiCode) {
      setActivities([]);
      return;
    }
    try {
      const data = await pamsSelect({
        parameter: "kpi_item_page",
        loginid,
        code1: companyCode,
        code2: kpiCode,
      });
      setActivities(
        data.map((r: Row) => ({
          srno: Number(r.KPI_ITEM_SRNO ?? 0),
          desc: text(r.KPI_ITEM_DESC),
        }))
      );
    } catch {
      setActivities([]);
    }
  };

  // ═════════════════════════════════════════════════════════
  // CASCADING HANDLERS
  // ═════════════════════════════════════════════════════════
  const onDivisionChange = async (divCode: string) => {
    setForm((prev) => ({ ...prev, DIVISION_CODE: divCode, DEPARTMENT_CODE: "", DESG_CODE: "" }));
    setDepartmentList([]);
    setDesignationList([]);
    if (divCode) {
      const depts = await fetchDepartments(loginid, companyCode, divCode);
      setDepartmentList(depts);
    }
  };

  const onDepartmentChange = async (deptCode: string) => {
    setForm((prev) => ({ ...prev, DEPARTMENT_CODE: deptCode, DESG_CODE: "" }));
    setDesignationList([]);
    if (deptCode && form.DIVISION_CODE) {
      const desgs = await fetchDesignations(loginid, companyCode, form.DIVISION_CODE, deptCode);
      setDesignationList(desgs);
    }
  };

  // ═════════════════════════════════════════════════════════
  // OPEN ADD
  // ═════════════════════════════════════════════════════════
  const openAdd = async () => {
    setEditMode(false);
    setViewMode(false);
    setAddMode("manual");
    setDuplicateIndices([]);
    setActivities([]);

    const kpis = await fetchKpiTypes(loginid, companyCode);
    setKpiTypeList(kpis);

    let divCode = selectedDivision;
    if (!divCode && divisionList.length > 0) divCode = text(divisionList[0].DIV_CODE);

    const depts = divCode ? await fetchDepartments(loginid, companyCode, divCode) : [];
    setDepartmentList(depts);

    let deptCode = selectedDepartment;
    if (!deptCode && depts.length > 0) deptCode = text(depts[0].DEPT_CODE);

    const desgs =
      divCode && deptCode
        ? await fetchDesignations(loginid, companyCode, divCode, deptCode)
        : [];
    setDesignationList(desgs);

    setForm({
      KPI_CODE: "",
      KPI_TYPE_CODE: tabTypeCode,
      KPI_DESC: "",
      DIVISION_CODE: divCode,
      DEPARTMENT_CODE: deptCode,
      SECTION_CODE: "",
      DESG_CODE: "",
      STANDARD_WEIGHTAGE: 0,
    });

    setFormOpen(true);
  };

  const openEdit = async (row: Row) => {
    const divCode = text(row.DIVISION_CODE ?? row.DIV_CODE);
    const deptCode = text(row.DEPARTMENT_CODE ?? row.DEPT_CODE);

    setEditMode(true);
    setViewMode(false);
    setAddMode("manual");
    setDuplicateIndices([]);

    const kpis = await fetchKpiTypes(loginid, companyCode);
    setKpiTypeList(kpis);

    const depts = divCode ? await fetchDepartments(loginid, companyCode, divCode) : [];
    setDepartmentList(depts);

    const desgs =
      divCode && deptCode
        ? await fetchDesignations(loginid, companyCode, divCode, deptCode)
        : [];
    setDesignationList(desgs);

    setForm({
      KPI_CODE: text(row.KPI_CODE),
      KPI_TYPE_CODE: text(row.KPI_TYPE_CODE) || tabTypeCode,
      KPI_DESC: text(row.KPI_DESC),
      DIVISION_CODE: divCode,
      DEPARTMENT_CODE: deptCode,
      SECTION_CODE: text(row.SECTION_CODE),
      DESG_CODE: text(row.DESG_CODE),
      STANDARD_WEIGHTAGE: number(row.STANDARD_WEIGHTAGE),
    });

    setFormOpen(true);
    if (text(row.KPI_TYPE_CODE) === KPI_ACTIVITY_TYPE_CODE) {
      await loadActivities(text(row.KPI_CODE));
    }
  };

  const openView = async (row: Row) => {
    const divCode = text(row.DIVISION_CODE ?? row.DIV_CODE);
    const deptCode = text(row.DEPARTMENT_CODE ?? row.DEPT_CODE);

    setEditMode(false);
    setViewMode(true);
    setAddMode("manual");
    setDuplicateIndices([]);

    const kpis = await fetchKpiTypes(loginid, companyCode);
    setKpiTypeList(kpis);

    const depts = divCode ? await fetchDepartments(loginid, companyCode, divCode) : [];
    setDepartmentList(depts);

    const desgs =
      divCode && deptCode
        ? await fetchDesignations(loginid, companyCode, divCode, deptCode)
        : [];
    setDesignationList(desgs);

    setForm({
      KPI_CODE: text(row.KPI_CODE),
      KPI_TYPE_CODE: text(row.KPI_TYPE_CODE) || tabTypeCode,
      KPI_DESC: text(row.KPI_DESC),
      DIVISION_CODE: divCode,
      DEPARTMENT_CODE: deptCode,
      SECTION_CODE: text(row.SECTION_CODE),
      DESG_CODE: text(row.DESG_CODE),
      STANDARD_WEIGHTAGE: number(row.STANDARD_WEIGHTAGE),
    });

    setFormOpen(true);
    if (text(row.KPI_TYPE_CODE) === KPI_ACTIVITY_TYPE_CODE) {
      await loadActivities(text(row.KPI_CODE));
    }
  };

  const updateField = (name: keyof KpiForm, value: string | number) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ═════════════════════════════════════════════════════════
  // SAVE
  // ═════════════════════════════════════════════════════════
  const saveRecord = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.KPI_TYPE_CODE.trim()) { toast.warning("KPI Type Code is required"); return; }
    if (!form.DIVISION_CODE.trim()) { toast.warning("Division is required"); return; }
    if (!form.DEPARTMENT_CODE.trim()) { toast.warning("Department is required"); return; }
    if (!form.DESG_CODE.trim()) { toast.warning("Designation is required"); return; }
    if (!form.KPI_DESC.trim()) { toast.warning("KPI Description is required"); return; }

    if (form.KPI_TYPE_CODE === KPI_ACTIVITY_TYPE_CODE) {
      const validActivities = activities.filter((a) => a.desc.trim());
      if (validActivities.length < 3) {
        toast.warning(`Minimum 3 KPI Items (Activities) required. Currently: ${validActivities.length}`);
        return;
      }
      if (validActivities.length > 6) {
        toast.warning(`Maximum 6 KPI Items (Activities) allowed. Currently: ${validActivities.length}`);
        return;
      }

      const dupIndices = findDuplicateActivityIndices(activities);
      if (dupIndices.length > 0) {
        setDuplicateIndices(dupIndices);
        const dupNames = Array.from(
          new Set(dupIndices.map((i) => activities[i]?.desc.trim()).filter(Boolean))
        );
        toast.warning(
          `Duplicate activities not allowed. Please remove duplicate(s): ${dupNames.join(", ")}`
        );
        return;
      }
    }

    setDuplicateIndices([]);
    setSaving(true);

    try {
      await pamsSave({
        parameter: "kpi_ins_upd",
        loginid,
        val1s1: form.KPI_CODE,
        val1s2: form.KPI_DESC,
        val1s3: form.KPI_TYPE_CODE,
        val1s4: companyCode,
        val1s5: form.DIVISION_CODE,
        val1s6: form.DEPARTMENT_CODE,
        val1s7: form.SECTION_CODE,
        val1s8: form.DESG_CODE,
        val1n1: form.STANDARD_WEIGHTAGE,
      });

      let kpiCode = form.KPI_CODE;
      if (!kpiCode) {
        const refreshed = await pamsSelect({ parameter: "kpi", loginid, code1: companyCode });
        const matches = refreshed
          .map(normalizeRow)
          .filter(
            (r) =>
              text(r.KPI_DESC) === form.KPI_DESC &&
              text(r.DIVISION_CODE) === form.DIVISION_CODE &&
              text(r.DEPARTMENT_CODE) === form.DEPARTMENT_CODE &&
              text(r.DESG_CODE) === form.DESG_CODE
          )
          .sort((a, b) => Number(text(b.KPI_CODE)) - Number(text(a.KPI_CODE)));

        kpiCode = matches.length > 0 ? text(matches[0].KPI_CODE) : "";
      }

      if (kpiCode && form.KPI_TYPE_CODE === KPI_ACTIVITY_TYPE_CODE) {
        if (editMode) {
          await pamsSave({
            parameter: "kpi_item_delete_all",
            loginid,
            val1s1: companyCode,
            val1s2: kpiCode,
          });
        }
        let srno = 1;
        for (const act of activities) {
          if (!act.desc.trim()) continue;
          await pamsSave({
            parameter: "kpi_item_ins_upd",
            loginid,
            val1s1: companyCode,
            val1s2: kpiCode,
            val1s3: act.desc,
            val1n1: srno,
          });
          srno++;
        }
      }

      setFormOpen(false);
      toast.success(editMode ? "Record updated successfully" : "Record added successfully");
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  // ═════════════════════════════════════════════════════════
  // DELETE — single call to safe_delete_kpi
  // ═════════════════════════════════════════════════════════
  const handleDeleteClick = async (row: Row) => {
    const kpiCode = text(row.KPI_CODE);
    const kpiDesc = text(row.KPI_DESC);
    const kpiTypeCode = text(row.KPI_TYPE_CODE);

    setDeleteCheckLoading(true);
    try {
      const result = await pamsSelect({
        parameter: "safe_delete_kpi",
        loginid,
        code1: companyCode,
        code2: kpiCode,
        code3: kpiTypeCode,
      });

      const res = String(
        (result?.[0] as Record<string, unknown>)?.RESULT ?? ""
      );

      if (res.toUpperCase().startsWith("ERROR_DOC_EXISTS")) {
        setDeleteTarget(row);
        return;
      }
      if (res.toUpperCase().startsWith("ERROR")) {
        throw new Error(res.replace(/^ERROR:\s*/i, ""));
      }

      toast.success(`"${kpiDesc || kpiCode}" deleted successfully`);
      await loadRows();
    } catch (error: any) {
      const raw = String(error?.message || error?.details || error || "");
      toast.error(
        raw.length > 200 ? raw.slice(0, 200) + "..." : raw || "Unable to delete"
      );
    } finally {
      setDeleteCheckLoading(false);
    }
  };

  const confirmDelete = async () => {
    setDeleteTarget(null);
  };

  const kpiTypeOptions = kpiTypeList.map(normalizeRow);
  const divisionOptions = divisionList.map(normalizeRow);
  const deptOptions = departmentList.map(normalizeRow);
  const desgOptions = designationList.map(normalizeRow);

  const addButtonLabel = isCharacteristicTab ? "Add Characteristic" : "Add KPI";
  const tableTitle = isGroupsTab
    ? "KPI Groups"
    : isActivitiesTab
      ? "KPI Activity"
      : "Characteristic";

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">KPI Item</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select division, department, and manage items group-wise by designation.
          </p>
        </div>
      </div>

      <Card className="shrink-0">
        <CardContent className="mt-2 grid gap-3 pt-4 md:grid-cols-3">
          <Field label="Division" required>
            <LookupField
              compact
              label="Division"
              value={selectedDivision}
              displayValue={selectedDivisionLabel}
              placeholder="Select Division"
              columns={[
                { field: "DIV_CODE", header: "Code" },
                { field: "DIV_NAME", header: "Name" },
              ]}
              valueField="DIV_CODE"
              displayFields={["DIV_CODE", "DIV_NAME"]}
              loadOptions={async () => divisionOptions as LookupRow[]}
              onChange={(val, row) => {
                setSelectedDivision(val);
                setSelectedDivisionLabel(row ? `${val} - ${text(row.DIV_NAME)}` : val);
              }}
            />
          </Field>

          <Field label="Department" required>
            <LookupField
              compact
              label="Department"
              value={selectedDepartment}
              displayValue={selectedDepartmentLabel}
              placeholder={!selectedDivision ? "Select Division first" : "Select Department"}
              disabled={!selectedDivision}
              columns={[
                { field: "DEPT_CODE", header: "Code" },
                { field: "DEPT_NAME", header: "Name" },
              ]}
              valueField="DEPT_CODE"
              displayFields={["DEPT_CODE", "DEPT_NAME"]}
              loadOptions={async () => deptOptions as LookupRow[]}
              onChange={(val, row) => {
                setSelectedDepartment(val);
                setSelectedDepartmentLabel(row ? `${val} - ${text(row.DEPT_NAME)}` : val);
              }}
            />
          </Field>

          <Field label="View" required>
            <div className="flex flex-wrap gap-1 rounded-md border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("groups")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "groups"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                KPI Groups
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("activities")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "activities"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                KPI Activities
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("characteristic")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "characteristic"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Characteristic
              </button>
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="shrink-0 border-b border-slate-200/70 px-4 py-2.5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <h2 className="m-0 text-sm font-semibold text-foreground">{tableTitle}</h2>
              <p className="m-0 truncate text-[11px] text-muted-foreground">
                {selectedDivision && selectedDepartment
                  ? `${selectedDivisionLabel} · ${selectedDepartmentLabel}`
                  : "Select division and department to load items"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload size={15} /> Import from Excel
              </Button>
              <Button onClick={openAdd}>
                <Plus size={15} /> {addButtonLabel}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 p-0">
          <div className="h-full overflow-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="w-14 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    S.No
                  </th>
                  <th className="w-12 px-2 py-2.5" />
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {isActivitiesTab
                      ? "KPI Description"
                      : isCharacteristicTab
                        ? "Characteristic"
                        : "Designation · KPI Description"}
                  </th>
                  {isActivitiesTab && (
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      KPI Activities
                    </th>
                  )}
                  <th className="w-32 px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Weightage %
                  </th>
                  <th className="w-28 px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={isActivitiesTab ? 6 : 5}
                      className="px-3 py-14 text-center text-muted-foreground"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : !selectedDivision || !selectedDepartment ? (
                  <tr>
                    <td
                      colSpan={isActivitiesTab ? 6 : 5}
                      className="px-3 py-14 text-center text-muted-foreground"
                    >
                      Select division and department to load rows.
                    </td>
                  </tr>
                ) : designationGroups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isActivitiesTab ? 6 : 5}
                      className="px-3 py-14 text-center text-muted-foreground"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  designationGroups.map((group, gIdx) => {
                    const expanded = isExpanded(group.key);
                    return (
                      <Fragment key={group.key}>
                        <tr className="border-b border-slate-100 bg-slate-50/60 align-top dark:border-slate-800/70 dark:bg-slate-900/40">
                          <td className="px-3 py-3 text-center text-xs font-medium text-muted-foreground">
                            {gIdx + 1}
                          </td>
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              onClick={() => toggleGroup(group.key)}
                              className={`grid h-6 w-6 place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-background ${
                                expanded ? "border-border bg-background text-primary" : ""
                              }`}
                              title={expanded ? "Collapse" : "Expand"}
                            >
                              <ChevronDown
                                size={13}
                                className={
                                  expanded ? "rotate-180 transition-transform" : "transition-transform"
                                }
                              />
                            </button>
                          </td>
                          <td
                            className="cursor-pointer select-none px-3 py-3"
                            colSpan={isActivitiesTab ? 2 : 1}
                            onClick={() => toggleGroup(group.key)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold text-foreground">
                                {group.designationLabel}
                              </span>
                              <span className="rounded-full bg-slate-100 px-1.5 py-[1px] text-[9px] font-semibold text-slate-500 dark:bg-slate-800">
                                {group.rows.length}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              {group.totalWeightage}
                            </span>
                          </td>
                          <td />
                        </tr>

                        {expanded &&
                          group.rows.map((row, rIdx) => {
                            const items = splitActivities(row.KPI_ITEMS ?? row.kpi_items);
                            return (
                              <tr
                                key={`${group.key}__${rIdx}`}
                                className="group border-b border-slate-100 align-top transition-colors hover:bg-primary/[0.04] dark:border-slate-800/70"
                              >
                                <td />
                                <td />
                                <td className="px-3 py-2.5">
                                  <div className="flex items-start gap-2 pl-6">
                                    <span className="mt-[2px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
                                      {rIdx + 1}
                                    </span>
                                    <span className="text-[13px] text-foreground">
                                      {text(row.KPI_DESC) || "—"}
                                    </span>
                                  </div>
                                </td>

                                {isActivitiesTab && (
                                  <td className="px-3 py-2.5">
                                    {items.length > 0 ? (
                                      <div className="grid gap-0.5">
                                        {items.map((it, i) => (
                                          <div
                                            key={i}
                                            className="flex items-start gap-1.5 text-xs text-muted-foreground"
                                          >
                                            <span className="mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-slate-100 text-[9px] font-semibold text-slate-500 dark:bg-slate-800">
                                              {i + 1}
                                            </span>
                                            <span className="whitespace-normal break-words leading-snug">
                                              {it}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </td>
                                )}

                                <td className="px-3 py-2.5 text-right">
                                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                                    {formatValue(row.STANDARD_WEIGHTAGE) || "—"}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex justify-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                                    <button
                                      type="button"
                                      title="View"
                                      onClick={() => void openView(row)}
                                      className="grid h-7 w-7 place-items-center rounded-md border border-transparent text-slate-500 transition-colors hover:border-border hover:bg-background hover:text-primary"
                                    >
                                      <Eye size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      title="Edit"
                                      onClick={() => void openEdit(row)}
                                      className="grid h-7 w-7 place-items-center rounded-md border border-transparent text-slate-500 transition-colors hover:border-border hover:bg-background hover:text-primary"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      title="Delete"
                                      onClick={() => void handleDeleteClick(row)}
                                      disabled={deleteCheckLoading || saving}
                                      className="grid h-7 w-7 place-items-center rounded-md border border-transparent text-slate-400 transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </Fragment>
                    );
                  })
                )}
              </tbody>

              {!loading && designationGroups.length > 0 && (
                <tfoot className="sticky bottom-0 bg-slate-50 dark:bg-slate-900">
                  <tr className="border-t border-slate-200 dark:border-slate-800">
                    <td
                      colSpan={isActivitiesTab ? 4 : 3}
                      className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Total Weightage
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-flex items-center rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
                        {grandTotal}
                      </span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={importOpen}
        wide
        title="Import from Excel"
        description="Upload an Excel file with columns DESG_CODE, DESG_NAME, KPI_GROUP, WEIGHTAGE, KPI_ACTIVITY."
        onClose={() => setImportOpen(false)}
      >
        <ImportKpiEdi
          designationLookup={designationLookup}
          divisionCode={selectedDivision}
          divisionName={selectedDivisionLabel}
          departmentCode={selectedDepartment}
          departmentName={selectedDepartmentLabel}
          onClose={() => setImportOpen(false)}
          onSuccess={async () => {
            setImportOpen(false);
            toast.success("Records imported successfully.");
            await loadRows();
          }}
        />
      </Dialog>

      <Dialog
        open={formOpen}
        wide
        title={viewMode ? "View" : editMode ? "Edit" : addButtonLabel}
        description={
          editMode || viewMode
            ? "Maintain item setup."
            : "Choose Division & Department, then pick a mode below."
        }
        onClose={() => setFormOpen(false)}
      >
        <div className="grid gap-4">
          <Card>
            <CardHeader className="border-b bg-muted/30">
              <div>
                <p className="eyebrow">Scope</p>
                <h2 className="m-0 text-sm font-semibold">Division &amp; Department</h2>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-2">
              <Field label="Division" required>
                <LookupField
                  compact
                  disabled={viewMode || editMode}
                  label="Division"
                  value={form.DIVISION_CODE}
                  displayValue={displayLookup(
                    divisionOptions,
                    "DIV_CODE",
                    "DIV_NAME",
                    form.DIVISION_CODE
                  )}
                  placeholder="Select Division"
                  columns={[
                    { field: "DIV_CODE", header: "Code" },
                    { field: "DIV_NAME", header: "Name" },
                  ]}
                  valueField="DIV_CODE"
                  displayFields={["DIV_CODE", "DIV_NAME"]}
                  loadOptions={async () => divisionOptions as LookupRow[]}
                  onChange={(val) => void onDivisionChange(val)}
                />
              </Field>

              <Field label="Department" required>
                <LookupField
                  compact
                  disabled={viewMode || editMode || !form.DIVISION_CODE}
                  label="Department"
                  value={form.DEPARTMENT_CODE}
                  displayValue={displayLookup(
                    deptOptions,
                    "DEPT_CODE",
                    "DEPT_NAME",
                    form.DEPARTMENT_CODE
                  )}
                  placeholder={
                    !form.DIVISION_CODE ? "Select Division first" : "Select Department"
                  }
                  columns={[
                    { field: "DEPT_CODE", header: "Code" },
                    { field: "DEPT_NAME", header: "Name" },
                  ]}
                  valueField="DEPT_CODE"
                  displayFields={["DEPT_CODE", "DEPT_NAME"]}
                  loadOptions={async () => deptOptions as LookupRow[]}
                  onChange={(val) => void onDepartmentChange(val)}
                />
              </Field>
            </CardContent>
          </Card>

          {!editMode && !viewMode && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setAddMode("manual")}
                className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                  addMode === "manual"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors ${
                    addMode === "manual"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <PenLine size={18} />
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-sm font-semibold text-foreground">Manual Entry</p>
                  <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                    Add designation, KPI details and activities manually
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAddMode("import")}
                className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                  addMode === "import"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors ${
                    addMode === "import"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <FileSpreadsheet size={18} />
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-sm font-semibold text-foreground">Import from Excel</p>
                  <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                    Upload an Excel file and stage it in bulk
                  </p>
                </div>
              </button>
            </div>
          )}

          {addMode === "import" && !editMode && !viewMode ? (
            <ImportKpiEdi
              designationLookup={designationLookup}
              divisionCode={form.DIVISION_CODE}
              divisionName={displayLookup(
                divisionOptions,
                "DIV_CODE",
                "DIV_NAME",
                form.DIVISION_CODE
              )}
              departmentCode={form.DEPARTMENT_CODE}
              departmentName={displayLookup(
                deptOptions,
                "DEPT_CODE",
                "DEPT_NAME",
                form.DEPARTMENT_CODE
              )}
              onClose={() => setFormOpen(false)}
              onSuccess={async () => {
                setFormOpen(false);
                toast.success("Records imported successfully.");
                await loadRows();
              }}
            />
          ) : (
            <form className="grid gap-4" onSubmit={saveRecord}>
              <Card>
                <CardHeader className="border-b bg-muted/30">
                  <div>
                    <p className="eyebrow">Details</p>
                    <h2 className="m-0 text-sm font-semibold">
                      {form.KPI_TYPE_CODE === KPI_ACTIVITY_TYPE_CODE
                        ? "KPI Information"
                        : "Characteristic Information"}
                    </h2>
                  </div>
                </CardHeader>

                <CardContent className="grid gap-4 pt-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field label="Designation" required>
                      <LookupField
                        compact
                        disabled={viewMode || editMode || !form.DEPARTMENT_CODE}
                        label="Designation"
                        value={form.DESG_CODE}
                        displayValue={displayLookup(
                          desgOptions,
                          "DESG_CODE",
                          "DESG_NAME",
                          form.DESG_CODE
                        )}
                        placeholder={
                          !form.DIVISION_CODE
                            ? "Select Division first"
                            : !form.DEPARTMENT_CODE
                              ? "Select Department first"
                              : "Select Designation"
                        }
                        columns={[
                          { field: "DESG_CODE", header: "Code" },
                          { field: "DESG_NAME", header: "Name" },
                        ]}
                        valueField="DESG_CODE"
                        displayFields={["DESG_CODE", "DESG_NAME"]}
                        loadOptions={async () => desgOptions as LookupRow[]}
                        onChange={(val) => updateField("DESG_CODE", val)}
                      />
                    </Field>

                    <Field label="KPI Type Code" required>
                      <LookupField
                        compact
                        disabled={viewMode || editMode}
                        label="KPI Type Code"
                        value={form.KPI_TYPE_CODE}
                        displayValue={displayLookup(
                          kpiTypeOptions,
                          "KPI_TYPE_CODE",
                          "KPI_TYPE_DESC",
                          form.KPI_TYPE_CODE
                        )}
                        placeholder="Select KPI Type"
                        columns={[
                          { field: "KPI_TYPE_CODE", header: "Code" },
                          { field: "KPI_TYPE_DESC", header: "Description" },
                        ]}
                        valueField="KPI_TYPE_CODE"
                        displayFields={["KPI_TYPE_CODE", "KPI_TYPE_DESC"]}
                        loadOptions={async () =>
                          kpiTypeOptions.filter(
                            (o) => text(o.KPI_TYPE_CODE) === tabTypeCode
                          ) as LookupRow[]
                        }
                        onChange={(val) => updateField("KPI_TYPE_CODE", val)}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <Field label="Standard Weightage">
                      <Input
                        disabled={viewMode}
                        type="number"
                        value={form.STANDARD_WEIGHTAGE}
                        onChange={(e) =>
                          updateField("STANDARD_WEIGHTAGE", Number(e.target.value || 0))
                        }
                        min={0}
                        max={100}
                        placeholder="Enter weightage"
                      />
                    </Field>

                    <div className="lg:col-span-2">
                      <Field
                        label={
                          form.KPI_TYPE_CODE === KPI_ACTIVITY_TYPE_CODE
                            ? "KPI Description (KPI Group)"
                            : "Characteristic Description"
                        }
                        required
                      >
                        <textarea
                          disabled={viewMode}
                          className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                          value={form.KPI_DESC}
                          onChange={(e) => updateField("KPI_DESC", e.target.value)}
                          placeholder={
                            form.KPI_TYPE_CODE === KPI_ACTIVITY_TYPE_CODE
                              ? "Enter KPI description"
                              : "Enter characteristic description"
                          }
                        />
                      </Field>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {form.KPI_TYPE_CODE === KPI_ACTIVITY_TYPE_CODE && (
                <Card>
                  <CardHeader className="border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                      <p className="eyebrow">Activities / KPI Items</p>
                      {!viewMode && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={addActivity}
                          disabled={activities.length >= 6}
                          className="gap-1"
                        >
                          <Plus size={14} /> Add Activity
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4">
                    {activities.length === 0 ? (
                      <p className="rounded-md bg-muted/30 py-4 text-center text-sm text-muted-foreground">
                        No activities added. Click "Add Activity" to add.
                      </p>
                    ) : (
                      <div className="grid gap-2">
                        {activities.map((act, idx) => {
                          const isDup = duplicateIndices.includes(idx);
                          return (
                            <div
                              key={idx}
                              className={`flex items-center gap-2 rounded-md border p-2 ${
                                isDup ? "border-red-400 bg-red-50" : "bg-background"
                              }`}
                            >
                              <span className="w-6 text-right text-xs text-muted-foreground">
                                {idx + 1}.
                              </span>
                              <Input
                                value={act.desc}
                                disabled={viewMode}
                                onChange={(e) => updateActivity(idx, e.target.value)}
                                placeholder="Enter activity description"
                                className={isDup ? "border-red-400 focus:ring-red-400" : ""}
                              />
                              {!viewMode && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeActivity(idx)}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              )}
                            </div>
                          );
                        })}

                        {duplicateIndices.length > 0 && !viewMode && (
                          <div className="mt-1 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                            <span>
                              Duplicate activities found. Please remove or edit the highlighted
                              item(s) before saving.
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  <X size={15} /> Cancel
                </Button>
                {!viewMode && (
                  <Button type="submit">
                    <Save size={15} /> {saving ? "Saving..." : "Save"}
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      </Dialog>

      {/* Block-only dialog — opens only when KPI is used in an appraisal doc */}
      <Dialog
        open={Boolean(deleteTarget)}
        compact
        tone="danger"
        title="Cannot Delete Record"
        onClose={() => setDeleteTarget(null)}
        footer={
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            OK
          </Button>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          <strong>{text(deleteTarget?.KPI_CODE)}</strong> —{" "}
          <strong>{text(deleteTarget?.KPI_DESC)}</strong> is already used in one or
          more appraisal documents, so it cannot be deleted.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Please remove the related appraisal(s) from the <strong>KPI Assignment</strong>{" "}
          page first, then try deleting again.
        </p>
      </Dialog>
    </section>
  );
}