import { auth } from "@/config/firebase";
import { useAuthStore } from "@/stores/auth-store";
import { getIdToken, type User } from "firebase/auth";

export const getCurrentUser = (): Promise<User | null> => {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
};
export const apiFetch = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T | null> => {
  const firebaseUser = await getCurrentUser();

  let token: string | null = null;
  if (firebaseUser) {
    try {
      token = await getIdToken(firebaseUser);
    } catch (err) {
      console.error("Failed to get token:", err);
    }
  }
  if (!token && typeof window !== "undefined" && window.localStorage) {
    token =
      localStorage.getItem("firebase-auth-token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      null;
  }

  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
  };

  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.status === 204) {
      return undefined as T;
    }
    if (res.status === 404 && options?.method === "PUT") {
      return null as T;
    }

    const text = await res.text();
    const safeJson = (t: string) => {
      try {
        return t ? JSON.parse(t) : null;
      } catch {
        return null;
      }
    };

    const data = safeJson(text);

    if (!res.ok) {
      if (res.status === 401) {
        console.warn("Unauthorized request (401), clearing user session");
        const { clearUser } = useAuthStore.getState();
        clearUser();
        // NEVER perform a hard reload if the user is already on an auth page!
        if (typeof window !== "undefined") {
          const isAuthPage =
            window.location.pathname === "/auth" ||
            window.location.pathname === "/auth/" ||
            window.location.pathname.startsWith("/auth");
          if (!isAuthPage) {
            window.location.replace("/auth");
          }
        }
        throw new Error("Unauthorized (401)");
      }
      let errorMessage = `Request failed with status ${res.status}`;
      if (data?.message) {
        errorMessage = data.message;
      } else if (res.statusText) {
        errorMessage = res.statusText;
      } else if (text && text.length < 200) {
        errorMessage = text;
      }

      const apiErr: any = new Error(errorMessage);
      apiErr.status = res.status;
      apiErr.code = data?.code;
      apiErr.category = data?.category;
      throw apiErr;
    }

    return data as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  }
};
