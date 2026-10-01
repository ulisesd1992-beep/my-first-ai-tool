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
- For negative reviews: apologize sincerely, don't argue or make excuses, and invite them to get in touch or come back.
- For positive reviews: show genuine appreciation and invite them back.
- Keep each reply 2-4 sentences. No hashtags. Don't invent facts (names, dishes, policies) not in the review.
- Write three clearly different variations.
- Each variation has an English version and a natural Spanish version (not a literal translation).
Respond ONLY with JSON of the shape: {"replies":[{"en":"...","es":"..."},{"en":"...","es":"..."},{"en":"...","es":"..."}]}`;

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "sk-your-key-here") {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server." },
      { status: 500 },
    );
  }

  let body: { review?: unknown; tone?: unknown; restaurant?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const review = typeof body.review === "string" ? body.review.trim() : "";
  const tone: Tone = typeof body.tone === "string" && body.tone in TONES ? (body.tone as Tone) : "professional";
  const restaurant = typeof body.restaurant === "string" ? body.restaurant.trim().slice(0, 100) : "";

  if (!review) {
    return NextResponse.json({ error: "Please paste a review first." }, { status: 400 });
  }
  if (review.length > 5000) {
    return NextResponse.json({ error: "Review is too long (max 5000 characters)." }, { status: 400 });
  }

  const userPrompt = [
    restaurant ? `Restaurant name: ${restaurant}` : null,
    `Tone: ${TONES[tone]}`,
    `Review:\n"""\n${review}\n"""`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.9,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    const message = detail?.error?.message ?? `OpenAI request failed (${res.status}).`;
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const data = await res.json();
  try {
    const parsed = JSON.parse(data.choices[0].message.content);
    const replies: Reply[] = (parsed.replies ?? [])
      .filter((r: Reply) => typeof r?.en === "string" && typeof r?.es === "string")
      .slice(0, 3);
    if (replies.length === 0) throw new Error("empty");
    return NextResponse.json({ replies });
  } catch {
    return NextResponse.json({ error: "Couldn't parse the AI response. Please try again." }, { status: 502 });
  }
}
