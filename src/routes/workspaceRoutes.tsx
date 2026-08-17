import { Fragment, type ReactNode } from "react";
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
// import { JournalVoucherPage } from "../pages/finance/JournalVoucherPage";
import { PaymentDocumentPage } from "../pages/finance/PaymentDocumentPage";
import { PrepaidRegisterPage } from "../pages/finance/PrepaidRegisterPage";
import { WmsInboundPage } from "../pages/wms/inbound/WmsInboundPage";
import { WmsOutboundPage } from "../pages/wms/outbound/WmsOutboundPage";
import { WmsSimpleMasterPage } from "../pages/wms/WmsSimpleMasterPage";
import { wmsSimpleMasterConfigs } from "../pages/wms/wmsMasterConfigs";
import { FreightMasterPage } from "../pages/freight/FreightMasterPage";
import { freightMasterConfigs } from "../pages/freight/freightMasterConfigs";
import { FreightEnquiryMainPage } from "../pages/freight/FreightEnquiryMainPage";
import { FreightQuotationPage } from "../pages/freight/FreightQuotationPage";
import { FreightWorkspacePage } from "../pages/freight/FreightWorkspacePage";
import { FreightAirlineTariffPage } from "../pages/freight/FreightAirlineTariffPage";
import { FreightJobPage } from "../pages/freight/FreightJobPage";
import { FreightPacklistPage } from "../pages/freight/FreightPacklistPage";
import { FreightJobActivitiesPage } from "../pages/freight/FreightJobActivitiesPage";
import { FreightJobWorkspacePage } from "../pages/freight/FreightJobWorkspacePage";
import { FreightReportPage, type FreightReportKey } from "../pages/freight/FreightReportPage";
import { SecurityAssignmentPage, securityAssignmentConfigs } from "../pages/security/SecurityAssignmentPage";
import { SecurityMasterPage, securityMasterConfigs } from "../pages/security/SecurityMasterPage";
import { SecurityOperationAccessPage } from "../pages/security/SecurityOperationAccessPage";
import { KpiActivityPage } from "../pages/pams/KpiActivityPage";
import MyTaskPage from "../pages/pams/MyTaskpage";
import AppraisalViewTabsPage from "../pages/pams/AppraisalViewtabspage";
import { KpiGroupPage } from "../pages/pams/KpiGroupPage";
import AppraisalSummaryReportDesign from "../pages/pams/AppraisalSummaryReportDesign";
import AppraisalDivisionSummaryReport from "../pages/pams/AppraisalDivisionSummaryReport";

import { CreditDebiteNotePage } from "../pages/finance/CreditDebiteNotePage";
import { JVDocumentEditor } from "../pages/finance/JVDocumentPage";

import { PamsAppraisalViewPage, PamsBulkAppraisalPage, PamsDashboardPage, PamsDepartmentAssignmentPage, PamsMasterPage, PamsReportPage, PamsTaskPage, pamsMasterConfigs, PeriodProcessButton ,  } from "../pages/pams/PamsPages";
import { HrMasterPage } from "../pages/hr/HrMasterPage";
import { hrMasterConfigs } from "../pages/hr/hrMasterConfigs";
import { HrLeaveCancelPage, HrPayrollAccountSetupPage, HrPayrollProcessPage, HrPayUnitsPage } from "../pages/hr/HrProcessPages";
import { ApplicationProgressPage } from "../pages/applicationProgress/ApplicationProgressPage";
import {
  OxAssetInventoryPage,
  OxInspectionReportPage,
  OxMaintDashboard,
  OxSimpleMasterPage,
  oxMaintMasterConfigs,
} from "../pages/oxmaint/OxMaintPages";
import { SalaryAdvancePage } from "../pages/hr/SalaryAdvancePage";
import { HrEmployeePayUnits } from "../pages/hr/HrEmployeePayUnits";
import { TrainingFeedbackPage } from "../pages/hr/Trainingfeedbackpage";
import { Leaf } from "lucide-react";
import LedgerBasics from "../pages/accounts_report/detailed_reports/LedgerBasics";
import { WmsBillingActPage } from "../pages/wms/Masters/WmsBillingActivityPage";
// import ProfitLossPage from "../pages/accounts_report/ProfitLossPage";
import AppraisalWeightageMaster from "../pages/pams/Appraisalweightagemaster";
import PeriodWisePage from "../pages/accounts_report/Ageing_reports/PeriodWiseReport";
// import { AcGroup, FirstGroup, SecondGroup, ThirdGroup } from "../pages/accounts_report/detailed_reports/TrailBalaneReports";
import AC_StatementPage from "../pages/accounts_report/detailed_reports/AC_StatementReportPage";
import OutstandingStatementPage from "../pages/accounts_report/detailed_reports/OutstandingStatementPage";
import BalanceSheetReportFilter from "../pages/accounts_report/detailed_reports/BalanceSheetReportFilter";
import AssignUserDiv from "../pages/finance/AssignUserDiv";
import TrialBalancePage from "../pages/accounts_report/detailed_reports/TrailBalaneReports";
import StockTransferPage from "../pages/wms/stock transfer/StockTransferPage";
import { StockTransferViewPage } from "../pages/wms/stock transfer/GetStockTransferPage";
import ProfitLossPage from "../pages/accounts_report/ProfitLossPage";
import VisaExpiryListingPage from "../pages/hr/Reports/Visaexpirylistingpage";
import Dnsummaryreportpage from "../pages/wms/Reports/Dnsummaryreportpage";
import StockSummaryReportPage from "../pages/wms/Reports/StockSummaryReportPage";
import StockAgeingQuantityReport from "../pages/wms/Reports/StockAgeingQuantityReport";
import StockAgeingVolumeReport from "../pages/wms/Reports/StockAgeingVolumeReport";

import { RJVDocumentEditor } from "../pages/finance/RJVDocuments";
import { AlmsSimpleMasterConfigs } from "../pages/almswf/almsMasterConfig";
import { AlmsSimpleMasterPage } from "../pages/almswf/AlmsMasterPage";
import TransactionReportPage from "../pages/wms/Stock_Reports/Transaction_report";
import TaxReportFilter from "../pages/accounts_report/tax_report/TaxReport";
import JobListingReport from "../pages/wms/stock transfer/JobListingReport";
import PLSetupPage from "../pages/finance/PLSetupPage";
import StockDetailReport from "../pages/wms_report/StockDetailReport";
import StockAdjustmentPage from "../pages/wms/stock adjustment/StockAdjustmentPage";
import { VendorWorkspacePage } from "../pages/vendor/VendorWorkspacePage";
import { isVendorRouteText } from "../pages/vendor/vendorRoutes";
import { StockAdjViewPage } from "../pages/wms/stock adjustment/StockAdjustmentViewPage";
import StockAdjPage from "../pages/wms/stock adjustment/StockAdjustmentPage";
import {StorageComputationPage} from "../pages/wms/storage computation/StorageComputation";
import LeaveEncashmentPage from "../pages/hr/LeaveEncashmentPage";
import EmployeeSalaryIncrement from "../pages/hr/EmployeeSalaryIncrement";
import { EmployeeProfilePage } from "../pages/hr/EmployeeProfilePage";

import { ContinuousAutoMemoPage } from "../pages/hr/HrContinuousAutoMemo";

import { ApplicantInfoPage } from "../pages/hr/Applicantinfopage";

import { InterviewEvalPage } from "../pages/hr/Interviewevalpage";

import { HrJoiningPage } from "../pages/hr/HrJoiningPage";

import { HrAccuralAccountSetup } from "../pages/hr/HrAccuralAccountSetup";

import { HrEmpEducationPage } from "../pages/hr/HrEmpEducationPage";  
import GradeSalaryIncrement from "../pages/hr/GradeSalaryIncrement.";
import EmployeeMasterPage from "../pages/hr/Employee Master/EmployeeMasterPage";
import SalaryAdditionDeductionMainPage from "../pages/hr/addition_deduction/SalaryAdditionDeductionMainPage";
import AbsentMemoMainPage from "../pages/hr/absent_memo/AbsentMemoMainPage";
import { BudgetRequestEditor } from "../pages/finance/budget/BudgetRequestEditor";

import { HrManpowerPage } from "../pages/hr/HrManpower";
import { BudgetRequestPage } from "../pages/finance/budget/BudgetRequestPage";
import { ProductWmsPage } from "../pages/wms/Masters/Product_Master/WmsProductPage";
import {
  EmployeePayslipPage,
  EmployeePayslipViewPage,
  LeaveRegisterPage,
  LeaveResumptionWorkspacePage,
  LeaveCancelRequestPage,
  LeaveClosedRequestPage,
  LeaveInProgressPage,
  LeaveRejectedRequestPage,
  LeaveWorkspacePage,
  leaveFlowConfigList,
  type LeaveFlowKey,
} from "../pages/hr/leave";
import { SmsDashboardPage } from "../pages/sms/SmsDashboardPage";
import { SmsMasterPage, smsMasterConfigs } from "../pages/sms/SmsMasterPage";
import { SmsSalesRequestPage } from "../pages/sms/SmsSalesRequestPage";
import InspectionReportMainPage from "../pages/oxmaint/inspection-report-tailwind/InspectionReportMainPage";

import { GradeMasterPage } from "../pages/hr/Grademasterpage";
import InvoicePage from "../pages/wms/invoice/InvoicePage";
import { AdminSupportCenterPage } from "../pages/support/AdminSupportCenterPage";
import { SupportDeveloperAssignmentPage } from "../pages/support/SupportDeveloperAssignmentPage";
import { SupportDeveloperWorkbenchPage } from "../pages/support/SupportDeveloperWorkbenchPage";
import FreightInvoicePage from "../pages/freight/FreightInvoicePage";
import InspectionFormPage from "../pages/oxmaint/inspection-form-tailwind/inspection_form/InspectionFormMainPage";
import GrnSummaryReportPage from "../pages/wms/Reports/Grnsummaryreport";
import AssetInventoryMainPage from "../pages/oxmaint/asset-inventory-tailwind/AssetInventoryMainPage";

