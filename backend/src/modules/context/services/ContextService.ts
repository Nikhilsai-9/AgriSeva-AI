import {IContextRepository} from '#root/shared/database/interfaces/IContextRepository.js';
import {BaseService, MongoDatabase} from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {inject, injectable} from 'inversify';
import {ClientSession} from 'mongodb';
import {IContext, QuestionSource} from '#root/shared/interfaces/models.js';
import {InternalServerError, BadRequestError} from 'routing-controllers';
import { QuestionService } from '#root/modules/question/services/QuestionService.js';
import { IContextService } from '../interfaces/IContextService.js';
import { appConfig } from '#root/config/app.js';
import { SttHttpError, SttErrorCode, SttErrorCategory } from '../errors/SttError.js';

@injectable()
export class ContextService extends BaseService implements IContextService {
  constructor(
    @inject(GLOBAL_TYPES.ContextRepository)
    private readonly contextRepo: IContextRepository,
    @inject(GLOBAL_TYPES.QuestionService)
    private readonly questionService: QuestionService,

    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,
  ) {
    super(mongoDatabase);
  }

  async addContext(
    userId: string,
    text: string,
    options?: {
      language?: string;
      submissionId?: string;
      user?: any;
      details?: any;
      source?: QuestionSource;
    },
  ): Promise<{ insertedId: string; questionId?: string }> {
    try {
      if (!text || text.trim().length === 0) {
        throw new BadRequestError('Context text required');
      }

      return this._withTransaction(async (session: ClientSession) => {
        const result = await this.contextRepo.addContext(text, session);
        const contextId = result.insertedId;

        const question = await this.questionService.createQuestionFromContext(
          userId,
          contextId,
          text,
          options,
          session,
        );

        return {
          insertedId: contextId,
          questionId: question?._id?.toString(),
        };
      });
    } catch (error) {
      throw new InternalServerError(`Failed to add context: ${error}`);
    }
  }

  async getById(contextId: string): Promise<IContext | null> {
    try {
      if (!contextId) {
        throw new BadRequestError('ContextId is required');
      }

      return this._withTransaction(async (session: ClientSession) => {
        const context = await this.contextRepo.getById(contextId, session);
        if (!context) {
          throw new BadRequestError(`Context with ID ${contextId} not found`);
        }
        return context;
      });
    } catch (error) {
      throw new InternalServerError(`Failed to get context: ${error}`);
    }
  }

  async translate(
    text: string,
    targetLang: string,
    sourceLang?: string,
  ): Promise<{ translated_text: string }> {
    const MAX_TOTAL_CHARS = 30_000;

    const apiKey = appConfig.sarvamAPI;
    if (!apiKey) throw new BadRequestError('Sarvam API key not configured');
    if (!text?.trim()) throw new BadRequestError('text is required');
    if (!targetLang) throw new BadRequestError('targetLang is required');
    if (text.length > MAX_TOTAL_CHARS)
      throw new BadRequestError(`Text exceeds maximum allowed length of ${MAX_TOTAL_CHARS} characters`);

    // Languages exclusive to sarvam-translate:v1 (supports 22 languages)
    // mayura:v1 supports only 11 languages but auto-detects source language
    const SARVAM_ONLY_LANGS = new Set([
      'en-IN', 'hi-IN', 'bn-IN',
      'gu-IN', 'kn-IN', 'ml-IN',
      'mr-IN', 'od-IN', 'pa-IN',
      'ta-IN', 'te-IN', 'as-IN',
      'doi-IN', 'kok-IN', 'ks-IN',
      'mai-IN', 'mni-IN', 'ne-IN',
      'sa-IN', 'sat-IN', 'sd-IN',
      'ur-IN', 'brx-IN',
    ]);

    const useSarvamModel = SARVAM_ONLY_LANGS.has(targetLang);
    const model = useSarvamModel ? 'sarvam-translate:v1' : 'mayura:v1';
    // API character limits: mayura:v1 = 1000, sarvam-translate:v1 = 2000

    // sarvam-translate:v1 requires an explicit source language (no 'auto').
    // When sourceLang is unknown, go via English:
    //   Step 1 — mayura:v1 auto-detects source → English
    //   Step 2 — sarvam-translate:v1 English → target
    if (useSarvamModel && !sourceLang) {
      const enChunks = this._splitIntoChunks(text, 900);
      const enResults = await this._translateInBatches(enChunks, 'auto', 'en-IN', 'mayura:v1', apiKey);
      const enText = enResults.join(' ');
      if(targetLang === 'en-IN') return { translated_text: enText };
      const targetChunks = this._splitIntoChunks(enText, 1900);
      const targetResults = await this._translateInBatches(targetChunks, 'en-IN', targetLang, model, apiKey);
      return { translated_text: targetResults.join(' ') };
    }

    const source_language_code = sourceLang ?? 'auto';
    const maxChars = useSarvamModel ? 1900 : 900;
    const chunks = this._splitIntoChunks(text, maxChars);
    const translatedChunks = await this._translateInBatches(chunks, source_language_code, targetLang, model, apiKey);
    return { translated_text: translatedChunks.join(' ') };
  }

