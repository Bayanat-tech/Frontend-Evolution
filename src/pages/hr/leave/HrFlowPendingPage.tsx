import { CalendarDays, FileWarning } from "lucide-react";
import { Card, CardContent } from "../../../components/ui/Card";

type HrFlowPendingPageProps = {
  title: string;
  oldRoute: string;
  sourceComponent: string;
  description: string;
};

export function HrFlowPendingPage({ title, oldRoute, sourceComponent, description }: HrFlowPendingPageProps) {
  return (
    <section className="grid gap-4">
      <div className="min-w-0">
        <h1 className="m-0 text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="border-dashed shadow-sm">
        <CardContent className="grid gap-4 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-muted text-primary">
              <FileWarning size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="m-0 text-lg font-semibold text-foreground">Route is configured</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This old HRFlow menu path now resolves in the new workspace. The page component still needs to be migrated from the old frontend.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-md border bg-background p-4 text-sm md:grid-cols-2">
            <div>
              <p className="m-0 text-xs font-semibold uppercase text-muted-foreground">Old Route</p>
              <p className="m-0 font-medium text-foreground">{oldRoute}</p>
            </div>
            <div>
              <p className="m-0 text-xs font-semibold uppercase text-muted-foreground">Old Component</p>
              <p className="m-0 font-medium text-foreground">{sourceComponent}</p>
            </div>
            <div className="md:col-span-2">
              <p className="m-0 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <CalendarDays size={13} /> Migration Status
              </p>
              <p className="m-0 font-medium text-foreground">Pending component migration</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
