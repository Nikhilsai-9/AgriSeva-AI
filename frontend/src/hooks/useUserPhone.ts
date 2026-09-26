import { useAuthStore } from "@/stores/auth-store";
import { useGetCurrentUser } from "@/hooks/api/user/useGetCurrentUser";
import { useFarmerProfile } from "@/features/farmerDashboard/hooks/data";
import { normalizePhoneNumber, isValidPhoneNumber, formatPhoneNumber } from "@/lib/phoneNumber";

/**
 * Hook to retrieve the authenticated user's canonical phone number.
 * Resolves across:
 * 1. Global AuthStore (`user.phone`)
 * 2. Real Backend User API (`/api/users/me` -> `farmerProfile.phone` or `mobile`)
 * 3. Farmer Profile Query (`/api/users/me` -> `FarmerProfile.phone`)
 */
export function useUserPhone() {
  const { user, isAuthenticated } = useAuthStore();
  const { data: userProfile } = useGetCurrentUser({ enabled: isAuthenticated });
  const { data: farmerProfile } = useFarmerProfile();

  const rawPhone =
    user?.phone ||
    farmerProfile?.phone ||
    userProfile?.farmerProfile?.phone ||
    userProfile?.mobile ||
    "";

  const normalized = normalizePhoneNumber(rawPhone);
  const isValid = isValidPhoneNumber(normalized);
  const formatted = formatPhoneNumber(normalized);

  return {
    phone: normalized,
    rawPhone,
    isValid,
    formatted,
    hasPhone: Boolean(normalized && isValid),
  };
}
