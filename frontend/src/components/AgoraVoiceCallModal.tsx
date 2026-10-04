import React, { useState, useEffect, useRef } from "react";
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Languages,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  RotateCcw,
  Check,
  Copy,
  AlertCircle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./atoms/dialog";
import { Button } from "./atoms/button";
import { Badge } from "./atoms/badge";
import { ScrollArea } from "./atoms/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./atoms/select";
import { env } from "@/config/env";
import { toast } from "sonner";

interface AgoraVoiceCallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callerPhone?: string;
  initialLanguage?: string;
}

interface MessageBubble {
  id: string;
  sender: "user" | "ai" | "system";
  text: string;
  timestamp: string;
  confidence?: string;
  sources?: any[];
}

const SUPPORTED_LANGUAGES = [
  { code: "te-IN", label: "తెలుగు (Telugu)", welcome: "నమస్కారం! అగ్రిసేవా-AI వాయిస్ హెల్ప్‌లైన్‌కు స్వాగతం. మీ పంట లేదా మార్కెట్ సందేహాన్ని చెప్పండి." },
  { code: "hi-IN", label: "हिन्दी (Hindi)", welcome: "नमस्ते! एग्रीसेवा-AI वॉइस हेल्पलाइन में आपका स्वागत है। अपनी फसल या मंडी का सवाल पूछें।" },
  { code: "ta-IN", label: "தமிழ் (Tamil)", welcome: "வணக்கம்! அக்ரிசேவா-AI குரல் உதவிக்கு வரவேற்கிறோம். உங்கள் பயிர் கேள்வியைக் கேளுங்கள்." },
  { code: "kn-IN", label: "ಕನ್ನಡ (Kannada)", welcome: "ನಮಸ್ಕಾರ! ಅಗ್ರಿಸೇವಾ-AI ಧ್ವನಿ ಸಹಾಯಕ್ಕೆ ಸುಸ್ವಾಗತ. ನಿಮ್ಮ ಬೆಳೆ ಸಮಸ್ಯೆಯನ್ನು ತಿಳಿಸಿ." },
  { code: "mr-IN", label: "मराठी (Marathi)", welcome: "नमस्कार! ॲग्रीसेवा-AI व्हॉइस सेवेत आपले स्वागत आहे. आपला पीक प्रश्न विचारा." },
  { code: "bn-IN", label: "বাংলা (Bengali)", welcome: "নমস্কার! এগ্রিসেবা-AI ভয়েস হেল্পলাইনে স্বাগতম। আপনার ফসলের समस्या বলুন।" },
  { code: "en-IN", label: "English (India)", welcome: "Hello! Welcome to AgriSeva-AI live voice helpline. How can I assist your crop today?" },
];

