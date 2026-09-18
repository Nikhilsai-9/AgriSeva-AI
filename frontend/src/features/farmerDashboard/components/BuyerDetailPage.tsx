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
} from "lucide-react";
import { useTranslation } from "@/locales";
import { useBuyer, useFarmerProfile, useMyLots } from "@/features/farmerDashboard/hooks/data";
import { computeBuyerMatch } from "@/features/farmerDashboard/hooks/use-market-match";
import {
  FarmerCard,
  FarmerPageContainer,
  FarmerSectionTitle,
} from "@/features/farmerDashboard/FarmerLayout";
import { formatDate } from "@/features/farmerDashboard/hooks/utils";

export function BuyerDetailPage({ buyerId }: { buyerId: string }) {
  const { t } = useTranslation();
  const { data: buyer } = useBuyer(buyerId);
  const { data: profile } = useFarmerProfile();
  const { data: lots } = useMyLots();
  const primaryLot =
    lots?.find((l) => l.status === "active") ?? lots?.[0] ?? null;
  const matchScore = buyer
    ? computeBuyerMatch(buyer, profile, primaryLot)
    : 0;

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
