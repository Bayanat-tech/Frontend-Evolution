import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, FileText, Plus, RefreshCw, Save, Trash2, X, ArrowLeft, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookupaccount } from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddProductTypeForm } from "./PS_AddproductTypeform";

type ProductTypeRow = {
  prodtype_code: string;
  prodtype_name: string;
  [key: string]: unknown;
};

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<ProductTypeRow>;
};

type Notice = { type: "success" | "error"; message: string } | null;

const baseParams = (loginid: string, companyCode: string) => ({
  parameter: "PURCHASE_SALE_MSE_PRODTYPE",
  loginid,
  code1: companyCode,
  code2: "NULL",
  code3: "NULL",
  code4: "NULL",
  number1: 0,
  number2: 0,
  number3: 0,
  number4: 0,
  date1: null,
  date2: null,
});