import { KpiEmployeeInformationPage } from "../pages/pams/KpiEmployeeInformation";
import StockCountPage from "../pages/wms/stock count/StockCountPage";
import{ExpenseMasterPage} from "../pages/purchase_sales/Expensemasterpage";
import MseProdGroup from "../pages/purchase_sales/MseProdGroup";
import ProductPurchaseSales from "../pages/purchase_sales/ProductPurchaseSales";



import {ProductTypePage} from "../pages/purchase_sales/PS_ProductTypePage";

import { ProductCategoryPage } from "../pages/purchase_sales/PS_ProductCategory";

import { ZoneMasterPage } from "../pages/purchase_sales/PS_ZoneMasterPage";
import PamsDashboard from "../pages/pams/PamsDashboard";

import Mytaskalmspage from "../pages/almswf/Mytaskalmspage";
import Credit_Request_page from "../pages/almswf/CreaditRequestPage";
import Capex_Request_page from "../pages/almswf/CapexRequestPage";
import Purchase_Request_page from "../pages/almswf/PurchaseRequestPage";

import { PurchaseOrderPage } from "../pages/purchase_sales/purchase/Purchaseorderpage";

import { StockInquiryPage } from "../pages/purchase_sales/PS_StockInquiry";
import { PS_ProductBomPage } from "../pages/purchase_sales/PS_ProductBomPage";
import { PurchaseSaleSetupPage } from "../pages/purchase_sales/Purchasesalesetuppage";
import { FlowAssignmentPage } from "../pages/security/FlowAssignmentPage";import { PurchaseQuotationPage } from "../pages/purchase_sales/purchase/PurchaseQuatationPage";
import { PurchaseGRNPage } from "../pages/purchase_sales/purchase/PurchaseGRNPage";
import { ProductionJobOrderPage } from "../pages/purchase_sales/production/ProductionJobOrderPage";
import { SalesOrderPage } from "../pages/purchase_sales/sales/SalesorderPage";
import { SalesDNPage } from "../pages/purchase_sales/sales/SalesDNPage";
import { StocksTransferPage } from "../pages/purchase_sales/inventory/StockTransferPage";
import { StocksAdjectmentPage } from "../pages/purchase_sales/inventory/StockadjustmentPage";
import { JobProductionOrderPage } from "../pages/purchase_sales/production/JobProductionPage";
import { LeaveTypesPage } from "../pages/hr/Leavetypespage";
import AccuralPayUnit from "../pages/hr/AccuralPayUnit";
import PLSummaryPage from "../pages/purchase_sales/Reports/Plsummarypage";
import { PurchaseInvoicePage } from "../pages/purchase_sales/purchase/PurchaseInvoicePage";
import { SalesInvoicePage } from "../pages/purchase_sales/sales/SalesInvoicePage";
import { ProductBrandPage } from "../pages/purchase_sales/Productbrandpage";
 type WorkspaceRouteContext = {
  pathname: string;
  activeApp?: MenuNode;
  activeMenu?: MenuNode;
};

type WorkspaceRoute = {
  name: string;
  match: (context: WorkspaceRouteContext) => boolean;
  element: (context: WorkspaceRouteContext) => ReactNode;
};

export function resolveWorkspaceRoute(context: WorkspaceRouteContext) {
  const route = workspaceRoutes.find((item) => item.match(context));
  const element = route?.element(context);
  return element ? <Fragment key={getWorkspaceRouteKey(context)}>{element}</Fragment> : null;
}

