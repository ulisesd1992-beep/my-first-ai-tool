import { NextResponse } from "next/server";
export const runtime = "nodejs";
const TONES = {
  professional: "professional, courteous and polished",
  friendly: "warm, friendly and personal",
  funny: "light-hearted and witty, with gentle humor that never mocks the guest",
} as const;
type Tone = keyof typeof TONES;
export type Reply = { en: string; es: string };
const SYSTEM_PROMPT = `You are an expert at writing public replies from restaurant owners to Google reviews.
Rules:
- Thank the reviewer and reference specific details they mentioned.
- For negative reviews: apologize sincerely, don't argue, invite them to get in touch or come back.
- For positive reviews: show genuine appreciation and invite them back.
- Keep each reply 2-4 sentences. No hashtags. Don't invent facts.
- Write three clearly different variations.
- Each variation has an English version and a natural Spanish version.
Respond ONLY with JSON: {"replies":[{"en":"...","es":"..."},{"en":"...","es":"..."}]}`;

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY is not set in Netlify." }, { status: 500 });
  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const review = typeof body.review === "string"? body.review.trim() : "";
  const tone: Tone = typeof body.tone === "string" && body.tone in TONES? (body.tone as Tone) : "professional";
  const restaurant = typeof body.restaurant === "string"? body.restaurant.trim().slice(0, 100) : "";
  if (!review) return NextResponse.json({ error: "Please paste a review first." }, { status: 400 });
  const userPrompt = [restaurant? `Restaurant name: ${restaurant}` : null, `Tone: ${TONES[tone]}`, `Review:\n"""\n${review}\n"""`].filter(Boolean).join("\n\n");
  const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: fullPrompt }] }], generationConfig: { temperature: 0.9, responseMimeType: "application/json" } }),
  });
  if (!res.ok) { const detail = await res.json().catch(() => null); return NextResponse.json({ error: detail?.error?.message || `Gemini failed ${res.status}` }, { status: 502 }); }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  try { const parsed = JSON.parse(text); const replies = (parsed.replies?? []).filter((r: any) => typeof r?.en === "string" && typeof r?.es === "string").slice(0,3); return NextResponse.json({ replies }); }
  catch { return NextResponse.json({ error: "Couldn't parse AI response." }, { status: 502 }); }
}
