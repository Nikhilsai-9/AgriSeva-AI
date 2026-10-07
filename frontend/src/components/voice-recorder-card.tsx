import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Keyboard,
  Lightbulb,
  Loader2,
  Mic,
  MicOff,
  RefreshCw,
  RotateCcw,
  Send,
  Speech,
  User,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./atoms/card";
import { Badge } from "./atoms/badge";
import { Button } from "./atoms/button";
import { Textarea } from "./atoms/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./atoms/select";
import type { SupportedLanguage } from "@/types";
import { useSubmitTranscript } from "@/hooks/api/context/useSubmitTranscript";
import { ScrollArea, ScrollBar } from "./atoms/scroll-area";
import { Label } from "./atoms/label";
import { useGenerateQuestion } from "@/hooks/api/question/useGenerateQuestion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./atoms/accordion";
import { Skeleton } from "./atoms/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./atoms/tooltip";
import { useTranslation } from "@/locales";
import { useGetCurrentUser } from "@/hooks/api/user/useGetCurrentUser";

export interface GroundedSourceItem {
  type: string;
  id: string;
  title: string;
  reference: string;
  score?: number;
  metadata?: Record<string, any>;
}

export interface GeneratedQuestion {
  id: string;
  question: string;
  agri_specialist: string;
  answer: string;
  referenceSource: string;
  status?: string;
  confidence?: 'high' | 'medium' | 'low';
  sources?: GroundedSourceItem[];
  warnings?: string[];
  language?: string;
  generatedAt?: string;
  questionId?: string;
}

export interface GroundedSourceItem {
  type: string;
  id: string;
  title: string;
  reference: string;
  score?: number;
  metadata?: Record<string, any>;
}

export interface GeneratedQuestion {
  id: string;
  question: string;
  agri_specialist: string;
  answer: string;
  referenceSource: string;
  status?: string;
  confidence?: 'high' | 'medium' | 'low';
  sources?: GroundedSourceItem[];
  warnings?: string[];
  language?: string;
  generatedAt?: string;
  questionId?: string;
}

export interface SttErrorState {
  code: string;
  category: string;
  message: string;
  canRetry: boolean;
  hasFailed: boolean;
}

