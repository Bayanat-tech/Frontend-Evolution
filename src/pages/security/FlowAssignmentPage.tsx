import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { LookupField } from "../../components/ui/LookupField";
import { Dialog } from "../../components/ui/Dialog";
import type { LookupRow } from "../../api/lookups";
import {
  getFlowAssignProcesses,
  getFlowAssignLevelDetails,
  getFlowAssignRoles,
  getFlowAssignRoleUsers,
  saveFlowAssignLevels,
  insSecRoleFunctionAccessUser,
  executeWmsInboundSqlCached,
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

const EMPTY_LEVEL_DESCS: Record<LevelKey, string> = {
  level1_role: "",
  level2_role: "",
  level3_role: "",
  level4_role: "",
  level5_role: "",
};

// LookupField shows raw `value` until its own lookup rows are loaded/matched,
// so code-only vs desc-only flicker happens unless we hand it an explicit
// "CODE — DESC" string via its `displayValue` prop.
function formatRoleDisplay(code: string, desc: string) {
  if (!code) return "";
  return desc ? `${code} — ${desc}` : code;
}

export function FlowAssignmentPage() {
  const { user } = useAuth();
  const companyCode = (user as any)?.company_code || (user as any)?.companyCode || "";
  const loginid = user?.loginid || "";

  const [selectedProcess, setSelectedProcess] = useState<string>("");
  // Processes added client-side via "Add Process" — merged into the Process
  // dropdown options below. No API call; purely local until backend support exists.
  const [customProcesses, setCustomProcesses] = useState<{ PROCESS: string }[]>([]);
  const [addProcessOpen, setAddProcessOpen] = useState(false);
  const [newProcessName, setNewProcessName] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedRoleDesc, setSelectedRoleDesc] = useState<string>("");

  const [levelValues, setLevelValues] = useState<Record<LevelKey, string>>(EMPTY_LEVEL_VALUES);
  const [levelDescs, setLevelDescs] = useState<Record<LevelKey, string>>(EMPTY_LEVEL_DESCS);
  const [levelLoading, setLevelLoading] = useState(false);
  const [savingLevels, setSavingLevels] = useState(false);
  const [levelDirty, setLevelDirty] = useState(false);
  const [savingRole, setSavingRole] = useState(false);

  const [userRows, setUserRows] = useState<TFlowRoleUser[]>([]);
  const [userLoading, setUserLoading] = useState(false);

  const [rightPanelContext, setRightPanelContext] = useState<string>("");

  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // ── Add User modal state ──────────────────────────────────────────────
  // modalRole is independent from the page's selectedRole, so the modal
  // can be opened even when nothing (or a null Level 5) is selected yet —
  // the person picks the role right here via LookupField.
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [modalRole, setModalRole] = useState("");
  const [modalRoleDesc, setModalRoleDesc] = useState("");
  const [addUserLoginId, setAddUserLoginId] = useState("");
  const [addUserLoginName, setAddUserLoginName] = useState("");
  // Tracks whether the Assigned Users grid has unsaved local changes
  // (additions via the modal, or removals via the row delete icon) so
  // Save Role knows there's something to push.
  const [roleUsersDirty, setRoleUsersDirty] = useState(false);

  const loadProcessOptions = useCallback(async () => {
    const rows = await getFlowAssignProcesses(companyCode);
    const apiRows = (rows ?? []) as unknown as LookupRow[];
    const existing = new Set(apiRows.map((r) => val(r as unknown as Record<string, unknown>, "PROCESS")));
    const merged = [
      ...apiRows,
      ...customProcesses.filter((p) => !existing.has(p.PROCESS)),
    ];
    return merged as unknown as LookupRow[];
  }, [companyCode, customProcesses]);

  const loadRoleOptions = useCallback(async () => {
    const rows = await getFlowAssignRoles(companyCode);
    return (rows ?? []) as unknown as LookupRow[];
  }, [companyCode]);

  const loadUserOptions = useCallback(async () => {
    const safeCompanyCode = companyCode.replace(/'/g, "''");
    const rows = await executeWmsInboundSqlCached(
      `select * from sec_login where company_code = '${safeCompanyCode}'`
    );
    return (rows ?? []) as unknown as LookupRow[];
  }, [companyCode]);

  const loadUsersForLevels = async (levels: Record<LevelKey, string>) => {
    const roleCodes = Array.from(new Set(Object.values(levels).filter(Boolean)));
    if (roleCodes.length === 0) {
      setUserRows([]);
      return;
    }
    setUserLoading(true);
    try {
      const results = await Promise.all(roleCodes.map((code) => getFlowAssignRoleUsers(companyCode, code)));
      setUserRows(results.flat());
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load role users." });
    } finally {
      setUserLoading(false);
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

  const loadLevelDetails = async (process: string) => {
    if (!process) {
      setLevelValues(EMPTY_LEVEL_VALUES);
      setLevelDescs(EMPTY_LEVEL_DESCS);
      setLevelDirty(false);
      setUserRows([]);
      setRightPanelContext("");
      return;
    }
    setLevelLoading(true);
    try {
      const rows = await getFlowAssignLevelDetails(companyCode, process);
      const first = (rows ?? [])[0] as Record<string, unknown> | undefined;

      const next: Record<LevelKey, string> = {
        level1_role: first ? val(first, "level1_role") : "",
        level2_role: first ? val(first, "level2_role") : "",
        level3_role: first ? val(first, "level3_role") : "",
        level4_role: first ? val(first, "level4_role") : "",
        level5_role: first ? val(first, "level5_role") : "",
      };
      const nextDescs: Record<LevelKey, string> = {
        level1_role: first ? val(first, "level1_role_desc") : "",
        level2_role: first ? val(first, "level2_role_desc") : "",
        level3_role: first ? val(first, "level3_role_desc") : "",
        level4_role: first ? val(first, "level4_role_desc") : "",
        level5_role: first ? val(first, "level5_role_desc") : "",
      };

      setLevelValues(next);
      setLevelDescs(nextDescs);
      setLevelDirty(false);
      setSelectedRole("");
      setSelectedRoleDesc("");
      setRoleUsersDirty(false);

      const filledCount = Object.values(next).filter(Boolean).length;
      setRightPanelContext(filledCount ? `Levels 1–${filledCount}` : "");
      await loadUsersForLevels(next);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load level details." });
    } finally {
      setLevelLoading(false);
    }
  };

  const updateLevelValue = (key: LevelKey, newValue: string, row: LookupRow | null) => {
    const next = { ...levelValues, [key]: newValue };
    setLevelValues(next);
    setLevelDescs((prev) => ({
      ...prev,
      [key]: newValue ? val((row as Record<string, unknown>) || {}, "ROLE_DESC") : "",
    }));
    setLevelDirty(true);

    const levelLabel = LEVEL_FIELDS.find((field) => field.key === key)?.label || key;
    setSelectedRole(newValue);
    setSelectedRoleDesc(newValue ? val((row as Record<string, unknown>) || {}, "ROLE_DESC") : "");
    setRoleUsersDirty(false);
    setRightPanelContext(newValue ? `${levelLabel} — Role ${newValue}` : `${levelLabel} — no role selected yet`);
    if (newValue) {
      void loadRoleUsers(newValue);
    } else {
      setUserRows([]);
    }
  };

  // Clicking a level's label (not the dropdown itself) selects that level's
  // already-assigned role in the Role Name field below, without changing
  // the level's value.
  const handleSelectLevelRole = (key: LevelKey) => {
    const roleId = levelValues[key];
    if (!roleId) return;

    const levelLabel = LEVEL_FIELDS.find((field) => field.key === key)?.label || key;
    setSelectedRole(roleId);
    setSelectedRoleDesc(levelDescs[key]);
    setRoleUsersDirty(false);
    setRightPanelContext(`${levelLabel} — Role ${roleId}`);
    void loadRoleUsers(roleId);
  };

  const totalLevelCount = useMemo(
    () => Object.values(levelValues).filter(Boolean).length,
    [levelValues]
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
        await loadLevelDetails(selectedProcess);
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

  const handleSaveRole = async () => {
    if (!selectedRole) {
      setNotice({ type: "error", message: "Please select a role first." });
      return;
    }
    if (!roleUsersDirty) {
      setNotice({ type: "error", message: "No changes to save." });
      return;
    }

    setSavingRole(true);
    try {
      // Send the full current grid for this role — any user removed locally
      // via the row delete icon is simply absent here, so the backend drops
      // it on save instead of us calling a separate delete endpoint.
      const rows = userRows.map((u) => {
        const rec = u as Record<string, unknown>;
        const rowLoginid = val(rec, "loginid");
        return {
          company_code: companyCode,
          loginid: rowLoginid,
          serial_no_or_role_id: selectedRole,
          userid: rowLoginid,
          create_user: loginid,
        };
      });

      const result = await insSecRoleFunctionAccessUser(rows);

      if (result?.success) {
        setNotice({ type: "success", message: "Role saved successfully." });
        setRoleUsersDirty(false);
        await loadRoleUsers(selectedRole);
      } else {
        throw new Error(result?.message || "Save failed");
      }
    } catch (error: any) {
      setNotice({
        type: "error",
        message: error?.message || "Failed to save role.",
      });
    } finally {
      setSavingRole(false);
    }
  };

  // Removes a row from the grid only — nothing is sent to the backend until
  // Save Role is clicked, at which point the row's absence is what deletes it.
  const handleRemoveUserRow = (row: TFlowRoleUser) => {
    setUserRows((prev) =>
      prev.filter(
        (r) =>
          !(
            val(r, "loginid") === val(row, "loginid") &&
            val(r, "serial_no_or_role_id") === val(row, "serial_no_or_role_id")
          )
      )
    );
    setRoleUsersDirty(true);
  };

  const userColumns = useMemo<ColumnDef<TFlowRoleUser>[]>(() => [
    { accessorKey: "loginid", header: "User Code", size: 140, cell: ({ row }) => val(row.original, "loginid") },
    { accessorKey: "serial_no_or_role_id", header: "Role Code", size: 130, cell: ({ row }) => val(row.original, "serial_no_or_role_id") || "-" },
    { accessorKey: "username", header: "User Name", size: 200, cell: ({ row }) => val(row.original, "username") || "-" },
    {
      id: "actions",
      header: "",
      size: 50,
      cell: ({ row }) => (
        <button
          type="button"
          className="text-muted-foreground hover:text-red-500"
          title="Remove from role"
          onClick={() => handleRemoveUserRow(row.original)}
        >
          <Trash2 size={14} />
        </button>
      ),
    },
  ], []);

  // Frontend-only: stage a new process name into the dropdown and select it.
  // No API call — nothing is persisted until a backend endpoint exists.
  const handleConfirmAddProcess = () => {
    const processValue = newProcessName.trim();
    if (!processValue) return;

    setCustomProcesses((prev) =>
      prev.some((p) => p.PROCESS === processValue) ? prev : [...prev, { PROCESS: processValue }]
    );
    setSelectedProcess(processValue);
    void loadLevelDetails(processValue);

    setAddProcessOpen(false);
    setNewProcessName("");
  };

  // Add is always openable now — even with no role/level selected (e.g. a
  // null Level 5) — because the role itself is picked inside the modal.
  const handleAddUser = () => {
    setModalRole(selectedRole || "");
    setModalRoleDesc(selectedRole ? selectedRoleDesc : "");
    setAddUserLoginId("");
    setAddUserLoginName("");
    setAddUserOpen(true);
  };

  const handleConfirmAddUser = () => {
    if (!modalRole || !addUserLoginId) return;

    const newRow: TFlowRoleUser = {
      loginid: addUserLoginId,
      username: addUserLoginName,
      serial_no_or_role_id: modalRole,
    };

    setUserRows((prev) => [...prev, newRow]);
    setRoleUsersDirty(true);

    setAddUserOpen(false);
    setAddUserLoginId("");
    setAddUserLoginName("");

    // Reflect the role picked in the modal back onto the page so the
    // grid below shows the role that was just staged.
    setSelectedRole(modalRole);
    setSelectedRoleDesc(modalRoleDesc);
    setRightPanelContext(`Role ${modalRole}`);
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

      {/* TOP: Process -> Approver Levels */}
      <div className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-end gap-3">
          <label className="grid flex-1 gap-1 text-sm">
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setNewProcessName("");
              setAddProcessOpen(true);
            }}
          >
            <Plus size={14} /> Add Process
          </Button>
        </div>

        <h2 className="m-0 text-sm font-semibold text-foreground">Approver Levels</h2>

        <div className="grid grid-cols-1 gap-2.5">
          {LEVEL_FIELDS.map(({ key, label, required }) => (
            <div key={key} className="flex items-center gap-3">
              <span
                className="w-16 shrink-0 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground hover:underline sm:w-20"
                onClick={() => handleSelectLevelRole(key)}
                title={levelValues[key] ? "View this role's assigned users" : undefined}
              >
                {label}
                {required && <span className="ml-0.5 text-red-500">*</span>}
              </span>
              <div className="min-w-0 flex-1">
                <LookupField
                  value={levelValues[key]}
                  displayValue={formatRoleDisplay(levelValues[key], levelDescs[key])}
                  placeholder={required ? "Select (required)" : "None"}
                  columns={[
                    { field: "ROLE_ID", header: "Role Code" },
                    { field: "ROLE_DESC", header: "Role Description" },
                  ]}
                  valueField="ROLE_ID"
                  displayFields={["ROLE_ID", "ROLE_DESC"]}
                  loadOptions={loadRoleOptions}
                  disabled={!selectedProcess || levelLoading}
                  onChange={(v, row) => updateLevelValue(key, v, row)}
                />
              </div>
            </div>
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

      {/* BOTTOM: users for whichever level cell was last clicked/edited,
          or a single role explicitly picked via Role Name */}
      <div className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-end justify-between gap-3">
          <label className="grid flex-1 gap-1 text-sm">
            <span className="font-medium text-foreground">Role Name</span>
            <LookupField
              value={selectedRole}
              displayValue={formatRoleDisplay(selectedRole, selectedRoleDesc)}
              placeholder="Filter to a single role"
              columns={[
                { field: "ROLE_ID", header: "Role Code" },
                { field: "ROLE_DESC", header: "Role Description" },
              ]}
              valueField="ROLE_ID"
              displayFields={["ROLE_ID", "ROLE_DESC"]}
              loadOptions={loadRoleOptions}
              onChange={(v, row) => {
                setSelectedRole(v);
                setSelectedRoleDesc(v ? val((row as Record<string, unknown>) || {}, "ROLE_DESC") : "");
                setRoleUsersDirty(false);
                if (v) {
                  setRightPanelContext(`Role ${v}`);
                  void loadRoleUsers(v);
                } else {
                  const filledCount = Object.values(levelValues).filter(Boolean).length;
                  setRightPanelContext(filledCount ? `Levels 1–${filledCount}` : "");
                  void loadUsersForLevels(levelValues);
                }
              }}
            />
          </label>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveRole}
            disabled={!selectedRole || !roleUsersDirty || savingRole}
          >
            <Save size={14} />
            {savingRole ? "Saving..." : "Save Role"}
          </Button>
        </div>

        <h2 className="m-0 text-sm font-semibold text-foreground">
          Assigned Users{rightPanelContext ? ` — ${rightPanelContext}` : ""}
        </h2>

        <DataTable
          columns={userColumns}
          data={userRows}
          loading={userLoading}
          height="320px"
          minWidth={420}
          density="grid"
          getRowId={(row: any, index: any) => val(row, "loginid") + "_" + val(row, "serial_no_or_role_id") + "_" + index}
        />

        <div className="flex justify-end gap-2 border-t pt-3">
          {/* No longer gated on selectedRole — Level 5 (or any unpicked level) can open this and choose the role right inside the modal. */}
          <Button onClick={handleAddUser}>
            <Plus size={15} /> Add
          </Button>
        </div>
      </div>

      {/* Add User modal */}
      <Dialog
        open={addUserOpen}
        title="Add User to Role"
        description="Pick the role, then enter the user code to assign."
        compact
        onClose={() => setAddUserOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmAddUser} disabled={!modalRole || !addUserLoginId}>
              <Plus size={14} />
              Add User
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-foreground">Role</span>
            <LookupField
              value={modalRole}
              displayValue={formatRoleDisplay(modalRole, modalRoleDesc)}
              placeholder="Search code, name, description..."
              columns={[
                { field: "ROLE_ID", header: "Role Code" },
                { field: "ROLE_DESC", header: "Role Description" },
              ]}
              valueField="ROLE_ID"
              displayFields={["ROLE_ID", "ROLE_DESC"]}
              loadOptions={loadRoleOptions}
              onChange={(v, row) => {
                setModalRole(v);
                setModalRoleDesc(v ? val((row as Record<string, unknown>) || {}, "ROLE_DESC") : "");
              }}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-foreground">User Code</span>
            <LookupField
              value={addUserLoginId}
              displayValue={formatRoleDisplay(addUserLoginId, addUserLoginName)}
              placeholder="Search user code or name..."
              columns={[
                { field: "LOGINID", header: "User Code" },
                { field: "USERNAME", header: "User Name" },
              ]}
              valueField="LOGINID"
              displayFields={["LOGINID", "USERNAME"]}
              loadOptions={loadUserOptions}
              onChange={(v, row) => {
                setAddUserLoginId(v);
                setAddUserLoginName(v ? val((row as Record<string, unknown>) || {}, "USERNAME") : "");
              }}
            />
          </label>
        </div>
      </Dialog>

      {/* Add Process modal — frontend-only, no API call. Adds the typed
          name into the Process dropdown's options and selects it. */}
      <Dialog
        open={addProcessOpen}
        title="Add Process"
        description="Enter a process name to add it to the dropdown above."
        compact
        onClose={() => setAddProcessOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setAddProcessOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmAddProcess} disabled={!newProcessName.trim()}>
              <Plus size={14} />
              Add
            </Button>
          </>
        }
      >
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Process Name</span>
          <input
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            placeholder="e.g. credit_request_form"
            value={newProcessName}
            onChange={(e) => setNewProcessName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirmAddProcess();
            }}
            autoFocus
          />
        </label>
      </Dialog>
    </section>
  );
}

export default FlowAssignmentPage;