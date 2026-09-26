import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroundedAnswerService } from '../services/GroundedAnswerService.js';
import type { GroundedAnswerResponse } from '../interfaces/IGroundedAnswerService.js';

describe('Multilingual Agent Interface Language Pipeline Tests', () => {
  let groundedService: GroundedAnswerService;

  const mockDb = {
    getCollection: vi.fn().mockImplementation(async (colName: string) => {
      if (colName === 'market_prices') {
        return {
          find: () => ({
            sort: () => ({
              limit: () => ({
                toArray: async () => [
                  {
                    commodity: 'Cotton',
                    crop: 'Cotton',
                    market: 'Warangal',
                    state: 'Telangana',
                    modalPrice: 7200,
                    unit: '₹/quintal',
                    arrivalDate: '2026-09-20',
                    source: 'agmarknet',
                  }
                ],
              }),
            }),
          }),
        };
      }
      if (colName === 'buyers') {
        return {
          find: () => ({
            limit: () => ({
              toArray: async () => [],
            }),
          }),
        };
      }
      if (colName === 'questions') {
        return {
          find: () => ({
            limit: () => ({
              toArray: async () => [],
            }),
          }),
        };
      }
      return {
        find: () => ({
          sort: () => ({ limit: () => ({ toArray: async () => [] }) }),
          limit: () => ({ toArray: async () => [] }),
        }),
      };
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    groundedService = new GroundedAnswerService(mockDb as any);
  });

  it('1. Returns Telugu expert review message when insufficient evidence exists for Telugu query', async () => {
    const res = await groundedService.generateGroundedAnswer({
      questionId: 'TEST_TE_001',
      query: 'వరి పంటలో ఆకు ఎండు తెగులు నివారణ ఏమిటి?',
      language: 'te-IN',
      crop: 'Rice',
      state: 'Andhra Pradesh',
    });

    expect(res.status).toBe('expert_review');
    expect(res.language).toBe('te-IN');
    expect(res.answer).toMatch(/వ్యవసాయ నిపుణుల/);
    expect(res.answer).not.toContain('Your query has been routed to an agricultural expert');
  });

  it('2. Returns Tamil expert review message when insufficient evidence exists for Tamil query', async () => {
    const res = await groundedService.generateGroundedAnswer({
      questionId: 'TEST_TA_002',
      query: 'நெல் பயிரில் இலை கருகல் நோய் கட்டுப்பாடு என்ன?',
      language: 'ta-IN',
      crop: 'Paddy',
      state: 'Tamil Nadu',
    });

    expect(res.status).toBe('expert_review');
    expect(res.language).toBe('ta-IN');
    expect(res.answer).toMatch(/வேளாண் நிபுணர்/);
    expect(res.answer).not.toContain('Your query has been routed to an agricultural expert');
  });

  it('3. Returns Hindi expert review message when insufficient evidence exists for Hindi query', async () => {
    const res = await groundedService.generateGroundedAnswer({
      questionId: 'TEST_HI_003',
      query: 'धान की फसल में झुलसा रोग का क्या उपाय है?',
      language: 'hi-IN',
      crop: 'Rice',
      state: 'Uttar Pradesh',
    });

    expect(res.status).toBe('expert_review');
    expect(res.language).toBe('hi-IN');
    expect(res.answer).toMatch(/कृषि विशेषज्ञ/);
    expect(res.answer).not.toContain('Your query has been routed to an agricultural expert');
  });

  it('4. Returns Urdu expert review message when insufficient evidence exists for Urdu query', async () => {
    const res = await groundedService.generateGroundedAnswer({
      questionId: 'TEST_UR_004',
      query: 'چاول کی فصل میں بیماری کا کیا علاج ہے؟',
      language: 'ur-IN',
      crop: 'Rice',
      state: 'Telangana',
    });

    expect(res.status).toBe('expert_review');
    expect(res.language).toBe('ur-IN');
    expect(res.answer).toMatch(/زرعی ماہر/);
    expect(res.answer).not.toContain('Your query has been routed to an agricultural expert');
  });

  it('5. Returns Kannada expert review message when insufficient evidence exists for Kannada query', async () => {
    const res = await groundedService.generateGroundedAnswer({
      questionId: 'TEST_KN_005',
      query: 'ಭತ್ತದ ಬೆಳೆಯಲ್ಲಿ ರೋಗ ನಿಯಂತ್ರಣ ಹೇಗೆ?',
      language: 'kn-IN',
      crop: 'Paddy',
      state: 'Karnataka',
    });

    expect(res.status).toBe('expert_review');
    expect(res.language).toBe('kn-IN');
    expect(res.answer).toMatch(/ಕೃಷಿ ತಜ್ಞರ/);
    expect(res.answer).not.toContain('Your query has been routed to an agricultural expert');
  });

  it('6. Returns Telugu localized market price when queried in Telugu', async () => {
    const res = await groundedService.generateGroundedAnswer({
      questionId: 'TEST_MKT_TE_006',
      query: 'వరంగల్ లో పత్తి మార్కెట్ ధర ఎంత? market price of cotton',
      language: 'te-IN',
      crop: 'Cotton',
      state: 'Telangana',
    });

    expect(res.status).toBe('calculated');
    expect(res.answer).toContain('7200');
    expect(res.answer).toContain('ధర');
  });

  it('7. Enforces chemical safety warning in Telugu when pesticide query is processed', async () => {
    const res = await groundedService.generateGroundedAnswer({
      questionId: 'TEST_CHEM_TE_007',
      query: 'వరిలో పురుగుల నివారణకు మోనోక్రోటోఫాస్ ఎంత మోతాదులో స్ప్రే చేయాలి? chemical dosage',
      language: 'te-IN',
      crop: 'Rice',
      state: 'Andhra Pradesh',
    });

    expect(res.status).toBe('expert_review');
    expect(res.answer).toContain('రసాయన/పురుగుల మందుకు సంబంధించిన అధికారిక మోతాదు');
    expect(res.answer).not.toContain('Chemical Safety Advisory:');
  });
});
