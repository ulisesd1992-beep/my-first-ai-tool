"use client";

import { useEffect, useState } from "react";

type Tone = "professional" | "friendly" | "funny";
type Reply = { en: string; es: string };
type HistoryItem = {
  id: string;
  createdAt: number;
  review: string;
  tone: Tone;
  replies: Reply[];
};

const HISTORY_KEY = "review-responder-history";
const MAX_HISTORY = 20;

const TONES: { value: Tone; label: string; emoji: string }[] = [
  { value: "professional", label: "Professional", emoji: "👔" },
  { value: "friendly", label: "Friendly", emoji: "😊" },
  { value: "funny", label: "Funny", emoji: "😄" },
];

const SAMPLE =
  "Food was great, especially the tacos al pastor, but we waited 40 minutes for a table even with a reservation. Staff was nice about it though.";

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    // storage full or blocked — history is a convenience, ignore
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-secure contexts (e.g. LAN IP over http)
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition ${
        copied ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"
      }`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function ReplyCard({ reply, index }: { reply: Reply; index: number }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-orange-600">Option {index + 1}</p>
      <div className="space-y-4">
        {(["en", "es"] as const).map((lang) => (
          <div key={lang}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-stone-500">
                {lang === "en" ? "🇺🇸 English" : "🇪🇸 Español"}
              </span>
              <CopyButton text={reply[lang]} />
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{reply[lang]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [review, setReview] = useState("");
  const [restaurant, setRestaurant] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  async function generate() {
    if (!review.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review, tone, restaurant }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setReplies(data.replies);

      const item: HistoryItem = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        review: review.trim(),
        tone,
        replies: data.replies,
      };
      const next = [item, ...history].slice(0, MAX_HISTORY);
      setHistory(next);
      saveHistory(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function restore(item: HistoryItem) {
    setReview(item.review);
    setTone(item.tone);
    setReplies(item.replies);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeItem(id: string) {
    const next = history.filter((h) => h.id !== id);
    setHistory(next);
    saveHistory(next);
  }

  function clearHistory() {
    setHistory([]);
    saveHistory([]);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      {/* Hero */}
      <header className="mb-10 text-center">
        <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
          ⭐ For restaurants
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
          Reply to every Google review <span className="text-orange-600">in seconds</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-stone-600">
          Paste a review, pick a tone, and get three ready-to-post replies in English and Spanish.
        </p>
      </header>

      {/* Form */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="review" className="text-sm font-semibold">
            Customer review
          </label>
          <button onClick={() => setReview(SAMPLE)} className="text-xs text-orange-600 hover:underline">
            Try a sample
          </button>
        </div>
        <textarea
          id="review"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
          }}
          rows={6}
          maxLength={5000}
          placeholder="Paste the Google review here…"
          className="w-full resize-y rounded-lg border border-stone-300 p-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="restaurant" className="mb-1 block text-sm font-semibold">
              Restaurant name <span className="font-normal text-stone-400">(optional)</span>
            </label>
            <input
              id="restaurant"
              value={restaurant}
              onChange={(e) => setRestaurant(e.target.value)}
              placeholder="e.g. La Cocina de Rosa"
              className="w-full rounded-lg border border-stone-300 p-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-semibold">Tone</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tone">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  role="radio"
                  aria-checked={tone === t.value}
                  onClick={() => setTone(t.value)}
                  className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition ${
                    tone === t.value
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-stone-300 text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  <span className="mr-1">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={generate}
          disabled={loading || !review.trim()}
          className="mt-5 w-full rounded-lg bg-orange-600 px-4 py-3 font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Writing replies…" : "Generate 3 replies"}
        </button>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </section>

      {/* Results */}
      {replies.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold">Your replies</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {replies.map((r, i) => (
              <ReplyCard key={i} reply={r} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section className="mt-14">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">History</h2>
            <button onClick={clearHistory} className="text-sm text-stone-500 hover:text-red-600">
              Clear all
            </button>
          </div>
          <ul className="space-y-2">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white p-3 text-sm"
              >
                <button onClick={() => restore(h)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-stone-800">{h.review}</p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {TONES.find((t) => t.value === h.tone)?.label} · {new Date(h.createdAt).toLocaleString()}
                  </p>
                </button>
                <button
                  onClick={() => removeItem(h.id)}
                  aria-label="Delete from history"
                  className="text-stone-400 hover:text-red-600"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-16 text-center text-xs text-stone-400">
        Replies are AI-generated — give them a quick read before posting.
      </footer>
    </main>
  );
}
