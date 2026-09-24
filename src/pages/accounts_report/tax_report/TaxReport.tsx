"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
// ⚠️ Adjust these paths to match your project


import { getDynamicLookup, getDynamicLookupaccount } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import {
  taxOutInSummaryReport,
  taxOutInReport,
  getTaxInvoiceExcelReport,
  exportTaxInvoiceSummaryExcel,
} from "../../../api/transactions";
import { NewReportDialog, NewReportPage, ReportFieldConfig, ReportOption } from "../../../components/new_report_format";

type TaxReportKey =
  | "taxoutsummary"
  | "taxinsummary"
  | "taxledgeroutreport"
  | "taxledgerinreport";

const TAX_REPORT_OPTIONS: {
  key: TaxReportKey;
  label: string;
  parameter: string;
  isSummary: boolean;
}[] = [
  {
    key: "taxoutsummary",
    label: "Tax Out Summary",
    parameter: "Account_Tax_Report_VAT_OUT_ACCOUNT_LEDGER_SUMMARY_REPORT",
    isSummary: true,
  },
  {
    key: "taxinsummary",
    label: "Tax In Summary",
    parameter: "Account_Tax_Report_VAT_IN_ACCOUNT_LEDGER_SUMMARY_REPORT",
    isSummary: true,
  },
  {
    key: "taxledgeroutreport",
    label: "Tax Ledger Out Report",
    parameter: "Account_Tax_Report_VAT_OUT_ACCOUNT_LEDGER_REPORT",
    isSummary: false,
  },
  {
    key: "taxledgerinreport",
    label: "Tax Ledger In Report",
    parameter: "Account_Tax_Report_VAT_IN_ACCOUNT_LEDGER_REPORT",
    isSummary: false,
  },
];

