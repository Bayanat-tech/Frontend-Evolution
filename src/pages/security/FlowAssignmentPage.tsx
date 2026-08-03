import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const LEVEL_FIELDS: { key: LevelKey; label: string; required: boolean; descField: string }[] = [
  { key: "level1_role", label: "Level 1", required: true, descField: "level1_role_desc" },
  { key: "level2_role", label: "Level 2", required: true, descField: "level2_role_desc" },
  { key: "level3_role", label: "Level 3", required: false, descField: "level3_role_desc" },
  { key: "level4_role", label: "Level 4", required: false, descField: "level4_role_desc" },
  { key: "level5_role", label: "Level 5", required: false, descField: "level5_role_desc" },
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

// ─── A small, properly-styled custom dropdown for the Level rows ──────────
type DropdownOption = { label: string; value: string };

function LevelDropdown({
  label,
  required,
  value,
  descValue,
  options,
  disabled,
  onSelect,
  onOpen,
}: {
  label: string;
  required: boolean;
  value: string;
  descValue?: string;
  options: DropdownOption[];
  disabled?: boolean;
  onSelect: (value: string) => void;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const formatOption = (option: DropdownOption) =>
    option.label && option.label !== option.value ? `${option.value} — ${option.label}` : option.value;

  const currentOption = options.find((option) => option.value === value);
  const currentLabel = value
    ? descValue
      ? `${value} — ${descValue}`
      : currentOption
      ? formatOption(currentOption)
      : value
    : "";

  return (
    <div ref={containerRef} className="relative flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground sm:w-20">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>

      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          disabled={disabled}
          className={`flex h-9 w-full items-center justify-between rounded-md border bg-background px-2 text-left text-sm text-foreground disabled:opacity-60 ${
            required && !value ? "border-red-400" : "border-input"
          }`}
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) onOpen?.();
          }}
        >
          <span className="truncate">{currentLabel || (required ? "Select (required)" : "None")}</span>
          <span className="shrink-0 text-muted-foreground">▾</span>
        </button>

        {open && (
          <div className="absolute z-20 mt-1 max-h-48 w-full min-w-[220px] overflow-auto rounded-md border bg-card shadow-lg">
            <button
              type="button"
              className="block w-full px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
              onClick={() => {
                onSelect("");
                setOpen(false);
              }}
            >
              {required ? "Select (required)" : "None"}
            </button>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`block w-full truncate px-2 py-1.5 text-left text-sm hover:bg-accent ${
                  option.value === value ? "bg-primary/10 font-medium" : ""
                }`}
                onClick={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
              >
                {formatOption(option)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function FlowAssignmentPage() {
  const { user } = useAuth();
  const companyCode = (user as any)?.company_code || (user as any)?.companyCode || "";
  const loginid = user?.loginid || "";

  const [selectedProcess, setSelectedProcess] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");

  const [levelValues, setLevelValues] = useState<Record<LevelKey, string>>(EMPTY_LEVEL_VALUES);
  const [levelDescs, setLevelDescs] = useState<Record<LevelKey, string>>(EMPTY_LEVEL_DESCS);
  const [levelLoading, setLevelLoading] = useState(false);
  const [savingLevels, setSavingLevels] = useState(false);
  const [levelDirty, setLevelDirty] = useState(false);

  const [approverOptions, setApproverOptions] = useState<{ label: string; value: string }[]>([]);

  const [userRows, setUserRows] = useState<TFlowRoleUser[]>([]);
  const [userLoading, setUserLoading] = useState(false);

  const [rightPanelContext, setRightPanelContext] = useState<string>("");

  const [selectedUserRow, setSelectedUserRow] = useState<TFlowRoleUser | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // ── Add User modal state ──────────────────────────────────────────────
  // modalRole is independent from the page's selectedRole, so the modal
  // can be opened even when nothing (or a null Level 5) is selected yet —
  // the person picks the role right here via LookupField.
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [modalRole, setModalRole] = useState("");
  const [addUserLoginId, setAddUserLoginId] = useState("");
  const [addingUser, setAddingUser] = useState(false);

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
      setSelectedUserRow(null);

      const filledCount = Object.values(next).filter(Boolean).length;
      setRightPanelContext(filledCount ? `Levels 1–${filledCount}` : "");
      await loadUsersForLevels(next);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load level details." });
    } finally {
      setLevelLoading(false);
    }
  };

  const handleLevelCellOpen = (key: LevelKey) => {
    const roleCode = levelValues[key];
    const levelLabel = LEVEL_FIELDS.find((field) => field.key === key)?.label || key;
    setSelectedRole(roleCode || "");
    setSelectedUserRow(null);
    setRightPanelContext(roleCode ? `${levelLabel} — Role ${roleCode}` : `${levelLabel} — no role selected yet`);
    if (roleCode) {
      void loadRoleUsers(roleCode);
    } else {
      setUserRows([]);
    }
  };

  const updateLevelValue = (key: LevelKey, newValue: string) => {
    const next = { ...levelValues, [key]: newValue };
    setLevelValues(next);
    setLevelDescs((prev) => ({
      ...prev,
      [key]: approverOptions.find((option) => option.value === newValue)?.label || "",
    }));
    setLevelDirty(true);

    const levelLabel = LEVEL_FIELDS.find((field) => field.key === key)?.label || key;
    setSelectedRole(newValue);
    setSelectedUserRow(null);
    setRightPanelContext(newValue ? `${levelLabel} — Role ${newValue}` : `${levelLabel} — no role selected yet`);
    if (newValue) {
      void loadRoleUsers(newValue);
    } else {
      setUserRows([]);
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
    { accessorKey: "serial_no_or_role_id", header: "Role Code", size: 130, cell: ({ row }) => val(row.original, "serial_no_or_role_id") || "-" },
    { accessorKey: "username", header: "User Name", size: 200, cell: ({ row }) => val(row.original, "username") || "-" },
  ], []);

  // Add is always openable now — even with no role/level selected (e.g. a
  // null Level 5) — because the role itself is picked inside the modal.
  const handleAddUser = () => {
    setModalRole(selectedRole || "");
    setAddUserLoginId("");
    setAddUserOpen(true);
  };

  const handleConfirmAddUser = async () => {
    if (!modalRole || !addUserLoginId) return;
    setAddingUser(true);
    try {
      await addUserToRole(companyCode, modalRole, addUserLoginId, loginid);
      setNotice({ type: "success", message: "User added to role." });
      setAddUserOpen(false);
      setAddUserLoginId("");

      // Reflect the role picked in the modal back onto the page so the
      // grid below shows the role that was just updated.
      setSelectedRole(modalRole);
      setRightPanelContext(`Role ${modalRole}`);
      await loadRoleUsers(modalRole);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to add user." });
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedRole || !selectedUserRow) {
      setNotice({ type: "error", message: "Select a role, then a user row, first." });
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

      {/* TOP: Process -> Approver Levels */}
      <div className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm">
        <label className="grid max-w-md gap-1 text-sm">
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

        <div className="grid max-w-md grid-cols-1 gap-2.5">
          {LEVEL_FIELDS.map(({ key, label, required }) => (
            <LevelDropdown
              key={key}
              label={label}
              required={required}
              value={levelValues[key]}
              descValue={levelDescs[key]}
              options={optionsWithFallback(levelValues[key])}
              disabled={!selectedProcess || levelLoading}
              onOpen={() => handleLevelCellOpen(key)}
              onSelect={(v) => updateLevelValue(key, v)}
            />
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
          <label className="grid max-w-md flex-1 gap-1 text-sm">
            <span className="font-medium text-foreground">Role Name</span>
            <LookupField
              value={selectedRole}
              placeholder="Filter to a single role"
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
            onClick={handleSaveLevels}
            disabled={!selectedProcess || !levelDirty || savingLevels}
          >
            <Save size={14} />
            {savingLevels ? "Saving..." : "Save Levels"}
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
          <Button variant="outline" onClick={handleDeleteUser} disabled={!selectedRole || !selectedUserRow}>
            <Trash2 size={15} /> Delete
          </Button>
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
            <Button onClick={handleConfirmAddUser} disabled={!modalRole || !addUserLoginId || addingUser}>
              <Plus size={14} />
              {addingUser ? "Adding..." : "Add"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-foreground">Role</span>
            <LookupField
              value={modalRole}
              placeholder="Search code, name, description..."
              columns={[
                { field: "ROLE_ID", header: "Role Code" },
                { field: "ROLE_DESC", header: "Role Description" },
              ]}
              valueField="ROLE_ID"
              displayFields={["ROLE_DESC"]}
              loadOptions={loadRoleOptions}
              onChange={setModalRole}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-foreground">User Code</span>
            <input
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              placeholder="Enter loginid"
              value={addUserLoginId}
              onChange={(e) => setAddUserLoginId(e.target.value)}
            />
            {/* TODO: swap this input for a LookupField (User Code / User Name
                columns) the moment a "list all users for company" API exists —
                same pattern as the Role field above, just no endpoint yet. */}
          </label>
        </div>
      </Dialog>
    </section>
  );
}

export default FlowAssignmentPage;