import { ArrowLeft, CalendarClock, Copy, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";
import { getDynamicLookup } from "../../../api/lookups";

import { useAuth } from "../../../state/AuthContext";
import { AbsentProcessHeaderForm } from "./AbsentProcessHeaderForm";
import { AbsentProcessLinesTable } from "./AbsentProcessLinesTable";
import {
  AbsentDetailRow,
  AbsentHeaderData,
  AbsentProcessEditorState,
  emptyAbsentHeader,
  emptyAbsentRow,
} from "./Absentprocesstypes";
import { generateAbsentMemoDaily, saveAbsentMemo } from "../../../api/hr";

interface AbsentProcessEditorProps {
  editor: AbsentProcessEditorState;
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
}

export function AbsentProcessEditor({ editor, onClose, onSaved }: AbsentProcessEditorProps) {
  const { user } = useAuth();
  const [header, setHeader] = useState<AbsentHeaderData>(emptyAbsentHeader());
  const [rows, setRows] = useState<AbsentDetailRow[]>([emptyAbsentRow(1)]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isEdit = editor?.mode === "edit";
  const docNo = isEdit ? editor.row.doc_no : "";

  useEffect(() => {
    if (!isEdit) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const docType = editor.row.doc_type || "ABM";

        const [headerRes, detailRes] = await Promise.all([
          getDynamicLookup({
            parameter: "ABSENT_MEMO_ENTRY_HEADER_PAGE",
            code1: user?.company_code,
            code2: docType,
            code3: docNo,
          }),
          getDynamicLookup({
            parameter: "ABSENT_MEMO_ENTRY_DETAIL_PAGE",
            code1: user?.company_code,
            code2: docType,
            code3: docNo,
          }),
        ]);

        if (!mounted) return;

        const headerRows = headerRes as unknown as AbsentHeaderData[];
        const detailRows = detailRes as unknown as AbsentDetailRow[];

        const headerData = headerRows?.[0] ?? emptyAbsentHeader();
        const detailData = detailRows?.length ? detailRows : [emptyAbsentRow(1)];

        setHeader({
          ...headerData,
          employee_code: headerData.employee_code || detailData[0]?.employee_code || "",
        });
        setRows(detailData);
      } catch (error) {
        setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load document" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isEdit, docNo, user?.company_code]);

  const handleHeaderChange = (field: keyof AbsentHeaderData, value: string) => {
    setHeader((prev) => ({ ...prev, [field]: value }));
  };

  const handleEmployeeLookup = () => {
    // TODO: open the shared employee lookup dialog and populate employee_code / employee_name
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateAbsentMemoDaily({
        company_code: user?.company_code,
        user_id: user?.loginid || user?.username || "ADMIN",
        doc_type: "ABM",
        // record_date omitted: procedure defaults to yesterday
      });
      await onSaved("Absent memos generated successfully");
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to generate absent memos" });
    } finally {
      setGenerating(false);
    }
  };

  const handleReverse = async () => {
    if (!header.doc_no) return;
    try {
      // TODO: replace with the real reverse endpoint/parameter — this currently reuses the detail-page lookup, which is likely a placeholder bug.
      await getDynamicLookup({
        parameter: "ABSENT_MEMO_ENTRY_DETAIL_PAGE",
        code1: user?.company_code,
        code2: header.doc_type,
        code3: header.doc_no.toLocaleString(),
      });
      setHeader((prev) => ({ ...prev, is_reversed: true }));
      setNotice({ type: "success", message: `Document ${header.doc_no} reversed` });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to reverse document" });
    }
  };

  const handleCopyDoc = () => {
    setHeader((prev) => ({
      ...emptyAbsentHeader(),
      employee_code: prev.employee_code,
    }));
    setRows(rows.map((row, i) => ({ ...emptyAbsentRow(i + 1), employee_code: row.employee_code })));
    setNotice({ type: "success", message: "Copied into a new draft document" });
  };


const handleSave = async () => {
  setSaving(true);

  try {
    const result = await saveAbsentMemo({
      company_code: user?.company_code,
      user_id: user?.loginid || user?.username || "ADMIN",

      header: {
        doc_type: header.doc_type || "ABM",
        doc_no: Number(header.doc_no) || 0,
        doc_date: header.doc_date || null,
        ref_no: header.ref_no || null,
        name_from: header.name_from || null,
        addr_from: header.addr_from || null,
        name_to: header.name_to || null,
        lettr_subject: header.lettr_subject || null,
        signatory_name: header.signatory_name || null,
        signatory_position: header.signatory_position || null,
        remarks_1: header.remarks_1 || null,
        remarks_2: header.remarks_2 || null,
      },

      details: rows.map((row) => ({
        employee_code: row.employee_code || null,
        sys_gen: row.sys_gen || "N",
        recover_from_dt: row.recover_from_dt || null,
        amount: Number(row.amount) || 0,
        allocated_amt: Number(row.allocated_amt) || 0,
        balance_amt: Number(row.balance_amt) || 0,
        deduct_from_leave: row.deduct_from_leave || "N",
        deduct_noof_leavedays:
          Number(row.deduct_noof_leavedays) || 0,
        ref_leave_doc_no: row.ref_leave_doc_no || null,
        cancel_status: row.cancel_status || null,
      })),
    });

    await onSaved(`Document ${result.doc_no} saved`);

  } catch (error) {
    setNotice({
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "Unable to save document",
    });
  } finally {
    setSaving(false);
  }
};


  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} title="Back to list">
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-lg font-semibold leading-none">Absent Process</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {isEdit ? `Editing ${docNo}` : "New absence document"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEdit && (
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating || saving}>
              <CalendarClock size={14} className="mr-1.5" /> {generating ? "Generating..." : "Generate Daily"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleCopyDoc} disabled={!isEdit}>
            <Copy size={14} className="mr-1.5" /> Copy Doc
          </Button>
          <Button variant="outline" size="sm" onClick={handleReverse} disabled={!isEdit || header.is_reversed}>
            <RotateCcw size={14} className="mr-1.5" /> Reverse
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || generating || header.is_reversed}>
            <Save size={14} className="mr-1.5" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="border-b px-6 pt-3">
        <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Loading document...</div>
        ) : (
          <div className="grid gap-5">
            <AbsentProcessHeaderForm
              header={header}
              onChange={handleHeaderChange}
              onEmployeeLookup={handleEmployeeLookup}
              readOnly={header.is_reversed}
            />
            <AbsentProcessLinesTable rows={rows} onRowsChange={setRows} readOnly={header.is_reversed} />
          </div>
        )}
      </div>
    </div>
  );
}