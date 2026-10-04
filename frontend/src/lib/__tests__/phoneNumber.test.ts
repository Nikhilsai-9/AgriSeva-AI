import { describe, it, expect } from "vitest";
import {
  normalizePhoneNumber,
  isValidPhoneNumber,
  formatPhoneNumber,
  maskPhoneNumber,
  getWhatsAppLink,
  getTelLink,
} from "../phoneNumber";

describe("Canonical Phone Number Utilities", () => {
  describe("normalizePhoneNumber", () => {
    it("normalizes a 10-digit Indian mobile number to E.164", () => {
      expect(normalizePhoneNumber("9876543210")).toBe("+919876543210");
      expect(normalizePhoneNumber(" 98765 43210 ")).toBe("+919876543210");
      expect(normalizePhoneNumber("9876-543-210")).toBe("+919876543210");
    });

    it("handles 11-digit leading 0 numbers", () => {
      expect(normalizePhoneNumber("09876543210")).toBe("+919876543210");
    });

    it("handles 12-digit Indian numbers starting with 91", () => {
      expect(normalizePhoneNumber("919876543210")).toBe("+919876543210");
    });

    it("preserves already normalized E.164 numbers", () => {
      expect(normalizePhoneNumber("+919876543210")).toBe("+919876543210");
      expect(normalizePhoneNumber("+14155552671")).toBe("+14155552671");
    });

    it("returns empty string on empty/null input", () => {
      expect(normalizePhoneNumber("")).toBe("");
      expect(normalizePhoneNumber(null)).toBe("");
      expect(normalizePhoneNumber(undefined)).toBe("");
    });
  });

  describe("isValidPhoneNumber", () => {
    it("validates 10-digit Indian mobile numbers starting with 6-9", () => {
      expect(isValidPhoneNumber("9876543210")).toBe(true);
      expect(isValidPhoneNumber("8123456789")).toBe(true);
      expect(isValidPhoneNumber("7000011111")).toBe(true);
      expect(isValidPhoneNumber("6222233333")).toBe(true);
    });

    it("rejects invalid starting digits for Indian mobile numbers", () => {
      expect(isValidPhoneNumber("1234567890")).toBe(false);
      expect(isValidPhoneNumber("2345678901")).toBe(false);
      expect(isValidPhoneNumber("5555555555")).toBe(false);
    });

    it("rejects too short or too long numbers", () => {
      expect(isValidPhoneNumber("98765")).toBe(false);
      expect(isValidPhoneNumber("9876543210123456")).toBe(false);
      expect(isValidPhoneNumber("")).toBe(false);
    });
  });

  describe("formatPhoneNumber", () => {
    it("formats Indian numbers nicely for human UI", () => {
      expect(formatPhoneNumber("9876543210")).toBe("+91 98765 43210");
      expect(formatPhoneNumber("+919876543210")).toBe("+91 98765 43210");
    });
  });

  describe("maskPhoneNumber", () => {
    it("masks sensitive digits for privacy", () => {
      expect(maskPhoneNumber("9876543210")).toBe("+91 987•••210");
      expect(maskPhoneNumber("+919876543210")).toBe("+91 987•••210");
    });
  });

  describe("getWhatsAppLink & getTelLink", () => {
    it("generates correct wa.me link with encoded message", () => {
      const link = getWhatsAppLink("9876543210", "Hello AgriSeva");
      expect(link).toBe("https://wa.me/919876543210?text=Hello%20AgriSeva");
    });

    it("generates correct tel: URI", () => {
      expect(getTelLink("9876543210")).toBe("tel:+919876543210");
    });
  });

  describe("Official AgriSeva-AI Contact Number (+91 91824 17061)", () => {
    const rawNumber = "+91 91824 17061";
    const normalizedNumber = "+919182417061";

    it("normalizes to E.164 without spaces", () => {
      expect(normalizePhoneNumber(rawNumber)).toBe(normalizedNumber);
      expect(normalizePhoneNumber("9182417061")).toBe(normalizedNumber);
    });

    it("validates as a valid Indian mobile number", () => {
      expect(isValidPhoneNumber(rawNumber)).toBe(true);
      expect(isValidPhoneNumber(normalizedNumber)).toBe(true);
    });

    it("formats cleanly for user display", () => {
      expect(formatPhoneNumber(normalizedNumber)).toBe("+91 91824 17061");
    });

    it("generates clean WhatsApp deep link without spaces or + signs", () => {
      expect(getWhatsAppLink(rawNumber)).toBe("https://wa.me/919182417061");
      expect(getWhatsAppLink(normalizedNumber, "Namaste AgriSeva")).toBe("https://wa.me/919182417061?text=Namaste%20AgriSeva");
    });

    it("generates standard tel: URI", () => {
      expect(getTelLink(rawNumber)).toBe("tel:+919182417061");
    });
  });
});

