import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
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

const TABLE_HEIGHT = 320;
const LEFT_MIN_WIDTH = 300;
const RIGHT_MIN_WIDTH = 360;

const AssignUserDiv = () => {
  const { user } = useAuth();

  const [divCode, setDivCode] = useState("");
  const [divName, setDivName] = useState("");
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editedSavedUsers, setEditedSavedUsers] = useState<Record<string, string>>({});

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
  const savedAssignedIds = new Set(savedAssignedUsers.map((u) => u.user_id));
  const pendingIds = new Set(pendingUsers.map((u) => u.user_id));

  const availableUsers = allUsersData.filter(
    (u) => !savedAssignedIds.has(u.user_id) && !pendingIds.has(u.user_id)
  );

  const allAssignedUsers: AssignedUser[] = [
    ...savedAssignedUsers.map((u) => ({
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
  ];

  // ── column definitions ───────────────────────────────────────────────────────
  const allUserColumns: ColumnDef<AllUser>[] = [
    { accessorKey: "user_id", header: "User ID", size: 110 },
    { accessorKey: "username", header: "User Name" },
  ];

  const assignedUserColumns: ColumnDef<AssignedUser>[] = [
    { accessorKey: "user_id", header: "User ID", size: 110 },
    { accessorKey: "user_name", header: "User Name" },
    {
      accessorKey: "default_div",
      header: "Def. Div",
      size: 64,
      cell: ({ row }) => {
        const u = row.original;
        const isPending = pendingIds.has(u.user_id);
        const isSaved = savedAssignedIds.has(u.user_id);

        const resolvedValue = isPending
          ? u.default_div
          : isSaved
          ? (editedSavedUsers[u.user_id] ?? u.default_div)
          : u.default_div;

        const checked = Boolean(
          resolvedValue === "Y" || resolvedValue === true || resolvedValue === "1"
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
            className={`h-4 w-4 accent-primary ${isEditable ? "cursor-pointer" : "cursor-default"}`}
          />
        );
      },
    },
    {
      id: "status",
      header: "",
      size: 44,
      cell: ({ row }) =>
        pendingIds.has(row.original.user_id) ? (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
            New
          </span>
        ) : null,
    },
  ];

  // ── handlers ─────────────────────────────────────────────────────────────────
  const handleMoveToAssigned = (clickedUser: AllUser) => {
    if (!divCode) return;
    setPendingUsers((prev) => [
      ...prev,
      {
        user_id: clickedUser.user_id,
        user_name: clickedUser.username,
        default_div: "N",
        company_code: user?.company_code ?? "",
        div_code: divCode,
        assigned_by: user?.loginid ?? "",
        assigned_date: new Date().toISOString().slice(0, 10),
      },
    ]);
  };

  const handleMoveToAvailable = (clickedUser: AssignedUser) => {
    if (pendingIds.has(clickedUser.user_id)) {
      setPendingUsers((prev) =>
        prev.filter((u) => u.user_id !== clickedUser.user_id)
      );
    }
  };

  const handleSave = async () => {
    if (!divCode || (pendingUsers.length === 0 && Object.keys(editedSavedUsers).length === 0)) return;
    setIsSaving(true);
    try {
      const savedPayload = savedAssignedUsers.map((u) => {
        const overriddenDefaultDiv = editedSavedUsers[u.user_id];
        const defaultDiv =
          overriddenDefaultDiv ??
          (u.default_div === true || u.default_div === "1" ? "Y" : u.default_div || "N");
        return {
          company_code: u.company_code,
          div_code: u.div_code,
          user_id: u.user_id,
          default_div: defaultDiv,
          assigned_by: u.assigned_by,
          assigned_date: u.assigned_date,
        };
      });

      const pendingPayload = pendingUsers.map((p) => ({
        company_code: p.company_code,
        div_code: p.div_code,
        user_id: p.user_id,
        default_div: p.default_div,
        assigned_by: p.assigned_by,
        assigned_date: p.assigned_date,
      }));

      await api.post("/api/finance/upsertSecDivUser", [...savedPayload, ...pendingPayload]);

      setPendingUsers([]);
      setEditedSavedUsers({});
      await refetchAssigned();
    } catch (err) {
      console.error("Failed to save assignments:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDivChange = (value: string, row: any) => {
    setDivCode(value);
    setDivName(row ? (row.div_name ?? row.description ?? row.name ?? "") : "");
    setPendingUsers([]);
    setEditedSavedUsers({});
  };

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="workspace-main flex flex-col gap-3 p-3">
      {/* Header bar */}
      <div className="rounded-lg border border-[#c7d2e3] bg-card px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div style={{ minWidth: 240 }}>
            <LookupField
              label="Division Code"
              value={divCode}
              displayValue={divCode}
              columns={[
                { field: "div_code", header: "Code" },
                { field: "div_name", header: "Division Name" },
              ]}
              valueField="div_code"
              displayFields={["div_code"]}
              loadOptions={loadDivisions}
              onChange={handleDivChange}
              placeholder="Select Division"
              required
            />
          </div>
          <div className="field" style={{ minWidth: 200, flex: 1 }}>
            <span>Division Name</span>
            <input
              className="ui-input"
              readOnly
              value={divName}
              placeholder="—"
              tabIndex={-1}
            />
          </div>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-2 gap-3">

        {/* Left – Available Users */}
        <div className="flex min-w-0 flex-col gap-1">
          <p className="eyebrow px-1 text-[11px]">
            Available Users
            <span className="ml-1.5 font-normal normal-case text-muted-foreground">
              — click a row to assign
            </span>
          </p>
          <div className="overflow-hidden" style={{ height: TABLE_HEIGHT }}>
            <DataTable
              columns={allUserColumns}
              data={availableUsers}
              loading={allUsersLoading}
              height={TABLE_HEIGHT}
              minWidth={LEFT_MIN_WIDTH}
              density="compact"
              enablePagination={false}
              enableColumnFilters={false}
              emptyText="No available users"
              getRowId={(row) => row.user_id}
              onRowClick={(row) => divCode && handleMoveToAssigned(row)}
              rowClassName={() =>
                divCode
                  ? "cursor-pointer hover:bg-primary/5"
                  : "cursor-not-allowed opacity-60"
              }
            />
          </div>
        </div>

        {/* Right – Assigned Users */}
        <div className="flex min-w-0 flex-col gap-1">
          <p className="eyebrow px-1 text-[11px]">
            Assigned Users
            {pendingUsers.length > 0 && (
              <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                {pendingUsers.length} pending
              </span>
            )}
          </p>
          <div className="overflow-hidden" style={{ height: TABLE_HEIGHT }}>
            <DataTable
              columns={assignedUserColumns}
              data={allAssignedUsers}
              loading={assignedUsersLoading}
              height={TABLE_HEIGHT}
              minWidth={RIGHT_MIN_WIDTH}
              density="compact"
              enablePagination={false}
              enableColumnFilters={false}
              emptyText={divCode ? "No users assigned" : "Select a division first"}
              getRowId={(row) => (row as AssignedUser).user_id}
              onRowClick={(row) => handleMoveToAvailable(row as AssignedUser)}
              rowClassName={(row) =>
                pendingIds.has((row as AssignedUser).user_id)
                  ? "cursor-pointer hover:bg-destructive/5"
                  : "cursor-default"
              }
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              onClick={handleSave}
              disabled={
                !divCode ||
                (pendingUsers.length === 0 && Object.keys(editedSavedUsers).length === 0) ||
                isSaving
              }
            >
              {isSaving ? "Saving…" : "Assign"}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AssignUserDiv;