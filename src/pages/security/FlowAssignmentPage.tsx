import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Save, Trash2, Users } from "lucide-react";
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

// ── Dynamic level support ───────────────────────────────────────────────
// The number of approver levels is NOT fixed — it's whatever the backend
// returns for a given process (could be 3, 5, 7, 10...). We detect it from
// the shape of the API response (level1_role, level2_role, ... levelN_role
// keys) rather than hardcoding a level count.

type LevelField = { key: string; label: string; required: boolean };

const DEFAULT_LEVEL_COUNT = 5; // used only when a process has no rows yet

function buildLevelFields(count: number): LevelField[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return { key: `level${n}_role`, label: `Level ${n}`, required: n <= 2 };
  });
}

// Scans raw API rows for level<N>_role keys and returns the highest N found.
// ALSO checks the `last_level` field on each row — some processes (e.g.
// frt_enquiry) report a last_level higher than the number of level<N>_role
// KEYS actually present on the row (only level1_role..level5_role exist as
// keys, but last_level says 7). last_level is the authoritative "this
// process has N levels" signal — key presence alone isn't enough, since a
// row can legitimately omit level6_role/level7_role as keys entirely while
// still needing those columns to exist so they CAN be filled in and saved.
function detectLevelCount(rows: Record<string, unknown>[]): number {
  let max = 0;
  const pattern = /^level(\d+)_role$/i;
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      const m = pattern.exec(k);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
    const lastLevelRaw = row["last_level"] ?? row["LAST_LEVEL"];
    const lastLevel = Number(lastLevelRaw);
    if (!Number.isNaN(lastLevel) && lastLevel > max) max = lastLevel;
  }
  return max;
}

// Each grid cell carries its code + resolved description together so
// LookupField can render "CODE — DESC" via displayValue without flicker.
type LevelCell = { value: string; desc: string };

// One row of the horizontal Approver Levels grid = one flow for the
// selected process. A process can now have several rows — e.g. the same
// Level 1 approver handling multiple departments via different Flow Codes.
// `rowId` is a client-only key (the backend has no serial number for these
// rows) used for React keys / dirty tracking — never sent to the backend.
// `levels` is keyed dynamically by "level1_role", "level2_role", etc. so the
// row shape adapts to however many levels the current process uses.
type FlowRow = {
  rowId: string;
  levels: Record<string, LevelCell>;
  flow_code: LevelCell;
};

