// export type THrEmpComponentPayload = {
//   employee_id: string;
//   pay_comp_id: string;
//   pay_comp_amt?: number | null;
//   pay_comp_perc?: number | null;
//   pay_comp_amt_old?: number | null;
//   entered_on?: string | null;
//   entered_by?: string | null;
//   verified_on?: string | null;
//   verified_by?: string | null;
//   approved_on?: string | null;
//   approved_by?: string | null;
//   revised_on?: string | null;
//   revised_by?: string | null;
//   freezed_on?: string | null;
//   freezed_reason?: string | null;
//   freezed_till?: string | null;
//   remarks?: string | null;
//   status_flag?: string | null;
//   user_id?: string | null;
//   user_dt?: string | null;
//   company_code: string;
//   pay_comp_earn_ded?: string | null;
//   pay_roll_status?: string | null;
//   comp_status?: string | null;
//   arrears_amt?: number | null;
//   arrears_type?: string | null;
//   arrears_posted?: string | null;
//   ref_doc_type?: string | null;
//   ref_doc_no?: string | null;
//   pay_comp_amt_vac?: number | null;
//   vac_updated?: string | null;
//   source_from?: string | null;
//   source_updated?: string | null;
//   curr_code?: string | null;
//   doc_no?: string | null;
// };

// export type THrEmpComponentSaveResult = {
//   success: boolean;
//   message: string;
//   data?: {
//     company_code: string;
//     employee_id: string;
//     pay_comp_id: string;
//     curr_code: string;
//   };
//   details?: string;
// };

// /**
//  * POSTs a single HR_EMP_COMPONENTS row to PROC_INS_UPD_HR_EMP_COMPONENTS
//  * via POST /api/hr/employee/pay-components/upsert (employeHr.routes.ts,
//  * mounted under /api/hr/employee in hr.routes.ts). The proc only accepts
//  * one component per call, so bulk saves are done by calling this once per
//  * row (see upsertHrEmpComponentsApi below).
//  */
// export async function insUpdHrEmpComponentApi(
//   component: THrEmpComponentPayload,
// ): Promise<THrEmpComponentSaveResult> {
//   const response = await fetch("/api/hr/employee/pay-components/upsert", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     credentials: "include",
//     body: JSON.stringify({ component }),
//   });

//   // Read as text first — an empty or non-JSON body (404 page, empty 204,
//   // proxy error page, etc.) would otherwise throw an opaque "Unexpected
//   // end of JSON input" that hides the real HTTP status.
//   const rawText = await response.text();

//   if (!rawText) {
//     throw new Error(
//       `Empty response from ${response.url} (HTTP ${response.status} ${response.statusText}). ` +
//         `The route likely doesn't match the backend's actual mount path — check the Express router.`,
//     );
//   }

//   let result: THrEmpComponentSaveResult;
//   try {
//     result = JSON.parse(rawText) as THrEmpComponentSaveResult;
//   } catch {
//     throw new Error(
//       `Non-JSON response from ${response.url} (HTTP ${response.status}): ${rawText.slice(0, 200)}`,
//     );
//   }

//   if (!response.ok || !result.success) {
//     throw new Error(result.details || result.message || "Unable to save pay component");
//   }

//   return result;
// }

// /**
//  * Bulk-style helper: saves multiple HR_EMP_COMPONENTS rows by issuing one
//  * insUpdHrEmpComponentApi call per row (the backend proc is single-row).
//  * Returns per-row results in the same order as the input array; rejected
//  * rows carry an `error` string instead of throwing, so one bad row doesn't
//  * abort the rest.
//  */
// export async function upsertHrEmpComponentsApi(
//   components: THrEmpComponentPayload[],
// ): Promise<Array<THrEmpComponentSaveResult | { success: false; error: string }>> {
//   return Promise.all(
//     components.map((component) =>
//       insUpdHrEmpComponentApi(component).catch((error: unknown) => ({
//         success: false as const,
//         error: error instanceof Error ? error.message : "Unable to save pay component",
//       })),
//     ),
//   );
// }