export const workspaceRoutes: WorkspaceRoute[] = [
  {
    name: 'MSE Prod Group',
    match: ({pathname}) => pathname.toLowerCase().includes("/purchase_sales/purchase_sales/masters/product_group"),
    element: () => <MseProdGroup />,
  },

  {
  name: 'Purchase Sales Product Brand',
  match: ({pathname}) => pathname.toLowerCase().includes("/purchase_sales/purchase_sales/masters/product_brand"),
  element: () => <ProductBrandPage />,
},
  {
    name: 'Purchase Sales Product',
    match: ({pathname}) => pathname.toLowerCase().includes("/purchase_sales/purchase_sales/masters/product"),
    element: () => <ProductPurchaseSales />
  },
  {
    name: 'HR Accural Pay Unit',
    match: ({pathname}) => pathname.toLowerCase().includes("/hr/hr/transactions/accural_pay_units"),
    element: () => <AccuralPayUnit />,
  },
  {
    name: "Activity WMS Master",
    match: ({pathname}) => pathname.toLowerCase().includes("/wms/wms/master/gm/activity"),
    element: () => <WmsSimpleMasterPage config={wmsSimpleMasterConfigs.activity} />,
  },

  {
    name: 'mms inspection report',
    match: ({pathname}) => pathname.toLowerCase().includes("/mms/mms/inspection/inspection-report"),
    element: () => <InspectionReportMainPage />,
  },
  {
    name: 'mms inspection form',
    match: ({pathname}) => pathname.toLowerCase().includes("/mms/mms/inspection/inspection-form"),
    element: () => <InspectionFormPage />
  },
  {
    name: 'mms asset inventory',
    match: ({pathname}) => pathname.toLowerCase().includes("/mms/mms/oxmaint/asset_inventory"),
    element: () => <AssetInventoryMainPage />
  },

  {
    name: "Support Developer Assignment",
    match: ({ pathname }) => pathname.toLowerCase().includes("/support/developer-assignment"),
    element: () => <SupportDeveloperAssignmentPage />,
  },
  {
    name: "Support Developer Workbench",
    match: ({ pathname }) => pathname.toLowerCase().includes("/support/developer-workbench"),
    element: () => <SupportDeveloperWorkbenchPage />,
  },
  {
    name: "Admin Support Center",
    match: ({ pathname }) => pathname.toLowerCase().includes("/support/admin"),
    element: () => <AdminSupportCenterPage />,
  },
  {
    name: "SMS Dashboard",
    match: (context) => isSmsRoute(context) && getGenericMatchText(context).includes("dashboard"),
    element: () => <SmsDashboardPage />,
  },
  {
    name: "SMS Sales Request",
    match: (context) => isSmsRoute(context) && getGenericMatchText(context).replace(/[^a-z0-9]/g, "").includes("salesrequest"),
    element: () => <SmsSalesRequestPage />,
  },
  {
    name: "SMS Master",
    match: (context) => Boolean(getSmsMasterConfig(context)),
    element: (context) => <SmsMasterPage config={getSmsMasterConfig(context)!} />,
  },
  {
    name: "HR Leave Workspace",
    match: (context) => isLeaveFlowRoute(context, "request"),
    element: () => <LeaveWorkspacePage initialTab="request" />,
  },

  {
  name: "HR Accural Account Setup",
  match: ({ pathname }) => isHrAccuralAccountSetupRoute(pathname),
  element: () => <HrAccuralAccountSetup />,
  },

  {
    name: "HR Leave In Progress",
    match: (context) => isLeaveFlowRoute(context, "inProgress"),
    element: () => <LeaveInProgressPage />,
  },
  {
    name: "HR Leave Closed Request",
    match: (context) => isLeaveFlowRoute(context, "closed"),
    element: () => <LeaveClosedRequestPage />,
  },
  {
    name: "HR Leave Cancel Request",
    match: (context) => isLeaveFlowRoute(context, "cancelled"),
    element: () => <LeaveCancelRequestPage />,
  },
  {
    name: "HR Leave Rejected Request",
    match: (context) => isLeaveFlowRoute(context, "rejected"),
    element: () => <LeaveRejectedRequestPage />,
  },
  {
    name: "HR Employee Payslip",
    match: (context) => isHrRoute(context) && isHrEmployeePayslipRoute(context),
    element: () => <EmployeePayslipPage />,
  },
  {
    name: "HR Employee Payslip View",
    match: (context) => isHrRoute(context) && isHrEmployeePayslipViewRoute(context),
    element: () => <EmployeePayslipViewPage />,
  },
  {
    name: "HR Leave Register",
    match: (context) => isHrRoute(context) && isHrLeaveRegisterRoute(context),
    element: () => <LeaveRegisterPage />,
  },
  {
    name: "HR Leave Resumption",
    match: (context) => isHrRoute(context) && isHrLeaveResumptionRoute(context),
    element: () => <LeaveResumptionWorkspacePage />,
  },
  {
    name: "HR Employee Profile",
    match: (context) => isHrRoute(context) && isHrEmployeeProfileRoute(context),
    element: () => <EmployeeProfilePage />,
  },
  {
    name: "HR Absent Memo",
    match: ({ pathname }) => pathname.toLowerCase().includes("/hr/hr/transactions/memo_and_forms/absent_memo"),
    element: () => <AbsentMemoMainPage />,
  },
  {
    name: "HR Salary Addition Deduction Page",
    match: ({ pathname }) => pathname.toLowerCase().includes("/hr/hr/transactions/memo_and_forms/addition/deduction_letter"),
    element: () => <SalaryAdditionDeductionMainPage />,
  },

//Grade master page route 
  {
  name: "HR Grade Master",
  match: ({ pathname }) =>
    pathname
      .toLowerCase()
      .includes("/workspace/hcm/hcm/general%20master/grade%20master"),
  element: () => <GradeMasterPage />,
},

{
  name: "HR Grade Master",
  match: ({ pathname }) =>
    pathname
      .toLowerCase()
      .includes("/workspace/bt-masters/hcm/general%20master/grade%20maste"),
  element: () => <GradeMasterPage />,
},
{
  name: "Security Flow Assignment",
  match: ({ pathname }) => isFlowAssignmentRoute(pathname),
  element: () => <FlowAssignmentPage />,
},

  {
    name:"HR Grade Salary Increment",
    match: ({ pathname }) => pathname.toLowerCase().includes("/hr/hr/transactions/grade_salary_increment"),
    element: () => <GradeSalaryIncrement />
  },
  {
    name: "HR Employee Salary Increment",
    match: ({ pathname }) => pathname.toLowerCase().includes("/hr/hr/transactions/salary%20increment"),
    element: () => <EmployeeSalaryIncrement />
  },
  {
    name: "HR Leave Encashmen",
    match: ({ pathname }) => pathname.toLowerCase().includes("/hr/hr/transactions/leave_encashment"),
    element: () => <LeaveEncashmentPage />
  },
  {
    name: "Employee Master",
    match: ({pathname})=> pathname.toLocaleLowerCase().includes("/hr/hr/employee/employee_master"),
    element: () => <EmployeeMasterPage />
  },
  {
    name: "Vendor System",
    match: (context) => isVendorRoute(context),
    element: (context) => <VendorWorkspacePage routePath={getGenericMatchText(context)} />,
  },
  {
    name: "Finance Ledger Basics",
    match: ({ pathname }) => pathname.toLowerCase().includes("/wms/wms/reports/stock%20report/stock_detail"),
    element: () => <StockDetailReport />,
  },
  {
    name: "Finance Assign User Div",
    match: ({ pathname }) => pathname.toLowerCase().includes("/finance/finance/utilities/assign_user_division"),
    element: () => <AssignUserDiv />
  },
  {
    name: "Finance Account Tree",
    match: ({ pathname }) => isAccountTreeRoute(pathname),
    element: () => <AccountTreePage />,
  },
  {
    name: "Finance Account Report",
    match: ({ pathname }) => isAccountReportRoute(pathname),
    element: () => <LedgerBasics />,
  },
   {
    name: "Finance Tax Report",
    match: ({ pathname }) => isTaxReportRoute(pathname),
    element: () => <TaxReportFilter />,
  },
  {
    name: "Finance Balance Sheet",
    match: ({ pathname }) => isBalanceSheetRoute(pathname),
    element: () => <BalanceSheetReportFilter />,
  },

  {
  name: "Finance AC Statement",
  match: ({ pathname }) => isAcStatementRoute(pathname),
  element: () => <AC_StatementPage />,
},

{
  name: "Storage Computation",
  match: ({ pathname }) => isStorageComputationRoute(pathname),
  element: () => <StorageComputationPage />,
},
{
  name: "Finance Outstanding Statement",
  match: ({ pathname }) => isOutstandingStatementRoute(pathname),
  element: () => <OutstandingStatementPage />,
},
{
  name: "Pams Dashboard",
  match: ({ pathname }) => pathname.toLowerCase().includes("/ems/masters/kpi%20masters/pms_dashboard"),
  element: () => <PamsDashboard />
},
  
  {
    name: "Finance Ageing Report",
    match: ({ pathname }) => isAgeingReportRoute(pathname),
    element: () => <PeriodWisePage />},
  { name: "Finance Trail Balance L2 Report",
    match: ({ pathname }) => pathname.toLowerCase().includes("finance/finance/accounts_report/trial_balance/first_group"),
    element: () => <TrialBalancePage />,
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
    name: "Budget Allocation Setup",
    match: ({ pathname }) => isBudgetSetupRoute(pathname),
    element: () => <BudgetRequestPage onClose={function (): void {
      throw new Error("Function not implemented.");
    } }  />,
  },
  {
    name: "Finance Budget Version",
    match: ({ pathname }) => isBudgetVersionRoute(pathname),
    element: () => <BudgetVersionPage />,
  },
      {
    name: "Stock Transfer View",
    match: ({ pathname }) => isStockTransferViewRoute(pathname),
    element: () => <StockTransferViewPage />,   
  },
  {
  name: "Stock Count",
  match: ({ pathname }) => isStockCountRoute(pathname),
  element: () => <StockCountPage />,
},
    {
    name: "Stock Transfer",
    match: ({ pathname }) => isStockTransferRoute(pathname),
    element: () => <StockTransferPage />,
  },
  {
  name: "Stock Adjustment View",
  match: ({ pathname }) => isStockAdjViewRoute(pathname),
  element: () => <StockAdjViewPage />,
},
{
  name: "Stock Adjustment",
  match: ({ pathname }) => isStockAdjustmentRoute(pathname),
  element: () => <StockAdjPage />,
},
{
  name: "WMS Invoice",
  match: ({ pathname }) => isInvoiceRoute(pathname),
  element: () => <InvoicePage />,
},
{
  name: "Freight Invoice",
  match: ({ pathname }) => isFreightInvoiceRoute(pathname),
  element: () => <FreightInvoicePage />,
},
  {
    name: "WMS Stock Transaction Report",
    match: ({ pathname }) => isTransactionReportRoute(pathname),
    element: () => <TransactionReportPage />,
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
    element: () => <JVDocumentEditor docType={"JV"}  />,
  },
    {
    name: "Finance RV Voucher",
    match: ({ pathname }) => isRVoucherRoute(pathname),
    element: () => <RJVDocumentEditor docType={"RJV"}  />,
  },
  {
    name: "Finance Bank Reconciliation",
    match: ({ pathname }) => isBankReconciliationRoute(pathname),
    element: () => <BankReconciliationPage />,
  },
  {
    name: "Finance Credit/Debit Notes",
    match: ({ pathname }) => Boolean(getCreditDebitNoteDocType(pathname)),
    element: ({ pathname }) => <CreditDebiteNotePage docType={getCreditDebitNoteDocType(pathname)!} />,
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
    name : "Profit and Loss",
    match: ({pathname}) => isProfitLossRoute(pathname),
    element: () => <ProfitLossPage/>
  },
{
    name : "Visa Expiry Listing Report",
    match: ({pathname}) => isVisaExpiryListingRoute(pathname),
    element: () => <VisaExpiryListingPage/>
  },

  {
    name : "DN Summary Report",
    match: ({pathname}) => isDnRoute(pathname),
    element: () => <Dnsummaryreportpage/>
  },

  {
    name : "Grn Summary Report",
    match: ({pathname}) => isGrnRoute(pathname),
    element: () => <GrnSummaryReportPage/>
  },

  {
    name: "WMS Inbound",
    match: ({ pathname }) => isWmsInboundRoute(pathname),
    element: () => <WmsInboundPage />,
  },
  {
    name: "WMS Outbound",
    match: ({ pathname }) => isWmsOutboundRoute(pathname),
    element: () => <WmsOutboundPage />,
  },
   {
    name: "WMS Billing Activity Master",
    match: ({ pathname }) => isWmsBillingActRoute(pathname),
    element: () => <WmsBillingActPage />,
  },
  {
    name: "Product Master",
    match: ({pathname})=> pathname.toLocaleLowerCase().includes("/wms/wms/masters/gm/product"),
    element: () => <ProductWmsPage />
  },
  {
    name: "WMS Stock Summary Report",
    match: ({ pathname }) => isStockSummaryRoute(pathname),
    element: () => <StockSummaryReportPage />,
  },
  {
  name: "WMS Stock Ageing Quantity Report",
  match: ({ pathname }) => isStockAgeingQuantityRoute(pathname),
  element: () => <StockAgeingQuantityReport />,
  },
  {
  name: "WMS Stock Ageing Volume Report",
  match: ({ pathname }) => isStockAgeingVolumeRoute(pathname),
  element: () => <StockAgeingVolumeReport />,
  },
  {
    name: "WMS Stock Report Job Listing",
    match: ({ pathname }) => isJobListingRoute(pathname),
    element: () => <JobListingReport />,
  },
  
  {
    name: "WMS Simple Master",
    match: ({ pathname }) => Boolean(getWmsSimpleMasterConfig(pathname)),
    element: ({ pathname }) => <WmsSimpleMasterPage config={getWmsSimpleMasterConfig(pathname)!} />,
  },
  {
    name: "Freight Reports",
    match: (context) => Boolean(getFreightReportKey(context)),
    element: (context) => <FreightReportPage reportKey={getFreightReportKey(context)!} />,
  },
  {
    name: "Freight RFQ Activities",
    match: (context) => isFreightRfqActivitiesRoute(context),
    element: (context) => <FreightEnquiryMainPage target={getFreightWorkspaceTarget(context)} screenType="rfq" />,
  },
  {
    name: "Freight RFQ",
    match: (context) => isFreightRfqRoute(context),
    element: (context) => <FreightEnquiryMainPage target={getFreightWorkspaceTarget(context)} screenType="rfq" />,
  },
  {
    name: "Freight Enquiry Activities",
    match: (context) => isFreightEnquiryActivitiesRoute(context),
    element: (context) => <FreightEnquiryMainPage target={getFreightWorkspaceTarget(context)} />,
  },
  {
    name: "Freight Enquiry",
    match: (context) => isFreightEnquiryRoute(context),
    element: (context) => <FreightEnquiryMainPage target={getFreightWorkspaceTarget(context)} />,
  },
  {
    name: "Freight Quotation",
    match: (context) => isFreightQuotationRoute(context),
    element: (context) => <FreightQuotationPage target={getFreightWorkspaceTarget(context)} initialTab={getFreightQuotationInitialTab(context)} />,
  },
  {
    name: "Freight Airline Tariff Report",
    match: (context) => isFreightAirlineTariffReportRoute(context),
    element: () => <FreightAirlineTariffPage mode="report" />,
  },
  {
    name: "Freight Airline Tariff",
    match: (context) => isFreightAirlineTariffRoute(context),
    element: () => <FreightAirlineTariffPage mode="entry" />,
  },
  {
    name: "Freight Job Sheet",
    match: (context) => isFreightJobSheetRoute(context),
    element: (context) => <FreightJobWorkspacePage target={getFreightWorkspaceTarget(context)} initialTab="jobsheet" />,
  },
  {
    name: "Freight Pack List",
    match: (context) => isFreightPacklistRoute(context),
    element: (context) => <FreightJobWorkspacePage target={getFreightWorkspaceTarget(context)} initialTab="packlist" />,
  },
  {
    name: "Freight Alerts",
    match: (context) => isFreightJobFollowupRoute(context, "alerts"),
    element: (context) => <FreightJobWorkspacePage target={getFreightWorkspaceTarget(context)} initialTab="alerts" />,
  },
  {
    name: "Freight Instructions",
    match: (context) => isFreightJobFollowupRoute(context, "instructions"),
    element: (context) => <FreightJobWorkspacePage target={getFreightWorkspaceTarget(context)} initialTab="instructions" />,
  },
  {
    name: "Freight Documents",
    match: (context) => isFreightJobFollowupRoute(context, "documents"),
    element: (context) => <FreightJobWorkspacePage target={getFreightWorkspaceTarget(context)} initialTab="documents" />,
  },
  {
    name: "Freight Deposits",
    match: (context) => isFreightJobFollowupRoute(context, "deposits"),
    element: (context) => <FreightJobWorkspacePage target={getFreightWorkspaceTarget(context)} initialTab="deposits" />,
  },
  {
    name: "Freight Service Activities",
    match: (context) => isFreightServiceActivitiesRoute(context),
    element: (context) => <FreightJobWorkspacePage target={getFreightWorkspaceTarget(context)} initialTab="activities" />,
  },
  {
    name: "Freight Job",
    match: (context) => isFreightOperationalJobRoute(context),
    element: (context) => <FreightJobWorkspacePage target={getFreightWorkspaceTarget(context)} />,
  },
  {
    name: "Freight Master",
    match: (context) => Boolean(getFreightMasterConfig(context)),
    element: (context) => <FreightMasterPage config={getFreightMasterConfig(context)!} />,
  },
  {
    name: "Freight Workspace",
    match: (context) => isFreightWorkspaceRoute(context),
    element: (context) => <FreightWorkspacePage target={getFreightWorkspaceTarget(context)} />,
  },
    {
    name: "ALMS Simple Master",
    match: ({ pathname }) => Boolean(getAlmsSimpleMasterConfig(pathname)),
    element: ({ pathname }) => <AlmsSimpleMasterPage config={getAlmsSimpleMasterConfig(pathname)!} />,
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

   // ── ALMS My Task Routes (specific tabs first, then generic fallback) ──
  {
    name: "ALMS My Task Pending",
    match: (context) => isAlmsMyTaskTabRoute(context, ["pending"]),
    element: () => <Mytaskalmspage initialTab={0} />,
  },
  {
    name: "ALMS My Task In Progress",
    match: (context) => isAlmsMyTaskTabRoute(context, ["in_progress", "in-progress"]),
    element: () => <Mytaskalmspage initialTab={1} />,
  },
  {
    name: "ALMS My Task Rejected",
    match: (context) => isAlmsMyTaskTabRoute(context, ["rejected"]),
    element: () => <Mytaskalmspage initialTab={2} />,
  },
  {
    name: "ALMS My Task Sent Back",
    match: (context) => isAlmsMyTaskTabRoute(context, ["sent_back", "sent-back"]),
    element: () => <Mytaskalmspage initialTab={3} />,
  },
  {
    name: "ALMS My Task Approved",
    match: (context) => isAlmsMyTaskTabRoute(context, ["approved", "final_approved", "final-approved"]),
    element: () => <Mytaskalmspage initialTab={4} />,
  },
  {
    name: "ALMS My Task Po Generated",
    match: (context) => isAlmsMyTaskTabRoute(context, ["po_generated", "po-generated"]),
    element: () => <Mytaskalmspage initialTab={5} />,
  },
  {
    name: 'My Task',
    match:(context) => isMyTaskRoute(context),
    element: () => <Mytaskalmspage initialTab={0} />
  },
  

  {
    name: 'Credit Request page',
    match:(context) => isCreditRequestTaskRoute(context),
    element: () => <Credit_Request_page initialTab={0} />
  },

  {
    name: 'Capex Request page',
    match:(context) => isCapexRequestTaskRoute(context),
    element: () => <Capex_Request_page initialTab={0} />
  },


  {
    name: 'Purchase Request page',
    match:(context) => isPurchaseRequestTaskRoute(context),
    element: () => <Purchase_Request_page initialTab={0} />
  },



  //// PAMS Routes
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

  {
    name: "Purchase Sales Setup",
    match: ({ pathname }) => isPurchaseSalesSetupRoute(pathname),
    element: () => <PurchaseOrderPage onClose={function (): void {
      throw new Error("Function not implemented.");
    } }  />,
  },
    {
    name: "Purchase Invoice Setup",
    match: ({ pathname }) => isPurchaseInvoiceSetupRoute(pathname),
    element: () => <PurchaseInvoicePage onClose={function (): void {
      throw new Error("Function not implemented.");
    } }  />,
  },

      {
    name: "Sales Invoice Setup",
    match: ({ pathname }) => isSalesInvoiceSetupRoute(pathname),
    element: () => <SalesInvoicePage onClose={function (): void {
      throw new Error("Function not implemented.");
    } }  />,
  },

    {
    name: "Purchase Quotation Setup",
    match: ({ pathname }) => isPurchaseQuotationSetupRoute(pathname),
    element: () => <PurchaseQuotationPage onClose={function (): void {
      throw new Error("Function not implemented.");
    } }  />,

    
  },
     {
    name: "Purchase Quotation Setup",
    match: ({ pathname }) => isPurchaseGRNSetupRoute(pathname),
    element: () => <PurchaseGRNPage onClose={function (): void {
      throw new Error("Function not implemented.");
    } }  />,
  },

       {
    name: "Purchase Quotation Setup",
    match: ({ pathname }) => isPProductionJoborderSetupRoute(pathname),
    element: () => <ProductionJobOrderPage onClose={function (): void {
      throw new Error("Function not implemented.");
    } }  />,
  },

         {
    name: "Sales Order Setup",
    match: ({ pathname }) => isSalesorderSetupRoute(pathname),
    element: () => <SalesOrderPage onClose={function (): void {
      throw new Error("Function not implemented.");
    } }  />,
  },
           {
    name: "Sales Order Setup",
    match: ({ pathname }) => isSalesDNSetupRoute(pathname),
    element: () => <SalesDNPage onClose={function (): void {
      throw new Error("Function not implemented.");
    } }  />,

    
  },
             {
    name: "Inventory Setup",
    match: ({ pathname }) => isStocksTransferSetupRoute(pathname),
    element: () => <StocksTransferPage onClose={function (): void {
      throw new Error("Function not implemented.");
    } }  />,

    
  },
               {
    name: "Inventory Setup",
    match: ({ pathname }) => isStocksAdjectmentSetupRoute(pathname),
    element: () => <StocksAdjectmentPage onClose={function (): void {
      throw new Error("Function not implemented.");
    } }  />,

    
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

  {
    name: "PAMS KPI Item",
    match: ({ pathname }) => isPamsRoute(pathname) && isPamsKpiItemRoute(pathname),
    element: () => <KpiActivityPage />,
  },

  // workspaceRoutes array mein, PAMS Master route se PEHLE add karo:
{
  name: "PAMS Period Setup",
  match: ({ pathname, activeApp }) => {
    if (!isPamsRoute(pathname)) return false;
    const context = { pathname, activeApp };
    const normalized = getPamsMatchText(context);
    const compact = normalized.replace(/[^a-z0-9]/g, "");
    return (
      normalized.includes("/period_setup") ||
      normalized.includes("/period-setup") ||
      normalized.includes("appraisal_period_setup") ||
      normalized.includes("appraisalperiodsetup") ||
      compact.includes("periodsetup") ||
      compact.includes("periodsetup")
    );
  },
  element: (context) => (
    <PamsMasterPage
  config={pamsMasterConfigs.period}
  hideRefresh={true}
  headerActions={<PeriodProcessButton />}
/>
  ),
},

  {
    name: "PAMS Master",
    match: (context) => Boolean(getPamsMasterConfig(context)),
    element: (context) => <PamsMasterPage config={getPamsMasterConfig(context)!} />,
  },
  {
    name: "Appraisal Weightage Master",
    match: ({ pathname }) => isPamsRoute(pathname) && isPamsAppraisalWeightageRoute(pathname),
    element: () => <AppraisalWeightageMaster />,
  },
 
  {
    name: "Application Progress",
    match: (context) => isApplicationProgressRoute(context),
    element: () => <ApplicationProgressPage />,

  },
  {
    name: "Oxmaint",
    match: (context) => isOxMaintRoute(context),
    element: (context) => getOxMaintElement(context),
  },

  {
  name: "HR Employee Pay Units",
  match: (context) =>
    isHrRoute(context) && isHrEmployeePayUnitsRoute(context),
  element: () => <HrEmployeePayUnits />,
  },

  
  {
    name: "HR Pay Units",
    match: (context) => isHrRoute(context) && isHrPayUnitsRoute(context),
    element: () => <HrPayUnitsPage mode="units" />,
  },

  

  {
    name: "HR Pay Units Dependant",
    match: (context) => isHrRoute(context) && isHrPayUnitsDependantRoute(context),
    element: () => <HrPayUnitsPage mode="dependant" />,
  },
  {
    name: "HR Payroll Process",
    match: (context) => isHrRoute(context) && isHrPayrollProcessRoute(context),
    element: () => <HrPayrollProcessPage />,
  },
  {
    name: "HR Leave Cancel",
    match: (context) => isHrRoute(context) && isHrLeaveCancelRoute(context),
    element: () => <HrLeaveCancelPage />,
  },
  {
    name: "HR Warning Letter",
    match: (context) => isHrRoute(context) && isHrMemosAndFormsWarningLetterRoute(context),
    element: () => <SalaryAdvancePage />,
  },
  
  {
  name: "HR Applicant Info",
  match: (context) => isHrRoute(context) && isHrApplicantInfoRoute(context),
  element: () => <ApplicantInfoPage />,
  },

  {
  name: "HR Continuous Auto Memo",
  match: (context) => isHrRoute(context) && isHrContinuousAutoMemoRoute(context),
  element: () => <ContinuousAutoMemoPage />,
},

{
  name: "HR Interview Evaluation",
  match: (context) => isHrRoute(context) && isHrInterviewEvalRoute(context),
  element: () => <InterviewEvalPage />,
},

  {
  name: "HR Training Feedback",
  match: (context) => isHrRoute(context) && isHrTrainingFeedbackRoute(context),
  element: () => <TrainingFeedbackPage />,
  },

  {
  name: "HR Joining",
  match: (context) => isHrRoute(context) && isHrJoiningRoute(context),
  element: () => <HrJoiningPage />,
},

{
  name: "HR Manpower Requisition",
  match: (context) => isHrRoute(context) && isHrManpowerRequisitionRoute(context),
  element: () => <HrManpowerPage />,
},

{
  name: "HR Employee Education",
  match: (context) => isHrRoute(context) && isHrEmpEducationRoute(context),
  element: () => <HrEmpEducationPage />,
},

{
  name: "Employee Information",
  match: (context) => isHrRoute(context) && isHrEmployeeInformationRoute(context),
  element: () => <KpiEmployeeInformationPage />,
},


{
    name: "HR Payroll Account Setup",
    match: (context) => isHrRoute(context) && isHrPayrollAccountSetupRoute(context),
    element: () => <HrPayrollAccountSetupPage />,
  },
  {
    name: "HR Leave Types",
    match: ({ pathname }) => isHrLeaveTypeRoute(pathname),
    element: () => <LeaveTypesPage />,
  },
  {
    name: "HR Master",
    match: (context) => Boolean(getHrMasterConfig(context)),
    element: (context) => <HrMasterPage config={getHrMasterConfig(context)!} />,
  },

  {
  name: "Purchase Sales Product Type",
  match: ({ pathname }) => isProductTypeRoute(pathname),
  element: () => <ProductTypePage />,
  },


  {
  name: "Purchase Sales Product Category",
  match: ({ pathname }) => isProductCategoryRoute(pathname),
  element: () => <ProductCategoryPage />,
  },

   {
  name: "Purchase Sales Zone Master",
  match: ({ pathname }) => isZoneMasterRoute(pathname),
  element: () => <ZoneMasterPage />,
  },

  

  {
    name : "Expense Master",
    match: ({pathname}) => isExpenseMasterRoute(pathname),
    element: () => <ExpenseMasterPage/>
  },
  

  {
    name : "Purchase Sale Setup",
    match: ({pathname}) => isPurchaseSaleSetupRoute(pathname),
    element: () => <PurchaseSaleSetupPage/>
  },

  {
  name: "Purchase Sales Stock Inquiry",
  match: ({ pathname }) => isStockInquiryRoute(pathname),
  element: () => <StockInquiryPage />,
  },

    {
  name: "Purchase Sales Stock Inquiry",
  match: ({ pathname }) => isJobProductionSetupRoute(pathname),
  element: () => <JobProductionOrderPage />,
  },

  {
  name: "Product BOM",
  match: ({ pathname }) => isProductBomRoute(pathname),
  element: () => <PS_ProductBomPage />},

  
  {
  name: "Profit & Loss Summary Report",
  match: ({ pathname }) => isProfitLossSummaryRoute(pathname),
  element: () => <PLSummaryPage />,
},
  
];

function isStorageComputationRoute(pathname: string) {
  return pathname.toLowerCase().includes("wms/activity/request/storage_computation");
}


function isHrLeaveTypeRoute(pathname: string) {
  const normalized = decodeRouteText(pathname).toLowerCase();
  // const compact = normalized.replace(/[^a-z0-9]/g, "");
  return (
    normalized.includes("/hcm/hcm/pay components/leave_types") ||
    normalized.includes("/hcm/hcm/pay%20components/leave_types")
    // compact.includes("paycomponentsleavetype")
  );
}


//--------PURCHASE SALE-------
function isExpenseMasterRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes(
    "/workspace/purchase_sales/purchase_sales/masters/expense_master"
  );
}



function isPurchaseSaleSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes(
    "/workspace/purchase_sales/purchase_sales/utilities/purchase/sales_setup"
  );
}

function isProductBrandRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes(
    "/workspace/purchase_sales/purchase_sales/masters/product_brand"
  );
}

function isProfitLossSummaryRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes(
    "/workspace/purchase_sales/purchase_sales/reports/profit_loss_summary"
  );
}



function isStockAdjViewRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return (
    normalized.includes("wms/activity/request/stock_adj") &&
    normalized.includes("/view/")
  );
}
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
function isBudgetSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return (
    normalized.includes("/finance/budget/budget_allocation")
  );
}


function isPurchaseSalesSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  
    return (normalized.includes("purchase_sales/purchase/purchase_order"))
}
function isPurchaseInvoiceSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  
    return (normalized.includes("purchase_sales/purchase/purchase_invoice"))
}

function isSalesInvoiceSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  
    return (normalized.includes("purchase_sales/sales/sales_invoice"))
}


function isPurchaseQuotationSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  
    return (normalized.includes("purchase_sales/purchase/purchase_quotation"))
}
function isPurchaseGRNSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  
    return (normalized.includes("purchase_sales/purchase/purchase_grn"))
}

function isPProductionJoborderSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  
    return (normalized.includes("purchase_sales/production/job_order"))
}

function isSalesorderSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  
    return (normalized.includes("purchase_sales/sales/sales_order"))
}
function isSalesDNSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  
    return (normalized.includes("purchase_sales/sales/sales_dn"))
}
function isStocksTransferSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  
    return (normalized.includes("purchase_sales/inventory/stock_transfer"))
}
function isStocksAdjectmentSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  
    return (normalized.includes("purchase_sales/inventory/stock_adjustment"))
}
function isJobProductionSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  
    return (normalized.includes("purchase_sales/production/job_production"))
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

function isAccountReportRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/finance/accounts_report/detailed_reports/ledger_basic") || normalized.includes("/finance/accounts/reports/account-report/detailed-reports/ledger-basic")
}
function isFlowAssignmentRoute(pathname: string) {
  const normalized = decodeRouteText(pathname).toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  return (
    normalized.includes("/security/security/masters/general master/flow_assignment") ||
    normalized.includes("/security/security/masters/general%20master/flow_assignment") ||
    compact.includes("generalmasterflowassignment") ||
    compact.includes("flowassignment")
  );
}
function isTaxReportRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/finance/accounts_report/tax_report") || normalized.includes("/finance/accounts/reports/tax-report");
}

function isBalanceSheetRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return (
    normalized.includes("/finance/finance/accounts_report/balance_sheet/balance_sheet") ||
    normalized.includes("/finance/finance/accounts_report/balance_sheet") ||
    normalized.includes("/finance/accounts_report/balance_sheet/balance_sheet") ||
    normalized.includes("/finance/accounts_report/balance_sheet") ||
    normalized.includes("/finance/accounts/reports/account-report/balance-sheet")
  );
}

function isAcStatementRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/finance/accounts_report/detailed_reports/a/c_statement") ||
         normalized.includes("/finance/accounts_report/detailed_reports/a%2fc_statement") ||
         normalized.includes("/finance/accounts/reports/account-report/detailed-reports/a/c-statement");
}

function isOutstandingStatementRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/finance/accounts_report/detailed_reports/outstanding_statement") ||
         normalized.includes("/finance/accounts_report/detailed_reports/outstanding-statement") ||
         normalized.includes("/finance/accounts/reports/account-report/detailed-reports/outstanding-statement");
}


function isAgeingReportRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/finance/accounts_report/ageing/period_wise") || normalized.includes("/finance/accounts/reports/ageing/period_wise/PeriodWisePage");
}

function isHrJoiningRoute(context: WorkspaceRouteContext) {
  const normalized = getHrMatchText(context);
  const compact    = normalized.replace(/[^a-z0-9]/g, "");
  return (
    compact.includes("hrjoining") ||
    compact.includes("joiningform") ||
    compact.includes("hrjoin") ||
    normalized.includes("hr_joining") ||
    normalized.includes("joining_form") ||
    normalized.includes("cam_join")
  );
}

function isHrEmployeeInformationRoute(context: WorkspaceRouteContext) {
  const normalized = getHrMatchText(context);
  const compact = normalized.replace(/[^a-z0-9]/g, "");

  return (
    compact.includes("employeeinformation") ||
    normalized.includes("employee_information") ||
    normalized.includes("employee-information")
  );
}

function isHrEmpEducationRoute(context: WorkspaceRouteContext) {
  const normalized = getHrMatchText(context);
  const compact    = normalized.replace(/[^a-z0-9]/g, "");
  return (
    compact.includes("empeducation") ||
    compact.includes("educationqualification") ||
    normalized.includes("emp_education") ||
    normalized.includes("educational_qualification") ||
    normalized.includes("education_qualification")
  );
}

function isHrManpowerRequisitionRoute(context: WorkspaceRouteContext) {
  const normalized = getHrMatchText(context);
  const compact    = normalized.replace(/[^a-z0-9]/g, "");
  return (
    compact.includes("manpowerrequisition") ||
    compact.includes("confirmationreview") ||
    normalized.includes("manpower_requisition") ||
    normalized.includes("manpower-requisition") ||
    normalized.includes("confirmation_review")
  );
}

function isHrContinuousAutoMemoRoute(context: WorkspaceRouteContext) {
  const normalized = getHrMatchText(context);
  const compact    = normalized.replace(/[^a-z0-9]/g, "");
  return (
    compact.includes("continousautomemo") ||
    normalized.includes("continous_auto_memo") ||
    normalized.includes("continous_auto_memo")
  );
}

function isHrApplicantInfoRoute(context: WorkspaceRouteContext) {
  const normalized = getHrMatchText(context);
  const compact    = normalized.replace(/[^a-z0-9]/g, "");
  return (
    compact.includes("applicantinfo") ||
    compact.includes("applicantinformation") ||
    normalized.includes("applicant_info") ||
    normalized.includes("applicant-info")
  );
}


function isHrInterviewEvalRoute(context: WorkspaceRouteContext) {
  const normalized = getHrMatchText(context);
  const compact    = normalized.replace(/[^a-z0-9]/g, "");
  return (
    compact.includes("intervieweval") ||
    compact.includes("interviewevaluation") ||
    normalized.includes("interview_eval") ||
    normalized.includes("int_eval")
  );
}



function getCreditDebitNoteDocType(pathname: string) {
  const normalized = pathname.toLowerCase();
  if (
    normalized.includes("/finance/accounts/transactions/credit-note") ||
    normalized.includes("/finance/accounts/transactions/credit_note") ||
    normalized.includes("/finance/accounts/transactions/creditnote") ||
    normalized.includes("/finance/accounts/transactions/cn")
  ) return "CN" as const;
  if (
    normalized.includes("/finance/accounts/transactions/debit-note") ||
    normalized.includes("/finance/accounts/transactions/debit_note") ||
    normalized.includes("/finance/accounts/transactions/debitnote") ||
    normalized.includes("/finance/accounts/transactions/dn")
  ) return "DN" as const;
  return null;
}

