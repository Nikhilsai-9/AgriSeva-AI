/**
 * Canonical Phone Number Utilities for AgriSeva-AI
 * 
 * Provides unified normalization, validation, formatting, masking,
 * and link generation across calling and WhatsApp pipelines.
 */

export interface ParsedPhoneNumber {
  raw: string;
  normalized: string; // E.164 format (+919876543210)
  digitsOnly: string; // 919876543210 or 9876543210
  countryCode: string; // +91
  nationalNumber: string; // 9876543210
  isValid: boolean;
  formatted: string; // +91 98765 43210
  masked: string; // +91 98765 •••10
}

/**
 * Normalizes any phone number input to standard E.164 format
 */
export function normalizePhoneNumber(
  input: string | undefined | null,
  defaultCountryCode = '+91'
): string {
  if (!input) return '';
  
  // Remove all whitespace, dashes, parentheses, dots
  let cleaned = input.replace(/[\s\-\(\)\.]/g, '').trim();
  if (!cleaned) return '';

  // If already starts with '+', ensure only valid chars
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.slice(1).replace(/\D/g, '');
  }

  // Remove non-digits
  const digits = cleaned.replace(/\D/g, '');

  // 10-digit number without country code
  if (digits.length === 10) {
    const cc = defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`;
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

/**
 * Validates whether a phone number is a well-formed mobile number
 */
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

/**
 * Formats a phone number for clean, human-readable display
 */
export function formatPhoneNumber(input: string | undefined | null): string {
  if (!input) return '';
  const normalized = normalizePhoneNumber(input);
  
  if (normalized.startsWith('+91') && normalized.length === 13) {
    const national = normalized.slice(3);
    return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
  }

  if (normalized.startsWith('+1') && normalized.length === 12) {
    const national = normalized.slice(2);
    return `+1 (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }

  return normalized;
}

/**
 * Masks the middle/sensitive digits of a phone number for privacy
 */
export function maskPhoneNumber(input: string | undefined | null): string {
  if (!input) return '';
  const normalized = normalizePhoneNumber(input);
  
  if (normalized.startsWith('+91') && normalized.length === 13) {
    const national = normalized.slice(3);
    return `+91 ${national.slice(0, 3)}•••${national.slice(7)}`;
  }

  if (normalized.length > 6) {
    const start = normalized.slice(0, 4);
    const end = normalized.slice(-2);
    return `${start}••••${end}`;
  }

  return normalized;
}

/**
 * Generates a direct WhatsApp link
 */
export function getWhatsAppLink(
  phoneNumber: string,
  message?: string
): string {
  const normalized = normalizePhoneNumber(phoneNumber);
  const digits = normalized.replace(/\D/g, '');
  
  let url = `https://wa.me/${digits}`;
  if (message) {
    url += `?text=${encodeURIComponent(message)}`;
  }
  return url;
}

/**
 * Generates a direct Tel URI link
 */
export function getTelLink(phoneNumber: string): string {
  const normalized = normalizePhoneNumber(phoneNumber);
  return `tel:${normalized}`;
}
