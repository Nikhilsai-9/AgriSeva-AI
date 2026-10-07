import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsAppController } from '../controllers/WhatsAppController.js';
import {
  WhatsAppService,
  checkContentSafety,
  isConversationalMessage,
  isLikelyAgriculturalQuery,
  matchLanguageChoice,
  isExplicitLanguageNameChoice,
} from '../services/WhatsAppService.js';
import type { IWhatsAppService } from '../interfaces/IWhatsAppService.js';
import { ObjectId } from 'mongodb';
import { IUser } from '#root/shared/index.js';

describe('WhatsApp Multilingual AI Agent Pipeline Tests', () => {
  describe('WhatsAppController Webhook', () => {
    let controller: WhatsAppController;
    let mockWhatsappService: IWhatsAppService;

    beforeEach(() => {
      process.env.META_WA_WEBHOOK_VERIFY_TOKEN = 'test_verify_token_123';

      mockWhatsappService = {
        getThreads: vi.fn(),
        getThreadDetails: vi.fn(),
        isUserConversationOwner: vi.fn().mockResolvedValue(true),
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
              (query.$or && query.$or.some((c: any) => 
                (c.phoneNumber && (c.phoneNumber === s.phoneNumber || c.phoneNumber === s.rawFrom)) ||
                (c.rawFrom && (c.rawFrom === s.rawFrom || c.rawFrom === s.phoneNumber)) ||
                (c._id && s._id && c._id.toString() === s._id.toString())
              )) ||
              s.phoneNumber === query.phoneNumber
            ) {
              return s;
            }
          }
          return null;
        }),
        updateOne: vi.fn().mockImplementation(async (filter: any, update: any, opts: any) => {
          const key = filter.phoneNumber || filter.$or?.[0]?.phoneNumber;
          const current = sessionsMap.get(key) || {};
          let next = { ...current };
          if (update.$set) next = { ...next, ...update.$set };
          if (update.$push?.history) {
            next.history = next.history || [];
            next.history.push(update.$push.history);
          }
          sessionsMap.set(key, next);
          return { acknowledged: true };
        }),
        find: vi.fn().mockImplementation((query?: any) => ({
          sort: vi.fn().mockReturnThis(),
          toArray: vi.fn().mockImplementation(async () => {
            let list = Array.from(sessionsMap.values());
            if (query && query._id && query._id.$exists === false) {
              return [];
            }
            if (query && query.$or) {
              list = list.filter((s: any) => {
                return query.$or.some((cond: any) => {
                  if (cond.userId && cond.userId.$in) {
                    const strIds = cond.userId.$in.map((x: any) => x.toString());
                    if (s.userId && strIds.includes(s.userId.toString())) return true;
                  }
                  if (cond.phoneNumber && cond.phoneNumber.$in) {
                    if (s.phoneNumber && cond.phoneNumber.$in.includes(s.phoneNumber)) return true;
                  }
                  if (cond.rawFrom && cond.rawFrom.$in) {
                    if (s.rawFrom && cond.rawFrom.$in.includes(s.rawFrom)) return true;
                  }
                  return false;
                });
              });
            }
            return list;
          }),
        })),
      };

      const mockUsersCol = {
        find: vi.fn().mockImplementation(() => ({
          toArray: vi.fn().mockResolvedValue([
            {
              _id: new ObjectId(),
              firstName: 'Ramesh',
              lastName: 'Patel',
              mobile: '+919876543210',
              farmerProfile: {
                phone: '+919876543210',
                preferredLanguage: 'te-IN',
                state: 'Andhra Pradesh',
              },
            },
          ]),
        })),
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
          return {
            findOne: vi.fn().mockResolvedValue(null),
            insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
          };
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

    it('standalone "1" reopens language menu without executing agricultural QA, while "1 kg fertilizer" runs QA', async () => {
      // User with existing explicit language selection
      sessionsMap.set('+919876543210', {
        phoneNumber: '+919876543210',
        rawFrom: '919876543210',
        preferredLanguage: 'te-IN',
        languageSelectedExplicitly: true,
      });

      // 1. Farmer types standalone "1"
      await service.handleIncomingWhatsAppCloudMessage(
        '919876543210',
        '1',
        '104239857281928',
      );

      // Should reopen language menu
      expect((service as any).sendInteractiveListMessage).toHaveBeenCalledWith(
        '919876543210',
        '104239857281928',
        expect.objectContaining({
          button: 'Select Language',
          header: 'AgriSeva-AI',
          body: expect.stringContaining('🌾 *Welcome to AgriSeva-AI*'),
        }),
      );
      // Must NOT call GroundedAnswerService for standalone 1
      expect(mockGroundedService.generateGroundedAnswer).not.toHaveBeenCalled();

      // 2. Farmer types "1 kg urea fertilizer for paddy"
      await service.handleIncomingWhatsAppCloudMessage(
        '919876543210',
        '1 kg urea fertilizer for paddy',
        '104239857281928',
      );

      // This SHOULD trigger agricultural QA
      expect(mockGroundedService.generateGroundedAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          query: '1 kg urea fertilizer for paddy',
          language: 'te-IN',
        }),
      );
    });

    it('greeting "Hi" from new user triggers clean language menu, and choosing language responds with greeting (no RAG)', async () => {
      // New user sends "Hi"
      await service.handleIncomingWhatsAppCloudMessage(
        '919111222333',
        'Hi',
        '104239857281928',
      );

      // Prompts language menu with clean body and header
      expect((service as any).sendInteractiveListMessage).toHaveBeenCalledWith(
        '919111222333',
        '104239857281928',
        expect.objectContaining({
          header: 'AgriSeva-AI',
          body: '🌾 *Welcome to AgriSeva-AI*\n\nPlease select your preferred language:',
          button: 'Select Language',
        }),
      );
      expect(mockGroundedService.generateGroundedAnswer).not.toHaveBeenCalled();

      // User selects Telugu
      await service.handleIncomingWhatsAppCloudMessage(
        '919111222333',
        'తెలుగు (Telugu)',
        '104239857281928',
        {
          interactive: {
            list_reply: { id: 'lang_te-IN', title: 'తెలుగు (Telugu)' },
          },
        },
      );

      // Outbound message is the welcome greeting, NOT an agricultural RAG advisory for "Hi"
      expect(mockGroundedService.generateGroundedAnswer).not.toHaveBeenCalled();
      const sendMock = (service as any).sendTextMessage as any;
      const lastCall = sendMock.mock.calls[sendMock.mock.calls.length - 1];
      expect(lastCall[2]).toContain('AgriSeva-AI కి స్వాగతం');
    });

    it('conversational messages (thanks, ack, identity) receive instant localized replies without RAG', async () => {
      sessionsMap.set('+919876543210', {
        phoneNumber: '+919876543210',
        rawFrom: '919876543210',
        preferredLanguage: 'te-IN',
        languageSelectedExplicitly: true,
      });

      // 1. Gratitude
      await service.handleIncomingWhatsAppCloudMessage(
        '919876543210',
        'ధన్యవాదాలు',
        '104239857281928',
      );
      expect(mockGroundedService.generateGroundedAnswer).not.toHaveBeenCalled();
      const sendMock = (service as any).sendTextMessage as any;
      expect(sendMock.mock.calls[sendMock.mock.calls.length - 1][2]).toContain('ధన్యవాదాలు');

      // 2. Identity
      await service.handleIncomingWhatsAppCloudMessage(
        '919876543210',
        'Who are you?',
        '104239857281928',
      );
      expect(mockGroundedService.generateGroundedAnswer).not.toHaveBeenCalled();
      expect(sendMock.mock.calls[sendMock.mock.calls.length - 1][2]).toContain('AgriSeva-AI డిజిటల్ వ్యవసాయ సహాయకుడిని');
    });

    it('safety moderation: 1st violation issues Warning, 2nd violation blocks user, and blocked messages are dropped silently', async () => {
      sessionsMap.set('+919876543210', {
        phoneNumber: '+919876543210',
        rawFrom: '919876543210',
        preferredLanguage: 'en-IN',
        languageSelectedExplicitly: true,
      });

      const sendMock = (service as any).sendTextMessage as any;
      sendMock.mockClear();

      // 1st violation
      await service.handleIncomingWhatsAppCloudMessage(
        '919876543210',
        'You asshole',
        '104239857281928',
      );

      let session = sessionsMap.get('+919876543210');
      expect(session.warningCount).toBe(1);
      expect(session.blocked).toBeFalsy();
      expect(sendMock).toHaveBeenCalledWith(
        '919876543210',
        '104239857281928',
        expect.stringContaining('Safety Warning'),
      );

      // 2nd violation -> Block!
      sendMock.mockClear();
      await service.handleIncomingWhatsAppCloudMessage(
        '919876543210',
        'You bastard',
        '104239857281928',
      );

      session = sessionsMap.get('+919876543210');
      expect(session.blocked).toBe(true);
      expect(session.warningCount).toBe(2);
      expect(sendMock).toHaveBeenCalledWith(
        '919876543210',
        '104239857281928',
        expect.stringContaining('Account Blocked'),
      );

      // 3rd message from blocked number -> silently dropped, zero calls
      sendMock.mockClear();
      mockGroundedService.generateGroundedAnswer.mockClear();
      await service.handleIncomingWhatsAppCloudMessage(
        '919876543210',
        'Tomato price please',
        '104239857281928',
      );

      expect(sendMock).not.toHaveBeenCalled();
      expect(mockGroundedService.generateGroundedAnswer).not.toHaveBeenCalled();
    });

    it('agricultural context is exempt from safety flagging (kill pests, spray poison on insects)', async () => {
      expect(checkContentSafety('spray pesticide to kill pests on tomato').isViolating).toBe(false);
      expect(checkContentSafety('rat poison for warehouse rodent control').isViolating).toBe(false);
      expect(checkContentSafety('పురుగులను చంపడానికి ఏ మందు వాడాలి?').isViolating).toBe(false);
      expect(checkContentSafety('कीटों को मारने के लिए कीटनाशक स्प्रे').isViolating).toBe(false);
    });

    it('off-topic queries (What is money?) receive polite localized scope explanation without warning or block', async () => {
      sessionsMap.set('+919876543210', {
        phoneNumber: '+919876543210',
        rawFrom: '919876543210',
        preferredLanguage: 'te-IN',
        languageSelectedExplicitly: true,
      });

      const sendMock = (service as any).sendTextMessage as any;
      sendMock.mockClear();

      await service.handleIncomingWhatsAppCloudMessage(
        '919876543210',
        'What is money?',
        '104239857281928',
      );

      const session = sessionsMap.get('+919876543210');
      expect(session.blocked).toBeFalsy();
      expect(session.warningCount).toBeFalsy();
      expect(mockGroundedService.generateGroundedAnswer).not.toHaveBeenCalled();
      expect(sendMock).toHaveBeenCalledWith(
        '919876543210',
        '104239857281928',
        expect.stringContaining('AgriSeva-AI వ్యవసాయ సహాయకుడు'),
      );
    });

    it('getThreads retrieves real conversations from MongoDB and maps farmer names for authenticated user', async () => {
      const mockUser: IUser = {
        _id: new ObjectId(),
        firebaseUID: 'fb_ramesh',
        email: 'ramesh@example.com',
        firstName: 'Ramesh',
        lastName: 'Patel',
        role: 'user',
        mobile: '+919876543210',
        farmerProfile: { phone: '+919876543210' },
      };

      sessionsMap.set('+919876543210', {
        phoneNumber: '+919876543210',
        rawFrom: '919876543210',
        userName: 'Ramesh Patel',
        preferredLanguage: 'te-IN',
        lastMessageAt: new Date('2026-10-05T10:00:00Z'),
        history: [
          { role: 'user', content: 'What is tomato price?', timestamp: new Date('2026-10-05T09:59:00Z') },
          { role: 'assistant', content: 'Tomato is ₹22/kg', timestamp: new Date('2026-10-05T10:00:00Z') },
        ],
      });

      const threads = await service.getThreads(mockUser);
      expect(threads).toBeDefined();
      expect(threads.length).toBe(1);
      expect(threads[0].phoneNumber).toBe('+919876543210');
      expect(threads[0].farmerName).toBe('Ramesh Patel');
      expect(threads[0].lastMessage).toBe('Tomato is ₹22/kg');
      expect(threads[0].language).toBe('te-IN');
      expect(threads[0].unreadCount).toBe(0);
    });

    it('getThreadDetails retrieves full chronological message history with media for conversation owner', async () => {
      const mockUser: IUser = {
        _id: new ObjectId(),
        firebaseUID: 'fb_ramesh',
        email: 'ramesh@example.com',
        firstName: 'Ramesh',
        lastName: 'Patel',
        role: 'user',
        mobile: '+919876543210',
        farmerProfile: { phone: '+919876543210' },
      };

      sessionsMap.set('+919876543210', {
        phoneNumber: '+919876543210',
        rawFrom: '919876543210',
        userName: 'Ramesh Patel',
        preferredLanguage: 'te-IN',
        history: [
          {
            role: 'user',
            content: 'Crop image problem',
            msgType: 'image',
            mediaUrl: 'data:image/jpeg;base64,abc123mock',
            timestamp: new Date('2026-10-05T09:00:00Z'),
          },
          {
            role: 'assistant',
            content: 'Diagnosed as early blight.',
            timestamp: new Date('2026-10-05T09:01:00Z'),
          },
          {
            role: 'expert',
            content: '👨‍🌾 [Expert Reply] Please spray Mancozeb @ 2g/L.',
            timestamp: new Date('2026-10-05T09:10:00Z'),
          },
        ],
      });

      const messages = await service.getThreadDetails(mockUser, '+919876543210', 'all');
      expect(messages.length).toBe(3);
      expect(messages[0].role).toBe('user');
      expect(messages[0].msgType).toBe('image');
      expect(messages[0].mediaUrl).toBe('data:image/jpeg;base64,abc123mock');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('expert');
    });

    it('multi-user test: User A only sees User A conversations, User B only sees User B conversations', async () => {
      const userAId = new ObjectId();
      const userBId = new ObjectId();

      const userA: IUser = {
        _id: userAId,
        firebaseUID: 'fb_user_a',
        email: 'userA@example.com',
        firstName: 'Farmer',
        lastName: 'A',
        role: 'user',
        mobile: '+919876543210',
        farmerProfile: { phone: '+919876543210' },
      };

      const userB: IUser = {
        _id: userBId,
        firebaseUID: 'fb_user_b',
        email: 'userB@example.com',
        firstName: 'Farmer',
        lastName: 'B',
        role: 'user',
        mobile: '+919123456780',
        farmerProfile: { phone: '+919123456780' },
      };

      sessionsMap.clear();

      // Session A belongs to User A (Tomato inquiry)
      sessionsMap.set('+919876543210', {
        _id: new ObjectId(),
        phoneNumber: '+919876543210',
        rawFrom: '919876543210',
        userId: userAId.toString(),
        userName: 'Farmer A',
        history: [
          { role: 'user', content: 'Tomato inquiry', timestamp: new Date('2026-10-05T10:00:00Z') },
        ],
      });

      // Session B belongs to User B (Cotton inquiry)
      sessionsMap.set('+919123456780', {
        _id: new ObjectId(),
        phoneNumber: '+919123456780',
        rawFrom: '919123456780',
        userId: userBId.toString(),
        userName: 'Farmer B',
        history: [
          { role: 'user', content: 'Cotton inquiry', timestamp: new Date('2026-10-05T10:05:00Z') },
        ],
      });

      // User A queries threads
      const threadsA = await service.getThreads(userA);
      expect(threadsA.length).toBe(1);
      expect(threadsA[0].phoneNumber).toBe('+919876543210');
      expect(threadsA[0].lastMessage).toBe('Tomato inquiry');
      // User A never sees Cotton
      expect(threadsA.some((t) => t.phoneNumber === '+919123456780')).toBe(false);

      // User B queries threads
      const threadsB = await service.getThreads(userB);
      expect(threadsB.length).toBe(1);
      expect(threadsB[0].phoneNumber).toBe('+919123456780');
      expect(threadsB[0].lastMessage).toBe('Cotton inquiry');
      // User B never sees Tomato
      expect(threadsB.some((t) => t.phoneNumber === '+919876543210')).toBe(false);
    });

    it('security check: User A attempting to access User B thread details is blocked with 403 Forbidden', async () => {
      const userAId = new ObjectId();
      const userBId = new ObjectId();

      const userA: IUser = {
        _id: userAId,
        firebaseUID: 'fb_user_a',
        email: 'userA@example.com',
        firstName: 'Farmer',
        lastName: 'A',
        role: 'user',
        mobile: '+919876543210',
      };

      sessionsMap.clear();

      // Session B belongs to User B
      sessionsMap.set('+919123456780', {
        _id: new ObjectId(),
        phoneNumber: '+919123456780',
        rawFrom: '919123456780',
        userId: userBId.toString(),
        userName: 'Farmer B',
        history: [
          { role: 'user', content: 'Confidential cotton crop health', timestamp: new Date() },
        ],
      });

      // User A directly requests User B's thread details
      await expect(service.getThreadDetails(userA, '+919123456780', 'all')).rejects.toThrow(
        /not authorized to access this conversation/i,
      );
    });

    it('admin / moderator role separation: authorized staff can view all conversations across farmers', async () => {
      const adminUser: IUser = {
        _id: new ObjectId(),
        firebaseUID: 'fb_admin',
        email: 'admin@agriseva.org',
        firstName: 'System',
        lastName: 'Admin',
        role: 'admin',
      };

      sessionsMap.clear();
      sessionsMap.set('+919876543210', {
        phoneNumber: '+919876543210',
        rawFrom: '919876543210',
        userName: 'Farmer A',
        history: [{ role: 'user', content: 'Tomato inquiry', timestamp: new Date() }],
      });
      sessionsMap.set('+919123456780', {
        phoneNumber: '+919123456780',
        rawFrom: '919123456780',
        userName: 'Farmer B',
        history: [{ role: 'user', content: 'Cotton inquiry', timestamp: new Date() }],
      });

      const allThreads = await service.getThreads(adminUser);
      expect(allThreads.length).toBe(2);
      expect(allThreads.map((t) => t.phoneNumber)).toContain('+919876543210');
      expect(allThreads.map((t) => t.phoneNumber)).toContain('+919123456780');

      // Admin can view details of any thread
      const messagesA = await service.getThreadDetails(adminUser, '+919876543210', 'all');
      expect(messagesA.length).toBe(1);
      const messagesB = await service.getThreadDetails(adminUser, '+919123456780', 'all');
      expect(messagesB.length).toBe(1);
    });

    it('search is strictly user-scoped for normal farmers', async () => {
      const userAId = new ObjectId();
      const userBId = new ObjectId();

      const userA: IUser = {
        _id: userAId,
        firebaseUID: 'fb_user_a',
        email: 'userA@example.com',
        firstName: 'Farmer',
        lastName: 'A',
        role: 'user',
        mobile: '+919876543210',
      };

      sessionsMap.clear();
      // User A session with "pesticide"
      sessionsMap.set('+919876543210', {
        phoneNumber: '+919876543210',
        rawFrom: '919876543210',
        userId: userAId.toString(),
        userName: 'Farmer A',
        history: [{ role: 'user', content: 'Need tomato pesticide', timestamp: new Date() }],
      });
      // User B session also with "pesticide"
      sessionsMap.set('+919123456780', {
        phoneNumber: '+919123456780',
        rawFrom: '919123456780',
        userId: userBId.toString(),
        userName: 'Farmer B',
        history: [{ role: 'user', content: 'Need cotton pesticide', timestamp: new Date() }],
      });

      const results = await service.getThreads(userA, undefined, undefined, 'pesticide');
      expect(results.length).toBe(1);
      expect(results[0].phoneNumber).toBe('+919876543210');
      expect(results[0].lastMessage).toBe('Need tomato pesticide');
    });

    it('sendMessage dispatches message and appends to session history', async () => {
      mockUserRepo.findById.mockResolvedValueOnce({
        _id: new ObjectId(),
        firstName: 'Dr. Sunita',
        lastName: 'Sharma',
        role: 'pae_expert',
      });

      sessionsMap.set('+919876543210', {
        phoneNumber: '+919876543210',
        rawFrom: '919876543210',
        history: [],
      });

      await service.sendMessage('user_123', '+919876543210', 'Recommended watering schedule is 2x weekly.');

      const session = sessionsMap.get('+919876543210');
      expect(session).toBeDefined();
      expect(session.history.length).toBe(1);
      expect(session.history[0].role).toBe('expert');
      expect(session.history[0].content).toContain('Recommended watering schedule');
    });
  });

  describe('Comprehensive 10-Point Language Switch & Pipeline Matrix (Requirement 19)', () => {
    let service: WhatsAppService;
    let mockUserRepo: any;
    let mockDb: any;
    let mockGroundedService: any;
    let mockContextService: any;
    let mockSessionsCol: any;
    let mockUsersCol: any;
    let sessionsMap: Map<string, any>;
    let usersMap: Map<string, any>;

    beforeEach(() => {
      sessionsMap = new Map();
      usersMap = new Map();

      mockSessionsCol = {
        findOne: vi.fn().mockImplementation(async (query: any) => {
          const phone = query.$or?.[0]?.phoneNumber || query.phoneNumber;
          return sessionsMap.get(phone) || null;
        }),
        updateOne: vi.fn().mockImplementation(async (filter: any, update: any, options: any) => {
          const phone = filter.phoneNumber;
          let current = sessionsMap.get(phone) || {};
          if (update.$set) current = { ...current, ...update.$set };
          sessionsMap.set(phone, current);
          return { acknowledged: true, modifiedCount: 1, upsertedCount: options?.upsert ? 1 : 0 };
        }),
      };

      mockUsersCol = {
        findOne: vi.fn().mockImplementation(async () => null),
        updateOne: vi.fn().mockImplementation(async (filter: any, update: any) => {
          const mobile = filter.mobile || (filter._id ? filter._id.toString() : null);
          let current = usersMap.get(mobile) || {};
          if (update.$set) current = { ...current, ...update.$set };
          usersMap.set(mobile, current);
          return { acknowledged: true, modifiedCount: 1 };
        }),
        insertOne: vi.fn().mockImplementation(async (doc: any) => {
          const id = new ObjectId();
          usersMap.set(doc.mobile, { ...doc, _id: id });
          return { acknowledged: true, insertedId: id };
        }),
      };

      mockDb = {
        getCollection: vi.fn().mockImplementation(async (colName: string) => {
          if (colName === 'whatsapp_sessions') return mockSessionsCol;
          if (colName === 'users') return mockUsersCol;
          return {
            findOne: vi.fn().mockResolvedValue(null),
            insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
            updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
          };
        }),
      };

      mockGroundedService = {
        generateGroundedAnswer: vi.fn().mockImplementation(async (params: any) => {
          return {
            questionId: 'q-test-matrix',
            answer: `[ADVISORY ANSWER in ${params.language}] Proper fertilizer dosage for crops.`,
            confidence: 'high',
            status: 'grounded',
            sources: [],
            language: params.language,
          };
        }),
      };

      mockContextService = {
        translate: vi.fn().mockImplementation(async (text: string, lang: string) => {
          return { translated_text: `[TRANSLATED TO ${lang}] ${text}` };
        }),
      };

      mockUserRepo = {
        findById: vi.fn().mockResolvedValue(null),
        findOne: vi.fn().mockResolvedValue(null),
      };

      service = new WhatsAppService(
        mockUserRepo,
        mockDb,
        mockGroundedService,
        mockContextService,
      );

      vi.spyOn<any, any>(service, 'sendTextMessage').mockResolvedValue({ message_id: 'out_msg_test' });
      vi.spyOn<any, any>(service, 'sendInteractiveListMessage').mockResolvedValue({ message_id: 'out_list_test' });
    });

    it('unit: matchLanguageChoice accurately parses shortcuts, native scripts, formatted options and phrases', () => {
      // 1. Digit shortcuts
      expect(matchLanguageChoice('1')).toBe('te-IN');
      expect(matchLanguageChoice('2')).toBe('hi-IN');
      expect(matchLanguageChoice('3')).toBe('ta-IN');
      expect(matchLanguageChoice('4')).toBe('kn-IN');
      expect(matchLanguageChoice('5')).toBe('en-IN');
      expect(matchLanguageChoice('6')).toBe('mr-IN');
      expect(matchLanguageChoice('7')).toBe('bn-IN');
      expect(matchLanguageChoice('8')).toBe('gu-IN');
      expect(matchLanguageChoice('9')).toBe('pa-IN');
      expect(matchLanguageChoice('10')).toBe('ml-IN');

      // 2. Interactive list IDs
      expect(matchLanguageChoice('lang_te-IN')).toBe('te-IN');
      expect(matchLanguageChoice('lang_hi-IN')).toBe('hi-IN');
      expect(matchLanguageChoice('lang_ta-IN')).toBe('ta-IN');

      // 3. Formatted list lines
      expect(matchLanguageChoice('1. Telugu')).toBe('te-IN');
      expect(matchLanguageChoice('2 - हिन्दी')).toBe('hi-IN');
      expect(matchLanguageChoice('3) தமிழ்')).toBe('ta-IN');
      expect(matchLanguageChoice('4. Kannada')).toBe('kn-IN');

      // 4. Standalone native scripts & names
      expect(matchLanguageChoice('తెలుగు')).toBe('te-IN');
      expect(matchLanguageChoice('हिन्दी')).toBe('hi-IN');
      expect(matchLanguageChoice('தமிழ்')).toBe('ta-IN');
      expect(matchLanguageChoice('ಕನ್ನಡ')).toBe('kn-IN');
      expect(matchLanguageChoice('english')).toBe('en-IN');
      expect(matchLanguageChoice('Marathi')).toBe('mr-IN');
      expect(matchLanguageChoice('বাংলা')).toBe('bn-IN');
      expect(matchLanguageChoice('ગુજરાતી')).toBe('gu-IN');
      expect(matchLanguageChoice('ਪੰਜਾਬੀ')).toBe('pa-IN');
      expect(matchLanguageChoice('മലയാളം')).toBe('ml-IN');
      expect(matchLanguageChoice('ଓଡ଼ିଆ')).toBe('od-IN');

      // 5. Switching phrases
      expect(matchLanguageChoice('switch to telugu')).toBe('te-IN');
      expect(matchLanguageChoice('change language to hindi')).toBe('hi-IN');
      expect(matchLanguageChoice('set to tamil')).toBe('ta-IN');

      // 6. Non-language inputs return null
      expect(matchLanguageChoice('1 kg urea')).toBeNull();
      expect(matchLanguageChoice('how to control tomato blight')).toBeNull();
    });

    it('unit: isExplicitLanguageNameChoice differentiates language picks from questions', () => {
      expect(isExplicitLanguageNameChoice('Telugu')).toBe(true);
      expect(isExplicitLanguageNameChoice('Hindi')).toBe(true);
      expect(isExplicitLanguageNameChoice('தமிழ்')).toBe(true);
      expect(isExplicitLanguageNameChoice('switch to telugu')).toBe(true);
      expect(isExplicitLanguageNameChoice('1. Telugu')).toBe(true);

      // Agricultural queries mentioning language or numbers should return false
      expect(isExplicitLanguageNameChoice('1 kg urea fertilizer')).toBe(false);
      expect(isExplicitLanguageNameChoice('Tomato crop disease in Telugu')).toBe(false);
      expect(isExplicitLanguageNameChoice('What is paddy leaf disease in Hindi')).toBe(false);
    });

    it('test matrix: sequential repeated language switching (EN -> TE -> TA -> HI -> EN)', async () => {
      const phone = '919876543299';
      const phoneId = '104239857281928';

      // 1. Initial Selection: English
      sessionsMap.set('+919876543299', {
        phoneNumber: '+919876543299',
        rawFrom: phone,
        preferredLanguage: 'en-IN',
        languageSelectedExplicitly: true,
      });

      // Question 1 in English -> Expect English RAG
      await service.handleIncomingWhatsAppCloudMessage(phone, 'What is the dosage for neem oil spray on tomatoes?', phoneId);
      expect(mockGroundedService.generateGroundedAnswer).toHaveBeenLastCalledWith(
        expect.objectContaining({ language: 'en-IN' }),
      );

      // 2. Switch to Telugu
      await service.handleIncomingWhatsAppCloudMessage(phone, 'Telugu', phoneId);
      expect(sessionsMap.get('+919876543299').preferredLanguage).toBe('te-IN');

      // Question 2 in Telugu -> Expect Telugu RAG
      await service.handleIncomingWhatsAppCloudMessage(phone, 'టమోటాలో ఆకుముడత నివారణ ఏమిటి?', phoneId);
      expect(mockGroundedService.generateGroundedAnswer).toHaveBeenLastCalledWith(
        expect.objectContaining({ language: 'te-IN' }),
      );

      // 3. Switch to Tamil
      await service.handleIncomingWhatsAppCloudMessage(phone, 'Tamil', phoneId);
      expect(sessionsMap.get('+919876543299').preferredLanguage).toBe('ta-IN');

      // Question 3 in Tamil -> Expect Tamil RAG
      await service.handleIncomingWhatsAppCloudMessage(phone, 'தக்காளி இலை சுருட்டை நோய்க்கான சிகிச்சை என்ன?', phoneId);
      expect(mockGroundedService.generateGroundedAnswer).toHaveBeenLastCalledWith(
        expect.objectContaining({ language: 'ta-IN' }),
      );

      // 4. Switch to Hindi
      await service.handleIncomingWhatsAppCloudMessage(phone, 'Hindi', phoneId);
      expect(sessionsMap.get('+919876543299').preferredLanguage).toBe('hi-IN');

      // Question 4 in Hindi -> Expect Hindi RAG
      await service.handleIncomingWhatsAppCloudMessage(phone, 'टमाटर में पत्ती मरोड़ रोग की रोकथाम कैसे करें?', phoneId);
      expect(mockGroundedService.generateGroundedAnswer).toHaveBeenLastCalledWith(
        expect.objectContaining({ language: 'hi-IN' }),
      );

      // 5. Switch back to English
      await service.handleIncomingWhatsAppCloudMessage(phone, 'English', phoneId);
      expect(sessionsMap.get('+919876543299').preferredLanguage).toBe('en-IN');

      // Question 5 in English -> Expect English RAG
      await service.handleIncomingWhatsAppCloudMessage(phone, 'What is the market price of onion in Nashik?', phoneId);
      expect(mockGroundedService.generateGroundedAnswer).toHaveBeenLastCalledWith(
        expect.objectContaining({ language: 'en-IN' }),
      );
    });

    it('test matrix: cross-language input respects selected language strictly (Requirement 4)', async () => {
      const phone = '919876543288';
      const phoneId = '104239857281928';

      // User has chosen Telugu
      sessionsMap.set('+919876543288', {
        phoneNumber: '+919876543288',
        rawFrom: phone,
        preferredLanguage: 'te-IN',
        languageSelectedExplicitly: true,
      });

      // Farmer types question in ENGLISH: "How much urea should I apply for 1 acre paddy?"
      await service.handleIncomingWhatsAppCloudMessage(phone, 'How much urea should I apply for 1 acre paddy?', phoneId);

      // The pipeline MUST send language: 'te-IN' to GroundedAnswerService!
      expect(mockGroundedService.generateGroundedAnswer).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: 'How much urea should I apply for 1 acre paddy?',
          language: 'te-IN',
        }),
      );

      // The final outbound response must use Telugu prefix
      expect((service as any).sendTextMessage).toHaveBeenLastCalledWith(
        phone,
        phoneId,
        expect.stringContaining('AgriSeva-AI సలహా'),
      );
    });

    it('test matrix: crop disease image processing adheres to selected language (Requirement 7 & 19)', async () => {
      const phone = '919876543277';
      const phoneId = '104239857281928';

      // User has selected Hindi
      sessionsMap.set('+919876543277', {
        phoneNumber: '+919876543277',
        rawFrom: phone,
        preferredLanguage: 'hi-IN',
        languageSelectedExplicitly: true,
      });

      // Mock image download & multimodal vision
      vi.spyOn<any, any>(service, 'downloadMetaMedia').mockResolvedValue({ buffer: Buffer.from('fake_image_bytes') });
      vi.spyOn<any, any>(service, 'processCropImage').mockResolvedValue('फसल में अगेती झुलसा रोग के लक्षण हैं। मैन्कोजेब 2 ग्राम प्रति लीटर पानी में मिलाकर छिड़काव करें।');

      await service.handleIncomingWhatsAppCloudMessage(
        phone,
        '',
        phoneId,
        {
          msgType: 'image',
          image: { id: 'media_img_999', mime_type: 'image/jpeg', caption: 'What disease is this?' },
        },
      );

      // Verify image was diagnosed using Hindi language
      expect((service as any).processCropImage).toHaveBeenCalledWith(
        expect.any(Buffer),
        'image/jpeg',
        'What disease is this?',
        'hi-IN',
      );

      // Verify Hindi crop diagnosis header is sent
      expect((service as any).sendTextMessage).toHaveBeenCalledWith(
        phone,
        phoneId,
        expect.stringContaining('🌱 *AgriSeva-AI फसल रोग निदान*'),
      );
    });

    it('test matrix: voice note audio query adheres to selected language (Requirement 7 & 19)', async () => {
      const phone = '919876543266';
      const phoneId = '104239857281928';

      // User has selected Telugu
      sessionsMap.set('+919876543266', {
        phoneNumber: '+919876543266',
        rawFrom: phone,
        preferredLanguage: 'te-IN',
        languageSelectedExplicitly: true,
      });

      // Mock audio download & transcription
      vi.spyOn<any, any>(service, 'downloadMetaMedia').mockResolvedValue({ buffer: Buffer.from('fake_audio_bytes') });
      vi.spyOn<any, any>(service, 'transcribeAudio').mockResolvedValue('వరిలో కాండం తొలుచు పురుగు నివారణ ఏమిటి?');

      await service.handleIncomingWhatsAppCloudMessage(
        phone,
        '',
        phoneId,
        {
          msgType: 'audio',
          audio: { id: 'media_audio_888', mime_type: 'audio/ogg' },
        },
      );

      // Verify audio transcribed using Telugu language
      expect((service as any).transcribeAudio).toHaveBeenCalledWith(
        expect.any(Buffer),
        'audio/ogg',
        'te-IN',
      );

      // Verify GroundedAnswer called with Telugu
      expect(mockGroundedService.generateGroundedAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'వరిలో కాండం తొలుచు పురుగు నివారణ ఏమిటి?',
          language: 'te-IN',
        }),
      );
    });

    it('test matrix: off-topic query in selected language receives polite localized scope message', async () => {
      const phone = '919876543255';
      const phoneId = '104239857281928';

      // User has selected Telugu
      sessionsMap.set('+919876543255', {
        phoneNumber: '+919876543255',
        rawFrom: phone,
        preferredLanguage: 'te-IN',
        languageSelectedExplicitly: true,
      });

      await service.handleIncomingWhatsAppCloudMessage(phone, 'Who won the cricket match yesterday?', phoneId);

      // Should send localized Telugu off-topic message
      expect((service as any).sendTextMessage).toHaveBeenCalledWith(
        phone,
        phoneId,
        expect.stringContaining('వ్యవసాయ సహాయకుడు'),
      );
      expect(mockGroundedService.generateGroundedAnswer).not.toHaveBeenCalled();
    });

    it('test matrix: menu open vs chat state for shortcut "1"', async () => {
      const phone = '919876543244';
      const phoneId = '104239857281928';

      // User is chatting normally in English
      sessionsMap.set('+919876543244', {
        phoneNumber: '+919876543244',
        rawFrom: phone,
        preferredLanguage: 'en-IN',
        languageSelectedExplicitly: true,
        awaitingLanguageSelection: false,
      });

      // 1. User types "1" while chatting -> Opens Language Menu
      await service.handleIncomingWhatsAppCloudMessage(phone, '1', phoneId);
      expect((service as any).sendInteractiveListMessage).toHaveBeenCalled();
      expect(sessionsMap.get('+919876543244').awaitingLanguageSelection).toBe(true);

      // 2. Now menu is open (awaitingLanguageSelection = true). User types "1" to pick Option 1: Telugu!
      await service.handleIncomingWhatsAppCloudMessage(phone, '1', phoneId);
      expect(sessionsMap.get('+919876543244').preferredLanguage).toBe('te-IN');
      expect(sessionsMap.get('+919876543244').awaitingLanguageSelection).toBe(false);
      expect((service as any).sendTextMessage).toHaveBeenCalledWith(
        phone,
        phoneId,
        expect.stringContaining('తెలుగు'),
      );
    });
  });

});