function getTransactionDocType(pathname: string) {
  const normalized = pathname.toLowerCase();
  if (normalized.includes("/finance/accounts/transactions/cheque-payment")) return "BP" as const;
  if (normalized.includes("/finance/accounts/transactions/cheque-receipt")) return "BR" as const;
  if (normalized.includes("/finance/accounts/transactions/cash-receipt")) return "CR" as const;
  if (
    normalized.includes("/finance/accounts/transactions/petty_cash_payment") ||
    normalized.includes("/finance/accounts/transactions/petty-cash-payment")
  ) return "CP" as const;
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


function isRVoucherRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return (
    normalized.includes("/finance/accounts/transactions/rjv") ||
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

function isStockTransferRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return (
    normalized.includes("wms/activity/request/stock_transfer") &&
    !normalized.includes("/view/")  // ← add this
  );
}
function isInvoiceRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("wms/activity/request/invoice");
}
function isFreightInvoiceRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/freight_invoice/invoice");
}
function isStockAdjustmentRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("wms/activity/request/stock_adj") && !normalized.includes("/view/");
}



function isTransactionReportRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/wms/reports/stock%20report/transaction_report") ||
         normalized.includes("/wms/reports/stock%20report/transaction-report");
}
function isStockCountRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("wms/activity/stock_count") && !normalized.includes("/view/");
}
function isStockTransferViewRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return (
    normalized.includes("wms/activity/request/stock_transfer") &&
    normalized.includes("/view/")
  );
}

function isJobListingRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return (
    normalized.includes("/wms/reports/stock%20report/job_listing") ||
    normalized.includes("/wms/reports/stock-report/job_listing") ||
    normalized.includes("/wms/reports/stock-report/job-listing")
  );
}
function isStockSummaryRoute(pathname: string) {  
  const normalized = pathname.toLowerCase();
  const stockReportPath =
    normalized.includes("/wms/wms/reports/stock%20report/") ||
    normalized.includes("/wms/wms/reports/stock_report/") ||
    normalized.includes("/wms/wms/reports/stock-report/") ||
    normalized.includes("/wms/wms/reports/stockreport/") ||
    normalized.includes("/wms/reports/stock%20report/") ||
    normalized.includes("/wms/reports/stock_report/") ||
    normalized.includes("/wms/reports/stock-report/") ||
    normalized.includes("/wms/reports/stockreport/");

  const stockSummarySegment =
    normalized.includes("/stock_summary") ||
    normalized.includes("/stock-summary") ||
    normalized.includes("/stock_detail");

  return stockReportPath && stockSummarySegment;
}

function isStockAgeingQuantityRoute(pathname: string) {
  const normalized = pathname.toLowerCase();

  return (
    normalized.includes("/wms/wms/reports/stock%20report/stock_ageing_quantity") ||
    normalized.includes("/wms/wms/reports/stock_report/stock_ageing_quantity") ||
    normalized.includes("/wms/wms/reports/stock-report/stock_ageing_quantity") ||

    normalized.includes("/wms/reports/stock%20report/stock_ageing_quantity") ||
    normalized.includes("/wms/reports/stock_report/stock_ageing_quantity") ||
    normalized.includes("/wms/reports/stock-report/stock_ageing_quantity")
  );
}

function isStockAgeingVolumeRoute(pathname: string) {
  const normalized = pathname.toLowerCase();

  return (
    normalized.includes("/wms/wms/reports/stock%20report/stock_ageing_volume") ||
    normalized.includes("/wms/wms/reports/stock_report/stock_ageing_volume") ||
    normalized.includes("/wms/wms/reports/stock-report/stock_ageing_volume") ||

    normalized.includes("/wms/reports/stock%20report/stock_ageing_volume") ||
    normalized.includes("/wms/reports/stock_report/stock_ageing_volume") ||
    normalized.includes("/wms/reports/stock-report/stock_ageing_volume")
  );
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

function isProfitLossRoute(pathname:string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/finance/finance/accounts_report/profit_and_loss/profit_and_loss")
}


function isDnRoute(pathname:string) {  
  const normalized = pathname.toLowerCase();
  return normalized.includes("/wms/wms/reports/summary%20report/dn_summary")
   || normalized.includes("/wms/wms/reports/summary_report/dn_summary");
}

function isGrnRoute(pathname:string) {  
  const normalized = pathname.toLowerCase();
  return normalized.includes("/wms/wms/reports/summary%20report/grn_summary")
   || normalized.includes("/wms/wms/reports/summary_report/grn_summary");
}

function isVisaExpiryListingRoute(pathname:string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("hr/reports/employee/visa_expiry_listing") || 
          normalized.includes("hr/reports/employee/visa-expiry-listing");
}


function isHrAccuralAccountSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes(
    "/workspace/hcm/hcm/pay%20components/accural%20account%20setup"
  );
}

function isWmsCountryRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/wms/") && normalized.includes("/country");
}
function isWmsBillingActRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/wms/") && normalized.includes("/principal_masters") && (normalized.includes("/billing_activity"));
}
function isWmsInboundRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  if (!normalized.includes("/wms/")) return false;

  const isListing =
    normalized.includes("/inbound") &&
    (normalized.includes("/jobs") || normalized.includes("/inboundjob"));

  // Only match /view/ if it's under an inbound path OR the job no starts with ib
  const isDetail =
    normalized.includes("/inbound") && normalized.includes("/view/");

  return isListing || isDetail;
}

function isWmsOutboundRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  if (!normalized.includes("/wms/")) return false;

  const isListing =
    normalized.includes("/outbound") &&
    (normalized.includes("/jobs") || normalized.includes("/job") || normalized.includes("jobs_oub"));

  const isDetail =
    normalized.includes("/outbound") && normalized.includes("/view/");

  return isListing || isDetail;
}

function getWmsSimpleMasterConfig(pathname: string) {
  const normalized = pathname.toLowerCase();
  if (!normalized.includes("/wms/")) return null;
  const matches = Object.values(wmsSimpleMasterConfigs)
    .flatMap((config) => (config.routeKeys || [config.master]).map((key) => ({ config, key: key.toLowerCase() })))
    .sort((a, b) => b.key.length - a.key.length);
  return matches.find(({ key }) => normalized.includes(`/${key}`) || normalized.includes(`/${key.replace(/_/g, "-")}`))?.config || null;
}

function getFreightMasterConfig(context: WorkspaceRouteContext) {
  const matchText = getGenericMatchText(context);
  const compact = matchText.replace(/[^a-z0-9]/g, "");
  const isFreight =
    matchText.includes("/freight") ||
    compact.includes("freight") ||
    compact.includes("frieght");

  if (!isFreight) return null;

  const matches = Object.values(freightMasterConfigs)
    .flatMap((config) => (config.routeKeys || [config.master]).map((key) => ({ config, key: key.toLowerCase() })))
    .sort((a, b) => b.key.length - a.key.length);

  return matches.find(({ key }) => {
    const hyphenKey = key.replace(/_/g, "-");
    const keyCompact = key.replace(/[^a-z0-9]/g, "");
    return matchText.includes(`/${key}`) || matchText.includes(`/${hyphenKey}`) || matchText.includes(key) || compact.includes(keyCompact);
  })?.config || null;
}

function getWorkspaceRouteKey(context: WorkspaceRouteContext) {
  const activeLeaf = getActiveLeaf(context);
  const leafRecord = (activeLeaf || {}) as Record<string, unknown>;
  const appRecord = (context.activeApp || {}) as Record<string, unknown>;
  return [
    context.pathname.toLowerCase(),
    String(leafRecord.menu_id || leafRecord.MENU_ID || leafRecord.menu_code || leafRecord.MENU_CODE || leafRecord.route || leafRecord.path || leafRecord.name || ""),
    String(appRecord.app_code || appRecord.APP_CODE || appRecord.name || ""),
  ].join("|");
}

function isFreightWorkspaceRoute(context: WorkspaceRouteContext) {
  const pathname = context.pathname.toLowerCase();
  const matchText = getGenericMatchText(context);
  const compact = matchText.replace(/[^a-z0-9]/g, "");
  return (
    pathname === "/workspace/fms/fms" ||
    pathname === "/workspace/fms/fms/" ||
    matchText.includes("/freight") ||
    compact.includes("freight") ||
    compact.includes("frieght") ||
    compact.includes("freightenquirymainpage")
  );
}

function getFreightReportKey(context: WorkspaceRouteContext): FreightReportKey | null {
  const compact = getGenericMatchText(context).replace(/[^a-z0-9]/g, "");
  if (!compact.includes("freightreports")) return null;
  if (compact.includes("enquirylist") || compact.includes("equirylist")) return "enquiry_list";
  if (compact.includes("rfqlist")) return "rfq_list";
  if (compact.includes("quotationlist") || compact.includes("quotationtable")) return "quotation_list";
  if (compact.includes("freightjoblist") || compact.includes("joblist")) return "freight_job_list";
  if (compact.includes("freightprofit") || compact.includes("profit")) return "freight_profit";
  if (compact.includes("freightexpense") || compact.includes("expense")) return "freight_expense";
  if (compact.includes("freightrevenue") || compact.includes("revenue")) return "freight_revenue";
  if (compact.includes("freightbrokerage") || compact.includes("brokerage")) return "freight_brokerage";
  if (compact.includes("queryreport") || compact.includes("packquery")) return "query_report";
  if (compact.includes("freightsummaryreport") || compact.includes("summaryreport") || compact.includes("modewisesummary")) return "freight_summary";
  if (compact.includes("containerdeposit") || compact.includes("contrdeposit")) return "container_deposit";
  if (compact.includes("deposits") || compact.includes("deposit")) return "deposits";
  return null;
}

function isFreightEnquiryRoute(context: WorkspaceRouteContext) {
  const matchText = getGenericMatchText(context);
  const compact = matchText.replace(/[^a-z0-9]/g, "");
  if (compact.includes("enquiryactivities") || compact.includes("enquirylist")) return false;
  return (
    compact.includes("freightenquirymainpage") ||
    compact.includes("freightfreightenquiryenquiry") ||
    compact.includes("freightfreightenquiryenquir") ||
    (compact.includes("freightenquiry") && !compact.includes("requestquote") && !compact.includes("quotation"))
  );
}

