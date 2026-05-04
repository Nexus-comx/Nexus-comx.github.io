import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, Gamepad2, MessageCircle, Sparkles, Users, Zap } from "lucide-react";
import nexusLogo from "@/assets/nexus-logo.png";

const features = [
  { icon: Users, title: "Friends", desc: "Find your people. Send requests, build your circle.", color: "from-violet-500 to-fuchsia-500" },
  { icon: MessageCircle, title: "Real-time chat", desc: "DM friends instantly with live messaging.", color: "from-cyan-500 to-blue-500" },
  { icon: Bot, title: "Nova AI", desc: "Your AI sidekick — remembers every conversation.", color: "from-emerald-500 to-cyan-500" },
  { icon: Gamepad2, title: "Live multiplayer", desc: "Play Tic-Tac-Toe head-to-head, anywhere.", color: "from-orange-500 to-pink-500" },
];

const stats = [
  { n: "4", l: "Built-in apps" },
  { n: "Real-time", l: "Everything live" },
  { n: "AI", l: "Powered chat" },
  { n: "Free", l: "To get started" },
];

const Landing = () => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Floating accent orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl animate-pulse-glow" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-primary-glow/20 blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 max-w-7xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl overflow-hidden ring-1 ring-primary/40 shadow-glow">
            <img src={nexusLogo} alt="Nexus logo" className="h-full w-full object-contain" />
          </div>
          <span className="text-xl font-bold text-gradient">Nexus</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost" className="text-foreground/80 hover:text-foreground">Log in</Button>
          </Link>
          <Link to="/auth">
            <Button className="bg-gradient-primary text-primary-foreground shadow-glow gap-1.5">
              <Zap className="h-4 w-4" /> Get started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-24 grid lg:grid-cols-2 gap-12 items-center">
        <div className="animate-fade-in">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-8">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Live • Real-time • Free</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
            Your social hub for <span className="text-gradient">friends, AI</span> and <span className="text-gradient">live games</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mb-10">
            Nexus brings together everything you'd actually use with friends — instant chat, an AI companion that remembers, and live multiplayer. One account. No clutter.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow gap-2 h-12 px-7 text-base">
                Create your account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-12 px-7 text-base">
                I already have one
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> No credit card</span>
            <span>·</span>
            <span>Takes ~10 seconds</span>
          </div>
        </div>

        {/* Showcase card */}
        <div className="relative animate-fade-in [animation-delay:120ms]">
          <div className="absolute -inset-4 bg-gradient-primary opacity-20 blur-3xl rounded-3xl" />
          <div className="relative glass rounded-3xl p-6 shadow-elevate">
            <div className="flex items-center gap-2 mb-5">
              <span className="h-3 w-3 rounded-full bg-destructive" />
              <span className="h-3 w-3 rounded-full bg-warning bg-yellow-400" />
              <span className="h-3 w-3 rounded-full bg-success" />
              <span className="ml-3 text-xs text-muted-foreground">nexus.app / chat with Nova</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-gradient-primary text-primary-foreground rounded-2xl px-4 py-2.5 max-w-[80%] text-sm">
                  hey nova, what should i do tonight?
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-8 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0 shadow-glow">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="glass rounded-2xl px-4 py-2.5 max-w-[80%] text-sm">
                  Start a Tic-Tac-Toe match with a friend ⚡, then we can brainstorm a meme caption together.
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-gradient-primary text-primary-foreground rounded-2xl px-4 py-2.5 max-w-[80%] text-sm">
                  open the games tab
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-8 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0 shadow-glow">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="glass rounded-2xl px-4 py-2.5 max-w-[80%] text-sm">
                  On it 🎮 switching to Multiplayer now…
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.l} className="glass rounded-2xl p-6 text-center">
              <div className="text-3xl md:text-4xl font-bold text-gradient mb-1">{s.n}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <p className="text-sm uppercase tracking-widest text-muted-foreground mb-3">Everything in one place</p>
          <h2 className="text-4xl md:text-5xl font-bold">Built for the way you actually <span className="text-gradient">hang out</span></h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              style={{ animationDelay: `${i * 80}ms` }}
              className="group relative overflow-hidden rounded-3xl glass p-7 animate-fade-in hover:scale-[1.02] transition-transform shadow-elevate"
            >
              <div className={`absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br ${f.color} opacity-20 blur-3xl group-hover:opacity-40 transition-opacity`} />
              <f.icon className="h-10 w-10 mb-4" />
              <h3 className="text-2xl font-bold mb-1">{f.title}</h3>
              <p className="text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl glass p-10 md:p-14 text-center shadow-elevate">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-60 w-60 rounded-full bg-gradient-primary opacity-30 blur-3xl" />
          <h2 className="text-3xl md:text-5xl font-bold mb-4 relative">Ready to plug in?</h2>
          <p className="text-muted-foreground mb-8 relative max-w-xl mx-auto">
            Make an account, find your friends, and start something. It's free.
          </p>
          <Link to="/auth" className="relative inline-block">
            <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow gap-2 h-12 px-8 text-base">
              Get started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="relative z-10 max-w-7xl mx-auto px-6 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Nexus · Your social hub
      </footer>
    </div>
  );
};

export default Landing;
