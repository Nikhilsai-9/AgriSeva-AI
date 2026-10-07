import axios from 'axios';
import { appConfig } from '#root/config/app.js';
import type {
  IWhatsAppService,
  Thread,
  Message,
  ToolCall,
  IncomingWhatsAppMessageExtra,
} from '../interfaces/IWhatsAppService.js';
import { InternalServerError, NotFoundError, UnauthorizedError, ForbiddenError } from 'routing-controllers';
import { aiConfig } from '#root/config/ai.js';
import { IUserRepository } from '#root/shared/database/interfaces/IUserRepository.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { inject, injectable, optional } from 'inversify';
import { WhatsappUser, WhatsappUsersResponse, MongoDatabase, IUser } from '#root/shared/index.js';
import { GROUNDED_ANSWER_TYPES } from '#root/modules/groundedAnswer/types.js';
import type { IGroundedAnswerService } from '#root/modules/groundedAnswer/interfaces/IGroundedAnswerService.js';
import type { IContextService } from '#root/modules/context/interfaces/IContextService.js';
import { normalizePhoneNumber } from '#root/utils/phoneNumber.js';
import {
  detectLanguageFromText,
  getLanguageDisplayName,
} from '#root/modules/groundedAnswer/services/GroundedAnswerService.js';
import { Collection, ObjectId } from 'mongodb';
import type { QuestionSource } from '#root/shared/interfaces/models.js';

/**
 * Maps any form of language input — interactive button/list ID, typed language name
 * (in English, native script, or transliterated), or a digit shortcut — to a BCP-47
 * locale code such as 'te-IN'.
 *
 * Returns null when the input does not resemble a language selection at all.
 * This is the single authoritative lookup to fix the infinite language-loop bug.
 */
