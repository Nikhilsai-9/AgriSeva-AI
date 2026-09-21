import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Factory,
  Star,
  MapPin,
  Phone,
  Globe,
  Mail,
  Calendar,
  HandCoins,
  ShieldCheck,
  Award,
  TrendingUp,
  Package,
} from "lucide-react";
import { useTranslation } from "@/locales";
import {
  useBuyer,
  useFarmerProfile,
  useMyLots,
  useAllMarketPrices,
  useGrievances,
} from "@/features/farmerDashboard/hooks/data";
import { computeBuyerMatch } from "@/features/farmerDashboard/hooks/use-market-match";
import {
  reliabilityEvidence,
  computeRealisableValue,
} from "@/features/farmerDashboard/market-intelligence";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import { formatDate, formatKg, formatRupees } from "@/features/farmerDashboard/hooks/utils";
import { cn } from "@/lib/utils";

export function BuyerDetailPage({ buyerId }: { buyerId: string }) {
  const { t } = useTranslation();
  const { data: buyer } = useBuyer(buyerId);
  const { data: profile } = useFarmerProfile();
  const { data: lots } = useMyLots();
  const { data: prices } = useAllMarketPrices();
  const { data: grievances } = useGrievances();
  const primaryLot =
    lots?.find((l) => l.status === "active") ?? lots?.[0] ?? null;
  const matchScore = buyer
    ? computeBuyerMatch(buyer, profile, primaryLot ?? undefined)
    : 0;

  // Market intelligence derived values.
  const reliability = buyer
    ? reliabilityEvidence(buyer, grievances ?? [])
    : null;
  // Find the best mandi price for the primary lot's crop.
  const lotPrice = primaryLot
    ? (prices ?? []).find((p) => p.crop === primaryLot.crop)
    : undefined;
  const expectedEarning =
    buyer && primaryLot && lotPrice
      ? computeRealisableValue({
          lot: primaryLot,
          price: lotPrice,
          logistics: { distanceKm: buyer.distanceKm },
        })
      : null;
  // Quality & demand fit — uses reliability sub-scores (qualitative).
  const qualityFit = buyer
    ? Math.round(
        ((buyer.verificationStatus === "verified" ? 100 : 60) +
          (primaryLot?.qualityGrade === "A"
            ? 100
            : primaryLot?.qualityGrade === "B"
              ? 75
              : 50)) /
          2,
      )
    : 0;
  const quantityFit = primaryLot
    ? primaryLot.quantityKg >= (buyer?.minQuantityKg ?? 0) &&
      primaryLot.quantityKg <= (buyer?.maxQuantityKg ?? Infinity)
    : false;

  if (!buyer) {
    return (
      <FarmerPageContainer>
        <FarmerCard className="p-6 text-center text-emerald-900/70">
          {t("farmer.buyerDetail.notFound", "Buyer not found.")}
        </FarmerCard>
      </FarmerPageContainer>
    );
  }

  return (
    <FarmerPageContainer className="space-y-5">
      <Link
        to="/farmer/buyers"
        className="inline-flex items-center gap-1 text-sm text-emerald-700 font-semibold"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("farmer.common.back", "Back")}
      </Link>

      <FarmerCard className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Factory className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl sm:text-2xl font-bold text-emerald-900 truncate">
              {buyer.name}
            </p>
            <p className="text-sm text-emerald-900/70 truncate">{buyer.type}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-1 rounded-full font-semibold">
                <Star className="h-3 w-3 text-amber-500" />
                {buyer.rating.toFixed(1)}
              </span>
              <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-700 px-2 py-1 rounded-full">
                {buyer.completedDeals} {t("farmer.buyers.deals", "deals")}
              </span>
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-1 rounded-full font-semibold">
                {t("farmer.buyers.matchScore", "Match")} {matchScore}%
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <DetailRow icon={<MapPin className="h-4 w-4" />} label={t("farmer.buyerDetail.location", "Location")}>
            {buyer.location}
          </DetailRow>
          {buyer.phone && (
            <DetailRow icon={<Phone className="h-4 w-4" />} label={t("farmer.buyerDetail.phone", "Phone")}>
              {buyer.phone}
            </DetailRow>
          )}
          {buyer.email && (
            <DetailRow icon={<Mail className="h-4 w-4" />} label={t("farmer.buyerDetail.email", "Email")}>
              {buyer.email}
            </DetailRow>
          )}
          {buyer.website && (
            <DetailRow icon={<Globe className="h-4 w-4" />} label={t("farmer.buyerDetail.website", "Website")}>
              {buyer.website}
            </DetailRow>
          )}
          <DetailRow icon={<Calendar className="h-4 w-4" />} label={t("farmer.buyerDetail.memberSince", "Member since")}>
            {formatDate(buyer.memberSince)}
          </DetailRow>
          <DetailRow icon={<HandCoins className="h-4 w-4" />} label={t("farmer.buyerDetail.preferredPayment", "Payment")}>
            {buyer.preferredPayment}
          </DetailRow>
        </div>
      </FarmerCard>

      <FarmerCard className="p-5">
        <FarmerSectionTitle>
          {t("farmer.buyerDetail.cropsOfInterest", "Crops of interest")}
        </FarmerSectionTitle>
        <div className="flex flex-wrap gap-2">
          {buyer.cropsInterested.map((c) => (
            <span
              key={c}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800"
            >
              {c}
            </span>
          ))}
        </div>
      </FarmerCard>

      <FarmerCard className="p-5">
        <FarmerSectionTitle>
          {t("farmer.buyerDetail.notes", "About")}
        </FarmerSectionTitle>
        <p className="text-sm text-emerald-900/80 leading-relaxed">{buyer.notes}</p>
      </FarmerCard>

      {/* Trust & Reliability — market intelligence */}
      {reliability ? (
        <FarmerCard className="p-5">
          <FarmerSectionTitle
            hint={t(
              "farmer.buyerDetail.reliabilityEvidence",
              "Why this score",
            )}
            action={
              <span
                className={cn(
                  "text-2xl font-extrabold",
                  reliability.suppressed
                    ? "text-stone-500"
                    : reliability.score! >= 80
                      ? "text-emerald-700"
                      : reliability.score! >= 60
                        ? "text-sky-700"
                        : reliability.score! >= 40
                          ? "text-amber-700"
                          : "text-rose-700",
                )}
              >
                {reliability.suppressed ? "—" : `${reliability.score}`}
              </span>
            }
          >
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              {t("farmer.buyerDetail.reliability", "Trust & reliability")}
            </span>
          </FarmerSectionTitle>
          <p className="text-xs font-semibold text-emerald-900 mb-2">
            {t("farmer.buyerDetail.reliabilityTier", "Tier")}:{" "}
            <span className="text-emerald-700">{reliability.tierLabel}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {reliability.evidence.map((e, i) => (
              <span
                key={i}
                className={cn(
                  "text-xs font-semibold px-2 py-1 rounded-full",
                  e.tone === "positive" && "bg-emerald-100 text-emerald-800",
                  e.tone === "neutral" && "bg-stone-100 text-stone-700",
                  e.tone === "negative" && "bg-rose-100 text-rose-800",
                )}
              >
                {e.label}
              </span>
            ))}
          </div>
        </FarmerCard>
      ) : null}

      {/* Quality & Demand — market intelligence */}
      <FarmerCard className="p-5">
        <FarmerSectionTitle
          action={
            <span
              className={cn(
                "text-lg font-extrabold",
                qualityFit >= 75
                  ? "text-emerald-700"
                  : qualityFit >= 50
                    ? "text-amber-700"
                    : "text-rose-700",
              )}
            >
              {qualityFit}/100
            </span>
          }
        >
          <span className="inline-flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-700" />
            {t("farmer.buyerDetail.quality", "Quality & demand fit")}
          </span>
        </FarmerSectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-900/60">
              {t("farmer.buyerDetail.gradeMatch", "Grade match")}
            </p>
            <p className="text-sm text-emerald-900">
              {primaryLot
                ? `${primaryLot.qualityGrade} lot vs ${buyer.verificationStatus === "verified" ? "verified" : "unverified"} buyer`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-900/60">
              {t("farmer.buyerDetail.quantityRange", "Quantity range")}
            </p>
            <p className="text-sm text-emerald-900">
              {buyer.minQuantityKg}–{buyer.maxQuantityKg} kg
              {primaryLot ? (
                <span
                  className={cn(
                    "ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                    quantityFit
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800",
                  )}
                >
                  {quantityFit
                    ? t("farmer.buyers.verified", "Verified buyer")
                    : t("farmer.lotDetail.noOffers", "No offers yet")}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </FarmerCard>

      {/* Expected earning — market intelligence */}
      {expectedEarning && primaryLot ? (
        <FarmerCard className="p-5 bg-gradient-to-br from-emerald-50 to-white">
          <FarmerSectionTitle
            hint={t(
              "farmer.buyerDetail.expectedEarningHint",
              "If you sell your active lot here",
            )}
            action={
              <span className="text-2xl font-extrabold text-emerald-900">
                {formatRupees(expectedEarning.net)}
              </span>
            }
          >
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-700" />
              {t("farmer.buyerDetail.expectedEarning", "Expected earning")}
            </span>
          </FarmerSectionTitle>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <EarningStat
              icon={<Package className="h-4 w-4" />}
              label={t("farmer.recommend.colGross", "Gross")}
              value={formatRupees(expectedEarning.gross)}
            />
            <EarningStat
              icon={<TrendingUp className="h-4 w-4" />}
              label={t("farmer.recommend.colDeductions", "Deductions")}
              value={formatRupees(expectedEarning.breakdown.total)}
            />
            <EarningStat
              icon={<HandCoins className="h-4 w-4" />}
              label={t("farmer.recommend.colNet", "Net realisable")}
              value={formatRupees(expectedEarning.net)}
            />
          </div>
          <p className="text-[10px] text-emerald-900/60 mt-2">
            {formatKg(primaryLot.quantityKg)} • {primaryLot.crop} • Grade{" "}
            {primaryLot.qualityGrade} • {buyer.distanceKm} km
          </p>
        </FarmerCard>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          to="/farmer/lots/new"
          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-emerald-700 transition-colors"
        >
          {t("farmer.buyerDetail.createLotForBuyer", "Create lot for this buyer")}
        </Link>
      </div>
    </FarmerPageContainer>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-emerald-700">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-900/60">
          {label}
        </p>
        <p className="text-sm text-emerald-900 break-words">{children}</p>
      </div>
    </div>
  );
}

function EarningStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-emerald-700">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-900/60">
          {label}
        </span>
      </div>
      <span className="text-sm font-bold text-emerald-900 break-words">
        {value}
      </span>
    </div>
  );
}
