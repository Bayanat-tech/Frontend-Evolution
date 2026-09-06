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
import { ArrowDown, ArrowDownUp, ArrowUp, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, Loader2, Search, X } from "lucide-react";
import { ReactNode, UIEvent, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { ExportCSVButton } from "./ExportCSVButton";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";
import { BiscDatePicker } from "./BiscDatePicker";

export type DataTableDensity = "grid" | "compact" | "comfortable" | "large";

export type DataTableLoaderType = "skeleton" | "circle";

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
  loaderType?: DataTableLoaderType; 
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
  enableExport?: boolean;
  exportFilename?: string;
  rowClassName?: (row: TData) => string;
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData, index: number) => string;
  /** Called whenever row selection changes; receives array of selected row originals */
   onRowSelectionChange?: (selectedRows: TData[]) => void;
  initialSorting?: SortingState;
  /**
   * STANDARD WIDE-TABLE PATTERN — on by default for every table using this
   * component. Pins the first column (row identity) while scrolling
   * horizontally. Set false only if the table has no natural identity
   * column, or is narrow enough to never scroll.
   */
  stickyFirstColumn?: boolean;
  /**
   * Pins the last column (typically Actions) while scrolling horizontally,
   * so view/edit/delete controls never require scrolling back. On by
   * default — set false only for tables with no action column.
   */
  stickyLastColumn?: boolean;
  /**
   * Shows a soft edge shadow on whichever side still has more columns to
   * scroll to, fading out at each end. This is the only reliable "there's
   * more here" signal until the user is already dragging the scrollbar.
   * On by default.
   */
  enableScrollShadow?: boolean;
};

const densityClasses: Record<DataTableDensity, { row: string; cell: string }> = {
  grid: { row: "h-[27px]", cell: "px-2 py-0 text-[11.5px] leading-tight" },
  compact: { row: "h-7", cell: "px-2 py-0.5 text-[11.5px] leading-tight" },
  comfortable: { row: "h-9", cell: "px-2 py-1 text-xs leading-tight" },
  large: { row: "h-14", cell: "py-3.5" },
};

// STANDARD WIDE-TABLE PATTERN — sticky column dividers.
// Plain box-shadow (not a border color) so it reads correctly in both
// light/dark and doesn't fight the table's existing border tokens.
const STICKY_LEFT_SHADOW = "6px 0 6px -6px rgba(0,0,0,0.15)";
const STICKY_RIGHT_SHADOW = "-6px 0 6px -6px rgba(0,0,0,0.15)";
// Sticky cells need an opaque background or the scrolling columns behind
// them show through. bg-white matches the convention already used
// elsewhere in this file (data-table-scroll, data-table-header, etc).
// NOTE: this means a sticky cell will NOT pick up row hover / [data-state
// =selected] styling from Table.tsx if that styling relies on the row's
// own background showing through cells — flag this to whoever owns
// Table.tsx if that's needed; not fixed here since Table.tsx wasn't in
// scope for this change.
const STICKY_CELL_BG = "bg-white";

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

