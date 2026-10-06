import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useState, useMemo, useCallback } from "react";
import { getDynamicLookup } from "../../api/lookups";
import { useAuth } from "../../state/AuthContext";
import { DataTable } from "../../components/ui/DataTable";
import { LookupField } from "../../components/ui/LookupField";
import { Button } from "../../components/ui/Button";
import { api } from "../../api/client";

type AllUser = {
  user_id: string;
  username: string;
};

type AssignedUser = {
  company_code: string;
  div_code: string;
  user_id: string;
  user_name: string;
  assigned_by: string;
  assigned_date: string;
  default_div: string | boolean;
};

type PendingUser = {
  user_id: string;
  user_name: string;
  default_div: string; // "Y" | "N"
  company_code: string;
  div_code: string;
  assigned_by: string;
  assigned_date: string;
};

const TABLE_HEIGHT = 360;
const LEFT_MIN_WIDTH = 280;
const RIGHT_MIN_WIDTH = 320;

const AssignUserDiv = () => {
  const { user } = useAuth();

  const [divCode, setDivCode] = useState("");
  const [divName, setDivName] = useState("");
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editedSavedUsers, setEditedSavedUsers] = useState<Record<string, string>>({});
  // Users already saved that the user wants to remove
  const [removedSavedIds, setRemovedSavedIds] = useState<Record<string, boolean>>({});
  const [selectedAvailable, setSelectedAvailable] = useState<Record<string, boolean>>({});
  const [selectedAssigned, setSelectedAssigned] = useState<Record<string, boolean>>({});

  // ── data fetching ────────────────────────────────────────────────────────────
  const loadDivisions = async () => {
    const response = await getDynamicLookup({
      parameter: "DROP_DOWN_DIVISION",
      loginid: user?.loginid,
      code1: user?.company_code,
    });
    return Array.isArray(response) ? response : [];
  };

  const { data: allUsersData = [], isLoading: allUsersLoading } = useQuery({
    queryKey: ["allUsers", user?.company_code],
    queryFn: async () => {
      const response = await getDynamicLookup({
        parameter: "USER_ASSIGN_DIV_ALL_USER",
        loginid: user?.loginid,
        code1: user?.company_code,
      });
      return Array.isArray(response) ? (response as AllUser[]) : [];
    },
    enabled: !!user?.company_code,
  });

  const {
    data: savedAssignedUsers = [],
    isLoading: assignedUsersLoading,
    refetch: refetchAssigned,
  } = useQuery({
    queryKey: ["assignedUsers", user?.company_code, divCode],
    queryFn: async () => {
      const response = await getDynamicLookup({
        parameter: "USER_ASSIGN_DIV_ASSIGNED_USER",
        loginid: user?.loginid,
        code1: user?.company_code,
        code2: divCode,
      });
      return Array.isArray(response) ? (response as AssignedUser[]) : [];
    },
    enabled: !!user?.company_code && !!divCode,
  });

  // ── derived state ────────────────────────────────────────────────────────────
  const savedAssignedIds = useMemo(
    () => new Set(savedAssignedUsers.map((u) => u.user_id)),
    [savedAssignedUsers]
  );
  const pendingIds = useMemo(
    () => new Set(pendingUsers.map((u) => u.user_id)),
    [pendingUsers]
  );
  const removedIds = useMemo(
    () => new Set(Object.keys(removedSavedIds).filter((id) => removedSavedIds[id])),
    [removedSavedIds]
  );

  const availableUsers = useMemo(
    () =>
      allUsersData.filter(
        (u) =>
          !savedAssignedIds.has(u.user_id) &&
          !pendingIds.has(u.user_id) ||
          removedIds.has(u.user_id)
      ).filter(
        // keep removed-from-assigned users in available once removed
        (u) => !pendingIds.has(u.user_id) && (!savedAssignedIds.has(u.user_id) || removedIds.has(u.user_id))
      ),
    [allUsersData, savedAssignedIds, pendingIds, removedIds]
  );

  // Cleaner available list
  const availableUsersClean = useMemo(
    () =>
      allUsersData.filter((u) => {
        if (pendingIds.has(u.user_id)) return false;
        if (savedAssignedIds.has(u.user_id) && !removedIds.has(u.user_id)) return false;
        return true;
      }),
    [allUsersData, savedAssignedIds, pendingIds, removedIds]
  );

  const allAssignedUsers: AssignedUser[] = useMemo(
    () => [
      ...savedAssignedUsers
        .filter((u) => !removedIds.has(u.user_id))
        .map((u) => ({
          ...u,
          user_name:
            u.user_name ??
            allUsersData.find((a) => a.user_id === u.user_id)?.username ??
            u.user_id,
        })),
      ...pendingUsers.map((p) => ({
        company_code: p.company_code,
        div_code: p.div_code,
        user_id: p.user_id,
        user_name: p.user_name,
        assigned_by: p.assigned_by,
        assigned_date: p.assigned_date,
        default_div: p.default_div,
      })),
    ],
    [savedAssignedUsers, pendingUsers, allUsersData, removedIds]
  );

  const hasUnsavedChanges =
    pendingUsers.length > 0 ||
    Object.keys(editedSavedUsers).length > 0 ||
    removedIds.size > 0;

  const selectedAvailableCount = Object.values(selectedAvailable).filter(Boolean).length;
  const selectedAssignedCount = Object.values(selectedAssigned).filter(Boolean).length;

  // ── selection helpers ────────────────────────────────────────────────────────
  const toggleAvailable = useCallback((userId: string) => {
    setSelectedAvailable((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  }, []);

  const toggleAllAvailable = useCallback(() => {
    setSelectedAvailable((prev) => {
      const list = availableUsersClean;
      const allOn = list.length > 0 && list.every((u) => prev[u.user_id]);
      if (allOn) return {};
      const next: Record<string, boolean> = {};
      list.forEach((u) => {
        next[u.user_id] = true;
      });
      return next;
    });
  }, [availableUsersClean]);

  const toggleAssigned = useCallback((userId: string) => {
    setSelectedAssigned((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  }, []);

  const toggleAllAssigned = useCallback(() => {
    setSelectedAssigned((prev) => {
      const list = allAssignedUsers;
      const allOn = list.length > 0 && list.every((u) => prev[u.user_id]);
      if (allOn) return {};
      const next: Record<string, boolean> = {};
      list.forEach((u) => {
        next[u.user_id] = true;
      });
      return next;
    });
  }, [allAssignedUsers]);

  // ── column definitions ───────────────────────────────────────────────────────
  const allUserColumns: ColumnDef<AllUser>[] = useMemo(
    () => [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary cursor-pointer"
            checked={
              availableUsersClean.length > 0 &&
              availableUsersClean.every((u) => selectedAvailable[u.user_id])
            }
            ref={(el) => {
              if (el) {
                const count = availableUsersClean.filter(
                  (u) => selectedAvailable[u.user_id]
                ).length;
                el.indeterminate =
                  count > 0 && count < availableUsersClean.length;
              }
            }}
            onChange={toggleAllAvailable}
            disabled={!divCode || availableUsersClean.length === 0}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary cursor-pointer"
            checked={!!selectedAvailable[row.original.user_id]}
            onChange={() => toggleAvailable(row.original.user_id)}
            onClick={(e) => e.stopPropagation()}
            disabled={!divCode}
          />
        ),
        size: 40,
        enableSorting: false,
      },
      { accessorKey: "user_id", header: "User ID", size: 100 },
      { accessorKey: "username", header: "User Name" },
    ],
    [
      availableUsersClean,
      selectedAvailable,
      divCode,
      toggleAllAvailable,
      toggleAvailable,
    ]
  );

  const assignedUserColumns: ColumnDef<AssignedUser>[] = useMemo(
    () => [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary cursor-pointer"
            checked={
              allAssignedUsers.length > 0 &&
              allAssignedUsers.every((u) => selectedAssigned[u.user_id])
            }
            ref={(el) => {
              if (el) {
                const count = allAssignedUsers.filter(
                  (u) => selectedAssigned[u.user_id]
                ).length;
                el.indeterminate =
                  count > 0 && count < allAssignedUsers.length;
              }
            }}
            onChange={toggleAllAssigned}
            disabled={allAssignedUsers.length === 0}
          />
        ),
        cell: ({ row }) => {
          const userId = row.original.user_id;
          return (
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary cursor-pointer"
              checked={!!selectedAssigned[userId]}
              onChange={() => toggleAssigned(userId)}
              onClick={(e) => e.stopPropagation()}
            />
          );
        },
        size: 40,
        enableSorting: false,
      },
      { accessorKey: "user_id", header: "User ID", size: 100 },
      { accessorKey: "user_name", header: "User Name" },
      {
        accessorKey: "default_div",
        header: "Def.",
        size: 56,
        cell: ({ row }) => {
          const u = row.original;
          const isPending = pendingIds.has(u.user_id);
          const isSaved = savedAssignedIds.has(u.user_id) && !removedIds.has(u.user_id);

          const resolvedValue = isPending
            ? u.default_div
            : isSaved
            ? (editedSavedUsers[u.user_id] ?? u.default_div)
            : u.default_div;

          const checked = Boolean(
            resolvedValue === "Y" ||
              resolvedValue === true ||
              resolvedValue === "1"
          );

          const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            e.stopPropagation();
            if (isPending) {
              setPendingUsers((prev) =>
                prev.map((p) =>
                  p.user_id === u.user_id
                    ? { ...p, default_div: e.target.checked ? "Y" : "N" }
                    : p
                )
              );
            } else if (isSaved) {
              setEditedSavedUsers((prev) => ({
                ...prev,
                [u.user_id]: e.target.checked ? "Y" : "N",
              }));
            }
          };

          const isEditable = isPending || isSaved;

          return (
            <input
              type="checkbox"
              checked={checked}
              onChange={isEditable ? handleChange : undefined}
              readOnly={!isEditable}
              onClick={(e) => isEditable && e.stopPropagation()}
              title={isEditable ? "Set as default division" : undefined}
              className={`h-4 w-4 accent-primary ${
                isEditable ? "cursor-pointer" : "cursor-default opacity-50"
              }`}
            />
          );
        },
      },
      {
        id: "status",
        header: "",
        size: 52,
        cell: ({ row }) =>
          pendingIds.has(row.original.user_id) ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              New
            </span>
          ) : null,
      },
    ],
    [
      allAssignedUsers,
      selectedAssigned,
      pendingIds,
      savedAssignedIds,
      removedIds,
      editedSavedUsers,
      toggleAllAssigned,
      toggleAssigned,
    ]
  );

  // ── handlers ─────────────────────────────────────────────────────────────────
  const handleAssignSelected = () => {
    if (!divCode || selectedAvailableCount === 0) return;

    const toAdd = availableUsersClean.filter((u) => selectedAvailable[u.user_id]);

    // If any were previously marked removed, clear that mark
    setRemovedSavedIds((prev) => {
      const next = { ...prev };
      toAdd.forEach((u) => {
        if (next[u.user_id]) delete next[u.user_id];
      });
      return next;
    });

    setPendingUsers((prev) => [
      ...prev,
      ...toAdd
        .filter((u) => !savedAssignedIds.has(u.user_id) || removedIds.has(u.user_id))
        .filter((u) => !pendingIds.has(u.user_id))
        .map((u) => ({
          user_id: u.user_id,
          user_name: u.username,
          default_div: "N" as const,
          company_code: user?.company_code ?? "",
          div_code: divCode,
          assigned_by: user?.loginid ?? "",
          assigned_date: new Date().toISOString().slice(0, 10),
        })),
    ]);

    // If user was saved+removed, putting them back: just clear removed flag (already done)
    // and if they were only in removed state (still in savedAssignedUsers), no need to add to pending
    setPendingUsers((prev) => {
      const existing = new Set(prev.map((p) => p.user_id));
      const additions = toAdd
        .filter((u) => {
          // already saved and not removed anymore → no pending needed
          if (savedAssignedIds.has(u.user_id) && !removedIds.has(u.user_id)) return false;
          if (savedAssignedIds.has(u.user_id) && removedIds.has(u.user_id)) return false; // just un-remove
          return !existing.has(u.user_id);
        })
        .map((u) => ({
          user_id: u.user_id,
          user_name: u.username,
          default_div: "N" as const,
          company_code: user?.company_code ?? "",
          div_code: divCode,
          assigned_by: user?.loginid ?? "",
          assigned_date: new Date().toISOString().slice(0, 10),
        }));
      return [...prev, ...additions];
    });

    setSelectedAvailable({});
  };

  const handleUnassignSelected = () => {
    if (selectedAssignedCount === 0) return;

    const ids = Object.entries(selectedAssigned)
      .filter(([, on]) => on)
      .map(([id]) => id);

    // Remove pending ones from pending list
    setPendingUsers((prev) => prev.filter((u) => !ids.includes(u.user_id)));

    // Mark saved ones as removed
    setRemovedSavedIds((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (savedAssignedIds.has(id)) next[id] = true;
      });
      return next;
    });

    // Clear default-div edits for removed
    setEditedSavedUsers((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        delete next[id];
      });
      return next;
    });

    setSelectedAssigned({});
  };

  const handleSave = async () => {
    if (!divCode || !hasUnsavedChanges) return;
    setIsSaving(true);
    try {
      const companyCode = user?.company_code ?? "";
      const assignedBy = user?.loginid ?? "";
      const today = new Date().toISOString().slice(0, 10);

      const savedPayload = savedAssignedUsers
        .filter((u) => !removedIds.has(u.user_id))
        .map((u) => {
          const overridden = editedSavedUsers[u.user_id];
          const defaultDiv =
            overridden ??
            (u.default_div === true || u.default_div === "1"
              ? "Y"
              : u.default_div || "N");
          return {
            company_code: companyCode,
            div_code: divCode,
            user_id: u.user_id,
            default_div: defaultDiv,
            assigned_by: u.assigned_by || assignedBy,
            assigned_date: u.assigned_date || today,
            remarks: null,
          };
        });

      const pendingPayload = pendingUsers.map((p) => ({
        company_code: companyCode,
        div_code: divCode,
        user_id: p.user_id,
        default_div: p.default_div,
        assigned_by: p.assigned_by || assignedBy,
        assigned_date: p.assigned_date || today,
        remarks: null,
      }));

      // Always lead with a marker row (empty user_id)
      const payload = [
        {
          company_code: companyCode,
          div_code: divCode,
          user_id: "",
          default_div: "N",
          assigned_by: assignedBy,
          assigned_date: today,
          remarks: null,
        },
        ...savedPayload,
        ...pendingPayload,
      ];

      await api.post("/api/finance/upsertSecDivUser", payload);

      setPendingUsers([]);
      setEditedSavedUsers({});
      setRemovedSavedIds({});
      setSelectedAvailable({});
      setSelectedAssigned({});
      await refetchAssigned();
    } catch (err) {
      console.error("Failed to save assignments:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDivChange = (value: string, row: any) => {
    setDivCode(value);
    setDivName(
      row
        ? row.div_name ?? row.DIV_NAME ?? row.description ?? row.name ?? ""
        : ""
    );
    setPendingUsers([]);
    setEditedSavedUsers({});
    setRemovedSavedIds({});
    setSelectedAvailable({});
    setSelectedAssigned({});
  };

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="finance-utility-page workspace-main flex h-full flex-col gap-4 p-1">
      <div className="flex items-center justify-between gap-3">
        <h1 className="m-0 text-lg font-semibold tracking-tight text-foreground">
          Assign User Division
        </h1>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="hidden sm:inline rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              Unsaved changes
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={!divCode || !hasUnsavedChanges || isSaving}
            className="min-w-[96px]"
          >
            {isSaving ? "Assigning…" : "Assign"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[320px] flex-1">
            <LookupField
              label="Division"
              value={divCode}
              displayValue={
                divCode
                  ? divName
                    ? `${divCode} — ${divName}`
                    : divCode
                  : ""
              }
              columns={[
                { field: "div_code", header: "Code" },
                { field: "div_name", header: "Division Name" },
              ]}
              valueField="div_code"
              displayFields={["div_code", "div_name"]}
              loadOptions={loadDivisions}
              onChange={handleDivChange}
              placeholder="Select division…"
              required
            />
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_1fr]">
        {/* LEFT – Available Users */}
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center justify-between px-1">
            <p className="eyebrow m-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Available Users
              <span className="ml-1.5 font-normal normal-case text-muted-foreground/80">
                ({availableUsersClean.length})
              </span>
              {selectedAvailableCount > 0 && (
                <span className="ml-2 text-[10px] font-medium text-primary">
                  {selectedAvailableCount} selected
                </span>
              )}
            </p>
          </div>
          <div
            className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm"
            style={{ height: TABLE_HEIGHT }}
          >
            <DataTable
              columns={allUserColumns}
              data={availableUsersClean}
              loading={allUsersLoading}
              height={TABLE_HEIGHT}
              minWidth={LEFT_MIN_WIDTH}
              density="compact"
              enablePagination={false}
              enableColumnFilters={false}
              emptyText={
                divCode ? "No available users" : "Select a division first"
              }
              getRowId={(row) => row.user_id}
            />
          </div>
          <p className="px-1 text-[11px] text-muted-foreground">
            Check users, then click → to move them to Assigned
          </p>
        </div>

        {/* CENTER – Transfer buttons */}
        <div className="flex flex-row items-center justify-center gap-2 py-2 lg:flex-col lg:py-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAssignSelected}
            disabled={!divCode || selectedAvailableCount === 0}
            title="Assign selected users"
            className="h-9 w-9 p-0"
          >
            <span className="text-base leading-none">→</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUnassignSelected}
            disabled={selectedAssignedCount === 0}
            title="Remove selected from Assigned"
            className="h-9 w-9 p-0"
          >
            <span className="text-base leading-none">←</span>
          </Button>
        </div>

        {/* RIGHT – Assigned Users */}
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center justify-between px-1">
            <p className="eyebrow m-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Assigned Users
              <span className="ml-1.5 font-normal normal-case text-muted-foreground/80">
                ({allAssignedUsers.length})
              </span>
              {pendingUsers.length > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {pendingUsers.length} pending
                </span>
              )}
              {selectedAssignedCount > 0 && (
                <span className="ml-2 text-[10px] font-medium text-destructive">
                  {selectedAssignedCount} selected
                </span>
              )}
            </p>
          </div>
          <div
            className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm"
            style={{ height: TABLE_HEIGHT }}
          >
            <DataTable
              columns={assignedUserColumns}
              data={allAssignedUsers}
              loading={assignedUsersLoading}
              height={TABLE_HEIGHT}
              minWidth={RIGHT_MIN_WIDTH}
              density="compact"
              enablePagination={false}
              enableColumnFilters={false}
              emptyText={
                divCode ? "No users assigned yet" : "Select a division first"
              }
              getRowId={(row) => (row as AssignedUser).user_id}
              onRowClick={(row) => {
                const u = row as AssignedUser;
                toggleAssigned(u.user_id);
              }}
              rowClassName={(row) => {
                const u = row as AssignedUser;
                const isSelected = !!selectedAssigned[u.user_id];
                return isSelected
                  ? "cursor-pointer bg-primary/10"
                  : "cursor-pointer hover:bg-muted/50";
              }}
            />
          </div>
          <p className="px-1 text-[11px] text-muted-foreground">
            Select any user (including already assigned), then click ← to remove. Toggle Def. for default division.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AssignUserDiv;