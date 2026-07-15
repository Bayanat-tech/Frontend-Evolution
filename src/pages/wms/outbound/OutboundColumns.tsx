import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { WmsRow } from "./Outboundtypes";
import { value, formatCellValue, sqlEscape } from "./OutboundHelpers";

export function makeColumns(
  columns: { key: string; label: string; size?: number }[]
): ColumnDef<WmsRow>[] {
  return columns.map((column) => ({
    accessorKey: column.key,
    header: column.label,
    size: column.size || 140,
    cell: ({ row }) => formatCellValue(row.original, column.key),
  }));
}

export function rowNumberColumn(): ColumnDef<WmsRow> {
  return {
    id: "row_no",
    header: "No",
    size: 56,
    enableColumnFilter: false,
    cell: ({ row }) => row.index + 1,
  };
}

function getSelectionId(row: WmsRow, selectionKey: string) {
  return value(row, selectionKey) || value(row, "serial_no") || value(row, "key_number");
}

export function selectionColumn(
  selection: Record<string, boolean>,
  setSelection: (
    next:
      | Record<string, boolean>
      | ((current: Record<string, boolean>) => Record<string, boolean>)
  ) => void,
  selectionKey = "serial_no"
): ColumnDef<WmsRow> {
  return {
    id: "select",
    header: ({ table }) => {
      const rows = table.getRowModel().rows;
      const ids = rows.map((r) => getSelectionId(r.original, selectionKey) || r.id);
      const allSelected = ids.length > 0 && ids.every((id) => selection[id]);
      const someSelected = !allSelected && ids.some((id) => selection[id]);
      return (
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected;
          }}
          onChange={(event) => {
            const checked = event.target.checked;
            setSelection((current) => {
              const next = { ...current };
              ids.forEach((id) => {
                next[id] = checked;
              });
              return next;
            });
          }}
        />
      );
    },
    size: 70,
    enableColumnFilter: false,
    cell: ({ row }) => {
      const id = getSelectionId(row.original, selectionKey) || row.id;
      return (
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={Boolean(selection[id])}
          onChange={(event) =>
            setSelection((current) => ({
              ...current,
              [id]: event.target.checked,
            }))
          }
        />
      );
    },
  };
}

export function actionColumn(
  onEdit: (row: WmsRow) => void,
  onDelete?: (row: WmsRow) => void
): ColumnDef<WmsRow> {
  return {
    id: "actions",
    header: "Actions",
    size: 105,
    enableColumnFilter: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          title="Edit"
          onClick={() => onEdit(row.original)}
        >
          <Pencil size={14} />
        </Button>
        {onDelete && (
          <Button
            size="icon"
            variant="ghost"
            title="Delete"
            onClick={() => onDelete(row.original)}
          >
            <Trash2 size={14} />
          </Button>
        )}
      </div>
    ),
  };
}

export function orderDetailColumns() {
  return [
    { key: "order_no", label: "Order No", size: 150 },
    { key: "cust_name", label: "Customer", size: 220 },
    { key: "prod_name", label: "Product", size: 340 },
    { key: "site_code", label: "Site Code", size: 110 },
    { key: "loc_code_from", label: "Location From", size: 150 },
    { key: "loc_code_to", label: "Location To", size: 150 },
    { key: "quantity", label: "Quantity", size: 120 },
    { key: "batch_no", label: "Batch No", size: 140 },
    { key: "lot_no", label: "Lot No", size: 140 },
    { key: "production_from", label: "Production From", size: 150 },
    { key: "production_to", label: "Production To", size: 150 },
    { key: "expiry_from", label: "Expiry From", size: 140 },
    { key: "expiry_to", label: "Expiry To", size: 140 },
    { key: "act_order_qty", label: "Actual Qty", size: 130 },
  ];
}

