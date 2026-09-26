/**
 * Canonical Phone Number Utilities for AgriSeva-AI Backend
 *
 * Provides unified normalization, validation, and formatting for phone numbers.
 * Stores phone numbers in canonical E.164 format (+919876543210).
 */

export function normalizePhoneNumber(
  input: string | undefined | null,
  defaultCountryCode = '+91',
): string {
  if (!input) return '';

  // Remove all whitespace, dashes, parentheses, dots
  const cleaned = input.replace(/[\s\-().]/g, '').trim();
  if (!cleaned) return '';

  // If already starts with '+', ensure only valid digits
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.slice(1).replace(/\D/g, '');
  }

  // Remove non-digits
  const digits = cleaned.replace(/\D/g, '');

  // 10-digit number without country code
  if (digits.length === 10) {
    const cc = defaultCountryCode.startsWith('+')
      ? defaultCountryCode
      : `+${defaultCountryCode}`;
    return `${cc}${digits}`;
  }

  // 12-digit Indian number starting with 91
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  // 11-digit number starting with 0 (Indian landline/STD format)
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }

  // Fallback E.164
  return `+${digits}`;
}

export function isValidPhoneNumber(input: string | undefined | null): boolean {
  if (!input) return false;
  const normalized = normalizePhoneNumber(input);
  const digits = normalized.replace(/\D/g, '');

  // Must have between 10 and 15 digits according to E.164 standard
  if (digits.length < 10 || digits.length > 15) return false;

  // For Indian numbers (+91), national part must be 10 digits starting with 6-9
  if (normalized.startsWith('+91')) {
    const national = normalized.slice(3);
    return national.length === 10 && /^[6-9]\d{9}$/.test(national);
  }

  return true;
}

export function formatPhoneNumber(input: string | undefined | null): string {
  if (!input) return '';
  const normalized = normalizePhoneNumber(input);

  if (normalized.startsWith('+91') && normalized.length === 13) {
    const national = normalized.slice(3);
    return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
  }

  return normalized;
}
