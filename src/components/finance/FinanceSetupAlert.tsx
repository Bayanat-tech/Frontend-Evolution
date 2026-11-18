import React, { useState } from "react";
import { AlertTriangle, CheckCircle, RefreshCw, Sparkles, Wrench } from "lucide-react";
import { Button } from "../ui/Button";
import { initializeCompanyFinance } from "../../api/transactions";

interface FinanceSetupAlertProps {
  companyCode?: string;
  onSuccess?: () => void;
}

export const FinanceSetupAlert: React.FC<FinanceSetupAlertProps> = ({
  companyCode,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleInitialize = async () => {
    setLoading(true);
    setStatus(null);
    try {
      await initializeCompanyFinance(companyCode);
      setStatus({
        type: "success",
        message: `Finance setup successfully configured for company ${companyCode || "current company"}! Reloading data...`,
      });
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      }, 1500);
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err?.message || "Failed to initialize company finance setup",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm backdrop-blur-xs transition-all dark:border-amber-900/50 dark:bg-amber-950/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100">
              Finance Setup Required for Company:{" "}
              <span className="font-mono text-primary underline">{companyCode || "Active Company"}</span>
            </h3>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300/90">
              This company was recently created in Company Master. Before creating or approving vouchers, the following base Finance configurations are needed:
            </p>
            <ul className="mt-2 grid grid-cols-1 gap-1 text-xs text-amber-900/80 sm:grid-cols-2 dark:text-amber-200/80">
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Financial Year Period (<code className="text-[11px]">MS_COMPANYINFO</code>)
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Base Currency & Rates (<code className="text-[11px]">MS_CURRENCY</code>)
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Standard COA Structure (Levels 1, 2, 3)
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Document Setup (<code className="text-[11px]">MS_AC_SETUP_DOC</code>)
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Division Master (<code className="text-[11px]">MS_HR_DIVISION</code>)
              </li>
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              * Note: Level 4 groups, Level 5 accounts (<code className="text-[10px]">MS_ACCODES</code>), and Document Account Mappings will be configured specifically by your finance team.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:self-center">
          <Button
            type="button"
            onClick={handleInitialize}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Auto-Initialize Setup
              </>
            )}
          </Button>
        </div>
      </div>

      {status && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-lg p-2.5 text-xs font-medium ${
            status.type === "success"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {status.type === "success" ? <CheckCircle className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
          <span>{status.message}</span>
        </div>
      )}
    </div>
  );
};
