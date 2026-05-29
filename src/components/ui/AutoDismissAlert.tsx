import React, { useEffect } from "react";

export function AutoDismissAlert({
  notice,
  onClose,
  duration = 4000,
}: {
  notice: { type: "success" | "error"; message: string } | null;
  onClose: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!notice) return;
    // auto-dismiss only success messages by default
    if (notice.type === "success") {
      const id = setTimeout(() => onClose(), duration);
      return () => clearTimeout(id);
    }
    return;
  }, [notice, onClose, duration]);

  if (!notice) return null;

  return (
    <div className={`alert ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
      {notice.message}
    </div>
  );
}

export default AutoDismissAlert;
