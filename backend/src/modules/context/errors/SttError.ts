import { HttpError } from 'routing-controllers';

export type SttErrorCategory =
  | 'quota_exceeded'
  | 'authentication_error'
  | 'forbidden'
  | 'invalid_request'
  | 'audio_too_large'
  | 'unsupported_audio'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'timeout'
  | 'network_error'
  | 'misconfigured'
  | 'unknown';

export type SttErrorCode =
  | 'STT_QUOTA_EXCEEDED'
  | 'STT_AUTH_ERROR'
  | 'STT_FORBIDDEN'
  | 'STT_INVALID_REQUEST'
  | 'STT_AUDIO_TOO_LARGE'
  | 'STT_UNSUPPORTED_AUDIO'
  | 'STT_RATE_LIMITED'
  | 'STT_PROVIDER_UNAVAILABLE'
  | 'STT_TIMEOUT'
  | 'STT_NETWORK_ERROR';

export class SttHttpError extends HttpError {
  public readonly code: SttErrorCode;
  public readonly category: SttErrorCategory;
  public readonly provider: string;
  public readonly requestId?: string;

  constructor(
    httpCode: number,
    message: string,
    code: SttErrorCode,
    category: SttErrorCategory,
    provider = 'sarvam',
    requestId?: string,
  ) {
    super(httpCode, message);
    this.name = 'SttHttpError';
    this.code = code;
    this.category = category;
    this.provider = provider;
    this.requestId = requestId;
    Object.setPrototypeOf(this, SttHttpError.prototype);
  }
}
