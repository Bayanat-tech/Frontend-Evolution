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
      SELECT *
      FROM VW_VMS_FLOW_HDR
      WHERE LAST_ACTION = 'SUBMITTED'
        AND AC_CODE = '${user}'
      ORDER BY DOC_NO DESC
    `;
  }
  if (action === "REJECTED") {
    return `
      SELECT *
      FROM VW_VMS_FLOW_HDR_REJECTED
      WHERE FUN_VMS_CHECK_VENDOR_DOC_NO('${user}', DOC_NO) = 'YES'
      ORDER BY DOC_NO DESC
    `;
  }
  if (action === "CLOSED") {
    return `
      SELECT *
      FROM VW_VMS_FLOW_HDR_CLOSED
      WHERE FINAL_APPROVED = 'YES'
        AND FUN_VMS_CHECK_VENDOR_DOC_NO('${user}', DOC_NO) = 'YES'
      ORDER BY DOC_NO DESC
    `;
  }
  // return `
  //   SELECT DOC_NO, AC_CODE, DOC_DATE, REF_DOC_NO, INVOICE_NUMBER, INVOICE_DATE, REMARKS, LAST_ACTION
  //   FROM VMS_FLOW_HDR
  //   WHERE COMPANY_CODE = '${company}'
  //     AND AC_CODE = '${user}'
  //   ORDER BY DOC_NO DESC
  // `;
  return `
  SELECT H.DOC_NO, H.AC_CODE,
    TO_CHAR(H.DOC_DATE,'DD-MM-YYYY') AS DOC_DATE,
    H.REF_DOC_NO, H.INVOICE_NUMBER,
    TO_CHAR(H.INVOICE_DATE,'DD-MM-YYYY') AS INVOICE_DATE,
    H.REMARKS, H.LAST_ACTION, H.FLOW_LEVEL, H.FINAL_APPROVED, H.NEXT_ACTION_BY,
    H.SENDBACK_HISTORY, H.REJECT_HISTORY,
    (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT,
    (SELECT MAX(A.ERP_DOC_NO) FROM VW_TMP_VM_TR_AC_HEADER_AWARE A WHERE A.COMPANY_CODE = H.COMPANY_CODE AND A.DOC_NO = H.DOC_NO) AS ERP_DOC_NO
  FROM VMS_FLOW_HDR H
  WHERE H.COMPANY_CODE = '${company}'
    AND H.AC_CODE = '${user}'
  ORDER BY H.DOC_NO DESC
`;
}

export function vendorApprovalSql(companyCode: string, loginid: string, actions: string[], approverLoginid = loginid) {
  const user = escapeSql(loginid);
  const approver = escapeSql(approverLoginid || loginid);
  const companyFilter = companyCode ? `AND H.COMPANY_CODE = '${escapeSql(companyCode)}'` : "";
  const first = actions[0]?.toUpperCase() || "PENDING";
  const myLevel = `(CASE WHEN '${approver}' IN (SELECT EMP_ID_LEVEL1 FROM MS_VENDOR_APPROVER) THEN 1
  WHEN '${approver}' IN (SELECT EMP_ID_LEVEL2 FROM MS_VENDOR_APPROVER) THEN 2
  WHEN '${approver}' IN (SELECT EMP_ID_LEVEL3 FROM MS_VENDOR_APPROVER) THEN 3 ELSE 0 END)`;
  
  if (first === "PENDING" || first === "SUBMITTED") {
    const approverSearch = sqlSearchValue(approver);

    if (approver === "00495") {
      return `
        SELECT V.*
        FROM VW_VMS_FLOW_HDR_FINAL_APPROVER V
        WHERE V.LAST_ACTION = 'APPROVED'
          AND '${approver}' IN (
            SELECT EMP_ID_LEVEL3
            FROM MS_VENDOR_APPROVER
          )
        ORDER BY V.DOC_NO DESC
      `;
    }

    return `
      SELECT H.*,
        (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
      FROM VW_VMS_FLOW_HDR H
      CROSS JOIN VW_VENDOR_APPROVER_STRING V
      WHERE H.LAST_ACTION NOT IN ('REJECTED')
        AND (
          (H.FLOW_LEVEL = 1 AND INSTR(V.LEVEL1_STRING, ${approverSearch}) > 0)
          OR (H.FLOW_LEVEL = 2 AND INSTR(V.LEVEL2_STRING, ${approverSearch}) > 0)
        )
      ORDER BY H.DOC_NO DESC
    `;
  }

  if (first === "SENTBACK") {  
    return `
      SELECT h.*,
  (SELECT AMOUNT 
     FROM VW_VENDOR_AMOUNT k
     WHERE k.COMPANY_CODE = h.COMPANY_CODE
       AND k.DOC_NO = h.DOC_NO) AS AMOUNT
FROM VW_TR_AC_LPO_HEADER_SENTBACK h
WHERE FUN_CHECK_VENDOR_DOC_NO('${user}', h.DOC_NO) = 'YES'
ORDER BY h.DOC_NO DESC
    `;
  }

  if (first === "IN_PROGRESS" || first === "INPROGRESS") {
    return `
      SELECT H.*,
        (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
      FROM VW_VMS_FLOW_HDR H
      WHERE H.FINAL_APPROVED = 'NO'
       AND H.LAST_ACTION NOT IN ('REJECTED', 'SENTBACK')
        ${companyFilter}
        AND (
          ('${approver}' IN (SELECT EMP_ID_LEVEL1 FROM MS_VENDOR_APPROVER) AND H.FLOW_LEVEL <> 1)
          OR ('${approver}' IN (SELECT EMP_ID_LEVEL2 FROM MS_VENDOR_APPROVER) AND H.FLOW_LEVEL <> 1)
        )
      ORDER BY H.DOC_NO DESC
    `;
  }
  if (first === "REJECTED") {
    return `
      SELECT H.*,
        (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
      FROM VW_VMS_FLOW_HDR_REJECTED H
      WHERE FUN_VMS_CHECK_VENDOR_DOC_NO('${user}', H.DOC_NO) = 'YES'
      ORDER BY H.DOC_NO DESC
    `;
  }

  if (first === "APPROVED" || first === "CLOSED") {
    return `
      SELECT H.*,
        (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
      FROM VW_VMS_FLOW_HDR_CLOSED H
      WHERE H.FINAL_APPROVED = 'YES' AND H.NEXT_ACTION_BY ='APPROVED'
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
  const userFilter = loginid
    ? `AND FUN_VMS_CHECK_VENDOR_DOC_NO('${escapeSql(loginid)}', H.DOC_NO) = 'YES'`
    : "";

  return `
    SELECT H.*,
      (SELECT AMOUNT FROM VW_VENDOR_AMOUNT K WHERE K.COMPANY_CODE = H.COMPANY_CODE AND K.DOC_NO = H.DOC_NO) AS AMOUNT
    FROM VW_VMS_FLOW_HDR_CLOSED H
    WHERE H.FINAL_APPROVED = 'YES'
      ${userFilter}
    ORDER BY H.DOC_NO DESC
  `;
}

function escapeSql(value: string) {
  return String(value || "").replace(/'/g, "''");
}

function sqlSearchValue(value: string) {
  return /^\d+$/.test(value) ? value : `'${escapeSql(value)}'`;
}
