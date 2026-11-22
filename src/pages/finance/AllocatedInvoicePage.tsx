import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileCheck,
  History,
  Layers,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDynamicLookup, getLookupValue, getLookupText, LookupRow } from "../../api/lookups";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";

type InvoiceLine = {
  id: string;
  sr: number;
  inv_no: string;
  inv_date: string;
  open_sign_ind: number;
  balance_amount: number;
  balance_amount_origin?: number;
  curr_code_origin?: string;
  ex_rate_origin?: number;
  amount: number;
  amount_origin?: number;
  sign_ind: number;
  org_curr_code: string;
  ex_rate: number;
};

function AllocatedAmountInput({
  line,
  onPatch,
  onToggle,
}: {
  line: InvoiceLine;
  onPatch: (id: string, patch: Partial<InvoiceLine>) => void;
  onToggle: (id: string) => void;
}) {
  const isCr = Number(line.sign_ind) < 0;
  const [val, setVal] = useState<string>(line.amount > 0 ? String(line.amount) : "");

  useEffect(() => {
    setVal(line.amount > 0 ? String(line.amount) : "");
  }, [line.amount]);

  const commit = (text: string) => {
    let num = parseFloat(text.replace(/[^0-9.]/g, ""));
    if (isNaN(num)) num = 0;
    if (num > line.balance_amount) {
      num = line.balance_amount;
    }
    const ex = line.ex_rate_origin || line.ex_rate || 1;
    const numOrig = ex !== 0 ? num / ex : num;
    setVal(num > 0 ? num.toFixed(3) : "");
    const targetSign = line.open_sign_ind === -1 ? 1 : -1;
    onPatch(line.id, {
      amount: num,
      amount_origin: Number(numOrig.toFixed(3)),
      sign_ind: targetSign,
    });
  };

  return (
    <div
      className="relative flex items-center"
      title="Double click to allocate full balance / toggle off"
      onDoubleClick={(e) => {
        e.stopPropagation();
        onToggle(line.id);
      }}
    >
      {isCr && (
        <span className="absolute left-2.5 text-rose-600 font-bold font-mono text-xs pointer-events-none">
          -
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={val}
        placeholder="0.000"
        onChange={(e) => setVal(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit((e.target as HTMLInputElement).value);
          }
        }}
        className={`h-8 w-full rounded border px-2 text-right font-mono text-xs font-semibold tabular-nums outline-none transition-colors focus:border-blue-500 focus:bg-emerald-50/50 cursor-pointer ${
          line.amount > 0
            ? "border-emerald-500 bg-emerald-50/70 text-emerald-900 font-bold shadow-xs"
            : "border-slate-300 bg-white text-slate-800 hover:border-slate-400"
        } ${isCr ? "text-rose-700 pl-6" : ""}`}
      />
    </div>
  );
}

type UnallocatedBill = {
  doc_type: string;
  doc_no: string;
  doc_date: string;
  inv_no: string;
  amount: number;
  sign_ind: number;
  div_code: string;
};

type ExistingAllocation = {
  DOC_TYPE: string;
  DOC_NO: string;
  DOC_DATE: string;
  AC_CODE: string;
  AC_NAME: string;
  REMARKS: string;
  CANCELED: string;
  CREATE_USER: string;
  CREATE_DATE: string;
  DIV_CODE: string;
  ALLOCATED_AMOUNT: number;
};

type AllocationDetailLine = {
  DTL_SR_NO: number;
  INV_NO: string;
  INV_DATE: string;
  AMOUNT: number;
  LCUR_AMOUNT: number;
  SIGN_IND: number;
  CURR_CODE: string;
  EX_RATE: number;
  INDICATOR_ORIGIN: string;
  DIV_CODE: string;
};

function colDate(isoOrDate: unknown): string {
  if (!isoOrDate) return "—";
  const str = String(isoOrDate).trim();
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return str.slice(0, 10);
}

export function AllocatedInvoicePage() {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";

  // Tabs
  const [activeTab, setActiveTab] = useState<"allocate" | "unallocate">("allocate");

  // Allocate state
  const [docNo, setDocNo] = useState("");
  const [docDate, setDocDate] = useState(today());
  const [division, setDivision] = useState("");
  const [divisionName, setDivisionName] = useState("");
  const [acCode, setAcCode] = useState("");
  const [acName, setAcName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [selectedUnallocBill, setSelectedUnallocBill] = useState<string>("");
  const [unallocatedBills, setUnallocatedBills] = useState<UnallocatedBill[]>([]);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Unallocate / History state
  const [allocationsList, setAllocationsList] = useState<ExistingAllocation[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [selectedUjv, setSelectedUjv] = useState<string | null>(null);
  const [ujvDetails, setUjvDetails] = useState<AllocationDetailLine[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [unallocatingDocNo, setUnallocatingDocNo] = useState<string | null>(null);
  const [confirmUnallocDocNo, setConfirmUnallocDocNo] = useState<string | null>(null);

  const totalDrAllocated = lines
    .filter((l) => Number(l.sign_ind) >= 0)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const totalCrAllocated = lines
    .filter((l) => Number(l.sign_ind) < 0)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const totalAllocated = lines.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const selectedUnallocItem = unallocatedBills.find(
    (b) => b.inv_no === selectedUnallocBill || b.doc_no === selectedUnallocBill
  );
  const unallocTarget = selectedUnallocItem ? selectedUnallocItem.amount : null;
  const isBalanced =
    unallocTarget !== null
      ? Math.abs(totalAllocated - unallocTarget) < 0.001
      : totalAllocated > 0 && Math.abs(totalDrAllocated - totalCrAllocated) < 0.001;

  // Auto-default division from user's assigned divisions on load
  useEffect(() => {
    if (division) return;
    let mounted = true;
    void (async () => {
      try {
        const divs = await getDynamicLookup({
          parameter: "Account_division",
          loginid: loginId,
          code1: companyCode,
          code2: "", code3: "", code4: "",
          number1: 0, number2: 0, number3: 0, number4: 0,
          date1: null, date2: null, date3: null, date4: null,
        });
        if (!mounted || !divs || !divs.length) return;
        const divCode = String(getLookupValue(divs[0], "div_code") || "");
        const divName = getLookupText(divs[0], ["div_name", "DIV_NAME", "division_name"]);
        if (divCode) {
          setDivision(divCode);
          setDivisionName(divName);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [companyCode, loginId]);

  // Fetch unallocated receipts/payments and open invoices whenever acCode or division changes
  const fetchOpenBills = async () => {
    if (!acCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const resp = await api.get<{
        success: boolean;
        data: {
          account: { ac_code: string; ac_name: string };
          unallocated_bills: any[];
          open_invoices: any[];
        };
      }>(`/api/finance/unallocated-bills?ac_code=${encodeURIComponent(acCode)}&div_code=${encodeURIComponent(division)}`);

      if (resp.data?.success && resp.data.data) {
        const rawUnalloc = resp.data.data.unallocated_bills || [];
        setUnallocatedBills(
          rawUnalloc.map((b) => ({
            doc_type: b.DOC_TYPE || b.doc_type || "",
            doc_no: b.DOC_NO || b.doc_no || b.INV_NO || b.inv_no || "",
            doc_date: b.DOC_DATE || b.doc_date || "",
            inv_no: b.INV_NO || b.inv_no || "",
            amount: Math.abs(Number(b.AMOUNT ?? b.amount ?? b.ORGAMT_OFUNALLOCATED ?? 0)),
            sign_ind: Number(b.SIGN_IND ?? b.sign_ind ?? 1),
            div_code: b.DIV_CODE || b.div_code || division,
          }))
        );

        const rawInvoices = resp.data.data.open_invoices || [];
        setLines(
          rawInvoices.map((inv, idx) => {
            const rawBal = Number(inv.RAW_BALANCE ?? inv.raw_balance ?? inv.BALANCE_AMOUNT ?? inv.balance_amount ?? 0);
            const balOrig = Number(inv.BALANCE_AMOUNT_ORIGIN ?? inv.balance_amount_origin ?? Math.abs(rawBal));
            const currOrig = String(inv.CURR_CODE_ORIGIN || inv.curr_code_origin || inv.ORG_CURR_CODE || inv.org_curr_code || "INR");
            const exOrig = Number(inv.EX_RATE_ORIGIN || inv.ex_rate_origin || inv.EX_RATE || inv.ex_rate || 1);
            const openSign = Number(inv.SIGN_IND ?? inv.sign_ind ?? (rawBal >= 0 ? 1 : -1));
            // PowerBuilder maintains the invoice sign (Cr -1 for Cr, Dr 1 for Dr)
            const allocSign = openSign;
            return {
              id: `line_${idx}_${inv.INV_NO || inv.inv_no}`,
              sr: idx + 1,
              inv_no: String(inv.INV_NO || inv.inv_no || ""),
              inv_date: String(inv.INV_DATE || inv.inv_date || ""),
              open_sign_ind: openSign,
              balance_amount: Math.abs(rawBal),
              balance_amount_origin: balOrig,
              curr_code_origin: currOrig,
              ex_rate_origin: exOrig,
              amount: 0,
              amount_origin: 0,
              sign_ind: allocSign,
              org_curr_code: String(inv.ORG_CURR_CODE || inv.org_curr_code || "INR"),
              ex_rate: Number(inv.EX_RATE ?? inv.ex_rate ?? 1),
            };
          })
        );

        if (rawInvoices.length === 0 && rawUnalloc.length === 0) {
          setNotice({
            type: "success",
            message: `Account ${acCode} is fully reconciled. No open unpaid invoices or unallocated receipts found.`,
          });
        }
      }
    } catch (err: any) {
      setNotice({
        type: "error",
        message: err.message || "Failed to load open invoices for account",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch list of existing UJV allocations
  const fetchAllocationsList = async () => {
    setLoadingAllocations(true);
    try {
      const params = new URLSearchParams();
      if (division) params.append("div_code", division);
      if (acCode) params.append("ac_code", acCode);
      const resp = await api.get<{ success: boolean; data: ExistingAllocation[] }>(
        `/api/finance/allocations/list?${params.toString()}`
      );
      if (resp.data?.success) {
        setAllocationsList(resp.data.data || []);
      }
    } catch (err: any) {
      console.error("Failed to load allocations list:", err);
    } finally {
      setLoadingAllocations(false);
    }
  };

  // View details of a specific UJV
  const handleViewUjvDetails = async (ujvDocNo: string) => {
    setSelectedUjv(ujvDocNo);
    setLoadingDetails(true);
    try {
      const resp = await api.get<{ success: boolean; data: AllocationDetailLine[] }>(
        `/api/finance/allocations/${encodeURIComponent(ujvDocNo)}`
      );
      if (resp.data?.success) {
        setUjvDetails(resp.data.data || []);
      }
    } catch (err: any) {
      console.error("Failed to load allocation details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Cancel / Unallocate a UJV
  const handleExecuteUnallocate = async (targetDocNo: string) => {
    setUnallocatingDocNo(targetDocNo);
    setNotice(null);
    try {
      const resp = await api.post<{ success: boolean; message: string }>("/api/finance/allocations/cancel", {
        doc_no: targetDocNo,
      });
      if (resp.data?.success) {
        setNotice({
          type: "success",
          message: resp.data.message || `Allocation voucher ${targetDocNo} successfully unallocated!`,
        });
        setConfirmUnallocDocNo(null);
        setSelectedUjv(null);
        await fetchAllocationsList();
        if (acCode) {
          await fetchOpenBills();
        }
      }
    } catch (err: any) {
      setNotice({
        type: "error",
        message: err.message || `Failed to unallocate voucher ${targetDocNo}`,
      });
    } finally {
      setUnallocatingDocNo(null);
    }
  };

  useEffect(() => {
    if (acCode) {
      void fetchOpenBills();
    } else {
      setLines([]);
      setUnallocatedBills([]);
    }
    if (activeTab === "unallocate") {
      void fetchAllocationsList();
    }
  }, [acCode, division, activeTab]);

  const patchLine = useCallback((id: string, patch: Partial<InvoiceLine>) => {
    setLines((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((row) => row.id !== id).map((row, index) => ({ ...row, sr: index + 1 })));
  }, []);

  // Double-click toggle: allocate full balance with OPPOSITE sign of open balance (as per PowerBuilder logic), or toggle off to 0
  const handleToggleAllocate = useCallback((id: string) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        if (line.amount === 0) {
          const allocAmt = line.balance_amount;
          const ex = line.ex_rate_origin || line.ex_rate || 1;
          const allocAmtOrig = ex !== 0 ? allocAmt / ex : allocAmt;
          // As per PowerBuilder dw_tr_ac_bill_allocation:
          // Allocate with OPPOSITE sign of open balance:
          // If invoice balance is Cr (-1), allocation entry is Dr (+1)
          // If invoice balance is Dr (+1), allocation entry is Cr (-1)
          const targetSign = line.open_sign_ind === -1 ? 1 : -1;
          return {
            ...line,
            amount: allocAmt,
            amount_origin: Number(allocAmtOrig.toFixed(3)),
            sign_ind: targetSign,
          };
        } else {
          return {
            ...line,
            amount: 0,
            amount_origin: 0,
          };
        }
      })
    );
  }, []);

  const addCustomLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `line_${Date.now()}`,
        sr: prev.length + 1,
        inv_no: "",
        inv_date: docDate,
        open_sign_ind: 1,
        balance_amount: 0,
        balance_amount_origin: 0,
        curr_code_origin: "INR",
        ex_rate_origin: 1,
        amount: 0,
        amount_origin: 0,
        sign_ind: -1,
        org_curr_code: "INR",
        ex_rate: 1,
      },
    ]);
  };

  // Auto-allocate sequentially against open invoices
  const handleAutoAllocate = () => {
    const unallocItem = unallocatedBills.find((b) => b.inv_no === selectedUnallocBill);
    let remaining = unallocItem ? unallocItem.amount : totalAllocated || 999999999;
    if (!unallocItem && remaining === 999999999) {
      setLines((prev) =>
        prev.map((line) => {
          const ex = line.ex_rate_origin || line.ex_rate || 1;
          const orig = ex !== 0 ? line.balance_amount / ex : line.balance_amount;
          const targetSign = line.open_sign_ind === -1 ? 1 : -1;
          return {
            ...line,
            amount: line.balance_amount,
            amount_origin: Number(orig.toFixed(3)),
            sign_ind: targetSign,
          };
        })
      );
      setNotice({ type: "success", message: "All open invoice balances auto-allocated" });
      return;
    }

    setLines((prev) =>
      prev.map((line) => {
        if (remaining <= 0) return { ...line, amount: 0, amount_origin: 0 };
        const toAlloc = Math.min(remaining, line.balance_amount);
        remaining -= toAlloc;
        const ex = line.ex_rate_origin || line.ex_rate || 1;
        const allocOrig = ex !== 0 ? toAlloc / ex : toAlloc;
        const targetSign = line.open_sign_ind === -1 ? 1 : -1;
        return {
          ...line,
          amount: toAlloc,
          amount_origin: Number(allocOrig.toFixed(3)),
          sign_ind: targetSign,
        };
      })
    );
    setNotice({
      type: "success",
      message: `Auto-allocated amounts against open invoices. Remaining to allocate: ${remaining.toFixed(3)}`,
    });
  };

  const handleSubmit = async () => {
    if (!division) {
      setNotice({ type: "error", message: "Division is required." });
      return;
    }
    if (!acCode) {
      setNotice({ type: "error", message: "Party Account Code is required." });
      return;
    }
    const allocatedLines = lines.filter((l) => Number(l.amount) > 0);
    if (allocatedLines.length === 0) {
      setNotice({ type: "error", message: "Please specify an allocation amount for at least one invoice." });
      return;
    }

    if (selectedUnallocBill && unallocTarget !== null && Math.abs(totalAllocated - unallocTarget) > 0.001) {
      setNotice({
        type: "error",
        message: `Total allocated (${totalAllocated.toFixed(3)}) does not match selected unallocated document amount (${unallocTarget.toFixed(3)}).`,
      });
      return;
    }

    if (!selectedUnallocBill && Math.abs(totalDrAllocated - totalCrAllocated) > 0.001) {
      setNotice({
        type: "error",
        message: `Allocation is not proper! Total Debit (${totalDrAllocated.toFixed(3)}) must equal Total Credit (${totalCrAllocated.toFixed(3)}) to balance to zero.`,
      });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const resp = await api.post<{
        success: boolean;
        message: string;
        data: { doc_no: string; doc_type: string; total_allocated: number };
      }>("/api/finance/allocate-invoices", {
        div_code: division,
        ac_code: acCode,
        doc_date: docDate,
        remarks: remarks || `Invoice allocation voucher UJV for A/C ${acCode}`,
        allocations: allocatedLines.map((l) => ({
          inv_no: l.inv_no,
          inv_date: l.inv_date,
          amount: l.amount,
          sign_ind: l.sign_ind,
          curr_code: l.org_curr_code,
          ex_rate: l.ex_rate,
        })),
        unallocated_ref_no: selectedUnallocBill || undefined,
        unallocated_amount: totalAllocated,
      });

      if (resp.data?.success) {
        const createdDocNo = resp.data.data?.doc_no || "UJV";
        setDocNo(createdDocNo);
        setNotice({
          type: "success",
          message: `Allocation Voucher ${createdDocNo} created successfully! Open invoices settled.`,
        });
        await fetchOpenBills();
      }
    } catch (err: any) {
      setNotice({
        type: "error",
        message: err.message || "Failed to save invoice allocation voucher",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<ColumnDef<InvoiceLine>[]>(
    () => [
      { accessorKey: "sr", header: "Sr.", size: 40 },
      {
        accessorKey: "inv_no",
        header: "Invoice No",
        size: 140,
        cell: ({ row }) => (
          <span
            className="font-mono text-xs font-semibold text-slate-800 cursor-pointer select-none"
            title="Double-click to allocate full balance"
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleToggleAllocate(row.original.id);
            }}
          >
            {row.original.inv_no}
          </span>
        ),
      },
      {
        accessorKey: "inv_date",
        header: "Invoice Date",
        size: 100,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-600">
            {colDate(row.original.inv_date)}
          </span>
        ),
      },
      {
        accessorKey: "balance_amount",
        header: "Open Balance (Local)",
        size: 140,
        cell: ({ row }) => {
          const isDr = Number(row.original.open_sign_ind) >= 0;
          const rawAmt = Number(row.original.balance_amount || 0);
          const formatted = rawAmt.toLocaleString("en-US", {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
          });
          return (
            <div
              className="flex items-center justify-end gap-1.5 font-mono text-xs font-semibold cursor-pointer select-none"
              title="Double-click to allocate full balance"
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleToggleAllocate(row.original.id);
              }}
            >
              <span className={isDr ? "text-slate-800" : "text-rose-700 font-bold"}>
                {isDr ? formatted : `-${formatted}`}
              </span>
              <span
                className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                  isDr
                    ? "bg-blue-100 text-blue-800"
                    : "bg-purple-100 text-purple-800"
                }`}
              >
                {isDr ? "Dr" : "Cr"}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "balance_amount_origin",
        header: "Balance (Origin)",
        size: 130,
        cell: ({ row }) => {
          const isDr = Number(row.original.open_sign_ind) >= 0;
          const rawAmt = Number(row.original.balance_amount_origin ?? row.original.balance_amount ?? 0);
          const formatted = rawAmt.toLocaleString("en-US", {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
          });
          const curr = row.original.curr_code_origin || row.original.org_curr_code || "INR";
          return (
            <div
              className="flex items-center justify-end gap-1.5 font-mono text-xs text-slate-600 cursor-pointer select-none"
              title="Double-click to allocate full balance"
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleToggleAllocate(row.original.id);
              }}
            >
              <span className={isDr ? "text-slate-700 font-medium" : "text-rose-600 font-medium"}>
                {isDr ? formatted : `-${formatted}`}
              </span>
              <span className="text-[10px] font-mono text-slate-500 font-bold">{curr}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "amount",
        header: "Allocated Amount",
        size: 140,
        cell: ({ row }) => (
          <AllocatedAmountInput
            line={row.original}
            onPatch={patchLine}
            onToggle={handleToggleAllocate}
          />
        ),
      },
      {
        accessorKey: "sign_ind",
        header: "Sign Ind",
        size: 95,
        cell: ({ row }) => {
          const currentSign = Number(row.original.sign_ind) >= 0 ? 1 : -1;
          return (
            <select
              value={currentSign}
              onChange={(e) => {
                const val = Number(e.target.value);
                patchLine(row.original.id, { sign_ind: val });
              }}
              className={`h-7 w-20 rounded border px-2 py-0.5 text-xs font-bold font-mono outline-none cursor-pointer transition-colors ${
                currentSign === 1
                  ? "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                  : "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
              }`}
            >
              <option value={1} className="text-blue-700 font-bold bg-white">Dr (+)</option>
              <option value={-1} className="text-purple-700 font-bold bg-white">Cr (-)</option>
            </select>
          );
        },
      },
      {
        accessorKey: "org_curr_code",
        header: "Currency",
        size: 75,
        cell: ({ row }) => (
          <span className="text-xs font-mono px-2 text-slate-600 font-medium">
            {row.original.curr_code_origin || row.original.org_curr_code || "INR"}
          </span>
        ),
      },
      {
        accessorKey: "ex_rate",
        header: "Ex. Rate",
        size: 80,
        cell: ({ row }) => {
          const ex = Number(row.original.ex_rate_origin || row.original.ex_rate || 1);
          return (
            <span className="text-xs font-mono text-slate-600 tabular-nums">
              {ex.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </span>
          );
        },
      },
      {
        accessorKey: "amount_origin",
        header: "Allocated (Origin)",
        size: 120,
        cell: ({ row }) => {
          const amt = Number(row.original.amount_origin ?? 0);
          const curr = row.original.curr_code_origin || row.original.org_curr_code || "INR";
          return (
            <div className="flex items-center justify-end gap-1 font-mono text-xs">
              <span className={amt > 0 ? "font-bold text-emerald-700" : "text-slate-400"}>
                {amt.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
              </span>
              <span className="text-[10px] text-slate-400">{curr}</span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        size: 40,
        cell: ({ row }) => (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLine(row.original.id)}>
            <Trash2 size={13} className="text-slate-400 hover:text-rose-500" />
          </Button>
        ),
      },
    ],
    [patchLine, removeLine, handleToggleAllocate]
  );

  return (
    <section className="finance-utility-page finance-list-page grid gap-4 p-4 pb-28 max-w-full overflow-y-auto">
      {/* ===================== PAGE HEADER ===================== */}
      <div className="tariff-page-header flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <FileCheck size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold leading-tight text-slate-900">
              Allocate and Unallocate Invoice
            </h1>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("allocate")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === "allocate"
                ? "bg-white text-indigo-700 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Allocate Invoices (UJV)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("unallocate")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === "unallocate"
                ? "bg-white text-indigo-700 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History size={13} />
            Existing Allocations & Unallocate
          </button>
        </div>
      </div>

      {notice && <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />}

      {/* ===================== FILTER / HEADER CRITERIA ===================== */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Division</label>
              <LookupField
                label=""
                value={division}
                displayValue={division ? `${division} - ${divisionName}` : ""}
                placeholder="Select Division"
                columns={[
                  { field: "div_code", header: "Division Code" },
                  { field: "div_name", header: "Division Name" },
                ]}
                valueField="div_code"
                displayFields={["div_code", "div_name"]}
                loadOptions={() =>
                  getDynamicLookup({
                    parameter: "Account_division",
                    loginid: loginId,
                    code1: companyCode,
                    code2: "", code3: "", code4: "",
                    number1: 0, number2: 0, number3: 0, number4: 0,
                    date1: null, date2: null, date3: null, date4: null,
                  })
                }
                onChange={(code, row) => {
                  setDivision(String(code || ""));
                  setDivisionName(String((row as any)?.div_name || ""));
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Party / Account Code</label>
              <LookupField
                label=""
                value={acCode}
                displayValue={acCode ? `${acCode} - ${acName}` : ""}
                placeholder="Search Account"
                columns={[
                  { field: "ac_code", header: "Account Code" },
                  { field: "ac_name", header: "Account Name" },
                ]}
                valueField="ac_code"
                displayFields={["ac_code", "ac_name"]}
                loadOptions={() =>
                  getDynamicLookup({
                    parameter: "Account_AC_CODE_Serach",
                    loginid: loginId,
                    code1: companyCode,
                    code2: "", code3: "", code4: "",
                    number1: 0, number2: 0, number3: 0, number4: 0,
                    date1: null, date2: null, date3: null, date4: null,
                  })
                }
                onChange={(code, row) => {
                  setAcCode(String(code || ""));
                  setAcName(String((row as any)?.ac_name || ""));
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Voucher Date</label>
              <Input
                type="date"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={loading || loadingAllocations}
                onClick={() => {
                  if (activeTab === "allocate") {
                    void fetchOpenBills();
                  } else {
                    void fetchAllocationsList();
                  }
                }}
                className="h-9 gap-1.5 text-xs font-semibold rounded-lg flex-1"
              >
                <RefreshCw size={14} className={loading || loadingAllocations ? "animate-spin" : ""} /> Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===================== TAB 1: ALLOCATE INVOICES ===================== */}
      {activeTab === "allocate" && (
        <>
          {/* COMPACT ALLOCATION CONTROL RIBBON */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3">
            {unallocatedBills.length > 0 && (
              <div className="mb-3 pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={13} className="text-indigo-600" />
                    Unallocated Reference Bills / Payments ({unallocatedBills.length})
                  </span>
                  <span className="text-[11px] text-slate-400">Select an unallocated payment/receipt to allocate against invoices</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 max-h-24">
                  {unallocatedBills.map((b) => (
                    <div
                      key={b.inv_no}
                      onClick={() => setSelectedUnallocBill(b.inv_no === selectedUnallocBill ? "" : b.inv_no)}
                      className={`px-3 py-1.5 rounded-lg border cursor-pointer transition-all flex items-center gap-3 shrink-0 ${
                        selectedUnallocBill === b.inv_no
                          ? "border-indigo-600 bg-indigo-50/70 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                      }`}
                    >
                      <div>
                        <span className="font-mono text-xs font-bold text-indigo-900 block">{b.inv_no}</span>
                        <span className="text-[10px] text-slate-500">Doc: {b.doc_type} #{b.doc_no}</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-700">
                        {b.amount.toLocaleString("en-US", { minimumFractionDigits: 3 })} INR
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SLIM HORIZONTAL SUMMARY BAR */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Left metrics */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 text-[11px] font-medium">Total Dr:</span>
                  <span className="font-mono font-bold text-blue-700">
                    +{totalDrAllocated.toLocaleString("en-US", { minimumFractionDigits: 3 })}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500 text-[11px] font-medium">Total Cr:</span>
                  <span className="font-mono font-bold text-rose-700">
                    -{totalCrAllocated.toLocaleString("en-US", { minimumFractionDigits: 3 })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[11px] font-medium">Net Diff:</span>
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                      isBalanced
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {isBalanced ? "✓ Balanced (0.000)" : `Diff: ${Math.abs(totalDrAllocated - totalCrAllocated).toFixed(3)}`}
                  </span>
                </div>

                {selectedUnallocBill && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500">Unalloc Bill:</span>
                    <span className="font-mono font-bold text-indigo-700">{selectedUnallocBill}</span>
                  </div>
                )}
              </div>

              {/* Center / Right: Remarks & Action Buttons */}
              <div className="flex items-center gap-2 flex-1 max-w-lg justify-end">
                <Input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Settlement remarks..."
                  className="h-8 text-xs max-w-xs"
                />
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleAutoAllocate}
                  disabled={lines.length === 0}
                  className="h-8 gap-1 text-xs font-semibold rounded-lg text-indigo-700 border-indigo-300 bg-indigo-50 hover:bg-indigo-100 shrink-0"
                  title="Auto-allocate FIFO"
                >
                  <Wand2 size={13} /> Auto-Allocate
                </Button>
                <Button
                  disabled={submitting || totalAllocated <= 0}
                  onClick={() => void handleSubmit()}
                  className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-3 rounded-lg cursor-pointer transition-colors disabled:opacity-50 shrink-0"
                >
                  <Send size={13} />
                  {submitting ? "Posting..." : "Submit (UJV)"}
                </Button>
              </div>
            </div>
          </div>

          {/* Open Invoices Table with Maximum Height & Dedicated Scrolling */}
          <Card className="border-slate-200 shadow-xs bg-white flex-1 min-h-0">
            <CardHeader className="py-2.5 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  Open Unpaid Invoices
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {lines.length} {lines.length === 1 ? "invoice" : "invoices"}
                  </span>
                </span>
                <span className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md hidden sm:inline-block">
                  💡 Double-click any row or amount to allocate full balance
                </span>
              </div>
              <Button size="sm" variant="ghost" onClick={addCustomLine} className="h-7 text-xs gap-1">
                <Plus size={12} /> Add Row
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <DataTable
                columns={columns}
                data={lines}
                loading={loading}
                height={190}
                minWidth={880}
                pageSize={100}
                density="compact"
                onRowDoubleClick={(row) => handleToggleAllocate(row.id)}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* ===================== TAB 2: EXISTING ALLOCATIONS & UNALLOCATE ===================== */}
      {activeTab === "unallocate" && (
        <div className="space-y-4">
          <Card className="border-slate-200 shadow-xs bg-white">
            <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <History size={15} className="text-indigo-600" />
                Posted Allocation Vouchers (UJV)
              </span>
              <span className="text-xs text-slate-500">
                Click "Unallocate" to cancel a UJV and restore its invoices and receipts to open balance
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Doc No</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Account</th>
                      <th className="py-2.5 px-3">Remarks</th>
                      <th className="py-2.5 px-3 text-right">Allocated Amount</th>
                      <th className="py-2.5 px-3">Created By</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingAllocations ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          <RefreshCw size={18} className="animate-spin inline mr-2" />
                          Loading allocations...
                        </td>
                      </tr>
                    ) : allocationsList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No allocation vouchers (UJV) found.
                        </td>
                      </tr>
                    ) : (
                      allocationsList.map((row) => (
                        <tr key={row.DOC_NO} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-bold text-indigo-900">{row.DOC_NO}</td>
                          <td className="py-2.5 px-3 text-slate-600">{row.DOC_DATE}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-slate-800 font-semibold">{row.AC_CODE}</span>
                            {row.AC_NAME && <span className="text-slate-500 block text-[11px]">{row.AC_NAME}</span>}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={row.REMARKS}>
                            {row.REMARKS || "-"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {Number(row.ALLOCATED_AMOUNT || 0).toLocaleString("en-US", { minimumFractionDigits: 3 })}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{row.CREATE_USER || "-"}</td>
                          <td className="py-2.5 px-3 text-center">
                            {row.CANCELED === "Y" ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                Canceled / Unallocated
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                Active Settled
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleViewUjvDetails(row.DOC_NO)}
                                className="h-7 text-[11px] gap-1 px-2 text-slate-700"
                              >
                                <Eye size={12} /> View
                              </Button>
                              {row.CANCELED !== "Y" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setConfirmUnallocDocNo(row.DOC_NO)}
                                  className="h-7 text-[11px] gap-1 px-2 text-rose-600 border-rose-200 hover:bg-rose-50"
                                >
                                  <RotateCcw size={12} /> Unallocate
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===================== VIEW UJV DETAILS MODAL ===================== */}
      {selectedUjv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Allocation Voucher Details: {selectedUjv}</h3>
                <p className="text-xs text-slate-500">Invoices and payments settled under this UJV transaction</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setSelectedUjv(null)} className="h-8 w-8">
                <X size={16} />
              </Button>
            </div>

            {loadingDetails ? (
              <div className="py-8 text-center text-slate-400">
                <RefreshCw size={18} className="animate-spin inline mr-2" />
                Loading lines...
              </div>
            ) : ujvDetails.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">No detail lines found for this voucher.</div>
            ) : (
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Sr.</th>
                      <th className="py-2 px-3">Invoice / Ref No</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      <th className="py-2 px-3 text-center">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {ujvDetails.map((line) => (
                      <tr key={line.DTL_SR_NO}>
                        <td className="py-2 px-3 text-slate-500">{line.DTL_SR_NO}</td>
                        <td className="py-2 px-3 font-bold text-indigo-900">{line.INV_NO}</td>
                        <td className="py-2 px-3 text-slate-600">{line.INV_DATE || "-"}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800">
                          {line.AMOUNT.toLocaleString("en-US", { minimumFractionDigits: 3 })} {line.CURR_CODE}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {line.SIGN_IND > 0 ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                              Debit (DR)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              Credit (CR)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setSelectedUjv(null)} className="h-8 text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CONFIRM UNALLOCATE DIALOG ===================== */}
      {confirmUnallocDocNo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Unallocate Voucher?</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to unallocate <strong>{confirmUnallocDocNo}</strong>?
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
              This will cancel the UJV voucher, delete the settlement offset records, and restore all associated invoices and receipts back to open balance.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfirmUnallocDocNo(null)} className="h-8 text-xs">
                Cancel
              </Button>
              <Button
                disabled={Boolean(unallocatingDocNo)}
                onClick={() => void handleExecuteUnallocate(confirmUnallocDocNo)}
                className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                {unallocatingDocNo ? "Unallocating..." : "Yes, Unallocate"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