export function matchLanguageChoice(raw: string): string | null {
  const s = (raw || '').trim();
  if (!s) return null;

  // 1. Exact button / list IDs sent by our interactive menus
  if (s.startsWith('lang_')) {
    const code = s.replace('lang_', '');
    if (code && !code.startsWith('page')) return code; // e.g. 'te-IN'
  }

  const lower = s.toLowerCase();

  // 2. Digit shortcuts (1-10) matching the order shown in the language menu page 1
  const DIGIT_MAP: Record<string, string> = {
    '1': 'te-IN', '2': 'hi-IN', '3': 'ta-IN', '4': 'kn-IN', '5': 'en-IN',
    '6': 'mr-IN', '7': 'bn-IN', '8': 'gu-IN', '9': 'pa-IN', '10': 'ml-IN',
  };
  if (DIGIT_MAP[s]) return DIGIT_MAP[s];

  // Formatted list selections: "1. Telugu", "1 - తెలుగు", "2) Hindi", etc.
  const numberedMatch = s.match(/^(\d{1,2})[\.\-\)\:]\s*(.+)$/);
  if (numberedMatch) {
    const num = numberedMatch[1];
    const rest = numberedMatch[2].trim();
    const langFromRest = matchLanguageChoice(rest);
    if (langFromRest) return langFromRest;
    if (DIGIT_MAP[num] && !isLikelyAgriculturalQuery(rest)) return DIGIT_MAP[num];
  }

  const numberedSpaceMatch = s.match(/^(\d{1,2})\s+([a-zA-Z\u0080-\uffff]+)$/);
  if (numberedSpaceMatch) {
    const langFromRest = matchLanguageChoice(numberedSpaceMatch[2]);
    if (langFromRest) return langFromRest;
  }

  // Common phrases: "switch to telugu", "change language to hindi", "set to tamil"
  const phraseMatch = lower.match(/(?:switch|change|set|select|choose|want|in)?\s*(?:language\s*(?:to|as)?|to|in)?\s*([a-z\u0080-\uffff]+)/i);
  const candidate = phraseMatch ? phraseMatch[1].trim() : lower;

  // 3. Language names in any form: English name, native script, or common transliteration
  const NAME_MAP: Record<string, string> = {
    // English names
    'telugu': 'te-IN', 'hindi': 'hi-IN', 'tamil': 'ta-IN', 'kannada': 'kn-IN',
    'english': 'en-IN', 'marathi': 'mr-IN', 'bengali': 'bn-IN', 'bangla': 'bn-IN',
    'gujarati': 'gu-IN', 'punjabi': 'pa-IN', 'malayalam': 'ml-IN', 'odia': 'od-IN',
    'oriya': 'od-IN', 'assamese': 'as-IN', 'urdu': 'ur-IN', 'maithili': 'mai-IN',
    'konkani': 'kok-IN', 'nepali': 'ne-IN', 'kashmiri': 'ks-IN', 'dogri': 'doi-IN',
    'sindhi': 'sd-IN', 'bodo': 'brx-IN', 'santhali': 'sat-IN', 'manipuri': 'mni-IN',
    // Native scripts
    'తెలుగు': 'te-IN', 'हिन्दी': 'hi-IN', 'हिंदी': 'hi-IN', 'தமிழ்': 'ta-IN',
    'ಕನ್ನಡ': 'kn-IN', 'മലയാളം': 'ml-IN', 'मराठी': 'mr-IN', 'বাংলা': 'bn-IN',
    'ગુજરાતી': 'gu-IN', 'ਪੰਜਾਬੀ': 'pa-IN', 'ଓଡ଼ିଆ': 'od-IN', 'অসমীয়া': 'as-IN',
    'اردو': 'ur-IN', 'मैथिली': 'mai-IN', 'कोंकणी': 'kok-IN', 'नेपाली': 'ne-IN',
    'डोगरी': 'doi-IN',
    // Common transliterations / abbreviations
    'tel': 'te-IN', 'hin': 'hi-IN', 'tam': 'ta-IN', 'kan': 'kn-IN',
    'eng': 'en-IN', 'mar': 'mr-IN', 'ben': 'bn-IN', 'guj': 'gu-IN',
    'pun': 'pa-IN', 'mal': 'ml-IN', 'ori': 'od-IN', 'ass': 'as-IN',
    'teugu': 'te-IN', 'telgu': 'te-IN',
  };

  if (NAME_MAP[s]) return NAME_MAP[s];   // exact match (case-sensitive for scripts)
  if (NAME_MAP[lower]) return NAME_MAP[lower]; // case-insensitive English match
  if (NAME_MAP[candidate]) return NAME_MAP[candidate]; // phrase-extracted match

  // Clean trailing punctuation e.g. "telugu." or "hindi!"
  const cleanPunct = lower.replace(/[.,/#!$%^&*;:{}=\-_~()]/g, '').trim();
  if (NAME_MAP[cleanPunct]) return NAME_MAP[cleanPunct];

  return null;
}

/**
 * Checks if the text is explicitly a language selection command or name
 * (e.g. "Telugu", "Hindi", "change to Tamil", "తెలుగు") and not an agricultural question.
 */
export function isExplicitLanguageNameChoice(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim();
  if (!clean) return false;

  // If text is long (> 30 characters), it is almost certainly a query, not a standalone language pick
  if (clean.length > 30) return false;

  // If it matches an explicit language name or digit or phrase
  const matched = matchLanguageChoice(clean);
  if (!matched) return false;

  // Disqualify if it has distinct agricultural words
  const lower = clean.toLowerCase();
  const agriWords = ['disease', 'crop', 'leaf', 'spray', 'fertilizer', 'urea', 'pesticide', 'seed', 'price', 'mandi', 'रोग', 'पत्ता', 'పంట', 'తెగులు'];
  if (agriWords.some(w => lower.includes(w))) {
    return false;
  }

  return true;
}

/**
 * Content safety detector for WhatsApp interactions.
 * Flags severe abuse, sexual content, threats, and illegal trafficking,
 * while safeguarding legitimate farming terminology (pesticides, weed killing, pest control).
 */
export function checkContentSafety(text: string): { isViolating: boolean; reason?: string } {
  if (!text || typeof text !== 'string') return { isViolating: false };
  const lower = text.toLowerCase().trim();

  // If text mentions agricultural pests/crops/weeds, don't flag "kill" or "poison"
  const isAgriContext =
    /(pest|insect|weed|bug|caterpillar|worm|fungus|blight|aphid|borer|larva|beetle|rat|rodent|crop|plant|leaf|seed|soil|పురుగు|కీటకం|తెగులు|కలుపు|ఎలుక|పంట|कीड़ा|कीट|खरपतवार|फसल)/i.test(lower);

  // 1. Explicit sexual content & pornography
  const sexualPattern = /\b(porn|pornography|sex\b|nude|nudes|xxx|horny|boobs|penis|vagina|choot|lund|chod|bhosad|lanja|puku|modda)\b/i;
  if (sexualPattern.test(lower)) {
    return { isViolating: true, reason: 'sexual_content' };
  }

  // 2. Severe profanity & abusive hate slurs
  const abusivePattern = /\b(fuck|bitch|bastard|asshole|motherfucker|madarchod|bhenchod|harami|kutta|kamina|gandu|dengu|lanjamunda|naa kodaka)\b/i;
  if (abusivePattern.test(lower)) {
    return { isViolating: true, reason: 'abusive_language' };
  }

  // 3. Extreme violence, terror & weapon threats (exempting pest/weed control)
  if (!isAgriContext) {
    const terrorViolencePattern = /\b(kill you|murder you|bomb|terrorist|ak47|rpg|suicide|hang myself|shoot people|blow up|chavu|champutha|jaan se maar)\b/i;
    if (terrorViolencePattern.test(lower)) {
      return { isViolating: true, reason: 'violence_threat' };
    }
  }

  // 4. Illegal narcotics / contraband
  const drugsPattern = /\b(heroin|cocaine|meth\b|mdma|lsd|buy ganja|buy weed|charas|smack drug)\b/i;
  if (drugsPattern.test(lower)) {
    return { isViolating: true, reason: 'illegal_substances' };
  }

  return { isViolating: false };
}

export type ConversationalType = 'greeting' | 'gratitude' | 'ack' | 'about' | 'howAreYou' | 'help';

/**
 * Recognizes simple farmer conversational greetings, thank-yous, acknowledgements,
 * identity queries, and how-are-you questions to respond directly without running heavy RAG pipelines.
 */
export function isConversationalMessage(text: string): { isConversational: boolean; type?: ConversationalType } {
  if (!text || typeof text !== 'string') return { isConversational: false };
  const clean = text.trim().toLowerCase().replace(/[.!?,:;~_*\-]+/g, '').trim();

  // 1. Greetings
  const greetings = new Set([
    'hi', 'hello', 'hey', 'namaste', 'namaskar', 'vanakkam', 'namaskara',
    'good morning', 'good afternoon', 'good evening', 'morning',
    'హాయ్', 'నమస్తే', 'నమస్కారం', 'శుభోదయం', 'నమస్కారము',
    'नमस्ते', 'नमस्कार', 'शुभ प्रभात', 'प्रणाम',
    'வணக்கம்', 'காலை வணக்கம்',
    'ನಮಸ್ಕಾರ', 'ಶುಭೋದಯ',
  ]);
  if (greetings.has(clean)) {
    return { isConversational: true, type: 'greeting' };
  }

  // 2. Gratitude
  const gratitude = new Set([
    'thanks', 'thank you', 'thank u', 'thx', 'ty',
    'ధన్యవాదాలు', 'ధన్యవాదం', 'థాంక్స్', 'కృతజ్ఞతలు',
    'धन्यवाद', 'शुक्रिया', 'थैंक्स',
    'நன்றி', 'மிக்க நன்றி',
    'ಧನ್ಯವಾದಗಳು', 'ತುಂಬಾ ಧನ್ಯವಾದಗಳು',
  ]);
  if (gratitude.has(clean)) {
    return { isConversational: true, type: 'gratitude' };
  }

  // 3. Acknowledgements
  const acks = new Set([
    'ok', 'okay', 'okk', 'k', 'yes', 'no', 'done', 'fine', 'sure', 'alright',
    'సరే', 'సరే అండి', 'అలాగే', 'సరే సార్',
    'ठीक है', 'अच्छा', 'हाँ', 'हां', 'जी',
    'சரி', 'ஆகட்டும்',
    'ಸರಿ', 'ಆಯಿತು',
  ]);
  if (acks.has(clean)) {
    return { isConversational: true, type: 'ack' };
  }

  // 4. About / Identity
  const aboutPatterns = [
    /^who are you\??$/,
    /^what is agriseva\??$/,
    /^who is agriseva\??$/,
    /^what can you do\??$/,
    /^nuvvu evaru\??$/,
    /^nuvvevaru\??$/,
    /^నువ్వు ఎవరు\??$/,
    /^నువ్వెవరు\??$/,
    /^మీరు ఎవరు\??$/,
    /^आप कौन हैं\??$/,
    /^तुम कौन हो\??$/,
    /^நீங்கள் யார்\??$/,
    /^ನೀವು ಯಾರು\??$/,
  ];
  if (aboutPatterns.some(p => p.test(clean))) {
    return { isConversational: true, type: 'about' };
  }

  // 5. How are you
  const howAreYouPatterns = [
    /^how are you\??$/,
    /^how are u\??$/,
    /^how r u\??$/,
    /^ela unnaru\??$/,
    /^bagunnara\??$/,
    /^ఎలా ఉన్నారు\??$/,
    /^బాగున్నారా\??$/,
    /^आप कैसे हैं\??$/,
    /^आप कैसी हैं\??$/,
    /^कैसे हो\??$/,
    /^எப்படி இருக்கிறீர்கள்\??$/,
    /^ಹೇಗಿದ್ದೀರ\??$/,
  ];
  if (howAreYouPatterns.some(p => p.test(clean))) {
    return { isConversational: true, type: 'howAreYou' };
  }

  // 6. Help command
  if (clean === 'help' || clean === 'సహాయం' || clean === 'मदद' || clean === 'உதவி' || clean === 'ಸಹಾಯ') {
    return { isConversational: true, type: 'help' };
  }

  return { isConversational: false };
}

/**
 * Discerns genuine agricultural inquiries from clear off-topic queries (money, sports, movies, coding).
 */
export function isLikelyAgriculturalQuery(text: string): boolean {
  if (!text || typeof text !== 'string') return true;
  const lower = text.toLowerCase().trim();

  // Known agricultural keywords
  const agriRegex = /(crop|plant|leaf|leaves|yellow|seed|soil|water|drip|irrigate|irrigation|fertilizer|urea|npk|potash|compost|pesticide|insecticide|fungicide|herbicide|weedicide|spray|weed|harvest|sowing|disease|rot|wilt|blight|spot|curl|rust|canker|pest|borer|caterpillar|worm|aphid|whitefly|mite|beetle|yield|mandi|price|rate|cost|msp|quintal|acre|hectare|field|farm|farmer|agriculture|horticulture|monsoon|rain|weather|temperature|kisan|rythu|subsidy|scheme|pm.?kisan|dairy|cow|buffalo|cattle|goat|sheep|poultry|fodder|feed|veterinary|tomato|paddy|rice|wheat|cotton|chilli|mirchi|onion|potato|maize|corn|soyabean|soya|groundnut|peanut|sugarcane|banana|mango|mustard|gram|pulse|turmeric|ginger|garlic|brinjal|eggplant|cabbage|cauliflower|okra|bhendi|citrus|lemon|orange|guava|coconut|papaya|tea|coffee|rubber|tobacco|వరి|టమోటా|పత్తి|మిరప|ఉల్లి|బంగాళదుంప|మొక్కజొన్న|వేరుశనగ|చెరకు|మామిడి|కొబ్బరి|అరటి|పంట|ఆకు|ఆకులు|మొక్క|విత్తనం|విత్తనాలు|నేల|భూమి|ఎరువు|యూరియా|పురుగు|కీటకం|తెగులు|వ్యాధి|మందు|పిచికారీ|కలుపు|దిగుబడి|మండి|ధర|రేటు|రైతు|పశువు|ఆవు|గేదె|పాల|వర్షం|వాతావరణం|స్కీమ్|धान|चावल|गेहूं|कपास|मिर्च|प्याज|आलू|मक्का|सोयाबीन|मूंगफली|गन्ना|सरसों|टमाटर|फसल|पत्ता|पत्ती|पौधा|बीज|मिट्टी|खाद|उर्वरक|यूरिया|कीट|कीड़ा|रोग|दवा|स्प्रे|खरपतवार|उपज|मंडी|भाव|दाम|रेट|किसान|खेती|पशु|गाय|भैंस|दूध|बारिश|मौसम)/i;

  if (agriRegex.test(lower)) {
    return true;
  }

  // Obvious non-agricultural patterns
  const nonAgriRegex = /\b(money|cricket|ipl|football|movie|song|cinema|actor|actress|bollywood|hollywood|python|java|javascript|coding|code|crypto|bitcoin|stock market|share market|politics|election|president|prime minister|narendra modi|donald trump|capital of|who invented|solve \d+|joke|shayari|poem|love story|girlfriend|boyfriend)\b/i;

  if (nonAgriRegex.test(lower)) {
    return false;
  }

  // If ambiguous or natural language inquiry, assume true
  return true;
}

export interface IWhatsAppSession {
  _id?: ObjectId | string;
  phoneNumber: string;
  rawFrom: string;
  userId?: ObjectId | string;
  userName?: string;
  preferredLanguage?: string;
  languageSelectedExplicitly?: boolean;
  awaitingLanguageSelection?: boolean;
  blocked?: boolean;
  blockedAt?: Date;
  blockReason?: string;
  warningCount?: number;
  lastViolationAt?: Date;
  farmerDetails?: {
    crop?: string;
    state?: string;
    district?: string;
  };
  pendingFirstMessage?: {
    text?: string;
    msgType?: string;
    mediaId?: string;
    mimeType?: string;
    caption?: string;
    timestamp?: Date;
  };
  lastMessageAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  history?: {
    role: 'user' | 'assistant' | 'expert' | 'system';
    content: string;
    timestamp: Date;
    msgType?: string;
    mediaUrl?: string;
    senderName?: string;
    status?: string;
  }[];
}

@injectable()
export class WhatsAppService implements IWhatsAppService {
  private sessionsCollection?: Collection<IWhatsAppSession>;

  constructor(
    @inject(GLOBAL_TYPES.UserRepository)
    private readonly userRepo: IUserRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,
    @optional()
    @inject(GROUNDED_ANSWER_TYPES.GroundedAnswerService)
    private readonly groundedAnswerService?: IGroundedAnswerService,
    @optional()
    @inject(GLOBAL_TYPES.ContextService)
    private readonly contextService?: IContextService,
  ) {}
  // private readonly baseUrl = aiConfig.serverIP;
  private readonly baseUrl =
    'http://' + aiConfig.serverIP + ':' + aiConfig.whatsAppServerPort;
  private readonly WHATSAPP_SERVER_URL = aiConfig.WHATSAPP_SERVER_URL;
  private readonly WA_WEBHOOK_API_KEY = appConfig.WA_WEBHOOK_API_KEY;

  /**
   * Checks whether the user has administrative / moderator privileges
   * to view all farmer WhatsApp conversations (Requirement 20).
   */
  public isStaffOrAdmin(user: IUser): boolean {
    const privilegedRoles = [
      'admin',
      'moderator',
      'expert',
      'pae_expert',
      'call_agent',
      'gate_keeper',
      'auditor',
      'district_coordinator',
      'block_coordinator',
    ];
    return privilegedRoles.includes(user.role as string) || !!user.special_task_force;
  }

  /**
   * Builds the MongoDB query filter for WhatsApp sessions based on the authenticated user.
   * Admins and moderators receive full access ({}).
   * Normal users receive a filter strictly matching their userId or phone number variations.
   */
  public buildUserSessionFilter(user: IUser): Record<string, any> {
    if (this.isStaffOrAdmin(user)) {
      return {};
    }

    const orConditions: Record<string, any>[] = [];

    // 1. Match by userId (string or ObjectId)
    if (user._id) {
      const idStr = user._id.toString();
      const userIds: any[] = [idStr];
      if (ObjectId.isValid(idStr)) {
        userIds.push(new ObjectId(idStr));
      }
      orConditions.push({ userId: { $in: userIds } });
    }

    // 2. Match by phone numbers (mobile or farmerProfile.phone)
    const phoneVariants = new Set<string>();
    const collectPhoneVariants = (phoneStr?: string | null) => {
      if (!phoneStr) return;
      const trimmed = phoneStr.trim();
      if (!trimmed) return;
      phoneVariants.add(trimmed);
      const canonical = normalizePhoneNumber(trimmed);
      if (canonical) phoneVariants.add(canonical);
      const digitsOnly = trimmed.replace(/\D/g, '');
      if (digitsOnly) {
        phoneVariants.add(digitsOnly);
        const d10 = digitsOnly.slice(-10);
        if (d10 && d10.length === 10) {
          phoneVariants.add(d10);
          phoneVariants.add(`+91${d10}`);
          phoneVariants.add(`91${d10}`);
        }
      }
    };

    collectPhoneVariants(user.mobile);
    if (user.farmerProfile?.phone) {
      collectPhoneVariants(user.farmerProfile.phone);
    }

    const phoneList = Array.from(phoneVariants);
    if (phoneList.length > 0) {
      orConditions.push({ phoneNumber: { $in: phoneList } });
      orConditions.push({ rawFrom: { $in: phoneList } });
    }

    // If user has no ID and no phone, they match nothing
    if (orConditions.length === 0) {
      return { _id: { $exists: false } };
    }

    return { $or: orConditions };
  }

  /**
   * Verifies whether a specific session belongs to the given user.
   */
  public isSessionOwnedByUser(session: IWhatsAppSession, user: IUser): boolean {
    if (this.isStaffOrAdmin(user)) {
      return true;
    }

    // Check direct userId match
    if (session.userId && user._id && session.userId.toString() === user._id.toString()) {
      return true;
    }

    // Check phone number match
    const userPhones = new Set<string>();
    const collectPhoneVariants = (phoneStr?: string | null) => {
      if (!phoneStr) return;
      const trimmed = phoneStr.trim();
      if (!trimmed) return;
      userPhones.add(trimmed);
      const canonical = normalizePhoneNumber(trimmed);
      if (canonical) userPhones.add(canonical);
      const digitsOnly = trimmed.replace(/\D/g, '');
      if (digitsOnly) {
        userPhones.add(digitsOnly);
        const d10 = digitsOnly.slice(-10);
        if (d10 && d10.length === 10) {
          userPhones.add(d10);
          userPhones.add(`+91${d10}`);
          userPhones.add(`91${d10}`);
        }
      }
    };

    collectPhoneVariants(user.mobile);
    if (user.farmerProfile?.phone) {
      collectPhoneVariants(user.farmerProfile.phone);
    }

    if (session.phoneNumber && userPhones.has(session.phoneNumber)) return true;
    if (session.rawFrom && userPhones.has(session.rawFrom)) return true;

    const sessionD10 = (session.phoneNumber || session.rawFrom || '').replace(/\D/g, '').slice(-10);
    if (sessionD10 && userPhones.has(sessionD10)) return true;

    return false;
  }

  /**
   * Public helper to verify if a user owns a conversation given its phoneNumber or session ID
   */
  public async isUserConversationOwner(user: IUser, phoneNumberOrId: string): Promise<boolean> {
    if (this.isStaffOrAdmin(user)) return true;
    const sessionsCol = await this.getSessionsCollection();
    const cleanPhone = phoneNumberOrId.includes('-') ? phoneNumberOrId.split('-')[0] : phoneNumberOrId;
    const canonicalPhone = normalizePhoneNumber(cleanPhone);
    const domestic10 = cleanPhone.replace(/\D/g, '').slice(-10);

    const session = await sessionsCol.findOne({
      $or: [
        { phoneNumber: canonicalPhone },
        { phoneNumber: cleanPhone },
        { rawFrom: cleanPhone },
        { rawFrom: domestic10 },
        { phoneNumber: `+91${domestic10}` },
        ...(ObjectId.isValid(phoneNumberOrId) ? [{ _id: new ObjectId(phoneNumberOrId) }] : []),
      ],
    });

    if (!session) return false;
    return this.isSessionOwnedByUser(session, user);
  }

  async getThreads(user: IUser, page?: number, limit?: number, search?: string): Promise<Thread[]> {
    try {
      const sessionsCol = await this.getSessionsCollection();
      const usersCol = await this.mongoDatabase.getCollection<IUser>('users');

      // 1. Build user-specific ownership filter (Requirement 3, 4, 5)
      const userFilter = this.buildUserSessionFilter(user);

      // Fetch user-scoped sessions sorted by updatedAt / lastMessageAt descending (Requirement 9)
      const sessions = await sessionsCol
        .find(userFilter)
        .sort({ updatedAt: -1, lastMessageAt: -1, createdAt: -1 })
        .toArray();

      if (sessions.length > 0) {
        // Collect phone numbers to resolve real farmer profiles
        const phoneList: string[] = [];
        sessions.forEach((s) => {
          if (s.phoneNumber) phoneList.push(s.phoneNumber);
          if (s.rawFrom) phoneList.push(s.rawFrom);
          const d10 = (s.phoneNumber || s.rawFrom || '').replace(/\D/g, '').slice(-10);
          if (d10) phoneList.push(d10);
        });

        const matchedUsers = await usersCol
          .find({
            $or: [
              { mobile: { $in: phoneList } },
              { 'farmerProfile.phone': { $in: phoneList } },
            ],
          })
          .toArray();

        const userByPhone = new Map<string, IUser>();
        matchedUsers.forEach((u) => {
          if (u.mobile) {
            userByPhone.set(u.mobile, u);
            userByPhone.set(u.mobile.replace(/\D/g, '').slice(-10), u);
          }
          if (u.farmerProfile?.phone) {
            userByPhone.set(u.farmerProfile.phone, u);
            userByPhone.set(u.farmerProfile.phone.replace(/\D/g, '').slice(-10), u);
          }
        });

        const threads: Thread[] = [];

        for (const session of sessions) {
          const rawPhone = session.phoneNumber || session.rawFrom;
          if (!rawPhone) continue;

          const domestic10 = rawPhone.replace(/\D/g, '').slice(-10);
          const matchedUser =
            userByPhone.get(rawPhone) ||
            userByPhone.get(session.rawFrom) ||
            userByPhone.get(domestic10);

          const farmerName =
            session.userName ||
            (matchedUser
              ? `${matchedUser.firstName || ''} ${matchedUser.lastName || ''}`.trim()
              : (!this.isStaffOrAdmin(user)
                  ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined
                  : undefined));

          // Determine last message, timestamp, and unread state
          let lastMsg = 'No message available';
          let lastTimestamp =
            session.lastMessageAt ||
            session.updatedAt ||
            session.createdAt ||
            new Date();
          let isLastFromUser = false;

          if (session.history && session.history.length > 0) {
            const lastEntry = session.history[session.history.length - 1];
            if (lastEntry.content) {
              lastMsg = lastEntry.content;
            }
            if (lastEntry.timestamp) {
              lastTimestamp = new Date(lastEntry.timestamp);
            }
            isLastFromUser = lastEntry.role === 'user';
          } else if (session.pendingFirstMessage?.text) {
            lastMsg = session.pendingFirstMessage.text;
            if (session.pendingFirstMessage.timestamp) {
              lastTimestamp = new Date(session.pendingFirstMessage.timestamp);
            }
            isLastFromUser = true;
          }

          // Format last message date in Asia/Kolkata timezone (YYYY-MM-DD)
          const lastMessageDate = new Date(lastTimestamp).toLocaleDateString('en-CA', {
            timeZone: 'Asia/Kolkata',
          });

          // Check if session has expert review requirement
          const hasPaeEscalation = session.history?.some(
            (m) =>
              m.content &&
              (m.content.includes('PAE') ||
                m.content.includes('వ్యవసాయ నైపుణ్యం') ||
                m.content.includes('వ్యవసాయ నిపుణుల') ||
                m.content.includes('कृषि विशेषज्ञ') ||
                m.content.includes('Agricultural Expert')),
          );

          let status = 'Active';
          if (session.pendingFirstMessage && (!session.history || session.history.length === 0)) {
            status = 'Awaiting Language Selection';
          } else if (hasPaeEscalation) {
            status = 'Expert Review Required';
          }

          threads.push({
            id: rawPhone,
            phoneNumber: rawPhone,
            farmerName: farmerName || undefined,
            lastMessage: lastMsg,
            lastMessageTimestamp: lastTimestamp,
            lastMessageDate,
            unreadCount: isLastFromUser ? 1 : 0,
            language: session.preferredLanguage,
            status,
            avatar: matchedUser?.avatar || (!this.isStaffOrAdmin(user) ? user.avatar : undefined),
          });
        }

        // Search filtering (Requirement 7) - applied ONLY within user's conversations
        let result = threads;
        if (search) {
          const q = search.trim().toLowerCase();
          result = result.filter(
            (t) =>
              t.phoneNumber.toLowerCase().includes(q) ||
              (t.farmerName && t.farmerName.toLowerCase().includes(q)) ||
              t.lastMessage.toLowerCase().includes(q),
          );
        }

        // Pagination (Requirement 9)
        if (page && limit) {
          const skip = (page - 1) * limit;
          result = result.slice(skip, skip + limit);
        }

        return result;
      }

      // If normal user has no sessions matching their filter, return empty array!
      if (!this.isStaffOrAdmin(user)) {
        return [];
      }

      // Fallback only for staff/admin if MongoDB has no sessions
      return await this.fetchThreadsFromLangGraph();
    } catch (error) {
      console.error('[WhatsAppService] Error in getThreads:', error);
      if (this.isStaffOrAdmin(user)) {
        try {
          return await this.fetchThreadsFromLangGraph();
        } catch (lgErr) {
          console.warn('[WhatsAppService] LangGraph fallback also failed:', lgErr);
          return [];
        }
      }
      return [];
    }
  }

  async getThreadDetails(
    user: IUser,
    phoneNumber: string,
    date: string,
  ): Promise<Message[]> {
    try {
      const sessionsCol = await this.getSessionsCollection();
      const cleanPhone = phoneNumber.includes('-')
        ? phoneNumber.split('-')[0]
        : phoneNumber;
      const canonicalPhone = normalizePhoneNumber(cleanPhone);
      const domestic10 = cleanPhone.replace(/\D/g, '').slice(-10);

      const session = await sessionsCol.findOne({
        $or: [
          { phoneNumber: canonicalPhone },
          { phoneNumber: cleanPhone },
          { rawFrom: cleanPhone },
          { rawFrom: domestic10 },
          { phoneNumber: `+91${domestic10}` },
          ...(ObjectId.isValid(phoneNumber) ? [{ _id: new ObjectId(phoneNumber) }] : []),
        ],
      });

      if (!session) {
        if (!this.isStaffOrAdmin(user)) {
          throw new NotFoundError('Conversation not found');
        }
        return await this.fetchThreadDetailsFromLangGraph(phoneNumber, date);
      }

      // OWNERSHIP ENFORCEMENT (Requirement 6, 11, 18)
      if (!this.isSessionOwnedByUser(session, user)) {
        throw new ForbiddenError('You are not authorized to access this conversation');
      }

      // If session is owned by user but userId was unlinked, persist linkage now
      if (!session.userId && user._id) {
        session.userId = user._id.toString();
        sessionsCol.updateOne({ _id: session._id }, { $set: { userId: user._id.toString() } }).catch(() => {});
      }

      const messages: Message[] = [];
      let msgIndex = 0;

      // Pending first message if not yet present in history
      if (
        session.pendingFirstMessage?.text &&
        (!session.history ||
          !session.history.some(
            (h) => h.content === session.pendingFirstMessage?.text,
          ))
      ) {
        messages.push({
          id: `msg-pending-${session.pendingFirstMessage.timestamp ? new Date(session.pendingFirstMessage.timestamp).getTime() : msgIndex++}`,
          role: 'user',
          content: session.pendingFirstMessage.text,
          timestamp: session.pendingFirstMessage.timestamp
            ? new Date(session.pendingFirstMessage.timestamp)
            : new Date(session.createdAt || Date.now()),
          msgType: (session.pendingFirstMessage.msgType as any) || 'text',
          senderName: session.userName || (!this.isStaffOrAdmin(user) ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Farmer') || 'Farmer',
        });
      }

      // History messages
      if (session.history && session.history.length > 0) {
        session.history.forEach((h, idx) => {
          const isExpert =
            h.role === 'expert' ||
            (h.role === 'assistant' &&
              h.content &&
              (h.content.startsWith('👨‍🌾') ||
                h.content.includes('వ్యవసాయ నిపుణుల (PAE)')));

          const role = isExpert ? 'expert' : h.role;
          const senderName =
            role === 'user'
              ? (session.userName || (!this.isStaffOrAdmin(user) ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Farmer') || 'Farmer')
              : isExpert
                ? (h.senderName || 'Agricultural Expert (PAE)')
                : 'AgriSeva-AI';

          messages.push({
            id: `msg-${idx}-${new Date(h.timestamp).getTime()}`,
            role,
            content: h.content || '',
            timestamp: new Date(h.timestamp),
            msgType: (h.msgType as any) || 'text',
            mediaUrl: (h as any).mediaUrl,
            senderName,
          });
        });
      }

      // Sort messages chronologically
      messages.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      // Date filtering if requested and not 'all'
      if (date && date !== 'all') {
        const filtered = messages.filter((m) => {
          const msgDate = new Date(m.timestamp).toLocaleDateString('en-CA', {
            timeZone: 'Asia/Kolkata',
          });
          return msgDate === date;
        });

        // Only return filtered if there are matches for that date; otherwise return all
        if (filtered.length > 0) {
          return filtered;
        }
      }

      return messages;
    } catch (error: any) {
      if (error instanceof ForbiddenError || error instanceof NotFoundError) {
        throw error;
      }
      console.error(
        `[WhatsAppService] Error fetching thread details for ${phoneNumber}:`,
        error,
      );
      if (this.isStaffOrAdmin(user)) {
        try {
          return await this.fetchThreadDetailsFromLangGraph(phoneNumber, date);
        } catch (lgErr) {
          console.warn('[WhatsAppService] LangGraph fallback failed:', lgErr);
          return [];
        }
      }
      return [];
    }
  }

  private async fetchThreadsFromLangGraph(): Promise<Thread[]> {
    const response = await axios.get(`${this.baseUrl}/threads`);
    const data = response.data;
    const uniqueThreadsMap = new Map<string, Thread>();

    (data.threads as any[])
      .filter(
        (t: any) =>
          /^\d{12}(-\d{4}-\d{2}-\d{2})?$/.test(t.thread_id) &&
          t.metadata &&
          Object.keys(t.metadata).length > 0 &&
          t.updated_at !== null,
      )
      .forEach((t: any) => {
        const phoneNumber = t.thread_id.split('-')[0];
        const existing = uniqueThreadsMap.get(phoneNumber);

        if (
          !existing ||
          new Date(t.updated_at) > existing.lastMessageTimestamp
        ) {
          let lastMessageDate = '';
          if (t.thread_id.includes('-')) {
            lastMessageDate = t.thread_id.split('-').slice(1).join('-');
          } else {
            lastMessageDate = new Date(t.updated_at).toLocaleDateString(
              'en-CA',
              { timeZone: 'Asia/Kolkata' },
            );
          }

          uniqueThreadsMap.set(phoneNumber, {
            id: phoneNumber,
            phoneNumber,
            lastMessage: t.metadata.thread_name || 'No message available',
            lastMessageTimestamp: new Date(t.updated_at),
            lastMessageDate,
            unreadCount: 0,
          });
        }
      });

    return Array.from(uniqueThreadsMap.values());
  }

  private async fetchThreadDetailsFromLangGraph(
    phoneNumber: string,
    date: string,
  ): Promise<Message[]> {
    let threadId = phoneNumber;
    if (!threadId.includes('-') && date && date !== 'all') {
      threadId = `${phoneNumber}-${date}`;
    }

    const response = await axios.get(
      `${this.baseUrl}/threads/${threadId}/state`,
    );
    const data = response.data;
    const messages = (data.values?.messages as any[]) || [];
    const formattedMessages: Message[] = [];

    const toolResponsesMap: Record<string, any> = {};
    messages.forEach((msg: any) => {
      if (msg.type === 'tool') {
        let resp =
          msg.artifact?.structured_content?.result || msg.content;
        if (typeof resp === 'string' && resp.startsWith('{')) {
          try {
            resp = JSON.parse(resp);
          } catch (e) {}
        }
        toolResponsesMap[msg.tool_call_id] = resp;
      }
    });

    messages.forEach((msg: any, idx: number) => {
      if (msg.type === 'human') {
        formattedMessages.push({
          id: msg.id || `h-${idx}`,
          role: 'user',
          content: typeof msg.content === 'string' ? msg.content : '',
          timestamp: new Date(data.created_at || Date.now()),
        });
      } else if (msg.type === 'ai') {
        const toolCalls: ToolCall[] =
          msg.tool_calls?.map((tc: any) => ({
            name: tc.name,
            args: tc.args,
            id: tc.id,
            response: toolResponsesMap[tc.id],
          })) || [];

        const content =
          typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content
                  .filter((c: any) => c.type === 'text')
                  .map((c: any) => c.text)
                  .join('\n')
              : '';

        if (content || toolCalls.length > 0) {
          formattedMessages.push({
            id: msg.id || `a-${idx}`,
            role: 'assistant',
            content:
              content || (toolCalls.length > 0 ? 'Executing tools...' : ''),
            timestamp: new Date(data.created_at || Date.now()),
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          });
        }
      }
    });

    return formattedMessages;
  }

  async sendMessage(
    userId: string,
    phoneNumber: string,
    messageText: string,
  ): Promise<void> {
    try {
      console.log('[WhatsAppService] sendMessage called with:', {
        userId,
        phoneNumber,
        messageText,
      });

      const user = await this.userRepo.findById(userId);
      if (!user) {
        throw new UnauthorizedError(
          "You don't have permission to send message!",
        );
      }

      const senderName =
        `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
        'AgriSeva Moderator';
      const isExpert =
        user.role === 'expert' ||
        user.role === 'pae_expert' ||
        (user as any).special_task_force;

      const canonicalPhone = normalizePhoneNumber(phoneNumber);
      const rawTarget = canonicalPhone.replace(/\D/g, '');
      const targetPhoneId = this.getDefaultPhoneId();

      const outboundText = isExpert
        ? `👨‍🌾 *వ్యవసాయ నిపుణుల సలహా / Expert Advisory* (${senderName}):\n\n${messageText}\n\n━━━━━━━━━━━━━━━━\n_🌾 AgriSeva-AI_`
        : messageText;

      // 1. Dispatch outbound message via Meta WhatsApp Cloud API directly
      try {
        await this.sendTextMessage(rawTarget, targetPhoneId, outboundText);
        console.log(`[WhatsAppService] Outbound message sent via Meta Cloud API to ${rawTarget}`);
      } catch (metaErr: any) {
        console.warn('[WhatsAppService] Direct Meta Cloud API delivery notice:', metaErr.message);
      }

      // 2. Persist to MongoDB whatsapp_sessions
      const sessionsCol = await this.getSessionsCollection();
      const messageEntry = {
        role: isExpert ? ('expert' as const) : ('assistant' as const),
        content: outboundText,
        timestamp: new Date(),
        msgType: 'text',
        senderName,
      };

      await sessionsCol.updateOne(
        {
          $or: [
            { phoneNumber: canonicalPhone },
            { phoneNumber },
            { rawFrom: rawTarget },
            { rawFrom: phoneNumber },
          ],
        },
        {
          $push: { history: messageEntry as any },
          $set: {
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );

      console.log('[WhatsAppService] Outgoing message persisted to MongoDB whatsapp_sessions');

      // 3. Optional webhook notification if configured
      const webhookUrl = appConfig.WA_SEND_MESSAGE_WEBHOOK_API_URL;
      if (webhookUrl && webhookUrl.startsWith('http')) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-api-key': appConfig.WA_WEBHOOK_API_KEY,
            },
            body: JSON.stringify({
              phoneNumber,
              messageText: outboundText,
              sendBy: senderName,
              userId: user._id.toString(),
            }),
          });
        } catch (whErr: any) {
          console.warn('[WhatsAppService] Optional webhook notification error:', whErr.message);
        }
      }
    } catch (error: any) {
      console.error(
        `[WhatsAppService] Error sending WhatsApp message to ${phoneNumber}:`,
        error.message,
      );
      throw new InternalServerError(`WhatsApp API Error: ${error.message}`);
    }
  }

  async getInactiveUsers(
    skip: number,
    limit: number,
  ): Promise<WhatsappUsersResponse> {

    try {
      const response = await axios.get(`${this.WHATSAPP_SERVER_URL}/whatsapp/users`, {
        params: {
          isPaginated: true,
          skip,
          limit,
        },
        headers: {
          'x-internal-api-key': this.WA_WEBHOOK_API_KEY,
        },
      });

      const usersResponse = response.data as WhatsappUsersResponse;

      return usersResponse;    
      } catch (error) {
      console.error('Error fetching inactive WhatsApp users:', error);

      throw new InternalServerError('Failed to fetch inactive WhatsApp users');
    }
  }

  async getAllUsers(): Promise<WhatsappUsersResponse> {
    try {
      const response = await axios.get(`${this.WHATSAPP_SERVER_URL}/whatsapp/users`, {
        params: {
          isPaginated: false,
        },
        headers: {
          'x-internal-api-key': this.WA_WEBHOOK_API_KEY,
        },
      });

      const usersResponse = response.data as WhatsappUsersResponse;

      return usersResponse;    
      } catch (error) {
      console.error('Error fetching inactive WhatsApp users:', error);

      throw new InternalServerError('Failed to fetch inactive WhatsApp users');
    }
  }

  async getUniqueUsers(): Promise<number> {
    try {
      const response = await axios.get(`${this.WHATSAPP_SERVER_URL}/whatsapp/users/count`, {
        params: {
          isPaginated: false,
        },
        headers: {
          'x-internal-api-key': this.WA_WEBHOOK_API_KEY,
        },
      });

      const uniqueUsersCount = response.data.uniqueUserCount;

      return uniqueUsersCount;    
    } catch (error) {
      console.error('Error fetching unique WhatsApp users count:', error);
      return 0;
    }
  }

  private getCloudToken(): string {
    return (
      process.env.META_WA_ACCESS_TOKEN ||
      process.env.WHATSAPP_CLOUD_API_TOKEN ||
      process.env.META_ACCESS_TOKEN ||
      ''
    ).trim();
  }

  private getDefaultPhoneId(): string {
    return (
      process.env.META_WA_PHONE_NUMBER_ID ||
      process.env.WHATSAPP_PHONE_NUMBER_ID ||
      '1449345788253222'
    ).trim();
  }

  private async getSessionsCollection(): Promise<Collection<IWhatsAppSession>> {
    if (!this.sessionsCollection) {
      this.sessionsCollection = await this.mongoDatabase.getCollection<IWhatsAppSession>('whatsapp_sessions');
      try {
        await this.sessionsCollection.createIndex({ phoneNumber: 1 }, { unique: true });
        await this.sessionsCollection.createIndex({ rawFrom: 1 });
      } catch (err: any) {
        // Ignore index creation errors if index already exists
      }
    }
    return this.sessionsCollection;
  }

  /**
   * Dispatches an interactive WhatsApp list message (e.g. for one-click language selection)
   */
  private async sendInteractiveListMessage(
    to: string,
    phoneNumberId: string,
    payload: {
      header?: string;
      body: string;
      footer?: string;
      button: string;
      sections: {
        title: string;
        rows: { id: string; title: string; description?: string }[];
      }[];
    },
  ): Promise<any> {
    const cloudToken = this.getCloudToken();
    const targetPhoneId = phoneNumberId || this.getDefaultPhoneId();

    if (!cloudToken) {
      console.warn('[WhatsAppService] No Meta Cloud API token found. Interactive message not dispatched.');
      return null;
    }

    const cleanTo = to.replace(/\D/g, '');
    const graphUrl = `https://graph.facebook.com/v21.0/${targetPhoneId}/messages`;
    try {
      const res = await axios.post(
        graphUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
          type: 'interactive',
          interactive: {
            type: 'list',
            ...(payload.header ? { header: { type: 'text', text: payload.header } } : {}),
            body: { text: payload.body },
            ...(payload.footer ? { footer: { text: payload.footer } } : {}),
            action: {
              button: payload.button,
              sections: payload.sections,
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${cloudToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 12000,
        },
      );
      console.log(`[WhatsAppService] Interactive list message delivered to ${cleanTo}:`, res.data);
      return res.data;
    } catch (err: any) {
      console.error(
        '[WhatsAppService] Error posting interactive list to Meta Cloud API:',
        err.response?.data || err.message,
      );
      // Fallback: send text message with language options if interactive fails
      const textFallback = `${payload.body}\n\n1. తెలుగు (Telugu)\n2. हिन्दी (Hindi)\n3. தமிழ் (Tamil)\n4. ಕನ್ನಡ (Kannada)\n5. English\n\nReply with 1 or your language name.`;
      return this.sendTextMessage(to, targetPhoneId, textFallback);
    }
  }

  /**
   * One-click language selector using Meta WhatsApp interactive list message
   */
  private async sendLanguageSelectionMenu(
    to: string,
    phoneNumberId: string,
    page: number = 1,
  ): Promise<void> {
    if (page === 1) {
      const rows = [
        { id: 'lang_te-IN', title: 'తెలుగు (Telugu)', description: 'ఆంధ్రప్రదేశ్ & తెలంగాణ' },
        { id: 'lang_hi-IN', title: 'हिन्दी (Hindi)', description: 'उत्तर व मध्य भारत' },
        { id: 'lang_ta-IN', title: 'தமிழ் (Tamil)', description: 'தமிழ்நாடு' },
        { id: 'lang_kn-IN', title: 'ಕನ್ನಡ (Kannada)', description: 'ಕರ್ನಾಟಕ' },
        { id: 'lang_en-IN', title: 'English', description: 'All India' },
        { id: 'lang_mr-IN', title: 'मराठी (Marathi)', description: 'महाराष्ट्र' },
        { id: 'lang_bn-IN', title: 'বাংলা (Bengali)', description: 'পশ্চিমবঙ্গ & ত্রিপুরা' },
        { id: 'lang_gu-IN', title: 'ગુજરાતી (Gujarati)', description: 'ગુજરાત' },
        { id: 'lang_pa-IN', title: 'ਪੰਜਾਬੀ (Punjabi)', description: 'ਪੰਜਾਬ & ਹਰਿਆਣਾ' },
        { id: 'lang_page_2', title: '🌐 More Languages', description: 'Odia, Assamese, Urdu, etc.' },
      ];

      await this.sendInteractiveListMessage(to, phoneNumberId, {
        header: 'AgriSeva-AI',
        body: '🌾 *Welcome to AgriSeva-AI*\n\nPlease select your preferred language:',
        footer: 'AgriSeva-AI • 23 Languages',
        button: 'Select Language',
        sections: [{ title: 'Popular Languages', rows }],
      });
    } else {
      const rows = [
        { id: 'lang_ml-IN', title: 'മലയാളം (Malayalam)', description: 'കേരളം' },
        { id: 'lang_od-IN', title: 'ଓଡ଼ିଆ (Odia)', description: 'ଓଡ଼ିଶା' },
        { id: 'lang_as-IN', title: 'অসমীয়া (Assamese)', description: 'অসম' },
        { id: 'lang_ur-IN', title: 'اردو (Urdu)', description: 'All India' },
        { id: 'lang_mai-IN', title: 'मैथिली (Maithili)', description: 'बिहार & झारखंड' },
        { id: 'lang_kok-IN', title: 'कोंकणी (Konkani)', description: 'गोवा' },
        { id: 'lang_ne-IN', title: 'नेपाली (Nepali)', description: 'सिक्किम & प. बंगाल' },
        { id: 'lang_ks-IN', title: 'کٲشُر (Kashmiri)', description: 'جموں و کشمیر' },
        { id: 'lang_doi-IN', title: 'डोगरी (Dogri)', description: 'जम्मू' },
        { id: 'lang_page_1', title: '⬅️ Back to Page 1', description: 'Telugu, Hindi, Tamil, English...' },
      ];

      await this.sendInteractiveListMessage(to, phoneNumberId, {
        header: 'AgriSeva-AI',
        body: '🌾 *AgriSeva-AI Languages (Page 2)*\n\nPlease select your preferred language:',
        footer: 'AgriSeva-AI • 23 Languages',
        button: 'Choose Language',
        sections: [{ title: 'Regional Languages', rows }],
      });
    }
  }

  /**
   * Sends an outbound text message to the WhatsApp user
   */
  private async sendTextMessage(
    to: string,
    phoneNumberId: string,
    text: string,
  ): Promise<any> {
    const cloudToken = this.getCloudToken();
    const targetPhoneId = phoneNumberId || this.getDefaultPhoneId();

    if (!cloudToken) {
      console.log('[WhatsAppService] Meta token not set. Simulated outbound message to', to, ':\n', text);
      return null;
    }

    const cleanTo = to.replace(/\D/g, '');
    const graphUrl = `https://graph.facebook.com/v21.0/${targetPhoneId}/messages`;
    try {
      const res = await axios.post(
        graphUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
          type: 'text',
          text: {
            preview_url: false,
            body: text,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${cloudToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );
      console.log(`[WhatsAppService] Meta text message delivered to ${cleanTo}:`, res.data);
      return res.data;
    } catch (err: any) {
      console.error(
        '[WhatsAppService] Error posting text message to Meta Cloud API:',
        err.response?.data || err.message,
      );
      return null;
    }
  }

  /**
   * Downloads media binary (voice notes or crop images) from Meta Graph API
   */
  private async downloadMetaMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const token = this.getCloudToken();
    if (!token) throw new Error('Meta API token is not configured');

    const metaMediaUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
    const metaRes = await axios.get(metaMediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });

    const fileUrl = metaRes.data?.url;
    const mimeType = metaRes.data?.mime_type || 'application/octet-stream';
    if (!fileUrl) throw new Error(`Could not obtain media URL for id ${mediaId}`);

    const binaryRes = await axios.get(fileUrl, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    return {
      buffer: Buffer.from(binaryRes.data),
      mimeType,
    };
  }

  /**
   * Transcribes incoming WhatsApp voice notes using Sarvam STT with Gemini audio fallback
   */
  private async transcribeAudio(buffer: Buffer, mimeType: string, langCode: string): Promise<string> {
    const sarvamKey = appConfig.sarvamAPI || process.env.SARVAM_API_KEY;
    if (sarvamKey) {
      try {
        const formData = new FormData();
        formData.append('file', new Blob([buffer], { type: mimeType }), 'voice_note.ogg');
        formData.append('language_code', langCode || 'unknown');
        const res = await fetch('https://api.sarvam.ai/speech-to-text', {
          method: 'POST',
          headers: { 'api-subscription-key': sarvamKey },
          body: formData,
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data?.transcript?.trim()) {
            return data.transcript.trim();
          }
        }
      } catch (err: any) {
        console.warn('[WhatsAppService] Sarvam STT attempt error, trying Gemini audio:', err.message);
      }
    }

    // Gemini audio fallback
    const geminiKey = aiConfig.geminiApiKey || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const model = aiConfig.geminiModel || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const cleanMime = mimeType.split(';')[0] || 'audio/ogg';
        const res = await axios.post(
          url,
          {
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: cleanMime,
                      data: buffer.toString('base64'),
                    },
                  },
                  {
                    text: 'Please transcribe the speech in this audio voice note word-for-word in the native spoken language. Output only the verbatim transcription without any prefix, formatting, or commentary.',
                  },
                ],
              },
            ],
          },
          { timeout: 25000 },
        );
        const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      } catch (gemErr: any) {
        console.warn('[WhatsAppService] Gemini audio transcription error:', gemErr.message);
      }
    }

    return '';
  }

  /**
   * Helper that checks whether a text already contains native characters in the target language's script.
   */
  private isAlreadyInTargetScript(text: string, langCode: string): boolean {
    if (!text || !langCode) return false;
    const lower = langCode.toLowerCase();
    if (lower.startsWith('te')) return /[\u0C00-\u0C7F]/.test(text); // Telugu
    if (lower.startsWith('ta')) return /[\u0B80-\u0BFF]/.test(text); // Tamil
    if (lower.startsWith('kn')) return /[\u0C80-\u0CFF]/.test(text); // Kannada
    if (lower.startsWith('ml')) return /[\u0D00-\u0D7F]/.test(text); // Malayalam
    if (lower.startsWith('gu')) return /[\u0A80-\u0AFF]/.test(text); // Gujarati
    if (lower.startsWith('pa')) return /[\u0A00-\u0A7F]/.test(text); // Punjabi
    if (lower.startsWith('bn') || lower.startsWith('as')) return /[\u0980-\u09FF]/.test(text); // Bengali / Assamese
    if (lower.startsWith('od') || lower.startsWith('or')) return /[\u0B00-\u0B7F]/.test(text); // Odia
    if (lower.startsWith('ur')) return /[\u0600-\u06FF]/.test(text); // Urdu
    if (lower.startsWith('hi') || lower.startsWith('mr') || lower.startsWith('ne') || lower.startsWith('mai') || lower.startsWith('kok') || lower.startsWith('doi')) {
      return /[\u0900-\u097F]/.test(text); // Devanagari script
    }
    if (lower.startsWith('en')) return true; // English doesn't need script translation
    return false;
  }

  /**
   * Diagnoses crop images using Gemini Multimodal Vision with strict agricultural grounding
   */
  private async processCropImage(
    buffer: Buffer,
    mimeType: string,
    caption: string,
    langCode: string,
  ): Promise<string> {
    const geminiKey = aiConfig.geminiApiKey || process.env.GEMINI_API_KEY;
    const targetName = getLanguageDisplayName(langCode);

    if (!geminiKey) {
      const fallbackMsgs: Record<string, string> = {
        'te-IN': '📷 పంట ఫోటో స్వీకరించబడింది. ఇమేజ్ విశ్లేషణ సేవ ప్రస్తుతం అందుబాటులో లేదు. దయచేసి సమస్యను టెక్స్ట్‌లో వివరించండి.',
        'hi-IN': '📷 फसल की फोटो प्राप्त हुई। इमेज विश्लेषण सेवा वर्तमान में अनुपलब्ध है। कृपया समस्या का टेक्स्ट में वर्णन करें।',
        'ta-IN': '📷 பயிர் புகைப்படம் பெறப்பட்டது. பார்வை சேவை தற்போது கிடைக்கவில்லை. சிக்கலை உரை வடிவில் விவரிக்கவும்.',
        'kn-IN': '📷 ಬೆಳೆಯ ಫೋಟೋ ಸ್ವೀಕರಿಸಲಾಗಿದೆ. ದೃಶ್ಯ ವಿಶ್ಲೇಷಣೆ ಸೇವೆ ಸದ್ಯಕ್ಕೆ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ರೋಗಲಕ್ಷಣಗಳನ್ನು ಪಠ್ಯದಲ್ಲಿ ವಿವರಿಸಿ.',
        'en-IN': '📷 Crop image received. Vision service is currently unavailable. Please describe the symptoms in text.',
        'mr-IN': '📷 पिकाचा फोटो मिळाला. प्रतिमा विश्लेषण सेवा सध्या अनुपलब्ध आहे. कृपया लक्षणांचे मजकुरात वर्णन करा.',
        'bn-IN': '📷 ফসলের ছবি পাওয়া গেছে। ইমেজ বিশ্লেষণ সেবা বর্তমানে অনুপলব্ধ। অনুগ্রহ করে লক্ষণগুলো টেক্সটে লিখুন।',
        'gu-IN': '📷 પાકનો ફોટો મળ્યો છે. ઇમેજ વિશ્લેષણ સેવા હાલમાં ઉપલબ્ધ નથી. કૃપા કરીને ટેક્સ્ટમાં લક્ષણો વર્ણવો.',
        'pa-IN': '📷 ਫਸਲ ਦੀ ਫੋਟੋ ਮਿਲੀ ਹੈ। ਚਿੱਤਰ ਵਿਸ਼ਲੇਸ਼ਣ ਸੇਵਾ ਫਿਲਹਾਲ ਉਪਲਬਧ ਨਹੀਂ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਲੱਛਣ ਟੈਕਸਟ ਵਿੱਚ ਲਿਖੋ।',
        'ml-IN': '📷 വിളയുടെ ഫോട്ടോ ലഭിച്ചു. ഇമേജ് വിശകലന സേവനം ഇപ്പോൾ ലഭ്യമല്ല. ദയവായി ലക്ഷണങ്ങൾ ടെക്സ്റ്റിൽ എഴുതുക.',
        'od-IN': '📷 ଫସଲ ଫଟୋ ଗ୍ରହଣ କରାଗଲା। ଚିତ୍ର ବିଶ୍ଳେଷଣ ସେବା ବର୍ତ୍ତମାନ ଉପଲବ୍ଧ ନାହିଁ। ଦୟାକରି ଲକ୍ଷଣଗୁଡ଼ିକ ଟେକ୍ସଟରେ ବର୍ଣ୍ଣନା କରନ୍ତୁ।',
      };
      return fallbackMsgs[langCode] || fallbackMsgs['en-IN'];
    }

    const primaryModel = aiConfig.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const fallbackModel = aiConfig.geminiFallbackModel || 'gemini-3.6-flash';

    const prompt = `You are AgriSeva-AI, the National Agricultural Multilingual Advisory Expert.
Analyze this crop image and user's query: "${caption || 'What problem does this plant have and what is the treatment?'}"

CRITICAL MANDATORY LANGUAGE RULE:
The farmer's authoritative selected language is ${targetName} (${langCode}).
You MUST generate your ENTIRE diagnostic response strictly in ${targetName} (${langCode}).
Do NOT reply in English unless ${langCode} is English.

Provide an agricultural advisory response:
1. Visual Assessment: Identify the crop and visible symptoms (disease, pest damage, nutrient deficiency, weather stress).
2. Probable Cause: State the likely cause.
3. Cultural & Organic Management: Preventive and organic measures (e.g. neem oil, sanitation, water drainage).
4. Chemical Treatment (if severe): CIBRC-approved recommendation with exact dosage per liter/acre, and mandatory safety precautions (gloves, masks, pre-harvest interval).
5. Disclaimer: If symptoms are ambiguous or uncertain, clearly state uncertainty and advise taking a sample to the nearest Krishi Vigyan Kendra (KVK).

Keep paragraphs concise, structured with bullet points and emojis, suitable for reading on WhatsApp.`;

    const cleanMime = mimeType.split(';')[0] || 'image/jpeg';
    const payload = {
      system_instruction: {
        parts: [{ text: `You are AgriSeva-AI. You MUST generate the ENTIRE response strictly in ${targetName} (${langCode}).` }],
      },
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: cleanMime,
                data: buffer.toString('base64'),
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800,
      },
    };

    for (const modelToTry of [primaryModel, fallbackModel]) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${geminiKey}`;
        const res = await axios.post(url, payload, { timeout: 25000 });
        const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      } catch (err: any) {
        console.warn(`[WhatsAppService] Gemini vision error with model ${modelToTry}:`, err.message);
      }
    }

    return '';
  }

  /**
   * Translates response text into the user's selected language using Sarvam AI with Gemini fallback
   */
  private async translateText(text: string, targetLang: string): Promise<string> {
    if (!targetLang || targetLang === 'en-IN' || targetLang === 'en') {
      return text;
    }

    // 1. Try Sarvam AI translation
    if (this.contextService) {
      try {
        const transRes = await this.contextService.translate(text, targetLang);
        if (transRes?.translated_text?.trim()) {
          return transRes.translated_text.trim();
        }
      } catch (err: any) {
        console.warn(`[WhatsAppService] Sarvam translation error for ${targetLang}, falling back to Gemini:`, err.message);
      }
    }

    // 2. Gemini Translation fallback
    const geminiKey = aiConfig.geminiApiKey || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const model = aiConfig.geminiModel || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const targetName = getLanguageDisplayName(targetLang);

        const prompt = `Translate the following agricultural advisory into ${targetName}.
Maintain all bullet points, numbers, scientific terms, chemical names, and dosages accurately.
Do not add introductory remarks or English explanations.

Text to translate:
"""
${text}
"""`;

        const res = await axios.post(
          url,
          {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 850,
            },
          },
          { timeout: 20000 },
        );

        const translated = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (translated) return translated;
      } catch (err: any) {
        console.warn(`[WhatsAppService] Gemini translation error:`, err.message);
      }
    }

    return text;
  }

  /**
   * Generates a grounded agricultural advisory answer when GroundedAnswerService needs a direct pass
   */
  private async generateDirectAgriculturalAnswer(
    query: string,
    langCode: string,
    history?: { role: 'user' | 'assistant' | 'expert' | 'system'; content: string }[],
  ): Promise<string> {
    const apiKey = aiConfig.geminiApiKey || process.env.GEMINI_API_KEY;
    const targetName = getLanguageDisplayName(langCode);

    if (!apiKey) {
      const fallbackReplies: Record<string, string> = {
        'te-IN': `AgriSeva-AI సంప్రదించినందుకు ధన్యవాదాలు. "${query}" కి సంబంధించి మా వ్యవసాయ సలహా వ్యవస్థ వివరాలను పరిశీలిస్తోంది. దయచేసి కిసాన్ కాల్ సెంటర్ టోల్-ఫ్రీ 1800-180-1551 ని సంప్రదించండి.`,
        'hi-IN': `AgriSeva-AI से संपर्क करने के लिए धन्यवाद। "${query}" के संबंध में हमारा कृषि सलाहकार तंत्र विवरण तैयार कर रहा है। कृपया किसान कॉल सेंटर टोल-फ्री 1800-180-1551 पर संपर्क करें।`,
        'ta-IN': `AgriSeva-AI-ஐ தொடர்பு கொண்டதற்கு நன்றி. "${query}" குறித்த ஆலோசனை தயாராகி வருகிறது. உழவர் அழைப்பு மையம் 1800-180-1551 என்ற எண்ணில் தொடர்பு கொள்ளலாம்.`,
        'kn-IN': `AgriSeva-AI ಸಂಪರ್ಕಿಸಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. "${query}" ಕುರಿತು ನಮ್ಮ ಕೃಷಿ ಸಲಹಾ ವ್ಯವಸ್ಥೆ ಪರಿಶೀಲಿಸುತ್ತಿದೆ. ಕಿಸಾನ್ ಕಾಲ್ ಸೆಂಟರ್ 1800-180-1551 ಸಂಪರ್ಕಿಸಿ.`,
        'en-IN': `Thank you for contacting AgriSeva-AI regarding "${query}". Our agricultural advisory system is currently processing your request. Please visit https://agriseva-ai.web.app or contact toll-free Kisan line 1800-180-1551.`,
        'mr-IN': `AgriSeva-AI शी संपर्क साधल्याबद्दल धन्यवाद. "${query}" बाबत आमची कृषी सल्लागार यंत्रणा माहिती तयार करत आहे. कृपया किसान कॉल सेंटर 1800-180-1551 वर संपर्क साधा.`,
        'bn-IN': `AgriSeva-AI এর সাথে যোগাযোগের জন্য ধন্যবাদ। "${query}" সংক্রান্ত পরামর্শ তৈরি করা হচ্ছে। অনুগ্রহ করে কিষাণ কল সেন্টার 1800-180-1551 নম্বরে যোগাযোগ করুন।`,
        'gu-IN': `AgriSeva-AI નો સંપર્ક કરવા બદલ આભાર. "${query}" સંબંધિત અમારી કૃષિ સલાહકાર સિસ્ટમ કાર્ય કરી રહી છે. કૃપા કરીને કિસાન કૉલ સેન્ટર 1800-180-1551 પર સંપર્ક કરો.`,
        'pa-IN': `AgriSeva-AI ਨਾਲ ਸੰਪਰਕ ਕਰਨ ਲਈ ਧੰਨਵਾਦ। "${query}" ਬਾਰੇ ਸਾਡਾ ਖੇਤੀਬਾੜੀ ਸਲਾਹਕਾਰ ਸਿਸਟਮ ਜਾਂਚ ਕਰ ਰਿਹਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਕਿਸਾਨ ਕਾਲ ਸੈਂਟਰ 1800-180-1551 ’ਤੇ ਸੰਪਰਕ ਕਰੋ।`,
        'ml-IN': `AgriSeva-AI യുമായി ബന്ധപ്പെട്ടതിന് നന്ദി. "${query}" സംബന്ധിച്ച നിർദ്ദേശങ്ങൾ തയ്യാറാക്കുന്നു. കിസാൻ കോൾ സെന്റർ 1800-180-1551 ൽ ബന്ധപ്പെടുക.`,
        'od-IN': `AgriSeva-AI ସହିତ ଯୋଗାଯୋଗ କରିଥିବାରୁ ଧନ୍ୟବାଦ। "${query}" ପାଇଁ କୃଷି ପରାମର୍ଶ ପ୍ରସ୍ତୁତ ହେଉଛି। କିଷାନ କଲ୍ ସେଣ୍ଟର 1800-180-1551 ରେ ଯୋଗାଯୋଗ କରନ୍ତୁ।`,
      };
      return fallbackReplies[langCode] || fallbackReplies['en-IN'];
    }

    const primaryModel = aiConfig.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const fallbackModel = aiConfig.geminiFallbackModel || 'gemini-3.6-flash';

    const systemInstruction = `You are AgriSeva-AI, India's National Multilingual Agricultural Advisory Voice & WhatsApp Assistant.
CRITICAL MANDATORY INSTRUCTION:
The farmer's selected response language is ${targetName} (${langCode}).
Regardless of whether the farmer typed in English, Hinglish, or any other language, and regardless of any previous chat history language, you MUST generate your entire response exclusively and fluently in ${targetName} (${langCode}).
Follow CIBRC guidelines for any pesticide or chemical recommendations. Always mention organic and cultural practices first.
Keep replies concise, structured, and easy to read on WhatsApp with bullet points and emojis.

CRITICAL ZERO-HALLUCINATION DIRECTIVE FOR MARKET INTELLIGENCE & BUYERS:
- NEVER invent, extrapolate, or guess mandi prices, APMC market rates, arrival volumes, or dates.
- NEVER fabricate names, phone numbers, or details of buyers, traders, or procurement agencies.
- If asked about live mandi prices or specific buyers and verified Agmarknet data was not provided in context, clearly direct the farmer to the AgriSeva Market Intelligence dashboard (https://agriseva-ai.web.app) or their local APMC market yard, stating that live verified prices should be checked directly from official records. Do not output fabricated rupee numbers.`;

    const contents: any[] = [];

    // Include recent conversation context (up to last 4 turns)
    if (history && history.length > 0) {
      const recent = history.slice(-4);
      for (const turn of recent) {
        contents.push({
          role: turn.role === 'assistant' || turn.role === 'expert' ? 'model' : 'user',
          parts: [{ text: turn.content }],
        });
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: `[DIRECTIVE: Generate entire response exclusively in ${targetName} (${langCode})]\n\nFarmer WhatsApp Query: "${query}"` }],
    });

    const payload = {
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 750,
      },
    };

    for (const modelToTry of [primaryModel, fallbackModel]) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${apiKey}`;
        const response = await axios.post(url, payload, { timeout: 20000 });
        const candidate = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (candidate) return candidate;
      } catch (err: any) {
        console.warn(`[WhatsAppService] Direct generation error with model ${modelToTry}:`, err.message);
      }
    }

    const fallbackReplies: Record<string, string> = {
      'te-IN': `AgriSeva-AI సంప్రదించినందుకు ధన్యవాదాలు. "${query}" కి సంబంధించి మా వ్యవసాయ సలహా వ్యవస్థ వివరాలను పరిశీలిస్తోంది. దయచేసి కిసాన్ కాల్ సెంటర్ టోల్-ఫ్రీ 1800-180-1551 ని సంప్రదించండి.`,
      'hi-IN': `AgriSeva-AI से संपर्क करने के लिए धन्यवाद। "${query}" के संबंध में हमारा कृषि सलाहकार तंत्र विवरण तैयार कर रहा है। कृपया किसान कॉल सेंटर टोल-फ्री 1800-180-1551 पर संपर्क करें।`,
      'ta-IN': `AgriSeva-AI-ஐ தொடர்பு கொண்டதற்கு நன்றி. "${query}" குறித்த ஆலோசனை தயாராகி வருகிறது. உழவர் அழைப்பு மையம் 1800-180-1551 என்ற எண்ணில் தொடர்பு கொள்ளலாம்.`,
      'kn-IN': `AgriSeva-AI ಸಂಪರ್ಕಿಸಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. "${query}" ಕುರಿತು ನಮ್ಮ ಕೃಷಿ ಸಲಹಾ ವ್ಯವಸ್ಥೆ ಪರಿಶೀಲಿಸುತ್ತಿದೆ. ಕಿಸಾನ್ ಕಾಲ್ ಸೆಂಟರ್ 1800-180-1551 ಸಂಪರ್ಕಿಸಿ.`,
      'en-IN': `Thank you for contacting AgriSeva-AI regarding "${query}". Our agricultural advisory system is currently processing your request. Please visit https://agriseva-ai.web.app or contact toll-free Kisan line 1800-180-1551.`,
      'mr-IN': `AgriSeva-AI शी संपर्क साधल्याबद्दल धन्यवाद. "${query}" बाबत आमची कृषी सल्लागार यंत्रणा माहिती तयार करत आहे. कृपया किसान कॉल सेंटर 1800-180-1551 वर संपर्क साधा.`,
      'bn-IN': `AgriSeva-AI এর সাথে যোগাযোগের জন্য ধন্যবাদ। "${query}" সংক্রান্ত পরামর্শ তৈরি করা হচ্ছে। অনুগ্রহ করে কিষাণ কল সেন্টার 1800-180-1551 নম্বরে যোগাযোগ করুন।`,
      'gu-IN': `AgriSeva-AI નો સંપર્ક કરવા બદલ આભાર. "${query}" સંબંધિત અમારી કૃષિ સલાહકાર સિસ્ટમ કાર્ય કરી રહી છે. કૃપા કરીને કિસાન કૉલ સેન્ટર 1800-180-1551 પર સંપર્ક કરો.`,
      'pa-IN': `AgriSeva-AI ਨਾਲ ਸੰਪਰਕ ਕਰਨ ਲਈ ਧੰਨਵਾਦ। "${query}" ਬਾਰੇ ਸਾਡਾ ਖੇਤੀਬਾੜੀ ਸਲਾਹਕਾਰ ਸਿਸਟਮ ਜਾਂਚ ਕਰ ਰਿਹਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਕਿਸਾਨ ਕਾਲ ਸੈਂਟਰ 1800-180-1551 ’ਤੇ ਸੰਪਰਕ ਕਰੋ।`,
      'ml-IN': `AgriSeva-AI യുമായി ബന്ധപ്പെട്ടതിന് നന്ദി. "${query}" സംബന്ധിച്ച നിർദ്ദേശങ്ങൾ തയ്യാറാക്കുന്നു. കിസാൻ കോൾ സെന്റർ 1800-180-1551 ൽ ബന്ധപ്പെടുക.`,
      'od-IN': `AgriSeva-AI ସହିତ ଯୋଗାଯୋଗ କରିଥିବାରୁ ଧନ୍ୟବାଦ। "${query}" ପାଇଁ କୃଷି ପରାମର୍ଶ ପ୍ରସ୍ତୁତ ହେଉଛି। କିଷାନ କଲ୍ ସେଣ୍ଟର 1800-180-1551 ରେ ଯୋଗାଯୋଗ କରନ୍ତୁ।`,
    };
    return fallbackReplies[langCode] || fallbackReplies['en-IN'];
  }

  /**
   * Master WhatsApp Message Coordinator
   */
  async handleIncomingWhatsAppCloudMessage(
    from: string,
    text: string,
    phoneNumberId?: string,
    extra?: IncomingWhatsAppMessageExtra,
  ): Promise<void> {
    const targetPhoneId = phoneNumberId || this.getDefaultPhoneId();
    const canonicalPhone = normalizePhoneNumber(from);
    console.log(`[WhatsAppService] Processing incoming message from ${from} (${canonicalPhone}): "${text}"`);

    const sessionsCol = await this.getSessionsCollection();
    let session: IWhatsAppSession | null = await sessionsCol.findOne({
      $or: [{ phoneNumber: canonicalPhone }, { rawFrom: from }, { phoneNumber: from }],
    });

    // Requirement: Blocked numbers are dropped immediately without AI processing
    if (session?.blocked) {
      console.warn(`[WhatsAppService] Dropping message from blocked user ${from} (${canonicalPhone})`);
      return;
    }

    if (!session) {
      session = {
        _id: new ObjectId(),
        phoneNumber: canonicalPhone,
        rawFrom: from,
        createdAt: new Date(),
        updatedAt: new Date(),
        history: [],
      };
    }

    // Step 1: Website / User Profile Language Sync (Requirement 8 & 30)
    // If language is not explicitly set in WhatsApp, inspect MongoDB users collection for existing profile.
    if (!session.userId || !session.languageSelectedExplicitly || !session.preferredLanguage) {
      try {
        const usersCol = await this.mongoDatabase.getCollection<IUser>('users');
        const domestic10 = canonicalPhone.replace(/\D/g, '').slice(-10);
        const userMatch = await usersCol.findOne({
          $or: [
            { mobile: canonicalPhone },
            { mobile: from },
            { mobile: domestic10 },
            { 'farmerProfile.phone': canonicalPhone },
            { 'farmerProfile.phone': from },
            { 'farmerProfile.phone': domestic10 },
          ],
        });

        if (userMatch) {
          session.userId = userMatch._id?.toString();
          session.userName = `${userMatch.firstName || ''} ${userMatch.lastName || ''}`.trim();
          const profileLang = userMatch.farmerProfile?.preferredLanguage;
          if (profileLang && !session.languageSelectedExplicitly) {
            session.preferredLanguage = profileLang;
            session.languageSelectedExplicitly = true;
            console.log(`[WhatsAppService] Synced preferredLanguage "${profileLang}" from website profile for ${from}`);
          }
        } else if (!session.userId) {
          const newUser: Partial<IUser> = {
            firebaseUID: `wa_${canonicalPhone.replace(/\D/g, '')}`,
            email: `wa_${canonicalPhone.replace(/\D/g, '')}@whatsapp.agriseva`,
            firstName: 'WhatsApp',
            lastName: canonicalPhone,
            role: 'user',
            mobile: canonicalPhone,
            farmerProfile: { phone: canonicalPhone },
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          try {
            const insertResult = await usersCol.insertOne(newUser as IUser);
            session.userId = insertResult.insertedId.toString();
            session.userName = canonicalPhone;
            console.log(`[WhatsAppService] Created independent WhatsApp farmer record for ${from} → userId=${session.userId}`);
          } catch (insertErr: any) {
            const raceMatch = await usersCol.findOne({ mobile: canonicalPhone });
            if (raceMatch) {
              session.userId = raceMatch._id?.toString();
              session.userName = `${raceMatch.firstName || ''} ${raceMatch.lastName || ''}`.trim();
            }
            console.warn('[WhatsAppService] Race on user creation (acceptable):', insertErr.message);
          }
        }
      } catch (err: any) {
        console.warn('[WhatsAppService] Error during user profile matching:', err.message);
      }
    }

    // Step 2: Handle Language Selection & Navigation
    const interactiveId =
      extra?.interactive?.button_reply?.id ||
      extra?.interactive?.list_reply?.id ||
      extra?.button?.payload ||
      extra?.button?.text;

    // Handle navigation between language menu pages
    if (interactiveId === 'lang_page_2') {
      await this.sendLanguageSelectionMenu(from, targetPhoneId, 2);
      return;
    }
    if (interactiveId === 'lang_page_1' || interactiveId === 'lang_more_all') {
      await this.sendLanguageSelectionMenu(from, targetPhoneId, 1);
      return;
    }

    const norm = (text || '').trim().toLowerCase();
    const isLangCommand =
      norm === 'language' ||
      norm === 'lang' ||
      norm === 'change language' ||
      norm === 'switch language' ||
      norm === 'select language' ||
      norm === 'bhasha' ||
      norm === 'भाषा' ||
      norm === 'భాష' ||
      norm === 'மொழி' ||
      norm === 'ಭಾಷೆ';

    // Requirement: Standalone "1" or "language" triggers language selection menu
    // If user is NOT awaiting language selection, typing "1" or a language command opens the menu.
    if ((norm === '1' || isLangCommand) && !session.awaitingLanguageSelection) {
      console.log(`[WhatsAppService:Diag] User ${from} requested language selection menu via shortcut "${norm}". Setting awaitingLanguageSelection = true`);
      session.awaitingLanguageSelection = true;
      session.updatedAt = new Date();
      await sessionsCol.updateOne({ phoneNumber: canonicalPhone }, { $set: session }, { upsert: true });
      await this.sendLanguageSelectionMenu(from, targetPhoneId, 1);
      return;
    }

    // Check if incoming input is an interactive or typed language choice
    const langCodeFromInteractive = interactiveId ? matchLanguageChoice(interactiveId) : null;
    const isMediaOnly = (extra?.msgType === 'audio' || extra?.msgType === 'voice' || extra?.msgType === 'image') && !text;

    let langCodeFromTyped: string | null = null;
    if (!isMediaOnly && !langCodeFromInteractive && text) {
      if (session.awaitingLanguageSelection) {
        // Farmer is actively choosing from the language menu (supports digits "1"-"10", language names, native scripts)
        // BUT if the text is clearly an agricultural query (e.g. "1 kg urea fertilizer for paddy"),
        // it is an agricultural question, NOT a language choice! Cancel awaiting selection.
        if (isLikelyAgriculturalQuery(text) && !isExplicitLanguageNameChoice(text) && !/^\d{1,2}$/.test(text.trim())) {
          session.awaitingLanguageSelection = false;
        } else {
          langCodeFromTyped = matchLanguageChoice(text);
        }
      } else if (isExplicitLanguageNameChoice(text)) {
        // Farmer typed an explicit language name e.g. "Telugu", "Hindi", "change to tamil" at any point
        langCodeFromTyped = matchLanguageChoice(text);
      } else if (!session.languageSelectedExplicitly) {
        // First-time incoming message before explicit selection
        langCodeFromTyped = matchLanguageChoice(text);
      }
    }

    const resolvedLangCode = langCodeFromInteractive || langCodeFromTyped;

    if (resolvedLangCode) {
      const chosenCode = resolvedLangCode;
      session.preferredLanguage = chosenCode;
      session.languageSelectedExplicitly = true;
      session.awaitingLanguageSelection = false;
      session.updatedAt = new Date();

      const pending = session.pendingFirstMessage;
      session.pendingFirstMessage = undefined;

      await sessionsCol.updateOne(
        { phoneNumber: canonicalPhone },
        { $set: session },
        { upsert: true },
      );

      // Requirement 8: Synchronize preferredLanguage with MongoDB users collection
      try {
        const usersCol = await this.mongoDatabase.getCollection<IUser>('users');
        if (session.userId) {
          await usersCol.updateOne(
            { _id: new ObjectId(session.userId.toString()) },
            { $set: { 'farmerProfile.preferredLanguage': chosenCode, updatedAt: new Date() } },
          );
        } else {
          await usersCol.updateOne(
            { mobile: canonicalPhone },
            { $set: { 'farmerProfile.preferredLanguage': chosenCode, updatedAt: new Date() } },
          );
        }
        console.log(`[WhatsAppService:Diag] Synchronized preferredLanguage=${chosenCode} to users collection for ${canonicalPhone}`);
      } catch (syncErr: any) {
        console.warn('[WhatsAppService] Could not sync preferredLanguage to users collection:', syncErr.message);
      }

      console.log(`[WhatsAppService] User ${from} selected language: ${chosenCode}`);

      // Check if there was a pending real agricultural question
      const pendingText = (pending?.text || '').trim();
      const hasMedia = !!(pending?.mediaId || (pending?.msgType && pending.msgType !== 'text'));
      const isPendingConversational = !hasMedia && isConversationalMessage(pendingText).isConversational;

      if (pending && (hasMedia || (pendingText && !isPendingConversational))) {
        const restoredConfirmations: Record<string, string> = {
          'te-IN': '✅ మీ భాషగా *తెలుగు* ఎంపిక చేయబడింది.\nమీ ప్రశ్నను పరిశీలిస్తున్నాము, దయచేసి వేచి ఉండండి...',
          'hi-IN': '✅ आपकी भाषा *हिन्दी* चुन ली गई है।\nहम आपके प्रश्न का उत्तर तैयार कर रहे हैं, कृपया प्रतीक्षा करें...',
          'ta-IN': '✅ உங்கள் மொழியாக *தமிழ்* தேர்ந்தெடுக்கப்பட்டது.\nஉங்கள் கேள்விக்கான பதிலை தயார் செய்கிறோம், காத்திருக்கவும்...',
          'kn-IN': '✅ ನಿಮ್ಮ ಭಾಷೆಯಾಗಿ *ಕನ್ನಡ* ಆಯ್ಕೆಯಾಗಿದೆ.\nನಿಮ್ಮ ಪ್ರಶ್ನೆಗೆ ಉತ್ತರವನ್ನು ಸಿದ್ಧಪಡಿಸುತ್ತಿದ್ದೇವೆ, ದಯವಿಟ್ಟು ನಿರೀಕ್ಷಿಸಿ...',
          'en-IN': '✅ Language set to *English*.\nAnalyzing your question, please wait a moment...',
          'mr-IN': '✅ तुमची भाषा *मराठी* निवडली गेली आहे.\nआम्ही तुमच्या प्रश्नाचे उत्तर तयार करत आहोत, कृपया प्रतीक्षा करा...',
          'bn-IN': '✅ আপনার ভাষা *বাংলা* নির্বাচন করা হয়েছে।\nআমরা আপনার প্রশ্নের উত্তর প্রস্তুত করছি, অনুগ্রহ করে অপেক্ষা করুন...',
          'gu-IN': '✅ તમારી ભાષા *ગુજરાતી* પસંદ કરવામાં આવી છે.\nઅમે તમારા પ્રશ્નનો જવાબ તૈયાર કરી રહ્યા છીએ, કૃપા કરીને રાહ જુઓ...',
          'pa-IN': '✅ ਤੁਹਾਡੀ ਭਾਸ਼ਾ *ਪੰਜਾਬੀ* ਚੁਣੀ ਗਈ ਹੈ।\nਅਸੀਂ ਤੁਹਾਡੇ ਸਵਾਲ ਦਾ ਜਵਾਬ ਤਿਆਰ ਕਰ ਰਹੇ ਹਾਂ, ਕਿਰਪਾ ਕਰਕੇ ਉਡੀਕ ਕਰੋ...',
          'ml-IN': '✅ നിങ്ങളുടെ ഭാഷയായി *മലയാളം* തെരഞ്ഞെടുത്തു.\nനിങ്ങളുടെ ചോദ്യത്തിനുള്ള ഉത്തരം തയാറാക്കുന്നു, ദയവായി കാത്തിരിക്കൂ...',
          'od-IN': '✅ ଆପଣଙ୍କ ଭାଷା *ଓଡ଼ିଆ* ଚୟନ କରାଯାଇଛି।\nଆମେ ଆପଣଙ୍କ ପ୍ରଶ୍ନର ଉତ୍ତର ପ୍ରସ୍ତୁତ କରୁଛୁ, ଦୟାକରି ଅପେକ୍ଷା କରନ୍ତୁ...',
        };
        const confirmMsg = restoredConfirmations[chosenCode] || restoredConfirmations['en-IN'];
        await this.sendTextMessage(from, targetPhoneId, confirmMsg);

        // Restore pending message to fall through and process it below!
        text = pendingText;
        extra = {
          msgId: 'restored_' + Date.now(),
          msgType: pending.msgType || 'text',
          audio: pending.msgType === 'audio' ? { id: pending.mediaId!, mime_type: pending.mimeType } : undefined,
          voice: pending.msgType === 'voice' ? { id: pending.mediaId!, mime_type: pending.mimeType } : undefined,
          image: pending.msgType === 'image' ? { id: pending.mediaId!, mime_type: pending.mimeType || 'image/jpeg', caption: pending.caption } : undefined,
        };
      } else {
        // No pending agricultural query — send welcome greeting in the chosen language
        const welcomeGreetings: Record<string, string> = {
          'te-IN': '🌾 *నమస్తే! AgriSeva-AI కి స్వాగతం.*\n\nమీ భాషగా *తెలుగు* విజయవంతంగా సెట్ చేయబడింది.\n\nమీరు పంట సమస్యలు, వ్యాధులు, మండి మార్కెట్ ధరలు, ఎరువులు లేదా ప్రభుత్వ పథకాల గురించి ఏ ప్రశ్ననైనా ఇక్కడ అడగవచ్చు.\n\n*టెక్స్ట్ మెసేజ్, వాయిస్ నోట్ లేదా పంట ఫోటో* పంపండి!\n\n_🌐 భాషను మార్చడానికి ఎప్పుడైనా "1" లేదా "language" అని పంపండి._',
          'hi-IN': '🌾 *नमस्ते! AgriSeva-AI में आपका स्वागत है।*\n\nआपकी भाषा *हिन्दी* सफलतापूर्वक चुन ली गई है।\n\nआप फसल संबंधी समस्याएं, कीट-रोग, मंडी भाव, खाद-उर्वरक या सरकारी योजनाओं के बारे में कोई भी प्रश्न पूछ सकते हैं।\n\n*टेक्स्ट मैसेज, वॉइस नोट या फसल की फोटो* भेजें!\n\n_🌐 भाषा बदलने के लिए कभी भी "1" या "language" लिखें।_',
          'ta-IN': '🌾 *வணக்கம்! AgriSeva-AI-க்கு நல்வரவு.*\n\nஉங்கள் மொழியாக *தமிழ்* தேர்ந்தெடுக்கப்பட்டது.\n\nபயிர் பாதுகாப்பு, நோய், மண்டி விலை, உரங்கள் அல்லது அரசு திட்டங்கள் குறித்து நீங்கள் எந்த கேள்வியையும் கேட்கலாம்.\n\n*உரை, குரல் பதிவு அல்லது பயிர் புகைப்படம்* அனுப்புங்கள்!\n\n_🌐 மொழியை மாற்ற "1" அல்லது "language" என தட்டச்சு செய்யவும்._',
          'kn-IN': '🌾 *ನಮಸ್ಕಾರ! AgriSeva-AI ಗೆ ಸ್ವಾಗತ.*\n\nನಿಮ್ಮ ಭಾಷೆಯಾಗಿ *ಕನ್ನಡ* ಆಯ್ಕೆಯಾಗಿದೆ.\n\nಬೆಳೆ ರೋಗಗಳು, ಮಂಡಿ ದರಗಳು, ರಸಗೊಬ್ಬರಗಳು ಅಥವಾ ಕೃಷಿ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ನಿಮ್ಮ ಪ್ರಶ್ನೆಗಳನ್ನು ಇಲ್ಲಿ ಕೇಳಬಹುದು.\n\n*ಪಠ್ಯ, ಧ್ವನಿ ಸಂದೇಶ ಅಥವಾ ಬೆಳೆಯ ಫೋಟೋ* ಕಳುಹಿಸಿ!\n\n_🌐 ಭಾಷೆ ಬದಲಾಯಿಸಲು "1" ಅಥವಾ "language" ಎಂದು ಕಳುಹಿಸಿ._',
          'en-IN': '🌾 *Namaste! Welcome to AgriSeva-AI.*\n\nYour language is set to *English*.\n\nYou can ask any question regarding crop health, pest & disease diagnosis, today\'s mandi prices, fertilizers, or government schemes.\n\nSend a *text message, voice note, or crop photo*!\n\n_🌐 Type "1" or "language" anytime to change your language._',
          'mr-IN': '🌾 *नमस्ते! AgriSeva-AI मध्ये आपले स्वागत आहे.*\n\nआपली भाषा *मराठी* यशस्वीरित्या निवडली गेली आहे.\n\nआपण पिकांच्या समस्या, कीड-रोग, बाजारभाव किंवा खतांबद्दल कोणताही प्रश्न विचारू शकता.\n\n_🌐 भाषा बदलण्यासाठी कधीही "1" किंवा "language" पाठवा._',
          'bn-IN': '🌾 *নমস্কার! AgriSeva-AI-তে স্বাগতম.*\n\nআপনার ভাষা *বাংলা* সফলভাবে নির্বাচিত হয়েছে।\n\nআপনি ফসলের সমস্যা, রোগবালাই, সার বা বাজার দর সম্পর্কে যেকোনো প্রশ্ন জিজ্ঞাসা করতে পারেন।\n\n_🌐 ভাষা পরিবর্তন করতে যেকোনো সময় "1" বা "language" পাঠান।_',
          'gu-IN': '🌾 *નમસ્તે! AgriSeva-AI માં આપનું સ્વાગત છે.*\n\nતમારી ભાષા *ગુજરાતી* સફળતાપૂર્વક પસંદ કરવામાં આવી છે.\n\nતમે પાકના રોગો, ખાતર કે બજાર ભાવ વિશે કોઈપણ પ્રશ્ન પૂછી શકો છો.\n\n_🌐 ભાષા બદલવા માટે ગમે ત્યારે "1" અથવા "language" મોકલો._',
          'pa-IN': '🌾 *ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! AgriSeva-AI ਵਿੱਚ ਤੁਹਾਡਾ ਸਵਾਗਤ ਹੈ।*\n\nਤੁਹਾਡੀ ਭਾਸ਼ਾ *ਪੰਜਾਬੀ* ਸਫਲਤਾਪੂਰਵਕ ਚੁਣੀ ਗਈ ਹੈ।\n\nਤੁਸੀਂ ਫਸਲ ਦੀਆਂ ਬਿਮਾਰੀਆਂ, ਖਾਦਾਂ ਜਾਂ ਮੰਡੀ ਦੇ ਭਾਅ ਬਾਰੇ ਕੋਈ ਵੀ ਸਵਾਲ ਪੁੱਛ ਸਕਦੇ ਹੋ।\n\n_🌐 ਭਾਸ਼ਾ ਬਦਲਣ ਲਈ ਕਦੇ ਵੀ "1" ਜਾਂ "language" ਭੇਜੋ।_',
          'ml-IN': '🌾 *നമസ്കാരം! AgriSeva-AI-ലേക്ക് സ്വാഗതം.*\n\nനിങ്ങളുടെ ഭാഷയായി *മലയാളം* തെരഞ്ഞെടുത്തിരിക്കുന്നു.\n\nവിള രോഗങ്ങൾ, വളം, വിപണി വില എന്നിവയെക്കുറിച്ച് എന്തും ചോദിക്കാം.\n\n_🌐 ഭാഷ മാറ്റാൻ എപ്പോൾ വേണമെങ്കിലും "1" അല്ലെങ്കിൽ "language" അയക്കുക._',
          'od-IN': '🌾 *ନମସ୍କାର! AgriSeva-AI କୁ ସ୍ୱାଗତ।*\n\nଆପଣଙ୍କ ଭାଷା *ଓଡ଼ିଆ* ସଫଳତାର ସହ ଚୟନ କରାଯାଇଛି।\n\nଆପଣ ଫସଲ ରୋଗ, ଖତ-ସାର କିମ୍ବା ମଣ୍ଡି ଦର ବିଷୟରେ ଯେକୌଣସି ପ୍ରଶ୍ନ ପଚାରିପାରିବେ।\n\n_🌐 ଭାଷା ପରିବର୍ତ୍ତନ ପାଇଁ ଯେକୌଣସି ସମୟରେ "1" କିମ୍ବା "language" ପଠାନ୍ତୁ।_',
        };
        const welcome = welcomeGreetings[chosenCode] || welcomeGreetings['en-IN'];
        await this.sendTextMessage(from, targetPhoneId, welcome);
        return;
      }
    }

    // Step 3: First-time Unmapped User Language Discovery
    // When a new user has not explicitly chosen language yet, do not answer the question immediately.
    // Instead, preserve incoming message/media and present the clean language selection menu.
    if (!session.languageSelectedExplicitly) {
      session.pendingFirstMessage = {
        text: text || '',
        msgType: extra?.msgType || 'text',
        mediaId: extra?.audio?.id || extra?.voice?.id || extra?.image?.id,
        mimeType: extra?.audio?.mime_type || extra?.voice?.mime_type || extra?.image?.mime_type,
        caption: extra?.image?.caption,
        timestamp: new Date(),
      };
      session.awaitingLanguageSelection = true;
      await sessionsCol.updateOne(
        { phoneNumber: canonicalPhone },
        { $set: session },
        { upsert: true },
      );

      console.log(`[WhatsAppService] Preserved first message from new user ${from}. Sending language selector.`);
      await this.sendLanguageSelectionMenu(from, targetPhoneId, 1);
      return;
    }

    // If farmer was awaiting selection but sent an agricultural question instead of selecting, clear awaiting flag
    if (session.awaitingLanguageSelection) {
      session.awaitingLanguageSelection = false;
      await sessionsCol.updateOne({ phoneNumber: canonicalPhone }, { $set: { awaitingLanguageSelection: false } });
    }

    const currentLang = session.preferredLanguage || 'en-IN';

    // Step 4: Safety & Moderation Check (Warning 1 -> Block 2)
    let userQuery = (text || '').trim();
    const safetyCheck = checkContentSafety(userQuery || extra?.image?.caption || '');
    if (safetyCheck.isViolating) {
      const currentWarnings = session.warningCount || 0;
      if (currentWarnings === 0) {
        session.warningCount = 1;
        session.lastViolationAt = new Date();
        session.history = session.history || [];
        session.history.push({
          role: 'user',
          content: userQuery || extra?.image?.caption || '⚠️ [Disallowed content]',
          timestamp: new Date(),
        });

        const warningMessages: Record<string, string> = {
          'te-IN': '⚠️ *హెచ్చరిక (Safety Warning)*\n\nదయచేసి AgriSeva-AI ప్లాట్‌ఫారమ్‌లో అనుచితమైన, దూషించే లేదా చట్టవిరుద్ధమైన భాషను ఉపయోగించవద్దు. AgriSeva-AI రైతుల వ్యవసాయ సలహాల కోసం మాత్రమే రూపొందించబడింది.\n\nమరలా నిబంధనలను ఉల్లంఘిస్తే, మీ నంబర్ శాశ్వతంగా బ్లాక్ చేయబడుతుంది.',
          'hi-IN': '⚠️ *चेतावनी (Safety Warning)*\n\nकृपया AgriSeva-AI पर अनुचित, अपमानजनक या आपत्तिजनक भाषा का प्रयोग न करें। यह सेवा केवल किसान भाइयों की कृषि सहायता हेतु है।\n\nदोबारा उल्लंघन करने पर आपका नंबर ब्लॉक कर दिया जाएगा।',
          'ta-IN': '⚠️ *எச்சரிக்கை (Safety Warning)*\n\nதயவுசெய்து AgriSeva-AI-ல் தகாத அல்லது தவறான சொற்களைப் பயன்படுத்த வேண்டாம். இது விவசாயிகளின் சேவைக்காக மட்டுமே.\n\nமீண்டும் விதிகளை மீறினால் உங்கள் எண் முடக்கப்படும்.',
          'kn-IN': '⚠️ *ಎಚ್ಚರಿಕೆ (Safety Warning)*\n\nದಯವಿಟ್ಟು AgriSeva-AI ನಲ್ಲಿ ಅನುಚಿತ ಅಥವಾ ನಿಂದನೀಯ ಭಾಷೆಯನ್ನು ಬಳಸಬೇಡಿ. ಇದು ಕೇವಲ ರೈತರ ಕೃಷಿ ಸೇವೆಗಾಗಿ ಮಾತ್ರ.\n\nಮತ್ತೊಮ್ಮೆ ನಿಯಮ ಉಲ್ಲಂಘಿಸಿದರೆ ನಿಮ್ಮ ಸಂಖ್ಯೆಯನ್ನು ನಿರ್ಬಂಧಿಸಲಾಗುವುದು.',
          'mr-IN': '⚠️ *चेतावणी (Safety Warning)*\n\nकृपया AgriSeva-AI वर अयोग्य किंवा अपमानास्पद भाषा वापरू नका. ही सेवा केवळ शेतकऱ्यांच्या कृषी सहाय्यासाठी आहे.\n\nपुन्हा नियम मोडल्यास आपला नंबर ब्लॉक केला जाईल.',
          'bn-IN': '⚠️ *সতর্কবার্তা (Safety Warning)*\n\nঅনুগ্রহ করে AgriSeva-AI-তে অনুপযুক্ত বা অবমাননাকর ভাষা ব্যবহার করবেন না। এটি শুধুমাত্র কৃষকদের কৃষি সহায়তার জন্য তৈরি।\n\nপুনরায় নিয়ম লঙ্ঘন করলে আপনার নম্বর ব্লক করা হবে।',
          'gu-IN': '⚠️ *ચેતવણી (Safety Warning)*\n\nકૃપા કરીને AgriSeva-AI પર અયોગ્ય અથવા અપમાનજનક ભાષાનો ઉપયોગ કરશો નહીં. આ સેવા માત્ર ખેડૂતોની કૃષિ સહાય માટે છે.\n\nફરીથી નિયમોનું ઉલ્લંઘન કરવાથી તમારો નંબર બ્લૉક કરવામાં આવશે.',
          'pa-IN': '⚠️ *ਚੇਤਾਵਨੀ (Safety Warning)*\n\nਕਿਰਪਾ ਕਰਕੇ AgriSeva-AI ’ਤੇ ਅਣਉਚਿਤ ਜਾਂ ਇਤਰਾਜ਼ਯੋਗ ਭਾਸ਼ਾ ਦੀ ਵਰਤੋਂ ਨਾ ਕਰੋ। ਇਹ ਸੇਵਾ ਸਿਰਫ਼ ਕਿਸਾਨਾਂ ਦੀ ਖੇਤੀਬਾੜੀ ਸਹਾਇਤਾ ਲਈ ਹੈ।\n\nਦੁਬਾਰਾ ਉਲੰਘਣਾ ਕਰਨ ’ਤੇ ਤੁਹਾਡਾ ਨੰਬਰ ਬਲਾਕ ਕਰ ਦਿੱਤਾ ਜਾਵੇਗਾ।',
          'ml-IN': '⚠️ *മുന്നറിയിപ്പ് (Safety Warning)*\n\nദയവായി AgriSeva-AI-ൽ അനുചിതമായ അല്ലെങ്കിൽ അപകീർത്തികരമായ ഭാഷ ഉപയോഗിക്കരുത്. ഇത് കർഷകരുടെ കാർഷിക സഹായത്തിന് മാത്രമുള്ളതാണ്.\n\nനിയമം വീണ്ടും ലംഘിച്ചാൽ നിങ്ങളുടെ നമ്പർ ബ്ലോക്ക് ചെയ്യപ്പെടും.',
          'od-IN': '⚠️ *ଚେତାବନୀ (Safety Warning)*\n\nଦୟାକରି AgriSeva-AI ରେ ଅନୁପଯୁକ୍ତ ବା ଅପମାନଜନକ ଭାଷା ବ୍ୟବହାର କରନ୍ତୁ ନାହିଁ। ଏହା କେବଳ କୃଷକମାନଙ୍କ କୃଷି ସହାୟତା ପାଇଁ ଉଦ୍ଦିଷ୍ଟ।\n\nପୁଣି ନିୟମ ଉଲ୍ଲଂଘନ କଲେ ଆପଣଙ୍କ ନମ୍ବର ବ୍ଲକ କରାଯିବ।',
          'en-IN': '⚠️ *Safety Warning*\n\nPlease refrain from using inappropriate, abusive, or illegal language. AgriSeva-AI is dedicated solely to agricultural and farming assistance.\n\nFurther violations will result in your number being blocked.',
        };
        const warningMsg = warningMessages[currentLang] || warningMessages['en-IN'];
        session.history.push({
          role: 'assistant',
          content: warningMsg,
          timestamp: new Date(),
        });
        session.lastMessageAt = new Date();
        session.updatedAt = new Date();

        await sessionsCol.updateOne({ phoneNumber: canonicalPhone }, { $set: session }, { upsert: true });
        await this.sendTextMessage(from, targetPhoneId, warningMsg);
        console.warn(`[WhatsAppService] Safety violation (Warning 1) sent to ${from}`);
        return;
      } else {
        session.blocked = true;
        session.blockedAt = new Date();
        session.blockReason = safetyCheck.reason || 'Repeated safety policy violations';
        session.warningCount = currentWarnings + 1;
        session.history = session.history || [];
        session.history.push({
          role: 'user',
          content: userQuery || extra?.image?.caption || '⚠️ [Disallowed content]',
          timestamp: new Date(),
        });

        const blockedNotices: Record<string, string> = {
          'te-IN': '🚫 *ఖాతా బ్లాక్ చేయబడింది (Account Blocked)*\n\nనిబంధనలను పదేపదే ఉల్లంఘించినందున మీ మొబైల్ నంబర్ AgriSeva-AI సేవలకు శాశ్వతంగా బ్లాక్ చేయబడింది.',
          'hi-IN': '🚫 *नंबर ब्लॉक कर दिया गया है (Account Blocked)*\n\nबार-बार नियमों का उल्लंघन करने के कारण आपका नंबर AgriSeva-AI पर स्थायी रूप से ब्लॉक कर दिया गया है।',
          'ta-IN': '🚫 *எண் முடக்கப்பட்டது (Account Blocked)*\n\nவிதிமுறைகளை தொடர்ந்து மீறியதால் உங்கள் எண் AgriSeva-AI சேவைகளில் முடக்கப்பட்டுள்ளது.',
          'kn-IN': '🚫 *ಸಂಖ್ಯೆಯನ್ನು ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ (Account Blocked)*\n\nನಿಯಮಗಳನ್ನು ಪದೇ ಪದೇ ಉಲ್ಲಂಘಿಸಿದ್ದಕ್ಕಾಗಿ ನಿಮ್ಮ ಸಂಖ್ಯೆಯನ್ನು AgriSeva-AI ನಲ್ಲಿ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ.',
          'mr-IN': '🚫 *खाते ब्लॉक केले गेले (Account Blocked)*\n\nवारंवार नियमांचे उल्लंघन केल्यामुळे आपला मोबाईल नंबर AgriSeva-AI वर कायमस्वरूपी ब्लॉक करण्यात आला आहे.',
          'bn-IN': '🚫 *অ্যাকাউন্ট ব্লক করা হয়েছে (Account Blocked)*\n\nবারংবার নিয়ম লঙ্ঘনের কারণে আপনার নম্বর AgriSeva-AI সেবায় স্থায়ীভাবে ব্লক করা হয়েছে।',
          'gu-IN': '🚫 *એકાઉન્ટ બ્લૉક કરવામાં આવ્યું (Account Blocked)*\n\nવારંવાર નિયમોના ઉલ્લંઘનને કારણે તમારો નંબર AgriSeva-AI પર કાયમ માટે બ્લૉક કરવામાં આવ્યો છે.',
          'pa-IN': '🚫 *ਨੰਬਰ ਬਲਾਕ ਕੀਤਾ ਗਿਆ (Account Blocked)*\n\nਵਾਰ-ਵਾਰ ਨਿਯਮਾਂ ਦੀ ਉਲੰਘਣਾ ਕਰਨ ਕਰਕੇ ਤੁਹਾਡਾ ਨੰਬਰ AgriSeva-AI ’ਤੇ ਪੱਕੇ ਤੌਰ ’ਤੇ ਬਲਾਕ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ।',
          'ml-IN': '🚫 *അക്കൗണ്ട് ബ്ലോക്ക് ചെയ്തു (Account Blocked)*\n\nതുടർച്ചയായ നിയമലംഘനം കാരണം നിങ്ങളുടെ നമ്പർ AgriSeva-AI സേവനങ്ങളിൽ സ്ഥിരമായി ബ്ലോക്ക് ചെയ്തിരിക്കുന്നു.',
          'od-IN': '🚫 *ଆକାଉଣ୍ଟ ବ୍ଲକ କରାଗଲା (Account Blocked)*\n\nବାରମ୍ବାର ନିୟମ ଉଲ୍ଲଂଘନ ହେତୁ ଆପଣଙ୍କ ମୋବାଇଲ ନମ୍ବର AgriSeva-AI ସେବାରୁ ସ୍ଥାୟୀ ଭାବେ ବ୍ଲକ କରାଯାଇଛି।',
          'en-IN': '🚫 *Account Blocked*\n\nDue to repeated violations of community safety guidelines, your number has been blocked from accessing AgriSeva-AI services.',
        };
        const blockMsg = blockedNotices[currentLang] || blockedNotices['en-IN'];
        session.history.push({
          role: 'assistant',
          content: blockMsg,
          timestamp: new Date(),
        });
        session.lastMessageAt = new Date();
        session.updatedAt = new Date();

        await sessionsCol.updateOne({ phoneNumber: canonicalPhone }, { $set: session }, { upsert: true });
        await this.sendTextMessage(from, targetPhoneId, blockMsg);
        console.warn(`[WhatsAppService] Safety violation: Blocked number ${from}`);
        return;
      }
    }

    // Step 5: Conversational & Off-topic Handling
    const isAudioMsg = extra?.msgType === 'audio' || extra?.msgType === 'voice' || !!extra?.audio || !!extra?.voice;
    const isImageMsg = extra?.msgType === 'image' || !!extra?.image;

    const footerTips: Record<string, string> = {
      'te-IN': '🌐 భాష మార్చడానికి "1" లేదా "language" అని పంపండి',
      'hi-IN': '🌐 भाषा बदलने के लिए "1" या "language" लिखें',
      'ta-IN': '🌐 மொழியை மாற்ற "1" அல்லது "language" என தட்டச்சு செய்யவும்',
      'kn-IN': '🌐 ಭಾಷೆ ಬದಲಾಯಿಸಲು "1" లేదా "language" ಎಂದು ಕಳುಹಿಸಿ',
      'mr-IN': '🌐 भाषा बदलण्यासाठी "1" किंवा "language" पाठवा',
      'bn-IN': '🌐 भाषा परिवर्तन করতে "1" বা "language" লিখুন',
      'gu-IN': '🌐 ભાષા બદલવા માટે "1" અથવા "language" લખો',
      'pa-IN': '🌐 ਭਾਸ਼ਾ ਬਦਲਣ ਲਈ "1" ਜਾਂ "language" ਲਿਖੋ',
      'ml-IN': '🌐 ഭാഷ മാറ്റാൻ "1" അല്ലെങ്കിൽ "language" എന്ന് അയക്കുക',
      'od-IN': '🌐 ଭାଷା ବଦଳାଇବା ପାଇଁ "1" କିମ୍ବା "language" ଲେଖନ୍ତୁ',
      'en-IN': '🌐 Type "1" or "language" anytime to change language',
    };

    if (!isAudioMsg && !isImageMsg && userQuery) {
      const conv = isConversationalMessage(userQuery);
      if (conv.isConversational && conv.type) {
        let reply = '';
        if (conv.type === 'greeting') {
          const greetingsMap: Record<string, string> = {
            'te-IN': '🌾 *నమస్తే! AgriSeva-AI కి స్వాగతం.*\n\nమీ పంటల ఆరోగ్యం, ఎరువులు, తెగుళ్ల నివారణ లేదా మార్కెట్ ధరల గురించి ఏవైనా ప్రశ్నలు అడగండి. మేము రైతులకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాము!\n\n_టెక్స్ట్ మెసేజ్, వాయిస్ నోట్ లేదా పంట ఫోటో పంపవచ్చు._',
            'hi-IN': '🌾 *नमस्ते! AgriSeva-AI में आपका स्वागत है।*\n\nअपनी फसल, खाद-उर्वरक, कीट-रोग या मंडी भाव से जुड़ा कोई भी प्रश्न पूछें। हम किसान भाइयों की सहायता के लिए तैयार हैं!\n\n_टेक्स्ट मैसेज, वॉइस नोट या फसल की फोटो भेज सकते हैं।_',
            'ta-IN': '🌾 *வணக்கம்! AgriSeva-AI-க்கு நல்வரவு.*\n\nபயிர் பாதுகாப்பு, உரம், பூச்சி மேலாண்மை அல்லது சந்தை விலைகள் குறித்து ஏதேனும் கேள்விகளைக் கேளுங்கள். உதவ நாங்கள் தயாராக உள்ளோம்!\n\n_உரை, குரல் பதிவு அல்லது பயிர் புகைப்படம் அனுப்பலாம்._',
            'kn-IN': '🌾 *ನಮಸ್ಕಾರ! AgriSeva-AI ಗೆ ಸ್ವಾಗತ.*\n\nಬೆಳೆ ರೋಗಗಳು, ರಸಗೊಬ್ಬರಗಳು ಅಥವಾ ಮಂಡಿ ದರಗಳ ಬಗ್ಗೆ ಯಾವುದೇ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ. ನಾವು ರೈತರಿಗೆ ಸಹಾಯ ಮಾಡಲು ಸಿದ್ಧರಿದ್ದೇವೆ!\n\n_ಪಠ್ಯ, ಧ್ವನಿ ಸಂದೇಶ లేదా ಬೆಳೆಯ ಫೋಟೋ ಕಳುಹಿಸಬಹುದು._',
            'mr-IN': '🌾 *नमस्कार! AgriSeva-AI मध्ये आपले स्वागत आहे.*\n\nआपली पिके, खते, कीड नियंत्रण किंवा बाजारभावाविषयी कोणताही प्रश्न विचारा. आम्ही शेतकऱ्यांच्या मदतीसाठी सज्ज आहोत!\n\n_मजकूर संदेश, व्हॉइस नोट किंवा पिकाचा फोटो पाठवू शकता._',
            'bn-IN': '🌾 *নমস্কার! AgriSeva-AI-তে স্বাগতম।*\n\nআপনার ফসল, সার, কীট ও রোগ বা বাজার দর সংক্রান্ত যেকোনো প্রশ্ন জিজ্ঞাসা করুন। আমরা কৃষকদের সহায়তায় প্রস্তুত!\n\n_টেক্সট মেসেজ, ভয়েস নোট বা ফসলের ছবি পাঠাতে পারেন।_',
            'gu-IN': '🌾 *નમસ્તે! AgriSeva-AI માં આપનું સ્વાગત છે.*\n\nતમારા પાક, ખાતર, જીવાત નિયંત્રણ અથવા બજાર ભાવ વિશે કોઈપણ પ્રશ્ન પૂછો. અમે ખેડૂતોની મદદ માટે તૈયાર છીએ!\n\n_ટેક્સ્ટ સંદેશ, વૉઇસ નોટ અથવા પાકનો ફોટો મોકલી શકો છો._',
            'pa-IN': '🌾 *ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! AgriSeva-AI ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ।*\n\nਆਪਣੀ ਫਸਲ, ਖਾਦ, ਕੀੜੇ-ਮਕੌੜੇ ਜਾਂ ਮੰਡੀ ਭਾਅ ਬਾਰੇ ਕੋਈ ਵੀ ਸਵਾਲ ਪੁੱਛੋ। ਅਸੀਂ ਕਿਸਾਨ ਭਰਾਵਾਂ ਦੀ ਮਦਦ ਲਈ ਤਿਆਰ ਹਾਂ!\n\n_ਟੈਕਸਟ ਸੁਨੇਹਾ, ਵੌਇਸ ਨੋਟ ਜਾਂ ਫਸਲ ਦੀ ਫੋਟੋ ਭੇਜ ਸਕਦੇ ਹੋ।_',
            'ml-IN': '🌾 *നമസ്കാരം! AgriSeva-AI-ലേക്ക് സ്വാഗതം.*\n\nവിള രോഗങ്ങൾ, വളങ്ങൾ, കീടനിയന്ത്രണം അല്ലെങ്കിൽ വിപണി വിലകൾ എന്നിവയെക്കുറിച്ച് എന്തും ചോദിക്കാം. കർഷകരെ സഹായിക്കാൻ ഞങ്ങൾ തയ്യാറാണ്!\n\n_ടെക്സ്റ്റ് സന്ദേശം, വോയ്‌സ് നോട്ട് അല്ലെങ്കിൽ വിളയുടെ ഫോട്ടോ അയക്കാം._',
            'od-IN': '🌾 *ନମସ୍କାର! AgriSeva-AI କୁ ସ୍ୱାଗତ।*\n\nଆପଣଙ୍କ ଫସଲ, ସାର, କୀଟ ନିୟନ୍ତ୍ରଣ କିମ୍ବା ବଜାର ଦର ବିଷୟରେ ଯେକୌଣସି ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ। ଆମେ କୃଷକମାନଙ୍କ ସାହାଯ୍ୟ ପାଇଁ ପ୍ରସ୍ତୁତ!\n\n_ଟେକ୍ସଟ୍ ମେସେଜ୍, ଭଏସ୍ ନୋଟ୍ କିମ୍ବା ଫସଲର ଫଟୋ ପଠାଇ ପାରିବେ।_',
            'en-IN': '🌾 *Hello! Welcome to AgriSeva-AI.*\n\nPlease ask any question about crop health, pest control, fertilizers, or mandi prices. We are here to assist you!\n\n_You can send a text message, voice note, or crop photo._',
          };
          reply = greetingsMap[currentLang] || greetingsMap['en-IN'];
        } else if (conv.type === 'gratitude') {
          const gratitudeMap: Record<string, string> = {
            'te-IN': '🌾 *ధన్యవాదాలు!* మీ వ్యవసాయ ప్రయాణంలో తోడ్పడటం మా సంతోషం. మీకు ఏవైనా సందేహాలు ఉంటే ఎప్పుడైనా సంప్రదించండి!',
            'hi-IN': '🌾 *धन्यवाद!* किसान भाइयों की सेवा करना हमारा सौभाग्य है। कोई भी समस्या हो तो कभी भी पूछें!',
            'ta-IN': '🌾 *மிக்க நன்றி!* விவசாயிகளுக்கு உதவுவது எங்கள் கடமை. சந்தேகங்கள் இருந்தால் எப்போது வேண்டுமானாலும் கேளுங்கள்!',
            'kn-IN': '🌾 *ಧನ್ಯವಾದಗಳು!* ಕೃಷಿ ಕಾರ್ಯದಲ್ಲಿ ನೆರವಾಗುವುದು ನಮ್ಮ ಸಂತೋಷ. ಯಾವುದೇ ಸಂದೇಹವಿದ್ದರೂ ಯಾವಾಗಲೂ ಕೇಳಿ!',
            'mr-IN': '🌾 *धन्यवाद!* शेतकऱ्यांची सेवा करण्यात आम्हाला आनंद आहे. शंका असल्यास कधीही विचारा!',
            'bn-IN': '🌾 *ধন্যবাদ!* কৃষকদের সেবা করতে পেরে আমরা আনন্দিত। কোনো সন্দেহ থাকলে নির্দ্বিধায় জিজ্ঞাসা করুন!',
            'gu-IN': '🌾 *ધન્યવાદ!* ખેડૂત ભાઈઓની સેવા કરવી એ અમારું સૌભાગ્ય છે. કોઈ પણ પ્રશ્ન હોય તો ગમે ત્યારે પૂછો!',
            'pa-IN': '🌾 *ਧੰਨਵਾਦ!* ਕਿਸਾਨ ਵੀਰਾਂ ਦੀ ਸੇਵਾ ਕਰਨਾ ਸਾਡਾ ਸੁਭਾਗ ਹੈ। ਕੋਈ ਵੀ ਸ਼ੱਕ ਹੋਵੇ ਤਾਂ ਕਦੇ ਵੀ ਪੁੱਛੋ!',
            'ml-IN': '🌾 *നന്ദി!* കർഷകരെ സഹായിക്കുന്നതിൽ ഞങ്ങൾക്ക് സന്തോഷമുണ്ട്. സംശയങ്ങൾ ഉണ്ടെങ്കിൽ എപ്പോൾ വേണമെങ്കിലും ചോദിക്കാം!',
            'od-IN': '🌾 *ଧନ୍ୟବାଦ!* କୃଷକମାନଙ୍କ ସେବା କରିବା ଆମର ଆନନ୍ଦ। କୌଣସି ସନ୍ଦେହ ଥିଲେ ଯେକୌଣସି ସମୟରେ ପଚାରନ୍ତୁ!',
            'en-IN': '🌾 *You\'re welcome!* Happy to assist with your farming needs. Feel free to ask anytime!',
          };
          reply = gratitudeMap[currentLang] || gratitudeMap['en-IN'];
        } else if (conv.type === 'ack') {
          const ackMap: Record<string, string> = {
            'te-IN': '👍 *సరేనండి!* మీ వ్యవసాయ పనులకు మా శుభాకాంక్షలు. ఏదైనా సందేహం ఉంటే అడగండి.',
            'hi-IN': '👍 *जी बिल्कुल!* किसी भी कृषि समस्या या जानकारी के लिए कभी भी पूछ सकते हैं।',
            'ta-IN': '👍 *சரிங்க!* விவசாயத் தேவைகளுக்கு எப்போது வேண்டுமானாலும் கேட்கலாம்.',
            'kn-IN': '👍 *ಸರಿ!* ಕೃಷಿ ಕುರಿತು ಯಾವುದೇ ಸಹಾಯ ಬೇಕಿದ್ದರೂ ಕೇಳಿ.',
            'mr-IN': '👍 *नक्कीच!* आपल्या शेती कामासाठी शुभेच्छा. कोणतीही अडचण असल्यास नक्की विचारा.',
            'bn-IN': '👍 *অবশ্যই!* কৃষিকাজে আপনার সাফল্যের কামনা করি। কোনো তথ্য প্রয়োজন হলে জানান।',
            'gu-IN': '👍 *ચોક્કસ!* તમારા ખેતીકામ માટે શુભેચ્છાઓ. કોઈ પણ મદદ જોઈતી હોય તો પૂછો.',
            'pa-IN': '👍 *ਜ਼ਰੂਰ!* ਤੁਹਾਡੇ ਖੇਤੀਬਾੜੀ ਕੰਮ ਲਈ ਸ਼ੁਭਕਾਮਨਾਵਾਂ। ਕੋਈ ਵੀ ਲੋੜ ਹੋਵੇ ਤਾਂ ਪੁੱਛੋ।',
            'ml-IN': '👍 *തീർച്ചയായും!* നിങ്ങളുടെ കാർഷിക വിജയത്തിന് ആശംസകൾ. എന്തെങ്കിലും സംശയമുണ്ടെങ്കിൽ ചോദിക്കുക.',
            'od-IN': '👍 *ନିଶ୍ଚୟ!* ଆପଣଙ୍କ କୃଷି କାର୍ଯ୍ୟ ପାଇଁ ଶୁଭକାମନା। କିଛି ଜାଣିବାକୁ ଥିଲେ ପଚାରନ୍ତୁ।',
            'en-IN': '👍 *Understood!* Wishing you great farming success. Feel free to ask if you have any questions.',
          };
          reply = ackMap[currentLang] || ackMap['en-IN'];
        } else if (conv.type === 'about' || conv.type === 'help') {
          const aboutMap: Record<string, string> = {
            'te-IN': '🌾 *నేను AgriSeva-AI డిజిటల్ వ్యవసాయ సహాయకుడిని.*\n\nరైతులకు పంట రోగ నిర్ధారణ, తెగుళ్ల నివారణ, ఎరువుల సమతుల్యత మరియు మార్కెట్ ధరలపై తక్షణ సలహాలు అందించడమే నా బాధ్యత.\n\nమీరు మీ పంట సమస్యను వివరించవచ్చు, వాయిస్ నోట్ లేదా పంట ఫోటో పంపవచ్చు!',
            'hi-IN': '🌾 *मैं AgriSeva-AI डिजिटल कृषि सहायक हूँ।*\n\nकिसानों को फसल रोग निदान, कीट नियंत्रण, उर्वरक प्रबंधन और मंडी भाव पर सटीक सलाह देना मेरा कार्य है।\n\nआप अपनी समस्या टेक्स्ट, वॉइस संदेश या फसल की फोटो भेजकर पूछ सकते हैं!',
            'ta-IN': '🌾 *நான் AgriSeva-AI டிஜிட்டல் விவசாய உதவியாளர்.*\n\nவிவசாயிகளுக்கு பயிர் நோய், பூச்சி மேலாண்மை, உரம் மற்றும் சந்தை விலை குறித்த ஆலோசனைகளை வழங்குவதே என் பணி.\n\nநீங்கள் உரை, குரல் பதிவு அல்லது பயிர் புகைப்படம் அனுப்பலாம்!',
            'kn-IN': '🌾 *ನಾನು AgriSeva-AI ಡಿಜಿಟಲ್ ಕೃಷಿ ಸಹಾಯಕ.*\n\nರೈತರಿಗೆ ಬೆಳೆ ರೋಗ, ಕೀಟ ನಿಯಂತ್ರಣ, ರಸಗೊಬ್ಬರ ಮತ್ತು ಮಂಡಿ ದರಗಳ ಕುರಿತು ನಿಖರ ಸಲಹೆ ನೀಡುವುದು ನನ್ನ ಗುರಿ.\n\nನೀವು ಪಠ್ಯ, ಧ್ವನಿ ಅಥವಾ ಬೆಳೆಯ ಫೋಟೋ ಕಳುಹಿಸಬಹುದು!',
            'mr-IN': '🌾 *मी AgriSeva-AI डिजिटल कृषी सहाय्यक आहे.*\n\nशेतकऱ्यांना पीक रोगनिदान, कीड व्यवस्थापन, खते आणि बाजारभावावर अचूक सल्ला देणे हे माझे काम आहे.\n\nआपण मजकूर, व्हॉइस संदेश किंवा पिकाचा फोटो पाठवून विचारू शकता!',
            'bn-IN': '🌾 *আমি AgriSeva-AI ডিজিটাল কৃষি সহায়ক।*\n\nকৃষকদের ফসলের রোগ নির্ণয়, কীট ব্যবস্থাপনা, সার ও বাজার দরের সঠিক পরামর্শ দেওয়াই আমার কাজ।\n\nআপনি টেক্সট, ভয়েস বা ফসলের ছবি পাঠিয়ে জিজ্ঞাসা করতে পারেন!',
            'gu-IN': '🌾 *હું AgriSeva-AI ડિજિટલ કૃષિ સહાયક છું.*\n\nખેડૂતોને પાક રોગ નિદાન, જીવાત નિયંત્રણ, ખાતર અને બજાર ભાવ અંગે ચોક્કસ સલાહ આપવી એ મારું કાર્ય છે.\n\nતમે ટેક્સ્ટ, વૉઇસ અથવા પાકનો ફોટો મોકલીને પૂછી શકો છો!',
            'pa-IN': '🌾 *ਮੈਂ AgriSeva-AI ਡਿਜੀਟਲ ਖੇਤੀਬਾੜੀ ਸਹਾਇਕ ਹਾਂ।*\n\nਕਿਸਾਨਾਂ ਨੂੰ ਫਸਲੀ ਬਿਮਾਰੀਆਂ, ਕੀੜਿਆਂ ਦੀ ਰੋਕਥਾਮ, ਖਾਦਾਂ ਅਤੇ ਮੰਡੀ ਭਾਅ ’ਤੇ ਸਹੀ ਸਲਾਹ ਦੇਣਾ ਮੇਰਾ ਕੰਮ ਹੈ।\n\nਤੁਸੀਂ ਟੈਕਸਟ, ਵੌਇਸ ਜਾਂ ਫਸਲ ਦੀ ਫੋਟੋ ਭੇਜ ਕੇ ਪੁੱਛ ਸਕਦੇ ਹੋ!',
            'ml-IN': '🌾 *ഞാൻ AgriSeva-AI ഡിജിറ്റൽ കാർഷിക സഹായിയാണ്.*\n\nവിള രോഗനിർണ്ണയം, കീടനിയന്ത്രണം, വളം, വിപണി വിലകൾ എന്നിവയിൽ കർഷകർക്ക് കൃത്യമായ ഉപദേശം നൽകുകയാണ് എന്റെ ലക്ഷ്യം.\n\nനിങ്ങൾക്ക് ടെക്സ്റ്റ്, വോയ്സ് അല്ലെങ്കിൽ വിളയുടെ ഫോട്ടോ അയക്കാം!',
            'od-IN': '🌾 *ମୁଁ AgriSeva-AI ଡିଜିଟାଲ୍ କୃଷି ସହାୟକ।*\n\nକୃଷକମାନଙ୍କୁ ଫସଲ ରୋଗ ନିର୍ଣ୍ଣୟ, କୀଟ ନିୟନ୍ତ୍ରଣ, ସାର ଏବଂ ବଜାର ଦର ବିଷୟରେ ସଠିକ୍ ପରାମର୍ଶ ଦେବା ମୋର ଲକ୍ଷ୍ୟ।\n\nଆପଣ ଟେକ୍ସଟ୍, ଭଏସ୍ କିମ୍ବା ଫସଲର ଫଟୋ ପଠାଇ ପଚାରି ପାରିବେ!',
            'en-IN': '🌾 *I am AgriSeva-AI, your digital agricultural assistant.*\n\nI provide instant advisory on crop disease diagnosis, pest management, fertilizers, weather, and market rates.\n\nYou can ask via text, voice message, or send a crop photo!',
          };
          reply = aboutMap[currentLang] || aboutMap['en-IN'];
        } else if (conv.type === 'howAreYou') {
          const howAreYouMap: Record<string, string> = {
            'te-IN': '😊 నేను బాగున్నాను, ధన్యవాదాలు! మీ పంటలు ఎలా ఉన్నాయి? నేడు మీకు ఏ వ్యవసాయ సహాయం కావాలి? 🌾',
            'hi-IN': '😊 मैं बिल्कुल ठीक हूँ, धन्यवाद! आपकी फसल कैसी है? आज आपको क्या कृषि जानकारी चाहिए? 🌾',
            'ta-IN': '😊 நான் நலமாக இருக்கிறேன், நன்றி! உங்கள் பயிர்கள் எப்படி உள்ளன? இன்று என்ன விவசாய உதவி வேண்டும்? 🌾',
            'kn-IN': '😊 ನಾನು ಚೆನ್ನಾಗಿದ್ದೇನೆ, ಧನ್ಯವಾದಗಳು! ನಿಮ್ಮ ಬೆಳೆ ಹೇಗಿದೆ? ಇಂದು ಯಾವ ಕೃಷಿ ಸಹಾಯ ಬೇಕು? 🌾',
            'mr-IN': '😊 मी अगदी मजेत आहे, धन्यवाद! आपली पिके कशी आहेत? आज आपल्याला कोणती कृषी माहिती हवी आहे? 🌾',
            'bn-IN': '😊 আমি ভালো আছি, ধন্যবাদ! আপনার ফসল কেমন আছে? আজ আপনাকে কী কৃষি পরামর্শ দিতে পারি? 🌾',
            'gu-IN': '😊 હું એકદમ મજામાં છું, આભાર! તમારા પાક કેવા છે? આજે તમને કઈ કૃષિ માહિતી જોઈએ છે? 🌾',
            'pa-IN': '😊 ਮੈਂ ਬਿਲਕੁਲ ਠੀਕ ਹਾਂ, ਧੰਨਵਾਦ! ਤੁਹਾਡੀ ਫਸਲ ਕਿਵੇਂ ਹੈ? ਅੱਜ ਤੁਹਾਨੂੰ ਕਿਹੜੀ ਖੇਤੀਬਾੜੀ ਜਾਣਕਾਰੀ ਚਾਹੀਦੀ ਹੈ? 🌾',
            'ml-IN': '😊 എനിക്ക് സുഖമാണ്, നന്ദി! നിങ്ങളുടെ കൃഷി എങ്ങനെയുണ്ട്? ഇന്ന് എന്താണ് കാർഷിക സഹായം വേണ്ടത്? 🌾',
            'od-IN': '😊 ମୁଁ ବହୁତ ଭଲରେ ଅଛି, ଧନ୍ୟବାଦ! ଆପଣଙ୍କ ଫସଲ କିପରି ଅଛି? ଆଜି ଆପଣଙ୍କୁ କେଉଁ କୃଷି ସହାୟତା ଦରକାର? 🌾',
            'en-IN': '😊 I\'m doing well, thank you! How are your crops doing? What agricultural assistance do you need today? 🌾',
          };
          reply = howAreYouMap[currentLang] || howAreYouMap['en-IN'];
        }

        const footerTip = footerTips[currentLang] || footerTips['en-IN'];
        const displayName = getLanguageDisplayName(currentLang);
        const formattedConvMsg = `${reply}\n\n━━━━━━━━━━━━━━━━\n_🌾 AgriSeva-AI • ${displayName}_\n_${footerTip}_`;

        await this.sendTextMessage(from, targetPhoneId, formattedConvMsg);

        session.history = session.history || [];
        session.history.push({
          role: 'user',
          content: userQuery,
          timestamp: new Date(),
          msgType: 'text',
        });
        session.history.push({
          role: 'assistant',
          content: formattedConvMsg,
          timestamp: new Date(),
        });
        session.lastMessageAt = new Date();
        session.updatedAt = new Date();
        await sessionsCol.updateOne({ phoneNumber: canonicalPhone }, { $set: session }, { upsert: true });
        return;
      }

      // Check Off-Topic Non-Agricultural queries
      if (!isLikelyAgriculturalQuery(userQuery)) {
        const offTopicResponses: Record<string, string> = {
          'te-IN': '🌾 *AgriSeva-AI వ్యవసాయ సహాయకుడు*\n\nనేను కేవలం వ్యవసాయం, పంటల సంరక్షణ, తెగుళ్ల నివారణ, ఎరువులు మరియు మార్కెట్ ధరలకు సంబంధించిన ప్రశ్నలకు మాత్రమే సమాధానం ఇవ్వగలను.\n\nదయచేసి మీ పంట లేదా వ్యవసాయ సంబంధిత ప్రశ్నను అడగండి!',
          'hi-IN': '🌾 *AgriSeva-AI कृषि सहायक*\n\nमैं केवल कृषि, फसल सुरक्षा, कीट-रोग, खाद-उर्वरक और मंडी भाव से संबंधित प्रश्नों के उत्तर देने के लिए समर्पित हूँ।\n\nकृपया खेती या फसल से जुड़ा कोई प्रश्न पूछें!',
          'ta-IN': '🌾 *AgriSeva-AI விவசாய உதவியாளர்*\n\nஎன்னால் விவசாயம், பயிர் பாதுகாப்பு, பூச்சி மேலாண்மை, உரம் மற்றும் சந்தை விலை தொடர்பான கேள்விகளுக்கு மட்டுமே பதிலளிக்க முடியும்.\n\nதயவுசெய்து விவசாயம் சார்ந்த கேள்வியைக் கேட்கவும்!',
          'kn-IN': '🌾 *AgriSeva-AI ಕೃಷಿ ಸಹಾಯಕ*\n\nನಾನು ಕೃಷಿ, ಬೆಳೆ ರಕ್ಷಣೆ, ರೋಗಗಳು, ರಸಗೊಬ್ಬರ ಮತ್ತು ಮಂಡಿ ದರಗಳಿಗೆ ಸಂಬಂಧಿಸಿದ ಪ್ರಶ್ನೆಗಳಿಗೆ ಮಾತ್ರ ಉತ್ತರಿಸಬಲ್ಲೆ.\n\nದಯವಿಟ್ಟು ಕೃಷಿಗೆ ಸಂಬಂಧಿಸಿದ ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳಿ!',
          'en-IN': '🌾 *AgriSeva-AI Agricultural Assistant*\n\nI am dedicated specifically to agriculture, crop health, pest diagnosis, fertilizers, and mandi prices.\n\nPlease ask an agriculture or crop-related question!',
        };
        const offTopicMsg = offTopicResponses[currentLang] || offTopicResponses['en-IN'];
        const footerTip = footerTips[currentLang] || footerTips['en-IN'];
        const displayName = getLanguageDisplayName(currentLang);
        const formattedOffTopic = `${offTopicMsg}\n\n━━━━━━━━━━━━━━━━\n_🌾 AgriSeva-AI • ${displayName}_\n_${footerTip}_`;

        await this.sendTextMessage(from, targetPhoneId, formattedOffTopic);

        session.history = session.history || [];
        session.history.push({
          role: 'user',
          content: userQuery,
          timestamp: new Date(),
          msgType: 'text',
        });
        session.history.push({
          role: 'assistant',
          content: formattedOffTopic,
          timestamp: new Date(),
        });
        session.lastMessageAt = new Date();
        session.updatedAt = new Date();
        await sessionsCol.updateOne({ phoneNumber: canonicalPhone }, { $set: session }, { upsert: true });
        return;
      }
    }

    // Step 6: Multi-modal Input Handling (Voice / Image / Text)

    // Handle Voice Message
    let audioDataUrl: string | undefined;
    if (isAudioMsg) {
      const audioId = extra?.audio?.id || extra?.voice?.id;
      const mimeType = extra?.audio?.mime_type || extra?.voice?.mime_type || 'audio/ogg';
      if (audioId) {
        try {
          console.log(`[WhatsAppService] Downloading voice message ${audioId}...`);
          const { buffer } = await this.downloadMetaMedia(audioId);
          if (buffer) {
            audioDataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
          }
          userQuery = await this.transcribeAudio(buffer, mimeType, currentLang);
          console.log(`[WhatsAppService] Transcribed voice query: "${userQuery}"`);
        } catch (err: any) {
          console.error('[WhatsAppService] Error processing voice note:', err.message);
        }

        if (!userQuery) {
          const voiceFailures: Record<string, string> = {
            'te-IN': '🎙️ క్షమించండి, మీ వాయిస్ సందేశం స్పష్టంగా వినిపించలేదు. దయచేసి నేపథ్య శబ్దం లేకుండా మళ్ళీ మాట్లాడి పంపండి లేదా టెక్స్ట్ రూపంలో టైప్ చేయండి.',
            'hi-IN': '🎙️ क्षमा करें, आपका वॉइस संदेश स्पष्ट सुनाई नहीं दिया। कृपया शांतिपूर्ण स्थान से पुनः बोलकर भेजें या टेक्स्ट में टाइप करें।',
            'ta-IN': '🎙️ மன்னிக்கவும், உங்கள் குரல் செய்தி தெளிவாக கேட்கவில்லை. தயவுசெய்து மீண்டும் தெளிவாக பேசி அனுப்பவும் அல்லது தட்டச்சு செய்யவும்.',
            'kn-IN': '🎙️ ಕ್ಷಮಿಸಿ, ನಿಮ್ಮ ಧ್ವನಿ ಸಂದೇಶ ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಪುನಃ ಸ್ಪಷ್ಟವಾಗಿ ಮಾತನಾಡಿ ಕಳುಹಿಸಿ ಅಥವಾ ಪಠ್ಯದಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ.',
            'mr-IN': '🎙️ क्षमस्व, आपला व्हॉइस संदेश स्पष्ट ऐकू आला नाही. कृपया शांत ठिकाणाहून पुन्हा बोलून पाठवा किंवा मजकुरात टाइप करा.',
            'bn-IN': '🎙️ দুঃখিত, আপনার ভয়েস বার্তা স্পষ্ট বোঝা যায়নি। অনুগ্রহ করে পুনরায় স্পষ্টভাবে বলে পাঠান অথবা টেক্সটে লিখে পাঠান।',
            'gu-IN': '🎙️ ક્ષમા કરશો, તમારો વૉઇસ સંદેશ સ્પષ્ટ સંભળાયો નથી. કૃપા કરીને ફરીથી સ્પષ્ટ બોલીને મોકલો અથવા ટેક્સ્ટમાં લખો.',
            'pa-IN': '🎙️ ਮਾਫ਼ ਕਰਨਾ, ਤੁਹਾਡਾ ਵੌਇਸ ਸੁਨੇਹਾ ਸਾਫ਼ ਨਹੀਂ ਸੁਣਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਬੋਲ ਕੇ ਭੇਜੋ ਜਾਂ ਟੈਕਸਟ ਵਿੱਚ ਲਿਖੋ।',
            'ml-IN': '🎙️ ക്ഷമിക്കണം, നിങ്ങളുടെ ശബ്ദ സന്ദേശം വ്യക്തമായി കേൾക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും വ്യക്തമായി സംസാരിച്ചു അയക്കുക അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യുക.',
            'od-IN': '🎙️ କ୍ଷମା କରିବେ, ଆପଣଙ୍କ ଭଏସ୍ ମେସେଜ୍ ସ୍ପଷ୍ଟ ଶୁଣାଗଲା ନାହିଁ। ଦୟାକରି ପୁନର୍ବାର ସ୍ପଷ୍ଟ ଭାବେ କହି ପଠାନ୍ତୁ କିମ୍ବା ଟାଇପ୍ କରନ୍ତୁ।',
            'en-IN': '🎙️ Sorry, we could not clearly understand your voice note. Please speak clearly without background noise and try again, or type your question in text.',
          };
          const failMsg = voiceFailures[currentLang] || voiceFailures['en-IN'];
          await this.sendTextMessage(from, targetPhoneId, failMsg);
          return;
        }
      }
    }

    // Handle Image Message
    if (isImageMsg) {
      const imageId = extra?.image?.id;
      const mimeType = extra?.image?.mime_type || 'image/jpeg';
      const caption = extra?.image?.caption || userQuery || '';
      if (imageId) {
        try {
          console.log(`[WhatsAppService] Downloading crop image ${imageId}...`);
          const { buffer } = await this.downloadMetaMedia(imageId);
          const diagnosis = await this.processCropImage(buffer, mimeType, caption, currentLang);
          if (diagnosis) {
            const translatedDiagnosis = await this.translateText(diagnosis, currentLang);
            // Use localized header/footer — was previously hardcoded in Telugu regardless of user language
            const imgHeaders: Record<string, string> = {
              'te-IN': '🌱 *AgriSeva-AI పంట రోగ నిర్ధారణ*',
              'hi-IN': '🌱 *AgriSeva-AI फसल रोग निदान*',
              'ta-IN': '🌱 *AgriSeva-AI பயிர் நோய் கண்டறிதல்*',
              'kn-IN': '🌱 *AgriSeva-AI ಬೆಳೆ ರೋಗ ರೋಗನಿರ್ಣಯ*',
              'mr-IN': '🌱 *AgriSeva-AI पीक रोगनिदान*',
              'bn-IN': '🌱 *AgriSeva-AI ফসল রোগ নির্ণয়*',
              'gu-IN': '🌱 *AgriSeva-AI પાક રોગ નિદાન*',
              'pa-IN': '🌱 *AgriSeva-AI ਫਸਲੀ ਬਿਮਾਰੀ ਨਿਦਾਨ*',
              'ml-IN': '🌱 *AgriSeva-AI വിള രോഗനിർണ്ണയം*',
              'od-IN': '🌱 *AgriSeva-AI ଫସଲ ରୋଗ ନିର୍ଣ୍ଣୟ*',
              'en-IN': '🌱 *AgriSeva-AI Crop Disease Diagnosis*',
            };
            const imgFooters: Record<string, string> = {
              'te-IN': '🌐 భాషను మార్చడానికి "1" లేదా "language" అని పంపండి.',
              'hi-IN': '🌐 भाषा बदलने के लिए "1" या "language" लिखें।',
              'ta-IN': '🌐 மொழியை மாற்ற "1" அல்லது "language" என தட்டச்சு செய்யவும்.',
              'kn-IN': '🌐 ಭಾಷೆ ಬದಲಾಯಿಸಲು "1" లేదా "language" ಎಂದು ಕಳುಹಿಸಿ.',
              'mr-IN': '🌐 भाषा बदलण्यासाठी "1" किंवा "language" पाठवा.',
              'bn-IN': '🌐 भाषा परिवर्तन করতে "1" বা "language" লিখুন।',
              'gu-IN': '🌐 ભાષા બદલવા માટે "1" અથવા "language" લખો.',
              'pa-IN': '🌐 ਭਾਸ਼ਾ ਬਦਲਣ ਲਈ "1" ਜਾਂ "language" ਲਿਖੋ।',
              'ml-IN': '🌐 ഭാഷ മാറ്റാൻ "1" അല്ലെങ്കിൽ "language" എന്ന് അയക്കുക.',
              'od-IN': '🌐 ଭାଷା ବଦଳାଇବା ପାଇଁ "1" କିମ୍ବା "language" ଲେଖନ୍ତୁ।',
              'en-IN': '🌐 Type "1" or "language" anytime to change language.',
            };
            const imgHeader = imgHeaders[currentLang] || imgHeaders['en-IN'];
            const imgFooter = imgFooters[currentLang] || imgFooters['en-IN'];
            const formatted = `${imgHeader}\n\n${translatedDiagnosis}\n\n━━━━━━━━━━━━━━━━\n_🌾 AgriSeva-AI • ${getLanguageDisplayName(currentLang)}_\n_${imgFooter}_`;
            await this.sendTextMessage(from, targetPhoneId, formatted);

            // Update session history
            session.history = session.history || [];
            session.history.push({
              role: 'user',
              content: caption || '📷 [Crop Image uploaded]',
              timestamp: new Date(),
              msgType: 'image',
              mediaUrl: buffer ? `data:${mimeType};base64,${buffer.toString('base64')}` : undefined,
            });
            session.history.push({
              role: 'assistant',
              content: translatedDiagnosis,
              timestamp: new Date(),
            });
            session.lastMessageAt = new Date();
            await sessionsCol.updateOne({ phoneNumber: canonicalPhone }, { $set: session }, { upsert: true });

            // Persist WhatsApp crop diagnosis image to "All Questions" pipeline
            try {
              const questionsCol = await this.mongoDatabase.getCollection('questions');
              const imgMsgId = extra?.image?.id || extra?.msgId || `wa_img_${canonicalPhone}_${Date.now()}`;
              const existingImgQ = await questionsCol.findOne({ messageId: imgMsgId });
              if (!existingImgQ) {
                const imgQId = new ObjectId();
                const userObjId = session.userId ? new ObjectId(session.userId.toString()) : undefined;
                await questionsCol.insertOne({
                  _id: imgQId,
                  userId: userObjId,
                  question: caption || '📷 [Crop Disease Image Diagnosis]',
                  originalQuestion: caption || 'Crop Disease Image Diagnosis',
                  status: 'open',
                  source: 'WHATSAPP',
                  imageUrl: buffer ? `data:${mimeType};base64,${buffer.toString('base64')}` : undefined,
                  messageId: imgMsgId,
                  threadId: canonicalPhone,
                  totalAnswersCount: 1,
                  isAutoAllocate: false,
                  autoAllocateGateKeeper: true,
                  autoAllocateAuditor: true,
                  autoAllocateModerator: true,
                  embedding: [],
                  metrics: null,
                  priority: 'medium',
                  details: { state: '', district: '', crop: '', season: '', domain: ['Disease Management'] },
                  language: currentLang,
                  detectedLanguage: currentLang,
                  aiInitialAnswer: translatedDiagnosis,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });

                const submissionsCol = await this.mongoDatabase.getCollection('question_submissions');
                await submissionsCol.insertOne({
                  questionId: imgQId,
                  lastRespondedBy: null,
                  history: [],
                  queue: [],
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
                console.log(`[WhatsAppService] Persisted WhatsApp crop image question (id: ${imgQId}, msgId: ${imgMsgId})`);
              }
            } catch (imgQErr: any) {
              console.warn('[WhatsAppService] Could not persist crop image question to questions collection:', imgQErr.message);
            }

            return;
          }
        } catch (err: any) {
          console.error('[WhatsAppService] Error analyzing crop image:', err.message);
        }
      }
    }

    if (!userQuery) {
      console.warn('[WhatsAppService] No text query found after processing. Nothing to reply.');
      return;
    }

    // Step 6: Core Agricultural Advisory Pipeline (Grounded / RAG / POP / Market / Safety)
    let aiAnswer = '';
    let isEscalatedToPAE = false;

    if (this.groundedAnswerService) {
      try {
        console.log(`[WhatsAppService] Calling GroundedAnswerService for: "${userQuery}" [lang: ${currentLang}]`);
        const groundedRes = await this.groundedAnswerService.generateGroundedAnswer({
          query: userQuery,
          language: currentLang,
          userContext: {
            userId: session.userId?.toString(),
          },
        });

        if (groundedRes?.answer?.trim()) {
          const isMarketOrBuyerResponse =
            groundedRes.sources?.some(s => s.type === 'market_prices' || s.type === 'buyers') ||
            groundedRes.warnings?.some(w => /market|commodity|agmarknet|mandi|buyer|crop/i.test(w)) ||
            groundedRes.status === 'calculated' ||
            groundedRes.status === 'insufficient_evidence';

          const isGenericBoilerplate =
            groundedRes.status === 'expert_review' && groundedRes.confidence === 'low' && !isMarketOrBuyerResponse;

          if (!isGenericBoilerplate) {
            aiAnswer = groundedRes.answer.trim();
          } else {
            isEscalatedToPAE = true;
          }
        }
      } catch (err: any) {
        console.warn('[WhatsAppService] GroundedAnswerService error, falling back to direct AI generation:', err.message);
      }
    }

    if (!aiAnswer) {
      aiAnswer = await this.generateDirectAgriculturalAnswer(userQuery, currentLang, session.history);
      if (isEscalatedToPAE) {
        const paeNotes: Record<string, string> = {
          'te-IN': '\n\n📌 _గమనిక: మీ ప్రశ్నకు వివరణాత్మక సలహా పైన ఇవ్వబడింది. అదనపు పరిశీలన కోసం ఇది వ్యవసాయ నిపుణుల (PAE) సమీక్షకు కూడా నమోదు చేయబడింది._',
          'hi-IN': '\n\n📌 _नोट: आपके प्रश्न के लिए विस्तृत सलाह ऊपर दी गई है। अतिरिक्त सत्यापन के लिए इसे कृषि विशेषज्ञ (PAE) समीक्षा हेतु भी दर्ज किया गया है।_',
          'ta-IN': '\n\n📌 _குறிப்பு: உங்கள் கேள்விக்கான ஆலோசனை மேலே கொடுக்கப்பட்டுள்ளது. மேலதிக உறுதிப்படுத்தலுக்கு இது வேளாண் நிபுணர் (PAE) பார்வைக்கு அனுப்பப்பட்டுள்ளது._',
          'kn-IN': '\n\n📌 _ಸೂಚನೆ: ನಿಮ್ಮ ಪ್ರಶ್ನೆಗೆ ವಿವರವಾದ ಸಲಹೆಯನ್ನು ಮೇಲೆ ನೀಡಲಾಗಿದೆ. ಹೆಚ್ಚಿನ ಪರಿಶೀಲನೆಗಾಗಿ ಇದನ್ನು ಕೃಷಿ ತಜ್ಞರ (PAE) ಪರಿಶೀಲನೆಗೆ ದಾಖಲಿಸಲಾಗಿದೆ._',
          'mr-IN': '\n\n📌 _टीप: आपल्या प्रश्नासाठी सविस्तर सल्ला वर दिला आहे. अतिरिक्त पडताळणीसाठी हे कृषी तज्ज्ञ (PAE) पुनरावलोकनासाठी नोंदवले गेले आहे._',
          'bn-IN': '\n\n📌 _নোট: আপনার প্রশ্নের বিশদ পরামর্শ উপরে দেওয়া হয়েছে। অতিরিক্ত যাচাইয়ের জন্য এটি কৃষি বিশেষজ্ঞ (PAE) পর্যালোচনায় পাঠানো হয়েছে।_',
          'gu-IN': '\n\n📌 _નોંધ: તમારા પ્રશ્ન માટે વિગતવાર સલાહ ઉપર આપેલ છે. વધુ ચકાસણી માટે આ કૃષિ નિષ્ણાત (PAE) સમીક્ષા માટે નોંધાયેલ છે._',
          'pa-IN': '\n\n📌 _ਨੋਟ: ਤੁਹਾਡੇ ਸਵਾਲ ਲਈ ਵਿਸਤ੍ਰਿਤ ਸਲਾਹ ਉੱਪਰ ਦਿੱਤੀ ਗਈ ਹੈ। ਹੋਰ ਪੁਸ਼ਟੀ ਲਈ ਇਹ ਖੇਤੀਬਾੜੀ ਮਾਹਿਰ (PAE) ਸਮੀਖਿਆ ਲਈ ਦਰਜ ਕੀਤੀ ਗਈ ਹੈ।_',
          'ml-IN': '\n\n📌 _കുറിപ്പ്: നിങ്ങളുടെ ചോദ്യത്തിന് വിശദമായ ഉപദേശം മുകളിൽ നൽകിയിട്ടുണ്ട്. കൂടുതൽ സ്ഥിരീകരണത്തിനായി ഇത് കാർഷിക വിദഗ്ദ്ധ (PAE) അവലോകനത്തിനായി രേഖപ്പെടുത്തിയിട്ടുണ്ട്._',
          'od-IN': '\n\n📌 _ଟିପ୍ପଣୀ: ଆପଣଙ୍କ ପ୍ରଶ୍ନ ପାଇଁ ବିସ୍ତୃତ ପରାମର୍ଶ ଉପରେ ଦିଆଯାଇଛି। ଅଧିକ ଯାଞ୍ଚ ପାଇଁ ଏହା କୃଷି ବିଶେଷଜ୍ଞ (PAE) ସମୀକ୍ଷା ପାଇଁ ପଠାଯାଇଛି।_',
          'en-IN': '\n\n📌 _Note: Comprehensive advisory is provided above. This query has also been registered for Agricultural Expert (PAE) review._',
        };
        aiAnswer += paeNotes[currentLang] || paeNotes['en-IN'];
      }
    }

    // Step 7: Final Translation into User's Selected Language (Requirements 11, 12, 44)
    let finalLocalizedAnswer = aiAnswer;
    if (currentLang !== 'en-IN' && !this.isAlreadyInTargetScript(aiAnswer, currentLang)) {
      finalLocalizedAnswer = await this.translateText(aiAnswer, currentLang);
    }

    // Step 8: Formatting for WhatsApp
    const headerPrefixes: Record<string, string> = {
      'te-IN': '🌱 *AgriSeva-AI సలహా*',
      'hi-IN': '🌱 *AgriSeva-AI कृषि सलाह*',
      'ta-IN': '🌱 *AgriSeva-AI விவசாய ஆலோசனை*',
      'kn-IN': '🌱 *AgriSeva-AI ಕೃಷಿ ಸಲಹೆ*',
      'mr-IN': '🌱 *AgriSeva-AI कृषी सल्ला*',
      'bn-IN': '🌱 *AgriSeva-AI कृषि পরামর্শ*',
      'gu-IN': '🌱 *AgriSeva-AI કૃષિ સલાહ*',
      'pa-IN': '🌱 *AgriSeva-AI ਖੇਤੀਬਾੜੀ ਸਲਾਹ*',
      'ml-IN': '🌱 *AgriSeva-AI കാർഷിക ഉപദേശം*',
      'od-IN': '🌱 *AgriSeva-AI କୃଷି ପରାମର୍ଶ*',
      'en-IN': '🌱 *AgriSeva-AI Advisory*',
    };


    const header = headerPrefixes[currentLang] || headerPrefixes['en-IN'];
    const footerTip = footerTips[currentLang] || footerTips['en-IN'];
    const displayName = getLanguageDisplayName(currentLang);

    const formattedMessage = `${header}\n\n${finalLocalizedAnswer}\n\n━━━━━━━━━━━━━━━━\n_🌾 AgriSeva-AI • ${displayName}_\n_${footerTip}_`;

    // Step 9: Outbound Message Dispatch
    await this.sendTextMessage(from, targetPhoneId, formattedMessage);

    // Step 10: Persist Conversation Session History (up to 200 items for rich dashboard history)
    session.history = session.history || [];
    session.history.push({
      role: 'user',
      content: userQuery,
      timestamp: new Date(),
      msgType: extra?.msgType || (audioDataUrl ? 'audio' : 'text'),
      mediaUrl: audioDataUrl,
    });
    session.history.push({
      role: 'assistant',
      content: finalLocalizedAnswer,
      timestamp: new Date(),
    });

    if (session.history.length > 200) {
      session.history = session.history.slice(-200);
    }
    session.lastMessageAt = new Date();
    session.updatedAt = new Date();

    await sessionsCol.updateOne({ phoneNumber: canonicalPhone }, { $set: session }, { upsert: true });

    // Step 11: Persist to "All Questions" pipeline (source: WHATSAPP)
    // Ensures questions asked via WhatsApp reliably appear in All Questions with complete metadata
    try {
      const questionsCol = await this.mongoDatabase.getCollection('questions');
      const msgId = extra?.msgId || `wa_${canonicalPhone}_${Date.now()}`;
      const existingQ = await questionsCol.findOne({
        $or: [{ messageId: msgId }, { $and: [{ threadId: canonicalPhone }, { question: userQuery }] }],
      });

      if (!existingQ) {
        const qId = new ObjectId();
        const userObjId = session.userId ? new ObjectId(session.userId.toString()) : undefined;

        // Extract crop / domain if possible
        const rawDetails = (session as any).farmerDetails || {};
        let state = (rawDetails.state || '').trim();
        let district = (rawDetails.district || '').trim();
        let crop = (rawDetails.crop || '').trim();
        let domains: string[] = [];

        if (!crop) {
          const knownCrops = [
            'Tomato', 'Paddy', 'Rice', 'Wheat', 'Cotton', 'Chilli', 'Chilli / Mirchi',
            'Onion', 'Potato', 'Maize', 'Soyabean', 'Groundnut', 'Bengal Gram',
            'Sugarcane', 'Turmeric', 'Banana', 'Mango', 'Mustard', 'Gram', 'Pulses'
          ];
          const lower = userQuery.toLowerCase();
          const matched = knownCrops.find(c => lower.includes(c.toLowerCase()));
          if (matched) crop = matched;
        }

        const lowerQ = userQuery.toLowerCase();
        if (/(yellow|leaf|leaves|curl|spot|rot|blight|wilt|fungus|disease|virus|బాధ|తెగులు|వ్యాధి|रोग|धब्बा|कीट)/i.test(lowerQ)) {
          domains = ['Disease Management'];
        } else if (/(pest|worm|caterpillar|borer|insect|aphid|spray|pesticide|పురుగు|కీటకం|कीड़ा|कीटनाशक)/i.test(lowerQ)) {
          domains = ['Insect - Pest Management'];
        } else if (/(price|mandi|rate|cost|msp|market|ధర|రేటు|మండి|भाव|दाम|कीमत)/i.test(lowerQ)) {
          domains = ['Market Prices, MSP & Marketing'];
        } else if (/(water|drip|irrigate|irrigation|నీరు|నీటి|सिंचाई|पानी)/i.test(lowerQ)) {
          domains = ['Irrigation and Water Management'];
        } else if (/(soil|urea|fertilizer|npk|zinc|nitrogen|ఎరువు|యూరియా|खाद|उर्वरक)/i.test(lowerQ)) {
          domains = ['Soil Health and Nutrient Management'];
        } else {
          domains = ['Cultural and Crop Management Practices'];
        }

        await questionsCol.insertOne({
          _id: qId,
          userId: userObjId,
          question: userQuery,
          originalQuestion: userQuery,
          status: 'open',
          source: 'WHATSAPP',
          messageId: msgId,
          threadId: canonicalPhone,
          totalAnswersCount: 1,
          isAutoAllocate: false,
          autoAllocateGateKeeper: true,
          autoAllocateAuditor: true,
          autoAllocateModerator: true,
          embedding: [],
          metrics: null,
          priority: 'medium',
          details: { state, district, crop, season: '', domain: domains },
          language: currentLang,
          detectedLanguage: currentLang,
          aiInitialAnswer: finalLocalizedAnswer,
          mediaUrl: audioDataUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const submissionsCol = await this.mongoDatabase.getCollection('question_submissions');
        await submissionsCol.insertOne({
          questionId: qId,
          lastRespondedBy: null,
          history: [],
          queue: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        console.log(`[WhatsAppService] Persisted WhatsApp question (id: ${qId}, msgId: ${msgId}, userId: ${session.userId})`);
      }
    } catch (qErr: any) {
      console.warn('[WhatsAppService] Could not persist question to questions collection:', qErr.message);
    }

    console.log(`[WhatsAppService] Successfully completed request for ${from} in ${currentLang}`);
  }
}
