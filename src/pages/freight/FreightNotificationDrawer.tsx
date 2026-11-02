import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "../../api/client";
import { useAuth } from "../../state/AuthContext";

export interface TrkNotificationItem {
  NOTIFICATION_ID: string;
  COMPANY_CODE: string;
  PRIN_CODE: string | null;
  JOB_NO: string | null;
  RECIPIENT_ID: string;
  CHANNEL: string;
  CATEGORY: string;
  TITLE: string;
  MESSAGE: string;
  IS_READ: "Y" | "N";
  READ_AT: string | null;
  CREATED_DT: string;
}

export function FreightNotificationDrawer({
  onSelectJob,
}: {
  onSelectJob?: (jobNo: string) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const userId = String(userRecord.user_id || userRecord.USER_ID || userRecord.loginid || userRecord.LOGINID || "Admin");

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const [notifications, setNotifications] = useState<TrkNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await api.post<{
        success: boolean;
        data: { notifications: TrkNotificationItem[]; unreadCount: number };
      }>("/api/freight/tracker/notifications/list", {
        company_code: companyCode,
        user_id: userId,
        unread_only: filter === "unread",
      });

      if (res.data?.success) {
        setNotifications(res.data.data.notifications || []);
        setUnreadCount(res.data.data.unreadCount || 0);
      }
    } catch (err) {
      console.warn("Failed to load tracker notifications:", err);
    }
  }, [companyCode, filter, userId]);

  useEffect(() => {
    void loadNotifications();
    // Poll every 30 seconds for live alert updates
    const interval = setInterval(() => {
      void loadNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkRead = async (notifId?: string) => {
    setMarkingRead(notifId || "all");
    try {
      await api.post("/api/freight/tracker/notifications/mark-read", {
        company_code: companyCode,
        user_id: userId,
        notification_id: notifId,
        all: !notifId,
      });
      await loadNotifications();
    } catch (err) {
      console.warn("Failed to mark notification read:", err);
    } finally {
      setMarkingRead(null);
    }
  };

  const handleOpenJob = (jobNo?: string | null) => {
    if (!jobNo) return;
    setIsOpen(false);
    if (onSelectJob) {
      onSelectJob(jobNo);
    } else {
      navigate(`/workspace/freight-sea-import?open=${encodeURIComponent(jobNo)}`);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return "";
    const ms = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* ── Bell Icon Button ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        title="Freight Alerts & Notifications"
        aria-label="Freight Alerts & Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Slide-over / Dropdown Drawer ───────────────────────────────────── */}
      {isOpen && (
        <div className="absolute right-0 top-10 z-50 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Freight Operations Alerts
              </h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleMarkRead()}
                  disabled={markingRead === "all"}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-50"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filter Sub-Tabs */}
          <div className="flex border-b border-slate-100 px-4 py-2 text-xs font-medium dark:border-slate-800">
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`mr-3 pb-1 border-b-2 transition ${
                filter === "unread"
                  ? "border-blue-600 text-blue-600 font-bold dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`pb-1 border-b-2 transition ${
                filter === "all"
                  ? "border-blue-600 text-blue-600 font-bold dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              All Notifications
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="flex h-44 flex-col items-center justify-center gap-2 text-center p-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-80" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  You are all caught up!
                </span>
                <span className="text-[11px] text-slate-400">
                  {filter === "unread"
                    ? "No unread alerts. Switch to 'All' to review historical updates."
                    : "No notification events logged yet."}
                </span>
              </div>
            ) : (
              notifications.map((item) => {
                const isHold = item.CATEGORY === "HOLD_APPLIED";
                const isReleased = item.CATEGORY === "HOLD_RELEASED";
                const isDoExpiry = item.CATEGORY === "DO_EXPIRING";
                const isBreakdown = item.CATEGORY === "BREAKDOWN";

                return (
                  <div
                    key={item.NOTIFICATION_ID}
                    className={`flex items-start gap-3 p-3 text-xs transition ${
                      item.IS_READ === "N"
                        ? "bg-blue-50/40 dark:bg-blue-950/20"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    {/* Category Icon */}
                    <div className="mt-0.5 shrink-0">
                      {isHold ? (
                        <div className="rounded-full bg-red-100 p-1 text-red-600 dark:bg-red-950 dark:text-red-400">
                          <ShieldAlert className="h-4 w-4" />
                        </div>
                      ) : isReleased ? (
                        <div className="rounded-full bg-emerald-100 p-1 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      ) : isDoExpiry ? (
                        <div className="rounded-full bg-amber-100 p-1 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                          <Clock className="h-4 w-4" />
                        </div>
                      ) : isBreakdown ? (
                        <div className="rounded-full bg-red-100 p-1 text-red-600 dark:bg-red-950 dark:text-red-400">
                          <AlertOctagon className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="rounded-full bg-blue-100 p-1 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                          <Sparkles className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {item.TITLE}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatTimeAgo(item.CREATED_DT)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                        {item.MESSAGE}
                      </p>

                      <div className="mt-2 flex items-center justify-between">
                        {item.JOB_NO ? (
                          <button
                            type="button"
                            onClick={() => handleOpenJob(item.JOB_NO)}
                            className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-50 dark:bg-slate-800 dark:text-blue-300"
                          >
                            Job: {item.JOB_NO}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </button>
                        ) : (
                          <span />
                        )}

                        {item.IS_READ === "N" && (
                          <button
                            type="button"
                            onClick={() => handleMarkRead(item.NOTIFICATION_ID)}
                            disabled={markingRead === item.NOTIFICATION_ID}
                            className="text-[10px] font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Mark as read"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

