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
});
