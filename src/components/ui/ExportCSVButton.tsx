import { Button } from "./Button";
import { Download } from "lucide-react";

type ExportCSVButtonProps<T> = {
  data: T[];
  columns: any[];
  filename?: string;
  includeHidden?: boolean;
};

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function ExportCSVButton<T>({ data, columns, filename = "export.csv" }: ExportCSVButtonProps<T>) {
  const getByPath = (obj: any, path: string) => {
    if (!obj || !path) return undefined;
    return path.split(".").reduce((acc: any, seg: string) => (acc == null ? undefined : acc[seg]), obj);
  };

  const resolveCols = (cols: any[]) =>
    cols
      .filter((c) => !c.meta?.noExport && (c.accessorKey || c.accessorFn || (c.id && c.id !== "actions")))
      .map((c) => ({
        header: c.meta?.exportHeader ?? (typeof c.header === "string" ? c.header : c.accessorKey ?? c.id ?? String(c.id ?? "")),
        accessorKey: c.accessorKey,
        id: c.id,
        accessorFn: c.accessorFn,
      }));

  const onClick = () => {
    try {
      const cols = resolveCols(columns || []);

      const rows = (data || []).map((row: any) =>
        cols
          .map((col) => {
            let val: any;
            if (col.accessorKey) {
              val = getByPath(row, col.accessorKey as string);
            }
            if (val === undefined && typeof col.accessorFn === "function") {
              try {
                val = col.accessorFn(row);
              } catch (e) {
                val = undefined;
              }
            }
            if (val === undefined && col.id) {
              val = getByPath(row, col.id as string);
            }
            return escapeCsv(val);
          })
          .join(","),
      );

      const headerLine = cols.map((c) => escapeCsv(c.header)).join(",");
      const csv = [headerLine, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  return (
    <Button className="rounded-full px-3" size="sm" variant="outline" onClick={onClick} title="Export CSV" aria-label="Export CSV">
      <Download size={13} />
      Export
    </Button>
  );
}

export default ExportCSVButton;
