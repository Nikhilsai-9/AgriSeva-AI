/**
 * LocationResolver — extracts and normalises Indian States, Districts, and Mandis
 * from user query text and filters.
 *
 * Ground truth: Official Government of India / Agmarknet states and mandis.
 * Never defaults to Maharashtra or Tamil Nadu.
 */

import { injectable } from 'inversify';

export interface ExtractedLocation {
  state?: string;
  district?: string;
  market?: string;
  confidence: 'exact' | 'alias' | 'none';
}

interface StateDefinition {
  canonical: string;
  aliases: string[];
}

interface MarketDefinition {
  canonical: string;
  state: string;
  district?: string;
  aliases: string[];
}

const INDIAN_STATES_MASTER: StateDefinition[] = [
  { canonical: 'Andhra Pradesh', aliases: ['andhra pradesh', 'andhra', 'ap', 'ఆంధ్రప్రదేశ్', 'ఆంధ్ర', 'आंध्र प्रदेश', 'ஆந்திரா'] },
  { canonical: 'Arunachal Pradesh', aliases: ['arunachal pradesh', 'arunachal', 'अरुणाचल प्रदेश'] },
  { canonical: 'Assam', aliases: ['assam', 'asom', 'असम', 'অসম'] },
  { canonical: 'Bihar', aliases: ['bihar', 'बिहार', 'বিহার'] },
  { canonical: 'Chhattisgarh', aliases: ['chhattisgarh', 'chattisgarh', 'छत्तीसगढ़'] },
  { canonical: 'Goa', aliases: ['goa', 'गोवा'] },
  { canonical: 'Gujarat', aliases: ['gujarat', 'गुजरात', 'ગુજરાત'] },
  { canonical: 'Haryana', aliases: ['haryana', 'हरियाणा', 'ਹਰਿਆਣਾ'] },
  { canonical: 'Himachal Pradesh', aliases: ['himachal pradesh', 'himachal', 'hp', 'हिमाचल प्रदेश'] },
  { canonical: 'Jharkhand', aliases: ['jharkhand', 'झारखंड'] },
  { canonical: 'Karnataka', aliases: ['karnataka', 'kar', 'ka', 'ಕರ್ನಾಟಕ', 'కర్ణాటక', 'कर्नाटक', 'கர்நாடகா'] },
  { canonical: 'Kerala', aliases: ['kerala', 'കേരളം', 'केरल', 'கேரளா'] },
  { canonical: 'Madhya Pradesh', aliases: ['madhya pradesh', 'mp', 'मध्य प्रदेश'] },
  { canonical: 'Maharashtra', aliases: ['maharashtra', 'mh', 'महाराष्ट्र', 'மகாராஷ்டிரா', 'మహారాష్ట్ర'] },
  { canonical: 'Manipur', aliases: ['manipur', 'मणिपुर'] },
  { canonical: 'Meghalaya', aliases: ['meghalaya', 'मेघालय'] },
  { canonical: 'Mizoram', aliases: ['mizoram', 'मिजोरम'] },
  { canonical: 'Nagaland', aliases: ['nagaland', 'नागालैंड'] },
  { canonical: 'Odisha', aliases: ['odisha', 'orissa', 'ଓଡ଼ିଶା', 'ओडिशा'] },
  { canonical: 'Punjab', aliases: ['punjab', 'pb', 'पंजाब', 'ਪੰਜਾਬ'] },
  { canonical: 'Rajasthan', aliases: ['rajasthan', 'raj', 'राजस्थान'] },
  { canonical: 'Sikkim', aliases: ['sikkim', 'सिक्किम'] },
  { canonical: 'Tamil Nadu', aliases: ['tamil nadu', 'tamilnadu', 'tn', 'தமிழ்நாடு', 'तमिलनाडु', 'తమిళనాడు'] },
  { canonical: 'Telangana', aliases: ['telangana', 'ts', 'tg', 'తెలంగాణ', 'तेलंगाना'] },
  { canonical: 'Tripura', aliases: ['tripura', 'त्रिपुरा'] },
  { canonical: 'Uttar Pradesh', aliases: ['uttar pradesh', 'up', 'उत्तर प्रदेश'] },
  { canonical: 'Uttarakhand', aliases: ['uttarakhand', 'uttaranchal', 'उत्तराखंड'] },
  { canonical: 'West Bengal', aliases: ['west bengal', 'bengal', 'wb', 'पश्चिम बंगाल', 'পশ্চিমবঙ্গ'] },
  { canonical: 'Delhi', aliases: ['delhi', 'nct delhi', 'दिल्ली'] },
  { canonical: 'Jammu and Kashmir', aliases: ['jammu and kashmir', 'jammu', 'kashmir', 'j&k', 'जम्मू और कश्मीर'] },
  { canonical: 'Ladakh', aliases: ['ladakh', 'लद्दाख'] },
  { canonical: 'Puducherry', aliases: ['puducherry', 'pondicherry', 'புதுச்சேரி'] },
  { canonical: 'Chandigarh', aliases: ['chandigarh', 'चंडीगढ़'] },
];

