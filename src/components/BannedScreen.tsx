import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export const BannedScreen = ({ reason }: { reason?: string | null }) => {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass max-w-md w-full rounded-2xl p-8 text-center shadow-elevate">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-destructive/20 flex items-center justify-center mb-4">
          <Ban className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">You've been banned</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Your access to Nexus has been revoked by an admin.
        </p>
        {reason && (
          <div className="bg-secondary/50 rounded-xl p-3 text-sm text-left mb-6">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Reason</p>
            <p>{reason}</p>
          </div>
        )}
        <Button onClick={signOut} variant="destructive" className="w-full">Sign out</Button>
      </div>
    </div>
  );
};
