import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BannedScreen } from "@/components/BannedScreen";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading, ban } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (ban) return <BannedScreen reason={ban.reason} />;
  return <>{children}</>;
};
