"use client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/atoms/card";
import CountUp from "react-countup";
import { TopRightBadge } from "../NewBadge";
import { useTranslation } from "@/locales";

interface QuestionsAnsweredAfter120MinProps {
  whatsappCount: number;
  agrisevaCount: number;
  questionsStateBreakdown?: {
    whatsapp: { status: string; count: number }[];
    agriseva: { status: string; count: number }[];
  };
}

export const QuestionsAnsweredAfter120MinProps = ({
  whatsappCount,
  agrisevaCount,
  questionsStateBreakdown,
}: QuestionsAnsweredAfter120MinProps) => {
  const { t } = useTranslation();

  const getStatusLabel = (status: string) => {
    const s = status.toLowerCase().replace(/-/g, "_");
    if (s === "open") return t("dashboard.statusOpen", "Open");
    if (s === "in_review") return t("dashboard.statusInReview", "In Review");
    if (s === "closed") return t("dashboard.statusClosed", "Closed");
    if (s === "delayed") return t("dashboard.statusDelayed", "Delayed");
    if (s === "re_routed" || s === "rerouted") return t("dashboard.statusReRouted", "Re-routed");
    if (s === "hold") return t("dashboard.statusHold", "Hold");
    if (s === "pae_submitted") return t("dashboard.statusPaeSubmitted", "PAE Submitted");
    return status;
  };

  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.answeredAfter120", "Questions Answered (>120 minutes)")}</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {t("dashboard.answeredAfter120Desc", "Questions answered after 2 hours")}
        </p>
        <TopRightBadge label="new" left={0} />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--color-chart-1)]" />
              <span className="text-sm font-medium">{t("dashboard.sourceWhatsApp", "WhatsApp")}</span>
            </div>
            <span className="text-2xl font-bold">
              <CountUp end={whatsappCount} duration={2} preserveValue />
            </span>      
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
          {questionsStateBreakdown?.whatsapp?.map((item) => (
            <div
              key={item.status}
              className="p-3 rounded-lg bg-muted text-center"
            >
              <p className="text-xs text-muted-foreground">{getStatusLabel(item.status)}</p>
              <p className="text-lg font-semibold text-foreground">
                <CountUp end={item.count} duration={2} preserveValue />
              </p>
            </div>
          ))}
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--color-chart-2)]" />
              <span className="text-sm font-medium">{t("dashboard.sourceAgriSeva", "AgriSeva-AI")}</span>
            </div>
            <span className="text-2xl font-bold">
              <CountUp end={agrisevaCount} duration={2} preserveValue />
            </span>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
          {questionsStateBreakdown?.agriseva?.map((item) => (
            <div
              key={item.status}
              className="p-3 rounded-lg bg-muted text-center"
            >
              <p className="text-xs text-muted-foreground">{getStatusLabel(item.status)}</p>
              <p className="text-lg font-semibold text-foreground">
                <CountUp end={item.count} duration={2} preserveValue />
              </p>
            </div>
          ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
