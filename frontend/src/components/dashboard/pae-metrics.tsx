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

interface PAEMetricsProps {
  assigned: number;
  submitted: number;
  closed: number;
}

export const PAEMetrics = ({ assigned, submitted, closed }: PAEMetricsProps) => {
  const { t } = useTranslation();
  const total = assigned + submitted + closed;

  const calculatePercentage = (value: number) => {
    return total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  };

  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.paeMetricsTitle", "PAE (Principal Agri Experts)")}</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {t("dashboard.paeMetricsDesc", "Status breakdown of questions under PAE review")}
        </p>
        <TopRightBadge label="new" left={0} />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* PAE Assigned */}
          <div className="flex flex-col p-4 rounded-lg bg-muted">
            <span className="text-xs text-muted-foreground mb-2">{t("dashboard.paeAssigned", "PAE Assigned")}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                <CountUp end={assigned} duration={1.5} preserveValue />
              </span>
            </div>
          </div>

          {/* PAE Submitted */}
          <div className="flex flex-col p-4 rounded-lg bg-muted">
            <span className="text-xs text-muted-foreground mb-2">{t("dashboard.paeSubmitted", "PAE Submitted")}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                <CountUp end={submitted} duration={1.5} preserveValue />
              </span>
            </div>
          </div>

          {/* PAE Closed */}
          <div className="flex flex-col p-4 rounded-lg bg-muted">
            <span className="text-xs text-muted-foreground mb-2">{t("dashboard.paeClosed", "PAE Closed")}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                <CountUp end={closed} duration={1.5} preserveValue />
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
