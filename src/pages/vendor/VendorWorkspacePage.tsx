import { ColumnDef } from "@tanstack/react-table";
import {
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileClock,
  FileSearch,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Truck,
  Undo2,
  XCircle,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  createVendorRegistration,
  executeVendorInvoicePrint,
  executeVendorSql,
  getPendingVendorLpo,
  getPendingVendorLpoDetail,
  getVendorAccounts,
  getVendorInvoiceStatus,
  getVendorOutstanding,
  getVendorRequest,
  saveVendorRequest,
  updateVendorLpoStatus,
  type VendorRow,
} from "../../api/vendor";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

type VendorView =
  | "dashboard"
  | "requests"
  | "approvals"
  | "registration"
  | "profile"
  | "outstanding"
  | "status"
  | "statement"
  | "account-entry"
  | "sent-back"
  | "closed";

type RequestTab = "drafts" | "submitted" | "rejected" | "closed";
type ApprovalTab = "pending" | "in-progress" | "sent-back" | "rejected" | "closed";

type Notice = { type: "success" | "error"; message: string } | null;

const requestTabs: { key: RequestTab; label: string; icon: typeof FileText }[] = [
  { key: "drafts", label: "Draft / Sent Back", icon: FileText },
  { key: "submitted", label: "In Progress", icon: FileClock },
  { key: "rejected", label: "Rejected", icon: XCircle },
  { key: "closed", label: "Closed", icon: CheckCircle2 },
];

const approvalTabs: { key: ApprovalTab; label: string; icon: typeof FileText }[] = [
  { key: "pending", label: "Pending Approval", icon: ShieldCheck },
  { key: "in-progress", label: "Approval Progress", icon: FileClock },
  { key: "sent-back", label: "Sent Back", icon: Undo2 },
  { key: "rejected", label: "Rejected", icon: XCircle },
  { key: "closed", label: "Approved / Closed", icon: CheckCircle2 },
];

const today = () => new Date().toISOString().slice(0, 10);

const requestDefaults = (companyCode: string, loginid: string): VendorRow => ({
  COMPANY_CODE: companyCode,
  DOC_TYPE: "LPO",
  DOC_NO: "",
  DOC_DATE: today(),
  AC_CODE: loginid,
  REF_NO: "",
  REF_DATE: today(),
  REMARKS: "",
  CURR_CODE: "",
  EX_RATE: 1,
  PAYMENT_TERMS: "",
  CREDIT_PERIOD: "",
  INVOICE_NUMBER: "",
  INVOICE_DATE: today(),
  DELIVERY_TO: "",
  DLVR_CONTACT: "",
  DLVR_EMAIL: "",
  DLVR_MOBILE: "",
  DLVR_TERM: "",
  DIV_CODE: "",
  LAST_ACTION: "SAVEASDRAFT",
  items: [],
});

const vendorDefaults = (companyCode: string, loginid: string): VendorRow => ({
  COMPANY_CODE: companyCode,
  AC_CODE: loginid,
  CR_NUMBER: "",
  VENDOR_CODE: "",
  VENDOR_NAME: "",
  VENDOR_ADDR1: "",
  VENDOR_ADDR2: "",
  VENDOR_ADDR3: "",
  VENDOR_ADDR4: "",
  VENDOR_CITY: "",
  VENDOR_CONTACT1: "",
  VENDOR_TELNO1: "",
  VENDOR_FAXNO1: "",
  VENDOR_EMAIL1: "",
  VENDOR_CONTACT2: "",
  VENDOR_TELNO2: "",
  VENDOR_FAXNO2: "",
  VENDOR_EMAIL2: "",
  VENDOR_CONTACT3: "",
  VENDOR_TELNO3: "",
  VENDOR_FAXNO3: "",
  VENDOR_REF1: "",
  VENDOR_REF2: "",
  VENDOR_REF3: "",
  CURR_CODE: "",
  COUNTRY_CODE: "",
  SERVICE_DATE: today(),
  SECLOGINID: loginid,
});

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function display(value: unknown) {
  const rendered = text(value);
  return rendered || "-";
}

function numberValue(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function money(value: unknown) {
  const num = numberValue(value);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sqlString(value: unknown) {
  return String(value ?? "").replace(/'/g, "''");
}

function makeColumns(rows: VendorRow[], extra?: ColumnDef<VendorRow>[]): ColumnDef<VendorRow>[] {
  const priority = [
    "DOC_NO",
    "DOC_DATE",
    "AC_CODE",
    "AC_NAME",
    "VENDOR_CODE",
    "VENDOR_NAME",
    "INVOICE_NUMBER",
    "INVOICE_DATE",
    "REF_DOC_NO",
    "LAST_ACTION",
    "FLOW_LEVEL",
    "FINAL_APPROVED",
    "AMOUNT",
    "LCUR_AMOUNT",
    "DEBIT_AMOUNT",
    "CREDIT_AMOUNT",
    "BALANCE",
    "PAY_STATUS",
    "ERP_DOC_NO",
  ];
  const allKeys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => {
        if (key !== "items") set.add(key);
      });
      return set;
    }, new Set<string>()),
  );
  const keys = [
    ...priority.filter((key) => allKeys.includes(key)),
    ...allKeys.filter((key) => !priority.includes(key)),
  ].slice(0, 12);

  return [
    ...(extra || []),
    ...keys.map<ColumnDef<VendorRow>>((key) => ({
      accessorKey: key,
      header: key.replace(/_/g, " "),
      cell: ({ row }: { row: { original: VendorRow } }) => {
        const value = row.original[key];
        const isAmount = /amount|balance|price|qty/i.test(key);
        const isStatus = /status|action|approved/i.test(key);
        if (isStatus) return <StatusBadge value={value} />;
        return <span className="block max-w-[240px] truncate">{isAmount ? money(value) : display(value)}</span>;
      },
    })),
  ];
}

