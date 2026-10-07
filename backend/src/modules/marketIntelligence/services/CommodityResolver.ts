/**
 * CommodityResolver — maps user-supplied crop / commodity strings
 * (across all Indian languages) to canonical names persisted in `market_prices`.
 *
 * Safety rules:
 *   1. Multilingual dictionary matches exact crop words/stems across Telugu,
 *      Hindi, Tamil, Kannada, Marathi, Gujarati, Punjabi, Bengali, Odia, English.
 *   2. Extracts the ACTUAL crop asked by the user; NEVER defaults to Tomato!
 *   3. If confidence is insufficient or no commodity is found, returns null so
 *      callers can honestly prompt the user for clarification.
 */

import {inject, injectable, optional} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {CommodityAliasRepository} from '../repositories/CommodityAliasRepository.js';

export interface CommodityResolverResult {
  /** Original (trimmed) input. */
  input: string;
  /** De-duplicated list of canonical candidates (input + aliases). */
  candidates: string[];
  /** True iff an alias hit added at least one extra canonical. */
  matchedAlias: boolean;
}

export interface ExtractedCommodity {
  canonical: string;
  matched: string;
  candidates: string[];
}

export interface CommodityMasterEntry {
  canonical: string;
  agmarknetCanonical: string;
  aliases: string[];
}

