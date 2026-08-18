import { ArrowLeft, Copy, RotateCcw, Save } from "lucide-react";
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
      // TODO: replace with the real save endpoint / dynamic lookup parameter for this module.
      await getDynamicLookup({
        parameter: header.doc_no ? "PS_ABSENT_PROCESS_UPDATE" : "PS_ABSENT_PROCESS_INSERT",
        code1: user?.company_code,
        code2: user?.loginid || user?.username || "ADMIN",
      });
      await onSaved(`Document ${header.doc_no || "(new)"} saved`);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save document" });
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
          <Button variant="outline" size="sm" onClick={handleCopyDoc} disabled={!isEdit}>
            <Copy size={14} className="mr-1.5" /> Copy Doc
          </Button>
          <Button variant="outline" size="sm" onClick={handleReverse} disabled={!isEdit || header.is_reversed}>
            <RotateCcw size={14} className="mr-1.5" /> Reverse
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || header.is_reversed}>
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