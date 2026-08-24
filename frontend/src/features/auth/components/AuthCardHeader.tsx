import { CardHeader } from "@/components/atoms/card";
import { AgriSevaBrand } from "@/components/AgriSevaBrand";

interface AuthCardHeaderProps {
  mode: "login" | "signup" | "forgot";
}

export const AuthCardHeader = ({ mode }: AuthCardHeaderProps) => (
  <CardHeader className="p-0 text-center flex flex-col items-center gap-3">
    <AgriSevaBrand size="md" align="center" showSlogan={true} />
    <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent mt-1">
      {mode === "login"
        ? "Welcome Back"
        : mode === "signup"
        ? "Join AgriSeva-AI"
        : "Reset Password"}
    </h2>
  </CardHeader>
);