function getRowId(row: VendorRow, index: number) {
  return String(row.DOC_NO ?? row.doc_no ?? row.AC_CODE ?? row.ac_code ?? row.VENDOR_CODE ?? row.vendor_code ?? index);
}

function getViewFromPath(pathname: string): VendorView {
  const normalized = pathname.toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  if (compact.includes("registrationapproval") || compact.includes("registrationform") || compact.includes("vendorregister")) return "registration";
  if (compact.includes("profile")) return "profile";
  if (compact.includes("outstanding")) return "outstanding";
  if (compact.includes("status") || compact.includes("invoicestatus")) return "status";
  if (compact.includes("statement") || compact.includes("ledger")) return "statement";
  if (compact.includes("accountentry") || compact.includes("acentry")) return "account-entry";
  if (compact.includes("sentback")) return "sent-back";
  if (compact.includes("approval")) return "approvals";
  if (compact.includes("dashboard") || compact.endsWith("vendor") || compact.endsWith("vendorsystem")) return "dashboard";
  if (compact.includes("closed") || compact.includes("close")) return "closed";
  return "requests";
}

function buildRequestSql(tab: RequestTab, companyCode: string, loginid: string) {
  const company = sqlString(companyCode);
  const user = sqlString(loginid);
  if (tab === "drafts") {
    return `
      SELECT * FROM TR_AC_LPO_HEADER
      WHERE COMPANY_CODE = '${company}'
        AND AC_CODE = '${user}'
        AND FLOW_LEVEL = 0
        AND (LAST_ACTION = 'SAVEASDRAFT' OR LAST_ACTION = 'SENTBACK')
      ORDER BY DOC_NO DESC
    `;
  }
  if (tab === "submitted") {
    return `
      SELECT * FROM VW_TR_AC_LPO_HEADER_NOTAPPROVED
      WHERE COMPANY_CODE = '${company}'
        AND AC_CODE = '${user}'
        AND LAST_ACTION = 'SUBMITTED'
      ORDER BY DOC_NO DESC
    `;
  }
  if (tab === "rejected") {
    return `
      SELECT * FROM VW_TR_AC_LPO_HEADER_REJECTED
      WHERE COMPANY_CODE = '${company}'
        AND AC_CODE = '${user}'
      ORDER BY DOC_NO DESC
    `;
  }
  return `
    SELECT * FROM VW_TR_AC_LPO_HEADER_CONFIRM
    WHERE COMPANY_CODE = '${company}'
      AND AC_CODE = '${user}'
      AND FINAL_APPROVED = 'YES'
    ORDER BY DOC_NO DESC
  `;
}

function buildApprovalSql(tab: ApprovalTab, companyCode: string, loginid: string) {
  const company = sqlString(companyCode);
  const user = sqlString(loginid);
  if (tab === "pending") {
    return `
      SELECT H.*, (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
      FROM VW_TR_AC_LPO_HEADER_NOTAPPROVED H
      WHERE H.COMPANY_CODE = '${company}'
        AND H.LAST_ACTION NOT IN ('REJECTED')
        AND H.FINAL_APPROVED = 'NO'
      ORDER BY H.DOC_NO DESC
    `;
  }
  if (tab === "in-progress") {
    return `
      SELECT H.*, (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
      FROM VW_TR_AC_LPO_HEADER_NOTAPPROVED H
      WHERE H.COMPANY_CODE = '${company}'
        AND H.FINAL_APPROVED = 'NO'
        AND H.LAST_ACTION != 'REJECTED'
        AND H.FLOW_LEVEL > 0
      ORDER BY H.DOC_NO DESC
    `;
  }
  if (tab === "sent-back") {
    return `
      SELECT H.*, (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
      FROM VW_TR_AC_LPO_HEADER_SENTBACK H
      WHERE H.COMPANY_CODE = '${company}'
      ORDER BY H.DOC_NO DESC
    `;
  }
  if (tab === "rejected") {
    return `
      SELECT H.*, (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
      FROM VW_TR_AC_LPO_HEADER_REJECTED H
      WHERE H.COMPANY_CODE = '${company}'
      ORDER BY H.DOC_NO DESC
    `;
  }
  return `
    SELECT H.*, (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
    FROM VW_TR_AC_LPO_HEADER_CONFIRM H
    WHERE H.COMPANY_CODE = '${company}'
      AND H.FINAL_APPROVED = 'YES'
    ORDER BY H.DOC_NO DESC
  `;
}

function buildAccountEntrySql(companyCode: string) {
  return `
    SELECT * FROM TR_AC_LPO_HEADER
    WHERE COMPANY_CODE = '${sqlString(companyCode)}'
      AND LAST_ACTION = 'APPROVED'
      AND ACCOUNT_NUMBER IS NULL
    ORDER BY DOC_NO DESC
  `;
}

function buildSentBackSql(companyCode: string) {
  return `
    SELECT * FROM TR_AC_LPO_HEADER
    WHERE COMPANY_CODE = '${sqlString(companyCode)}'
      AND LAST_ACTION = 'SENTBACK'
    ORDER BY DOC_NO DESC
  `;
}

