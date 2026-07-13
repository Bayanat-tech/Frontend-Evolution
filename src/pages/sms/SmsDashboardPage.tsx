import { BarChart3, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { getSmsDashboard } from "../../api/sms";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import NoticeToast, { type ToastNotice } from "../../components/ui/NoticeToast";

const dashboardEndpoints = [
  { key: "pipeline-summary", title: "Pipeline Summary" },
  { key: "sales-performance", title: "Sales Performance" },
  { key: "deal-probability", title: "Deal Probability" },
  { key: "monthly-forecast", title: "Monthly Forecast" },
  { key: "next-actions", title: "Next Actions" },
  { key: "segment-performance", title: "Segment Performance" },
];

export function SmsDashboardPage() {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<ToastNotice>(null);

  const loadData = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const entries = await Promise.all(
        dashboardEndpoints.map(async (item) => [item.key, await getSmsDashboard(item.key)] as const),
      );
      setData(Object.fromEntries(entries));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load SMS dashboard" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">SMS</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">SMS Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pipeline, sales, probability and forecast summary.</p>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </Button>
      </div>
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {dashboardEndpoints.map((item) => (
          <Card key={item.key} className="min-h-[180px]">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-primary" />
                <h2 className="m-0 text-sm font-semibold">{item.title}</h2>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                  {JSON.stringify(data[item.key] ?? [], null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
