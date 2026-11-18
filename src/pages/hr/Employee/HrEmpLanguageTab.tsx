// Language Skills tab — rendered inside EmployeeWorkspacePage.
// No header / employee selection here: the employee comes from the workspace route.
// The header Save calls save() through the ref. save() returns true when the data was saved
// (the workspace then moves to the next tab) and false when it should stay on this tab.

import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Languages, Plus, Trash2 } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { getDynamicLookup } from "../../../api/lookups";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Field, SectionPanel } from "../../../components/ui/Formblocks";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { useLookupOptions } from "../../../components/ui/Uselookupoptions";
import { useAuth } from "../../../state/AuthContext";
import type { TabHandle, TabProps } from "./Employee.workspace.shared";
import hrEmpLanguageServiceInstance from "../../../pages/hr/Upserthremplanguage";

/* ================= TYPES ================= */

type LanguageOption = { lang_code: string; lang_desc: string };
type StatusOption = { value_code: string; value_desc: string };

type LangRow = {
  id: string;
  /** false for rows added in this session (nothing to delete server-side) */
  persisted: boolean;
  lang_code: string;
  lang_desc: string;
  to_read: string;
  to_write: string;
  to_speak: string;
  remarks: string;
  /** "D" marks a persisted row for deletion on the next save */
  status_flag: string;
};

const PROFICIENCY_OPTIONS = [
  { code: "B", label: "Basic" },
  { code: "I", label: "Intermediate" },
  { code: "F", label: "Fluent" },
  { code: "E", label: "Expert" },
];

const PROFICIENCY_FIELDS = [
  ["to_read", "Read"],
  ["to_write", "Write"],
  ["to_speak", "Speak"],
] as const;

/* ================= HELPERS ================= */

const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

const createEmptyRow = (): LangRow => ({
  id: newId(),
  persisted: false,
  lang_code: "",
  lang_desc: "",
  to_read: "",
  to_write: "",
  to_speak: "",
  remarks: "",
  status_flag: "A",
});

function buildParams(parameter: string, loginid: string, companyCode: string, code2 = "") {
  return {
    parameter,
    loginid,
    code1: companyCode,
    code2,
    code3: "",
    code4: "",
    number1: 0, number2: 0, number3: 0, number4: 0,
    date1: null, date2: null, date3: null, date4: null,
  };
}

const proficiencyLabel = (code: string) =>
  PROFICIENCY_OPTIONS.find((o) => o.code === code)?.label ?? (code || "—");

const mapLanguage = (r: Record<string, unknown>): LanguageOption => ({
  lang_code: String(r.LANG_CODE ?? ""),
  lang_desc: String(r.LANG_DESC ?? ""),
});
const mapStatus = (r: Record<string, unknown>): StatusOption => ({
  value_code: String(r.VALUE_CODE ?? ""),
  value_desc: String(r.VALUE_DESC ?? ""),
});

