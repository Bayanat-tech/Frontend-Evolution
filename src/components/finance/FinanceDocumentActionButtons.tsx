import React from "react";
import { Edit2, Printer, Download, Ban, Trash2 } from "lucide-react";

export interface FinanceDocumentActionButtonsProps {
  onEdit?: () => void;
  onPrint?: () => void;
  onExcel?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  isCancelled?: boolean;
  disabled?: boolean;
  editTooltip?: string;
  printTooltip?: string;
  excelTooltip?: string;
  cancelTooltip?: string;
  deleteTooltip?: string;
}

export const FinanceDocumentActionButtons: React.FC<FinanceDocumentActionButtonsProps> = ({
  onEdit,
  onPrint,
  onExcel,
  onCancel,
  onDelete,
  isCancelled = false,
  disabled = false,
  editTooltip = "Edit document",
  printTooltip = "Print / PDF Report",
  excelTooltip = "Download Excel report",
  cancelTooltip = "Cancel document",
  deleteTooltip = "Delete document",
}) => {
  return (
    <div
      className="inline-flex items-center justify-center gap-1 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Edit Action */}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          title={editTooltip}
          aria-label={editTooltip}
          className="group relative inline-flex h-[23px] w-[23px] items-center justify-center rounded-[5px] border border-blue-200/90 bg-blue-50/90 text-[#00378C] shadow-2xs transition-all duration-150 hover:border-[#00378C] hover:bg-[#00378C] hover:text-white hover:shadow-xs active:scale-95 disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
        >
          <Edit2 size={12.5} strokeWidth={2.4} />
        </button>
      )}

      {/* Print Action */}
      {onPrint && (
        <button
          type="button"
          onClick={onPrint}
          disabled={disabled}
          title={printTooltip}
          aria-label={printTooltip}
          className="group relative inline-flex h-[23px] w-[23px] items-center justify-center rounded-[5px] border border-slate-300/80 bg-slate-50 text-slate-700 shadow-2xs transition-all duration-150 hover:border-slate-700 hover:bg-slate-700 hover:text-white hover:shadow-xs active:scale-95 disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
        >
          <Printer size={12.5} strokeWidth={2.4} />
        </button>
      )}

      {/* Excel Download Action */}
      {onExcel && (
        <button
          type="button"
          onClick={onExcel}
          disabled={disabled}
          title={excelTooltip}
          aria-label={excelTooltip}
          className="group relative inline-flex h-[23px] w-[23px] items-center justify-center rounded-[5px] border border-emerald-300/80 bg-emerald-50 text-emerald-700 shadow-2xs transition-all duration-150 hover:border-emerald-700 hover:bg-emerald-700 hover:text-white hover:shadow-xs active:scale-95 disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
        >
          <Download size={12.5} strokeWidth={2.4} />
        </button>
      )}

      {/* Cancel Action (Only when not cancelled) */}
      {onCancel && !isCancelled && (
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          title={cancelTooltip}
          aria-label={cancelTooltip}
          className="group relative inline-flex h-[23px] w-[23px] items-center justify-center rounded-[5px] border border-rose-300/80 bg-rose-50 text-rose-600 shadow-2xs transition-all duration-150 hover:border-rose-600 hover:bg-rose-600 hover:text-white hover:shadow-xs active:scale-95 disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
        >
          <Ban size={12.5} strokeWidth={2.4} />
        </button>
      )}

      {/* Delete Action (RJV, Petty Cash, etc.) */}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          title={deleteTooltip}
          aria-label={deleteTooltip}
          className="group relative inline-flex h-[23px] w-[23px] items-center justify-center rounded-[5px] border border-red-300/80 bg-red-50 text-red-700 shadow-2xs transition-all duration-150 hover:border-red-700 hover:bg-red-700 hover:text-white hover:shadow-xs active:scale-95 disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
        >
          <Trash2 size={12.5} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
};
