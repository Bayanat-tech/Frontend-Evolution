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
import { ArrowDown, ArrowDownUp, ArrowUp, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Filter, Loader2, Search, X } from "lucide-react";
import { ReactNode, UIEvent, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { ExportCSVButton } from "./ExportCSVButton";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";

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
  /**
   * STANDARD WIDE-TABLE PATTERN — truncates body cell content to a single
   * line with an ellipsis instead of letting long values wrap the row
   * taller. The full value is still available on hover via a native title
   * tooltip. Column headers are never truncated — a header is always
   * short, fixed text, so the column simply widens to fit it. On by
   * default; set false for tables that genuinely need wrapped text (e.g.
   * multi-line notes columns).
   */
  truncateCellText?: boolean;
};

const densityClasses: Record<DataTableDensity, { row: string; cell: string }> = {
  grid: { row: "h-7", cell: "px-2 py-0.5 text-[11px] leading-tight" },
  compact: { row: "h-8", cell: "px-2 py-1 text-xs leading-tight" },
  comfortable: { row: "h-12", cell: "py-3" },
  large: { row: "h-14", cell: "py-3.5" },
};

// STANDARD WIDE-TABLE PATTERN — sticky column dividers.
// Plain box-shadow (not a border color) so it reads correctly in both
// light/dark and doesn't fight the table's existing border tokens.
const STICKY_LEFT_SHADOW = "6px 0 6px -6px rgba(0,0,0,0.10)";
const STICKY_RIGHT_SHADOW = "-6px 0 6px -6px rgba(0,0,0,0.10)";
// Sticky cells need an opaque background or the scrolling columns behind
// them show through. bg-white matches the convention already used
// elsewhere in this file (data-table-scroll, data-table-header, etc).
// NOTE: this means a sticky cell will NOT pick up row hover / [data-state
// =selected] styling from Table.tsx if that styling relies on the row's
// own background showing through cells — flag this to whoever owns
// Table.tsx if that's needed; not fixed here since Table.tsx wasn't in
// scope for this change.
const STICKY_CELL_BG = "bg-white";

