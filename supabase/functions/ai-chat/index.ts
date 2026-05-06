const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, system } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const systemPrompt = system && typeof system === "string" ? system : `You are Nova, a friendly, concise AI companion inside a social hub app called Nexus. Use markdown when helpful. Keep replies upbeat.

You can NAVIGATE the user when they ask you to open a site, go somewhere, or switch tabs. To do so, include a directive on its own line in your reply using EXACTLY this format:

[[NAVIGATE:<url-or-route>]]

Rules:
- Use a full https:// URL for external sites (e.g. [[NAVIGATE:https://www.google.com]]).
- Use an internal route for in-app tabs. Available routes: /, /friends, /chat, /ai, /games, /study.
- Tab name mapping: home -> /, friends -> /friends, chat/messages -> /chat, ai/nova -> /ai, games -> /games, study -> /study.
- Only emit the directive when the user clearly asks to open/go/visit/switch. Put it on its own line. Also include a short friendly confirmation message in your reply.
- Never invent fake URLs. If unsure which site they mean, ask first instead of navigating.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded, slow down a bit." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Lovable Cloud." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