export function pickingColumns() {
  return [
    { key: "order_no", label: "Order No", size: 150 },
    { key: "cust_name", label: "Customer", size: 220 },
    { key: "prod_name", label: "Product", size: 340 },
    { key: "site_code", label: "Site", size: 100 },
    { key: "lot_no", label: "Lot No", size: 140 },
    { key: "loc_code_from", label: "Location From", size: 150 },
    { key: "loc_code_to", label: "Location To", size: 150 },
    { key: "quantity", label: "Quantity", size: 120 },
    { key: "production_from", label: "Production From", size: 150 },
    { key: "production_to", label: "Production To", size: 150 },
    { key: "expiry_from", label: "Expiry From", size: 140 },
    { key: "expiry_to", label: "Expiry To", size: 140 },
    { key: "act_order_qty", label: "Actual Qty", size: 130 },
  ];
}

export function confirmPickColumns() {
  return [
    { key: "order_no", label: "Order No", size: 150 },
    { key: "cust_name", label: "Customer", size: 220 },
    { key: "prod_name", label: "Product", size: 340 },
    { key: "site_code", label: "Site Code", size: 110 },
    { key: "location_code", label: "Location From", size: 150 },
    { key: "loc_code_to", label: "Location To", size: 150 },
    { key: "quantity", label: "Quantity", size: 120 },
    { key: "batch_no", label: "Batch No", size: 140 },
    { key: "lot_no", label: "Lot No", size: 140 },
  ];
}

export function pickingIssueColumns() {
  return [
    { key: "company_code", label: "Company", size: 110 },
    { key: "prin_code", label: "Principal", size: 120 },
    { key: "job_no", label: "Job No", size: 130 },
    { key: "prod_code", label: "Product Code", size: 160 },
    { key: "qty_puom", label: "Qty PUOM", size: 130 },
    { key: "p_uom", label: "P UOM", size: 100 },
    { key: "qty_luom", label: "Qty LUOM", size: 130 },
    { key: "quantity", label: "Quantity", size: 130 },
    { key: "l_uom", label: "L UOM", size: 100 },
    { key: "expiry_from", label: "Expiry From", size: 140 },
    { key: "expiry_to", label: "Expiry To", size: 140 },
    { key: "production_from", label: "Production From", size: 150 },
    { key: "production_to", label: "Production To", size: 150 },
    { key: "batch_no", label: "Batch No", size: 130 },
    { key: "loc_code_from", label: "Loc From", size: 130 },
    { key: "loc_code_to", label: "Loc To", size: 130 },
    { key: "pick_qty_status", label: "Pick Qty Status", size: 150 },
    { key: "check_mfg_exp", label: "Mfg/Exp Check", size: 240 },
  ];
}

