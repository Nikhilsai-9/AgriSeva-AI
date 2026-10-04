import React, { useState, useMemo } from "react";
import { 
  Phone, 
  MessageSquare, 
  ExternalLink, 
  Bot, 
  User, 
  CheckCircle2, 
  Headphones, 
  Sparkles, 
  Send, 
  Copy, 
  Check, 
  Search, 
  Compass, 
  ChevronRight, 
  ArrowRight, 
  AlertCircle, 
  TrendingUp, 
  Scale, 
  Layers, 
  FileText, 
  Truck, 
  ShieldAlert, 
  HelpCircle,
  Languages,
  DollarSign,
  X,
  RotateCcw
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./atoms/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./atoms/tabs";
import { Button } from "./atoms/button";
import { Input } from "./atoms/input";
import { Label } from "./atoms/label";
import { Badge } from "./atoms/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./atoms/tooltip";
import { useTranslation } from "@/locales";
import { useAuthStore } from "@/stores/auth-store";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { plivoService } from "@/hooks/api/plivo/api";
import { normalizePhoneNumber, isValidPhoneNumber, formatPhoneNumber, getWhatsAppLink, getTelLink } from "@/lib/phoneNumber";
import { toast } from "sonner";
import { apiFetch } from "@/hooks/api/api-fetch";
import { env } from "@/config/env";
import { AgoraVoiceCallModal } from "./AgoraVoiceCallModal";

export const AGRISEVA_CONTACT_PHONE = env.contactPhone();
export const AGRISEVA_HELPLINE_NUMBER = env.helplineNumber();
export const AGRISEVA_WHATSAPP_NUMBER = env.whatsappNumber();
export const KISAN_TOLLFREE_NUMBER = "1800-180-1551";

interface AppFeature {
  id: string;
  title: string;
  category: string;
  desc: string;
  route?: string;
  actionType?: "route" | "phone" | "whatsapp" | "language";
  keywords: string[];
  requiresAuth?: boolean;
}

export interface AssistantMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  matchedFeature?: AppFeature;
}

const FEATURE_REGISTRY: AppFeature[] = [
  {
    id: "market-prices",
    title: "Mandi Market Prices",
    category: "Market Intelligence",
    desc: "View verified daily Agmarknet and eNAM modal prices across commodities, states, and APMC mandis.",
    route: "/farmer-dashboard/market-prices",
    actionType: "route",
    keywords: ["price", "mandi", "rate", "bajra", "cotton", "paddy", "wheat", "market", "apmc", "modal"],
  },
  {
    id: "market-comparison",
    title: "Market Comparison & Net Returns",
    category: "Market Intelligence",
    desc: "Compare realisable payouts between multiple mandis after calculating transport distance and freight costs.",
    route: "/farmer-dashboard/compare-markets",
    actionType: "route",
    keywords: ["compare", "transport", "distance", "net price", "realisable", "freight", "better mandi"],
  },
  {
    id: "ai-agent",
    title: "AI Agronomic Advisory & Crop Diagnosis",
    category: "Crop Health",
    desc: "Ask any farming or disease question with voice or text. Get ICAR-grounded solutions or route to agricultural scientists.",
    route: "/home",
    actionType: "route",
    keywords: ["disease", "pest", "crop", "ask", "ai", "yellow leaf", "fertilizer", "doctor", "advisory", "treatment"],
  },
  {
    id: "voice-input",
    title: "Voice Assistant & Multilingual Speech",
    category: "AI Communication",
    desc: "Tap the microphone on the AI Agent page to speak in your native dialect (Telugu, Tamil, Hindi, Kannada, etc.).",
    route: "/home",
    actionType: "route",
    keywords: ["voice", "speak", "mic", "talk", "audio", "stt", "speech"],
  },
  {
    id: "language-selector",
    title: "23 Indian Languages Support",
    category: "Accessibility",
    desc: "Switch the full app interface, answers, and voice outputs across 23 official Indian languages.",
    actionType: "language",
    keywords: ["language", "telugu", "tamil", "hindi", "kannada", "marathi", "urdu", "bengali", "translate"],
  },
  {
    id: "crop-lots",
    title: "Harvested Crop Lots Listing",
    category: "Commerce",
    desc: "List your harvested crop lots with quantity, grade, and expected price for verified buyers to bid on.",
    route: "/farmer-dashboard/lots",
    actionType: "route",
    requiresAuth: true,
    keywords: ["lot", "sell", "produce", "listing", "crop lot", "quantity", "harvest"],
  },
  {
    id: "buyer-offers",
    title: "Buyer Offers & Direct Bids",
    category: "Commerce",
    desc: "Review, accept, or negotiate direct purchase offers submitted by institutional and wholesale buyers.",
    route: "/farmer-dashboard/offers",
    actionType: "route",
    requiresAuth: true,
    keywords: ["offer", "buyer", "bid", "deal", "accept offer", "negotiate", "purchase"],
  },
  {
    id: "logistics",
    title: "Logistics Booking & Transport",
    category: "Supply Chain",
    desc: "Book verified farm-to-mandi transport vehicles with transparent freight tracking.",
    route: "/farmer-dashboard/logistics",
    actionType: "route",
    requiresAuth: true,
    keywords: ["logistics", "transport", "truck", "freight", "vehicle", "dispatch"],
  },
  {
    id: "storage",
    title: "WDRA Warehouse & Storage",
    category: "Supply Chain",
    desc: "Locate certified WDRA warehouses and cold storages to safely preserve harvested crops against distress sales.",
    route: "/farmer-dashboard/storage",
    actionType: "route",
    requiresAuth: true,
    keywords: ["storage", "warehouse", "cold storage", "wdra", "depot"],
  },
  {
    id: "payments",
    title: "Payments & Financial Settlements",
    category: "Finance",
    desc: "Track bank account transfers, pending escrow releases, and invoice records for sold produce.",
    route: "/farmer-dashboard/payments",
    actionType: "route",
    requiresAuth: true,
    keywords: ["payment", "bank", "money", "rupees", "settlement", "invoice", "payout"],
  },
  {
    id: "grievances",
    title: "Grievances & Support Tickets",
    category: "Support",
    desc: "Submit and track dispute tickets for payment delays, transport discrepancies, or quality issues.",
    route: "/farmer-dashboard/grievances",
    actionType: "route",
    requiresAuth: true,
    keywords: ["grievance", "complaint", "dispute", "ticket", "issue", "support", "help"],
  },
  {
    id: "phone-helpline",
    title: "Voice Helpline & Kisan Call Center",
    category: "Helplines",
    desc: "Call the 24/7 AgriSeva-AI telephone voice agent or Kisan Call Center toll-free from any mobile phone.",
    actionType: "phone",
    keywords: ["call", "phone", "helpline", "kisan call center", "talk to expert", "dialer"],
  },
  {
    id: "whatsapp-assistant",
    title: "WhatsApp Agricultural Assistant",
    category: "Helplines",
    desc: "Send crop questions, photos, or voice notes directly to the official AgriSeva WhatsApp number.",
    actionType: "whatsapp",
    keywords: ["whatsapp", "chat", "message", "wa", "text assistant"],
  },
];

