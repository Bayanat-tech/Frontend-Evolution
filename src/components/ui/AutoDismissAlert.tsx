import { useEffect, useRef } from "react";
import { useToast } from "./AlertToast";

type Notice = { type: "success" | "error" | "info" | "warning"; message: string } | null;

export function AutoDismissAlert({
  notice,
  onClose,
  duration = 4000,
}: {
  notice: Notice;
  onClose: () => void;
  duration?: number;
}) {
  const { toast } = useToast();
  const lastNoticeKey = useRef("");

  useEffect(() => {
    if (!notice) {
      lastNoticeKey.current = "";
      return;
    }

    const key = `${notice.type}:${notice.message}`;
    if (lastNoticeKey.current === key) return;
    lastNoticeKey.current = key;

    toast[notice.type](notice.message, notice.type === "error" ? undefined : duration);
    const id = window.setTimeout(onClose, 50);
    return () => window.clearTimeout(id);
  }, [duration, notice, onClose, toast]);

  return null;
}

export default AutoDismissAlert;
