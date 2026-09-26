import { auth, googleProvider } from "@/config/firebase";
import { queryClient } from "@/routes/__root";
import type { AuthUser, ExtendedUserCredential } from "@/types";
import { env } from "@/config/env";
import {
  // getIdToken,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface AuthStore {
  user: AuthUser | null;
  firebaseUser: User | null;
  loading: boolean;
  error: string | null;
  updateUser: (data: Partial<AuthUser>) => void;
  loginWithGoogle: () => Promise<ExtendedUserCredential | null>;
  logout: () => Promise<void>;
  initAuthListener: () => void;
  setUser: (user: AuthUser | null) => void;
  isAuthenticated: boolean;
  clearUser: () => void;
  setFirebaseUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        loading: false,
        error: null,
        isAuthenticated: false,
        firebaseUser: null,
        setFirebaseUser: (firebaseUser) =>
          set({ firebaseUser }, undefined, "setFirebaseUser"),

        setUser: (user) => set({ user }, undefined, "setUser"),

        clearUser: () => {
          localStorage.removeItem("firebase-auth-token");
          localStorage.removeItem("user-id");
          localStorage.removeItem("user-email");
          localStorage.removeItem("user-firstName");
          localStorage.removeItem("user-lastName");
          set({ user: null, isAuthenticated: false });
        },
        updateUser: (data) =>
          set(
            (state) =>
              state.user
                ? { user: { ...state.user, ...data } }
                : state,
            undefined,
            "updateUser"
          ),
        loginWithGoogle: async (): Promise<ExtendedUserCredential | null> => {
          set({ loading: true, error: null });
          try {
            const result = await signInWithPopup(auth, googleProvider);
            const authUser: AuthUser = {
              uid: result.user.uid,
              email: result.user.email || "",
              name: result.user.displayName || "",
              avatar: result.user.photoURL || "",
            };
            set(
              { user: authUser, firebaseUser: result.user, loading: false, isAuthenticated: true },
              undefined,
              "loginWithGoogle"
            );

            try {
              const token = await result.user.getIdToken();
              const res = await fetch(`${env.apiBaseUrl()}/users/me`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              if (res.ok) {
                const backendUser = await res.json();
                const resolvedPhone = backendUser?.farmerProfile?.phone || backendUser?.mobile || "";
                const resolvedName = [backendUser?.firstName, backendUser?.lastName].filter(Boolean).join(" ").trim();
                set((state) => ({
                  user: state.user
                    ? {
                        ...state.user,
                        name: resolvedName || state.user.name,
                        phone: resolvedPhone || state.user.phone,
                        role: backendUser.role || state.user.role,
                      }
                    : state.user,
                }));
              }
            } catch (profileErr) {
              console.warn("[auth-store] Failed to fetch backend profile on login:", profileErr);
            }

            return result;
          } catch (err: any) {
            console.error(err);
            set({ error: err.message || "Login failed", loading: false });
            return null;
          }
        },

        logout: async () => {
          set({ loading: true });
          try {
            await signOut(auth);
            queryClient.clear();
            localStorage.removeItem("questionDrafts");
            set(
              { user: null, firebaseUser: null, loading: false, isAuthenticated: false },
              undefined,
              "logout"
            );
          } catch (err: any) {
            console.error(err);
            set({ error: err.message || "Logout failed", loading: false });
          }
        },

        initAuthListener: () => {
          set({ loading: true });
          onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
              const existingUser = useAuthStore.getState().user;
              const authUser: AuthUser = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || "",
                name: firebaseUser.displayName || existingUser?.name || "",
                avatar: firebaseUser.photoURL || existingUser?.avatar || "",
                phone: existingUser?.phone || undefined,
                role: existingUser?.role || undefined,
              };

              set({
                user: authUser,
                firebaseUser,
                loading: false,
                isAuthenticated: true,
              });

              try {
                const token = await firebaseUser.getIdToken();
                const res = await fetch(`${env.apiBaseUrl()}/users/me`, {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                });
                if (res.ok) {
                  const backendUser = await res.json();
                  const resolvedPhone = backendUser?.farmerProfile?.phone || backendUser?.mobile || "";
                  const resolvedName = [backendUser?.firstName, backendUser?.lastName].filter(Boolean).join(" ").trim();
                  set((state) => ({
                    user: state.user
                      ? {
                          ...state.user,
                          name: resolvedName || state.user.name,
                          phone: resolvedPhone || state.user.phone,
                          role: backendUser.role || state.user.role,
                        }
                      : state.user,
                  }));
                }
              } catch (profileErr) {
                console.warn("[auth-store] Failed to fetch backend profile on init:", profileErr);
              }
            } else {
              set({ user: null, firebaseUser: null, loading: false, isAuthenticated: false });
            }
          });
        },
      }),
      {
        name: "auth-storage", // localStorage key
      }
    ),
    { name: "AuthStore", enabled: true } // DevTools store name
  )
);
