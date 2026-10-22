import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Paperclip, FileText, Printer, FileSpreadsheet, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { DataTable } from "../../components/ui/DataTable";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Badge } from "../../components/ui/Badge";
import { CardContent, CardHeader } from "../../components/ui/Card";
import { AttachmentDialog } from "../../components/ui/AttachmentDialog";
import { useAuth } from "../../state/AuthContext";
import { almsSave, almsCommonSelect } from "../../api/alms";
import { printCapexApprovalReport } from "./CapexApprovalReport";

// ─── Types ────────────────────────────────────────────────────────────────
// TODO: move into CapexRequest-types.ts if you keep a shared types file
export type TCPHeader = {
  REQUEST_NUMBER?: string;
  REQUEST_DATE?: string | Date;
  DESCRIPTION?: string;
  REMARKS?: string;
  DEPARTMENT_CODE?: string;
  FLOW_CODE?: string;
  FLOW_LEVEL_INITIAL?: number;
  FLOW_LEVEL_RUNNING?: number;
  FLOW_LEVEL_FINAL?: number;
  COMPANY_CODE?: string;
  USER_DT?: string | Date;
  USER_ID?: string;
  FA_UPLOADED?: string;
  FINAL_APPROVED?: string;
  CREATE_USER?: string;
  CREATE_DATE?: string | Date;
  LAST_UPDATED?: string;
  LAST_ACTION?: string;
  HISTORY_SERIAL?: number;
  MOBILE_APP_UPDATE?: string;
  HOD_USER?: string;
  FA_USER?: string;
  MAIL_CC?: string;
  REF_REQUEST_NUMBER?: string;
  REF_REQUEST_DATE?: string | Date;
  REMARKS_HISTRY?: string;
  SUPPLIER?: string;       // Supplier Code
  AC_NAME?: string;        // Supplier Name (joined from MS_ACCODES)
  REF_DOC_NO?: string;     // PO Number
  BUDGETED?: string;       // Y/N
  BOARD_APPROVAL?: string; // Y/N
  purch_status?: string;   // Status label shown in header chip
  PURCH_STATUS?: string;   // same, uppercase variant
};

export type TCPItem = {
  REQUEST_NUMBER?: string;
  ITEM_CODE?: string;
  COMPANY_CODE?: string;
  USER_DT?: string | Date;
  USER_ID?: string;
  LAST_ACTION?: string;
  HISTORY_SERIAL?: number;
  ITEM_SRNO?: number;
  REF_DOC_NO?: string;
  ITEM_RATE?: number;
  ITEM_QTY?: number;
  AMOUNT?: number;
  TX_COMPNT_AMT_1?: number;
  ITEM_DESP?: string;
};

type AddCPRequestPageProps = {
  isEditMode: boolean;
  isViewMode?: boolean;
  existingData?: { request_number?: string };
  onClose: (refresh?: boolean, message?: string) => void;
};