export function VendorWorkspacePage({ routePath = "" }: { routePath?: string }) {
  const { user } = useAuth();
  const companyCode = String(user?.company_code || "").trim();
  const loginid = String(user?.loginid || user?.username || "").trim();
  const view = getViewFromPath(routePath);
  const [notice, setNotice] = useState<Notice>(null);

  if (view === "registration") {
    return (
      <VendorRegistrationPage
        companyCode={companyCode}
        loginid={loginid}
        notice={notice}
        setNotice={setNotice}
      />
    );
  }

  if (view === "profile") {
    return <VendorProfilePage companyCode={companyCode} loginid={loginid} notice={notice} setNotice={setNotice} />;
  }

  if (view === "outstanding" || view === "status" || view === "statement") {
    return (
      <VendorInquiryPage
        kind={view}
        companyCode={companyCode}
        loginid={loginid}
        notice={notice}
        setNotice={setNotice}
      />
    );
  }

  if (view === "approvals") {
    return <VendorApprovalPage companyCode={companyCode} loginid={loginid} notice={notice} setNotice={setNotice} />;
  }

  if (view === "account-entry") {
    return (
      <VendorSqlListingPage
        title="Vendor Account Entry"
        subtitle="Approved vendor requests pending account transfer"
        eyebrow="Vendor Accounts"
        companyCode={companyCode}
        notice={notice}
        setNotice={setNotice}
        sqlFactory={() => buildAccountEntrySql(companyCode)}
        actions="account"
      />
    );
  }

  if (view === "sent-back") {
    return (
      <VendorSqlListingPage
        title="Vendor Sent Back"
        subtitle="Requests returned for revision"
        eyebrow="Vendor Request"
        companyCode={companyCode}
        notice={notice}
        setNotice={setNotice}
        sqlFactory={() => buildSentBackSql(companyCode)}
        actions="request"
      />
    );
  }

  if (view === "closed") {
    return (
      <VendorSqlListingPage
        title="Vendor Closed"
        subtitle="Final approved vendor invoices"
        eyebrow="Vendor Request"
        companyCode={companyCode}
        notice={notice}
        setNotice={setNotice}
        sqlFactory={() => buildRequestSql("closed", companyCode, loginid)}
        actions="closed"
      />
    );
  }

  if (view === "requests") {
    return <VendorRequestPage companyCode={companyCode} loginid={loginid} notice={notice} setNotice={setNotice} />;
  }

  return <VendorDashboardPage companyCode={companyCode} loginid={loginid} notice={notice} setNotice={setNotice} />;
}

function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="m-0 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
  );
}

function StatusBadge({ value }: { value: unknown }) {
  const status = display(value);
  const normalized = status.toLowerCase();
  const className = normalized.includes("reject")
    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
    : normalized.includes("sent")
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
      : normalized.includes("yes") || normalized.includes("approved") || normalized.includes("closed") || normalized.includes("cleared")
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
        : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}>{status}</span>;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: typeof FileText }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <div className="mt-2 text-2xl font-semibold">{value}</div>
        </div>
        <span className="rounded-lg bg-secondary p-2 text-primary">
          <Icon size={18} />
        </span>
      </div>
    </Card>
  );
}

function VendorDashboardPage({
  companyCode,
  loginid,
  notice,
  setNotice,
}: {
  companyCode: string;
  loginid: string;
  notice: Notice;
  setNotice: (notice: Notice) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<VendorRow[]>([]);
  const [approvals, setApprovals] = useState<VendorRow[]>([]);
  const [closed, setClosed] = useState<VendorRow[]>([]);

  const loadDashboard = async () => {
    if (!companyCode) {
      setNotice({ type: "error", message: "Company code is missing from your login session." });
      return;
    }
    setLoading(true);
    try {
      const [draftRows, approvalRows, closedRows] = await Promise.all([
        executeVendorSql(buildRequestSql("drafts", companyCode, loginid)),
        executeVendorSql(buildApprovalSql("pending", companyCode, loginid)),
        executeVendorSql(buildRequestSql("closed", companyCode, loginid)),
      ]);
      setDrafts(draftRows);
      setApprovals(approvalRows);
      setClosed(closedRows);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load vendor dashboard." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyCode, loginid]);

  const recentRows = [...drafts, ...approvals, ...closed].slice(0, 12);
  const totalAmount = [...drafts, ...approvals, ...closed].reduce((sum, row) => sum + numberValue(row.AMOUNT ?? row.LCUR_AMOUNT), 0);

  return (
    <section className="vendor-page grid gap-4">
      <PageHeader
        eyebrow="Vendor System"
        title="Vendor Dashboard"
        subtitle="Live vendor request, approval, and invoice activity in one workspace."
        actions={
          <Button variant="outline" onClick={() => void loadDashboard()} disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Refresh
          </Button>
        }
      />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Drafts" value={drafts.length} icon={FileText} />
        <StatCard label="Pending Approval" value={approvals.length} icon={ShieldCheck} />
        <StatCard label="Closed" value={closed.length} icon={BadgeCheck} />
        <StatCard label="Total Amount" value={money(totalAmount)} icon={BarChart3} />
      </div>
      <DataTable
        columns={makeColumns(recentRows)}
        data={recentRows}
        title="Recent Vendor Activity"
        subtitle={companyCode || "Tenant"}
        searchPlaceholder="Search activity..."
        loading={loading}
        emptyText="No recent vendor activity found"
        height={520}
        density="grid"
        enableExport
        exportFilename="vendor-dashboard"
        getRowId={getRowId}
      />
    </section>
  );
}

function VendorRequestPage({ companyCode, loginid, notice, setNotice }: SharedVendorProps) {
  const [activeTab, setActiveTab] = useState<RequestTab>("drafts");
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState<{ row?: VendorRow; mode: "create" | "edit" | "view" } | null>(null);

  const loadRows = async () => {
    if (!companyCode) {
      setNotice({ type: "error", message: "Company code is missing from your login session." });
      return;
    }
    setLoading(true);
    try {
      setRows(await executeVendorSql(buildRequestSql(activeTab, companyCode, loginid)));
    } catch (error) {
      setRows([]);
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load vendor requests." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, companyCode, loginid]);

  const filteredRows = filterRows(rows, query);
  const actionColumn: ColumnDef<VendorRow> = {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditor({ mode: "view", row: row.original })}>View</Button>
        {activeTab === "drafts" && <Button size="sm" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original })}>Edit</Button>}
      </div>
    ),
  };

  return (
    <section className="vendor-page grid gap-4">
      <PageHeader
        eyebrow="Vendor Request"
        title="Vendor Requests"
        subtitle="Create requests, monitor progress, and review rejected or closed invoices."
        actions={
          <>
            <Button variant="outline" onClick={() => void loadRows()} disabled={loading}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Refresh
            </Button>
            <Button onClick={() => setEditor({ mode: "create" })}>
              <Plus size={15} />
              Add Vendor Request
            </Button>
          </>
        }
      />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <TabStrip tabs={requestTabs} active={activeTab} onChange={setActiveTab} />
      <DataTable
        columns={makeColumns(filteredRows, [actionColumn])}
        data={filteredRows}
        title={`${filteredRows.length} Requests`}
        subtitle={requestTabs.find((tab) => tab.key === activeTab)?.label}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search vendor requests..."
        loading={loading}
        emptyText="No vendor requests found"
        height={650}
        minWidth={1200}
        density="grid"
        enableExport
        exportFilename={`vendor-requests-${activeTab}`}
        getRowId={getRowId}
      />
      {editor && (
        <VendorRequestDialog
          companyCode={companyCode}
          loginid={loginid}
          editor={editor}
          onClose={() => setEditor(null)}
          onSaved={async (message) => {
            setEditor(null);
            setNotice({ type: "success", message });
            await loadRows();
          }}
        />
      )}
    </section>
  );
}