function isFreightEnquiryActivitiesRoute(context: WorkspaceRouteContext) {
  const matchText = getGenericMatchText(context);
  const compact = matchText.replace(/[^a-z0-9]/g, "");
  return compact.includes("freightfreightenquiryenquiryactivities") || compact.includes("freightenquiryactivities");
}

function isFreightRfqRoute(context: WorkspaceRouteContext) {
  const matchText = getGenericMatchText(context);
  const compact = matchText.replace(/[^a-z0-9]/g, "");
  if (compact.includes("rfqactivities") || compact.includes("rfqlist")) return false;
  return compact.includes("freightrequestquoterfq") || compact.includes("requestquoterfq") || compact.includes("rfqtest");
}

function isFreightRfqActivitiesRoute(context: WorkspaceRouteContext) {
  const matchText = getGenericMatchText(context);
  const compact = matchText.replace(/[^a-z0-9]/g, "");
  return compact.includes("freightrequestquoterfqactivities") || compact.includes("requestquoterfqactivities") || compact.includes("rfqactivities");
}

function isFreightQuotationRoute(context: WorkspaceRouteContext) {
  const matchText = getGenericMatchText(context);
  const compact = matchText.replace(/[^a-z0-9]/g, "");
  if (compact.includes("airlinetarriff") || compact.includes("airlinetariff") || compact.includes("quotationlist")) return false;
  return compact.includes("freightfreightquotationquotation")
    || compact.includes("freightquotationquotation")
    || compact.includes("freightfreightquotationactivities")
    || compact.includes("freightquotationactivities")
    || compact.includes("freightfreightquotationtermscondition")
    || compact.includes("freightquotationtermscondition")
    || compact.includes("termscondition");
}

function isFreightAirlineTariffRoute(context: WorkspaceRouteContext) {
  const compact = getGenericMatchText(context).replace(/[^a-z0-9]/g, "");
  if (compact.includes("report")) return false;
  return compact.includes("freightfreightquotationairlinetarriff")
    || compact.includes("freightfreightquotationairlinetariff")
    || compact.includes("airlinetarriff");
}

function isFreightAirlineTariffReportRoute(context: WorkspaceRouteContext) {
  const compact = getGenericMatchText(context).replace(/[^a-z0-9]/g, "");
  return compact.includes("airlinetarriffreport") || compact.includes("airlinetariffreport");
}

function isFreightPacklistRoute(context: WorkspaceRouteContext) {
  const compact = getGenericMatchText(context).replace(/[^a-z0-9]/g, "");
  return (compact.includes("freightair") || compact.includes("freightsea") || compact.includes("freightroad"))
    && (compact.includes("packlist") || compact.includes("packinglist"))
    && !compact.includes("jobsheet");
}

function isFreightJobSheetRoute(context: WorkspaceRouteContext) {
  const compact = getGenericMatchText(context).replace(/[^a-z0-9]/g, "");
  return (compact.includes("freightair") || compact.includes("freightsea") || compact.includes("freightroad"))
    && compact.includes("jobsheet");
}

function isFreightJobFollowupRoute(context: WorkspaceRouteContext, kind: "alerts" | "instructions" | "documents" | "deposits") {
  const compact = getGenericMatchText(context).replace(/[^a-z0-9]/g, "");
  if (!(compact.includes("freightair") || compact.includes("freightsea") || compact.includes("freightroad"))) return false;
  if (kind === "alerts") return compact.includes("alerts") || compact.includes("alert");
  if (kind === "instructions") return compact.includes("instructions") || compact.includes("instruction");
  if (kind === "documents") return compact.includes("documents") || compact.includes("document");
  return compact.includes("deposits") || compact.includes("deposit");
}

function isFreightServiceActivitiesRoute(context: WorkspaceRouteContext) {
  const compact = getGenericMatchText(context).replace(/[^a-z0-9]/g, "");
  return compact.includes("serviceactivities") || compact.includes("costsheet");
}

function isFreightOperationalJobRoute(context: WorkspaceRouteContext) {
  const compact = getGenericMatchText(context).replace(/[^a-z0-9]/g, "");
  if (
    compact.includes("packlist")
    || compact.includes("packinglist")
    || compact.includes("serviceactivities")
    || compact.includes("costsheet")
    || compact.includes("jobsheet")
    || compact.includes("alerts")
    || compact.includes("alert")
    || compact.includes("instructions")
    || compact.includes("instruction")
    || compact.includes("documents")
    || compact.includes("document")
    || compact.includes("deposits")
    || compact.includes("deposit")
  ) return false;
  return (compact.includes("freightair") || compact.includes("freightsea") || compact.includes("freightroad"))
    && (compact.includes("import") || compact.includes("export") || compact.includes("reexport"));
}

function getFreightQuotationInitialTab(context: WorkspaceRouteContext) {
  const matchText = getGenericMatchText(context);
  const compact = matchText.replace(/[^a-z0-9]/g, "");
  if (compact.includes("activities")) return "charges" as const;
  if (compact.includes("termscondition") || compact.includes("terms")) return "terms" as const;
  return "cargo" as const;
}

function getFreightWorkspaceTarget(context: WorkspaceRouteContext) {
  const matchText = getGenericMatchText(context);
  const compact = matchText.replace(/[^a-z0-9]/g, "");
  return {
    process: compact.includes("rfq") || compact.includes("requestquote") || compact.includes("requestforquote")
      ? "rfq" as const
      : compact.includes("quotation") || compact.includes("freightquotation") || compact.includes("airlinetarriff")
        ? "quotation" as const
        : "enquiry" as const,
    direction: compact.includes("reexport") || compact.includes("importforreexport")
      ? "reexport" as const
      : compact.includes("export")
        ? "export" as const
        : "import" as const,
    mode: compact.includes("sea")
      ? "sea" as const
      : compact.includes("road") || compact.includes("land")
        ? "land" as const
        : "air" as const,
    action: compact.includes("freightreports") || compact.includes("enquirylist") || compact.includes("rfqlist") || compact.includes("quotationlist")
      ? "reports"
      : compact.includes("costsheet")
      ? "cost-sheet"
      : compact.includes("jobsheet")
        ? "job-sheet"
        : compact.includes("document")
          ? "documents"
          : "job",
  };
}

function getAlmsSimpleMasterConfig(pathname: string) {
  const normalized = pathname.toLowerCase();
  if (!normalized.includes("/almswf/")) return null;
  const matches = Object.values(AlmsSimpleMasterConfigs)
    .flatMap((config) => (config.routeKeys || [config.master]).map((key) => ({ config, key: key.toLowerCase() })))
    .sort((a, b) => b.key.length - a.key.length);
  return matches.find(({ key }) => normalized.includes(`/${key}`) || normalized.includes(`/${key.replace(/_/g, "-")}`))?.config || null;
}

function isAlmsRoute(pathname: string) {
  return pathname.toLowerCase().includes("/almswf/");
}

function isMyTaskRoute(context: WorkspaceRouteContext) {
  const normalized = getGenericMatchText(context);
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  return (
    isAlmsRoute(context.pathname) &&
    (normalized.includes("/my_task") ||
      normalized.includes("/my-task") ||
      compact.includes("mytask")) &&
    !normalized.includes("/view/") &&
    !normalized.includes("/edit/")
  );
}

function isCreditRequestTaskRoute(context: WorkspaceRouteContext) {
  const normalized = getGenericMatchText(context);
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  return (
    isAlmsRoute(context.pathname) &&
    (normalized.includes("/credit_request") ||
      normalized.includes("/credit-request") ||
      compact.includes("creditrequest")) &&
    !normalized.includes("/view/") &&
    !normalized.includes("/edit/")
  );
}



function isCapexRequestTaskRoute(context: WorkspaceRouteContext) {
  const normalized = getGenericMatchText(context);
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  return (
    isAlmsRoute(context.pathname) &&
    (normalized.includes("/capex") ||
      normalized.includes("/capex-request") ||
      compact.includes("capexrequest")) &&
    !normalized.includes("/view/") &&
    !normalized.includes("/edit/")
  );
}



function isPurchaseRequestTaskRoute(context: WorkspaceRouteContext) {
  const normalized = getGenericMatchText(context);
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  return (
    isAlmsRoute(context.pathname) &&
    (normalized.includes("/purchase_request") ||
      normalized.includes("/purchase-request") ||
      compact.includes("purchaserequest")) &&
    !normalized.includes("/view/") &&
    !normalized.includes("/edit/")
  );
}

function isAlmsMyTaskTabRoute(context: WorkspaceRouteContext, tabKeys: string[]) {
  if (!isMyTaskRoute(context)) return false;
  const normalized = getGenericMatchText(context);
  return tabKeys.some((key) => normalized.includes(`/${key}`));
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

function isPamsAppraisalWeightageRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes("/appraisal_weightage") || 
         normalized.includes("/appraisal_weightage");
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
  const activeLeaf = getActiveLeaf(context);
  return buildRouteMatchText(pathname, context.activeApp, activeLeaf);
}

function getGenericMatchText(context: WorkspaceRouteContext) {
  const pathname = context.pathname.toLowerCase();
  const activeLeaf = getActiveLeaf(context);
  return buildRouteMatchText(pathname, context.activeApp, activeLeaf);
}

function isVendorRoute(context: WorkspaceRouteContext) {
  return isVendorRouteText(getGenericMatchText(context));
}

function isSmsRoute(context: WorkspaceRouteContext) {
  const matchText = getGenericMatchText(context);
  return matchText.includes("/sms/") || matchText.includes(" sms ") || matchText.startsWith("sms ");
}

function getSmsMasterConfig(context: WorkspaceRouteContext) {
  if (!isSmsRoute(context)) return null;
  const matchText = getGenericMatchText(context);
  const compact = matchText.replace(/[^a-z0-9]/g, "");
  const matches = Object.values(smsMasterConfigs)
    .flatMap((config) => config.routeKeys.map((key) => ({ config, key: key.toLowerCase() })))
    .sort((a, b) => b.key.length - a.key.length);
  return matches.find(({ key }) => {
    const keyCompact = key.replace(/[^a-z0-9]/g, "");
    return matchText.includes(`/${key}`) || matchText.includes(`/${key.replace(/_/g, "-")}`) || matchText.includes(key) || compact.includes(keyCompact);
  })?.config || null;
}

