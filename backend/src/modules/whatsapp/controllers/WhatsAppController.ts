import {
  JsonController,
  Get,
  Post,
  HttpCode,
  Param,
  Body,
  Authorized,
  CurrentUser,
  QueryParam,
  ForbiddenError,
  Res,
} from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import { inject, injectable } from 'inversify';
import { WHATSAPP_TYPES } from '../types.js';
import type { IWhatsAppService } from '../interfaces/IWhatsAppService.js';
import { IUser } from '#root/shared/index.js';
import { verifyNotTester } from '#root/shared/functions/verifyNotTester.js';
import { WhatsappUsers } from '#root/utils/dummyWhatsAppUsers.js';

@OpenAPI({
  tags: ['whatsapp'],
  description: 'WhatsApp history endpoints and Cloud API Webhooks',
})
@injectable()
@JsonController('/whatsapp', { transformResponse: false })
export class WhatsAppController {
  constructor(
    @inject(WHATSAPP_TYPES.WhatsAppService)
    private readonly whatsappService: IWhatsAppService,
  ) { }

  @OpenAPI({
    summary: 'Meta WhatsApp Cloud API Webhook Verification',
    description: 'Verifies the webhook endpoint for Meta WhatsApp Cloud API',
  })
  @Get('/webhook')
  async verifyWebhook(
    @QueryParam('hub.mode') mode: string,
    @QueryParam('hub.verify_token') verifyToken: string,
    @QueryParam('hub.challenge') challenge: string,
    @Res() response: any,
  ) {
    const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'agriseva_webhook_token_2026';
    if (mode === 'subscribe' && verifyToken === expectedToken) {
      console.log('[WhatsAppController] Webhook verified successfully');
      return response.status(200).send(challenge);
    }
    return response.status(403).send('Verification token mismatch');
  }

  @OpenAPI({
    summary: 'Meta WhatsApp Cloud API Incoming Message Webhook',
    description: 'Receives incoming messages from WhatsApp users and dispatches automated AI advisory replies.',
  })
  @Post('/webhook')
  @HttpCode(200)
  async handleIncomingWebhook(@Body() body: any, @Res() response: any) {
    response.status(200).send('EVENT_RECEIVED');

    try {
      if (body?.object && body?.entry && body.entry[0]?.changes && body.entry[0].changes[0]?.value) {
        const change = body.entry[0].changes[0].value;
        const messages = change.messages;
        const metadata = change.metadata;
        const phoneNumberId = metadata?.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;

        if (messages && messages.length > 0) {
          const incomingMsg = messages[0];
          const from = incomingMsg.from;
          const text = incomingMsg.text?.body;
          const msgType = incomingMsg.type;

          console.log(`[WhatsAppController] Incoming message from ${from}: ${text || `[type: ${msgType}]`}`);

          if (text) {
            await this.whatsappService.handleIncomingWhatsAppCloudMessage(from, text, phoneNumberId);
          }
        }
      }
    } catch (err) {
      console.error('[WhatsAppController] Error handling incoming WhatsApp message:', err);
    }
  }

  @OpenAPI({
    summary: 'Get all WhatsApp threads',
    description: 'Retrieves a list of all WhatsApp threads from LangGraph.',
  })
  @Get('/threads')
  @HttpCode(200)
  @Authorized()
  async getThreads() {
    return this.whatsappService.getThreads();
  }

  @OpenAPI({
    summary: 'Get WhatsApp thread details',
    description:
      'Retrieves message history for a specific WhatsApp thread from LangGraph.',
  })
  @Get('/threads/:threadId/:date')
  @HttpCode(200)
  @Authorized()
  async getThreadDetails(
    @Param('threadId') threadId: string,
    @Param('date') date: string,
  ) {
    return this.whatsappService.getThreadDetails(threadId, date);
  }

  @OpenAPI({
    summary: 'Send a WhatsApp message',
    description: 'Sends a direct WhatsApp message to a specific phone number.',
  })
  @Post('/send-message')
  @HttpCode(200)
  @Authorized()
  async sendMessage(
    @Body() body: { phoneNumber: string; messageText: string },
    @CurrentUser() user: IUser,
  ) {
    verifyNotTester(user);
    const userId = user._id.toString();
    await this.whatsappService.sendMessage(
      userId,
      body.phoneNumber,
      body.messageText,
    );
    console.log('[WhatsAppController] Message sent successfully');
    return { success: true, message: 'Message sent successfully' };
  }

  @OpenAPI({
    summary: 'Fetch inactive whatsapp users',
    description:
      'Fetches the users by mobile numbers who are inactive for more than last 3 days',
  })
  @Get('/inactive-users')
  @HttpCode(200)
  @Authorized()
  async fetxhInactiveUsers(
    @QueryParam('page') page = 1,
    @QueryParam('limit') limit = 2,
  ) {
    const skip = (page - 1) * limit;
    const response = await this.whatsappService.getInactiveUsers(skip, limit);
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

    const inactiveUsers = response.data.filter(item => {
      return new Date(item.lastMessageAt).getTime() < threeDaysAgo;
    });

    const total = inactiveUsers.length;

    return {
      users: inactiveUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  @OpenAPI({
    summary: 'Fetch unique whatsapp users',
    description:
      'Fetches the unique users by mobile numbers',
  })
  @Get('/unique-users')
  @HttpCode(200)
  @Authorized()
  async fetchUnqiueWhatsAppUsers(
  ) {

    return await this.whatsappService.getUniqueUsers();
  }

  @OpenAPI({
    summary: 'Fetch all WhatsApp users',
    description:
      'Fetches all WhatsApp users. Falls back to dummy data on failure.',
  })
  @Get('/users')
  @HttpCode(200)
  @Authorized()
  async fetchAllWhatsAppUsers(
  ) {
    try {
      const response = await this.whatsappService.getAllUsers();
      return {
        users: response.data || [],
      };
    } catch (error) {
      console.error('Error fetching all WhatsApp users from service, falling back to empty list:', error);
      return {
        users: [],
      };
    }
  }
}
