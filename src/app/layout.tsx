import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/shell/BottomNav";
import { DemoBanner } from "@/components/shell/DemoBanner";

export const metadata: Metadata = {
  title: "taxfix — AI Tax Assistant (Prototype)",
  description:
    "Prototype assistant that determines German VAT treatment and generates a compliant invoice. Demo only.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-tf-surface shadow-sm sm:my-4 sm:min-h-[calc(100dvh-2rem)] sm:rounded-tf-lg">
          <DemoBanner />
          <main className="flex-1 px-5 pb-28 pt-4">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
