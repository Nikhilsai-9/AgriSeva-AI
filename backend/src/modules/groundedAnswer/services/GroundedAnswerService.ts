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

      return {
        questionId,
        answer: 'No verified institutional buyers are currently registered in this region for the specified crop. This query has been queued for regional FPO / procurement review.',
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
      const hasDosageInEvidence = evidenceList.some(doc => {
        const text = `${doc.title} ${doc.reference}`.toLowerCase();
        return /\b(\d+(\.\d+)?\s*(ml|g|kg|l|gm|liter|litre|acre|ha|ppm))\b/i.test(text);
      });

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
        return {
          questionId,
          answer: 'Unable to produce a verified answer adhering to strict safety guidelines from the available sources. Routed for expert review.',
          confidence: 'low',
          status: 'expert_review',
          sources: evidenceList,
          warnings: [...warnings, 'Answer quality gate failed on strict evidence verification'],
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

    const modelName = aiConfig.geminiModel || process.env.GEMINI_MODEL || this.DEFAULT_MODEL;

    const evidenceText = evidence.map((e, idx) => `[Source ${idx + 1} (${e.type.toUpperCase()})]: ${e.title}`).join('\n\n');

    const systemPrompt = `You are AgriSeva-AI, an expert agricultural advisory assistant for Indian farmers.
STRICT COMPLIANCE RULES:
1. Grounding: Answer the user's question using ONLY the provided verified source evidence.
2. Anti-Hallucination: Do NOT invent chemical dosages, pesticide quantities, fertilizer rates, disease diagnoses, or market prices that are absent from the evidence.
3. Clarity: Write in simple, farmer-friendly, empathetic language without academic jargon.
4. Accuracy: If the evidence does not specify exact dosage or timing, clearly state: "Please consult your local KVK or agricultural extension officer for specific dosage recommendations."
5. Language: Respond fluently in the requested language code: ${language}. Keep technical chemical names, crop varieties, and units intact.`;

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

    // Primary Call
    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
    );

    // If configured model returns 404 or fails, retry with fallback model
    if (!response.ok && modelName !== this.FALLBACK_MODEL) {
      console.warn(`Gemini primary model ${modelName} failed (${response.statusText}), attempting fallback ${this.FALLBACK_MODEL}...`);
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.FALLBACK_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        },
      );
    }

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errBody}`);
    }

    const data = (await response.json()) as any;
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText || !candidateText.trim()) {
      throw new Error('Gemini returned empty candidate text');
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
