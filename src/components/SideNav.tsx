import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Sparkles, Users, MessageCircle, Bot, Gamepad2, Youtube, LogOut, ChevronRight, Home } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/friends", icon: Users, label: "Friends" },
  { to: "/chat", icon: MessageCircle, label: "IRL Chat" },
  { to: "/ai", icon: Bot, label: "AI Chat" },
  { to: "/games", icon: Gamepad2, label: "Multiplayer" },
];

export const SideNav = () => {
  const [expanded, setExpanded] = useState(false);
  const { signOut, user } = useAuth();
  const location = useLocation();

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onClick={() => setExpanded((e) => !e)}
      className={cn(
        "group fixed left-0 top-0 z-40 flex h-screen flex-col glass border-r border-border/40 transition-all duration-500 ease-out cursor-pointer",
        expanded ? "w-64 shadow-elevate" : "w-20"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-border/30">
        <div className="relative shrink-0 h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className={cn("overflow-hidden transition-all duration-300", expanded ? "w-32 opacity-100" : "w-0 opacity-0")}>
          <h1 className="text-lg font-bold text-gradient whitespace-nowrap">Nexus</h1>
          <p className="text-[10px] text-muted-foreground whitespace-nowrap">social hub</p>
        </div>
      </div>

      {/* Links */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {links.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex items-center gap-4 rounded-xl px-3 py-3 transition-all duration-200 relative overflow-hidden",
                active
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className={cn("whitespace-nowrap font-medium transition-all duration-300", expanded ? "opacity-100" : "opacity-0")}>
                {label}
              </span>
            </NavLink>
          );
        })}

        <a
          href="https://www.youtube.com"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-4 rounded-xl px-3 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
        >
          <Youtube className="h-5 w-5 shrink-0 text-destructive" />
          <span className={cn("whitespace-nowrap font-medium transition-all duration-300", expanded ? "opacity-100" : "opacity-0")}>
            YouTube
          </span>
        </a>
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border/30">
        <button
          onClick={(e) => { e.stopPropagation(); signOut(); }}
          className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-muted-foreground hover:text-destructive hover:bg-secondary/60 transition-all"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className={cn("whitespace-nowrap font-medium transition-all duration-300", expanded ? "opacity-100" : "opacity-0")}>
            Sign out
          </span>
        </button>
        <div className={cn("mt-3 px-2 text-xs text-muted-foreground/70 truncate transition-all", expanded ? "opacity-100" : "opacity-0")}>
          {user?.email}
        </div>
      </div>

      {/* Expand chevron hint */}
      <ChevronRight className={cn(
        "absolute top-1/2 -right-3 h-6 w-6 rounded-full bg-primary text-primary-foreground p-1 shadow-glow transition-transform duration-500",
        expanded && "rotate-180"
      )} />
    </aside>
  );
};
