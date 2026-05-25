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
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, Search, X } from "lucide-react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";

export type DataTableDensity = "grid" | "compact" | "comfortable" | "large";

export type DataTableProps<TData, TValue> = {
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
  density?: DataTableDensity;
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
  rowClassName?: (row: TData) => string;
  getRowId?: (row: TData, index: number) => string;
  /** Called whenever row selection changes. Receives the array of selected row originals. */
  onRowSelectionChange?: (selectedRows: TData[]) => void;
};

const densityClasses: Record<DataTableDensity, { row: string; cell: string }> = {
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

export function DataTable<TData, TValue>({
  columns,
  data,
  title,
  subtitle,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  toolbar,
  loading,
  emptyText = "No records found",
  height = 590,
  minWidth,
  density = "comfortable",
  pageSize = 25,
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
  rowClassName,
  getRowId,
  onRowSelectionChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [internalColumnFilters, setInternalColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [internalSearch, setInternalSearch] = useState("");
  const globalFilter = searchValue ?? internalSearch;
  const columnFilters = controlledColumnFilters ?? internalColumnFilters;
  const rowStyle = densityClasses[density];

  const table = useReactTable({
    data,
    columns,
    getRowId,
    filterFns: {
      includesText: includesText as FilterFn<TData>,
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
    pageCount: manualPagination
      ? Math.max(1, Math.ceil((totalRows ?? data.length) / Math.max(pageSize, 1)))
      : undefined,
  });

  // Fire onRowSelectionChange whenever selection changes
  useEffect(() => {
    if (!onRowSelectionChange) return;
    const selected = table.getSelectedRowModel().rows.map((r) => r.original);
    onRowSelectionChange(selected);
  }, [rowSelection]);

  // Reset selection when data changes (e.g. tab switch)
  useEffect(() => {
    setRowSelection({});
  }, [data]);

  const visibleRows = manualFiltering
    ? table.getCoreRowModel().rows
    : manualPagination
    ? table.getFilteredRowModel().rows
    : enablePagination
    ? table.getRowModel().rows
    : table.getFilteredRowModel().rows;

  const skeletonRows = useMemo(() => Array.from({ length: Math.min(pageSize, 10) }), [pageSize]);
  const heightValue = typeof height === "number" ? `${height}px` : height;
  const minWidthValue = typeof minWidth === "number" ? `${minWidth}px` : minWidth;
  const pageCount = manualPagination
    ? Math.max(1, Math.ceil((totalRows ?? data.length) / Math.max(pageSize, 1)))
    : table.getPageCount() || 1;
  const currentPageIndex = manualPagination ? pageIndex : table.getState().pagination.pageIndex;
  const displayTitle = title && !isCountTitle(title) ? title : undefined;
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

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="overflow-hidden rounded-md border bg-card shadow-sm">
      {(displayTitle || subtitle || onSearchChange || toolbar || enableColumnVisibility) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-2">
          {(displayTitle || subtitle) && (
            <div className="flex items-center gap-3">
              <div>
                {subtitle && <p className="eyebrow">{subtitle}</p>}
                {displayTitle && <h2 className="m-0 text-base font-semibold">{displayTitle}</h2>}
              </div>
              {/* Selection badge */}
              {onRowSelectionChange && selectedCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {selectedCount} selected
                  <button
                    type="button"
                    className="ml-0.5 rounded hover:text-destructive"
                    onClick={() => setRowSelection({})}
                    title="Clear selection"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}
            </div>
          )}
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            {onSearchChange && (
              <label className="flex h-8 w-[min(340px,100%)] items-center gap-2 rounded-md border bg-background px-2.5 text-muted-foreground">
                <Search size={15} />
                <Input
                  className="h-7 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
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
            {toolbar}
          </div>
        </div>
      )}

      <div className="overflow-auto" style={{ maxHeight: heightValue }}>
        <Table style={{ minWidth: minWidthValue }}>
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
                      <span className="min-w-0 truncate">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" && (
                          <span className="ml-1 text-[10px] normal-case text-primary">Asc</span>
                        )}
                        {header.column.getIsSorted() === "desc" && (
                          <span className="ml-1 text-[10px] normal-case text-primary">Desc</span>
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
            {loading ? (
              skeletonRows.map((_, index) => (
                <TableRow className={rowStyle.row} key={index}>
                  <TableCell className={rowStyle.cell} colSpan={columns.length}>
                    <Skeleton />
                  </TableCell>
                </TableRow>
              ))
            ) : visibleRows.length ? (
              visibleRows.map((row) => (
                <TableRow
                  className={cn(
                    rowStyle.row,
                    rowClassName?.(row.original),
                    // highlight selected rows
                    onRowSelectionChange && row.getIsSelected() && "bg-primary/5 outline outline-1 outline-primary/20",
                  )}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  key={row.id}
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
                <TableCell className="h-32 text-center text-muted-foreground" colSpan={columns.length}>
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {enablePagination && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Page {currentPageIndex + 1} of {pageCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs">
              Rows
              <select
                className="h-8 rounded-md border bg-background px-2 text-xs font-medium text-foreground"
                value={pageSize}
                onChange={(event) => changePageSize(Number(event.target.value))}
              >
                {[50, 100, 250, 500].map((size) => (
                  <option value={size} key={size}>{size}</option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" disabled={!canPreviousPage} onClick={() => goToPage(0)}>
                <ChevronsLeft size={15} />
              </Button>
              <Button size="icon" variant="outline" disabled={!canPreviousPage} onClick={() => goToPage(currentPageIndex - 1)}>
                <ChevronLeft size={15} />
              </Button>
              <Button size="icon" variant="outline" disabled={!canNextPage} onClick={() => goToPage(currentPageIndex + 1)}>
                <ChevronRight size={15} />
              </Button>
              <Button size="icon" variant="outline" disabled={!canNextPage} onClick={() => goToPage(pageCount - 1)}>
                <ChevronsRight size={15} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function isCountTitle(title: string) {
  return /^(loading|[\d,]+\s+(records?|rows?|items?|documents?|vouchers?|cheques?|lines?|jobs?|countries?))$/i.test(
    title.trim(),
  );
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
  const value = String(column.getFilterValue() ?? "");
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
          value && "bg-primary/10 text-primary",
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
          value={value}
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
  position,
  onChange,
  onClose,
}: {
  value: string;
  position: { left: number; top: number };
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed z-[80] grid w-[196px] gap-1.5 rounded-md border bg-popover p-2 text-[11px] normal-case shadow-xl"
      style={{ left: position.left, top: position.top }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold leading-none text-foreground">Filter</span>
        <button
          type="button"
          className="grid h-5 w-5 place-items-center rounded hover:bg-accent"
          onClick={onClose}
          aria-label="Close filter"
        >
          <X size={12} />
        </button>
      </div>
      <label className="flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-muted-foreground">
        <Search size={12} />
        <Input
          autoFocus
          className="h-6 border-0 bg-transparent px-0 text-[11px] shadow-none focus-visible:ring-0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Contains..."
        />
      </label>
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" type="button" onClick={() => onChange("")}>
          Clear
        </Button>
        <Button size="sm" type="button" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}