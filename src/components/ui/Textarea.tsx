import { useEffect, useState, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";

/** Multiline counterpart of Input's character-limit preview. */
export function Textarea({ onFocus, onBlur, onChange, onMouseEnter, onMouseLeave, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [preview, setPreview] = useState<{ text: string; left: number; top: number; above: boolean } | null>(null);
  useEffect(() => {
    const hide = () => setPreview(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => { window.removeEventListener("scroll", hide, true); window.removeEventListener("resize", hide); };
  }, []);
  const show = (el: HTMLTextAreaElement) => {
    if (!el.value || el.value.length < 12) return setPreview(null);
    const rect = el.getBoundingClientRect();
    const above = rect.bottom + 150 > window.innerHeight;
    setPreview({ text: el.value, left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(480, window.innerWidth - 16) - 8)), top: above ? rect.top - 6 : rect.bottom + 6, above });
  };
  return <>
    <textarea {...props}
      onFocus={(event) => { show(event.currentTarget); onFocus?.(event); }}
      onBlur={(event) => { setPreview(null); onBlur?.(event); }}
      onMouseEnter={(event) => { show(event.currentTarget); onMouseEnter?.(event); }}
      onMouseLeave={(event) => { if (document.activeElement !== event.currentTarget) setPreview(null); onMouseLeave?.(event); }}
      onChange={(event) => { show(event.currentTarget); onChange?.(event); }}
    />
    {preview && createPortal(<div role="tooltip" style={{ position: "fixed", zIndex: 99999, left: preview.left, top: preview.top, transform: preview.above ? "translateY(-100%)" : undefined, width: "min(480px, calc(100vw - 16px))", pointerEvents: "none" }} className="rounded-xl bg-[#00378C] p-4 text-sm text-white shadow-xl">
      <div className="max-h-24 overflow-hidden whitespace-pre-wrap break-words">{preview.text}</div>
      {props.maxLength != null && <div className="mt-3 flex justify-between border-t border-white/20 pt-2 font-mono text-xs">
        <span>{preview.text.length} / {props.maxLength} characters</span>
        <span>{preview.text.length > props.maxLength ? "Exceeded by " + (preview.text.length - props.maxLength) : "(" + (props.maxLength - preview.text.length) + " left)"}</span>
      </div>}
    </div>, document.body)}
  </>;
}
