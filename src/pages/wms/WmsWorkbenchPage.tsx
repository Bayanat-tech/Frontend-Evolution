import { ArrowRight, Boxes, ClipboardList, Database, FileText, PackageCheck, RefreshCw, Truck } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { useAuth } from "../../state/AuthContext";
import type { MenuNode } from "../../types/auth";
import { cleanPath, flattenLeaves, titleCase } from "../../utils/menu";

type WmsWorkbenchPageProps = {
  activeApp?: MenuNode;
  pathname: string;
};

const groups = [
  {
    title: "General Management",
    description: "Country, site, principal, product, warehouse, location, UOM, activity and related master setup.",
    icon: Database,
    keywords: ["master", "general", "gm", "country", "site", "principal", "product", "warehouse", "location", "uom", "brand"],
  },
  {
    title: "Inbound",
    description: "Inbound jobs, receiving, shipment details, packing details, tally, quality clearance and putaway.",
    icon: PackageCheck,
    keywords: ["inbound", "receiving", "shipment", "packing", "tally", "quality", "putaway", "grn", "jobs"],
  },
  {
    title: "Outbound",
    description: "Order entry, outbound jobs, order details, picking preference, picking confirmation and cancellation.",
    icon: Truck,
    keywords: ["outbound", "order", "picking", "pick", "dispatch", "delivery", "jobs_oub"],
  },
  {
    title: "Stock Control",
    description: "Stock transfer, stock adjustment, count creation, actual count entry and confirmation workflows.",
    icon: Boxes,
    keywords: ["stock", "transfer", "adjustment", "count", "inventory", "stn"],
  },
  {
    title: "Reports",
    description: "Stock detail, stock summary, ageing, GRN summary, DN summary and dynamic WMS reports.",
    icon: FileText,
    keywords: ["report", "reports", "stockcriteria", "summary", "ageing", "aging", "grn", "dn"],
  },
];

export function WmsWorkbenchPage({ activeApp, pathname }: WmsWorkbenchPageProps) {
  const { user } = useAuth();
  const leaves = useMemo(() => flattenLeaves(activeApp?.children || []), [activeApp]);
  const activeLeaf = leaves.find((leaf) => {
    const path = cleanPath(leaf.url_path);
    return path && pathname.toLowerCase().includes(path.toLowerCase());
  });

  const menuStats = useMemo(() => {
    const lowerLeaves = leaves.map((leaf) => ({
      ...leaf,
      search: `${leaf.title} ${leaf.url_path || ""}`.toLowerCase(),
    }));
    return groups.map((group) => ({
      ...group,
      count: lowerLeaves.filter((leaf) => group.keywords.some((keyword) => leaf.search.includes(keyword))).length,
    }));
  }, [leaves]);

  const visibleLeaves = leaves.slice(0, 12);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Warehouse Management</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">
            {activeLeaf ? titleCase(activeLeaf.title) : "WMS Workbench"}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            New WMS screens will use the same shared Bayanat UI foundation: compact forms, reusable tables, lookup dialogs, and existing backend APIs.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw size={15} /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {menuStats.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between gap-3 pb-2">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon size={18} />
                </div>
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                  {item.count} Menu
                </span>
              </CardHeader>
              <CardContent className="grid gap-2">
                <h2 className="m-0 text-sm font-semibold">{item.title}</h2>
                <p className="m-0 text-xs leading-5 text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <div>
              <p className="eyebrow">Build Order</p>
              <h2 className="m-0 text-base font-semibold">Recommended WMS Migration Sequence</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {[
                ["1", "Common WMS API helpers and route foundation", "Started now in the new frontend."],
                ["2", "Simple General Management masters", "Country, currency, UOM, UOC, brand, group, line, vessel, airline."],
                ["3", "Dependent masters", "Principal, product, site, warehouse, location, location type, customer, supplier."],
                ["4", "Inbound workflows", "Inbound job listing, job form, shipment/packing/tally/putaway/confirmation tabs."],
                ["5", "Outbound workflows", "Order entry, order details, outbound jobs, picking and confirmation."],
                ["6", "Stock operations and reports", "Stock transfer, adjustment, count, stock criteria reports, dashboard."],
              ].map(([no, title, detail]) => (
                <div className="grid grid-cols-[34px_1fr] gap-3 rounded-md border bg-card p-3" key={no}>
                  <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">{no}</div>
                  <div>
                    <h3 className="m-0 text-sm font-semibold">{title}</h3>
                    <p className="m-0 text-xs leading-5 text-muted-foreground">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <p className="eyebrow">Current Context</p>
              <h2 className="m-0 text-base font-semibold">Route And User</h2>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <InfoRow label="Route" value={pathname} />
            <InfoRow label="Company" value={user?.company_code || "Not available"} />
            <InfoRow label="User" value={user?.loginid || user?.username || "Not available"} />
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="flex items-start gap-2">
                <ClipboardList className="mt-0.5 text-primary" size={16} />
                <p className="m-0 text-xs leading-5 text-muted-foreground">
                  Each real screen should first match the old Bayanat API contract, then improve layout using the shared UI components.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {visibleLeaves.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <p className="eyebrow">Menu Preview</p>
              <h2 className="m-0 text-base font-semibold">First WMS Menu Items From Login Permissions</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {visibleLeaves.map((leaf) => {
                const path = cleanPath(leaf.url_path);
                return (
                  <Link
                    className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent"
                    key={leaf.id || leaf.title}
                    to={path ? `/workspace/${activeApp?.title.toLowerCase().replace(/\s+/g, "-") || "wms"}/${path}` : "#"}
                  >
                    <span className="truncate">{titleCase(leaf.title)}</span>
                    <ArrowRight className="text-muted-foreground" size={15} />
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <strong className="break-all rounded-md border bg-background px-3 py-2 text-xs font-semibold text-foreground">{value}</strong>
    </div>
  );
}