/** Keeps the first item for each key (removes duplicate dropdown entries). */
function uniqBy<T>(list: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ================= TAB ================= */

export const HrEmpLanguageTab = forwardRef<TabHandle, TabProps>(function HrEmpLanguageTab({ employeeId }, ref) {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const languageOptsRaw = useLookupOptions("EDUCATION_QUALIFICATION_LANG_LANG_SELECT", mapLanguage, "languages", "");
  const statusOptsRaw = useLookupOptions("EDUCATION_QUALIFICATION_LANG_STATUS_SELECT", mapStatus, "statuses", "");
  const languageOpts = useMemo(() => uniqBy(languageOptsRaw, (o) => o.lang_code), [languageOptsRaw]);
  const statusOpts = useMemo(() => uniqBy(statusOptsRaw, (o) => o.value_code), [statusOptsRaw]);

  const [rows, setRows] = useState<LangRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [draft, setDraft] = useState<LangRow | null>(null); // inline panel above the grid
  const loadToken = useRef(0);

  const visibleRows = useMemo(() => rows.filter((r) => r.status_flag !== "D"), [rows]);

  /* ── Load this employee's language rows ── */
  const loadRows = useCallback(async () => {
    const token = ++loadToken.current;
    if (!employeeId) {
      setRows([]);
      setLoadingRows(false);
      return;
    }
    setLoadingRows(true);
    try {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_LANG_SELECT", loginid, companyCode, employeeId),
      );
      if (token !== loadToken.current) return;
      const raw = (Array.isArray(res) ? res : []) as unknown as Record<string, unknown>[];
      setRows(
        raw.map((r) => ({
          id: newId(),
          persisted: true,
          lang_code: String(r.lang_code ?? ""),
          lang_desc: String(r.lang_desc ?? ""),
          to_read: String(r.to_read ?? ""),
          to_write: String(r.to_write ?? ""),
          to_speak: String(r.to_speak ?? ""),
          remarks: String(r.remarks ?? ""),
          status_flag: String(r.status_flag ?? "A"),
        })),
      );
    } catch (error) {
      if (token !== loadToken.current) return;
      setRows([]);
      toast.error(error instanceof Error ? error.message : "Unable to load language records");
    } finally {
      if (token === loadToken.current) setLoadingRows(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, loginid, companyCode]);

  useEffect(() => {
    setDraft(null);
    void loadRows();
  }, [loadRows]);

  /* ── Row panel handlers ── */
  const patchDraft = (patch: Partial<LangRow>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  const saveDraft = () => {
    if (!draft) return;
    if (!draft.lang_code) return void toast.warning("Please select a Language");
    const missing = PROFICIENCY_FIELDS.find(([key]) => !draft[key]);
    if (missing) return void toast.warning(`Please select ${missing[1]} proficiency`);
    if (!draft.status_flag) return void toast.warning("Please select a Status");
    if (visibleRows.some((r) => r.id !== draft.id && r.lang_code === draft.lang_code)) {
      return void toast.warning("This language is already added for the employee");
    }
    setRows((prev) => {
      const index = prev.findIndex((r) => r.id === draft.id);
      if (index === -1) return [...prev, draft];
      const next = [...prev];
      next[index] = draft;
      return next;
    });
    setDraft(null);
  };

  // Persisted rows are flagged "D" and removed by the next Save; new rows just disappear
  const deleteRow = (row: LangRow) => {
    setRows((prev) =>
      row.persisted
        ? prev.map((r) => (r.id === row.id ? { ...r, status_flag: "D" } : r))
        : prev.filter((r) => r.id !== row.id),
    );
    setDraft((d) => (d?.id === row.id ? null : d));
  };

  /* ── Save (called by the header Save button) ──
     Returns true  → saved, the workspace moves to the next tab
             false → nothing saved, stay on this tab */
  const save = async (): Promise<boolean> => {
    if (!employeeId) {
      toast.warning("No employee selected");
      return false;
    }
    if (draft) {
      toast.warning("Finish the open language row (Add Row / Update Row) or cancel it before saving");
      return false;
    }
    if (rows.length === 0) {
      toast.warning("Add at least one language record");
      return false;
    }
    try {
      const language_details = rows.map((r) => ({
        employee_id: employeeId,
        lang_code: r.lang_code,
        to_read: r.to_read,
        to_write: r.to_write,
        to_speak: r.to_speak,
        remarks: r.remarks,
        status_flag: r.status_flag,
        company_code: companyCode,
        user_id: loginid,
      }));

      const result: unknown = await hrEmpLanguageServiceInstance.upsertHrEmpLanguageApi({
        company_code: companyCode,
        language_details,
        loginid,
      });
      const ok =
        typeof result === "object" && result !== null && "success" in result
          ? Boolean((result as { success: unknown }).success)
          : Boolean(result);
      if (!ok) {
        const message = (result as { message?: string } | null)?.message;
        throw new Error(message || "Save failed. Please try again.");
      }

      toast.success("Language details saved successfully");
      await loadRows(); // refresh so rows are persisted and deletions applied
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save language details");
      return false;
    }
  };

  useImperativeHandle(ref, () => ({ save }));

  /* ── Columns ── */
  const columns = useMemo<ColumnDef<LangRow>[]>(
    () => [
      { id: "srno", header: "SlNo", size: 60, enableSorting: false, cell: ({ row }) => row.index + 1 },
      {
        accessorKey: "lang_code",
        header: "Language",
        size: 220,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.lang_desc ||
          languageOpts.find((o) => o.lang_code === row.original.lang_code)?.lang_desc ||
          row.original.lang_code ||
          "—",
      },
      {
        accessorKey: "to_read",
        header: "Read",
        size: 130,
        enableSorting: false,
        cell: ({ row }) => proficiencyLabel(row.original.to_read),
      },
      {
        accessorKey: "to_write",
        header: "Write",
        size: 130,
        enableSorting: false,
        cell: ({ row }) => proficiencyLabel(row.original.to_write),
      },
      {
        accessorKey: "to_speak",
        header: "Speak",
        size: 130,
        enableSorting: false,
        cell: ({ row }) => proficiencyLabel(row.original.to_speak),
      },
      {
        accessorKey: "status_flag",
        header: "Status",
        size: 120,
        enableSorting: false,
        cell: ({ row }) =>
          statusOpts.find((o) => o.value_code === row.original.status_flag)?.value_desc ??
          (row.original.status_flag || "—"),
      },
      {
        accessorKey: "remarks",
        header: "Remarks",
        size: 240,
        enableSorting: false,
        cell: ({ row }) => row.original.remarks || "—",
      },
      {
        id: "actions",
        header: "Actions",
        size: 90,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => setDraft({ ...row.original })}
              title="Edit row"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => deleteRow(row.original)}
              title="Remove row"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [languageOpts, statusOpts],
  );

  const isEditingRow = !!draft && rows.some((r) => r.id === draft.id);

  return (
    <div className="grid gap-2">
      {draft && (
        <SectionPanel title="Language Details" icon={Languages}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Language" required>
              <Select
                value={draft.lang_code}
                onChange={(e) => {
                  const opt = languageOpts.find((x) => x.lang_code === e.target.value);
                  patchDraft({ lang_code: e.target.value, lang_desc: opt?.lang_desc ?? "" });
                }}
              >
                <option value="">-- Select --</option>
                {languageOpts.map((o) => (
                  <option key={o.lang_code} value={o.lang_code}>
                    {o.lang_desc}
                  </option>
                ))}
              </Select>
            </Field>

            {PROFICIENCY_FIELDS.map(([key, label]) => (
              <Field key={key} label={label} required>
                <Select value={draft[key]} onChange={(e) => patchDraft({ [key]: e.target.value })}>
                  <option value="">-- Select --</option>
                  {PROFICIENCY_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}

            <Field label="Status" required>
              <Select value={draft.status_flag} onChange={(e) => patchDraft({ status_flag: e.target.value })}>
                <option value="">-- Select --</option>
                {statusOpts.map((o) => (
                  <option key={o.value_code} value={o.value_code}>
                    {o.value_desc}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Remarks" className="md:col-span-3">
              <Input value={draft.remarks} onChange={(e) => patchDraft({ remarks: e.target.value })} />
            </Field>
          </div>

          <div className="mt-3 flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={saveDraft}>
              {isEditingRow ? "Update Row" : "Add Row"}
            </Button>
          </div>
        </SectionPanel>
      )}

      <DataTable
        columns={columns}
        data={visibleRows}
        title={loadingRows ? "Loading" : `${visibleRows.length.toLocaleString()} Record${visibleRows.length !== 1 ? "s" : ""}`}
        subtitle="Language Records"
        loading={loadingRows}
        emptyText="No language records"
        height={420}
        minWidth={1000}
        density="grid"
        getRowId={(row) => row.id}
        toolbar={
          <button
            type="button"
            onClick={() => setDraft(createEmptyRow())}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
          >
            <Plus size={14} />
            Add Row
          </button>
        }
      />
    </div>
  );
});

export default HrEmpLanguageTab;