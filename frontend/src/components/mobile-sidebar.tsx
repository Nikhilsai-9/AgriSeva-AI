import type { IUser } from "@/types";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Clock,
  Database,
  History,
  List,
  Menu,
  MessageSquare,
  Phone,
  Sprout,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { canManageUsers, isCoordinatorRole } from "@/lib/roles";
import { Sheet, SheetContent, SheetTrigger } from "./atoms/sheet";
import { AgriSevaBrand } from "./AgriSevaBrand";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggleCompact } from "./atoms/ThemeToggle";
import { UserProfileActions } from "./atoms/user-profile-actions";
import { useTranslation } from "@/locales";

const SidebarButton = ({
  label,
  icon: Icon,
  onClick,
  isActive = false,
}: {
  label: string;
  icon: any;
  onClick: () => void;
  isActive?: boolean;
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        group w-full px-3.5 sm:px-4 py-2.5 sm:py-3 min-h-[44px]
        flex items-center gap-3
        text-left rounded-lg 
        transition-all duration-200 
        ${
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground hover:bg-accent hover:text-accent-foreground"
        }
        active:scale-[0.98]
      `}
    >
      <Icon
        className={`w-5 h-5 flex-shrink-0 ${
          isActive ? "" : "text-muted-foreground group-hover:text-foreground"
        }`}
      />
      <span className="font-medium text-sm sm:text-base truncate">{label}</span>
    </button>
  );
};

export const MobileSidebar = ({
  user,
  setTab,
  setChatbotSource,
}: {
  user: IUser;
  setTab: (value: string) => void;
  setChatbotSource: (value: "whatsapp" | "annam" | "acc") => void;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(
    user?.role === "call_agent"
      ? "call_interface"
      : user?.role === "gate_keeper" || user?.role === "auditor"
        ? "roleDashboard"
        : user?.role !== "expert"
          ? "performance"
          : "questions",
  );
  const isCoordinator = isCoordinatorRole(user?.role);
  const handleClick = (value: string) => {
    if (value === "chatbotanalytics") {
      // ChatBot Analytics is now its own route rather than an in-page tab.
      navigate({ to: "/chatbot" });
    } else if (value === "whatsapp_history") {
      navigate({ to: "/whatsapp-history" });
    } else if (value === "farmer") {
      // Farmer Dashboard lives at its own route.
      navigate({ to: "/farmer" });
    } else {
      setTab(value);
      setActiveTab(value);
    }

    setOpen(false);
  };

  const menuItems = [
    // Gate keepers and auditors get their own role dashboard; every other non-expert,
    // non-call-agent role gets the standard performance dashboard.
    ...(user &&
    user.role !== "expert" &&
    user.role !== "call_agent" &&
    user.role !== "gate_keeper" &&
    user.role !== "auditor"
      ? [{ id: "performance", label: t("sidebar.dashboard", "Dashboard"), icon: BarChart3 }]
      : []),

    ...(user && (user.role === "gate_keeper" || user.role === "auditor")
      ? [{ id: "roleDashboard", label: t("sidebar.dashboard", "Dashboard"), icon: BarChart3 }]
      : []),

    ...(user && user.role === "expert"
      ? [{ id: "expertPerformance", label: t("sidebar.dashboard", "Dashboard"), icon: BarChart3 }]
      : []),

    // ── Farmer Dashboard ── position #2 (all roles, excludes call_agent)
    ...(user && user.role !== "call_agent"
      ? [{ id: "farmer", label: t("sidebar.farmerDashboard", "Farmer Dashboard"), icon: Sprout }]
      : []),

    ...(user && user.role === "expert"
      ? [{ id: "questions", label: t("sidebar.questions", "Questions"), icon: MessageSquare }]
      : []),

    ...(user && user.role !== "call_agent"
      ? [{ id: "all_questions", label: t("sidebar.allQuestions", "All Questions"), icon: List }]
      : []),

    ...(user && canManageUsers(user.role)
      ? [
          {
            id: "user_management",
            label:
              user.role === "admin"
                ? t("sidebar.userManagement", "User Management")
                : t("sidebar.expertManagement", "Expert Management"),
            icon: Users,
          },
        ]
      : []),

    ...(user && user.role !== "expert" && user.role !== "call_agent"
      ? [{ id: "request_queue", label: t("sidebar.flagsReported", "Flags Reported"), icon: AlertTriangle }]
      : []),

    ...(user && user.role !== "call_agent"
      ? [{ id: "upload", label: t("sidebar.agentsInterface", "Agents Interface"), icon: Upload }]
      : []),

    ...(user && user.role === "call_agent"
      ? [
          { id: "call_dashboard", label: t("sidebar.callDashboard", "Call Dashboard"), icon: TrendingUp },
          { id: "call_interface", label: t("sidebar.callInterface", "Call Interface"), icon: Phone },
          { id: "call_history", label: t("sidebar.callHistory", "Call History"), icon: Clock },
        ]
      : []),

    ...(user && user.role !== "expert" && user.role !== "call_agent"
      ? [
          {
            id: "chatbotanalytics",
            label: t("sidebar.chatbotAnalytics", "Chatbot Analytics"),
            icon: Bot,
          },
        ]
      : []),

    ...(user && user.role === "admin"
      ? [{ id: "data_processing", label: t("sidebar.dataProcessing", "Data Processing"), icon: Database }]
      : []),

    ...(user && !isCoordinator && user.role !== "call_agent"
      ? [{ id: "history", label: t("sidebar.history", "History"), icon: History }]
      : []),
    ...(user && !isCoordinator && user.role !== "call_agent"
      ? [
          {
            id: "whatsapp_history",
            label: t("sidebar.whatsappHistory", "WhatsApp History"),
            icon: MessageSquare,
          },
        ]
      : []),
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-accent transition-colors flex items-center justify-center cursor-pointer text-foreground shrink-0 select-none min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] lg:hidden"
          aria-label={t("sidebar.menu", "Open navigation menu")}
          title={t("sidebar.menu", "Menu")}
        >
          <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="
          fixed left-0 top-0 h-full
          w-[min(20rem,calc(100vw-1rem))] xxs:w-[min(18rem,calc(100vw-1rem))] sm:w-80 max-w-[88vw] p-0 flex flex-col pt-0
          bg-background border-r
          shadow-2xl
          animate-in slide-in-from-left duration-300
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b bg-muted/30">
          <AgriSevaBrand size="sm" showSlogan={false} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 xxs:px-4 sm:px-5 py-4 sm:py-6 space-y-1 overflow-y-auto overscroll-contain">
          {menuItems.map((item) => (
            <SidebarButton
              key={item.id}
              label={item.label}
              icon={item.icon}
              onClick={() => handleClick(item.id)}
              isActive={item.id === activeTab}
            />
          ))}
        </nav>

        {/* Footer — visible only below lg.
         * The global header hides <UserProfileActions>, <ThemeToggleCompact>
         * and <LanguageSwitcher> at mobile widths to keep the chrome
         * uncluttered at 320-480px. This footer restores access to them
         * inside the hamburger sheet so every chrome control is reachable
         * from the same place on phones & tablets. */}
        <div className="lg:hidden border-t bg-muted/30 px-3 xxs:px-4 sm:px-5 py-3 sm:py-4 pb-safe space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <LanguageSwitcher variant="outline" />
            <ThemeToggleCompact />
          </div>
          <div className="flex items-center gap-2">
            <UserProfileActions />
            <span className="text-xs text-muted-foreground truncate min-w-0">
              {user?.firstName
                ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
                : user?.email}
            </span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
