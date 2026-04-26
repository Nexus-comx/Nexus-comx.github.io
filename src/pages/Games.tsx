import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, Trophy, Users } from "lucide-react";

type Game = {
  id: string;
  player_x: string;
  player_o: string | null;
  board: string[];
  current_turn: string;
  status: string;
  winner: string | null;
};

const winLines = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

const checkWinner = (b: string[]): string | null => {
  for (const [a,c,d] of winLines) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  if (b.every(x => x)) return "draw";
  return null;
};

const Games = () => {
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [active, setActive] = useState<Game | null>(null);

  const loadGames = async () => {
    const { data } = await supabase.from("games").select("*").order("created_at", { ascending: false }).limit(30);
    setGames((data as any) || []);
  };

  useEffect(() => {
    loadGames();
    const ch = supabase.channel("games-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => loadGames())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!active) return;
    const ch = supabase.channel(`game:${active.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${active.id}` }, (p) => {
        setActive(p.new as Game);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active?.id]);

  const createGame = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("games").insert({ player_x: user.id }).select().single();
    if (error) return toast.error(error.message);
    setActive(data as any);
    toast.success("Game created — waiting for opponent");
  };

  const joinGame = async (g: Game) => {
    if (!user) return;
    if (g.player_x === user.id) { setActive(g); return; }
    if (g.player_o) { setActive(g); return; }
    const { data, error } = await supabase.from("games")
      .update({ player_o: user.id, status: "active" })
      .eq("id", g.id)
      .is("player_o", null)
      .select().single();
    if (error) return toast.error(error.message);
    setActive(data as any);
  };

  const playMove = async (idx: number) => {
    if (!active || !user) return;
    if (active.status !== "active") return toast("Waiting for opponent");
    const mySymbol = active.player_x === user.id ? "X" : active.player_o === user.id ? "O" : null;
    if (!mySymbol) return;
    if (active.current_turn !== mySymbol) return toast("Not your turn");
    if (active.board[idx]) return;

    const board = [...active.board];
    board[idx] = mySymbol;
    const winner = checkWinner(board);
    const next: any = {
      board,
      current_turn: mySymbol === "X" ? "O" : "X",
      updated_at: new Date().toISOString(),
    };
    if (winner) { next.winner = winner; next.status = "finished"; }

    const { error } = await supabase.from("games").update(next).eq("id", active.id);
    if (error) toast.error(error.message);
  };

  const mySymbol = active && user ? (active.player_x === user.id ? "X" : active.player_o === user.id ? "O" : null) : null;

  return (
    <AppLayout>
      <div className="px-8 py-12 max-w-5xl mx-auto animate-fade-in">
        <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gradient">Multiplayer Arena</h1>
            <p className="text-muted-foreground">Real-time Tic-Tac-Toe. Create or join a game.</p>
          </div>
          <Button onClick={createGame} className="bg-gradient-primary text-primary-foreground shadow-glow">
            <Plus className="h-4 w-4 mr-2" /> New game
          </Button>
        </header>

        {active ? (
          <div className="glass rounded-3xl p-8 shadow-elevate">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <p className="text-sm text-muted-foreground">You are <span className="font-bold text-gradient">{mySymbol || "spectator"}</span></p>
                <p className="text-xs text-muted-foreground">Status: {active.status} · Turn: {active.current_turn}</p>
              </div>
              <Button variant="ghost" onClick={() => setActive(null)}>← Back to lobby</Button>
            </div>

            {active.winner && (
              <div className="mb-6 p-4 rounded-2xl bg-gradient-primary text-primary-foreground text-center font-bold shadow-glow flex items-center justify-center gap-2">
                <Trophy className="h-5 w-5" />
                {active.winner === "draw" ? "Draw!" : `${active.winner} wins!`}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
              {active.board.map((cell, i) => (
                <button
                  key={i}
                  onClick={() => playMove(i)}
                  disabled={!!cell || active.status !== "active" || active.current_turn !== mySymbol}
                  className={cn(
                    "aspect-square rounded-2xl glass text-5xl font-black flex items-center justify-center transition-all",
                    "hover:bg-secondary/80 disabled:cursor-not-allowed",
                    cell === "X" && "text-primary",
                    cell === "O" && "text-accent"
                  )}
                >
                  {cell}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {games.length === 0 && (
              <p className="text-muted-foreground col-span-2 text-center py-12">No games yet. Create one!</p>
            )}
            {games.map(g => (
              <button
                key={g.id}
                onClick={() => joinGame(g)}
                className="glass rounded-2xl p-5 text-left hover:scale-[1.02] transition-all shadow-elevate"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full font-medium",
                    g.status === "waiting" && "bg-accent/20 text-accent",
                    g.status === "active" && "bg-primary/20 text-primary",
                    g.status === "finished" && "bg-muted text-muted-foreground",
                  )}>{g.status}</span>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="font-mono text-xs text-muted-foreground">#{g.id.slice(0,8)}</p>
                {g.winner && <p className="text-sm mt-2">Winner: <span className="font-bold">{g.winner}</span></p>}
                {g.status === "waiting" && g.player_x !== user?.id && (
                  <p className="text-sm text-primary mt-2 font-semibold">Tap to join</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Games;