function VendorApprovalPage({ companyCode, loginid, notice, setNotice }: SharedVendorProps) {
  const [activeTab, setActiveTab] = useState<ApprovalTab>("pending");
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<VendorRow | null>(null);
  const [actionTarget, setActionTarget] = useState<{ row: VendorRow; action: "SENTBACK" | "REJECTED" } | null>(null);

  const loadRows = async () => {
    if (!companyCode) {
      setNotice({ type: "error", message: "Company code is missing from your login session." });
      return;
    }
    setLoading(true);
    try {
      setRows(await executeVendorSql(buildApprovalSql(activeTab, companyCode, loginid)));
    } catch (error) {
      setRows([]);
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load vendor approvals." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, companyCode, loginid]);

  const filteredRows = filterRows(rows, query);
  const actionColumn: ColumnDef<VendorRow> = {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={() => setViewer(row.original)}>View</Button>
        {activeTab === "pending" && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setActionTarget({ row: row.original, action: "SENTBACK" })}>Send Back</Button>
            <Button size="sm" variant="ghost" onClick={() => setActionTarget({ row: row.original, action: "REJECTED" })}>Reject</Button>
          </>
        )}
      </div>
    ),
  };

  return (
    <section className="vendor-page grid gap-4">
      <PageHeader
        eyebrow="Vendor Approval"
        title="Vendor Approval"
        subtitle="Review vendor LPO requests across pending, progress, sent-back, rejected, and closed queues."
        actions={
          <Button variant="outline" onClick={() => void loadRows()} disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Refresh
          </Button>
        }
      />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <TabStrip tabs={approvalTabs} active={activeTab} onChange={setActiveTab} />
      <DataTable
        columns={makeColumns(filteredRows, [actionColumn])}
        data={filteredRows}
        title={`${filteredRows.length} Approval Records`}
        subtitle={approvalTabs.find((tab) => tab.key === activeTab)?.label}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search approval records..."
        loading={loading}
        emptyText="No approval records found"
        height={650}
        minWidth={1220}
        density="grid"
        enableExport
        exportFilename={`vendor-approval-${activeTab}`}
        getRowId={getRowId}
      />
      {viewer && (
        <VendorRequestDialog
          companyCode={companyCode}
          loginid={loginid}
          editor={{ mode: "view", row: viewer }}
          onClose={() => setViewer(null)}
          onSaved={async () => {
            setViewer(null);
            await loadRows();
          }}
        />
      )}
      {actionTarget && (
        <VendorActionDialog
          target={actionTarget}
          companyCode={companyCode}
          onClose={() => setActionTarget(null)}
          onDone={async (message) => {
            setActionTarget(null);
            setNotice({ type: "success", message });
            await loadRows();
          }}
        />
      )}
    </section>
  );
}

type SharedVendorProps = {
  companyCode: string;
  loginid: string;
  notice: Notice;
  setNotice: (notice: Notice) => void;
};

