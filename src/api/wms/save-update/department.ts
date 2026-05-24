import { executeWmsInboundSql } from "../../wms";
import type { UserProfile } from "../../../types/auth";

export async function saveDepartment(
  values: Record<string, unknown>,
  context: { editMode: boolean; original: Record<string, unknown> | null; user: UserProfile | null }
): Promise<void> {
  const { user, editMode } = context;
  
  // Map lowercase form fields to uppercase database fields
  const deptCode = String(values.dept_code ?? "");
  const deptName = String(values.dept_name ?? "");
  const divCode = String(values.div_code ?? "");
  const companyCode = String(values.company_code ?? user?.company_code ?? user?.COMPANY_CODE ?? "");

  try {
    if (editMode) {
      /* ---------------- UPDATE ---------------- */
      const updateSql = `
        UPDATE MS_DEPARTMENT
        SET
          DEPT_NAME = '${deptName}',
          DIV_CODE  = '${divCode}',
          USER_ID   = '${user?.username || user?.USERNAME || "SYSTEM"}',
          USER_DT   = SYSDATE
        WHERE DEPT_CODE    = '${deptCode}'
          AND COMPANY_CODE = '${companyCode}'
      `;
      await executeWmsInboundSql(updateSql);
    } else {
      /* ---------------- INSERT ---------------- */
      const insertSql = `
        INSERT INTO MS_DEPARTMENT
        (
          DEPT_CODE,
          DEPT_NAME,
          DIV_CODE,
          COMPANY_CODE,
          USER_ID,
          USER_DT
        )
        VALUES
        (
          '${deptCode}',
          '${deptName}',
          '${divCode}',
          '${companyCode}',
          '${user?.username || user?.USERNAME || "SYSTEM"}',
          SYSDATE
        )
      `;
      await executeWmsInboundSql(insertSql);
    }
  } catch (error) {
    console.error("Error saving department:", error);
    throw error;
  }
}