export function getOutboundTabConfig(tab: string) {
  const orderWhere = ({
    companyCode,
    jobNo,
    prinCode,
  }: {
    companyCode: string;
    jobNo: string;
    prinCode: string;
  }) =>
    `COMPANY_CODE = '${sqlEscape(companyCode)}' AND JOB_NO = '${sqlEscape(jobNo)}' AND PRIN_CODE = '${sqlEscape(prinCode)}'`;

  const configs: Record<
    string,
    {
      title: string;
      minWidth: number;
      kind?: "order" | "detail";
      editable?: boolean;
      selectionKey?: string;
      columns: { key: string; label: string; size?: number }[];
      sql: (args: {
        companyCode: string;
        jobNo: string;
        prinCode: string;
      }) => string;
    }
  > = {
    order_entry: {
      title: "Order Entry",
      minWidth: 1900,
      kind: "order",
      editable: true,
      sql: (args) =>
        `SELECT * FROM TO_ORDER WHERE ${orderWhere(args)} ORDER BY ORDER_NO`,
      columns: [
        { key: "order_no", label: "Order No", size: 150 },
        { key: "cust_code", label: "Customer", size: 150 },
        { key: "order_date", label: "Order Date", size: 120 },
        { key: "order_due_date", label: "Due Date", size: 120 },
        { key: "curr_code", label: "Currency", size: 120 },
        { key: "ex_rate", label: "Exchange Rate", size: 130 },
        { key: "moc1", label: "MOC 1", size: 100 },
        { key: "moc2", label: "MOC 2", size: 100 },
        { key: "exp_container_no", label: "Container No", size: 160 },
        { key: "exp_container_size", label: "Container Size", size: 140 },
        { key: "exp_container_type", label: "Container Type", size: 140 },
        { key: "exp_container_sealno", label: "Seal No", size: 140 },
        { key: "cust_reference", label: "Customer Ref", size: 170 },
        { key: "pack_start", label: "Pack Start", size: 150 },
        { key: "pack_end", label: "Pack End", size: 150 },
        { key: "load_start", label: "Load Start", size: 150 },
        { key: "load_end", label: "Load End", size: 150 },
      ],
    },
    order_details: {
      title: "Order Details",
      minWidth: 2100,
      kind: "detail",
      editable: true,
      sql: (args) =>
        `SELECT * FROM VW_TO_ORDER_DET WHERE ${orderWhere(args)} ORDER BY ORDER_NO, SERIAL_NO`,
      columns: orderDetailColumns(),
    },
    picking_details: {
      title: "Picking Details",
      minWidth: 2100,
      selectionKey: "serial_no",
      sql: ({ jobNo, prinCode }) =>
        `SELECT * FROM VW_WM_OUB_TO_PICK WHERE JOB_NO = '${sqlEscape(jobNo)}' AND PRIN_CODE = '${sqlEscape(prinCode)}' ORDER BY ORDER_NO, SERIAL_NO`,
      columns: pickingColumns(),
    },
    cancel_picking: {
      title: "Cancel Picking",
      minWidth: 2100,
      selectionKey: "key_number",
      sql: ({ jobNo, prinCode }) =>
        `SELECT * FROM VW_WM_OUB_PICK_TO_CONFIRM WHERE CONFIRMED = 'N' AND JOB_NO = '${sqlEscape(jobNo)}' AND PRIN_CODE = '${sqlEscape(prinCode)}' ORDER BY ORDER_NO, KEY_NUMBER`,
      columns: confirmPickColumns(),
    },
    job_confirmation: {
      title: "Job Confirmation",
      minWidth: 2100,
      selectionKey: "key_number",
      sql: ({ companyCode, jobNo, prinCode }) =>
        `SELECT * FROM VW_WM_OUB_PICK_TO_CONFIRM WHERE JOB_NO = '${sqlEscape(jobNo)}' AND PRIN_CODE = '${sqlEscape(prinCode)}' AND COMPANY_CODE = '${sqlEscape(companyCode)}' AND SELECTED = 'N' AND CONFIRMED = 'N' AND CONFIRM_DATE IS NULL ORDER BY ORDER_NO, KEY_NUMBER`,
      columns: confirmPickColumns(),
    },
    activity_billing: {
      title: "Activity Billing",
      minWidth: 1180,
      sql: ({ jobNo, prinCode }) => `
        SELECT
          tid.PRIN_CODE,
          tid.JOB_NO,
          tid.ACT_CODE,
          tid.ACT_CODE || '-' || ma.ACTIVITY AS ACTIVITY,
          tid.QUANTITY,
          tid.BILL_RATE,
          tid.BILL,
          tid.COST_RATE,
          tid.COST,
          tid.OTHER_SERVICES
        FROM TN_INVOICE_DET tid
        JOIN MS_ACTIVITY ma
          ON tid.ACT_CODE = ma.ACTIVITY_CODE
        WHERE tid.PRIN_CODE = ${Number(prinCode) || 0}
          AND tid.JOB_NO = '${sqlEscape(jobNo)}'
      `,
      columns: [
        { key: "act_code", label: "Activity Code", size: 150 },
        { key: "activity", label: "Activity", size: 280 },
        { key: "quantity", label: "Quantity", size: 120 },
        { key: "bill_rate", label: "Bill Rate", size: 120 },
        { key: "bill", label: "Bill", size: 120 },
        { key: "cost_rate", label: "Cost Rate", size: 120 },
        { key: "cost", label: "Cost", size: 120 },
        { key: "other_services", label: "Other Services", size: 200 },
      ],
    },
  };

  return configs[tab];
}