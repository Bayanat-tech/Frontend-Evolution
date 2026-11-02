/** PowerBuilder stores tax at four decimals and converts the rounded tax value. */
export function roundFinanceTax(value: number): number {
  return Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 10000) / 10000;
}

export function financeTaxAmounts(line: {
  amount?: unknown;
  tx_compnt_perc_1?: unknown;
  tx_compnt_amt_1?: unknown;
}, exchangeRate: number) {
  const calculated = Math.abs(Number(line.amount || 0)) * Number(line.tx_compnt_perc_1 || 0) / 100;
  const tax = roundFinanceTax(Number(line.tx_compnt_amt_1 ?? calculated));
  return { tx_compnt_amt_1: tax, tx_compnt_lcuramt_1: roundFinanceTax(tax * exchangeRate) };
}