function makeRowId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `row_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function emptyRow(levelCount: number): FlowRow {
  const levels: Record<string, LevelCell> = {};
  for (let i = 1; i <= levelCount; i++) {
    levels[`level${i}_role`] = { value: "", desc: "" };
  }
  return {
    rowId: makeRowId(),
    levels,
    // Backend returns "NA" when nothing's been picked yet — default to it.
    flow_code: { value: "NA", desc: "" },
  };
}

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

  // Horizontal Approver Levels grid — one process can have multiple flow rows.
  const [flowRows, setFlowRows] = useState<FlowRow[]>([]);
  // How many Level columns the CURRENT process uses — detected from the API
  // response each time a process is loaded (see detectLevelCount).
  const [levelCount, setLevelCount] = useState<number>(DEFAULT_LEVEL_COUNT);
  const [levelLoading, setLevelLoading] = useState(false);
  const [savingLevels, setSavingLevels] = useState(false);
  const [levelDirty, setLevelDirty] = useState(false);

  const LEVEL_FIELDS = useMemo(() => buildLevelFields(levelCount), [levelCount]);

  // Single source of truth for the grid's column layout, driven by the
  // detected level count — used as inline style so it stays correct no
  // matter how many levels a process has (Tailwind can't generate an
  // arbitrary grid-cols class for a count that only exists at runtime).
  const gridTemplateColumns = useMemo(
    () => `repeat(${levelCount + 1}, minmax(130px, 1fr)) 24px`,
    [levelCount]
  );
  const gridMinWidth = useMemo(() => `${Math.max(680, (levelCount + 1) * 140 + 40)}px`, [levelCount]);

  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedRoleDesc, setSelectedRoleDesc] = useState<string>("");
  const [savingRole, setSavingRole] = useState(false);

  const [userRows, setUserRows] = useState<TFlowRoleUser[]>([]);
  const [userLoading, setUserLoading] = useState(false);

  const [rightPanelContext, setRightPanelContext] = useState<string>("");

  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // ── Add User modal state ──────────────────────────────────────────────
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [modalRole, setModalRole] = useState("");
  const [modalRoleDesc, setModalRoleDesc] = useState("");
  const [addUserLoginId, setAddUserLoginId] = useState("");
  const [addUserLoginName, setAddUserLoginName] = useState("");
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

  const loadFlowCodeOptions = useCallback(async () => {
    const safeCompanyCode = companyCode.replace(/'/g, "''");
    const rows = await executeWmsInboundSqlCached(
      `select * from MS_PS_FLOW_MASTER where company_code = '${safeCompanyCode}'`
    );
    return (rows ?? []) as unknown as LookupRow[];
  }, [companyCode]);

  // Default bottom-panel view: users across every role used anywhere in the
  // grid (all rows, all levels) — same fallback as before, extended from
  // "one row's fixed levels" to "all rows' dynamic levels".
  const loadUsersForRows = async (rows: FlowRow[]) => {
    const roleCodes = Array.from(
      new Set(
        rows
          .flatMap((r) => Object.values(r.levels).map((cell) => cell.value))
          .filter(Boolean)
      )
    );
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
      setFlowRows([]);
      setLevelCount(DEFAULT_LEVEL_COUNT);
      setLevelDirty(false);
      setUserRows([]);
      setRightPanelContext("");
      setSelectedRole("");
      setSelectedRoleDesc("");
      return;
    }
    setLevelLoading(true);
    try {
      const rows = await getFlowAssignLevelDetails(companyCode, process);
      const data = (rows ?? []) as unknown as Record<string, unknown>[];

      // Detect how many level columns this process actually uses. Falls
      // back to the default only when the process has no rows yet (new
      // process, nothing configured) so there's still something to fill in.
      const detected = detectLevelCount(data);
      const count = detected > 0 ? detected : DEFAULT_LEVEL_COUNT;
      setLevelCount(count);

      const mapped: FlowRow[] = data.map((r) => {
        const levels: Record<string, LevelCell> = {};
        for (let i = 1; i <= count; i++) {
          const key = `level${i}_role`;
          levels[key] = { value: val(r, key), desc: val(r, `${key}_desc`) };
        }
        return {
          rowId: makeRowId(),
          levels,
          flow_code: { value: val(r, "flow_code") || "NA", desc: val(r, "flow_code_desc") },
        };
      });

      // Always keep at least one (possibly empty) row so there's something
      // to fill in for a process that has no flows configured yet.
      const next = mapped.length ? mapped : [emptyRow(count)];
      setFlowRows(next);
      setLevelDirty(false);
      setSelectedRole("");
      setSelectedRoleDesc("");
      setRoleUsersDirty(false);
      setRightPanelContext("");
      await loadUsersForRows(next);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load level details." });
    } finally {
      setLevelLoading(false);
    }
  };

  const updateRowLevel = (rowId: string, key: string, newValue: string, row: LookupRow | null) => {
    setFlowRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId
          ? {
              ...r,
              levels: {
                ...r.levels,
                [key]: {
                  value: newValue,
                  desc: newValue ? val((row as Record<string, unknown>) || {}, "ROLE_DESC") : "",
                },
              },
            }
          : r
      )
    );
    setLevelDirty(true);
  };

  const updateRowFlowCode = (rowId: string, v: string, row: LookupRow | null) => {
    // Clearing the selection falls back to "NA" — same sentinel the backend
    // sends when nothing has been picked — rather than an empty string.
    const nextCode = v || "NA";
    setFlowRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId
          ? {
              ...r,
              flow_code: {
                value: nextCode,
                desc: v ? val((row as Record<string, unknown>) || {}, "FLOW_DESCRIPTION") : "",
              },
            }
          : r
      )
    );
    setLevelDirty(true);
  };

  // Clicking the small "view users" icon next to a filled cell shows that
  // specific row + level's role in the bottom panel, without touching the grid.
  const handleViewRoleUsers = (row: FlowRow, key: string) => {
    const cell = row.levels[key];
    if (!cell?.value) return;
    const levelLabel = LEVEL_FIELDS.find((f) => f.key === key)?.label || key;
    setSelectedRole(cell.value);
    setSelectedRoleDesc(cell.desc);
    setRoleUsersDirty(false);
    setRightPanelContext(`${levelLabel} — Role ${cell.value}`);
    void loadRoleUsers(cell.value);
  };

  const handleAddRow = () => {
    setFlowRows((prev) => [...prev, emptyRow(levelCount)]);
    setLevelDirty(true);
  };

  // Removing a row is purely client-side, same pattern as removing a user
  // from the Assigned Users grid below — its absence on Save Levels is what
  // tells the backend to drop it.
  const handleRemoveRow = (rowId: string) => {
    setFlowRows((prev) => {
      const next = prev.filter((r) => r.rowId !== rowId);
      return next.length ? next : [emptyRow(levelCount)];
    });
    setLevelDirty(true);
  };

  const handleSaveLevels = async () => {
    if (!selectedProcess) {
      setNotice({ type: "error", message: "Please select a process first." });
      return;
    }

    // Drop rows nobody touched (added via "+ Add Row" then left blank).
    const usableRows = flowRows.filter((r) => Object.values(r.levels).some((c) => c.value));

    if (usableRows.length === 0) {
      setNotice({ type: "error", message: "Add at least one row with Level 1 and Level 2." });
      return;
    }

    for (const row of usableRows) {
      if (!row.levels["level1_role"]?.value || !row.levels["level2_role"]?.value) {
        setNotice({ type: "error", message: "Level 1 and Level 2 are required on every row." });
        return;
      }
    }

    // Same Level 1 across rows is fine (one approver, multiple departments)
    // — but those rows must then use different Flow Codes, otherwise the
    // flows can't be told apart.
    const seen = new Set<string>();
    for (const row of usableRows) {
      const level1Value = row.levels["level1_role"]?.value || "";
      const key = `${level1Value}::${row.flow_code.value || "NA"}`;
      if (seen.has(key)) {
        setNotice({
          type: "error",
          message: `Two rows share Level 1 (${level1Value}) and Flow Code (${row.flow_code.value || "NA"}) — give one of them a different Flow Code.`,
        });
        return;
      }
      seen.add(key);
    }

    setSavingLevels(true);
    try {
      // Send every level the grid is currently showing for this process
      // (levelCount) — level6, level7, etc. included, not just 1-5 — so
      // insUpdMsApproverLevels actually receives and persists them.
      const payloadRows:any = usableRows.map((row) => {
        const payload: Record<string, unknown> = {};
        let lastLevel = 0;
        for (let i = 1; i <= levelCount; i++) {
          const key = `level${i}_role`;
          const v = row.levels[key]?.value || "";
          if (v) lastLevel = i;
          // Level 1 & 2 are required, so always send whatever's there;
          // levels 3+ are optional and omitted entirely when blank.
          payload[key] = i <= 2 ? v : v || undefined;
        }
        payload.last_level = lastLevel;
        payload.flow_code = row.flow_code.value || "NA";
        return payload;
      });

      const result = await saveFlowAssignLevels(companyCode, selectedProcess, payloadRows);

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
          role_id: selectedRole,
          loginid: rowLoginid,
          serial_no_or_role_id: selectedRole,
          userid: rowLoginid,
          create_user: loginid,
        };
      });

      // Payload now sends the whole row set plus top-level role_id/company_code,
      // matching the updated insSecRoleFunctionAccessUser backend signature.
      const result = await insSecRoleFunctionAccessUser({
        rows,
        role_id: selectedRole,
        company_code: companyCode,
      });

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

    setSelectedRole(modalRole);
    setSelectedRoleDesc(modalRoleDesc);
    setRightPanelContext(`Role ${modalRole}`);
  };

  const filledRowCount = flowRows.filter((r) => r.levels["level1_role"]?.value).length;

  return (
    <section className="grid gap-5">
      <div>
        <h1 className="m-0 text-2xl font-semibold text-foreground">Flow Assignment</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Configure approver levels per process, and assign users to roles.
        </p>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

{/* TOP: Process -> Approver Levels (horizontal grid, one row per flow) */}
<div className="grid gap-2.5 rounded-lg border bg-card p-3 shadow-sm">
  <div className="flex items-end gap-2">
    <label className="grid flex-1 gap-1 text-sm">
      <span className="font-medium text-foreground">Process</span>
      <LookupField
        value={selectedProcess}
        dense
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

  <div className="flex items-center justify-between">
    <h2 className="m-0 text-sm font-semibold text-foreground">Approver Levels</h2>
    <Button size="sm" variant="outline" onClick={handleAddRow} disabled={!selectedProcess || levelLoading}>
      <Plus size={14} /> Add Row
    </Button>
  </div>

  {!selectedProcess ? (
    // Nothing to show columns FOR yet — no process means no known level
    // count, so we don't render Level 1..N headers at all until one is
    // picked and the API tells us how many levels it actually has.
    <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
      Select a process above to view or configure its approver levels.
    </div>
  ) : levelLoading ? (
    <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
      Loading approver levels...
    </div>
  ) : (
  <div className="overflow-x-auto">
    <div style={{ minWidth: gridMinWidth }}>
      {/* header — columns are generated from LEVEL_FIELDS, which is sized
          off the level count detected from THIS process's API response */}
      <div className="grid gap-1.5 border-b pb-1.5" style={{ gridTemplateColumns }}>
        {LEVEL_FIELDS.map(({ key, label, required }) => (
          <span key={key} className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
            {required && <span className="ml-0.5 text-red-500">*</span>}
          </span>
        ))}
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Flow Code</span>
        <span />
      </div>

      {/* rows */}
      <div className="grid gap-1 pt-1.5">
        {flowRows.map((row) => (
          <div
            key={row.rowId}
            className="grid items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-muted/40"
            style={{ gridTemplateColumns }}
          >
            {LEVEL_FIELDS.map(({ key, required }) => (
              <div key={key} className="flex min-w-0 items-center gap-1">
                <div className="min-w-0 flex-1">
                  <LookupField
                  dense
                    value={row.levels[key].value}
                    displayValue={formatRoleDisplay(row.levels[key].value, row.levels[key].desc)}
                    placeholder={required ? "Select" : "None"}
                    columns={[
                      { field: "ROLE_ID", header: "Role Code" },
                      { field: "ROLE_DESC", header: "Role Description" },
                    ]}
                    valueField="ROLE_ID"
                    displayFields={["ROLE_ID", "ROLE_DESC"]}
                    loadOptions={loadRoleOptions}
                    disabled={!selectedProcess || levelLoading}
                    onChange={(v, r) => updateRowLevel(row.rowId, key, v, r)}
                  />
                </div>
                {row.levels[key].value && (
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title="View this role's assigned users"
                    onClick={() => handleViewRoleUsers(row, key)}
                  >
                    <Users size={12} />
                  </button>
                )}
              </div>
            ))}

            <div className="min-w-0">
              <LookupField
              dense
                value={row.flow_code.value === "NA" ? "" : row.flow_code.value}
                displayValue={row.flow_code.value === "NA" ? "NA" : formatRoleDisplay(row.flow_code.value, row.flow_code.desc)}
                placeholder="NA"
                columns={[
                  { field: "FLOW_CODE", header: "Flow Code" },
                  { field: "FLOW_DESCRIPTION", header: "Flow Description" },
                ]}
                valueField="FLOW_CODE"
                displayFields={["FLOW_CODE", "FLOW_DESCRIPTION"]}
                loadOptions={loadFlowCodeOptions}
                disabled={!selectedProcess || levelLoading}
                onChange={(v, r) => updateRowFlowCode(row.rowId, v, r)}
              />
            </div>

            <button
              type="button"
              className="shrink-0 text-muted-foreground hover:text-red-500"
              title="Remove row"
              onClick={() => handleRemoveRow(row.rowId)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  </div>
  )}

  <div className="flex items-center justify-between border-t pt-2">
    <span className="text-xs font-medium text-muted-foreground">
      {selectedProcess ? (
        <>Rows: <span className="tabular-nums text-foreground">{filledRowCount}</span></>
      ) : (
        <>&nbsp;</>
      )}
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

      {/* BOTTOM: users for whichever row/level's "view users" icon was last
          clicked, or a single role explicitly picked via Role Name */}
      <div className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-end justify-between gap-3">
          <label className="grid flex-1 gap-1 text-sm">
            <span className="font-medium text-foreground">Role Name</span>
            <LookupField
            dense
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
                  setRightPanelContext("");
                  void loadUsersForRows(flowRows);
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
           loaderType="circle" 
          density="grid"
          getRowId={(row: any, index: any) => val(row, "loginid") + "_" + val(row, "serial_no_or_role_id") + "_" + index}
        />

        <div className="flex justify-end gap-2 border-t pt-3">
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
            dense
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
            dense
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