import { inject, injectable } from 'inversify';
import { ObjectId } from 'mongodb';
import { GLOBAL_TYPES } from '#root/types.js';
import { MongoDatabase } from '#root/shared/index.js';
import { aiConfig } from '#root/config/ai.js';
import type {
  IGroundedAnswerService,
  GroundedAnswerRequest,
  GroundedAnswerResponse,
  GroundedSource,
  GroundedAnswerStatus,
  GroundedConfidence,
} from '../interfaces/IGroundedAnswerService.js';

interface RawSearchDoc {
  id?: string;
  question?: string;
  answer?: string;
  text?: string;
  source?: string;
  score?: number;
  metadata?: Record<string, any>;
  agri_expert?: string;
  sources?: any[];
}

@injectable()
export class GroundedAnswerService implements IGroundedAnswerService {
  private readonly RELEVANCE_THRESHOLD = 0.70;
  private readonly DEFAULT_MODEL = 'gemini-3.5-flash-lite';
  private readonly FALLBACK_MODEL = 'gemini-3.6-flash';

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  public async generateGroundedAnswer(
    request: GroundedAnswerRequest,
  ): Promise<GroundedAnswerResponse> {
    const questionId = request.questionId || new ObjectId().toString();
    const normalizedQuery = (request.query || '').trim();
    const lang = request.language || 'en-IN';
    const timestamp = new Date().toISOString();

    if (!normalizedQuery) {
      return {
        questionId,
        answer: 'Empty question provided.',
        confidence: 'low',
        status: 'error',
        sources: [],
        warnings: ['Empty question text'],
        language: lang,
        generatedAt: timestamp,
      };
    }

    // Step 1: Query Normalization & Intent Classification
    const intent = this.classifyIntent(normalizedQuery);

    // Step 2 & 3: Multi-Tier Knowledge Retrieval by Domain
    if (intent === 'MARKET_PRICE') {
      return this.handleMarketPriceQuery(questionId, normalizedQuery, lang, timestamp, request);
    }

    if (intent === 'BUYER') {
      return this.handleBuyerQuery(questionId, normalizedQuery, lang, timestamp, request);
    }

    if (intent === 'WEATHER') {
      return this.handleWeatherQuery(questionId, normalizedQuery, lang, timestamp, request);
    }

    // Agronomic / Chemical / Disease / Cultivation Query
    return this.handleAgronomicQuery(questionId, normalizedQuery, intent, lang, timestamp, request);
  }

  /* =======================================================================
   * 1. INTENT CLASSIFIER
   * ======================================================================= */
  private classifyIntent(
    query: string,
  ): 'MARKET_PRICE' | 'BUYER' | 'CHEMICAL_PESTICIDE' | 'WEATHER' | 'GOVT_SCHEME' | 'GENERAL_AGRI' {
    const lower = query.toLowerCase();

    // Market Price intent
    const marketKeywords = [
      'market price', 'mandi rate', 'price of', 'bhav', 'rate per quintal',
      'modal price', 'selling rate', 'ధర', 'రేటు', 'మార్కెట్ ధర', 'దర', 'भाव', 'बाजार भाव'
    ];
    if (marketKeywords.some(kw => lower.includes(kw))) {
      return 'MARKET_PRICE';
    }

    // Buyer intent
    const buyerKeywords = [
      'buyer', 'buyers', 'who will buy', 'sell my', 'purchaser', 'trader',
      'కొనుగోలుదారు', 'కొనేవారు', 'వ్యాపారి', 'खरीदार', 'व्यापारी'
    ];
    if (buyerKeywords.some(kw => lower.includes(kw))) {
      return 'BUYER';
    }

    // Chemical / Pesticide / Fertilizer intent
    const chemicalKeywords = [
      'dose', 'dosage', 'spray', 'pesticide', 'fungicide', 'insecticide',
      'chemical', 'fertilizer', 'urea', 'dap', 'npk', 'ml per liter', 'per acre',
      'మందు', 'స్ప్రే', 'మోతాదు', 'పురుగుల మందు', 'ఎరువులు', 'दवा', 'कीटनाशक', 'मात्रा'
    ];
    if (chemicalKeywords.some(kw => lower.includes(kw))) {
      return 'CHEMICAL_PESTICIDE';
    }

    // Weather intent
    const weatherKeywords = [
      'weather', 'rain', 'temperature', 'forecast', 'rainfall', 'humidity',
      'వాతావరణం', 'వర్షం', 'తుఫాను', 'मौसम', 'बारिश'
    ];
    if (weatherKeywords.some(kw => lower.includes(kw))) {
      return 'WEATHER';
    }

    // Govt Schemes intent
    const schemeKeywords = [
      'scheme', 'subsidy', 'pm-kisan', 'rythu bandhu', 'yojana', 'subsidies',
      'పథకం', 'రైతు బంధు', 'సబ్సిడీ', 'योजना', 'सब्सिडी'
    ];
    if (schemeKeywords.some(kw => lower.includes(kw))) {
      return 'GOVT_SCHEME';
    }

    return 'GENERAL_AGRI';
  }

