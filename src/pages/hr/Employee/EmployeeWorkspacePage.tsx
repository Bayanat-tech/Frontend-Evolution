// Employee workspace — opened from the Employee Master list
//
// Save flow
//  • Save on a tab → go to the next tab (a tab can stay put by returning false from save())
//  • New employee: after the Master tab saves, the list is refreshed, the new employee is found
//    (by the code/id the save returned, else as the only new row in the list) and its URL is
//    opened on the "details" tab, so every later tab gets the generated code from the URL
//  • Save on the last tab (Employee Pay Units) → back to the Employee Master list
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, IdCard, Languages, Loader2, Save, Users, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import HrEmpDependantsTab from "./HrEmpDependantsTab";
import HrEmpLanguageTab from "./HrEmpLanguageTab";
import HrEmployeePayUnitsTab from "./HrEmployeePayUnitsTab";
import AddEmployeeHrForm, { type SavedEmployee } from "../../../pages/hr/Employee Master/AddEmployeeHrForm";
import EditEmployeeDetailsForm, { type EmployeeFormHandle } from "../../../pages/hr/Employee Details/Employeedetailform";
import {
  EMPLOYEE_MASTER_PATH,
  TAB_KEYS,
  employeeWorkspacePath,
  type TabHandle,
} from "./Employee.workspace.shared";
import { employeeListKey, useEmployeeList } from "./UseEmployeeList";

import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookup } from "../../../api/lookups";
import { useToast } from "../../../components/ui/AlertToast";
import type { TEmployeeDetails } from "../../../pages/hr/Employee Details/EmployeeDetails.types";
import { mapEmployeeDetails } from "../../../pages/hr/Employee Details/Employeedetailspage";

const TABS = [
  { key: "master", label: "Employee Master", icon: FileText },
  { key: "details", label: "Employee Details", icon: IdCard },
  { key: "dependants", label: "Employee Dependants", icon: Users },
  { key: "language", label: "Language Skills", icon: Languages },
  { key: "payunits", label: "Employee Pay Units", icon: Wallet },
] as const;

const LAST_TAB_INDEX = TABS.length - 1;

