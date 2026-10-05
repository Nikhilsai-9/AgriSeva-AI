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

  // Simple in-memory deduplication cache for Meta webhook message IDs (10 min TTL)
  private static readonly processedMsgIds = new Map<string, number>();

  private isDuplicate(msgId?: string): boolean {
    if (!msgId) return false;
    const now = Date.now();
    for (const [id, ts] of WhatsAppController.processedMsgIds) {
      if (now - ts > 10 * 60 * 1000) {
        WhatsAppController.processedMsgIds.delete(id);
      }
    }
    if (WhatsAppController.processedMsgIds.has(msgId)) {
      return true;
    }
    WhatsAppController.processedMsgIds.set(msgId, now);
    return false;
  }

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
    const expectedToken =
      process.env.META_WA_WEBHOOK_VERIFY_TOKEN ||
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
      'agriseva_webhook_token_2026';

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      console.log('[WhatsAppController] Webhook verified successfully');
      return response.status(200).send(challenge);
    }
    console.warn('[WhatsAppController] Verification token mismatch. Received:', verifyToken);
    return response.status(403).send('Verification token mismatch');
  }

  @OpenAPI({
    summary: 'Meta WhatsApp Cloud API Incoming Message Webhook',
    description: 'Receives incoming messages from WhatsApp users and dispatches automated AI advisory replies.',
  })
  @Post('/webhook')
  async handleIncomingWebhook(@Body() body: any, @Res() response: any) {
    this.processIncomingEvent(body);
    return response.status(200).send('EVENT_RECEIVED');
  }

  private processIncomingEvent(body: any): void {
    try {
      if (!body?.object || !Array.isArray(body?.entry)) return;

      // Loop ALL entries and ALL changes (Meta can batch multiple events in one POST)
      for (const entry of body.entry) {
        if (!Array.isArray(entry?.changes)) continue;
        for (const change of entry.changes) {
          const value = change?.value;
          if (!value) continue;

          const messages: any[] = value.messages;
          const metadata = value.metadata;
          const phoneNumberId =
            metadata?.phone_number_id ||
            process.env.META_WA_PHONE_NUMBER_ID ||
            process.env.WHATSAPP_PHONE_NUMBER_ID;

          if (!Array.isArray(messages) || messages.length === 0) continue;

          // Loop ALL messages in this change (Meta sometimes batches them)
          for (const incomingMsg of messages) {
            const from: string = incomingMsg.from;
            const msgType: string = incomingMsg.type;
            const msgId: string = incomingMsg.id;

            if (this.isDuplicate(msgId)) {
              console.log(`[WhatsAppController] Duplicate webhook event for message ${msgId} ignored.`);
              continue;
            }

            // Extract text body from all possible message types:
            //  - plain text
            //  - interactive button reply (quick-reply buttons)
            //  - interactive list reply (list-message row click)
            //  - legacy "button" type (wa.me pre-filled link buttons)
            //  - image caption (the text typed with an image)
            const textBody: string =
              incomingMsg.text?.body ||
              incomingMsg.interactive?.button_reply?.title ||
              incomingMsg.interactive?.list_reply?.title ||
              incomingMsg.button?.text ||
              incomingMsg.button?.payload ||
              incomingMsg.image?.caption ||
              '';

            console.log(
              `[WhatsAppController] Incoming ${msgType} message ${msgId || ''} from ${from}: "${textBody}"`,
            );

            // Process asynchronously — do NOT await, webhook must return 200 immediately
            this.whatsappService
              .handleIncomingWhatsAppCloudMessage(from, textBody, phoneNumberId, {
                msgId,
                msgType,
                interactive: incomingMsg.interactive,
                audio: incomingMsg.audio,
                voice: incomingMsg.voice,
                image: incomingMsg.image,
                button: incomingMsg.button,
              })
              .catch((err: any) => {
                console.error('[WhatsAppController] Asynchronous WhatsApp handling error:', err);
              });
          }
        }
      }
    } catch (err) {
      console.error('[WhatsAppController] Error handling incoming WhatsApp message:', err);
    }
  }

  private ensureStaffOrAdmin(user: IUser) {
    const privilegedRoles = [
      'admin',
      'moderator',
      'expert',
      'pae_expert',
      'call_agent',
      'gate_keeper',
      'auditor',
      'district_coordinator',
      'block_coordinator',
    ];
    if (!privilegedRoles.includes(user.role as string) && !user.special_task_force) {
      throw new ForbiddenError('Access denied: Staff or Admin role required');
    }
  }

  @OpenAPI({
    summary: 'Get WhatsApp threads for authenticated user',
    description: 'Retrieves a list of WhatsApp threads scoped to the authenticated user.',
  })
  @Get('/threads')
  @HttpCode(200)
  @Authorized()
  async getThreads(
    @CurrentUser() user: IUser,
    @QueryParam('page') page?: number,
    @QueryParam('limit') limit?: number,
    @QueryParam('search') search?: string,
  ) {
    return this.whatsappService.getThreads(user, page, limit, search);
  }

  @OpenAPI({
    summary: 'Get WhatsApp thread details',
    description:
      'Retrieves message history for a specific WhatsApp thread with ownership verification.',
  })
  @Get('/threads/:threadId')
  @HttpCode(200)
  @Authorized()
  async getThreadDetailsById(
    @CurrentUser() user: IUser,
    @Param('threadId') threadId: string,
    @QueryParam('date') date?: string,
  ) {
    return this.whatsappService.getThreadDetails(user, threadId, date || 'all');
  }

  @OpenAPI({
    summary: 'Get WhatsApp thread details for date',
    description:
      'Retrieves message history for a specific WhatsApp thread on a date with ownership verification.',
  })
  @Get('/threads/:threadId/:date')
  @HttpCode(200)
  @Authorized()
  async getThreadDetails(
    @CurrentUser() user: IUser,
    @Param('threadId') threadId: string,
    @Param('date') date: string,
  ) {
    return this.whatsappService.getThreadDetails(user, threadId, date);
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
    const isOwner = await this.whatsappService.isUserConversationOwner(user, body.phoneNumber);
    if (!isOwner) {
      throw new ForbiddenError('You are not authorized to send messages to this conversation');
    }

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
    @CurrentUser() user: IUser,
    @QueryParam('page') page = 1,
    @QueryParam('limit') limit = 2,
  ) {
    this.ensureStaffOrAdmin(user);
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
    @CurrentUser() user: IUser,
  ) {
    this.ensureStaffOrAdmin(user);
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
    @CurrentUser() user: IUser,
  ) {
    this.ensureStaffOrAdmin(user);
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