const PROMINENT_MANDIS: MarketDefinition[] = [
  // Tamil Nadu
  { canonical: 'Thoothukudi APMC', state: 'Tamil Nadu', district: 'Thoothukudi', aliases: ['thoothukudi', 'tuticorin', 'தூத்துக்குடி', 'తూత్తుకుడి'] },
  { canonical: 'Tuticorin(Uzhavar Sandhai )', state: 'Tamil Nadu', district: 'Thoothukudi', aliases: ['tuticorin uzhavar', 'thoothukudi uzhavar sandhai'] },
  { canonical: 'Erode APMC', state: 'Tamil Nadu', district: 'Erode', aliases: ['erode', 'ஈரோடு', 'ఈరోడ్'] },
  { canonical: 'Coimbatore APMC', state: 'Tamil Nadu', district: 'Coimbatore', aliases: ['coimbatore', 'kovai', 'கோயம்புத்தூர்', 'కోయంబత్తూరు'] },
  { canonical: 'Madurai APMC', state: 'Tamil Nadu', district: 'Madurai', aliases: ['madurai', 'மதுரை'] },
  { canonical: 'Tirunelveli APMC', state: 'Tamil Nadu', district: 'Tirunelveli', aliases: ['tirunelveli', 'nellai', 'திருநெல்வேலி'] },

  // Maharashtra
  { canonical: 'APMC Lasalgaon', state: 'Maharashtra', district: 'Nashik', aliases: ['lasalgaon', 'lasalgaon mandi', 'लासलगाव', 'लासलगांव', 'లాసల్‌గావ్'] },
  { canonical: 'Pune APMC', state: 'Maharashtra', district: 'Pune', aliases: ['pune', 'poona', 'पुणे', 'పుణె'] },
  { canonical: 'Nashik APMC', state: 'Maharashtra', district: 'Nashik', aliases: ['nashik', 'nasik', 'नासिक', 'नाशिक'] },
  { canonical: 'Nagpur APMC', state: 'Maharashtra', district: 'Nagpur', aliases: ['nagpur', 'नागपुर'] },
  { canonical: 'Akola APMC', state: 'Maharashtra', district: 'Akola', aliases: ['akola', 'अकोला'] },
  { canonical: 'Solapur APMC', state: 'Maharashtra', district: 'Solapur', aliases: ['solapur', 'sholapur', 'सोलापूर'] },

  // Karnataka
  { canonical: 'Kolar APMC', state: 'Karnataka', district: 'Kolar', aliases: ['kolar', 'kolar mandi', 'ಕೋಲಾರ', 'कोलार', 'కోలార్'] },
  { canonical: 'Bangalore APMC', state: 'Karnataka', district: 'Bangalore Urban', aliases: ['bangalore', 'bengaluru', 'ಬೆಂಗಳೂರು', 'बैंगलोर', 'బెంగళూరు'] },
  { canonical: 'Mysore APMC', state: 'Karnataka', district: 'Mysore', aliases: ['mysore', 'mysuru', 'ಮೈಸೂರು'] },
  { canonical: 'Davangere APMC', state: 'Karnataka', district: 'Davangere', aliases: ['davangere', 'ದಾವಣಗೆರೆ'] },
  { canonical: 'Belgaum APMC', state: 'Karnataka', district: 'Belgaum', aliases: ['belgaum', 'belagavi', 'ಬೆಳಗಾವಿ'] },

  // Andhra Pradesh
  { canonical: 'Kurnool APMC', state: 'Andhra Pradesh', district: 'Kurnool', aliases: ['kurnool', 'కర్నూలు', 'कुर्नूल'] },
  { canonical: 'Guntur APMC', state: 'Andhra Pradesh', district: 'Guntur', aliases: ['guntur', 'గుంటూరు', 'गुंटूर'] },
  { canonical: 'Madanapalle APMC', state: 'Andhra Pradesh', district: 'Chittoor', aliases: ['madanapalle', 'madanapalli', 'మదనపల్లె', 'मदनपल्ले'] },
  { canonical: 'Vijayawada APMC', state: 'Andhra Pradesh', district: 'Krishna', aliases: ['vijayawada', 'bezawada', 'విజయవాడ'] },
  { canonical: 'Tirupati APMC', state: 'Andhra Pradesh', district: 'Chittoor', aliases: ['tirupati', 'తిరుపతి'] },

  // Telangana
  { canonical: 'Warangal APMC', state: 'Telangana', district: 'Warangal', aliases: ['warangal', 'వరంగల్'] },
  { canonical: 'Nizamabad APMC', state: 'Telangana', district: 'Nizamabad', aliases: ['nizamabad', 'నిజామాబాద్'] },
  { canonical: 'Khammam APMC', state: 'Telangana', district: 'Khammam', aliases: ['khammam', 'ఖమ్మం'] },
  { canonical: 'Bowenpally APMC', state: 'Telangana', district: 'Hyderabad', aliases: ['bowenpally', 'hyderabad mandi'] },

  // Gujarat
  { canonical: 'Rajkot APMC', state: 'Gujarat', district: 'Rajkot', aliases: ['rajkot', 'રાજકોટ', 'राजकोट'] },
  { canonical: 'Ahmedabad APMC', state: 'Gujarat', district: 'Ahmedabad', aliases: ['ahmedabad', 'अहमदाबाद', 'અમદાવાદ'] },
  { canonical: 'Surat APMC', state: 'Gujarat', district: 'Surat', aliases: ['surat', 'સુરત'] },

  // Madhya Pradesh
  { canonical: 'Indore APMC', state: 'Madhya Pradesh', district: 'Indore', aliases: ['indore', 'इन्दौर', 'इंदौर'] },
  { canonical: 'Ujjain APMC', state: 'Madhya Pradesh', district: 'Ujjain', aliases: ['ujjain', 'उज्जैन'] },
  { canonical: 'Bhopal APMC', state: 'Madhya Pradesh', district: 'Bhopal', aliases: ['bhopal', 'भोपाल'] },

  // Rajasthan
  { canonical: 'Jaipur (Grain) APMC', state: 'Rajasthan', district: 'Jaipur', aliases: ['jaipur', 'जयपुर'] },
  { canonical: 'Kota APMC', state: 'Rajasthan', district: 'Kota', aliases: ['kota', 'कोटा'] },
  { canonical: 'Jodhpur APMC', state: 'Rajasthan', district: 'Jodhpur', aliases: ['jodhpur', 'जोधपुर'] },

  // Delhi / North
  { canonical: 'Azadpur Mandi', state: 'Delhi', district: 'North Delhi', aliases: ['azadpur', 'आजादपुर'] },
  { canonical: 'Karnal APMC', state: 'Haryana', district: 'Karnal', aliases: ['karnal', 'करनाल'] },
  { canonical: 'Khanna APMC', state: 'Punjab', district: 'Ludhiana', aliases: ['khanna', 'खन्ना'] },
];

