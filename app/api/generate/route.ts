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

  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const review = typeof body.review === "string" ? body.review.trim() : "";
  const tone: Tone = typeof body.tone === "string" && body.tone in TONES ? (body.tone as Tone) : "professional";
  const restaurant = typeof body.restaurant === "string" ? body.restaurant.trim().slice(0, 100) : "";

  if (!review) return NextResponse.json({ error: "Please paste a review first." }, { status: 400 });

  // UPDATED: Strict system instructions to enforce JSON output format
  const SYSTEM_PROMPT = "You are an expert at writing public replies from restaurant owners to Google reviews. Rules: Thank reviewer, reference details, apologize sincerely for negatives, show appreciation for positives. You MUST respond with a JSON object containing a 'replies' key with an array of 3 strings.";
  const prompt = `${SYSTEM_PROMPT}\n\nRestaurant: ${restaurant}\nTone: ${TONES[tone]}\n\nReview:\n"""\n${review}\n"""`;

  const res = await fetch(`https://googleapis.com{apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { 
        temperature: 0.9, 
        responseMimeType: "application/json"
      }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    return NextResponse.json({ error: err?.error?.message || `Gemini error: ${res.status}` }, { status: 500 });
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return NextResponse.json({ error: "Empty response from AI" }, { status: 502 });
  }

  try {
    const p = JSON.parse(text);
    if (!p.replies || !Array.isArray(p.replies)) {
      return NextResponse.json({ error: "Invalid JSON structure from AI" }, { status: 502 });
    }
    return NextResponse.json({ replies: p.replies.slice(0, 3) });
  } catch {
    return NextResponse.json({ error: "Parse failed" }, { status: 502 });
  }
}
