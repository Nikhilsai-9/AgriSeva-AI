import type { UserRole } from "@/types";

export const COORDINATOR_ROLES = [
  "district_coordinator",
  "block_coordinator",
  "village_volunteer",
] as const;

export const USER_ROLES = [
  "admin",
  "moderator",
  "expert",
  "pae_expert",
  "tester",
  "call_agent",
  "gate_keeper",
  "auditor",
  "user",
  ...COORDINATOR_ROLES,
] as const;

export type CoordinatorRole = (typeof COORDINATOR_ROLES)[number];

export const isCoordinatorRole = (
  role?: string | UserRole | null,
): role is CoordinatorRole => {
  return COORDINATOR_ROLES.includes(role as CoordinatorRole);
};

export const MODERATOR_ROLES = [
  "admin",
  "moderator",
  "tester",
] as const;

export type ModeratorRole = (typeof MODERATOR_ROLES)[number];

export const isModeratorRole = (
  role?: string | UserRole | null,
): role is ModeratorRole => {
  return MODERATOR_ROLES.includes(role as ModeratorRole);
};

export const isFarmerOrUserRole = (
  role?: string | UserRole | null,
): boolean => {
  return !role || role === "user" || role === "farmer";
};

export interface RoleLandingRoute {
  to: string;
  params?: Record<string, string>;
}

export const getRoleLandingRoute = (
  role?: string | UserRole | null,
  userId?: string,
): RoleLandingRoute => {
  if (isCoordinatorRole(role)) {
    return {
      to: "/user/$userId",
      params: { userId: userId || "" },
    };
  }
  if (role === "pae_expert") {
    return { to: "/pae-expert" };
  }
  if (isModeratorRole(role)) {
    return { to: "/home" };
  }
  if (
    role === "expert" ||
    role === "call_agent" ||
    role === "gate_keeper" ||
    role === "auditor"
  ) {
    return { to: "/home" };
  }
  // Default to farmer dashboard for user, farmer, or any unassigned/regular role
  return { to: "/farmer" };
};

/** Roles allowed to open the User / Expert Management page. */
export const USER_MANAGEMENT_ROLES = [
  "admin",
  "moderator",
  "tester",
  // Gate keepers and auditors get the same Expert Management view as moderators.
  "gate_keeper",
  "auditor",
] as const;

/**
 * Whether this role may see the User / Expert Management tab. An allowlist, so roles added
 * later (gate_keeper, auditor, …) stay out until explicitly granted access.
 */
export const canManageUsers = (role?: string | UserRole | null): boolean =>
  USER_MANAGEMENT_ROLES.includes(role as (typeof USER_MANAGEMENT_ROLES)[number]);

/** Roles that may open the Queue Details / Gate Keeper–Auditor Queue management tools. */
export const QUEUE_DETAILS_ROLES = [
  "admin",
  "moderator",
  "gate_keeper",
  "auditor",
] as const;

/** Whether this role sees the queue tools in the Management Tools drawer. */
export const canViewQueueDetails = (role?: string | UserRole | null): boolean =>
  QUEUE_DETAILS_ROLES.includes(role as (typeof QUEUE_DETAILS_ROLES)[number]);

