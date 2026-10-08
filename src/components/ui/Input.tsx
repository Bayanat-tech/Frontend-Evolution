import { InputHTMLAttributes, forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** If false, disables the floating overflow tooltip. Defaults to true. */
  showOverflowTooltip?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      showOverflowTooltip = true,
      onMouseEnter,
      onMouseLeave,
      onFocus,
      onBlur,
      onChange,
      type = "text",
      ...props
    },
    ref,
  ) => {
    const innerRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    const [tooltip, setTooltip] = useState<{
      left: number;
      top: number;
      width: number;
      placeAbove: boolean;
      text: string;
    } | null>(null);

    const isFocusedRef = useRef(false);

    const updateTooltipPosition = useCallback((val: string) => {
      const el = innerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const width = Math.min(480, Math.max(260, Math.min(window.innerWidth - 32, rect.width * 1.35)));
      const left = Math.min(Math.max(16, rect.left), Math.max(16, window.innerWidth - width - 16));
      const placeAbove = rect.bottom + 120 > window.innerHeight;
      const top = placeAbove ? Math.max(12, rect.top - 8) : rect.bottom + 6;

      setTooltip({
        left,
        top,
        width,
        placeAbove,
        text: val,
      });
    }, []);

    const checkAndShowTooltip = useCallback(() => {
      if (!showOverflowTooltip) return;
      // Skip non-text or security inputs
      if (type === "password" || type === "number" || type === "date" || type === "checkbox" || type === "radio" || type === "hidden") {
        setTooltip(null);
        return;
      }

      const el = innerRef.current;
      if (!el) return;
      const val = String(el.value ?? props.value ?? "");
      if (!val || val.trim().length < 12) {
        setTooltip(null);
        return;
      }

      // Check if text is overflowing the input container or is notably long
      const isOverflowing = el.scrollWidth > el.clientWidth + 2 || val.length > 28;
      if (!isOverflowing) {
        setTooltip(null);
        return;
      }

      updateTooltipPosition(val);
    }, [props.value, showOverflowTooltip, type, updateTooltipPosition]);

    const hideTooltip = useCallback(() => {
      setTooltip(null);
    }, []);

    useEffect(() => {
      if (!tooltip) return;
      const onScroll = () => hideTooltip();
      const onResize = () => hideTooltip();
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onResize);
      return () => {
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onResize);
      };
    }, [hideTooltip, tooltip]);

    return (
      <>
        <input
          ref={innerRef}
          type={type}
          className={cn(
            "ui-input",
            "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
          onMouseEnter={(e) => {
            checkAndShowTooltip();
            onMouseEnter?.(e);
          }}
          onMouseLeave={(e) => {
            if (!isFocusedRef.current) {
              hideTooltip();
            }
            onMouseLeave?.(e);
          }}
          onFocus={(e) => {
            isFocusedRef.current = true;
            checkAndShowTooltip();
            onFocus?.(e);
          }}
          onBlur={(e) => {
            isFocusedRef.current = false;
            hideTooltip();
            onBlur?.(e);
          }}
          onChange={(e) => {
            if (tooltip) {
              const nextVal = e.target.value;
              if (nextVal && nextVal.length >= 12) {
                updateTooltipPosition(nextVal);
              } else {
                hideTooltip();
              }
            }
            onChange?.(e);
          }}
          {...props}
        />
        {tooltip &&
          createPortal(
            <div
              className="data-table-overflow-tooltip"
              role="tooltip"
              style={{
                left: tooltip.left,
                top: tooltip.top,
                maxWidth: tooltip.width,
                width: "max-content",
                transform: tooltip.placeAbove ? "translateY(-100%)" : undefined,
                animation: "fadeIn 0.15s ease-in-out",
                boxShadow: "0 10px 25px -5px rgba(0, 55, 140, 0.3), 0 8px 10px -6px rgba(0, 55, 140, 0.2)",
              }}
            >
              <div className="whitespace-pre-wrap font-medium">{tooltip.text}</div>
              {props.maxLength && (
                <div className="mt-1.5 pt-1.5 border-t border-white/20 flex items-center justify-between text-[10.5px] opacity-90 font-mono">
                  <span>
                    {tooltip.text.length} / {props.maxLength} characters
                  </span>
                  {tooltip.text.length > props.maxLength ? (
                    <span className="text-rose-300 font-bold ml-2">Exceeded by {tooltip.text.length - props.maxLength}</span>
                  ) : (
                    <span className="opacity-75 ml-2">({props.maxLength - tooltip.text.length} left)</span>
                  )}
                </div>
              )}
            </div>,
            document.body,
          )}
      </>
    );
  },
);

Input.displayName = "Input";

