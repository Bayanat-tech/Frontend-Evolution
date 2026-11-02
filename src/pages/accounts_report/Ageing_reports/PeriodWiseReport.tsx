"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";


import { getDynamicLookup, getDynamicLookupaccount } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import {
  exportDueDetailExcel,
  exportDueSummaryExcel,
  exportInvDetailExcel,
  exportInvSummaryExcel,
  exportOutstandingListExcel,
  openDuedatewiseDetailReport,
  openDuedatewiseSummaryReport,
  openInvdatewiseDetailReport,
  openInvdatewiseSummaryReport,
  openOutstandingListReport,
} from "../../../api/transactions";
import { NewReportDialog, NewReportPage, ReportFieldConfig, ReportOption } from "../../../components/new_report_format";

const DEFAULT_AGES = [30, 60, 90, 120, 180, 365];
const today = new Date().toISOString().split("T")[0];

const formatDateOracle = (date: string) => {
  if (!date) return "";
  const d = new Date(date);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
};

const PeriodWisePage: React.FC = () => {
  const { user } = useAuth();

  // ── Filter values ─────────────────────────────────────────────────────────
  const [values, setValues] = useState<Record<string, any>>({
    division: "",
    asOnDate: today,
    dateType: "inv",
    option: "detail",
    outstandingList: false,
    salesmanWise: false,
    acCodes: ["All"],
    l4Codes: ["All"],
    salesmanCodes: ["All"],
    age1: DEFAULT_AGES[0],
    age2: DEFAULT_AGES[1],
    age3: DEFAULT_AGES[2],
    age4: DEFAULT_AGES[3],
    age5: DEFAULT_AGES[4],
    age6: DEFAULT_AGES[5],
  });

  // ── Lookup data ───────────────────────────────────────────────────────────
  const [divisionList, setDivisionList] = useState<any[]>([]);
  const [accountItems, setAccountItems] = useState<any[]>([]);
  const [groupItems, setGroupItems] = useState<any[]>([]);
  const [salesmanItems, setSalesmanItems] = useState<any[]>([]);
  const [fetchedTabs, setFetchedTabs] = useState<Set<string>>(new Set());
  const [optionsLoading, setOptionsLoading] = useState(false);

  // ── Report dialog ─────────────────────────────────────────────────────────
  const [reportOpen, setReportOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const division = values.division as string;
  const outstandingList = Boolean(values.outstandingList);
  const salesmanWise = Boolean(values.salesmanWise);

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

  // ── Reset lists when division changes ─────────────────────────────────────
  useEffect(() => {
    if (!division) {
      setAccountItems([]);
      setGroupItems([]);
      setSalesmanItems([]);
      setFetchedTabs(new Set());
      return;
    }
    setAccountItems([]);
    setGroupItems([]);
    setSalesmanItems([]);
    setFetchedTabs(new Set());
    setValues((prev) => ({
      ...prev,
      acCodes: ["All"],
      l4Codes: ["All"],
      salesmanCodes: ["All"],
    }));
    // Pre-fetch accounts
    fetchAccounts(division);
  }, [division]);

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
        code1: user?.company_code || "",
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

  const fetchSalesman = async (div: string) => {
    if (fetchedTabs.has("salesman")) return;
    try {
      setOptionsLoading(true);
      const response = await getDynamicLookupaccount({
        parameter: "Account_Report_Salesman",
        code1: user?.company_code || "",
        code2: div,
      });
      setSalesmanItems(response || []);
      setFetchedTabs((prev) => new Set(prev).add("salesman"));
    } catch (error) {
      console.error("Salesman fetch error:", error);
    } finally {
      setOptionsLoading(false);
    }
  };

  // Lazy-load group/salesman options when those multiselects are first needed
  useEffect(() => {
    if (division && !fetchedTabs.has("group")) fetchGroups(division);
  }, [division, values.l4Codes]);

  useEffect(() => {
    if (division && !fetchedTabs.has("salesman")) fetchSalesman(division);
  }, [division, values.salesmanCodes]);

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

  const salesmanOptions: ReportOption[] = useMemo(
    () =>
      salesmanItems.map((s: any) => ({
        value: String(s.salesman_code),
        label: `${s.salesman_code} - ${s.salesman_name}`,
        code: String(s.salesman_code),
      })),
    [salesmanItems]
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
        key: "asOnDate",
        label: "As on Date",
        type: "date",
        required: true,
        colSpan: 3,
      },
      {
        key: "dateType",
        label: "Date Type",
        type: "select",
        options: [
          { value: "inv", label: "INV Date wise" },
          { value: "due", label: "Due Date wise" },
        ],
        disabled: outstandingList || salesmanWise,
        colSpan: 3,
      },
      {
        key: "option",
        label: "Option",
        type: "select",
        options: [
          { value: "summary", label: "Summary" },
          { value: "detail", label: "Detail" },
        ],
        disabled: outstandingList,
        colSpan: 3,
      },
      {
        key: "acCodes",
        label: "A/c Code",
        type: "multiselect",
        options: accountOptions,
        loading: optionsLoading && !fetchedTabs.has("acCode"),
        placeholder: "All",
        colSpan: 4,
        disabled: !division,
      },
      {
        key: "l4Codes",
        label: "Group",
        type: "multiselect",
        options: groupOptions,
        loading: optionsLoading && !fetchedTabs.has("group"),
        placeholder: "All",
        colSpan: 4,
        disabled: !division,
      },
      {
        key: "salesmanCodes",
        label: "Salesman",
        type: "multiselect",
        options: salesmanOptions,
        loading: optionsLoading && !fetchedTabs.has("salesman"),
        placeholder: "All",
        colSpan: 4,
        disabled: !division,
      },
    ],
    [
      divisionOptions,
      accountOptions,
      groupOptions,
      salesmanOptions,
      outstandingList,
      salesmanWise,
      division,
      optionsLoading,
      fetchedTabs,
    ]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleChange = useCallback((key: string, value: any) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };

      // Mutual exclusion: outstanding list ↔ salesman wise
      if (key === "outstandingList" && value) {
        next.salesmanWise = false;
      }
      if (key === "salesmanWise" && value) {
        next.outstandingList = false;
        next.dateType = "inv";
      }
      return next;
    });
    setReportError(null);
  }, []);

  const handleClearAll = useCallback(() => {
    setValues({
      division: "",
      asOnDate: today,
      dateType: "inv",
      option: "detail",
      outstandingList: false,
      salesmanWise: false,
      acCodes: ["All"],
      l4Codes: ["All"],
      salesmanCodes: ["All"],
      age1: DEFAULT_AGES[0],
      age2: DEFAULT_AGES[1],
      age3: DEFAULT_AGES[2],
      age4: DEFAULT_AGES[3],
      age5: DEFAULT_AGES[4],
      age6: DEFAULT_AGES[5],
    });
    setReportError(null);
  }, []);

  const buildParams = useCallback(() => {
    const ac = values.acCodes as string[];
    const groups = values.l4Codes as string[];
    const sales = values.salesmanCodes as string[];

    return {
      parameter: outstandingList
        ? "Account_Report_VW_PERIODWISE_OUTSTD_LIST"
        : values.dateType === "due" && values.option === "summary"
          ? "Account_Report_VW_PERIODWISE_DUEDATE_SUMMARY"
          : values.dateType === "due" && values.option === "detail"
            ? "Account_Report_VW_PERIODWISE_DUEDATE_DETAIL"
            : values.option === "summary"
              ? "Account_Report_VW_PERIODWISE_INV_SUMMARY"
              : "Account_Report_VW_PERIODWISE_INV_DETAIL",
      loginid: user?.loginid || user?.username || "ADMIN",
      code1: user?.company_code || "",
      code2: division,
      code3: ac.length && !ac.includes("All") ? ac.join(",") : "All",
      code4: groups.length && !groups.includes("All") ? groups.join(",") : "All",
      code5: sales.length && !sales.includes("All") ? sales.join(",") : "All",
      code6: formatDateOracle(values.asOnDate),
      code7: values.dateType,
      code8: values.option,
      code9: String(values.age1),
      code10: String(values.age2),
      code11: String(values.age3),
      code12: String(values.age4),
      code13: String(values.age5),
      code14: String(values.age6),
      code15: String(outstandingList),
      code16: String(salesmanWise),
    };
  }, [values, division, outstandingList, salesmanWise, user]);

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
      let html: string;

      if (outstandingList) {
        html = await openOutstandingListReport(params);
      } else if (values.dateType === "due" && values.option === "summary") {
        html = await openDuedatewiseSummaryReport(params);
      } else if (values.dateType === "due" && values.option === "detail") {
        html = await openDuedatewiseDetailReport(params);
      } else if (values.option === "summary") {
        html = await openInvdatewiseSummaryReport(params);
      } else {
        html = await openInvdatewiseDetailReport(params);
      }

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
      const params = buildParams();
      if (outstandingList) {
        await exportOutstandingListExcel(params);
      } else if (values.dateType === "due" && values.option === "summary") {
        await exportDueSummaryExcel(params);
      } else if (values.dateType === "due" && values.option === "detail") {
        await exportDueDetailExcel(params);
      } else if (values.option === "summary") {
        await exportInvSummaryExcel(params);
      } else {
        await exportInvDetailExcel(params);
      }
    } catch (err: any) {
      setReportError(err.message || "Failed to export Excel.");
    } finally {
      setGeneratingExcel(false);
    }
  };

  const reportTitle = useMemo(() => {
    if (outstandingList) return "Period Wise – Outstanding List";
    const dateLabel = values.dateType === "due" ? "Due Date" : "INV Date";
    const optLabel = values.option === "summary" ? "Summary" : "Detail";
    return `Period Wise – ${dateLabel} ${optLabel}`;
  }, [outstandingList, values.dateType, values.option]);

  // ── Extra filters (checkboxes + age periods) rendered via children ────────
  const extraFilters = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, 1fr)",
        columnGap: 14,
        rowGap: 16,
        marginTop: 8,
      }}
    >
      {/* Checkboxes */}
      <div style={{ gridColumn: "span 4" }}>
        <div
          style={{
            fontSize: "var(--app-label-font-size, 11px)",
            fontWeight: 500,
            color: "var(--muted, #6b7a8d)",
            marginBottom: 8,
          }}
        >
          Options
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              cursor: salesmanWise ? "not-allowed" : "pointer",
              opacity: salesmanWise ? 0.45 : 1,
              color: "var(--text, #1a1a2e)",
            }}
          >
            <input
              type="checkbox"
              checked={outstandingList}
              disabled={salesmanWise || generating}
              onChange={(e) => handleChange("outstandingList", e.target.checked)}
              style={{ accentColor: "var(--primary, #00378c)" }}
            />
            Outstanding list
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              cursor: outstandingList ? "not-allowed" : "pointer",
              opacity: outstandingList ? 0.45 : 1,
              color: "var(--text, #1a1a2e)",
            }}
          >
            <input
              type="checkbox"
              checked={salesmanWise}
              disabled={outstandingList || generating}
              onChange={(e) => handleChange("salesmanWise", e.target.checked)}
              style={{ accentColor: "var(--primary, #00378c)" }}
            />
            Salesman wise
          </label>
        </div>
      </div>

      {/* Age periods */}
      <div style={{ gridColumn: "span 8" }}>
        <div
          style={{
            fontSize: "var(--app-label-font-size, 11px)",
            fontWeight: 500,
            color: "var(--muted, #6b7a8d)",
            marginBottom: 8,
          }}
        >
          Age periods
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "10px 16px",
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--muted, #6b7a8d)", minWidth: 48 }}>
                Age {n}:
              </span>
              <input
                type="number"
                min={0}
                value={values[`age${n}`] ?? 0}
                disabled={generating}
                onChange={(e) => {
                  const num = parseInt(e.target.value, 10);
                  handleChange(`age${n}`, isNaN(num) ? 0 : num);
                }}
                style={{
                  width: 72,
                  height: "var(--app-control-height, 36px)",
                  padding: "0 10px",
                  fontSize: "var(--app-control-font-size, 12px)",
                  border: "1px solid var(--border, #cbd5e1)",
                  borderRadius: 6,
                  textAlign: "right",
                  boxSizing: "border-box",
                  color: "var(--text, #1a1a2e)",
                  background: "var(--panel, #ffffff)",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <NewReportPage
        title="Period Wise Report"
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
      >
        {extraFilters}
      </NewReportPage>

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

export default PeriodWisePage;