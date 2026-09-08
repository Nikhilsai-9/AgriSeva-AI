import React, { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";
import { loginWithEmail } from "@/lib/firebase";
import { useSignup } from "@/hooks/api/auth/useSignup";
import { useForgotPassword } from "@/hooks/api/auth/useForgotPassword";
import { AuthService } from "@/hooks/services/authService";
import { isCoordinatorRole } from "@/lib/roles";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  Sprout,
  Eye,
  EyeOff,
} from "lucide-react";

interface AuthFormProps {
  mode?: "login" | "signup" | "forgot";
  onModeChange?: (mode: "login" | "signup" | "forgot") => void;
}

const authService = new AuthService();

export const AuthForm = ({ mode: initialMode = "login" }: AuthFormProps) => {
  const navigate = useNavigate();
  const { setUser, loginWithGoogle } = useAuthStore();
  const { mutateAsync: signupMutation } = useSignup();
  const { mutateAsync: forgotPasswordMutation } = useForgotPassword();

  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(
    initialMode === "login" ? "signin" : initialMode
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (mode === "signup") {
      if (!name.trim()) {
        setErrorMsg("Please enter your full name.");
        return;
      }
      if (!email.trim() || !email.includes("@")) {
        setErrorMsg("Please enter a valid email address.");
        return;
      }
      if (password.length < 6) {
        setErrorMsg("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match.");
        return;
      }

      setIsSubmitting(true);
      try {
        const parts = name.trim().split(" ");
        const firstName = parts[0] || "Farmer";
        const lastName = parts.slice(1).join(" ") || "";

        const response = await signupMutation({
          email,
          password,
          firstName,
          lastName,
        });

        toast.success(response?.message || "Registration successful! Please check your email to verify.");
        setSuccessMsg("Registration successful! Please check your inbox to verify your email.");
        setMode("signin");
      } catch (err: any) {
        let msg = err?.message || "Failed to create account.";
        if (msg.includes("already registered") || msg.includes("email-already-in-use")) {
          msg = "This email is already registered. Please sign in instead.";
        }
        setErrorMsg(msg);
        toast.error(msg);
      } finally {
        setIsSubmitting(false);
      }
    } else if (mode === "signin") {
      if (!email.trim()) {
        setErrorMsg("Please enter your email.");
        return;
      }
      if (!password) {
        setErrorMsg("Please enter your password.");
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await loginWithEmail(email, password);
        if (result) {
          setUser({
            uid: result.user.uid,
            email: result.user.email || "",
            name: result.user.displayName || email.split("@")[0],
            avatar: result.user.photoURL || "",
          });

          if (isCoordinatorRole(result.appUser?.role)) {
            navigate({
              to: "/user/$userId",
              params: { userId: result.appUser?._id || result.user.uid },
            });
          } else if (result.appUser?.role === "pae_expert") {
            navigate({ to: "/pae-expert" });
          } else {
            navigate({ to: "/home" });
          }
        }
      } catch (err: any) {
        let msg = err?.message || "Incorrect email or password.";
        if (msg.includes("INVALID_LOGIN_CREDENTIALS") || msg.includes("wrong-password") || msg.includes("user-not-found")) {
          msg = "Invalid email or password. Please check your credentials.";
        }
        setErrorMsg(msg);
        toast.error(msg);
      } finally {
        setIsSubmitting(false);
      }
    } else if (mode === "forgot") {
      if (!email.trim()) {
        setErrorMsg("Please enter your email to receive recovery instructions.");
        return;
      }
      setIsSubmitting(true);
      try {
        await forgotPasswordMutation(email);
        setSuccessMsg("Password reset instructions have been sent to your email.");
        toast.success("Reset email sent!");
      } catch (err: any) {
        const msg = err?.message || "Failed to send reset email.";
        setErrorMsg(msg);
        toast.error(msg);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const result = await loginWithGoogle();
      if (result) {
        let appUser: any = null;
        try {
          const syncRes = await authService.loginWithGoogle(result);
          appUser = syncRes?.data?.user;
        } catch (backendSyncErr) {
          console.warn("Backend Google sync notice:", backendSyncErr);
        }
        if (isCoordinatorRole(appUser?.role)) {
          navigate({
            to: "/user/$userId",
            params: { userId: appUser?._id || result.user.uid },
          });
        } else if (appUser?.role === "pae_expert") {
          navigate({ to: "/pae-expert" });
        } else {
          navigate({ to: "/home" });
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to sign in with Google.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white font-sans selection:bg-emerald-500 selection:text-white">
      {/* LEFT 48%: Atmospheric Agricultural Hero Visual & Brand Identity */}
      <div className="hidden lg:flex lg:w-[48%] relative bg-[#06180e] p-12 lg:p-16 flex-col justify-between overflow-hidden">
        {/* Background Image: Atmospheric Farmer in Wheat Field */}
        <div
          className="absolute inset-0 bg-cover bg-center z-0 scale-100 transition-transform duration-700"
          style={{
            backgroundImage: `url('/auth-farmer-bg.jpg')`,
            backgroundPosition: "center 25%",
          }}
        />
        {/* Cinematic Gradient: Soft mist visible at top, deep emerald vignette at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#04140b] via-[#051a0f]/65 to-[#051a0f]/25 z-10" />

        {/* Top Brand Logo */}
        <div className="relative z-20">
          <Link to="/" className="inline-flex items-center gap-3 no-underline group">
            <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 group-hover:border-emerald-500/40 transition">
              <img
                src="/favicon.svg"
                alt="AgriSeva-AI"
                className="w-8 h-8 object-contain rounded-lg flex-shrink-0 drop-shadow-sm"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <span className="font-extrabold text-xl tracking-tight text-white font-sans">
                AgriSeva<span className="text-[#F97352]">-AI</span>
              </span>
            </div>
          </Link>
        </div>

        {/* Center / Value Proposition Content */}
        <div className="relative z-20 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold backdrop-blur-md">
            <Sprout className="w-3.5 h-3.5 text-emerald-400" />
            <span>Decision Intelligence for Indian Agriculture</span>
          </div>

          <h2 className="font-extrabold text-4xl sm:text-5xl text-white tracking-tight leading-[1.15] drop-shadow-sm">
            Smarter decisions.<br />Stronger farms.
          </h2>

          <p className="text-emerald-100/90 text-sm leading-relaxed max-w-md drop-shadow-xs">
            AgriSeva-AI helps farmers understand risk, access India-wide market prices, optimize water and fertilizer, and plan each season with confidence.
          </p>

          <div className="flex items-center gap-6 pt-4 text-xs text-emerald-200">
            <div className="flex items-center gap-2 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Biophysical Yield Physics</span>
            </div>
            <div className="flex items-center gap-2 font-medium">
              <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Downside Risk Protection</span>
            </div>
          </div>
        </div>

        {/* Bottom Footer Note */}
        <div className="relative z-20 text-xs text-emerald-300/70">
          © 2026 AgriSeva-AI Platform. All rights reserved.
        </div>
      </div>

      {/* RIGHT 52%: Authentication Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-6 sm:px-12 lg:px-20 xl:px-28 bg-white">
        <div className="w-full max-w-md mx-auto space-y-7">
          {/* Header */}
          <div>
            <div className="lg:hidden mb-6">
              <Link to="/" className="inline-flex items-center gap-2.5 no-underline">
                <img
                  src="/favicon.svg"
                  alt="AgriSeva-AI"
                  className="w-8 h-8 object-contain"
                />
                <span className="font-extrabold text-2xl tracking-tight text-slate-900">
                  AgriSeva<span className="text-emerald-600">-AI</span>
                </span>
              </Link>
            </div>
            <h1 className="font-extrabold text-3xl text-slate-900 tracking-tight">
              {mode === "signin" && "Welcome back"}
              {mode === "signup" && "Create your account"}
              {mode === "forgot" && "Reset your password"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {mode === "signin" && "Sign in to continue to your farm intelligence dashboard."}
              {mode === "signup" && "Start building smarter, resilient farming decisions."}
              {mode === "forgot" && "Enter your email to receive recovery instructions."}
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Gurpreet Singh"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition shadow-2xs"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="farmer@example.com"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition shadow-2xs"
              />
            </div>

            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition shadow-2xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition shadow-2xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Primary Action Button: Solid Green */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#0a8053] hover:bg-[#086c46] disabled:opacity-50 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-xs transition duration-150 cursor-pointer text-center mt-2"
            >
              {isSubmitting
                ? "Processing..."
                : mode === "signin"
                ? "Sign In"
                : mode === "signup"
                ? "Create Account"
                : "Send Reset Link"}
            </button>
          </form>

          {/* OR Divider */}
          {mode !== "forgot" && (
            <div className="space-y-4">
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400 font-medium">
                    OR
                  </span>
                </div>
              </div>

              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-sm py-3 px-4 rounded-xl shadow-2xs transition flex items-center justify-center gap-3 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
          )}

          {/* Toggle Modes */}
          <div className="text-center text-xs text-slate-600 pt-2">
            {mode === "signin" && (
              <p>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  Create an account
                </button>
              </p>
            )}

            {mode === "signup" && (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            )}

            {mode === "forgot" && (
              <p>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  Back to Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
