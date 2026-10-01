import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TONES = {
  professional: "professional, courteous and polished",
  friendly: "warm, friendly and personal",
  funny: "light-hearted and witty, with gentle humor that never mocks the guest",
} as const;

type Tone = keyof typeof TONES;

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) return NextResponse.json({ replies: ["Error: GEMINI_API_KEY environment variable is not configured on Netlify."] }, { status: 200 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ replies: ["Error: Invalid JSON payload received."] }, { status: 200 }); }

  const review = typeof body.review === "string" ? body.review.trim() : "";
  const tone: Tone = typeof body.tone === "string" && body.tone in TONES ? (body.tone as Tone) : "professional";
  const restaurant = typeof body.restaurant === "string" ? body.restaurant.trim().slice(0, 100) : "";

  if (!review) return NextResponse.json({ replies: ["Please paste a customer review text first."] }, { status: 200 });

  const SYSTEM_PROMPT = "You are an expert at writing public replies from restaurant owners to Google reviews. Rules: Thank reviewer, reference details, apologize sincerely for negatives, show appreciation for positives.";
  const prompt = `${SYSTEM_PROMPT}\n\nRestaurant: ${restaurant}\nTone: ${TONES[tone]}\n\nReview:\n"""\n${review}\n"""`;

  try {
    const res = await fetch(`https://googleapis.com{apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.9, 
          responseMimeType: "application/json",
          // FORCE the Gemini engine to output your exact JSON shape
          responseSchema: {
            type: "OBJECT",
            properties: {
              replies: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "List of 3 generated review replies"
              }
            },
            required: ["replies"]
          }
        }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      const errMsg = err?.error?.message || `HTTP ${res.status}`;
      return NextResponse.json({ replies: [`API Error: ${errMsg}`, "Please check your Gemini API key restrictions.", "Ensure your billing or tier limit isn't exceeded."] }, { status: 200 });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return NextResponse.json({ replies: ["Error: Received empty text from AI.", "Try submitting again.", "Verify your prompt context."] }, { status: 200 });
    }

    const p = JSON.parse(text);
    return NextResponse.json({ replies: (p.replies || []).slice(0, 3) });

  } catch (e: any) {
    return NextResponse.json({ replies: [`Server Error: ${e.message || "Unknown internal error"}`, "Check your Netlify function logs.", "Retry the generation process."] }, { status: 200 });
  }
}
