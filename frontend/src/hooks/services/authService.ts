import { env } from "@/config/env";
import type { ExtendedUserCredential } from "@/types";

const API_BASE_URL = env.apiBaseUrl();

export class AuthService {
  private _baseUrl = `${API_BASE_URL}/auth`;

  async loginWithGoogle(firebaseLoginRes: ExtendedUserCredential) {
    try {
      const idToken = await firebaseLoginRes.user.getIdToken();
      return await this.accountSync(idToken);
    } catch (error) {
      console.error("Login with google failed!", error);
      throw error;
    }
  }
  async signup({
    email,
    password,
    firstName,
    lastName,
  }: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    try {
      const backendUrl = `${this._baseUrl}/signup`;
      const res = await fetch(backendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Signup failed: ${res.status} ${res.statusText} - ${errorText}`
        );
      }

      return res.json();
    } catch (error) {
      console.error("Signup failed!", error);
      throw error;
    }
  }

  async accountSync(idToken: string) {
    try {
      const backendUrl = `${this._baseUrl}/sync`;
      const res = await fetch(backendUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        let errorMessage = `Sync failed: ${res.status} ${res.statusText}`;
        let errorData: any = null;
        try {
          errorData = await res.json();
          if (errorData?.message) {
            errorMessage = errorData.message;
          }
        } catch {
          const errorText = await res.text().catch(() => "");
          if (errorText) errorMessage = errorText;
        }
        const error: any = new Error(errorMessage);
        error.status = res.status;
        error.data = errorData;
        throw error;
      }

      return res.json();
    } catch (error) {
      console.error("Account sync failed!", error);
      throw error;
    }
  }

  async resendVerification(email: string) {
    try {
      const backendUrl = `${this._baseUrl}/resend-verification`;
      const res = await fetch(backendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Failed to resend verification: ${res.status} ${res.statusText} - ${errorText}`
        );
      }

      return res.json();
    } catch (error) {
      console.error("Resend verification failed!", error);
      throw error;
    }
  }

  async forgotPassword(email: string) {
    try {
      const backendUrl = `${this._baseUrl}/forgot-password`;
      const res = await fetch(backendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Failed to send reset email: ${res.status} ${res.statusText} - ${errorText}`
        );
      }

      return res.json();
    } catch (error) {
      console.error("Forgot password failed!", error);
      throw error;
    }
  }
}