function isApplicationProgressRoute(context: WorkspaceRouteContext) {
  const matchText = getGenericMatchText(context);
  const compact = matchText.replace(/[^a-z0-9]/g, "");
  return (
    compact.includes("applicationprogress") ||
    compact.includes("appprogress") ||
    matchText.includes("app_progress") ||
    matchText.includes("application_progress")
  );
}

function isOxMaintRoute(context: WorkspaceRouteContext) {
  const matchText = getGenericMatchText(context);
  const compact = matchText.replace(/[^a-z0-9]/g, "");
  return (
    matchText.includes("/oxmaint") ||
    compact.includes("oxmaint") ||
    compact.includes("assetinventory") ||
    compact.includes("assettype") ||
    compact.includes("siteproject") ||
    compact.includes("status")
  );
}

function getOxMaintElement(context: WorkspaceRouteContext) {
  const matchText = getGenericMatchText(context);
  const compact = matchText.replace(/[^a-z0-9]/g, "");
  if (compact.includes("assettype")) return <OxSimpleMasterPage config={oxMaintMasterConfigs.assetType} />;
  if (compact.includes("siteproject")) return <OxSimpleMasterPage config={oxMaintMasterConfigs.siteProject} />;
  if (compact.includes("status")) return <OxSimpleMasterPage config={oxMaintMasterConfigs.status} />;
  return <OxMaintDashboard />;
}

function getHrMasterConfig(context: WorkspaceRouteContext) {
  const matchText = getHrMatchText(context);
  if (!isHrRoute(context)) return null;
  const compact = matchText.replace(/[^a-z0-9]/g, "");
  const matches = Object.values(hrMasterConfigs)
    .flatMap((config) => (config.routeKeys || [config.master]).map((key) => ({ config, key: key.toLowerCase() })))
    .sort((a, b) => b.key.length - a.key.length);
  return matches.find(({ key }) => {
    const keyCompact = key.replace(/[^a-z0-9]/g, "");
    return matchText.includes(`/${key}`) || matchText.includes(`/${key.replace(/_/g, "-")}`) || matchText.includes(key) || compact.includes(keyCompact);
  })?.config || null;
}

function getHrMatchText(context: WorkspaceRouteContext) {
  const pathname = decodeRouteText(context.pathname).toLowerCase();
  const activeLeaf = getActiveLeaf(context);
  return buildRouteMatchText(pathname, context.activeApp, activeLeaf);
}

function getActiveLeaf(context: WorkspaceRouteContext) {
  if (context.activeMenu) return context.activeMenu;
  const pathname = decodeRouteText(context.pathname).toLowerCase();
  const leaves = collectMenuLeaves(context.activeApp?.children || []);
  return leaves.find((leaf) => {
    const path = decodeRouteText((leaf.url_path || "").replace(/^\/+/, "")).toLowerCase();
    return path && pathname.includes(path);
  });
}

function buildRouteMatchText(pathname: string, activeApp?: MenuNode, activeLeaf?: MenuNode) {
  return [
    pathname,
    activeApp?.title,
    activeApp?.url_path,
    activeApp?.component_name,
    activeApp?.componentName,
    activeLeaf?.title,
    activeLeaf?.url_path,
    activeLeaf?.component_name,
    activeLeaf?.componentName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isHrRoute(context: WorkspaceRouteContext) {
  const matchText = getHrMatchText(context);
  const compact = matchText.replace(/[^a-z0-9]/g, "");
  return (
    matchText.includes("/hr/") ||
    matchText.includes("/hcm/") ||
    matchText.includes("/ems/") ||
    matchText.includes(" hr ") ||
    matchText.includes(" hcm ") ||
    matchText.includes(" ems ") ||
    matchText.includes("human") ||
    matchText.includes("employee management") ||
    compact.includes("employeemanagement") ||
    compact.includes("humancapitalmanagement")
  );
}

function isLeaveFlowRoute(context: WorkspaceRouteContext, key: LeaveFlowKey) {
  if (!isHrRoute(context)) return false;
  const config = leaveFlowConfigList.find((item) => item.key === key);
  if (!config) return false;
  const compact = getHrMatchText(context).replace(/[^a-z0-9]/g, "");
  return config.routeTokens.some((token) => compact.includes(token));
}

function decodeRouteText(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isHrPayrollProcessRoute(context: WorkspaceRouteContext) {
  const compact = getHrMatchText(context).replace(/[^a-z0-9]/g, "");
  return compact.includes("payrollprocessing") || compact.includes("payrollprocess") || compact.includes("payrollprocesspage");
}

function isHrPayUnitsRoute(context: WorkspaceRouteContext) {
  const compact = getHrMatchText(context).replace(/[^a-z0-9]/g, "");
  return (compact.includes("payunits") || compact.includes("payunit")) && !compact.includes("depend");
}

function isHrPayUnitsDependantRoute(context: WorkspaceRouteContext) {
  const compact = getHrMatchText(context).replace(/[^a-z0-9]/g, "");
  return compact.includes("payunitsdependant") || compact.includes("payunitdependant") || compact.includes("payunitsdependent") || compact.includes("payunitdependent");
}

function isHrLeaveCancelRoute(context: WorkspaceRouteContext) {
  const compact = getHrMatchText(context).replace(/[^a-z0-9]/g, "");
  return compact.includes("leavecancel") || compact.includes("leavecancellation") || compact.includes("pgleaveflowcancel");
}

function isHrEmployeePayslipRoute(context: WorkspaceRouteContext) {
  const compact = getHrMatchText(context).replace(/[^a-z0-9]/g, "");
  return (
    !compact.includes("employeepayslipview") &&
    !compact.includes("viewpayslipreport") &&
    (compact.includes("employeepayslip") || compact.includes("hrpayslips") || compact.includes("payslip"))
  );
}

function isHrEmployeePayslipViewRoute(context: WorkspaceRouteContext) {
  const compact = getHrMatchText(context).replace(/[^a-z0-9]/g, "");
  return compact.includes("employeepayslipview") || compact.includes("viewpayslipreport");
}

function isHrLeaveRegisterRoute(context: WorkspaceRouteContext) {
  const compact = getHrMatchText(context).replace(/[^a-z0-9]/g, "");
  return compact.includes("leaveregister") || compact.includes("hremployeeregistermainpage");
}

function isHrLeaveResumptionRoute(context: WorkspaceRouteContext) {
  const compact = getHrMatchText(context).replace(/[^a-z0-9]/g, "");
  return compact.includes("leaveresumption") || compact.includes("hrleaveresumptionmainpage");
}

function isHrEmployeeProfileRoute(context: WorkspaceRouteContext) {
  const compact = getHrMatchText(context).replace(/[^a-z0-9]/g, "");
  return compact.includes("employeeprofile") || compact.includes("employeemaster") || compact.includes("hremployeeprofile");
}

function isHrPayrollAccountSetupRoute(context: WorkspaceRouteContext) {
  const compact = getHrMatchText(context).replace(/[^a-z0-9]/g, "");
  return compact.includes("payrollaccountsetup") || compact.includes("payrollaccountssetup") || compact.includes("payrollacsetup");
}

function isHrMemosAndFormsWarningLetterRoute(context: WorkspaceRouteContext) {
  const normalized = getHrMatchText(context);
  return (
    (normalized.includes("memos") || normalized.includes("memo_and_forms") || normalized.includes("memo-and-forms") || normalized.includes("memosandforms") || normalized.includes("memo and forms")) &&
    (normalized.includes("forms") || normalized.includes("memo_and_forms") || normalized.includes("memo-and-forms") || normalized.includes("memo and forms")) &&
    (normalized.includes("warning letter") || normalized.includes("warning-letter") || normalized.includes("warning_letter") || normalized.includes("warning"))
  );
}

function isHrTrainingFeedbackRoute(context: WorkspaceRouteContext) {
  const normalized = getHrMatchText(context);
  const compact    = normalized.replace(/[^a-z0-9]/g, "");
  return (
    compact.includes("trainingfeedback") ||
    normalized.includes("training_feedback") ||
    normalized.includes("training-feedback")
  );
}

function isProductTypeRoute(pathname: string) {
  const normalized = pathname.toLowerCase();

  return (
    normalized.includes("/purchase_sales/purchase_sales/masters/product%20type") ||
    normalized.includes("/purchase_sales/purchase_sales/masters/product_type") ||
    normalized.includes("/purchase_sales/purchase_sales/masters/product-type")
  );
}


function isProductCategoryRoute(pathname: string) {
  const normalized = pathname.toLowerCase();

  return (
    normalized.includes("/purchase_sales/purchase_sales/masters/product%20category") ||
    normalized.includes("/purchase_sales/purchase_sales/masters/product_category") ||
    normalized.includes("/purchase_sales/purchase_sales/masters/product-category")
  );
}


function isZoneMasterRoute(pathname: string) {
  const normalized = pathname.toLowerCase();

  return (
    normalized.includes("/purchase_sales/purchase_sales/masters/zone%20master") ||
    normalized.includes("/purchase_sales/purchase_sales/masters/zone_master") ||
    normalized.includes("/purchase_sales/purchase_sales/masters/zone-master")
  );
}

function isStockInquiryRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return normalized.includes(
    "/workspace/purchase_sales/purchase_sales/inquiry/stock%20inquiry"
  );
}

function isProductBomRoute(pathname: string) {
  const normalized = pathname.toLowerCase();

  return (
    normalized.includes("/purchase_sales/purchase_sales/masters/product_bom") ||
    normalized.includes("/purchase_sales/purchase_sales/masters/product%20bom") ||
    normalized.includes("/purchase_sales/purchase_sales/masters/product-bom")
  );
}

function isHrEmployeePayUnitsRoute(context: WorkspaceRouteContext) {
  const compact = getHrMatchText(context).replace(/[^a-z0-9]/g, "");

  return (
    compact.includes("employeepayunits") ||
    compact.includes("employee_payunits")
  );
}
