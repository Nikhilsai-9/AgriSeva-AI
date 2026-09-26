import { useQuery } from "@tanstack/react-query";
import { UserService } from "../../services/userService";
import type { IUser } from "@/types";
import { useAuthStore } from "@/stores/auth-store";

const userService = new UserService();

export const useGetCurrentUser = (options?: { enabled?: boolean }) => {
  const { data, isLoading, error, refetch } = useQuery<IUser | null, Error>({
    queryKey: ["user"],
    queryFn: async () => {
      const user = await userService.getCurrentUser();
      if (user) {
        const resolvedPhone = user?.farmerProfile?.phone || user?.mobile || "";
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
        const updates: Record<string, any> = {};
        if (resolvedPhone) updates.phone = resolvedPhone;
        if (user.role) updates.role = user.role;
        if (fullName) updates.name = fullName;
        if (Object.keys(updates).length > 0) {
          useAuthStore.getState().updateUser(updates);
        }
      }
      return user;
    },
    enabled: options?.enabled,
  });

  return { data, isLoading, error, refetch };
};
