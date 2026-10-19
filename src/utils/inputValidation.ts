export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Validates whether an email string has a valid email address format.
 * Returns true if empty (not required check).
 */
export function isValidEmail(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  const str = String(value).trim();
  if (!str) return true;
  return EMAIL_REGEX.test(str);
}

/**
 * Validates phone / mobile / fax / contact numbers.
 * Strictly disallows letters/alphabetic characters and ensures it contains numbers.
 * Allows digits, optional leading +, hyphens, spaces, and parentheses.
 */
export function isValidPhoneNumber(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  const str = String(value).trim();
  if (!str) return true;
  if (/[a-zA-Z]/.test(str)) return false;
  return /^[\d+\-\s()]{3,30}$/.test(str);
}

/**
 * Strips any characters that are not digits or standard telephone symbols (+, -, space, parentheses).
 * Guarantees that alphabetic characters are rejected as the user types.
 */
export function sanitizePhoneNumber(value: string): string {
  return value.replace(/[^0-9+\-\s()]/g, "");
}

