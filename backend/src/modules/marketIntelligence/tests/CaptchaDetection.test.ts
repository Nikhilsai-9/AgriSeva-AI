/**
 * Unit tests for the captcha-detection helpers in
 * `MarketNormaliser.ts`. PHASE 2 §P2.D.
 *
 * Why a separate file: the helpers are pure and need to lock
 * down every known captcha marker (Cloudflare "Just a moment",
 * cf-chl-bypass, g-recaptcha, etc.) plus a healthy control.
 */

import {describe, it, expect} from 'vitest';
import {
  CAPTCHA_MARKERS,
  detectCaptchaInString,
  detectCaptchaInPayload,
  detectCaptchaInError,
} from '../services/MarketNormaliser.js';

describe('MarketNormaliser — captcha detection (PHASE 2 §P2.D)', () => {
  describe('CAPTCHA_MARKERS', () => {
    it('includes Cloudflare "Just a moment" marker', () => {
      expect(CAPTCHA_MARKERS).toContain('<title>Just a moment');
    });

    it('includes cf-chl-bypass Cloudflare cookie marker', () => {
      expect(CAPTCHA_MARKERS).toContain('cf-chl-bypass');
    });

    it('includes g-recaptcha marker', () => {
      expect(CAPTCHA_MARKERS).toContain('g-recaptcha');
    });
  });

  describe('detectCaptchaInString', () => {
    it('detects Cloudflare challenge HTML', () => {
      const html =
        '<!DOCTYPE html><html><head><title>Just a moment...</title></head></html>';
      expect(detectCaptchaInString(html)).toBe(true);
    });

    it('detects cf-chl-bypass in body', () => {
      expect(detectCaptchaInString('set-cookie: cf-chl-bypass=xyz')).toBe(true);
    });

    it('detects g-recaptcha class marker', () => {
      // Google reCAPTCHA renders a div with class `g-recaptcha`
      // (see https://developers.google.com/recaptcha/docs/display).
      expect(detectCaptchaInString('<div class="g-recaptcha" data-sitekey="xxx"></div>')).toBe(true);
    });

    it('is case-insensitive on the marker match', () => {
      expect(detectCaptchaInString('CLOUDFLARE: <TITLE>JUST A MOMENT</TITLE>')).toBe(true);
    });

    it('returns false for ordinary JSON payload', () => {
      const json = '{"records":[{"commodity":"Onion","modal_price":"1800"}]}';
      expect(detectCaptchaInString(json)).toBe(false);
    });

    it('returns false for empty / non-string input', () => {
      expect(detectCaptchaInString('')).toBe(false);
      // @ts-expect-error — testing runtime guard
      expect(detectCaptchaInString(undefined)).toBe(false);
      // @ts-expect-error — testing runtime guard
      expect(detectCaptchaInString(null)).toBe(false);
      // @ts-expect-error — testing runtime guard
      expect(detectCaptchaInString(42)).toBe(false);
    });

    it('returns false for a generic HTML error page without captcha markers', () => {
      expect(detectCaptchaInString('<html><body>500 Internal Server Error</body></html>')).toBe(false);
    });
  });

  describe('detectCaptchaInPayload', () => {
    it('handles string payloads', () => {
      expect(detectCaptchaInPayload('<html><title>Just a moment</title></html>')).toBe(true);
    });

    it('handles object payloads by serialising to JSON', () => {
      expect(detectCaptchaInPayload({error: 'cf-chl-bypass expired'})).toBe(true);
    });

    it('returns false for healthy object payloads', () => {
      expect(detectCaptchaInPayload({records: [{commodity: 'Onion'}]})).toBe(false);
    });

    it('returns false for null / undefined', () => {
      expect(detectCaptchaInPayload(null)).toBe(false);
      expect(detectCaptchaInPayload(undefined)).toBe(false);
    });

    it('does not throw on circular object references', () => {
      const a: any = {};
      a.self = a;
      expect(() => detectCaptchaInPayload(a)).not.toThrow();
      expect(detectCaptchaInPayload(a)).toBe(false);
    });
  });

  describe('detectCaptchaInError', () => {
    it('detects captcha keywords in error string', () => {
      expect(detectCaptchaInError('MCP returned HTTP 403: <html><title>Just a moment</title>')).toBe(true);
    });

    it('returns false for ordinary error message', () => {
      expect(detectCaptchaInError('ECONNREFUSED 127.0.0.1:9004')).toBe(false);
    });

    it('returns false for undefined / empty input', () => {
      expect(detectCaptchaInError(undefined)).toBe(false);
      expect(detectCaptchaInError('')).toBe(false);
    });
  });
});