  /* =======================================================================
   * 2. MARKET PRICE HANDLER (Tier 4 Verified Agmarknet Structured Data)
   * ======================================================================= */
  private async handleMarketPriceQuery(
    questionId: string,
    query: string,
    lang: string,
    timestamp: string,
    request: GroundedAnswerRequest,
  ): Promise<GroundedAnswerResponse> {
    try {
      const col = await this.db.getCollection<any>('market_prices');

      // Extract commodity name from query or request context
      const knownCommodities = [
        'Bajra', 'Jowar', 'Maize', 'Paddy', 'Wheat', 'Cotton', 'Chilli',
        'Tomato', 'Onion', 'Potato', 'Soyabean', 'Groundnut', 'Bengal Gram'
      ];

      const detected = knownCommodities.find(c =>
        query.toLowerCase().includes(c.toLowerCase()) ||
        request.crop?.toLowerCase().includes(c.toLowerCase())
      );

      const filter: any = {};
      if (detected) {
        filter.commodity = { $regex: new RegExp(detected, 'i') };
      }
      if (request.state) {
        filter.state = { $regex: new RegExp(request.state, 'i') };
      }

      const results = await col.find(filter).sort({ arrivalDate: -1, reportedAt: -1 }).limit(3).toArray();

      if (results && results.length > 0) {
        const item = results[0];
        const commodityName = item.commodity || item.crop || 'Commodity';
        const modalPrice = item.modalPrice || item.maxPrice || 'N/A';
        const minPrice = item.minPrice || modalPrice;
        const maxPrice = item.maxPrice || modalPrice;
        const unit = item.unit || '₹/quintal';
        const market = item.market || item.state || 'Regional Mandi';
        const date = item.arrivalDate || item.reportedAt || 'Recent';

        let answer = '';
        if (lang.startsWith('te')) {
          answer = `${market} లో ${commodityName} తాజా మార్కెట్ ధరలు (${date} ప్రకారం): సగటు ధర ${modalPrice} ${unit} (కనీసం: ${minPrice}, గరిష్టం: ${maxPrice}). మూలం: Agmarknet అధికారిక నివేదిక.`;
        } else if (lang.startsWith('hi')) {
          answer = `${market} में ${commodityName} के नवीनतम मंडी भाव (${date} के अनुसार): मॉडल भाव ${modalPrice} ${unit} (न्यूनतम: ${minPrice}, अधिकतम: ${maxPrice}). स्रोत: Agmarknet आधिकारिक डेटा.`;
        } else {
          answer = `Current verified market prices for ${commodityName} in ${market} as of ${date}: Modal Price is ${modalPrice} ${unit} (Range: ${minPrice} - ${maxPrice} ${unit}). Verified Source: Agmarknet official daily arrivals.`;
        }

        const source: GroundedSource = {
          type: 'market_prices',
          id: String(item._id || item.recordKey || 'agmarknet-rec'),
          title: `Agmarknet Market Price — ${commodityName} (${market})`,
          reference: 'https://agmarknet.gov.in (Agmarknet Mandi Arrivals)',
          score: 1.0,
          metadata: {
            arrivalDate: date,
            modalPrice,
            unit,
            state: item.state,
          },
        };

        return {
          questionId,
          answer,
          confidence: 'high',
          status: 'calculated',
          sources: [source],
          warnings: [],
          language: lang,
          generatedAt: timestamp,
        };
      }

      // No price found in database: DO NOT INVENT PRICES!
      let noPriceMsg = '';
      if (lang.startsWith('te')) {
        noPriceMsg = 'అడిగిన పంట మరియు ప్రాంతానికి సంబంధించిన అధికారిక మార్కెట్ ధరల వివరాలు Agmarknet డేటాబేస్‌లో అందుబాటులో లేవు. స్థానిక మార్కెట్ యార్డ్ లేదా వ్యవసాయ మార్కెటింగ్ అధికారిని సంప్రదించండి.';
      } else if (lang.startsWith('hi')) {
        noPriceMsg = 'अनुरोधित फसल और स्थान के लिए आधिकारिक मंडी भाव वर्तमान में Agmarknet डेटाबेस में उपलब्ध नहीं हैं। कृपया नजदीकी कृषि उपज मंडी से संपर्क करें।';
      } else if (lang.startsWith('ta')) {
        noPriceMsg = 'கோரப்பட்ட பயிர் மற்றும் பகுதிக்கான சரிபார்க்கப்பட்ட சந்தை விலை தரவு அக்மார்க்நெட் (Agmarknet) பதிவுகளில் தற்போது கிடைக்கவில்லை. உள்ளூர் வேளாண் விற்பனைக் குழுவை அணுகவும்.';
      } else if (lang.startsWith('ur')) {
        noPriceMsg = 'اس فصل اور علاقے کے لیے تصدیق شدہ منڈی ریٹ فی الحال سرکاری ایگ مارک نیٹ (Agmarknet) ڈیٹا بیس میں دستیاب نہیں ہے۔ برائے مہربانی قریبی منڈی یا زرعی افسر سے رابطہ کریں۔';
      } else {
        noPriceMsg = 'Verified market price data for the requested crop and region is currently not available in official Agmarknet records. Please consult your local APMC / agricultural marketing committee.';
      }

      return {
        questionId,
        answer: noPriceMsg,
        confidence: 'low',
        status: 'insufficient_evidence',
        sources: [],
        warnings: ['No verified market price record in Agmarknet dataset for this query'],
        language: lang,
        generatedAt: timestamp,
      };
    } catch (err: any) {
      console.error('Market price retrieval failed:', err);
      return {
        questionId,
        answer: 'Market intelligence service is temporarily unavailable. Please verify with local mandi officials.',
        confidence: 'low',
        status: 'source_unavailable',
        sources: [],
        warnings: [err?.message || 'Market data source error'],
        language: lang,
        generatedAt: timestamp,
      };
    }
  }