function num(v: unknown) {
  return Number(v) || 0;
}
function fmt3(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

const AddCPRequestPage = ({ isEditMode, isViewMode = false, existingData, onClose }: AddCPRequestPageProps) => {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";

  // CP pages only ever open against an existing request (edit/view) — never "add"
  const requestNumber = existingData?.request_number;

  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [header, setHeader] = useState<Partial<TCPHeader>>({});
  const [attachOpen, setAttachOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const disabled = isViewMode || saving;

  // ── Fetch header ───────────────────────────────────────────────────────────
  const { data: hdrList = [], isLoading: hdrLoading, isError: hdrError } = useQuery<TCPHeader[]>({
    queryKey: ["cp-header", requestNumber, companyCode],
    queryFn: () =>
      almsCommonSelect<TCPHeader>({
        parameter: "Amlspf_TabCPHeader",
        loginid,
        code1: companyCode,
        code2: requestNumber,
      }),
    enabled: !!requestNumber,
  });

  useEffect(() => {
    if (hdrList.length > 0) {
      setHeader(hdrList[0]);
    }
  }, [hdrList]);

  // Derived loading flag — header query settle zali ki (empty/error asli tari) resolve hoto
  const loading = !!requestNumber && hdrLoading;

  // ── Fetch details (read-only, sourced from PR line items) ─────────────────
  const { data: items = [], isLoading: itemsLoading } = useQuery<TCPItem[]>({
    queryKey: ["cp-details", requestNumber, companyCode],
    queryFn: () =>
      almsCommonSelect<TCPItem>({
        parameter: "Amlspf_TabCPDetails",
        loginid,
        code1: companyCode,
        code2: requestNumber,
      }),
    enabled: !!requestNumber,
  });

  const setHdr = (field: keyof TCPHeader, value: unknown) =>
    setHeader((prev) => ({ ...prev, [field]: value }));

  const totalAmount = items.reduce((s, r) => s + num(r.AMOUNT), 0);
  const totalTax = items.reduce((s, r) => s + num(r.TX_COMPNT_AMT_1), 0);
  const statusLabel = header.purch_status || header.PURCH_STATUS || "";
  const canExport = !!requestNumber && !itemsLoading && !saving;

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    printCapexApprovalReport({
      companyName: "AL MADINA LOGISTIC SERVICES CO SAOC",
      requestNumber: header.REQUEST_NUMBER,
      requestDate: header.REQUEST_DATE,
      supplierCode: header.SUPPLIER,
      budgeted: header.BUDGETED,
      boardApproval: header.BOARD_APPROVAL,
      justification: header.DESCRIPTION,
      items: items.map((it) => ({
        itemCode: it.ITEM_CODE,
        itemDesp: it.ITEM_DESP,
        rate: it.ITEM_RATE,
        qty: it.ITEM_QTY,
        amount: it.AMOUNT,
        vatAmount: it.TX_COMPNT_AMT_1,
      })),
    });
  };

  // ── Generate Excel ──────────────────────────────────────────────────────────
  // TODO: wire this to your actual export endpoint/util.
  const handleGenerateExcel = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await almsSave({
        parameter: "Amlspf_GenerateCPExcel", // TODO: confirm actual SP / export endpoint name
        loginid,
        code1: companyCode,
        code2: requestNumber,
      });
      setNotice({ type: "success", message: "Excel generated successfully!" });
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to generate Excel" });
    } finally {
      setSaving(false);
    }
  };

  // ── Details grid columns (read-only) ───────────────────────────────────────
  const itemColumns = useMemo<ColumnDef<TCPItem>[]>(
    () => [
      { accessorKey: "ITEM_SRNO", header: "Item SR No", size: 100 },
      { accessorKey: "ITEM_CODE", header: "Item Code", size: 120 },
      { accessorKey: "ITEM_DESP", header: "Item Description", size: 300 },
      {
        accessorKey: "ITEM_QTY",
        header: () => <div className="text-right">Quantity</div>,
        size: 100,
        cell: ({ getValue }) => <div className="text-right">{fmt3(num(getValue()))}</div>,
      },
      {
        accessorKey: "ITEM_RATE",
        header: () => <div className="text-right">Rate</div>,
        size: 100,
        cell: ({ getValue }) => <div className="text-right">{fmt3(num(getValue()))}</div>,
      },
      {
        accessorKey: "AMOUNT",
        header: () => <div className="text-right">Amount</div>,
        size: 120,
        cell: ({ getValue }) => <div className="text-right font-semibold">{fmt3(num(getValue()))}</div>,
      },
      {
        accessorKey: "TX_COMPNT_AMT_1",
        header: () => <div className="text-right">Tax</div>,
        size: 100,
        cell: ({ getValue }) => <div className="text-right">{fmt3(num(getValue()))}</div>,
      },
    ],
    []
  );

  // ═══════════════════════════════════════════════════════════════════════
  // Root wrapper flow-based — sidebar visible rahato
  // (junhe: "fixed inset-0 z-50" + "h-screen" + footer bar kadhle)
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <section className="finance-document-ui payment-workbench commercial-editor grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
        {/* ── Command header ─────────────────────────────────────────────── */}
        <CardHeader className="commercial-command-header border-b bg-primary px-4 py-1.5 text-primary-foreground shadow-sm">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
              <div>
                <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                  {isViewMode ? "View Document" : isEditMode ? "Edit Document" : "New Document"}
                </p>
                <h2 className="m-0 text-base font-semibold leading-tight text-primary-foreground">Capex Request</h2>
              </div>
              <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Doc No</span>
                <strong className="block text-sm leading-tight text-primary-foreground">{requestNumber || "New"}</strong>
              </div>
              <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Total</span>
                <strong className="block text-sm leading-tight text-primary-foreground">{fmt3(totalAmount)}</strong>
              </div>
              {statusLabel && (
                <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Status</span>
                  <Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground">{statusLabel}</Badge>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {requestNumber && (
                <>
                  <Button type="button" variant="secondary" onClick={handlePrint} disabled={!canExport}>
                    <Printer size={15} /> Print
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void handleGenerateExcel()} disabled={!canExport}>
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
                    {saving ? "Generating..." : "Excel"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setAttachOpen(true)}>
                    <Paperclip size={15} /> Files
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setLogOpen(true)}>
                    <FileText size={15} /> Log
                  </Button>
                </>
              )}
              <Button aria-label="Close" type="button" variant="secondary" size="icon" onClick={() => onClose()}>
                <X size={16} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="commercial-editor-body min-h-0 min-w-0 overflow-auto p-3">
          {loading ? (
            <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">Loading Capex Request...</div>
          ) : hdrError ? (
            <div className="grid min-h-[420px] place-items-center text-sm text-destructive">Unable to load Capex Request</div>
          ) : (
            <div className="commercial-editor-sections grid min-w-0 gap-3">
              <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

              <div className="rounded-md border bg-card">
                <div className="border-b bg-secondary/40 px-3 py-1.5">
                  <p className="eyebrow m-0">Header</p>
                  <h3 className="m-0 text-sm font-semibold leading-tight">Request Information</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <label className="field">
                    <span>Request Number</span>
                    <Input disabled value={header.REQUEST_NUMBER || ""} />
                  </label>
                  <label className="field">
                    <span>Request Date</span>
                    <Input disabled type="date" value={header.REQUEST_DATE ? String(header.REQUEST_DATE).slice(0, 10) : ""} />
                  </label>
                  <label className="field">
                    <span>Ref. Request Number</span>
                    <Input disabled value={header.REF_REQUEST_NUMBER || ""} />
                  </label>
                  <label className="field">
                    <span>Ref. Request Date</span>
                    <Input disabled type="date" value={header.REF_REQUEST_DATE ? String(header.REF_REQUEST_DATE).slice(0, 10) : ""} />
                  </label>
                  <label className="field">
                    <span>Supplier Code</span>
                    <Input disabled value={header.SUPPLIER || ""} />
                  </label>
                  <label className="field">
                    <span>Supplier Name</span>
                    <Input disabled value={header.AC_NAME || ""} />
                  </label>
                  <label className="field">
                    <span>PO Number</span>
                    <Input disabled value={header.REF_DOC_NO || ""} />
                  </label>
                  <label className="field">
                    <span>Budgeted (Y/N)</span>
                    <select
                      disabled={disabled}
                      value={header.BUDGETED || ""}
                      onChange={(e) => setHdr("BUDGETED", e.target.value)}
                      className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
                    >
                      <option value="">— Select —</option>
                      <option value="Y">Y</option>
                      <option value="N">N</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Board Approval (Y/N)</span>
                    <select
                      disabled={disabled}
                      value={header.BOARD_APPROVAL || ""}
                      onChange={(e) => setHdr("BOARD_APPROVAL", e.target.value)}
                      className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
                    >
                      <option value="">— Select —</option>
                      <option value="Y">Y</option>
                      <option value="N">N</option>
                    </select>
                  </label>

                  <label className="field col-span-3 max-lg:col-span-2 max-md:col-span-1">
                    <span>Description</span>
                    <textarea
                      disabled={disabled}
                      rows={4}
                      value={header.DESCRIPTION || ""}
                      onChange={(e) => setHdr("DESCRIPTION", e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="field col-span-3 max-lg:col-span-2 max-md:col-span-1">
                    <span>Remarks</span>
                    <textarea
                      disabled={disabled}
                      rows={4}
                      value={header.REMARKS || ""}
                      onChange={(e) => setHdr("REMARKS", e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </div>

              <div className="commercial-lines-card rounded-md border bg-card">
                <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-1.5">
                  <div>
                    <p className="eyebrow m-0">Details</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Line Items</h3>
                  </div>
                </div>
                <DataTable
                  columns={itemColumns}
                  data={items}
                  title={`${items.length} Items`}
                  loading={itemsLoading}
                  emptyText="No line items"
                  height={360}
                  density="grid"
                  enablePagination={false}
                  getRowId={(row, index) => `${row.ITEM_SRNO ?? row.ITEM_CODE ?? "row"}_${index}`}
                />
                <div className="flex items-center justify-end gap-8 border-t px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <strong className="text-primary">{fmt3(totalAmount)}</strong>
                </div>
                <div className="flex items-center justify-end gap-8 px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <strong className="text-primary">{fmt3(totalTax)}</strong>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </section>

      <AttachmentDialog
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        requestNumber={requestNumber}
        title="Capex Request Attachments"
        module="LMS"
        type="CP"
        companyCode={companyCode}
        loginId={loginid}
        readOnly={isViewMode}
      />
    </div>
  );
};

export default AddCPRequestPage;