import React, { useState } from "react";
import { Phone, MessageSquare, ExternalLink, Bot, User, CheckCircle2, Headphones, Sparkles, Send, Copy, Check } from "lucide-react";
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
import { useNavigate } from "@tanstack/react-router";
import { plivoService } from "@/hooks/api/plivo/api";
import { normalizePhoneNumber, isValidPhoneNumber, formatPhoneNumber, getWhatsAppLink, getTelLink } from "@/lib/phoneNumber";
import { toast } from "sonner";
import { apiFetch } from "@/hooks/api/api-fetch";
import { env } from "@/config/env";

export const AGRISEVA_HELPLINE_NUMBER = "+919606751041";
export const KISAN_TOLLFREE_NUMBER = "1800-180-1551";

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

  const handleCopyHelpline = () => {
    navigator.clipboard.writeText(AGRISEVA_HELPLINE_NUMBER);
    setCopiedHelpline(true);
    toast.success("Helpline number copied to clipboard");
    setTimeout(() => setCopiedHelpline(false), 2500);
  };

  return (
    <>
      {/* Persistent Floating Bottom-Right Stack */}
      <aside 
        aria-label="AgriSeva Global Communication Helplines"
        className="fixed bottom-6 right-6 z-[90] flex flex-col items-center gap-3 select-none pointer-events-auto"
      >
        <TooltipProvider delayDuration={200}>
          {/* WhatsApp Floating Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                id="floating-whatsapp-action-btn"
                aria-label="Open AgriSeva WhatsApp Assistance"
                onClick={() => setWhatsappDialogOpen(true)}
                className="group relative flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-tr from-[#25D366] via-[#20BA5C] to-[#128C7E] text-white shadow-xl shadow-green-600/30 hover:shadow-green-500/50 hover:scale-110 active:scale-95 transition-all duration-200 border-2 border-white/30 dark:border-zinc-800/50 focus:outline-none focus:ring-4 focus:ring-[#25D366]/40"
              >
                <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-15 transition-opacity" />
                <MessageSquare className="h-6 w-6 stroke-[2.2] fill-white/20" />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs font-semibold py-1.5 px-3 bg-zinc-900 text-white shadow-xl border border-zinc-700">
              {t("common.whatsappHelp", "WhatsApp AI Assistance & Chat")}
            </TooltipContent>
          </Tooltip>

          {/* Phone Helpline Floating Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                id="floating-phone-action-btn"
                aria-label="Open AgriSeva Voice Helpline & Dialer"
                onClick={() => setPhoneDialogOpen(true)}
                className="group relative flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-xl shadow-emerald-700/30 hover:shadow-emerald-600/50 hover:scale-110 active:scale-95 transition-all duration-200 border-2 border-white/30 dark:border-zinc-800/50 focus:outline-none focus:ring-4 focus:ring-emerald-500/40"
              >
                <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-15 transition-opacity" />
                <Phone className="h-6 w-6 stroke-[2.2] fill-white/20" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs font-semibold py-1.5 px-3 bg-zinc-900 text-white shadow-xl border border-zinc-700">
              {t("common.voiceHelp", "Voice Helpline & Calling")}
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
                    <span className="text-xs font-mono font-bold text-foreground">
                      +91 96067 51041
                    </span>
                    <Button
                      onClick={() => {
                        const link = getWhatsAppLink(AGRISEVA_HELPLINE_NUMBER, "Namaste AgriSeva, I need agricultural advice for my crops.");
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
    </>
  );
}