export const MULTILINGUAL_COMMODITY_MASTER: CommodityMasterEntry[] = [
  {
    canonical: 'Tomato',
    agmarknetCanonical: 'Tomato',
    aliases: [
      'tomato', 'tomatoes', 'tamatar', 'tomata', 'thakkali',
      'టమోటా', 'టమాట', 'తక్కాళి',
      'टमाटर', 'टोमॅटो',
      'தக்காளி',
      'ಟೊಮೆಟೊ', 'ತೊಮೇಟೊ',
      'টমেটো', 'ટામેટા', 'ਟਮਾਟਰ', 'ଟମାଟୋ'
    ],
  },
  {
    canonical: 'Onion',
    agmarknetCanonical: 'Onion',
    aliases: [
      'onion', 'onions', 'pyaaz', 'pyaz', 'kanda', 'ulli', 'vengayam', 'eerulli',
      'ఉల్లి', 'ఉల్లిపాయ', 'ఉల్లిగడ్డ',
      'प्याज', 'कांदा',
      'வெங்காயம்',
      'ಈರುಳ್ಳಿ',
      'পেঁয়াজ', 'ડુંગળી', 'ਪਿਆਜ਼', 'ପିଆଜ'
    ],
  },
  {
    canonical: 'Potato',
    agmarknetCanonical: 'Potato',
    aliases: [
      'potato', 'potatoes', 'aloo', 'alu', 'batata', 'urulaikilangu', 'bangaladumpa',
      'బంగాళదుంప', 'ఆలూ', 'ఆలుగడ్డ',
      'आलू', 'बटाटा',
      'உருளைக்கிழங்கு',
      'ಆಲೂಗಡ್ಡೆ', 'ಆಲೂ',
      'আলু', 'બટાકા', 'ਆਲੂ', 'ଆଳୁ'
    ],
  },
  {
    canonical: 'Chilli',
    agmarknetCanonical: 'Chilli',
    aliases: [
      'chilli', 'chillies', 'chili', 'mirchi', 'mirapa', 'milagai', 'menasinakayi', 'green chilli', 'red chilli',
      'మిరప', 'మిరపకాయ', 'మిర్చి',
      'मिर्च', 'हरी मिर्च', 'लाल मिर्च', 'काळी मिर्ची',
      'மிளகாய்', 'பச்சை மிளகாய்',
      'ಮೆಣಸಿನಕಾಯಿ', 'ಖಾರ',
      'লঙ্কা', 'મરચાં', 'ਮਿਰਚ', 'ଲଙ୍କା'
    ],
  },
  {
    canonical: 'Cotton',
    agmarknetCanonical: 'Cotton',
    aliases: [
      'cotton', 'kapas', 'patti', 'paruthi', 'hatti',
      'పత్తి',
      'कपास', 'कापूस',
      'பருத்தி',
      'ಹತ್ತಿ',
      'তুলা', 'કપાસ', 'ਕਪਾਹ', 'କପା'
    ],
  },
  {
    canonical: 'Paddy',
    agmarknetCanonical: 'Paddy(Common)',
    aliases: [
      'paddy', 'rice', 'dhan', 'chawal', 'vari', 'biyyam', 'nellu', 'arisi', 'bhatta', 'paddy(common)',
      'వరి', 'బియ్యం', 'వడ్లు',
      'धान', 'चावल', 'भात', 'तांदूळ',
      'நெல்', 'அரிசி',
      'ಭತ್ತ', 'ಅಕ್ಕಿ',
      'ধান', 'চাল', 'ડાંગર', 'ચોખા', 'ਝੋਨਾ', 'ਚੌਲ', 'ଧାନ', 'ଚାଉଳ'
    ],
  },
  {
    canonical: 'Wheat',
    agmarknetCanonical: 'Wheat',
    aliases: [
      'wheat', 'gehun', 'gahu', 'godhuma', 'godhumai', 'godhi',
      'గోధుమ', 'గోధుమలు',
      'गेहूं', 'गहू',
      'கோதுமை',
      'ಗೋಧಿ',
      'গম', 'ઘઉં', 'ਕਣਕ', 'ଗହମ'
    ],
  },
  {
    canonical: 'Maize',
    agmarknetCanonical: 'Maize',
    aliases: [
      'maize', 'corn', 'makka', 'bhutta', 'mokkajonna', 'makki',
      'మొక్కజొన్న', 'జొన్న మొక్క',
      'मक्का', 'मका', 'भुट्टा',
      'மக்காச்சோளம்',
      'ಮೆಕ್ಕೆಜೋಳ',
      'ভুট্টা', 'મકાઈ', 'ਮੱਕੀ', 'ମକା'
    ],
  },
  {
    canonical: 'Groundnut',
    agmarknetCanonical: 'Groundnut',
    aliases: [
      'groundnut', 'peanut', 'mungfali', 'verusenaga', 'kadalai', 'kadalekayi', 'bhuimug',
      'వేరుశనగ', 'పల్లీ',
      'मूंगफली', 'भुईमूग',
      'நிலக்கடலை', 'வேர்க்கடலை',
      'ಕಡಲೆಕಾಯಿ', 'ಶೇಂಗಾ',
      'চিনাবাদাম', 'મગફળી', 'ਮੂੰਗਫਲੀ', 'ଚିନାବାଦାମ'
    ],
  },
  {
    canonical: 'Soyabean',
    agmarknetCanonical: 'Soyabean',
    aliases: [
      'soyabean', 'soybean', 'soya',
      'సోయాబీన్', 'సోయా',
      'सोयाबीन',
      'சோயாபீன்',
      'ಸೋಯಾಬೀನ್',
      'সয়াবিন', 'સોયાબીન', 'ਸੋਇਆਬੀਨ', 'ସୋୟାବିନ୍'
    ],
  },
  {
    canonical: 'Turmeric',
    agmarknetCanonical: 'Turmeric',
    aliases: [
      'turmeric', 'haldi', 'pasupu', 'manjal', 'arishina',
      'పసుపు',
      'हल्दी', 'हळद',
      'மஞ்சள்',
      'ಅರಿಶಿನ',
      'হলুদ', 'હળદર', 'ਹਲਦੀ', 'ହଳଦୀ'
    ],
  },
  {
    canonical: 'Bajra',
    agmarknetCanonical: 'Bajra(Pearl Millet/Cumbu)',
    aliases: [
      'bajra', 'pearl millet', 'sajjalu', 'kambu', 'sajje', 'bajri', 'bajra(pearl millet/cumbu)',
      'సజ్జలు', 'సజ్జ',
      'बाजरा', 'बाजरी',
      'கம்பு',
      'ಸಜ್ಜೆ',
      'বাজরা', 'બાજરી', 'ਬਾਜਰਾ', 'ବାଜରା'
    ],
  },
  {
    canonical: 'Jowar',
    agmarknetCanonical: 'Jowar(Sorghum)',
    aliases: [
      'jowar', 'sorghum', 'jonnalu', 'cholam', 'jola', 'jowar(sorghum)',
      'జొన్నలు', 'జొన్న',
      'ज्वार', 'ज्वारी',
      'சோளம்',
      'ಜೋಳ',
      'জোয়ার', 'જુવાર', 'ਜਵਾਰ', 'ଜୁଆର'
    ],
  },
  {
    canonical: 'Bengal Gram',
    agmarknetCanonical: 'Bengal Gram(Gram)(Whole)',
    aliases: [
      'bengal gram', 'chana', 'gram', 'senagalu', 'kondakadalai', 'kadale', 'harbhara', 'bengal gram(gram)(whole)',
      'శనగలు', 'శనగ',
      'चना', 'हरभरा',
      'கொண்டைக்கடலை',
      'ಕಡಲೆ',
      'ছোলা', 'ચણા', 'ਛੋਲੇ', 'ବୁଟ'
    ],
  },
  {
    canonical: 'Red Gram',
    agmarknetCanonical: 'Red gram/Arhar/Tur(whole)',
    aliases: [
      'red gram', 'tur', 'arhar', 'pigeon pea', 'kandulu', 'thuvarai', 'togari', 'toor dal', 'red gram/arhar/tur(whole)',
      'కందులు', 'కంది',
      'अरहर', 'तूर',
      'துவரை',
      'ತೊಗರಿ',
      'অড়হর', 'તુવેર', 'ਅਰਹਰ', 'ହରଡ଼'
    ],
  },
  {
    canonical: 'Black Gram',
    agmarknetCanonical: 'Black Gram(Urd Beans)(Whole)',
    aliases: [
      'black gram', 'urad', 'minumulu', 'ulundu', 'uddu', 'black gram(urd beans)(whole)',
      'మినుములు', 'మినుము',
      'उड़द', 'उडद',
      'உளுந்து',
      'ಉದ್ದು',
      'মাষকলাই', 'અડદ', 'ਮਾਂਹ', 'ବିରି'
    ],
  },
  {
    canonical: 'Green Gram',
    agmarknetCanonical: 'Green Gram(Moong)(Whole)',
    aliases: [
      'green gram', 'moong', 'pesalu', 'pasi payaru', 'hesarukaalu', 'mung', 'green gram(moong)(whole)',
      'పెసలు', 'పెసర',
      'मूंग', 'मूग',
      'பாசிப்பயறு',
      'ಹೆಸರುಕಾಳು',
      'মুগ', 'મગ', 'ਮੂੰਗੀ', 'ମୁଗ'
    ],
  },
  {
    canonical: 'Mustard',
    agmarknetCanonical: 'Mustard',
    aliases: [
      'mustard', 'sarson', 'avalu', 'kadugu', 'sasive', 'mohari', 'rai',
      'ఆవాలు',
      'सरसों', 'राई', 'मोहरी',
      'கடுகு',
      'ಸಾಸಿವೆ',
      'সরিষা', 'રાઈ', 'ਸਰ੍ਹੋਂ', 'ସୋରିଷ'
    ],
  },
  {
    canonical: 'Garlic',
    agmarknetCanonical: 'Garlic',
    aliases: [
      'garlic', 'lahsun', 'vellulli', 'poondu', 'bellulli', 'lasun',
      'వెల్లుల్లి',
      'लहसुन', 'लसूण',
      'பூண்டு',
      'ಬೆಳ್ಳುಳ್ಳಿ',
      'রসুন', 'લસણ', 'ਲਸਣ', 'ରସୁଣ'
    ],
  },
  {
    canonical: 'Ginger',
    agmarknetCanonical: 'Ginger',
    aliases: [
      'ginger', 'adrak', 'allam', 'inji', 'shunti', 'ale',
      'అల్లం',
      'अदरक', 'आले',
      'இஞ்சி',
      'ಶುಂಠಿ',
      'আদা', 'આદુ', 'ਅਦਰਕ', 'ଅଦା'
    ],
  },
  {
    canonical: 'Brinjal',
    agmarknetCanonical: 'Brinjal',
    aliases: [
      'brinjal', 'eggplant', 'vankaya', 'baingan', 'kathirikai', 'badanekayi', 'vangi',
      'వంకాయ',
      'बैंगन', 'वांगी',
      'கத்தரிக்காய்',
      'ಬದನೆಕಾಯಿ',
      'বেগুন', 'રીંગણા', 'ਬੈਂਗਣ', 'ବାଇଗଣ'
    ],
  },
];

