import type { ReactNode } from "react";
import type { MenuNode } from "../types/auth";
import { AccountWiseBudgetPage } from "../pages/finance/AccountWiseBudgetPage";
import { AccountTreePage } from "../pages/finance/AccountTreePage";
import { AllocatedInvoicePage } from "../pages/finance/AllocatedInvoicePage";
import { AssetDepreciationPage } from "../pages/finance/AssetDepreciationPage";
import { AssetRegisterPage } from "../pages/finance/AssetRegisterPage";
import { AssetSaleRegisterPage } from "../pages/finance/AssetSaleRegisterPage";
import { AssetTransferPage } from "../pages/finance/AssetTransferPage";
import { BankCodeSettingsPage } from "../pages/finance/BankCodeSettingsPage";
import { BankMasterPage } from "../pages/finance/BankMasterPage";
import { BankReconciliationPage } from "../pages/finance/BankReconciliationPage";
import { BudgetVersionPage } from "../pages/finance/BudgetVersionPage";
import { ChequeDepositSlipPage } from "../pages/finance/ChequeDepositSlipPage";
import { CommercialDocumentPage } from "../pages/finance/CommercialDocumentPage";
import { DocumentSetupPage } from "../pages/finance/DocumentSetupPage";
import { ExpenseTypePage } from "../pages/finance/ExpenseTypePage";
import { FinanceUtilityMasterPage, financeUtilityConfigs } from "../pages/finance/FinanceUtilityMasterPage";
import { JournalVoucherPage } from "../pages/finance/JournalVoucherPage";
import { PaymentDocumentPage } from "../pages/finance/PaymentDocumentPage";
import { PLSetupPage } from "../pages/finance/PLSetupPage";
import { PrepaidRegisterPage } from "../pages/finance/PrepaidRegisterPage";
import { WmsCountryPage } from "../pages/wms/WmsCountryPage";
import { WmsInboundPage } from "../pages/wms/WmsInboundPage";
import { WmsSimpleMasterPage } from "../pages/wms/WmsSimpleMasterPage";
import { wmsSimpleMasterConfigs } from "../pages/wms/wmsMasterConfigs";
import { SecurityAssignmentPage, securityAssignmentConfigs } from "../pages/security/SecurityAssignmentPage";
import { SecurityMasterPage, securityMasterConfigs } from "../pages/security/SecurityMasterPage";
import { SecurityOperationAccessPage } from "../pages/security/SecurityOperationAccessPage";
import { PamsBulkAppraisalPage, PamsDashboardPage, PamsDepartmentAssignmentPage, PamsMasterPage, PamsReportPage, pamsMasterConfigs } from "../pages/pams/PamsPages";
import { KpiItemPage } from "../pages/pams/KpiActivityPage";
import MyTaskPage from "../pages/pams/MyTaskpage";
import AppraisalViewTabsPage from "../pages/pams/AppraisalViewtabspage";
import { KpiGroupPage } from "../pages/pams/KpiGroupPage";
import AppraisalSummaryReportDesign from "../pages/pams/AppraisalSummaryReportDesign";
import AppraisalDivisionSummaryReport from "../pages/pams/AppraisalDivisionSummaryReport";


type WorkspaceRouteContext = {
  pathname: string;
  activeApp?: MenuNode;
};

type WorkspaceRoute = {
  name: string;
  match: (context: WorkspaceRouteContext) => boolean;
  element: (context: WorkspaceRouteContext) => ReactNode;
};

export function resolveWorkspaceRoute(context: WorkspaceRouteContext) {
  const route = workspaceRoutes.find((item) => item.match(context));
  return route?.element(context) || null;
}

