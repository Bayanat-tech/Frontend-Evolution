type JournalLine = {
  ac_code?: string;
  amount?: number;
  sign_ind?: number;
  serial_no?: number;
};

export function getJournalLineError(lines: JournalLine[]): string | null {
  const invalidSide = lines.find((line) => Number(line.amount) > 0 && ![1, -1].includes(Number(line.sign_ind)));
  if (invalidSide) {
    return `Line #${invalidSide.serial_no || 1}: choose either Debit (Dr) or Credit (Cr). A line cannot contain both.`;
  }
  const completeLines = lines.filter((line) => line.ac_code?.trim() && Number.isFinite(Number(line.amount)) && Number(line.amount) > 0);
  if (completeLines.length < 2) {
    return "Journal Voucher requires at least two ledger lines with an account and a positive amount. Enter Debit and Credit on separate lines.";
  }
  return null;
}
