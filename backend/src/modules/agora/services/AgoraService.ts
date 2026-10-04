import { injectable, inject } from 'inversify';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { GROUNDED_ANSWER_TYPES } from '../../groundedAnswer/types.js';
import type { IGroundedAnswerService } from '../../groundedAnswer/interfaces/IGroundedAnswerService.js';

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
}

@injectable()
export class AgoraService {
  constructor(
    @inject(GROUNDED_ANSWER_TYPES.GroundedAnswerService)
    private readonly groundedAnswerService: IGroundedAnswerService,
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
   * Processes a live spoken voice query received during an Agora call.
   * Grounded through AgriSeva agronomic database, weather, Mandi prices, and ICAR advisories.
   */
  public async processVoiceQuery(
    question: string,
    language: string = 'te-IN',
    farmerPhone?: string,
  ): Promise<AgoraVoiceQueryResponse> {
    const groundedResult = await this.groundedAnswerService.generateGroundedAnswer({
      query: question,
      language,
      userContext: { role: 'farmer', userId: farmerPhone },
    });

    return {
      success: true,
      question,
      answer: groundedResult.answer,
      confidence: groundedResult.confidence,
      sources: groundedResult.sources,
      language: groundedResult.language || language,
    };
  }
}
