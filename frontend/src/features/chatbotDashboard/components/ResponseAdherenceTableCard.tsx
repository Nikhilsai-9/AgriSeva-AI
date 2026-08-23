import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/card";
import { Button } from "@/components/atoms/button";
import { useState } from "react";
import { Calendar } from "@/components/atoms/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/atoms/popover";
import { CalendarIcon, ClipboardCheck, Download, InfoIcon, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/atoms/accordion";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/atoms/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/atoms/tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { BreakdownTooltip } from "@/components/atoms/source-breakdown-tooltip";

type ResponseAdherenceTableData = {
  date: string;
  time: string;
  timeWindow: string;
  whatsappQueriesAsked: number;
  agrisevaQueriesAsked: number;
  manualQueriesAsked: number;
  whatsappPushedToReviewer: number;
  agrisevaPushedToReviewer: number;
  manualPushedToReviewer: number;
  whatsappAnsweredWithin120Min: number;
  agrisevaAnsweredWithin120Min: number;
  manualAnsweredWithin120Min: number;
  whatsappMarkedDuplicate: number;
  agrisevaMarkedDuplicate: number;
  manualMarkedDuplicate: number;
  whatsappDynamicWeather: number;
  agrisevaDynamicWeather: number;
  manualDynamicWeather: number;
  whatsappDynamicMarket: number;
  agrisevaDynamicMarket: number;
  manualDynamicMarket: number;
  whatsappDynamicSchemes: number;
  agrisevaDynamicSchemes: number;
  manualDynamicSchemes: number;
  // whatsappNonGdbWithin120: number;
  // agrisevaNonGdbWithin120: number;
  // manualNonGdbWithin120: number;
  whatsappInReview: number;
  agrisevaInReview: number;
  manualInReview: number;
  whatsappOpen: number;
  agrisevaOpen: number;
  manualOpen: number;
  whatsappDelayed: number;
  agrisevaDelayed: number;
  manualDelayed: number;

            whatsappClosedCount: number;
        whatsappPendingCount: number;
        whatsappNonAgriCount: number;
        whatsappDynamicCount: number;
        whatsappDuplicateCount: number;
        whatsappHoldCount: number;
        whatsappPaeSubmitedCount: number;
        whatsappDynamicCLosedCount: number;
        whatsappReroutedCount: number;
        whatsappPassCount: number;
        whatsappDuplicateClosedCount: number;

      agrisevaClosedCount: number;
    agrisevaPendingCount: number;
    agrisevaNonAgriCount: number;
    agrisevaDynamicCount: number;
    agrisevaDuplicateCount: number;
    agrisevaHoldCount: number;
    agrisevaPaeSubmitedCount:number;
    agrisevaDynamicCLosedCount: number;
    agrisevaReroutedCount: number;
    agrisevaPassCount: number;
    agrisevaDuplicateClosedCount:number;

      manualClosedCount: number;
    manualPendingCount: number;
    manualNonAgriCount:number;
    manualDynamicCount: number;
    manualDuplicateCount: number;
    manualHoldCount: number;
    manualPaeSubmitedCount:number;
    manualDynamicCLosedCount: number;
    manualReroutedCount: number;
    manualPassCount: number;
    manualDuplicateClosedCount:number;

                  manualAverageResponseGBDMinutes: number;
    manualAverageResponseNonGBDMinutes: number;
    whatsappAverageResponseGBDMinutes:number;
        whatsappAverageResponseNonGBDMinutes:number;
            agrisevaAverageResponseGBDMinutes: number;
    agrisevaAverageResponseNonGBDMinutes: number;

  whatsappAverageResponseMinutes: number;
  agrisevaAverageResponseMinutes: number;
  manualAverageResponseMinutes: number;
  whatsappAdherencePct: number;
  agrisevaAdherencePct: number;
  manualAdherencePct: number;
  manualTotal: number;
  agriexpertTotal: number;
  outreachTotal: number;
  answeredWithin120MinClosedwhatsapp: number;
  answeredWithin120MinPasswhatsapp: number;
  answeredWithin120MinDynamicClosedwhatsapp: number;
  answeredWithin120MinDuplicateClosedwhatsapp: number;
  answeredWithin120MinClosedagriseva: number;
  answeredWithin120MinPassagriseva: number;
  answeredWithin120MinDynamicClosedagriseva: number;
  answeredWithin120MinDuplicateClosedagriseva: number;
  answeredWithin120MinClosedmanual: number;
  answeredWithin120MinPassmanual: number;
  answeredWithin120MinDynamicClosedmanual: number;
  answeredWithin120MinDuplicateClosedmanual: number;

  whatsappdynamicWeatherDynamicCount: number;
  whatsappdynamicWeatherStaticDynamicCount: number;
  agrisevadynamicWeatherDynamicCount: number;
  agrisevadynamicWeatherStaticDynamicCount: number;
  manualdynamicWeatherDynamicCount: number;
  manualdynamicWeatherStaticDynamicCount: number;

  whatsappdynamicMarketDynamicCount: number;
  whatsappdynamicMarketStaticDynamicCount: number;
  agrisevadynamicMarketDynamicCount: number;
  agrisevadynamicMarketStaticDynamicCount: number;
  manualdynamicMarketDynamicCount: number;
  manualdynamicMarketStaticDynamicCount: number;

  whatsappdynamicSchemesDynamicCount: number;
  whatsappdynamicSchemesStaticDynamicCount: number;
  agrisevadynamicSchemesDynamicCount: number;
  agrisevadynamicSchemesStaticDynamicCount: number;
  manualdynamicSchemesDynamicCount: number;
  manualdynamicSchemesStaticDynamicCount: number;

  totalDynamicWhatsappCount: number;
  totalDynamicAgriSeva-AICount: number;
  totalDynamicManualCount: number;

  totalStaticDynamicWhatsappCount: number;
  totalStaticDynamicAgriSeva-AICount: number;
  totalStaticDynamicManualCount: number;

  whatsAppAnsweredAfter120Min: number;
  agrisevaAnsweredAfter120Min: number;
  manualAnsweredAfter120Min: number;

  whatsAppAnsweredAfter120MinClosed: number;
  whatsAppAnsweredAfter120MinPass: number;
  whatsAppAnsweredAfter120MinDynamicClosed: number;
  whatsAppAnsweredAfter120MinDuplicateClosed: number;

  agrisevaAnsweredAfter120MinClosed: number;
  agrisevaAnsweredAfter120MinPass: number;
  agrisevaAnsweredAfter120MinDynamicClosed: number;
  agrisevaAnsweredAfter120MinDuplicateClosed: number;

  manualAnsweredAfter120MinClosed: number;
  manualAnsweredAfter120MinPass: number;
  manualAnsweredAfter120MinDynamicClosed: number;
  manualAnsweredAfter120MinDuplicateClosed: number;

  whatsappSlaBreachedCount: number;
  agrisevaSlaBreachedCount: number;
  manualSlaBreachedCount: number;

    // WhatsApp
  whatsappTatMinutes: number;
  whatsappAverageTimeToAuthorMinutes: number;
  whatsappAverageReviewAcceptMinutes: number;
  whatsappAverageReviewModifyMinutes: number;
  whatsappAverageReviewRejectReauthorMinutes: number;
  whatsappAverageModeratingMinutes: number;
  whatsappAverageGatekeepingMinutes: number;
  whatsappAverageAuditingMinutes: number;
  whatsappAverageReroutedCompletionMinutes: number;

  // AgriSeva-AI
  agrisevaTatMinutes: number;
  agrisevaAverageTimeToAuthorMinutes: number;
  agrisevaAverageReviewAcceptMinutes: number;
  agrisevaAverageReviewModifyMinutes: number;
  agrisevaAverageReviewRejectReauthorMinutes: number;
  agrisevaAverageModeratingMinutes: number;
  agrisevaAverageGatekeepingMinutes: number;
  agrisevaAverageAuditingMinutes: number;
  agrisevaAverageReroutedCompletionMinutes: number;

  // Manual
  manualTatMinutes: number;
  manualAverageTimeToAuthorMinutes: number;
  manualAverageReviewAcceptMinutes: number;
  manualAverageReviewModifyMinutes: number;
  manualAverageReviewRejectReauthorMinutes: number;
  manualAverageModeratingMinutes: number;
  manualAverageGatekeepingMinutes: number;
  manualAverageAuditingMinutes: number;
  manualAverageReroutedCompletionMinutes: number;

  whatsappAverageEndToEndQnaCompletionMinutes: number;
  agrisevaAverageEndToEndQnaCompletionMinutes: number;
  manualAverageEndToEndQnaCompletionMinutes: number;

  whatsappAverageEndToEndUniqueMinutes: number;
  agrisevaAverageEndToEndUniqueMinutes: number;
  manualAverageEndToEndUniqueMinutes: number;

  whatsappAverageEndToEndDynamicMinutes: number;
  agrisevaAverageEndToEndDynamicMinutes: number;
  manualAverageEndToEndDynamicMinutes: number;

  whatsappAverageEndToEndDuplicateMinutes: number;
  agrisevaAverageEndToEndDuplicateMinutes: number;
  manualAverageEndToEndDuplicateMinutes: number;

        whatsappPaeAssignedQuestions: number;
    agrisevaPaeAssignedQuestions: number;
    manualPaeAssignedQuestions: number;
    // PAE Contribution to GDB
    whatsappPaeContributionToGDB: number;
    agrisevaPaeContributionToGDB: number;
    manualPaeContributionToGDB: number;
    // PAE Contribution to GDB %
    whatsappPaeContributionToGDBPct: number;
    agrisevaPaeContributionToGDBPct: number;
    manualPaeContributionToGDBPct: number;
};

const DEFAULT_DATA: ResponseAdherenceTableData = {
  date: "",
  time: "",
  timeWindow: "",
  whatsappQueriesAsked: 0,
  agrisevaQueriesAsked: 0,
  manualQueriesAsked: 0,
  whatsappPushedToReviewer: 0,
  agrisevaPushedToReviewer: 0,
  manualPushedToReviewer: 0,
  whatsappAnsweredWithin120Min: 0,
  agrisevaAnsweredWithin120Min: 0,
  manualAnsweredWithin120Min: 0,
  whatsappMarkedDuplicate: 0,
  agrisevaMarkedDuplicate: 0,
  manualMarkedDuplicate: 0,
  whatsappDynamicWeather: 0,
  agrisevaDynamicWeather: 0,
  manualDynamicWeather: 0,
  whatsappDynamicMarket: 0,
  agrisevaDynamicMarket: 0,
  manualDynamicMarket: 0,
  whatsappDynamicSchemes: 0,
  agrisevaDynamicSchemes: 0,
  manualDynamicSchemes: 0,

            whatsappClosedCount: 0,
        whatsappPendingCount: 0,
        whatsappNonAgriCount: 0,
        whatsappDynamicCount: 0,
        whatsappDuplicateCount: 0,
        whatsappHoldCount: 0,
        whatsappPaeSubmitedCount: 0,
        whatsappDynamicCLosedCount: 0,
        whatsappReroutedCount: 0,
        whatsappPassCount: 0,
        whatsappDuplicateClosedCount: 0,

      agrisevaClosedCount: 0,
    agrisevaPendingCount: 0,
    agrisevaNonAgriCount: 0,
    agrisevaDynamicCount: 0,
    agrisevaDuplicateCount: 0,
    agrisevaHoldCount: 0,
    agrisevaPaeSubmitedCount:0,
    agrisevaDynamicCLosedCount: 0,
    agrisevaReroutedCount: 0,
    agrisevaPassCount: 0,
    agrisevaDuplicateClosedCount:0,

      manualClosedCount: 0,
    manualPendingCount: 0,
    manualNonAgriCount:0,
    manualDynamicCount: 0,
    manualDuplicateCount: 0,
    manualHoldCount: 0,
    manualPaeSubmitedCount:0,
    manualDynamicCLosedCount: 0,
    manualReroutedCount: 0,
    manualPassCount: 0,
    manualDuplicateClosedCount:0,

                  manualAverageResponseGBDMinutes: 0,
    manualAverageResponseNonGBDMinutes: 0,
    whatsappAverageResponseGBDMinutes:0,
        whatsappAverageResponseNonGBDMinutes: 0,
            agrisevaAverageResponseGBDMinutes: 0,
    agrisevaAverageResponseNonGBDMinutes: 0,

  // whatsappNonGdbWithin120: 0,
  // agrisevaNonGdbWithin120: 0,
  // manualNonGdbWithin120: 0,
  whatsappInReview: 0,
  agrisevaInReview: 0,
  manualInReview: 0,
  whatsappOpen: 0,
  agrisevaOpen: 0,
  manualOpen: 0,
  whatsappDelayed: 0,
  agrisevaDelayed: 0,
  manualDelayed: 0,
  whatsappAverageResponseMinutes: 0,
  agrisevaAverageResponseMinutes: 0,
  manualAverageResponseMinutes: 0,
  whatsappAdherencePct: 0,
  agrisevaAdherencePct: 0,
  manualAdherencePct: 0,
  manualTotal: 0,
  agriexpertTotal: 0,
  outreachTotal: 0,
  answeredWithin120MinClosedwhatsapp: 0,
  answeredWithin120MinPasswhatsapp: 0,
  answeredWithin120MinDynamicClosedwhatsapp: 0,
  answeredWithin120MinDuplicateClosedwhatsapp: 0,
  answeredWithin120MinClosedagriseva: 0,
  answeredWithin120MinPassagriseva: 0,
  answeredWithin120MinDynamicClosedagriseva: 0,
  answeredWithin120MinDuplicateClosedagriseva: 0,
  answeredWithin120MinClosedmanual: 0,
  answeredWithin120MinPassmanual: 0,
  answeredWithin120MinDynamicClosedmanual: 0,
  answeredWithin120MinDuplicateClosedmanual: 0,

  whatsappdynamicWeatherDynamicCount: 0,
  whatsappdynamicWeatherStaticDynamicCount: 0,
  agrisevadynamicWeatherDynamicCount: 0,
  agrisevadynamicWeatherStaticDynamicCount: 0,
  manualdynamicWeatherDynamicCount: 0,
  manualdynamicWeatherStaticDynamicCount: 0,

  whatsappdynamicMarketDynamicCount: 0,
  whatsappdynamicMarketStaticDynamicCount: 0,
  agrisevadynamicMarketDynamicCount: 0,
  agrisevadynamicMarketStaticDynamicCount: 0,
  manualdynamicMarketDynamicCount: 0,
  manualdynamicMarketStaticDynamicCount: 0,

  whatsappdynamicSchemesDynamicCount: 0,
  whatsappdynamicSchemesStaticDynamicCount: 0,
  agrisevadynamicSchemesDynamicCount: 0,
  agrisevadynamicSchemesStaticDynamicCount: 0,
  manualdynamicSchemesDynamicCount: 0,
  manualdynamicSchemesStaticDynamicCount: 0,

  totalDynamicWhatsappCount: 0,
  totalDynamicAgriSeva-AICount: 0,
  totalDynamicManualCount: 0,

  totalStaticDynamicWhatsappCount: 0,
  totalStaticDynamicAgriSeva-AICount: 0,
  totalStaticDynamicManualCount: 0,

  whatsAppAnsweredAfter120Min: 0,
  agrisevaAnsweredAfter120Min: 0,
  manualAnsweredAfter120Min: 0,

  whatsAppAnsweredAfter120MinClosed: 0,
  whatsAppAnsweredAfter120MinPass: 0,
  whatsAppAnsweredAfter120MinDynamicClosed: 0,
  whatsAppAnsweredAfter120MinDuplicateClosed: 0,

  agrisevaAnsweredAfter120MinClosed: 0,
  agrisevaAnsweredAfter120MinPass: 0,
  agrisevaAnsweredAfter120MinDynamicClosed: 0,
  agrisevaAnsweredAfter120MinDuplicateClosed: 0,

  manualAnsweredAfter120MinClosed: 0,
  manualAnsweredAfter120MinPass: 0,
  manualAnsweredAfter120MinDynamicClosed: 0,
  manualAnsweredAfter120MinDuplicateClosed: 0,

  whatsappSlaBreachedCount: 0,
  agrisevaSlaBreachedCount: 0,
  manualSlaBreachedCount: 0,

  // WhatsApp
whatsappTatMinutes: 0,
whatsappAverageTimeToAuthorMinutes: 0,
whatsappAverageReviewAcceptMinutes: 0,
whatsappAverageReviewModifyMinutes: 0,
whatsappAverageReviewRejectReauthorMinutes: 0,
whatsappAverageModeratingMinutes: 0,
whatsappAverageGatekeepingMinutes: 0,
whatsappAverageAuditingMinutes: 0,
whatsappAverageReroutedCompletionMinutes: 0,

// AgriSeva-AI
agrisevaTatMinutes: 0,
agrisevaAverageTimeToAuthorMinutes: 0,
agrisevaAverageReviewAcceptMinutes: 0,
agrisevaAverageReviewModifyMinutes: 0,
agrisevaAverageReviewRejectReauthorMinutes: 0,
agrisevaAverageModeratingMinutes: 0,
agrisevaAverageGatekeepingMinutes: 0,
agrisevaAverageAuditingMinutes: 0,
agrisevaAverageReroutedCompletionMinutes: 0,

// Manual
manualTatMinutes: 0,
manualAverageTimeToAuthorMinutes: 0,
manualAverageReviewAcceptMinutes: 0,
manualAverageReviewModifyMinutes: 0,
manualAverageReviewRejectReauthorMinutes: 0,
manualAverageModeratingMinutes: 0,
manualAverageGatekeepingMinutes: 0,
manualAverageAuditingMinutes: 0,
manualAverageReroutedCompletionMinutes: 0,

  whatsappAverageEndToEndQnaCompletionMinutes: 0,
  agrisevaAverageEndToEndQnaCompletionMinutes: 0,
  manualAverageEndToEndQnaCompletionMinutes: 0,

  whatsappAverageEndToEndUniqueMinutes: 0,
  agrisevaAverageEndToEndUniqueMinutes: 0,
  manualAverageEndToEndUniqueMinutes: 0,

  whatsappAverageEndToEndDynamicMinutes: 0,
  agrisevaAverageEndToEndDynamicMinutes: 0,
  manualAverageEndToEndDynamicMinutes: 0,

  whatsappAverageEndToEndDuplicateMinutes: 0,
  agrisevaAverageEndToEndDuplicateMinutes: 0,
  manualAverageEndToEndDuplicateMinutes: 0,

        whatsappPaeAssignedQuestions: 0,
    agrisevaPaeAssignedQuestions: 0,
    manualPaeAssignedQuestions: 0,
    // PAE Contribution to GDB
    whatsappPaeContributionToGDB: 0,
    agrisevaPaeContributionToGDB: 0,
    manualPaeContributionToGDB: 0,
    // PAE Contribution to GDB %
    whatsappPaeContributionToGDBPct: 0,
    agrisevaPaeContributionToGDBPct: 0,
    manualPaeContributionToGDBPct: 0,
};

const ALL_ROW_IDS = [
  "date",
  "time",
  "header",
  "queriesAsked",
  "irrevelantQueries",
  "pushedReviewer",
  "answered120",
  "answered120Closed",
  "answered120Pass",
  "answered120DynamicClosed",
  "answered120DuplicateClosed",
  "duplicate",

  "totalDynamic",
  "dynamicWeather",
  "dynamicMarket",
  "dynamicSchemes",

  "totalStaticDynamic",
  "staticdynamicWeather",
  "staticdynamicMarket",
  "staticdynamicSchemes",

  "answeredAfter120Min",
  "answeredAfter120MinClosed",
  "answeredAfter120MinPass",
  "answeredAfter120MinDynamicClosed",
  "answeredAfter120MinDuplicateClosed",

  "tatMinutes",
  "averageTimeToAuthorMinutes",
  "averageReviewAcceptMinutes",
  "averageReviewModifyMinutes",
  "averageReviewRejectReauthorMinutes",
  "averageModeratingMinutes",
  "averageGatekeepingMinutes",
  "averageAuditingMinutes",
  "averageReroutedCompletionMinutes",

  "slaBreachedCount",

  "inReview",
  "open",
  "delayed",
  "closed",
  "pending",
  "nonAgri",
  "hold",
  "paeSubmited",
  "paeAssignedQuestions",
  "paeContributionToGDB",
  "paeContributionToGDBPct",
  "dynamicClosed",
  "rerouted",
  "pass",
  "duplicateClosed",

  "summaryDelayReason",

  "averageEndToEndQnaCompletion",
  "averageEndToEndUnique",
  "averageEndToEndDynamic",
  "averageEndToEndDuplicate",

  "slaBreached",
  "adherencePct",
] as const;

const DEFAULT_SELECTED_ROW_IDS = new Set<string>([
  "date",
  "time",
  "header",
  "pushedReviewer",
  "answered120",
  "summaryDelayReason",
  // "avgResponse",
  "adherencePct",
]);
 
type RowConfig =
  | {
      key: string;
      label: string;
      tooltip?: string;
      type: "single";
      value: React.ReactNode;
      span?: boolean;
    }
  | {
      key: string;
      label: string;
      tooltip?: string;
      type: "header";
      wa: React.ReactNode;
      manual: React.ReactNode;
      as: React.ReactNode;
      isHeader: true;
    }
  | {
      key: string;
      label: string;
      tooltip?: string;
      type: "data";
      wa: React.ReactNode;
      manual: React.ReactNode;
      as: React.ReactNode;
      highlight?: boolean;
    };

const todayAsInputDate = (now: Date = new Date()) => {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseInputDateToLocalDate = (value: string): Date => {
  if (!value) return new Date();
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 Min";
  const totalMinutes = Math.round(minutes);
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hrs === 0) return `${mins} Min`;
  if (mins === 0) return `${hrs} Hr`;
  return `${hrs} Hr. ${mins} Mins`;
}

export function ResponseAdherenceTableCard({
  data,
  selectedDate,
  onSelectedDateChange,
  isLoading = false,
  userType,
}: {
  data?: Partial<ResponseAdherenceTableData> | null;
  selectedDate?: string;
  onSelectedDateChange?: (date: string) => void;
  isLoading?: boolean;
  userType: 'all' | 'external' | 'internal';
}) {
  type ExportColumn = "whatsapp" | "agriSeva" | "manual";
    console.log("data----", data);
  const [checkedColumns, setCheckedColumns] = useState<
    Record<ExportColumn, boolean>
  >({
    whatsapp: true,
    agriSeva: true,
    manual: false,
  });

  const toggleColumn = (column: ExportColumn) => {
    setCheckedColumns((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  };
  const d = { ...DEFAULT_DATA, ...(data ?? {}) };
  const whatsappQueriesAskedDisplay =
    d.whatsappQueriesAsked > 0 ? d.whatsappQueriesAsked : "NIL";
  const manualQueriesAskedDisplay = 
    d.manualQueriesAsked > 0 ? d.manualQueriesAsked : "NIL";
  // const manualDynamicWeatherDisplay =
  //   d.manualDynamicWeather > 0 ? d.manualDynamicWeather : "NIL";
  // const manualDynamicMarketDisplay =
  //   d.manualDynamicMarket > 0 ? d.manualDynamicMarket : "NIL";
  // const manualDynamicSchemesDisplay =
  //   d.manualDynamicSchemes > 0 ? d.manualDynamicSchemes : "NIL";
  const [internalDate, setInternalDate] = useState<string>(todayAsInputDate());
  const [checkedRows, setCheckedRows] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      ALL_ROW_IDS.map((rowId) => [rowId, DEFAULT_SELECTED_ROW_IDS.has(rowId)]),
    ),
  );

  const effectiveDate = selectedDate ?? internalDate;

  const toggleRow = (rowId: string) =>
    setCheckedRows((prev) => ({ ...prev, [rowId]: !prev[rowId] }));

  const handleDateChange = (nextDate: string) => {
    if (onSelectedDateChange) {
      onSelectedDateChange(nextDate);
      return;
    }
    setInternalDate(nextDate);
  };

  const csvEscape = (value: string | number) => {
    const str = String(value ?? "");
    const escaped = str.replace(/"/g, "\"\"");
    return `"${escaped}"`;
  };

  const rowExportData = [
    { id: "date", field: "Date", whatsapp: d.date || effectiveDate || "", agriSeva: "", manual: "", notes: "" },
    { id: "time", field: "Time", whatsapp: d.timeWindow, agriSeva: "", manual: "", notes: "" },
    { id: "header", field: "Source", whatsapp: "Whatsapp", agriSeva: "AgriSeva-AI", manual: "Manual", notes: "" },
    { id: "queriesAsked", field: "Queries Asked", whatsapp: whatsappQueriesAskedDisplay, agriSeva: d.agrisevaQueriesAsked, manual: manualQueriesAskedDisplay, notes: "" },
    { id: "irrevelantQueries", field: "Irrevelant Queries", whatsapp: d.whatsappQueriesAsked > 0 ? d.whatsappQueriesAsked - d.whatsappPushedToReviewer : "NIL", agriSeva: d.agrisevaQueriesAsked > 0 ? d.agrisevaQueriesAsked - d.agrisevaPushedToReviewer : "NIL", manual: d.manualQueriesAsked > 0 ? d.manualQueriesAsked -  d.manualPushedToReviewer: "NIL", notes: "" },
    { id: "pushedReviewer", field: "Questions pushed into the review system", whatsapp: d.whatsappPushedToReviewer, agriSeva: d.agrisevaPushedToReviewer, manual: d.manualPushedToReviewer, notes: "" },
    { id: "answered120", field: "Questions answered within 120 minutes", whatsapp: d.whatsappAnsweredWithin120Min, agriSeva: d.agrisevaAnsweredWithin120Min, manual: d.manualAnsweredWithin120Min, notes: "" },
    {id: "answered120Closed",field: "Closed within 120 minutes",whatsapp: `${d.answeredWithin120MinClosedwhatsapp} / ${d.whatsappAnsweredWithin120Min}`,agriSeva: `${d.answeredWithin120MinClosedagriseva} / ${d.agrisevaAnsweredWithin120Min}`,manual: `${d.answeredWithin120MinClosedmanual} / ${d.manualAnsweredWithin120Min}`,notes: ""},
    {id: "answered120Pass",field: "Pass within 120 minutes",whatsapp: `${d.answeredWithin120MinPasswhatsapp} / ${d.whatsappAnsweredWithin120Min}`,agriSeva: `${d.answeredWithin120MinPassagriseva} / ${d.agrisevaAnsweredWithin120Min}`,manual: `${d.answeredWithin120MinPassmanual} / ${d.manualAnsweredWithin120Min}`,notes: ""},
    {id: "answered120DynamicClosed",field: "Dynamic Closed within 120 minutes",whatsapp: `${d.answeredWithin120MinDynamicClosedwhatsapp} / ${d.whatsappAnsweredWithin120Min}`,agriSeva: `${d.answeredWithin120MinDynamicClosedagriseva} / ${d.agrisevaAnsweredWithin120Min}`,manual: `${d.answeredWithin120MinDynamicClosedmanual} / ${d.manualAnsweredWithin120Min}`,notes: ""},
    {id: "answered120DuplicateClosed",field: "Duplicate Closed within 120 minutes",whatsapp: `${d.answeredWithin120MinDuplicateClosedwhatsapp} / ${d.whatsappAnsweredWithin120Min}`,agriSeva: `${d.answeredWithin120MinDuplicateClosedagriseva} / ${d.agrisevaAnsweredWithin120Min}`,manual: `${d.answeredWithin120MinDuplicateClosedmanual} / ${d.manualAnsweredWithin120Min}`,notes: ""},  
    { id: "duplicate", field: "Marked Duplicate (Fetched from GDB)", whatsapp: d.whatsappMarkedDuplicate, agriSeva: d.agrisevaMarkedDuplicate, manual: d.manualMarkedDuplicate, notes: "" },

    { id: "totalDynamic", field: "Total - Dynamic", whatsapp: d.totalDynamicWhatsappCount, agriSeva: d.totalDynamicAgriSeva-AICount, manual: d.totalDynamicManualCount, notes: "" },
    { id: "dynamicWeather", field: "Dynamic - Weather", whatsapp: d.whatsappdynamicWeatherDynamicCount, agriSeva: d.agrisevadynamicWeatherDynamicCount, manual: d.manualdynamicWeatherDynamicCount, notes: "" },
    { id: "dynamicMarket", field: "Dynamic - Market", whatsapp: d.whatsappdynamicMarketDynamicCount, agriSeva: d.agrisevadynamicMarketDynamicCount, manual:d.manualdynamicMarketDynamicCount, notes: "" },
    { id: "dynamicSchemes", field: "Dynamic - Schemes", whatsapp: d.whatsappdynamicSchemesDynamicCount, agriSeva: d.agrisevadynamicSchemesDynamicCount, manual: d.manualdynamicSchemesDynamicCount, notes: "" },

    { id: "totalStaticDynamic", field: "Total - Static Dynamic", whatsapp: d.totalStaticDynamicWhatsappCount, agriSeva: d.totalStaticDynamicAgriSeva-AICount, manual: d.totalStaticDynamicManualCount, notes: "" },
    { id: "staticdynamicWeather", field: "Static Dynamic - Weather", whatsapp: d.whatsappdynamicWeatherStaticDynamicCount, agriSeva: d.agrisevadynamicWeatherStaticDynamicCount, manual: d.manualdynamicWeatherStaticDynamicCount, notes: "" },
    { id: "staticdynamicMarket", field: "Static Dynamic - Market", whatsapp: d.whatsappdynamicMarketStaticDynamicCount, agriSeva: d.agrisevadynamicMarketStaticDynamicCount, manual:d.manualdynamicMarketStaticDynamicCount, notes: "" },
    { id: "staticdynamicSchemes", field: "Static Dynamic - Schemes", whatsapp: d.whatsappdynamicSchemesStaticDynamicCount, agriSeva: d.agrisevadynamicSchemesStaticDynamicCount, manual: d.manualdynamicSchemesStaticDynamicCount, notes: "" },
    { id: "answeredAfter120Min", field: "Answered After 120 Min", whatsapp: d.whatsAppAnsweredAfter120Min, agriSeva: d.agrisevaAnsweredAfter120Min, manual: d.manualAnsweredAfter120Min, notes: "" },
    // { id: "answeredAfter120Min", field: "Answered After 120 Min", whatsapp: d.whatsAppAnsweredAfter120Min, agriSeva: d.agrisevaAnsweredAfter120Min, manual: d.manualAnsweredAfter120Min, notes: ""},
    {id: "answeredAfter120MinClosed",field: "Closed After 120 Min",whatsapp: `${d.whatsAppAnsweredAfter120MinClosed} / ${d.whatsAppAnsweredAfter120Min}`,agriSeva: `${d.agrisevaAnsweredAfter120MinClosed} / ${d.agrisevaAnsweredAfter120Min}`,manual: `${d.manualAnsweredAfter120MinClosed} / ${d.manualAnsweredAfter120Min}`,notes: ""},
    {id: "answeredAfter120MinPass",field: "Pass After 120 Min",whatsapp: `${d.whatsAppAnsweredAfter120MinPass} / ${d.whatsAppAnsweredAfter120Min}`,agriSeva: `${d.agrisevaAnsweredAfter120MinPass} / ${d.agrisevaAnsweredAfter120Min}`,manual: `${d.manualAnsweredAfter120MinPass} / ${d.manualAnsweredAfter120Min}`,notes: ""},
    {id: "answeredAfter120MinDynamicClosed",field: "Dynamic Closed After 120 Min",whatsapp: `${d.whatsAppAnsweredAfter120MinDynamicClosed} / ${d.whatsAppAnsweredAfter120Min}`,agriSeva: `${d.agrisevaAnsweredAfter120MinDynamicClosed} / ${d.agrisevaAnsweredAfter120Min}`,manual: `${d.manualAnsweredAfter120MinDynamicClosed} / ${d.manualAnsweredAfter120Min}`,notes: ""},
    {id: "answeredAfter120MinDuplicateClosed",field: "Duplicate Closed After 120 Min",whatsapp: `${d.whatsAppAnsweredAfter120MinDuplicateClosed} / ${d.whatsAppAnsweredAfter120Min}`,agriSeva: `${d.agrisevaAnsweredAfter120MinDuplicateClosed} / ${d.agrisevaAnsweredAfter120Min}`,manual: `${d.manualAnsweredAfter120MinDuplicateClosed} / ${d.manualAnsweredAfter120Min}`,notes: ""},   
    {id: "tatMinutes",field: "TAT",whatsapp: formatMinutes(d.whatsappTatMinutes),agriSeva: formatMinutes(d.agrisevaTatMinutes),manual: formatMinutes(d.manualTatMinutes), notes: ""},
    {id: "averageTimeToAuthorMinutes",field: "Average Time to Author",whatsapp: formatMinutes(d.whatsappAverageTimeToAuthorMinutes),agriSeva: formatMinutes(d.agrisevaAverageTimeToAuthorMinutes),manual: formatMinutes(d.manualAverageTimeToAuthorMinutes),notes: ""},
    {id: "averageReviewAcceptMinutes",field: "Average Time for Reviewing + Accepting",whatsapp: formatMinutes(d.whatsappAverageReviewAcceptMinutes),agriSeva: formatMinutes(d.agrisevaAverageReviewAcceptMinutes),manual: formatMinutes(d.manualAverageReviewAcceptMinutes),notes: ""},
    {id: "averageReviewModifyMinutes",field: "Average Time for Reviewing + Modifying",whatsapp: formatMinutes(d.whatsappAverageReviewModifyMinutes),agriSeva: formatMinutes(d.agrisevaAverageReviewModifyMinutes),manual: formatMinutes(d.manualAverageReviewModifyMinutes),notes: ""},
    {id: "averageReviewRejectReauthorMinutes",field: "Average Time for Reviewing + Rejecting + Re-Authoring",whatsapp: formatMinutes(d.whatsappAverageReviewRejectReauthorMinutes),agriSeva: formatMinutes(d.agrisevaAverageReviewRejectReauthorMinutes),manual: formatMinutes(d.manualAverageReviewRejectReauthorMinutes),notes: ""},
    {id: "averageModeratingMinutes",field: "Average Time for Moderating",whatsapp: formatMinutes(d.whatsappAverageModeratingMinutes),agriSeva: formatMinutes(d.agrisevaAverageModeratingMinutes),manual: formatMinutes(d.manualAverageModeratingMinutes),notes: ""},
    {id: "averageGatekeepingMinutes",field: "Average Time to Gatekeeping",whatsapp: formatMinutes(d.whatsappAverageGatekeepingMinutes),agriSeva: formatMinutes(d.agrisevaAverageGatekeepingMinutes),manual: formatMinutes(d.manualAverageGatekeepingMinutes),notes: ""},
    {id: "averageAuditingMinutes",field: "Average Time to Auditing",whatsapp: formatMinutes(d.whatsappAverageAuditingMinutes),agriSeva: formatMinutes(d.agrisevaAverageAuditingMinutes),manual: formatMinutes(d.manualAverageAuditingMinutes),notes: ""},
    {id: "averageReroutedCompletionMinutes",field: "Average Time for Rerouted Questions to be Completed",whatsapp: formatMinutes(d.whatsappAverageReroutedCompletionMinutes),agriSeva: formatMinutes(d.agrisevaAverageReroutedCompletionMinutes),manual: formatMinutes(d.manualAverageReroutedCompletionMinutes),notes: ""},
    {id: "slaBreachedCount",field: "SLA Breached Count",whatsapp: d.whatsappSlaBreachedCount,agriSeva: d.agrisevaSlaBreachedCount, manual: d.manualSlaBreachedCount,notes: ""},
    // { id: "nonGdb", field: "Non GDB Questions - Answer prepared in 120 Min by AEs", whatsapp: d.whatsappNonGdbWithin120, agriSeva: d.agrisevaNonGdbWithin120, manual: d.manualNonGdbWithin120, notes: "" },
    { id: "inReview", field: "Question in Review", whatsapp: d.whatsappInReview, agriSeva: d.agrisevaInReview, manual: d.manualInReview, notes: "" },
    { id: "open", field: "Questions are Open", whatsapp: d.whatsappOpen, agriSeva: d.agrisevaOpen, manual: d.manualOpen, notes: "" },
    { id: "delayed", field: "Questions are delayed", whatsapp: d.whatsappDelayed, agriSeva: d.agrisevaDelayed, manual: d.manualDelayed, notes: "" },
    {id: "closed", field: "Questions are closed", whatsapp: d.whatsappClosedCount, agriSeva: d.agrisevaClosedCount, manual: d.manualClosedCount, notes:""},
    {id: "pending", field: "Questions are pending", whatsapp: d.whatsappPendingCount, agriSeva: d.agrisevaPendingCount, manual: d.manualPendingCount, notes:""},
    // {id: "nonAgri", field: "Questions are non-agri", whatsapp: d.whatsappNonAgriCount, agriSeva: d.agrisevaNonAgriCount, manual: d.manualNonAgriCount, notes:""},
    // {id: "dynamic", field: "Dynamic Question", whatsapp: d.whatsappDynamicCount, agriSeva: d.agrisevaDynamicCount, manual: d.manualDynamicCount, notes:""},
    // {id: "duplicate", field: "Duplicate Question", whatsapp: d.whatsappDuplicateCount, agriSeva: d.agrisevaDuplicateCount, manual: d.manualDuplicateCount, notes:""},
    {id: "hold", field: "Questions on hold", whatsapp: d.whatsappHoldCount, agriSeva: d.agrisevaHoldCount, manual: d.manualHoldCount, notes:""},
    {id: "paeSubmited", field: "PAE Submited Questions", whatsapp: d.whatsappPaeSubmitedCount, agriSeva: d.agrisevaPaeSubmitedCount, manual: d.manualPaeSubmitedCount, notes:""},
    {id: "paeAssignedQuestions",field: "PAE Assigned Questions",whatsapp: d.whatsappPaeAssignedQuestions ?? 0,agriSeva: d.agrisevaPaeAssignedQuestions ?? 0,manual: d.manualPaeAssignedQuestions ?? 0,},
    {id: "paeContributionToGDB",field: "PAE Contribution to GDB",whatsapp: d.whatsappPaeContributionToGDB ?? 0,agriSeva: d.agrisevaPaeContributionToGDB ?? 0,manual: d.manualPaeContributionToGDB ?? 0,},
    {id: "paeContributionToGDBPct",field: "PAE Contribution to GDB (%)",whatsapp: `${d.whatsappPaeContributionToGDBPct ?? 0}%`,agriSeva: `${d.agrisevaPaeContributionToGDBPct ?? 0}%`,manual: `${d.manualPaeContributionToGDBPct ?? 0}%`,},
// {id: "dynamicClosed", field: "Dynamic Closed Questions", whatsapp: d.whatsappDynamicCLosedCount, agriSeva: d.agrisevaDynamicCLosedCount, manual: d.manualDynamicCLosedCount, notes:""},
    {id: "rerouted", field: "Rerouted Questions", whatsapp: d.whatsappReroutedCount, agriSeva: d.agrisevaReroutedCount, manual: d.manualReroutedCount, notes:""},
    {id: "pass", field: "Pass Questions", whatsapp: d.whatsappPassCount, agriSeva: d.agrisevaPassCount, manual: d.manualPassCount, notes:""},
    // {id: "duplicateClosed", field: "Duplicate Closed Questions", whatsapp: d.whatsappDuplicateClosedCount, agriSeva: d.agrisevaDuplicateClosedCount, manual: d.manualDuplicateClosedCount, notes:""},
    { id: "summaryDelayReason", field: "Summary of the reason for delay", whatsapp: "", agriSeva: "", manual: "", notes: "" },
    { id: "averageEndToEndQnaCompletion", field: "Average response time for End to End QNA Completion", whatsapp: formatMinutes(d.whatsappAverageEndToEndQnaCompletionMinutes), agriSeva: formatMinutes(d.agrisevaAverageEndToEndQnaCompletionMinutes), manual: formatMinutes(d.manualAverageEndToEndQnaCompletionMinutes), notes: "" },
    { id: "averageEndToEndUnique", field: "Average response time for End to End QNA Completion of Unique Questions", whatsapp: formatMinutes(d.whatsappAverageEndToEndUniqueMinutes), agriSeva: formatMinutes(d.agrisevaAverageEndToEndUniqueMinutes), manual: formatMinutes(d.manualAverageEndToEndUniqueMinutes), notes: "" },
    { id: "averageEndToEndDynamic", field: "Average response time for End to End QNA Completion of Dynamic Question", whatsapp: formatMinutes(d.whatsappAverageEndToEndDynamicMinutes), agriSeva: formatMinutes(d.agrisevaAverageEndToEndDynamicMinutes), manual: formatMinutes(d.manualAverageEndToEndDynamicMinutes), notes: "" },
    { id: "averageEndToEndDuplicate", field: "Average response time for End to End QNA Completion of Duplicate Question", whatsapp: formatMinutes(d.whatsappAverageEndToEndDuplicateMinutes), agriSeva: formatMinutes(d.agrisevaAverageEndToEndDuplicateMinutes), manual: formatMinutes(d.manualAverageEndToEndDuplicateMinutes), notes: "" },
      //  { id: "avgResponse", field: "Average response time", whatsapp: formatMinutes(d.whatsappAverageResponseMinutes), agriSeva: formatMinutes(d.agrisevaAverageResponseMinutes), manual: formatMinutes(d.manualAverageResponseMinutes), notes: "" },
    // { id: "avgResponseGDB", field: "Average response time GDB", whatsapp: formatMinutes(d.whatsappAverageResponseGBDMinutes), agriSeva: formatMinutes(d.agrisevaAverageResponseGBDMinutes), manual: formatMinutes(d.manualAverageResponseGBDMinutes), notes: "" },
    // { id: "avgResponseNonGDB", field: "Average response time Non GDB", whatsapp: formatMinutes(d.whatsappAverageResponseNonGBDMinutes), agriSeva: formatMinutes(d.agrisevaAverageResponseNonGBDMinutes), manual: formatMinutes(d.manualAverageResponseNonGBDMinutes), notes: "" },
    { id: "slaBreached", field: "SLA Breached", whatsapp: `${(100 - d.whatsappAdherencePct).toFixed(2)}%`, agriSeva: `${(100 - d.agrisevaAdherencePct).toFixed(2)}%`, manual: `${(100 - d.manualAdherencePct).toFixed(2)}%`, notes: "" },
    { id: "adherencePct", field: "Percentage of questions completed within 120 minutes", whatsapp: `${d.whatsappAdherencePct.toFixed(2)}%`, agriSeva: `${d.agrisevaAdherencePct.toFixed(2)}%`, manual: `${d.manualAdherencePct.toFixed(2)}%`, notes: "" },
  ] as const;

  const rows: RowConfig[] = [
    {
      key: "date",
      label: "Date",
      tooltip: "Date for which the response adherence metrics are calculated.",
      type: "single",
      value: d.date || effectiveDate,
    },
    {
      key: "time",
      label: "Time Window",
      tooltip:
        "Time range within the selected date used to calculate all metrics in this report.",
      type: "single",
      value: d.timeWindow,
      span: true,
    },
    {
      key: "header",
      label: "Source",
      tooltip:
        "Channel through which the question entered the system: WhatsApp, AgriSeva-AI, or Manual.",
      type: "header",
      wa: "WhatsApp",
      as: "AgriSeva-AI",
      manual: "Manual",
      isHeader: true,
    },

    {
      key: "queriesAsked",
      label: "Queries Asked",
      tooltip:
        "Total user queries received from this source during the selected time window.",
      type: "data",
      wa: whatsappQueriesAskedDisplay,
      as: d.agrisevaQueriesAsked,
      manual: manualQueriesAskedDisplay,
    },
    {
      key: "irrevelantQueries",
      label: "Irrevelant Queries",
      tooltip:
        "Difference between the queries asked and questions pushed to the system",
      type: "data",
      wa: d.whatsappQueriesAsked > 0 ? d.whatsappQueriesAsked - d.whatsappPushedToReviewer : "NIL",
      as: d.agrisevaQueriesAsked > 0 ? d.agrisevaQueriesAsked - d.agrisevaPushedToReviewer : "NIL",
      manual: d.manualQueriesAsked > 0 ? d.manualQueriesAsked -  d.manualPushedToReviewer: "NIL",
    },
    {
      key: "pushedReviewer",
      label: "Questoins Pushed into Reviewer System",
      tooltip:
        "Total questions created in the reviewer system for this source during the selected time window.",
      type: "data",
      wa: d.whatsappPushedToReviewer,
      as: d.agrisevaPushedToReviewer,
      manual: d.manualPushedToReviewer,
    },

    {
      key: "answered120",
      label: "Questions Responded within 120 min",
      tooltip:
        "Total completed questions whose operational completion time was within 120 minutes of question creation.",
      type: "data",
      wa: d.whatsappAnsweredWithin120Min,
      as: d.agrisevaAnsweredWithin120Min,
      manual: d.manualAnsweredWithin120Min,
    },
    {
      key: "answered120Closed",
      label: "Questions Closed within 120 minutes",
      tooltip:
        "Questions with Closed status that were completed within 120 minutes. The value is shown against the total questions responded to within 120 minutes.",
      type: "data",
      wa: `${d.answeredWithin120MinClosedwhatsapp} / ${d.whatsappAnsweredWithin120Min}`,
      as: `${d.answeredWithin120MinClosedagriseva} / ${d.agrisevaAnsweredWithin120Min}`,
      manual: `${d.answeredWithin120MinClosedmanual} / ${d.manualAnsweredWithin120Min}`,
    },
    {
      key: "answered120Pass",
      label: " Questions Passed within 120 minutes",
      tooltip:
        "Questions with Pass status that were completed within 120 minutes. The value is shown against the total questions responded to within 120 minutes.",
      type: "data",
      wa: `${d.answeredWithin120MinPasswhatsapp} / ${d.whatsappAnsweredWithin120Min}`,
      as: `${d.answeredWithin120MinPassagriseva} / ${d.agrisevaAnsweredWithin120Min}`,
      manual: `${d.answeredWithin120MinPassmanual} / ${d.manualAnsweredWithin120Min}`,
    },
    {
      key: "answered120DynamicClosed",
      label: "Questions Dynamic Closed within 120 minutes",
      tooltip:
        "Dynamic questions that reached Dynamic Closed status within 120 minutes. The value is shown against the total questions responded to within 120 minutes.",
      type: "data",
      wa: `${d.answeredWithin120MinDynamicClosedwhatsapp} / ${d.whatsappAnsweredWithin120Min}`,
      as: `${d.answeredWithin120MinDynamicClosedagriseva} / ${d.agrisevaAnsweredWithin120Min}`,
      manual: `${d.answeredWithin120MinDynamicClosedmanual} / ${d.manualAnsweredWithin120Min}`,
    },
    {
      key: "answered120DuplicateClosed",
      label: "Questions Duplicate Closed within 120 minutes",
      tooltip:
        "Duplicate questions that reached Duplicate Closed status within 120 minutes. The value is shown against the total questions responded to within 120 minutes.",
      type: "data",
      wa: `${d.answeredWithin120MinDuplicateClosedwhatsapp} / ${d.whatsappAnsweredWithin120Min}`,
      as: `${d.answeredWithin120MinDuplicateClosedagriseva} / ${d.agrisevaAnsweredWithin120Min}`,
      manual: `${d.answeredWithin120MinDuplicateClosedmanual} / ${d.manualAnsweredWithin120Min}`,
    },

    {
      key: "duplicate",
      label: "Questions Marked Duplicate (GDB)",
      tooltip:
        "Questions identified as duplicates of an existing Golden Database (GDB) question.",
      type: "data",
      wa: d.whatsappMarkedDuplicate,
      as: d.agrisevaMarkedDuplicate,
      manual: d.manualMarkedDuplicate,
    },

    {
      key: "totalDynamic",
      label: "Total - Dynamic",
      tooltip:
        "Total dynamic Weather, Market, and Schemes questions. These are handled through dynamic data or tool-based processing.",
      type: "data",
      wa: d.totalDynamicWhatsappCount,
      as: d.totalDynamicAgriSeva-AICount,
      manual: d.totalDynamicManualCount,
    },
    {
      key: "dynamicWeather",
      label: "Dynamic — Weather",
      tooltip:
        "Weather-related questions classified as Dynamic.",
      type: "data",
      wa: d.whatsappdynamicWeatherDynamicCount,
      as: d.agrisevadynamicWeatherDynamicCount,
      manual: d.manualdynamicWeatherDynamicCount,
    },
    {
      key: "dynamicMarket",
      label: "Dynamic — Market",
      tooltip:
        "Market-related questions classified as Dynamic.",
      type: "data",
      wa: d.whatsappdynamicMarketDynamicCount,
      as: d.agrisevadynamicMarketDynamicCount,
      manual: d.manualdynamicMarketDynamicCount,
    },
    {
      key: "dynamicSchemes",
      label: "Dynamic — Schemes",
      tooltip:
        "Government scheme-related questions classified as Dynamic.",
      type: "data",
      wa: d.whatsappdynamicSchemesDynamicCount,
      as: d.agrisevadynamicSchemesDynamicCount,
      manual: d.manualdynamicSchemesDynamicCount,
    },

    {
      key: "totalStaticDynamic",
      label: "Total - Static Dynamic",
      tooltip:
        "Total Weather, Market, and Schemes questions tagged as Static Dynamic.",
      type: "data",
      wa: d.totalStaticDynamicWhatsappCount,
      as: d.totalStaticDynamicAgriSeva-AICount,
      manual: d.totalStaticDynamicManualCount,
    },
    {
      key: "staticdynamicWeather",
      label: "Static Dynamic — Weather",
      tooltip:
        "Weather-related questions tagged as Static Dynamic.",
      type: "data",
      wa: d.whatsappdynamicWeatherStaticDynamicCount,
      as: d.agrisevadynamicWeatherStaticDynamicCount,
      manual: d.manualdynamicWeatherStaticDynamicCount,
    },
    {
      key: "staticdynamicMarket",
      label: "Static Dynamic — Market",
      tooltip:
        "Market-related questions tagged as Static Dynamic.",
      type: "data",
      wa: d.whatsappdynamicMarketStaticDynamicCount,
      as: d.agrisevadynamicMarketStaticDynamicCount,
      manual: d.manualdynamicMarketStaticDynamicCount,
    },
    {
      key: "staticdynamicSchemes",
      label: "Static Dynamic — Schemes",
      tooltip:
        "Government scheme-related questions tagged as Static Dynamic.",
      type: "data",
      wa: d.whatsappdynamicSchemesStaticDynamicCount,
      as: d.agrisevadynamicSchemesStaticDynamicCount,
      manual: d.manualdynamicSchemesStaticDynamicCount,
    },
   {
      key: "answeredAfter120Min",
      label: "Questions Answered After 120 Min",
      tooltip: "Questions answered after 120 minutes of creation",
      type: "data",
      wa: d.whatsAppAnsweredAfter120Min,
      as: d.agrisevaAnsweredAfter120Min,
      manual: d.manualAnsweredAfter120Min,
    },

    {
      key: "answeredAfter120MinClosed",
      label: "Questions Closed After 120 Min",
      tooltip: "Questions closed after 120 minutes of creation",
      type: "data",
      wa: `${d.whatsAppAnsweredAfter120MinClosed} / ${d.whatsAppAnsweredAfter120Min}`,
      as: `${d.agrisevaAnsweredAfter120MinClosed} / ${d.agrisevaAnsweredAfter120Min}`,
      manual: `${d.manualAnsweredAfter120MinClosed} / ${d.manualAnsweredAfter120Min}`,
    },

    {
      key: "answeredAfter120MinPass",
      label: "Questions Passed After 120 Min",
      tooltip: "Questions passed after 120 minutes of creation",
      type: "data",
      wa: `${d.whatsAppAnsweredAfter120MinPass} / ${d.whatsAppAnsweredAfter120Min}`,
      as: `${d.agrisevaAnsweredAfter120MinPass} / ${d.agrisevaAnsweredAfter120Min}`,
      manual: `${d.manualAnsweredAfter120MinPass} / ${d.manualAnsweredAfter120Min}`,
    },

    {
      key: "answeredAfter120MinDynamicClosed",
      label: "Questions Dynamic Closed After 120 Min",
      tooltip: "Dynamic questions closed after 120 minutes of creation",
      type: "data",
      wa: `${d.whatsAppAnsweredAfter120MinDynamicClosed} / ${d.whatsAppAnsweredAfter120Min}`,
      as: `${d.agrisevaAnsweredAfter120MinDynamicClosed} / ${d.agrisevaAnsweredAfter120Min}`,
      manual: `${d.manualAnsweredAfter120MinDynamicClosed} / ${d.manualAnsweredAfter120Min}`,
    },

    {
      key: "answeredAfter120MinDuplicateClosed",
      label: "Questions Duplicate Closed After 120 Min",
      tooltip: "Duplicate questions closed after 120 minutes of creation",
      type: "data",
      wa: `${d.whatsAppAnsweredAfter120MinDuplicateClosed} / ${d.whatsAppAnsweredAfter120Min}`,
      as: `${d.agrisevaAnsweredAfter120MinDuplicateClosed} / ${d.agrisevaAnsweredAfter120Min}`,
      manual: `${d.manualAnsweredAfter120MinDuplicateClosed} / ${d.manualAnsweredAfter120Min}`,
    },
    {
      key: "tatMinutes",
      label: "TAT",
      tooltip: "Total turnaround time calculated from all TAT lifecycle bifurcations",
      type: "data",
      wa: formatMinutes(d.whatsappTatMinutes),
      as: formatMinutes(d.agrisevaTatMinutes),
      manual: formatMinutes(d.manualTatMinutes),
    },
    {
      key: "averageTimeToAuthorMinutes",
      label: "Average Time to Author",
      tooltip: "Average time from first allocation to first answer submission",
      type: "data",
      wa: formatMinutes(d.whatsappAverageTimeToAuthorMinutes),
      as: formatMinutes(d.agrisevaAverageTimeToAuthorMinutes),
      manual: formatMinutes(d.manualAverageTimeToAuthorMinutes),
    },
    {
      key: "averageReviewAcceptMinutes",
      label: "Average Time for Reviewing + Accepting",
      tooltip: "Average time taken for reviewing and accepting an answer",
      type: "data",
      wa: formatMinutes(d.whatsappAverageReviewAcceptMinutes),
      as: formatMinutes(d.agrisevaAverageReviewAcceptMinutes),
      manual: formatMinutes(d.manualAverageReviewAcceptMinutes),
    },
    {
      key: "averageReviewModifyMinutes",
      label: "Average Time for Reviewing + Modifying",
      tooltip: "Average time taken for reviewing and modifying an answer",
      type: "data",
      wa: formatMinutes(d.whatsappAverageReviewModifyMinutes),
      as: formatMinutes(d.agrisevaAverageReviewModifyMinutes),
      manual: formatMinutes(d.manualAverageReviewModifyMinutes),
    },
    {
      key: "averageReviewRejectReauthorMinutes",
      label: "Average Time for Reviewing + Rejecting + Re-Authoring",
      tooltip: "Average time from review start through rejection to re-authoring",
      type: "data",
      wa: formatMinutes(d.whatsappAverageReviewRejectReauthorMinutes),
      as: formatMinutes(d.agrisevaAverageReviewRejectReauthorMinutes),
      manual: formatMinutes(d.manualAverageReviewRejectReauthorMinutes),
    },
    {
      key: "averageModeratingMinutes",
      label: "Average Time for Moderating",
      tooltip: "Average time taken for moderation",
      type: "data",
      wa: formatMinutes(d.whatsappAverageModeratingMinutes),
      as: formatMinutes(d.agrisevaAverageModeratingMinutes),
      manual: formatMinutes(d.manualAverageModeratingMinutes),
    },
    {
      key: "averageGatekeepingMinutes",
      label: "Average Time to Gatekeeping",
      tooltip: "Average time taken for gatekeeping",
      type: "data",
      wa: formatMinutes(d.whatsappAverageGatekeepingMinutes),
      as: formatMinutes(d.agrisevaAverageGatekeepingMinutes),
      manual: formatMinutes(d.manualAverageGatekeepingMinutes),
    },
    {
      key: "averageAuditingMinutes",
      label: "Average Time to Auditing",
      tooltip: "Average time taken for auditing",
      type: "data",
      wa: formatMinutes(d.whatsappAverageAuditingMinutes),
      as: formatMinutes(d.agrisevaAverageAuditingMinutes),
      manual: formatMinutes(d.manualAverageAuditingMinutes),
    },
    {
      key: "averageReroutedCompletionMinutes",
      label: "Average Time for Rerouted Questions to be Completed",
      tooltip: "Average time from rerouting until completion",
      type: "data",
      wa: formatMinutes(d.whatsappAverageReroutedCompletionMinutes),
      as: formatMinutes(d.agrisevaAverageReroutedCompletionMinutes),
      manual: formatMinutes(d.manualAverageReroutedCompletionMinutes),
    },

    {
      key: "slaBreachedCount",
      label: "SLA Breached Count",
      tooltip: "Questions whose lifecycle exceeded the 120-minute SLA",
      type: "data",
      wa: d.whatsappSlaBreachedCount,
      as: d.agrisevaSlaBreachedCount,
      manual: d.manualSlaBreachedCount,
    },

    {
      key: "inReview",
      label: "Questions are In Review",
      tooltip:
        "Questions currently under review and awaiting completion of the review process.",
      type: "data",
      wa: d.whatsappInReview,
      as: d.agrisevaInReview,
      manual: d.manualInReview,
    },
    {
      key: "open",
      label: "Questions are Open",
      tooltip:
        "Questions currently in Open status and not yet completed.",
      type: "data",
      wa: d.whatsappOpen,
      as: d.agrisevaOpen,
      manual: d.manualOpen,
    },
    {
      key: "delayed",
      label: "Questions are delayed",
      tooltip:
        "Questions currently marked as Delayed in the reviewer system.",
      type: "data",
      wa: d.whatsappDelayed,
      as: d.agrisevaDelayed,
      manual: d.manualDelayed,
    },
    {
      key: "closed",
      label: "Question are closed",
      tooltip:
        "Questions whose current reviewer-system status is Closed.",
      type: "data",
      wa: d.whatsappClosedCount,
      as: d.agrisevaClosedCount,
      manual: d.manualClosedCount,
    },
    {
      key: "pending",
      label: "Question are pending",
      tooltip:
        "Questions whose current reviewer-system status is Pending.",
      type: "data",
      wa: d.whatsappPendingCount,
      as: d.agrisevaPendingCount,
      manual: d.manualPendingCount,
    },
    // {
    //   key: "nonAgri",
    //   label: "Non Agri Questions",
    //   tooltip:
    //     "Questions classified as non-agricultural and therefore outside the agricultural query workflow.",
    //   type: "data",
    //   wa: d.whatsappNonAgriCount,
    //   as: d.agrisevaNonAgriCount,
    //   manual: d.manualNonAgriCount,
    // },
    // {
    //   key: "dynamic",
    //   label: "Dynamic",
    //   tooltip:
    //     "Questions whose current reviewer-system status is Dynamic.",
    //   type: "data",
    //   wa: d.whatsappDynamicCount,
    //   as: d.agrisevaDynamicCount,
    //   manual: d.manualDynamicCount,
    // },
    // {
    //   key: "duplicate",
    //   label: "Duplicate",
    //   tooltip:
    //     "Questions whose current reviewer-system status is Duplicate.",
    //   type: "data",
    //   wa: d.whatsappDuplicateCount,
    //   as: d.agrisevaDuplicateCount,
    //   manual: d.manualDuplicateCount,
    // },
    {
      key: "hold",
      label: "Questions on Hold",
      tooltip:
        "Questions currently placed on hold and awaiting further action.",
      type: "data",
      wa: d.whatsappHoldCount,
      as: d.agrisevaHoldCount,
      manual: d.manualHoldCount,
    },
    {
      key: "paeSubmited",
      label: "PAE Submitted",
      tooltip:
        "Questions whose current status indicates that they have been submitted to the PAE workflow.",
      type: "data",
      wa: d.whatsappPaeSubmitedCount,
      as: d.agrisevaPaeSubmitedCount,
      manual: d.manualPaeSubmitedCount,
    },
    {
      key: "paeAssignedQuestions",
      label: "PAE Assigned Questions",
      tooltip:
        "Open questions assigned to the PAE workflow where PAE review is enabled.",
      type: "data",
      wa: d.whatsappPaeAssignedQuestions,
      as: d.agrisevaPaeAssignedQuestions,
      manual: d.manualPaeAssignedQuestions,
    },
    {
      key: "paeContributionToGDB",
      label: "PAE Contribution to GDB",
      tooltip:
        "Closed questions where PAE review was enabled and contributed to the GDB.",
      type: "data",
      wa: d.whatsappPaeContributionToGDB,
      as: d.agrisevaPaeContributionToGDB,
      manual: d.manualPaeContributionToGDB,
    },
    {
      key: "paeContributionToGDBPct",
      label: "PAE Contribution to GDB (%)",
      tooltip:
        "Percentage of closed questions contributed by PAE out of all closed questions.",
      type: "data",
      wa: `${d.whatsappPaeContributionToGDBPct ?? 0}%`,
      as: `${d.agrisevaPaeContributionToGDBPct ?? 0}%`,
      manual: `${d.manualPaeContributionToGDBPct ?? 0}%`,
    },
    // {
    //   key: "dynamicClosed",
    //   label: "Dynamic Closed",
    //   tooltip:
    //     "Dynamic questions that have completed processing and reached Dynamic Closed status.",
    //   type: "data",
    //   wa: d.whatsappDynamicCLosedCount,
    //   as: d.agrisevaDynamicCLosedCount,
    //   manual: d.manualDynamicCLosedCount,
    // },
    {
      key: "rerouted",
      label: "Rerouted Questions",
      tooltip:
        "Questions rerouted to another workflow or processing path.",
      type: "data",
      wa: d.whatsappReroutedCount,
      as: d.agrisevaReroutedCount,
      manual: d.manualReroutedCount,
    },
    {
      key: "pass",
      label: "Pass Questions",
      tooltip:
        "Questions whose current reviewer-system status is Pass.",
      type: "data",
      wa: d.whatsappPassCount,
      as: d.agrisevaPassCount,
      manual: d.manualPassCount,
    },
    // {
    //   key: "duplicateClosed",
    //   label: "Duplicate Closed",
    //   tooltip:
    //     "Duplicate questions whose processing has been completed and whose current status is Duplicate Closed.",
    //   type: "data",
    //   wa: d.whatsappDuplicateClosedCount,
    //   as: d.agrisevaDuplicateClosedCount,
    //   manual: d.manualDuplicateClosedCount,
    // },

    {
      key: "summaryDelayReason",
      label: "Summary of delay reason",
      tooltip:
        "Summary explaining why questions exceeded the expected response or processing time.",
      type: "data",
      wa: "—",
      as: "—",
      manual: "—",
    },

   {
      key: "averageEndToEndQnaCompletion",
      label: "Average Response Time for End to End QNA Completion",
      tooltip: "Average end-to-end completion time for all completed questions",
      type: "data",
      wa: formatMinutes(d.whatsappAverageEndToEndQnaCompletionMinutes),
      as: formatMinutes(d.agrisevaAverageEndToEndQnaCompletionMinutes),
      manual: formatMinutes(d.manualAverageEndToEndQnaCompletionMinutes),
    },
    {
      key: "averageEndToEndUnique",
      label: "Average Response Time for End to End QNA Completion of Unique Questions",
      tooltip: "Average end-to-end completion time for unique questions",
      type: "data",
      wa: formatMinutes(d.whatsappAverageEndToEndUniqueMinutes),
      as: formatMinutes(d.agrisevaAverageEndToEndUniqueMinutes),
      manual: formatMinutes(d.manualAverageEndToEndUniqueMinutes),
    },
    {
      key: "averageEndToEndDynamic",
      label: "Average Response Time for End to End QNA Completion of Dynamic Question",
      tooltip: "Average end-to-end completion time for dynamic questions",
      type: "data",
      wa: formatMinutes(d.whatsappAverageEndToEndDynamicMinutes),
      as: formatMinutes(d.agrisevaAverageEndToEndDynamicMinutes),
      manual: formatMinutes(d.manualAverageEndToEndDynamicMinutes),
    },
    {
      key: "averageEndToEndDuplicate",
      label: "Average Response Time for End to End QNA Completion of Duplicate Question",
      tooltip: "Average end-to-end completion time for duplicate questions",
      type: "data",
      wa: formatMinutes(d.whatsappAverageEndToEndDuplicateMinutes),
      as: formatMinutes(d.agrisevaAverageEndToEndDuplicateMinutes),
      manual: formatMinutes(d.manualAverageEndToEndDuplicateMinutes),
    },

    // {
    //   key: "avgResponse",
    //   label: "Avg. Response Time",
    //   tooltip:
    //     "Average time from question creation to operational completion across all completed question categories.",
    //   type: "data",
    //   wa: formatMinutes(d.whatsappAverageResponseMinutes),
    //   as: formatMinutes(d.agrisevaAverageResponseMinutes),
    //   manual: formatMinutes(d.manualAverageResponseMinutes),
    // },
    // {
    //   key: "avgResponseGDB",
    //   label: "Avg. Response Time of GDB",
    //   tooltip:
    //     "Average time from question creation to closure for GDB-based questions.",
    //   type: "data",
    //   wa: formatMinutes(d.whatsappAverageResponseGBDMinutes),
    //   as: formatMinutes(d.agrisevaAverageResponseGBDMinutes),
    //   manual: formatMinutes(d.manualAverageResponseGBDMinutes),
    // },
    // {
    //   key: "avgResponseNonGDB",
    //   label: "Avg. Response Time of Non GDB",
    //   tooltip:
    //     "Average time from question creation to operational completion for Non-GDB questions, including Pass, Dynamic Closed, and Duplicate Closed.",
    //   type: "data",
    //   wa: formatMinutes(d.whatsappAverageResponseNonGBDMinutes),
    //   as: formatMinutes(d.agrisevaAverageResponseNonGBDMinutes),
    //   manual: formatMinutes(d.manualAverageResponseNonGBDMinutes),
    // },
    {
      key: "slaBreached",
      label: "SLA Breached",
      tooltip:
        "Percentage of completed questions that were not completed within the 120-minute SLA. Calculated as 100% minus the 120-minute adherence percentage.",
      type: "data",
      wa:
        d.whatsappAdherencePct != null
          ? `${(100 - d.whatsappAdherencePct).toFixed(2)}%`
          : "—",
      as:
        d.agrisevaAdherencePct != null
          ? `${(100 - d.agrisevaAdherencePct).toFixed(2)}%`
          : "—",
      manual:
        d.manualAdherencePct != null
          ? `${(100 - d.manualAdherencePct).toFixed(2)}%`
          : "—",
      highlight: false,
    },
    {
      key: "adherencePct",
      label: "% Responded within 120 min",
      tooltip:
        "Percentage of completed questions that were operationally completed within 120 minutes of creation.",
      type: "data",
      wa:
        d.whatsappAdherencePct != null
          ? `${d.whatsappAdherencePct.toFixed(2)}%`
          : "—",
      as:
        d.agrisevaAdherencePct != null
          ? `${d.agrisevaAdherencePct.toFixed(2)}%`
          : "—",
      manual:
        d.manualAdherencePct != null
          ? `${d.manualAdherencePct.toFixed(2)}%`
          : "—",
      highlight: true,
    },
  ];


  const hasSelectedRows = rowExportData.some((row) => checkedRows[row.id]);

  const handleDownloadSelectedFields = () => {
    const selectedRows = rowExportData.filter((row) => checkedRows[row.id]);
    if (!selectedRows.length) return;

    const header = ["Field"];
    if (checkedColumns.whatsapp) {
      header.push("Whatsapp");
    }
    if (checkedColumns.agriSeva) {
      header.push("AgriSeva-AI");
    }
    if (checkedColumns.manual) {
      header.push("Manual");
    }
    header.push("Notes");

    const lines = selectedRows.map((row) => {
      const values: (string | number)[] = [row.field];

      if (checkedColumns.whatsapp) {
        values.push(row.whatsapp);
      }

      if (checkedColumns.agriSeva) {
        values.push(row.agriSeva);
      }

      if (checkedColumns.manual) {
        values.push(row.manual);
      }

      values.push(row.notes);

      return values
        .map((value) => csvEscape(value))
        .join(",");
    });

    const csvContent = ["\uFEFF" + header.join(","), ...lines].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    const now = new Date();
    const timestamp = `${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
    anchor.download = `response-adherence-report-${effectiveDate}-${timestamp}.csv`;    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(downloadUrl);
  };

  const rowCheck = (rowId: string) => (
    <input
      type="checkbox"
      checked={!!checkedRows[rowId]}
      onChange={() => toggleRow(rowId)}
      className="h-5 w-5 cursor-pointer accent-primary"
    />
  );
  const queryClient = useQueryClient();
  const handleRefresh = async ()=>{
    await queryClient.refetchQueries({ queryKey: ["response-adherence-table"] });
  }

  return (
    // <Card className="mb-4 rounded-2xl border border-border/60 bg-muted/5 shadow-none">
    //   <Accordion type="single" collapsible>
    //     <AccordionItem value="response-adherence" className="border-none">
    //       {/* ── Card Header ── */}
    //       <CardHeader className="p-0">
    //         <AccordionTrigger className="w-full px-6 py-2.5 hover:no-underline">
    //           <div className="flex w-full items-center justify-between gap-4">
    //             {/* Left */}
    //             <div className="flex items-center gap-2 min-w-0">
    //               <ClipboardCheck className="w-4.5 h-4.5 text-primary shrink-0" />

    //               <CardTitle className="text-base font-semibold tracking-tight text-foreground">
    //                 Response Adherence Summary
    //               </CardTitle>
    //             </div>

    //             {/* Right Section */}
    //             <div
    //               className="flex items-center gap-2 ml-auto mr-3"
    //               onClick={(e) => e.stopPropagation()}
    //             >
    //               {/* Date Picker */}
    //               <Popover>
    //                 <PopoverTrigger asChild>
    //                   <Button
    //                     variant="outline"
    //                     className="h-9 min-w-[200px] justify-start text-sm font-normal border-border/70 bg-background"
    //                   >
    //                     <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />

    //                     {format(
    //                       parseInputDateToLocalDate(effectiveDate),
    //                       "MMM dd, yyyy",
    //                     )}
    //                   </Button>
    //                 </PopoverTrigger>

    //                 <PopoverContent className="w-auto p-0" align="end">
    //                   <Calendar
    //                     initialFocus
    //                     mode="single"
    //                     selected={parseInputDateToLocalDate(effectiveDate)}
    //                     onSelect={(date) => {
    //                       if (!date) return;
    //                       handleDateChange(todayAsInputDate(date));
    //                     }}
    //                     disabled={{ after: new Date() }}
    //                   />
    //                 </PopoverContent>
    //               </Popover>

    //               {/* Download */}
    //               <Button
    //                 type="button"
    //                 variant="outline"
    //                 size="sm"
    //                 onClick={handleDownloadSelectedFields}
    //                 disabled={!hasSelectedRows}
    //                 className="h-9 px-4 text-sm gap-2 border-border/70"
    //               >
    //                 <Download className="w-3.5 h-3.5" />
    //                 Download .xlsx
    //               </Button>
    //             </div>
    //           </div>
    //         </AccordionTrigger>
    //       </CardHeader>

    //       {/* ── Accordion Content ── */}
    //       <AccordionContent>
    //         <CardContent className="pt-0">
    //           {isLoading && (
    //             <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
    //               <Loader2 className="h-3 w-3 animate-spin" />
    //               Fetching data for selected date…
    //             </div>
    //           )}

    //           <div className="overflow-x-auto rounded-xl border border-border/50">
    //             <table className="w-full min-w-[720px] border-collapse text-sm">
    //               <tbody>
    //                 {rows.map((row) => {
    //                   if (row.type === "single") {
    //                     return (
    //                       <tr
    //                         key={row.key}
    //                         className="hover:bg-muted/20 transition-colors"
    //                       >
    //                         <td className="border-b border-r border-border/40 px-2 py-2.5 text-center w-10">
    //                           {rowCheck(row.key)}
    //                         </td>
    //                         <td className="border-b border-r border-border/40 px-3 py-2.5 text-muted-foreground w-56">
    //                           {row.label}
    //                         </td>
    //                         <td
    //                           colSpan={row.span ? 2 : 1}
    //                           className="border-b border-border/40 px-3 py-2.5 font-medium"
    //                         >
    //                           {row.value}
    //                         </td>
    //                         {!row.span && (
    //                           <td className="border-b border-border/40" />
    //                         )}
    //                       </tr>
    //                     );
    //                   }

    //                   if (row.type === "header") {
    //                     return (
    //                       <tr key={row.key} className="bg-muted/30">
    //                         <td className="border-b border-r border-border/40 px-2 py-2.5 text-center w-10">
    //                           {rowCheck(row.key)}
    //                         </td>
    //                         <td className="border-b border-r border-border/40 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
    //                           {row.label}
    //                         </td>
    //                         <td className="border-b border-r border-border/40 px-3 py-2.5 font-semibold text-foreground">
    //                           {row.wa}
    //                         </td>
    //                         <td className="border-b border-border/40 px-3 py-2.5 font-semibold text-foreground">
    //                           {row.as}
    //                         </td>
    //                       </tr>
    //                     );
    //                   }

    //                   // data row
    //                   return (
    //                     <tr
    //                       key={row.key}
    //                       className={`hover:bg-muted/20 transition-colors ${
    //                         row.highlight ? "bg-primary/5 font-medium" : ""
    //                       }`}
    //                     >
    //                       <td className="border-b border-r border-border/40 px-2 py-2.5 text-center w-10">
    //                         {rowCheck(row.key)}
    //                       </td>
    //                       <td className="border-b border-r border-border/40 px-3 py-2.5 text-muted-foreground">
    //                         {row.label}
    //                       </td>
    //                       <td className="border-b border-r border-border/40 px-3 py-2.5 tabular-nums">
    //                         {row.wa ?? "—"}
    //                       </td>
    //                       <td className="border-b border-border/40 px-3 py-2.5 tabular-nums">
    //                         {row.as ?? "—"}
    //                       </td>
    //                     </tr>
    //                   );
    //                 })}
    //               </tbody>
    //             </table>
    //           </div>
    //         </CardContent>
    //       </AccordionContent>
    //     </AccordionItem>
    //   </Accordion>
    // </Card>

    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card
        className="group mb-4 overflow-hidden rounded-2xl border border-border/60  bg-gradient-to-br from-card to-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-300     
"
      >
        <button
            onClick={handleRefresh}
            className="absolute top-10 right-113 z-50 rounded-lg p-1.5 shadow-sm backdrop-blur-sm transition-all duration-200"
            title="Refresh"
          >
            <RefreshCw
              className={`h-3.5 w-3.5  ${
                isLoading ? "animate-spin" : ""
              }`}
            />
        </button>
        <Accordion type="single" collapsible>
          <AccordionItem value="response-adherence" className="border-none">
            {/* ── Card Header ── */}
            <CardHeader className="p-0">
              <AccordionTrigger className="w-full px-6 py-3 hover:no-underline [&[data-state=open]]:border-b [&[data-state=open]]:border-border/40">
                <div className="flex w-full items-center justify-between gap-4">
                  {/* Left */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <motion.div
                      whileHover={{ scale: 1.08, rotate: -3 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 15,
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-inset ring-primary/20"
                    >
                      <ClipboardCheck className="h-4 w-4 text-primary" />
                    </motion.div>
                    <div className="flex flex-col items-start min-w-0">
                      <CardTitle className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                        <span>Response Adherence Summary</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help inline-flex items-center text-muted-foreground/60 hover:text-muted-foreground">
                              <InfoIcon className="h-3.5 w-3.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Daily response time and completion rate metrics for questions resolved within 120 minutes.
                          </TooltipContent>
                        </Tooltip>
                      </CardTitle>
                      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Daily breakdown
                      </span>
                    </div>
                  </div>

                  {/* Right Section */}
                  <div
                    className="flex items-center gap-2 ml-auto mr-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Date Picker */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <motion.div
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <Button
                            variant="outline"
                            className="h-9 min-w-[200px] justify-start text-sm font-normal border-border/70 bg-background/80 backdrop-blur-sm shadow-sm hover:bg-muted/40"
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                            {format(
                              parseInputDateToLocalDate(effectiveDate),
                              "MMM dd, yyyy",
                            )}
                          </Button>
                        </motion.div>
                      </PopoverTrigger>

                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          initialFocus
                          mode="single"
                          selected={parseInputDateToLocalDate(effectiveDate)}
                          onSelect={(date) => {
                            if (!date) return;
                            handleDateChange(todayAsInputDate(date));
                          }}
                          disabled={{ after: new Date() }}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>

                    {/* Download */}
                    <motion.div
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadSelectedFields}
                        disabled={!hasSelectedRows}
                        className="h-9 px-4 text-sm gap-2 border-border/70 bg-background/80 shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                      >
                        <motion.span
                          animate={hasSelectedRows ? { y: [0, -2, 0] } : {}}
                          transition={{
                            repeat: Infinity,
                            repeatDelay: 2,
                            duration: 0.8,
                          }}
                          className="inline-flex"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </motion.span>
                        Download .xlsx
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </AccordionTrigger>
            </CardHeader>

            {/* ── Accordion Content ── */}
            <AccordionContent>
              <CardContent className="pt-4">
                <AnimatePresence>
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 mb-3 text-xs text-muted-foreground overflow-hidden"
                    >
                      <Skeleton className="h-4 w-56 rounded-md" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                  className="overflow-x-auto rounded-xl border border-border/50 shadow-sm"
                >
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <tbody>
                      {rows.map((row, idx) => {
                        const baseMotion = {
                          initial: { opacity: 0, x: -8 },
                          animate: { opacity: 1, x: 0 },
                          transition: {
                            duration: 0.25,
                            delay: idx * 0.03,
                            ease: "easeOut" as const,
                          },
                        };

                        if (row.type === "single") {
                          return (
                            <motion.tr
                              key={row.key}
                              {...baseMotion}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              <td className="border-b border-r border-border/40 px-2 py-2.5 text-center w-10">
                                {rowCheck(row.key)}
                              </td>
                              <td className="border-b border-r border-border/40 px-3 py-2.5 text-muted-foreground w-56">
                                {row.label}
                              </td>
                              <td
                                colSpan={row.span ? 3 : 2}
                                className="border-b border-border/40 px-3 py-2.5 font-medium tabular-nums"
                              >
                                {row.value}
                              </td>
                              {!row.span && (
                                <td className="border-b border-border/40" />
                              )}
                            </motion.tr>
                          );
                        }

                        if (row.type === "header") {
                          return (
                            <motion.tr
                              key={row.key}
                              {...baseMotion}
                              className="bg-muted/40"
                            >
                              <td className="border-b border-r border-border/40 px-2 py-2.5 text-center w-10">
                                {rowCheck(row.key)}
                              </td>
                              <td className="border-b border-r border-border/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                {row.label}
                              </td>
                              <td className="border-b border-r border-border/40 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={checkedColumns.whatsapp}
                                    onChange={() => toggleColumn("whatsapp")}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-4 w-4 cursor-pointer accent-primary"
                                  />
                                {row.wa}
                                </div>
                              </td>
                              <td className="border-b border-r border-border/40 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground">
                                <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={checkedColumns.agriSeva}
                                  onChange={() => toggleColumn("agriSeva")}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-4 w-4 cursor-pointer accent-primary"
                                />
                                {row.as}
                                </div>
                              </td>
                              <td className="border-b border-r border-border/40 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground">  
                                <span className="flex gap-2">
                                  <input
                                    type="checkbox"
                                    checked={checkedColumns.manual}
                                    onChange={() => toggleColumn("manual")}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-4 w-4 cursor-pointer accent-primary"
                                  />
                                  {row.manual}
                                  <span className="flex items-center gap-1 ml-2">
                                    <BreakdownTooltip
                                      items={[
                                        {
                                          label: "Manual",
                                          count: data?.manualTotal ?? 0,
                                          key: "MANUAL",
                                        },
                                        {
                                          label: "Agri Expert",
                                          count: data?.agriexpertTotal ?? 0,
                                          key: "AGRI_EXPERT",
                                        },
                                        {
                                          label: "Outreach",
                                          count: data?.outreachTotal ?? 0,
                                          key: "OUTREACH",
                                        },
                                      ]}
                                      effectiveDate = {effectiveDate}
                                      userType={userType}
                                  />
                                </span>
                                </span>
                              </td>
                            </motion.tr>
                          );
                        }

                        return (
                          <motion.tr
                            key={row.key}
                            {...baseMotion}
                            className={`hover:bg-muted/30 transition-colors ${
                              row.highlight
                                ? "bg-primary/5 font-medium ring-1 ring-inset ring-primary/10"
                                : ""
                            }`}
                          >
                            <td className="border-b border-r border-border/40 px-2 py-2.5 text-center w-10">
                              {rowCheck(row.key)}
                            </td>
                            <td className="border-b border-r border-border/40 px-3 py-2.5 text-muted-foreground w-[300px] min-w-[300px]">
                              <div className="flex w-full items-center justify-between gap-3">
                                <span>{row.label}</span>

                                {row.tooltip && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <InfoIcon className="h-4 w-4" />
                                      </button>
                                    </TooltipTrigger>

                                    <TooltipContent
                                      side="top"
                                      className="max-w-xs text-sm"
                                    >
                                      <p>{row.tooltip}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </td>
                            <td className="border-b border-r border-border/40 px-3 py-2.5 tabular-nums">
                              {row.wa ?? "—"}
                            </td>
                            <td className="border-b border-border/40 px-3 py-2.5 tabular-nums">
                              {row.as ?? "—"}
                            </td>
                            <td className="border-b border-l border-border/40 px-3 py-2.5 tabular-nums">
                              {row.manual ?? "—"}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </motion.div>
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    </motion.div>
  );
}
