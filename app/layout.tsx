import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Review Responder — AI replies to Google reviews",
  description:
    "Paste a Google review, get three ready-to-post replies in English and Spanish.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}
