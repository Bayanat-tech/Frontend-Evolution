import type { ComponentType, ReactNode } from "react";
import {
  ClipboardList, FileCheck2, FileText, MessageSquareQuote, PackageCheck, Receipt, ShoppingCart, Truck,
} from "lucide-react";
import type { DashboardSummary } from "./types";
import { CARD, COLORS, fmt } from "./UiPage";

interface FlowNode {
  label: string;
  count: number;
  icon: ComponentType<{ className?: string }>;
  color: string;
  note: string;
  pending?: number;
  pendingLabel?: string;
}

const HEX = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
const LINE = "bg-slate-300 dark:bg-slate-600";
const grad = (c: string) => `linear-gradient(135deg, ${c}, ${c}cc)`;

function Hex({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <div style={{ width: w, height: h, filter: "drop-shadow(0 2px 4px rgba(15,23,42,0.14))" }}>
      <div className="flex h-full w-full items-center justify-center bg-white dark:bg-slate-700" style={{ clipPath: HEX }}>
        {children}
      </div>
    </div>
  );
}

function NodeColumn({ n }: { n: FlowNode }) {
  const Icon = n.icon;
  const hasPending = n.pending !== undefined;
  const open = (n.pending ?? 0) > 0;
  return (
    <div className="flex flex-col items-center px-1">
      <div className={`h-2 w-px ${open ? "bg-amber-400" : LINE}`} />
      <Hex w={58} h={64}>
        <div className="flex h-5 w-[50px] items-center justify-between rounded-full pl-0.5 pr-1.5 text-white" style={{ background: grad(n.color) }}>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white" style={{ color: n.color }}>
            <Icon className="h-2.5 w-2.5" />
          </span>
          <span className="text-[11px] font-bold tabular-nums">{fmt(n.count)}</span>
        </div>
      </Hex>
      <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-800 dark:text-slate-100">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: n.color }} />
        {n.label}
      </p>
      {hasPending ? (
        open ? (
          <span className="mt-0.5 rounded-full bg-amber-50 px-2 py-px text-center text-[10px] font-semibold leading-tight text-amber-800 ring-1 ring-amber-200">
            {fmt(n.pending!)} awaiting {n.pendingLabel}
          </span>
        ) : (
          <span className="mt-0.5 text-[10px] font-medium text-emerald-600">All moved to {n.pendingLabel}</span>
        )
      ) : (
        <span className="mt-0.5 text-center text-[10px] leading-tight text-slate-500 dark:text-slate-400">{n.note}</span>
      )}
    </div>
  );
}

function Tree({ title, sub, color, nodes }: { title: string; sub: string; color: string; nodes: FlowNode[] }) {
  const n = nodes.length;
  return (
    <div className="flex flex-col items-center">
      <Hex w={112} h={58}>
        <div className="rounded-full px-4 py-1 text-center text-white" style={{ background: grad(color) }}>
          <p className="text-xs font-bold leading-tight">{title}</p>
          <p className="text-[10px] leading-tight opacity-90">{sub}</p>
        </div>
      </Hex>
      <div className={`h-2 w-px ${LINE}`} />
      <div className="relative w-full">
        <div className={`absolute top-0 h-px ${LINE}`} style={{ left: `${50 / n}%`, right: `${50 / n}%` }} />
        <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {nodes.map((nd) => <NodeColumn key={nd.label} n={nd} />)}
        </div>
      </div>
    </div>
  );
}

export function PurchaseWorkflow({ summary: s }: { summary: DashboardSummary }) {
  return (
    <div className={`${CARD} h-full p-3`}>
      <Tree
        title="Purchase" sub="5 stages" color={COLORS.purchase}
        nodes={[
          { label: "Request", count: s.totalPRequest, icon: FileText, color: "#84cc16", note: "Requisitions raised" },
          { label: "Quotation", count: s.totalQuotation, icon: MessageSquareQuote, color: "#06b6d4", note: "Supplier quotes" },
          { label: "Order", count: s.totalPOrder, icon: ShoppingCart, color: "#3b82f6", note: "Orders placed", pending: s.pOrderGrnPending, pendingLabel: "GRN" },
          { label: "GRN", count: s.totalGrn, icon: PackageCheck, color: "#a855f7", note: "Goods received", pending: s.invoicePending, pendingLabel: "invoice" },
          { label: "Invoice", count: s.totalInvoice, icon: Receipt, color: "#ec4899", note: "Invoices booked" },
        ]}
      />
    </div>
  );
}

export function SalesWorkflow({ summary: s }: { summary: DashboardSummary }) {
  return (
    <div className={`${CARD} h-full p-3`}>
      <Tree
        title="Sales" sub="3 stages" color={COLORS.sales}
        nodes={[
          { label: "Order", count: s.totalSOrder, icon: ClipboardList, color: "#f59e0b", note: "Customer orders", pending: s.sOrderSdnPending, pendingLabel: "SDN" },
          { label: "SDN", count: s.totalSdn, icon: Truck, color: "#10b981", note: "Delivery notes", pending: s.sInvoicePending, pendingLabel: "invoice" },
          { label: "Invoice", count: s.totalSInvoice, icon: FileCheck2, color: "#6366f1", note: "Invoices raised" },
        ]}
      />
    </div>
  );
}