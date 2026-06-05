import {
  ColumnDef,
  ColumnFiltersState,
  Column,
  FilterFn,
  RowSelectionState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowDownUp, ArrowUp, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, Search, X } from "lucide-react";
import { ReactNode, UIEvent, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { ExportCSVButton } from "./ExportCSVButton";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";

export type WmsDataTableDensity = "grid" | "compact" | "comfortable" | "large";

export type WmsDataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  title?: string;
  subtitle?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  loading?: boolean;
  emptyText?: string;
  height?: number | string;
  minWidth?: number | string;
  density?: WmsDataTableDensity;
  pageSize?: number;    
  enablePagination?: boolean;
  manualPagination?: boolean;
  pageIndex?: number;
  totalRows?: number;
  onPageChange?: (pageIndex: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  manualFiltering?: boolean;
  enableColumnFilters?: boolean;
  enableColumnVisibility?: boolean;
  enableExport?: boolean;
  exportFilename?: string;
  rowClassName?: (row: TData) => string;
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData, index: number) => string;
  /** Called whenever row selection changes; receives array of selected row originals */
   onRowSelectionChange?: (selectedRows: TData[]) => void;
  initialSorting?: SortingState;
};

const densityClasses: Record<WmsDataTableDensity, { row: string; cell: string }> = {
  grid: { row: "h-7", cell: "px-2 py-0.5 text-[11px] leading-tight" },
  compact: { row: "h-8", cell: "px-2 py-1 text-xs leading-tight" },
  comfortable: { row: "h-12", cell: "py-3" },
  large: { row: "h-14", cell: "py-3.5" },
};

const includesText: FilterFn<unknown> = (row, columnId, filterValue) => {
  const search = String(filterValue ?? "").trim().toLowerCase();
  if (!search) return true;
  return String(row.getValue(columnId) ?? "").toLowerCase().includes(search);
};

const globalIncludesText: FilterFn<unknown> = (row, _columnId, filterValue) => {
  const search = String(filterValue ?? "").trim().toLowerCase();
  if (!search) return true;
  return row.getAllCells().some((cell) => String(cell.getValue() ?? "").toLowerCase().includes(search));
};

const dateBetween: FilterFn<unknown> = (row, columnId, filterValue) => {
  const range = filterValue as { from?: string; to?: string } | undefined;
  if (!range?.from && !range?.to) return true;
  const value = toDateOnly(row.getValue(columnId));
  if (!value) return false;
  if (range.from && value < range.from) return false;
  if (range.to && value > range.to) return false;
  return true;
};

