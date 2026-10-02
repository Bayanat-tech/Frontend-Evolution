import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookup, getDynamicLookupaccount } from "../../../api/lookups";
import {
  exportAcStatementExcel,
  openAcStatementReport,
} from "../../../api/transactions";
import {
  NewReportDialog,
  NewReportPage,
  ReportFieldConfig,
  ReportOption,
} from "../../../components/new_report_format";

const today = new Date().toISOString().split("T")[0];
const yearStart = `${new Date().getFullYear()}-01-01`;

const formatDateOracle = (date: string) => {
  if (!date) return "";
  const d = new Date(date);
  const months = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
};

const codesOrAll = (arr: string[] | undefined): string => {
  if (!arr || arr.length === 0 || arr.includes("All")) return "All";
  return arr.join(",");
};

const AC_StatementPage: React.FC = () => {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || user?.username || "ADMIN";

  // ── Filter values ─────────────────────────────────────────────────────────
  const [values, setValues] = useState<Record<string, any>>({
    division: "",
    dateFrom: yearStart,
    dateTo: today,
    activeTab: "acCode", // "acCode" | "group"
    acCodes: ["All"],
    l4Codes: ["All"],
  });

  // ── Lookup data ───────────────────────────────────────────────────────────
  const [divisionList, setDivisionList] = useState<any[]>([]);
  const [accountItems, setAccountItems] = useState<any[]>([]);
  const [groupItems, setGroupItems] = useState<any[]>([]);
  const [fetchedTabs, setFetchedTabs] = useState<Set<string>>(new Set());
  const [optionsLoading, setOptionsLoading] = useState(false);

  // ── Report dialog ─────────────────────────────────────────────────────────
  const [reportOpen, setReportOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const division = values.division as string;
  const activeTab = values.activeTab as "acCode" | "group";

  // ── Fetch divisions on mount ──────────────────────────────────────────────
  useEffect(() => {
    const fetchDivisions = async () => {
      try {
        const response = await getDynamicLookup({
          parameter: "Account_division",
          code1: companyCode,
          loginid: loginId,
        });
        setDivisionList(response || []);
      } catch (error) {
        console.error("Division fetch error:", error);
      }
    };
    fetchDivisions();
  }, [companyCode, loginId]);

  // ── Reset lists when division changes ─────────────────────────────────────
  useEffect(() => {
    if (!division) {
      setAccountItems([]);
      setGroupItems([]);
      setFetchedTabs(new Set());
      return;
    }
    setAccountItems([]);
    setGroupItems([]);
    setFetchedTabs(new Set());
    setValues((prev) => ({
      ...prev,
      acCodes: ["All"],
      l4Codes: ["All"],
    }));
    // Pre-fetch accounts (default tab)
    fetchAccounts(division);
  }, [division]);

  const fetchAccounts = async (div: string) => {
    try {
      setOptionsLoading(true);
      const response = await getDynamicLookupaccount({
        parameter: "Account_Report_AC",
        code1: companyCode,
        code2: div,
      });
      const uniqueData = Array.from(
        new Map((response || []).map((item: any) => [item.ac_code, item])).values()
      );
      setAccountItems(uniqueData as any[]);
      setFetchedTabs((prev) => new Set(prev).add("acCode"));
    } catch (error) {
      console.error("Account fetch error:", error);
    } finally {
      setOptionsLoading(false);
    }
  };

  const fetchGroups = async (div: string) => {
    if (fetchedTabs.has("group")) return;
    try {
      setOptionsLoading(true);
      const response = await getDynamicLookupaccount({
        parameter: "Account_Report_Group",
        code1: companyCode,
        code2: div,
      });
      setGroupItems(response || []);
      setFetchedTabs((prev) => new Set(prev).add("group"));
    } catch (error) {
      console.error("Group fetch error:", error);
    } finally {
      setOptionsLoading(false);
    }
  };

  // Lazy-load groups when the Group multiselect is first used / tab switches
  useEffect(() => {
    if (division && activeTab === "group" && !fetchedTabs.has("group")) {
      fetchGroups(division);
    }
  }, [division, activeTab, fetchedTabs]);

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

  // ── Field config for NewReportPage ────────────────────────────────────────
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
        toKey: "dateTo",
        label: "Date Range",
        type: "daterange",
        required: true,
        colSpan: 6,
      },
      {
        key: "activeTab",
        label: "Filter By",
        type: "select",
        options: [
          { value: "acCode", label: "A/c Code" },
          { value: "group", label: "Group" },
        ],
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
        disabled: !division || activeTab !== "acCode",
      },
      {
        key: "l4Codes",
        label: "Group",
        type: "multiselect",
        options: groupOptions,
        loading: optionsLoading && !fetchedTabs.has("group"),
        placeholder: "All",
        colSpan: 6,
        disabled: !division || activeTab !== "group",
      },
    ],
    [
      divisionOptions,
      accountOptions,
      groupOptions,
      division,
      activeTab,
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
      dateFrom: yearStart,
      dateTo: today,
      activeTab: "acCode",
      acCodes: ["All"],
      l4Codes: ["All"],
    });
    setReportError(null);
  }, []);

  const buildParams = useCallback(() => {
    return {
      parameter: "Account_Report_AC_StatementReport",
      loginid: loginId,
      code1: companyCode,
      code2: division,
      code3: activeTab === "acCode" ? codesOrAll(values.acCodes) : "All",
      code4: activeTab === "group" ? codesOrAll(values.l4Codes) : "All",
      code5: formatDateOracle(values.dateFrom),
      code6: formatDateOracle(values.dateTo),
      code20: "RAWSQL",
    };
  }, [values, division, activeTab, companyCode, loginId]);

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
      // openAcStatementReport must return the report HTML string
      // (same pattern as openInvdatewiseDetailReport etc. in PeriodWisePage)
      const html = await openAcStatementReport(params);
      setReportHtml(typeof html === "string" ? html : String(html ?? ""));
    } catch (err: any) {
      setReportError("Failed to generate report. Check console.");
      console.error(err);
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
      await exportAcStatementExcel(buildParams());
    } catch (err: any) {
      setReportError(err?.message || "Failed to export Excel.");
      console.error(err);
    } finally {
      setGeneratingExcel(false);
    }
  };

  return (
    <>
      <NewReportPage
        title="AC Statement"
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
        title="AC Statement"
        htmlContent={reportHtml}
        loading={generating}
        error={reportError}
        onExportExcel={handleExportExcel}
        exportingExcel={generatingExcel}
      />
    </>
  );
};

export default AC_StatementPage;