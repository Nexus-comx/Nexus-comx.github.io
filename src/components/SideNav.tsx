import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Users, MessageCircle, Bot, Gamepad2, Youtube, LogOut, ChevronRight, Home, UserCheck, UserX, Tv, Brain, Swords } from "lucide-react";
import nexusLogo from "@/assets/nexus-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const links = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/friends", icon: Users, label: "Friends" },
  { to: "/chat", icon: MessageCircle, label: "IRL Chat" },
  { to: "/ai", icon: Bot, label: "AI Chat" },
  { to: "/games", icon: Gamepad2, label: "Multiplayer" },
];

type Profile = { id: string; username: string; display_name: string | null };
type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  requester?: Profile;
  addressee?: Profile;
};

export const SideNav = () => {
  const [expanded, setExpanded] = useState(false);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const { signOut, user } = useAuth();
  const location = useLocation();

  const loadFriendships = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    if (!data) return;
    const ids = new Set<string>();
    data.forEach((f: any) => {
      ids.add(f.requester_id);
      ids.add(f.addressee_id);
    });
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", Array.from(ids));
    const map = new Map(profiles?.map((p: any) => [p.id, p]) ?? []);
    setFriendships(
      data.map((f: any) => ({
        ...f,
        requester: map.get(f.requester_id),
        addressee: map.get(f.addressee_id),
      }))
    );
  };

  useEffect(() => {
    loadFriendships();
    if (!user) return;
    const ch = supabase
      .channel("sidebar-friendships")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => loadFriendships()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const incoming = friendships.filter(
    (f) => f.addressee_id === user?.id && f.status === "pending"
  );
  const accepted = friendships.filter((f) => f.status === "accepted");

  const respond = async (id: string, accept: boolean) => {
    if (accept) {
      await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
      toast.success("Friend added!");
    } else {
      await supabase.from("friendships").delete().eq("id", id);
      toast("Request declined");
    }
  };

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onClick={() => setExpanded((e) => !e)}
      className={cn(
        "group fixed left-0 top-0 z-40 flex h-screen flex-col glass border-r border-border/40 transition-all duration-500 ease-out cursor-pointer",
        expanded ? "w-72 shadow-elevate" : "w-20"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-border/30 shrink-0">
        <div className="relative shrink-0 h-10 w-10 rounded-xl overflow-hidden shadow-glow ring-1 ring-primary/30">
          <img src={nexusLogo} alt="Nexus logo" className="h-full w-full object-contain" width={40} height={40} />
        </div>
        <div
          className={cn(
            "overflow-hidden transition-all duration-300",
            expanded ? "w-32 opacity-100" : "w-0 opacity-0"
          )}
        >
          <h1 className="text-lg font-bold text-gradient whitespace-nowrap">Nexus</h1>
          <p className="text-[10px] text-muted-foreground whitespace-nowrap">social hub</p>
        </div>
      </div>

      {/* Links */}
      <nav className="px-3 py-4 flex flex-col gap-1 shrink-0">
        {links.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          const showBadge = to === "/friends" && incoming.length > 0;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex items-center gap-4 rounded-xl px-3 py-3 transition-all duration-200 relative",
                active
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              <div className="relative shrink-0">
                <Icon className="h-5 w-5" />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center animate-pulse-glow">
                    {incoming.length}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "whitespace-nowrap font-medium transition-all duration-300 flex-1",
                  expanded ? "opacity-100" : "opacity-0"
                )}
              >
                {label}
              </span>
              {showBadge && expanded && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                  {incoming.length} new
                </span>
              )}
            </NavLink>
          );
        })}

        {[
          { href: "https://www.youtube.com", label: "YouTube", Icon: Youtube, color: "text-destructive" },
          { href: "https://www.nick.com", label: "Nick.com", Icon: Tv, color: "text-orange-500" },
          { href: "https://www.gimkit.com", label: "Gimkit", Icon: Brain, color: "text-cyan-500" },
          { href: "https://poki.com", label: "Poki", Icon: Gamepad2, color: "text-emerald-500" },
          { href: "https://www.blooket.com", label: "Blooket", Icon: Swords, color: "text-fuchsia-500" },
        ].map(({ href, label, Icon, color }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              window.open(href, "_blank", "noopener,noreferrer");
            }}
            className="flex items-center gap-4 rounded-xl px-3 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
          >
            <Icon className={cn("h-5 w-5 shrink-0", color)} />
            <span
              className={cn(
                "whitespace-nowrap font-medium transition-all duration-300",
                expanded ? "opacity-100" : "opacity-0"
              )}
            >
              {label}
            </span>
          </a>
        ))}
      </nav>

      {/* Friends panel — visible when expanded */}
      <div
        className={cn(
          "flex-1 overflow-hidden border-t border-border/30 transition-all duration-300",
          expanded ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="h-full overflow-y-auto px-3 py-4 space-y-4">
          {incoming.length > 0 && (
            <div>
              <p className="px-2 mb-2 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Requests · {incoming.length}
              </p>
              <div className="space-y-1">
                {incoming.map((f) => (
                  <div
                    key={f.id}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 rounded-xl px-2 py-2 bg-secondary/50 animate-slide-in"
                  >
                    <div className="h-8 w-8 rounded-full bg-gradient-accent flex items-center justify-center text-xs font-bold text-accent-foreground shrink-0">
                      {(f.requester?.display_name || f.requester?.username || "?")[0]?.toUpperCase()}
                    </div>
                    <p className="flex-1 text-xs font-medium truncate">
                      @{f.requester?.username}
                    </p>
                    <button
                      onClick={() => respond(f.id, true)}
                      className="h-7 w-7 rounded-lg bg-success/20 hover:bg-success/30 text-success flex items-center justify-center transition-colors"
                      title="Accept"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => respond(f.id, false)}
                      className="h-7 w-7 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive flex items-center justify-center transition-colors"
                      title="Decline"
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="px-2 mb-2 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Friends · {accepted.length}
            </p>
            {accepted.length === 0 ? (
              <p className="px-2 text-xs text-muted-foreground/70">
                No friends yet. Open Friends to add some.
              </p>
            ) : (
              <div className="space-y-1">
                {accepted.map((f) => {
                  const other =
                    f.requester_id === user?.id ? f.addressee : f.requester;
                  return (
                    <NavLink
                      key={f.id}
                      to="/chat"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-secondary/60 transition-colors"
                    >
                      <div className="relative shrink-0">
                        <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                          {(other?.display_name || other?.username || "?")[0]?.toUpperCase()}
                        </div>
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success border-2 border-card" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {other?.display_name || other?.username}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          @{other?.username}
                        </p>
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border/30 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            signOut();
          }}
          className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-muted-foreground hover:text-destructive hover:bg-secondary/60 transition-all"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span
            className={cn(
              "whitespace-nowrap font-medium transition-all duration-300",
              expanded ? "opacity-100" : "opacity-0"
            )}
          >
            Sign out
          </span>
        </button>
        <div
          className={cn(
            "mt-2 px-2 text-xs text-muted-foreground/70 truncate transition-all",
            expanded ? "opacity-100" : "opacity-0"
          )}
        >
          {user?.email}
        </div>
      </div>

      {/* Expand chevron hint */}
      <ChevronRight
        className={cn(
          "absolute top-1/2 -right-3 h-6 w-6 rounded-full bg-primary text-primary-foreground p-1 shadow-glow transition-transform duration-500",
          expanded && "rotate-180"
        )}
      />
    </aside>
  );
};
