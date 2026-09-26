import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserService } from "../../services/userService";
import type { IUser } from "@/types";
import {toast} from "sonner";
import { useAuthStore } from "@/stores/auth-store";

const userService = new UserService();

export const useEditUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["edit_user"],
    mutationFn: async (user: Partial<IUser>): Promise<void | null> => {
      return await userService.edit(user);
    },
    onSuccess: (_, user_variable) => {
      const fullName = [user_variable?.firstName, user_variable?.lastName].filter(Boolean).join(" ");
      const resolvedPhone = user_variable?.mobile || (user_variable as any)?.phone || (user_variable as any)?.phoneNumber || (user_variable as any)?.farmerProfile?.phone;
      const updates: Record<string, any> = {};
      if (fullName) updates.name = fullName;
      if (resolvedPhone) updates.phone = resolvedPhone;
      if (user_variable?.avatar !== undefined) updates.avatar = user_variable.avatar;
      if (Object.keys(updates).length > 0) {
        useAuthStore.getState().updateUser(updates);
      }
      queryClient.invalidateQueries({
        queryKey: ["user"],
      });
      queryClient.invalidateQueries({
        queryKey: ["farmer-profile"],
      });
      queryClient.invalidateQueries({
        queryKey: ["users"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["experts"],
        exact: false,
      });
    },
    onError: () => {
      toast.error("Failed to update, try again!");
    },
  });
};



export const useBlockUser = (userId:string,action:string) => {
  const queryClient =useQueryClient();
  return useMutation({
    mutationKey:['block_users'],
    mutationFn: async (): Promise<void | null> => {
     return await userService.isBlockUser(userId,action)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey:['users']})
    },
    onError:() => {
      toast.error(`Failed to ${action} Expert`)
    }
  })
}
