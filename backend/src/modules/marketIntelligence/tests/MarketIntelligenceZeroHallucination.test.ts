import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommodityResolver, MULTILINGUAL_COMMODITY_MASTER } from '../services/CommodityResolver.js';
import { LocationResolver } from '../services/LocationResolver.js';
import { GroundedAnswerService } from '../../groundedAnswer/services/GroundedAnswerService.js';

describe('Market Intelligence & Zero-Hallucination Comprehensive Tests', () => {
  const commodityResolver = new CommodityResolver();
  const locationResolver = new LocationResolver();

  describe('1. Multilingual Commodity Extraction (Zero-Tomato-Default)', () => {
    it('accurately extracts Paddy in Telugu ("వరి ధర") without defaulting to Tomato', () => {
      const result = commodityResolver.extractCommodity('వరి ధర ఎంత ఉంది?');
      expect(result).not.toBeNull();
      expect(result?.canonical).toBe('Paddy');
      expect(result?.canonical).not.toBe('Tomato');
    });

    it('accurately extracts Chilli in Telugu ("మిర్చి రేటు")', () => {
      const result = commodityResolver.extractCommodity('ఈరోజు మిర్చి రేటు ఎంత?');
      expect(result?.canonical).toBe('Chilli');
    });

    it('accurately extracts Onion in Telugu ("ఉల్లిపాయ ధర")', () => {
      const result = commodityResolver.extractCommodity('ఉల్లిపాయ ధరలు చెప్పండి');
      expect(result?.canonical).toBe('Onion');
    });

    it('accurately extracts Tomato in Tamil ("தக்காளி விலை")', () => {
      const result = commodityResolver.extractCommodity('தூத்துக்குடியில் தக்காளி விலை என்ன?');
      expect(result?.canonical).toBe('Tomato');
    });

    it('accurately extracts Onion in Tamil ("வெங்காயம் விலை")', () => {
      const result = commodityResolver.extractCommodity('இன்றைய வெங்காயம் விலை நிலவரம்');
      expect(result?.canonical).toBe('Onion');
    });

    it('accurately extracts Paddy in Kannada ("ಭತ್ತದ ದರ")', () => {
      const result = commodityResolver.extractCommodity('ಭತ್ತದ ದರ ತಿಳಿಸಿ');
      expect(result?.canonical).toBe('Paddy');
    });

    it('accurately extracts Onion in Kannada ("ಈರುಳ್ಳಿ ಬೆಲೆ")', () => {
      const result = commodityResolver.extractCommodity('ಕೋಲಾರ ಮಂಡಿಯಲ್ಲಿ ಈರುಳ್ಳಿ ಬೆಲೆ ಎಷ್ಟು?');
      expect(result?.canonical).toBe('Onion');
    });

    it('accurately extracts Onion in Hindi ("प्याज का भाव")', () => {
      const result = commodityResolver.extractCommodity('लासलगांव मंडी में प्याज का भाव क्या है?');
      expect(result?.canonical).toBe('Onion');
    });

    it('accurately extracts Potato in Hindi ("आलू का रेट")', () => {
      const result = commodityResolver.extractCommodity('पुणे में आलू का रेट क्या है?');
      expect(result?.canonical).toBe('Potato');
    });

    it('accurately extracts Soyabean in Marathi ("सोयाबीन भाव")', () => {
      const result = commodityResolver.extractCommodity('पुणे बाजार समितीत सोयाबीन भाव काय आहे?');
      expect(result?.canonical).toBe('Soyabean');
    });

    it('accurately extracts Cotton in Gujarati ("કપાસ નો ભાવ")', () => {
      const result = commodityResolver.extractCommodity('રાજકોટ માર્કેટ માં કપાસ નો ભાવ');
      expect(result?.canonical).toBe('Cotton');
    });

    it('accurately extracts Mustard in Punjabi ("ਸਰ੍ਹੋਂ ਦਾ ਭਾਅ")', () => {
      const result = commodityResolver.extractCommodity('ਕੋਟਾ ਮੰਡੀ ਵਿੱਚ ਸਰ੍ਹੋਂ ਦਾ ਭਾਅ');
      expect(result?.canonical).toBe('Mustard');
    });

    it('returns null for generic queries without any crop mentioned (NEVER defaults to Tomato)', () => {
      const queries = [
        'What is the mandi price today?',
        'ఈరోజు మార్కెట్ రేటు ఎంత?',
        'இன்றைய சந்தை விலை என்ன?',
        'आज मंडी भाव क्या है?',
        'Tell me the rate',
        'Show me nearby market arrivals',
      ];

      for (const q of queries) {
        const result = commodityResolver.extractCommodity(q);
        expect(result).toBeNull();
      }
    });
  });

  describe('2. Location & Mandi Resolution', () => {
    it('resolves Tamil Nadu variations across scripts', () => {
      expect(locationResolver.resolveState('Tamil Nadu')).toBe('Tamil Nadu');
      expect(locationResolver.resolveState('Tamilnadu')).toBe('Tamil Nadu');
      expect(locationResolver.resolveState('தமிழ்நாடு')).toBe('Tamil Nadu');
      expect(locationResolver.resolveState('తమిళనాడు')).toBe('Tamil Nadu');
      expect(locationResolver.resolveState('TN')).toBe('Tamil Nadu');
    });

    it('resolves Maharashtra variations across scripts', () => {
      expect(locationResolver.resolveState('Maharashtra')).toBe('Maharashtra');
      expect(locationResolver.resolveState('महाराष्ट्र')).toBe('Maharashtra');
      expect(locationResolver.resolveState('మహారాష్ట్ర')).toBe('Maharashtra');
      expect(locationResolver.resolveState('MH')).toBe('Maharashtra');
    });

    it('resolves Karnataka variations across scripts', () => {
      expect(locationResolver.resolveState('Karnataka')).toBe('Karnataka');
      expect(locationResolver.resolveState('ಕರ್ನಾಟಕ')).toBe('Karnataka');
      expect(locationResolver.resolveState('కర్ణాటక')).toBe('Karnataka');
      expect(locationResolver.resolveState('KA')).toBe('Karnataka');
    });

    it('extracts mandi and state from natural language query', () => {
      const res1 = locationResolver.extractLocation('What is the tomato price in Thoothukudi APMC?');
      expect(res1.market).toBe('Thoothukudi APMC');
      expect(res1.state).toBe('Tamil Nadu');

      const res2 = locationResolver.extractLocation('लासलगांव मंडी में प्याज का भाव');
      expect(res2.market).toBe('APMC Lasalgaon');
      expect(res2.state).toBe('Maharashtra');

      const res3 = locationResolver.extractLocation('Kolar tomato arrivals');
      expect(res3.market).toBe('Kolar APMC');
      expect(res3.state).toBe('Karnataka');
    });
  });

  describe('3. GroundedAnswerService Market Price Queries (Zero Hallucination)', () => {
    let mockDb: any;
    let mockMarketPrices: any[];
    let mockBuyers: any[];
    let service: GroundedAnswerService;

    beforeEach(() => {
      mockMarketPrices = [
        {
          recordKey: 'tn-thoothukudi-tomato',
          state: 'Tamil Nadu',
          district: 'Thoothukudi',
          market: 'Thoothukudi APMC',
          commodity: 'Tomato',
          variety: 'Deshi',
          minPrice: 4200,
          maxPrice: 5100,
          modalPrice: 4750,
          arrivalDate: '2026-10-06',
          reportedAt: '2026-10-06T08:00:00Z',
          unit: '₹/quintal',
          source: 'agmarknet_daily',
        },
        {
          recordKey: 'tn-thoothukudi-paddy',
          state: 'Tamil Nadu',
          district: 'Thoothukudi',
          market: 'Thoothukudi APMC',
          commodity: 'Paddy',
          variety: 'Common',
          minPrice: 1850,
          maxPrice: 2050,
          modalPrice: 1950,
          arrivalDate: '2026-10-06',
          reportedAt: '2026-10-06T08:00:00Z',
          unit: '₹/quintal',
          source: 'agmarknet_daily',
        },
        {
          recordKey: 'mh-lasalgaon-onion',
          state: 'Maharashtra',
          district: 'Nashik',
          market: 'APMC Lasalgaon',
          commodity: 'Onion',
          variety: 'Red',
          minPrice: 3800,
          maxPrice: 4500,
          modalPrice: 4100,
          arrivalDate: '2026-10-06',
          reportedAt: '2026-10-06T08:00:00Z',
          unit: '₹/quintal',
          source: 'agmarknet_daily',
        },
      ];

      mockBuyers = [
        {
          id: 'buyer-tn-enam-1',
          name: 'Tamil Nadu Agro Fed (eNAM)',
          businessName: 'Tamil Nadu Agro Fed (eNAM)',
          verificationStatus: 'government_enam_verified',
          state: 'Tamil Nadu',
          district: 'Thoothukudi',
          cropsInterested: ['Tomato', 'Chilli', 'Paddy'],
          phone: '+91 44 2852 1100',
          rating: 4.9,
          isDemo: false,
        },
        {
          id: 'buyer-mh-agriseva-1',
          name: 'MahaKisan Agro Direct',
          businessName: 'MahaKisan Agro Direct',
          verificationStatus: 'agriseva_verified',
          state: 'Maharashtra',
          district: 'Nashik',
          cropsInterested: ['Onion', 'Tomato', 'Soyabean'],
          phone: '+91 253 257 8890',
          rating: 4.8,
          isDemo: false,
        },
      ];

      mockDb = {
        getCollection: vi.fn().mockImplementation((name: string) => {
          if (name === 'market_prices') {
            return {
              find: vi.fn().mockImplementation((query: any) => {
                let filtered = [...mockMarketPrices];
                if (query.commodity) {
                  const regex = query.commodity.$regex || query.commodity;
                  filtered = filtered.filter(item => regex.test(item.commodity));
                }
                if (query.market) {
                  const regex = query.market.$regex || query.market;
                  filtered = filtered.filter(item => regex.test(item.market));
                }
                if (query.state) {
                  const regex = query.state.$regex || query.state;
                  filtered = filtered.filter(item => regex.test(item.state));
                }
                return {
                  sort: vi.fn().mockReturnThis(),
                  limit: vi.fn().mockImplementation(() => ({
                    toArray: vi.fn().mockResolvedValue(filtered),
                  })),
                  toArray: vi.fn().mockResolvedValue(filtered),
                };
              }),
            };
          }
          if (name === 'buyers') {
            return {
              find: vi.fn().mockImplementation((query: any) => {
                let filtered = [...mockBuyers];
                if (query.cropsInterested) {
                  const regex = query.cropsInterested.$regex || query.cropsInterested;
                  filtered = filtered.filter(item =>
                    item.cropsInterested.some((c: string) => regex.test(c))
                  );
                }
                if (query.state) {
                  const regex = query.state.$regex || query.state;
                  filtered = filtered.filter(item => regex.test(item.state));
                }
                return {
                  sort: vi.fn().mockReturnThis(),
                  limit: vi.fn().mockImplementation(() => ({
                    toArray: vi.fn().mockResolvedValue(filtered),
                  })),
                  toArray: vi.fn().mockResolvedValue(filtered),
                };
              }),
            };
          }
          return {
            find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
          };
        }),
      };

      service = new GroundedAnswerService(mockDb);
    });

    it('prompts farmer for crop clarification when no crop is mentioned, rather than guessing Tomato', async () => {
      const response = await service.generateGroundedAnswer({
        query: 'What is the mandi price today in Tamil Nadu?',
        language: 'en-IN',
      });

      expect(response.status).toBe('insufficient_evidence');
      expect(response.answer).toContain('Which crop');
      expect(response.answer).not.toContain('4750'); // Does NOT hallucinate Tomato price!
      expect(response.sources.length).toBe(0);
    });

    it('returns exact Thoothukudi APMC Tomato modal price (₹4,750) when asked for Tomato in Tamil Nadu', async () => {
      const response = await service.generateGroundedAnswer({
        query: 'What is the tomato price in Thoothukudi APMC?',
        language: 'en-IN',
      });

      expect(response.status).toBe('calculated');
      expect(response.confidence).toBe('high');
      expect(response.answer).toContain('4750');
      expect(response.answer).toContain('Thoothukudi APMC');
      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.sources[0].type).toBe('market_prices');
      expect(response.sources[0].reference).toContain('agmarknet');
    });

    it('returns exact Thoothukudi APMC Paddy price (₹1,950) when asked for Paddy in Telugu ("వరి ధర")', async () => {
      const response = await service.generateGroundedAnswer({
        query: 'Thoothukudi లో వరి ధర ఎంత?',
        language: 'te-IN',
      });

      expect(response.status).toBe('calculated');
      expect(response.confidence).toBe('high');
      expect(response.answer).toContain('1950');
      expect(response.answer).toContain('Paddy');
      expect(response.answer).not.toContain('4750'); // NOT Tomato!
    });

    it('returns honest localized NO DATA state when crop has no records in state, NEVER hallucinating or falling back to other states', async () => {
      const response = await service.generateGroundedAnswer({
        query: 'What is the price of Soyabean in Tamil Nadu?',
        language: 'en-IN',
      });

      expect(response.status).toBe('insufficient_evidence');
      expect(response.confidence).toBe('low');
      expect(response.answer).toContain('not available in official Agmarknet records');
      expect(response.answer).not.toContain('4750'); // Does NOT fall back to Tomato
      expect(response.answer).not.toContain('4100'); // Does NOT fall back to Lasalgaon Onion
      expect(response.sources.length).toBe(0);
    });
  });

  describe('4. Verified Buyer Directory & Verification Badges', () => {
    let mockDb: any;
    let service: GroundedAnswerService;

    beforeEach(() => {
      const mockBuyers = [
        {
          _id: 'b1',
          name: 'Tamil Nadu Agro Fed (eNAM)',
          businessName: 'Tamil Nadu Agro Fed (eNAM)',
          verificationStatus: 'government_enam_verified',
          state: 'Tamil Nadu',
          district: 'Thoothukudi',
          cropsInterested: ['Tomato', 'Paddy'],
          phone: '+91 44 2852 1100',
          rating: 4.9,
          isDemo: false,
        },
        {
          _id: 'b2',
          name: 'MahaKisan Agro Direct',
          businessName: 'MahaKisan Agro Direct',
          verificationStatus: 'agriseva_verified',
          state: 'Maharashtra',
          district: 'Nashik',
          cropsInterested: ['Onion', 'Tomato'],
          phone: '+91 253 257 8890',
          rating: 4.8,
          isDemo: false,
        },
      ];

      mockDb = {
        getCollection: vi.fn().mockImplementation((name: string) => ({
          find: vi.fn().mockImplementation((query: any) => {
            let filtered = [...mockBuyers];
            if (query.cropsInterested) {
              const regex = query.cropsInterested.$regex || query.cropsInterested;
              filtered = filtered.filter(b => b.cropsInterested.some((c: string) => regex.test(c)));
            }
            if (query.state) {
              const regex = query.state.$regex || query.state;
              filtered = filtered.filter(b => regex.test(b.state));
            }
            return {
              sort: vi.fn().mockReturnThis(),
              limit: vi.fn().mockImplementation(() => ({
                toArray: vi.fn().mockResolvedValue(filtered),
              })),
              toArray: vi.fn().mockResolvedValue(filtered),
            };
          }),
        })),
      };

      service = new GroundedAnswerService(mockDb);
    });

    it('returns verified buyers with explicit Government/eNAM badge for Tamil Nadu Tomato', async () => {
      const response = await service.generateGroundedAnswer({
        query: 'Show me verified tomato buyers in Tamil Nadu',
        language: 'en-IN',
      });

      expect(response.status).toBe('grounded');
      expect(response.confidence).toBe('high');
      expect(response.answer).toContain('Tamil Nadu Agro Fed (eNAM)');
      expect(response.answer).toContain('Government/eNAM Verified');
      expect(response.answer).toContain('+91 44 2852 1100');
      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.sources[0].type).toBe('buyers');
    });

    it('returns honest localized message when no buyers exist for an unlisted crop in a region', async () => {
      const response = await service.generateGroundedAnswer({
        query: 'Are there any buyers for Saffron in Tamil Nadu?',
        language: 'en-IN',
      });

      expect(response.status).toBe('expert_review');
      expect(response.confidence).toBe('low');
      expect(response.answer).toContain('No verified buyers are currently registered');
      expect(response.answer).toContain('Farmer Dashboard');
    });
  });
});
