import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContextService } from '../services/ContextService.js';
import { SttHttpError } from '../errors/SttError.js';
import { appConfig } from '#root/config/app.js';

describe('ContextService STT Error Classification & Health', () => {
  let contextService: ContextService;
  const mockContextRepo: any = {};
  const mockQuestionService: any = {};
  const mockMongoDatabase: any = {};

  const originalFetch = globalThis.fetch;
  const originalApiKey = appConfig.sarvamAPI;

  beforeEach(() => {
    appConfig.sarvamAPI = 'test-sarvam-key-12345';
    contextService = new ContextService(
      mockContextRepo,
      mockQuestionService,
      mockMongoDatabase
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    appConfig.sarvamAPI = originalApiKey;
    vi.restoreAllMocks();
  });

  const createDummyFile = (size = 1000): Express.Multer.File => ({
    fieldname: 'file',
    originalname: 'recording.webm',
    encoding: '7bit',
    mimetype: 'audio/webm',
    buffer: Buffer.alloc(size),
    size,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  });

  it('classifies 402 response as STT_QUOTA_EXCEEDED with clean user message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      statusText: 'Payment Required',
      headers: { get: () => 'req-sarvam-402' },
      json: vi.fn().mockResolvedValue({
        error: { message: 'No credits available.', code: 'insufficient_quota_error' },
      }),
    });

    try {
      await contextService.speechToText(createDummyFile(), 'hi-IN');
      expect.fail('Expected speechToText to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(SttHttpError);
      expect(err.httpCode).toBe(402);
      expect(err.code).toBe('STT_QUOTA_EXCEEDED');
      expect(err.category).toBe('quota_exceeded');
      expect(err.message).toBe(
        'Voice transcription is temporarily unavailable. Please try again later or type your question.'
      );
      // Ensure raw secret or raw provider JSON is not exposed in message
      expect(err.message).not.toContain('No credits available');
      expect(err.message).not.toContain('insufficient_quota_error');
    }
  });

  it('classifies 401 response as STT_AUTH_ERROR', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: { get: () => null },
      json: vi.fn().mockResolvedValue({ error: { message: 'Invalid API key' } }),
    });

    try {
      await contextService.speechToText(createDummyFile(), 'en-IN');
      expect.fail('Expected speechToText to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(SttHttpError);
      expect(err.httpCode).toBe(401);
      expect(err.code).toBe('STT_AUTH_ERROR');
      expect(err.category).toBe('authentication_error');
    }
  });

  it('classifies 429 response as STT_RATE_LIMITED', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: { get: () => null },
      json: vi.fn().mockResolvedValue({ error: { message: 'Rate limit exceeded' } }),
    });

    try {
      await contextService.speechToText(createDummyFile(), 'hi-IN');
      expect.fail('Expected speechToText to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(SttHttpError);
      expect(err.httpCode).toBe(429);
      expect(err.code).toBe('STT_RATE_LIMITED');
      expect(err.category).toBe('rate_limited');
    }
  });

  it('classifies 503 response as STT_PROVIDER_UNAVAILABLE', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      headers: { get: () => null },
      json: vi.fn().mockResolvedValue({ error: { message: 'Overloaded' } }),
    });

    try {
      await contextService.speechToText(createDummyFile(), 'te-IN');
      expect.fail('Expected speechToText to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(SttHttpError);
      expect(err.httpCode).toBe(503);
      expect(err.code).toBe('STT_PROVIDER_UNAVAILABLE');
      expect(err.category).toBe('provider_unavailable');
    }
  });

  it('classifies network fetch failure as STT_NETWORK_ERROR', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    try {
      await contextService.speechToText(createDummyFile(), 'hi-IN');
      expect.fail('Expected speechToText to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(SttHttpError);
      expect(err.httpCode).toBe(503);
      expect(err.code).toBe('STT_NETWORK_ERROR');
      expect(err.category).toBe('network_error');
    }
  });

  it('rejects empty audio files with STT_INVALID_REQUEST', async () => {
    try {
      await contextService.speechToText(createDummyFile(0), 'hi-IN');
      expect.fail('Expected speechToText to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(SttHttpError);
      expect(err.httpCode).toBe(400);
      expect(err.code).toBe('STT_INVALID_REQUEST');
    }
  });

  it('returns clean health status quota_exceeded when Sarvam returns 402 on probe', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 402,
    });

    const health = await contextService.getSTTHealth();
    expect(health.status).toBe('quota_exceeded');
    expect(health.provider).toBe('sarvam');
    expect(health).toHaveProperty('checkedAt');
  });

  it('returns healthy status when Sarvam probe responds with 200 or 400', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 400,
    });

    // Force clear health cache
    (contextService as any)._sttHealthCache = null;
    (contextService as any)._lastHealthCheckTime = 0;

    const health = await contextService.getSTTHealth();
    expect(health.status).toBe('healthy');
    expect(health.provider).toBe('sarvam');
  });
});
