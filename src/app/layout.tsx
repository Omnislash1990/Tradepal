import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { appUrl } from "@/lib/server/app-url";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "Tradepal — Your building materials, sorted.", template: "%s · Tradepal" },
  description:
    "AI-powered building materials for tradespeople and DIY, starting in the West Midlands. Search, estimate quantities and order online.",
  applicationName: "Tradepal",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "Tradepal",
    description: "Your building materials, sorted.",
    locale: "en_GB",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1769D2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${inter.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white font-sans text-ink-900">{children}</body>
    </html>
  );
}
