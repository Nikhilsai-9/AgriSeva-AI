import { UserProfileActions } from "@/components/atoms/user-profile-actions";
import { ThemeToggleCompact } from "./atoms/ThemeToggle";
import { BellIcon, Sprout } from "lucide-react";
import { MobileSidebar } from "./mobile-sidebar";
import { HoverCard } from "./atoms/hover-card";
import { NotificationModal } from "./NotificationModal";
import { TabsList, TabsTrigger } from "@/components/atoms/tabs";
import { canManageUsers } from "@/lib/roles";
import { AgriSevaBrand } from "./AgriSevaBrand";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useTranslation } from "@/locales";
import type { IUser } from "@/types";

export function PlaygroundHeader({
  user,
  activeTab,
  onTabChange,
  setTab,
  setChatbotSource,
}: {
  user: IUser | null | undefined;
  activeTab: string;
  onTabChange: (value: string) => void;
  setTab: (value: string) => void;
  setChatbotSource: (value: "whatsapp" | "annam" | "acc") => void;
}) {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-2 sm:py-2.5">
        {/* AgriSeva Brand Logo & Tagline */}
        <div className="flex items-center shrink-0 cursor-pointer">
          <AgriSevaBrand size="sm" showSlogan={true} />
        </div>

        <div className="flex-1 md:flex justify-center min-w-0 hidden ">
          <TabsList className="flex gap-2 overflow-x-auto whitespace-nowrap bg-transparent p-0 no-scrollbar">
            {user &&
              user.role !== "expert" &&
              user.role !== "call_agent" &&
              user.role !== "gate_keeper" &&
              user.role !== "auditor" && (
                <TabsTrigger
                  value="performance"
                  className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm md:text-base transition-all duration-150 flex-shrink-0"
                >
                  <HoverCard openDelay={150}>
                    <span>{t("dashboard.tabsDashboard", "Dashboard")}</span>
                  </HoverCard>
                </TabsTrigger>
              )}
            {/* Gate keepers / auditors get their own role dashboard instead. */}
            {user && (user.role === "gate_keeper" || user.role === "auditor") && (
              <TabsTrigger
                value="roleDashboard"
                className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm md:text-base transition-all duration-150 flex-shrink-0"
              >
                <HoverCard openDelay={150}>
                  <span>{t("dashboard.tabsDashboard", "Dashboard")}</span>
                </HoverCard>
              </TabsTrigger>
            )}
            {user && user.role === "expert" && (
              <TabsTrigger
                value="expertPerformance"
                className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm md:text-base transition-all duration-150 flex-shrink-0"
              >
                <HoverCard openDelay={150}>
                  <span>{t("dashboard.tabsDashboard", "Dashboard")}</span>
                </HoverCard>
              </TabsTrigger>
            )}

            {/* ── Farmer Dashboard ── position #2 in main nav (all non-call-agent roles) */}
            {user && user.role !== "call_agent" && (
              <TabsTrigger
                value="farmer_dashboard"
                className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm md:text-base transition-all duration-150 flex-shrink-0 flex items-center gap-1.5"
              >
                <HoverCard openDelay={150}>
                  <span className="flex items-center gap-1.5">
                    <Sprout className="h-4 w-4 text-emerald-600" />
                    {t("sidebar.farmerDashboard", "Farmer Dashboard")}
                  </span>
                </HoverCard>
              </TabsTrigger>
            )}

            {user && user.role == "expert" && (
              <TabsTrigger
                value="questions"
                className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm md:text-base transition-all duration-150 flex-shrink-0"
              >
                <span>{t("dashboard.tabsQueue", "My Queue")}</span>
              </TabsTrigger>
            )}
            {user && user.role !== "call_agent" && (
              <TabsTrigger
                value="all_questions"
                className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm md:text-base transition-all duration-150 flex-shrink-0"
              >
                <span>{t("dashboard.tabsAll", "All Questions")}</span>
              </TabsTrigger>
            )}

            {user && canManageUsers(user.role) && (
                <TabsTrigger
                  value="user_management"
                  className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm md:text-base transition-all duration-150 flex-shrink-0"
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
                className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm md:text-base transition-all duration-150 flex-shrink-0"
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
                  className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm md:text-base transition-all duration-150 flex-shrink-0"
                >
                  <HoverCard openDelay={150}>
                    <span>{t("dashboard.tabsDashboard", "Dashboard")}</span>
                  </HoverCard>
                </TabsTrigger>
                <TabsTrigger
                  value="call_interface"
                  className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm md:text-base transition-all duration-150 flex-shrink-0"
                >
                  <HoverCard openDelay={150}>
                    <span>{t("dashboard.tabsCallInterface", "Call Interface")}</span>
                  </HoverCard>
                </TabsTrigger>
                <TabsTrigger
                  value="call_history"
                  className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm md:text-base transition-all duration-150 flex-shrink-0"
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
                onClick={() => onTabChange("manage_agents")}
                className={
                  activeTab === "manage_agents"
                    ? "bg-accent text-accent-foreground"
                    : ""
                }
              >
                {t("dashboard.tabsManageAgents", "Manage Agents")}
              </TabsTrigger>
            )}

            {user &&
              (user.role === "admin" ||
              user.role === "moderator") && (
                <TabsTrigger
                  value="chatbotanalytics"
                  className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm md:text-base transition-all duration-150 flex-shrink-0"
                >
                  <span>{t("dashboard.tabsAnalytics", "ChatBot Analytics")}</span>
                </TabsTrigger>
              )}
            {user && user.role === "admin" && (
              <TabsTrigger
                value="data_processing"
                className="px-2 md:px-3 py-1.5 rounded-lg font-medium text-sm md:text-base transition-all duration-150 flex-shrink-0"
              >
                <span>{t("dashboard.tabsDataProcessing", "Data Processing")}</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* RIGHT SIDE ICONS */}
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 shrink-0">
          <LanguageSwitcher variant="outline" />

          {/* Notifications */}
          <NotificationModal
            trigger={
              <button 
                type="button"
                aria-label={t("common.notifications", "Notifications")}
                className="relative p-1.5 sm:p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer text-foreground shrink-0"
              >
                <BellIcon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground hover:text-foreground transition" />
                {user?.notifications! > 0 && (
                  <span className="absolute -top-[2px] -right-[6px] sm:-top-[4px] sm:-right-[10px] flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] sm:text-[10px] font-semibold text-white">
                    {user?.notifications! > 99
                      ? "99+"
                      : user?.notifications}
                  </span>
                )}
              </button>
            }
          />

          <ThemeToggleCompact />

          <UserProfileActions />

          <MobileSidebar
            user={user!}
            setTab={setTab}
            setChatbotSource={setChatbotSource}
          />
        </div>
      </div>
    </header>
  );
}
