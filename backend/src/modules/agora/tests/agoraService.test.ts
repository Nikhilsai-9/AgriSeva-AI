import { describe, it, expect, vi } from 'vitest';
import { AgoraService } from '../services/AgoraService.js';
import type { IGroundedAnswerService } from '../../groundedAnswer/interfaces/IGroundedAnswerService.js';

describe('AgoraService', () => {
  const mockGroundedAnswerService: IGroundedAnswerService = {
    generateGroundedAnswer: vi.fn().mockResolvedValue({
      status: 'grounded',
      confidence: 'high',
      answer: 'వరి పంటలో పసుపు రంగు ఆకులు నత్రజని లోపం వల్ల కావచ్చు. ఎకరాకు 25-30 కిలోల యూరియా వేయండి.',
      sources: [
        {
          type: 'pop',
          id: 'pop-paddy-01',
          title: 'ICAR Package of Practices - Paddy Nitrogen Management',
          reference: 'ICAR-CRRI Rice Advisory 2026',
        },
      ],
      language: 'te-IN',
    }),
  } as unknown as IGroundedAnswerService;

  const mockQuestionService: any = {
    createCanonicalQuestion: vi.fn().mockResolvedValue({
      question: {
        _id: 'q123',
        question: 'నా వరి పంటలో ఆకులు పసుపు రంగులోకి మారుతున్నాయి',
        source: 'AI_ASSISTANT',
        language: 'te-IN',
      },
      answer: 'వరి పంటలో పసుపు రంగు ఆకులు నత్రజని లోపం వల్ల కావచ్చు. ఎకరాకు 25-30 కిలోల యూరియా వేయండి.',
      confidence: 'high',
      sources: [
        {
          type: 'pop',
          id: 'pop-paddy-01',
          title: 'ICAR Package of Practices - Paddy Nitrogen Management',
          reference: 'ICAR-CRRI Rice Advisory 2026',
        },
      ],
      language: 'te-IN',
    }),
  };

  it('should generate a valid Agora RTC token for voice calling', () => {
    const service = new AgoraService(mockGroundedAnswerService, mockQuestionService);
    const result = service.generateToken('agriseva-call', 1001, 'publisher');

    expect(result.success).toBe(true);
    expect(result.channelName).toBe('agriseva-call');
    expect(result.uid).toBe(1001);
    expect(result.token).toBeDefined();
    expect(result.token.length).toBeGreaterThan(20);
    expect(result.appId).toBe('360acfc1ebd44465b9b85b7800153364');
  });

  it('should process a voice query and return grounded agricultural advice', async () => {
    const service = new AgoraService(mockGroundedAnswerService, mockQuestionService);
    const result = await service.processVoiceQuery(
      'నా వరి పంటలో ఆకులు పసుపు రంగులోకి మారుతున్నాయి',
      'te-IN',
      '+919182417061',
    );

    expect(result.success).toBe(true);
    expect(result.question).toBe('నా వరి పంటలో ఆకులు పసుపు రంగులోకి మారుతున్నాయి');
    expect(result.answer).toContain('వరి పంటలో పసుపు రంగు ఆకులు');
    expect(result.confidence).toBe('high');
    expect(result.sources).toHaveLength(1);
    expect(result.sources![0].title).toContain('ICAR Package of Practices');
  });
});
