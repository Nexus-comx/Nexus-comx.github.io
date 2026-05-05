import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

type Ban = { reason: string | null } | null;
type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  ban: Ban;
  signOut: () => Promise<void>;
};
const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, ban: null, signOut: async () => {} });

const cleanUsername = (value: string) =>
  value
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 24);

const ensureUserProfile = async (user: User) => {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return;

  const metadata = user.user_metadata as { username?: string; display_name?: string } | null;
  const emailName = user.email?.split("@")[0] ?? "user";
  const baseUsername = cleanUsername(metadata?.username || emailName) || `user_${user.id.slice(0, 8)}`;
  const displayName = metadata?.display_name?.trim() || baseUsername;

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    username: baseUsername,
    display_name: displayName,
  });

  if (error?.code === "23505") {
    await supabase.from("profiles").insert({
      id: user.id,
      username: `${baseUsername}_${user.id.slice(0, 4)}`,
      display_name: displayName,
    });
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      void ensureUserProfile(session.user);
    }
  }, [session?.user?.id]);

  return (
    <Ctx.Provider value={{
      user: session?.user ?? null,
      session,
      loading,
      signOut: async () => { await supabase.auth.signOut(); },
    }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
