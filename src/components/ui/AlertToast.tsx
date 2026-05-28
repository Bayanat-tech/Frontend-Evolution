// ─────────────────────────────────────────────────────────────────────────────
// toast.tsx  —  Drop-in toast system for WMS
//
// 1. Copy this file to src/components/ui/toast.tsx
// 2. Wrap your app root with <ToastProvider> (or add it inside your layout)
// 3. Call useToast() anywhere to get { toast } and fire notifications
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
    }, 320); // matches exit animation duration
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

  const toast = {
    success: (m: string, d?: number) => add("success", m, d),
    error:   (m: string, d?: number) => add("error",   m, d ?? 6000),
    info:    (m: string, d?: number) => add("info",    m, d),
    warning: (m: string, d?: number) => add("warning", m, d ?? 5000),
  };

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
          width: "min(420px, calc(100vw - 2rem))",
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

// ─── Single Toast ─────────────────────────────────────────────────────────────

const CONFIG: Record<
  ToastType,
  { icon: React.ReactNode; accent: string; bg: string; border: string; progress: string }
> = {
  success: {
    icon: <CheckCircle2 size={16} />,
    accent: "#22c55e",
    bg: "rgba(15, 23, 42, 0.97)",
    border: "rgba(34,197,94,0.35)",
    progress: "#22c55e",
  },
  error: {
    icon: <XCircle size={16} />,
    accent: "#ef4444",
    bg: "rgba(15, 23, 42, 0.97)",
    border: "rgba(239,68,68,0.35)",
    progress: "#ef4444",
  },
  info: {
    icon: <Info size={16} />,
    accent: "#3b82f6",
    bg: "rgba(15, 23, 42, 0.97)",
    border: "rgba(59,130,246,0.35)",
    progress: "#3b82f6",
  },
  warning: {
    icon: <AlertTriangle size={16} />,
    accent: "#f59e0b",
    bg: "rgba(15, 23, 42, 0.97)",
    border: "rgba(245,158,11,0.35)",
    progress: "#f59e0b",
  },
};

function ToastItem({
  toast,
  exiting,
  onDismiss,
}: {
  toast: Toast;
  exiting: boolean;
  onDismiss: (id: string) => void;
}) {
  const cfg = CONFIG[toast.type];
  const progressRef = useRef<HTMLDivElement>(null);

  // Animate progress bar
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
        borderRadius: "8px",
        overflow: "hidden",
        boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)`,
      }}
    >
      {/* Body */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "12px 14px",
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

        {/* Message */}
        <p
          style={{
            flex: 1,
            margin: 0,
            fontSize: "13px",
            lineHeight: "1.5",
            color: "#f1f5f9",
            fontWeight: 400,
            wordBreak: "break-word",
          }}
        >
          {toast.message}
        </p>

        {/* Close */}
        <button
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss"
          style={{
            flexShrink: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#64748b",
            padding: "1px",
            display: "flex",
            alignItems: "center",
            borderRadius: "4px",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f1f5f9")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#64748b")}
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      {toast.duration && toast.duration > 0 && (
        <div style={{ height: "2px", background: "rgba(255,255,255,0.06)" }}>
          <div
            ref={progressRef}
            style={{
              height: "100%",
              background: cfg.accent,
              width: "100%",
              opacity: 0.7,
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
    from { opacity: 0; transform: translateX(110%) scale(0.95); }
    to   { opacity: 1; transform: translateX(0)   scale(1); }
  }
  @keyframes wms-toast-out {
    from { opacity: 1; transform: translateX(0)   scale(1);    max-height: 120px; margin-bottom: 0; }
    to   { opacity: 0; transform: translateX(110%) scale(0.95); max-height: 0;    margin-bottom: -8px; }
  }
  .wms-toast-enter {
    animation: wms-toast-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  .wms-toast-exit {
    animation: wms-toast-out 0.32s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
`;