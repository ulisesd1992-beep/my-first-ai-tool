import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TONES = {
  professional: "professional, courteous and polished",
  friendly: "warm, friendly and personal",
  funny: "light-hearted and witty, with gentle humor that never mocks the guest",
} as const;

type Tone = keyof typeof TONES;

export async function POST(req: Request) {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();

  if (!apiKey) {
    return NextResponse.json({
      replies: [
        { en: "Setup Error: GEMINI_API_KEY is missing in your Netlify Environment Variables.", es: "Error: Falta GEMINI_API_KEY en Netlify." },
        { en: "Please add your key in the Netlify site dashboard.", es: "Por favor agregue su clave en el panel de Netlify." },
        { en: "Then trigger a fresh production deployment.", es: "Luego active un nuevo despliegue de producción." }
      ]
    }, { status: 200 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const review = typeof body?.review === "string" ? body.review.trim() : "";
  const tone: Tone = typeof body?.tone === "string" && body.tone in TONES ? (body.tone as Tone) : "professional";
  const restaurant = typeof body?.restaurant === "string" ? body.restaurant.trim().slice(0, 100) : "";

  if (!review) {
    return NextResponse.json({
      replies: [
        { en: "Please paste a customer review first.", es: "Por favor, pegue una reseña de un cliente primero." },
        { en: "The field cannot be blank.", es: "El campo no puede estar vacío." },
        { en: "Type something to generate a reply.", es: "Escriba algo para generar una respuesta." }
      ]
    }, { status: 200 });
  }

  const SYSTEM_PROMPT = "You are an expert at writing public replies from restaurant owners to Google reviews. Rules: Thank reviewer, reference details, apologize sincerely for negatives, show appreciation for positives. For each option, provide both an English version ('en') and a high-quality, professional Spanish translation ('es').";
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
          responseSchema: {
            type: "OBJECT",
            properties: {
              replies: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    en: { type: "STRING" },
                    es: { type: "STRING" }
                  },
                  required: ["en", "es"]
                }
              }
            },
            required: ["replies"]
          }
        }
      })
    });

    if (!res.ok) {
      const err: any = await res.json().catch(() => null);
      const errMsg = err?.error?.message || `HTTP ${res.status}`;
      return NextResponse.json({
        replies: [
          { en: `Gemini API Denied: ${errMsg}`, es: `API de Gemini Rechazada: ${errMsg}` },
          { en: "Check your API key restrictions inside Google AI Studio.", es: "Verifique las restricciones de su clave en Google AI Studio." },
          { en: "Verify your free usage limits are active.", es: "Verifique que sus límites de uso estén activos." }
        ]
      }, { status: 200 });
    }

    const data: any = await res.json();
    
    // TYPO FIXED: Clean safe path navigation
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return NextResponse.json({
        replies: [
          { en: "Empty data layout received from model configuration.", es: "Se recibió un diseño vacío." },
          { en: "Please retry your submission directly.", es: "Por favor reintente su envío directamente." },
          { en: "Check API dashboard if this persists.", es: "Revise el panel de la API si esto persiste." }
        ]
      }, { status: 200 });
    }

    const p = JSON.parse(text);
    return NextResponse.json({ replies: (p?.replies || []).slice(0, 3) });

  } catch (e: any) {
    return NextResponse.json({
      replies: [
        { en: `App Exception: ${e?.message || "Unknown error"}`, es: `Excepción: ${e?.message || "Error desconocido"}` },
        { en: "Ensure your environments match across standard systems.", es: "Asegúrese de la consistencia de los entornos." },
        { en: "Reload window and retry again.", es: "Recargue la ventana y vuelva a intentarlo." }
      ]
    }, { status: 200 });
  }
}
