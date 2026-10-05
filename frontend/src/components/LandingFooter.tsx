import { Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Github,
  Mail,
  Globe,
  ExternalLink,
  Phone,
  MessageSquare,
  Sparkles,
  Building2,
  Sprout,
  Landmark,
  Scale,
  Award,
} from "lucide-react";
import { useTranslation } from "@/locales";
import { AGRISEVA_HELPLINE_NUMBER } from "@/components/GlobalCommunicationActions";

export function LandingFooter() {
  const { t } = useTranslation();

  return (
    <footer
      role="contentinfo"
      aria-label="AgriSeva Platform Footer"
      className="w-full border-t border-stone-200/80 bg-stone-50/95 dark:bg-stone-950/90 text-stone-700 dark:text-stone-300"
    >
      {/* 1. TOP BANNER / TRUST STRIP */}
      <div className="border-b border-stone-200/70 bg-emerald-950 text-emerald-100 py-2.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-medium tracking-wide">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {t(
                "footer.topBannerText",
                "National Agri-Stack & Verified Agricultural Networks"
              )}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-emerald-200/80">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Agmarknet Verified
            </span>
            <span className="text-emerald-700">•</span>
            <span className="flex items-center gap-1">
              <Landmark className="h-3.5 w-3.5 text-emerald-400" />
              eNAM Integrated
            </span>
            <span className="text-emerald-700">•</span>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              ICAR Science Grounded
            </span>
          </div>
        </div>
      </div>

      {/* 2. MAIN 5-COLUMN NAVIGATION GRID */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 text-xs">
          {/* Column 1: Farming Intelligence */}
          <div className="space-y-3">
            <p className="font-bold text-sm text-stone-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Sprout className="h-4 w-4 text-emerald-600" />
              {t("footer.colFarming", "Farming Intelligence")}
            </p>
            <ul className="space-y-2 font-medium">
              <li>
                <Link
                  to="/home"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {t("footer.aiAdvisory", "AI Crop Advisory")}
                </Link>
              </li>
              <li>
                <Link
                  to="/farmer/prices"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {t("footer.mandiPrices", "Mandi Market Rates")}
                </Link>
              </li>
              <li>
                <Link
                  to="/home"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {t("footer.weatherInsights", "Weather Forecasts")}
                </Link>
              </li>
              <li>
                <Link
                  to="/home"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {t("footer.soilHealth", "Soil & Nutrient Advice")}
                </Link>
              </li>
              <li>
                <Link
                  to="/home"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {t("footer.chemicalSafety", "Chemical Safety Verification")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Farmers & FPOs */}
          <div className="space-y-3">
            <p className="font-bold text-sm text-stone-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Building2 className="h-4 w-4 text-emerald-600" />
              {t("footer.colFarmers", "Farmers & FPOs")}
            </p>
            <ul className="space-y-2 font-medium">
              <li>
                <Link
                  to="/farmer"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {t("footer.farmerDashboard", "Farmer Dashboard")}
                </Link>
              </li>
              <li>
                <Link
                  to="/farmer/lots/new"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {t("footer.createLot", "List Harvest Lot")}
                </Link>
              </li>
              <li>
                <Link
                  to="/farmer/buyers"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {t("footer.verifiedBuyers", "Find Verified Buyers")}
                </Link>
              </li>
              <li>
                <Link
                  to="/farmer/recommend"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {t("footer.compareMarkets", "Compare Mandi Payouts")}
                </Link>
              </li>
              <li>
                <Link
                  to="/farmer/logistics"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {t("footer.storageLogistics", "Storage & Logistics")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Official Portals */}
          <div className="space-y-3">
            <p className="font-bold text-sm text-stone-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Landmark className="h-4 w-4 text-emerald-600" />
              {t("footer.colPortals", "Official Portals")}
            </p>
            <ul className="space-y-2 font-medium">
              <li>
                <a
                  href="https://agmarknet.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center gap-1 transition-colors"
                >
                  <span>{t("footer.agmarknet", "Agmarknet Directory")}</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </li>
              <li>
                <a
                  href="https://enam.gov.in/web/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center gap-1 transition-colors"
                >
                  <span>{t("footer.enam", "eNAM National Market")}</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </li>
              <li>
                <a
                  href="https://pmkisan.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center gap-1 transition-colors"
                >
                  <span>{t("footer.pmKisan", "PM-Kisan Portal")}</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </li>
              <li>
                <a
                  href="https://www.myscheme.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center gap-1 transition-colors"
                >
                  <span>{t("footer.myscheme", "MyScheme Central Portal")}</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </li>
              <li>
                <a
                  href="https://soilhealth.dac.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center gap-1 transition-colors"
                >
                  <span>{t("footer.soilCard", "Soil Health Card Scheme")}</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Support & Helplines */}
          <div className="space-y-3">
            <p className="font-bold text-sm text-stone-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Phone className="h-4 w-4 text-emerald-600" />
              {t("footer.colSupport", "Support & Helplines")}
            </p>
            <ul className="space-y-2 font-medium">
              <li>
                <a
                  href={`tel:${AGRISEVA_HELPLINE_NUMBER}`}
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center gap-1 transition-colors"
                >
                  <Phone className="h-3 w-3 text-emerald-600" />
                  <span>{t("footer.voiceHelpline", "Voice Helpline & Web Call")}</span>
                </a>
              </li>
              <li>
                <a
                  href="tel:18001801551"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center gap-1 transition-colors"
                >
                  <span>{t("footer.kisanCallCenter", "Kisan Call Center (1800-180-1551)")}</span>
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/919182417061"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center gap-1 transition-colors"
                >
                  <MessageSquare className="h-3 w-3 text-green-600" />
                  <span>{t("footer.whatsappBot", "WhatsApp AI Advisory")}</span>
                </a>
              </li>
              <li>
                <Link
                  to="/farmer/grievances"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {t("footer.disputes", "Grievance & Dispute Resolution")}
                </Link>
              </li>
              <li>
                <Link
                  to="/home"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {t("footer.experts", "ICAR & Extension Specialists")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 5: AgriSeva-AI Platform */}
          <div className="space-y-3">
            <p className="font-bold text-sm text-stone-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Award className="h-4 w-4 text-emerald-600" />
              {t("footer.colAbout", "AgriSeva-AI")}
            </p>
            <ul className="space-y-2 font-medium">
              <li>
                <a
                  href="#impact"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {t("footer.mission", "Mission & Impact")}
                </a>
              </li>
              <li>
                <Link
                  to="/privacy"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {t("footer.privacyPolicy", "Privacy Policy")}
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {t("footer.termsOfService", "Terms & Conditions")}
                </Link>
              </li>
              <li>
                <a
                  href="mailto:hello@agriseva.ai"
                  className="hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center gap-1 transition-colors"
                >
                  <Mail className="h-3 w-3 text-emerald-600" />
                  <span>{t("footer.contactUs", "Contact Team")}</span>
                </a>
              </li>
              <li>
                <span className="text-[11px] text-stone-500 font-mono">
                  {t("footer.contactEmail", "hello@agriseva.ai")}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 3. FEATURED INTEGRATIONS / REGISTRIES BAR (ADOBE STYLE) */}
      <div className="border-t border-stone-200/80 bg-white/60 dark:bg-stone-900/60 py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-stone-800 dark:text-stone-200 font-semibold">
            <span>{t("footer.featuredIntegrations", "Featured Integrations & Official Registries")}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "Agmarknet APMC", link: "https://agmarknet.gov.in/" },
              { label: "eNAM National", link: "https://enam.gov.in/web/" },
              { label: "PM-Kisan Stack", link: "https://pmkisan.gov.in/" },
              { label: "ICAR Kisan Portal", link: "https://icar.org.in/" },
              { label: "Open Agri Stack", link: "https://agristack.gov.in/" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-emerald-50 dark:bg-stone-800 dark:hover:bg-emerald-950 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-300 text-[11px] font-semibold transition-colors flex items-center gap-1"
              >
                <span>{item.label}</span>
                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* 4. BOTTOM LEGAL & SOCIAL STRIP */}
      <div className="border-t border-stone-200/70 bg-stone-100/80 dark:bg-stone-950 py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-stone-600 dark:text-stone-400">
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Nikhilsai-9/AgriSeva-AI"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-900 dark:hover:text-white transition-colors"
              aria-label="GitHub Repository"
            >
              <Github className="h-4 w-4" />
            </a>
            <a
              href="mailto:hello@agriseva.ai"
              className="hover:text-stone-900 dark:hover:text-white transition-colors"
              aria-label="Email AgriSeva"
            >
              <Mail className="h-4 w-4" />
            </a>
            <a
              href="https://wa.me/919182417061"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-900 dark:hover:text-white transition-colors"
              aria-label="WhatsApp"
            >
              <MessageSquare className="h-4 w-4" />
            </a>
            <span className="text-stone-300 dark:text-stone-700">|</span>
            <p className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>
                © {new Date().getFullYear()} AgriSeva-AI.{" "}
                {t("footer.builtForFarmers", "Built for Indian farmers.")}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/privacy"
              className="hover:text-stone-900 dark:hover:text-white underline-offset-2 hover:underline"
            >
              {t("footer.privacyPolicy", "Privacy Policy")}
            </Link>
            <span>•</span>
            <Link
              to="/terms"
              className="hover:text-stone-900 dark:hover:text-white underline-offset-2 hover:underline"
            >
              {t("footer.termsOfService", "Terms & Conditions")}
            </Link>
            <span>•</span>
            <a
              href="https://github.com/Nikhilsai-9/AgriSeva-AI"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-900 dark:hover:text-white inline-flex items-center gap-1"
            >
              <Github className="h-3 w-3" />
              <span>{t("footer.sourceCode", "Source Code")}</span>
            </a>
            <span>•</span>
            <span className="text-stone-500">
              {t(
                "footer.marketDataAttribution",
                "Official market data from Agmarknet & eNAM registries."
              )}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default LandingFooter;