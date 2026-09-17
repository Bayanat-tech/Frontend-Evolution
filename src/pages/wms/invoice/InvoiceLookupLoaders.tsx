// utils/invoiceLookupLoaders.ts
//
// Same pattern as utils/lookupLoaders.ts (loadInboundPrincipalLookup etc.):
// every dropdown that needs real data goes through executeWmsInboundSqlCached,
// which POSTs { raw_sql } to /api/wms/inbound/executeRawSql and caches
// identical queries for 5 minutes (see executeWmsInboundSqlCached in your
// wms api service file).
//
// ⚠️ PLACEHOLDER SCHEMA — I don't have your real table/column names.
// MS_PRINCIPAL / MS_CODES / MS_CURRENCY below are guesses that follow your
// existing naming convention (MS_ = master table). Replace with whatever
// your Oracle schema actually calls these before wiring this up for real.

import { executeWmsInboundSqlCached, executeWmsInboundSql } from "../../../api/wms"; // adjust to wherever this actually lives
import type { LookupRow } from "../../../api/lookups";

/** Escape single quotes so a value dropped into a raw SQL literal doesn't break the query. */
const esc = (v: string) => v.replace(/'/g, "''");

/**
 * Principal dropdown for the invoice form — code, name, and default currency
 * so selecting a principal can auto-fill the currency field, same cascading
 * idea as the inbound Principal → Department/Division cascade.
 */
export function loadInvoicePrincipalLookup(companyCode: string): Promise<LookupRow[]> {
  return executeWmsInboundSqlCached(`
    SELECT PRIN_CODE, PRIN_NAME, CURR_CODE
    FROM   MS_PRINCIPAL
    WHERE  COMPANY_CODE = '${esc(companyCode)}'
    ORDER  BY PRIN_NAME
  `);
}

/** Invoice status options (Draft / Confirmed / Cancelled, etc.) from a shared codes table. */
export function loadInvoiceStatusLookup(companyCode: string): Promise<LookupRow[]> {
  return executeWmsInboundSqlCached(`
    SELECT CODE_VALUE AS INV_STATUS, CODE_DESC AS INV_STATUS_DESC
    FROM   MS_CODES
    WHERE  COMPANY_CODE = '${esc(companyCode)}'
    AND    CODE_TYPE = 'INV_STATUS'
    ORDER  BY SEQ_NO
  `);
}

/** Despatched Yes/No — modeled as a codes lookup too, for consistency with the rest of the form. */
export function loadInvoiceDespatchedLookup(companyCode: string): Promise<LookupRow[]> {
  return executeWmsInboundSqlCached(`
    SELECT CODE_VALUE AS DESPATCHED, CODE_DESC AS DESPATCHED_DESC
    FROM   MS_CODES
    WHERE  COMPANY_CODE = '${esc(companyCode)}'
    AND    CODE_TYPE = 'YES_NO'
    ORDER  BY SEQ_NO
  `);
}

/** Currency master — used if the user wants to browse/override the auto-filled currency. */
export function loadInvoiceCurrencyLookup(): Promise<LookupRow[]> {
  return executeWmsInboundSqlCached(`
    SELECT CURR_CODE, CURR_NAME, EX_RATE
    FROM   MS_CURRENCY
    ORDER  BY CURR_CODE
  `);
}

// ─── Job / storage grid data (auto-populated on principal selection) ──────
//
// These back the "Job details" / "Storage details" grids directly — no
// selection modal, no manual "+ Select" step. Picking a principal on the
// invoice form fires these, filtered to that principal's un-invoiced
// activity/storage records. Uncached (executeWmsInboundSql, not the
// *Cached variant) since this is transactional data, not master data —
// caching it would risk showing stale/already-invoiced rows.
//
// ⚠️ MS_ACTIVITY_BILLING / MS_STORAGE_BILLING and their columns are
// placeholders — point these at whatever your real billing tables are
// (this is likely close to whatever backs your existing JobSelectionModal /
// StorageSelectionModal queries).

export function loadInvoiceJobRows(companyCode: string, prinCode: string): Promise<LookupRow[]> {
  if (!companyCode || !prinCode) return Promise.resolve([]);
  return executeWmsInboundSql(`
    SELECT JOB_NO, ACTIVITY_CODE AS ACTIVITY, QTY, COST_RATE, COST_AMT, BILL_RATE, BILL_AMT, OTHER_AMT AS OTHER
    FROM   MS_ACTIVITY_BILLING
    WHERE  COMPANY_CODE = '${esc(companyCode)}'
    AND    PRIN_CODE = '${esc(prinCode)}'
    ORDER  BY JOB_NO
  `);
}

export function loadInvoiceStorageRows(companyCode: string, prinCode: string): Promise<LookupRow[]> {
  if (!companyCode || !prinCode) return Promise.resolve([]);
  return executeWmsInboundSql(`
    SELECT STORAGE_REF AS RECORD, QTY, AMOUNT
    FROM   MS_STORAGE_BILLING
    WHERE  COMPANY_CODE = '${esc(companyCode)}'
    AND    PRIN_CODE = '${esc(prinCode)}'
    ORDER  BY STORAGE_REF
  `);
}