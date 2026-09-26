import React, { useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import {
  useFarmerProfile,
  useUpdateFarmerProfile,
} from "@/features/farmerDashboard/hooks/data";
import {
  isValidPhoneNumber,
  normalizePhoneNumber,
} from "@/lib/phoneNumber";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/atoms/dialog";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { Phone, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/locales";

export function ContactOnboardingModal() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const { data: profile, isLoading } = useFarmerProfile();
  const updateProfile = useUpdateFarmerProfile();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If user is not authenticated or profile is loading, do not show
  if (!isAuthenticated || !user || isLoading) {
    return null;
  }

  // If user already has a valid phone in their profile or auth store, do not show
  const existingPhone = profile?.phone || user.phone;
  if (existingPhone && isValidPhoneNumber(existingPhone)) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      setError(t("onboarding.phoneRequired", "Please enter your 10-digit mobile number."));
      return;
    }

    if (!isValidPhoneNumber(trimmed)) {
      setError(
        t(
          "onboarding.phoneInvalid",
          "Please enter a valid 10-digit Indian mobile number (e.g. 9876543210)."
        )
      );
      return;
    }

    const normalized = normalizePhoneNumber(trimmed);

    setIsSubmitting(true);
    try {
      await updateProfile.mutateAsync({
        phone: normalized,
      });
      useAuthStore.getState().updateUser({ phone: normalized });
      toast.success(
        t("onboarding.phoneSaved", "Contact number verified and saved successfully!")
      );
    } catch (err: any) {
      console.error("[ContactOnboardingModal] Failed to save contact number:", err);
      setError(
        err?.message ||
          t("onboarding.phoneSaveError", "Failed to save contact number. Please try again.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header with gradient banner */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
              <Phone className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-white">
                {t("onboarding.contactTitle", "Add your contact number")}
              </DialogTitle>
              <DialogDescription className="text-xs text-white/85 mt-0.5">
                {t("onboarding.contactBadge", "Essential Step • AgriSeva-AI Communication Setup")}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t(
              "onboarding.contactDesc",
              "Your contact number helps AgriSeva-AI provide communication and calling/WhatsApp-related services."
            )}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="onboarding-phone-input" className="text-xs font-semibold text-foreground">
                {t("onboarding.mobileNumber", "Mobile Number")}
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center px-3 py-2 rounded-xl border border-input bg-muted/50 text-xs font-bold text-foreground select-none">
                  🇮🇳 +91
                </div>
                <Input
                  id="onboarding-phone-input"
                  type="tel"
                  autoFocus
                  placeholder="9876543210"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl text-sm"
                  maxLength={14}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("onboarding.phoneHint", "Enter your 10-digit mobile number without country code.")}
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                {error}
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t("onboarding.saving", "Saving contact number...")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("onboarding.continue", "Continue")}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>{t("onboarding.privacyAssurance", "Your phone number is securely stored and never shared with 3rd parties.")}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
