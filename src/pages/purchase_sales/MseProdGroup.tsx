import { useMemo } from "react";
import { api } from "../../api/client";
import { MasterPage } from "../../components/ui/MasterPage";
import type { MasterField } from "../../components/ui/MasterPage";
import { getDynamicLookup } from "../../api/lookups";
import { useAuth } from "../../state/AuthContext";

export default function MseProdGroup() {
  const { user } = useAuth();

const field = useMemo<MasterField[]>(
  () => [
    {
      name: "group_code",
      label: "Product Group",
      required: true,
      disabledOnEdit: true,
      dropdownParam: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_GROUP",
      dropdownDisplayFields: ["group_code", "group_name"],
      dropdownDisplaySeparator: " - ",
      dropdownValueKey: "group_code",
      colSpan: 1,
      populateFields: { group_name: "group_name" }, // auto-fill group_name on select
    },
    {
      name: "group_name",
      label: "Product Group Name",
      disabledWhen : () => true,
    },
    { name: "inv_ac_code", 
      label: "Inventory A/C Code", 
      section: 'Goods in Transit/Inventory A/C',
      dropdownParam: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_INVENTORY_ACCOUNT",
      dropdownDisplayFields: ["ac_code", "ac_name"],
      dropdownDisplaySeparator: " - ",
      dropdownValueKey: "ac_code",
    },
    { name: "sales_ac_code", 
      label: "Sales A/C Code", 
      section: 'Goods in Transit/Inventory A/C',
      dropdownParam: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_SALEAC_ACCOUNT",
      dropdownDisplayFields: ["ac_code", "ac_name"],
      dropdownDisplaySeparator: " - ",
      dropdownValueKey: "ac_code",
    },
    { name: "direct_expense_ac", 
      label: "Direct Expense A/C", 
      section: 'Goods in Transit/Inventory A/C',
      dropdownParam: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_DIRECT_EXPENSE_ACCOUNT",
      dropdownDisplayFields: ["ac_code", "ac_name"],
      dropdownDisplaySeparator: " - ",
      dropdownValueKey: "ac_code",
   },
    { name: "costofsales_ac_code",
      label: "Cost of Sales A/C Code",
      section: 'Goods in Transit/Inventory A/C',
      dropdownParam: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_COSTSALES_ACCOUNT",
      dropdownDisplayFields: ["ac_code", "ac_name"],
      dropdownDisplaySeparator: " - ",
      dropdownValueKey: "ac_code",
    },
    { name: "gitin_ac_code",
      label: "GIT-IN A/C Code", 
      section: 'Goods in Transit/Inventory A/C',
      dropdownParam: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_GITIN_ACCOUNT",
      dropdownDisplayFields: ["ac_code", "ac_name"],
      dropdownDisplaySeparator: " - ",
      dropdownValueKey: "ac_code", 
    },
    { name: "gitout_ac_code", label: "GIT-OUT A/C Code", section: 'Goods in Transit/Inventory A/C', 
      dropdownParam: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_GITOUT_ACCOUNT",
      dropdownDisplayFields: ["ac_code", "ac_name"],
      dropdownDisplaySeparator: " - ",
      dropdownValueKey: "ac_code",
    },
  ],
  [],
);

  const customLoad = async () => {
    const response = await getDynamicLookup({
      parameter: "PURCHASE_SALES_MSE_PROD_GROUP_DATA_TABLE",
      code1: user?.company_code || "",
    });

    return {
      tableData: Array.isArray(response) ? response : [],
    };
  };

  return (
    <MasterPage
      config={{
        title: "Product Group",
        subtitle: "Manage Product Groups",
        master: "mse_prod_group",
        keyFields: ["group_code"],
        rowIdSeparator: "_",
        fields: field,
        customLoad,

        customSave: async (form, { editMode, original }) => {
          if (editMode && original) {
            await api.put(`/mse-prod-group/${original.group_code}`, form);
          } else {
            await api.post("/mse-prod-group", form);
          }
        },

        customDelete: async (row) => {
          await api.delete(`/mse-prod-group/${row.group_code}`);
        },
      }}
    />
  );
}