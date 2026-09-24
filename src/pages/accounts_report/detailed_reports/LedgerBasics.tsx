"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
// ⚠️ Adjust these paths to match your project (this was the cause of the previous error)


import { getDynamicLookup, getDynamicLookupaccount } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import {
  openChequeDateWiseReport,
  openAccountPayeeWiseReport,
  exportAccountPayeeWiseExcel,
  exportChequeDateWiseExcel,
  openLedgerWithDetailsReport,
  openLedgerOppositeEntryReport,
  exportLedgerWithDetailsExcel,
} from "../../../api/transactions";
import { NewReportDialog, NewReportPage, ReportFieldConfig, ReportOption } from "../../../components/new_report_format";

type ReportOptionKey =
  | "chequeDateWise"
  | "ledgerWithDetails"
  | "ledgerWithOppositeEntry"
  | "acPayeeWise";

const REPORT_OPTIONS: { key: ReportOptionKey; label: string }[] = [
  { key: "chequeDateWise", label: "Cheque Date Wise" },
  { key: "ledgerWithDetails", label: "Ledger With Details" },
  { key: "ledgerWithOppositeEntry", label: "Ledger With Opposite Entry" },
  { key: "acPayeeWise", label: "A/c Payee Wise" },
];

const formatDate = (date: string) => {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export default function FinanceReportFilter() {
  const { user } = useAuth();

  // ── Filter values (driven by NewReportPage) ───────────────────────────────
  const [values, setValues] = useState<Record<string, any>>({
    division: "",
    dateFrom: "2026-05-01",
    dateTo: new Date().toISOString().split("T")[0],
    amountFrom: "",
    amountTo: "",
    acPayee: ["All"],
    remarks: "",
    reportType: "chequeDateWise" as ReportOptionKey,
    acCodes: ["All"],
    l4Codes: ["All"],
  });

  // ── Lookup data ───────────────────────────────────────────────────────────
  const [divisionList, setDivisionList] = useState<any[]>([]);
  const [accountItems, setAccountItems] = useState<any[]>([]);
  const [groupItems, setGroupItems] = useState<any[]>([]);
  const [acPayeeItems, setAcPayeeItems] = useState<any[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // ── Dialog / report state ─────────────────────────────────────────────────
  const [reportOpen, setReportOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const division = values.division as string;
  const reportType = (values.reportType || "chequeDateWise") as ReportOptionKey;

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

  // ── Load A/c payee list once ──────────────────────────────────────────────
  useEffect(() => {
    const fetchPayees = async () => {
      try {
        const response = await getDynamicLookupaccount({
          parameter: "Account_Report_AC_PAYEE",
          code1: user?.company_code || "",
          loginid: user?.loginid || user?.username || "ADMIN",
        });
        setAcPayeeItems(response || []);
      } catch (error) {
        console.error("A/c payee fetch error:", error);
      }
    };
    fetchPayees();
  }, [user?.company_code, user?.loginid, user?.username]);

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

  // ── Options for NewReportPage fields ──────────────────────────────────────
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

  const acPayeeOptions: ReportOption[] = useMemo(
    () =>
      acPayeeItems.map((p: any) => ({
        value: String(p.ac_payee ?? p.ac_ref ?? ""),
        label: `${p.ac_payee ?? ""}${p.ac_ref ? ` - ${p.ac_ref}` : ""}`,
        code: String(p.ac_payee ?? ""),
      })),
    [acPayeeItems]
  );

  const reportTypeOptions: ReportOption[] = useMemo(
    () => REPORT_OPTIONS.map((o) => ({ value: o.key, label: o.label })),
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
        key: "amountFrom",
        label: "Amount From",
        type: "text",
        placeholder: "0",
        colSpan: 3,
      },
      {
        key: "amountTo",
        label: "Amount To",
        type: "text",
        placeholder: "0",
        colSpan: 3,
      },
      {
        key: "acPayee",
        label: "A/c Payee",
        type: "multiselect",
        options: acPayeeOptions,
        placeholder: "All",
        colSpan: 3,
      },
      {
        key: "remarks",
        label: "Remarks",
        type: "text",
        placeholder: "Optional remarks",
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
      acPayeeOptions,
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
      amountFrom: "",
      amountTo: "",
      acPayee: ["All"],
      remarks: "",
      reportType: "chequeDateWise",
      acCodes: ["All"],
      l4Codes: ["All"],
    });
    setReportError(null);
  }, []);

  const buildParams = useCallback(() => {
    const ac = (values.acCodes as string[]) || [];
    const groups = (values.l4Codes as string[]) || [];
    const payees = (values.acPayee as string[]) || [];

    return {
      loginid: user?.loginid || user?.username || "ADMIN",
      code1: user?.company_code || "",
      code2: division || "",
      code3: ac.length && !ac.includes("All") ? ac.join(",") : "All",
      code4: groups.length && !groups.includes("All") ? groups.join(",") : "All",
      code5: String(formatDate(values.dateFrom)),
      code6: String(formatDate(values.dateTo)),
      code7: values.amountFrom || "",
      code8: values.amountTo || "",
      code9: payees.length && !payees.includes("All") ? payees.join(",") : "",
      code10: String(formatDate(values.dateFrom)),
      code20: reportType === "ledgerWithDetails" || reportType === "chequeDateWise" ? "DATE_WISE" : "RAWSQL",
      parameter: "Account_Report_Transaction",
    };
  }, [values, division, reportType, user]);

  const reportTitle = useMemo(() => {
    const found = REPORT_OPTIONS.find((o) => o.key === reportType);
    return found ? found.label : "Finance Report";
  }, [reportType]);

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

      switch (reportType) {
        case "ledgerWithDetails":
          html = await openLedgerWithDetailsReport({ ...params, code20: "DATE_WISE" });
          break;
        case "ledgerWithOppositeEntry":
          html = await openLedgerOppositeEntryReport(params);
          break;
        case "acPayeeWise":
          html = await openAccountPayeeWiseReport(params);
          break;
        case "chequeDateWise":
        default:
          html = await openChequeDateWiseReport({ ...params, code20: "DATE_WISE" });
          break;
      }

      setReportHtml(typeof html === "string" ? html : String(html ?? ""));
    } catch (err: any) {
      console.error(err);
      setReportError(err?.message || "Failed to generate report. Check console.");
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
      switch (reportType) {
        case "ledgerWithDetails":
        case "ledgerWithOppositeEntry":
          await exportLedgerWithDetailsExcel(params);
          break;
        case "acPayeeWise":
          await exportAccountPayeeWiseExcel(params);
          break;
        case "chequeDateWise":
        default:
          await exportChequeDateWiseExcel(params);
          break;
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
        title="Finance Report"
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