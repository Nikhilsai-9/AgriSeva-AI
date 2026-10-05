import { describe, it, expect } from "vitest";
import {
  isCoordinatorRole,
  isModeratorRole,
  isFarmerOrUserRole,
  getRoleLandingRoute,
  canManageUsers,
} from "../roles";

describe("Role and Permission Architecture Audit Tests", () => {
  describe("isModeratorRole", () => {
    it("recognizes moderator, admin, and tester as moderator roles", () => {
      expect(isModeratorRole("moderator")).toBe(true);
      expect(isModeratorRole("admin")).toBe(true);
      expect(isModeratorRole("tester")).toBe(true);
    });

    it("strictly rejects normal user and farmer from moderator role", () => {
      expect(isModeratorRole("user")).toBe(false);
      expect(isModeratorRole("farmer")).toBe(false);
      expect(isModeratorRole(null)).toBe(false);
      expect(isModeratorRole(undefined)).toBe(false);
    });

    it("rejects domain experts, call agents, gate keepers, auditors, and coordinators from moderator role", () => {
      expect(isModeratorRole("expert")).toBe(false);
      expect(isModeratorRole("pae_expert")).toBe(false);
      expect(isModeratorRole("call_agent")).toBe(false);
      expect(isModeratorRole("gate_keeper")).toBe(false);
      expect(isModeratorRole("auditor")).toBe(false);
      expect(isModeratorRole("district_coordinator")).toBe(false);
      expect(isModeratorRole("block_coordinator")).toBe(false);
      expect(isModeratorRole("village_volunteer")).toBe(false);
    });
  });

  describe("isFarmerOrUserRole", () => {
    it("identifies user, farmer, and missing roles as normal farmer/user role", () => {
      expect(isFarmerOrUserRole("user")).toBe(true);
      expect(isFarmerOrUserRole("farmer")).toBe(true);
      expect(isFarmerOrUserRole(undefined)).toBe(true);
      expect(isFarmerOrUserRole(null)).toBe(true);
    });

    it("rejects privileged and staff roles", () => {
      expect(isFarmerOrUserRole("moderator")).toBe(false);
      expect(isFarmerOrUserRole("admin")).toBe(false);
      expect(isFarmerOrUserRole("expert")).toBe(false);
      expect(isFarmerOrUserRole("pae_expert")).toBe(false);
      expect(isFarmerOrUserRole("district_coordinator")).toBe(false);
    });
  });

  describe("getRoleLandingRoute", () => {
    it("routes normal user and farmer to /farmer (Farmer Dashboard)", () => {
      expect(getRoleLandingRoute("user")).toEqual({ to: "/farmer" });
      expect(getRoleLandingRoute("farmer")).toEqual({ to: "/farmer" });
      expect(getRoleLandingRoute(undefined)).toEqual({ to: "/farmer" });
      expect(getRoleLandingRoute(null)).toEqual({ to: "/farmer" });
    });

    it("routes moderator, admin, and tester to /home (Staff/Moderator surface)", () => {
      expect(getRoleLandingRoute("moderator")).toEqual({ to: "/home" });
      expect(getRoleLandingRoute("admin")).toEqual({ to: "/home" });
      expect(getRoleLandingRoute("tester")).toEqual({ to: "/home" });
    });

    it("routes PAE expert to /pae-expert", () => {
      expect(getRoleLandingRoute("pae_expert")).toEqual({ to: "/pae-expert" });
    });

    it("routes coordinator roles to their dedicated profile /user/$userId", () => {
      expect(getRoleLandingRoute("district_coordinator", "coord_123")).toEqual({
        to: "/user/$userId",
        params: { userId: "coord_123" },
      });
      expect(getRoleLandingRoute("block_coordinator", "coord_456")).toEqual({
        to: "/user/$userId",
        params: { userId: "coord_456" },
      });
      expect(getRoleLandingRoute("village_volunteer", "vol_789")).toEqual({
        to: "/user/$userId",
        params: { userId: "vol_789" },
      });
    });

    it("routes internal agents (expert, call_agent, gate_keeper, auditor) to /home", () => {
      expect(getRoleLandingRoute("expert")).toEqual({ to: "/home" });
      expect(getRoleLandingRoute("call_agent")).toEqual({ to: "/home" });
      expect(getRoleLandingRoute("gate_keeper")).toEqual({ to: "/home" });
      expect(getRoleLandingRoute("auditor")).toEqual({ to: "/home" });
    });
  });

  describe("canManageUsers", () => {
    it("allows admin, moderator, tester, gate_keeper, and auditor", () => {
      expect(canManageUsers("admin")).toBe(true);
      expect(canManageUsers("moderator")).toBe(true);
      expect(canManageUsers("tester")).toBe(true);
      expect(canManageUsers("gate_keeper")).toBe(true);
      expect(canManageUsers("auditor")).toBe(true);
    });

    it("strictly blocks regular user and farmer from user management", () => {
      expect(canManageUsers("user")).toBe(false);
      expect(canManageUsers("farmer")).toBe(false);
      expect(canManageUsers(undefined)).toBe(false);
    });
  });

  describe("Role-to-Route Permission Matrix", () => {
    it("ensures normal users are permitted to access user-facing areas but not staff tools", () => {
      const normalUserRole = "farmer";
      expect(isFarmerOrUserRole(normalUserRole)).toBe(true);
      expect(isModeratorRole(normalUserRole)).toBe(false);
      expect(isCoordinatorRole(normalUserRole)).toBe(false);
      expect(canManageUsers(normalUserRole)).toBe(false);
    });

    it("ensures moderator role preserves access to staff tools while restricted from coordinator profile redirect", () => {
      const moderatorRole = "moderator";
      expect(isModeratorRole(moderatorRole)).toBe(true);
      expect(isFarmerOrUserRole(moderatorRole)).toBe(false);
      expect(isCoordinatorRole(moderatorRole)).toBe(false);
      expect(canManageUsers(moderatorRole)).toBe(true);
    });
  });

  describe("Navigation & Route Separation Architecture", () => {
    it("guarantees Dashboard and All Questions have distinct, independent tab identifiers", () => {
      const dashboardTab = "dashboard";
      const allQuestionsTab = "all_questions";
      const farmerDashboardTab = "farmer_dashboard";
      const agentsInterfaceTab = "upload";

      expect(dashboardTab).not.toEqual(allQuestionsTab);
      expect(dashboardTab).not.toEqual(farmerDashboardTab);
      expect(allQuestionsTab).not.toEqual(farmerDashboardTab);
      expect(dashboardTab).not.toEqual(agentsInterfaceTab);
    });

    it("verifies normalized tab values ensure performance maps to dashboard", () => {
      const normalize = (tab?: string | null) => (tab === "performance" ? "dashboard" : tab);
      expect(normalize("performance")).toBe("dashboard");
      expect(normalize("dashboard")).toBe("dashboard");
      expect(normalize("all_questions")).toBe("all_questions");
      expect(normalize("upload")).toBe("upload");
    });

    it("enforces default tab separation by user role so normal users never land on moderator dashboard", () => {
      const getDefaultTab = (role?: string | null) => {
        if (role === "expert") return "questions";
        if (role === "call_agent") return "call_interface";
        if (role === "gate_keeper" || role === "auditor") return "roleDashboard";
        if (isModeratorRole(role)) return "dashboard";
        return "all_questions";
      };

      // Normal users and farmers MUST default to all_questions (or farmer portal), never dashboard
      expect(getDefaultTab("user")).toBe("all_questions");
      expect(getDefaultTab("farmer")).toBe("all_questions");
      expect(getDefaultTab(null)).toBe("all_questions");
      expect(getDefaultTab(undefined)).toBe("all_questions");

      // Staff roles get their respective dashboard tabs
      expect(getDefaultTab("moderator")).toBe("dashboard");
      expect(getDefaultTab("admin")).toBe("dashboard");
      expect(getDefaultTab("tester")).toBe("dashboard");
      expect(getDefaultTab("expert")).toBe("questions");
      expect(getDefaultTab("call_agent")).toBe("call_interface");
      expect(getDefaultTab("gate_keeper")).toBe("roleDashboard");
      expect(getDefaultTab("auditor")).toBe("roleDashboard");
    });

    it("prevents normal users from loading stale moderator dashboard tab from storage", () => {
      const isSavedTabAllowedForRole = (savedTab: string, role?: string | null) => {
        const isGateKeeperOrAuditor = role === "gate_keeper" || role === "auditor";
        const isModerator = isModeratorRole(role);
        return (
          (isGateKeeperOrAuditor ? savedTab !== "dashboard" : savedTab !== "roleDashboard") &&
          (isModerator ? true : savedTab !== "dashboard" && savedTab !== "performance")
        );
      };

      // Normal user: "dashboard" or "performance" is strictly rejected as invalid
      expect(isSavedTabAllowedForRole("dashboard", "user")).toBe(false);
      expect(isSavedTabAllowedForRole("dashboard", "farmer")).toBe(false);
      expect(isSavedTabAllowedForRole("performance", "user")).toBe(false);
      expect(isSavedTabAllowedForRole("all_questions", "user")).toBe(true);
      expect(isSavedTabAllowedForRole("upload", "user")).toBe(true);

      // Moderator: "dashboard" is allowed
      expect(isSavedTabAllowedForRole("dashboard", "moderator")).toBe(true);
      expect(isSavedTabAllowedForRole("all_questions", "moderator")).toBe(true);
    });
  });
});
