import { useMemo } from "react";
import { MasterPage } from "../../components/ui/MasterPage";
import type { MasterField } from "../../components/ui/MasterPage";
import { executeDynamicDelete, executeDynamicMutation, getDynamicLookup } from "../../api/lookups";
import { useAuth } from "../../state/AuthContext";

export default function MseProdGroup() {
  const { user } = useAuth();

  const fields = useMemo<MasterField[]>(
    () => [
      {
        name: "group_code",
        label: "Product Group",
        disabledWhen: () => true,
      },
      {
        name: "group_name",
        label: "Product Group Name",
      },
      {
        name: "inv_ac_code",
        label: "Inventory A/C Code",
        section: "Goods in Transit/Inventory A/C",
        dropdownParam: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_INVENTORY_ACCOUNT",
        dropdownDisplayFields: ["ac_code", "ac_name"],
        dropdownDisplaySeparator: " - ",
        dropdownValueKey: "ac_code",
      },
      {
        name: "sales_ac_code",
        label: "Sales A/C Code",
        section: "Goods in Transit/Inventory A/C",
        dropdownParam: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_SALEAC_ACCOUNT",
        dropdownDisplayFields: ["ac_code", "ac_name"],
        dropdownDisplaySeparator: " - ",
        dropdownValueKey: "ac_code",
      },
      {
        name: "direct_expense_ac",
        label: "Direct Expense A/C",
        section: "Goods in Transit/Inventory A/C",
        dropdownParam: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_DIRECT_EXPENSE_ACCOUNT",
        dropdownDisplayFields: ["ac_code", "ac_name"],
        dropdownDisplaySeparator: " - ",
        dropdownValueKey: "ac_code",
      },
      {
        name: "costofsales_ac_code",
        label: "Cost of Sales A/C Code",
        section: "Goods in Transit/Inventory A/C",
        dropdownParam: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_COSTSALES_ACCOUNT",
        dropdownDisplayFields: ["ac_code", "ac_name"],
        dropdownDisplaySeparator: " - ",
        dropdownValueKey: "ac_code",
      },
      {
        name: "gitin_ac_code",
        label: "GIT-IN A/C Code",
        section: "Goods in Transit/Inventory A/C",
        dropdownParam: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_GITIN_ACCOUNT",
        dropdownDisplayFields: ["ac_code", "ac_name"],
        dropdownDisplaySeparator: " - ",
        dropdownValueKey: "ac_code",
      },
      {
        name: "gitout_ac_code",
        label: "GIT-OUT A/C Code",
        section: "Goods in Transit/Inventory A/C",
        dropdownParam: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_GITOUT_ACCOUNT",
        dropdownDisplayFields: ["ac_code", "ac_name"],
        dropdownDisplaySeparator: " - ",
        dropdownValueKey: "ac_code",
      },
    ],
    [],
  );

  // ── Load ──────────────────────────────────────────────────────────────
  const customLoad = async () => {
    const response = await getDynamicLookup({
      parameter: "PURCHASE_SALES_MSE_PROD_GROUP_DATA_TABLE",
      code1: user?.company_code || "",
    });

    return {
      tableData: Array.isArray(response) ? response : [],
    };
  };

  // ── Save (Insert / Update) ────────────────────────────────────────────
  const customSave = async (
    form: Record<string, unknown>,
    context: { editMode: boolean; original: Record<string, unknown> | null; user: unknown },
  ) => {
    const typedUser = context.user as { loginid: string; company_code: string };

    // null / empty group_code → INSERT, otherwise → UPDATE
    const groupCode =
      context.editMode && context.original?.group_code
        ? String(context.original.group_code)
        : form.group_code
          ? String(form.group_code)
          : undefined;

    await executeDynamicMutation({
      parameter: "PURCHASE_SALES_INS_UPD_MSE_PRODGROUP",
      loginid: typedUser.loginid,

      // key / WHERE
      wval1s1: typedUser.company_code, // COMPANY_CODE
      wval1s2: groupCode,              // GROUP_CODE (undefined = insert)

      // values
      val1s2: form.group_name ? String(form.group_name) : undefined,
      val1s3: form.gitin_ac_code ? String(form.gitin_ac_code) : undefined,
      val1s4: form.inv_ac_code ? String(form.inv_ac_code) : undefined,
      val1s5: form.gitout_ac_code ? String(form.gitout_ac_code) : undefined,
      val1s6: form.sales_ac_code ? String(form.sales_ac_code) : undefined,
      val1s7: form.costofsales_ac_code ? String(form.costofsales_ac_code) : undefined,
      val1s8: form.prodtype_code ? String(form.prodtype_code) : undefined,
      val1s9: form.direct_expense_ac ? String(form.direct_expense_ac) : undefined,
    });
  };

  // ── Delete ────────────────────────────────────────────────────────────
  const customDelete = async (row: Record<string, unknown>, userArg: unknown) => {
    const typedUser = userArg as { loginid: string; company_code: string };

    await executeDynamicDelete({
      parameter: "PURCHASE_SALES_DEL_MSE_PRODGROUP",
      loginid: typedUser.loginid,
      code1: typedUser.company_code, // COMPANY_CODE
      code2: String(row.group_code), // GROUP_CODE
    });
  };

  return (
    <MasterPage
      config={{
        title: "Product Group",
        subtitle: "Manage Product Groups",
        master: "mse_prod_group",
        keyFields: ["group_code"],
        rowIdSeparator: "_",
        fields,
        customLoad,
        customSave,
        customDelete,
      }}
    />
  );
}