import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { LeaveFlowTable } from "./LeaveFlowTable";
import { LeaveRequestDialog } from "./LeaveRequestDialog";
import { leaveFlowConfigs } from "./leaveFlowConfig";

export function LeaveRequestPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);

  return (
    <>
      <LeaveFlowTable
        config={leaveFlowConfigs.request}
        refreshToken={refreshToken}
        onEditRow={(row) => {
          setEditingRow(row);
          setDialogOpen(true);
        }}
        headerActions={
          <Button
            type="button"
            onClick={() => {
              setEditingRow(null);
              setDialogOpen(true);
            }}
          >
            <Plus size={15} /> Add Leave Request
          </Button>
        }
      />
      <LeaveRequestDialog
        open={dialogOpen}
        initialRow={editingRow}
        onClose={() => {
          setDialogOpen(false);
          setEditingRow(null);
        }}
        onSaved={() => setRefreshToken((current) => current + 1)}
      />
    </>
  );
}
