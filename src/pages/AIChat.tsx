import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bot, Send, Sparkles, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NAV_RE = /\[\[NAVIGATE:([^\]]+)\]\]/g;

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "nexus.ai.history";

const AIChat = () => {
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();

  const handleNavigation = (raw: string) => {
    const target = raw.trim();
    if (!target) return;
    const internal = ["/", "/friends", "/chat", "/ai", "/games"];
    if (target.startsWith("http://") || target.startsWith("https://")) {
      toast(`Opening ${target}`);
      window.open(target, "_blank", "noopener,noreferrer");
    } else if (internal.includes(target)) {
      toast(`Switching to ${target}`);
      navigate(target);
    } else {
      toast.error(`Can't navigate to ${target}`);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setBusy(false);
    toast("Chat cleared");
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next }),
      });

      if (resp.status === 429) {
        toast.error("Slow down — rate limited.");
        setBusy(false);
        return;
      }
      if (resp.status === 402) {
        toast.error("AI credits exhausted. Add credits in workspace settings.");
        setBusy(false);
        return;
      }
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
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (c) {
              assistant += c;
              setMessages((prev) =>
                prev.map((m, idx) => (idx === prev.length - 1 ? { ...m, content: assistant } : m))
              );
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("AI failed to respond");
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const suggestions = [
    "Give me 3 fun ice-breaker questions",
    "Suggest a quick game to play with friends",
    "Write a short witty bio about me",
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-screen max-w-3xl mx-auto px-6">
        {/* Header */}
        <header className="py-6 flex items-center justify-between gap-3 animate-fade-in shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
              <Bot className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gradient truncate">Nova</h1>
              <p className="text-xs text-muted-foreground truncate">Your AI sidekick · powered by Lovable AI</p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="shrink-0">
              <Trash2 className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-16 animate-fade-in">
              <div className="h-16 w-16 rounded-3xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4">
                <Sparkles className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="text-xl font-bold mb-2">Hey, I'm Nova ✨</h2>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Ask me anything — ideas, questions, code, jokes. I remember our conversation.
              </p>
              <div className="grid gap-2 w-full max-w-md">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-left text-sm glass rounded-xl px-4 py-3 hover:bg-secondary/60 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const mine = m.role === "user";
            return (
              <div key={i} className={cn("flex gap-3 animate-fade-in", mine ? "justify-end" : "justify-start")}>
                {!mine && (
                  <div className="h-8 w-8 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0 shadow-glow">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3",
                    mine
                      ? "bg-gradient-primary text-primary-foreground"
                      : "glass text-foreground"
                  )}
                >
                  {mine ? (
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  ) : m.content ? (
                    <div className="prose prose-sm prose-invert max-w-none break-words [&_p]:my-1 [&_pre]:bg-secondary/60 [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:text-primary [&_a]:text-primary [&_ul]:my-1 [&_ol]:my-1">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children, ...props }) => (
                          <a
                            {...props}
                            href={href}
                            onClick={(e) => {
                              if (!href) return;
                              e.preventDefault();
                              window.open(href, "_blank", "noopener,noreferrer");
                            }}
                            className="text-primary underline cursor-pointer"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="inline-flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse [animation-delay:150ms]" />
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
                {mine && (
                  <div className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="py-4 shrink-0">
          <div className="flex gap-2 glass rounded-2xl p-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Message Nova…"
              disabled={busy}
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button
              onClick={send}
              disabled={busy || !input.trim()}
              size="icon"
              className="bg-gradient-primary text-primary-foreground shadow-glow shrink-0"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default AIChat;
