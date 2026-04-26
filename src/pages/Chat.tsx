import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Profile = { id: string; username: string; display_name: string | null };
type Message = { id: string; sender_id: string; recipient_id: string; content: string; created_at: string };

const Chat = () => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [active, setActive] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("friendships").select("*").eq("status", "accepted")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      const ids = (data || []).map((f: any) => f.requester_id === user.id ? f.addressee_id : f.requester_id);
      if (ids.length === 0) return;
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
      setFriends(profs || []);
    })();
  }, [user]);

  useEffect(() => {
    if (!active || !user) return;
    (async () => {
      const { data } = await supabase.from("messages").select("*")
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${active.id}),and(sender_id.eq.${active.id},recipient_id.eq.${user.id})`)
        .order("created_at");
      setMessages(data || []);
    })();
    const channel = supabase.channel(`dm:${user.id}:${active.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        if ((m.sender_id === user.id && m.recipient_id === active.id) ||
            (m.sender_id === active.id && m.recipient_id === user.id)) {
          setMessages((prev) => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [active, user]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!text.trim() || !user || !active) return;
    const content = text.trim();
    setText("");
    await supabase.from("messages").insert({ sender_id: user.id, recipient_id: active.id, content });
  };

  return (
    <AppLayout>
      <div className="flex h-screen">
        <aside className="w-72 glass border-r border-border/30 p-4 overflow-y-auto">
          <h2 className="font-bold text-lg mb-4 text-gradient">IRL Chat</h2>
          {friends.length === 0 && <p className="text-sm text-muted-foreground">Add friends to start chatting.</p>}
          <div className="space-y-1">
            {friends.map(f => (
              <button
                key={f.id}
                onClick={() => setActive(f)}
                className={cn(
                  "w-full text-left rounded-xl px-3 py-2 transition-all",
                  active?.id === f.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-secondary/60"
                )}
              >
                <p className="font-medium text-sm">{f.display_name || f.username}</p>
                <p className="text-xs opacity-70">@{f.username}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex-1 flex flex-col">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">Select a friend to chat</div>
          ) : (
            <>
              <header className="px-6 py-4 border-b border-border/30 glass">
                <p className="font-semibold">{active.display_name || active.username}</p>
                <p className="text-xs text-muted-foreground">@{active.username}</p>
              </header>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {messages.map(m => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[70%] rounded-2xl px-4 py-2 animate-fade-in",
                        mine ? "bg-gradient-primary text-primary-foreground" : "bg-secondary text-foreground"
                      )}>
                        {m.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div className="p-4 border-t border-border/30 glass flex gap-2">
                <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message…" />
                <Button onClick={send} className="bg-gradient-primary text-primary-foreground"><Send className="h-4 w-4" /></Button>
              </div>
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default Chat;
