import { executeWmsInboundSql, getWmsInbound, getWmsMaster, postWmsOutbound } from "../../../api/wms";
import type { LookupRow } from "../../../api/lookups";
import { sqlEscape, normalizeLookupRows } from "./OutboundHelpers";

export async function loadOutboundCustomers(
  companyCode: string,
  prinCode: string
): Promise<LookupRow[]> {
  const rows = await executeWmsInboundSql(
    `SELECT * FROM MS_CUSTOMER
     WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
       AND PRIN_CODE    = '${sqlEscape(prinCode)}'`
  );
  return normalizeLookupRows(rows);
}

export async function loadCurrencies(): Promise<LookupRow[]> {
  const response = await getWmsMaster("currency", { page: 1, limit: 100000 });
  return normalizeLookupRows(response.tableData);
}

export async function loadWmsMasterLookup(master: string): Promise<LookupRow[]> {
  const heavyLookupLimits: Record<string, number> = {
    port: 500,
    principal: 1000,
  };
  const response = await getWmsMaster(master, {
    page: 1,
    limit: heavyLookupLimits[master] || 100000,
  });
  return normalizeLookupRows(response.tableData);
}

export async function loadOutboundPrincipalLookup(
  companyCode: string
): Promise<LookupRow[]> {
  const rows = await executeWmsInboundSql(`
    SELECT
      p.PRIN_CODE,
      p.PRIN_NAME,
      p.PRIN_DEPT_CODE,
      p.DIV_CODE,
      p.CURR_CODE,
      d.DEPT_NAME,
      v.DIV_NAME
    FROM MS_PRINCIPAL p
    LEFT JOIN MS_DEPARTMENT d
      ON d.COMPANY_CODE = p.COMPANY_CODE
     AND d.DEPT_CODE = p.PRIN_DEPT_CODE
     AND d.DIV_CODE = p.DIV_CODE
    LEFT JOIN MS_HR_DIVISION v
      ON v.COMPANY_CODE = p.COMPANY_CODE
     AND v.DIV_CODE = p.DIV_CODE
    WHERE p.COMPANY_CODE = '${sqlEscape(companyCode)}'
    ORDER BY p.PRIN_CODE
  `);
  return normalizeLookupRows(rows);
}

export async function loadDepartmentLookup(
  companyCode: string,
  divCode: string
): Promise<LookupRow[]> {
  const rows = await executeWmsInboundSql(`
    SELECT d.DEPT_CODE, d.DEPT_NAME, d.DIV_CODE, v.DIV_NAME
    FROM MS_DEPARTMENT d
    LEFT JOIN MS_HR_DIVISION v
      ON v.COMPANY_CODE = d.COMPANY_CODE
     AND v.DIV_CODE = d.DIV_CODE
    WHERE d.COMPANY_CODE = '${sqlEscape(companyCode)}'
      ${divCode ? `AND d.DIV_CODE = '${sqlEscape(divCode)}'` : ""}
    ORDER BY d.DEPT_CODE
  `);
  return normalizeLookupRows(rows);
}

export async function loadPortLookup(): Promise<LookupRow[]> {
  const response = await getWmsMaster("port", { page: 1, limit: 500 });
  return normalizeLookupRows(response.tableData);
}

export async function loadOrderEntryOptions(
  companyCode: string,
  prinCode: string,
  jobNo: string
): Promise<LookupRow[]> {
  const rows = await executeWmsInboundSql(
    `SELECT * FROM TO_ORDER
     WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
       AND PRIN_CODE = '${sqlEscape(prinCode)}'
       AND JOB_NO = '${sqlEscape(jobNo)}'
     ORDER BY ORDER_NO`
  );
  return normalizeLookupRows(rows);
}

export async function loadOutboundProducts(
  companyCode: string,
  prinCode: string
): Promise<LookupRow[]> {
  const rows = await getWmsInbound<LookupRow[]>("getddPrinceProduct", {
    company_code: companyCode,
    prin_code: prinCode,
  });
  return normalizeLookupRows(rows);
}