export interface VoiceRecorderCardProps {
  // No props needed - call transcript is only in CallInterface
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const supportedLanguages: {
  code: SupportedLanguage | "auto";
  label: string;
}[] = [
  { code: "auto", label: "Auto Detection" },
  { code: "en-IN", label: "English (India)" },
  { code: "hi-IN", label: "Hindi" },
  { code: "bn-IN", label: "Bengali" },
  { code: "te-IN", label: "Telugu" },
  { code: "mr-IN", label: "Marathi" },
  { code: "ta-IN", label: "Tamil" },
  { code: "gu-IN", label: "Gujarati" },
  { code: "kn-IN", label: "Kannada" },
  { code: "ml-IN", label: "Malayalam" },
  { code: "pa-IN", label: "Punjabi" },
  { code: "ur-IN", label: "Urdu" },
  { code: "as-IN", label: "Assamese" },
  { code: "brx-IN", label: "Bodo" },
  { code: "doi-IN", label: "Dogri" },
  { code: "kok-IN", label: "Konkani" },
  { code: "ks-IN", label: "Kashmiri" },
  { code: "mai-IN", label: "Maithili" },
  { code: "mni-IN", label: "Manipuri" },
  { code: "ne-IN", label: "Nepali" },
  { code: "sa-IN", label: "Sanskrit" },
  { code: "sat-IN", label: "Santali" },
  { code: "sd-IN", label: "Sindhi" },
];

const getSpeechRecognitionLang = (
  selectedLang: SupportedLanguage | "auto",
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

export const VoiceRecorderCard = ({}: VoiceRecorderCardProps) => {
  const { t, currentLanguage } = useTranslation();
  const { data: currentUser } = useGetCurrentUser();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState(``);
  const [isListening, setIsListening] = useState(false);
  const [sttError, setSttError] = useState<SttErrorState | null>(null);
  const [isTypingMode, setIsTypingMode] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Synchronize language with current app localization
  const [language, setLanguage] = useState<SupportedLanguage>("auto");
  useEffect(() => {
    if (currentLanguage?.code) {
      setLanguage(currentLanguage.code as SupportedLanguage);
    }
  }, [currentLanguage]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const [frequencyData, setFrequencyData] = useState<number[]>([]);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const accumulatedTranscriptRef = useRef<string>("");
  const isRecordingRef = useRef(false);
  const lastTranscriptRef = useRef("");

  const { mutateAsync: submitTranscript, isPending } = useSubmitTranscript();

  const { mutateAsync: generateQuestions, isPending: isGeneratingQuestions } =
    useGenerateQuestion();

  // Question suggestions triggered when transcript changes
  useEffect(() => {
    if (!isRecording && !transcript) return;
    if (!transcript || transcript.trim().length <= 10) return;

    if (transcript === lastTranscriptRef.current) return;
    lastTranscriptRef.current = transcript;

    const generate = async () => {
      try {
        const qstns = await generateQuestions(transcript);
        setQuestions(qstns || []);
      } catch (err) {
        console.error("Error generating questions:", err);
      }
    };

    generate();
  }, [transcript, isRecording, isListening, generateQuestions]);

  const updateFrequency = () => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const bars = Array.from(dataArray).map((v) => v / 255);
    setFrequencyData(bars);
    animationFrameRef.current = requestAnimationFrame(updateFrequency);
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsListening(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Recognition already stopped
      }
      recognitionRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
    setFrequencyData([]);
  };

  const startRecording = async () => {
    const SpeechRecognitionClass =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionClass) {
      setSttError({
        code: "BROWSER_NOT_SUPPORTED",
        category: "compatibility",
        message: t(
          "voice.browserNotSupported",
          "Speech recognition is not supported in this browser. Please type your question directly or open AgriSeva in Google Chrome / Microsoft Edge."
        ),
        canRetry: false,
        hasFailed: true,
      });
      setIsTypingMode(true);
      return;
    }

    setSttError(null);
    setQuestions([]);
    setRetryCount(0);
    lastTranscriptRef.current = "";
    accumulatedTranscriptRef.current = transcript.trim();

    // Start live microphone stream for frequency animation
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      updateFrequency();
    } catch (err: any) {
      console.warn("Could not start visualizer audio stream:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setSttError({
          code: "MIC_PERMISSION_DENIED",
          category: "permission",
          message: t(
            "voice.micPermissionDenied",
            "Microphone access was denied. Please allow microphone permissions in your browser or type your question."
          ),
          canRetry: true,
          hasFailed: true,
        });
        return;
      }
    }

    // Initialize 100% Free Browser Native Speech Recognition
    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = getSpeechRecognitionLang(language, currentLanguage?.code);

      recognition.onresult = (event: any) => {
        let interim = "";
        let finalParts = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalParts += res[0].transcript + " ";
          } else {
            interim += res[0].transcript;
          }
        }

        if (finalParts) {
          accumulatedTranscriptRef.current = (
            accumulatedTranscriptRef.current + " " + finalParts
          )
            .replace(/\s+/g, " ")
            .trim();
        }

        const currentFull = (
          accumulatedTranscriptRef.current + (interim ? " " + interim : "")
        ).trim();

        setTranscript(currentFull);
        if (sttError) {
          setSttError(null);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setSttError({
            code: "MIC_PERMISSION_DENIED",
            category: "permission",
            message: t(
              "voice.micPermissionDenied",
              "Microphone access was denied. Please allow microphone permissions or type your question."
            ),
            canRetry: true,
            hasFailed: true,
          });
          stopRecording();
        } else if (event.error === "network") {
          setSttError({
            code: "SPEECH_NETWORK_ERROR",
            category: "network",
            message: t(
              "voice.networkError",
              "Connection issue during speech recognition. Please check your internet or type your question."
            ),
            canRetry: true,
            hasFailed: true,
          });
          stopRecording();
        } else if (event.error !== "no-speech") {
          setSttError({
            code: "SPEECH_RECOGNITION_ERROR",
            category: "recognition",
            message: t(
              "voice.transcriptionFailed",
              "Voice transcription encountered an issue. Please try again or type your question."
            ),
            canRetry: true,
            hasFailed: true,
          });
          stopRecording();
        }
      };

      recognition.onend = () => {
        // Automatically resume listening if user has not clicked stop
        if (isRecordingRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // Already started or busy
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      isRecordingRef.current = true;
      setIsRecording(true);
      setIsListening(true);
    } catch (err: any) {
      console.error("Failed to start speech recognition:", err);
      setSttError({
        code: "SPEECH_START_ERROR",
        category: "recognition",
        message: t(
          "voice.transcriptionFailed",
          "Could not start speech recognition. Please type your question directly."
        ),
        canRetry: true,
        hasFailed: true,
      });
      stopRecording();
    }
  };

  const handleRecordingToggle = () => {
    if (isRecordingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleRetry = () => {
    setSttError(null);
    setRetryCount((prev) => prev + 1);
    startRecording();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const handleSubmit = async () => {
    if (sttError?.hasFailed) {
      toast.error(
        t(
          "voice.cannotSubmitFailed",
          "Please record again or type your question before submitting."
        )
      );
      return;
    }

    const textToSubmit = transcript.trim();
    if (!textToSubmit) {
      toast.error(t("common.transcriptEmpty", "Transcript is empty!"));
      return;
    }

    try {
      let currentQuestions = questions;
      if (currentQuestions.length === 0) {
        const qstns = await generateQuestions(textToSubmit);
        if (qstns && qstns.length > 0) {
          currentQuestions = qstns;
          setQuestions(qstns);
        }
      }

      const submissionId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `sub-${Date.now()}`;

      const userKvk = currentUser?.kvkCovered?.[0];
      const farmerProf = currentUser?.farmerProfile;
      const derivedDetails = {
        state: userKvk?.state || farmerProf?.state || "",
        district: userKvk?.district || farmerProf?.district || "",
        crop: farmerProf?.primaryCrops?.[0] || "",
        season: "",
        domain: [],
      };

      const result = await submitTranscript({
        transcript: textToSubmit,
        language,
        submissionId,
        details: derivedDetails,
        source: "VOICE",
      });

      const isUnavailableFallback = currentQuestions.some(
        (q) => q.referenceSource === "advisory_fallback_service_unavailable"
      );

      if (isUnavailableFallback) {
        toast.info(
          `Question saved to pipeline (ID: ${result?.questionId || "created"}). AI search unavailable — routed to expert review.`
        );
      } else {
        toast.success(
          `Question saved to pipeline (ID: ${result?.questionId || "created"}).`
        );
      }

      setTranscript("");
      accumulatedTranscriptRef.current = "";
      setQuestions([]);
      setSttError(null);
      setIsTypingMode(false);
      lastTranscriptRef.current = "";
    } catch (error: any) {
      console.error("Failed to submit transcript:", error);
      toast.error(error?.message || "Failed to submit transcript. Try again!");
    }
  };

  const handleClear = () => {
    stopRecording();
    setTranscript("");
    accumulatedTranscriptRef.current = "";
    setSttError(null);
    setIsTypingMode(false);
    setRetryCount(0);
    setQuestions([]);
    lastTranscriptRef.current = "";
  };

  return (
    <div className=" bg-background p-4">
      <div className=" mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="min-h-[80%] md:h-auto">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Volume2 className="h-4 w-4 text-primary" />
                  </div>
                  <span>{t("common.voiceRecorder", "Voice Recorder")}</span>
                  <Badge variant="outline" className="text-[11px] font-normal border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
                    100% Free
                  </Badge>
                </CardTitle>
                <Select
                  value={language}
                  onValueChange={(value) =>
                    setLanguage(value as SupportedLanguage)
                  }
                >
                  <SelectTrigger className="w-full md:w-[160px] h-9">
                    <Speech className="w-4 h-4" />
                    <span className="hidden md:block text-sm">
                      <SelectValue placeholder={t("common.selectLanguage", "Language")} />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {supportedLanguages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 border rounded-lg bg-muted/30">
                <Button
                  onClick={() => handleRecordingToggle()}
                  size="sm"
                  variant={isRecording ? "destructive" : "default"}
                  className={cn(
                    "h-12 w-12 rounded-full flex-shrink-0 self-center sm:self-auto",
                    isRecording && "animate-pulse"
                  )}
                  title={t("common.toggleRecording", "Toggle recording")}
                >
                  {isRecording ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>

                <div className="flex-1 flex items-center gap-1 h-8">
                  {isRecording ? (
                    <div className="w-[70%] h-full flex items-end overflow-hidden">
                      {frequencyData
                        .filter((_, index) => index % 4 === 0)
                        .map((level, index) => (
                          <div
                            key={index}
                            className="bg-gradient-to-t from-blue-500 to-purple-500 rounded-full w-1 transition-all duration-75"
                            style={{
                              height: `${Math.max(level * 100, 10)}%`,
                              opacity: 0.6 + level * 0.4,
                              marginRight: "4px",
                            }}
                          />
                        ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      {isRecording ? (
                        <>
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          {t("common.recording", "Recording...")}
                        </>
                      ) : (
                        t("common.clickMicToStart", "Click microphone to start")
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0">
                  {transcript && !isRecording && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">{t("common.done", "Done")}</span>
                    </div>
                  )}
                </div>
              </div>

              {sttError && sttError.hasFailed && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 sm:p-4 text-sm text-foreground space-y-3 animate-in fade-in-50 duration-200">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="font-medium text-amber-900 dark:text-amber-200 text-sm leading-snug break-words">
                        {sttError.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsTypingMode(true);
                        setSttError(null);
                      }}
                      className="h-8 text-xs font-medium gap-1.5 border-amber-600/30 hover:bg-amber-500/15 text-amber-900 dark:text-amber-100"
                    >
                      <Keyboard className="h-3.5 w-3.5" />
                      {t("voice.typeQuestion", "Type your question")}
                    </Button>
                    {sttError.canRetry && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleRetry}
                        disabled={retryCount >= 1}
                        className="h-8 text-xs font-medium gap-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {t("voice.retry", "Retry")}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    {isTypingMode ? t("voice.typeQuestion", "Your Question") : t("common.transcript", "Transcript")}
                  </Label>
                  {transcript.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {transcript.length} {t("common.chars", "chars")}
                    </span>
                  )}
                </div>

                <div className="h-40 relative">
                  {isTypingMode ? (
                    <Textarea
                      value={transcript}
                      onChange={(e) => {
                        setTranscript(e.target.value);
                        accumulatedTranscriptRef.current = e.target.value;
                        if (sttError?.hasFailed) {
                          setSttError(null);
                        }
                      }}
                      placeholder={t("voice.typeYourQuestionHere", "Type your question here...")}
                      className="h-full w-full resize-none p-3 text-sm focus-visible:ring-primary rounded-md border bg-background/50"
                      autoFocus
                    />
                  ) : (
                    <div className="h-full w-full overflow-y-auto rounded-md border bg-background/50 p-3 text-sm whitespace-pre-wrap break-words">
                      {!transcript ? (
                        <span className="text-muted-foreground">
                          {t("common.speechPlaceholder", "Your speech will appear here...")}
                        </span>
                      ) : (
                        <span className="text-foreground">
                          {transcript}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex flex-wrap items-center justify-between mt-2 gap-2">
                  <div>
                    {!isTypingMode && (
                      <Button
                        type="button"
                        onClick={() => {
                          setIsTypingMode(true);
                          if (sttError?.hasFailed) setSttError(null);
                        }}
                        variant="ghost"
                        size="sm"
                        disabled={isRecording}
                        className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                      >
                        <Keyboard className="h-3.5 w-3.5" />
                        <span>{t("voice.typeQuestion", "Type question")}</span>
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={handleClear}
                      variant="outline"
                      size="sm"
                      disabled={(!transcript && !sttError && !isTypingMode) || isRecording}
                      className="flex items-center gap-1"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>{t("common.clear", "Clear")}</span>
                    </Button>

                    <Button
                      onClick={handleSubmit}
                      disabled={
                        !transcript.trim() ||
                        isPending ||
                        isGeneratingQuestions ||
                        isRecording ||
                        (sttError !== null && sttError.hasFailed)
                      }
                      size="sm"
                      className="flex items-center gap-1 shadow-sm"
                    >
                      <Send className="h-3 w-3" />
                      <span className="text-xs">
                        {isPending ? t("common.sending", "Sending...") : t("common.submit", "Submit")}
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
            {/* can the incoming call box be moved here? */}
          <Card className="min-h-[80%]  md:h-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <HelpCircle className="h-5 w-5 text-primary" />
                      </div>
                      {t("common.questionsGenerated", "Questions")}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("common.questionsGeneratedHint", "These are questions generated from your transcript")}
                  </TooltipContent>
                </Tooltip>
                <Badge variant="outline">{questions?.length} {t("dashboard.questionsCount", "questions")}</Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className=" h-full overflow-hidden">
              {isGeneratingQuestions ? (
                <div className="flex flex-col h-[500px] text-center text-muted-foreground space-y-4 p-4">
                  <Skeleton className="h-25 w-full rounded-md" />
                  <Skeleton className="h-25 w-full rounded-md" />
                  <Skeleton className="h-25 w-full rounded-md" />
                </div>
              ) : (
                <ScrollArea className="h-[500px] w-full ">
                  {!questions || questions?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                      <Lightbulb className="h-12 w-12 mb-4 opacity-50" />
                      <p className="text-sm">
                        {t("common.startSpeakingHint", "Start speaking to see related questions based on your transcript")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-28">
                      {questions?.map((qn, index) => (
                        <div
                          key={`${qn.question}-${qn.id + index}`}
                          className="rounded-lg border bg-card hover:bg-accent/30 transition-colors overflow-hidden"
                        >
                          <div className="p-4">
                            <div className="flex items-start gap-3 mb-3">
                              <div className="text-blue-600 dark:text-blue-400 mt-1">
                                <HelpCircle className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground leading-relaxed">
                                  {qn.question}
                                </p>
                              </div>
                            </div>

                            <Accordion
                              type="single"
                              collapsible
                              className="w-full"
                            >
                              <AccordionItem
                                value="answer"
                                className="border-none"
                              >
                                <AccordionTrigger className="py-2 px-3 bg-muted/50 rounded-md hover:bg-muted transition-colors text-sm font-medium hover:no-underline">
                                  <div className="flex items-center gap-2">
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    {t("common.viewExpertAnswer", "View Expert Answer")}
                                  </div>
                                </AccordionTrigger>
                                
                                <AccordionContent className="pt-3 pb-1">
                                   <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-3">
                                     {/* Status & Qualitative Confidence Header */}
                                     <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                                       <div className="flex items-center gap-2">
                                         <span
                                           className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                                             qn.status === "grounded"
                                               ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                                               : qn.status === "calculated"
                                               ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300"
                                               : qn.status === "source_unavailable"
                                               ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300"
                                               : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300"
                                           }`}
                                         >
                                           {qn.status === "grounded"
                                             ? "Grounded Advisory"
                                             : qn.status === "calculated"
                                             ? "Market Intelligence"
                                             : qn.status === "source_unavailable"
                                             ? "Source Unavailable"
                                             : "Needs Expert Review"}
                                         </span>

                                         <span className="text-xs text-muted-foreground font-medium">
                                           Confidence:{" "}
                                           <span className="text-foreground font-semibold">
                                             {qn.confidence === "high"
                                               ? "Verified source"
                                               : qn.confidence === "medium"
                                               ? "Supported by sources"
                                               : "Needs expert review"}
                                           </span>
                                         </span>
                                       </div>

                                       <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                         <User className="w-3 h-3" />
                                         <span className="font-medium text-foreground">
                                           {qn.agri_specialist}
                                         </span>
                                       </div>
                                     </div>

                                     {/* Warnings / Missing Dosage Alert */}
                                     {qn.warnings && qn.warnings.length > 0 && (
                                       <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-md p-2.5 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                                         <span className="font-semibold block">Notice / Safety Disclaimer:</span>
                                         {qn.warnings.map((w, idx) => (
                                           <p key={idx}>{w}</p>
                                         ))}
                                       </div>
                                     )}

                                     {/* Answer Body */}
                                     <div className="px-1">
                                       <p className="text-sm text-foreground leading-relaxed">
                                         {qn.answer || "No response generated."}
                                       </p>
                                     </div>

                                     {/* Provenance Evidence Sources */}
                                     {qn.sources && qn.sources.length > 0 && (
                                       <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-1.5">
                                         <span className="text-xs font-semibold text-muted-foreground block">
                                           Verified Evidence Sources:
                                         </span>
                                         <div className="flex flex-wrap gap-2">
                                           {qn.sources.map((src, sIdx) => (
                                             <div
                                               key={sIdx}
                                               className="text-xs px-2 py-1 rounded bg-background border border-border flex items-center gap-1.5"
                                             >
                                               <span className="font-bold text-primary">
                                                 {src.type === "golden"
                                                   ? "Golden Dataset"
                                                   : src.type === "reviewer"
                                                   ? "Expert Reviewed"
                                                   : src.type === "market_prices"
                                                   ? "Agmarknet Mandi"
                                                   : src.type === "pop"
                                                   ? "Official PoP"
                                                   : src.type === "buyers"
                                                   ? "Verified Buyer"
                                                   : "Official Source"}
                                               </span>
                                               {src.reference && (
                                                 <span className="text-muted-foreground truncate max-w-[200px]">
                                                   ({src.reference})
                                                 </span>
                                               )}
                                             </div>
                                           ))}
                                         </div>
                                       </div>
                                     )}
                                   </div>
                                 </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <ScrollBar orientation="vertical" />
                </ScrollArea>
              )}

              {(questions?.length || 0) > 0 && (
                <div className="text-center text-sm text-muted-foreground border-t pt-4 mt-4">
                  <p>Questions are generated live as you speak</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default VoiceRecorderCard;
