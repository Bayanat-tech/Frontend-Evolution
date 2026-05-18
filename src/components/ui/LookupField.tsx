import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { getLookupText, getLookupValue, LookupRow } from "../../api/lookups";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Input } from "./Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";

type LookupColumn = {
  field: string;
  header: string;
};

type LookupFieldProps = {
  label: string;
  value: string;
  displayValue?: string;
  columns: LookupColumn[];
  valueField: string;
  displayFields: string[];
  loadOptions: () => Promise<LookupRow[]>;
  onChange: (value: string, row: LookupRow | null) => void;
  disabled?: boolean;
  compact?: boolean;
  placeholder?: string;
};

export function LookupField({
  label,
  value,
  displayValue,
  columns,
  valueField,
  displayFields,
  loadOptions,
  onChange,
  disabled,
  compact,
  placeholder,
}: LookupFieldProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [selectedRow, setSelectedRow] = useState<LookupRow | null>(null);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => Object.values(row).some((item) => String(item ?? "").toLowerCase().includes(term)));
  }, [query, rows]);

  const openLookup = async () => {
    if (disabled) return;
    setOpen(true);
    setSelectedRow(rows.find((row) => String(getLookupValue(row, valueField) || "") === value) || null);
    if (rows.length > 0) return;
    setLoading(true);
    setError("");
    try {
      setRows(await loadOptions());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load lookup");
    } finally {
      setLoading(false);
    }
  };

  const selectRow = (row: LookupRow) => {
    onChange(String(getLookupValue(row, valueField) || ""), row);
    setOpen(false);
    setQuery("");
    setSelectedRow(null);
  };

  const confirmSelection = () => {
    if (!selectedRow) return;
    selectRow(selectedRow);
  };

  return (
    <>
      <label className={compact ? "block" : "field"}>
        {!compact && <span>{label}</span>}
        <div className="flex h-9 overflow-hidden rounded-md border bg-background">
          <button
            className="min-w-0 flex-1 border-0 bg-transparent px-3 text-left text-sm text-foreground disabled:opacity-60"
            type="button"
            onClick={openLookup}
            disabled={disabled}
          >
            <span className={value ? "block truncate" : "block truncate text-muted-foreground"}>
              {displayValue || value || placeholder || `Select ${label}`}
            </span>
          </button>
          {value && !disabled && (
            <button className="grid w-8 place-items-center text-muted-foreground hover:bg-accent" type="button" onClick={() => onChange("", null)}>
              <X size={14} />
            </button>
          )}
          <button className="grid w-9 place-items-center border-l text-muted-foreground hover:bg-accent" type="button" onClick={openLookup} disabled={disabled}>
            <Search size={15} />
          </button>
        </div>
      </label>

      <Dialog
        open={open}
        wide
        title={label}
        description="Search and select a value"
        onClose={() => {
          setOpen(false);
          setSelectedRow(null);
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setSelectedRow(null);
              }}
            >
              Cancel
            </Button>
            <Button disabled={!selectedRow} onClick={confirmSelection}>Select</Button>
          </>
        }
      >
        <div className="grid gap-3">
          <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-muted-foreground shadow-sm">
            <Search size={15} />
            <Input
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search code, name, description..."
            />
          </label>
          {error && <div className="alert error">{error}</div>}
          <div className="max-h-[420px] overflow-auto rounded-md border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  {columns.map((column) => (
                    <TableHead key={column.field}>
                      {column.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell className="px-3 py-8 text-center text-muted-foreground" colSpan={columns.length + 1}>Loading...</TableCell></TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow><TableCell className="px-3 py-8 text-center text-muted-foreground" colSpan={columns.length + 1}>No records found</TableCell></TableRow>
                ) : (
                  filteredRows.map((row, index) => {
                    const selected = String(getLookupValue(row, valueField) || "") === value;
                    const tempSelected = selectedRow
                      ? String(getLookupValue(selectedRow, valueField) || "") === String(getLookupValue(row, valueField) || "")
                      : selected;
                    return (
                      <TableRow
                        className={
                          tempSelected
                            ? "cursor-pointer border-l-4 border-l-[var(--primary)] bg-primary/10"
                            : "cursor-pointer border-l-4 border-l-transparent hover:bg-accent"
                        }
                        key={`${getLookupValue(row, valueField) || index}`}
                        onDoubleClick={() => selectRow(row)}
                        onClick={() => setSelectedRow(row)}
                      >
                        <TableCell className="px-3 py-2 text-center">
                          <input
                            aria-label="Select row"
                            checked={tempSelected}
                            className="h-4 w-4 accent-[var(--primary)]"
                            onChange={() => setSelectedRow(row)}
                            type="radio"
                          />
                        </TableCell>
                        {columns.map((column) => (
                          <TableCell className="px-3 py-2 text-xs" key={column.field}>
                            {String(getLookupValue(row, column.field) || "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <p className="m-0 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Current: {displayValue || (value ? getLookupText({ [valueField]: value }, [valueField]) : "None")}
          </p>
        </div>
      </Dialog>
    </>
  );
}
