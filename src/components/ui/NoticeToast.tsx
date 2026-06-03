import { AutoDismissAlert } from "./AutoDismissAlert";

export type ToastNotice = { type: "success" | "error" | "info" | "warning"; message: string } | null;

export function NoticeToast({
  notice,
  onClose,
  duration,
}: {
  notice: ToastNotice;
  onClose: () => void;
  duration?: number;
}) {
  return <AutoDismissAlert notice={notice} onClose={onClose} duration={duration} />;
}

export default NoticeToast;
