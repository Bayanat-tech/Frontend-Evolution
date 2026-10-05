export interface DashboardSummary {
  totalPRequest: number;
  totalQuotation: number;
  totalPOrder: number;
  totalGrn: number;
  pOrderGrnPending: number;
  totalInvoice: number;
  invoicePending: number;
  totalSOrder: number;
  totalSdn: number;
  sOrderSdnPending: number;
  totalSInvoice: number;
  sInvoicePending: number;
}

// NOTE: the live API returns camelCase keys (supplierCode, totalAmount, month),
// not the UPPERCASE Oracle column names. Types match the real payload.
export interface Supplier {
  supplierCode: string;
  totalAmount: number;
  supplierName:string
}

export interface Customer {
  customerCode: string;
  totalAmount: number;
  customerName: string;
}

export interface MonthlyAmount {
  month: string; // e.g. "SEP-2026"
  totalAmount: number;
}

export interface PurchaseSalesDashboardData {
  summary: DashboardSummary;
  topSuppliers: Supplier[];
  topCustomers: Customer[];
  monthlyPurchase: MonthlyAmount[];
  monthlySales: MonthlyAmount[];
}

export interface DashboardResponse {
  success: boolean;
  data: PurchaseSalesDashboardData;
  message?: string;
}