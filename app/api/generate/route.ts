import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TONES = {
  professional: "professional, courteous and polished",
  friendly: "warm, friendly and personal",
  funny: "light-hearted and witty, with gentle humor that never mocks the guest",
} as const;

type Tone = keyof typeof TONES;
export type Reply = { en: string; es: string };

export async function POST(req: Request) {
  let body: { review?: unknown; tone?: unknown; restaurant?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const review = typeof body.review === "string"? body.review.trim() : "";
  const tone: Tone = typeof body.tone === "string" && body.tone in TONES? (body.tone as Tone) : "professional";
  const restaurant = typeof body.restaurant === "string"? body.restaurant.trim().slice(0, 100) : "";

  if (!review) {
    return NextResponse.json({ error: "Please paste a review first." }, { status: 400 });
  }
  if (review.length > 5000) {
    return NextResponse.json({ error: "Review is too long (max 5000 characters)." }, { status: 400 });
  }

  const rName = restaurant || "our restaurant";

  // No OpenAI call - free templates that feel real
  const allReplies: Record<Tone, Reply[]> = {
    professional: [
      { en: `Thank you for sharing your experience at ${rName}. We appreciate your kind words and are glad you enjoyed your visit.`, es: `Gracias por compartir tu experiencia en ${rName}. Agradecemos tus amables palabras y nos alegra que hayas disfrutado tu visita.` },
      { en: `We truly appreciate your feedback about ${rName}. Thank you for taking the time to share it, and we hope to welcome you back soon.`, es: `Agradecemos mucho tus comentarios sobre ${rName}. Gracias por tomarte el tiempo de compartirlos y esperamos darte la bienvenida pronto.` },
      { en: `Thank you for choosing ${rName}! We're delighted to hear you had a great experience and look forward to serving you again.`, es: `¡Gracias por elegir ${rName}! Nos alegra saber que tuviste una gran experiencia y esperamos atenderte nuevamente.` },
    ],
    friendly: [
      { en: `Wow, you just made our day at ${rName}! Thank you so much for the lovely review - we're so happy you loved it.`, es: `¡Wow, nos acabas de alegrar el día en ${rName}! Muchas gracias por la hermosa reseña, nos alegra mucho que te haya encantado.` },
      { en: `This means the world to us at ${rName}! Thanks for the love and we can't wait to see you again soon!`, es: `¡Esto significa mucho para nosotros en ${rName}! ¡Gracias por el cariño y no podemos esperar a verte pronto de nuevo!` },
      { en: `You're amazing - thank you! So glad ${rName} made you happy. Come back anytime!`, es: `¡Eres increíble, gracias! Nos alegra que ${rName} te haya hecho feliz. ¡Vuelve cuando quieras!` },
    ],
    funny: [
      { en: `We're officially framing this review at ${rName}! Thanks for the epic feedback - our team is doing a happy dance right now.`, es: `¡Oficialmente vamos a enmarcar esta reseña en ${rName}! Gracias por el comentario épico, nuestro equipo está bailando de felicidad.` },
      { en: `Stop it, you're making us blush at ${rName}! Thanks for the love - come back before we eat all the good stuff ourselves!`, es: `¡Para, nos haces sonrojar en ${rName}! Gracias por el cariño, ¡vuelve antes de que nos comamos todo lo bueno nosotros!` },
      { en: `Best review ever at ${rName}! Thanks a million - you rock and we owe you a coffee next time!`, es: `¡La mejor reseña de todas en ${rName}! ¡Muchísimas gracias, eres lo máximo y te debemos un café la próxima vez!` },
    ],
  };

  const replies = allReplies[tone];
  return NextResponse.json({ replies });
}
