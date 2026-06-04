import { executeWmsInboundSql } from "../api/wms";
import { sqlEscape, normalizeRow } from "../utils/inboundHelpers";

export async function loadInboundPrincipalLookup(companyCode: string) {
  const data = await executeWmsInboundSql(`
    SELECT p.PRIN_CODE, p.PRIN_NAME, p.PRIN_DEPT_CODE, p.DIV_CODE,
           d.DEPT_NAME, v.DIV_NAME
    FROM MS_PRINCIPAL p
    LEFT JOIN MS_DEPARTMENT d
      ON d.COMPANY_CODE = p.COMPANY_CODE
     AND d.DEPT_CODE    = p.PRIN_DEPT_CODE
     AND d.DIV_CODE     = p.DIV_CODE
    LEFT JOIN MS_HR_DIVISION v
      ON v.COMPANY_CODE = p.COMPANY_CODE
     AND v.DIV_CODE     = p.DIV_CODE
    WHERE p.COMPANY_CODE = '${sqlEscape(companyCode)}'
    ORDER BY p.PRIN_CODE
  `);
  return data.map(normalizeRow);
}

export async function loadInboundDepartmentLookup(companyCode: string, divCode = "") {
  const data = await executeWmsInboundSql(`
    SELECT d.DEPT_CODE, d.DEPT_NAME, d.DIV_CODE, v.DIV_NAME
    FROM MS_DEPARTMENT d
    LEFT JOIN MS_HR_DIVISION v
      ON v.COMPANY_CODE = d.COMPANY_CODE
     AND v.DIV_CODE     = d.DIV_CODE
    WHERE d.COMPANY_CODE = '${sqlEscape(companyCode)}'
    ${divCode ? `AND d.DIV_CODE = '${sqlEscape(divCode)}'` : ""}
    ORDER BY d.DEPT_CODE
  `);
  return data.map(normalizeRow);
}

export async function loadInboundDivisionLookup(companyCode: string) {
  const data = await executeWmsInboundSql(`
    SELECT DIV_CODE, DIV_NAME FROM MS_HR_DIVISION
    WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
    ORDER BY DIV_CODE
  `);
  return data.map(normalizeRow);
}

export async function loadInboundCountryLookup() {
  const data = await executeWmsInboundSql(
    `SELECT COUNTRY_CODE, COUNTRY_NAME FROM MS_COUNTRY ORDER BY COUNTRY_NAME`,
  );
  return data.map(normalizeRow);
}

export async function loadInboundPortLookup(countryCode = "") {
  const data = await executeWmsInboundSql(`
    SELECT PORT_CODE, PORT_NAME, COUNTRY_CODE FROM MS_PORT
    ${countryCode ? `WHERE COUNTRY_CODE = '${sqlEscape(countryCode)}'` : ""}
    ORDER BY PORT_NAME
  `);
  return data.map(normalizeRow);
}