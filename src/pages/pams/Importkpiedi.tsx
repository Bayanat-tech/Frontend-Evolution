import React, { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "../../state/AuthContext";
import * as XLSX from "xlsx-js-style";
import {
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Paperclip,
  Trash2,
  RefreshCw,
  Eraser,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { DataTable } from "../../components/ui/DataTable";
import { pamsSelect, pamsSave, pamsDelete } from "../../api/pams";
import type { ColumnDef } from "@tanstack/react-table";

export type DesignationInfo = {
  divCode: string;
  divName: string;
  deptCode: string;
  deptName: string;
};

interface ImportKpiEdiProps {
  onClose: () => void;
  onSuccess: () => void;
  divisionCode?: string;
  divisionName?: string;
  departmentCode?: string;
  departmentName?: string;
  designationLookup?: Record<string, DesignationInfo[]>;
}

interface EdiRow {
  error_message?: string;
  kpi_code?: string;
  kpi_group?: string;
  kpi_activity?: string;
  weightage?: string;
  div_code?: string;
  div_name?: string;
  dept_code?: string;
  dept_name?: string;
  desg_code?: string;
  desg_name?: string;
  dept_head_name?: string;
  dept_head_code?: string;
  remarks?: string;
  loaded_by?: string;
  loaded_date?: string;
  company_code?: string;
}

type AnyRow = Record<string, any>;

function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function normKey(k: string): string {
  return String(k || "")
    .replace(/[\s\-]+/g, "_")
    .replace(/__+/g, "_")
    .trim()
    .toUpperCase();
}

function normalizeRow(row: AnyRow): AnyRow {
  const out: AnyRow = {};
  Object.keys(row || {}).forEach((k) => {
    out[normKey(k)] = row[k];
  });
  return out;
}

function getVal(row: AnyRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

// ═════════════════════════════════════════════════════════
// EDI Row-level validation
//    ✅ FIXED: Min 3 KPI Groups per DESG (Max limit REMOVED)
//    ✅ Duplicate KPI Group detection
// ═════════════════════════════════════════════════════════
function applyEdiValidation(rows: EdiRow[]): EdiRow[] {
  const desgGroups = new Map<
    string,
    {
      kpiGroups: Map<string, { rowIndices: number[]; weightages: Set<string> }>;
      allRowIndices: number[];
    }
  >();

  rows.forEach((r, idx) => {
    const desg = text(r.desg_code).toUpperCase();
    const grp = text(r.kpi_group).toUpperCase();
    const wt = text(r.weightage);

    if (!desg) return;

    if (!desgGroups.has(desg)) {
      desgGroups.set(desg, { kpiGroups: new Map(), allRowIndices: [] });
    }
    const dg = desgGroups.get(desg)!;
    dg.allRowIndices.push(idx);

    if (!grp) return;

    if (!dg.kpiGroups.has(grp)) {
      dg.kpiGroups.set(grp, { rowIndices: [], weightages: new Set() });
    }
    const kg = dg.kpiGroups.get(grp)!;
    kg.rowIndices.push(idx);
    kg.weightages.add(wt);
  });

  return rows.map((r) => {
    const desg = text(r.desg_code).toUpperCase();
    const grp = text(r.kpi_group).toUpperCase();

    const backendError = text(r.error_message);
    let computedError = "";

    const dg = desgGroups.get(desg);

    if (!backendError && dg) {
      const distinctGroups = dg.kpiGroups.size;

      // ─────────────────────────────────────────────
      // Check 1: Duplicate KPI Group (same name, multiple weightages)
      // ─────────────────────────────────────────────
      let duplicateGroupName: string | null = null;
      dg.kpiGroups.forEach((info, gname) => {
        if (info.weightages.size > 1 && !duplicateGroupName) {
          duplicateGroupName = gname;
        }
      });

      if (duplicateGroupName) {
        if (grp === duplicateGroupName) {
          const wts = Array.from(dg.kpiGroups.get(duplicateGroupName)!.weightages)
            .filter(Boolean)
            .join(", ");
          computedError = `Duplicate KPI Group "${r.kpi_group}" in DESG ${r.desg_code} — appears with multiple weightages: ${wts}`;
        }
      }
      // ─────────────────────────────────────────────
      // Check 2: Min 3 KPI Groups per DESG
      //          ✅ Max 6 rule REMOVED
      // ─────────────────────────────────────────────
      else if (distinctGroups < 3) {
        computedError = `DESG ${r.desg_code} has only ${distinctGroups} KPI Group(s). Min 3 required.`;
      }

      // ─────────────────────────────────────────────
      // Check 3: Blank KPI group name
      // ─────────────────────────────────────────────
      if (!computedError && !grp) {
        computedError = "KPI Group name is blank.";
      }
    }

    return {
      ...r,
      error_message: backendError || computedError,
    };
  });
}

const ImportKpiEdi: React.FC<ImportKpiEdiProps> = ({
  onClose,
  onSuccess,
  divisionCode = "",
  divisionName = "",
  departmentCode = "",
  departmentName = "",
  designationLookup = {},
}) => {
  const { user } = useAuth();

  const [excelData, setExcelData] = useState<AnyRow[]>([]);
  const [ediRows, setEdiRows] = useState<EdiRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [ediUploaded, setEdiUploaded] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ STEP 1: Dedupe rows on frontend
  const dedupedEdiRows = useMemo<EdiRow[]>(() => {
    const seen = new Set<string>();
    return ediRows.filter((r) => {
      const key = [
        text(r.desg_code).toUpperCase(),
        text(r.kpi_group).toUpperCase(),
        text(r.kpi_activity).toUpperCase(),
        text(r.weightage),
      ].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [ediRows]);

  const enhancedEdiRows = useMemo<EdiRow[]>(
    () => applyEdiValidation(dedupedEdiRows),
    [dedupedEdiRows]
  );

  const validRows = enhancedEdiRows.filter(
    (row) => !row.error_message || row.error_message.trim() === ""
  );
  const invalidRows = enhancedEdiRows.filter(
    (row) => row.error_message && row.error_message.trim() !== ""
  );
  const hasErrors = invalidRows.length > 0;

  const totalCount = enhancedEdiRows.length;
  const countLabel = useMemo(
    () => `${totalCount} record${totalCount === 1 ? "" : "s"}`,
    [totalCount]
  );

  // ═════════════════════════════════════════════════════════
  // HARD CLEAR — 3 attempts + verification
  // ═════════════════════════════════════════════════════════
  const clearStaging = async (): Promise<boolean> => {
    const MAX_ATTEMPTS = 3;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await pamsDelete({
          parameter: "clear_kpi_edi",
          loginid: user?.loginid ?? "",
          code1: user?.company_code ?? "",
        });
      } catch (e) {
        console.warn(`clear attempt ${attempt} threw:`, e);
      }

      try {
        const check: any = await pamsSelect({
          parameter: "get_kpi_edi",
          loginid: user?.loginid ?? "",
          code1: user?.company_code ?? "",
        });

        if (!Array.isArray(check)) return true;

        const myLoginid = text(user?.loginid).toUpperCase();
        const myRows = check.filter((r: any) => {
          const r2: any = {};
          Object.keys(r).forEach((k) => {
            r2[k.toUpperCase()] = r[k];
          });
          return text(r2.LOADED_BY).toUpperCase() === myLoginid;
        });

        if (myRows.length === 0) {
          console.log(`clear succeeded on attempt ${attempt}`);
          return true;
        }

        console.warn(
          `clear attempt ${attempt} failed — ${myRows.length} rows still exist`
        );
      } catch (e) {
        console.warn(`verify attempt ${attempt} threw:`, e);
        return true;
      }

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((res) => setTimeout(res, 300));
      }
    }

    return false;
  };

  const handleForceClear = async () => {
    try {
      setIsLoading(true);
      setUploadError(null);

      const cleared = await clearStaging();

      if (cleared) {
        setNotice({
          type: "success",
          message: "Staging cleared successfully.",
        });
        setEdiRows([]);
        setEdiUploaded(false);
      } else {
        setUploadError(
          "Unable to clear staging data. This is a database permission issue — " +
            "please contact your administrator to grant DELETE privilege on GT_KPI_EDI."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ═════════════════════════════════════════════════════════
  // FETCH STAGING
  // ═════════════════════════════════════════════════════════
  const fetchEDIData = async () => {
    try {
      setIsLoading(true);
      const response = await pamsSelect({
        parameter: "get_kpi_edi",
        loginid: user?.loginid ?? "",
        code1: user?.company_code ?? "",
      });

      if (Array.isArray(response)) {
        const myLoginid = text(user?.loginid).toUpperCase();

        const rows: EdiRow[] = response
          .map((row: any) => {
            const r: any = {};
            Object.keys(row).forEach((k) => {
              r[k.toUpperCase()] = row[k];
            });

            return {
              error_message: text(r.ERROR_MESSAGE),
              kpi_code: text(r.KPI_CODE),
              kpi_group: text(r.KPI_GROUP),
              kpi_activity: text(r.KPI_ACTIVITY),
              weightage: text(r.WEIGHTAGE),
              div_code: text(r.DIV_CODE),
              div_name: text(r.DIV_NAME),
              dept_code: text(r.DEPT_CODE),
              dept_name: text(r.DEPT_NAME),
              desg_code: text(r.DESG_CODE),
              desg_name: text(r.DESG_NAME),
              dept_head_name: text(r.DEPT_HEAD_NAME),
              dept_head_code: text(r.DEPT_HEAD_CODE),
              remarks: text(r.REMARKS),
              loaded_by: text(r.LOADED_BY),
              loaded_date: text(r.LOADED_DATE),
              company_code: text(r.COMPANY_CODE),
            };
          })
          .filter((row) => text(row.loaded_by).toUpperCase() === myLoginid);

        setEdiRows(rows);
      } else {
        setEdiRows([]);
      }
    } catch (err: any) {
      setUploadError("Failed to fetch staged data: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ═════════════════════════════════════════════════════════
  // FILE UPLOAD
  // ═════════════════════════════════════════════════════════
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setFileName(file.name);
    setFileSelected(false);
    setExcelData([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as AnyRow[];

        if (json.length === 0) {
          setUploadError("Excel file is empty");
          return;
        }
        if (json.length > 5000) {
          setUploadError("File has more than 5000 rows.");
          return;
        }

        const normalized = json.map(normalizeRow);

        const first = normalized[0] ?? {};
        const hasDesg = "DESG_CODE" in first || "DESGCODE" in first;
        const hasActivity = "KPI_ACTIVITY" in first || "KPIACTIVITY" in first;
        if (!hasDesg || !hasActivity) {
          setUploadError(
            "Required columns missing. Please use columns: DESG_CODE, DESG_NAME, KPI_GROUP, WEIGHTAGE, KPI_ACTIVITY."
          );
          return;
        }

        setExcelData(normalized);
        setFileSelected(true);
        setNotice({
          type: "info",
          message: `${normalized.length} rows loaded from "${file.name}". Click "Upload to EDI" to continue.`,
        });
      } catch (err: any) {
        setUploadError("Failed to parse Excel file: " + err.message);
      }
    };
    reader.onerror = () => setUploadError("Failed to read file");
    reader.readAsArrayBuffer(file);
  };

  // ═════════════════════════════════════════════════════════
  // UPLOAD TO EDI STAGING
  // ═════════════════════════════════════════════════════════
  const CHUNK_SIZE = 100;

  const handleUploadToEDI = async () => {
    try {
      setIsLoading(true);
      setUploadError(null);

      const existingCheck: any = await pamsSelect({
        parameter: "get_kpi_edi",
        loginid: user?.loginid ?? "",
        code1: user?.company_code ?? "",
      });

      if (Array.isArray(existingCheck)) {
        const myLoginid = text(user?.loginid).toUpperCase();
        const existingMyRows = existingCheck.filter((r: any) => {
          const r2: any = {};
          Object.keys(r).forEach((k) => {
            r2[k.toUpperCase()] = r[k];
          });
          return text(r2.LOADED_BY).toUpperCase() === myLoginid;
        });

        if (existingMyRows.length > 0) {
          const cleared = await clearStaging();
          if (!cleared) {
            setUploadError(
              `Cannot proceed. There are ${existingMyRows.length} old rows in staging that cannot be cleared.\n\n` +
                `Please click "Clear All Staging" button to retry, or contact your admin to grant DELETE privilege on GT_KPI_EDI table.\n\n` +
                `Continuing would duplicate the data.`
            );
            setIsLoading(false);
            return;
          }
        }
      }

      const filled: AnyRow[] = [];
      let lastDesg: AnyRow = {};
      let lastKpiGroup = "";
      let lastWeightage = "";

      for (const raw of excelData) {
        const r = normalizeRow(raw);

        const desgCode = getVal(r, "DESGCODE", "DESG_CODE");
        const currentGroup = getVal(r, "KPIGROUP", "KPI_GROUP");

        if (desgCode !== "") {
          lastDesg = { ...r };
          lastKpiGroup = currentGroup;
          lastWeightage = getVal(r, "WEIGHTAGE");
        } else {
          if (currentGroup !== "") {
            lastKpiGroup = currentGroup;
            lastWeightage = getVal(r, "WEIGHTAGE");
          }
        }

        const merged: AnyRow = { ...lastDesg };
        Object.keys(r).forEach((k) => {
          if (r[k] !== undefined && String(r[k]).trim() !== "") {
            merged[k] = r[k];
          }
        });

        merged["KPIGROUP"] = lastKpiGroup;
        merged["WEIGHTAGE"] = lastWeightage;

        if (!getVal(merged, "KPIACTIVITY", "KPI_ACTIVITY")) continue;
        filled.push(merged);
      }

      const desgUseCount: Record<string, number> = {};

      const mappedRows = filled.map((r) => {
        const desgCode = getVal(r, "DESGCODE", "DESG_CODE").replace(/\.0+$/, "");
        const arr = designationLookup[desgCode] || [];
        const idx = desgUseCount[desgCode] || 0;
        const info = arr[idx] || arr[0];

        desgUseCount[desgCode] = idx + 1;

        const scope = info
          ? {
              divCode: info.divCode,
              divName: info.divName,
              deptCode: info.deptCode,
              deptName: info.deptName,
            }
          : {
              divCode: divisionCode,
              divName: divisionName,
              deptCode: departmentCode,
              deptName: departmentName,
            };

        return [
          scope.divCode || "-",
          scope.divName || "-",
          scope.deptCode || "-",
          scope.deptName || "-",
          "-",
          "-",
          desgCode,
          getVal(r, "DESGNAME", "DESG_NAME"),
          getVal(r, "KPIGROUP", "KPI_GROUP"),
          getVal(r, "WEIGHTAGE").replace(/\.0+$/, ""),
          getVal(r, "KPIACTIVITY", "KPI_ACTIVITY"),
        ].join("|");
      });

      const chunks: string[][] = [];
      for (let i = 0; i < mappedRows.length; i += CHUNK_SIZE) {
        chunks.push(mappedRows.slice(i, i + CHUNK_SIZE));
      }

      let totalUploaded = 0;
      for (let i = 0; i < chunks.length; i++) {
        await (pamsSave as any)({
          parameter: "kpi_edi_bulk_insert",
          loginid: user?.loginid ?? "",
          val1s1: user?.company_code ?? "",
          val1s2: chunks[i].join("||"),
        });
        totalUploaded += chunks[i].length;
        setNotice({
          type: "info",
          message: `Uploading... ${totalUploaded}/${filled.length} rows`,
        });
      }

      await fetchEDIData();
      setEdiUploaded(true);
      setNotice({
        type: "success",
        message: `Uploaded successfully. ${filled.length} rows staged.`,
      });
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ═════════════════════════════════════════════════════════
  // SAVE VALID ROWS
  // ═════════════════════════════════════════════════════════
  const handlePostValid = async () => {
    if (validRows.length === 0) {
      setUploadError("No valid records to post.");
      return;
    }

    try {
      setIsLoading(true);
      setNotice(null);

      const result = await pamsSelect({
        parameter: "sp_copy_kpi_edi",
        loginid: user?.loginid ?? "",
        code1: user?.company_code ?? "",
      });

      let resultStr = "";
      if (Array.isArray(result) && result.length > 0) {
        const firstRow = result[0] as Record<string, unknown>;
        resultStr = String(Object.values(firstRow)[0] ?? "");
      }

      if (!resultStr.toUpperCase().startsWith("ERROR")) {
        setNotice({
          type: "success",
          message: `Import successful! ${validRows.length} records saved.`,
        });
        setTimeout(() => {
          void handleReset();
          onSuccess();
          onClose();
        }, 2000);
      } else {
        setUploadError("Copy failed: " + resultStr);
      }
    } catch (err: any) {
      setUploadError("Failed to save records: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    await clearStaging();
    setExcelData([]);
    setEdiRows([]);
    setUploadError(null);
    setEdiUploaded(false);
    setFileSelected(false);
    setFileName("");
    setNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ═════════════════════════════════════════════════════════
  // DOWNLOAD TEMPLATE
  // ═════════════════════════════════════════════════════════
  const handleDownloadTemplate = async () => {
    try {
      setIsLoading(true);
      setUploadError(null);

      const templateData: Array<Record<string, string>> = [];
      const desgCodes = Object.keys(designationLookup || {}).sort();
      const nameMap: Record<string, string> = {};

      for (const desgCode of desgCodes) {
        const arr = designationLookup[desgCode];
        if (!Array.isArray(arr) || arr.length === 0) continue;

        for (const info of arr) {
          templateData.push({
            DESG_CODE: desgCode,
            DESG_NAME: "",
            KPI_GROUP: "",
            WEIGHTAGE: "",
            KPI_ACTIVITY: "",
          });
        }
      }

      if (templateData.length > 0) {
        try {
          const pairs = new Set<string>();
          for (const desgCode of desgCodes) {
            const arr = designationLookup[desgCode];
            if (!Array.isArray(arr)) continue;
            for (const info of arr) {
              if (info.divCode && info.deptCode) {
                pairs.add(`${info.divCode}|${info.deptCode}`);
              }
            }
          }

          for (const pair of pairs) {
            const [d, p] = pair.split("|");
            try {
              const desgRows = await pamsSelect({
                parameter: "employee_designation",
                loginid: user?.loginid ?? "",
                code1: user?.company_code ?? "",
                code2: d,
                code3: p,
                code4: "All",
              });

              if (Array.isArray(desgRows)) {
                for (const raw of desgRows) {
                  const r: AnyRow = {};
                  Object.keys(raw).forEach((k) => {
                    r[k.toUpperCase()] = (raw as AnyRow)[k];
                  });
                  const c = text(r.DESG_CODE);
                  const n = text(r.DESG_NAME);
                  if (c && !nameMap[c]) nameMap[c] = n;
                }
              }
            } catch {
              // silent
            }
          }

          for (const row of templateData) {
            if (nameMap[row.DESG_CODE]) {
              row.DESG_NAME = nameMap[row.DESG_CODE];
            }
          }
        } catch {
          // silent
        }
      }

      if (templateData.length === 0) {
        templateData.push({
          DESG_CODE: "",
          DESG_NAME: "",
          KPI_GROUP: "",
          WEIGHTAGE: "",
          KPI_ACTIVITY: "",
        });
      }

      const ws = XLSX.utils.json_to_sheet(templateData);

      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
      const yellowStyle = {
        fill: { patternType: "solid", fgColor: { rgb: "FFFF00" } },
        font: { bold: true, color: { rgb: "000000" } },
      };

      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c });
        if (!ws[cellRef]) continue;
        (ws[cellRef] as any).s = yellowStyle;
      }

      ws["!cols"] = [
        { wch: 12 },
        { wch: 40 },
        { wch: 32 },
        { wch: 12 },
        { wch: 55 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "KpiEdiTemplate");
      XLSX.writeFile(wb, "KPI_EDI_Template.xlsx");

      setNotice({
        type: "success",
        message: `Template downloaded with ${templateData.length} row(s).`,
      });
    } catch (err: any) {
      setUploadError("Failed to generate template: " + (err?.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  // ═════════════════════════════════════════════════════════
  // COLUMNS
  // ═════════════════════════════════════════════════════════
  const columns: ColumnDef<EdiRow>[] = [
    {
      accessorKey: "error_message",
      header: "Status",
      size: 280,
      cell: ({ row }) => {
        const error = row.original.error_message;
        if (error && error.trim() !== "") {
          return (
            <div className="flex items-start gap-2 text-red-600">
              <XCircle size={16} className="mt-0.5 shrink-0" />
              <span className="text-xs font-medium leading-snug whitespace-normal">
                {error}
              </span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle size={16} />
            <span className="text-sm font-medium">Valid</span>
          </div>
        );
      },
    },
    { accessorKey: "kpi_group", header: "KPI Desc (Group)", size: 240 },
    { accessorKey: "kpi_activity", header: "KPI Item (Activity)", size: 380 },
    { accessorKey: "weightage", header: "Weightage", size: 100 },
    { accessorKey: "div_code", header: "Div Code", size: 90 },
    { accessorKey: "div_name", header: "Division", size: 200 },
    { accessorKey: "dept_code", header: "Dept Code", size: 100 },
    { accessorKey: "dept_name", header: "Department", size: 200 },
    { accessorKey: "desg_code", header: "Desg Code", size: 100 },
    { accessorKey: "desg_name", header: "Designation", size: 200 },
    { accessorKey: "loaded_by", header: "Loaded By", size: 120 },
    { accessorKey: "loaded_date", header: "Loaded Date", size: 150 },
  ];

  useEffect(() => {
    if (ediUploaded) fetchEDIData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ediUploaded]);

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-secondary/30 p-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
            <FileSpreadsheet size={18} />
          </span>
          <div>
            <h3 className="m-0 text-sm font-semibold">
              {ediUploaded ? "KPI EDI Staging" : "KPI Excel Import"}
            </h3>
            <p className="m-0 text-xs text-muted-foreground">
              {ediUploaded
                ? `${countLabel} staged · Review before saving`
                : fileName
                  ? `Selected: ${fileName}`
                  : "Upload an Excel file with KPI data to import in bulk"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls"
            className="hidden"
          />

          {!ediUploaded && (
            <>
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                className="gap-2"
                disabled={isLoading}
              >
                <Download size={15} /> Template
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="gap-2"
              >
                <Paperclip size={15} /> Select Excel
              </Button>
              {fileSelected && excelData.length > 0 && (
                <Button onClick={handleUploadToEDI} disabled={isLoading} className="gap-2">
                  <Upload size={15} />
                  {isLoading ? "Uploading..." : "Upload to EDI"}
                </Button>
              )}
            </>
          )}

          {ediUploaded && (
            <>
              <Button
                variant="outline"
                onClick={() => void fetchEDIData()}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw size={15} /> Refresh
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleForceClear()}
                disabled={isLoading}
                className="gap-2 text-red-600 hover:text-red-700"
                title="Force clear all staging data"
              >
                <Eraser size={15} /> Clear All Staging
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleReset()}
                disabled={isLoading}
                className="gap-2"
              >
                <Upload size={15} /> New File
              </Button>
            </>
          )}
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {!ediUploaded && !fileSelected && (
        <div className="grid min-h-[260px] place-items-center rounded-md border border-dashed bg-secondary/20 p-8 text-center">
          <div>
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-md bg-primary/10 text-primary">
              <FileSpreadsheet size={20} />
            </div>
            <h3 className="m-0 text-base font-semibold">Upload KPI Excel File</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Columns required:{" "}
              <strong>DESG_CODE, DESG_NAME, KPI_GROUP, WEIGHTAGE, KPI_ACTIVITY</strong>.
              Download the template for reference.
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              <strong>Note:</strong> Each designation must have <strong>at least 3 KPI Groups</strong>.
              Duplicate KPI Groups within a designation are not allowed.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
                <Download size={15} /> Download Template
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Paperclip size={15} /> Select Excel File
              </Button>
            </div>
          </div>
        </div>
      )}

      {!ediUploaded && fileSelected && excelData.length > 0 && (
        <div className="grid min-h-[200px] place-items-center rounded-md border border-dashed bg-blue-50/40 p-8 text-center">
          <div>
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-md bg-blue-100 text-blue-600">
              <CheckCircle size={22} />
            </div>
            <h3 className="m-0 text-base font-semibold">
              {excelData.length} rows ready to upload
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Review the file content before uploading to staging. Click{" "}
              <strong>Upload to EDI</strong> to proceed.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => void handleReset()}
                className="gap-2"
                disabled={isLoading}
              >
                <Trash2 size={15} /> Discard
              </Button>
              <Button onClick={handleUploadToEDI} disabled={isLoading} className="gap-2">
                <Upload size={15} />
                {isLoading ? "Uploading..." : "Upload to EDI Staging"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {ediUploaded && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-secondary/30 p-3">
            <div className="flex gap-6">
              <div>
                <span className="text-xs text-muted-foreground">Total</span>
                <p className="m-0 text-2xl font-bold text-foreground">
                  {enhancedEdiRows.length}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Valid</span>
                <p className="m-0 text-2xl font-bold text-green-600">
                  {validRows.length}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Invalid</span>
                <p className="m-0 text-2xl font-bold text-red-600">
                  {invalidRows.length}
                </p>
              </div>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={enhancedEdiRows}
            title="Staged Records"
            subtitle="Review and validate before saving"
            searchPlaceholder="Search records..."
            loading={isLoading}
            height={500}
            minWidth={1800}
            density="grid"
            enablePagination
            pageSize={50}
            getRowId={(row, i) => `${row.kpi_code}_${row.div_code}_${i}`}
            rowClassName={(row) =>
              row.error_message && row.error_message.trim() !== ""
                ? "bg-red-50 hover:bg-red-100"
                : "bg-green-50/30 hover:bg-green-50"
            }
          />
        </div>
      )}

      {uploadError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-600" />
            <div className="whitespace-pre-line text-sm text-red-700">{uploadError}</div>
          </div>
        </div>
      )}

      {hasErrors && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-yellow-700" />
            <div className="text-sm text-yellow-800">
              {invalidRows.length} record(s) have validation errors. Please fix and re-upload.
              All errors are shown in the <strong>Status</strong> column above.
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2">
          <Download size={14} /> Download Template
        </Button>

        {ediUploaded ? (
          <div className="flex gap-2">
            <Button
              variant="default"
              onClick={handlePostValid}
              disabled={isLoading || hasErrors || validRows.length === 0}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  Save Valid Records ({validRows.length})
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={() => void handleReset()} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </div>
  );
};

export default ImportKpiEdi;