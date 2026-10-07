import { IContext, QuestionSource } from '#root/shared/interfaces/models.js';

export interface IContextService {
  addContext(
    userId: string,
    text: string,
    options?: {
      language?: string;
      submissionId?: string;
      user?: any;
      details?: any;
      source?: QuestionSource;
    },
  ): Promise<{ insertedId: string; questionId?: string }>;
  getById(contextId: string): Promise<IContext | null>;
  translate(text: string, targetLang: string, sourceLang?: string): Promise<{ translated_text: string }>;
  speechToText(file: Express.Multer.File, language: string): Promise<unknown>;
  getSTTHealth(): Promise<{
    status: 'healthy' | 'quota_exceeded' | 'authentication_error' | 'rate_limited' | 'provider_unavailable' | 'misconfigured' | 'unknown';
    provider: string;
    checkedAt: string;
  }>;
}
