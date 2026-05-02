import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--next-font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--next-font-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--next-font-display",
  weight: "400",
  style: "italic",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StrategyForge — Autonomous DeFi Strategy Agent",
  description: "Self-learning DeFi automation agent that generates, deploys, and improves KeeperHub workflows using LLM reasoning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full`}>
      <body className="min-h-full flex flex-col relative" data-theme="dark" style={{
        backgroundImage: `
          radial-gradient(circle at 14% 4%, rgba(var(--accent-glow), 0.16) 0%, transparent 28%),
          radial-gradient(circle at 88% 88%, rgba(227,169,74,0.12) 0%, transparent 24%),
          linear-gradient(180deg, var(--landing-page-bg) 0%, color-mix(in srgb, var(--landing-page-bg) 80%, var(--bg-0) 20%) 100%)
        `
      }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(to right, var(--landing-grid) 1px, transparent 1px),
              linear-gradient(to bottom, var(--landing-grid) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
            opacity: 0.26,
            pointerEvents: 'none',
          }}
        />
        <Toaster theme="dark" position="top-right" />
        <div className="relative z-10 flex flex-col min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