export function EmployeeWorkspacePage() {
  const { pathname } = useLocation();
  const employeeCode = useMemo(() => {
    const match = pathname.match(/employee_master\/([^/?#]+)/i);
    if (!match) return "";
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }, [pathname]);

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { rows, isLoading, isFetching, companyCode } = useEmployeeList();

  const { user } = useAuth();
  const loginid = user?.loginid ?? "";

  const isNew = employeeCode === "new";
  const row = useMemo(
    () => (isNew ? undefined : rows.find((r) => r.employee_code === employeeCode)),
    [isNew, rows, employeeCode],
  );
  const employeeId = row ? String(row.employee_id) : "";

  /* ── Full details fetch (Employee Details tab) ── */
  const [detailedRow, setDetailedRow] = useState<TEmployeeDetails | null>(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  useEffect(() => {
    if (!isNew && row) {
      const fetchDetails = async () => {
        setFetchingDetails(true);
        try {
          const response = await getDynamicLookup({
            parameter: "MS_HR_EMPDETAIL_EMPLOYEE",
            loginid,
            code1: companyCode,
          });
          const tableData = (Array.isArray(response) ? response : []) as Record<string, unknown>[];
          const mapped = tableData
            .map(mapEmployeeDetails)
            .find((r) => r.employee_id === String(row.employee_id) || r.employee_code === row.employee_code);
          setDetailedRow(mapped || null);
        } catch (error) {
          console.error("Failed to fetch employee details", error);
        } finally {
          setFetchingDetails(false);
        }
      };
      fetchDetails();
    } else if (isNew) {
      setDetailedRow(null);
    }
  }, [isNew, row, companyCode, loginid]);

  /* ── Active tab (from URL) ── */
  const tabParam = searchParams.get("tab");
  const requestedIndex = TAB_KEYS.findIndex((k) => k === tabParam);
  const activeIndex = isNew ? 0 : Math.max(0, requestedIndex);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([activeIndex]));

  const selectTab = (index: number) => {
    setVisited((prev) => new Set(prev).add(index));
    setSearchParams({ tab: TAB_KEYS[index] }, { replace: true });
  };

  /* ── One ref per tab ── */
  const masterRef = useRef<TabHandle>(null);
  const detailsRef = useRef<EmployeeFormHandle>(null);
  const dependantsRef = useRef<TabHandle>(null);
  const languageRef = useRef<TabHandle>(null);
  const payUnitsRef = useRef<TabHandle>(null);

  const tabRefs = [masterRef, detailsRef, dependantsRef, languageRef, payUnitsRef];

  const backToList = () => navigate(EMPLOYEE_MASTER_PATH);

  /* ── Move forward after a successful save ── */
  const goNext = () => {
    if (activeIndex >= LAST_TAB_INDEX) {
      queryClient.invalidateQueries({ queryKey: employeeListKey(companyCode) });
      backToList();
      return;
    }
    selectTab(activeIndex + 1);
  };

  /* ── New employee: once saved, open it on the next tab using its generated code ── */
  const preSaveIds = useRef<Set<string>>(new Set());
  const [pendingNew, setPendingNew] = useState<SavedEmployee | null>(null);

  useEffect(() => {
    if (!pendingNew || isFetching) return;

    const byResponse = rows.find(
      (r) =>
        (pendingNew.employee_code && r.employee_code === pendingNew.employee_code) ||
        (pendingNew.employee_id && String(r.employee_id) === pendingNew.employee_id),
    );
    // Fallback: the only employee that was not in the list before saving
    const fresh = rows.filter((r) => !preSaveIds.current.has(String(r.employee_id)));
    const created = byResponse ?? (fresh.length === 1 ? fresh[0] : undefined);

    setPendingNew(null);
    if (created) {
      navigate(employeeWorkspacePath(created.employee_code, "details"), { replace: true });
    } else {
      toast.warning("Employee saved. Open it from the list to continue.");
      backToList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNew, isFetching, rows]);

  /** Master tab saved (AddEmployeeHrForm calls this only on a successful save). */
  const handleMasterSaved = async (saved: SavedEmployee) => {
    await queryClient.invalidateQueries({ queryKey: employeeListKey(companyCode) });
    if (isNew) {
      setPendingNew(saved);
    } else {
      goNext();
    }
  };

  /* ── Save button ── */
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew && activeIndex === 0) {
        preSaveIds.current = new Set(rows.map((r) => String(r.employee_id)));
      }
      const result = (await tabRefs[activeIndex].current?.save()) as unknown;
      // The Master tab advances by itself through onSaved, so it is handled above.
      if (activeIndex === 0) return;
      // A tab returns false when it saved nothing or wants to stay on screen.
      if (result === false) return;
      goNext();
    } catch (error) {
      // The tab shows its own error message; stay on this tab.
      console.error("Save failed", error);
    } finally {
      setSaving(false);
    }
  };

  const mounted = (i: number) => !isNew && !!employeeId && (visited.has(i) || activeIndex === i);

  /* ── Guards ── */
  if (!isNew && isLoading) {
    return (
      <section className="grid place-items-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 size={18} className="animate-spin" /> Loading employee...
      </section>
    );
  }

  if (!isNew && !row) {
    return (
      <section className="freight-workspace-ui freight-ui-standard grid gap-2">
        <div className="rounded-md border bg-card p-4 shadow-sm">
          <p className="m-0 mb-3 text-sm text-muted-foreground">Employee {employeeCode} was not found.</p>
          <Button type="button" size="sm" variant="outline" onClick={backToList}>
            <ArrowLeft size={14} /> Back to List
          </Button>
        </div>
      </section>
    );
  }

  const busy = saving || !!pendingNew;

  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Header */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <FileText size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">Employee Master</h1>
              <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                {isNew ? "New" : "Editing"}
              </span>
              {row && (
                <span className="text-xs text-muted-foreground">
                  {row.employee_code}
                  {row.rpt_name ? ` - ${row.rpt_name}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={backToList} disabled={busy}>
            <ArrowLeft size={14} /> Back to List
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
            {busy ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-md border bg-card p-1 shadow-sm">
        {TABS.map((t, i) => {
          const Icon = t.icon;
          const active = i === activeIndex;
          const disabled = isNew && i > 0;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={disabled}
              title={disabled ? "Save the employee first" : t.label}
              onClick={() => selectTab(i)}
              className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active ? "bg-[#00378C] text-white" : "text-slate-600 hover:bg-blue-50 hover:text-[#00378C]"
              }`}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}

      {/* 0: Employee Master */}
      <div hidden={activeIndex !== 0}>
        <AddEmployeeHrForm
          key={row?.employee_code ?? "new"}
          ref={masterRef}
          isEditMode={!isNew}
          existingData={row}
          onSaved={handleMasterSaved}
        />
      </div>

      {/* 1: Employee Details */}
      {mounted(1) && (
        <div hidden={activeIndex !== 1}>
          {fetchingDetails ? (
            <div className="grid place-items-center p-10 text-sm text-muted-foreground">
              <Loader2 size={18} className="animate-spin" /> Loading details...
            </div>
          ) : detailedRow ? (
            <EditEmployeeDetailsForm
              ref={detailsRef}
              existingData={detailedRow}
              onClose={(shouldRefetch?: boolean) => {
                if (shouldRefetch) {
                  queryClient.invalidateQueries({ queryKey: employeeListKey(companyCode) });
                }
              }}
            />
          ) : (
            <div className="p-10 text-center text-sm text-red-500">Failed to load employee details.</div>
          )}
        </div>
      )}

      {/* 2: Employee Dependants */}
      {mounted(2) && (
        <div hidden={activeIndex !== 2}>
          <HrEmpDependantsTab ref={dependantsRef} employeeId={employeeId} employeeName={row?.rpt_name} />
        </div>
      )}

      {/* 3: Language Skills */}
      {mounted(3) && (
        <div hidden={activeIndex !== 3}>
          <HrEmpLanguageTab ref={languageRef} employeeId={employeeId} employeeName={row?.rpt_name} />
        </div>
      )}

      {/* 4: Employee Pay Units */}
      {mounted(4) && (
        <div hidden={activeIndex !== 4}>
          <HrEmployeePayUnitsTab ref={payUnitsRef} employeeId={employeeId} employeeName={row?.rpt_name} />
        </div>
      )}
    </section>
  );
}

export default EmployeeWorkspacePage;