export function WmsDataTable<TData, TValue>({
  columns,
  data,
  title: _title,
  subtitle: _subtitle,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  toolbar,
  loading,
  emptyText = "No records found",
  height = 590,
  minWidth,
  density = "comfortable",
  pageSize = 500,
  enablePagination = false,
  manualPagination = false,
  pageIndex = 0,
  totalRows,
  onPageChange,
  onPageSizeChange,
  columnFilters: controlledColumnFilters,
  onColumnFiltersChange,
  manualFiltering = false,
  enableColumnFilters = true,
  enableColumnVisibility = false,
  enableExport,
  exportFilename,
  rowClassName,
  onRowClick,
  getRowId,
  onRowSelectionChange,
  initialSorting = [],
}: WmsDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [internalColumnFilters, setInternalColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [internalSearch, setInternalSearch] = useState("");
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [scrollContentWidth, setScrollContentWidth] = useState(0);
  const globalFilter = searchValue ?? internalSearch;
  const columnFilters = controlledColumnFilters ?? internalColumnFilters;
  const rowStyle = densityClasses[density];
  const enhancedColumns = useMemo(
    () => columns.map((column) => {
      const id = "id" in column && column.id ? column.id : "accessorKey" in column ? String(column.accessorKey) : "";
      return isDateColumn(id) && !column.filterFn ? { ...column, filterFn: dateBetween as FilterFn<TData> } : column;
    }),
    [columns],
  );

  const table = useReactTable({
    data,
    columns: enhancedColumns,
    getRowId,
    filterFns: {
      includesText: includesText as FilterFn<TData>,
      dateBetween: dateBetween as FilterFn<TData>,
    },
    globalFilterFn: globalIncludesText as FilterFn<TData>,
    defaultColumn: {
      filterFn: includesText as FilterFn<TData>,
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      rowSelection,
    },
    initialState: {
      pagination: { pageIndex: 0, pageSize },
    },
    enableRowSelection: !!onRowSelectionChange,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater;
      setRowSelection(next);
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: (updater) => {
      const nextFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      if (onColumnFiltersChange) {
        onColumnFiltersChange(nextFilters);
      } else {
        setInternalColumnFilters(nextFilters);
      }
    },
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: onSearchChange ?? setInternalSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination,
    manualFiltering,
    pageCount: manualPagination ? Math.max(1, Math.ceil((totalRows ?? data.length) / Math.max(pageSize, 1))) : undefined,
  });

  const visibleRows = manualFiltering ? table.getCoreRowModel().rows : manualPagination ? table.getSortedRowModel().rows : enablePagination ? table.getRowModel().rows : table.getFilteredRowModel().rows;
  const exportRows = (manualPagination || manualFiltering ? table.getCoreRowModel().rows : table.getFilteredRowModel().rows).map((row) => row.original);
  const showExport = enableExport ?? Boolean(onSearchChange || enablePagination || manualPagination);
  const skeletonRows = useMemo(() => Array.from({ length: Math.min(loading ? pageSize : 0, 100) }), [pageSize, loading]);
  const heightValue = typeof height === "number" ? `${height}px` : height;
  const responsiveMinWidth = minWidth ?? Math.max(760, enhancedColumns.length * 140);
  const minWidthValue = typeof responsiveMinWidth === "number" ? `${responsiveMinWidth}px` : responsiveMinWidth;
  const pageCount = manualPagination ? Math.max(1, Math.ceil((totalRows ?? data.length) / Math.max(pageSize, 1))) : table.getPageCount() || 1;
  const currentPageIndex = manualPagination ? pageIndex : table.getState().pagination.pageIndex;
  const effectiveTotalRows = totalRows ?? (manualPagination ? data.length : table.getFilteredRowModel().rows.length);
  const firstVisibleRow = effectiveTotalRows === 0 ? 0 : currentPageIndex * pageSize + 1;
  const lastVisibleRow = Math.min(effectiveTotalRows, currentPageIndex * pageSize + visibleRows.length);
  const canPreviousPage = currentPageIndex > 0;
  const canNextPage = currentPageIndex < pageCount - 1;
  const goToPage = (nextPageIndex: number) => {
    const boundedPageIndex = Math.min(Math.max(nextPageIndex, 0), Math.max(pageCount - 1, 0));
    if (manualPagination) {
      onPageChange?.(boundedPageIndex);
    } else {
      table.setPageIndex(boundedPageIndex);
    }
  };
  const changePageSize = (nextPageSize: number) => {
    if (manualPagination) {
      onPageSizeChange?.(nextPageSize);
    } else {
      table.setPageSize(nextPageSize);
    }
  };

  useEffect(() => {
    if (!manualPagination) table.setPageSize(pageSize);
  }, [manualPagination, pageSize, table]);

  // Reset table state when data changes to prevent stale rows
  useEffect(() => {
    if (!manualPagination && data.length > 0) {
      table.resetRowSelection();
    }
  }, [data.length, manualPagination, table]);

  // notify parent of selection changes
  useEffect(() => {
    if (!onRowSelectionChange) return;
    const selected = table.getSelectedRowModel().rows.map((r) => r.original as TData);
    onRowSelectionChange(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

  useEffect(() => {
    const scrollElement = tableScrollRef.current;
    if (!scrollElement) return undefined;
    const updateWidth = () => setScrollContentWidth(scrollElement.scrollWidth);
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(scrollElement);
    if (scrollElement.firstElementChild) resizeObserver.observe(scrollElement.firstElementChild);
    window.addEventListener("resize", updateWidth);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [columns.length, data.length, visibleRows.length, minWidthValue]);

  const syncTableScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
  };

  const syncTopScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!topScrollRef.current) return;
    topScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
  };

  return (
    <div className="data-table-wrap grid w-full min-w-0 max-w-full gap-2">
      <div className="data-table-shell w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-[#aebbd0] bg-card shadow-[0_8px_22px_rgba(15,23,42,0.07)]">
      {(onSearchChange || toolbar || enableColumnVisibility || showExport) && (
        <div className="data-table-header grid gap-2 border-b border-[#c7d2e3] bg-white px-3 py-2">
          <div className="data-table-actions flex w-full flex-wrap items-center justify-between gap-2">
            {onSearchChange && (
              <label className="data-table-search flex h-10 w-full min-w-[260px] max-w-[520px] items-center gap-2 rounded-full border border-[#aebbd0] bg-[#fbfdff] px-3 text-muted-foreground shadow-inner">
                <Search size={16} />
                <Input
                  className="h-8 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                  value={globalFilter ?? ""}
                  onChange={(event) => table.setGlobalFilter(event.target.value)}
                  placeholder={searchPlaceholder}
                />
              </label>
            )}
            {enableColumnVisibility && (
              <details className="relative">
                <summary className="flex h-8 cursor-pointer list-none items-center gap-2 rounded-md border bg-background px-2.5 text-xs font-medium">
                  Columns <ChevronDown size={14} />
                </summary>
                <div className="absolute right-0 z-20 mt-2 grid min-w-[190px] gap-1 rounded-md border bg-popover p-2 text-sm shadow-lg">
                  {table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => (
                    <label className="flex items-center gap-2 rounded px-2 py-1 hover:bg-accent" key={column.id}>
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                      />
                      <span>{column.id}</span>
                    </label>
                  ))}
                </div>
              </details>
            )}
            {toolbar && (
              <div className="data-table-toolbar flex flex-wrap items-center justify-end gap-2">
                {toolbar}
              </div>
            )}
            {showExport && (
              <ExportCSVButton
                columns={enhancedColumns}
                data={exportRows}
                filename={exportFilename ?? `${slugifyFilename(_title || "wms-table")}.csv`}
              />
            )}
            {!onSearchChange && !toolbar && !showExport && <span className="min-h-1 flex-1" />}
            </div>
        </div>
      )}

      <div
        ref={topScrollRef}
        className="data-table-x-scrollbar"
        aria-hidden="true"
        onScroll={syncTableScroll}
      >
        <div style={{ width: scrollContentWidth ? `${scrollContentWidth}px` : minWidthValue, height: 1 }} />
      </div>

      <div
        ref={tableScrollRef}
        className="data-table-scroll overflow-auto bg-white"
        style={{ maxHeight: heightValue, overflowX: "auto" }}
        onScroll={syncTopScroll}
      >
        <Table key={`table-${data.length}-${loading}`} style={{ minWidth: minWidthValue, width: `max(100%, ${minWidthValue})` }}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() || undefined }}
                    className={cn("relative", header.column.getCanSort() ? "cursor-pointer select-none" : undefined)}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex min-h-7 items-center justify-between gap-1">
                      <span className="flex min-w-0 items-center gap-1 truncate">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <SortIcon sorted={header.column.getIsSorted()} />
                        )}
                      </span>
                      {enableColumnFilters && header.column.getCanFilter() && (
                        <ColumnFilterButton
                          column={header.column}
                          open={activeFilterColumn === header.column.id}
                          onOpenChange={(open) => setActiveFilterColumn(open ? header.column.id : null)}
                        />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && skeletonRows.length > 0 ? (
              skeletonRows.map((_, index) => (
                <TableRow className={rowStyle.row} key={`skeleton-${index}`}>
                  <TableCell className={rowStyle.cell} colSpan={enhancedColumns.length}><Skeleton /></TableCell>
                </TableRow>
              ))
            ) : visibleRows.length > 0 ? (
              visibleRows
                .filter((row) => row.getVisibleCells().length > 0)
                .map((row) => (
                  <TableRow
                    className={cn(rowStyle.row, onRowClick && "cursor-pointer", rowClassName?.(row.original))}
                    data-state={row.getIsSelected() && "selected"}
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell className={rowStyle.cell} key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
            ) : (
              <TableRow>
                <TableCell className="h-32 text-center text-muted-foreground" colSpan={enhancedColumns.length}>
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {enablePagination && (
        <div className="data-table-pagination flex flex-wrap items-center justify-between gap-3 border-t border-[#c7d2e3] bg-white px-3 py-2 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Showing <strong className="text-foreground">{firstVisibleRow}-{lastVisibleRow}</strong> of <strong className="text-foreground">{effectiveTotalRows.toLocaleString()}</strong>
            </span>
          </div>
          <div className="data-table-pager flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs">
              Show
              <select
                className="h-8 rounded-md border border-[#aebbd0] bg-background px-2 text-xs font-medium text-foreground"
                value={pageSize}
                onChange={(event) => changePageSize(Number(event.target.value))}
              >
                {[50, 100, 250, 500].map((size) => (
                  <option value={size} key={size}>{size}</option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" disabled={!canPreviousPage} onClick={() => goToPage(0)}><ChevronsLeft size={15} /></Button>
              <Button size="icon" variant="outline" disabled={!canPreviousPage} onClick={() => goToPage(currentPageIndex - 1)}><ChevronLeft size={15} /></Button>
              <Button size="icon" variant="outline" disabled={!canNextPage} onClick={() => goToPage(currentPageIndex + 1)}><ChevronRight size={15} /></Button>
              <Button size="icon" variant="outline" disabled={!canNextPage} onClick={() => goToPage(pageCount - 1)}><ChevronsRight size={15} /></Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function slugifyFilename(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "wms-table";
}

function ColumnFilterButton<TData, TValue>({
  column,
  open,
  onOpenChange,
}: {
  column: Column<TData, TValue>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rawValue = column.getFilterValue();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const updatePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const workspaceRect = document.querySelector(".workspace-main")?.getBoundingClientRect();
    const contentLeft = (workspaceRect?.left ?? 0) + 12;
    const popupWidth = 196;
    const popupHeight = 118;
    const preferredLeft = rect.left;
    const maxLeft = window.innerWidth - popupWidth - 12;
    const left = Math.min(maxLeft, Math.max(contentLeft, preferredLeft));
    const top = Math.min(window.innerHeight - popupHeight - 12, Math.max(12, rect.bottom + 8));
    setPosition({ left, top });
  };

  useEffect(() => {
    if (!open) return undefined;
    updatePosition();
    const handleWindowChange = () => updatePosition();
    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);
    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [open]);

  return (
    <span className="flex shrink-0 items-center">
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          "grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-background hover:text-primary",
          hasFilterValue(rawValue) && "bg-primary/10 text-primary",
        )}
        onClick={(event) => {
          event.stopPropagation();
          updatePosition();
          onOpenChange(!open);
        }}
        title="Column filter"
        aria-label="Column filter"
      >
        <Filter size={12} />
      </button>
      {open && (
        <ColumnFilterPopup
          value={rawValue}
          isDate={isDateColumn(column.id)}
          position={position}
          onChange={(nextValue) => column.setFilterValue(nextValue)}
          onClose={() => onOpenChange(false)}
        />
      )}
    </span>
  );
}

function ColumnFilterPopup({
  value,
  isDate,
  position,
  onChange,
  onClose,
}: {
  value: unknown;
  isDate: boolean;
  position: { left: number; top: number };
  onChange: (value: unknown) => void;
  onClose: () => void;
}) {
  const textValue = typeof value === "string" ? value : "";
  const dateValue = (typeof value === "object" && value ? value : {}) as { from?: string; to?: string };
  return (
    <div
      className="data-table-filter-popover fixed z-[90] grid w-[228px] gap-2 rounded-lg border border-[#9fb0c8] bg-white p-3 text-xs normal-case text-foreground shadow-[0_18px_42px_rgba(15,23,42,0.22)] ring-1 ring-slate-900/5"
      style={{ left: position.left, top: position.top }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold leading-none text-foreground">{isDate ? "Date filter" : "Column filter"}</span>
        <button type="button" className="grid h-5 w-5 place-items-center rounded hover:bg-accent" onClick={onClose} aria-label="Close filter">
          <X size={12} />
        </button>
      </div>
      {isDate ? (
        <div className="grid gap-2">
          <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
            From
            <span className="flex h-8 items-center gap-2 rounded-md border border-[#b6c3d6] bg-[#fbfdff] px-2">
              <CalendarDays size={13} />
              <Input
                autoFocus
                type="date"
                className="h-7 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                value={dateValue.from || ""}
                onChange={(event) => onChange({ ...dateValue, from: event.target.value })}
              />
            </span>
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
            To
            <span className="flex h-8 items-center gap-2 rounded-md border border-[#b6c3d6] bg-[#fbfdff] px-2">
              <CalendarDays size={13} />
              <Input
                type="date"
                className="h-7 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                value={dateValue.to || ""}
                onChange={(event) => onChange({ ...dateValue, to: event.target.value })}
              />
            </span>
          </label>
        </div>
      ) : (
        <label className="flex h-8 items-center gap-1 rounded-md border border-[#b6c3d6] bg-[#fbfdff] px-2 text-muted-foreground">
          <Search size={13} />
          <Input
            autoFocus
            className="h-7 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
            value={textValue}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Contains..."
          />
        </label>
      )}
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" type="button" onClick={() => onChange(isDate ? undefined : "")}>Clear</Button>
        <Button size="sm" type="button" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ArrowUp className="text-primary" size={12} />;
  if (sorted === "desc") return <ArrowDown className="text-primary" size={12} />;
  return <ArrowDownUp className="text-muted-foreground/80" size={12} />;
}

function isDateColumn(columnId: string) {
  return /(^|_)(date|dt)(_|$)/i.test(columnId);
}

function hasFilterValue(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0;
  if (value && typeof value === "object") return Boolean((value as { from?: string; to?: string }).from || (value as { from?: string; to?: string }).to);
  return false;
}

function toDateOnly(value: unknown) {
  if (!value) return "";
  const raw = String(value);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})|^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return "";
  if (match[1]) return match[1];
  return `${match[4]}-${match[3]}-${match[2]}`;
}
