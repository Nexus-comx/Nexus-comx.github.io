import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Notif = { id: string; type: string; title: string; body: string | null; link: string | null; read: boolean; created_at: string };

export const NotificationBell = ({ expanded }: { expanded: boolean }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const navigate = useNavigate();

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
    setItems((data ?? []) as Notif[]);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase.channel(`notif:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const unread = items.filter(i => !i.read).length;

  const open = async (n: Notif) => {
    await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-4 rounded-xl px-3 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all w-full"
        >
          <div className="relative shrink-0">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center animate-pulse-glow">
                {unread}
              </span>
            )}
          </div>
          <span className={cn("whitespace-nowrap font-medium transition-all", expanded ? "opacity-100" : "opacity-0")}>
            Notifications
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-3 border-b border-border/40">
          <p className="font-semibold text-sm">Notifications</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAll} className="h-7 text-xs">
              <Check className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">No notifications yet</p>
          ) : items.map(n => (
            <button
              key={n.id}
              onClick={() => open(n)}
              className={cn(
                "w-full text-left px-3 py-3 border-b border-border/20 hover:bg-secondary/60 transition-colors",
                !n.read && "bg-primary/5"
              )}
            >
              <div className="flex items-start gap-2">
                {!n.read && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground truncate">{n.body}</p>}
                  <p className="text-[10px] text-muted-foreground/70 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
