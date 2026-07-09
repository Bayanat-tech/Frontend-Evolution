export function vendorRequestSql(companyCode: string, loginid: string, action: string) {
  const company = escapeSql(companyCode);
  const user = escapeSql(loginid);
  if (action === "DRAFT") {
    return `
      SELECT DOC_NO,AC_CODE, DOC_DATE, REF_DOC_NO, INVOICE_NUMBER, INVOICE_DATE, REMARKS, LAST_ACTION, SENDBACK_HISTORY
      FROM VMS_FLOW_HDR
      WHERE (LAST_ACTION = 'SAVEASDRAFT' OR LAST_ACTION = 'SENTBACK')
        AND FLOW_LEVEL = 0
        AND AC_CODE = '${user}'
        AND COMPANY_CODE = '${company}'
      ORDER BY DOC_NO DESC
    `;
  }
  if (action === "SUBMITTED") {
    return `
      SELECT DOC_NO, AC_CODE,DOC_DATE, REF_DOC_NO, INVOICE_NUMBER, INVOICE_DATE, REMARKS, LAST_ACTION
      FROM VW_VMS_FLOW_HDR
      WHERE LAST_ACTION = 'SUBMITTED'
        AND AC_CODE = '${user}'
        AND COMPANY_CODE = '${company}'
      ORDER BY DOC_NO DESC
    `;
  }
  if (action === "REJECTED") {
    return `
      SELECT DOC_NO, AC_CODE, DOC_DATE, REF_DOC_NO, INVOICE_NUMBER, INVOICE_DATE, REMARKS, LAST_ACTION, REJECT_HISTORY
      FROM VW_VMS_FLOW_HDR_REJECTED
      WHERE COMPANY_CODE = '${company}'
        AND AC_CODE = '${user}'
      ORDER BY DOC_NO DESC
    `;
  }
  if (action === "CLOSED") {
    return `
      SELECT DOC_NO, AC_CODE, DOC_DATE, REF_DOC_NO, INVOICE_NUMBER, INVOICE_DATE, REMARKS, ERP_DOC_NO, LAST_ACTION
      FROM VW_VMS_FLOW_HDR_CLOSED
      WHERE COMPANY_CODE = '${company}'
        AND FINAL_APPROVED = 'YES'
        AND AC_CODE = '${user}'
      ORDER BY DOC_NO DESC
    `;
  }
  return `
    SELECT DOC_NO, AC_CODE, DOC_DATE, REF_DOC_NO, INVOICE_NUMBER, INVOICE_DATE, REMARKS, LAST_ACTION
    FROM VMS_FLOW_HDR
    WHERE COMPANY_CODE = '${company}'
      AND AC_CODE = '${user}'
    ORDER BY DOC_NO DESC
  `;
}

export function vendorApprovalSql(companyCode: string, loginid: string, actions: string[]) {
  const user = escapeSql(loginid);
  const companyFilter = companyCode ? `AND H.COMPANY_CODE = '${escapeSql(companyCode)}'` : "";
  const first = actions[0]?.toUpperCase() || "PENDING";
  if (first === "PENDING" || first === "SUBMITTED") {
    return `
      SELECT H.*
       FROM VW_VMS_FLOW_HDR h
       WHERE FINAL_APPROVED = 'NO'
       AND LAST_ACTION != 'REJECTED'
       AND (
       ('${user}' IN (SELECT EMP_ID_LEVEL1 FROM MS_VENDOR_APPROVER) AND h.FLOW_LEVEL <> 1)
         OR ('${user}' IN (SELECT EMP_ID_LEVEL2 FROM MS_VENDOR_APPROVER) AND h.FLOW_LEVEL <> 1)
      )
     ORDER BY H.DOC_NO DESC
    `;
    // return `
    //   SELECT H.*,
    //     (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
    //   FROM VW_VMS_FLOW_HDR H
    //   CROSS JOIN VW_VENDOR_APPROVER_STRING V
    //   WHERE H.LAST_ACTION NOT IN ('REJECTED')
    //     ${companyFilter}
    //     AND (
    //       (H.FLOW_LEVEL = 1 AND INSTR(V.LEVEL1_STRING, '${user}') > 0)
    //       OR (H.FLOW_LEVEL = 2 AND INSTR(V.LEVEL2_STRING, '${user}') > 0)
    //     )
    //   ORDER BY H.DOC_NO DESC
    // `;
  }
  if (first === "IN_PROGRESS" || first === "INPROGRESS") {
    return `
      SELECT H.*,
        (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
      FROM VW_VMS_FLOW_HDR H
      WHERE H.FINAL_APPROVED = 'NO'
        AND H.LAST_ACTION != 'REJECTED'
        ${companyFilter}
        AND (
          ('${user}' IN (SELECT EMP_ID_LEVEL1 FROM MS_VENDOR_APPROVER) AND H.FLOW_LEVEL <> 1)
          OR ('${user}' IN (SELECT EMP_ID_LEVEL2 FROM MS_VENDOR_APPROVER) AND H.FLOW_LEVEL <> 1)
        )
      ORDER BY H.DOC_NO DESC
    `;
  }
  if (first === "REJECTED") {
    return `
      SELECT H.*,
        (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
      FROM VW_VMS_FLOW_HDR_REJECTED H
      WHERE 1 = 1
        ${companyFilter}
      ORDER BY H.DOC_NO DESC
    `;
  }
  if (first === "APPROVED" || first === "CLOSED") {
    return `
      SELECT H.*,
        (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
      FROM VW_VMS_FLOW_HDR_CLOSED H
      WHERE H.FINAL_APPROVED = 'YES'
        ${companyFilter}
      ORDER BY H.DOC_NO DESC
    `;
  }
  return `
    SELECT H.*
    FROM VW_VMS_FLOW_HDR H
    WHERE H.COMPANY_CODE = '${escapeSql(companyCode)}'
    ORDER BY DOC_NO DESC
  `;
}

export function vendorAccountEntrySql(companyCode: string) {
  return `
    SELECT DOC_NO, DOC_DATE, REF_DOC_NO, INVOICE_NUMBER, INVOICE_DATE, REMARKS, ERP_DOC_NO, LAST_ACTION
    FROM VW_VMS_FLOW_HDR_CLOSED
    WHERE COMPANY_CODE = '${escapeSql(companyCode)}'
      AND FINAL_APPROVED = 'YES'
    ORDER BY DOC_NO DESC
  `;
}

export function vendorSentBackSql(companyCode: string, loginid = "") {
  return `
    SELECT H.*,
      (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
    FROM VW_VMS_FLOW_HDR_SENTBACK H
    WHERE COMPANY_CODE = '${escapeSql(companyCode)}'
      ${loginid ? `AND H.AC_CODE = '${escapeSql(loginid)}'` : ""}
    ORDER BY H.DOC_NO DESC
  `;
}

export function vendorClosedSql(companyCode: string, loginid = "") {
  return `
    SELECT H.*,
      (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
    FROM VW_VMS_FLOW_HDR_CLOSED H
    WHERE H.COMPANY_CODE = '${escapeSql(companyCode)}'
      AND H.FINAL_APPROVED = 'YES'
      ${loginid ? `AND H.AC_CODE = '${escapeSql(loginid)}'` : ""}
    ORDER BY H.DOC_NO DESC
  `;
}

function escapeSql(value: string) {
  return String(value || "").replace(/'/g, "''");
}