export async function loadStockSites(
  companyCode: string,
  prinCode: string,
  prodCode: string
): Promise<LookupRow[]> {
  const rows = await executeWmsInboundSql(`
    SELECT DISTINCT TT_STKLED.SITE_CODE
    FROM TT_STKLED
    WHERE TT_STKLED.COMPANY_CODE = '${sqlEscape(companyCode)}'
      AND TT_STKLED.PRIN_CODE = '${sqlEscape(prinCode)}'
      AND TT_STKLED.PROD_CODE = '${sqlEscape(prodCode)}'
      AND NVL(TT_STKLED.FREEZE_FLAG,'N') = 'N'
      AND TT_STKLED.QTY_AVL > 0
      AND SITE_CODE IN (
        SELECT SITE_CODE FROM MS_SITE
        WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' AND PICKING_OUT = 'Y'
      )
    ORDER BY TT_STKLED.SITE_CODE
  `);
  return normalizeLookupRows(rows);
}

export async function loadStockLocations(
  companyCode: string,
  prinCode: string,
  prodCode: string,
  siteCode: string
): Promise<LookupRow[]> {
  const rows = await executeWmsInboundSql(`
    SELECT DISTINCT TT_STKLED.LOCATION_CODE
    FROM TT_STKLED
    WHERE TT_STKLED.COMPANY_CODE = '${sqlEscape(companyCode)}'
      AND TT_STKLED.PRIN_CODE = '${sqlEscape(prinCode)}'
      AND TT_STKLED.PROD_CODE = '${sqlEscape(prodCode)}'
      AND NVL(TT_STKLED.FREEZE_FLAG,'N') = 'N'
      AND NVL(TT_STKLED.SITE_CODE,'') = '${sqlEscape(siteCode)}'
      AND TT_STKLED.QTY_AVL > 0
    ORDER BY TT_STKLED.LOCATION_CODE
  `);
  return normalizeLookupRows(rows);
}

export async function loadStockBatches(
  companyCode: string,
  prodCode: string,
  siteCode: string
): Promise<LookupRow[]> {
  const rows = await executeWmsInboundSql(`
    SELECT DISTINCT BATCH_NO
    FROM TT_STKLED
    WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
      AND PROD_CODE = '${sqlEscape(prodCode)}'
      AND SITE_CODE = '${sqlEscape(siteCode)}'
      AND QTY_AVL > 0
      AND BATCH_NO IS NOT NULL
    ORDER BY BATCH_NO
  `);
  return normalizeLookupRows(rows);
}

export async function loadStockLots(
  companyCode: string,
  prodCode: string,
  siteCode: string
): Promise<LookupRow[]> {
  const rows = await executeWmsInboundSql(`
    SELECT DISTINCT LOT_NO
    FROM TT_STKLED
    WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
      AND PROD_CODE = '${sqlEscape(prodCode)}'
      AND SITE_CODE = '${sqlEscape(siteCode)}'
      AND LOT_NO IS NOT NULL
    ORDER BY LOT_NO
  `);
  return normalizeLookupRows(rows);
}

export async function loadOutboundAvailableQuantity({
  companyCode,
  prinCode,
  prodCode,
  siteCode,
  locationFrom,
  locationTo,
  batchNo,
  lotNo,
  productionFrom,
  productionTo,
  expiryFrom,
  expiryTo,
}: {
  companyCode: string;
  prinCode: string;
  prodCode: string;
  siteCode: string;
  locationFrom: string;
  locationTo: string;
  batchNo: string;
  lotNo: string;
  productionFrom: string;
  productionTo: string;
  expiryFrom: string;
  expiryTo: string;
}): Promise<number> {
  const response = (await postWmsOutbound("getTotalAvailableQty", {
    company_code: companyCode,
    prin_code: prinCode,
    prod_code: prodCode,
    site_code: siteCode,
    location_from: locationFrom,
    location_to: locationTo,
    batch: batchNo,
    lot_no: lotNo,
    mfg_date_from: productionFrom,
    mfg_date_to: productionTo,
    exp_date_from: expiryFrom,
    exp_date_to: expiryTo,
  })) as unknown as {
    TOT_AVL_QTY?: number | string;
    data?: { TOT_AVL_QTY?: number | string };
  };

  return Number(response.TOT_AVL_QTY ?? response.data?.TOT_AVL_QTY ?? 0);
}