function VendorSqlListingPage({
  title,
  subtitle,
  eyebrow,
  companyCode,
  notice,
  setNotice,
  sqlFactory,
  actions,
}: {
  title: string;
  subtitle: string;
  eyebrow: string;
  companyCode: string;
  notice: Notice;
  setNotice: (notice: Notice) => void;
  sqlFactory: () => string;
  actions: "request" | "account" | "closed";
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<VendorRow | null>(null);

  const loadRows = async () => {
    if (!companyCode) {
      setNotice({ type: "error", message: "Company code is missing from your login session." });
      return;
    }
    setLoading(true);
    try {
      setRows(await executeVendorSql(sqlFactory()));
    } catch (error) {
      setRows([]);
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load vendor records." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyCode, title]);

  const filteredRows = filterRows(rows, query);
  const actionColumn: ColumnDef<VendorRow> = {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={() => setViewer(row.original)}>View</Button>
        {actions === "closed" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              try {
                await executeVendorInvoicePrint(companyCode, text(row.original.DOC_NO), text(user?.loginid));
                setNotice({ type: "success", message: "Vendor invoice print process started." });
              } catch (error) {
                setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to print vendor invoice." });
              }
            }}
          >
            Print
          </Button>
        )}
      </div>
    ),
  };

  return (
    <section className="vendor-page grid gap-4">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        actions={
          <Button variant="outline" onClick={() => void loadRows()} disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Refresh
          </Button>
        }
      />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <DataTable
        columns={makeColumns(filteredRows, [actionColumn])}
        data={filteredRows}
        title={`${filteredRows.length} Records`}
        subtitle={companyCode}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search vendor records..."
        loading={loading}
        emptyText="No records found"
        height={650}
        minWidth={1200}
        density="grid"
        enableExport
        exportFilename={`vendor-${title.toLowerCase().replace(/\s+/g, "-")}`}
        getRowId={getRowId}
      />
      {viewer && (
        <VendorRequestDialog
          companyCode={companyCode}
          loginid={text(user?.loginid)}
          editor={{ mode: "view", row: viewer }}
          onClose={() => setViewer(null)}
          onSaved={async () => {
            setViewer(null);
            await loadRows();
          }}
        />
      )}
    </section>
  );
}