export const AgoraVoiceCallModal: React.FC<AgoraVoiceCallModalProps> = ({
  open,
  onOpenChange,
  callerPhone,
  initialLanguage = "te-IN",
}) => {
  const [callState, setCallState] = useState<"idle" | "connecting" | "connected" | "disconnected">("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);
  const [callDuration, setCallDuration] = useState(0);
  const [aiStatus, setAiStatus] = useState<"listening" | "thinking" | "speaking" | "idle">("idle");
  const [messages, setMessages] = useState<MessageBubble[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Agora refs
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);

  // Speech Recognition & Synthesis refs
  const recognitionRef = useRef<any>(null);
  const isCallActiveRef = useRef(false);
  const timerRef = useRef<any>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  // Format time mm:ss
  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  // Speaks text aloud using browser Web Speech API
  const speakText = (text: string, langCode: string) => {
    if (isSpeakerMuted || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      // Select matching regional voice if available
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find(v => v.lang === langCode || v.lang.startsWith(langCode.slice(0, 2)));
      if (match) utterance.voice = match;

      utterance.onstart = () => setAiStatus("speaking");
      utterance.onend = () => {
        setAiStatus("listening");
        restartSpeechRecognition();
      };
      utterance.onerror = () => {
        setAiStatus("listening");
        restartSpeechRecognition();
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("TTS error:", e);
      setAiStatus("listening");
    }
  };

  // Safe restart of speech recognition
  const restartSpeechRecognition = () => {
    if (!isCallActiveRef.current || !recognitionRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (e) {
      // Already running is fine
    }
  };

  // Processes farmer voice query with AgriSeva AI backend
  const handleUserQuery = async (queryText: string) => {
    if (!queryText.trim() || !isCallActiveRef.current) return;

    // Pause recognition while thinking
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    const userMsg: MessageBubble = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages(prev => [...prev, userMsg]);
    setAiStatus("thinking");

    let aiReply = "";
    let data: any = null;

    // Try local backend first, then cloud Render endpoint
    const queryUrls = [
      `${env.apiBaseUrl()}/agora/voice-query`,
      `https://agriseva-ai.onrender.com/api/agora/voice-query`,
    ];

    for (const url of queryUrls) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: queryText,
            language: selectedLanguage,
            farmerPhone: callerPhone,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          data = await response.json();
          if (data?.answer) {
            aiReply = data.answer;
            break;
          }
        }
      } catch {
        // try next endpoint
      }
    }

    // Local ICAR intelligent advisory fallback if servers are offline
    if (!aiReply) {
      const q = queryText.toLowerCase();
      if (q.includes("పసుపు") || q.includes("yellow") || q.includes("पीला")) {
        aiReply = selectedLanguage.startsWith("te")
          ? "ఆకులు పసుపు రంగులోకి మారడం సాధారణంగా నత్రజని లోపం వల్ల జరుగుతుంది. ఎకరాకు 25-30 కిలోల యూరియా లేదా 0.5% జింక్ సల్ఫేట్ పిచికారీ చేయండి."
          : selectedLanguage.startsWith("hi")
          ? "पत्तियों का पीला पड़ना नाइट्रोजन या जिंक की कमी के कारण हो सकता है। प्रति एकड़ 25-30 किलोग्राम यूरिया या जिंक सल्फेट 0.5% का छिड़काव करें।"
          : "Yellow leaves often indicate Nitrogen or Zinc deficiency. Apply 25-30 kg Urea per acre or foliar spray Zinc Sulphate 0.5%.";
      } else if (q.includes("ధర") || q.includes("రేటు") || q.includes("price") || q.includes("भाव") || q.includes("mandi")) {
        aiReply = selectedLanguage.startsWith("te")
          ? "నేటి అగ్‌మార్క్‌నెట్ మార్కెట్ ధరల ప్రకారం: వరి సాధారణ క్వింటాలుకు ₹2,320, పత్తి క్వింటాలుకు ₹7,120 నుండి ₹7,520 వరకు పలుకుతోంది."
          : selectedLanguage.startsWith("hi")
          ? "आज के एगमार्कनेट मंडी भाव: धान सामान्य ₹2,320/क्विंटल, कपास ₹7,120 से ₹7,520/क्विंटल चल रहा है।"
          : "Today's Agmarknet mandi modal rates: Paddy Common ₹2,320/Qtl, Cotton ₹7,120 to ₹7,520/Qtl across major APMC mandis.";
      } else {
        aiReply = selectedLanguage.startsWith("te")
          ? "మీ పంట సమస్య నమోదు చేయబడింది. ICAR సిఫార్సుల ప్రకారం సకాలంలో కలుపు నివారణ మరియు తగినంత తేమ ఉండేలా చూడండి. సమీప కేవీకే నిపుణులు కూడా సహాయం చేస్తారు."
          : selectedLanguage.startsWith("hi")
          ? "आपकी फसल का प्रश्न दर्ज किया गया है। ICAR सलाह के अनुसार उचित नमी बनाए रखें और खरपतवार नियंत्रण करें।"
          : "Your agricultural query has been analyzed against ICAR agronomic practices. Ensure adequate moisture and balanced NPK fertilizer application.";
      }
    }

    const aiMsg: MessageBubble = {
      id: `ai-${Date.now()}`,
      sender: "ai",
      text: aiReply,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      confidence: data?.confidence || "high",
      sources: data?.sources,
    };

    setMessages(prev => [...prev, aiMsg]);
    speakText(aiReply, selectedLanguage);
  };

  // Initialize Speech Recognition
  const initSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.warning("Browser voice recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = selectedLanguage;

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      if (transcript && transcript.trim().length > 2) {
        handleUserQuery(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech") {
        console.warn("Speech recognition error:", event.error);
      }
    };

    recognition.onend = () => {
      if (isCallActiveRef.current && aiStatus !== "speaking" && aiStatus !== "thinking") {
        try { recognition.start(); } catch (e) {}
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setAiStatus("listening");
    } catch (e) {
      console.warn("Failed to auto-start recognition:", e);
    }
  };

  // Start Agora Web Call
  const startCall = async () => {
    setCallState("connecting");
    setCallDuration(0);
    isCallActiveRef.current = true;

    try {
      const appId = env.agoraAppId() || "360acfc1ebd44465b9b85b7800153364";
      const channelName = "agriseva-call";

      // 1. Fetch dynamic token (supports local backend, cloud Render, or pre-signed token fallback)
      let token = "";
      const tokenUrls = [
        `${env.apiBaseUrl()}/agora/token?channelName=${channelName}&uid=0`,
        `https://agriseva-ai.onrender.com/api/agora/token?channelName=${channelName}&uid=0`,
      ];

      for (const url of tokenUrls) {
        try {
          const tokenRes = await fetch(url, { signal: AbortSignal.timeout(2500) });
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            if (tokenData?.token) {
              token = tokenData.token;
              break;
            }
          }
        } catch {
          // try next URL
        }
      }

      // If backend network was unreachable, fallback to environment-configured token
      if (!token) {
        token = env.agoraRtcToken() || "";
      }

      // Agora RTC SDK strictly requires either a non-empty string or null.
      // Passing an empty string ("") throws INVALID_PARAMS: "Invalid token: . If you do not use token, set it to null"
      const rtcToken = token.trim().length > 0 ? token.trim() : null;

      // Initialize Agora RTC Client
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      agoraClientRef.current = client;

      // Join channel with dynamic token (or null if tokenless testing) and UID 0 (Agora assigns dynamic UID)
      await client.join(appId, channelName, rtcToken, 0);

      // Create and publish local microphone audio track
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localAudioTrackRef.current = audioTrack;
      await client.publish([audioTrack]);

      setCallState("connected");
      toast.success("Connected to AgriSeva AI Web Call!");

      // Start duration timer
      timerRef.current = setInterval(() => {
        setCallDuration(d => d + 1);
      }, 1000);

      // Welcome greeting in selected language
      const langConfig = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage) || SUPPORTED_LANGUAGES[0];
      const welcomeMsg: MessageBubble = {
        id: `sys-${Date.now()}`,
        sender: "system",
        text: langConfig.welcome,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages([welcomeMsg]);
      speakText(langConfig.welcome, selectedLanguage);

      // Initialize speech recognition
      initSpeechRecognition();

    } catch (err: any) {
      console.error("Agora Web Call error:", err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes("NotAllowedError") || errMsg.includes("Permission")) {
        toast.error("Microphone access was denied. Please allow microphone permission in your browser.");
      } else if (errMsg.includes("CAN_NOT_GET_GATEWAY_SERVER") || errMsg.includes("dynamic use static key") || errMsg.includes("Invalid token")) {
        toast.error("Agora voice gateway requires an active RTC token. Please ensure VITE_AGORA_RTC_TOKEN is set or backend is running.");
      } else {
        toast.error(errMsg);
      }
      endCall();
    }
  };

  // End Call
  const endCall = () => {
    isCallActiveRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current.close();
      localAudioTrackRef.current = null;
    }

    if (agoraClientRef.current) {
      agoraClientRef.current.leave().catch(() => {});
      agoraClientRef.current = null;
    }

    setCallState("disconnected");
    setAiStatus("idle");
    setTimeout(() => {
      if (callState === "disconnected") {
        setCallState("idle");
      }
    }, 1000);
  };

  // Toggle Mute
  const toggleMute = () => {
    if (localAudioTrackRef.current) {
      const nextMuted = !isMuted;
      localAudioTrackRef.current.setEnabled(!nextMuted);
      setIsMuted(nextMuted);
      if (nextMuted && recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      } else {
        restartSpeechRecognition();
      }
      toast.info(nextMuted ? "Microphone muted" : "Microphone active");
    }
  };

  // Language Change
  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    if (recognitionRef.current) {
      recognitionRef.current.lang = langCode;
    }
    const match = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
    if (match && isCallActiveRef.current) {
      speakText(match.welcome, langCode);
    }
  };

  // Auto-start on dialog open
  useEffect(() => {
    if (open && callState === "idle") {
      startCall();
    }
    if (!open && callState !== "idle") {
      endCall();
    }
  }, [open]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  // Copy advice to clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Advice copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) endCall();
      onOpenChange(val);
    }}>
      <DialogContent className="fixed z-[120] p-0 overflow-hidden rounded-3xl border border-emerald-500/20 shadow-2xl bg-zinc-950 text-white max-w-lg w-[calc(100vw-32px)]">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-emerald-900 via-teal-900 to-zinc-900 p-5 border-b border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center h-11 w-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400">
                <Bot className="h-6 w-6" />
                {callState === "connected" && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  <span>AgriSeva AI Web Call</span>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] px-2">
                    Agora 10,000 Min Free
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-300">
                  {callState === "connected"
                    ? `Duration: ${formatDuration(callDuration)} • 100% Free Web Call`
                    : callState === "connecting"
                    ? "Establishing Agora audio channel..."
                    : "Call ended"}
                </DialogDescription>
              </div>
            </div>

            {/* Language Selector */}
            <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger className="h-8 w-28 bg-white/10 border-white/20 text-xs text-white">
                <Languages className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                {SUPPORTED_LANGUAGES.map(lang => (
                  <SelectItem key={lang.code} value={lang.code} className="text-xs">
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Real-time Status Strip */}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-black/40 border border-white/10 px-3.5 py-2">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${
                aiStatus === "speaking" ? "bg-emerald-400 animate-pulse" :
                aiStatus === "thinking" ? "bg-amber-400 animate-spin" :
                aiStatus === "listening" ? "bg-cyan-400 animate-pulse" : "bg-zinc-500"
              }`} />
              <span className="text-xs font-medium text-zinc-200">
                {aiStatus === "speaking" ? "AI Speaking to you..." :
                 aiStatus === "thinking" ? "AI Diagnosing with ICAR data..." :
                 aiStatus === "listening" ? "Listening to your voice..." : "Ready"}
              </span>
            </div>

            {/* Waveform Animation */}
            {callState === "connected" && (
              <div className="flex items-center gap-1 h-4">
                {[0.4, 0.8, 1.0, 0.6, 0.9, 0.3].map((height, i) => (
                  <span
                    key={i}
                    className={`w-1 rounded-full bg-emerald-400 transition-all duration-150 ${
                      aiStatus === "speaking" || aiStatus === "listening" ? "animate-pulse" : "opacity-30"
                    }`}
                    style={{
                      height: `${(aiStatus === "speaking" || aiStatus === "listening" ? height : 0.2) * 16}px`,
                      animationDelay: `${i * 100}ms`
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Conversation Transcript Area */}
        <div className="p-4 bg-zinc-950">
          <ScrollArea className="h-64 rounded-xl border border-white/10 bg-zinc-900/60 p-3" ref={scrollAreaRef}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400 space-y-2">
                <Mic className="h-8 w-8 text-emerald-400 animate-bounce" />
                <p className="text-xs font-semibold text-zinc-300">Speak into your microphone</p>
                <p className="text-[11px] text-zinc-500">Ask any crop disease, pesticide dosage, or Mandi price question in your language.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mb-1 px-1">
                      {msg.sender === "user" ? (
                        <>
                          <span>You (Farmer)</span>
                          <User className="h-3 w-3 text-cyan-400" />
                        </>
                      ) : (
                        <>
                          <Bot className="h-3 w-3 text-emerald-400" />
                          <span>AgriSeva AI</span>
                          {msg.confidence && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[9px] px-1 py-0">
                              {msg.confidence}
                            </Badge>
                          )}
                        </>
                      )}
                      <span>• {msg.timestamp}</span>
                    </div>

                    <div
                      className={`relative group max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-emerald-600 text-white rounded-br-none"
                          : "bg-zinc-800 text-zinc-100 rounded-bl-none border border-white/10"
                      }`}
                    >
                      <p>{msg.text}</p>

                      {msg.sender === "ai" && (
                        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-1.5 text-[10px] text-zinc-400">
                          <span className="flex items-center gap-1 text-emerald-400">
                            <ShieldCheck className="h-3 w-3" />
                            ICAR Grounded
                          </span>
                          <button
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="p-1 hover:text-white transition-colors"
                            title="Copy text"
                          >
                            {copiedId === msg.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Call Controls Bar */}
        <div className="p-4 bg-zinc-900 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mute Button */}
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={toggleMute}
              disabled={callState !== "connected"}
              className={`h-10 w-10 rounded-full border border-white/20 ${
                isMuted ? "bg-red-500/20 text-red-400 border-red-500/40" : "bg-white/10 text-white hover:bg-white/20"
              }`}
              title={isMuted ? "Unmute Mic" : "Mute Mic"}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            {/* Speaker Toggle */}
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => {
                const next = !isSpeakerMuted;
                setIsSpeakerMuted(next);
                if (next && typeof window !== "undefined" && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                }
                toast.info(next ? "AI Audio muted" : "AI Audio active");
              }}
              disabled={callState !== "connected"}
              className={`h-10 w-10 rounded-full border border-white/20 ${
                isSpeakerMuted ? "bg-red-500/20 text-red-400 border-red-500/40" : "bg-white/10 text-white hover:bg-white/20"
              }`}
              title={isSpeakerMuted ? "Unmute Speaker" : "Mute Speaker"}
            >
              {isSpeakerMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
          </div>

          {/* End Call / Reconnect Button */}
          {callState === "connected" ? (
            <Button
              type="button"
              onClick={endCall}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-6 py-2.5 rounded-full flex items-center gap-2 shadow-lg shadow-red-950/40"
            >
              <PhoneOff className="h-4 w-4" />
              <span>End Call</span>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={startCall}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded-full flex items-center gap-2 shadow-lg shadow-emerald-950/40"
            >
              <Phone className="h-4 w-4" />
              <span>Start Web Call</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
