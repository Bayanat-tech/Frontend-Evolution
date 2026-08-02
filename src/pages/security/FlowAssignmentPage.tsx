import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { LookupField } from "../../components/ui/LookupField";
import type { LookupRow } from "../../api/lookups";
import {
  getFlowAssignProcesses,
  getFlowAssignLevelDetails,
  getFlowAssignRoles,
  getFlowAssignRoleUsers,
  addUserToRole,
  removeUserFromRole,
  saveFlowAssignLevels,
  type TFlowRoleUser,
} from "../../api/wms";
import { useAuth } from "../../state/AuthContext";

function val(row: Record<string, unknown>, key: string) {
  return String(row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()] ?? "");
}

type LevelKey = "level1_role" | "level2_role" | "level3_role" | "level4_role" | "level5_role";

const LEVEL_FIELDS: { key: LevelKey; label: string; required: boolean }[] = [
  { key: "level1_role", label: "Level 1", required: true },
  { key: "level2_role", label: "Level 2", required: true },
  { key: "level3_role", label: "Level 3", required: false },
  { key: "level4_role", label: "Level 4", required: false },
  { key: "level5_role", label: "Level 5", required: false },
];

const EMPTY_LEVEL_VALUES: Record<LevelKey, string> = {
  level1_role: "",
  level2_role: "",
  level3_role: "",
  level4_role: "",
  level5_role: "",
};