function VendorInquiryPage({ kind, companyCode, loginid, notice, setNotice }: SharedVendorProps & { kind: "outstanding" | "status" | "statement" }) {
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [query, setQuery] = useState("");
  const [acCode, setAcCode] = useState(loginid);
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [loading, setLoading] = useState(false);

  const title = kind === "outstanding" ? "Vendor Outstanding" : kind === "status" ? "Vendor Invoice Status" : "Vendor Register / Statement";
  const subtitle =
    kind === "outstanding"
      ? "Track debit, credit, and balance by vendor."
      : kind === "status"
        ? "Review payment and booking status by invoice."
        : "Review vendor ledger movement for a selected date range.";

  const loadRows = async () => {
    if (!companyCode || !acCode.trim()) {
      setNotice({ type: "error", message: "Company code and AC code are required." });
      return;
    }
    setLoading(true);
    try {
      const nextRows =
        kind === "outstanding"
          ? await getVendorOutstanding(companyCode, acCode.trim())
          : kind === "status"
            ? await getVendorInvoiceStatus(companyCode, acCode.trim(), fromDate, toDate)
            : await executeVendorSql(`
                SELECT * FROM VW_TR_AC_LPO_HEADER_CONFIRM
                WHERE COMPANY_CODE = '${sqlString(companyCode)}'
                  AND AC_CODE = '${sqlString(acCode)}'
                ORDER BY DOC_NO DESC
              `);
      setRows(nextRows);
    } catch (error) {
      setRows([]);
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load vendor inquiry." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, companyCode]);

  const filteredRows = filterRows(rows, query);
  const debit = rows.reduce((sum, row) => sum + numberValue(row.DEBIT_AMOUNT ?? row.DEBIT_AMT), 0);
  const credit = rows.reduce((sum, row) => sum + numberValue(row.CREDIT_AMOUNT ?? row.CREDIT_AMT), 0);
  const balance = rows.reduce((sum, row) => sum + numberValue(row.BALANCE), 0);

  return (
    <section className="vendor-page grid gap-4">
      <PageHeader
        eyebrow="Vendor Inquiry"
        title={title}
        subtitle={subtitle}
        actions={
          <Button variant="outline" onClick={() => void loadRows()} disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Refresh
          </Button>
        }
      />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_160px_auto]">
          <label className="grid gap-1.5 text-sm font-medium">
            AC Code
            <Input value={acCode} onChange={(event) => setAcCode(event.target.value)} placeholder="Vendor account code" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            From Date
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            To Date
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
          <div className="flex items-end">
            <Button className="w-full" onClick={() => void loadRows()} disabled={loading}>
              <FileSearch size={15} />
              Search
            </Button>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Rows" value={rows.length} icon={ClipboardList} />
        <StatCard label="Debit" value={money(debit)} icon={FileText} />
        <StatCard label="Credit" value={money(credit)} icon={FileCheck2} />
        <StatCard label="Balance" value={money(balance)} icon={BarChart3} />
      </div>
      <DataTable
        columns={makeColumns(filteredRows)}
        data={filteredRows}
        title={`${filteredRows.length} Records`}
        subtitle={title}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search vendor inquiry..."
        loading={loading}
        emptyText="No vendor records found"
        height={620}
        minWidth={1120}
        density="grid"
        enableExport
        exportFilename={`vendor-${kind}`}
        getRowId={getRowId}
      />
    </section>
  );
}

function VendorProfilePage({ companyCode, loginid, notice, setNotice }: SharedVendorProps) {
  const [account, setAccount] = useState<VendorRow>({});
  const [loading, setLoading] = useState(false);

  const loadProfile = async () => {
    if (!companyCode || !loginid) {
      setNotice({ type: "error", message: "Company code and login ID are required." });
      return;
    }
    setLoading(true);
    try {
      const accounts = await getVendorAccounts(companyCode, loginid);
      setAccount(accounts[0] || {});
    } catch (error) {
      setAccount({});
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load vendor profile." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyCode, loginid]);

  const fields: [string, unknown][] = [
    ["Account Code", account.AC_CODE],
    ["Account Name", account.AC_NAME],
    ["Address", account.ADDRESS],
    ["Phone", account.PHONE],
    ["Fax", account.FAX],
    ["Email", account.EMAIL],
    ["Mobile", account.MOBILE],
    ["Department", account.DEPT_CODE],
    ["Tax Country", account.TAX_COUNTRY_CODE],
    ["Contact Person", account.CONTACT_PERSON],
    ["Territory", account.TERRITORY_CODE],
    ["Country", account.COUNTRY_CODE],
  ];

  return (
    <section className="vendor-page grid gap-4">
      <PageHeader
        eyebrow="Vendor Profile"
        title="Vendor Profile"
        subtitle="Account contact and commercial profile for the logged-in vendor."
        actions={
          <Button variant="outline" onClick={() => void loadProfile()} disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Refresh
          </Button>
        }
      />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          {fields.map(([label, value]) => (
            <div key={label} className="rounded-lg border bg-background p-3">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
              <p className="m-0 mt-1 min-h-6 text-sm font-medium">{display(value)}</p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

function VendorRegistrationPage({ companyCode, loginid, notice, setNotice }: SharedVendorProps) {
  const [form, setForm] = useState<VendorRow>(() => vendorDefaults(companyCode, loginid));
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<VendorRow[]>([]);

  useEffect(() => {
    setForm((current) => ({ ...vendorDefaults(companyCode, loginid), ...current, COMPANY_CODE: companyCode, AC_CODE: text(current.AC_CODE) || loginid }));
  }, [companyCode, loginid]);

  const searchAccounts = async () => {
    try {
      setAccounts(await getVendorAccounts(companyCode, text(form.AC_CODE) || undefined));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load accounts." });
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const required = ["VENDOR_NAME", "VENDOR_ADDR1", "VENDOR_CONTACT1", "VENDOR_EMAIL1", "VENDOR_CITY"];
    const missing = required.filter((field) => !text(form[field]));
    if (missing.length) {
      setNotice({ type: "error", message: `Missing required fields: ${missing.join(", ")}` });
      return;
    }
    setSaving(true);
    try {
      await createVendorRegistration(companyCode, form);
      setNotice({ type: "success", message: "Vendor registration submitted successfully." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to submit vendor registration." });
    } finally {
      setSaving(false);
    }
  };

  const setField = (name: string, value: unknown) => setForm((current) => ({ ...current, [name]: value }));

  return (
    <section className="vendor-page grid gap-4">
      <PageHeader
        eyebrow="Vendor Registration"
        title="Vendor Registration"
        subtitle="Register or update vendor master profile using the tenant company context."
        actions={
          <Button form="vendor-registration-form" type="submit" disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Submit
          </Button>
        }
      />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <form id="vendor-registration-form" onSubmit={submit} className="grid gap-4">
        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Company Code" value={companyCode} disabled onChange={() => undefined} />
            <Field label="Account Code" value={text(form.AC_CODE)} onChange={(value) => setField("AC_CODE", value)} />
            <div className="flex items-end">
              <Button type="button" variant="outline" className="w-full" onClick={() => void searchAccounts()}>
                <FileSearch size={15} />
                Lookup Account
              </Button>
            </div>
            {accounts.length > 0 && (
              <label className="grid gap-1.5 text-sm font-medium md:col-span-3">
                Account
                <Select
                  value={text(form.AC_CODE)}
                  onChange={(event) => {
                    const row = accounts.find((item) => text(item.AC_CODE) === event.target.value);
                    setForm((current) => ({ ...current, AC_CODE: event.target.value, VENDOR_NAME: text(row?.AC_NAME) || text(current.VENDOR_NAME) }));
                  }}
                >
                  <option value="">Select account</option>
                  {accounts.map((account) => (
                    <option key={text(account.AC_CODE)} value={text(account.AC_CODE)}>
                      {text(account.AC_CODE)} - {text(account.AC_NAME)}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>
        </Card>
        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="CR Number" value={text(form.CR_NUMBER)} onChange={(value) => setField("CR_NUMBER", value)} />
            <Field label="Vendor Code" value={text(form.VENDOR_CODE)} onChange={(value) => setField("VENDOR_CODE", value)} />
            <Field label="Vendor Name" value={text(form.VENDOR_NAME)} required onChange={(value) => setField("VENDOR_NAME", value)} />
            <Field label="Address 1" value={text(form.VENDOR_ADDR1)} required onChange={(value) => setField("VENDOR_ADDR1", value)} />
            <Field label="Address 2" value={text(form.VENDOR_ADDR2)} onChange={(value) => setField("VENDOR_ADDR2", value)} />
            <Field label="Address 3" value={text(form.VENDOR_ADDR3)} onChange={(value) => setField("VENDOR_ADDR3", value)} />
            <Field label="Address 4" value={text(form.VENDOR_ADDR4)} onChange={(value) => setField("VENDOR_ADDR4", value)} />
            <Field label="City" value={text(form.VENDOR_CITY)} required onChange={(value) => setField("VENDOR_CITY", value)} />
            <Field label="Country Code" value={text(form.COUNTRY_CODE)} onChange={(value) => setField("COUNTRY_CODE", value)} />
          </div>
        </Card>
        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Contact 1" value={text(form.VENDOR_CONTACT1)} required onChange={(value) => setField("VENDOR_CONTACT1", value)} />
            <Field label="Telephone 1" value={text(form.VENDOR_TELNO1)} onChange={(value) => setField("VENDOR_TELNO1", value)} />
            <Field label="Email 1" type="email" value={text(form.VENDOR_EMAIL1)} required onChange={(value) => setField("VENDOR_EMAIL1", value)} />
            <Field label="Contact 2" value={text(form.VENDOR_CONTACT2)} onChange={(value) => setField("VENDOR_CONTACT2", value)} />
            <Field label="Telephone 2" value={text(form.VENDOR_TELNO2)} onChange={(value) => setField("VENDOR_TELNO2", value)} />
            <Field label="Email 2" type="email" value={text(form.VENDOR_EMAIL2)} onChange={(value) => setField("VENDOR_EMAIL2", value)} />
            <Field label="Contact 3" value={text(form.VENDOR_CONTACT3)} onChange={(value) => setField("VENDOR_CONTACT3", value)} />
            <Field label="Telephone 3" value={text(form.VENDOR_TELNO3)} onChange={(value) => setField("VENDOR_TELNO3", value)} />
            <Field label="Email 3" type="email" value={text(form.VENDOR_EMAIL3)} onChange={(value) => setField("VENDOR_EMAIL3", value)} />
          </div>
        </Card>
      </form>
    </section>
  );
}

function VendorRequestDialog({
  companyCode,
  loginid,
  editor,
  onClose,
  onSaved,
}: {
  companyCode: string;
  loginid: string;
  editor: { row?: VendorRow; mode: "create" | "edit" | "view" };
  onClose: () => void;
  onSaved: (message: string) => Promise<void> | void;
}) {
  const [form, setForm] = useState<VendorRow>(() => ({ ...requestDefaults(companyCode, loginid), ...(editor.row || {}) }));
  const [items, setItems] = useState<VendorRow[]>(() => Array.isArray(editor.row?.items) ? (editor.row?.items as VendorRow[]) : []);
  const [loading, setLoading] = useState(false);
  const readOnly = editor.mode === "view";

  useEffect(() => {
    const docNo = text(editor.row?.DOC_NO);
    const acCode = text(editor.row?.AC_CODE);
    if (!docNo || !acCode || editor.mode === "create") return;
    setLoading(true);
    getVendorRequest(`${docNo}$$$${acCode}`)
      .then((data) => {
        setForm((current) => ({ ...current, ...data }));
        setItems(Array.isArray(data.items) ? (data.items as VendorRow[]) : []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [editor.mode, editor.row]);

  const setField = (name: string, value: unknown) => setForm((current) => ({ ...current, [name]: value }));
  const setItem = (index: number, name: string, value: unknown) =>
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [name]: value } : item));

  const addItem = () =>
    setItems((current) => [
      ...current,
      {
        SERIAL_NO: current.length + 1,
        COMPANY_CODE: companyCode,
        DOC_NO: text(form.DOC_NO),
        DOC_DATE: text(form.DOC_DATE) || today(),
        AC_CODE: text(form.AC_CODE) || loginid,
        HEADER_AC_CODE: text(form.AC_CODE) || loginid,
        REMARKS: "",
        QTY: 1,
        PRICE: 0,
        AMOUNT: 0,
        LCUR_AMOUNT: 0,
        DIV_CODE: text(form.DIV_CODE),
      },
    ]);

  const submit = async (lastAction: "SAVEASDRAFT" | "SUBMITTED") => {
    setLoading(true);
    try {
      const payload = {
        ...form,
        COMPANY_CODE: companyCode,
        AC_CODE: text(form.AC_CODE) || loginid,
        LAST_ACTION: lastAction,
        items: items.map((item, index) => ({
          ...item,
          SERIAL_NO: numberValue(item.SERIAL_NO) || index + 1,
          COMPANY_CODE: companyCode,
          DOC_NO: text(form.DOC_NO),
          DOC_DATE: text(form.DOC_DATE) || today(),
          AC_CODE: text(form.AC_CODE) || loginid,
          HEADER_AC_CODE: text(form.AC_CODE) || loginid,
          AMOUNT: numberValue(item.AMOUNT) || numberValue(item.QTY) * numberValue(item.PRICE),
          LCUR_AMOUNT: numberValue(item.LCUR_AMOUNT) || numberValue(item.AMOUNT) || numberValue(item.QTY) * numberValue(item.PRICE),
        })),
      };
      const result = await saveVendorRequest(payload);
      await onSaved(result.requestNumber ? `Vendor request ${result.requestNumber} saved.` : "Vendor request saved.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      wide
      title={editor.mode === "create" ? "Add Vendor Request" : editor.mode === "edit" ? "Edit Vendor Request" : "Vendor Request"}
      description="Header, invoice, delivery, and line details"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {!readOnly && (
            <>
              <Button variant="outline" onClick={() => void submit("SAVEASDRAFT")} disabled={loading}>
                <Save size={15} />
                Save Draft
              </Button>
              <Button onClick={() => void submit("SUBMITTED")} disabled={loading}>
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Submit
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Company" value={companyCode} disabled onChange={() => undefined} />
          <Field label="Doc No" value={text(form.DOC_NO)} disabled={readOnly} onChange={(value) => setField("DOC_NO", value)} />
          <Field label="Doc Date" type="date" value={text(form.DOC_DATE) || today()} disabled={readOnly} onChange={(value) => setField("DOC_DATE", value)} />
          <Field label="AC Code" value={text(form.AC_CODE) || loginid} disabled={readOnly} onChange={(value) => setField("AC_CODE", value)} />
          <Field label="Invoice No" value={text(form.INVOICE_NUMBER)} disabled={readOnly} onChange={(value) => setField("INVOICE_NUMBER", value)} />
          <Field label="Invoice Date" type="date" value={text(form.INVOICE_DATE) || today()} disabled={readOnly} onChange={(value) => setField("INVOICE_DATE", value)} />
          <Field label="Currency" value={text(form.CURR_CODE)} disabled={readOnly} onChange={(value) => setField("CURR_CODE", value)} />
          <Field label="Exchange Rate" type="number" value={text(form.EX_RATE) || "1"} disabled={readOnly} onChange={(value) => setField("EX_RATE", value)} />
          <Field label="Reference No" value={text(form.REF_NO)} disabled={readOnly} onChange={(value) => setField("REF_NO", value)} />
          <Field label="Reference Date" type="date" value={text(form.REF_DATE) || today()} disabled={readOnly} onChange={(value) => setField("REF_DATE", value)} />
          <Field label="Division" value={text(form.DIV_CODE)} disabled={readOnly} onChange={(value) => setField("DIV_CODE", value)} />
          <Field label="Payment Terms" value={text(form.PAYMENT_TERMS)} disabled={readOnly} onChange={(value) => setField("PAYMENT_TERMS", value)} />
        </div>
        <label className="grid gap-1.5 text-sm font-medium">
          Remarks
          <textarea
            className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={text(form.REMARKS)}
            disabled={readOnly}
            onChange={(event) => setField("REMARKS", event.target.value)}
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow m-0">Item Details</p>
            <p className="m-0 text-sm text-muted-foreground">{items.length} line item{items.length === 1 ? "" : "s"}</p>
          </div>
          {!readOnly && (
            <Button type="button" variant="outline" onClick={addItem}>
              <Plus size={15} />
              Add Line
            </Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-secondary">
              <tr>
                {["Sr", "Ref Doc", "Product", "Description", "Qty", "Price", "Amount", "Division", ""].map((header) => (
                  <th key={header} className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No line items</td></tr>
              ) : items.map((item, index) => (
                <tr key={index} className="border-t">
                  <td className="px-2 py-2">{index + 1}</td>
                  <td className="px-2 py-2"><Input disabled={readOnly} value={text(item.REF_DOC_NO)} onChange={(event) => setItem(index, "REF_DOC_NO", event.target.value)} /></td>
                  <td className="px-2 py-2"><Input disabled={readOnly} value={text(item.PROD_CODE)} onChange={(event) => setItem(index, "PROD_CODE", event.target.value)} /></td>
                  <td className="px-2 py-2"><Input disabled={readOnly} value={text(item.REMARKS)} onChange={(event) => setItem(index, "REMARKS", event.target.value)} /></td>
                  <td className="px-2 py-2"><Input disabled={readOnly} type="number" value={text(item.QTY)} onChange={(event) => setItem(index, "QTY", event.target.value)} /></td>
                  <td className="px-2 py-2"><Input disabled={readOnly} type="number" value={text(item.PRICE)} onChange={(event) => setItem(index, "PRICE", event.target.value)} /></td>
                  <td className="px-2 py-2"><Input disabled={readOnly} type="number" value={text(item.AMOUNT)} onChange={(event) => setItem(index, "AMOUNT", event.target.value)} /></td>
                  <td className="px-2 py-2"><Input disabled={readOnly} value={text(item.DIV_CODE)} onChange={(event) => setItem(index, "DIV_CODE", event.target.value)} /></td>
                  <td className="px-2 py-2">
                    {!readOnly && <Button size="sm" variant="ghost" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  );
}

function VendorActionDialog({
  target,
  companyCode,
  onClose,
  onDone,
}: {
  target: { row: VendorRow; action: "SENTBACK" | "REJECTED" };
  companyCode: string;
  onClose: () => void;
  onDone: (message: string) => Promise<void> | void;
}) {
  const [remarks, setRemarks] = useState("");
  const [flowLevel, setFlowLevel] = useState(String(numberValue(target.row.FLOW_LEVEL) || 0));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!remarks.trim()) return;
    setSaving(true);
    try {
      await updateVendorLpoStatus({
        doc_no: text(target.row.DOC_NO),
        company_code: companyCode,
        flow_level: target.action === "REJECTED" ? 0 : numberValue(flowLevel),
        remarks,
        action: target.action,
      });
      await onDone(target.action === "REJECTED" ? "Vendor request rejected." : "Vendor request sent back.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      compact
      tone={target.action === "REJECTED" ? "danger" : "default"}
      title={target.action === "REJECTED" ? "Reject Vendor Request" : "Send Back Vendor Request"}
      description={`Document ${display(target.row.DOC_NO)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={target.action === "REJECTED" ? "destructive" : "default"} disabled={saving || !remarks.trim()} onClick={() => void submit()}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : target.action === "REJECTED" ? <XCircle size={15} /> : <Undo2 size={15} />}
            Confirm
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {target.action !== "REJECTED" && (
          <Field label="Return To Flow Level" type="number" value={flowLevel} onChange={setFlowLevel} />
        )}
        <label className="grid gap-1.5 text-sm font-medium">
          Remarks
          <textarea
            className="min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Enter reason or instruction"
          />
        </label>
      </div>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}{required && <span className="text-destructive"> *</span>}</span>
      <Input type={type} value={value} disabled={disabled} required={required} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TabStrip<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; icon: typeof FileText }[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <Card className="p-2">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function filterRows(rows: VendorRow[], query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) => Object.values(row).some((value) => display(value).toLowerCase().includes(term)));
}
