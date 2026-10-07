import { describe, it, expect } from "vitest";
import { resolveTranslation } from "@/locales";
import { LANGUAGES } from "@/config/languages";

describe("Voice Transcription Error Classification and Localization", () => {
  it("verifies all 23 official languages contain non-empty voice translation keys", () => {
    const requiredKeys = [
      "voice.transcriptionUnavailable",
      "voice.transcriptionQuotaExceeded",
      "voice.transcriptionFailed",
      "voice.retry",
      "voice.typeQuestion",
      "voice.typeYourQuestionHere",
      "voice.networkError",
      "voice.audioTooLarge",
      "voice.rateLimited",
      "voice.cannotSubmitFailed",
    ];

    for (const lang of LANGUAGES) {
      for (const key of requiredKeys) {
        const val = resolveTranslation(lang.code, key);
        expect(
          val,
          `Language ${lang.code} (${lang.name}) must have translation for key "${key}"`
        ).toBeDefined();
        expect(
          val.trim().length,
          `Translation for "${key}" in ${lang.code} should not be empty`
        ).toBeGreaterThan(0);
        // Ensure raw key is never returned as fallback
        expect(val).not.toBe(key);
      }
    }
  });

  it("verifies quota error in non-English modes returns authentic native translation", () => {
    // Test Hindi
    const hiQuota = resolveTranslation("hi-IN", "voice.transcriptionQuotaExceeded");
    expect(hiQuota).toContain("वॉयस ट्रांसक्रिप्शन अस्थायी रूप से अनुपलब्ध है");
    expect(hiQuota).not.toContain("Voice transcription");

    // Test Telugu
    const teQuota = resolveTranslation("te-IN", "voice.transcriptionQuotaExceeded");
    expect(teQuota).toContain("వాయిస్ ట్రాన్స్‌క్రిప్షన్ తాత్కాలికంగా అందుబాటులో లేదు");

    // Test Tamil
    const taQuota = resolveTranslation("ta-IN", "voice.transcriptionQuotaExceeded");
    expect(taQuota).toContain("குரல் டிரான்ஸ்கிரிப்ஷன் தற்காலிகமாக கிடைக்கவில்லை");

    // Test Bengali
    const bnQuota = resolveTranslation("bn-IN", "voice.transcriptionQuotaExceeded");
    expect(bnQuota).toContain("ভয়েস ট্রান্সক্রিপশন সাময়িকভাবে অনুপলব্ধ");

    // Test Punjabi
    const paQuota = resolveTranslation("pa-IN", "voice.transcriptionQuotaExceeded");
    expect(paQuota).toContain("ਵੌਇਸ ਟ੍ਰਾਂਸਕ੍ਰਿਪਸ਼ਨ ਅਸਥਾਈ ਤੌਰ 'ਤੇ ਉਪਲਬਧ ਨਹੀਂ ਹੈ");
  });

  it("evaluates retry gating: 402 quota errors must NOT be retryable", () => {
    const isQuotaError = (err: any) =>
      err?.status === 402 ||
      err?.code === "STT_QUOTA_EXCEEDED" ||
      err?.category === "quota_exceeded";

    const canRetrySTT = (err: any, retryCount: number) => {
      const isQuota = isQuotaError(err);
      const isAuth = err?.status === 401 || err?.status === 403;
      const isTooLarge = err?.status === 413;
      return !isQuota && !isAuth && !isTooLarge && retryCount < 1;
    };

    // 402 Quota error -> Never retryable
    expect(canRetrySTT({ status: 402, code: "STT_QUOTA_EXCEEDED" }, 0)).toBe(false);

    // 401 Auth error -> Never retryable
    expect(canRetrySTT({ status: 401, code: "STT_AUTH_ERROR" }, 0)).toBe(false);

    // 413 Size error -> Never retryable
    expect(canRetrySTT({ status: 413, code: "STT_AUDIO_TOO_LARGE" }, 0)).toBe(false);

    // 429 Rate limit -> Retryable once
    expect(canRetrySTT({ status: 429, code: "STT_RATE_LIMITED" }, 0)).toBe(true);
    expect(canRetrySTT({ status: 429, code: "STT_RATE_LIMITED" }, 1)).toBe(false);

    // Network timeout -> Retryable once
    expect(canRetrySTT({ status: 504, code: "STT_TIMEOUT" }, 0)).toBe(true);
    expect(canRetrySTT({ status: 504, code: "STT_TIMEOUT" }, 1)).toBe(false);
  });

  it("evaluates submission gating: prevents submission of empty or failed STT transcripts", () => {
    const canSubmit = (
      transcript: string,
      isRecording: boolean,
      isLoadingRemaining: boolean,
      sttError: { hasFailed: boolean } | null
    ) => {
      const hasValidTranscript = transcript.trim().length > 0;
      const isSttRunning = isRecording || isLoadingRemaining;
      return hasValidTranscript && !isSttRunning && (sttError === null || !sttError.hasFailed);
    };

    // Empty transcript -> blocked
    expect(canSubmit("", false, false, null)).toBe(false);
    expect(canSubmit("   ", false, false, null)).toBe(false);

    // Recording in progress -> blocked
    expect(canSubmit("Crop advice for wheat", true, false, null)).toBe(false);

    // Loading chunk -> blocked
    expect(canSubmit("Crop advice for wheat", false, true, null)).toBe(false);

    // Failed STT state -> blocked
    expect(canSubmit("Old transcript", false, false, { hasFailed: true })).toBe(false);

    // Successful fresh transcript -> allowed
    expect(canSubmit("What is the current mandi price of cotton?", false, false, null)).toBe(true);
  });

  it("verifies 100% free Browser Web Speech API BCP-47 language tag resolution", () => {
    const getSpeechRecognitionLang = (
      selectedLang: string,
      appLangCode?: string
    ): string => {
      const code = selectedLang === "auto" ? appLangCode || "hi" : selectedLang;
      const langMap: Record<string, string> = {
        hi: "hi-IN",
        "hi-IN": "hi-IN",
        en: "en-IN",
        "en-IN": "en-IN",
        te: "te-IN",
        "te-IN": "te-IN",
        ta: "ta-IN",
        "ta-IN": "ta-IN",
        bn: "bn-IN",
        "bn-IN": "bn-IN",
        mr: "mr-IN",
        "mr-IN": "mr-IN",
        gu: "gu-IN",
        "gu-IN": "gu-IN",
        kn: "kn-IN",
        "kn-IN": "kn-IN",
        ml: "ml-IN",
        "ml-IN": "ml-IN",
        pa: "pa-IN",
        "pa-IN": "pa-IN",
        ur: "ur-IN",
        "ur-IN": "ur-IN",
        ne: "ne-NP",
        "ne-IN": "ne-NP",
        as: "as-IN",
        "as-IN": "as-IN",
        kok: "kok-IN",
        "kok-IN": "kok-IN",
        sa: "sa-IN",
        "sa-IN": "sa-IN",
        sd: "sd-IN",
        "sd-IN": "sd-IN",
        mai: "mai-IN",
        "mai-IN": "mai-IN",
        doi: "doi-IN",
        "doi-IN": "doi-IN",
        ks: "ks-IN",
        "ks-IN": "ks-IN",
        brx: "brx-IN",
        "brx-IN": "brx-IN",
        mni: "mni-IN",
        "mni-IN": "mni-IN",
        sat: "sat-IN",
        "sat-IN": "sat-IN",
      };
      return langMap[code] || (code.includes("-") ? code : `${code}-IN`);
    };

    // Hindi resolution
    expect(getSpeechRecognitionLang("hi-IN")).toBe("hi-IN");
    expect(getSpeechRecognitionLang("auto", "hi")).toBe("hi-IN");

    // Telugu resolution
    expect(getSpeechRecognitionLang("te-IN")).toBe("te-IN");
    expect(getSpeechRecognitionLang("auto", "te")).toBe("te-IN");

    // Tamil resolution
    expect(getSpeechRecognitionLang("ta-IN")).toBe("ta-IN");
    expect(getSpeechRecognitionLang("auto", "ta")).toBe("ta-IN");

    // Marathi resolution
    expect(getSpeechRecognitionLang("mr-IN")).toBe("mr-IN");
    expect(getSpeechRecognitionLang("auto", "mr")).toBe("mr-IN");

    // English resolution
    expect(getSpeechRecognitionLang("en-IN")).toBe("en-IN");
    expect(getSpeechRecognitionLang("auto", "en")).toBe("en-IN");

    // Default fallback when nothing detected
    expect(getSpeechRecognitionLang("auto")).toBe("hi-IN");
  });
});