  /* =======================================================================
   * 3. BUYER DIRECTORY HANDLER (Tier 4 Verified Buyer Records)
   * ======================================================================= */
  private async handleBuyerQuery(
    questionId: string,
    query: string,
    lang: string,
    timestamp: string,
    request: GroundedAnswerRequest,
  ): Promise<GroundedAnswerResponse> {
    try {
      const col = await this.db.getCollection<any>('buyers');
      const filter: any = {};
      if (request.state) {
        filter.state = { $regex: new RegExp(request.state, 'i') };
      }

      const buyers = await col.find(filter).limit(3).toArray();

      if (buyers && buyers.length > 0) {
        const buyerNames = buyers.map(b => `${b.businessName || b.name} (${b.district || b.state || 'Verified Buyer'})`).join(', ');

        let answer = '';
        if (lang.startsWith('te')) {
          answer = `ధృవీకరించబడిన కొనుగోలుదారులు: ${buyerNames}. అధికారిక లావాదేవీలు మరియు చెల్లింపు భద్రత కోసం రైతు సేవా పోర్టల్ ద్వారా సంప్రదించండి.`;
        } else if (lang.startsWith('hi')) {
          answer = `सत्यापित खरीदार: ${buyerNames}। सुरक्षित डिजिटल अनुबंध और भुगतान गारंटी के लिए एग्रीसेवा पोर्टल के माध्यम से जुड़ें।`;
        } else if (lang.startsWith('ta')) {
          answer = `சரிபார்க்கப்பட்ட வாங்குபவர்கள்: ${buyerNames}. பாதுகாப்பான ஒப்பந்தம் மற்றும் கட்டண உத்தரவாதத்திற்காக அக்ரிசேவா போர்டல் மூலம் இணைக்கவும்.`;
        } else if (lang.startsWith('ur')) {
          answer = `تصدیق شدہ خریدار: ${buyerNames}۔ محفوظ ڈیجیٹل معاہدے اور ادائیگی کی ضمانت کے لیے ایگری سیوا پورٹل کے ذریعے رابطہ کریں۔`;
        } else {
          answer = `Verified procurement buyers available in your region: ${buyerNames}. Connect through the AgriSeva portal for secure digital contract and payment guarantee.`;
        }

        const sources: GroundedSource[] = buyers.map(b => ({
          type: 'buyers',
          id: String(b.id || b._id),
          title: b.businessName || b.name || 'Verified Buyer',
          reference: `/buyers/${b.id || b._id}`,
          score: 0.95,
        }));

        return {
          questionId,
          answer,
          confidence: 'high',
          status: 'grounded',
          sources,
          warnings: [],
          language: lang,
          generatedAt: timestamp,
        };
      }

      let noBuyerMsg = '';
      if (lang.startsWith('te')) {
        noBuyerMsg = 'ఈ ప్రాంతంలో అడిగిన పంటకు సంబంధించి ధృవీకరించబడిన సంస్థాగత కొనుగోలుదారులు ప్రస్తుతం నమోదు కాలేదు. ఈ ప్రశ్న ప్రాంతీయ FPO / సేకరణ సమీక్షకు పంపబడింది.';
      } else if (lang.startsWith('hi')) {
        noBuyerMsg = 'इस क्षेत्र में निर्दिष्ट फसल के लिए वर्तमान में कोई सत्यापित संस्थागत खरीदार पंजीकृत नहीं हैं। यह प्रश्न क्षेत्रीय एफपीओ समीक्षा के लिए भेजा गया है।';
      } else if (lang.startsWith('ta')) {
        noBuyerMsg = 'இந்த பிராந்தியத்தில் பதிவுசெய்யப்பட்ட சரிபார்க்கப்பட்ட நிறுவன வாங்குபவர்கள் தற்போது கிடைக்கவில்லை. இந்த கேள்வி மண்டல FPO மறுஆய்வுக்கு அனுப்பப்பட்டுள்ளது.';
      } else if (lang.startsWith('ur')) {
        noBuyerMsg = 'اس علاقے میں فی الحال کوئی تصدیق شدہ خریدار رجسٹرڈ نہیں ہے۔ یہ سوال علاقائی ایف پی او (FPO) کے جائزے کے لیے بھیج دیا گیا ہے۔';
      } else {
        noBuyerMsg = 'No verified institutional buyers are currently registered in this region for the specified crop. This query has been queued for regional FPO / procurement review.';
      }

      return {
        questionId,
        answer: noBuyerMsg,
        confidence: 'low',
        status: 'expert_review',
        sources: [],
        warnings: ['No verified buyer record in database'],
        language: lang,
        generatedAt: timestamp,
      };
    } catch (err: any) {
      console.error('Buyer retrieval failed:', err);
      return {
        questionId,
        answer: 'Verified buyer directory is temporarily unreachable. Please check with local FPO leadership.',
        confidence: 'low',
        status: 'source_unavailable',
        sources: [],
        warnings: [err?.message || 'Buyer source unavailable'],
        language: lang,
        generatedAt: timestamp,
      };
    }
  }

