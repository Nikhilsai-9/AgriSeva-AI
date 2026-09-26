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

/**
 * Robust language detection based on Unicode script ranges for 23 Indian languages + English
 */
export function detectLanguageFromText(text: string, explicitLang?: string): string {
  const cleanLang = (explicitLang || '').trim().toLowerCase();
  if (cleanLang && cleanLang !== 'auto' && cleanLang !== 'unknown') {
    if (cleanLang.startsWith('te')) return 'te-IN';
    if (cleanLang.startsWith('ta')) return 'ta-IN';
    if (cleanLang.startsWith('hi')) return 'hi-IN';
    if (cleanLang.startsWith('kn')) return 'kn-IN';
    if (cleanLang.startsWith('ml')) return 'ml-IN';
    if (cleanLang.startsWith('mr')) return 'mr-IN';
    if (cleanLang.startsWith('bn')) return 'bn-IN';
    if (cleanLang.startsWith('gu')) return 'gu-IN';
    if (cleanLang.startsWith('pa')) return 'pa-IN';
    if (cleanLang.startsWith('ur')) return 'ur-IN';
    if (cleanLang.startsWith('or') || cleanLang.startsWith('od')) return 'od-IN';
    if (cleanLang.startsWith('as')) return 'as-IN';
    if (cleanLang.startsWith('sat')) return 'sat-IN';
    if (cleanLang.startsWith('ks')) return 'ks-IN';
    if (cleanLang.startsWith('ne')) return 'ne-IN';
    if (cleanLang.startsWith('kok')) return 'kok-IN';
    if (cleanLang.startsWith('sd')) return 'sd-IN';
    if (cleanLang.startsWith('doi')) return 'doi-IN';
    if (cleanLang.startsWith('mni')) return 'mni-IN';
    if (cleanLang.startsWith('brx')) return 'brx-IN';
    if (cleanLang.startsWith('sa')) return 'sa-IN';
    if (cleanLang.startsWith('mai')) return 'mai-IN';
    if (cleanLang.startsWith('en')) return 'en-IN';
    return explicitLang;
  }

  const sample = (text || '').trim();
  if (!sample) return 'en-IN';

  // Check Unicode script ranges in sample text
  if (/[\u0C00-\u0C7F]/.test(sample)) return 'te-IN'; // Telugu
  if (/[\u0B80-\u0BFF]/.test(sample)) return 'ta-IN'; // Tamil
  if (/[\u0C80-\u0CFF]/.test(sample)) return 'kn-IN'; // Kannada
  if (/[\u0D00-\u0D7F]/.test(sample)) return 'ml-IN'; // Malayalam
  if (/[\u0A80-\u0AFF]/.test(sample)) return 'gu-IN'; // Gujarati
  if (/[\u0A00-\u0A7F]/.test(sample)) return 'pa-IN'; // Punjabi
  if (/[\u0B00-\u0B7F]/.test(sample)) return 'od-IN'; // Odia
  if (/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(sample)) return 'ur-IN'; // Urdu / Arabic script
  if (/[\u1C50-\u1C7F]/.test(sample)) return 'sat-IN'; // Santali Ol Chiki
  if (/[\u0980-\u09FF]/.test(sample)) {
    // Bengali / Assamese
    if (/(কি|কেন|কিভাবে|আমাৰ|পানী|খেতি|ধান)/i.test(sample)) return 'as-IN';
    return 'bn-IN';
  }
  if (/[\u0900-\u097F]/.test(sample)) {
    // Devanagari script (Hindi, Marathi, Nepali, Sanskrit, Maithili, etc.)
    if (/(आहे|नाही|कसे|करावे|पिकावर|पाणी|शेतकरी)/i.test(sample)) return 'mr-IN';
    if (/(छ|भयो|गर्नु|राम्रो)/i.test(sample)) return 'ne-IN';
    return 'hi-IN';
  }

  return 'en-IN';
}

