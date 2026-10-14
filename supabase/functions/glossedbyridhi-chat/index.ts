
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      throw new Error("Chatbot API key is not configured");
    }

    const { message, history = [] } = await req.json();

    if (typeof message !== "string" || !message.trim() || message.length > 1000) {
      return new Response(
        JSON.stringify({ error: "Enter a message under 1000 characters." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!Array.isArray(history)) {
      return new Response(
        JSON.stringify({ error: "Chat history must be a list of messages." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const recentHistory = history.slice(-10);
    if (
      recentHistory.some(
        (entry) =>
          !entry ||
          (entry.role !== "user" && entry.role !== "assistant") ||
          typeof entry.content !== "string" ||
          !entry.content.trim() ||
          entry.content.length > 1000,
      )
    ) {
      return new Response(
        JSON.stringify({ error: "Chat history contains an invalid message." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: `You are the friendly nail-art assistant for GlossedByRidhi.
Help customers explore nail-art styles, understand services, and prepare
for appointments. Be warm, concise, and honest. Never invent prices,
service availability, or appointment slots. If asked to book, explain
that you can guide them to the website's booking form, but do not claim
to have booked anything. Do not request payment details or passwords.`,
            }],
          },
          contents: [
            ...recentHistory.map((entry) => ({
              role: entry.role === "assistant" ? "model" : "user",
              parts: [{ text: entry.content.trim() }],
            })),
            { role: "user", parts: [{ text: message.trim() }] },
          ],
          generationConfig: { maxOutputTokens: 250 },
        }),
      },
    );

    if (!response.ok) {
  const errorDetails = await response.text();
  console.error("Gemini API error:", response.status, errorDetails);

  return new Response(
    JSON.stringify({
      error: "Gemini request failed",
      status: response.status,
      details: errorDetails,
    }),
    {
      status: 502,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

    const data = await response.json();
    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("") || "Sorry, I couldn't prepare a reply. Please try again.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Chatbot error:", error instanceof Error ? error.message : "Unknown error");

    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