  /* =======================================================================
   * 3B. WEATHER SERVICE HANDLER (Real Meteorological Verification / Fail-Safe)
   * ======================================================================= */
  private async handleWeatherQuery(
    questionId: string,
    query: string,
    lang: string,
    timestamp: string,
    request: GroundedAnswerRequest,
  ): Promise<GroundedAnswerResponse> {
    // Check if live meteorological weather provider is configured
    // Since external weather API is not configured in environment, prevent hallucinated weather data
    let weatherUnavailableMsg = '';
    if (lang.startsWith('te')) {
      weatherUnavailableMsg = 'ప్రత్యక్ష వాతావరణ సమాచార సేవ ప్రస్తుతం అందుబాటులో లేదు. ఖచ్చితమైన మరియు తాజా వాతావరణ సమాచారం కోసం దయచేసి భారత వాతావరణ శాఖ (IMD) లేదా "మౌసమ్" (Mausam) యాప్‌ను చూడండి. ఊహాజనిత వాతావరణ సమాచారం నిషిద్ధం.';
    } else if (lang.startsWith('hi')) {
      weatherUnavailableMsg = 'लाइव मौसम पूर्वानुमान सेवा वर्तमान में उपलब्ध नहीं है। वास्तविक और सटीक मौसम पूर्वानुमान के लिए कृपया भारत मौसम विज्ञान विभाग (IMD) या "मौसम" ऐप देखें। अनुमानित मौसम डेटा प्रदान नहीं किया जाता है।';
    } else if (lang.startsWith('ta')) {
      weatherUnavailableMsg = 'நேரடி வானிலை முன்னறிவிப்பு சேவை தற்போது கிடைக்கவில்லை. சான்றளிக்கப்பட்ட நிகழ்நேர முன்னறிவிப்புகள் மற்றும் மழை எச்சரிக்கைகளுக்கு இந்திய வானிலை ஆய்வுத் துறை (IMD) அல்லது அதிகாரப்பூர்வ "மௌசம்" செயலியைப் பார்க்கவும்.';
    } else if (lang.startsWith('ur')) {
      weatherUnavailableMsg = 'براہ راست موسمیاتی پیش گوئی کی خدمت فی الحال دستیاب نہیں ہے۔ تصدیق شدہ پیش گوئی اور بارش کے الرٹ کے لیے براہ کرم محکمہ موسمیات (IMD) یا سرکاری موسم ایپ سے رجوع کریں۔ موسمیاتی ڈیٹا من گھڑت نہیں بنایا جاتا۔';
    } else {
      weatherUnavailableMsg = 'Live meteorological weather service is currently unavailable. For certified, real-time forecasts and rainfall alerts, please consult the India Meteorological Department (IMD) or the official Mausam app. Real-time weather data is never fabricated.';
    }

    return {
      questionId,
      answer: weatherUnavailableMsg,
      confidence: 'low',
      status: 'source_unavailable',
      sources: [],
      warnings: ['SOURCE_UNAVAILABLE: Real-time meteorological weather provider is not configured. Real-time weather predictions are not generated to prevent hallucination.'],
      language: lang,
      generatedAt: timestamp,
    };
  }