export function getLanguageDisplayName(langCode: string): string {
  const code = (langCode || 'en-IN').toLowerCase();
  if (code.startsWith('te')) return 'Telugu (తెలుగు)';
  if (code.startsWith('ta')) return 'Tamil (தமிழ்)';
  if (code.startsWith('hi')) return 'Hindi (हिन्दी)';
  if (code.startsWith('kn')) return 'Kannada (ಕನ್ನಡ)';
  if (code.startsWith('ml')) return 'Malayalam (മലയാളം)';
  if (code.startsWith('mr')) return 'Marathi (मराठी)';
  if (code.startsWith('bn')) return 'Bengali (বাংলা)';
  if (code.startsWith('gu')) return 'Gujarati (ગુજરાતી)';
  if (code.startsWith('pa')) return 'Punjabi (ਪੰਜਾਬੀ)';
  if (code.startsWith('od') || code.startsWith('or')) return 'Odia (ଓଡ଼ିଆ)';
  if (code.startsWith('ur')) return 'Urdu (اردو)';
  if (code.startsWith('as')) return 'Assamese (অসমীয়া)';
  if (code.startsWith('sat')) return 'Santali (ᱥᱟᱱᱛᱟᱲᱤ)';
  if (code.startsWith('ks')) return 'Kashmiri (کٲشُر)';
  if (code.startsWith('ne')) return 'Nepali (नेपाली)';
  if (code.startsWith('kok')) return 'Konkani (कोंकणी)';
  if (code.startsWith('sd')) return 'Sindhi (سنڌي)';
  if (code.startsWith('doi')) return 'Dogri (डोगरी)';
  if (code.startsWith('mni')) return 'Manipuri (মৈতৈলোন্)';
  if (code.startsWith('brx')) return 'Bodo (बड़ो)';
  if (code.startsWith('sa')) return 'Sanskrit (संस्कृतम्)';
  if (code.startsWith('mai')) return 'Maithili (मैथिली)';
  return 'English';
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
    const lang = detectLanguageFromText(normalizedQuery, request.language);
    const timestamp = new Date().toISOString();

    if (!normalizedQuery) {
      return {
        questionId,
        answer: this.getEmptyQuestionMessage(lang),
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

  private getEmptyQuestionMessage(lang: string): string {
    if (lang.startsWith('te')) return 'ప్రశ్న వివరాలు ఖాళీగా ఉన్నాయి. దయచేసి మీ వ్యవసాయ సందేహాన్ని నమోదు చేయండి.';
    if (lang.startsWith('ta')) return 'கேள்வி விவரங்கள் காலியாக உள்ளன. உங்கள் விவசாயக் கேள்வியை உள்ளிடவும்.';
    if (lang.startsWith('hi')) return 'प्रश्न विवरण खाली है। कृपया अपना कृषि प्रश्न दर्ज करें।';
    if (lang.startsWith('ur')) return 'سوال کی تفصیل خالی ہے۔ برائے مہربانی اپنا زرعی سوال درج کریں۔';
    if (lang.startsWith('kn')) return 'ಪ್ರಶ್ನೆಯ ವಿವರಗಳು ಖಾಲಿಯಾಗಿವೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಕೃಷಿ ಪ್ರಶ್ನೆಯನ್ನು ನಮೂದಿಸಿ.';
    if (lang.startsWith('ml')) return 'ചോദ്യ വിവരങ്ങൾ ശൂന്യമാണ്. ദയവായി നിങ്ങളുടെ കാർഷിക ചോദ്യം നൽകുക.';
    if (lang.startsWith('mr')) return 'प्रश्न तपशील रिक्त आहे. कृपया आपला शेतीविषयक प्रश्न प्रविष्ट करा.';
    if (lang.startsWith('bn')) return 'প্রশ্নের বিবরণ ফাঁকা রয়েছে। অনুগ্রহ করে আপনার কৃষিসংক্রান্ত প্রশ্নটি লিখুন।';
    if (lang.startsWith('gu')) return 'પ્રશ્ન વિગતો ખાલી છે. કૃપા કરીને તમારો કૃષિ પ્રશ્ન દાખલ કરો.';
    if (lang.startsWith('pa')) return 'ਸਵਾਲ ਦੇ ਵੇਰਵੇ ਖਾਲੀ ਹਨ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਖੇਤੀਬਾੜੀ ਸਵਾਲ ਦਰਜ ਕਰੋ।';
    if (lang.startsWith('od') || lang.startsWith('or')) return 'ପ୍ରଶ୍ନ ବିବରଣୀ ଖାଲି ଅଛି। ଦୟାକରି ଆପଣଙ୍କ କୃଷି ପ୍ରଶ୍ନ ଦାଖଲ କରନ୍ତୁ।';
    return 'Empty question provided. Please enter your agricultural question.';
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
      'modal price', 'selling rate', 'mandi price', 'mandi', 'market rate',
      // Telugu
      'ధర', 'రేటు', 'మార్కెట్ ధర', 'దర', 'మండి', 'ధరలు',
      // Hindi / Marathi
      'भाव', 'बाजार भाव', 'मंडी भाव', 'दाम', 'कीमत', 'दर',
      // Tamil
      'விலை', 'சந்தை விலை', 'மண்டி விலை', 'சந்தை',
      // Kannada
      'ಬೆಲೆ', 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆ', 'ದರ',
      // Malayalam
      'വില', 'മാർക്കറ്റ് വില', 'നിരക്ക്',
      // Bengali
      'দাম', 'দর', 'বাজার দর', 'মূল্য',
      // Gujarati
      'ભાવ', 'બજાર ભાવ', 'કિંમત',
      // Punjabi
      'ਭਾਅ', 'ਮੰਡੀ ਭਾਅ', 'ਕੀਮਤ',
      // Odia
      'ଦର', 'ମୂଲ୍ୟ', 'ବଜାର ଦର',
      // Urdu
      'قیمت', 'نرخ', 'منڈی', 'مارکیٹ'
    ];
    if (marketKeywords.some(kw => lower.includes(kw))) {
      return 'MARKET_PRICE';
    }

    // Buyer intent
    const buyerKeywords = [
      'buyer', 'buyers', 'who will buy', 'sell my', 'purchaser', 'trader', 'merchant',
      // Telugu
      'కొనుగోలుదారు', 'కొనేవారు', 'వ్యాపారి',
      // Hindi / Marathi
      'खरीदार', 'व्यापारी', 'खरीददार',
      // Tamil
      'வாங்குபவர்', 'வியாபாரி',
      // Kannada
      'ಖರೀದಿದಾರ', 'ವ್ಯಾಪಾರಿ',
      // Malayalam
      'വാങ്ങുന്നവർ', 'വ്യാപാരി',
      // Bengali
      'ক্রেতা', 'ব্যবসায়ী',
      // Gujarati
      'ખરીદનાર', 'વેપારી',
      // Punjabi
      'ਖਰੀਦਦਾਰ', 'ਵਪਾਰੀ',
      // Urdu
      'خریدار', 'تاجر'
    ];
    if (buyerKeywords.some(kw => lower.includes(kw))) {
      return 'BUYER';
    }

    // Chemical / Pesticide / Fertilizer intent
    const chemicalKeywords = [
      'dose', 'dosage', 'spray', 'pesticide', 'fungicide', 'insecticide',
      'chemical', 'fertilizer', 'urea', 'dap', 'npk', 'ml per liter', 'per acre',
      // Telugu
      'మందు', 'స్ప్రే', 'మోతాదు', 'పురుగుల మందు', 'ఎరువులు', 'తెగులు మందు',
      // Hindi / Marathi
      'दवा', 'कीटनाशक', 'मात्रा', 'छिड़काव', 'उर्वरक', 'खाद',
      // Tamil
      'மருந்து', 'பூச்சிக்கொல்லி', 'அளவு', 'தெளிப்பு', 'உரம்',
      // Kannada
      'ಔಷಧ', 'ಕೀಟನಾಶಕ', 'ಪ್ರಮಾಣ ಸಿಂಪಡಣೆ', 'ಗೊಬ್ಬರ',
      // Malayalam
      'മരുന്ന്', 'കീടനാശിനി', 'അളവ്', 'വളം',
      // Bengali
      'ওষুধ', 'কীটনাশক', 'মাত্রা', 'স্প্রে', 'সার',
      // Gujarati
      'દવા', 'જંતુનાશક', 'માત્રા', 'ખાતર',
      // Punjabi
      'ਦਵਾਈ', 'ਕੀਟਨਾਸ਼ਕ', 'ਮਾਤਰਾ', 'ਸਪਰੇਅ', 'ਖਾਦ',
      // Urdu
      'دوا', 'کیڑے مار دوا', 'کھاد', 'اسپرے'
    ];
    if (chemicalKeywords.some(kw => lower.includes(kw))) {
      return 'CHEMICAL_PESTICIDE';
    }

    // Weather intent
    const weatherKeywords = [
      'weather', 'rain', 'temperature', 'forecast', 'rainfall', 'humidity',
      // Telugu
      'వాతావరణం', 'వర్షం', 'తుఫాను',
      // Hindi / Marathi
      'मौसम', 'बारिश', 'तापमान', 'हवामान',
      // Tamil
      'வானிலை', 'மழை',
      // Kannada
      'ಹವಾಮಾನ', 'ಮಳೆ',
      // Malayalam
      'കാലാവസ്ഥ', 'മഴ',
      // Bengali
      'আবহাওয়া', 'বৃষ্টি',
      // Gujarati
      'હવામાન', 'વરસાદ',
      // Punjabi
      'ਮੌਸਮ', 'ਮੀਂਹ',
      // Urdu
      'موسم', 'بارش'
    ];
    if (weatherKeywords.some(kw => lower.includes(kw))) {
      return 'WEATHER';
    }

    // Govt Schemes intent
    const schemeKeywords = [
      'scheme', 'subsidy', 'pm-kisan', 'rythu bandhu', 'yojana', 'subsidies',
      // Telugu
      'పథకం', 'రైతు బంధు', 'సబ్సిడీ',
      // Hindi / Marathi
      'योजना', 'सब्सिडी',
      // Tamil
      'திட்டம்', 'மானியம்',
      // Kannada
      'ಯೋಜನೆ', 'ಸಹಾಯಧನ',
      // Malayalam
      'പദ്ധതി', 'സബ്സിഡി',
      // Bengali
      'প্রকল্প', 'ভর্তুকি',
      // Gujarati
      'યોજના', 'સબસિડી',
      // Punjabi
      'ਸਕੀਮ', 'ਸਬਸਿਡੀ',
      // Urdu
      'اسکیم', 'سبسڈی'
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

        const answer = this.getMarketPriceAnswer(market, commodityName, date, modalPrice, minPrice, maxPrice, unit, lang);

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
      const noPriceMsg = this.getNoPriceMessage(lang);

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
        answer: this.getMarketServiceUnavailableMessage(lang),
        confidence: 'low',
        status: 'source_unavailable',
        sources: [],
        warnings: [err?.message || 'Market data source error'],
        language: lang,
        generatedAt: timestamp,
      };
    }
  }

  private getMarketPriceAnswer(market: string, commodityName: string, date: string, modalPrice: any, minPrice: any, maxPrice: any, unit: string, lang: string): string {
    if (lang.startsWith('te')) return `${market} లో ${commodityName} తాజా మార్కెట్ ధరలు (${date} ప్రకారం): సగటు ధర ${modalPrice} ${unit} (కనీసం: ${minPrice}, గరిష్టం: ${maxPrice}). మూలం: Agmarknet అధికారిక నివేదిక.`;
    if (lang.startsWith('ta')) return `${market} சந்தையில் ${commodityName} சமீபத்திய விலை (${date} நிலவரப்படி): மாதிரி விலை ${modalPrice} ${unit} (குறைந்தபட்சம்: ${minPrice}, அதிகபட்சம்: ${maxPrice}). ஆதாரம்: Agmarknet அதிகாரப்பூர்வ அறிக்கை.`;
    if (lang.startsWith('hi')) return `${market} में ${commodityName} के नवीनतम मंडी भाव (${date} के अनुसार): मॉडल भाव ${modalPrice} ${unit} (न्यूनतम: ${minPrice}, अधिकतम: ${maxPrice})। स्रोत: Agmarknet आधिकारिक डेटा।`;
    if (lang.startsWith('ur')) return `${market} میں ${commodityName} کے تازہ ترین منڈی ریٹ (${date} کے مطابق): ماڈل ریٹ ${modalPrice} ${unit} (کم سے کم: ${minPrice}، زیادہ سے زیادہ: ${maxPrice})۔ ماخذ: Agmarknet سرکاری ڈیٹا۔`;
    if (lang.startsWith('kn')) return `${market} ನಲ್ಲಿ ${commodityName} ನ ಇತ್ತೀಚಿನ ಮಾರುಕಟ್ಟೆ ದರಗಳು (${date} ರಂತೆ): ಸರಾಸರಿ ದರ ${modalPrice} ${unit} (ಕನಿಷ್ಠ: ${minPrice}, ಗರಿಷ್ಠ: ${maxPrice}). ಮೂಲ: Agmarknet ಅಧಿಕೃತ ವರದಿ.`;
    if (lang.startsWith('ml')) return `${market} വിപണിയിൽ ${commodityName} ഏറ്റവും പുതിയ വില (${date} പ്രകാരം): മോഡൽ വില ${modalPrice} ${unit} (കുറഞ്ഞത്: ${minPrice}, കൂടിയത്: ${maxPrice}). ഉറവിടം: Agmarknet ഔദ്യോഗിക റിപ്പോർട്ട്.`;
    if (lang.startsWith('mr')) return `${market} मध्ये ${commodityName} चे नवीनतम बाजार भाव (${date} नुसार): सरासरी भाव ${modalPrice} ${unit} (किमान: ${minPrice}, कमाल: ${maxPrice})। स्रोत: Agmarknet अधिकृत डेटा.`;
    if (lang.startsWith('bn')) return `${market}-এ ${commodityName}-এর সাম্প্রতিক বাজার দর (${date} অনুযায়ী): গড় দর ${modalPrice} ${unit} (সর্বনিম্ন: ${minPrice}, সর্বোচ্চ: ${maxPrice})। উৎস: Agmarknet অফিসিয়াল রিপোর্ট।`;
    if (lang.startsWith('gu')) return `${market} માં ${commodityName} ના તાજા બજાર ભાવ (${date} મુજબ): મોડલ ભાવ ${modalPrice} ${unit} (લઘુત્તમ: ${minPrice}, મહત્તમ: ${maxPrice}). સ્ત્રોત: Agmarknet સત્તાવાર અહેવાલ.`;
    if (lang.startsWith('pa')) return `${market} ਵਿੱਚ ${commodityName} ਦੇ ਤਾਜ਼ਾ ਮੰਡੀ ਭਾਅ (${date} ਅਨੁਸਾਰ): ਔਸਤ ਭਾਅ ${modalPrice} ${unit} (ਘੱਟੋ-ਘੱਟ: ${minPrice}, ਵੱਧ ਤੋਂ ਵੱਧ: ${maxPrice})। ਸਰੋਤ: Agmarknet ਅਧਿਕਾਰਤ ਡਾਟਾ।`;
    if (lang.startsWith('od') || lang.startsWith('or')) return `${market} ରେ ${commodityName} ର ସର୍ବଶେଷ ବଜାର ଦର (${date} ଅନୁଯାୟୀ): ମଡାଲ ଦର ${modalPrice} ${unit} (ସର୍ବନିମ୍ନ: ${minPrice}, ସର୍ବାଧିକ: ${maxPrice})। ଉତ୍ସ: Agmarknet ସରକାରୀ ରିପୋର୍ଟ।`;
    if (lang.startsWith('as')) return `${market}-ত ${commodityName}-ৰ শেহতীয়া বজাৰ দৰ (${date} অনুসৰি): গড় দৰ ${modalPrice} ${unit} (নূন্যতম: ${minPrice}, সৰ্বোচ্চ: ${maxPrice})। উৎস: Agmarknet চৰকাৰী প্ৰতিবেদন।`;
    return `Current verified market prices for ${commodityName} in ${market} as of ${date}: Modal Price is ${modalPrice} ${unit} (Range: ${minPrice} - ${maxPrice} ${unit}). Verified Source: Agmarknet official daily arrivals.`;
  }

  private getNoPriceMessage(lang: string): string {
    if (lang.startsWith('te')) return 'అడిగిన పంట మరియు ప్రాంతానికి సంబంధించిన అధికారిక మార్కెట్ ధరల వివరాలు Agmarknet డేటాబేస్‌లో అందుబాటులో లేవు. స్థానిక మార్కెట్ యార్డ్ లేదా వ్యవసాయ మార్కెటింగ్ అధికారిని సంప్రదించండి.';
    if (lang.startsWith('ta')) return 'கோரப்பட்ட பயிர் மற்றும் பகுதிக்கான சரிபார்க்கப்பட்ட சந்தை விலை தரவு அக்மார்க்நெட் (Agmarknet) பதிவுகளில் தற்போது கிடைக்கவில்லை. உள்ளூர் வேளாண் விற்பனைக் குழுவை அணுகவும்.';
    if (lang.startsWith('hi')) return 'अनुरोधित फसल और स्थान के लिए आधिकारिक मंडी भाव वर्तमान में Agmarknet डेटाबेस में उपलब्ध नहीं हैं। कृपया नजदीकी कृषि उपज मंडी से संपर्क करें।';
    if (lang.startsWith('ur')) return 'اس فصل اور علاقے کے لیے تصدیق شدہ منڈی ریٹ فی الحال سرکاری ایگ مارک نیٹ (Agmarknet) ڈیٹا بیس میں دستیاب نہیں ہے۔ برائے مہربانی قریبی منڈی یا زرعی افسر سے رابطہ کریں۔';
    if (lang.startsWith('kn')) return 'ಕೋರಲಾದ ಬೆಳೆ ಮತ್ತು ಪ್ರದೇಶಕ್ಕೆ ಅಧಿಕೃತ ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ವಿವರಗಳು Agmarknet ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ಥಳೀಯ ಎಪಿಎಂಸಿ ಅಥವಾ ಕೃಷಿ ಮಾರುಕಟ್ಟೆ ಅಧಿಕಾರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.';
    if (lang.startsWith('ml')) return 'ആവശ്യപ്പെട്ട വിളയ്ക്കും പ്രദേശത്തിനുമുള്ള ഔദ്യോഗിക മാർക്കറ്റ് വില വിവരങ്ങൾ Agmarknet ഡാറ്റാബേസിൽ ലഭ്യമല്ല. ദയവായി പ്രാദേശിക മാർക്കറ്റ് കമ്മിറ്റിയുമായി ബന്ധപ്പെടുക.';
    if (lang.startsWith('mr')) return 'विनंती केलेल्या पिकासाठी आणि बाजारासाठी अधिकृत बाजार भाव Agmarknet डेटाबेसमध्ये उपलब्ध नाहीत. कृपया स्थानिक कृषी उत्पन्न बाजार समितीशी संपर्क साधा.';
    if (lang.startsWith('bn')) return 'অনুরোধকৃত ফসল এবং অঞ্চলের জন্য যাচাইকৃত বাজার মূল্যের তথ্য Agmarknet ডাটাবেসে পাওয়া যায়নি। অনুগ্রহ করে স্থানীয় কৃষি বিপণন দপ্তরে যোগাযোগ করুন।';
    if (lang.startsWith('gu')) return 'વિનંતી કરેલ પાક અને વિસ્તાર માટે સત્તાવાર બજાર ભાવ Agmarknet ડેટાબેઝમાં ઉપલબ્ધ નથી. કૃપા કરીને સ્થાનિક APMC નો સંપર્ક કરો.';
    if (lang.startsWith('pa')) return 'ਇਸ ਫਸਲ ਅਤੇ ਖੇਤਰ ਲਈ ਸਰਕਾਰੀ ਮੰਡੀ ਰੇਟ Agmarknet ਡੇਟਾਬੇਸ ਵਿੱਚ ਉਪਲਬਧ ਨਹੀਂ ਹਨ। ਕਿਰਪਾ ਕਰਕੇ ਸਥਾਨਕ ਮਾਰਕੀਟ ਕਮੇਟੀ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।';
    if (lang.startsWith('od') || lang.startsWith('or')) return 'ଅନୁରୋଧ କରାଯାଇଥିବା ଫସଲ ଏବଂ ଅଞ୍ଚଳ ପାଇଁ ସରକାରୀ ମଣ୍ଡି ଦର Agmarknet ଡାଟାବେସରେ ଉପଲବ୍ଧ ନାହିଁ। ଦୟାକରି ସ୍ଥାନୀୟ ମଣ୍ଡି କର୍ତ୍ତୃପକ୍ଷଙ୍କ ସହ ଯୋଗାଯୋଗ କରନ୍ତୁ।';
    if (lang.startsWith('as')) return 'অনুৰোধ কৰা শস্য আৰু অঞ্চলৰ বাবে চৰকাৰী বজাৰ দৰ Agmarknet ডাটাবেচত উপলব্ধ নহয়। অনুগ্ৰহ কৰি স্থানীয় কৃষি বিষয়াৰ সৈতে যোগাযোগ কৰক।';
    return 'Verified market price data for the requested crop and region is currently not available in official Agmarknet records. Please consult your local APMC / agricultural marketing committee.';
  }

  private getMarketServiceUnavailableMessage(lang: string): string {
    if (lang.startsWith('te')) return 'మార్కెట్ ధరల సమాచార సేవ తాత్కాలికంగా అందుబాటులో లేదు. దయచేసి స్థానిక మార్కెట్ అధికారులను సంప్రదించండి.';
    if (lang.startsWith('ta')) return 'சந்தை நுண்ணறிவு சேவை தற்காலிகமாக கிடைக்கவில்லை. உள்ளூர் சந்தை அதிகாரிகளிடம் சரிபார்க்கவும்.';
    if (lang.startsWith('hi')) return 'मंडी भाव सेवा वर्तमान में अनुपलब्ध है। कृपया स्थानीय मंडी अधिकारियों से संपर्क करें।';
    if (lang.startsWith('ur')) return 'منڈی ریٹ سروس فی الحال دستیاب نہیں ہے۔ برائے مہربانی مقامی منڈی افسران سے تصدیق کریں۔';
    if (lang.startsWith('kn')) return 'ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ ಸೇವೆ ತಾತ್ಕಾಲಿಕವಾಗಿ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ಥಳೀಯ ಮಾರುಕಟ್ಟೆ ಅಧಿಕಾರಿಗಳನ್ನು ಸಂಪರ್ಕಿಸಿ.';
    if (lang.startsWith('ml')) return 'മാർക്കറ്റ് വില സേവനം താൽക്കാലികമായി ലഭ്യമല്ല. ദയവായി പ്രാദേശിക വിപണി ഉദ്യോഗസ്ഥരുമായി ബന്ധപ്പെടുക.';
    if (lang.startsWith('mr')) return 'बाजार भाव सेवा तात्पुरती अनुपलब्ध आहे. कृपया स्थानिक बाजार समितीशी संपर्क साधा.';
    if (lang.startsWith('bn')) return 'বাজার দর সেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে স্থানীয় বাজার কমিটির সাথে যোগাযোগ করুন।';
    if (lang.startsWith('gu')) return 'બજાર ભાવ સેવા હાલમાં અનુપલબ્ધ છે. કૃપા કરીને સ્થાનિક APMC અધિકારીઓનો સંપર્ક કરો.';
    if (lang.startsWith('pa')) return 'ਮੰਡੀ ਭਾਅ ਸੇਵਾ ਅਸਥਾਈ ਤੌਰ ਤੇ ਉਪਲਬਧ ਨਹੀਂ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਸਥਾਨਕ ਮੰਡੀ ਅਧਿਕਾਰੀਆਂ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।';
    if (lang.startsWith('od') || lang.startsWith('or')) return 'ମଣ୍ଡି ଦର ସେବା ଅସ୍ଥାୟୀ ଭାବେ ଅନୁପଲବ୍ଧ। ଦୟାକରି ସ୍ଥାନୀୟ କର୍ତ୍ତୃପକ୍ଷଙ୍କ ସହ ଯୋଗାଯୋଗ କରନ୍ତୁ।';
    return 'Market intelligence service is temporarily unavailable. Please verify with local mandi officials.';
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
        const answer = this.getBuyerAnswer(buyerNames, lang);

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

      const noBuyerMsg = this.getNoBuyerMessage(lang);

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
        answer: this.getBuyerServiceUnavailableMessage(lang),
        confidence: 'low',
        status: 'source_unavailable',
        sources: [],
        warnings: [err?.message || 'Buyer source unavailable'],
        language: lang,
        generatedAt: timestamp,
      };
    }
  }

  private getBuyerAnswer(buyerNames: string, lang: string): string {
    if (lang.startsWith('te')) return `ధృవీకరించబడిన కొనుగోలుదారులు: ${buyerNames}. అధికారిక లావాదేవీలు మరియు చెల్లింపు భద్రత కోసం రైతు సేవా పోర్టల్ ద్వారా సంప్రదించండి.`;
    if (lang.startsWith('ta')) return `சரிபார்க்கப்பட்ட வாங்குபவர்கள்: ${buyerNames}. பாதுகாப்பான ஒப்பந்தம் மற்றும் கட்டண உத்தரவாதத்திற்காக அக்ரிசேவா போர்டல் மூலம் இணைக்கவும்.`;
    if (lang.startsWith('hi')) return `सत्यापित खरीदार: ${buyerNames}। सुरक्षित डिजिटल अनुबंध और भुगतान गारंटी के लिए एग्रीसेवा पोर्टल के माध्यम से जुड़ें।`;
    if (lang.startsWith('ur')) return `تصدیق شدہ خریدار: ${buyerNames}۔ محفوظ ڈیجیٹل معاہدے اور ادائیگی کی ضمانت کے لیے ایگری سیوا پورٹل کے ذریعے رابطہ کریں۔`;
    if (lang.startsWith('kn')) return `ದೃಢೀಕರಿಸಿದ ಖರೀದಿದಾರರು: ${buyerNames}. ಸುರಕ್ಷಿತ ವಹಿವಾಟುಗಳಿಗಾಗಿ ಅಗ್ರಿಸೇವಾ ಪೋರ್ಟಲ್ ಮೂಲಕ ಸಂಪರ್ಕಿಸಿ.`;
    if (lang.startsWith('ml')) return `സ്ഥിരീകരിച്ച വാങ്ങലുകാർ: ${buyerNames}. സുരക്ഷിത കരാറുകൾക്കായി അഗ്രിസേവ പോർട്ടൽ വഴി ബന്ധപ്പെടുക.`;
    if (lang.startsWith('mr')) return `सत्यापित खरेदीदार: ${buyerNames}। सुरक्षित व्यवहारांसाठी ॲग्रीसेवा पोर्टलद्वारे संपर्क साधा.`;
    if (lang.startsWith('bn')) return `যাচাইকৃত ক্রেতা: ${buyerNames}। নিরাপদ ডিজিটাল চুক্তির জন্য এগ্রিসেবা পোর্টালের মাধ্যমে যোগাযোগ করুন।`;
    if (lang.startsWith('gu')) return `ચકાસાયેલ ખરીદદારો: ${buyerNames}. સુરક્ષિત વ્યવહારો માટે એગ્રીસેવા પોર્ટલ દ્વારા જોડાઓ.`;
    if (lang.startsWith('pa')) return `ਪ੍ਰਮਾਣਿਤ ਖਰੀਦਦਾਰ: ${buyerNames}। ਸੁਰੱਖਿਅਤ ਸੌਦਿਆਂ ਲਈ ਐਗਰੀਸੇਵਾ ਪੋਰਟਲ ਰਾਹੀਂ ਸੰਪਰਕ ਕਰੋ।`;
    if (lang.startsWith('od') || lang.startsWith('or')) return `ଯାଞ୍ଚ ହୋଇଥିବା କ୍ରେତା: ${buyerNames}। ସୁରକ୍ଷିତ କାରବାର ପାଇଁ ଏଗ୍ରିସେବା ପୋର୍ଟାଲ ମାଧ୍ୟମରେ ଯୋଗାଯୋଗ କରନ୍ତୁ।`;
    return `Verified procurement buyers available in your region: ${buyerNames}. Connect through the AgriSeva portal for secure digital contract and payment guarantee.`;
  }

  private getNoBuyerMessage(lang: string): string {
    if (lang.startsWith('te')) return 'ఈ ప్రాంతంలో అడిగిన పంటకు సంబంధించి ధృవీకరించబడిన సంస్థాగత కొనుగోలుదారులు ప్రస్తుతం నమోదు కాలేదు. ఈ ప్రశ్న ప్రాంతీయ FPO / సేకరణ సమీక్షకు పంపబడింది.';
    if (lang.startsWith('ta')) return 'இந்த பிராந்தியத்தில் பதிவுசெய்யப்பட்ட சரிபார்க்கப்பட்ட நிறுவன வாங்குபவர்கள் தற்போது கிடைக்கவில்லை. இந்த கேள்வி மண்டல FPO மறுஆய்வுக்கு அனுப்பப்பட்டுள்ளது.';
    if (lang.startsWith('hi')) return 'इस क्षेत्र में निर्दिष्ट फसल के लिए वर्तमान में कोई सत्यापित संस्थागत खरीदार पंजीकृत नहीं हैं। यह प्रश्न क्षेत्रीय एफपीओ समीक्षा के लिए भेजा गया है।';
    if (lang.startsWith('ur')) return 'اس علاقے میں فی الحال کوئی تصدیق شدہ خریدار رجسٹرڈ نہیں ہے۔ یہ سوال علاقائی ایف پی او (FPO) کے جائزے کے لیے بھیج دیا گیا ہے۔';
    if (lang.startsWith('kn')) return 'ಈ ಪ್ರದೇಶದಲ್ಲಿ ನಿರ್ದಿಷ್ಟ ಬೆಳೆಗೆ ದೃಢೀಕರಿಸಿದ ಸಾಂಸ್ಥಿಕ ಖರೀದಿದಾರರು ಪ್ರಸ್ತುತ ನೋಂದಣಿಯಾಗಿಲ್ಲ. ಈ ಪ್ರಶ್ನೆಯನ್ನು ಪ್ರಾದೇಶಿಕ FPO ಪರಿಶೀಲನೆಗೆ ಕಳುಹಿಸಲಾಗಿದೆ.';
    if (lang.startsWith('ml')) return 'ഈ പ്രദേശത്ത് നിലവിൽ സ്ഥിരീകരിച്ച വാങ്ങലുകാർ രജിസ്റ്റർ ചെയ്തിട്ടില്ല. ഈ ചോദ്യം പ്രാദേശಿಕ FPO അവലോകനത്തിനായി അയച്ചിരിക്കുന്നു.';
    if (lang.startsWith('mr')) return 'या भागात या पिकासाठी कोणतेही संस्थात्मक खरेदीदार नोंदणीकृत नाहीत. हा प्रश्न प्रादेशिक FPO पुनरावलोकनासाठी पाठवला आहे.';
    if (lang.startsWith('bn')) return 'এই অঞ্চলে এই ফসলের জন্য কোনো যাচাইকৃত ক্রেতা নিবন্ধিত নেই। প্রশ্নটি আঞ্চলিক FPO পর্যালোচনার জন্য পাঠানো হয়েছে।';
    if (lang.startsWith('gu')) return 'આ વિસ્તારમાં આ પાક માટે કોઈ સંસ્થાકીય ખરીદદારો નોંધાયેલા નથી. આ પ્રશ્ન પ્રાદેશિક FPO સમીક્ષા માટે મોકલવામાં આવ્યો છે.';
    if (lang.startsWith('pa')) return 'ਇਸ ਖੇਤਰ ਵਿੱਚ ਇਸ ਫਸਲ ਲਈ ਕੋਈ ਸੰਸਥਾਗਤ ਖਰੀਦਦਾਰ ਰਜਿਸਟਰਡ ਨਹੀਂ ਹਨ। ਇਹ ਸਵਾਲ ਖੇਤਰੀ FPO ਸਮੀਖਿਆ ਲਈ ਭੇਜਿਆ ਗਿਆ ਹੈ।';
    if (lang.startsWith('od') || lang.startsWith('or')) return 'ଏହି ଅଞ୍ଚଳରେ ନିର୍ଦ୍ଦିଷ୍ଟ ଫସଲ ପାଇଁ କୌଣସି କ୍ରେତା ପଞ୍ଜୀକୃତ ହୋଇନାହାଁନ୍ତି। ଏହି ପ୍ରଶ୍ନଟି ଆଞ୍ଚଳିକ FPO ସମୀକ୍ଷା ପାଇଁ ପଠାଯାଇଛି।';
    return 'No verified institutional buyers are currently registered in this region for the specified crop. This query has been queued for regional FPO / procurement review.';
  }

  private getBuyerServiceUnavailableMessage(lang: string): string {
    if (lang.startsWith('te')) return 'కొనుగోలుదారుల డైరెక్టరీ సేవ ప్రస్తుతం అందుబాటులో లేదు. దయచేసి స్థానిక FPO నాయకత్వాన్ని సంప్రదించండి.';
    if (lang.startsWith('ta')) return 'வாங்குபவர் அடைவு சேவை தற்காலிகமாக கிடைக்கவில்லை. உள்ளூர் FPO நிர்வாகத்தை அணுகவும்.';
    if (lang.startsWith('hi')) return 'सत्यापित खरीदार निर्देशिका अस्थायी रूप से अनुपलब्ध है। कृपया स्थानीय एफपीओ नेतृत्व से संपर्क करें।';
    if (lang.startsWith('ur')) return 'خریداروں کی ڈائرکٹری عارضی طور پر دستیاب نہیں ہے۔ براہ کرم مقامی ایف پی او سے رابطہ کریں۔';
    if (lang.startsWith('kn')) return 'ಖರೀದಿದಾರರ ಡೈರೆಕ್ಟರಿ ಸೇವೆ ತಾತ್ಕಾಲಿಕವಾಗಿ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ಥಳೀಯ FPO ಅಧಿಕಾರಿಗಳನ್ನು ಸಂಪರ್ಕಿಸಿ.';
    if (lang.startsWith('ml')) return 'വാങ്ങലുകാരുടെ വിവര ശേഖരം ഇപ്പോൾ ലഭ്യമല്ല. ദയവായി പ്രാദേശിക FPO നേതൃത്വവുമായി ബന്ധപ്പെടുക.';
    if (lang.startsWith('mr')) return 'खरेदीदार निर्देशिका सध्या अनुपलब्ध आहे. कृपया स्थानिक FPO शी संपर्क साधा.';
    if (lang.startsWith('bn')) return 'ক্রেতা তালিকা সেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে স্থানীয় FPO নেতৃত্বের সাথে যোগাযোগ করুন।';
    if (lang.startsWith('gu')) return 'ખરીદદાર ડિરેક્ટરી હાલમાં અનુપલબ્ધ છે. કૃપા કરીને સ્થાનિક FPO નો સંપર્ક કરો.';
    if (lang.startsWith('pa')) return 'ਖਰੀਦਦਾਰ ਡਾਇਰੈਕਟਰੀ ਫਿਲਹਾਲ ਉਪਲਬਧ ਨਹੀਂ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਸਥਾਨਕ FPO ਨਾਲ ਸੰਪਰਕ ਕਰੋ।';
    if (lang.startsWith('od') || lang.startsWith('or')) return 'କ୍ରେତା ଡାଇରେକ୍ଟୋରୀ ଅସ୍ଥାୟୀ ଭାବେ ଅନୁପଲବ୍ଧ। ଦୟାକରି ସ୍ଥାନୀୟ FPO ସହ ଯୋଗାଯୋଗ କରନ୍ତୁ।';
    return 'Verified buyer directory is temporarily unreachable. Please check with local FPO leadership.';
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
    const weatherUnavailableMsg = this.getWeatherUnavailableMessage(lang);

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

  private getWeatherUnavailableMessage(lang: string): string {
    if (lang.startsWith('te')) return 'ప్రత్యక్ష వాతావరణ సమాచార సేవ ప్రస్తుతం అందుబాటులో లేదు. ఖచ్చితమైన మరియు తాజా వాతావరణ సమాచారం కోసం దయచేసి భారత వాతావరణ శాఖ (IMD) లేదా "మౌసమ్" (Mausam) యాప్‌ను చూడండి. ఊహాజనిత వాతావరణ సమాచారం నిషిద్ధం.';
    if (lang.startsWith('ta')) return 'நேரடி வானிலை முன்னறிவிப்பு சேவை தற்போது கிடைக்கவில்லை. சான்றளிக்கப்பட்ட நிகழ்நேர முன்னறிவிப்புகள் மற்றும் மழை எச்சரிக்கைகளுக்கு இந்திய வானிலை ஆய்வுத் துறை (IMD) அல்லது அதிகாரப்பூர்வ "மௌசம்" செயலியைப் பார்க்கவும்.';
    if (lang.startsWith('hi')) return 'लाइव मौसम पूर्वानुमान सेवा वर्तमान में उपलब्ध नहीं है। वास्तविक और सटीक मौसम पूर्वानुमान के लिए कृपया भारत मौसम विज्ञान विभाग (IMD) या "मौसम" ऐप देखें। अनुमानित मौसम डेटा प्रदान नहीं किया जाता है।';
    if (lang.startsWith('ur')) return 'براہ راست موسمیاتی پیش گوئی کی خدمت فی الحال دستیاب نہیں ہے۔ تصدیق شدہ پیش گوئی اور بارش کے الرٹ کے لیے براہ کرم محکمہ موسمیات (IMD) یا سرکاری موسم ایپ سے رجوع کریں۔ موسمیاتی ڈیٹا من گھڑت نہیں بنایا جاتا۔';
    if (lang.startsWith('kn')) return 'ಲೈವ್ ಹವಾಮಾನ ಮುನ್ಸೂಚನೆ ಸೇವೆ ಸದ್ಯಕ್ಕೆ ಲಭ್ಯವಿಲ್ಲ. ನಿಖರ ಹವಾಮಾನ ಮಾಹಿತಿಗಾಗಿ ದಯವಿಟ್ಟು ಭಾರತೀಯ ಹವಾಮಾನ ಇಲಾಖೆ (IMD) ಅಥವಾ "ಮೌಸಮ್" ಆ್ಯಪ್ ಪರಿಶೀಲಿಸಿ.';
    if (lang.startsWith('ml')) return 'തത്സമയ കാലാവസ്ഥാ പ്രവചന സേവനം ഇപ്പോൾ ലഭ്യമല്ല. കൃത്യമായ കാലാവസ്ഥാ വിവരങ്ങൾക്ക് ദയവായി ഇന്ത്യൻ കാലാവസ്ഥാ വകുപ്പ് (IMD) അല്ലെങ്കിൽ "മൗസം" ആപ്പ് പരിശോധിക്കുക.';
    if (lang.startsWith('mr')) return 'थेट हवामान अंदाज सेवा सध्या उपलब्ध नाही. अचूक हवामान अंदाजासाठी कृपया भारतीय हवामान विभाग (IMD) किंवा "मौसम" ॲप पहा.';
    if (lang.startsWith('bn')) return 'লাইভ আবহাওয়ার পূর্বাভাস সেবা বর্তমানে অনুপলব্ধ। সঠিক পূর্বাভাস ও বৃষ্টিপাতের সতর্কতার জন্য ভারতীয় আবহাওয়া অধিদপ্তর (IMD) বা অফিসিয়াল "মৌসম" অ্যাপ দেখুন।';
    if (lang.startsWith('gu')) return 'લાઈવ હવામાન આગાહી સેવા હાલમાં ઉપલબ્ધ નથી. ચોક્કસ હવામાન માટે કૃપા કરીને ભારતીય હવામાન વિભાગ (IMD) અથવા "મૌસમ" એપ જુઓ.';
    if (lang.startsWith('pa')) return 'ਲਾਈਵ ਮੌਸਮ ਸੇਵਾ ਫਿਲਹਾਲ ਉਪਲਬਧ ਨਹੀਂ ਹੈ। ਸਹੀ ਜਾਣਕਾਰੀ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਭਾਰਤੀ ਮੌਸਮ ਵਿਭਾਗ (IMD) ਜਾਂ "ਮੌਸਮ" ਐਪ ਦੇਖੋ।';
    if (lang.startsWith('od') || lang.startsWith('or')) return 'ପାଣିପାଗ ସେବା ବର୍ତ୍ତମାନ ଉପଲବ୍ଧ ନାହିଁ। ସଠିକ୍ ପୂର୍ବାନୁମାନ ପାଇଁ ଦୟାକରି ଭାରତୀୟ ପାଣିପାଗ ବିଭାଗ (IMD) କିମ୍ବା "ମୌସମ" ଆପ୍ ଦେଖନ୍ତୁ।';
    return 'Live meteorological weather service is currently unavailable. For certified, real-time forecasts and rainfall alerts, please consult the India Meteorological Department (IMD) or the official Mausam app. Real-time weather data is never fabricated.';
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
      const asksDosage = /\b(dose|dosage|quantity|how much|rate|concentration|ml|gm|gram|spray rate|మోతాదు|ఎంత|పరిమాణం|మాత్ర|कितना|अளவு|مقدار|ಪ್ರಮಾಣ|അളവ്|मात्रा|পরিমাণ)\b/i.test(query);
      const hasDosageInEvidence = evidenceList.some(doc => {
        const text = `${doc.title} ${doc.reference}`.toLowerCase();
        return /\b(\d+(\.\d+)?\s*(ml|g|kg|l|gm|liter|litre|acre|ha|ppm))\b/i.test(text);
      });

      // Strict Rule: If dosage is requested and no verified dosage is in evidence, NEVER let Gemini invent it!
      if (asksDosage && !hasDosageInEvidence) {
        const chemReviewMsg = this.getChemicalDosageReviewMessage(lang);

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
      const ungroundedMsg = this.getUngroundedReviewMessage(lang);

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
          ? `[${this.getVerifiedRecordLabel(lang)}]: ${topEvidence.title}`
          : this.getVerifiedAdvisoryFallback(lang);

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
        ? `[${this.getVerifiedRecordLabel(lang)}]: ${topEvidence.title}`
        : this.getVerifiedAdvisoryFallback(lang);

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

  private getChemicalDosageReviewMessage(lang: string): string {
    if (lang.startsWith('te')) return 'ఈ రసాయన/పురుగుల మందుకు సంబంధించిన అధికారిక మోతాదు వివరాలు ధృవీకరించబడిన డేటాబేస్‌లో అందుబాటులో లేవు. పంట భద్రత దృష్ట్యా తప్పుడు మోతాదు సిఫార్సు చేయడం నిషిద్ధం. ఈ ప్రశ్న వ్యవసాయ నిపుణుల (PAE) సమీక్షకు పంపబడింది. దయచేసి స్థానిక వ్యవసాయ అధికారి లేదా KVK ని సంప్రదించండి.';
    if (lang.startsWith('ta')) return 'இந்த பூச்சிக்கொல்லி/இரசாயன மருந்திற்கான அதிகாரப்பூர்வ அளவு விவரங்கள் சரிபார்க்கப்பட்ட பதிவுகளில் கிடைக்கவில்லை. பயிர் பாதுகாப்பை உறுதிப்படுத்த சரியான அளவை உருவாக்க முடியாது. இது வேளாண் நிபுணர் (PAE/KVK) மதிப்பாய்வுக்கு அனுப்பப்பட்டுள்ளது.';
    if (lang.startsWith('hi')) return 'इस कीटनाशक/रासायनिक दवा के लिए आधिकारिक खुराक (मात्रा) सत्यापित डेटाबेस में उपलब्ध नहीं है। गलत मात्रा की सिफारिश फसल सुरक्षा के विरुद्ध है। यह प्रश्न कृषि विशेषज्ञ (PAE) समीक्षा के लिए भेजा गया है। कृपया नजदीकी KVK या कृषि अधिकारी से सलाह लें।';
    if (lang.startsWith('ur')) return 'اس کیمیائی کیڑے مار دوا کے لیے سرکاری مقدار کے اعداد و شمار تصدیق شدہ ریکارڈ میں دستیاب نہیں ہیں۔ فصل کے تحفظ کی خاطر من گھڑت مقدار فراہم نہیں کی جا سکتی۔ یہ سوال زرعی ماہر (PAE) کے جائزے کے لیے بھیج دیا گیا ہے۔';
    if (lang.startsWith('kn')) return 'ಈ ಕೀಟನಾಶಕ/ರಾಸಾಯನಿಕಕ್ಕೆ ಅಧಿಕೃತ ಪ್ರಮಾಣದ ವಿವರಗಳು ಪರಿಶೀಲಿಸಿದ ದಾಖಲೆಗಳಲ್ಲಿ ಲಭ್ಯವಿಲ್ಲ. ಬೆಳೆ ಸುರಕ್ಷತೆಯ ದೃಷ್ಟಿಯಿಂದ ಕೃಷಿ ತಜ್ಞರ (PAE) ಪರಿಶೀಲನೆಗೆ ಕಳುಹಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಸ್ಥಳೀಯ KVK ಅಥವಾ ಕೃಷಿ ಅಧಿಕಾರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.';
    if (lang.startsWith('ml')) return 'ഈ കീടനാശിനിയുടെ ഔദ്യോഗിക അളവ് വിവരങ്ങൾ സ്ഥിരീകരിച്ച ഡാറ്റാബേസിൽ ലഭ്യമല്ല. വിള സുരക്ഷയ്ക്കായി കൃഷി വിദഗ്ധന്റെ (PAE/KVK) അവലോകനത്തിനായി നൽകിയിരിക്കുന്നു. ദയവായി തദ്ദേശീയ കൃഷി ഉദ്യോഗസ്ഥരുമായി ബന്ധപ്പെടുക.';
    if (lang.startsWith('mr')) return 'या कीटकनाशकासाठी अधिकृत प्रमाणाचे तपशील उपलब्ध नाहीत. पीक सुरक्षेच्या दृष्टीने हा प्रश्न कृषी तज्ज्ञ (PAE) पुनरावलोकनासाठी पाठवला आहे. कृपया स्थानिक KVK शी संपर्क साधा.';
    if (lang.startsWith('bn')) return 'এই কীটনাশক/রাসায়নিকের অনুমোদিত মাত্রার তথ্য যাচাইকৃত ডাটাবেসে নেই। ফসলের সুরক্ষার স্বার্থে এটি কৃষি বিশেষজ্ঞ (PAE) পর্যালোচনার জন্য পাঠানো হয়েছে। স্থানীয় কৃষি কর্মকর্তার পরামর্শ নিন।';
    if (lang.startsWith('gu')) return 'આ જંતુનાશક માટે સત્તાવાર માત્રાની વિગતો ઉપલબ્ધ નથી. પાકની સુરક્ષા માટે આ પ્રશ્ન કૃષિ નિષ્ણાત (PAE) સમીક્ષા માટે મોકલવામાં આવ્યો છે. કૃપા કરીને સ્થાનિક KVK નો સંપર્ક કરો.';
    if (lang.startsWith('pa')) return 'ਇਸ ਕੀਟਨਾਸ਼ਕ ਲਈ ਅਧਿਕਾਰਤ ਖੁਰਾਕ ਦੇ ਵੇਰਵੇ ਉਪਲਬਧ ਨਹੀਂ ਹਨ। ਫਸਲ ਦੀ ਸੁਰੱਖਿਆ ਲਈ ਇਹ ਸਵਾਲ ਖੇਤੀਬਾੜੀ ਮਾਹਿਰ (PAE) ਸਮੀਖਿਆ ਲਈ ਭੇਜਿਆ ਗਿਆ ਹੈ।';
    if (lang.startsWith('od') || lang.startsWith('or')) return 'ଏହି କୀଟନାଶକର ସରକାରୀ ମାତ୍ରା ବିବରଣୀ ଉପଲବ୍ଧ ନାହିଁ। ଫସଲ ସୁରକ୍ଷା ପାଇଁ ଏହି ପ୍ରଶ୍ନ କୃଷି ବିଶେଷଜ୍ଞ (PAE) ସମୀକ୍ଷା ପାଇଁ ପଠାଯାଇଛି।';
    return 'Official dosage recommendations for this chemical/pesticide are not available in verified reference records. To ensure crop safety and avoid toxic under/over-dosage, exact application rates cannot be generated and this request has been routed to agricultural expert review (PAE/KVK). Please consult your local KVK or agricultural extension officer before spraying.';
  }

  private getUngroundedReviewMessage(lang: string): string {
    if (lang.startsWith('te')) return 'ఈ ప్రశ్నకు అధికారిక వ్యవసాయ డేటాబేస్‌లో ధృవీకరించబడిన సమాచారం అందుబాటులో లేదు. ఖచ్చితమైన పరిష్కారం కొరకు ఈ ప్రశ్న వ్యవసాయ నిపుణుల (PAE) సమీక్షకు పంపబడింది.';
    if (lang.startsWith('ta')) return 'அதிகாரப்பூர்வ வேளாண்மை தகவல் தளத்தில் இந்த கேள்விக்கு சரிபார்க்கப்பட்ட தகவல் கிடைக்கவில்லை. இது வேளாண் நிபுணர் (PAE) மறுஆய்வுக்கு அனுப்பப்பட்டுள்ளது.';
    if (lang.startsWith('hi')) return 'इस प्रश्न के लिए आधिकारिक कृषि डेटाबेस में सत्यापित जानकारी उपलब्ध नहीं है। सटीक समाधान के लिए यह प्रश्न कृषि विशेषज्ञ (PAE) समीक्षा के लिए भेजा गया है।';
    if (lang.startsWith('ur')) return 'اس سوال کے لیے سرکاری زرعی ڈیٹابیس میں تصدیق شدہ معلومات دستیاب نہیں ہے۔ یہ سوال زرعی ماہر (PAE) کے جائزے کے لیے بھیج دیا گیا ہے۔';
    if (lang.startsWith('kn')) return 'ಈ ಪ್ರಶ್ನೆಗೆ ಅಧಿಕೃತ ಕೃಷಿ ಜ್ಞಾನಕೋಶದಲ್ಲಿ ಪರಿಶೀಲಿಸಿದ ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ. ನಿಖರ ಪರಿಹಾರಕ್ಕಾಗಿ ಈ ಪ್ರಶ್ನೆಯನ್ನು ಕೃಷಿ ತಜ್ಞರ ಪರಿಶೀಲನೆಗೆ ಕಳುಹಿಸಲಾಗಿದೆ.';
    if (lang.startsWith('ml')) return 'ഈ ചോദ്യത്തിനുള്ള സ്ഥിരീകരിച്ച വിവരങ്ങൾ ഔദ്യോഗിക കാർഷിക ഡാറ്റാബേസിൽ ലഭ്യമല്ല. ഈ ചോദ്യം കാർഷിക വിദഗ്ധ അവലോകനത്തിനായി കൈമാറിയിരിക്കുന്നു.';
    if (lang.startsWith('mr')) return 'या प्रश्नासाठी अधिकृत कृषी डेटाबेसमध्ये पडताळलेली माहिती उपलब्ध नाही. हा प्रश्न कृषी तज्ज्ञ पुनरावलोकनासाठी पाठवला गेला आहे.';
    if (lang.startsWith('bn')) return 'এই প্রশ্নের জন্য অফিসিয়াল কৃষি ডাটাবেসে যাচাইকৃত তথ্য পাওয়া যায়নি। সঠিক সমাধানের জন্য প্রশ্নটি কৃষি বিশেষজ্ঞ পর্যালোচনার জন্য পাঠানো হয়েছে।';
    if (lang.startsWith('gu')) return 'આ પ્રશ્ન માટે સત્તાવાર કૃષિ ડેટાબેઝમાં ચકાસાયેલ માહિતી ઉપલબ્ધ નથી. આ પ્રશ્ન કૃષિ નિષ્ણાત સમીક્ષા માટે મોકલવામાં આવ્યો છે.';
    if (lang.startsWith('pa')) return 'ਇਸ ਸਵਾਲ ਲਈ ਸਰਕਾਰੀ ਖੇਤੀਬਾੜੀ ਡੇਟਾਬੇਸ ਵਿੱਚ ਪ੍ਰਮਾਣਿਤ ਜਾਣਕਾਰੀ ਉਪਲਬਧ ਨਹੀਂ ਹੈ। ਇਹ ਸਵਾਲ ਖੇਤੀਬਾੜੀ ਮਾਹਿਰ ਸਮੀਖਿਆ ਲਈ ਭੇਜਿਆ ਗਿਆ ਹੈ।';
    if (lang.startsWith('od') || lang.startsWith('or')) return 'ଏହି ପ୍ରଶ୍ନ ପାଇଁ ସରକାରୀ କୃଷି ଡାଟାବେସରେ ଯାଞ୍ଚ ହୋଇଥିବା ସୂଚନା ଉପଲବ୍ଧ ନାହିଁ। ଏହି ପ୍ରଶ୍ନ କୃଷି ବିଶେଷଜ୍ଞ ସମୀକ୍ଷା ପାଇଁ ପଠାଯାଇଛି।';
    return 'Verified information is not available for this question in official knowledge sources yet. This question has been routed to agricultural expert review.';
  }

  private getVerifiedRecordLabel(lang: string): string {
    if (lang.startsWith('te')) return 'ధృవీకరించబడిన సమాచారం';
    if (lang.startsWith('ta')) return 'சரிபார்க்கப்பட்ட பதிவு';
    if (lang.startsWith('hi')) return 'सत्यापित रिकॉर्ड';
    if (lang.startsWith('ur')) return 'تصدیق شدہ ریکارڈ';
    if (lang.startsWith('kn')) return 'ಪರಿಶೀಲಿಸಿದ ದಾಖಲೆ';
    if (lang.startsWith('ml')) return 'സ്ഥിരീകരിച്ച രേഖ';
    if (lang.startsWith('mr')) return 'सत्यापित नोंद';
    if (lang.startsWith('bn')) return 'যাচাইকৃত তথ্য';
    if (lang.startsWith('gu')) return 'ચકાસાયેલ રેકોર્ડ';
    if (lang.startsWith('pa')) return 'ਪ੍ਰਮਾਣਿਤ ਰਿਕਾਰਡ';
    if (lang.startsWith('od') || lang.startsWith('or')) return 'ଯାଞ୍ଚ ହୋଇଥିବା ରେକର୍ଡ';
    return 'Verified Record';
  }

  private getVerifiedAdvisoryFallback(lang: string): string {
    if (lang.startsWith('te')) return 'అధికారిక వ్యవసాయ సిఫార్సులు ధృవీకరించబడిన రికార్డుల్లో అందుబాటులో ఉన్నాయి. దయచేసి జతచేసిన నిపుణుల సలహాను చూడండి.';
    if (lang.startsWith('ta')) return 'சரிபார்க்கப்பட்ட அதிகாரப்பூர்வ வேளாண் ஆலோசனைகள் இணைக்கப்பட்டுள்ளன. நிபுணர் வழிகாட்டுதலைப் பார்க்கவும்.';
    if (lang.startsWith('hi')) return 'सत्यापित आधिकारिक कृषि सलाह उपलब्ध है। कृपया संलग्न विशेषज्ञ सलाह देखें।';
    if (lang.startsWith('ur')) return 'تصدیق شدہ سرکاری زرعی مشورہ دستیاب ہے۔ برائے مہربانی منسلک ماہرین کی رہنمائی دیکھیں۔';
    return 'Verified agricultural advisory is available in linked official records. Please refer to linked expert advisory.';
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

    const langDisplayName = getLanguageDisplayName(language);
    const systemPrompt = `You are AgriSeva-AI, an expert agricultural advisory assistant for Indian farmers.
STRICT COMPLIANCE RULES:
1. Grounding: Answer the user's question using ONLY the provided verified source evidence.
2. Anti-Hallucination: Do NOT invent chemical dosages, pesticide quantities, fertilizer rates, disease diagnoses, or market prices that are absent from the evidence.
3. Clarity: Write in simple, farmer-friendly, empathetic language without academic jargon.
4. Accuracy: If the evidence does not specify exact dosage or timing, clearly state that the farmer should consult their local KVK or agricultural extension officer for specific dosage recommendations.
5. MANDATORY USER LANGUAGE: The user submitted their question in ${langDisplayName} (${language}). You MUST generate your ENTIRE final response strictly in ${langDisplayName} (${language}). Do NOT respond in English unless ${language} is English. Even if the verified source evidence is in English, translate and synthesize the answer fluently into ${langDisplayName}.
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
