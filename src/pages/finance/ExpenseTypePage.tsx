import { Edit2, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { executeCommonProcedure, getDynamicLookup, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../state/AuthContext";

type ExpenseTypeRow = {
  company_code: string;
  exp_type_code: string;
  exp_type_description: string;
};

type ExpenseSubTypeRow = {
  id: string;
  company_code: string;
  exp_subtype_code: string;
  exp_subtype_description: string;
  exp_type_code: string;
  dept_code: string;
};

type ExpenseCodeRow = {
  id: string;
  company_code: string;
  exp_type_code: string;
  exp_code: string;
  exp_description: string;
  ref_code: string;
};

type ActiveGrid = "subtype" | "expcode" | null;
type DeleteTarget = { grid: Exclude<ActiveGrid, null>; row: ExpenseSubTypeRow | ExpenseCodeRow } | null;

export function ExpenseTypePage() {
  const { user } = useAuth();
  const [expenseTypes, setExpenseTypes] = useState<ExpenseTypeRow[]>([]);
  const [selected, setSelected] = useState<ExpenseTypeRow | null>(null);
  const [subTypes, setSubTypes] = useState<ExpenseSubTypeRow[]>([]);
  const [expenseCodes, setExpenseCodes] = useState<ExpenseCodeRow[]>([]);
  const [dirtySubTypes, setDirtySubTypes] = useState<Record<string, ExpenseSubTypeRow>>({});
  const [dirtyExpenseCodes, setDirtyExpenseCodes] = useState<Record<string, ExpenseCodeRow>>({});
  const [activeGrid, setActiveGrid] = useState<ActiveGrid>(null);
  const [query, setQuery] = useState("");
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";

  const loadExpenseTypes = async (clearNotice = true) => {
    setLoadingTypes(true);
    if (clearNotice) setNotice(null);
    try {
      const rows = await getDynamicLookup({
        parameter: "AC_EXPSTYPE_EXPSTYPE_MASTER",
        loginid: loginId,
        code1: companyCode,
      });
      const mapped = rows.map(mapExpenseType);
      setExpenseTypes(mapped);
      if (selected && !mapped.some((row) => row.exp_type_code === selected.exp_type_code)) {
        setSelected(null);
        setSubTypes([]);
        setExpenseCodes([]);
      }
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load expense types" });
    } finally {
      setLoadingTypes(false);
    }
  };

  const loadDetails = async (row: ExpenseTypeRow, clearNotice = true) => {
    setSelected(row);
    setActiveGrid(null);
    setDirtySubTypes({});
    setDirtyExpenseCodes({});
    setLoadingDetails(true);
    if (clearNotice) setNotice(null);
    try {
      const [subTypeRows, codeRows] = await Promise.all([
        getDynamicLookup({
          parameter: "AC_EXPSTYPE_EXPSUBTYPE_MASTER",
          loginid: loginId,
          code1: row.company_code || companyCode,
          code2: row.exp_type_code,
        }),
        getDynamicLookup({
          parameter: "AC_EXPSTYPE_EXPCODE_MASTER",
          loginid: loginId,
          code1: row.company_code || companyCode,
          code2: row.exp_type_code,
        }),
      ]);
      setSubTypes(subTypeRows.map(mapSubType));
      setExpenseCodes(codeRows.map(mapExpenseCode));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load expense details" });
      setSubTypes([]);
      setExpenseCodes([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    void loadExpenseTypes();
  }, []);

  const filteredTypes = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return expenseTypes;
    return expenseTypes.filter((row) => `${row.exp_type_code} ${row.exp_type_description}`.toLowerCase().includes(term));
  }, [expenseTypes, query]);

  const dirtyCount = Object.keys(dirtySubTypes).length + Object.keys(dirtyExpenseCodes).length;

  const markSubTypeDirty = useCallback((row: ExpenseSubTypeRow) => {
    setSubTypes((prev) => prev.map((item) => (item.id === row.id ? row : item)));
    setDirtySubTypes((prev) => ({ ...prev, [row.id]: row }));
  }, []);

  const markExpenseCodeDirty = useCallback((row: ExpenseCodeRow) => {
    setExpenseCodes((prev) => prev.map((item) => (item.id === row.id ? row : item)));
    setDirtyExpenseCodes((prev) => ({ ...prev, [row.id]: row }));
  }, []);

  const addSubTypeRow = useCallback( () => {
    if (!selected) return;
    const row: ExpenseSubTypeRow = {
      id: `sub_new_${Date.now()}`,
      company_code: selected.company_code || companyCode,
      exp_subtype_code: "",
      exp_subtype_description: "",
      exp_type_code: selected.exp_type_code,
      dept_code: "",
    };
    setSubTypes((prev) => [...prev, row]);
    setDirtySubTypes((prev) => ({ ...prev, [row.id]: row }));
    setActiveGrid("subtype");
  }, [selected, companyCode]);

  const addExpenseCodeRow = useCallback(() => {
    if (!selected) return;
    const row: ExpenseCodeRow = {
      id: `code_new_${Date.now()}`,
      company_code: selected.company_code || companyCode,
      exp_type_code: selected.exp_type_code,
      exp_code: "",
      exp_description: "",
      ref_code: "",
    };
    setExpenseCodes((prev) => [...prev, row]);
    setDirtyExpenseCodes((prev) => ({ ...prev, [row.id]: row }));
    setActiveGrid("expcode");
  }, [selected, companyCode]);

  const saveChanges = async () => {
    if (!selected || dirtyCount === 0) return;
    setSaving(true);
    setNotice(null);
    try {
      const expsubtypes = Object.values(dirtySubTypes)
        .filter((row) => row.exp_subtype_code.trim() || row.exp_subtype_description.trim())
        .map((row) => ({
          company_code: row.company_code || selected.company_code || companyCode,
          exp_subtype_code: row.exp_subtype_code.trim(),
          exp_subtype_description: row.exp_subtype_description.trim(),
          exp_type_code: row.exp_type_code || selected.exp_type_code,
        }));

      const expcodes = Object.values(dirtyExpenseCodes)
        .filter((row) => row.exp_code.trim() || row.exp_description.trim())
        .map((row) => ({
          company_code: row.company_code || selected.company_code || companyCode,
          exp_type_code: row.exp_type_code || selected.exp_type_code,
          exp_code: row.exp_code.trim(),
          exp_description: row.exp_description.trim(),
        }));

      if (!expsubtypes.length && !expcodes.length) {
        setNotice({ type: "error", message: "Enter a code and description before saving." });
        return;
      }

      await postFinance("insUpdAcExpTypeBulk", { expsubtypes, expcodes, loginId });
      setDirtySubTypes({});
      setDirtyExpenseCodes({});
      setActiveGrid(null);
      setNotice({ type: "success", message: "Expense setup saved successfully" });
      await loadDetails(selected, false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save expense setup" });
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async () => {
    if (!deleteTarget || !selected) return;
    const isSubType = deleteTarget.grid === "subtype";
    const row = deleteTarget.row;
    try {
      await executeCommonProcedure({
        parameter: "PROC_DELETE_EXPENSETYPE_AND_SUBTYPE",
        loginid: loginId,
        val1s1: selected.company_code || companyCode,
        val1s2: selected.exp_type_code,
        val1s3: isSubType ? (row as ExpenseSubTypeRow).exp_subtype_code : "",
        val1s4: isSubType ? "" : (row as ExpenseCodeRow).exp_code,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: isSubType ? "Sub type deleted" : "Expense code deleted" });
      await loadDetails(selected, false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete row" });
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Finance Master</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Expense Type</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirtyCount > 0 && <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{dirtyCount} unsaved</span>}
          <Button variant="outline" onClick={() => void loadExpenseTypes()}><RefreshCw size={15} /> Refresh</Button>
          <Button disabled={!selected || dirtyCount === 0 || saving} onClick={() => void saveChanges()}>{saving ? <span className="spinner small" /> : <Save size={15} />} Save Changes</Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <div className="grid min-h-[650px] grid-cols-[350px_minmax(0,1fr)] gap-4 max-xl:grid-cols-1">
        <Card className="overflow-hidden">
          <CardHeader className="gap-3 border-b">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Expense Types</p>
                <h2 className="m-0 text-base font-semibold">{loadingTypes ? "Loading" : `${filteredTypes.length} Records`}</h2>
              </div>
            </div>
            <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-muted-foreground">
              <Search size={15} />
              <Input className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search expense type..." />
            </label>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[590px] overflow-auto">
              {loadingTypes ? (
                <div className="grid gap-2 p-3">{Array.from({ length: 12 }).map((_, index) => <Skeleton key={index} />)}</div>
              ) : filteredTypes.length === 0 ? (
                <div className="px-3 py-12 text-center text-sm text-muted-foreground">No expense types found</div>
              ) : (
                <div className="divide-y">
                  {filteredTypes.map((row) => {
                    const active = row.exp_type_code === selected?.exp_type_code;
                    return (
                      <button className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-accent ${active ? "bg-[#eaf2ff]" : ""}`} key={row.exp_type_code} onClick={() => void loadDetails(row)}>
                        <span className="rounded-md bg-[#eef3fb] px-2 py-1 text-xs font-bold text-[#17345f]">{row.exp_type_code}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{row.exp_type_description || "Untitled"}</span>
                          <span className="block text-xs text-muted-foreground">{row.company_code || companyCode}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid min-h-[650px] grid-rows-2 gap-4">
          <EditableExpenseTable
            title="Sub Types"
            subtitle={selected ? `${selected.exp_type_code} - ${selected.exp_type_description}` : "Select an expense type"}
            active={activeGrid === "subtype"}
            disabled={!selected || activeGrid === "expcode"}
            loading={loadingDetails}
            rows={subTypes}
            columns={[
              { key: "exp_subtype_code", label: "Sub Type Code", width: "160px" },
              { key: "exp_subtype_description", label: "Description" },
            ]}
            rowKey={(row) => row.id}
            onEdit={() => setActiveGrid(activeGrid === "subtype" ? null : "subtype")}
            onAdd={addSubTypeRow}
            onDelete={(row) => setDeleteTarget({ grid: "subtype", row })}
            onChange={(row, key, value) => markSubTypeDirty({ ...row, [key]: value })}
          />
          <EditableExpenseTable
            title="Expense Codes"
            subtitle={selected ? `${selected.exp_type_code} - ${selected.exp_type_description}` : "Select an expense type"}
            active={activeGrid === "expcode"}
            disabled={!selected || activeGrid === "subtype"}
            loading={loadingDetails}
            rows={expenseCodes}
            columns={[
              { key: "exp_code", label: "Expense Code", width: "160px" },
              { key: "exp_description", label: "Description" },
            ]}
            rowKey={(row) => row.id}
            onEdit={() => setActiveGrid(activeGrid === "expcode" ? null : "expcode")}
            onAdd={addExpenseCodeRow}
            onDelete={(row) => setDeleteTarget({ grid: "expcode", row })}
            onChange={(row, key, value) => markExpenseCodeDirty({ ...row, [key]: value })}
          />
        </div>
      </div>

      {deleteTarget && (
        <Dialog
          open
          compact
          tone="danger"
          title="Delete Row"
          description="This will remove the selected setup row."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void deleteRow()}>Delete</Button>
            </>
          }
        >
          <p className="modal-copy">Delete this {deleteTarget.grid === "subtype" ? "sub type" : "expense code"}?</p>
        </Dialog>
      )}
    </section>
  );
}

function EditableExpenseTable<T extends Record<string, string>>({
  title,
  subtitle,
  active,
  disabled,
  loading,
  rows,
  columns,
  rowKey,
  onEdit,
  onAdd,
  onDelete,
  onChange,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  disabled: boolean;
  loading: boolean;
  rows: T[];
  columns: { key: keyof T; label: string; width?: string }[];
  rowKey: (row: T) => string;
  onEdit: () => void;
  onAdd: () => void;
  onDelete: (row: T) => void;
  onChange: (row: T, key: keyof T, value: string) => void;
}) {

  const onChangeRef = useRef(onChange);
useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
const onDeleteRef = useRef(onDelete);
useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);

const tableColumns = useMemo<ColumnDef<T>[]>(() => [
  ...columns.map<ColumnDef<T>>((column) => ({
    accessorKey: String(column.key),
    header: column.label,
    size: column.width ? Number.parseInt(column.width, 10) : undefined,
    cell: ({ row }) => {
      const original = row.original;
      return active ? (
        <Input
          className="h-9"
          defaultValue={String(original[column.key] || "")}
          onBlur={(e) => onChangeRef.current(original, column.key, e.target.value)}
        />
      ) : (
        <span className={column.width ? "font-medium" : ""}>{String(original[column.key] || "")}</span>
      );
    },
  })),
  {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    cell: ({ row }) => (
      <Button size="icon" variant="ghost" disabled={disabled} onClick={() => onDeleteRef.current(row.original)}>
        <Trash2 size={15} />
      </Button>
    ),
  },
 ], [active, columns,disabled, onChange, onDelete]);

  return (
    <div className={active ? "rounded-md ring-2 ring-primary/30" : ""}>
      <DataTable
        columns={tableColumns}
        data={rows}
        title={subtitle}
        subtitle={title}
        loading={loading}
        emptyText="No rows found"
        height={270}
        density="grid"
        getRowId={(row) => rowKey(row)}
        toolbar={
          <>
          <Button size="sm" variant="outline" disabled={disabled || !active} onClick={onAdd}><Plus size={14} /> Add</Button>
          <Button size="sm" variant={active ? "secondary" : "outline"} disabled={disabled} onClick={onEdit}>{active ? <X size={14} /> : <Edit2 size={14} />} {active ? "Cancel" : "Edit"}</Button>
          </>
        }
      />
    </div>
  );
}

function mapExpenseType(row: LookupRow): ExpenseTypeRow {
  return {
    company_code: String(getLookupValue(row, "company_code") || ""),
    exp_type_code: String(getLookupValue(row, "exp_type_code") || ""),
    exp_type_description: String(getLookupValue(row, "exp_type_description") || ""),
  };
}

function mapSubType(row: LookupRow, index: number): ExpenseSubTypeRow {
  const code = String(getLookupValue(row, "exp_subtype_code") || "");
  return {
    id: `sub_${code || index}`,
    company_code: String(getLookupValue(row, "company_code") || ""),
    exp_subtype_code: code,
    exp_subtype_description: String(getLookupValue(row, "exp_subtype_description") || ""),
    exp_type_code: String(getLookupValue(row, "exp_type_code") || ""),
    dept_code: String(getLookupValue(row, "dept_code") || ""),
  };
}

function mapExpenseCode(row: LookupRow, index: number): ExpenseCodeRow {
  const code = String(getLookupValue(row, "exp_code") || "");
  return {
    id: `code_${code || index}`,
    company_code: String(getLookupValue(row, "company_code") || ""),
    exp_type_code: String(getLookupValue(row, "exp_type_code") || ""),
    exp_code: code,
    exp_description: String(getLookupValue(row, "exp_description") || ""),
    ref_code: String(getLookupValue(row, "ref_code") || ""),
  };
}
