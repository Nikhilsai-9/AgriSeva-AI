export const COORDINATOR_ROLES = [
  'district_coordinator',
  'block_coordinator',
  'village_volunteer',
] as const;

export const USER_ROLES = [
  'expert',
  'moderator',
  'admin',
  'pae_expert',
  'tester',
  'call_agent',
  'gate_keeper',
  'auditor',
  'user',
  ...COORDINATOR_ROLES,
] as const;

export type CoordinatorRole = (typeof COORDINATOR_ROLES)[number];
export type UserRoleValue = (typeof USER_ROLES)[number];

/**
 * Privileged operational roles that require explicit administrator verification
 * before access to internal or privileged operations is permitted.
 * Normal users ('user' / farmers) and system administrators do NOT require
 * pending admin verification.
 */
export const ROLES_REQUIRING_ADMIN_VERIFICATION: readonly UserRoleValue[] = [
  'pae_expert',
  'expert',
  'moderator',
  'district_coordinator',
  'block_coordinator',
  'village_volunteer',
  'gate_keeper',
  'auditor',
  'tester',
  'call_agent',
] as const;

/**
 * Determines whether a given user account requires admin verification and is currently
 * pending approval.
 */
export function requiresAdminVerification(user?: { role?: string; isVerified?: boolean } | null): boolean {
  if (!user || user.role === 'user' || user.role === 'admin') {
    return false;
  }
  return (
    ROLES_REQUIRING_ADMIN_VERIFICATION.includes(user.role as UserRoleValue) &&
    user.isVerified === false
  );
}
