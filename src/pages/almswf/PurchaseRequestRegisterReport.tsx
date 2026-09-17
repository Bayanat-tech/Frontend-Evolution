import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../state/AuthContext";
import { almsCommonSelect } from "../../api/alms";
import {
  exportPRPurchaseSummaryExcel,
  getPRRegisterReportHtml,
} from "../../api/transactions";
import { NewReportDialog, NewReportPage, ReportFieldConfig, ReportOption } from "../../components/new_report_format";


// ─── Types ────────────────────────────────────────────────────────────────────

interface Params {
  division: string;
  status: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PurchaseRequestRegisterReport() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";

  // ── Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>("");
  const [reportHtml, setReportHtml] = useState<string | null>(null);

  // ── Parameter options
  const [divisionOptions, setDivisionOptions] = useState<ReportOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<ReportOption[]>([]);
  const [optLoading, setOptLoading] = useState(false);
  const [optError, setOptError] = useState<string>("");

  // ── Parameter values
  const [params, setParams] = useState<Params>({
    division: "ALL",
    status: "ALL",
  });

  const optionsLoadedRef = useRef(false);

  // ── Load options ──────────────────────────────────────────────────────────
  const loadOptions = useCallback(async () => {
    if (optionsLoadedRef.current) return;
    optionsLoadedRef.current = true;

    setOptLoading(true);
    setOptError("");

    try {
      const divisionResult = await almsCommonSelect({
        parameter: "PS_PREQUEST_ENTRY_DIVISION",
        loginid,
        code1: companyCode,
        code2: "",
        code3: "",
        code4: "",
      });

      const statusResult = await almsCommonSelect({
        parameter: "PS_PREQUEST_ENTRY_STATUS_LIST",
        loginid,
        code1: companyCode,
        code2: "",
        code3: "",
        code4: "",
      });

      const divisions: ReportOption[] = [
        { value: "ALL", label: "All Divisions" },
        ...(divisionResult || []).map((row: Record<string, unknown>) => ({
          value: String(row.DIV_CODE || ""),
          label: String(row.DIV_NAME || ""),
        })),
      ];

      let statuses: ReportOption[] = [];
      if (statusResult && statusResult.length > 0) {
        statuses = (statusResult || []).map((row: Record<string, unknown>) => ({
          value: String(row.STATUS_CODE || ""),
          label: String(row.STATUS_NAME || ""),
        }));
      } else {
        const STATUS_LABELS: Record<string, string> = {
          SAVEASDRAFT: "Draft",
          SUBMITTED: "Submitted",
          APPROVED: "Approved",
          REJECTED: "Rejected",
          SENDBACK: "Sent Back",
          CANCELED: "Canceled",
        };
        statuses = [
          { value: "ALL", label: "All" },
          ...Object.entries(STATUS_LABELS).map(([code, label]) => ({
            value: code,
            label,
          })),
        ];
      }

      setDivisionOptions(divisions);
      setStatusOptions(statuses);
    } catch (e: any) {
      console.error("Failed to load options", e);
      setOptError(e?.message ?? "Failed to load filter options");
      optionsLoadedRef.current = false;
    } finally {
      setOptLoading(false);
    }
  }, [companyCode, loginid]);

  useEffect(() => {
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch the report HTML ─────────────────────────────────────────────────
  const fetchReport = useCallback(
    async (p: Params) => {
      setLoading(true);
      setError("");
      setReportHtml(null);
      setDialogOpen(true);

      try {
        const html = await getPRRegisterReportHtml({
          parameter: "PS_PREQUEST_ENTRY_SUMMARY_REPORT",
          loginid: loginid,
          code1: companyCode,
          code2: p.division,
          code3: p.status,
          code4: "",
        });

        setReportHtml(html);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load report. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [companyCode, loginid]
  );

  // ── Excel export ───────────────────────────────────────────────────────────
  const handleExcel = async () => {
    setExporting(true);
    try {
      await exportPRPurchaseSummaryExcel({
        parameter: "PS_PREQUEST_ENTRY_SUMMARY_REPORT",
        loginid: loginid,
        code1: companyCode,
        code2: params.division,
        code3: params.status,
        code4: "",
      });
    } catch (e: any) {
      alert("Excel export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // ── Generate report ───────────────────────────────────────────────────────
  const handleGenerateReport = () => {
    fetchReport(params);
  };

  // ── Field change handler (matches NewReportPage's onChange signature) ─────
  const handleFieldChange = (key: string, value: any) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearAll = () => {
    setParams({ division: "ALL", status: "ALL" });
    setError("");
  };

  // ── Field config for NewReportPage ────────────────────────────────────────
  const fields: ReportFieldConfig[] = [
    {
      key: "division",
      label: "Division",
      type: "select",
      options: divisionOptions,
      placeholder: "Select Division",
      loading: optLoading,
      colSpan: 6,
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: statusOptions,
      placeholder: "Select Status",
      loading: optLoading,
      colSpan: 6,
    },
  ];

  return (
    <>
      <NewReportPage
        title="Purchase Request Register Report"
        fields={fields}
        values={params}
        onChange={handleFieldChange}
        onClearAll={handleClearAll}
        onGenerate={handleGenerateReport}
        loading={loading}
        optionsLoading={optLoading}
        error={optError || error || null}
        onClearError={() => {
          setError("");
          setOptError("");
        }}
      />

      <NewReportDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Purchase Request Register Report"
        htmlContent={reportHtml}
        loading={loading}
        error={error || null}
        onExportExcel={handleExcel}
        exportingExcel={exporting}
        meta={{ division: params.division, status: params.status }}
      />
    </>
  );
}