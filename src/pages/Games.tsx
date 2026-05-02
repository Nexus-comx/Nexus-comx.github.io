import { AppLayout } from "@/components/AppLayout";
import { ExternalLink, Tv, Brain, Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";

const moreGames = [
  {
    href: "https://www.nick.com/games",
    label: "Nick.com",
    description: "Play games with your favorite Nickelodeon characters.",
    Icon: Tv,
    accent: "text-orange-500",
  },
  {
    href: "https://www.gimkit.com",
    label: "Gimkit",
    description: "Live learning game shows with your class.",
    Icon: Brain,
    accent: "text-cyan-500",
  },
  {
    href: "https://poki.com",
    label: "Poki",
    description: "Thousands of free online games in your browser.",
    Icon: Gamepad2,
    accent: "text-fuchsia-500",
  },
];

const Games = () => {
  return (
    <AppLayout>
      <div className="px-8 py-12 max-w-5xl mx-auto animate-fade-in">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gradient">More Games</h1>
          <p className="text-muted-foreground">Hand-picked game sites that open in a new tab.</p>
        </header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {moreGames.map(({ href, label, description, Icon, accent }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                window.open(href, "_blank", "noopener,noreferrer");
              }}
              className="group glass rounded-2xl p-6 shadow-elevate hover:scale-[1.02] transition-all flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className={cn("h-12 w-12 rounded-xl bg-secondary/60 flex items-center justify-center", accent)}>
                  <Icon className="h-6 w-6" />
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{label}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Games;
