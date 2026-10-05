import { FirebaseAuthService } from "#root/modules/auth/services/FirebaseAuthService.js";
import { getFromContainer } from "routing-controllers";
import { getFirebaseAuth } from '#root/config/firebaseAdmin.js';

export async function authorizationChecker(action: any, roles?: string[]): Promise<boolean> {
  getFirebaseAuth();
  const firebaseAuthService = getFromContainer(FirebaseAuthService);
  const token = action.request.headers.authorization?.split(' ')[1];
  if (!token) {
    return false; // No token provided
  }
  const decoded = await firebaseAuthService.getCurrentUserFromToken(token);
  if (!decoded) {
    return false;
  }
  // Moderators and Experts: access is gated by activity status, NOT isBlocked —
  // isBlocked is their availability flag (check-in/checkout) and must not deny
  // access. Every other role is unchanged: isBlocked denies access as before.
  if (decoded.role === 'moderator' || decoded.role === 'expert' || decoded.role === 'gate_keeper' || decoded.role === 'auditor') {
    if (decoded.status === 'in-active') {
      return false;
    }
  } else if (decoded.isBlocked) {
    return false;
  }
  if (!decoded?.firebaseUID) {
    return false;
  }

  // If specific roles are required, verify user has one of the allowed roles
  if (roles && roles.length > 0) {
    if (!decoded.role || !roles.includes(decoded.role)) {
      return false;
    }
  }

  return true; // Authorization successful
}
