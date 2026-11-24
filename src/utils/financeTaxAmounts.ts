/** PowerBuilder stores tax rounded to currency decimal precision. */
export function roundFinanceTax(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor;
}

export function financeTaxAmounts(line: {
  amount?: unknown;
  tx_compnt_perc_1?: unknown;
  tx_compnt_amt_1?: unknown;
}, exchangeRate: number, decimals: number = 2) {
  const calculated = Math.abs(Number(line.amount || 0)) * Number(line.tx_compnt_perc_1 || 0) / 100;
  const tax = roundFinanceTax(Number(line.tx_compnt_amt_1 ?? calculated), decimals);
  return { tx_compnt_amt_1: tax, tx_compnt_lcuramt_1: roundFinanceTax(tax * exchangeRate, decimals) };
}
