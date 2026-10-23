import type { Metadata } from "next";
import "./globals.css";
import { getLang } from "@/lib/i18n";

export const metadata: Metadata = { title: "Motor IA Recruiting", description: "Demo: búsqueda de candidatos con IA" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={await getLang()}>
      <body>{children}</body>
    </html>
  );
}
