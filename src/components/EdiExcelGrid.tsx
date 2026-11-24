/**
 * EdiExcelGrid – simple Excel-like grid for EdiImportPage.
 *
 * Features (kept simple):
 *  - Column letters (A, B, C...) + column name header, row numbers on the left (both frozen)
 *  - Gridlines, click to select a cell (green border like Excel)
 *  - Arrow keys move, Enter / F2 / double-click edits, just typing starts editing
 *  - Enter = commit + move down, Tab = commit + move right, Esc = cancel
 *  - Delete / Backspace clears the cell
 *  - Ctrl+C copies the cell, Ctrl+V pastes (single value or a block copied from Excel)
 *  - Name box + message bar on top (shows e.g. "B3" and the error of that cell)
 *  - Invalid cells are red with a small red corner marker
 *  - Fill handle: drag the small green square at the bottom-right of the selected cell
 *    down / up / left / right to copy its value into the cells you drag over
 *  - Row delete icon appears in the row-number cell on hover
 */
import { Info, Trash2 } from "lucide-react";
import { ClipboardEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import type { EdiColumn } from "./EdiImportPage";

export type GridRow = {
  id: number;
  values: Record<string, string>;
  errors: Record<string, string>;
};

type Props = {
  columns: EdiColumn[];
  rows: GridRow[]; // rows to show (already paged / filtered)
  getRowNumber: (id: number) => number | undefined;
  onChangeCell: (id: number, col: EdiColumn, value: string) => void;
  onRemoveRow: (id: number) => void;
  maxHeight?: string;
};

const GREEN = "#217346";

const colLetter = (index: number) => {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** yyyy-mm-dd -> dd/mm/yyyy for display */
const showDate = (v: string) => {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
};

/** dd/mm/yyyy or yyyy-mm-dd -> yyyy-mm-dd (used for pasted values) */
const toIso = (v: string) => {
  const s = v.trim();
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${pad(Number(dmy[2]))}-${pad(Number(dmy[1]))}`;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : s;
};

export default function EdiExcelGrid({
  columns,
  rows,
  getRowNumber,
  onChangeCell,
  onRemoveRow,
  maxHeight = "calc(100dvh - 300px)",
}: Props) {
  const [active, setActive] = useState<{ r: number; c: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);

  // fill handle drag: source cell (r, c) and the cell the mouse is over now (tr, tc)
  const [fill, setFill] = useState<{ r: number; c: number; tr: number; tc: number } | null>(null);

  // error pop-up opened from the small "i" button on a red cell (fixed position, so it is never clipped)
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  const rowCount = rows.length;
  const colCount = columns.length;

  // keep selection inside the grid when rows / columns change (paging, delete, filter)
  useEffect(() => {
    setEditing(false);
    setActive((a) => {
      if (!a) return a;
      if (!rowCount || !colCount) return null;
      return { r: Math.min(a.r, rowCount - 1), c: Math.min(a.c, colCount - 1) };
    });
  }, [rowCount, colCount]);

  // scroll the selected cell into view
  useEffect(() => {
    if (!active) return;
    boxRef.current
      ?.querySelector(`[data-cell="${active.r}-${active.c}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  const valueAt = (r: number, c: number) => rows[r]?.values[columns[c]?.name] ?? "";

  /* ── undo / redo: every edit, paste, cut, clear or fill is one step ── */
  type Change = { id: number; col: EdiColumn; prev: string; next: string };
  const undoRef = useRef<Change[][]>([]);
  const redoRef = useRef<Change[][]>([]);

  /** Applies a group of cell changes as ONE undo step (skips cells whose value does not change). */
  const applyBatch = (items: { row: GridRow; col: EdiColumn; value: string }[]) => {
    const batch: Change[] = items
      .filter((i) => (i.row.values[i.col.name] ?? "") !== i.value)
      .map((i) => ({ id: i.row.id, col: i.col, prev: i.row.values[i.col.name] ?? "", next: i.value }));
    if (!batch.length) return;
    batch.forEach((b) => onChangeCell(b.id, b.col, b.next));
    undoRef.current.push(batch);
    if (undoRef.current.length > 100) undoRef.current.shift();
    redoRef.current = [];
  };

  const undo = () => {
    const batch = undoRef.current.pop();
    if (!batch) return;
    batch.forEach((b) => onChangeCell(b.id, b.col, b.prev));
    redoRef.current.push(batch);
  };

  const redo = () => {
    const batch = redoRef.current.pop();
    if (!batch) return;
    batch.forEach((b) => onChangeCell(b.id, b.col, b.next));
    undoRef.current.push(batch);
  };

  /** Drag direction is locked to the dominant axis, like Excel: down/up OR left/right. */
  const fillTarget = (f: { r: number; c: number; tr: number; tc: number }) =>
    Math.abs(f.tr - f.r) >= Math.abs(f.tc - f.c) ? { r: f.tr, c: f.c } : { r: f.r, c: f.tc };

  const inFillRange = (ri: number, ci: number) => {
    if (!fill) return false;
    const t = fillTarget(fill);
    const inR = ri >= Math.min(fill.r, t.r) && ri <= Math.max(fill.r, t.r);
    const inC = ci >= Math.min(fill.c, t.c) && ci <= Math.max(fill.c, t.c);
    return inR && inC && !(ri === fill.r && ci === fill.c);
  };

  // on mouse release, copy the source value into every cell of the dragged range
  useEffect(() => {
    if (!fill) return;
    const finish = () => {
      const t = fillTarget(fill);
      const value = rows[fill.r]?.values[columns[fill.c]?.name] ?? "";
      const items: { row: GridRow; col: EdiColumn; value: string }[] = [];
      for (let r = Math.min(fill.r, t.r); r <= Math.max(fill.r, t.r); r++) {
        for (let c = Math.min(fill.c, t.c); c <= Math.max(fill.c, t.c); c++) {
          if (r === fill.r && c === fill.c) continue;
          if (rows[r] && columns[c]) items.push({ row: rows[r], col: columns[c], value });
        }
      }
      applyBatch(items);
      setFill(null);
    };
    window.addEventListener("mouseup", finish);
    return () => window.removeEventListener("mouseup", finish);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill, rows, columns, onChangeCell]);

  const move = (dr: number, dc: number) => {
    setActive((a) => {
      const cur = a ?? { r: 0, c: 0 };
      return {
        r: Math.max(0, Math.min(rowCount - 1, cur.r + dr)),
        c: Math.max(0, Math.min(colCount - 1, cur.c + dc)),
      };
    });
  };

  const focusGrid = () => boxRef.current?.focus();

  const startEdit = (initial?: string) => {
    if (!active) return;
    setDraft(initial ?? valueAt(active.r, active.c));
    setEditing(true);
  };

  const commit = (dr: number, dc: number) => {
    if (active) {
      const row = rows[active.r];
      const col = columns[active.c];
      if (row && col) applyBatch([{ row, col, value: draft }]);
    }
    setEditing(false);
    move(dr, dc);
    focusGrid();
  };

  const cancel = () => {
    setEditing(false);
    focusGrid();
  };

  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing || !rowCount || !colCount) return;
    if (!active) setActive({ r: 0, c: 0 });

    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl) {
      const k = e.key.toLowerCase();
      if (k === "c" && active) {
        void navigator.clipboard?.writeText(valueAt(active.r, active.c));
      } else if (k === "x" && active) {
        void navigator.clipboard?.writeText(valueAt(active.r, active.c));
        applyBatch([{ row: rows[active.r], col: columns[active.c], value: "" }]);
      } else if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
      return; // Ctrl+V is handled by the paste handler
    }

    switch (e.key) {
      case "ArrowUp": e.preventDefault(); move(-1, 0); break;
      case "ArrowDown": e.preventDefault(); move(1, 0); break;
      case "ArrowLeft": e.preventDefault(); move(0, -1); break;
      case "ArrowRight": e.preventDefault(); move(0, 1); break;
      case "Tab": e.preventDefault(); move(0, e.shiftKey ? -1 : 1); break;
      case "Enter": e.preventDefault(); if (e.shiftKey) move(-1, 0); else startEdit(); break;
      case "F2": e.preventDefault(); startEdit(); break;
      case "Home": e.preventDefault(); setActive((a) => ({ r: a?.r ?? 0, c: 0 })); break;
      case "End": e.preventDefault(); setActive((a) => ({ r: a?.r ?? 0, c: colCount - 1 })); break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        if (active) applyBatch([{ row: rows[active.r], col: columns[active.c], value: "" }]);
        break;
      default:
        // typing a character starts editing and replaces the content (like Excel)
        if (e.key.length === 1 && !e.altKey) {
          e.preventDefault();
          startEdit(e.key);
        }
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    if (editing || !active) return;
    const text = e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    const matrix = text
      .replace(/\r/g, "")
      .replace(/\n$/, "")
      .split("\n")
      .map((line) => line.split("\t"));
    const items: { row: GridRow; col: EdiColumn; value: string }[] = [];
    matrix.forEach((line, i) => {
      const row = rows[active.r + i];
      if (!row) return;
      line.forEach((cell, j) => {
        const col = columns[active.c + j];
        if (!col) return;
        items.push({ row, col, value: col.kind === "date" ? toIso(cell) : cell.trim() });
      });
    });
    applyBatch(items);
  };

  const activeRow = active ? rows[active.r] : undefined;
  const activeCol = active ? columns[active.c] : undefined;
  const activeRowNo = activeRow ? getRowNumber(activeRow.id) : undefined;

  return (
    <div className="grid gap-1">
      {/* name box + message bar */}
      <div className="flex items-center gap-2 text-xs">
        <div className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-center font-semibold text-slate-700">
          {active && activeRowNo ? `${colLetter(active.c)}${activeRowNo}` : "—"}
        </div>
        <div className="flex h-7 min-w-0 flex-1 items-center rounded border border-slate-300 bg-white px-2 text-slate-700">
          {activeCol ? (
            <span className="truncate font-semibold">{activeCol.name}</span>
          ) : (
            <span className="text-slate-400">
              Click a cell 
            </span>
          )}
        </div>
      </div>

      {/* grid */}
      <div
        ref={boxRef}
        tabIndex={0}
        onKeyDown={onGridKeyDown}
        onPaste={onPaste}
        onScroll={() => setTip(null)}
        className={`overflow-auto border border-slate-300 bg-white outline-none ${
          fill ? "select-none cursor-crosshair" : ""
        }`}
        style={{ maxHeight }}
      >
        <table className="border-collapse text-xs" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 56 }} />
            {columns.map((c) => (
              <col key={c.name} style={{ width: Math.min(260, Math.max(120, (c.length ?? 14) * 8 + 40)) }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20">
            {/* A B C ... */}
            <tr>
              <th className="sticky left-0 z-30 border border-slate-300 bg-slate-200" />
              {columns.map((c, ci) => (
                <th
                  key={c.name}
                  className={`border border-slate-300 py-0.5 text-center font-semibold ${
                    active?.c === ci ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {colLetter(ci)}
                </th>
              ))}
            </tr>
            {/* column names */}
            <tr>
              <th className="sticky left-0 z-30 border border-slate-300 bg-slate-100 px-1 py-1 text-slate-500">
                #
              </th>
              {columns.map((c) => (
                <th
                  key={c.name}
                  className="truncate border border-slate-300 bg-slate-50 px-2 py-1 text-left font-semibold text-slate-800"
                >
                  {c.name}
                  {!c.nullable && <span className="text-red-600"> *</span>}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.id} className="group">
                <td
                  className={`sticky left-0 z-10 border border-slate-300 px-1 text-center font-semibold ${
                    active?.r === ri ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <div className="relative flex h-7 items-center justify-center">
                    <span className="group-hover:invisible">{getRowNumber(row.id)}</span>
                    <button
                      type="button"
                      title="Delete row"
                      aria-label="Delete row"
                      onClick={() => onRemoveRow(row.id)}
                      className="absolute hidden cursor-pointer rounded p-0.5 text-slate-500 hover:bg-red-100 hover:text-red-600 group-hover:block"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>

                {columns.map((c, ci) => {
                  const isActive = active?.r === ri && active?.c === ci;
                  const isEditing = isActive && editing;
                  const err = row.errors[c.name];
                  const raw = row.values[c.name] ?? "";
                  const display = c.kind === "date" ? showDate(raw) : raw;

                  return (
                    <td
                      key={c.name}
                      data-cell={`${ri}-${ci}`}
                      onMouseDown={() => {
                        if (editing && !isActive) commit(0, 0);
                        setActive({ r: ri, c: ci });
                      }}
                      onMouseEnter={() => {
                        if (fill) setFill({ ...fill, tr: ri, tc: ci });
                      }}
                      onDoubleClick={() => {
                        setActive({ r: ri, c: ci });
                        setDraft(raw);
                        setEditing(true);
                      }}
                      className={`relative border border-slate-200 p-0 ${
                        inFillRange(ri, ci) ? "bg-emerald-50" : err ? "bg-red-50" : "bg-white"
                      }`}
                      style={
                        isActive
                          ? { outline: `2px solid ${GREEN}`, outlineOffset: -2, zIndex: 5 }
                          : inFillRange(ri, ci)
                            ? { outline: `1px dashed ${GREEN}`, outlineOffset: -1 }
                            : undefined
                      }
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          type={c.kind === "date" ? "date" : "text"}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") { e.preventDefault(); commit(e.shiftKey ? -1 : 1, 0); }
                            else if (e.key === "Tab") { e.preventDefault(); commit(0, e.shiftKey ? -1 : 1); }
                            else if (e.key === "Escape") { e.preventDefault(); cancel(); }
                          }}
                          onBlur={() => commit(0, 0)}
                          className="h-7 w-full bg-white px-1.5 text-xs text-slate-900 outline-none"
                        />
                      ) : (
                        <div
                          className={`h-7 truncate px-1.5 leading-7 ${
                            c.kind === "number" ? "text-right" : "text-left"
                          } ${err ? "pr-6 text-red-700" : "text-slate-800"}`}
                        >
                          {display}
                        </div>
                      )}
                      {isActive && !isEditing && !fill && (
                        <span
                          title="Drag to copy this value"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setFill({ r: ri, c: ci, tr: ri, tc: ci });
                          }}
                          className="absolute z-10 h-2 w-2 cursor-crosshair"
                          style={{
                            right: -4,
                            bottom: -4,
                            background: GREEN,
                            border: "1px solid #fff",
                          }}
                        />
                      )}
                      {err && !isEditing && (
                        <button
                          type="button"
                          aria-label="Show error"
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseEnter={(e) => {
                            const b = e.currentTarget.getBoundingClientRect();
                            setTip({ text: err, x: b.left + b.width / 2, y: b.bottom + 4 });
                          }}
                          onMouseLeave={() => setTip(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            const b = e.currentTarget.getBoundingClientRect();
                            setTip({ text: err, x: b.left + b.width / 2, y: b.bottom + 4 });
                          }}
                          className="absolute right-1 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-full text-red-600 hover:text-red-800"
                        >
                          <Info size={15} />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={columns.length + 1} className="p-6 text-center text-slate-500">
                  No rows to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 max-w-xs rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ left: tip.x, top: tip.y, transform: "translateX(-50%)" }}
        >
          {tip.text}
        </div>
      )}

      <p className="m-0 flex items-center gap-1 px-1 text-[11px] text-slate-500">
        <Info size={11} className="text-red-500" /> Red cells need a fix · hover the i icon in the cell to
        read the message.
      </p>
    </div>
  );
}