  private async _translateInBatches(
    chunks: string[],
    source_language_code: string,
    targetLang: string,
    model: string,
    apiKey: string,
    batchSize = 3,
  ): Promise<string[]> {
    const results: string[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(chunk =>
          this._callSarvamTranslate(chunk, source_language_code, targetLang, model, apiKey),
        ),
      );
      results.push(...batchResults);
    }

    return results;
  }

  private _splitIntoChunks(text: string, maxChars: number): string[] {
    if (text.length <= maxChars) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > maxChars) {
      let splitAt = remaining.lastIndexOf('\n', maxChars);
      if (splitAt < maxChars / 2) splitAt = remaining.lastIndexOf('. ', maxChars);
      if (splitAt < maxChars / 2) splitAt = maxChars;

      chunks.push(remaining.slice(0, splitAt + 1));
      remaining = remaining.slice(splitAt + 1);
    }

    if (remaining.length > 0) chunks.push(remaining);
    return chunks;
  }

  private _sttHealthCache: {
    status: 'healthy' | 'quota_exceeded' | 'authentication_error' | 'rate_limited' | 'provider_unavailable' | 'misconfigured' | 'unknown';
    provider: string;
    checkedAt: string;
  } | null = null;
  private _lastHealthCheckTime = 0;

  async getSTTHealth(): Promise<{
    status: 'healthy' | 'quota_exceeded' | 'authentication_error' | 'rate_limited' | 'provider_unavailable' | 'misconfigured' | 'unknown';
    provider: string;
    checkedAt: string;
  }> {
    const now = Date.now();
    if (this._sttHealthCache && now - this._lastHealthCheckTime < 60000) {
      return this._sttHealthCache;
    }

    const apiKey = appConfig.sarvamAPI;
    if (!apiKey) {
      this._sttHealthCache = {
        status: 'misconfigured',
        provider: 'sarvam',
        checkedAt: new Date().toISOString(),
      };
      this._lastHealthCheckTime = now;
      return this._sttHealthCache;
    }

    try {
      const res = await fetch('https://api.sarvam.ai/speech-to-text-translate', {
        method: 'POST',
        headers: { 'api-subscription-key': apiKey },
        signal: AbortSignal.timeout(5000),
      });

      let status:
        | 'healthy'
        | 'quota_exceeded'
        | 'authentication_error'
        | 'rate_limited'
        | 'provider_unavailable'
        | 'misconfigured'
        | 'unknown' = 'unknown';

      if (res.status === 200 || res.status === 400) {
        status = 'healthy';
      } else if (res.status === 402) {
        status = 'quota_exceeded';
      } else if (res.status === 401 || res.status === 403) {
        status = 'authentication_error';
      } else if (res.status === 429) {
        status = 'rate_limited';
      } else if (res.status >= 500) {
        status = 'provider_unavailable';
      }

      this._sttHealthCache = {
        status,
        provider: 'sarvam',
        checkedAt: new Date().toISOString(),
      };
      this._lastHealthCheckTime = now;
      return this._sttHealthCache;
    } catch {
      this._sttHealthCache = {
        status: 'provider_unavailable',
        provider: 'sarvam',
        checkedAt: new Date().toISOString(),
      };
      this._lastHealthCheckTime = now;
      return this._sttHealthCache;
    }
  }

  async speechToText(
    file: Express.Multer.File,
    language: string,
  ): Promise<unknown> {
    const apiKey = appConfig.sarvamAPI;
    if (!apiKey) {
      console.error(
        '[STT Service]',
        JSON.stringify({
          event: 'stt_failure',
          provider: 'sarvam',
          category: 'misconfigured',
          status: 503,
          timestamp: new Date().toISOString(),
        })
      );
      throw new SttHttpError(
        503,
        'Voice transcription is temporarily unavailable. Please try again later or type your question.',
        'STT_PROVIDER_UNAVAILABLE',
        'misconfigured',
        'sarvam',
      );
    }

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new SttHttpError(
        400,
        'Audio recording was empty. Please record again or type your question.',
        'STT_INVALID_REQUEST',
        'invalid_request',
        'sarvam',
      );
    }

    if (file.buffer.length > 25 * 1024 * 1024) {
      console.error(
        '[STT Service]',
        JSON.stringify({
          event: 'stt_failure',
          provider: 'sarvam',
          category: 'audio_too_large',
          status: 413,
          timestamp: new Date().toISOString(),
        })
      );
      throw new SttHttpError(
        413,
        'Audio recording is too large. Please record a shorter message or type your question.',
        'STT_AUDIO_TOO_LARGE',
        'audio_too_large',
        'sarvam',
      );
    }

    const formData = new FormData();
    formData.append(
      'file',
      new Blob([file.buffer], { type: file.mimetype || 'audio/webm' }),
      file.originalname || 'recording.webm'
    );
    formData.append('language', language || 'hi-IN');

    if (
      this._sttHealthCache?.status === 'quota_exceeded' &&
      Date.now() - this._lastHealthCheckTime < 60000
    ) {
      throw new SttHttpError(
        402,
        'Voice transcription is temporarily unavailable. Please try again later or type your question.',
        'STT_QUOTA_EXCEEDED',
        'quota_exceeded',
        'sarvam',
      );
    }

    let response: Response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      response = await fetch('https://api.sarvam.ai/speech-to-text-translate', {
        method: 'POST',
        headers: { 'api-subscription-key': apiKey },
        body: formData,
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr.name === 'AbortError';
      const status = isTimeout ? 504 : 503;
      const code: SttErrorCode = isTimeout ? 'STT_TIMEOUT' : 'STT_NETWORK_ERROR';
      const category: SttErrorCategory = isTimeout ? 'timeout' : 'network_error';

      console.error(
        '[STT Service]',
        JSON.stringify({
          event: 'stt_failure',
          provider: 'sarvam',
          category,
          status,
          timestamp: new Date().toISOString(),
        })
      );

      throw new SttHttpError(
        status,
        isTimeout
          ? 'Voice transcription request timed out. Please try again or type your question.'
          : 'Unable to connect to transcription service. Please check your connection or type your question.',
        code,
        category,
        'sarvam',
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const requestId = response.headers.get('x-request-id') || undefined;
      let rawBody: any = null;
      try {
        rawBody = await response.json();
      } catch {
        rawBody = await response.text().catch(() => response.statusText);
      }

      const bodyRequestId =
        typeof rawBody === 'object' && rawBody !== null
          ? rawBody.request_id || rawBody.error?.request_id
          : undefined;
      const effectiveRequestId = requestId || bodyRequestId;

      let code: SttErrorCode;
      let category: SttErrorCategory;
      let message: string;
      let clientStatus = response.status;

      switch (response.status) {
        case 402:
          code = 'STT_QUOTA_EXCEEDED';
          category = 'quota_exceeded';
          clientStatus = 402;
          message = 'Voice transcription is temporarily unavailable. Please try again later or type your question.';
          this._sttHealthCache = {
            status: 'quota_exceeded',
            provider: 'sarvam',
            checkedAt: new Date().toISOString(),
          };
          this._lastHealthCheckTime = Date.now();
          break;
        case 401:
          code = 'STT_AUTH_ERROR';
          category = 'authentication_error';
          clientStatus = 401;
          message = 'Voice transcription service authentication failed. Please try again later or type your question.';
          break;
        case 403:
          code = 'STT_FORBIDDEN';
          category = 'forbidden';
          clientStatus = 403;
          message = 'Voice transcription service access was denied. Please try again later or type your question.';
          break;
        case 400:
          code = 'STT_INVALID_REQUEST';
          category = 'invalid_request';
          clientStatus = 400;
          message = 'Voice transcription request could not be processed. Please try again or type your question.';
          break;
        case 413:
          code = 'STT_AUDIO_TOO_LARGE';
          category = 'audio_too_large';
          clientStatus = 413;
          message = 'The recorded audio is too large. Please record a shorter message or type your question.';
          break;
        case 415:
          code = 'STT_UNSUPPORTED_AUDIO';
          category = 'unsupported_audio';
          clientStatus = 415;
          message = 'Audio format is not supported. Please try again or type your question.';
          break;
        case 429:
          code = 'STT_RATE_LIMITED';
          category = 'rate_limited';
          clientStatus = 429;
          message = 'Voice transcription is busy. Please wait a moment and try again, or type your question.';
          break;
        case 500:
        case 502:
        case 503:
        case 504:
        default:
          code = 'STT_PROVIDER_UNAVAILABLE';
          category = 'provider_unavailable';
          clientStatus = 503;
          message = 'Voice transcription is temporarily unavailable. Please try again later or type your question.';
          break;
      }

      console.error(
        '[STT Service]',
        JSON.stringify({
          event: 'stt_failure',
          provider: 'sarvam',
          category,
          status: response.status,
          requestId: effectiveRequestId,
          timestamp: new Date().toISOString(),
        })
      );

      throw new SttHttpError(
        clientStatus,
        message,
        code,
        category,
        'sarvam',
        effectiveRequestId,
      );
    }

    return response.json();
  }


  private async _callSarvamTranslate(
    input: string,
    source_language_code: string,
    target_language_code: string,
    model: string,
    apiKey: string,
  ): Promise<string> {
    const response = await fetch('https://api.sarvam.ai/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({ input, source_language_code, target_language_code, model }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => response.statusText);
      throw new InternalServerError(`Sarvam API error ${response.status}: ${body}`);
    }

    const data = await response.json() as { translated_text?: string };
    if (!data?.translated_text) {
      throw new InternalServerError('Sarvam API returned empty translation');
    }

    return data.translated_text;
  }
}