export const workspaceRoutes: WorkspaceRoute[] = [
  {
    name: "Finance Account Tree",
    match: ({ pathname }) => isAccountTreeRoute(pathname),
    element: () => <AccountTreePage />,
  },
  {
    name: "Finance Bank Master",
    match: ({ pathname }) => isBankMasterRoute(pathname),
    element: () => <BankMasterPage />,
  },
  {
    name: "Finance Bank Code Settings",
    match: ({ pathname }) => isBankCodeSettingsRoute(pathname),
    element: () => <BankCodeSettingsPage />,
  },
  {
    name: "Finance P&L Setup",
    match: ({ pathname }) => isPLSetupRoute(pathname),
    element: () => <PLSetupPage />,
  },
  {
    name: "Finance Expense Type",
    match: ({ pathname }) => isExpenseTypeRoute(pathname),
    element: () => <ExpenseTypePage />,
  },
  {
    name: "Finance Document Setup",
    match: ({ pathname }) => isDocumentSetupRoute(pathname),
    element: () => <DocumentSetupPage />,
  },
  {
    name: "Finance Budget Version",
    match: ({ pathname }) => isBudgetVersionRoute(pathname),
    element: () => <BudgetVersionPage />,
  },
  {
    name: "Finance Account Wise Budget",
    match: ({ pathname }) => isAccountWiseBudgetRoute(pathname),
    element: () => <AccountWiseBudgetPage />,
  },
  {
    name: "Finance Commercial Documents",
    match: ({ pathname }) => Boolean(getCommercialDocType(pathname)),
    element: ({ pathname }) => <CommercialDocumentPage docType={getCommercialDocType(pathname)!} />,
  },
  {
    name: "Finance Journal Voucher",
    match: ({ pathname }) => isJournalVoucherRoute(pathname),
    element: () => <JournalVoucherPage />,
  },
  {
    name: "Finance Bank Reconciliation",
    match: ({ pathname }) => isBankReconciliationRoute(pathname),
    element: () => <BankReconciliationPage />,
  },
  {
    name: "Finance Payment Documents",
    match: ({ pathname }) => Boolean(getTransactionDocType(pathname)),
    element: ({ pathname }) => <PaymentDocumentPage docType={getTransactionDocType(pathname)!} />,
  },
  {
    name: "Finance Utility Master",
    match: ({ pathname }) => Boolean(getUtilityMasterConfig(pathname)),
    element: ({ pathname }) => <FinanceUtilityMasterPage config={getUtilityMasterConfig(pathname)!} />,
  },
  {
    name: "Finance Prepaid Register",
    match: ({ pathname }) => isPrepaidRegisterRoute(pathname),
    element: () => <PrepaidRegisterPage />,
  },
  {
    name: "Finance Asset Register",
    match: ({ pathname }) => isAssetRegisterRoute(pathname),
    element: () => <AssetRegisterPage />,
  },
  {
    name: "Finance Asset Sale/Disposal",
    match: ({ pathname }) => Boolean(getAssetSaleMode(pathname)),
    element: ({ pathname }) => <AssetSaleRegisterPage mode={getAssetSaleMode(pathname)!} />,
  },
  {
    name: "Finance Asset Transfer",
    match: ({ pathname }) => isAssetTransferRoute(pathname),
    element: () => <AssetTransferPage />,
  },
  {
    name: "Finance Asset Depreciation",
    match: ({ pathname }) => isAssetDepreciationRoute(pathname),
    element: () => <AssetDepreciationPage />,
  },
  {
    name: "Finance Cheque Deposit Slip",
    match: ({ pathname }) => isChequeDepositRoute(pathname),
    element: () => <ChequeDepositSlipPage />,
  },
  {
    name: "Finance Allocated Invoice",
    match: ({ pathname }) => isAllocatedInvoiceRoute(pathname),
    element: () => <AllocatedInvoicePage />,
  },
  {
    name: "WMS Inbound",
    match: ({ pathname }) => isWmsInboundRoute(pathname),
    element: () => <WmsInboundPage />,
  },
  {
    name: "WMS Country Master",
    match: ({ pathname }) => isWmsCountryRoute(pathname),
    element: () => <WmsCountryPage />,
  },
  {
    name: "WMS Simple Master",
    match: ({ pathname }) => Boolean(getWmsSimpleMasterConfig(pathname)),
    element: ({ pathname }) => <WmsSimpleMasterPage config={getWmsSimpleMasterConfig(pathname)!} />,
  },
  {
    name: "Security Operation Access",
    match: (context) => Boolean(getSecurityOperationMode(context)),
    element: (context) => <SecurityOperationAccessPage mode={getSecurityOperationMode(context)!} />,
  },
  {
    name: "Security Assignment",
    match: (context) => Boolean(getSecurityAssignmentConfig(context)),
    element: (context) => <SecurityAssignmentPage config={getSecurityAssignmentConfig(context)!} />,
  },
  {
    name: "Security Master",
    match: (context) => Boolean(getSecurityMasterConfig(context)),
    element: (context) => <SecurityMasterPage config={getSecurityMasterConfig(context)!} />,
  },
  {
    name: "PAMS Dashboard",
    match: ({ pathname }) => isPamsRoute(pathname) && pathname.toLowerCase().includes("/dashboard"),
    element: () => <PamsDashboardPage />,
  },
  {
    name: "PAMS Bulk Appraisal",
    match: ({ pathname }) => isPamsRoute(pathname) && isPamsBulkAppraisalRoute(pathname),
    element: () => <PamsBulkAppraisalPage />,
  },
  // ── PAMS My Task Routes (Specific tabs first, then default) ──
  {
    name: "PAMS My Task Pending",
    match: ({ pathname }) => {
      const normalized = pathname.toLowerCase();
      return isPamsRoute(pathname) && 
        (normalized.includes("/my_task/pending") || 
         normalized.includes("/my-task/pending"));
    },
    element: () => <MyTaskPage initialTab={0} />,
  },
  {
    name: "PAMS My Task In Progress",
    match: ({ pathname }) => {
      const normalized = pathname.toLowerCase();
      return isPamsRoute(pathname) && 
        (normalized.includes("/my_task/in_progress") || 
         normalized.includes("/my-task/in-progress"));
    },
    element: () => <MyTaskPage initialTab={1} />,
  },
  {
    name: "PAMS My Task Rejected",
    match: ({ pathname }) => {
      const normalized = pathname.toLowerCase();
      return isPamsRoute(pathname) && 
        (normalized.includes("/my_task/rejected") || 
         normalized.includes("/my-task/rejected"));
    },
    element: () => <MyTaskPage initialTab={2} />,
  },
  {
    name: "PAMS My Task Sent Back",
    match: ({ pathname }) => {
      const normalized = pathname.toLowerCase();
      return isPamsRoute(pathname) && 
        (normalized.includes("/my_task/sent_back") || 
         normalized.includes("/my-task/sent-back"));
    },
    element: () => <MyTaskPage initialTab={3} />,
  },
  {
    name: "PAMS My Task Closed",
    match: ({ pathname }) => {
      const normalized = pathname.toLowerCase();
      return isPamsRoute(pathname) && 
        (normalized.includes("/my_task/closed") || 
         normalized.includes("/my-task/closed"));
    },
    element: () => <MyTaskPage initialTab={4} />,
  },
  {
    name: "PAMS My Task",
    match: ({ pathname }) => {
      const normalized = pathname.toLowerCase();
      return isPamsRoute(pathname) && 
        normalized.includes("/my_task") && 
        !normalized.includes("/view/") &&
        !normalized.includes("/edit/") &&
        !normalized.includes("/pending") &&
        !normalized.includes("/in_progress") &&
        !normalized.includes("/rejected") &&
        !normalized.includes("/sent_back") &&
        !normalized.includes("/closed");
    },
    element: () => <MyTaskPage initialTab={0} />,
  },
  // ── PAMS Appraisal View/Edit Routes ──
  {
  name: "PAMS Appraisal Tabs View",
  match: ({ pathname }) => {
    const normalized = pathname.toLowerCase();
    return isPamsRoute(pathname) && 
      (normalized.includes("/appraisal/view/") || 
       normalized.includes("/appraisal/edit/") ||
       normalized.includes("/view/") && normalized.includes("employee_code"));
  },
  element: () => <AppraisalViewTabsPage />,
},
  {
    name: "PAMS Appraisal View",
    match: ({ pathname }) => {
      const normalized = pathname.toLowerCase();
      return isPamsRoute(pathname) && 
        (normalized.includes("/my_task/view/") || 
         normalized.includes("/my-task/view/") ||
         normalized.includes("/view/"));
    },
    element: () => <AppraisalViewTabsPage />,
  },
  // {
  //   name: "PAMS Reports",
  //   match: ({ pathname }) => {
  //     const normalized = pathname.toLowerCase();
  //     return isPamsRoute(pathname) && 
  //       (normalized.includes("appraisal_listing_summary") || 
  //        normalized.includes("appraisal_listing") ||
  //        normalized.includes("/reports"));
  //   },
  //   element: ({ pathname }) => <PamsReportPage type={pathname.toLowerCase().includes("summary") ? "summary" : "listing"} />,
  // },
  {
    name: "PAMS Department Assignment",
    match: ({ pathname }) => {
      const normalized = pathname.toLowerCase();
      return isPamsRoute(pathname) && 
        (normalized.includes("/department_kpi") || 
         normalized.includes("/kpi_assignment") ||
         normalized.includes("/dept-kpi"));
    },
    element: () => <PamsDepartmentAssignmentPage />,
  },
//// reporting pages
  {
  name: "PAMS Appraisal Summary Report",
  match: ({ pathname }) => isPamsRoute(pathname) && isPamsAppraisalSummaryRoute(pathname),
  element: () => <AppraisalSummaryReportDesign required_values={{
    loginid: undefined,
    company_code: undefined,
    period_label: undefined,
  }} />,
},
// reporting pages section mein, AppraisalSummaryReport ke NEECHE add karo:
 {
    name: "PAMS Appraisal Division Summary Report", 
    match: ({ pathname }) => isPamsRoute(pathname) && isPamsAppraisalDivisionSummaryRoute(pathname),
    element: () => <AppraisalDivisionSummaryReport />,
  },
  {
    name: "PAMS KPI Group",
    match: ({ pathname }) => isPamsRoute(pathname) && isPamsKpiGroupRoute(pathname),
    element: () => <KpiGroupPage />,
  },
  // ── PAMS KPI Item — must be BEFORE PAMS Master so kpi_item route match ho pehle ──
  {
    name: "PAMS KPI Item",
    match: ({ pathname }) => isPamsRoute(pathname) && isPamsKpiItemRoute(pathname),
    element: () => <KpiItemPage />,
  },
  {
    name: "PAMS Master",
    match: (context) => Boolean(getPamsMasterConfig(context)),
    element: (context) => <PamsMasterPage config={getPamsMasterConfig(context)!} />,
  },
];

function isBankMasterRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return (
    normalized.includes("/finance/accounts/masters/bank") &&
    !normalized.includes("bank_code") &&
    !normalized.includes("bank-code")
  );
}

function isAccountWiseBudgetRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return (
    normalized.includes("/finance/accounts/masters/budget_a/c_wise") ||
    normalized.includes("/finance/accounts/masters/budget_ac_wise") ||
    normalized.includes("/finance/accounts/masters/account-wise-budget")
  );
}

function isBudgetVersionRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/finance/accounts/masters/budget_version") || normalized.includes("/finance/accounts/masters/budget-version");
}

function isDocumentSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return (
    normalized.includes("/finance/accounts/masters/documentsetup") ||
    normalized.includes("/finance/accounts/masters/document_setup") ||
    normalized.includes("/finance/accounts/masters/document-setup") ||
    normalized.includes("/finance/utilities/document_setup") ||
    normalized.includes("/finance/utilities/document-setup") ||
    normalized.includes("/finance/utilities/documentsetup")
  );
}

function isExpenseTypeRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return (
    normalized.includes("/finance/accounts/masters/expensetype") ||
    normalized.includes("/finance/accounts/masters/expense_type") ||
    normalized.includes("/finance/accounts/masters/expense-type")
  );
}

function isPLSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return (
    normalized.includes("/finance/accounts/masters/pl_setup") ||
    normalized.includes("/finance/accounts/masters/pl-setup") ||
    normalized.includes("/finance/accounts/masters/p-l_setup") ||
    normalized.includes("/finance/utilities/pl_setup") ||
    normalized.includes("/finance/utilities/pl-setup") ||
    normalized.includes("/finance/utilities/p&l_setup") ||
    normalized.includes("/finance/utilities/p%26l_setup") ||
    normalized.includes("/finance/utilities/p-l_setup")
  );
}

function isBankCodeSettingsRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return (
    normalized.includes("/finance/accounts/masters/bank_code_setting") ||
    normalized.includes("/finance/accounts/masters/bank-code-setting") ||
    normalized.includes("/finance/accounts/masters/bank_code")
  );
}

function isAccountTreeRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return (
    normalized.includes("/finance/accounts/masters/a-c_tree") ||
    normalized.includes("/finance/accounts/masters/ac_tree") ||
    normalized.includes("/finance/accounts/masters/a/c_tree")
  );
}

function getTransactionDocType(pathname: string) {
  const normalized = pathname.toLowerCase();
  if (normalized.includes("/finance/accounts/transactions/cheque-payment")) return "BP" as const;
  if (normalized.includes("/finance/accounts/transactions/cheque-receipt")) return "BR" as const;
  if (normalized.includes("/finance/accounts/transactions/cash-receipt")) return "CR" as const;
  if (normalized.includes("/finance/accounts/transactions/credit-note")) return "CN" as const;
  if (normalized.includes("/finance/accounts/transactions/debit-note")) return "DN" as const;
  if (normalized.includes("/finance/accounts/transactions/petty_cash_payment") || normalized.includes("/finance/accounts/transactions/petty-cash-payment")) return "CP" as const;
  return null;
}