  /* =======================================================================
   * 4. AGRONOMIC / GENERAL / CHEMICAL QUERY HANDLER
   * ======================================================================= */
  private async handleAgronomicQuery(
    questionId: string,
    query: string,
    intent: string,
    lang: string,
    timestamp: string,
    request: GroundedAnswerRequest,
  ): Promise<GroundedAnswerResponse> {
    // Step 2: Multi-Tier Knowledge Retrieval
    const evidenceList = await this.retrieveMultiTierEvidence(query, request);

    // Step 3: Evidence & Relevance Threshold Check
    const bestScore = evidenceList.length > 0 ? Math.max(...evidenceList.map(e => e.score || 0)) : 0;
    const meetsThreshold = bestScore >= this.RELEVANCE_THRESHOLD && evidenceList.length > 0;

    // Strict Anti-Hallucination Gate for Chemical/Pesticide Dosages
    const warnings: string[] = [];
    if (intent === 'CHEMICAL_PESTICIDE') {
      const asksDosage = /\b(dose|dosage|quantity|how much|rate|concentration|ml|gm|gram|spray rate|మోతాదు|ఎంత|పరిమాణం|మాత్ర|कितना|அளவு|مقدار)\b/i.test(query);
      const hasDosageInEvidence = evidenceList.some(doc => {
        const text = `${doc.title} ${doc.reference}`.toLowerCase();
        return /\b(\d+(\.\d+)?\s*(ml|g|kg|l|gm|liter|litre|acre|ha|ppm))\b/i.test(text);
      });

      // Strict Rule: If dosage is requested and no verified dosage is in evidence, NEVER let Gemini invent it!
      if (asksDosage && !hasDosageInEvidence) {
        let chemReviewMsg = '';
        if (lang.startsWith('te')) {
          chemReviewMsg = 'ఈ రసాయన/పురుగుల మందుకు సంబంధించిన అధికారిక మోతాదు వివరాలు ధృవీకరించబడిన డేటాబేస్‌లో అందుబాటులో లేవు. పంట భద్రత దృష్ట్యా తప్పుడు మోతాదు సిఫార్సు చేయడం నిషిద్ధం. ఈ ప్రశ్న వ్యవసాయ నిపుణుల (PAE) సమీక్షకు పంపబడింది. దయచేసి స్థానిక వ్యవసాయ అధికారి లేదా KVK ని సంప్రదించండి.';
        } else if (lang.startsWith('hi')) {
          chemReviewMsg = 'इस कीटनाशक/रासायनिक दवा के लिए आधिकारिक खुराक (मात्रा) सत्यापित डेटाबेस में उपलब्ध नहीं है। गलत मात्रा की सिफारिश फसल सुरक्षा के विरुद्ध है। यह प्रश्न कृषि विशेषज्ञ (PAE) समीक्षा के लिए भेजा गया है। कृपया नजदीकी KVK या कृषि अधिकारी से सलाह लें।';
        } else if (lang.startsWith('ta')) {
          chemReviewMsg = 'இந்த பூச்சிக்கொல்லி/இரசாயன மருந்திற்கான அதிகாரப்பூர்வ அளவு விவரங்கள் சரிபார்க்கப்பட்ட பதிவுகளில் கிடைக்கவில்லை. பயிர் பாதுகாப்பை உறுதிப்படுத்த சரியான அளவை உருவாக்க முடியாது. இது வேளாண் நிபுணர் (PAE/KVK) மதிப்பாய்வுக்கு அனுப்பப்பட்டுள்ளது.';
        } else if (lang.startsWith('ur')) {
          chemReviewMsg = 'اس کیمیائی کیڑے مار دوا کے لیے سرکاری مقدار کے اعداد و شمار تصدیق شدہ ریکارڈ میں دستیاب نہیں ہیں۔ فصل کے تحفظ کی خاطر من گھڑت مقدار فراہم نہیں کی جا سکتی۔ یہ سوال زرعی ماہر (PAE) کے جائزے کے لیے بھیج دیا گیا ہے۔';
        } else {
          chemReviewMsg = 'Official dosage recommendations for this chemical/pesticide are not available in verified reference records. To ensure crop safety and avoid toxic under/over-dosage, exact application rates cannot be generated and this request has been routed to agricultural expert review (PAE/KVK). Please consult your local KVK or agricultural extension officer before spraying.';
        }

        return {
          questionId,
          answer: chemReviewMsg,
          confidence: 'low',
          status: 'expert_review',
          sources: evidenceList,
          warnings: ['Official chemical dosage figures unavailable. Invented dosages are strictly prohibited; routed to expert review.'],
          language: lang,
          generatedAt: timestamp,
        };
      }

      if (!hasDosageInEvidence && meetsThreshold) {
        warnings.push('Official dosage figures are not present in verified source text. Application rates must be confirmed with local KVK/PAE expert.');
      }
    }

    // If evidence does not meet threshold: DO NOT MANUFACTURE PLAUSIBLE ANSWER!
    if (!meetsThreshold) {
      let ungroundedMsg = '';
      if (lang.startsWith('te')) {
        ungroundedMsg = 'ఈ ప్రశ్నకు అధికారిక వ్యవసాయ డేటాబేస్‌లో ధృవీకరించబడిన సమాచారం అందుబాటులో లేదు. ఖచ్చితమైన పరిష్కారం కొరకు ఈ ప్రశ్న వ్యవసాయ నిపుణుల (PAE) సమీక్షకు పంపబడింది.';
      } else if (lang.startsWith('hi')) {
        ungroundedMsg = 'इस प्रश्न के लिए आधिकारिक कृषि डेटाबेस में सत्यापित जानकारी उपलब्ध नहीं है। सटीक समाधान के लिए यह प्रश्न कृषि विशेषज्ञ (PAE) समीक्षा के लिए भेजा गया है।';
      } else if (lang.startsWith('ta')) {
        ungroundedMsg = 'அதிகாரப்பூர்வ வேளாண்மை தகவல் தளத்தில் இந்த கேள்விக்கு சரிபார்க்கப்பட்ட தகவல் கிடைக்கவில்லை. இது வேளாண் நிபுணர் (PAE) மறுஆய்வுக்கு அனுப்பப்பட்டுள்ளது.';
      } else if (lang.startsWith('ur')) {
        ungroundedMsg = 'اس سوال کے لیے سرکاری زرعی ڈیٹابیس میں تصدیق شدہ معلومات دستیاب نہیں ہے۔ یہ سوال زرعی ماہر (PAE) کے جائزے کے لیے بھیج دیا گیا ہے۔';
      } else {
        ungroundedMsg = 'Verified information is not available for this question in official knowledge sources yet. This question has been routed to agricultural expert review.';
      }

      return {
        questionId,
        answer: ungroundedMsg,
        confidence: 'low',
        status: 'expert_review',
        sources: [],
        warnings: ['No verified evidence met the 0.70 similarity threshold'],
        language: lang,
        generatedAt: timestamp,
      };
    }

    // Step 4: Grounded Answer Synthesis using Gemini
    try {
      const synthesized = await this.synthesizeWithGemini(query, evidenceList, intent, lang, warnings);

      // Step 5: Answer Quality Gate
      const qualityCheckPassed = this.validateAnswerQuality(synthesized.answer, evidenceList, intent);

      if (!qualityCheckPassed) {
        // Fallback safely to verbatim top verified evidence so the farmer still receives verified facts
        const topEvidence = evidenceList[0];
        const fallbackAnswer = topEvidence.title
          ? `[Verified Record]: ${topEvidence.title}`
          : 'Verified agricultural advisory is available in linked official records.';

        return {
          questionId,
          answer: fallbackAnswer,
          confidence: 'medium',
          status: 'grounded',
          sources: evidenceList,
          warnings: [...warnings, 'LLM output failed strict quality gate; reverted to verbatim verified source excerpt'],
          language: lang,
          generatedAt: timestamp,
        };
      }

      return {
        questionId,
        answer: synthesized.answer,
        confidence: bestScore >= 0.85 ? 'high' : 'medium',
        status: 'grounded',
        sources: evidenceList,
        warnings,
        language: lang,
        generatedAt: timestamp,
      };
    } catch (err: any) {
      console.warn('Gemini synthesis failed, falling back to top verified evidence text:', err?.message);

      // Safe fallback: Return verbatim top evidence answer WITHOUT hallucination
      const topEvidence = evidenceList[0];
      const fallbackAnswer = topEvidence.title
        ? `[Verified Record]: ${topEvidence.title}`
        : 'Information available in verified sources. Please refer to linked expert advisory.';

      return {
        questionId,
        answer: fallbackAnswer,
        confidence: 'medium',
        status: 'grounded',
        sources: evidenceList,
        warnings: [...warnings, 'LLM synthesis unavailable; provided verbatim verified source excerpt'],
        language: lang,
        generatedAt: timestamp,
      };
    }
  }

