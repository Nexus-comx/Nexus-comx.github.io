import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Send, Sparkles, UserPlus, Phone, PhoneOff, Mic, MicOff, Crown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Profile = { id: string; username: string; display_name: string | null };
type Group = { id: string; name: string; topic: string | null; owner_id: string; created_at: string };
type GroupMsg = { id: string; group_id: string; sender_id: string; content: string; created_at: string };
type Invite = { id: string; group_id: string; invitee_id: string; inviter_id: string; status: string };
type Call = { id: string; group_id: string; started_by: string; active: boolean };

const ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

const Study = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [active, setActive] = useState<Group | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<GroupMsg[]>([]);
  const [text, setText] = useState("");
  const [friends, setFriends] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});

  // Create group dialog
  const [openCreate, setOpenCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTopic, setNewTopic] = useState("");

  // Invite dialog
  const [openInvite, setOpenInvite] = useState(false);

  // Nova clues
  const [clueOpen, setClueOpen] = useState(false);
  const [clueTopic, setClueTopic] = useState("");
  const [clueText, setClueText] = useState("");
  const [clueBusy, setClueBusy] = useState(false);

  // Voice call
  const [call, setCall] = useState<Call | null>(null);
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [callPeers, setCallPeers] = useState<string[]>([]);
  const localStream = useRef<MediaStream | null>(null);
  const peers = useRef<Record<string, RTCPeerConnection>>({});
  const audioEls = useRef<Record<string, HTMLAudioElement>>({});

  const bottom = useRef<HTMLDivElement>(null);

  /* ------- LOAD ------- */
  const loadGroups = async () => {
    if (!user) return;
    const { data: mems } = await supabase.from("study_group_members").select("group_id").eq("user_id", user.id);
    const ids = (mems ?? []).map((m: any) => m.group_id);
    const { data: owned } = await supabase.from("study_groups").select("*").eq("owner_id", user.id);
    const { data: joined } = ids.length
      ? await supabase.from("study_groups").select("*").in("id", ids)
      : { data: [] as Group[] };
    const merged = [...(owned ?? []), ...(joined ?? [])];
    const unique = Array.from(new Map(merged.map(g => [g.id, g])).values()) as Group[];
    setGroups(unique);
    const map: Record<string, string> = {};
    unique.forEach(g => { map[g.id] = g.name; });
    setGroupNames(map);
  };

  const loadFriends = async () => {
    if (!user) return;
    const { data } = await supabase.from("friendships").select("*").eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    const ids = (data || []).map((f: any) => f.requester_id === user.id ? f.addressee_id : f.requester_id);
    if (!ids.length) { setFriends([]); return; }
    const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
    setFriends((profs as Profile[]) ?? []);
  };

  const loadInvites = async () => {
    if (!user) return;
    const { data } = await supabase.from("study_group_invites").select("*").eq("invitee_id", user.id).eq("status", "pending");
    setInvites((data as Invite[]) ?? []);
    const gids = (data ?? []).map((i: any) => i.group_id);
    if (gids.length) {
      const { data: gs } = await supabase.from("study_groups").select("id,name").in("id", gids);
      setGroupNames(prev => ({ ...prev, ...Object.fromEntries((gs ?? []).map((g: any) => [g.id, g.name])) }));
    }
  };

  useEffect(() => { loadGroups(); loadFriends(); loadInvites(); }, [user?.id]);

  /* ------- ACTIVE GROUP DATA ------- */
  useEffect(() => {
    if (!active) return;
    (async () => {
      const { data: ms } = await supabase.from("study_group_messages").select("*").eq("group_id", active.id).order("created_at");
      setMessages((ms as GroupMsg[]) ?? []);
      const { data: mems } = await supabase.from("study_group_members").select("user_id").eq("group_id", active.id);
      const ids = (mems ?? []).map((m: any) => m.user_id);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
        setMembers((profs as Profile[]) ?? []);
      } else setMembers([]);
      const { data: c } = await supabase.from("voice_calls").select("*").eq("group_id", active.id).eq("active", true).maybeSingle();
      setCall((c as Call) ?? null);
    })();

    const ch = supabase.channel(`group:${active.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "study_group_messages", filter: `group_id=eq.${active.id}` },
        (p) => setMessages(prev => prev.some(m => m.id === (p.new as any).id) ? prev : [...prev, p.new as GroupMsg]))
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_calls", filter: `group_id=eq.${active.id}` },
        (p) => {
          const row = (p.new ?? p.old) as Call;
          if (p.eventType === "DELETE" || (row && !(row as any).active)) setCall(null);
          else setCall(row as Call);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active?.id]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  /* ------- ACTIONS ------- */
  const createGroup = async () => {
    if (!user || !newName.trim()) return;
    const { data, error } = await supabase.from("study_groups").insert({
      name: newName.trim(), topic: newTopic.trim() || null, owner_id: user.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("study_group_members").insert({ group_id: data.id, user_id: user.id });
    setOpenCreate(false); setNewName(""); setNewTopic("");
    toast.success("Group created");
    loadGroups();
    setActive(data as Group);
  };

  const sendMsg = async () => {
    if (!text.trim() || !active || !user) return;
    const c = text.trim(); setText("");
    await supabase.from("study_group_messages").insert({ group_id: active.id, sender_id: user.id, content: c });
  };

  const inviteFriend = async (friendId: string) => {
    if (!active || !user) return;
    const { error } = await supabase.from("study_group_invites").insert({
      group_id: active.id, invitee_id: friendId, inviter_id: user.id,
    });
    if (error) toast.error(error.message); else toast.success("Invite sent");
  };

  const respondInvite = async (inv: Invite, accept: boolean) => {
    if (!user) return;
    if (accept) {
      await supabase.from("study_group_members").insert({ group_id: inv.group_id, user_id: user.id });
      await supabase.from("study_group_invites").update({ status: "accepted" }).eq("id", inv.id);
      toast.success("Joined group");
      loadGroups();
    } else {
      await supabase.from("study_group_invites").update({ status: "declined" }).eq("id", inv.id);
    }
    loadInvites();
  };

  /* ------- NOVA CLUE MODE ------- */
  const askClue = async () => {
    if (!clueTopic.trim()) { toast.error("Tell Nova your topic"); return; }
    setClueBusy(true); setClueText("");
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          system: `You are Nova in CLUE MODE. The student is studying a topic and you must NEVER give the answer outright. Give 3 short progressive clues that nudge them toward discovering the answer themselves. Use a numbered list. End with one short reflection question. Be encouraging.`,
          messages: [{ role: "user", content: `My topic: ${clueTopic}` }],
        }),
      });
      if (!resp.ok || !resp.body) throw new Error();
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = ""; let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const c = JSON.parse(json).choices?.[0]?.delta?.content;
            if (c) setClueText(prev => prev + c);
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch { toast.error("Nova couldn't respond"); }
    finally { setClueBusy(false); }
  };

  /* ------- VOICE CALL (WebRTC mesh) ------- */
  const ensureLocalStream = async () => {
    if (localStream.current) return localStream.current;
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStream.current = s;
    return s;
  };

  const createPeer = (otherId: string, callId: string, initiator: boolean) => {
    if (peers.current[otherId]) return peers.current[otherId];
    const pc = new RTCPeerConnection(ICE);
    peers.current[otherId] = pc;
    localStream.current?.getTracks().forEach(t => pc.addTrack(t, localStream.current!));
    pc.onicecandidate = (e) => {
      if (e.candidate && user) {
        supabase.from("voice_signals").insert({
          call_id: callId, from_user: user.id, to_user: otherId,
          payload: { kind: "ice", candidate: e.candidate.toJSON() },
        });
      }
    };
    pc.ontrack = (e) => {
      let el = audioEls.current[otherId];
      if (!el) {
        el = document.createElement("audio");
        el.autoplay = true;
        document.body.appendChild(el);
        audioEls.current[otherId] = el;
      }
      el.srcObject = e.streams[0];
    };
    if (initiator) {
      pc.createOffer().then(o => pc.setLocalDescription(o).then(() => {
        if (!user) return;
        supabase.from("voice_signals").insert({
          call_id: callId, from_user: user.id, to_user: otherId,
          payload: { kind: "offer", sdp: pc.localDescription },
        });
      }));
    }
    return pc;
  };

  const cleanupCall = async () => {
    Object.values(peers.current).forEach(pc => pc.close());
    peers.current = {};
    Object.values(audioEls.current).forEach(el => { el.srcObject = null; el.remove(); });
    audioEls.current = {};
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    setInCall(false); setCallPeers([]); setMuted(false);
  };

  const joinCall = async () => {
    if (!active || !user) return;
    try {
      let activeCall = call;
      if (!activeCall) {
        const { data, error } = await supabase.from("voice_calls").insert({
          group_id: active.id, started_by: user.id, active: true,
        }).select().single();
        if (error) { toast.error(error.message); return; }
        activeCall = data as Call; setCall(activeCall);
      }
      await ensureLocalStream();
      await supabase.from("voice_call_participants").insert({ call_id: activeCall.id, user_id: user.id });
      setInCall(true);

      // Get current participants and start peer connections
      const { data: parts } = await supabase.from("voice_call_participants")
        .select("user_id").eq("call_id", activeCall.id).is("left_at", null);
      const others = (parts ?? []).map((p: any) => p.user_id).filter((id: string) => id !== user.id);
      setCallPeers(others);
      others.forEach(id => createPeer(id, activeCall!.id, true));
    } catch (e: any) {
      toast.error("Couldn't access mic");
      console.error(e);
    }
  };

  const leaveCall = async () => {
    if (!call || !user) { cleanupCall(); return; }
    await supabase.from("voice_call_participants").update({ left_at: new Date().toISOString() }).eq("call_id", call.id).eq("user_id", user.id);
    // If owner & last person, end the call
    const { data: remain } = await supabase.from("voice_call_participants").select("id").eq("call_id", call.id).is("left_at", null);
    if (!remain || remain.length === 0) {
      await supabase.from("voice_calls").update({ active: false }).eq("id", call.id);
    }
    await cleanupCall();
  };

  // Signaling channel for active call
  useEffect(() => {
    if (!inCall || !call || !user) return;
    const ch = supabase.channel(`call:${call.id}:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "voice_signals", filter: `to_user=eq.${user.id}` },
        async (p) => {
          const row = p.new as any;
          if (row.call_id !== call.id) return;
          const from = row.from_user as string;
          const payload = row.payload;
          let pc = peers.current[from];
          if (!pc) pc = createPeer(from, call.id, false);
          try {
            if (payload.kind === "offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              const ans = await pc.createAnswer();
              await pc.setLocalDescription(ans);
              await supabase.from("voice_signals").insert({
                call_id: call.id, from_user: user.id, to_user: from,
                payload: { kind: "answer", sdp: pc.localDescription },
              });
              setCallPeers(prev => prev.includes(from) ? prev : [...prev, from]);
            } else if (payload.kind === "answer") {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            } else if (payload.kind === "ice") {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            }
          } catch (e) { console.error("signal err", e); }
          await supabase.from("voice_signals").delete().eq("id", row.id);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "voice_call_participants", filter: `call_id=eq.${call.id}` },
        (p) => {
          const row = p.new as any;
          if (row.left_at) {
            peers.current[row.user_id]?.close();
            delete peers.current[row.user_id];
            audioEls.current[row.user_id]?.remove();
            delete audioEls.current[row.user_id];
            setCallPeers(prev => prev.filter(x => x !== row.user_id));
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [inCall, call?.id, user?.id]);

  const toggleMute = () => {
    if (!localStream.current) return;
    const next = !muted;
    localStream.current.getAudioTracks().forEach(t => t.enabled = !next);
    setMuted(next);
  };

  const memberMap = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members]);

  return (
    <AppLayout>
      <div className="flex h-screen">
        {/* Sidebar */}
        <aside className="w-72 glass border-r border-border/30 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg text-gradient flex items-center gap-2"><BookOpen className="h-5 w-5" />Study</h2>
            <Button size="icon" variant="ghost" onClick={() => setOpenCreate(true)} title="Create group"><Plus className="h-4 w-4" /></Button>
          </div>

          {invites.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-1">Invites · {invites.length}</p>
              <div className="space-y-2">
                {invites.map(i => (
                  <div key={i.id} className="glass rounded-xl p-2 text-xs">
                    <p className="font-medium truncate mb-1">{groupNames[i.group_id] || "Group"}</p>
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 flex-1 bg-gradient-primary text-primary-foreground" onClick={() => respondInvite(i, true)}>Accept</Button>
                      <Button size="sm" variant="outline" className="h-7" onClick={() => respondInvite(i, false)}>X</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-1">Your groups</p>
          {groups.length === 0 && <p className="text-xs text-muted-foreground px-1">No groups yet. Create one to start.</p>}
          <div className="space-y-1">
            {groups.map(g => (
              <button key={g.id} onClick={() => setActive(g)}
                className={cn("w-full text-left rounded-xl px-3 py-2 transition-all",
                  active?.id === g.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-secondary/60")}>
                <p className="font-medium text-sm truncate flex items-center gap-1">
                  {g.owner_id === user?.id && <Crown className="h-3 w-3" />}{g.name}
                </p>
                {g.topic && <p className="text-xs opacity-70 truncate">{g.topic}</p>}
              </button>
            ))}
          </div>
        </aside>

        <section className="flex-1 flex flex-col">
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <BookOpen className="h-12 w-12 opacity-40" />
              <p>Select or create a study group</p>
              <Button onClick={() => setClueOpen(true)} variant="outline"><Sparkles className="h-4 w-4 mr-1" />Ask Nova for clues</Button>
            </div>
          ) : (
            <>
              <header className="px-6 py-4 border-b border-border/30 glass flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{active.name}</p>
                  {active.topic && <p className="text-xs text-muted-foreground truncate">📚 {active.topic}</p>}
                  <p className="text-[10px] text-muted-foreground">{members.length} member{members.length !== 1 ? "s" : ""}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setClueOpen(true)}><Sparkles className="h-4 w-4 mr-1" />Clues</Button>
                {active.owner_id === user?.id && (
                  <Button size="sm" variant="outline" onClick={() => setOpenInvite(true)}><UserPlus className="h-4 w-4 mr-1" />Invite</Button>
                )}
                {!inCall ? (
                  <Button size="sm" className="bg-gradient-primary text-primary-foreground" onClick={joinCall}>
                    <Phone className="h-4 w-4 mr-1" />{call ? "Join call" : "Start call"}
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={toggleMute}>
                      {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={leaveCall}>
                      <PhoneOff className="h-4 w-4 mr-1" />Leave
                    </Button>
                    <Badge variant="outline" className="text-[10px]">In call · {callPeers.length + 1}</Badge>
                  </>
                )}
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {messages.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">No messages yet. Say hi 👋</p>}
                {messages.map(m => {
                  const mine = m.sender_id === user?.id;
                  const sender = memberMap[m.sender_id];
                  return (
                    <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                      {!mine && <p className="text-[10px] text-muted-foreground px-2 mb-0.5">{sender?.display_name || sender?.username || "user"}</p>}
                      <div className={cn("max-w-[70%] rounded-2xl px-4 py-2 animate-fade-in",
                        mine ? "bg-gradient-primary text-primary-foreground" : "bg-secondary text-foreground")}>{m.content}</div>
                    </div>
                  );
                })}
                <div ref={bottom} />
              </div>

              <div className="p-4 border-t border-border/30 glass flex gap-2">
                <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMsg()} placeholder="Message group…" />
                <Button onClick={sendMsg} className="bg-gradient-primary text-primary-foreground"><Send className="h-4 w-4" /></Button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Create */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New study group</DialogTitle></DialogHeader>
          <Input placeholder="Group name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input placeholder="Topic (optional)" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button onClick={createGroup} className="bg-gradient-primary text-primary-foreground">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite */}
      <Dialog open={openInvite} onOpenChange={setOpenInvite}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite friends to {active?.name}</DialogTitle></DialogHeader>
          {friends.length === 0 ? <p className="text-sm text-muted-foreground">Add friends first.</p> : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {friends.map(f => {
                const already = members.some(m => m.id === f.id);
                return (
                  <div key={f.id} className="flex items-center gap-2 glass rounded-xl p-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                      {(f.display_name || f.username)[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.display_name || f.username}</p>
                      <p className="text-xs text-muted-foreground truncate">@{f.username}</p>
                    </div>
                    <Button size="sm" disabled={already} onClick={() => inviteFriend(f.id)}>
                      {already ? "In" : "Invite"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Nova Clue Mode */}
      <Dialog open={clueOpen} onOpenChange={(o) => { setClueOpen(o); if (!o) { setClueText(""); setClueTopic(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Nova · Clue mode</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Tell Nova your topic. She'll give clues — never the answer.</p>
          <div className="flex gap-2">
            <Input value={clueTopic} onChange={(e) => setClueTopic(e.target.value)} placeholder="e.g. photosynthesis, quadratic formula…" onKeyDown={(e) => e.key === "Enter" && askClue()} />
            <Button onClick={askClue} disabled={clueBusy} className="bg-gradient-primary text-primary-foreground">
              {clueBusy ? "…" : "Get clues"}
            </Button>
          </div>
          {clueText && (
            <div className="glass rounded-xl p-3 text-sm whitespace-pre-wrap max-h-80 overflow-y-auto">{clueText}</div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Study;
