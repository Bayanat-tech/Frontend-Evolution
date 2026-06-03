// ─────────────────────────────────────────────────────────────────────────────
// toast.tsx  —  Drop-in toast system for WMS (Light + Dark mode)
//
// 1. Copy this file to src/components/ui/toast.tsx
// 2. Wrap your app root with <ToastProvider>
// 3. Call useToast() anywhere to fire notifications
//
// Usage:
//   const { toast } = useToast();
//   toast.success("Inbound job saved successfully");
//   toast.error("Unable to save inbound job");
//   toast.info("Loading shipment details...");
//   toast.warning("Principal is required");
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms, default 4000. Pass 0 for persistent.
}

interface ToastContextValue {
  toast: {
    success: (message: string, duration?: number) => void;
    error:   (message: string, duration?: number) => void;
    info:    (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [exiting, setExiting] = useState<Set<string>>(new Set());

  const dismiss = useCallback((id: string) => {
    setExiting((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      setExiting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 320);
  }, []);

  const add = useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const toast = useMemo(
    () => ({
      success: (m: string, d?: number) => add("success", m, d),
      error:   (m: string, d?: number) => add("error",   m, d ?? 6000),
      info:    (m: string, d?: number) => add("info",    m, d),
      warning: (m: string, d?: number) => add("warning", m, d ?? 5000),
    }),
    [add],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} exiting={exiting} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Container ───────────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  exiting,
  onDismiss,
}: {
  toasts: Toast[];
  exiting: Set<string>;
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <>
      <style>{TOAST_STYLES}</style>
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: "fixed",
          top: "1rem",
          right: "1rem",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          width: "min(400px, calc(100vw - 2rem))",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            exiting={exiting.has(t.id)}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </>
  );
}

// ─── Theme Config ─────────────────────────────────────────────────────────────
//
// LIGHT: Matches Bayanat WMS — white cards, subtle borders, navy text, 
//        colored icon+left-border only. Clean, professional, enterprise feel.
//
// DARK:  Original dark glass style — near-black bg, glowing border, rich tones.

const LIGHT_CONFIG: Record<
  ToastType,
  { icon: React.ReactNode; accent: string; bg: string; border: string; text: string; subText: string; shadow: string; progress: string; label: string }
> = {
  success: {
    icon:     <CheckCircle2 size={15} strokeWidth={2.2} />,
    accent:   "#15803d",        // green-700
    bg:       "#f0fdf4",        // green-50 — stands out on white page
    border:   "#4ade80 ",        // green-300
    text:     "#0f172a",
    subText:  "#4b7a5e",
    shadow:   "0 4px 16px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.08)",
    progress: "#15803d",
    label:    "Success",
  },
  error: {
    icon:     <XCircle size={15} strokeWidth={2.2} />,
    accent:   "#b91c1c",        // red-700
    bg:       "#fff1f2",        // rose-50
    border:   "#fca5a5",        // red-300
    text:     "#0f172a",
    subText:  "#7c3333",
    shadow:   "0 4px 16px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.08)",
    progress: "#b91c1c",
    label:    "Error",
  },
  info: {
    icon:     <Info size={15} strokeWidth={2.2} />,
    accent:   "#1d4ed8",        // Bayanat navy-blue
    bg:       "#eff6ff",        // blue-50
    border:   "#93c5fd",        // blue-300
    text:     "#0f172a",
    subText:  "#3a5a9e",
    shadow:   "0 4px 16px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.08)",
    progress: "#1d4ed8",
    label:    "Info",
  },
  warning: {
    icon:     <AlertTriangle size={15} strokeWidth={2.2} />,
    accent:   "#b45309",        // amber-700
    bg:       "#fffbeb",        // amber-50
    border:   "#fcd34d",        // amber-300
    text:     "#0f172a",
    subText:  "#78450f",
    shadow:   "0 4px 16px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.08)",
    progress: "#b45309",
    label:    "Warning",
  },
};

const DARK_CONFIG: Record<
  ToastType,
  { icon: React.ReactNode; accent: string; bg: string; border: string; text: string; subText: string; shadow: string; progress: string; label: string }
> = {
  success: {
    icon:     <CheckCircle2 size={15} strokeWidth={2.2} />,
    accent:   "#22c55e",
    bg:       "rgba(15, 23, 42, 0.97)",
    border:   "rgba(34,197,94,0.30)",
    text:     "#f1f5f9",
    subText:  "#94a3b8",
    shadow:   "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
    progress: "#22c55e",
    label:    "Success",
  },
  error: {
    icon:     <XCircle size={15} strokeWidth={2.2} />,
    accent:   "#ef4444",
    bg:       "rgba(15, 23, 42, 0.97)",
    border:   "rgba(239,68,68,0.30)",
    text:     "#f1f5f9",
    subText:  "#94a3b8",
    shadow:   "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
    progress: "#ef4444",
    label:    "Error",
  },
  info: {
    icon:     <Info size={15} strokeWidth={2.2} />,
    accent:   "#3b82f6",
    bg:       "rgba(15, 23, 42, 0.97)",
    border:   "rgba(59,130,246,0.30)",
    text:     "#f1f5f9",
    subText:  "#94a3b8",
    shadow:   "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
    progress: "#3b82f6",
    label:    "Info",
  },
  warning: {
    icon:     <AlertTriangle size={15} strokeWidth={2.2} />,
    accent:   "#f59e0b",
    bg:       "rgba(15, 23, 42, 0.97)",
    border:   "rgba(245,158,11,0.30)",
    text:     "#f1f5f9",
    subText:  "#94a3b8",
    shadow:   "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
    progress: "#f59e0b",
    label:    "Warning",
  },
};

// ─── Single Toast ─────────────────────────────────────────────────────────────

function ToastItem({
  toast,
  exiting,
  onDismiss,
}: {
  toast: Toast;
  exiting: boolean;
  onDismiss: (id: string) => void;
}) {
  // Your app sets class="app dark" on the root div — we read that here.
  // This re-evaluates on every render, so theme toggles are reflected instantly.
  const isDark =
    typeof document !== "undefined" &&
    document.querySelector(".app")?.classList.contains("dark") === true;

  const cfg = isDark ? DARK_CONFIG[toast.type] : LIGHT_CONFIG[toast.type];
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!progressRef.current || !toast.duration) return;
    const el = progressRef.current;
    el.style.transition = "none";
    el.style.width = "100%";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = `width ${toast.duration}ms linear`;
        el.style.width = "0%";
      });
    });
  }, [toast.duration]);

  return (
    <div
      role="alert"
      className={exiting ? "wms-toast wms-toast-exit" : "wms-toast wms-toast-enter"}
      style={{
        pointerEvents: "all",
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderLeft: `3px solid ${cfg.accent}`,
        borderRadius: "6px",
        overflow: "hidden",
        boxShadow: cfg.shadow,
      }}
    >
      {/* Body */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "11px 13px",
        }}
      >
        {/* Icon */}
        <span
          style={{
            color: cfg.accent,
            flexShrink: 0,
            marginTop: "1px",
            display: "flex",
          }}
        >
          {cfg.icon}
        </span>

        {/* Text group */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Label row */}
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.02em",
              color: cfg.accent,
              textTransform: "uppercase",
              lineHeight: 1,
              marginBottom: "3px",
            }}
          >
            {cfg.label}
          </p>
          {/* Message */}
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              lineHeight: "1.45",
              color: cfg.text,
              fontWeight: 400,
              wordBreak: "break-word",
            }}
          >
            {toast.message}
          </p>
        </div>

        {/* Close */}
        <button
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss"
          style={{
            flexShrink: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: cfg.subText,
            padding: "1px",
            display: "flex",
            alignItems: "center",
            borderRadius: "4px",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.color = cfg.text)
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.color = cfg.subText)
          }
        >
          <X size={13} />
        </button>
      </div>

      {/* Progress bar */}
      {toast.duration && toast.duration > 0 && (
        <div
          style={{
            height: "2px",
            background: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
          }}
        >
          <div
            ref={progressRef}
            style={{
              height: "100%",
              background: cfg.accent,
              width: "100%",
              opacity: isDark ? 0.7 : 0.55,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Keyframe styles ──────────────────────────────────────────────────────────

const TOAST_STYLES = `
  @keyframes wms-toast-in {
    from { opacity: 0; transform: translateX(110%) scale(0.96); }
    to   { opacity: 1; transform: translateX(0)   scale(1); }
  }
  @keyframes wms-toast-out {
    from { opacity: 1; transform: translateX(0)   scale(1);    max-height: 120px; margin-bottom: 0; }
    to   { opacity: 0; transform: translateX(110%) scale(0.96); max-height: 0;    margin-bottom: -8px; }
  }
  .wms-toast-enter {
    animation: wms-toast-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  .wms-toast-exit {
    animation: wms-toast-out 0.32s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
`;
