import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { LeaveFlowTable } from "./LeaveFlowTable";
import { LeaveRequestDialog } from "./LeaveRequestDialog";
import { leaveFlowConfigs } from "./leaveFlowConfig";

export function LeaveRequestPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <>
      <LeaveFlowTable
        config={leaveFlowConfigs.request}
        refreshToken={refreshToken}
        headerActions={
          <Button type="button" onClick={() => setDialogOpen(true)}>
            <Plus size={15} /> Add Leave Request
          </Button>
        }
      />
      <LeaveRequestDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => setRefreshToken((current) => current + 1)}
      />
    </>
  );
}
