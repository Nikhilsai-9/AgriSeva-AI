"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/atoms/card";

import { TopRightBadge } from "../NewBadge";
import { useTranslation } from "@/locales";

interface AverageResponseTimeProps {
  whatsappAvgTime: number;
  agrisevaAvgTime: number;
}

export const AverageResponseTime = ({
  whatsappAvgTime,
  agrisevaAvgTime,
}: AverageResponseTimeProps) => {
  const { t } = useTranslation();

  const formatHours = (hours: number) => {
    const totalMinutes = Math.round(hours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    const minsUnit = t("dashboard.minutesUnit", "mins");
    const hrsUnit = t("dashboard.hoursUnit", "hrs");
    const hrUnit = t("dashboard.hourUnit", "hr");

    if (hrs === 0) {
      return `${mins} ${minsUnit}`;
    }

    if (mins === 0) {
      return `${hrs} ${hrsUnit}`;
    }

    return `${hrs} ${hrUnit} ${mins} ${minsUnit}`;
  };

  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle className="text-base">
          {t("dashboard.avgResponseTimeTitle", "Average Response Time")}
        </CardTitle>

        <p className="text-sm text-muted-foreground mt-1">
          {t("dashboard.avgResponseTimeDesc", "Average time to answer questions")}
        </p>

        <TopRightBadge label="new" left={0} />
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* WhatsApp */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--color-chart-1)]" />

              <span className="text-sm font-medium">
                {t("dashboard.sourceWhatsApp", "WhatsApp")}
              </span>
            </div>

            <div className="text-right">
              <span className="text-xl font-bold">
                {formatHours(whatsappAvgTime)}
              </span>
            </div>
          </div>

          {/* AgriSeva-AI */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--color-chart-2)]" />

              <span className="text-sm font-medium">
                {t("dashboard.sourceAgriSeva", "AgriSeva-AI")}
              </span>
            </div>

            <div className="text-right">
              <span className="text-xl font-bold">
                {formatHours(agrisevaAvgTime)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};