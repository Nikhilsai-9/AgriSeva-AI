import {
  JsonController,
  Get,
  Post,
  QueryParam,
  Body,
  HttpCode,
} from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import { inject, injectable } from 'inversify';
import { AGORA_TYPES } from '../types.js';
import { AgoraService } from '../services/AgoraService.js';

interface VoiceQueryDto {
  question: string;
  language?: string;
  farmerPhone?: string;
}

@OpenAPI({
  tags: ['agora'],
  description: 'Agora Web Voice Calling & RTC Token Endpoints',
})
@injectable()
@JsonController('/agora', { transformResponse: false })
export class AgoraController {
  constructor(
    @inject(AGORA_TYPES.AgoraService)
    private readonly agoraService: AgoraService,
  ) {}

  /**
   * Generates an RTC Token for direct web-based voice calling (10,000 free min/mo)
   */
  @Get('/token')
  @HttpCode(200)
  public getToken(
    @QueryParam('channelName') channelName?: string,
    @QueryParam('uid') uid?: string,
    @QueryParam('role') role?: 'publisher' | 'subscriber',
  ) {
    const channel = channelName || 'agriseva-call';
    const clientUid = uid || 0;
    const clientRole = role || 'publisher';

    const result = this.agoraService.generateToken(channel, clientUid, clientRole);
    return result;
  }

  /**
   * Processes a live spoken voice query from the in-browser Agora call
   */
  @Post('/voice-query')
  @HttpCode(200)
  public async handleVoiceQuery(@Body() body: VoiceQueryDto) {
    if (!body || !body.question || !body.question.trim()) {
      return {
        success: false,
        error: 'Question is required for voice query processing.',
      };
    }

    const result = await this.agoraService.processVoiceQuery(
      body.question.trim(),
      body.language || 'te-IN',
      body.farmerPhone,
    );

    return result;
  }
}
