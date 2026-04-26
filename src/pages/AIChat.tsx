import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bot, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const AIChat = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || busy) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next }),
      });

      if (resp.status === 429) { toast.error("Slow down — rate limited."); setBusy(false); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted."); setBusy(false); return; }
      if (!resp.ok || !resp.body) throw new Error("Failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let assistant = "";
      let done = false;
      setMessages([...next, { role: "assistant", content: "" }]);

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, i);
          buf = buf.slice(i + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (c) {
              assistant += c;
              setMessages((prev) => prev.map((m, idx) => idx === prev.length - 1 ? { ...m, content: assistant } : m));
            }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e) {
      toast.error("AI failed to respond");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-screen max-w-3xl mx-auto px-6">
        <header className="py-6 flex items-center gap-3 animate-fade-in">
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Bot className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gradient">Nova</h1>
            <p className="text-xs text-muted-foreground">Your AI sidekick · powered by Lovable AI</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-20 text-muted-foreground animate-fade-in">
              <Sparkles className="h-10 w-10 mx-auto mb-3 text-primary" />
              <p>Ask Nova anything to get started.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 whitespace-pre-wrap animate-fade-in",
                m.role === "user" ? "bg-gradient-primary text-primary-foreground" : "glass"
              )}>
                {m.content || (busy ? "…" : "")}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="py-4 flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message Nova…" disabled={busy} />
          <Button onClick={send} disabled={busy} className="bg-gradient-primary text-primary-foreground"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default AIChat;