  /* =======================================================================
   * 5. MULTI-TIER RETRIEVAL LOGIC
   * ======================================================================= */
  private async retrieveMultiTierEvidence(
    query: string,
    request: GroundedAnswerRequest,
  ): Promise<GroundedSource[]> {
    const sources: GroundedSource[] = [];

    // 1. Try external AI/Agent Search Service if configured
    try {
      const searchUrl = aiConfig.agentSearchUrl || 'http://localhost:6002';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${searchUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          mode: 'all',
          top_k: 5,
          threshold: this.RELEVANCE_THRESHOLD,
          state: request.state || null,
          crop: request.crop || null,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as any;
        // Map Tier 1: Golden
        if (Array.isArray(data.golden)) {
          for (const item of data.golden) {
            sources.push({
              type: 'golden',
              id: item.id || item._id || 'golden-doc',
              title: item.answer || item.text || item.question,
              reference: item.metadata?.source || item.source || 'Golden Dataset',
              score: Number(item.score || 0.90),
              metadata: item.metadata,
            });
          }
        }
        // Map Tier 2: Reviewer
        if (Array.isArray(data.reviewer)) {
          for (const item of data.reviewer) {
            sources.push({
              type: 'reviewer',
              id: item.id || item._id || 'reviewer-doc',
              title: item.answer || item.text || item.question,
              reference: item.agri_expert || item.source || 'Expert Reviewed Q&A',
              score: Number(item.score || 0.85),
            });
          }
        }
        // Map Tier 3: PoP
        if (Array.isArray(data.pop)) {
          for (const item of data.pop) {
            sources.push({
              type: 'pop',
              id: item.id || 'pop-doc',
              title: item.text || 'Package of Practices Document',
              reference: item.source || 'Official Package of Practices (POP)',
              score: Number(item.score || 0.80),
            });
          }
        }
      }
    } catch (e) {
      // Upstream search server unreachable/timed out — proceed to direct MongoDB lookup
    }

    // 2. Direct MongoDB Search (Fallback & Local Tier 1 / Tier 2 Lookup)
    if (sources.length === 0 && this.db && typeof this.db.getCollection === 'function') {
      try {
        const questionsCol = await this.db.getCollection<any>('questions');

        // Search questions collection for matching closed / verified answers
        const terms = query.split(/\s+/).filter(t => t.length > 3).slice(0, 4);
        if (terms.length > 0) {
          const regexQuery = terms.map(t => `(?=.*${t})`).join('');
          const mongoMatches = await questionsCol.find({
            question: { $regex: new RegExp(regexQuery, 'i') },
            status: { $in: ['closed', 'verified'] },
            'answers.0': { $exists: true },
          }).limit(3).toArray();

          for (const m of mongoMatches) {
            const bestAns = m.answers?.[0]?.answer || m.answer || '';
            if (bestAns) {
              sources.push({
                type: m.isGolden ? 'golden' : 'reviewer',
                id: String(m._id),
                title: bestAns,
                reference: m.isGolden ? 'Golden Dataset (Database Record)' : 'Expert Approved Question (PAE)',
                score: 0.82,
                metadata: m.details,
              });
            }
          }
        }
      } catch (dbErr) {
        console.warn('Direct Mongo evidence search encountered error:', dbErr);
      }
    }

    // Sort by priority (Tier 1 Golden > Tier 2 Reviewer > Tier 3 PoP) and score
    sources.sort((a, b) => {
      const priorityMap: Record<string, number> = { golden: 3, reviewer: 2, pop: 1 };
      const pA = priorityMap[a.type] || 0;
      const pB = priorityMap[b.type] || 0;
      if (pA !== pB) return pB - pA;
      return (b.score || 0) - (a.score || 0);
    });

    return sources.slice(0, 5);
  }

