import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlivoService } from '../services/PlivoService.js';
import { PlivoController } from '../controllers/PlivoController.js';
import type { ICallDetailsRepository } from '#root/shared/database/interfaces/ICallDetailsRepository.js';
import type { IFarmerService } from '../services/FarmerService.js';
import type { IGroundedAnswerService } from '#root/modules/groundedAnswer/interfaces/IGroundedAnswerService.js';

describe('Plivo Telephony AI Voice Agent', () => {
  let mockCallDetailsRepo: Partial<ICallDetailsRepository>;
  let mockFarmerService: Partial<IFarmerService>;
  let mockGroundedAnswerService: Partial<IGroundedAnswerService>;
  let plivoService: PlivoService;
  let plivoController: PlivoController;

  beforeEach(() => {
    mockCallDetailsRepo = {
      create: vi.fn().mockResolvedValue('test_id_123'),
      updateCallDetails: vi.fn().mockResolvedValue(undefined),
      getByCallUuid: vi.fn().mockResolvedValue(null),
    };

    mockFarmerService = {
      getFarmerByPhoneNo: vi.fn().mockResolvedValue(null),
      createFarmer: vi.fn().mockResolvedValue('new_farmer_id'),
      updateFarmer: vi.fn().mockResolvedValue(true),
    };

    mockGroundedAnswerService = {
      generateGroundedAnswer: vi.fn().mockResolvedValue({
        questionId: 'q_1',
        answer: '**Pest Recommendation:** For brown spot in tomatoes, spray Chlorothalonil 75% WP at 2g/litre of water. Maintain proper drainage.',
        confidence: 'high',
        status: 'grounded',
        sources: [],
        warnings: [],
        language: 'te-IN',
        generatedAt: new Date().toISOString(),
      }),
    };

    plivoService = new PlivoService(mockCallDetailsRepo as ICallDetailsRepository);
    plivoController = new PlivoController(
      mockCallDetailsRepo as ICallDetailsRepository,
      {} as any,
      plivoService,
      mockFarmerService as IFarmerService,
      mockGroundedAnswerService as IGroundedAnswerService
    );
  });

  describe('PlivoService Telephony Helpers', () => {
    it('creates, retrieves, and updates an active call session', () => {
      const session = plivoService.getOrCreateCallSession('call-uuid-1', '+919182417061', 'te-IN');
      expect(session).toBeDefined();
      expect(session.callUuid).toBe('call-uuid-1');
      expect(session.language).toBe('te-IN');

      plivoService.addCallTurn('call-uuid-1', 'farmer', 'టమోటా ధర ఎంత?');
      plivoService.addCallTurn('call-uuid-1', 'assistant', 'టమోటా క్వింటాల్ ధర 1800 రూపాయలు.');

      const updated = plivoService.getCallSession('call-uuid-1');
      expect(updated?.turns.length).toBe(2);
      expect(updated?.turns[0].role).toBe('farmer');
      expect(updated?.turns[1].role).toBe('assistant');
    });

    it('returns appropriate language configurations for Indian languages', () => {
      const teConfig = plivoService.getLanguageConfig('te-IN');
      expect(teConfig.code).toBe('te-IN');
      expect(teConfig.greeting).toContain('అగ్రిసేవ-AI');

      const hiConfig = plivoService.getLanguageConfig('hi-IN');
      expect(hiConfig.code).toBe('hi-IN');
      expect(hiConfig.greeting).toContain('एग्रीसेवा-एआई');

      const enConfig = plivoService.getLanguageConfig('en-IN');
      expect(enConfig.code).toBe('en-IN');
      expect(enConfig.greeting).toContain('Welcome to AgriSeva-AI');
    });

    it('cleans markdown and long technical outputs into telephony-spoken prose', () => {
      const raw = '**Pest Treatment:** Use [Neem Oil](http://example.com) at 5ml/litre. *Spray in late evening* to protect pollinators.';
      const clean = plivoService.formatTextForSpeech(raw);

      expect(clean).not.toContain('**');
      expect(clean).not.toContain('http://');
      expect(clean).not.toContain('*');
      expect(clean).toContain('Neem Oil at 5ml/litre');
    });

    it('properly escapes XML special characters', () => {
      const unsafe = 'Tomato & Chilli <disease> "blast"';
      const escaped = plivoService.escapeXml(unsafe);
      expect(escaped).toBe('Tomato &amp; Chilli &lt;disease&gt; &quot;blast&quot;');
    });
  });

  describe('PlivoController Inbound Call Handlers', () => {
    it('answers call with spoken language menu for first-time caller without saved language', async () => {
      let sentXml = '';
      const req = {
        body: {
          CallUUID: 'call-uuid-new-1',
          From: '+919876543210',
          To: '+919182417061',
        },
        headers: {},
        protocol: 'https',
        get: () => 'api.agriseva.org',
      } as any;

      const res = {
        set: vi.fn(),
        send: vi.fn((xml: string) => { sentXml = xml; }),
        status: vi.fn().mockReturnThis(),
      } as any;

      await plivoController.answer(req, res);

      expect(res.set).toHaveBeenCalledWith('Content-Type', 'text/xml');
      expect(sentXml).toContain('<GetInput action="https://api.agriseva.org/api/plivo/language-menu"');
      expect(sentXml).toContain('Welcome to AgriSeva-AI. Please choose your language');
      expect(sentXml).toContain('Telugu kosam 1 nokkandi');
      expect(mockFarmerService.createFarmer).toHaveBeenCalled();
    });

    it('answers call directly in chosen language for returning farmer', async () => {
      mockFarmerService.getFarmerByPhoneNo = vi.fn().mockResolvedValue({
        phoneNo: '+919876543210',
        profile: {
          farmerName: 'Ramesh',
          languagePreference: 'te-IN',
        },
      });

      let sentXml = '';
      const req = {
        body: {
          CallUUID: 'call-uuid-returning-1',
          From: '+919876543210',
          To: '+919182417061',
        },
        headers: {},
        protocol: 'https',
        get: () => 'api.agriseva.org',
      } as any;

      const res = {
        set: vi.fn(),
        send: vi.fn((xml: string) => { sentXml = xml; }),
        status: vi.fn().mockReturnThis(),
      } as any;

      await plivoController.answer(req, res);

      expect(sentXml).toContain('<GetInput action="https://api.agriseva.org/api/plivo/speech-input"');
      expect(sentXml).toContain('నమస్కారం! అగ్రిసేవ-AI వ్యవసాయ హెల్ప్‌లైన్‌కు స్వాగతం');
    });

    it('handles language selection DTMF and persists preference in farmer profile', async () => {
      let sentXml = '';
      const req = {
        body: {
          CallUUID: 'call-uuid-menu-1',
          From: '+919876543210',
          Digits: '1', // Telugu
        },
        headers: {},
        protocol: 'https',
        get: () => 'api.agriseva.org',
      } as any;

      const res = {
        set: vi.fn(),
        send: vi.fn((xml: string) => { sentXml = xml; }),
        status: vi.fn().mockReturnThis(),
      } as any;

      await plivoController.handleLanguageMenu(req, res);

      expect(mockFarmerService.updateFarmer).toHaveBeenCalledWith(
        '+919876543210',
        expect.objectContaining({ languagePreference: 'te-IN' })
      );
      expect(sentXml).toContain('ధన్యవాదాలు. మీరు తెలుగును ఎంచుకున్నారు.');
      expect(sentXml).toContain('<GetInput action="https://api.agriseva.org/api/plivo/speech-input"');
    });

    it('processes farmer speech, queries grounded AI pipeline, and speaks answer back in multi-turn loop', async () => {
      let sentXml = '';
      const req = {
        body: {
          CallUUID: 'call-uuid-speech-1',
          From: '+919876543210',
          Speech: 'టమోటా లో మచ్చల తెగులు వస్తుంది ఏం చేయాలి?',
        },
        headers: {},
        protocol: 'https',
        get: () => 'api.agriseva.org',
      } as any;

      const res = {
        set: vi.fn(),
        send: vi.fn((xml: string) => { sentXml = xml; }),
        status: vi.fn().mockReturnThis(),
      } as any;

      // Seed session
      plivoService.getOrCreateCallSession('call-uuid-speech-1', '+919876543210', 'te-IN');

      await plivoController.handleSpeechInput(req, res);

      expect(mockGroundedAnswerService.generateGroundedAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'టమోటా లో మచ్చల తెగులు వస్తుంది ఏం చేయాలి?',
          language: 'te-IN',
        })
      );
      expect(sentXml).toContain('<GetInput action="https://api.agriseva.org/api/plivo/speech-input"');
      expect(sentXml).toContain('Chlorothalonil');
      expect(sentXml).toContain('మీ పంట లేదా మార్కెట్ గురించి ఇంకా ఏదైనా సందేహం ఉందా?');
    });

    it('gracefully hangs up when caller says farewell or bye', async () => {
      let sentXml = '';
      const req = {
        body: {
          CallUUID: 'call-uuid-bye-1',
          From: '+919876543210',
          Speech: 'చాలు ధన్యవాదాలు (thank you bye)',
        },
        headers: {},
        protocol: 'https',
        get: () => 'api.agriseva.org',
      } as any;

      const res = {
        set: vi.fn(),
        send: vi.fn((xml: string) => { sentXml = xml; }),
        status: vi.fn().mockReturnThis(),
      } as any;

      plivoService.getOrCreateCallSession('call-uuid-bye-1', '+919876543210', 'te-IN');

      await plivoController.handleSpeechInput(req, res);

      expect(sentXml).toContain('<Hangup/>');
      expect(sentXml).toContain('అగ్రిసేవ-AI కి కాల్ చేసినందుకు ధన్యవాదాలు');
    });

    it('records call details and clears active session upon hangup webhook', async () => {
      const req = {
        body: {
          CallUUID: 'call-uuid-hangup-1',
          Duration: '45',
          HangupCause: 'normal_clearing',
        },
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as any;

      // Seed session with turns
      plivoService.getOrCreateCallSession('call-uuid-hangup-1', '+919876543210', 'te-IN');
      plivoService.addCallTurn('call-uuid-hangup-1', 'farmer', 'టమోటా ధర ఎంత?');
      plivoService.addCallTurn('call-uuid-hangup-1', 'assistant', 'టమోటా క్వింటాల్ ధర 1800 రూపాయలు.');

      await plivoController.handleHangup(req, res);

      expect(mockCallDetailsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          callUuid: 'call-uuid-hangup-1',
          status: 'completed',
        })
      );
      expect(plivoService.getCallSession('call-uuid-hangup-1')).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