// STANDARD WIDE-TABLE PATTERN — every border in this component (shell
// outline, header rule, row rule, column dividers, pagination rule) comes
// from these two literal, fully-written-out class strings. IMPORTANT: keep
// them as plain literals, not built with template-literal interpolation
// (e.g. `border-[${SOME_VAR}]`) — Tailwind's compiler finds classes by
// statically scanning the raw source text, so an interpolated arbitrary
// value never gets its CSS generated and silently renders as nothing.
const GRID_OUTLINE = "border-[#878787]"; // shell's outer border — a touch stronger, it's the table's boundary
const GRID_LINE = "border-[#ecf0f5]"; // internal rules — header/row/column dividers
const CELL_DIVIDER = `border-r ${GRID_LINE} last:border-r-0`;

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
  stickyFirstColumn = true,
  stickyLastColumn = true,
  enableScrollShadow = true,
  truncateCellText = true,
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
  // STANDARD WIDE-TABLE PATTERN — condensed page-number list (1 2 3 … 42)
  // instead of only first/prev/next/last controls, so pagination reads the
  // same regardless of how many pages there are.
  const pageNumbers = useMemo(() => getPaginationRange(currentPageIndex, pageCount), [currentPageIndex, pageCount]);

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
    <div className="data-table-wrap grid w-full min-w-0 max-w-full gap-3">
      {/* SECTION 1 — search / column-visibility / toolbar / export. Sits
          directly on the page background, outside the grid's own bordered
          card, so it reads as a separate toolbar row rather than being
          fused to the table (matches the reference layout). */}
      {(onSearchChange || toolbar || enableColumnVisibility || showExport) && (
        <div className={cn("data-table-header grid gap-2 rounded-2xl border bg-card px-3 py-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]", GRID_OUTLINE)}>
          <div className="data-table-actions flex w-full flex-wrap items-center justify-between gap-2">
            {onSearchChange && (
              <label className={cn("data-table-search flex h-10 w-full min-w-[260px] max-w-[520px] items-center gap-2 rounded-full border bg-[#fbfdff] px-3 text-muted-foreground shadow-inner", GRID_OUTLINE)}>
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
                filename={exportFilename ?? `${slugifyFilename(_title || "table")}.csv`}
              />
            )}
            {!onSearchChange && !toolbar && !showExport && <span className="min-h-1 flex-1" />}
            </div>
        </div>
      )}

      {/* SECTION 2 — the grid itself: header, rows, and pagination footer,
          all inside one rounded card of their own. */}
      <div className={cn("data-table-shell w-full min-w-0 max-w-full overflow-hidden rounded-2xl border bg-card shadow-[0_10px_24px_rgba(15,23,42,0.06)]", GRID_OUTLINE)}>
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
                background: "linear-gradient(to right, rgba(0,0,0,0.06), transparent)",
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-30 w-6 transition-opacity duration-150"
              style={{
                opacity: canScrollRight ? 1 : 0,
                background: "linear-gradient(to left, rgba(0,0,0,0.06), transparent)",
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
          <Table style={{ minWidth: minWidthValue, width: `max(100%, ${minWidthValue})` }}>
            {/* STANDARD WIDE-TABLE PATTERN — sticky header stays visible on
                vertical scroll. z-20 so it sits above sticky body columns
                (z-10) at the header/body seam. */}
            <TableHeader className={cn("sticky top-0 z-20 border-b bg-white", GRID_LINE)}>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header, colIndex) => {
                    const isFirst = colIndex === 0;
                    const isLast = colIndex === headerGroup.headers.length - 1;
                    const stickLeft = stickyFirstColumn && isFirst;
                    // Guard against a 1-column table trying to stick both sides at once.
                    const stickRight = stickyLastColumn && isLast && headerGroup.headers.length > 1;
                    return (
                      <TableHead
                        key={header.id}
                        style={{
                          // minWidth (not width) — the column happily grows
                          // past its declared size to fit the full header
                          // label; only body content ever truncates.
                          minWidth: header.getSize() || undefined,
                          boxShadow: stickLeft ? STICKY_LEFT_SHADOW : stickRight ? STICKY_RIGHT_SHADOW : undefined,
                        }}
                        className={cn(
                          "relative",
                          CELL_DIVIDER,
                          header.column.getCanSort() ? "cursor-pointer select-none" : undefined,
                          (stickLeft || stickRight) && `sticky z-10 ${STICKY_CELL_BG}`,
                          stickLeft && "left-0",
                          stickRight && "right-0",
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex min-h-7 items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium normal-case text-foreground/80">
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
          <TableRow className={cn(rowStyle.row, "border-b", GRID_LINE)} key={index}>
            <TableCell className={rowStyle.cell} colSpan={enhancedColumns.length}><Skeleton /></TableCell>
          </TableRow>
        ))
      )
    ) : visibleRows.length ? (
              visibleRows.map((row) => (
                <TableRow
                  className={cn(rowStyle.row, "border-b", GRID_LINE, onRowClick && "cursor-pointer", rowClassName?.(row.original))}
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
                    // Actions-style columns (buttons/icons) render their own
                    // layout — truncating those would clip controls rather
                    // than text, so they're left alone.
                    const skipTruncate = cell.column.id === "actions";
                    return (
                      <TableCell
                        className={cn(
                          rowStyle.cell,
                          CELL_DIVIDER,
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
                        {truncateCellText && !skipTruncate ? (
                          <div className="truncate" title={getCellTitle(cell)}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
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
        <div className={cn("data-table-pagination flex flex-wrap items-center justify-between gap-3 border-t bg-white px-3 py-2 text-sm text-muted-foreground", GRID_LINE)}>
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Showing <strong className="text-foreground">{firstVisibleRow}-{lastVisibleRow}</strong> of <strong className="text-foreground">{effectiveTotalRows.toLocaleString()}</strong>
            </span>
          </div>
          <div className="data-table-pager flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" disabled={!canPreviousPage} onClick={() => goToPage(currentPageIndex - 1)}><ChevronLeft size={15} /></Button>
              {pageNumbers.map((page, idx) =>
                page === "ellipsis" ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => goToPage(page)}
                    aria-current={page === currentPageIndex ? "page" : undefined}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-md text-xs font-medium transition-colors",
                      page === currentPageIndex
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {page + 1}
                  </button>
                ),
              )}
              <Button size="icon" variant="outline" disabled={!canNextPage} onClick={() => goToPage(currentPageIndex + 1)}><ChevronRight size={15} /></Button>
            </div>
            <label className="flex items-center gap-2 text-xs">
              Show
              <select
                className={cn("h-8 rounded-md border bg-background px-2 text-xs font-medium text-foreground", GRID_OUTLINE)}
                value={pageSize}
                onChange={(event) => changePageSize(Number(event.target.value))}
              >
                {[50, 100, 250, 500].map((size) => (
                  <option value={size} key={size}>{size}</option>
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

// STANDARD WIDE-TABLE PATTERN — condensed pagination range, e.g.
// [0, "ellipsis", 4, 5, 6, "ellipsis", 41] for page 5 of 42. Always keeps
// the first page, the last page, and one page on either side of current.
function getPaginationRange(currentPageIndex: number, pageCount: number): (number | "ellipsis")[] {
  const totalPages = Math.max(pageCount, 1);
  const keep = new Set<number>();
  keep.add(0);
  keep.add(totalPages - 1);
  for (let page = currentPageIndex - 1; page <= currentPageIndex + 1; page++) {
    if (page >= 0 && page < totalPages) keep.add(page);
  }
  const sorted = Array.from(keep).sort((a, b) => a - b);
  const range: (number | "ellipsis")[] = [];
  let previous = -2;
  for (const page of sorted) {
    if (page - previous > 1) range.push("ellipsis");
    range.push(page);
    previous = page;
  }
  return range;
}

// STANDARD WIDE-TABLE PATTERN — best-effort tooltip text for a truncated
// cell. Columns without an accessor (id-only custom cells) don't have a
// getValue() to call, so this fails safe rather than throwing.
function getCellTitle(cell: { getValue: () => unknown }): string | undefined {
  try {
    const value = cell.getValue();
    if (value === null || value === undefined) return undefined;
    if (typeof value === "string" || typeof value === "number") return String(value);
    return undefined;
  } catch {
    return undefined;
  }
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
      className="data-table-filter-popover fixed z-[90] grid w-[228px] gap-2 rounded-lg border border-[#dfe6ef] bg-white p-3 text-xs normal-case text-foreground shadow-[0_18px_42px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/5"
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
            <span className="flex h-8 items-center gap-2 rounded-md border border-[#dde3ec] bg-[#fbfdff] px-2">
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
            <span className="flex h-8 items-center gap-2 rounded-md border border-[#dde3ec] bg-[#fbfdff] px-2">
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
        <label className="flex h-8 items-center gap-1 rounded-md border border-[#dde3ec] bg-[#fbfdff] px-2 text-muted-foreground">
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