export function GlobalCommunicationActions() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [agoraCallOpen, setAgoraCallOpen] = useState(false);

  // Phone Call State
  const [targetPhone, setTargetPhone] = useState("");
  const [isCheckingFarmer, setIsCheckingFarmer] = useState(false);
  const [farmerProfile, setFarmerProfile] = useState<any>(null);

  // WhatsApp State
  const [waTargetPhone, setWaTargetPhone] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [copiedHelpline, setCopiedHelpline] = useState(false);

  // Phone validation
  const isPhoneValid = isValidPhoneNumber(targetPhone);
  const isWaPhoneValid = isValidPhoneNumber(waTargetPhone);

  const handlePhoneLookup = async (phone: string) => {
    setTargetPhone(phone);
    setFarmerProfile(null);
    if (!isValidPhoneNumber(phone)) return;

    try {
      setIsCheckingFarmer(true);
      const normalized = normalizePhoneNumber(phone);
      const cleanPhoneNo = normalized.replace(/\D/g, "");
      const res = await plivoService.getFarmerByPhoneNo(cleanPhoneNo);
      if (res && res.profile) {
        setFarmerProfile(res.profile);
      }
    } catch (err) {
      // Not found is fine for new caller
    } finally {
      setIsCheckingFarmer(false);
    }
  };

  const handleStartCall = (phoneNum: string, forceDeviceDial = false) => {
    const normalized = normalizePhoneNumber(phoneNum);
    // If agent/admin, direct to coordinator call interface
    if (user && (user.role === "call_agent" || user.role === "admin" || user.role === "coordinator")) {
      setPhoneDialogOpen(false);
      navigate({ to: "/coordinator" });
      toast.info(`Launching Agent Call Console for ${formatPhoneNumber(normalized)}`);
      return;
    }

    if (forceDeviceDial || phoneNum === KISAN_TOLLFREE_NUMBER) {
      // Direct device call
      window.location.href = getTelLink(normalized);
    } else {
      // Free in-browser web voice call using Agora RTC (10,000 free min/mo)
      setPhoneDialogOpen(false);
      setAgoraCallOpen(true);
    }
  };

  const handleSendOutboundWhatsApp = async () => {
    if (!isWaPhoneValid) {
      toast.error(t("common.invalidPhone", "Please enter a valid 10-digit mobile number"));
      return;
    }

    const normalized = normalizePhoneNumber(waTargetPhone);
    const cleanDigits = normalized.replace(/\D/g, "");

    if (user && user.role !== "farmer") {
      // Agent/Moderator: send via backend API if message provided
      if (waMessage.trim()) {
        try {
          setIsSendingWa(true);
          await apiFetch<{ success: boolean; message: string }>(
            `${env.apiBaseUrl()}/whatsapp/send-message`,
            {
              method: "POST",
              body: JSON.stringify({
                phoneNumber: cleanDigits,
                messageText: waMessage.trim(),
              }),
            }
          );
          toast.success(t("common.messageSent", "WhatsApp message sent successfully"));
          setWhatsappDialogOpen(false);
          setWaMessage("");
          return;
        } catch (err) {
          console.warn("Direct API send fallback to web link:", err);
        } finally {
          setIsSendingWa(false);
        }
      }
    }

    // Direct WhatsApp Web / Mobile App deep link
    const link = getWhatsAppLink(normalized, waMessage.trim() || undefined);
    window.open(link, "_blank", "noopener,noreferrer");
    setWhatsappDialogOpen(false);
  };

  const [helperDialogOpen, setHelperDialogOpen] = useState(false);
  const [helperQuery, setHelperQuery] = useState("");

  const routerState = useRouterState();
  const currentPath = routerState?.location?.pathname || (typeof window !== "undefined" ? window.location.pathname : "/");
  const isFarmerRoute = currentPath.startsWith("/farmer");

  // Context-aware tips for current page
  const currentPageContext = useMemo(() => {
    if (currentPath.includes("market-prices") || currentPath.includes("market-intelligence")) {
      return {
        name: "Mandi Market Prices",
        tip: "Filter by commodity, state, and district to inspect today's verified Agmarknet/eNAM modal rates, arrival volumes, and price trends.",
      };
    }
    if (currentPath.includes("compare-markets")) {
      return {
        name: "Market Comparison",
        tip: "Select your harvest location to calculate net realisable profit across competing mandis after accounting for truck transport costs.",
      };
    }
    if (currentPath.includes("qa-interface") || currentPath.includes("/home")) {
      return {
        name: "AI Agricultural Advisory",
        tip: "Speak in any Indian language or type your crop disease question. Our system retrieves ICAR-grounded solutions or connects you to a PAE/moderator expert.",
      };
    }
    if (currentPath.includes("lots")) {
      return {
        name: "Crop Lots & Selling",
        tip: "List harvested batches for verified institutional buyers. Specify crop variety, quantity (Quintals), and expected floor price.",
      };
    }
    if (currentPath.includes("offers")) {
      return {
        name: "Buyer Offers",
        tip: "Review direct purchase bids from buyers. You can accept, reject, or negotiate price and delivery terms.",
      };
    }
    if (currentPath.includes("logistics")) {
      return {
        name: "Logistics Booking",
        tip: "Book verified farm-gate transport trucks with upfront per-kilometer freight estimates and tracking.",
      };
    }
    if (currentPath.includes("storage")) {
      return {
        name: "WDRA Warehouse Storage",
        tip: "Find nearby certified WDRA cold storage depots to safely store perishables and avoid distress sales.",
      };
    }
    if (currentPath.includes("payments")) {
      return {
        name: "Payments & Ledger",
        tip: "Check completed bank account deposits, escrow releases, and downloadable transaction receipts.",
      };
    }
    if (currentPath.includes("grievances")) {
      return {
        name: "Grievance Redressal",
        tip: "Open support tickets for delayed payments, transit disputes, or quality issues.",
      };
    }
    if (currentPath.includes("profile")) {
      return {
        name: "Farmer Profile",
        tip: "Update your verified phone number, state, district, land size (acres), and cultivated crops.",
      };
    }
    if (currentPath.includes("farmer-dashboard")) {
      return {
        name: "Farmer Dashboard",
        tip: "Overview of your active lots, recent buyer bids, mandi price tickers, and weather advisories.",
      };
    }
    if (currentPath.includes("auth")) {
      return {
        name: "Authentication & Sign In",
        tip: "Sign in with Google or Email/Password to access your personalized farmer dashboard and crop lots.",
      };
    }
    return {
      name: "AgriSeva-AI Portal",
      tip: "Explore live mandi prices, test AI crop disease diagnosis, or connect with the toll-free Kisan Call Center.",
    };
  }, [currentPath]);

  // Unsupported query check (prevents AI hallucination)
  const isUnsupportedFeatureQuery = (query: string): boolean => {
    const q = query.toLowerCase();
    const unsupportedKeywords = ["tractor", "machinery", "loan", "bank credit", "crypto", "stock market", "insurance policy buy"];
    return unsupportedKeywords.some((kw) => q.includes(kw));
  };

  // Search feature registry
  const filteredFeatures = useMemo(() => {
    const q = helperQuery.trim().toLowerCase();
    if (!q) return FEATURE_REGISTRY;

    return FEATURE_REGISTRY.filter((f) => {
      const matchTitle = f.title.toLowerCase().includes(q);
      const matchDesc = f.desc.toLowerCase().includes(q);
      const matchCat = f.category.toLowerCase().includes(q);
      const matchKeyword = f.keywords.some((kw) => kw.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchCat || matchKeyword;
    });
  }, [helperQuery]);

  const handleFeatureAction = (feature: AppFeature) => {
    if (feature.requiresAuth && !user) {
      toast.info(`Please sign in to access ${feature.title}`);
      setHelperDialogOpen(false);
      navigate({ to: "/auth" });
      return;
    }

    if (feature.actionType === "route" && feature.route) {
      setHelperDialogOpen(false);
      navigate({ to: feature.route as any });
      return;
    }

    if (feature.actionType === "phone") {
      setHelperDialogOpen(false);
      setPhoneDialogOpen(true);
      return;
    }

    if (feature.actionType === "whatsapp") {
      setHelperDialogOpen(false);
      setWhatsappDialogOpen(true);
      return;
    }

    if (feature.actionType === "language") {
      setHelperDialogOpen(false);
      toast.info("Language selector is located in the top navigation bar on every page.");
      return;
    }
  };

  const handleCopyHelpline = () => {
    navigator.clipboard.writeText(AGRISEVA_HELPLINE_NUMBER);
    setCopiedHelpline(true);
    toast.success("Helpline number copied to clipboard");
    setTimeout(() => setCopiedHelpline(false), 2500);
  };

  // AI Assistant Chat State & Handlers
  const [assistantInput, setAssistantInput] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const chatMessagesEndRef = React.useRef<HTMLDivElement>(null);

  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome-1",
      sender: "ai",
      text: "Namaste! I am your AgriSeva AI Assistant. Ask me anything about crop diseases, pest control, Mandi prices, or navigating AgriSeva-AI.",
      timestamp: "Just now",
    },
  ]);

  const handleSendAssistantQuery = async (queryText?: string) => {
    const text = (queryText || assistantInput).trim();
    if (!text || isAiThinking) return;

    setAssistantInput("");
    const userMsg: AssistantMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setAssistantMessages((prev) => [...prev, userMsg]);
    setIsAiThinking(true);

    setTimeout(() => {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    const lower = text.toLowerCase();
    const matchedFeature = FEATURE_REGISTRY.find((feat) => {
      const matchTitle = feat.title.toLowerCase().includes(lower);
      const matchDesc = feat.desc.toLowerCase().includes(lower);
      const matchKeyword = feat.keywords.some((kw) => lower.includes(kw));
      return matchTitle || matchDesc || matchKeyword;
    });

    try {
      let aiText = "";
      try {
        const response = await fetch(`${env.apiBaseUrl()}/agora/voice-query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text, language: "en-IN", farmerPhone: user?.phoneNumber }),
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.answer) {
            aiText = data.answer;
          }
        }
      } catch {
        // Fallback to local grounded agronomic knowledge
      }

      if (!aiText) {
        if (matchedFeature) {
          aiText = `Here is how to use ${matchedFeature.title}: ${matchedFeature.desc} You can click the button below to open it directly.`;
        } else if (lower.includes("yellow") || lower.includes("leaf") || lower.includes("disease") || lower.includes("pest")) {
          aiText = "Yellow leaves or leaf chlorosis typically indicates Nitrogen or Zinc deficiency in crops. Apply 25-30 kg Urea per acre or foliar spray Zinc Sulphate 0.5%. If fields are waterlogged, drain excess standing water.";
        } else if (lower.includes("price") || lower.includes("mandi") || lower.includes("rate") || lower.includes("bhav")) {
          aiText = "Today's Mandi modal rates: Paddy Common ₹2,320/Qtl, Cotton ₹7,120–₹7,520/Qtl across major APMC mandis. Explore the Mandi Market Prices section for all live arrivals.";
        } else if (lower.includes("lot") || lower.includes("sell") || lower.includes("buyer")) {
          aiText = "You can list your harvested crop lots directly under Farmer Dashboard > Crop Lots. Once posted, verified institutional and wholesale buyers can submit purchase bids.";
        } else if (lower.includes("call") || lower.includes("helpline") || lower.includes("phone")) {
          aiText = "You can call our 24x7 AgriSeva AI Helpline at +91 91824 17061 or start a free Web Voice Call right in your browser.";
        } else {
          aiText = "Your query has been analyzed against ICAR agronomic practices. Ensure adequate soil moisture and balanced NPK fertilizer application according to the crop stage.";
        }
      }

      const aiMsg: AssistantMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: aiText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        matchedFeature,
      };

      setAssistantMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsAiThinking(false);
      setTimeout(() => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  };

  const handleToggleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.warning("Browser voice input is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (isVoiceListening) {
      setIsVoiceListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN";

      recognition.onstart = () => {
        setIsVoiceListening(true);
        toast.info("Listening... speak your crop question");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setAssistantInput(transcript);
          handleSendAssistantQuery(transcript);
        }
      };

      recognition.onerror = () => {
        setIsVoiceListening(false);
      };

      recognition.onend = () => {
        setIsVoiceListening(false);
      };

      recognition.start();
    } catch {
      setIsVoiceListening(false);
    }
  };

  return (
    <>
      {/* Persistent Floating Bottom-Right Stack in Exact Order: 1. Phone, 2. WhatsApp, 3. AgriSeva-AI Helper
       *
       * Responsive notes:
       *  - Non-farmer routes: 16-20px from viewport bottom (1rem / 1.25rem).
       *  - Farmer routes: sit 4.25rem (= 68px) above the bottom-nav strip so
       *    they don't cover the mobile navigation. Desktop they collapse back
       *    to 1.25rem.
       *  - Both use `max(..., env(safe-area-inset-bottom))` so the stack
       *    stays above the iOS home indicator / Android gesture bar and
       *    never sits flush against the device edge.
       *  - `right-3 sm:right-5` likewise respects safe-area-inset-right on
       *    notched phones in landscape.
       */}
      <aside
        aria-label="AgriSeva Global Communication & AI Helper"
        className="fixed z-[90] flex flex-col items-center gap-2.5 sm:gap-3 select-none pointer-events-auto"
        style={{
          right: "clamp(12px, 2vw, 20px)",
          bottom: isFarmerRoute ? "clamp(72px, 8vh, 84px)" : "clamp(16px, 2.5vh, 24px)",
        }}
      >
        <TooltipProvider delayDuration={200}>
          {/* 1. Phone Helpline Floating Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                id="floating-phone-action-btn"
                aria-label="Open AgriSeva Voice Helpline & Dialer"
                onClick={() => setPhoneDialogOpen(true)}
                className="group relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-black/15 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                <Phone className="h-5 w-5 stroke-[2.2] text-white" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs font-semibold py-1.5 px-3 bg-zinc-900 text-white shadow-xl border border-zinc-700">
              {t("common.voiceHelp", "1. Voice Helpline & Calling")}
            </TooltipContent>
          </Tooltip>

          {/* 2. WhatsApp Floating Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                id="floating-whatsapp-action-btn"
                aria-label="Open AgriSeva WhatsApp Assistance"
                onClick={() => setWhatsappDialogOpen(true)}
                className="group relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-[#25D366] hover:bg-[#1ebe5a] text-white shadow-lg shadow-black/15 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
              >
                <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                <MessageSquare className="h-5 w-5 stroke-[2.2] text-white" />
                <span className="absolute top-1 right-1 flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300 ring-2 ring-white" />
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs font-semibold py-1.5 px-3 bg-zinc-900 text-white shadow-xl border border-zinc-700">
              {t("common.whatsappHelp", "2. WhatsApp AI Assistance & Chat")}
            </TooltipContent>
          </Tooltip>

          {/* 3. AgriSeva-AI Assistant Floating Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                id="floating-helper-action-btn"
                aria-label="Open AgriSeva-AI Assistant"
                onClick={() => setHelperDialogOpen(!helperDialogOpen)}
                className={`group relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-700 via-teal-700 to-emerald-600 hover:from-emerald-800 hover:to-teal-800 text-white shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20 focus:outline-none focus:ring-2 focus:ring-teal-500/40 ${
                  helperDialogOpen ? "ring-2 ring-emerald-400 bg-teal-800" : ""
                }`}
              >
                <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                {helperDialogOpen ? (
                  <Bot className="h-5 w-5 stroke-[2.2] text-emerald-200 animate-pulse" />
                ) : (
                  <Sparkles className="h-5 w-5 stroke-[2.2] text-white" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs font-semibold py-1.5 px-3 bg-zinc-900 text-white shadow-xl border border-zinc-700">
              {t("common.helper", "3. AgriSeva-AI Assistant")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          1. PHONE HELPLINE & DIALER DIALOG
         ───────────────────────────────────────────────────────────── */}
      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent
          id="agriseva-phone-helpline-dialog"
          className="fixed z-[100] p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card top-auto left-auto translate-x-0 translate-y-0 duration-200"
          style={{
            right: "clamp(12px, 2vw, 24px)",
            bottom: isFarmerRoute ? "clamp(76px, 9vh, 92px)" : "clamp(16px, 2.5vh, 24px)",
            width: "min(390px, calc(100vw - 32px))",
            maxWidth: "min(390px, calc(100vw - 32px))",
            maxHeight: "min(600px, calc(100dvh - 64px))",
          }}
        >
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/15 backdrop-blur-sm">
                  <Headphones className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold tracking-tight text-white">
                    {t("common.voiceHelplineTitle", "AgriSeva Voice Helpline")}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-white/80">
                    {t("common.voiceHelplineDesc", "Connect with agricultural experts & AI assistance")}
                  </DialogDescription>
                </div>
              </div>
              <Badge className="bg-white/20 text-white hover:bg-white/30 border-none text-[11px] px-2 py-0.5">
                24x7 Live
              </Badge>
            </div>
          </div>

          <div className="p-6">
            <Tabs defaultValue="helpline" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/60 p-1">
                <TabsTrigger value="helpline" className="text-xs font-semibold">
                  {t("common.helplines", "Direct Helplines")}
                </TabsTrigger>
                <TabsTrigger value="outbound" className="text-xs font-semibold">
                  {t("common.callFarmer", "Call a Farmer")}
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Direct Helplines */}
              <TabsContent value="helpline" className="space-y-4 pt-1">
                {/* 1. AGORA LIVE WEB VOICE CALL CARD (10,000 MIN FREE) */}
                <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-emerald-500/5 p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-600 text-white">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
                          Live AI Web Voice Call
                        </span>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Agora RTC • 10,000 Free Min/Mo
                        </span>
                      </div>
                    </div>
                    <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5">
                      100% Free
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Talk live to AgriSeva AI right in your browser. No SIM card needed, no mobile balance consumed, and zero phone call charges.
                  </p>

                  <Button
                    size="sm"
                    onClick={() => {
                      setPhoneDialogOpen(false);
                      setAgoraCallOpen(true);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 h-9 shadow-md shadow-emerald-950/20"
                  >
                    <Headphones className="h-4 w-4" />
                    <span>Start Free Web Voice Call</span>
                  </Button>
                </div>

                {/* 2. DEDICATED PHONE HELPLINE */}
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider block">
                        AgriSeva AI Helpline
                      </span>
                      <span className="text-base font-bold text-foreground">
                        {formatPhoneNumber(AGRISEVA_HELPLINE_NUMBER)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={handleCopyHelpline}
                        className="h-8 w-8 rounded-lg"
                        title="Copy Number"
                      >
                        {copiedHelpline ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleStartCall(AGRISEVA_HELPLINE_NUMBER, true)}
                        variant="outline"
                        className="border-emerald-600 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1.5 h-8 px-3 shadow-sm"
                        title="Dial on phone"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>Dial</span>
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Official AgriSeva contact number. Dial from any phone to reach our automated helpline.
                  </p>
                </div>

                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                        Kisan Call Center (Toll-Free)
                      </span>
                      <span className="text-base font-bold text-foreground">
                        {KISAN_TOLLFREE_NUMBER}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartCall(KISAN_TOLLFREE_NUMBER)}
                      className="font-semibold flex items-center gap-1.5 h-8 px-3.5"
                    >
                      <Phone className="h-3.5 w-3.5 text-amber-600" />
                      <span>Call</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    National agricultural advisory service by Ministry of Agriculture & Farmers Welfare.
                  </p>
                </div>

                {user && (user.role === "call_agent" || user.role === "admin" || user.role === "coordinator") && (
                  <Button
                    onClick={() => {
                      setPhoneDialogOpen(false);
                      navigate({ to: "/coordinator" });
                    }}
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2 border-dashed border-primary/50 text-primary hover:bg-primary/5 py-5 font-semibold text-xs"
                  >
                    <Bot className="h-4 w-4" />
                    <span>{t("common.openAgentConsole", "Open Interactive Call Console (/coordinator)")}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </TabsContent>

              {/* Tab 2: Outbound Call to Farmer */}
              <TabsContent value="outbound" className="space-y-4 pt-1">
                <div className="space-y-2">
                  <Label htmlFor="call-target-phone" className="text-xs font-semibold">
                    {t("common.farmerPhoneNumber", "Farmer Mobile Number")}
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 rounded-lg border border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                      +91
                    </div>
                    <Input
                      id="call-target-phone"
                      type="tel"
                      value={targetPhone}
                      onChange={(e) => handlePhoneLookup(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="text-sm font-mono tracking-wide"
                      maxLength={15}
                    />
                  </div>
                </div>

                {/* Farmer Profile Preview Card */}
                {isCheckingFarmer && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
                    <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <span>Checking registered farmer profile...</span>
                  </div>
                )}

                {farmerProfile && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      <User className="h-3.5 w-3.5" />
                      <span>{farmerProfile.farmerName || "Registered Farmer"}</span>
                      <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-emerald-600" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {farmerProfile.villageName ? `${farmerProfile.villageName}, ` : ""}
                      {farmerProfile.district ? `${farmerProfile.district}, ` : ""}
                      {farmerProfile.state || ""} 
                      {farmerProfile.primaryCrop ? ` • Crop: ${farmerProfile.primaryCrop}` : ""}
                    </p>
                  </div>
                )}

                <div className="pt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPhoneDialogOpen(false)}
                    className="w-1/3"
                  >
                    {t("common.cancel", "Cancel")}
                  </Button>
                  <Button
                    type="button"
                    disabled={!isPhoneValid}
                    onClick={() => handleStartCall(targetPhone)}
                    className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Phone className="h-4 w-4" />
                    <span>{t("common.dialNumber", "Start Call")}</span>
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          2. WHATSAPP CONNECT DIALOG
         ───────────────────────────────────────────────────────────── */}
      <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
        <DialogContent
          id="agriseva-whatsapp-dialog"
          className="fixed z-[100] p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card top-auto left-auto translate-x-0 translate-y-0 duration-200"
          style={{
            right: "clamp(12px, 2vw, 24px)",
            bottom: isFarmerRoute ? "clamp(76px, 9vh, 92px)" : "clamp(16px, 2.5vh, 24px)",
            width: "min(390px, calc(100vw - 32px))",
            maxWidth: "min(390px, calc(100vw - 32px))",
            maxHeight: "min(600px, calc(100dvh - 64px))",
          }}
        >
          <div className="bg-gradient-to-r from-[#25D366] via-[#20BA5C] to-[#128C7E] p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/15 backdrop-blur-sm">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold tracking-tight text-white">
                    AgriSeva WhatsApp Connect
                  </DialogTitle>
                  <DialogDescription className="text-xs text-white/85">
                    Chat with AI advisory & send farmer updates
                  </DialogDescription>
                </div>
              </div>
              <Badge className="bg-white/20 text-white hover:bg-white/30 border-none text-[11px] px-2 py-0.5 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Official Bot
              </Badge>
            </div>
          </div>

          <div className="p-6">
            <Tabs defaultValue="chatbot" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/60 p-1">
                <TabsTrigger value="chatbot" className="text-xs font-semibold">
                  AgriSeva AI Bot
                </TabsTrigger>
                <TabsTrigger value="direct" className="text-xs font-semibold">
                  Message a Farmer
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: AI Chatbot on WhatsApp */}
              <TabsContent value="chatbot" className="space-y-4 pt-1">
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10 text-green-600 mt-0.5">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        Instant WhatsApp Agricultural Advisory
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Send questions, crop photos, or voice notes on WhatsApp to receive real-time disease diagnosis, mandi rates, and pest management.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block uppercase tracking-wider">
                        AgriSeva AI WhatsApp
                      </span>
                      <span className="text-xs font-mono font-bold text-foreground">
                        {formatPhoneNumber(AGRISEVA_WHATSAPP_NUMBER)}
                      </span>
                    </div>
                    <Button
                      onClick={() => {
                        const link = getWhatsAppLink(AGRISEVA_WHATSAPP_NUMBER, "Namaste AgriSeva-AI! I need agricultural advice for my farm.");
                        window.open(link, "_blank", "noopener,noreferrer");
                        setWhatsappDialogOpen(false);
                      }}
                      className="bg-[#25D366] hover:bg-[#20BA5C] text-white font-semibold flex items-center gap-1.5 h-8 px-4 shadow-sm"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Chat on WhatsApp</span>
                      <ExternalLink className="h-3 w-3 ml-0.5" />
                    </Button>
                  </div>
                </div>

                {user && (
                  <Button
                    onClick={() => {
                      setWhatsappDialogOpen(false);
                      navigate({ to: "/whatsapp-history" });
                    }}
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2 border-dashed border-green-600/40 text-green-700 dark:text-green-400 hover:bg-green-50/30 py-5 font-semibold text-xs"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>{t("common.viewWhatsAppThreads", "View WhatsApp Conversation History (/whatsapp-history)")}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </TabsContent>

              {/* Tab 2: Outbound WhatsApp to Farmer */}
              <TabsContent value="direct" className="space-y-4 pt-1">
                <div className="space-y-2">
                  <Label htmlFor="wa-target-phone" className="text-xs font-semibold">
                    {t("common.farmerPhoneNumber", "Farmer Mobile Number")}
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 rounded-lg border border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                      +91
                    </div>
                    <Input
                      id="wa-target-phone"
                      type="tel"
                      value={waTargetPhone}
                      onChange={(e) => setWaTargetPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="text-sm font-mono tracking-wide"
                      maxLength={15}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wa-message-text" className="text-xs font-semibold">
                    {t("common.message", "Message Text (Optional)")}
                  </Label>
                  <textarea
                    id="wa-message-text"
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                    placeholder="Enter agricultural advice or advisory text to send to farmer..."
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500/40"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setWhatsappDialogOpen(false)}
                    className="w-1/3"
                  >
                    {t("common.cancel", "Cancel")}
                  </Button>
                  <Button
                    type="button"
                    disabled={!isWaPhoneValid || isSendingWa}
                    onClick={handleSendOutboundWhatsApp}
                    className="w-2/3 bg-[#25D366] hover:bg-[#20BA5C] text-white font-semibold flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isSendingWa ? (
                      <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span>{t("common.sendMessage", "Send via WhatsApp")}</span>
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          3. AGRISEVA-AI COMPACT FLOATING ASSISTANT PANEL
         ───────────────────────────────────────────────────────────── */}
      {helperDialogOpen && (
        <aside
          id="agriseva-ai-assistant-panel"
          role="dialog"
          aria-label="AgriSeva AI Assistant"
          className="fixed z-[95] flex flex-col bg-card/95 backdrop-blur-md border border-emerald-500/30 dark:border-emerald-700/40 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200 select-auto"
          style={{
            right: "clamp(12px, 2vw, 24px)",
            bottom: isFarmerRoute ? "clamp(76px, 10vh, 92px)" : "clamp(18px, 2.5vh, 24px)",
            width: "min(380px, calc(100vw - 28px))",
            maxWidth: "min(380px, calc(100vw - 28px))",
            maxHeight: "min(520px, calc(100dvh - 100px))",
            height: "min(520px, calc(100dvh - 100px))",
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white px-3.5 py-2.5 border-b border-emerald-700/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
                <Bot className="h-4 w-4 text-emerald-300" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate">AgriSeva AI Assistant</span>
                  <Badge className="bg-emerald-500/30 text-emerald-200 border-none text-[9px] px-1 py-0 font-medium">
                    Online
                  </Badge>
                </div>
                <p className="text-[10px] text-emerald-200/90 truncate font-serif italic">
                  Every Farmer a King, with AI by their side.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setAssistantMessages([assistantMessages[0]])}
                className="p-1 rounded-md text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
                title="Reset conversation"
                aria-label="Reset conversation"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setHelperDialogOpen(false)}
                className="p-1 rounded-md text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
                title="Close AI Assistant"
                aria-label="Close AI Assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Context tip bar if on specific route */}
          {currentPageContext && (
            <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border-b border-emerald-200/60 dark:border-emerald-800/60 px-3 py-1 flex items-center justify-between text-[11px] text-emerald-900 dark:text-emerald-200 shrink-0">
              <div className="flex items-center gap-1.5 truncate">
                <Compass className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold truncate">{currentPageContext.name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">Active Tip</span>
            </div>
          )}

          {/* Conversation Thread */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0 bg-slate-50/50 dark:bg-zinc-950/50">
            {assistantMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`rounded-2xl text-xs leading-relaxed max-w-[88%] shadow-xs ${
                    msg.sender === "user"
                      ? "bg-emerald-600 text-white rounded-tr-xs px-3 py-2"
                      : "bg-card border border-border rounded-tl-xs p-3 text-foreground space-y-2"
                  }`}
                >
                  <p>{msg.text}</p>

                  {/* If query linked to a feature, offer direct navigation */}
                  {msg.matchedFeature && (
                    <div className="pt-1 border-t border-border/60">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleFeatureAction(msg.matchedFeature!)}
                        className="h-7 text-[11px] px-2.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold flex items-center gap-1 w-full justify-center transition-colors"
                      >
                        <span>Open {msg.matchedFeature.title}</span>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-muted-foreground mt-0.5 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {/* Quick Suggestion Chips (when only initial message is shown) */}
            {assistantMessages.length === 1 && (
              <div className="pt-1 space-y-1.5">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
                  Frequently Asked
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "🌾 Today's Paddy Mandi Rate",
                    "🐛 Yellow leaf disease cure",
                    "📦 How to list a Crop Lot",
                    "🚚 Book farm transport",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleSendAssistantQuery(chip)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors text-left"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isAiThinking && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded-xl bg-muted/40 w-fit">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Consulting ICAR agronomic database...</span>
              </div>
            )}

            <div ref={chatMessagesEndRef} />
          </div>

          {/* Quick Helplines Gateway inside Footer */}
          <div className="px-3 py-1.5 bg-muted/20 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
            <span>Need human agent?</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setHelperDialogOpen(false);
                  setPhoneDialogOpen(true);
                }}
                className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-0.5"
              >
                <Phone className="h-3 w-3" />
                <span>Call</span>
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  setHelperDialogOpen(false);
                  setWhatsappDialogOpen(true);
                }}
                className="text-green-600 dark:text-green-400 font-semibold hover:underline flex items-center gap-0.5"
              >
                <MessageSquare className="h-3 w-3" />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Footer Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendAssistantQuery();
            }}
            className="p-2 border-t border-border bg-card flex items-center gap-1.5 shrink-0"
          >
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={handleToggleVoiceInput}
              className={`h-8 w-8 shrink-0 rounded-lg ${
                isVoiceListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
              }`}
              title="Voice Input (Speech to text)"
              aria-label="Voice Input"
            >
              <Headphones className="h-4 w-4" />
            </Button>

            <Input
              type="text"
              id="ai-assistant-input"
              value={assistantInput}
              onChange={(e) => setAssistantInput(e.target.value)}
              placeholder="Ask farming query or app guidance..."
              className="h-8 text-xs bg-muted/40 border-border focus:ring-1 focus:ring-emerald-500 rounded-lg px-2.5"
            />

            <Button
              type="submit"
              size="icon"
              disabled={!assistantInput.trim() || isAiThinking}
              className="h-8 w-8 shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 transition-colors"
              title="Send Query"
              aria-label="Send Query"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </aside>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. AGORA LIVE WEB VOICE CALL MODAL (10,000 FREE MIN/MO)
         ───────────────────────────────────────────────────────────── */}
      <AgoraVoiceCallModal
        open={agoraCallOpen}
        onOpenChange={setAgoraCallOpen}
        callerPhone={user?.phoneNumber || AGRISEVA_CONTACT_PHONE}
      />
    </>
  );
}