function getCommercialDocType(pathname: string) {
  const normalized = pathname.toLowerCase();
  if (normalized.includes("/finance/accounts/transactions/lpo")) return "PO" as const;
  if (normalized.includes("/finance/accounts/transactions/purchase")) return "PI" as const;
  if (normalized.includes("/finance/accounts/transactions/sales")) return "SI" as const;
  if (normalized.includes("/finance/accounts/transactions/service-invoice") || normalized.includes("/finance/accounts/transactions/service_invoice")) return "SV" as const;
  return null;
}

function isJournalVoucherRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return (
    normalized.includes("/finance/accounts/transactions/jv") ||
    normalized.includes("/finance/accounts/transactions/provisional") ||
    normalized.includes("/finance/accounts/transactions/journal")
  );
}

function isBankReconciliationRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/finance/accounts/transactions/bank_reconciliation") || normalized.includes("/finance/accounts/transactions/bank-reconciliation");
}

function getUtilityMasterConfig(pathname: string) {
  const normalized = pathname.toLowerCase();
  if (normalized.includes("/finance/a/c_others/assets/asset_group")) return financeUtilityConfigs.assetGroup;
  if (normalized.includes("/finance/a/c_others/assets/asset_subgroup")) return financeUtilityConfigs.assetSubgroup;
  if (normalized.includes("/finance/a/c_others/assets/asset_location")) return financeUtilityConfigs.assetLocation;
  if (normalized.includes("/finance/a/c_others/prepaid/prepaid_group")) return financeUtilityConfigs.prepaidGroup;
  return null;
}

function isPrepaidRegisterRoute(pathname: string) {
  return pathname.toLowerCase().includes("/finance/a/c_others/prepaid/prepaid_register");
}

function isAssetRegisterRoute(pathname: string) {
  return pathname.toLowerCase().includes("/finance/a/c_others/assets/asset_register");
}

function getAssetSaleMode(pathname: string) {
  const normalized = pathname.toLowerCase();
  if (normalized.includes("/finance/a/c_others/assets/asset_disposal")) return "disposal" as const;
  if (normalized.includes("/finance/a/c_others/assets/asset_sales")) return "sale" as const;
  return null;
}

function isAssetTransferRoute(pathname: string) {
  return pathname.toLowerCase().includes("/finance/a/c_others/assets/asset_transfer");
}

function isAssetDepreciationRoute(pathname: string) {
  return pathname.toLowerCase().includes("/finance/a/c_others/assets/asset_depreciation");
}

function isChequeDepositRoute(pathname: string) {
  return pathname.toLowerCase().includes("/finance/accounts/transactions/cheque-deposit-slip");
}

function isAllocatedInvoiceRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/finance/accounts/transactions/allocated_invoice") || normalized.includes("/finance/accounts/transactions/allocated-invoice");
}

function isWmsCountryRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/wms/") && normalized.includes("/country");
}

function isWmsInboundRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/wms/") && normalized.includes("/inbound") && (normalized.includes("/jobs") || normalized.includes("/job") || normalized.includes("/inboundjob"));
}

function getWmsSimpleMasterConfig(pathname: string) {
  const normalized = pathname.toLowerCase();
  if (!normalized.includes("/wms/")) return null;
  const matches = Object.values(wmsSimpleMasterConfigs)
    .flatMap((config) => (config.routeKeys || [config.master]).map((key) => ({ config, key: key.toLowerCase() })))
    .sort((a, b) => b.key.length - a.key.length);
  return matches.find(({ key }) => normalized.includes(`/${key}`) || normalized.includes(`/${key.replace(/_/g, "-")}`))?.config || null;
}

function isSecurityContext({ pathname, activeApp }: WorkspaceRouteContext) {
  const normalized = pathname.toLowerCase();
  const appTitle = activeApp?.title?.toLowerCase() || "";
  return normalized.includes("/security") || normalized.includes("/secuity") || appTitle.includes("security") || appTitle.includes("secuity");
}

function getSecurityAssignmentConfig(context: WorkspaceRouteContext) {
  const normalized = getSecurityMatchText(context);
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  if (!isSecurityContext(context)) return null;
  const matches = Object.values(securityAssignmentConfigs)
    .flatMap((config) => config.routeKeys.map((key) => ({ config, key: key.toLowerCase() })))
    .sort((a, b) => b.key.length - a.key.length);
  return matches.find(({ key }) => {
    const keyCompact = key.replace(/[^a-z0-9]/g, "");
    return normalized.includes(`/${key}`) || normalized.includes(`/${key.replace(/_/g, "-")}`) || normalized.includes(key) || compact.includes(keyCompact);
  })?.config || null;
}