const formatDate = (date: string) => {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export default function TaxReportFilter() {
  const { user } = useAuth();

  // ── Filter values ─────────────────────────────────────────────────────────
  const [values, setValues] = useState<Record<string, any>>({
    division: "",
    dateFrom: "2026-05-01",
    dateTo: new Date().toISOString().split("T")[0],
    reportType: "taxoutsummary" as TaxReportKey,
    acCodes: ["All"],
    l4Codes: ["All"],
  });

  // ── Lookup data ───────────────────────────────────────────────────────────
  const [divisionList, setDivisionList] = useState<any[]>([]);
  const [accountItems, setAccountItems] = useState<any[]>([]);
  const [groupItems, setGroupItems] = useState<any[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // ── Dialog / report state ─────────────────────────────────────────────────
  const [reportOpen, setReportOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const division = values.division as string;
  const reportType = (values.reportType || "taxoutsummary") as TaxReportKey;

  const selectedReport = useMemo(
    () => TAX_REPORT_OPTIONS.find((o) => o.key === reportType) ?? TAX_REPORT_OPTIONS[0],
    [reportType]
  );

  // ── Fetch divisions on mount ──────────────────────────────────────────────
  useEffect(() => {
    const fetchDivisions = async () => {
      try {
        const response = await getDynamicLookup({
          parameter: "Account_division",
          code1: user?.company_code || "",
          loginid: user?.loginid || user?.username || "ADMIN",
        });
        setDivisionList(response || []);
      } catch (error) {
        console.error("Division fetch error:", error);
      }
    };
    fetchDivisions();
  }, [user?.company_code, user?.loginid, user?.username]);

  // ── When division changes: load groups + accounts ─────────────────────────
  useEffect(() => {
    if (!division) {
      setAccountItems([]);
      setGroupItems([]);
      setValues((prev) => ({
        ...prev,
        acCodes: ["All"],
        l4Codes: ["All"],
      }));
      return;
    }
    fetchGroups(division);
    fetchAccounts(division);
  }, [division]);

  const fetchGroups = async (div: string) => {
    try {
      setOptionsLoading(true);
      const response = await getDynamicLookupaccount({
        parameter: "Account_Report_Group",
        code1: user?.company_code || "",
        code2: div,
      });
      setGroupItems(response || []);
      setValues((prev) => ({ ...prev, l4Codes: ["All"] }));
    } catch (error) {
      console.error("Group fetch error:", error);
    } finally {
      setOptionsLoading(false);
    }
  };

  const fetchAccounts = async (div: string) => {
    try {
      setOptionsLoading(true);
      const response = await getDynamicLookupaccount({
        parameter: "Account_Report_AC",
        code1: user?.company_code || "",
        code2: div,
      });
      const uniqueData = Array.from(
        new Map((response || []).map((item: any) => [item.ac_code, item])).values()
      );
      setAccountItems(uniqueData as any[]);
      setValues((prev) => ({ ...prev, acCodes: ["All"] }));
    } catch (error) {
      console.error("Accounts fetch error:", error);
    } finally {
      setOptionsLoading(false);
    }
  };

  // ── Options for fields ────────────────────────────────────────────────────
  const divisionOptions: ReportOption[] = useMemo(
    () =>
      divisionList.map((d: any) => ({
        value: String(d.div_code),
        label: `${d.div_code} - ${d.div_name}`,
        code: String(d.div_code),
      })),
    [divisionList]
  );

  const accountOptions: ReportOption[] = useMemo(
    () =>
      accountItems.map((a: any) => ({
        value: String(a.ac_code),
        label: `${a.ac_code} - ${a.ac_name}`,
        code: String(a.ac_code),
      })),
    [accountItems]
  );

  const groupOptions: ReportOption[] = useMemo(
    () =>
      groupItems.map((g: any) => ({
        value: String(g.l4_code),
        label: `${g.l4_code} - ${g.description}`,
        code: String(g.l4_code),
      })),
    [groupItems]
  );

  const reportTypeOptions: ReportOption[] = useMemo(
    () => TAX_REPORT_OPTIONS.map((o) => ({ value: o.key, label: o.label })),
    []
  );

  // ── Field config ──────────────────────────────────────────────────────────
  const fields: ReportFieldConfig[] = useMemo(
    () => [
      {
        key: "division",
        label: "Division",
        type: "select",
        options: divisionOptions,
        required: true,
        placeholder: "Select division",
        colSpan: 3,
      },
      {
        key: "dateFrom",
        label: "From Date",
        type: "date",
        required: true,
        colSpan: 3,
      },
      {
        key: "dateTo",
        label: "To Date",
        type: "date",
        required: true,
        colSpan: 3,
      },
      {
        key: "reportType",
        label: "Report Type",
        type: "select",
        options: reportTypeOptions,
        required: true,
        colSpan: 3,
      },
      {
        key: "acCodes",
        label: "A/c Code",
        type: "multiselect",
        options: accountOptions,
        loading: optionsLoading,
        placeholder: "All",
        colSpan: 6,
        disabled: !division,
      },
      {
        key: "l4Codes",
        label: "Group",
        type: "multiselect",
        options: groupOptions,
        loading: optionsLoading,
        placeholder: "All",
        colSpan: 6,
        disabled: !division,
      },
    ],
    [
      divisionOptions,
      reportTypeOptions,
      accountOptions,
      groupOptions,
      division,
      optionsLoading,
    ]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleChange = useCallback((key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setReportError(null);
  }, []);

  const handleClearAll = useCallback(() => {
    setValues({
      division: "",
      dateFrom: "2026-05-01",
      dateTo: new Date().toISOString().split("T")[0],
      reportType: "taxoutsummary",
      acCodes: ["All"],
      l4Codes: ["All"],
    });
    setReportError(null);
  }, []);

  const buildParams = useCallback(
    (parameter: string) => {
      const ac = (values.acCodes as string[]) || [];
      const groups = (values.l4Codes as string[]) || [];

      return {
        loginid: user?.loginid || user?.username || "ADMIN",
        code1: user?.company_code || "",
        code2: formatDate(values.dateFrom),
        code3: formatDate(values.dateTo),
        code4: groups.length && !groups.includes("All") ? groups.join(",") : "All",
        code5: ac.length && !ac.includes("All") ? ac.join(",") : "All",
        code6: division || "",
        parameter,
      };
    },
    [values, division, user]
  );

  const reportTitle = useMemo(() => selectedReport.label, [selectedReport]);

  const handleGenerate = async () => {
    if (!division) {
      setReportError("Please select a Division before generating.");
      return;
    }

    setReportError(null);
    setGenerating(true);
    setReportHtml(null);
    setReportOpen(true);

    try {
      const params = buildParams(selectedReport.parameter);
      console.log("Generating:", selectedReport.parameter, params);

      const html = selectedReport.isSummary
        ? await taxOutInSummaryReport(params)
        : await taxOutInReport(params);

      setReportHtml(typeof html === "string" ? html : String(html ?? ""));
    } catch (err: any) {
      console.error(err);
      setReportError(err?.message || "Failed to generate report.");
      setReportOpen(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleExportExcel = async () => {
    if (!division) {
      setReportError("Please select a Division before exporting.");
      return;
    }
    setReportError(null);
    setGeneratingExcel(true);
    try {
      const params = buildParams(selectedReport.parameter);

      if (selectedReport.isSummary) {
        await exportTaxInvoiceSummaryExcel(params);
      } else {
        await getTaxInvoiceExcelReport(params);
      }
    } catch (err: any) {
      console.error(err);
      setReportError(err?.message || "Failed to export Excel.");
    } finally {
      setGeneratingExcel(false);
    }
  };

  return (
    <>
      <NewReportPage
        title="Tax Report"
        fields={fields}
        values={values}
        onChange={handleChange}
        onClearAll={handleClearAll}
        onGenerate={handleGenerate}
        loading={generating}
        optionsLoading={optionsLoading}
        error={reportError}
        onClearError={() => setReportError(null)}
        defaultColSpan={3}
      />

      <NewReportDialog
        open={reportOpen}
        onClose={() => {
          setReportOpen(false);
          setReportHtml(null);
        }}
        title={reportTitle}
        htmlContent={reportHtml}
        loading={generating}
        error={reportError}
        onExportExcel={handleExportExcel}
        exportingExcel={generatingExcel}
      />
    </>
  );
}