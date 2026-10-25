import type { Metadata } from "next";
import "./globals.css";
import { getLang } from "@/lib/i18n";

export const metadata: Metadata = { title: "World Teams", description: "Global recruiting: la IA sugiere, las personas deciden." };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={await getLang()}>
      <body>{children}</body>
    </html>
  );
}
