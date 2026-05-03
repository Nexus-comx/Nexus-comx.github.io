import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { UserPlus, Check, X, Search } from "lucide-react";

type Profile = { id: string; username: string; display_name: string | null };
type Friendship = { id: string; requester_id: string; addressee_id: string; status: string; requester?: Profile; addressee?: Profile };

const cleanSearchTerm = (value: string) => value.trim().replace(/^@+/, "").split("@")[0].trim();

const Friends = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("friendships")
      .select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    if (!data) return;
    const ids = new Set<string>();
    data.forEach((f: any) => { ids.add(f.requester_id); ids.add(f.addressee_id); });
    if (ids.size === 0) {
      setFriendships(data);
      return;
    }
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", Array.from(ids));
    const map = new Map(profiles?.map((p: any) => [p.id, p]) ?? []);
    setFriendships(data.map((f: any) => ({ ...f, requester: map.get(f.requester_id), addressee: map.get(f.addressee_id) })));
  };

  useEffect(() => { load(); }, [user]);

  const doSearch = async () => {
    if (!search.trim() || !user) return;
    const term = cleanSearchTerm(search);
    if (!term) return;
    const { data, error } = await supabase.from("profiles")
      .select("*")
      .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
      .neq("id", user.id)
      .limit(10);
    if (error) toast.error(error.message);
    setResults(data || []);
    if ((data?.length ?? 0) === 0) toast("No users found");
  };

  const sendRequest = async (addressee_id: string) => {
    if (!user) return;
    setBusyId(addressee_id);
    const incomingRequest = friendships.find(f => f.requester_id === addressee_id && f.addressee_id === user.id && f.status === "pending");
    if (incomingRequest) {
      await respond(incomingRequest.id, true);
      setBusyId(null);
      return;
    }
    const { error } = await supabase.from("friendships").insert({ requester_id: user.id, addressee_id });
    if (error) toast.error(error.code === "23505" ? "You already sent this request." : error.message);
    else { toast.success("Request sent!"); await load(); }
    setBusyId(null);
  };

  const respond = async (id: string, accept: boolean) => {
    setBusyId(id);
    if (accept) {
      const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
      if (error) toast.error(error.message);
      else toast.success("Friend added!");
    } else {
      const { error } = await supabase.from("friendships").delete().eq("id", id);
      if (error) toast.error(error.message);
      else toast("Removed");
    }
    await load();
    setBusyId(null);
  };

  const incoming = friendships.filter(f => f.addressee_id === user?.id && f.status === "pending");
  const outgoing = friendships.filter(f => f.requester_id === user?.id && f.status === "pending");
  const accepted = friendships.filter(f => f.status === "accepted");

  return (
    <AppLayout>
      <div className="px-8 py-12 max-w-4xl mx-auto space-y-10 animate-fade-in">
        <header>
          <h1 className="text-4xl font-bold text-gradient mb-2">Friends</h1>
          <p className="text-muted-foreground">Find people, send requests, build your circle.</p>
        </header>

        <section className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Search className="h-4 w-4" /> Find users</h2>
          <div className="flex gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by username…" onKeyDown={(e) => e.key === "Enter" && doSearch()} />
            <Button onClick={doSearch} className="bg-gradient-primary text-primary-foreground">Search</Button>
          </div>
          <div className="mt-4 space-y-2">
            {results.map(p => {
              const exists = friendships.some(f => f.requester_id === p.id || f.addressee_id === p.id);
              return (
                <div key={p.id} className="flex items-center justify-between bg-secondary/40 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-medium">{p.display_name || p.username}</p>
                    <p className="text-xs text-muted-foreground">@{p.username}</p>
                  </div>
                  <Button size="sm" disabled={exists || busyId === p.id} onClick={() => sendRequest(p.id)} className="bg-gradient-primary text-primary-foreground">
                    <UserPlus className="h-4 w-4 mr-1" /> {exists ? "Added" : busyId === p.id ? "..." : "Add"}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {incoming.length > 0 && (
          <section className="glass rounded-2xl p-6">
            <h2 className="font-semibold mb-3">Incoming requests ({incoming.length})</h2>
            <div className="space-y-2">
              {incoming.map(f => (
                <div key={f.id} className="flex items-center justify-between bg-secondary/40 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-medium">{f.requester?.display_name || f.requester?.username}</p>
                    <p className="text-xs text-muted-foreground">@{f.requester?.username}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busyId === f.id} onClick={() => respond(f.id, true)} className="bg-success text-foreground"><Check className="h-4 w-4" /></Button>
                    <Button size="sm" disabled={busyId === f.id} variant="destructive" onClick={() => respond(f.id, false)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-3">Friends ({accepted.length})</h2>
          <div className="space-y-2">
            {accepted.length === 0 && <p className="text-sm text-muted-foreground">No friends yet — send some requests!</p>}
            {accepted.map(f => {
              const other = f.requester_id === user?.id ? f.addressee : f.requester;
              return (
                <div key={f.id} className="flex items-center justify-between bg-secondary/40 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-medium">{other?.display_name || other?.username}</p>
                    <p className="text-xs text-muted-foreground">@{other?.username}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {outgoing.length > 0 && (
          <section className="glass rounded-2xl p-6">
            <h2 className="font-semibold mb-3">Pending sent ({outgoing.length})</h2>
            <div className="space-y-2">
              {outgoing.map(f => (
                <div key={f.id} className="flex items-center justify-between bg-secondary/40 rounded-xl px-4 py-3">
                  <span className="text-sm">@{f.addressee?.username}</span>
                  <Button size="sm" disabled={busyId === f.id} variant="ghost" onClick={() => respond(f.id, false)}>Cancel</Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
};

export default Friends;