export function DataTable<TData, TValue>({
  columns,
  data,
  title: _title,
  subtitle: _subtitle,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  toolbar,
  loading,
  loaderType = "skeleton",
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
  enableExport,
  exportFilename,
  rowClassName,
  onRowClick,
  getRowId,
  onRowSelectionChange,
  initialSorting = [],
  stickyFirstColumn = true,
  stickyLastColumn = true,
  enableScrollShadow = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [internalColumnFilters, setInternalColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [internalSearch, setInternalSearch] = useState("");
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [scrollContentWidth, setScrollContentWidth] = useState(0);
  // STANDARD WIDE-TABLE PATTERN — scroll-shadow state, driven off the same
  // horizontal scroll position already tracked for the synced top scrollbar.
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
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
  const skeletonRows = useMemo(() => Array.from({ length: Math.min(pageSize, 100) }), [pageSize]);
  const heightValue = typeof height === "number" ? `${height}px` : height;
  const responsiveMinWidth = minWidth ?? (enhancedColumns.length > 14 ? Math.max(760, enhancedColumns.length * 110) : "100%");
  const minWidthValue = typeof responsiveMinWidth === "number" ? `${responsiveMinWidth}px` : responsiveMinWidth;
  const pageCount = manualPagination ? Math.max(1, Math.ceil((totalRows ?? data.length) / Math.max(pageSize, 1))) : table.getPageCount() || 1;
  const currentPageIndex = manualPagination ? pageIndex : table.getState().pagination.pageIndex;
  const currentPageSize = manualPagination ? pageSize : table.getState().pagination.pageSize;
  const effectiveTotalRows = totalRows ?? (manualPagination ? data.length : table.getFilteredRowModel().rows.length);
  const firstVisibleRow = effectiveTotalRows === 0 ? 0 : currentPageIndex * currentPageSize + 1;
  const lastVisibleRow = Math.min(effectiveTotalRows, currentPageIndex * currentPageSize + visibleRows.length);
  const canPreviousPage = currentPageIndex > 0;
  const canNextPage = currentPageIndex < pageCount - 1;
  const totalPages = Math.max(pageCount, 1);
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    if (totalPages <= 5) {
      for (let i = 0; i < totalPages; i += 1) pages.push(i);
    } else if (currentPageIndex <= 2) {
      pages.push(0, 1, 2, -1, totalPages - 1);
    } else if (currentPageIndex >= totalPages - 3) {
      pages.push(0, -1, totalPages - 3, totalPages - 2, totalPages - 1);
    } else {
      pages.push(0, -1, currentPageIndex - 1, currentPageIndex, currentPageIndex + 1, -1, totalPages - 1);
    }
    return pages;
  }, [currentPageIndex, totalPages]);
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

  // notify parent of selection changes
  useEffect(() => {
    if (!onRowSelectionChange) return;
    const selected = table.getSelectedRowModel().rows.map((r) => r.original as TData);
    onRowSelectionChange(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

  // STANDARD WIDE-TABLE PATTERN — recompute shadow visibility from the
  // scroll container's current scrollLeft/scrollWidth/clientWidth.
  const updateScrollShadows = () => {
    if (!enableScrollShadow) return;
    const el = tableScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const scrollElement = tableScrollRef.current;
    if (!scrollElement) return undefined;
    const updateWidth = () => {
      setScrollContentWidth(scrollElement.scrollWidth);
      updateScrollShadows();
    };
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(scrollElement);
    if (scrollElement.firstElementChild) resizeObserver.observe(scrollElement.firstElementChild);
    window.addEventListener("resize", updateWidth);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.length, data.length, visibleRows.length, minWidthValue, enableScrollShadow]);

  const syncTableScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
    updateScrollShadows();
  };

  const syncTopScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!topScrollRef.current) return;
    topScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
    updateScrollShadows();
  };

  return (
    <div className="data-table-wrap grid w-full min-w-0 max-w-full gap-2 font-sans">
      {(onSearchChange || toolbar || enableColumnVisibility || showExport) && (
        <div className="data-table-header flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-2 px-3 shadow-sm">
          <div className="data-table-actions flex w-full flex-wrap items-center justify-between gap-3">
            {onSearchChange && (
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={globalFilter ?? ""}
                  onChange={(event) => table.setGlobalFilter(event.target.value)}
                  placeholder={searchPlaceholder || "Search...."}
                  className="data-table-search-input w-full h-9 pl-9 pr-8 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary text-[13px] transition-all"
                />
                {globalFilter ? (
                  <button
                    onClick={() => table.setGlobalFilter("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer text-xs leading-none"
                    type="button"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
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
            <div className="flex items-center gap-2">
              {toolbar && (
                <div className="data-table-toolbar flex flex-wrap items-center justify-end gap-2">
                  {toolbar}
                </div>
              )}
              {showExport && (
                <ExportCSVButton
                  columns={enhancedColumns}
                  data={exportRows}
                  filename={exportFilename ?? `${slugifyFilename(_title || "table")}.csv`}
                />
              )}
              {Boolean(_subtitle || (_title && !_title.includes("Records") && !_title.includes("Loading"))) && (
                <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1 rounded-lg border border-[#00378C] text-white bg-[#00378C] shadow-sm select-none shrink-0 font-medium text-[13px]">
                  <span>{_subtitle || _title}</span>
                </div>
              )}
            </div>
            {!onSearchChange && !toolbar && !showExport && !(_subtitle || _title) && <span className="min-h-1 flex-1" />}
            {table.getState().columnFilters.filter((f) => hasFilterValue(f.value)).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 w-full pt-2 border-t border-border/50 text-xs">
                <span className="text-[#64748b] font-semibold text-[11px] uppercase tracking-wide">
                  Filtered by:
                </span>
                {table.getState().columnFilters
                  .filter((f) => hasFilterValue(f.value))
                  .map((f) => {
                    const col = table.getColumn(f.id);
                    const headerTitle = typeof col?.columnDef.header === "string" ? col.columnDef.header : f.id;
                    const val = f.value as any;
                    const displayVal = typeof val === "object" && val
                      ? `${val.from || "Any"} → ${val.to || "Any"}`
                      : String(val);
                    return (
                      <span
                        key={f.id}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#00378C]/10 text-[#00378C] font-semibold text-xs border border-[#00378C]/20 shadow-sm"
                      >
                        <span>{headerTitle}:</span>
                        <span className="font-normal text-foreground">{displayVal}</span>
                        <button
                          type="button"
                          onClick={() => col?.setFilterValue(undefined)}
                          className="hover:bg-[#00378C]/20 rounded-full p-0.5 cursor-pointer text-[#00378C] ml-0.5 transition-colors"
                          title={`Clear ${headerTitle} filter`}
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                <button
                  type="button"
                  onClick={() => table.resetColumnFilters()}
                  className="text-xs font-semibold text-[#00378C] hover:underline cursor-pointer ml-1"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="data-table-shell w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">

      <div
        ref={topScrollRef}
        className="data-table-x-scrollbar"
        aria-hidden="true"
        onScroll={syncTableScroll}
      >
        <div style={{ width: scrollContentWidth ? `${scrollContentWidth}px` : minWidthValue, height: 1 }} />
      </div>

      {/* STANDARD WIDE-TABLE PATTERN — relative wrapper so the scroll-shadow
          overlays below can sit absolutely positioned against the actual
          scrolling viewport, not the whole table shell. */}
      <div className="relative">
        {enableScrollShadow && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-30 w-6 transition-opacity duration-150"
              style={{
                opacity: canScrollLeft ? 1 : 0,
                background: "linear-gradient(to right, rgba(0,0,0,0.08), transparent)",
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-30 w-6 transition-opacity duration-150"
              style={{
                opacity: canScrollRight ? 1 : 0,
                background: "linear-gradient(to left, rgba(0,0,0,0.08), transparent)",
              }}
            />
          </>
        )}

        <div
          ref={tableScrollRef}
          className="data-table-scroll overflow-auto bg-white"
          style={{ maxHeight: heightValue, overflowX: "auto" }}
          onScroll={syncTopScroll}
        >
          <Table style={{ minWidth: minWidthValue === "100%" ? undefined : minWidthValue, width: "100%" }}>
            {/* STANDARD WIDE-TABLE PATTERN — sticky header stays visible on
                vertical scroll. z-20 so it sits above sticky body columns
                (z-10) at the header/body seam. */}
            <TableHeader className="sticky top-0 z-20 bg-white">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b border-[#8e97a8]">
                  {headerGroup.headers.map((header, colIndex) => {
                    const isFirst = colIndex === 0;
                    const isLast = colIndex === headerGroup.headers.length - 1;
                    const stickLeft = stickyFirstColumn && isFirst;
                    // Guard against a 1-column table trying to stick both sides at once.
                    const stickRight = stickyLastColumn && isLast && headerGroup.headers.length > 1;
                    const isFilterActive = hasFilterValue(header.column.getFilterValue());

                    return (
                      <TableHead
                        key={header.id}
                        style={{
                          width: header.column.columnDef.size ? `${header.column.columnDef.size}px` : undefined,
                          minWidth: header.column.columnDef.minSize ? `${header.column.columnDef.minSize}px` : undefined,
                          boxShadow: stickLeft ? STICKY_LEFT_SHADOW : stickRight ? STICKY_RIGHT_SHADOW : undefined,
                        }}
                        className={cn(
                          "relative transition-colors border-r border-[#8e97a8] last:border-r-0",
                          isFilterActive && "bg-[#00378C]/[0.06] border-b-2 border-b-[#00378C]",
                          header.column.getCanSort() ? "cursor-pointer select-none" : undefined,
                          (stickLeft || stickRight) && `sticky z-10 ${STICKY_CELL_BG}`,
                          stickLeft && "left-0",
                          stickRight && "right-0",
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex min-h-7 items-center justify-between gap-1">
                          <span className={cn(
                            "flex min-w-0 items-center gap-1 truncate transition-colors text-[11px] uppercase tracking-wider font-semibold",
                            isFilterActive ? "text-[#00378C] font-bold" : "text-[#64748b]"
                          )}>
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
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
    {loading ? (
      loaderType === "circle" ? (
        <TableRow>
          <TableCell className="h-40 text-center" colSpan={enhancedColumns.length}>
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="animate-spin text-primary" size={22} />
              <span className="text-xs font-medium">Loading...</span>
            </div>
          </TableCell>
        </TableRow>
      ) : (
        skeletonRows.map((_, index) => (
          <TableRow className={rowStyle.row} key={index}>
            <TableCell className={rowStyle.cell} colSpan={enhancedColumns.length}><Skeleton /></TableCell>
          </TableRow>
        ))
      )
    ) : visibleRows.length ? (
              visibleRows.map((row) => (
                <TableRow
                  className={cn(rowStyle.row, onRowClick && "cursor-pointer", rowClassName?.(row.original))}
                  data-state={row.getIsSelected() && "selected"}
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell, colIndex) => {
                    const cells = row.getVisibleCells();
                    const rawCellValue = cell.getValue();
                    const cellTitle =
                      typeof rawCellValue === "string" || typeof rawCellValue === "number"
                        ? String(rawCellValue)
                        : undefined;
                    const isFirst = colIndex === 0;
                    const isLast = colIndex === cells.length - 1;
                    const stickLeft = stickyFirstColumn && isFirst;
                    const stickRight = stickyLastColumn && isLast && cells.length > 1;
                    return (
                      <TableCell
                        className={cn(
                          rowStyle.cell,
                          (stickLeft || stickRight) && `sticky z-10 ${STICKY_CELL_BG}`,
                          stickLeft && "left-0",
                          stickRight && "right-0",
                        )}
                        style={{
                          boxShadow: stickLeft ? STICKY_LEFT_SHADOW : stickRight ? STICKY_RIGHT_SHADOW : undefined,
                        }}
                        key={cell.id}
                        title={cellTitle}
                      >
                        <div className="data-table-cell-content">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </TableCell>
                    );
                  })}
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
      </div>

      {enablePagination && (
        <div className="data-table-pagination flex flex-wrap items-center justify-between gap-3 border-t border-[#8e97a8] bg-white px-4 py-2.5 text-xs text-muted-foreground font-sans">
          <div className="flex flex-wrap items-center gap-1.5">
            <span>
              {effectiveTotalRows === 0 ? (
                <span>Showing 0 records</span>
              ) : (
                <span>
                  Showing <span className="font-semibold text-foreground">{firstVisibleRow}</span>–
                  <span className="font-semibold text-foreground">{lastVisibleRow}</span> of{" "}
                  <span className="font-semibold text-foreground">{effectiveTotalRows.toLocaleString()}</span> {effectiveTotalRows === 1 ? "record" : "records"}
                </span>
              )}
            </span>
          </div>
          <div className="data-table-pager flex items-center gap-2">
            <ul className="flex items-center gap-1 m-0 p-0 list-none">
              <li>
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded-md border border-[#cbd5e1] text-[#64748b] hover:bg-[#f1f5f9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  disabled={!canPreviousPage}
                  onClick={() => goToPage(currentPageIndex - 1)}
                  title="Previous Page"
                >
                  {"<"}
                </button>
              </li>

              {pageNumbers.map((page, idx) => (
                <li key={`${page}-${idx}`}>
                  {page === -1 ? (
                    <span className="px-2 py-1 text-xs text-[#94a3b8]">...</span>
                  ) : (
                    <button
                      type="button"
                      className={cn(
                        "px-2.5 py-1 text-xs rounded-md border font-medium transition-colors cursor-pointer min-w-[28px]",
                        currentPageIndex === page
                          ? "bg-[#00378C] text-white border-[#00378C] shadow-sm font-semibold"
                          : "border-[#cbd5e1] text-[#64748b] hover:bg-[#f1f5f9]",
                      )}
                      onClick={() => goToPage(page)}
                    >
                      {page + 1}
                    </button>
                  )}
                </li>
              ))}

              <li>
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded-md border border-[#cbd5e1] text-[#64748b] hover:bg-[#f1f5f9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  disabled={!canNextPage}
                  onClick={() => goToPage(currentPageIndex + 1)}
                  title="Next Page"
                >
                  {">"}
                </button>
              </li>
            </ul>

            <label className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
              <select
                className="h-7 rounded-md border border-[#cbd5e1] bg-white px-2 text-xs font-medium text-[#1e293b] focus:outline-none focus:ring-1 focus:ring-[#00378C] cursor-pointer"
                value={currentPageSize}
                onChange={(event) => changePageSize(Number(event.target.value))}
              >
                {[10, 20, 25, 30, 50, 100].map((size) => (
                  <option value={size} key={size}>Show {size}</option>
                ))}
              </select>
            </label>
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
    .replace(/^-+|-+$/g, "") || "table";
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
    const popupWidth = 260;
    const popupHeight = 220;
    const preferredLeft = rect.left - 20;
    const maxLeft = window.innerWidth - popupWidth - 16;
    const left = Math.min(maxLeft, Math.max(contentLeft, preferredLeft));
    const top = Math.min(window.innerHeight - popupHeight - 12, Math.max(12, rect.bottom + 6));
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

  const isActive = hasFilterValue(rawValue);

  return (
    <span className="flex shrink-0 items-center">
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          "relative grid h-5 w-5 place-items-center rounded transition-all cursor-pointer",
          isActive
            ? "bg-[#00378C] text-white shadow-sm ring-2 ring-[#00378C]/25"
            : "text-muted-foreground hover:bg-slate-100 hover:text-[#00378C]"
        )}
        onClick={(event) => {
          event.stopPropagation();
          updatePosition();
          onOpenChange(!open);
        }}
        title={isActive ? "Filter is active (click to modify or clear)" : "Column filter"}
        aria-label="Column filter"
      >
        <Filter size={11} strokeWidth={isActive ? 2.8 : 2} className={isActive ? "text-white" : "text-muted-foreground"} />
        {isActive && (
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00378C] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00378C] border border-white"></span>
          </span>
        )}
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
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const textValue = typeof value === "string" ? value : "";
  const dateValue = (typeof value === "object" && value ? value : {}) as { from?: string; to?: string };
  const [tempText, setTempText] = useState(textValue);
  const [tempFrom, setTempFrom] = useState(dateValue.from || "");
  const [tempTo, setTempTo] = useState(dateValue.to || "");

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        if (target.closest?.(".bisc-date-picker-portal") || target.closest?.("[data-bisc-calendar]")) {
          return;
        }
        onClose();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="data-table-filter-popover fixed z-[90] w-[260px] p-3.5 space-y-2.5 rounded-2xl border border-border bg-card text-xs normal-case text-foreground shadow-xl shadow-primary/10 font-sans"
      style={{ left: position.left, top: position.top }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      {isDate ? (
        <div className="space-y-2.5">
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-slate-500">
              From
            </label>
            <BiscDatePicker
              value={tempFrom}
              onChange={setTempFrom}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-slate-500">
              To
            </label>
            <BiscDatePicker
              value={tempTo}
              onChange={setTempTo}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <button
              type="button"
              className="px-3 py-1.5 rounded-sm border border-border bg-card text-foreground hover:bg-secondary transition-colors font-medium cursor-pointer text-xs"
              onClick={() => {
                setTempFrom("");
                setTempTo("");
                onChange(undefined);
                onClose();
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="px-3.5 py-1.5 rounded-sm bg-[#00378C] text-white transition-all hover:opacity-90 shadow-md shadow-[#00378C]/20 font-medium cursor-pointer text-xs"
              onClick={() => {
                let nextValue: { from?: string; to?: string } | undefined;
                if (tempFrom && tempTo) {
                  nextValue = { from: tempFrom, to: tempTo };
                } else if (tempFrom) {
                  nextValue = { from: tempFrom };
                } else if (tempTo) {
                  nextValue = { to: tempTo };
                }
                onChange(nextValue);
                onClose();
              }}
            >
              Apply Range
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-slate-500">
              Search
            </label>
            <Input
              autoFocus
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-slate-100 text-foreground text-xs shadow-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
              value={tempText}
              onChange={(e) => setTempText(e.target.value)}
              placeholder="Enter value..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <button
              type="button"
              className="px-3 py-1.5 rounded-sm border border-border bg-card text-foreground hover:bg-secondary transition-colors font-medium cursor-pointer text-xs"
              onClick={() => {
                setTempText("");
                onChange("");
                onClose();
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="px-3.5 py-1.5 rounded-sm bg-[#00378C] text-white transition-all hover:opacity-90 shadow-md shadow-[#00378C]/20 font-medium cursor-pointer text-xs"
              onClick={() => {
                onChange(tempText || undefined);
                onClose();
              }}
            >
              Apply Filter
            </button>
          </div>
        </div>
      )}
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

function hasFilterValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.values(obj).some((v) => v !== undefined && v !== null && String(v).trim().length > 0);
  }
  return Boolean(value);
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
