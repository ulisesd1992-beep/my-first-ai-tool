import { NextResponse } from "next/server";
import https from "https";

export const runtime = "nodejs";

const TONES = {
  professional: "professional, courteous and polished",
  friendly: "warm, friendly and personal",
  funny: "light-hearted and witty, with gentle humor that never mocks the guest",
} as const;

type Tone = keyof typeof TONES;

// Safe helper function to perform the POST request using Node's native HTTPS module
function nativeHttpsPost(url: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP status ${res.statusCode}: ${data}`));
          }
        });
      }
    );

    req.on("error", (err) => { reject(err); });
    req.write(body);
    req.end();
  });
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      replies: [
        { en: "Error: GEMINI_API_KEY environment variable is not configured.", es: "Error: La variable de entorno GEMINI_API_KEY no está configurada." },
        { en: "Please check your Netlify dashboard settings.", es: "Por favor verifique la configuración de su panel de Netlify." },
        { en: "Ensure your API key is active.", es: "Asegúrese de que su clave API esté activa." }
      ]
    }, { status: 200 });
  }

  let body: any;
  try { 
    body = await req.json(); 
  } catch { 
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); 
  }

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

  const requestBody = JSON.stringify({
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
  });

  try {
    const apiUrl = `https://googleapis.com{apiKey}`;
    const responseText = await nativeHttpsPost(apiUrl, requestBody);

    const data = JSON.parse(responseText);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return NextResponse.json({
        replies: [
          { en: "Received an empty string response from the AI backend.", es: "Se recibió una respuesta vacía del backend de IA." },
          { en: "Please try submitting the form again.", es: "Por favor, intente enviar el formulario de nuevo." },
          { en: "Review your input text parameters.", es: "Revise los parámetros de su texto de entrada." }
        ]
      }, { status: 200 });
    }

    const p = JSON.parse(text);
    const parsedReplies = Array.isArray(p?.replies) ? p.replies : [];
    
    return NextResponse.json({ replies: parsedReplies.slice(0, 3) });

  } catch (e: any) {
    return NextResponse.json({
      replies: [
        { en: `Network Connection Error: ${e?.message || "Unknown proxy failure"}`, es: `Error de conexión de red: ${e?.message || "Fallo proxy desconocido"}` },
        { en: "Verify that Netlify outbound connection ports aren't blocked.", es: "Verifique que los puertos de conexión de Netlify no estén bloqueados." },
        { en: "Confirm your Gemini API key status and billing limits.", es: "Confirme el estado de su clave API de Gemini y sus límites de facturación." }
      ]
    }, { status: 200 });
  }
}
