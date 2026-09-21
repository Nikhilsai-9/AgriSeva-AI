"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/atoms/card";
import { useRestartOnView } from "@/hooks/ui/useRestartView";
import type { QuestionStatus } from "@/types";
import CountUp from "react-countup";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

import { useTranslation } from "@/locales";

export interface StatusOverview {
  questions: { status: QuestionStatus; value: number }[];
  answers: { status: string; value: number }[];
}
const colors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];
export const StatusCharts = ({ data }: { data: StatusOverview }) => {
  const { t } = useTranslation();
  const {ref, key,} = useRestartOnView()

  const getStatusLabel = (status: string) => {
    const s = status.toLowerCase().replace(/-/g, "_");
    if (s === "open") return t("dashboard.statusOpen", "Open");
    if (s === "in_review") return t("dashboard.statusInReview", "In Review");
    if (s === "closed") return t("dashboard.statusClosed", "Closed");
    if (s === "delayed") return t("dashboard.statusDelayed", "Delayed");
    if (s === "re_routed" || s === "rerouted") return t("dashboard.statusReRouted", "Re-routed");
    if (s === "hold") return t("dashboard.statusHold", "Hold");
    if (s === "pae_submitted") return t("dashboard.statusPaeSubmitted", "PAE Submitted");
    if (s === "draft") return t("dashboard.statusDraft", "Draft");
    if (s === "duplicate") return t("dashboard.statusDuplicate", "Duplicate");
    return status;
  };

  const translatedQuestions = data.questions.map((q) => ({
    ...q,
    displayStatus: getStatusLabel(q.status),
  }));

  const translatedAnswers = data.answers.map((a) => ({
    ...a,
    displayStatus: getStatusLabel(a.status),
  }));

  return (
    <div ref={ref} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("dashboard.questionStatusTitle", "Question Status Overview")}
            </CardTitle>
            <CardDescription>{t("dashboard.distributionQuestionStatuses", "Distribution of question statuses")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart key={`questionStatus-${key}`}>
                <Pie
                  data={translatedQuestions}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="displayStatus"
                  stroke="none"
                >
                  {translatedQuestions.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={colors[index % colors.length]}
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    color: "var(--color-foreground)",
                  }}
                  itemStyle={{
                    color: "var(--color-foreground)",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {translatedQuestions.map((item) => (
                <div
                  key={item.status}
                  className="p-3 rounded-lg bg-muted text-center"
                >
                  <p className="text-xs text-muted-foreground">{item.displayStatus}</p>
                  <p className="text-lg font-semibold text-foreground">
                    <CountUp key={`questionStatus-${key}`} end={item.value} duration={2} preserveValue />
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.answerStatusTitle", "Answer Status Overview")}</CardTitle>
            <CardDescription>{t("dashboard.distributionAnswerStatuses", "Distribution of answer statuses")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart key={`answerStatus-${key}`}>
                <Pie
                  data={translatedAnswers}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="displayStatus"
                  stroke="none"
                >
                  {translatedAnswers.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={colors[index % colors.length]}
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    color: "var(--color-foreground)",
                  }}
                  itemStyle={{
                    color: "var(--color-foreground)",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>

            <div className={`mt-6 grid grid-cols-2 gap-3`}>
              {translatedAnswers.map((item) => (
                <div
                  key={item.status}
                  className="p-3 rounded-lg bg-muted text-center"
                >
                  <p className="text-xs text-muted-foreground">{item.displayStatus}</p>
                  <p className="text-lg font-semibold text-foreground">
                    <CountUp key={`answerStatus-${key}`} end={item.value} duration={2} preserveValue />
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
