import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsAppController } from '../controllers/WhatsAppController.js';
import { WhatsAppService } from '../services/WhatsAppService.js';
import type { IWhatsAppService } from '../interfaces/IWhatsAppService.js';
import { ObjectId } from 'mongodb';

describe('WhatsApp Multilingual AI Agent Pipeline Tests', () => {
  describe('WhatsAppController Webhook', () => {
    let controller: WhatsAppController;
    let mockWhatsappService: IWhatsAppService;

    beforeEach(() => {
      process.env.META_WA_WEBHOOK_VERIFY_TOKEN = 'test_verify_token_123';

      mockWhatsappService = {
        getThreads: vi.fn(),
        getThreadDetails: vi.fn(),
        sendMessage: vi.fn(),
        getInactiveUsers: vi.fn(),
        getAllUsers: vi.fn(),
        getUniqueUsers: vi.fn(),
        handleIncomingWhatsAppCloudMessage: vi.fn().mockResolvedValue(undefined),
      };

      controller = new WhatsAppController(mockWhatsappService);
    });

    it('verifies Meta webhook challenge when token matches', async () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await controller.verifyWebhook('subscribe', 'test_verify_token_123', 'challenge_code_987', mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith('challenge_code_987');
    });

    it('rejects Meta webhook verification when token mismatches', async () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await controller.verifyWebhook('subscribe', 'wrong_token', 'challenge_code_987', mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('acknowledges Meta webhook with 200 immediately and passes incoming text message', async () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      const webhookBody = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '9182417061',
                    phone_number_id: '104239857281928',
                  },
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.test.001',
                      timestamp: '1710000000',
                      text: {
                        body: 'What is the current tomato price?',
                      },
                      type: 'text',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      await controller.handleIncomingWebhook(webhookBody, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith('EVENT_RECEIVED');
      expect(mockWhatsappService.handleIncomingWhatsAppCloudMessage).toHaveBeenCalledWith(
        '919876543210',
        'What is the current tomato price?',
        '104239857281928',
        expect.objectContaining({
          msgId: 'wamid.test.001',
          msgType: 'text',
        }),
      );
    });

    it('idempotently discards duplicate Meta webhook message delivery', async () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      const webhookBody = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.duplicate.test',
                      type: 'text',
                      text: { body: 'Hello AgriSeva' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      // First call processes
      await controller.handleIncomingWebhook(webhookBody, mockRes);
      expect(mockWhatsappService.handleIncomingWhatsAppCloudMessage).toHaveBeenCalledTimes(1);

      // Duplicate delivery with same msgId is ignored
      await controller.handleIncomingWebhook(webhookBody, mockRes);
      expect(mockWhatsappService.handleIncomingWhatsAppCloudMessage).toHaveBeenCalledTimes(1);
    });

    it('correctly handles incoming interactive list/button selection', async () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      const webhookBody = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: '104239857281928' },
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.interactive.001',
                      type: 'interactive',
                      interactive: {
                        type: 'list_reply',
                        list_reply: {
                          id: 'lang_te-IN',
                          title: 'తెలుగు (Telugu)',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      await controller.handleIncomingWebhook(webhookBody, mockRes);

      expect(mockWhatsappService.handleIncomingWhatsAppCloudMessage).toHaveBeenCalledWith(
        '919876543210',
        'తెలుగు (Telugu)',
        '104239857281928',
        expect.objectContaining({
          msgType: 'interactive',
          interactive: expect.objectContaining({
            list_reply: { id: 'lang_te-IN', title: 'తెలుగు (Telugu)' },
          }),
        }),
      );
    });
  });

  describe('WhatsAppService Session & Language Sync', () => {
    let service: WhatsAppService;
    let mockUserRepo: any;
    let mockDb: any;
    let mockGroundedService: any;
    let mockContextService: any;
    let sessionsMap: Map<string, any>;

    beforeEach(() => {
      sessionsMap = new Map();

      mockUserRepo = {
        findById: vi.fn(),
      };

      const mockSessionsCol = {
        createIndex: vi.fn().mockResolvedValue(true),
        findOne: vi.fn().mockImplementation(async (query: any) => {
          for (const s of sessionsMap.values()) {
            if (
              (query.$or && query.$or.some((c: any) => c.phoneNumber === s.phoneNumber || c.rawFrom === s.rawFrom)) ||
              s.phoneNumber === query.phoneNumber
            ) {
              return s;
            }
          }
          return null;
        }),
        updateOne: vi.fn().mockImplementation(async (filter: any, update: any, opts: any) => {
          const key = filter.phoneNumber;
          const current = sessionsMap.get(key) || {};
          const next = { ...current, ...(update.$set || {}) };
          sessionsMap.set(key, next);
          return { acknowledged: true };
        }),
      };

      const mockUsersCol = {
        findOne: vi.fn().mockImplementation(async (query: any) => {
          // Mock an authenticated user with phone 919876543210 and preferredLanguage "te-IN"
          if (query.$or) {
            for (const cond of query.$or) {
              const val = cond.mobile || cond['farmerProfile.phone'];
              if (val === '+919876543210' || val === '919876543210' || val === '9876543210') {
                return {
                  _id: new ObjectId(),
                  firstName: 'Ramesh',
                  lastName: 'Patel',
                  mobile: '+919876543210',
                  farmerProfile: {
                    phone: '+919876543210',
                    preferredLanguage: 'te-IN',
                    state: 'Andhra Pradesh',
                  },
                };
              }
            }
          }
          return null;
        }),
      };

      mockDb = {
        getCollection: vi.fn().mockImplementation(async (colName: string) => {
          if (colName === 'whatsapp_sessions') return mockSessionsCol;
          if (colName === 'users') return mockUsersCol;
          return { findOne: vi.fn().mockResolvedValue(null) };
        }),
      };

      mockGroundedService = {
        generateGroundedAnswer: vi.fn().mockResolvedValue({
          questionId: 'q-123',
          answer: 'Tomato prices in Kurnool are currently ₹2,200 per quintal.',
          confidence: 'high',
          status: 'grounded',
          sources: [{ type: 'market_prices', title: 'Agmarknet', reference: 'https://agmarknet.gov.in' }],
          language: 'te-IN',
        }),
      };

      mockContextService = {
        translate: vi.fn().mockImplementation(async (text: string, lang: string) => {
          return { translated_text: `[TELUGU TRANSLATION] ${text}` };
        }),
      };

      service = new WhatsAppService(
        mockUserRepo,
        mockDb,
        mockGroundedService,
        mockContextService,
      );

      // Mock outbound network calls
      vi.spyOn<any, any>(service, 'sendTextMessage').mockResolvedValue({ message_id: 'out_123' });
      vi.spyOn<any, any>(service, 'sendInteractiveListMessage').mockResolvedValue({ message_id: 'out_list_123' });
    });

    it('syncs website farmer profile language automatically when sender matches registered user', async () => {
      // 919876543210 is registered with preferredLanguage: "te-IN"
      await service.handleIncomingWhatsAppCloudMessage(
        '919876543210',
        'What is the tomato price today?',
        '104239857281928',
      );

      // Verify GroundedAnswerService was called with the synced "te-IN" language
      expect(mockGroundedService.generateGroundedAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'te-IN',
        }),
      );

      // Verify language selection menu was NOT triggered
      expect((service as any).sendInteractiveListMessage).not.toHaveBeenCalled();

      // Verify outbound reply was sent
      expect((service as any).sendTextMessage).toHaveBeenCalledWith(
        '919876543210',
        '104239857281928',
        expect.stringContaining('AgriSeva-AI'),
      );
    });

    it('preserves first message and prompts language selection for unmapped new users', async () => {
      // 919999999999 is a new unregistered number
      await service.handleIncomingWhatsAppCloudMessage(
        '919999999999',
        'My tomato leaves are curling',
        '104239857281928',
      );

      // Should prompt for language via interactive list
      expect((service as any).sendInteractiveListMessage).toHaveBeenCalledWith(
        '919999999999',
        '104239857281928',
        expect.objectContaining({
          button: 'Select Language',
        }),
      );

      // Grounded answer should not run yet (awaiting language tap)
      expect(mockGroundedService.generateGroundedAnswer).not.toHaveBeenCalled();

      // Check session preserved the pending query
      const session = sessionsMap.get('+919999999999');
      expect(session).toBeDefined();
      expect(session.pendingFirstMessage.text).toBe('My tomato leaves are curling');
    });

    it('restores pending question and answers in selected language when user taps language button', async () => {
      // 1. Send first message
      await service.handleIncomingWhatsAppCloudMessage(
        '919999999999',
        'My tomato leaves are curling',
        '104239857281928',
      );

      // 2. User taps "తెలుగు (Telugu)" (interactive reply lang_te-IN)
      await service.handleIncomingWhatsAppCloudMessage(
        '919999999999',
        'తెలుగు (Telugu)',
        '104239857281928',
        {
          interactive: {
            list_reply: { id: 'lang_te-IN', title: 'తెలుగు (Telugu)' },
          },
        },
      );

      // Session should now have te-IN permanently saved
      const session = sessionsMap.get('+919999999999');
      expect(session.preferredLanguage).toBe('te-IN');
      expect(session.languageSelectedExplicitly).toBe(true);

      // The original preserved query "My tomato leaves are curling" should have been executed!
      expect(mockGroundedService.generateGroundedAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'My tomato leaves are curling',
          language: 'te-IN',
        }),
      );

      // Outbound message was delivered to the farmer
      expect((service as any).sendTextMessage).toHaveBeenCalled();
    });

    it('switches language when farmer types "language" or "change language"', async () => {
      // User is already in Telugu
      sessionsMap.set('+919876543210', {
        phoneNumber: '+919876543210',
        rawFrom: '919876543210',
        preferredLanguage: 'te-IN',
        languageSelectedExplicitly: true,
      });

      await service.handleIncomingWhatsAppCloudMessage(
        '919876543210',
        'language',
        '104239857281928',
      );

      // Prompts language selector menu
      expect((service as any).sendInteractiveListMessage).toHaveBeenCalledWith(
        '919876543210',
        '104239857281928',
        expect.objectContaining({
          button: 'Select Language',
        }),
      );
    });

    it('different questions produce different answers for market price vs crop disease', async () => {
      sessionsMap.set('+919876543210', {
        phoneNumber: '+919876543210',
        rawFrom: '919876543210',
        preferredLanguage: 'en-IN',
        languageSelectedExplicitly: true,
      });

      mockGroundedService.generateGroundedAnswer
        .mockResolvedValueOnce({
          questionId: 'q-1',
          answer: 'Mandi price for tomato is ₹2,200/quintal in Kurnool.',
          confidence: 'high',
          status: 'grounded',
        })
        .mockResolvedValueOnce({
          questionId: 'q-2',
          answer: 'Rice yellowing is caused by zinc deficiency or blast. Apply zinc sulphate 25kg/ha.',
          confidence: 'high',
          status: 'grounded',
        });

      // Question 1: Market price
      await service.handleIncomingWhatsAppCloudMessage(
        '919876543210',
        'What is tomato market price?',
        '104239857281928',
      );

      // Question 2: Crop disease
      await service.handleIncomingWhatsAppCloudMessage(
        '919876543210',
        'My rice leaves are turning yellow',
        '104239857281928',
      );

      expect(mockGroundedService.generateGroundedAnswer).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ query: 'What is tomato market price?' }),
      );
      expect(mockGroundedService.generateGroundedAnswer).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ query: 'My rice leaves are turning yellow' }),
      );

      const calls = ((service as any).sendTextMessage as any).mock.calls;
      expect(calls[0][2]).toContain('tomato');
      expect(calls[1][2]).toContain('zinc');
      expect(calls[0][2]).not.toEqual(calls[1][2]);
    });
  });
});