export function FlowAssignmentPage() {
  const { user } = useAuth();
  const companyCode = (user as any)?.company_code || (user as any)?.companyCode || "";
  const loginid = user?.loginid || "";

  const [selectedProcess, setSelectedProcess] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");

  const [levelValues, setLevelValues] = useState<Record<LevelKey, string>>(EMPTY_LEVEL_VALUES);
  const [levelLoading, setLevelLoading] = useState(false);
  const [savingLevels, setSavingLevels] = useState(false);
  const [levelDirty, setLevelDirty] = useState(false);

  const [approverOptions, setApproverOptions] = useState<{ label: string; value: string }[]>([]);

  const [userRows, setUserRows] = useState<TFlowRoleUser[]>([]);
  const [userLoading, setUserLoading] = useState(false);

  const [selectedUserRow, setSelectedUserRow] = useState<TFlowRoleUser | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Load approver role options
  useEffect(() => {
    if (!companyCode) return;
    getFlowAssignRoles(companyCode)
      .then((roles) => setApproverOptions((roles ?? []).map((r: any) => ({ label: r.ROLE_DESC, value: r.ROLE_ID }))))
      .catch(() => {});
  }, [companyCode]);

  const loadProcessOptions = useCallback(async () => {
    const rows = await getFlowAssignProcesses(companyCode);
    return (rows ?? []) as unknown as LookupRow[];
  }, [companyCode]);

  const loadRoleOptions = useCallback(async () => {
    const rows = await getFlowAssignRoles(companyCode);
    return (rows ?? []) as unknown as LookupRow[];
  }, [companyCode]);

  const loadLevelDetails = async (process: string) => {
    if (!process) {
      setLevelValues(EMPTY_LEVEL_VALUES);
      setLevelDirty(false);
      return;
    }
    setLevelLoading(true);
    try {
      const rows = await getFlowAssignLevelDetails(companyCode, process);
      const first = (rows ?? [])[0] as Record<string, unknown> | undefined;

      setLevelValues({
        level1_role: first ? val(first, "level1_role") : "",
        level2_role: first ? val(first, "level2_role") : "",
        level3_role: first ? val(first, "level3_role") : "",
        level4_role: first ? val(first, "level4_role") : "",
        level5_role: first ? val(first, "level5_role") : "",
      });
      setLevelDirty(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load level details." });
    } finally {
      setLevelLoading(false);
    }
  };

  const loadRoleUsers = async (roleId: string) => {
    if (!roleId) {
      setUserRows([]);
      return;
    }
    setUserLoading(true);
    try {
      const rows = await getFlowAssignRoleUsers(companyCode, roleId);
      setUserRows(rows ?? []);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load role users." });
    } finally {
      setUserLoading(false);
    }
  };

  const updateLevelValue = (key: LevelKey, newValue: string) => {
    setLevelValues((prev) => ({ ...prev, [key]: newValue }));
    setLevelDirty(true);

    // 🔥 NEW: When user selects a role in any level → show its users on the right
    if (newValue) {
      setSelectedRole(newValue);
      void loadRoleUsers(newValue);
    }
  };

  const totalLevelCount = useMemo(
    () => Object.values(levelValues).filter(Boolean).length,
    [levelValues]
  );

  const optionsWithFallback = useCallback(
    (currentValue: string) => {
      if (!currentValue || approverOptions.some((option) => option.value === currentValue)) {
        return approverOptions;
      }
      return [{ label: currentValue, value: currentValue }, ...approverOptions];
    },
    [approverOptions]
  );

  const handleSaveLevels = async () => {
    if (!selectedProcess) {
      setNotice({ type: "error", message: "Please select a process first." });
      return;
    }
    if (!levelValues.level1_role || !levelValues.level2_role) {
      setNotice({ type: "error", message: "Level 1 and Level 2 are required." });
      return;
    }

    setSavingLevels(true);
    try {
      const lastLevel = totalLevelCount;

      const result = await saveFlowAssignLevels(companyCode, selectedProcess, {
        level1_role: levelValues.level1_role,
        level2_role: levelValues.level2_role,
        level3_role: levelValues.level3_role || undefined,
        level4_role: levelValues.level4_role || undefined,
        level5_role: levelValues.level5_role || undefined,
        last_level: lastLevel,
      });

      if (result?.success) {
        setLevelDirty(false);
        setNotice({ type: "success", message: "Approver levels saved successfully." });
      } else {
        throw new Error(result?.message || "Save failed");
      }
    } catch (error: any) {
      setNotice({
        type: "error",
        message: error?.message || "Failed to save approver levels.",
      });
    } finally {
      setSavingLevels(false);
    }
  };

  // ==================== User Role Logic ====================
  const userColumns = useMemo<ColumnDef<TFlowRoleUser>[]>(() => [
    {
      accessorKey: "loginid",
      header: "User Code",
      size: 140,
      cell: ({ row }) => (
        <button className="text-left hover:underline" onClick={() => setSelectedUserRow(row.original)}>
          {val(row.original, "loginid")}
        </button>
      ),
    },
    { accessorKey: "serial_no_or_role_id", header: "Role Code", size: 200, cell: ({ row }) => val(row.original, "serial_no_or_role_id") || "-" },
    { accessorKey: "username", header: "User Name", size: 200, cell: ({ row }) => val(row.original, "username") || "-" },
  ], []);

  const handleAddUser = async () => {
    if (!selectedRole) {
      setNotice({ type: "error", message: "Select a role first." });
      return;
    }
    const newLoginId = window.prompt("Enter the user code (loginid) to add to this role:");
    if (!newLoginId) return;

    try {
      await addUserToRole(companyCode, selectedRole, newLoginId, loginid);
      setNotice({ type: "success", message: "User added to role." });
      await loadRoleUsers(selectedRole);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to add user." });
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedRole || !selectedUserRow) {
      setNotice({ type: "error", message: "Select a user row first." });
      return;
    }
    try {
      await removeUserFromRole(companyCode, selectedRole, val(selectedUserRow, "loginid"), loginid);
      setNotice({ type: "success", message: "User removed from role." });
      setSelectedUserRow(null);
      await loadRoleUsers(selectedRole);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to remove user." });
    }
  };

  return (
    <section className="grid gap-5">
      <div>
        <h1 className="m-0 text-2xl font-semibold text-foreground">Flow Assignment</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Configure approver levels per process, and assign users to roles.
        </p>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* LEFT: Process -> Approver Levels */}
        <div className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-foreground">Process</span>
            <LookupField
              value={selectedProcess}
              placeholder="Select process"
              columns={[{ field: "PROCESS", header: "Process" }]}
              valueField="PROCESS"
              displayFields={["PROCESS"]}
              loadOptions={loadProcessOptions}
              onChange={(v) => {
                setSelectedProcess(v);
                void loadLevelDetails(v);
              }}
            />
          </label>

          <h2 className="m-0 text-sm font-semibold text-foreground">Approver Levels</h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {LEVEL_FIELDS.map(({ key, label, required }) => (
              <label key={key} className="grid gap-1 text-xs">
                <span className="font-medium text-muted-foreground">
                  {label}
                  {required && <span className="ml-0.5 text-red-500">*</span>}
                </span>
                <select
                  className={`h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${
                    required && !levelValues[key] ? "border-red-400" : "border-input"
                  }`}
                  value={levelValues[key]}
                  disabled={!selectedProcess || levelLoading}
                  onChange={(e) => updateLevelValue(key, e.target.value)}
                >
                  <option value="">{required ? "Select (required)" : "None"}</option>
                  {optionsWithFallback(levelValues[key]).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm font-medium text-foreground">
              Total Level Count: <span className="tabular-nums">{totalLevelCount}</span>
            </span>
            <Button
              size="sm"
              onClick={handleSaveLevels}
              disabled={!selectedProcess || !levelDirty || savingLevels}
            >
              <Save size={14} />
              {savingLevels ? "Saving..." : "Save Levels"}
            </Button>
          </div>
        </div>

        {/* RIGHT: Role -> Assigned Users (Auto-updates when level is clicked) */}
        <div className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-foreground">Role Name</span>
            <LookupField
              value={selectedRole}
              placeholder="Select role"
              columns={[
                { field: "ROLE_ID", header: "Role Code" },
                { field: "ROLE_DESC", header: "Role Description" },
              ]}
              valueField="ROLE_ID"
              displayFields={["ROLE_DESC"]}
              loadOptions={loadRoleOptions}
              onChange={(v) => {
                setSelectedRole(v);
                setSelectedUserRow(null);
                void loadRoleUsers(v);
              }}
            />
          </label>

          <h2 className="m-0 text-sm font-semibold text-foreground">Assigned Users</h2>

          <DataTable
            columns={userColumns}
            data={userRows}
            loading={userLoading}
            height="280px"
            minWidth={420}
            density="grid"
            getRowId={(row: any, index: any) => val(row, "loginid") || String(index)}
          />

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={handleDeleteUser} disabled={!selectedUserRow}>
              <Trash2 size={15} /> Delete
            </Button>
            <Button onClick={handleAddUser} disabled={!selectedRole}>
              <Plus size={15} /> Add
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FlowAssignmentPage;