import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChequeMind Scanner",
  description: "Cheque OCR benchmark comparing Gemini 3.1 Flash-Lite vs Gemini 2.5 Flash.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