@injectable()
export class LocationResolver {
  /**
   * Extract state, district, or market from free-text query.
   * Never defaults to any state when absent.
   */
  public extractLocation(query: string): ExtractedLocation {
    if (!query || typeof query !== 'string') {
      return { confidence: 'none' };
    }

    const lower = query.toLowerCase();

    // 1. Check for prominent mandis first (most specific)
    for (const m of PROMINENT_MANDIS) {
      if (m.aliases.some((a) => lower.includes(a.toLowerCase()))) {
        return {
          market: m.canonical,
          district: m.district,
          state: m.state,
          confidence: 'exact',
        };
      }
    }

    // 2. Check for states
    for (const s of INDIAN_STATES_MASTER) {
      if (s.aliases.some((a) => {
        // Match word boundaries or exact substring for regional scripts
        const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|\\b|\\s)${escaped}(\\b|\\s|$)`, 'i').test(lower) || lower.includes(a.toLowerCase());
      })) {
        return {
          state: s.canonical,
          confidence: 'exact',
        };
      }
    }

    return { confidence: 'none' };
  }

  /**
   * Resolve an explicit state name or alias into its canonical form.
   */
  public resolveState(input?: string | null): string | undefined {
    if (!input) return undefined;
    const trimmed = input.trim().toLowerCase();
    const match = INDIAN_STATES_MASTER.find((s) =>
      s.canonical.toLowerCase() === trimmed || s.aliases.some((a) => a.toLowerCase() === trimmed)
    );
    return match ? match.canonical : input.trim();
  }

  /**
   * Return all canonical Indian States and UTs.
   */
  public getAllStates(): string[] {
    return INDIAN_STATES_MASTER.map((s) => s.canonical);
  }
}
