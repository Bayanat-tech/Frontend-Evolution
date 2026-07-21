import { useMemo } from "react";
import { api } from "../../api/client";
import { MasterPage } from "../../components/ui/MasterPage";
import { getDynamicLookup } from "../../api/lookups";
import { useAuth } from "../../state/AuthContext";

export default function MseProdGroup() {
  const { user } = useAuth();

  const field = useMemo(() => [
    { name: "prod_group_id", label: "Product Group ID", required: true, disabledOnEdit: true },
    { name: "prod_group_name", label: "Product Group Name", required: true },
    { name: "description", label: "Description" },
  ], []);

  const customLoad = async () => {
    const response = await getDynamicLookup({
      parameter: 'PURCHASE_SALES_MSE_PROD_GROUP_DATA_TABLE',
      code1: user?.company_code || ''
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
        keyFields: ["prod_group_id"],
        rowIdSeparator: "_",
        fields: field,
        customLoad: customLoad,

        customSave: async (form, { editMode, original }) => {
          if (editMode && original) {
            await api.put(`/mse-prod-group/${original.prod_group_id}`, form);
          } else {
            await api.post("/mse-prod-group", form);
          }
        },

        customDelete: async (row) => {
          await api.delete(`/mse-prod-group/${row.prod_group_id}`);
        },
      }}
    />
  );
}