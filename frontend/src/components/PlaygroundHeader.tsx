/**
 * PlaygroundHeader - in-page tabs row rendered inside PlaygroundPage (/home).
 *
 * The global brand row + actions (sign-out, language switcher, notifications,
 * profile menu) are now provided ONCE by the shared MainDashboardShell. So
 * PlaygroundHeader ONLY renders the role-gated TabsList - no brand, no actions.
 *
 * Position 2 = Farmer Dashboard lives in the global nav (MainDashboardHeader)
 * to avoid duplication. It is intentionally omitted from the in-page tabs.
 */

import { HoverCard } from "./atoms/hover-card";
import { TabsList, TabsTrigger } from "@/components/atoms/tabs";
import { canManageUsers } from "@/lib/roles";
import { useTranslation } from "@/locales";
import type { IUser } from "@/types";

export function PlaygroundHeader({
  user,
  activeTab,
}: {
  user: IUser | null | undefined;
  activeTab: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="sticky top-14 sm:top-16 z-30 w-full border-b border-emerald-100 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70"
      data-testid="playground-tabs-row"
    >
      <div className="mx-auto px-3 sm:px-4 py-2">
        <TabsList className="flex gap-1.5 overflow-x-auto whitespace-nowrap bg-transparent p-0 no-scrollbar">
          {user &&
            user.role !== "expert" &&
            user.role !== "call_agent" &&
            user.role !== "gate_keeper" &&
            user.role !== "auditor" && (
              <TabsTrigger
                value="performance"
                className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-150 flex-shrink-0"
              >
                <HoverCard openDelay={150}>
                  <span>{t("dashboard.tabsDashboard", "Dashboard")}</span>
                </HoverCard>
              </TabsTrigger>
            )}
          {user && (user.role === "gate_keeper" || user.role === "auditor") && (
            <TabsTrigger
              value="roleDashboard"
              className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-150 flex-shrink-0"
            >
              <HoverCard openDelay={150}>
                <span>{t("dashboard.tabsDashboard", "Dashboard")}</span>
              </HoverCard>
            </TabsTrigger>
          )}
          {user && user.role === "expert" && (
            <TabsTrigger
              value="expertPerformance"
              className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-150 flex-shrink-0"
            >
              <HoverCard openDelay={150}>
                <span>{t("dashboard.tabsDashboard", "Dashboard")}</span>
              </HoverCard>
            </TabsTrigger>
          )}
          {user && user.role == "expert" && (
            <TabsTrigger
              value="questions"
              className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-150 flex-shrink-0"
            >
              <span>{t("dashboard.tabsQueue", "My Queue")}</span>
            </TabsTrigger>
          )}
          {user && user.role !== "call_agent" && (
            <TabsTrigger
              value="all_questions"
              className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-150 flex-shrink-0"
            >
              <span>{t("dashboard.tabsAll", "All Questions")}</span>
            </TabsTrigger>
          )}
          {user && canManageUsers(user.role) && (
            <TabsTrigger
              value="user_management"
              className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-150 flex-shrink-0"
            >
              <HoverCard openDelay={150}>
                <span>
                  {user.role === "admin"
                    ? t("dashboard.tabsUserMgmt", "User Management")
                    : t("dashboard.tabsExpertMgmt", "Expert Management")}
                </span>
              </HoverCard>
            </TabsTrigger>
          )}
          {user && user.role !== "call_agent" && (
            <TabsTrigger
              value="upload"
              className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-150 flex-shrink-0"
            >
              <HoverCard openDelay={150}>
                <span>{t("dashboard.tabsAgents", "Agents Interface")}</span>
              </HoverCard>
            </TabsTrigger>
          )}
          {user?.role === "call_agent" && (
            <>
              <TabsTrigger
                value="call_dashboard"
                className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-150 flex-shrink-0"
              >
                <HoverCard openDelay={150}>
                  <span>{t("dashboard.tabsDashboard", "Dashboard")}</span>
                </HoverCard>
              </TabsTrigger>
              <TabsTrigger
                value="call_interface"
                className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-150 flex-shrink-0"
              >
                <HoverCard openDelay={150}>
                  <span>{t("dashboard.tabsCallInterface", "Call Interface")}</span>
                </HoverCard>
              </TabsTrigger>
              <TabsTrigger
                value="call_history"
                className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-150 flex-shrink-0"
              >
                <HoverCard openDelay={150}>
                  <span>{t("dashboard.tabsCallHistory", "Call History")}</span>
                </HoverCard>
              </TabsTrigger>
            </>
          )}
          {user?.role === "admin" && (
            <TabsTrigger
              value="manage_agents"
              className={
                activeTab === "manage_agents"
                  ? "bg-accent text-accent-foreground px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-150 flex-shrink-0"
                  : "px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-150 flex-shrink-0"
              }
            >
              {t("dashboard.tabsManageAgents", "Manage Agents")}
            </TabsTrigger>
          )}
          {user && (user.role === "admin" || user.role === "moderator") && (
            <TabsTrigger
              value="chatbotanalytics"
              className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-150 flex-shrink-0"
            >
              <span>{t("dashboard.tabsAnalytics", "ChatBot Analytics")}</span>
            </TabsTrigger>
          )}
          {user && user.role === "admin" && (
            <TabsTrigger
              value="data_processing"
              className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-150 flex-shrink-0"
            >
              <span>{t("dashboard.tabsDataProcessing", "Data Processing")}</span>
            </TabsTrigger>
          )}
        </TabsList>
      </div>
    </div>
  );
}
