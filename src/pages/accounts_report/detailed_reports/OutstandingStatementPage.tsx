"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
// ⚠️ Adjust these paths to match your project


import { getDynamicLookup, getDynamicLookupaccount } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import {
  exportOutstandingDetailExcel,
  exportOutstandingSummaryExcel,
  openOutstandingStatementDetailReport,
  openOutstandingStatementSummaryReport,
} from "../../../api/transactions";
import { NewReportDialog, NewReportPage, ReportFieldConfig, ReportOption } from "../../../components/new_report_format";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateOracle(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${d}-${months[parseInt(m, 10) - 1]}-${y}`;
}

const OutstandingStatementPage: React.FC = () => {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? user?.username ?? "";

  // ── Filter values ─────────────────────────────────────────────────────────
  const [values, setValues] = useState<Record<string, any>>({
    division: "",
    asOnDate: todayISO(),
    reportType: "detail",
    acCodes: ["All"],
    l4Codes: ["All"],
  });

  // ── Lookup data ───────────────────────────────────────────────────────────
  const [divisionList, setDivisionList] = useState<any[]>([]);
  const [accountItems, setAccountItems] = useState<any[]>([]);
  const [groupItems, setGroupItems] = useState<any[]>([]);
  const [fetchedTabs, setFetchedTabs] = useState<Set<string>>(new Set());
  const [optionsLoading, setOptionsLoading] = useState(false);

  // ── Dialog / report state ─────────────────────────────────────────────────
  const [reportOpen, setReportOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const division = values.division as string;
  const reportType = (values.reportType || "detail") as "detail" | "summary";

  // ── Fetch divisions on mount ──────────────────────────────────────────────
  useEffect(() => {
    getDynamicLookup({
      parameter: "Account_division",
      loginid: loginId,
      code1: companyCode,
      code2: "",
      code3: "",
      code4: "",
      number1: 0,
      number2: 0,
      number3: 0,
      number4: 0,
      date1: null,
      date2: null,
      date3: null,
      date4: null,
    })
      .then((res) => setDivisionList(res || []))
      .catch(console.error);
  }, [loginId, companyCode]);

  // ── On division change: reset selections and fetch lists ──────────────────
  useEffect(() => {
    if (!division) {
      setAccountItems([]);
      setGroupItems([]);
      setFetchedTabs(new Set());
      setValues((prev) => ({
        ...prev,
        acCodes: ["All"],
        l4Codes: ["All"],
      }));
      return;
    }
    setFetchedTabs(new Set());
    setValues((prev) => ({
      ...prev,
      acCodes: ["All"],
      l4Codes: ["All"],
    }));
    fetchAccounts(division);
    fetchGroups(division);
  }, [division]);

  const fetchAccounts = async (div: string) => {
    try {
      setOptionsLoading(true);
      const res = await getDynamicLookupaccount({
        parameter: "Account_Report_AC",
        code1: companyCode,
        code2: div,
      });
      const unique = Array.from(
        new Map((res || []).map((i: any) => [i.ac_code, i])).values()
      ) as any[];
      setAccountItems(unique);
      setFetchedTabs((p) => new Set(p).add("acCode"));
    } catch (e) {
      console.error(e);
    } finally {
      setOptionsLoading(false);
    }
  };

  const fetchGroups = async (div: string) => {
    try {
      setOptionsLoading(true);
      const res = await getDynamicLookupaccount({
        parameter: "Account_Report_Group",
        code1: companyCode,
        code2: div,
      });
      setGroupItems(res || []);
      setFetchedTabs((p) => new Set(p).add("group"));
    } catch (e) {
      console.error(e);
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
        key: "asOnDate",
        label: "As On",
        type: "date",
        required: true,
        colSpan: 3,
      },
      {
        key: "reportType",
        label: "Option",
        type: "select",
        options: [
          { value: "detail", label: "Detail" },
          { value: "summary", label: "Summary" },
        ],
        required: true,
        colSpan: 3,
      },
      {
        key: "acCodes",
        label: "A/c Code",
        type: "multiselect",
        options: accountOptions,
        loading: optionsLoading && !fetchedTabs.has("acCode"),
        placeholder: "All",
        colSpan: 6,
        disabled: !division,
      },
      {
        key: "l4Codes",
        label: "Group",
        type: "multiselect",
        options: groupOptions,
        loading: optionsLoading && !fetchedTabs.has("group"),
        placeholder: "All",
        colSpan: 6,
        disabled: !division,
      },
    ],
    [
      divisionOptions,
      accountOptions,
      groupOptions,
      division,
      optionsLoading,
      fetchedTabs,
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
      asOnDate: todayISO(),
      reportType: "detail",
      acCodes: ["All"],
      l4Codes: ["All"],
    });
    setReportError(null);
  }, []);

  const buildParams = useCallback(() => {
    const ac = (values.acCodes as string[]) || [];
    const groups = (values.l4Codes as string[]) || [];

    return {
      parameter:
        reportType === "detail"
          ? "Account_Report_Outstanding_Detail"
          : "Account_Report_Outstanding_Summary",
      loginid: loginId,
      code1: companyCode,
      code2: division,
      code3: ac.length && !ac.includes("All") ? ac.join(",") : "All",
      code4: groups.length && !groups.includes("All") ? groups.join(",") : "All",
      code5: "OMR",
      code6: formatDateOracle(values.asOnDate),
      code20: "RAWSQL",
    };
  }, [values, division, reportType, loginId, companyCode]);

  const reportTitle = useMemo(
    () =>
      reportType === "detail"
        ? "Outstanding Statement – Detail"
        : "Outstanding Statement – Summary",
    [reportType]
  );

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
      const params = buildParams();
      console.log("Report params------:", params);

      let html: string;
      if (reportType === "detail") {
        html = await openOutstandingStatementDetailReport(params);
      } else {
        html = await openOutstandingStatementSummaryReport(params);
      }

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
      const params = buildParams();
      if (reportType === "detail") {
        await exportOutstandingDetailExcel(params);
      } else {
        await exportOutstandingSummaryExcel(params);
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
        title="Outstanding Statement"
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
};

export default OutstandingStatementPage;