  /* =======================================================================
   * 6. GROUNDED SYNTHESIS VIA GEMINI
   * ======================================================================= */
  private async synthesizeWithGemini(
    query: string,
    evidence: GroundedSource[],
    intent: string,
    language: string,
    warnings: string[],
  ): Promise<{ answer: string }> {
    const apiKey = aiConfig.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const primaryModel = aiConfig.geminiModel || process.env.GEMINI_MODEL || this.DEFAULT_MODEL;
    const fallbackModel = aiConfig.geminiFallbackModel || process.env.GEMINI_FALLBACK_MODEL || this.FALLBACK_MODEL;

    const evidenceText = evidence.map((e, idx) => `[Source ${idx + 1} (${e.type.toUpperCase()})]: ${e.title}`).join('\n\n');

    const systemPrompt = `You are AgriSeva-AI, an expert agricultural advisory assistant for Indian farmers.
STRICT COMPLIANCE RULES:
1. Grounding: Answer the user's question using ONLY the provided verified source evidence.
2. Anti-Hallucination: Do NOT invent chemical dosages, pesticide quantities, fertilizer rates, disease diagnoses, or market prices that are absent from the evidence.
3. Clarity: Write in simple, farmer-friendly, empathetic language without academic jargon.
4. Accuracy: If the evidence does not specify exact dosage or timing, clearly state: "Please consult your local KVK or agricultural extension officer for specific dosage recommendations."
5. Language: Respond fluently in the requested language code: ${language}. Keep technical chemical names, crop varieties, and units intact.
6. Objectivity: Never claim 100% accuracy, perfection, or guaranteed cure. Use qualified, grounded advice only.`;

    const userPrompt = `Farmer's Question:
"${query}"

Verified Evidence Available:
${evidenceText}

Synthesize a helpful, grounded explanation for the farmer adhering strictly to the facts above.`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.2, // Low temperature for high factual grounding
        maxOutputTokens: 500,
      },
    };

    const callModel = async (model: string): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          },
        );
        clearTimeout(timeoutId);
        return res;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error(`TIMEOUT: Request to Gemini model ${model} timed out after 10000ms`);
        }
        throw err;
      }
    };

    let response: Response;
    try {
      response = await callModel(primaryModel);
    } catch (primaryErr: any) {
      console.warn(`Gemini primary model ${primaryModel} failed: ${primaryErr.message}. Attempting fallback ${fallbackModel}...`);
      response = await callModel(fallbackModel);
    }

    // If primary model returned error status (e.g. 404, 500, 503), attempt fallback
    if (!response.ok && primaryModel !== fallbackModel) {
      if (response.status === 429) {
        throw new Error(`QUOTA_EXCEEDED: Gemini quota limit reached (${response.statusText})`);
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(`AUTHENTICATION_FAILURE: Gemini API key invalid or unauthorized (${response.statusText})`);
      }

      console.warn(`Gemini primary model ${primaryModel} returned ${response.status}. Attempting fallback ${fallbackModel}...`);
      try {
        response = await callModel(fallbackModel);
      } catch (fallbackErr: any) {
        throw new Error(`Gemini fallback model ${fallbackModel} failed: ${fallbackErr.message}`);
      }
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(`QUOTA_EXCEEDED: Gemini quota limit reached (${response.statusText})`);
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(`AUTHENTICATION_FAILURE: Gemini API key invalid or unauthorized (${response.statusText})`);
      }
      const errBody = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errBody}`);
    }

    const data = (await response.json()) as any;
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText || !candidateText.trim()) {
      throw new Error('MALFORMED_OUTPUT: Gemini returned empty or invalid candidate structure');
    }

    return { answer: candidateText.trim() };
  }

  /* =======================================================================
   * 7. QUALITY GATE & ANTI-HALLUCINATION VALIDATION
   * ======================================================================= */
  private validateAnswerQuality(
    answer: string,
    evidence: GroundedSource[],
    intent: string,
  ): boolean {
    if (!answer || answer.trim().length < 15) return false;

    // Reject banned absolute / hyperbole claims (Rule 19)
    const forbiddenClaims = [
      /\b100%\s*(accurate|guaranteed|effective|cured|cure)\b/i,
      /\bperfect(ly)?\s*(cure|treatment|accurate|solution)\b/i,
      /\bguaranteed\s*(result|yield|eradication|kill)\b/i,
    ];
    if (forbiddenClaims.some(pattern => pattern.test(answer))) {
      console.warn('Quality Gate: Rejected non-objective absolute claim in generated answer');
      return false;
    }

    // If intent is CHEMICAL_PESTICIDE, ensure model didn't invent arbitrary dosages
    if (intent === 'CHEMICAL_PESTICIDE') {
      const evidenceHasDose = evidence.some(e => /\b\d+(\.\d+)?\s*(ml|g|kg|ppm)\b/i.test(e.title));
      const answerHasDose = /\b\d+(\.\d+)?\s*(ml|g|kg|ppm)\b/i.test(answer);

      // If answer claims a numeric dose not in evidence, reject it
      if (answerHasDose && !evidenceHasDose) {
        console.warn('Quality Gate: Rejected hallucinated chemical dosage in generated answer');
        return false;
      }
    }

    return true;
  }
}
