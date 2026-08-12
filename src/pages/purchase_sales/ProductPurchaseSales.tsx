import { useMemo } from "react";
import { MasterField, MasterPage } from "../../components/ui/MasterPage";
import { executeDynamicDelete, executeDynamicMutationColumn90, getDynamicLookup } from "../../api/lookups";
import { useAuth } from "../../state/AuthContext";

const ProductPurchaseSales = () => {
  const { user } = useAuth();

  const fields = useMemo<MasterField[]>(
    () => [
      // Product Details
      { name: "prod_code", label: "Product Code", section: "Product Details" },
      { name: "prod_name", label: "Product Name", section: "Product Details" },
      { name: "model_number", label: "Model Number", section: "Product Details" },
      {
        name: "group_code",
        label: "Group Code",
        section: "Product Details",
        dropdownParam: "PURCHASE_SALES_DD_ONLY_COMPANY_GROUP",
        dropdownDisplayFields: ["group_code", "group_name"],
        dropdownDisplaySeparator: " - ",
        dropdownValueKey: "group_code",
      },
      {
        name: "brand_code",
        label: "Brand Code",
        section: "Product Details",
        dropdownParam: "PURCHASE_SALES_DD_ONLY_COMPANY_BRAND",
        dropdownDisplayFields: ["brand_code", "brand_name"],
        dropdownDisplaySeparator: " - ",
        dropdownValueKey: "brand_code",
      },
      {
        name: "category_code",
        label: "Category Code",
        section: "Product Details",
        dropdownParam: "PURCHASE_SALES_DD_ONLY_COMPANY_CATEGORY",
        dropdownDisplayFields: ["category_code", "category_name"],
        dropdownDisplaySeparator: " - ",
        dropdownValueKey: "category_code",
      },
      {
        name: "prodtype_code",
        label: "Product Type Code",
        section: "Product Details",
        dropdownParam: "PURCHASE_SALES_DD_ONLY_COMPANY_PRODTYPE",
        dropdownDisplayFields: ["prodtype_code", "prodtype_name"],
        dropdownDisplaySeparator: " - ",
        dropdownValueKey: "prodtype_code",
      },
      { name: "season_code", label: "Season Code", section: "Product Details" },

      // Barcode and QR code fields
      { name: "barcode", label: "Barcode", section: "Barcode and QR Code" },
      { name: "size_code", label: "Size Code", section: "Barcode and QR Code" },
      { name: "Active", label: "Active", section: "Barcode and QR Code" },
      { name: "co_packing", label: "Co Packing", section: "Barcode and QR Code" },
      { name: "product_stage", label: "Product Stage", section: "Barcode and QR Code" },

      // Unit of Measurement fields
      { name: "uom_count", label: "No. of UOMs", section: "Unit of Measurement" },
      { name: "p_uom", label: "Primary UOM", section: "Unit of Measurement" },
      { name: "l_uom", label: "Lower UOM", section: "Unit of Measurement" },
      { name: "uppp", label: "UPPP", section: "Unit of Measurement" },

      // Division fields
      { name: "div_code", label: "Division Code", section: "Division" },
      { name: "color_code", label: "Color Code", section: "Division" },

      // Weight and Dimensions fields
      { name: "length", label: "Length", section: "Dimensions" },
      { name: "breadth", label: "Breadth", section: "Dimensions" },
      { name: "height", label: "Height", section: "Dimensions" },
      { name: "volume", label: "Volume", section: "Dimensions" },
      { name: "net_wt", label: "Net Weight", section: "Dimensions" },

      // Remarks field
      { name: "remarks", label: "Remarks", section: "Remarks", type: "textarea", colSpan: 2 },

      // Additional fields
      { name: "manu_code", label: "Manufacturer Code", section: "Additional" },
      { name: "origin_country", label: "Origin Country", section: "Additional" },
      { name: "cost_rate", label: "Cost Rate Unit", section: "Additional" },
      { name: "retail_rate", label: "Retail Price", section: "Additional" },
      { name: "sales_rate", label: "Sales Rate", section: "Additional" },
      { name: "reorder_qty", label: "Reorder Qty", section: "Additional" },
      { name: "alt_prod_code", label: "Alternate Product", section: "Additional" },

      // Tax Component fields
      { name: "tx_compt_1", label: "tax Component 1", section: "Tax Component" },
      { name: "tx_compt_2", label: "tax Component 2", section: "Tax Component" },
      { name: "tx_compt_3", label: "tax Component 3", section: "Tax Component" },
      { name: "tx_compt_4", label: "tax Component 4", section: "Tax Component" },
    ],
    [],
  );

  // ── Load ──────────────────────────────────────────────────────────────
  const customLoad = async () => {
    const response = await getDynamicLookup({
      parameter: "PURCHASE_SALES_MSE_PRODUCT_DATA_TABLE",
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

    const toStr = (v: unknown) => (v != null && v !== "" ? String(v) : undefined);
    const toNum = (v: unknown) => {
        if (v == null || v === "") return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    };

    await executeDynamicMutationColumn90({
        parameter: "purchase_sales_ins_upd_mse_product",
        loginid: typedUser.loginid,

        // keys
        val1s1: typedUser.company_code,                    // COMPANY_CODE
        val1s2: toStr(form.prod_code),                     // PROD_CODE

        // strings
        val1s3:  toStr(form.prod_name),                    // PROD_NAME
        val1s4:  toStr(form.model_number),                 // MODEL_NUMBER
        val1s5:  toStr(form.barcode ?? form.bar_code),     // BAR_CODE
        val1s6:  toStr(form.group_code),                   // GROUP_CODE
        val1s7:  toStr(form.brand_code),                   // BRAND_CODE
        val1s8:  toStr(form.category_code),                // CATEGORY_CODE
        val1s9:  toStr(form.prodtype_code),                // PRODTYPE_CODE
        val1s10: toStr(form.manu_code),                    // MANU_CODE
        val1s11: toStr(form.alt_prod_code),                // ALT_PROD_CODE
        val1s12: toStr(form.p_uom),                        // P_UOM
        val1s13: toStr(form.l_uom),                        // L_UOM
        val1s14: toStr(form.origin_country),               // ORIGIN_COUNTRY
        val1s15: toStr(form.co_packing ?? form.co_pack) ?? "N", // CO_PACK
        val1s16: toStr(form.product_stage),                // PRODUCT_STAGE
        val1s17: toStr(form.div_code),                     // DIV_CODE
        val1s18: toStr(form.size_code),                    // SIZE_CODE
        val1s19: toStr(form.color_code),                   // COLOR_CODE
        val1s20: toStr(form.season_code),                  // SEASON_CODE
        val1s21: toStr(form.remarks),                      // REMARKS
        val1s22: toStr(form.is_inventory) ?? "Y",          // IS_INVENTORY
        val1s23: toStr(form.Active ?? form.is_active) ?? "Y", // IS_ACTIVE
        val1s24: toStr(form.active_status) ?? "Y",         // ACTIVE_STATUS
        val1s25: toStr(form.supplier_code),                // SUPPLIER_CODE
        val1s26: toStr(form.prod_image_path),              // PROD_IMAGE_PATH
        val1s27: toStr(form.tx_compt_1) ?? "N",            // TX_COMPNT_1_EXPMT
        val1s28: toStr(form.tx_compt_2) ?? "N",            // TX_COMPNT_2_EXPMT
        val1s29: toStr(form.tx_compt_3) ?? "N",            // TX_COMPNT_3_EXPMT
        val1s30: toStr(form.tx_compt_4) ?? "N",            // TX_COMPNT_4_EXPMT

        // numbers
        val1n1:  toNum(form.uom_count),                    // UOM_COUNT
        val1n2:  toNum(form.uppp),                         // UPPP
        val1n3:  toNum(form.length),                       // LENGTH
        val1n4:  toNum(form.breadth),                      // BREADTH
        val1n5:  toNum(form.height),                       // HEIGHT
        val1n6:  toNum(form.volume),                       // VOLUME
        val1n7:  toNum(form.gross_wt),                     // GROSS_WT
        val1n8:  toNum(form.net_wt),                       // NET_WT
        val1n9:  toNum(form.cost_rate),                    // COST_RATE
        val1n10: toNum(form.sales_rate),                   // SALES_RATE
    });
    };

  // ── Delete ────────────────────────────────────────────────────────────
  const customDelete = async (row: Record<string, unknown>, userArg: unknown) => {
    const typedUser = userArg as { loginid: string; company_code: string };

    await executeDynamicDelete({
      parameter: "PURCHASE_SALES_DEL_MSE_PRODUCT",
      loginid: typedUser.loginid,
      code1: typedUser.company_code,
      code2: String(row.prod_code),
    });
  };

  return (
    <MasterPage
      config={{
        title: "Product",
        subtitle: "Manage Product",
        master: "product",
        keyFields: ["prod_code"],
        rowIdSeparator: "_",
        fields,
        fieldsPerRow: 4,
        sectionsPerRow: 2,
        wide: true,
        customLoad,
        customSave,
        customDelete,
      }}
    />
  );
};

export default ProductPurchaseSales;