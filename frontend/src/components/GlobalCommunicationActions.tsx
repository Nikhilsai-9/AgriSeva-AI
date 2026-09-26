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
  DollarSign
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
    desc: "Call the Kisan Call Center (1800-180-1551) toll-free or initiate an instant in-browser WebRTC call.",
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

  const handleStartCall = (phoneNum: string) => {
    const normalized = normalizePhoneNumber(phoneNum);
    // If agent/admin, direct to coordinator call interface
    if (user && (user.role === "call_agent" || user.role === "admin" || user.role === "coordinator")) {
      setPhoneDialogOpen(false);
      navigate({ to: "/coordinator" });
      toast.info(`Launching Agent Call Console for ${formatPhoneNumber(normalized)}`);
    } else {
      // Direct device call
      window.location.href = getTelLink(normalized);
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

  return (
    <>
      {/* Persistent Floating Bottom-Right Stack in Exact Order: 1. Phone, 2. WhatsApp, 3. AgriSeva-AI Helper */}
      <aside 
        aria-label="AgriSeva Global Communication & AI Helper"
        className="fixed bottom-6 right-6 z-[90] flex flex-col items-center gap-3 select-none pointer-events-auto"
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
                className="group relative flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-xl shadow-emerald-700/30 hover:shadow-emerald-600/50 hover:scale-110 active:scale-95 transition-all duration-200 border-2 border-white/30 dark:border-zinc-800/50 focus:outline-none focus:ring-4 focus:ring-emerald-500/40"
              >
                <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-15 transition-opacity" />
                <Phone className="h-5 w-5 sm:h-6 sm:w-6 stroke-[2.2] fill-white/20" />
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
                className="group relative flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-gradient-to-tr from-[#25D366] via-[#20BA5C] to-[#128C7E] text-white shadow-xl shadow-green-600/30 hover:shadow-green-500/50 hover:scale-110 active:scale-95 transition-all duration-200 border-2 border-white/30 dark:border-zinc-800/50 focus:outline-none focus:ring-4 focus:ring-[#25D366]/40"
              >
                <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-15 transition-opacity" />
                <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 stroke-[2.2] fill-white/20" />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs font-semibold py-1.5 px-3 bg-zinc-900 text-white shadow-xl border border-zinc-700">
              {t("common.whatsappHelp", "2. WhatsApp AI Assistance & Chat")}
            </TooltipContent>
          </Tooltip>

          {/* 3. AgriSeva-AI Helper Floating Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                id="floating-helper-action-btn"
                aria-label="Open AgriSeva-AI Product & Navigation Helper"
                onClick={() => setHelperDialogOpen(true)}
                className="group relative flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-emerald-600 to-teal-700 text-white shadow-2xl shadow-emerald-700/40 hover:shadow-emerald-600/60 hover:scale-110 active:scale-95 transition-all duration-200 border-2 border-white/40 dark:border-zinc-800/60 focus:outline-none focus:ring-4 focus:ring-amber-400/50"
              >
                <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
                <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 stroke-[2.2] text-amber-200 animate-pulse" />
                <Bot className="h-4 w-4 absolute -bottom-0.5 -right-0.5 text-white bg-emerald-800 rounded-full p-0.5 border border-white" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs font-semibold py-1.5 px-3 bg-zinc-900 text-white shadow-xl border border-zinc-700">
              {t("common.helper", "3. AgriSeva-AI Product Helper & Guide")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          1. PHONE HELPLINE & DIALER DIALOG
         ───────────────────────────────────────────────────────────── */}
      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card">
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
                        onClick={() => handleStartCall(AGRISEVA_HELPLINE_NUMBER)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 h-8 px-3.5 shadow-sm"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>Call</span>
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Automated multilingual agricultural query resolution powered by Plivo WebRTC and Grounded AI.
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
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card">
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

      {/* 3. AGRISEVA-AI HELPER DIALOG (Product Navigation & Feature Guidance) */}
      <Dialog open={helperDialogOpen} onOpenChange={setHelperDialogOpen}>
        <DialogContent 
          id="agriseva-ai-helper-dialog"
          className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden border border-emerald-200 dark:border-emerald-800 shadow-2xl rounded-2xl"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white p-5 border-b border-emerald-700/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                  <Sparkles className="h-5 w-5 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                    AgriSeva-AI Helper
                    <Badge className="bg-amber-400 text-emerald-950 text-[10px] font-bold px-1.5 py-0.5 uppercase tracking-wider">
                      Guide
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-emerald-100/90 mt-0.5">
                    Your real-time product navigation & feature guidance assistant
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Search / Ask Feature Bar */}
            <div className="mt-4 relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-emerald-200" />
              <input
                type="text"
                id="helper-search-input"
                value={helperQuery}
                onChange={(e) => setHelperQuery(e.target.value)}
                placeholder="Ask e.g. 'How to check mandi price?', 'How to create lot?', 'Tractor'..."
                className="w-full bg-white/10 placeholder:text-emerald-200/70 text-white rounded-xl pl-9 pr-4 py-2 text-xs border border-white/20 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:bg-white/20 transition-all"
              />
              {helperQuery && (
                <button
                  type="button"
                  onClick={() => setHelperQuery("")}
                  className="absolute right-3 top-2.5 text-emerald-200 hover:text-white text-xs font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-zinc-950">
            {/* Context-Aware Quick Tips for Current Page */}
            {currentPageContext && !helperQuery && (
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/40 dark:border-emerald-800 text-xs space-y-1.5 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
                  <Compass className="h-4 w-4" />
                  <span>💡 Current Page Guide: {currentPageContext.name}</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {currentPageContext.tip}
                </p>
              </div>
            )}

            {/* Search Results / Unsupported Query Warning */}
            {helperQuery.trim() !== "" ? (
              <div className="space-y-3">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                  Search & Guidance Results
                </div>

                {isUnsupportedFeatureQuery(helperQuery) && (
                  <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                      <AlertCircle className="h-4 w-4" />
                      <span>Feature Notice</span>
                    </div>
                    <p className="leading-relaxed">
                      This capability (such as buying heavy equipment/tractors or direct bank loans) is not currently offered in AgriSeva-AI. AgriSeva-AI specializes strictly in <strong>Mandi Market Intelligence, Grounded Agronomic Q&A, Crop Lots, Logistics, and Direct Buyer Offers</strong>.
                    </p>
                  </div>
                )}

                {filteredFeatures.length === 0 && !isUnsupportedFeatureQuery(helperQuery) ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    No exact feature matches found for "{helperQuery}". Try asking about <em>mandi price, compare markets, voice, crop disease, lots, offers, call, or WhatsApp</em>.
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {filteredFeatures.map((feat) => (
                      <div
                        key={feat.id}
                        className="p-3 rounded-xl border border-border bg-card hover:border-emerald-400 hover:shadow-md transition-all flex items-start justify-between gap-3 group"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                              {feat.title}
                            </span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">
                              {feat.category}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            {feat.desc}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleFeatureAction(feat)}
                          className="text-xs h-8 px-3 shrink-0 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 transition-colors flex items-center gap-1 font-semibold"
                        >
                          <span>Open</span>
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Default State: Quick Feature Actions */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Core Product Capabilities
                  </div>
                  <span className="text-[10px] text-muted-foreground">Click to navigate</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-2">
                  {FEATURE_REGISTRY.map((feat) => (
                    <button
                      key={feat.id}
                      type="button"
                      onClick={() => handleFeatureAction(feat)}
                      className="p-2.5 text-left rounded-xl border border-border bg-card hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 hover:shadow-sm transition-all flex flex-col justify-between group"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                            {feat.title}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <p className="text-[10.5px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {feat.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Direct Helplines Gateway inside Helper */}
                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      Need Direct Human Assistance?
                    </div>
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Call our agricultural helpline or message on WhatsApp.
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => {
                        setHelperDialogOpen(false);
                        setPhoneDialogOpen(true);
                      }}
                      className="h-8 px-2.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1 shadow-sm font-semibold"
                    >
                      <Phone className="h-3 w-3" />
                      <span>Call</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setHelperDialogOpen(false);
                        setWhatsappDialogOpen(true);
                      }}
                      className="h-8 px-2.5 text-xs bg-[#25D366] hover:bg-[#20BA5C] text-white flex items-center gap-1 shadow-sm font-semibold"
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span>WhatsApp</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
