import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Users, MessageCircle, Bot, Gamepad2, ArrowRight, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cards = [
  { to: "/friends", icon: Users, title: "Friends", desc: "Send requests, build your circle.", color: "from-violet-500 to-fuchsia-500" },
  { to: "/chat", icon: MessageCircle, title: "IRL Chat", desc: "Real-time DMs with friends.", color: "from-cyan-500 to-blue-500" },
  { to: "/ai", icon: Bot, title: "AI Chat", desc: "Talk to Nova, your AI sidekick.", color: "from-emerald-500 to-cyan-500" },
  { to: "/games", icon: Gamepad2, title: "Multiplayer", desc: "Tic-Tac-Toe with anyone, live.", color: "from-orange-500 to-pink-500" },
];

const Index = () => {
  const { user, signOut } = useAuth();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name,username").eq("id", user.id).maybeSingle()
      .then(({ data }) => setName(data?.display_name || data?.username || ""));
  }, [user]);

  return (
    <AppLayout>
      <div className="px-8 py-12 max-w-6xl mx-auto">
        <div className="mb-12 animate-fade-in">
          <p className="text-sm uppercase tracking-widest text-muted-foreground mb-2">Welcome back</p>
          <h1 className="text-5xl md:text-6xl font-bold text-gradient mb-3">Hey {name || "friend"} 👋</h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            Your hub for friends, chats, AI, and live games. Hover the sidebar to expand it.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {cards.map((c, i) => (
            <Link
              key={c.to}
              to={c.to}
              style={{ animationDelay: `${i * 80}ms` }}
              className="group relative overflow-hidden rounded-3xl glass p-7 hover:scale-[1.02] transition-all duration-300 animate-fade-in shadow-elevate"
            >
              <div className={`absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br ${c.color} opacity-20 blur-3xl group-hover:opacity-40 transition-opacity`} />
              <c.icon className="h-10 w-10 text-foreground mb-4" />
              <h3 className="text-2xl font-bold mb-1">{c.title}</h3>
              <p className="text-muted-foreground mb-4">{c.desc}</p>
              <div className="flex items-center gap-2 text-primary group-hover:gap-3 transition-all font-medium">
                Open <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
