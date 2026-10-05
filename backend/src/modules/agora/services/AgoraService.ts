import { injectable, inject } from 'inversify';
import agoraTokenPkg from 'agora-token';

const agoraPkgAny: any = (agoraTokenPkg as any)?.default || agoraTokenPkg;
const RtcTokenBuilder = agoraPkgAny?.RtcTokenBuilder;
const RtcRole = agoraPkgAny?.RtcRole || { PUBLISHER: 1, SUBSCRIBER: 2 };
import { GROUNDED_ANSWER_TYPES } from '../../groundedAnswer/types.js';
import type { IGroundedAnswerService } from '../../groundedAnswer/interfaces/IGroundedAnswerService.js';
import { GLOBAL_TYPES } from '#root/types.js';
import type { IQuestionService } from '../../question/interfaces/IQuestionService.js';
import type { QuestionSource } from '#root/shared/interfaces/models.js';

export interface AgoraTokenResponse {
  success: boolean;
  appId: string;
  channelName: string;
  token: string;
  uid: string | number;
  expireTime: number;
}

export interface AgoraVoiceQueryResponse {
  success: boolean;
  question: string;
  answer: string;
  confidence?: string;
  sources?: any[];
  language?: string;
  questionId?: string;
}

@injectable()
export class AgoraService {
  constructor(
    @inject(GROUNDED_ANSWER_TYPES.GroundedAnswerService)
    private readonly groundedAnswerService: IGroundedAnswerService,
    @inject(GLOBAL_TYPES.QuestionService)
    private readonly questionService: IQuestionService,
  ) {}

  private getAppId(): string {
    return process.env.AGORA_APP_ID || '360acfc1ebd44465b9b85b7800153364';
  }

  private getAppCertificate(): string {
    return process.env.AGORA_APP_CERTIFICATE || '5a5ffb7db6dd438a9ca9f7d0019e7189';
  }

  /**
   * Generates an Agora RTC token for live in-browser audio calls.
   * Expiration defaults to 86400 seconds (24 hours).
   */
  public generateToken(
    channelName: string = 'agriseva-call',
    uid: string | number = 0,
    role: 'publisher' | 'subscriber' = 'publisher',
    expireTimeSeconds: number = 86400,
  ): AgoraTokenResponse {
    const appId = this.getAppId();
    const appCertificate = this.getAppCertificate();
    const rtcRole = role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

    let token = '';
    const numericUid = typeof uid === 'number' ? uid : parseInt(uid, 10);

    if (!isNaN(numericUid) && numericUid >= 0) {
      token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        numericUid,
        rtcRole,
        expireTimeSeconds,
        expireTimeSeconds,
      );
    } else {
      token = RtcTokenBuilder.buildTokenWithUserAccount(
        appId,
        appCertificate,
        channelName,
        String(uid),
        rtcRole,
        expireTimeSeconds,
        expireTimeSeconds,
      );
    }

    return {
      success: true,
      appId,
      channelName,
      token,
      uid,
      expireTime: expireTimeSeconds,
    };
  }

  /**
   * Processes a live query received from AI Assistant or in-browser Agora call.
   * Runs through canonical question pipeline: saves question, assigns category,
   * generates grounded answer, saves answer to MongoDB, and makes visible in All Questions.
   */
  public async processVoiceQuery(
    question: string,
    language: string = 'te-IN',
    farmerPhone?: string,
    source: QuestionSource = 'AI_ASSISTANT',
    imageUrl?: string,
    userId?: string,
  ): Promise<AgoraVoiceQueryResponse> {
    const canonicalResult = await this.questionService.createCanonicalQuestion({
      question,
      language,
      userId,
      farmerPhone,
      source,
      imageUrl,
    });

    return {
      success: true,
      question: canonicalResult.question.question,
      answer: canonicalResult.answer || canonicalResult.question.aiInitialAnswer || '',
      confidence: canonicalResult.confidence || 'medium',
      sources: canonicalResult.sources || [],
      language: canonicalResult.language || canonicalResult.question.language || language,
      questionId: canonicalResult.question._id?.toString(),
    };
  }
}
