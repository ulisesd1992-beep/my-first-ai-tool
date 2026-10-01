import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TONES = {
  professional: "professional, courteous and polished",
  friendly: "warm, friendly and personal",
  funny: "light-hearted and witty, with gentle humor that never mocks the guest",
} as const;

type Tone = keyof typeof TONES;

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

  if (!apiKey || apiKey.trim() === "") {
    return NextResponse.json({
      replies: [
        { en: "Setup Error: GEMINI_API_KEY is missing in your Netlify Environment Variables settings.", es: "Error de configuración: falta GEMINI_API_KEY en la configuración de Netlify." },
        { en: "Go to Netlify Dashboard -> Site Configuration -> Environment Variables to add it.", es: "Vaya al Panel de Netlify -> Configuración del sitio -> Variables de entorno para agregarlo." },
        { en: "Ensure you trigger a fresh deployment after saving your key values.", es: "Asegúrese de activar un nuevo despliegue después de guardar los valores de su clave." }
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
    const targetUrl = new URL("https://googleapis.com");
    targetUrl.searchParams.set("key", apiKey.trim());

    const res = await fetch(targetUrl.toString(), {
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
          { en: `Gemini API Denied Request: ${errMsg}`, es: `La API de Gemini rechazó la solicitud: ${errMsg}` },
          { en: "Verify your API Key permissions and project restrictions inside Google AI Studio.", es: "Verifique los permisos de su clave API y las restricciones del proyecto en Google AI Studio." },
          { en: "Check if your payment profile or free usage tier limits have expired.", es: "Compruebe si su perfil de pago o los límites del nivel de uso gratuito han expirado." }
        ]
      }, { status: 200 });
    }

    const data: any = await res.json();
    const text = data?.candidates?.?.content?.parts?.?.text;

    if (!text) {
      return NextResponse.json({
        replies: [
          { en: "Empty data layout received from model configuration.", es: "Se recibió un diseño de datos vacío de la configuración del modelo." },
          { en: "Please retry your submission directly.", es: "Por favor, reintente su envío directamente." },
          { en: "Review input parameters if this error persists.", es: "Revise los parámetros de entrada si este error persiste." }
        ]
      }, { status: 200 });
    }

    const p = JSON.parse(text);
    return NextResponse.json({ replies: (p?.replies || []).slice(0, 3) });

  } catch (e: any) {
    return NextResponse.json({
      replies: [
        { en: `App Exception Encountered: ${e?.message || "Unknown error context"}`, es: `Se encontró una excepción en la aplicación: ${e?.message || "Contexto de error desconocido"}` },
        { en: "Ensure your runtime environments match across standard systems.", es: "Asegúrese de que sus entornos de ejecución coincidan en los sistemas estándar." },
        { en: "Retry generating responses in a fresh dashboard window.", es: "Reintente generar respuestas en una ventana nueva del panel." }
      ]
    }, { status: 200 });
  }
}
