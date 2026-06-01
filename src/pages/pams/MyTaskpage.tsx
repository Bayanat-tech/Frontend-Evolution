import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../state/AuthContext";
import { pamsSelect, pamsDelete, pamsSave } from "../../api/pams";
import { CheckCircle, Eye, Edit2, Trash2, X, Save } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import type { ColumnDef } from "@tanstack/react-table";
import type { LookupRow } from "../../api/lookups";

// ─── Types ────────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;

interface MyTaskPageProps {
  initialTab?: number;
}

interface FormData {
  APPRAISAL_DOC_NO: string;
  APPRAISAL_DOC_DATE: string;
  EMPLOYEE_CODE: string;
  EMPLOYEE_NAME: string;
  PERIOD_NUMBER: string;
  APPRAISAL_FROM: string;
  APPRAISAL_TO: string;
  COMPANY_CODE: string;
  [key: string]: unknown;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TAB_STATUS   = ["PENDING", "IN PROGRESS", "REJECTED", "SENT BACK", "APPROVED"] as const;
const TAB_LABELS   = ["Pending", "In Progress", "Rejected", "Sent Back", "Closed"]   as const;
const HR_APPROVERS = ["2021060535", "2010080001", "2018030473"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function text(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

function fmtDate(val: unknown): string {
  const raw = String(val || "");
  if (!raw || raw === "null" || raw === "undefined") return "NA";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "NA";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function getStatusMeta(
  lastAction: string,
  flowLevel: number,
  status: string
): { label: string; bg: string; color: string; border: string } {
  const isDraft =
    (flowLevel === 2 || flowLevel === 3) &&
    (status === "DRAFT" || lastAction === "SAVE AS DRAFT" || lastAction === "SAVE_AS_DRAFT");
  const label = isDraft ? "SAVE AS DRAFT" : lastAction;
  const val   = (lastAction || "").toUpperCase().trim();

  if (isDraft)              return { label, bg: "#fff4e5", color: "#92400e", border: "#fcd38a" };
  if (val === "SUBMITTED")  return { label, bg: "#e6f9f0", color: "#0a6640", border: "#b7ebd4" };
  if (val === "APPROVED")   return { label, bg: "#e8f0fe", color: "#1a4fa0", border: "#b3caf5" };
  if (val === "REJECTED")   return { label, bg: "#fdecea", color: "#a01a1a", border: "#f5b3b3" };
  if (val === "SENT BACK")  return { label, bg: "#f3e8fe", color: "#6b21a8", border: "#d9b3f5" };
  return { label, bg: "#f4f4f5", color: "#52525b", border: "#d4d4d8" };
}

function normalizeRow(row: Row): Row {
  const normalized: Row = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    normalized[key] = value;
    normalized[key.toUpperCase()] = value;
  });
  return normalized;
}

// ─── Main Component ───────────────────────────────────────────────────────────
const MyTaskPage = ({ initialTab = 0 }: MyTaskPageProps) => {
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const loginid      = user?.loginid || user?.username || "";
  const companyCode  = user?.company_code || "";
  const isHRApprover = HR_APPROVERS.includes(loginid);

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState(initialTab);
  const [rows,         setRows]         = useState<Row[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [notice,       setNotice]       = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [query,        setQuery]        = useState("");
  
  // Dialog state for Edit/View
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentRow, setCurrentRow] = useState<Row | null>(null);
  const [formData, setFormData] = useState<FormData>({
    APPRAISAL_DOC_NO: "",
    APPRAISAL_DOC_DATE: "",
    EMPLOYEE_CODE: "",
    EMPLOYEE_NAME: "",
    PERIOD_NUMBER: "",
    APPRAISAL_FROM: "",
    APPRAISAL_TO: "",
    COMPANY_CODE: companyCode,
  });
  const [saving, setSaving] = useState(false);
  const [periods, setPeriods] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Row[]>([]);

  const isInitialMount = useRef(true);
  const currentTabRef = useRef(initialTab);

  const statusFilter = TAB_STATUS[activeTab];

  // Load periods and employees for lookup
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [periodsData, employeesData] = await Promise.all([
          pamsSelect({ parameter: "period", loginid, code1: companyCode }),
          pamsSelect({ parameter: "employee_hierarchy", loginid, code1: companyCode }),
        ]);
        setPeriods(periodsData.map(normalizeRow));
        setEmployees(employeesData.map(normalizeRow));
      } catch (error) {
        console.error("Error loading lookups:", error);
      }
    };
    loadLookups();
  }, [loginid, companyCode]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (tabIndex: number) => {
    const tabStatus = TAB_STATUS[tabIndex];
    setLoading(true);
    setNotice(null);
    try {
      const data = await pamsSelect({
        parameter: "Trn_appraisal",
        loginid,
        code1: companyCode,
        code2: "NULL",
        code3: tabStatus,
      });
      const normalizedData = data.map(normalizeRow);
      setRows(normalizedData);
      
      const initSelected: Record<string, boolean> = {};
      normalizedData.forEach((row) => {
        initSelected[text(row.APPRAISAL_DOC_NO)] = false;
      });
      setSelectedRows(initSelected);
    } catch (err: unknown) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to load data" });
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode]);

  useEffect(() => {
    void fetchData(activeTab);
    isInitialMount.current = false;
  }, [activeTab, fetchData]);

  const handleTabChange = useCallback((index: number) => {
    if (index === activeTab) return;
    setActiveTab(index);
    currentTabRef.current = index;
    setQuery("");
  }, [activeTab]);

    const openAppraisalTabsPage = (row: Row, mode: "view" | "edit" = "view") => {
    const docNo = text(row.APPRAISAL_DOC_NO);
    const employeeCode = text(row.EMPLOYEE_CODE);
    const employeeName = encodeURIComponent(text(row.EMPLOYEE_NAME));
    const designation = encodeURIComponent(text(row.DESG_NAME));
    const department = encodeURIComponent(text(row.DEPT_NAME));
    
    navigate(
      `/workspace/pams/appraisal/view/${docNo}?employee_code=${employeeCode}&employee_name=${employeeName}&designation=${designation}&department=${department}&mode=${mode}`
    );
  };

  // ── Dialog Handlers ────────────────────────────────────────────────────────
  const openViewDialog = (row: Row) => {
    setCurrentRow(row);
    setFormData({
      APPRAISAL_DOC_NO: text(row.APPRAISAL_DOC_NO),
      APPRAISAL_DOC_DATE: dateToString(row.APPRAISAL_DOC_DATE),
      EMPLOYEE_CODE: text(row.EMPLOYEE_CODE),
      EMPLOYEE_NAME: text(row.EMPLOYEE_NAME),
      PERIOD_NUMBER: text(row.PERIOD_NUMBER),
      APPRAISAL_FROM: dateToString(row.APPRAISAL_FROM),
      APPRAISAL_TO: dateToString(row.APPRAISAL_TO),
      COMPANY_CODE: text(row.COMPANY_CODE) || companyCode,
    });
    setViewMode(true);
    setEditMode(false);
    setDialogOpen(true);
  };

  const openEditDialog = (row: Row) => {
    setCurrentRow(row);
    setFormData({
      APPRAISAL_DOC_NO: text(row.APPRAISAL_DOC_NO),
      APPRAISAL_DOC_DATE: dateToString(row.APPRAISAL_DOC_DATE),
      EMPLOYEE_CODE: text(row.EMPLOYEE_CODE),
      EMPLOYEE_NAME: text(row.EMPLOYEE_NAME),
      PERIOD_NUMBER: text(row.PERIOD_NUMBER),
      APPRAISAL_FROM: dateToString(row.APPRAISAL_FROM),
      APPRAISAL_TO: dateToString(row.APPRAISAL_TO),
      COMPANY_CODE: text(row.COMPANY_CODE) || companyCode,
    });
    setViewMode(false);
    setEditMode(true);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setViewMode(false);
    setEditMode(false);
    setCurrentRow(null);
    setFormData({
      APPRAISAL_DOC_NO: "",
      APPRAISAL_DOC_DATE: "",
      EMPLOYEE_CODE: "",
      EMPLOYEE_NAME: "",
      PERIOD_NUMBER: "",
      APPRAISAL_FROM: "",
      APPRAISAL_TO: "",
      COMPANY_CODE: companyCode,
    });
  };

  const updateFormField = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handlePeriodChange = (periodNumber: string) => {
    const period = periods.find((p) => text(p.PERIOD_NUMBER) === periodNumber);
    updateFormField("PERIOD_NUMBER", periodNumber);
    if (period) {
      updateFormField("APPRAISAL_FROM", dateToString(period.PERIOD_FROM_DATE));
      updateFormField("APPRAISAL_TO", dateToString(period.PERIOD_TO_DATE));
    }
  };

  const handleEmployeeChange = (value: string, selected: LookupRow | null) => {
    updateFormField("EMPLOYEE_CODE", value);
    updateFormField("EMPLOYEE_NAME", selected?.RPT_NAME || selected?.EMP_NAME || "");
  };

  const saveRecord = async () => {
    if (!editMode) return;
    
    if (!formData.EMPLOYEE_CODE || !formData.PERIOD_NUMBER) {
      setNotice({ type: "error", message: "Employee and period are required" });
      return;
    }
    
    setSaving(true);
    setNotice(null);
    try {
      await pamsSave({
        parameter: "Trn_ems_appraisal_hdr",
        loginid,
        val1s1: formData.COMPANY_CODE,
        val1s4: formData.EMPLOYEE_CODE,
        val1s5: formData.APPRAISAL_DOC_NO,
        val1s6: formData.APPRAISAL_DOC_DATE,
        val1s7: formData.APPRAISAL_FROM,
        val1s8: formData.APPRAISAL_TO,
        val1s9: formData.PERIOD_NUMBER,
        wval1s1: formData.COMPANY_CODE,
        wval1s5: formData.APPRAISAL_DOC_NO,
      });
      setNotice({ type: "success", message: "Appraisal updated successfully" });
      closeDialog();
      void fetchData(activeTab);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Failed to update appraisal" });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (row: Row) => {
    if (!window.confirm("Are you sure you want to delete this appraisal?")) return;
    try {
      await pamsDelete({ 
        parameter: "delete_appraisal_hdr", 
        loginid, 
        code1: text(row.APPRAISAL_DOC_NO), 
        code2: text(row.COMPANY_CODE) 
      });
      setNotice({ type: "success", message: "Appraisal deleted successfully" });
      void fetchData(activeTab);
    } catch (err: unknown) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to delete" });
    }
  };

  // ── Bulk approve ───────────────────────────────────────────────────────────
  const handleBulkApprove = async () => {
    const ids = Object.entries(selectedRows).filter(([, v]) => v).map(([id]) => id);
    if (!ids.length) { 
      setNotice({ type: "warning", message: "Please select at least one appraisal!" }); 
      return; 
    }
    try {
      await pamsSelect({ 
        parameter: "proc_update_pams_doc_status_bulk", 
        loginid, 
        code1: companyCode, 
        code2: ids.join(","), 
        code3: "A", 
        code4: "" 
      });
      setNotice({ type: "success", message: "Appraisals approved successfully!" });
      setSelectedRows({});
      void fetchData(activeTab);
    } catch (err: unknown) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    }
  };

  // ── Checkbox handlers ──────────────────────────────────────────────────────
  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedRows((prev) => ({ ...prev, [id]: checked }));
  };

  const toggleSelectAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    rows.forEach((row) => {
      next[text(row.APPRAISAL_DOC_NO)] = checked;
    });
    setSelectedRows(next);
  };

  // Helper function to convert date to YYYY-MM-DD
  function dateToString(value: unknown): string {
    if (!value) return "";
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // ── Columns Definition ─────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<Row>[]>(() => {
    const cols: ColumnDef<Row>[] = [];

    // Appraisal Doc No column with Checkbox inside
    cols.push({
      accessorKey: "APPRAISAL_DOC_NO",
      header: "Appraisal Doc No",
      size: 200,
      cell: ({ row }) => {
        const id = text(row.original.APPRAISAL_DOC_NO);
        if (!id) return null;

        return (
          <div
            onClick={(e) => {
              if ((e.target as HTMLElement).tagName !== 'INPUT') {
                // Open AppraisalViewTabsPage with tabs
                openAppraisalTabsPage(row.original, "view");
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {isHRApprover && (
              <input
                type="checkbox"
                checked={!!selectedRows[id]}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleSelect(id, e.target.checked);
                }}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  accentColor: '#082A89'
                }}
              />
            )}
            <span
              style={{
                color: "#082A89",
                fontWeight: 600,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: 'inline-block',
                minWidth: 80
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              {id}
            </span>
          </div>
        );
      },
    });

    cols.push({
      accessorKey: "APPRAISAL_DOC_DATE",
      header: "Appraisal Date",
      size: 110,
      cell: ({ row }) => fmtDate(row.original.APPRAISAL_DOC_DATE),
    });

    cols.push({
      accessorKey: "PERIOD_NUMBER",
      header: "Period No",
      size: 100,
      cell: ({ row }) => text(row.original.PERIOD_NUMBER) || "—",
    });

    cols.push({
      accessorKey: "EMPLOYEE_CODE",
      header: "Employee",
      size: 280,
      cell: ({ row }) => (
        <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>
          {text(row.original.EMPLOYEE_CODE)} - {text(row.original.EMPLOYEE_NAME)}
        </span>
      ),
    });

    cols.push({
      accessorKey: "DESG_NAME",
      header: "Designation",
      size: 200,
      cell: ({ row }) => {
        const desgCode = text(row.original.DESG_CODE);
        const desgName = text(row.original.DESG_NAME);
        const desgLabel = desgCode && desgName ? `${desgCode} - ${desgName}` : desgCode || desgName || "—";
        return <span style={{ whiteSpace: "nowrap" }}>{desgLabel}</span>;
      },
    });

    cols.push({
      accessorKey: "APPRAISAL_FROM",
      header: "From",
      size: 110,
      cell: ({ row }) => fmtDate(row.original.APPRAISAL_FROM),
    });

    cols.push({
      accessorKey: "APPRAISAL_TO",
      header: "To",
      size: 110,
      cell: ({ row }) => fmtDate(row.original.APPRAISAL_TO),
    });

    cols.push({
      accessorKey: "LAST_ACTION",
      header: "Status",
      size: 140,
      cell: ({ row }) => {
        const status = getStatusMeta(
          text(row.original.LAST_ACTION),
          Number(row.original.FLOW_LEVEL_RUNNING || 0),
          text(row.original.STATUS)
        );
        return (
          <span style={{
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: "999px",
            fontSize: "0.7rem",
            fontWeight: 700,
            whiteSpace: "nowrap",
            background: status.bg,
            color: status.color,
            border: `1px solid ${status.border}`,
          }}>
            {status.label || "—"}
          </span>
        );
      },
    });

    // Actions column with Edit and View only (no Delete)
    cols.push({
      id: "actions",
      header: "Actions",
      size: 100,
      cell: ({ row }) => (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Button
            size="sm"
            variant="ghost"
            title="Edit"
            onClick={() => openEditDialog(row.original)}
            style={{ padding: "4px", height: "28px", width: "28px" }}
          >
            <Edit2 size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="View"
            onClick={() => openViewDialog(row.original)}
            style={{ padding: "4px", height: "28px", width: "28px" }}
          >
            <Eye size={14} />
          </Button>
        </div>
      ),
    });

    return cols;
  }, [isHRApprover, selectedRows]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#6b7280" }}>
        <a href="/dashboard" style={{ color: "#6b7280", textDecoration: "none" }}>Home</a>
        <span style={{ color: "#d1d5db" }}>/</span>
        <a href="/pams/masters" style={{ color: "#6b7280", textDecoration: "none" }}>Master</a>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ color: "#111827", fontWeight: 500 }}>Appraisal</span>
      </div>

      {/* Notice */}
      {notice && (
        <div style={{
          padding: "9px 14px",
          borderRadius: "6px",
          fontSize: "13px",
          fontWeight: 500,
          background: notice.type === "success" ? "#e6f9f0" : notice.type === "error" ? "#fdecea" : "#fff4e5",
          color: notice.type === "success" ? "#0a6640" : notice.type === "error" ? "#a01a1a" : "#92400e",
          border: `1px solid ${notice.type === "success" ? "#b7ebd4" : notice.type === "error" ? "#f5b3b3" : "#fcd38a"}`,
        }}>
          {notice.message}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: "2px", borderBottom: "2px solid #e5e7eb" }}>
        {TAB_LABELS.map((label, index) => (
          <button
            key={index}
            onClick={() => handleTabChange(index)}
            style={{
              padding: "8px 20px",
              fontSize: "14px",
              fontWeight: activeTab === index ? 700 : 500,
              color: activeTab === index ? "#082A89" : "#6b7280",
              background: activeTab === index ? "#f0f4ff" : "transparent",
              border: "none",
              borderBottom: activeTab === index ? "2px solid #082A89" : "2px solid transparent",
              borderRadius: "8px 8px 0 0",
              cursor: "pointer",
              marginBottom: "-2px",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Select All Checkbox */}
      {isHRApprover && rows.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 4px" }}>
          <input
            type="checkbox"
            checked={rows.length > 0 && rows.every((row) => selectedRows[text(row.APPRAISAL_DOC_NO)])}
            onChange={(e) => toggleSelectAll(e.target.checked)}
            style={{
              width: '16px',
              height: '16px',
              cursor: 'pointer',
              accentColor: '#082A89'
            }}
          />
          <span style={{ fontSize: "12px", color: "#6b7280" }}>
            Select All ({rows.length} records)
          </span>
        </div>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={rows}
        title={`${rows.length.toLocaleString()} Records`}
        subtitle={`${statusFilter} Appraisals`}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search appraisal..."
        loading={loading}
        height={550}
        minWidth={1300}
        density="compact"
        enablePagination
        pageSize={100}
        enableColumnFilters={true}
        getRowId={(row) => text(row.APPRAISAL_DOC_NO)}
      />

      {/* Bulk Approve Button */}
      {isHRApprover && Object.values(selectedRows).some(Boolean) && (
        <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={handleBulkApprove} style={{ background: "#082a89" }}>
            <CheckCircle size={15} /> Approve Selected ({Object.values(selectedRows).filter(Boolean).length})
          </Button>
        </div>
      )}

      {/* Edit/View Dialog with LookupField */}
      <Dialog
        open={dialogOpen}
        wide
        title={viewMode ? "View Appraisal" : editMode ? "Edit Appraisal" : "Appraisal Details"}
        description="View or edit appraisal details"
        onClose={closeDialog}
        footer={
          <>
            <Button variant="outline" onClick={closeDialog}>
              <X size={15} /> Close
            </Button>
            {editMode && (
              <Button disabled={saving} onClick={saveRecord}>
                <Save size={15} /> {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </>
        }
      >
        <form className="grid max-w-full gap-4 overflow-hidden">
          <Card className="max-w-full overflow-hidden">
            <CardHeader className="border-b border-border">
              <div>
                <p className="eyebrow">Details</p>
                <h2 className="m-0 text-sm font-semibold">Appraisal Information</h2>
              </div>
            </CardHeader>
            <CardContent className="grid max-w-full grid-cols-1 gap-3 pt-4 lg:grid-cols-2">
              {/* Appraisal Doc No */}
              <div className="field">
                <span>Appraisal Doc No</span>
                <Input 
                  disabled 
                  value={formData.APPRAISAL_DOC_NO || "Auto generated"} 
                  onChange={() => {}} 
                />
              </div>

              {/* Appraisal Doc Date */}
              <div className="field">
                <span>Appraisal Doc Date</span>
                <Input 
                  disabled={viewMode} 
                  type="date" 
                  value={formData.APPRAISAL_DOC_DATE} 
                  onChange={(e) => updateFormField("APPRAISAL_DOC_DATE", e.target.value)} 
                />
              </div>

              {/* Employee LookupField */}
              <div className="min-w-0 lg:col-span-2">
                <div className="field">
                  <span>Employee <strong className="text-destructive">*</strong></span>
                  <LookupField
                    compact
                    disabled={viewMode}
                    label="Employee"
                    value={formData.EMPLOYEE_CODE}
                    displayValue={formData.EMPLOYEE_NAME ? `${formData.EMPLOYEE_CODE} - ${formData.EMPLOYEE_NAME}` : formData.EMPLOYEE_CODE}
                    placeholder="Search employee"
                    columns={[
                      { field: "EMPLOYEE_ID", header: "Employee ID" },
                      { field: "EMPLOYEE_CODE", header: "Employee Code" },
                      { field: "RPT_NAME", header: "Employee Name" },
                      { field: "EMP_NAME", header: "Employee Name" },
                    ]}
                    valueField="EMPLOYEE_CODE"
                    displayFields={["EMPLOYEE_CODE", "RPT_NAME", "EMP_NAME"]}
                    loadOptions={async () => employees as LookupRow[]}
                    onChange={handleEmployeeChange}
                  />
                </div>
              </div>

              {/* Period Number */}
              <div className="field">
                <span>Period Number <strong className="text-destructive">*</strong></span>
                <select
                  disabled={viewMode}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors disabled:opacity-60"
                  value={formData.PERIOD_NUMBER}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                >
                  <option value="">Select Period</option>
                  {periods.map((period, idx) => (
                    <option key={idx} value={text(period.PERIOD_NUMBER)}>
                      {text(period.PERIOD_NUMBER)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Appraisal From */}
              <div className="field">
                <span>Appraisal From</span>
                <Input disabled type="date" value={formData.APPRAISAL_FROM} onChange={() => {}} />
              </div>

              {/* Appraisal To */}
              <div className="field">
                <span>Appraisal To</span>
                <Input disabled type="date" value={formData.APPRAISAL_TO} onChange={() => {}} />
              </div>
            </CardContent>
          </Card>
        </form>
      </Dialog>
    </div>
  );
};

export default MyTaskPage;