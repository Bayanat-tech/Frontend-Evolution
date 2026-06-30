import { Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { saveHrGm } from "../../api/hr";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

// ─── Types ─────────────────────────────────────────────────────────────────

export type TGradeHeader = {
  company_code: string;
  grade_code: string;
  grade_name: string;
  grade_short_name: string;
  ot_eligibility: string;
  grade_status: string;
  status: string;
  remarks: string;
  airfare_entitlement: string;
  spouse_af_entitlement: string;
  dep_af_entitlement: string;
  medical_entitlement: string;
  spouse_med_entitlement: string;
  dep_med_entitlement: string;
};

export type TGradeDetail = {
  _id: string;
  company_code: string;
  grade_code: string;
  pay_comp_id: string;
  min_pay_amt: number;
  max_pay_amt: number;
  approved_date: string;
};

type TProps = {
  open: boolean;
  isEdit: boolean;
  isView: boolean;
  company_code: string;
  grade_code?: string;
  onClose: (saved?: boolean) => void;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

type TGradeFetchResponse = {
  header?: Record<string, unknown>;
  details?: Record<string, unknown>[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const yesNo = [
  { label: "No", value: "N" },
  { label: "Yes", value: "Y" },
];

const activeInactive = [
  { label: "Active", value: "A" },
  { label: "Inactive", value: "N" },
];

const gradeStatusOptions = [
  { label: "Active", value: "A" },
  { label: "Inactive", value: "N" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Maps each checkbox row (self/spouse/dependent) to the real DB column name.
// These names don't follow one consistent prefix pattern (e.g. "spouse_af_entitlement"
// has "af" in the middle, not at the end), so an explicit map is safer than
// building the key with a template string.
const AIRFARE_FIELD_MAP: Record<"self" | "spouse" | "dependent", keyof TGradeHeader> = {
  self: "airfare_entitlement",
  spouse: "spouse_af_entitlement",
  dependent: "dep_af_entitlement",
};

const MEDICAL_FIELD_MAP: Record<"self" | "spouse" | "dependent", keyof TGradeHeader> = {
  self: "medical_entitlement",
  spouse: "spouse_med_entitlement",
  dependent: "dep_med_entitlement",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const emptyHeader = (company_code: string): TGradeHeader => ({
  company_code,
  grade_code: "",
  grade_name: "",
  grade_short_name: "",
  ot_eligibility: "N",
  grade_status: "",
  status: "A",
  remarks: "",
  airfare_entitlement: "N",
  spouse_af_entitlement: "N",
  dep_af_entitlement: "N",
  medical_entitlement: "N",
  spouse_med_entitlement: "N",
  dep_med_entitlement: "N",
});

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="text-xs font-medium text-muted-foreground">
      {label} {required && <strong className="text-destructive">*</strong>}
    </span>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-5 py-2 text-sm font-medium transition-colors ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function EntitlementCard({
  title,
  self,
  spouse,
  dependent,
  disabled,
  onChange,
}: {
  title: string;
  self: string;
  spouse: string;
  dependent: string;
  disabled: boolean;
  onChange: (key: "self" | "spouse" | "dependent", value: string) => void;
}) {
  const rows: { key: "self" | "spouse" | "dependent"; label: string; value: string }[] = [
    { key: "self", label: "Self", value: self },
    { key: "spouse", label: "Spouse", value: spouse },
    { key: "dependent", label: "Dependent", value: dependent },
  ];

  return (
    <div className="rounded-md border p-2.5">
      <p className="mb-1.5 text-xs font-semibold text-foreground">{title}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {rows.map((row) => (
          <label
            key={row.key}
            className="flex items-center justify-between gap-1.5 rounded border border-transparent px-1.5 py-1 text-xs text-foreground hover:border-slate-200"
          >
            <span>{row.label}</span>
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-slate-300"
              checked={row.value === "Y"}
              disabled={disabled}
              onChange={(event) => onChange(row.key, event.target.checked ? "Y" : "N")}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dialog ─────────────────────────────────────────────────────────────

export function GradeDialog({ open, isEdit, isView, company_code, grade_code: initGradeCode, onClose }: TProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"header" | "details">("header");
  const [header, setHeader] = useState<TGradeHeader>(emptyHeader(company_code));
  const [details, setDetails] = useState<TGradeDetail[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const isDisabled = isView;
  const dialogTitle = isView ? "View Grade" : isEdit ? "Edit Grade" : "Add Grade";

  // Lock the background page so it can't scroll (vertically or horizontally)
  // while this dialog is open — without this, the underlying page still has
  // its own scrollbars visible behind/around the modal. Restored on close.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevWidth = document.body.style.width;
    document.body.style.overflow = "hidden";
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.width = prevWidth;
    };
  }, [open]);

  const totalAmount = useMemo(
    () => details.reduce((sum, row) => sum + Number(row.max_pay_amt || 0), 0),
    [details],
  );

  // ── Load existing grade data ───────────────────────────────────────────────
  // Uses the shared `api` client (same one api/hr.ts uses) instead of a bare
  // fetch(), so auth headers / base URL / response-envelope handling all
  // behave consistently with the rest of the app instead of silently
  // hitting the wrong host or failing auth.
  useEffect(() => {
    if (!open) return;
    setTab("header");
    setNotice(null);
    setPageIndex(0);

    if ((isEdit || isView) && initGradeCode) {
      setLoading(true);
      api
        .get<ApiResponse<TGradeFetchResponse>>(`/api/hr/grade/${initGradeCode}`, {
          params: { company_code },
        })
        .then((response) => {
          if (!response.data.success) {
            throw new Error(response.data.message || "Unable to load grade data.");
          }
          const data = response.data.data || {};
          if (data.header) setHeader({ ...emptyHeader(company_code), ...data.header });
          if (Array.isArray(data.details)) {
            setDetails(
              data.details.map((row: Record<string, unknown>, index: number) => ({
                _id: `${row.pay_comp_id ?? index}_${index}`,
                company_code: String(row.company_code ?? company_code),
                grade_code: String(row.grade_code ?? initGradeCode),
                pay_comp_id: String(row.pay_comp_id ?? ""),
                min_pay_amt: Number(row.min_pay_amt ?? 0),
                max_pay_amt: Number(row.max_pay_amt ?? 0),
                approved_date: String(row.approved_date ?? ""),
              })),
            );
          }
        })
        .catch((error) =>
          setNotice({
            type: "error",
            message: error instanceof Error ? error.message : "Failed to load grade data.",
          }),
        )
        .finally(() => setLoading(false));
    } else {
      setHeader(emptyHeader(company_code));
      setDetails([]);
    }
  }, [open, isEdit, isView, initGradeCode, company_code]);

  // ── Field helpers ──────────────────────────────────────────────────────────
  const setH = (field: keyof TGradeHeader, value: string) => setHeader((prev) => ({ ...prev, [field]: value }));

  const addDetailRow = () => {
    setDetails((prev) => [
      ...prev,
      {
        _id: `new_${Date.now()}`,
        company_code,
        grade_code: header.grade_code,
        pay_comp_id: "",
        min_pay_amt: 0,
        max_pay_amt: 0,
        approved_date: "",
      },
    ]);
  };

  const updateDetail = (id: string, field: keyof TGradeDetail, value: string | number) =>
    setDetails((prev) => prev.map((row) => (row._id === id ? { ...row, [field]: value } : row)));

  const deleteDetail = (id: string) => setDetails((prev) => prev.filter((row) => row._id !== id));

  const pageCount = Math.max(1, Math.ceil(details.length / pageSize));
  const pagedDetails = details.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
  const rangeStart = details.length === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd = Math.min(details.length, pageIndex * pageSize + pageSize);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!header.grade_name.trim()) {
      setNotice({ type: "error", message: "Name is required." });
      setTab("header");
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      // On Add, grade_code is sent blank — the server generates the real
      // code and returns it in the response. On Edit, the existing code is
      // sent as-is and the server echoes it back unchanged. Either way,
      // `savedGradeCode` is the one source of truth to use afterwards —
      // never the locally-held (possibly blank) header.grade_code.
      const saveResponse = await saveHrGm(
        "grade",
        {
          ...header,
          grade_code: isEdit ? initGradeCode : "",
          user_id: user?.loginid ?? "",
          company_code,
        },
        isEdit ? "put" : "post",
      );

      const savedGradeCode = String(
        (saveResponse as { data?: { grade_code?: string } })?.data?.grade_code || (isEdit ? initGradeCode : ""),
      );

      if (!savedGradeCode) {
        // Server did not return a code and this wasn't an edit — without a
        // valid grade_code we cannot safely save detail rows under it.
        throw new Error("Grade was saved, but no grade code was returned. Please refresh and check Details.");
      }

      if (details.length > 0) {
        const detailResponse = await api.post<ApiResponse<unknown>>("/api/hr/grade/components", {
          header: { ...header, grade_code: savedGradeCode, user_id: user?.loginid ?? "" },
          details: details.map((row) => ({
            company_code: row.company_code,
            grade_code: savedGradeCode,
            pay_comp_id: row.pay_comp_id,
            min_pay_amt: Number(row.min_pay_amt),
            max_pay_amt: Number(row.max_pay_amt),
            approved_date: row.approved_date,
            user_id: user?.loginid ?? "",
          })),
        });

        if (!detailResponse.data.success) {
          throw new Error(detailResponse.data.message || "Grade was saved, but components failed to save.");
        }
      }

      onClose(true);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Failed to save grade." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      wide
      title=""
      onClose={() => onClose()}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          {!isDisabled && (
            <Button disabled={saving} onClick={() => void handleSave()}>
              <Save size={14} /> {saving ? "Saving..." : "Save"}
            </Button>
          )}
          <Button variant="outline" onClick={() => onClose()}>
            <X size={14} /> {isDisabled ? "Close" : "Cancel"}
          </Button>
        </div>
      }
    >
      {/* Hides the scrollbar track/thumb visually in every browser while the
          element underneath remains fully scrollable (mouse wheel, trackpad,
          touch, and keyboard all still work) — removes the visible
          vertical/horizontal scroll lines without disabling scrolling. */}
      <style>{`
        .scroll-hide {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* old Edge / IE */
        }
        .scroll-hide::-webkit-scrollbar {
          display: none; /* Chrome, Safari, new Edge */
        }
        html, body {
          overflow: hidden !important;
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        html::-webkit-scrollbar, body::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none !important;
        }
        #root, #__next {
          overflow: hidden !important;
        }
      `}</style>

      {/* Fixed-height shell: title/tabs/notice are fixed; only the active
          tab's own region ever scrolls — both Header and Details scroll
          internally instead of being clipped, so the dialog itself never
          grows/shrinks or resets its scroll position while typing. */}
      <div className="-mt-6 flex max-h-[78vh] flex-col overflow-hidden">
        {/* ── Title bar ── */}
        <div className="flex shrink-0 items-center justify-between bg-primary px-6 py-3.5">
          <h2 className="text-base font-semibold text-white">{dialogTitle}</h2>
         
        </div>

        {/* ── Tabs ── */}
        <div className="flex shrink-0 border-b px-6">
          <TabBtn active={tab === "header"} onClick={() => setTab("header")}>
            Header
          </TabBtn>
          <TabBtn active={tab === "details"} onClick={() => setTab("details")}>
            Details
          </TabBtn>
        </div>

        {notice && (
          <div className="shrink-0 px-6 pt-2">
            <NoticeToast notice={notice} onClose={() => setNotice(null)} />
          </div>
        )}

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
            Loading grade data...
          </div>
        ) : (
          <>
            {/* ══════════════ TAB: HEADER ══════════════ */}
            {tab === "header" && (
             <div className="flex-1 overflow-hidden px-6 py-3">
                {/* Grade code / amount strip */}
                <div className="flex items-center justify-between rounded-t-md border border-b-0 bg-slate-50 px-3 py-2">
                  <div>
                    <p className="text-[10px] uppercase leading-tight tracking-wide text-muted-foreground">
                      Autogenerated
                    </p>
                    <p className="text-[11px] font-medium leading-tight text-muted-foreground">Grade Code</p>
                    <p className="text-sm font-semibold leading-tight text-foreground">
                      {isEdit || isView ? header.grade_code || initGradeCode : "N/A"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-medium leading-tight text-muted-foreground">Amount</p>
                    <p className="text-sm font-semibold leading-tight text-foreground">{totalAmount.toFixed(2)}</p>
                  </div>
                </div>
                <div className="h-0.5 w-full bg-primary" />

                <div className="grid grid-cols-1 gap-x-5 gap-y-2.5 rounded-b-md border border-t-0 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="field">
                    <FieldLabel label="Company" required />
                    <Input className="h-8 text-sm" value={header.company_code} disabled />
                  </label>

                  <label className="field">
                    <FieldLabel label="Name" required />
                    <Input
                      className="h-8 text-sm"
                      value={header.grade_name}
                      disabled={isDisabled}
                      onChange={(event) => setH("grade_name", event.target.value)}
                    />
                  </label>

                  <label className="field">
                    <FieldLabel label="Short Name" />
                    <Input
                      className="h-8 text-sm"
                      value={header.grade_short_name}
                      disabled={isDisabled}
                      onChange={(event) => setH("grade_short_name", event.target.value)}
                    />
                  </label>

                  <label className="field">
                    <FieldLabel label="Eligibility for OT (Y/N)" required />
                    <Select
                      className="h-8 text-sm"
                      value={header.ot_eligibility}
                      disabled={isDisabled}
                      onChange={(event) => setH("ot_eligibility", event.target.value)}
                    >
                      {yesNo.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <label className="field">
                    <FieldLabel label="Grade Status" />
                    <Select
                      className="h-8 text-sm"
                      value={header.grade_status}
                      disabled={isDisabled}
                      onChange={(event) => setH("grade_status", event.target.value)}
                    >
                      <option value="">— Select —</option>
                      {gradeStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <label className="field">
                    <FieldLabel label="Status" required />
                    <Select
                      className="h-8 text-sm"
                      value={header.status}
                      disabled={isDisabled}
                      onChange={(event) => setH("status", event.target.value)}
                    >
                      {activeInactive.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                    <p className="mb-1 mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Entitlements
                    </p>
                    <hr className="mb-2 border-slate-200" />
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <EntitlementCard
                        title="Airfare Entitlement"
                        self={header.airfare_entitlement}
                        spouse={header.spouse_af_entitlement}
                        dependent={header.dep_af_entitlement}
                        disabled={isDisabled}
                        onChange={(key, value) => setH(AIRFARE_FIELD_MAP[key], value)}
                      />
                      <EntitlementCard
                        title="Medical Entitlement"
                        self={header.medical_entitlement}
                        spouse={header.spouse_med_entitlement}
                        dependent={header.dep_med_entitlement}
                        disabled={isDisabled}
                        onChange={(key, value) => setH(MEDICAL_FIELD_MAP[key], value)}
                      />
                    </div>
                  </div>

                  <label className="field col-span-1 sm:col-span-2 lg:col-span-3">
                    <FieldLabel label="Remarks" />
                    <textarea
                      className="min-h-[44px] w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      value={header.remarks}
                      disabled={isDisabled}
                      onChange={(event) => setH("remarks", event.target.value)}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* ══════════════ TAB: DETAILS ══════════════ */}
            {tab === "details" && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-3">
                <div className="mb-2 flex shrink-0 items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Grade Components</h3>
                  {!isDisabled && (
                    <Button size="sm" variant="outline" onClick={addDetailRow}>
                      <Plus size={13} /> Add Row
                    </Button>
                  )}
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
                  <div className="scroll-hide overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-left text-muted-foreground">
                        <tr>
                          <th className="border-b px-3 py-2 font-semibold">S.No</th>
                          <th className="border-b px-3 py-2 font-semibold">Pay Component</th>
                          <th className="border-b px-3 py-2 font-semibold">Min Amount</th>
                          <th className="border-b px-3 py-2 font-semibold">Max Amount</th>
                          <th className="border-b px-3 py-2 font-semibold">Approved Date</th>
                          {!isDisabled && <th className="border-b px-3 py-2" />}
                        </tr>
                      </thead>
                      <tbody>
                        {pagedDetails.length === 0 ? (
                          <tr>
                            <td colSpan={isDisabled ? 5 : 6} className="px-4 py-16 text-center text-muted-foreground">
                              No Rows To Show
                            </td>
                          </tr>
                        ) : (
                          pagedDetails.map((row, index) => (
                            <tr key={row._id} className="border-b hover:bg-slate-50">
                              <td className="px-3 py-1.5 text-muted-foreground">{pageIndex * pageSize + index + 1}</td>
                              <td className="px-2 py-1.5">
                                <Input
                                  className="h-8 text-sm"
                                  value={row.pay_comp_id}
                                  disabled={isDisabled}
                                  onChange={(event) => updateDetail(row._id, "pay_comp_id", event.target.value)}
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input
                                  className="h-8 text-right text-sm"
                                  type="number"
                                  value={row.min_pay_amt}
                                  disabled={isDisabled}
                                  onChange={(event) => updateDetail(row._id, "min_pay_amt", Number(event.target.value))}
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input
                                  className="h-8 text-right text-sm"
                                  type="number"
                                  value={row.max_pay_amt}
                                  disabled={isDisabled}
                                  onChange={(event) => updateDetail(row._id, "max_pay_amt", Number(event.target.value))}
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <Input
                                  className="h-8 text-sm"
                                  type="date"
                                  value={row.approved_date}
                                  disabled={isDisabled}
                                  onChange={(event) => updateDetail(row._id, "approved_date", event.target.value)}
                                />
                              </td>
                              {!isDisabled && (
                                <td className="px-2 py-1.5 text-center">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                                    onClick={() => deleteDetail(row._id)}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex shrink-0 items-center justify-between border-t bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>Page Size:</span>
                      <Select
                        className="h-8 w-20"
                        value={String(pageSize)}
                        onChange={(event) => {
                          setPageSize(Number(event.target.value));
                          setPageIndex(0);
                        }}
                      >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="flex items-center gap-4">
                      <span>
                        {rangeStart} to {rangeEnd} of {details.length}
                      </span>
                      <span>
                        Page <strong className="text-foreground">{details.length === 0 ? 0 : pageIndex + 1}</strong> of{" "}
                        <strong className="text-foreground">{details.length === 0 ? 0 : pageCount}</strong>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-slate-200 disabled:opacity-40"
                          disabled={pageIndex === 0}
                          onClick={() => setPageIndex(0)}
                        >
                          ⏮
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-slate-200 disabled:opacity-40"
                          disabled={pageIndex === 0}
                          onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-slate-200 disabled:opacity-40"
                          disabled={pageIndex >= pageCount - 1}
                          onClick={() => setPageIndex((prev) => Math.min(pageCount - 1, prev + 1))}
                        >
                          ›
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-slate-200 disabled:opacity-40"
                          disabled={pageIndex >= pageCount - 1}
                          onClick={() => setPageIndex(pageCount - 1)}
                        >
                          ⏭
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}