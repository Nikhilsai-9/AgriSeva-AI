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

interface QuestionsAnswered120MinProps {
  whatsappCount: number;
  agrisevaCount: number;
}

export const QuestionsAnswered120Min = ({
  whatsappCount,
  agrisevaCount,
}: QuestionsAnswered120MinProps) => {
  const { t } = useTranslation();
  return (
    <Card className="relative">
      <CardHeader >
        <CardTitle className="text-base">{t("dashboard.answeredWithin120", "Questions Answered (≤120 minutes)")}</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {t("dashboard.responseAdherenceDesc", "Questions answered within 2 hours")}
        </p>
        <TopRightBadge label="new" left={0} />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* WhatsApp */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--color-chart-1)]" />
              <span className="text-sm font-medium">{t("dashboard.sourceWhatsApp", "WhatsApp")}</span>
            </div>
            <span className="text-2xl font-bold">
              <CountUp end={whatsappCount} duration={2} preserveValue />
            </span>
          </div>

          {/* AgriSeva-AI */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--color-chart-2)]" />
              <span className="text-sm font-medium">{t("dashboard.sourceAgriSeva", "AgriSeva-AI")}</span>
            </div>
            <span className="text-2xl font-bold">
              <CountUp end={agrisevaCount} duration={2} preserveValue />
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