@injectable()
export class CommodityResolver {
  constructor(
    @inject(GLOBAL_TYPES.CommodityAliasRepository)
    @optional()
    private readonly aliasRepo?: CommodityAliasRepository,
  ) {}

  /**
   * Extract commodity from user natural language query in any Indian language.
   * Returns null if no crop is explicitly identified.
   */
  public extractCommodity(text: string): ExtractedCommodity | null {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();

    for (const entry of MULTILINGUAL_COMMODITY_MASTER) {
      for (const alias of entry.aliases) {
        const aLower = alias.toLowerCase();
        // Check for non-latin script substring or latin word boundary
        const isNonLatin = /[\u0900-\u0D7F]/.test(aLower);
        if (isNonLatin) {
          if (lower.includes(aLower)) {
            return {
              canonical: entry.canonical,
              matched: alias,
              candidates: Array.from(new Set([entry.canonical, entry.agmarknetCanonical, alias])),
            };
          }
        } else {
          const escaped = aLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(^|\\b|\\s)${escaped}(\\b|\\s|$)`, 'i');
          if (regex.test(lower)) {
            return {
              canonical: entry.canonical,
              matched: alias,
              candidates: Array.from(new Set([entry.canonical, entry.agmarknetCanonical, alias])),
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Resolve a user-supplied commodity string to canonical candidates.
   */
  public async resolve(input: string | undefined | null): Promise<CommodityResolverResult> {
    const trimmed = (input ?? '').trim();
    if (!trimmed) {
      return {input: '', candidates: [], matchedAlias: false};
    }

    const candidates = this.aliasRepo
      ? await this.aliasRepo.resolveCanonical(trimmed)
      : [trimmed];

    const matchedAlias =
      candidates.length > 1 ||
      (candidates.length === 1 &&
        candidates[0].toLowerCase() !== trimmed.toLowerCase());

    return {input: trimmed, candidates, matchedAlias};
  }

  /**
   * Pure helper: extract base name from parenthetical canonical string.
   */
  public static extractBaseName(canonical: string | undefined | null): string | undefined {
    if (!canonical) return undefined;
    const trimmed = canonical.trim();
    if (!trimmed) return undefined;
    const open = trimmed.indexOf('(');
    if (open < 0) return trimmed;
    const base = trimmed.slice(0, open).trim();
    if (base.length === 0) return undefined;
    return base;
  }
}