function getSecurityOperationMode(context: WorkspaceRouteContext) {
  if (!isSecurityContext(context)) return null;
  const normalized = getSecurityMatchText(context);
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  const roleKeys = [
    "accessassignrole",
    "accessassignroll",
    "accessassignrole",
    "accesstorole",
    "accesstoroll",
    "assignaccessrole",
    "assignaccessroll",
    "assignaccesstorole",
    "assignaccesstoroll",
  ];
  const userKeys = ["accessassignuser", "accesstouser", "assignaccessuser", "assignaccesstouser"];
  if (roleKeys.some((key) => compact.includes(key))) return "role" as const;
  if (userKeys.some((key) => compact.includes(key))) return "user" as const;
  return null;
}

function getSecurityMasterConfig(context: WorkspaceRouteContext) {
  const normalized = getSecurityMatchText(context);
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  if (!isSecurityContext(context)) return null;
  const matches = Object.values(securityMasterConfigs)
    .flatMap((config) => config.routeKeys.map((key) => ({ config, key: key.toLowerCase() })))
    .sort((a, b) => b.key.length - a.key.length);
  return matches.find(({ key }) => {
    const keyCompact = key.replace(/[^a-z0-9]/g, "");
    return normalized.includes(`/${key}`) || normalized.includes(`/${key.replace(/_/g, "-")}`) || normalized.includes(key) || compact.includes(keyCompact);
  })?.config || null;
}

function getSecurityMatchText(context: WorkspaceRouteContext) {
  const pathname = context.pathname.toLowerCase();
  const leaves = collectMenuLeaves(context.activeApp?.children || []);
  const activeLeaf = leaves.find((leaf) => {
    const path = (leaf.url_path || "").replace(/^\/+/, "").toLowerCase();
    return path && pathname.includes(path);
  });
  return [pathname, activeLeaf?.title, activeLeaf?.url_path].filter(Boolean).join(" ").toLowerCase();
}

function collectMenuLeaves(nodes: MenuNode[]) {
  const leaves: MenuNode[] = [];
  const walk = (items: MenuNode[]) => {
    items.forEach((item) => {
      if (item.type === "item" || item.url_path) leaves.push(item);
      if (item.children?.length) walk(item.children);
    });
  };
  walk(nodes);
  return leaves;
}

function isPamsRoute(pathname: string) {
  return pathname.toLowerCase().includes("/pams/");
}

function isPamsBulkAppraisalRoute(pathname: string) {
  const normalized = pathname.toLowerCase().replace(/\/+$/, "");
  return normalized.endsWith("/pams/masters/gm/kpi") || normalized.includes("/bulk");
}

function isPamsKpiGroupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/kpi_groups");
}

function isPamsKpiItemRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/kpi_activity");
}


function isPamsAppraisalSummaryRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/appraisal_listing_summary") || 
         normalized.includes("/appraisal-listing-summary");
}

function isPamsAppraisalDivisionSummaryRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/appraisal_listing") ||
         normalized.includes("/appraisal-listing");
}


function getPamsMasterConfig(context: WorkspaceRouteContext) {
  if (!isPamsRoute(context.pathname)) return null;
  const normalized = getPamsMatchText(context);
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  const matches = Object.values(pamsMasterConfigs)
    .flatMap((config) => config.routeKeys.map((key) => ({ config, key: key.toLowerCase() })))
    .sort((a, b) => b.key.length - a.key.length);
  return matches.find(({ key }) => {
    const keyCompact = key.replace(/[^a-z0-9]/g, "");
    return normalized.includes(`/${key}`) || normalized.includes(`/${key.replace(/_/g, "-")}`) || normalized.includes(key) || compact.includes(keyCompact);
  })?.config || null;
}

function getPamsMatchText(context: WorkspaceRouteContext) {
  const pathname = context.pathname.toLowerCase();
  const leaves = collectMenuLeaves(context.activeApp?.children || []);
  const activeLeaf = leaves.find((leaf) => {
    const path = (leaf.url_path || "").replace(/^\/+/, "").toLowerCase();
    return path && pathname.includes(path);
  });
  return [pathname, activeLeaf?.title, activeLeaf?.url_path].filter(Boolean).join(" ").toLowerCase();
}

