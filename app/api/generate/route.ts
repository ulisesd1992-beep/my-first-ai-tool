import { NextResponse } from "next/server";
import https from "https";

export const runtime = "nodejs";

const TONES = {
  professional: "professional, courteous and polished",
  friendly: "warm, friendly and personal",
  funny: "light-hearted and witty, with gentle humor that never mocks the guest",
} as const;

type Tone = keyof typeof TONES;

// Native helper to bypass Netlify fetch network proxy restrictions
function requestAI(apiKey: string, promptData: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: promptData }] }],
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
    });

    const req = https.request(
      `https://googleapis.com{apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let chunkData = "";
        res.on("data", (chunk) => { chunkData += chunk; });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(chunkData);
          } else {
            reject(new Error(`Status ${res.statusCode}: ${chunkData}`));
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

export async function POST(req: Request) {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();

  if (!apiKey) {
    return NextResponse.json({
      replies: [
        { en: "Setup Error: GEMINI_API_KEY is missing on Netlify environment variables.", es: "Error: Falta GEMINI_API_KEY en variables de entorno." },
        { en: "Please configure your environment variables.", es: "Configure sus variables de entorno." },
        { en: "Trigger a fresh deployment afterwards.", es: "Active un nuevo despliegue después." }
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
    const rawResponse = await requestAI(apiKey, prompt);
    const data = JSON.parse(rawResponse);
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

    const parsedJson = JSON.parse(text);
    return NextResponse.json({ replies: (parsedJson?.replies || []).slice(0, 3) });

  } catch (e: any) {
    return NextResponse.json({
      replies: [
        { en: `Network Connection Error: ${e?.message || "Internal failure"}`, es: `Error de conexión: ${e?.message || "Fallo interno"}` },
        { en: "Check your Netlify outbound network security rules.", es: "Revise las reglas de red de Netlify." },
        { en: "Verify your API billing tier setup.", es: "Verifique su plan de facturación de la API." }
      ]
    }, { status: 200 });
  }
}
