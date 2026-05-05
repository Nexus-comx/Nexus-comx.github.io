import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRole";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Shield, Ban, History, Crown, UserCog, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Profile = { id: string; username: string; display_name: string | null; created_at: string };
type Role = "owner" | "admin" | "user";

const Admin = () => {
  const { user } = useAuth();
  const { isAdmin, isOwner, loading } = useRoles();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesMap, setRolesMap] = useState<Record<string, Role[]>>({});
  const [bans, setBans] = useState<Record<string, { reason: string | null; banned_at: string }>>({});
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Profile | null>(null);
  const [history, setHistory] = useState<{ messages: any[]; ai: any[]; games: any[] } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banTarget, setBanTarget] = useState<Profile | null>(null);

  const reload = async () => {
    const [{ data: ps }, { data: rs }, { data: bs }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id,role"),
      supabase.from("banned_users").select("user_id,reason,banned_at"),
    ]);
    setProfiles((ps ?? []) as Profile[]);
    const map: Record<string, Role[]> = {};
    (rs ?? []).forEach((r: any) => { (map[r.user_id] = map[r.user_id] || []).push(r.role); });
    setRolesMap(map);
    const bmap: Record<string, any> = {};
    (bs ?? []).forEach((b: any) => { bmap[b.user_id] = { reason: b.reason, banned_at: b.banned_at }; });
    setBans(bmap);
  };

  useEffect(() => { if (isAdmin) reload(); }, [isAdmin]);

  if (loading) return <AppLayout><div className="p-10 text-muted-foreground">Loading…</div></AppLayout>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const roleOf = (id: string): Role =>
    rolesMap[id]?.includes("owner") ? "owner" : rolesMap[id]?.includes("admin") ? "admin" : "user";

  const filtered = profiles.filter(p =>
    !q.trim() || p.username.toLowerCase().includes(q.toLowerCase()) || (p.display_name || "").toLowerCase().includes(q.toLowerCase())
  );

  const ban = async () => {
    if (!banTarget || !user) return;
    const { error } = await supabase.from("banned_users").insert({
      user_id: banTarget.id, reason: banReason.trim() || null, banned_by: user.id,
    });
    if (error) toast.error(error.message); else toast.success(`Banned @${banTarget.username}`);
    setBanTarget(null); setBanReason("");
    reload();
  };

  const unban = async (id: string) => {
    const { error } = await supabase.from("banned_users").delete().eq("user_id", id);
    if (error) toast.error(error.message); else toast.success("Unbanned");
    reload();
  };

  const setRole = async (id: string, role: Role) => {
    if (!isOwner) { toast.error("Only owners can change roles"); return; }
    await supabase.from("user_roles").delete().eq("user_id", id).in("role", ["admin", "owner"]);
    if (role !== "user") {
      await supabase.from("user_roles").insert({ user_id: id, role });
      if (role === "owner") await supabase.from("user_roles").insert({ user_id: id, role: "admin" });
    }
    toast.success("Role updated");
    reload();
  };

  const viewHistory = async (p: Profile) => {
    setActive(p);
    setHistory(null);
    const [{ data: messages }, { data: ai }, { data: games }] = await Promise.all([
      supabase.from("messages").select("*").or(`sender_id.eq.${p.id},recipient_id.eq.${p.id}`).order("created_at", { ascending: false }).limit(200),
      supabase.from("ai_messages").select("*").eq("user_id", p.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("games").select("*").or(`player_x.eq.${p.id},player_o.eq.${p.id}`).order("created_at", { ascending: false }).limit(50),
    ]);
    setHistory({ messages: messages ?? [], ai: ai ?? [], games: games ?? [] });
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-8 animate-fade-in">
        <header className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gradient">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">Manage users, roles and bans · {isOwner ? "Owner" : "Admin"}</p>
          </div>
        </header>

        <div className="glass rounded-2xl p-3 mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground ml-2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="border-0 bg-transparent focus-visible:ring-0" />
        </div>

        <div className="space-y-2">
          {filtered.map(p => {
            const role = roleOf(p.id);
            const banned = !!bans[p.id];
            const isMe = p.id === user?.id;
            return (
              <div key={p.id} className="glass rounded-2xl p-4 flex items-center gap-3 flex-wrap">
                <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                  {(p.display_name || p.username)[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{p.display_name || p.username}</p>
                    {role === "owner" && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Crown className="h-3 w-3 mr-1" />Owner</Badge>}
                    {role === "admin" && <Badge className="bg-primary/20 text-primary border-primary/30"><Shield className="h-3 w-3 mr-1" />Admin</Badge>}
                    {banned && <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />Banned</Badge>}
                    {isMe && <Badge variant="outline">You</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                </div>

                <Button size="sm" variant="outline" onClick={() => viewHistory(p)}>
                  <History className="h-4 w-4 mr-1" /> History
                </Button>

                {isOwner && !isMe && (
                  <select
                    value={role}
                    onChange={(e) => setRole(p.id, e.target.value as Role)}
                    className="text-xs rounded-lg bg-secondary px-2 py-2 border border-border/40"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                )}

                {role !== "owner" && !isMe && (
                  banned
                    ? <Button size="sm" variant="outline" onClick={() => unban(p.id)}>Unban</Button>
                    : <Button size="sm" variant="destructive" onClick={() => { setBanTarget(p); setBanReason(""); }}><Ban className="h-4 w-4 mr-1" />Ban</Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Ban dialog */}
      <Dialog open={!!banTarget} onOpenChange={(o) => !o && setBanTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ban @{banTarget?.username}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">They will be signed out and unable to use Nexus.</p>
          <Input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Reason (optional)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={ban}>Ban user</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" />@{active?.username} — full history</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto space-y-4 pr-2">
            {!history ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <>
                <Section title={`Messages (${history.messages.length})`}>
                  {history.messages.map((m: any) => (
                    <div key={m.id} className="text-xs glass rounded-lg p-2">
                      <p className="text-muted-foreground">{new Date(m.created_at).toLocaleString()} · {m.sender_id === active?.id ? "sent" : "received"}</p>
                      <p className="mt-1 break-words">{m.content}</p>
                    </div>
                  ))}
                </Section>
                <Section title={`AI conversations (${history.ai.length})`}>
                  {history.ai.map((m: any) => (
                    <div key={m.id} className={cn("text-xs glass rounded-lg p-2", m.role === "user" ? "bg-primary/10" : "")}>
                      <p className="text-muted-foreground">{new Date(m.created_at).toLocaleString()} · {m.role}</p>
                      <p className="mt-1 break-words whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ))}
                </Section>
                <Section title={`Games (${history.games.length})`}>
                  {history.games.map((g: any) => (
                    <div key={g.id} className="text-xs glass rounded-lg p-2">
                      <p>{new Date(g.created_at).toLocaleString()} · status: {g.status} {g.winner ? `· winner: ${g.winner}` : ""}</p>
                    </div>
                  ))}
                </Section>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">{title}</p>
    <div className="space-y-1.5">{children}</div>
  </div>
);

export default Admin;
