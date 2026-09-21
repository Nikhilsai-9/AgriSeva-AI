import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroundedAnswerService } from '../services/GroundedAnswerService.js';
import type { GroundedAnswerResponse } from '../interfaces/IGroundedAnswerService.js';

describe('Production Grounded Answer-Generation Pipeline Tests', () => {
  let groundedService: GroundedAnswerService;

  // Mock collections for testing
  const mockMarketPrices = [
    {
      _id: '6aae7b9a298665c8ba68df27',
      commodity: 'Bajra(Pearl Millet/Cumbu)',
      crop: 'Bajra(Pearl Millet/Cumbu)',
      market: 'Gujarat (state aggregate)',
      state: 'Gujarat',
      modalPrice: 2371.48,
      minPrice: 2371.48,
      maxPrice: 2371.48,
      unit: '₹/quintal',
      arrivalDate: '2026-09-17',
      source: 'agmarknet',
      sourceUrl: 'http://127.0.0.1:9004/mcp',
    },
    {
      _id: '6aae7b9a298665c8ba68df29',
      commodity: 'Maize',
      crop: 'Maize',
      market: 'Gujarat (state aggregate)',
      state: 'Gujarat',
      modalPrice: 2421.81,
      minPrice: 2421.81,
      maxPrice: 2421.81,
      unit: '₹/quintal',
      arrivalDate: '2026-09-17',
      source: 'agmarknet',
      sourceUrl: 'http://127.0.0.1:9004/mcp',
    },
  ];

  const mockBuyers = [
    {
      _id: 'buyer-001',
      id: 'b1',
      businessName: 'Surat Grain Traders Syndicate',
      state: 'Gujarat',
      district: 'Surat',
      verificationStatus: 'verified',
    },
  ];

  const mockQuestions = [
    {
      _id: 'q-wheat-yellow-rust',
      question: 'TEST_QUESTION_A_001: Symptoms of yellow rust in wheat crop',
      status: 'closed',
      isGolden: true,
      answers: [
        {
          answer: 'Yellow rust appears as bright yellow pustules arranged in linear stripes along the leaf veins. Early detection and resistant varieties are advised.',
        },
      ],
      details: { crop: 'Wheat', state: 'Punjab' },
    },
    {
      _id: 'q-groundnut-water',
      question: 'TEST_QUESTION_B_002: Irrigation schedule for groundnut crop',
      status: 'verified',
      isGolden: false,
      answers: [
        {
          answer: 'Groundnut requires critical irrigations during flowering (20-25 DAS), pegging (35-45 DAS), and pod development (70-80 DAS). Avoid water stagnation.',
        },
      ],
      details: { crop: 'Groundnut', state: 'Andhra Pradesh' },
    },
  ];

  const mockDb = {
    getCollection: vi.fn().mockImplementation(async (colName: string) => {
      if (colName === 'market_prices') {
        return {
          find: (filter: any) => ({
            sort: () => ({
              limit: () => ({
                toArray: async () => {
                  if (filter.commodity) {
                    return mockMarketPrices.filter(p =>
                      filter.commodity.test ? filter.commodity.test(p.commodity) : true
                    );
                  }
                  return mockMarketPrices;
                },
              }),
            }),
          }),
        };
      }
      if (colName === 'buyers') {
        return {
          find: (filter: any) => ({
            limit: () => ({
              toArray: async () => mockBuyers,
            }),
          }),
        };
      }
      if (colName === 'questions') {
        return {
          find: (filter: any) => ({
            limit: () => ({
              toArray: async () => {
                if (filter.question) {
                  const reg = filter.question.$regex || filter.question;
                  return mockQuestions.filter(q => (reg.test ? reg.test(q.question) : true));
                }
                return mockQuestions;
              },
            }),
          }),
        };
      }
      return {
        find: () => ({
          sort: () => ({
            limit: () => ({
              toArray: async () => [],
            }),
          }),
          limit: () => ({
            toArray: async () => [],
          }),
        }),
      };
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    groundedService = new GroundedAnswerService(mockDb as any);
  });

  it('Test 1: Question A and Question B receive independent processing, separate IDs, and distinct non-reused answers', async () => {
    const qA = await groundedService.generateGroundedAnswer({
      questionId: 'Q_ID_ALPHA_001',
      query: 'TEST_QUESTION_A_001: Symptoms of yellow rust in wheat crop',
      language: 'en-IN',
    });

    const qB = await groundedService.generateGroundedAnswer({
      questionId: 'Q_ID_BETA_002',
      query: 'TEST_QUESTION_B_002: Irrigation schedule for groundnut crop',
      language: 'en-IN',
    });

    // Verify distinct identity and processing
    expect(qA.questionId).toBe('Q_ID_ALPHA_001');
    expect(qB.questionId).toBe('Q_ID_BETA_002');
    expect(qA.questionId).not.toBe(qB.questionId);

    // Verify answers are strictly distinct and question-specific
    expect(qA.answer).not.toBe(qB.answer);
    expect(qA.answer.toLowerCase()).toContain('yellow rust');
    expect(qB.answer.toLowerCase()).toContain('groundnut');

    // Verify neither received the old hardcoded Telugu static string
    expect(qA.answer).not.toContain('వ్యవసాయ నిపుణుల సలహా');
    expect(qB.answer).not.toContain('వ్యవసాయ నిపుణుల సలహా');

    // Verify schema adherence
    expect(qA.status).toBe('grounded');
    expect(qB.status).toBe('grounded');
    expect(qA.sources.length).toBeGreaterThan(0);
    expect(qB.sources.length).toBeGreaterThan(0);
    expect(qA.sources[0].type).toBe('golden');
    expect(qB.sources[0].type).toBe('reviewer');
  }, 15000);

  it('Test 2: Market price query fetches real Agmarknet data without LLM hallucination', async () => {
    const marketResult = await groundedService.generateGroundedAnswer({
      questionId: 'Q_ID_MARKET_003',
      query: 'What is the current market price of Bajra in Gujarat?',
      language: 'en-IN',
      state: 'Gujarat',
      crop: 'Bajra',
    });

    expect(marketResult.questionId).toBe('Q_ID_MARKET_003');
    expect(marketResult.status).toBe('calculated');
    expect(marketResult.confidence).toBe('high');
    expect(marketResult.answer).toContain('2371.48');
    expect(marketResult.answer).toContain('₹/quintal');
    expect(marketResult.sources[0].type).toBe('market_prices');
    expect(marketResult.sources[0].reference).toContain('agmarknet');
  });

  it('Test 3: Chemical query without official dosage in evidence flags strict safety disclaimer and refuses to invent numbers', async () => {
    const chemicalResult = await groundedService.generateGroundedAnswer({
      questionId: 'Q_ID_CHEM_004',
      query: 'What is the exact chemical spray dosage in ml per acre for controlling blast disease in paddy?',
      language: 'en-IN',
    });

    // Since no matching evidence exists in database with dosage, it must route to expert review
    expect(chemicalResult.status).toBe('expert_review');
    expect(chemicalResult.confidence).toBe('low');
    expect(chemicalResult.answer).toContain('routed to agricultural expert review');
    expect(chemicalResult.warnings).toBeDefined();
  });

  it('Test 4: Out-of-domain query safely triggers expert_review and does NOT manufacture an answer', async () => {
    const oodResult = await groundedService.generateGroundedAnswer({
      questionId: 'Q_ID_OOD_005',
      query: 'How do I change the engine transmission fluid on a 2012 Honda Civic?',
      language: 'en-IN',
    });

    expect(oodResult.status).toBe('expert_review');
    expect(oodResult.confidence).toBe('low');
    expect(oodResult.sources.length).toBe(0);
    expect(oodResult.answer).toContain('Verified information is not available');
  });

  it('Test 5: Buyer inquiry correctly retrieves verified buyer records from database', async () => {
    const buyerResult = await groundedService.generateGroundedAnswer({
      questionId: 'Q_ID_BUYER_006',
      query: 'Who are the registered buyers for grain in Gujarat?',
      language: 'en-IN',
      state: 'Gujarat',
    });

    expect(buyerResult.status).toBe('grounded');
    expect(buyerResult.confidence).toBe('high');
    expect(buyerResult.answer).toContain('Surat Grain Traders Syndicate');
    expect(buyerResult.sources[0].type).toBe('buyers');
  });
});
